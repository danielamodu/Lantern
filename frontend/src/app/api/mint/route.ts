import { NextResponse } from 'next/server';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder, Address } from '@stellar/stellar-sdk';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { SETTLEMENT_CONTRACT_ID, SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';

function validateAssetId(assetId: any): number {
  const num = Number(assetId);
  if (isNaN(num) || num <= 0 || num > 99999999) {
    throw new Error(`Invalid assetId: must be a positive integer between 1 and 99999999, got ${assetId}`);
  }
  return num;
}

function validateAmount(amount: any): string {
  const str = String(amount);
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid amount: must be a numeric string, got ${amount}`);
  }
  const num = parseFloat(str);
  if (num <= 0) {
    throw new Error(`Invalid amount: must be positive, got ${amount}`);
  }
  return str;
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

    const { id, faceValue, issuer, sourceAddress } = body;

    if (!id || !faceValue || !issuer || !sourceAddress) {
      return NextResponse.json({ error: 'Missing required parameters: id, faceValue, issuer, sourceAddress' }, { status: 400 });
    }

    const validatedId = validateAssetId(id);
    const validatedAmount = validateAmount(faceValue);
    const validatedIssuer = validateStellarAddress(issuer);
    const validatedSource = validateStellarAddress(sourceAddress);

    const defaultAssetClass = body.assetClass || 'TreasuryBill';
    const defaultMaturity = body.maturityTimestamp || 0;
    const defaultCouponBps = body.couponBps || 0;

    const rpcServer = new StellarRpc.Server(SOROBAN_RPC_URL);
    const contract = new Contract(SETTLEMENT_CONTRACT_ID);

    // Check if asset already exists via simulation
    try {
      const checkOp = contract.call('get_asset', xdr.ScVal.scvU32(validatedId));
      const checkAccount = await rpcServer.getAccount(validatedSource);
      const checkTx = new TransactionBuilder(checkAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
      .addOperation(checkOp)
      .setTimeout(30)
      .build();
      const checkSim = await rpcServer.simulateTransaction(checkTx);
      if (StellarRpc.Api.isSimulationSuccess(checkSim)) {
        return NextResponse.json({ error: 'Asset already exists on-chain', code: 'ASSET_EXISTS' }, { status: 409 });
      }
    } catch (_) {
      // Asset doesn't exist yet — expected
    }

    const op = contract.call(
      'mint_asset',
      xdr.ScVal.scvU32(validatedId),
      Address.fromString(validatedIssuer).toScVal(),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(validatedAmount)),
      xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol(defaultAssetClass)
      ]),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(String(defaultMaturity))),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(String(defaultCouponBps)))
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
      return NextResponse.json({ error: 'Failed to simulate mint transaction', details: errMsg }, { status: 500 });
    }

    const assembled = StellarRpc.assembleTransaction(tx, simResult).build();
    const unsignedXdr = Buffer.from(assembled.toXDR()).toString('base64');

    return NextResponse.json({
      success: true,
      unsignedXdr,
      assetId: validatedId
    });
  } catch (err: any) {
    console.error("[API Mint] Uncaught exception:", err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(POSTHandler);
