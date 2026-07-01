import { NextResponse } from 'next/server';
import { CONTRACT_ID, ISSUER, SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';
import { cacheGet, cacheSet, cacheInvalidate } from '@/lib/cache';

const ASSET_CLASS_LABELS: Record<string, string> = {
  TreasuryBill: 'US Treasury Bill',
  CorporateBond: 'Corporate Bond',
  InvoiceReceivable: 'Invoice Receivable',
  CommodityToken: 'Commodity Token',
  CarbonCredit: 'Carbon Credit',
};

function scValSymbolFromXdr(b64: string): string {
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf[0] === 0x0e && buf[1] === 0x00 && buf[2] === 0x00) {
      const len = buf[3];
      return buf.slice(4, 4 + len).toString('ascii');
    }
    if (buf[0] === 0x0c) {
      const len = buf[2];
      const inner = buf.slice(3, 3 + len);
      if (inner[0] === 0x0e) {
        const symLen = inner[3];
        return inner.slice(4, 4 + symLen).toString('ascii');
      }
    }
    return '';
  } catch {
    return '';
  }
}

function scValU32FromXdr(b64: string): number {
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf[0] === 0x04) return buf.readUInt32BE(1);
    if (buf[0] === 0x0c && buf[2] >= 5) {
      const inner = buf.slice(3);
      if (inner[0] === 0x04) return inner.readUInt32BE(1);
    }
    return 0;
  } catch {
    return 0;
  }
}

async function getLatestLedger(): Promise<number> {
  try {
    const res = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger', params: {} }),
    });
    const data = await res.json();
    return data?.result?.sequence || 0;
  } catch {
    return 0;
  }
}

async function fetchAllMintEvents(startLedger: number): Promise<Map<number, { assetClass: string }>> {
  const assetMap = new Map<number, { assetClass: string }>();
  let cursor: string | undefined;
  let ledger = startLedger;

  for (let page = 0; page < 20; page++) {
    const res = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'getEvents',
        params: {
          startLedger: ledger,
          filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
          limit: 200,
          ...(cursor ? { cursor } : {}),
        },
      }),
    });
    const data = await res.json();
    const events: any[] = data?.result?.events || [];

    for (const e of events) {
      const topics: string[] = e.topic || [];
      const eventType = topics.length >= 1 ? scValSymbolFromXdr(topics[0]) : '';
      if (eventType !== 'mint') continue;

      const assetId = topics.length >= 2 ? scValU32FromXdr(topics[1]) : 0;
      if (!assetId) continue;

      let assetClass = 'TreasuryBill';
      const valueB64: string = e.value || '';
      if (valueB64) {
        try {
          const buf = Buffer.from(valueB64, 'base64');
          const hex = buf.toString('hex');
          for (const className of ['TreasuryBill', 'CorporateBond', 'InvoiceReceivable', 'CommodityToken', 'CarbonCredit']) {
            const classHex = Buffer.from(className, 'utf8').toString('hex');
            if (hex.includes(classHex)) {
              assetClass = className;
              break;
            }
          }
        } catch {}
      }

      if (!assetMap.has(assetId)) {
        assetMap.set(assetId, { assetClass });
      }
    }

    const cursorRaw = data?.result?.cursor;
    if (cursorRaw && events.length > 0) {
      cursor = cursorRaw;
    } else {
      break;
    }
  }

  return assetMap;
}

async function getAssetFromContract(assetId: number): Promise<{
  exists: boolean;
  faceValue: number;
  status: string;
  assetClass: string;
  maturityTimestamp: number;
  couponBps: number;
} | null> {
  const rpc = await import('@stellar/stellar-sdk').then(m => ({
    Server: m.rpc.Server,
    Contract: m.Contract,
    xdr: m.xdr,
    TransactionBuilder: m.TransactionBuilder,
  }));

  const rpcServer = new rpc.Server(SOROBAN_RPC_URL);
  const contract = new rpc.Contract(CONTRACT_ID);

  let sourceAccount: any;
  try {
    sourceAccount = await rpcServer.getAccount(ISSUER);
  } catch {
    await fetch(`https://friendbot.stellar.org/?addr=${ISSUER}`);
    sourceAccount = await rpcServer.getAccount(ISSUER);
  }

  const op = contract.call('get_asset', rpc.xdr.ScVal.scvU32(assetId));
  const tx = new rpc.TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(op).setTimeout(30).build();

  const simResult = await rpcServer.simulateTransaction(tx);
  if (!simResult || (simResult as any).error) return null;

  const returnVal = (simResult as any).result?.retval;
  if (!returnVal) return null;

  try {
    const mapEntries = returnVal.map ? returnVal.map() : null;
    if (!mapEntries) return null;

    const info: Record<string, any> = {};
    for (const entry of mapEntries) {
      const key = entry.key().switch().name === 'scvSymbol'
        ? entry.key().sym().toString()
        : entry.key().toXDR('hex');
      const val = entry.val();
      if (key === 'face_value') {
        try { info.face_value = val.u64().toString(); } catch { try { info.face_value = String(val.i128().lo()); } catch {} }
      }
      if (key === 'status') {
        try { info.status = val.sym().toString(); } catch {}
      }
      if (key === 'asset_class') {
        try { info.asset_class = val.sym().toString(); } catch {}
      }
      if (key === 'maturity_timestamp') {
        try { info.maturity_timestamp = val.u64().toString(); } catch {}
      }
      if (key === 'coupon_bps') {
        try { info.coupon_bps = val.u64().toString(); } catch {}
      }
    }

    return {
      exists: true,
      faceValue: Number(info.face_value || 0),
      status: info.status || 'Active',
      assetClass: info.asset_class || 'TreasuryBill',
      maturityTimestamp: Number(info.maturity_timestamp || 0),
      couponBps: Number(info.coupon_bps || 0),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cached = cacheGet<any[]>('assets:list');
    if (cached) {
      return NextResponse.json({ success: true, assets: cached, cached: true });
    }

    const latestLedger = await getLatestLedger();
    if (!latestLedger) {
      return NextResponse.json({ success: true, assets: [] });
    }

    const startLedger = Math.max(1, latestLedger - 50000);
    const mintEventAssets = await fetchAllMintEvents(startLedger);

    const assetIds = Array.from(mintEventAssets.keys()).sort((a, b) => a - b);

    const assets: any[] = [];
    for (const id of assetIds) {
      const eventData = mintEventAssets.get(id)!;
      const onChain = await getAssetFromContract(id);

      const assetClass = onChain?.assetClass || eventData.assetClass || 'TreasuryBill';
      const label = ASSET_CLASS_LABELS[assetClass] || assetClass;
      const status = onChain?.status === 'Redeemed' ? 'Redeemed'
        : onChain?.status === 'Settled' ? 'Settled'
        : 'Pending';

      let maturityDate = '';
      if (onChain?.maturityTimestamp && onChain.maturityTimestamp > 0) {
        maturityDate = new Date(onChain.maturityTimestamp * 1000).toISOString().split('T')[0];
      }

      assets.push({
        id,
        name: `${label} #${id}`,
        faceValue: onChain?.faceValue || 0,
        assetClass,
        maturityDate,
        couponBps: onChain?.couponBps || 0,
        status,
      });
    }

    cacheSet('assets:list', assets, 60_000);

    return NextResponse.json({ success: true, assets });
  } catch (err: any) {
    console.error('[API Assets List] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
