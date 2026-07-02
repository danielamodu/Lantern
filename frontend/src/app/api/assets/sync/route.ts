import { NextResponse } from 'next/server';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder, Address } from '@stellar/stellar-sdk';
import { SETTLEMENT_CONTRACT_ID, SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';
import { cacheInvalidate } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid or missing asset IDs list' }, { status: 400 });
    }

    const rpcServer = new StellarRpc.Server(SOROBAN_RPC_URL);
    const contract = new Contract(SETTLEMENT_CONTRACT_ID);
    const results: Record<number, { faceValue: number, status: string, assetClass: string, maturityTimestamp: number, couponBps: number, exists: boolean }> = {};

    let sourceAccount;
    try {
      sourceAccount = await rpcServer.getAccount('GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4');
    } catch {
      return NextResponse.json({ error: 'Query account not fundable on this network' }, { status: 500 });
    }

    for (const id of ids) {
      try {
        const op = contract.call('get_asset', xdr.ScVal.scvU32(Number(id)));
        const tx = new TransactionBuilder(sourceAccount, {
          fee: '100',
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(op)
          .setTimeout(30)
          .build();

        const simResult = await rpcServer.simulateTransaction(tx);
        if (StellarRpc.Api.isSimulationSuccess(simResult)) {
          const returnVal = simResult.result?.retval;
          if (returnVal) {
            const mapEntries = returnVal.map();
            if (mapEntries) {
              const assetInfo: Record<string, any> = {};
              for (const entry of mapEntries) {
                const key = entry.key().switch().name === 'scvSymbol'
                  ? entry.key().sym().toString()
                  : entry.key().toXDR('hex');
                const val = entry.val();
                if (key === 'face_value') {
                  try { assetInfo.face_value = val.u64().toString(); } catch(_) {
                    try { assetInfo.face_value = String(val.i128().lo()); } catch(__) {
                      assetInfo.face_value = val.toXDR('hex');
                    }
                  }
                }
                if (key === 'status') {
                  try { assetInfo.status = val.vec()?.[0]?.sym()?.toString() || val.toXDR('hex'); } catch(_) {
                    try { assetInfo.status = val.sym().toString(); } catch(__) {}
                  }
                }
                if (key === 'asset_class') {
                  try { assetInfo.asset_class = val.vec()?.[0]?.sym()?.toString() || val.sym().toString() || val.toXDR('hex'); } catch(_) {
                    try { assetInfo.asset_class = val.sym().toString(); } catch(__) {}
                  }
                }
                if (key === 'maturity_timestamp') {
                  try { assetInfo.maturity_timestamp = val.u64().toString(); } catch(_) {
                    try { assetInfo.maturity_timestamp = String(val.i128().lo()); } catch(__) {}
                  }
                }
                if (key === 'coupon_bps') {
                  try { assetInfo.coupon_bps = val.u64().toString(); } catch(_) {
                    try { assetInfo.coupon_bps = String(val.i128().lo()); } catch(__) {}
                  }
                }
              }
              results[id] = {
                exists: true,
                faceValue: Number(assetInfo.face_value || 0),
                status: assetInfo.status || 'Active',
                assetClass: assetInfo.asset_class || 'TreasuryBill',
                maturityTimestamp: Number(assetInfo.maturity_timestamp || 0),
                couponBps: Number(assetInfo.coupon_bps || 0),
              };
              continue;
            }
          }
        }
        results[id] = { exists: false, faceValue: 0, status: 'Active', assetClass: 'TreasuryBill', maturityTimestamp: 0, couponBps: 0 };
      } catch (err) {
        results[id] = { exists: false, faceValue: 0, status: 'Active', assetClass: 'TreasuryBill', maturityTimestamp: 0, couponBps: 0 };
      }
    }

    cacheInvalidate('assets');

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[API Assets Sync] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
