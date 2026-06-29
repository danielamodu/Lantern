import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder, Keypair, Address } from '@stellar/stellar-sdk';

const CONTRACT_ID = 'CACFHOCMFKHVUR4UKS5W5XG4QCQBDCDDDT54SOOMHYBHKZIQA43MREUT';
const ISSUER = 'GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4';

export async function POST(request: Request) {
  try {
    const { id, faceValue } = await request.json();

    if (!id || !faceValue) {
      return NextResponse.json({ error: 'Missing required parameters: id, faceValue' }, { status: 400 });
    }

    const secret = process.env.DEPLOYER_SECRET;
    if (secret) {
      console.log(`[API Mint] DEPLOYER_SECRET found. Building mint_asset transaction natively...`);
      try {
        const keypair = Keypair.fromSecret(secret);
        const deployerAddress = keypair.publicKey();

        const rpcServer = new StellarRpc.Server('https://soroban-testnet.stellar.org');
        const contract = new Contract(CONTRACT_ID);
        
        // Build mint_asset operation parameters
        const op = contract.call(
          'mint_asset', 
          xdr.ScVal.scvU32(Number(id)),
          Address.fromString(ISSUER).toScVal(),
          xdr.ScVal.scvU64(xdr.Uint64.fromString(String(faceValue)))
        );

        const sourceAccount = await rpcServer.getAccount(deployerAddress);
        
        const tx = new TransactionBuilder(sourceAccount, {
          fee: '100000', // 0.01 XLM
          networkPassphrase: 'Test SDF Network ; September 2015',
        })
          .addOperation(op)
          .setTimeout(30)
          .build();

        tx.sign(keypair);

        const sendResult = await rpcServer.sendTransaction(tx);
        if (sendResult.status !== 'PENDING' && sendResult.status !== 'SUCCESS') {
          throw new Error(`Soroban RPC submission failed with status: ${sendResult.status}`);
        }

        const txHash = sendResult.hash;
        console.log(`[API Mint] Native transaction submitted: ${txHash}. Polling status...`);

        let txStatus = sendResult.status;
        let attempts = 0;
        while (txStatus === 'PENDING' && attempts < 15) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const statusResult = await rpcServer.getTransaction(txHash);
          txStatus = statusResult.status;
          attempts++;
          if (statusResult.status === 'SUCCESS') {
            console.log(`[API Mint] Native transaction committed!`);
            return NextResponse.json({
              success: true,
              txHash,
              method: 'native'
            });
          }
        }
        throw new Error(`Transaction status timeout or failure on-chain: ${txStatus}`);
      } catch (err: any) {
        console.error("[API Mint] Native execution failed, fallback to CLI...", err.message);
      }
    }

    console.log(`[API Mint] Invoking mint_asset via local WSL CLI fallback...`);

    const mintArgs = [
      'contract', 'invoke',
      '--id', CONTRACT_ID,
      '--source', 'deployer',
      '--network', 'testnet',
      '--send', 'yes',
      '--', 'mint_asset',
      '--asset_id', String(id),
      '--issuer', ISSUER,
      '--face_value', String(faceValue)
    ];

    const result = spawnSync('wsl', ['/home/xbt/.local/bin/stellar', ...mintArgs], { encoding: 'utf8' });

    if (result.status !== 0) {
      console.error("[API Mint] WSL invocation failed:", result.stderr);
      return NextResponse.json({ 
        error: 'Stellar CLI execution failed', 
        details: result.stderr || result.stdout 
      }, { status: 500 });
    }

    // Extract transaction hash from stderr (Signing transaction: <hash>)
    const txHashMatch = result.stderr.match(/Signing transaction: ([a-f0-9]{64})/);
    const txHash = txHashMatch ? txHashMatch[1] : null;

    console.log(`[API Mint] Success! Tx Hash: ${txHash}`);

    return NextResponse.json({
      success: true,
      txHash,
      method: 'wsl-cli',
      output: result.stdout || result.stderr
    });
  } catch (err: any) {
    console.error("[API Mint] Uncaught exception:", err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
