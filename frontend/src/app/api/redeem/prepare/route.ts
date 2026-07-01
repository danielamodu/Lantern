import { NextResponse } from 'next/server';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder, Keypair } from '@stellar/stellar-sdk';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { CONTRACT_ID, DEPLOYER_SECRET, SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';

async function POSTHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();

    if (!body.assetId) {
      return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });
    }

    const assetIdNum = Number(body.assetId);
    if (isNaN(assetIdNum) || assetIdNum <= 0 || assetIdNum > 99999999) {
      return NextResponse.json({ error: 'Invalid assetId' }, { status: 400 });
    }

    console.log(`[API Redeem] Calling redeem_asset for RWA #${body.assetId} on contract ${CONTRACT_ID}...`);

    const secret = DEPLOYER_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfiguration: DEPLOYER_SECRET not set' }, { status: 500 });
    }

    const keypair = Keypair.fromSecret(secret);
    const deployerAddress = keypair.publicKey();

    const rpcServer = new StellarRpc.Server(SOROBAN_RPC_URL);
    const contract = new Contract(CONTRACT_ID);

    const op = contract.call(
      'redeem_asset',
      xdr.ScVal.scvU32(assetIdNum)
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
    console.log(`[API Redeem] Native transaction submitted: ${txHash}. Polling status...`);

    let txStatus: string = sendResult.status;
    let attempts = 0;
    while (txStatus === 'PENDING' && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResult = await rpcServer.getTransaction(txHash);
      txStatus = statusResult.status as string;
      attempts++;
      if (txStatus === 'SUCCESS') {
        console.log(`[API Redeem] Native transaction committed!`);
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
    console.error("[API Redeem] Error:", err);

    if (err.message && err.message.includes('#107')) {
      return NextResponse.json({ error: 'Asset already redeemed', code: 107 }, { status: 400 });
    }
    if (err.message && err.message.includes('#106')) {
      return NextResponse.json({ error: 'Asset not settled — must settle before redeeming', code: 106 }, { status: 400 });
    }
    if (err.message && err.message.includes('#108')) {
      return NextResponse.json({ error: 'Maturity not yet reached — cannot redeem', code: 108 }, { status: 400 });
    }

    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(POSTHandler);
