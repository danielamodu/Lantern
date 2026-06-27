import { NextResponse } from 'next/server';
import { spawnSync, execSync } from 'child_process';
import { xdr, scValToNative } from '@stellar/stellar-sdk';
import { decryptSettlement } from '../../../utils/cryptoDisclosure';

const CONTRACT_ID = 'CACFHOCMFKHVUR4UKS5W5XG4QCQBDCDDDT54SOOMHYBHKZIQA43MREUT';
const RPC_URL = 'https://soroban-testnet.stellar.org';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { txHash, privateKey } = body;

    if (!txHash || !privateKey) {
      return NextResponse.json({ error: 'Missing transaction hash or view key' }, { status: 400 });
    }

    console.log(`[API Decrypt] Processing decryption for Tx: ${txHash}`);

    // 1. Fetch transaction details from Horizon to get the ledger number
    const txUrl = `https://horizon-testnet.stellar.org/transactions/${txHash}`;
    let txInfo;
    try {
      const txInfoOutput = execSync(`curl -s ${txUrl}`, { encoding: 'utf8' });
      txInfo = JSON.parse(txInfoOutput);
    } catch (e: any) {
      console.error(`[API Decrypt] Failed to fetch transaction details:`, e);
      return NextResponse.json({ error: 'Transaction not found or Horizon indexing lag' }, { status: 404 });
    }

    const ledger = txInfo.ledger;
    if (!ledger) {
      return NextResponse.json({ error: 'Transaction ledger not indexed' }, { status: 500 });
    }

    // 2. Query Soroban RPC getEvents
    console.log(`[API Decrypt] Querying events for ledger: ${ledger}`);
    const rpcPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getEvents',
      params: {
        startLedger: ledger,
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID]
          }
        ]
      }
    };

    let rpcResponse;
    try {
      const rpcOutput = execSync(`curl -s -X POST -H "Content-Type: application/json" -d '${JSON.stringify(rpcPayload)}' ${RPC_URL}`, { encoding: 'utf8' });
      rpcResponse = JSON.parse(rpcOutput);
    } catch (e: any) {
      console.error(`[API Decrypt] Soroban RPC request failed:`, e);
      return NextResponse.json({ error: 'Failed to query Soroban RPC' }, { status: 500 });
    }

    if (rpcResponse.error) {
      return NextResponse.json({ error: rpcResponse.error.message }, { status: 500 });
    }

    const events = rpcResponse.result?.events;
    if (!events || events.length === 0) {
      return NextResponse.json({ error: 'No contract events found in this ledger' }, { status: 404 });
    }

    // Find target event matching our txHash
    const targetEvent = events.find((ev: any) => ev.txHash === txHash);
    if (!targetEvent) {
      return NextResponse.json({ error: 'No settlement event found matching this transaction' }, { status: 404 });
    }

    // 3. Decode event XDR
    console.log(`[API Decrypt] Decoding event XDR value...`);
    const scVal = xdr.ScVal.fromXDR(Buffer.from(targetEvent.value, 'base64'));
    const nativeValue: any = scValToNative(scVal);

    // Envelope structure: (ephemeralPublicKeyHex, ivHex, tagHex, ciphertextHex)
    const retrievedPayload = {
      ephemeralPublicKeyHex: nativeValue[0].toString('hex'),
      ivHex: nativeValue[1].toString('hex'),
      tagHex: nativeValue[2].toString('hex'),
      ciphertextHex: nativeValue[3].toString('hex'),
    };

    // 4. Decrypt using the private View Key
    console.log(`[API Decrypt] Decrypting ciphertext...`);
    try {
      const decryptedAmount = decryptSettlement(retrievedPayload, privateKey);
      console.log(`[API Decrypt] Successfully decrypted amount: ${decryptedAmount}`);
      return NextResponse.json({
        success: true,
        decryptedAmount,
        payload: retrievedPayload
      });
    } catch (decryptError: any) {
      console.error(`[API Decrypt] Decryption failed:`, decryptError.message);
      return NextResponse.json({ 
        error: 'Decryption failed: View Key is invalid or authentication tag check failed',
        details: decryptError.message 
      }, { status: 401 });
    }

  } catch (error: any) {
    console.error(`[API Decrypt] Fatal Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
