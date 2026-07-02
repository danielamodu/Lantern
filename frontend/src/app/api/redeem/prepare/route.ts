import { NextResponse } from 'next/server';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder } from '@stellar/stellar-sdk';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { SETTLEMENT_CONTRACT_ID, SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';

function validateAssetId(assetId: any): number {
  const num = Number(assetId);
  if (isNaN(num) || num <= 0 || num > 99999999) {
    throw new Error(`Invalid assetId: must be a positive integer between 1 and 99999999, got ${assetId}`);
  }
  return num;
}

function validateStellarAddress(address: any): string {
  const str = String(address);
  if (!/^G[A-Z0-9]{55}$/.test(str)) {
    throw new Error(`Invalid Stellar address format: must be G followed by 55 alphanumeric chars, got ${str}`);
  }
  return str;
}

async function POSTHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();

    // Phase 2: Submit signed XDR
    if (body.signedXdr) {
      try {
        const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
        const { Horizon } = await import('@stellar/stellar-sdk');
        const server = new Horizon.Server(HORIZON_URL);
        const tx = TransactionBuilder.fromXDR(body.signedXdr, NETWORK_PASSPHRASE);
        const submitResult = await server.submitTransaction(tx);
        return NextResponse.json({
          success: true,
          txHash: submitResult.hash,
          ledgerUrl: `https://stellar.expert/explorer/testnet/tx/${submitResult.hash}`
        });
      } catch (err: any) {
        return NextResponse.json({
          error: 'Horizon transaction submission failed',
          details: err.response?.data || err.message
        }, { status: 500 });
      }
    }

    // Phase 1: Build unsigned XDR
    const { assetId, sourceAddress } = body;
    if (!assetId || !sourceAddress) {
      return NextResponse.json({ error: 'Missing required parameters: assetId, sourceAddress' }, { status: 400 });
    }

    const validatedAssetId = validateAssetId(assetId);
    const validatedSource = validateStellarAddress(sourceAddress);

    // Pre-flight check: verify asset exists and is in Settled state
    const rpcServer = new StellarRpc.Server(SOROBAN_RPC_URL);
    const contract = new Contract(SETTLEMENT_CONTRACT_ID);

    try {
      const checkOp = contract.call('get_asset', xdr.ScVal.scvU32(validatedAssetId));
      const checkAccount = await rpcServer.getAccount(validatedSource);
      const checkTx = new TransactionBuilder(checkAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
      .addOperation(checkOp)
      .setTimeout(30)
      .build();

      const checkSim = await rpcServer.simulateTransaction(checkTx);
      if (!StellarRpc.Api.isSimulationSuccess(checkSim)) {
        return NextResponse.json({ error: 'Asset not found on-chain. Ensure it has been minted.', code: 101 }, { status: 404 });
      }

      const retval = checkSim.result?.retval;
      if (retval) {
        const mapEntries = retval.map();
        for (const entry of mapEntries) {
          const key = entry.key().sym().toString();
          const val = entry.val();
          if (key === 'status') {
            const status = val.vec()?.[0]?.sym()?.toString() || val.sym().toString();
            if (status !== 'Settled') {
              const msg = status === 'Active' ? 'Asset not yet settled — must settle before redeeming'
                : status === 'Redeemed' ? 'Asset already redeemed'
                : 'Asset cannot be redeemed in its current state';
              return NextResponse.json({ error: msg, code: status === 'Active' ? 106 : 107 }, { status: 400 });
            }
          }
          if (key === 'maturity_timestamp') {
            const maturity = Number(val.u64().toString());
            if (maturity > 0) {
              const ledgerRes = await fetch(`${process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'}/latestLedger`);
              const ledgerData = await ledgerRes.json();
              const now = Math.floor(Date.now() / 1000);
              if (now < maturity) {
                return NextResponse.json({
                  error: `Maturity not yet reached (${new Date(maturity * 1000).toISOString()}). Cannot redeem.`,
                  code: 108
                }, { status: 400 });
              }
            }
          }
        }
      }
    } catch (checkErr: any) {
      return NextResponse.json({ error: 'Pre-flight check failed', details: checkErr.message }, { status: 500 });
    }

    // Build unsigned redeem transaction
    const op = contract.call(
      'redeem_asset',
      xdr.ScVal.scvU32(validatedAssetId)
    );

    const sourceAccount = await rpcServer.getAccount(validatedSource);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: '100000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const simResult = await rpcServer.simulateTransaction(tx);
    if (!StellarRpc.Api.isSimulationSuccess(simResult)) {
      const errMsg = (simResult as any).error ?? JSON.stringify(simResult);
      return NextResponse.json({ error: 'Failed to prepare on-chain transaction', details: errMsg }, { status: 500 });
    }

    const assembled = StellarRpc.assembleTransaction(tx, simResult).build();
    const unsignedXdr = Buffer.from(assembled.toXDR()).toString('base64');

    return NextResponse.json({
      success: true,
      unsignedXdr,
      assetId: validatedAssetId
    });
  } catch (err: any) {
    console.error("[API Redeem] Error:", err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(POSTHandler);