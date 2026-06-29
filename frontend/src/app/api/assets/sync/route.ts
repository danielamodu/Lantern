import { NextResponse } from 'next/server';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder, Address } from '@stellar/stellar-sdk';

const CONTRACT_ID = 'CACFHOCMFKHVUR4UKS5W5XG4QCQBDCDDDT54SOOMHYBHKZIQA43MREUT';
const ISSUER = 'GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4';

export async function POST(request: Request) {
  try {
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid or missing asset IDs list' }, { status: 400 });
    }

    const rpcServer = new StellarRpc.Server('https://soroban-testnet.stellar.org');
    const contract = new Contract(CONTRACT_ID);
    const results: Record<number, { faceValue: number, settled: boolean, exists: boolean }> = {};

    // Optimize: Fetch account once outside the loop to run all simulations fast
    const sourceAccount = await rpcServer.getAccount(ISSUER);

    for (const id of ids) {
      try {
        const op = contract.call('get_asset', xdr.ScVal.scvU32(Number(id)));
        const tx = new TransactionBuilder(sourceAccount, {
          fee: '100',
          networkPassphrase: 'Test SDF Network ; September 2015',
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
                if (key === 'settled') { try { assetInfo.settled = val.b(); } catch(_) {} }
              }
              results[id] = {
                exists: true,
                faceValue: Number(assetInfo.face_value),
                settled: !!assetInfo.settled
              };
              continue;
            }
          }
        }
        results[id] = { exists: false, faceValue: 0, settled: false };
      } catch (err) {
        results[id] = { exists: false, faceValue: 0, settled: false };
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[API Assets Sync] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
