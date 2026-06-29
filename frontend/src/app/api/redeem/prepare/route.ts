import { NextResponse } from 'next/server';
import { Horizon, TransactionBuilder, Asset, Operation } from '@stellar/stellar-sdk';

const ISSUER = 'GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4';

export async function POST(request: Request) {
  try {
    const { userAddress, assetId } = await request.json();

    if (!userAddress || !assetId) {
      return NextResponse.json({ error: 'Missing userAddress or assetId' }, { status: 400 });
    }

    console.log(`[API Redeem] Preparing payment tx from ${userAddress} to Issuer ${ISSUER} representing RWA #${assetId} redemption...`);

    // Load account sequence from Horizon
    const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
    const sourceAccount = await horizon.loadAccount(userAddress);

    // Build payment transaction of 1 XLM to represent the on-chain redemption signal
    const tx = new TransactionBuilder(sourceAccount, {
      fee: '10000', // 0.001 XLM
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: ISSUER,
          asset: Asset.native(),
          amount: '1.0', // 1 XLM
        })
      )
      .addMemo(TransactionBuilder.Memo.text(`RED-${assetId}`))
      .setTimeout(300)
      .build();

    const unsignedXdr = tx.toXDR();

    return NextResponse.json({
      success: true,
      xdr: unsignedXdr,
    });
  } catch (err: any) {
    console.error("[API Redeem] Error preparing redemption:", err);
    return NextResponse.json({ 
      error: 'Failed to prepare transaction', 
      details: err.message || err 
    }, { status: 500 });
  }
}
