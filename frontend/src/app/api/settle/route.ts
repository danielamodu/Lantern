import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import { Horizon, TransactionBuilder } from '@stellar/stellar-sdk';

const CONTRACT_ID = 'CACFHOCMFKHVUR4UKS5W5XG4QCQBDCDDDT54SOOMHYBHKZIQA43MREUT';
const ISSUER = 'GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4';
const COMMITMENT = '572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // PHASE 2: Submit Signed Transaction XDR
    if (body.signedXdr) {
      console.log(`[API Settle] Submitting signed transaction XDR to Horizon...`);
      try {
        const server = new Horizon.Server('https://horizon-testnet.stellar.org');
        const tx = TransactionBuilder.fromXDR(body.signedXdr, 'Test SDF Network ; September 2015');
        const response = await server.submitTransaction(tx);
        
        return NextResponse.json({
          success: true,
          txHash: response.hash,
          ledgerUrl: `https://stellar.expert/explorer/testnet/tx/${response.hash}`
        });
      } catch (err: any) {
        console.error('[API Settle Submit Error]', err);
        const errDetails = err.response?.data || err.message;
        return NextResponse.json({ 
          error: 'Horizon transaction submission failed', 
          details: errDetails 
        }, { status: 500 });
      }
    }

    // PHASE 1: Prepare Unsigned Transaction XDR
    const { assetId, ephemeralPublicKey, iv, tag, ciphertext, sourceAddress } = body;

    if (!assetId || !ephemeralPublicKey || !iv || !tag || !ciphertext || !sourceAddress) {
      return NextResponse.json({ error: 'Missing required parameters (ensure Freighter address is provided)' }, { status: 400 });
    }

    console.log(`[API Settle] Preparing settlement XDR for Asset ID: ${assetId}, Source: ${sourceAddress}`);

    // 1. Ensure the asset is minted on-chain first using deployer account
    console.log(`[API Settle] Minting asset ${assetId} using deployer key...`);
    const mintArgs = [
      'contract', 'invoke',
      '--id', CONTRACT_ID,
      '--source', 'deployer',
      '--network', 'testnet',
      '--send', 'yes',
      '--', 'mint_asset',
      '--asset_id', String(assetId),
      '--issuer', ISSUER,
      '--face_value', '1000'
    ];
    const mintResult = spawnSync('/home/xbt/.local/bin/stellar', mintArgs, { encoding: 'utf8' });
    console.log(`[API Settle] Mint status code:`, mintResult.status);

    // Wait for sequence syncing
    spawnSync('sleep', ['2']);

    // 2. Build the settle_asset contract invocation using --build-only
    console.log(`[API Settle] Building contract call to settle_asset with build-only...`);
    const settleArgs = [
      'contract', 'invoke',
      '--id', CONTRACT_ID,
      '--source', sourceAddress,
      '--network', 'testnet',
      '--build-only',
      '--', 'settle_asset',
      '--asset_id', String(assetId),
      '--vk-file-path', '/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/circuits/custom_vk_args.json',
      '--proof-file-path', '/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/circuits/custom_proof_args.json',
      '--commitment', COMMITMENT,
      '--ephemeral_public_key', ephemeralPublicKey,
      '--iv', iv,
      '--tag', tag,
      '--ciphertext', ciphertext
    ];

    const buildResult = spawnSync('/home/xbt/.local/bin/stellar', settleArgs, { encoding: 'utf8' });
    
    if (buildResult.status !== 0) {
      console.error(`[API Settle Build Error]`, buildResult.stderr);
      return NextResponse.json({ 
        error: 'Failed to build/simulate Soroban transaction', 
        details: buildResult.stderr 
      }, { status: 500 });
    }

    const unsignedXdr = buildResult.stdout.trim();
    console.log(`[API Settle] Unsigned XDR built successfully: ${unsignedXdr.substring(0, 24)}...`);

    return NextResponse.json({
      success: true,
      unsignedXdr
    });

  } catch (error: any) {
    console.error(`[API Settle Error]:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
