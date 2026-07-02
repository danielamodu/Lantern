import { NextResponse } from 'next/server';
import { TransactionBuilder, Keypair, Memo, Operation, Asset, rpc as StellarRpc } from '@stellar/stellar-sdk';
import { createSession } from '@/lib/auth';
import { SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sourceAddress, signedXdr } = body;

    // Phase 1: Issue challenge (unsigned XDR for the client to sign with Freighter)
    if (action === 'challenge') {
      if (!sourceAddress || !/^G[A-Z0-9]{55}$/.test(sourceAddress)) {
        return NextResponse.json({ error: 'Invalid source address' }, { status: 400 });
      }

      const nonce = crypto.randomUUID();
      const server = new StellarRpc.Server(SOROBAN_RPC_URL);
      const account = await server.getAccount(sourceAddress);

      const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(Operation.payment({
          destination: sourceAddress,
          asset: Asset.native(),
          amount: '0.0000001',
        }))
        .addMemo(Memo.text(nonce))
        .setTimeout(30)
        .build();

      const unsignedXdr = tx.toXDR();

      return NextResponse.json({
        success: true,
        unsignedXdr: Buffer.from(unsignedXdr).toString('base64'),
        nonce,
      });
    }

    // Phase 2: Verify signed XDR and issue session token
    if (!signedXdr || !sourceAddress) {
      return NextResponse.json({ error: 'Missing signedXdr or sourceAddress' }, { status: 400 });
    }

    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    if (tx.source !== sourceAddress) {
      return NextResponse.json({ error: 'Signed transaction source does not match address' }, { status: 401 });
    }

    const memo = tx.memo;
    if (!memo || memo.type !== 'text') {
      return NextResponse.json({ error: 'Transaction must contain a text memo' }, { status: 401 });
    }

    const hash = tx.hash();
    const signature = tx.signatures[0]?.signature();
    if (!signature) {
      return NextResponse.json({ error: 'Transaction is not signed' }, { status: 401 });
    }

    const isValid = Keypair.fromPublicKey(sourceAddress).verify(hash, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const token = await createSession(sourceAddress);
    return NextResponse.json({ success: true, token });
  } catch (err: any) {
    console.error('[Auth Session] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}