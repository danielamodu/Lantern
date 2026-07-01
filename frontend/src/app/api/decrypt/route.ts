import { NextResponse } from 'next/server';
import { decryptSettlement, EncryptedPayload } from '@/utils/cryptoDisclosure';
import { CONTRACT_ID, SOROBAN_RPC_URL as RPC_URL, HORIZON_URL } from '@/lib/config';

function extractBytesFromVecXdr(b64: string): Buffer[] {
  const buf = Buffer.from(b64, 'base64');
  const results: Buffer[] = [];
  let offset = 0;

  if (buf[offset] === 0x0c) {
    offset++;
    const lenHi = buf[offset++];
    const lenLo = buf[offset++];
    const vecLen = (lenHi << 8) | lenLo;

    for (let i = 0; i < vecLen && offset < buf.length; i++) {
      if (buf[offset] === 0x0a) {
        offset++;
        const bLenHi = buf[offset++];
        const bLenLo = buf[offset++];
        const bLen = (bLenHi << 8) | bLenLo;
        results.push(Buffer.from(buf.slice(offset, offset + bLen)));
        offset += bLen;
      } else if (buf[offset] === 0x0b) {
        offset++;
        const bLenHi = buf[offset++];
        const bLenLo = buf[offset++];
        const bLen = (bLenHi << 8) | bLenLo;
        results.push(Buffer.from(buf.slice(offset, offset + bLen)));
        offset += bLen;
      } else {
        break;
      }
    }
  }

  return results;
}

async function rpcRequest(method: string, params: any): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return res.json();
}

async function horizonFetch(path: string): Promise<any> {
  const res = await fetch(`${HORIZON_URL}${path}`);
  if (!res.ok) throw new Error(`Horizon error: ${res.status}`);
  return res.json();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { txHash, privateKey, payload, eventValue } = body;

    if (!privateKey) {
      return NextResponse.json({ error: 'Missing private view key' }, { status: 400 });
    }

    if (payload) {
      console.log(`[API Decrypt] Directly decrypting provided payload...`);
      try {
        const decryptedAmount = decryptSettlement(payload as EncryptedPayload, privateKey);
        console.log(`[API Decrypt] Successfully decrypted amount (direct): ${decryptedAmount}`);
        return NextResponse.json({
          success: true,
          decryptedAmount,
          payload
        });
      } catch (decryptError: any) {
        console.error(`[API Decrypt] Decryption failed (direct):`, decryptError.message);
        return NextResponse.json({
          error: 'Decryption failed: View Key is invalid or authentication tag check failed',
          details: decryptError.message
        }, { status: 401 });
      }
    }

    if (eventValue) {
      console.log(`[API Decrypt] Parsing provided eventValue base64...`);
      try {
        const segments = extractBytesFromVecXdr(eventValue);
        if (segments.length < 4) {
          throw new Error(`Expected 4 segments (eph_key, iv, tag, ciphertext), got ${segments.length}`);
        }
        const retrievedPayload: EncryptedPayload = {
          ephemeralPublicKeyHex: segments[0].toString('hex'),
          ivHex: segments[1].toString('hex'),
          tagHex: segments[2].toString('hex'),
          ciphertextHex: segments[3].toString('hex'),
        };
        const decryptedAmount = decryptSettlement(retrievedPayload, privateKey);
        console.log(`[API Decrypt] Successfully decrypted amount via eventValue: ${decryptedAmount}`);
        return NextResponse.json({
          success: true,
          decryptedAmount,
          payload: retrievedPayload
        });
      } catch (err: any) {
        console.error(`[API Decrypt] Decryption via eventValue failed:`, err.message);
        return NextResponse.json({
          error: 'Decryption failed: invalid event value or View Key mismatch',
          details: err.message
        }, { status: 400 });
      }
    }

    if (!txHash) {
      return NextResponse.json({ error: 'Missing transaction hash' }, { status: 400 });
    }

    console.log(`[API Decrypt] Processing decryption for Tx: ${txHash}`);

    let txInfo: any;
    try {
      txInfo = await horizonFetch(`/transactions/${txHash}`);
    } catch (e: any) {
      console.error(`[API Decrypt] Failed to fetch transaction details:`, e);
      return NextResponse.json({ error: 'Transaction not found or Horizon indexing lag' }, { status: 404 });
    }

    const ledger = txInfo.ledger;
    if (!ledger) {
      return NextResponse.json({ error: 'Transaction ledger not indexed' }, { status: 500 });
    }

    console.log(`[API Decrypt] Querying events for ledger: ${ledger}`);
    const rpcData = await rpcRequest('getEvents', {
      startLedger: ledger,
      filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
      limit: 50,
    });

    if (rpcData.error) {
      return NextResponse.json({ error: rpcData.error.message }, { status: 500 });
    }

    const events = rpcData.result?.events;
    if (!events || events.length === 0) {
      return NextResponse.json({ error: 'No contract events found in this ledger' }, { status: 404 });
    }

    const targetEvent = events.find((ev: any) => ev.txHash === txHash);
    if (!targetEvent) {
      return NextResponse.json({ error: 'No settlement event found matching this transaction' }, { status: 404 });
    }

    console.log(`[API Decrypt] Decoding event XDR value...`);

    const valueB64 = targetEvent.value;
    const segments = extractBytesFromVecXdr(valueB64);
    if (segments.length < 4) {
      return NextResponse.json({
        error: `Event value XDR unexpected structure: ${segments.length} segments (need 4)`,
      }, { status: 500 });
    }

    const retrievedPayload: EncryptedPayload = {
      ephemeralPublicKeyHex: segments[0].toString('hex'),
      ivHex: segments[1].toString('hex'),
      tagHex: segments[2].toString('hex'),
      ciphertextHex: segments[3].toString('hex'),
    };

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
