import { NextResponse } from 'next/server';
import { CONTRACT_ID, SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';
import { cacheGet, cacheSet } from '@/lib/cache';

const ASSET_CLASS_LABELS: Record<string, string> = {
  TreasuryBill: 'US Treasury Bill',
  CorporateBond: 'Corporate Bond',
  InvoiceReceivable: 'Invoice Receivable',
  CommodityToken: 'Commodity Token',
  CarbonCredit: 'Carbon Credit',
};

function base64ToHex(b64: string): string {
  return Buffer.from(b64, 'base64').toString('hex');
}

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

function scValU64FromXdr(b64: string): number {
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf[0] === 0x05) {
      const hi = buf.readUInt32BE(1);
      const lo = buf.readUInt32BE(5);
      return hi * 0x100000000 + lo;
    }
    return 0;
  } catch {
    return 0;
  }
}

function extractU64FromStructXdr(b64: string, fieldName: string): number {
  try {
    const buf = Buffer.from(b64, 'base64');
    const hex = buf.toString('hex');
    const fieldPrefix = Buffer.from(fieldName, 'utf8').toString('hex');
    const idx = hex.indexOf(fieldPrefix);
    if (idx === -1) return 0;
    const afterField = hex.slice(idx + fieldPrefix.length);
    const u64Marker = '05';
    const markerIdx = afterField.indexOf(u64Marker);
    if (markerIdx === -1 || markerIdx > 8) return 0;
    const u64Hex = afterField.slice(markerIdx + 2, markerIdx + 18);
    if (u64Hex.length < 16) return 0;
    const hi = parseInt(u64Hex.slice(0, 8), 16);
    const lo = parseInt(u64Hex.slice(8, 16), 16);
    return hi * 0x100000000 + lo;
  } catch {
    return 0;
  }
}

async function getLatestLedger(): Promise<number> {
  try {
    const res = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getLatestLedger',
        params: {},
      }),
    });
    const data = await res.json();
    return data?.result?.sequence || 0;
  } catch {
    return 0;
  }
}

async function fetchEvents(startLedger: number): Promise<any[]> {
  const res = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'getEvents',
      params: {
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID],
          },
        ],
        limit: 50,
      },
    }),
  });
  const data = await res.json();
  return data?.result?.events || [];
}

export async function GET() {
  try {
    const cached = cacheGet<any[]>('events');
    if (cached) {
      return NextResponse.json({ success: true, events: cached, cached: true });
    }

    const latestLedger = await getLatestLedger();
    if (!latestLedger) {
      return NextResponse.json({ success: true, events: [] });
    }

    const startLedger = Math.max(1, latestLedger - 5000);
    let events: any[] = [];

    try {
      events = await fetchEvents(startLedger);
    } catch (err) {
      console.error('[API Events] getEvents RPC failed:', err);
    }

    const txs: any[] = events
      .map((e: any, idx: number) => {
        const topics: string[] = e.topic || [];
        const valueB64: string = e.value || '';

        let eventType = 'unknown';
        if (topics.length >= 1) {
          eventType = scValSymbolFromXdr(topics[0]);
        }

        let assetId = 0;
        if (topics.length >= 2) {
          assetId = scValU32FromXdr(topics[1]);
        }

        let faceValue = 0;
        let discountBps = 0;
        if (valueB64) {
          faceValue = extractU64FromStructXdr(valueB64, 'face_value');
          discountBps = extractU64FromStructXdr(valueB64, 'discount_bps');
          if (!faceValue) {
            faceValue = scValU64FromXdr(valueB64);
          }
        }

        let assetClass = 'TreasuryBill';
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
        const assetLabel = ASSET_CLASS_LABELS[assetClass] || assetClass;

        return {
          txHash: e.txHash || e.id?.toString() || `event-${idx}`,
          assetId,
          assetName: `${assetLabel} #${assetId}`,
          faceValue,
          actualAmount: faceValue,
          eventType,
          discountBps,
          timestamp: e.ledgerClosedAt || '',
        };
      })

    cacheSet('events', txs);
    cacheSet(`events:ledger:${latestLedger}`, txs);

    return NextResponse.json({ success: true, events: txs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
