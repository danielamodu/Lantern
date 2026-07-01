import { NextResponse } from 'next/server';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder, Keypair, Address } from '@stellar/stellar-sdk';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { CONTRACT_ID, ISSUER, DEPLOYER_SECRET, SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';

async function POSTHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();

    if (!body.id || !body.faceValue) {
      return NextResponse.json({ error: 'Missing required parameters: id, faceValue' }, { status: 400 });
    }

    const secret = DEPLOYER_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfiguration: DEPLOYER_SECRET not set' }, { status: 500 });
    }

    const defaultAssetClass = body.assetClass || 'TreasuryBill';
    const defaultMaturity = body.maturityTimestamp || 0;
    const defaultCouponBps = body.couponBps || 0;

    const keypair = Keypair.fromSecret(secret);
    const deployerAddress = keypair.publicKey();

    const rpcServer = new StellarRpc.Server(SOROBAN_RPC_URL);
    const contract = new Contract(CONTRACT_ID);

    const op = contract.call(
      'mint_asset',
      xdr.ScVal.scvU32(Number(body.id)),
      Address.fromString(ISSUER).toScVal(),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(String(body.faceValue))),
      xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol(defaultAssetClass)
      ]),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(String(defaultMaturity))),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(String(defaultCouponBps)))
    );

    const sourceAccount = await rpcServer.getAccount(deployerAddress);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '100000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    tx.sign(keypair);

    const sendResult = await rpcServer.sendTransaction(tx);
    const sendStatus = sendResult.status as string;
    if (sendStatus !== 'PENDING' && sendStatus !== 'SUCCESS') {
      throw new Error(`Soroban RPC submission failed with status: ${sendResult.status}`);
    }

    const txHash = sendResult.hash;
    console.log(`[API Mint] Native transaction submitted: ${txHash}. Polling status...`);

    let txStatus: string = sendResult.status;
    let attempts = 0;
    while (txStatus === 'PENDING' && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResult = await rpcServer.getTransaction(txHash);
      txStatus = statusResult.status as string;
      attempts++;
      if (txStatus === 'SUCCESS') {
        console.log(`[API Mint] Native transaction committed!`);
        return NextResponse.json({
          success: true,
          txHash,
          method: 'native',
          signerAddress: req.auth?.signerAddress
        });
      }
    }
    return NextResponse.json({ error: `Transaction timeout or failure on-chain: ${txStatus}` }, { status: 500 });
  } catch (err: any) {
    console.error("[API Mint] Uncaught exception:", err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(POSTHandler);
