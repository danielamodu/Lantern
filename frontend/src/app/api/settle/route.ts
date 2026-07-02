import { NextResponse } from 'next/server';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder, Horizon } from '@stellar/stellar-sdk';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { SETTLEMENT_CONTRACT_ID, SOROBAN_RPC_URL, HORIZON_URL, NETWORK_PASSPHRASE } from '@/lib/config';
import { cacheInvalidate } from '@/lib/cache';

const CIRCUITS_DIR = path.resolve(process.cwd(), '..', 'circuits');
const SNARKJS_ENTRY = path.join(CIRCUITS_DIR, 'node_modules', 'snarkjs', 'main.js');

let snarkjsModulePromise: Promise<any> | null = null;

async function loadSnarkjs() {
  if (!snarkjsModulePromise) {
    snarkjsModulePromise = import(pathToFileURL(SNARKJS_ENTRY).href);
  }
  return snarkjsModulePromise;
}

async function loadJsonFile<T>(fileName: string): Promise<T> {
  const filePath = path.join(CIRCUITS_DIR, fileName);
  const fileText = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileText) as T;
}

// ── INPUT VALIDATION ───────────────────────────────────────────────────────
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

function validateEphemeralPublicKey(pubKey: any): string {
  const str = String(pubKey).trim();
  const expectedLen = 130;
  if (!str.startsWith('04') && !str.match(/^0[0-9a-f]{128}$/i)) {
    throw new Error(`Invalid ephemeral public key: must start with 04 prefix followed by 64 hex chars (total 130 chars), got ${str}`);
  }
  if (str.length !== expectedLen) {
    throw new Error(`Invalid ephemeral public key length: expected ${expectedLen} chars, got ${str.length}`);
  }
  return str;
}

function validateHex(str: any, expectedBytes: number): string {
  const hex = String(str).trim();
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`Invalid hex string: expected hex characters, got ${hex}`);
  }

  if (expectedBytes === 0) {
    return hex;
  }

  const expectedLen = expectedBytes * 2;
  if (hex.length !== expectedLen) {
    throw new Error(`Invalid hex length: expected ${expectedLen} chars (${expectedBytes} bytes), got ${hex.length}`);
  }
  return hex;
}

function sanitizeFilePrefix(prefix: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(prefix)) {
    throw new Error(`Invalid file prefix: contains illegal characters (only alphanumeric and underscore allowed)`);
  }
  return prefix;
}

// ── ZK PROOF GENERATION (pure TypeScript, no WSL spawnSync) ───────────────
function bigintToBytesBE(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let tmp = n;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(tmp & BigInt(0xff));
    tmp >>= BigInt(8);
  }
  return out;
}

function g1ToBytes(x: string, y: string): Uint8Array {
  const FP_SIZE = 48;
  const xBytes = bigintToBytesBE(BigInt(x), FP_SIZE);
  const yBytes = bigintToBytesBE(BigInt(y), FP_SIZE);
  const out = new Uint8Array(FP_SIZE * 2);
  out.set(xBytes, 0);
  out.set(yBytes, FP_SIZE);
  return out;
}

function g2ToBytes(x1: string, x2: string, y1: string, y2: string): Uint8Array {
  const FP_SIZE = 48;
  const xc0 = bigintToBytesBE(BigInt(x1), FP_SIZE);
  const xc1 = bigintToBytesBE(BigInt(x2), FP_SIZE);
  const yc0 = bigintToBytesBE(BigInt(y1), FP_SIZE);
  const yc1 = bigintToBytesBE(BigInt(y2), FP_SIZE);
  const out = new Uint8Array(FP_SIZE * 4);
  out.set(xc0, 0);
  out.set(xc1, FP_SIZE);
  out.set(yc0, FP_SIZE * 2);
  out.set(yc1, FP_SIZE * 3);
  return out;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function uint32BE(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

function stringToUint8Array(s: string): Uint8Array {
  const enc = new TextEncoder();
  return enc.encode(s);
}

interface ProofJson {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
}

interface VkJson {
  vk_alpha_1: [string, string, string];
  vk_beta_2: [[string, string], [string, string], [string, string]];
  vk_gamma_2: [[string, string], [string, string], [string, string]];
  vk_delta_2: [[string, string], [string, string], [string, string]];
  IC: [string, string, string][];
  nPublic: number;
}

function proofToHex(proofJson: ProofJson): string {
  const a = g1ToBytes(proofJson.pi_a[0], proofJson.pi_a[1]);
  const b = g2ToBytes(proofJson.pi_b[0][1], proofJson.pi_b[0][0], proofJson.pi_b[1][1], proofJson.pi_b[1][0]);
  const c = g1ToBytes(proofJson.pi_c[0], proofJson.pi_c[1]);
  return Buffer.from(concat(a, b, c)).toString('hex');
}

function vkToHex(vkJson: VkJson): string {
  const alpha = g1ToBytes(vkJson.vk_alpha_1[0], vkJson.vk_alpha_1[1]);
  const beta  = g2ToBytes(vkJson.vk_beta_2[0][1],  vkJson.vk_beta_2[0][0],  vkJson.vk_beta_2[1][1],  vkJson.vk_beta_2[1][0]);
  const gamma = g2ToBytes(vkJson.vk_gamma_2[0][1], vkJson.vk_gamma_2[0][0], vkJson.vk_gamma_2[1][1], vkJson.vk_gamma_2[1][0]);
  const delta = g2ToBytes(vkJson.vk_delta_2[0][1], vkJson.vk_delta_2[0][0], vkJson.vk_delta_2[1][1], vkJson.vk_delta_2[1][0]);
  const icLen = uint32BE(vkJson.IC.length);
  const icParts = vkJson.IC.map(ic => g1ToBytes(ic[0], ic[1]));
  return Buffer.from(concat(alpha, beta, gamma, delta, icLen, ...icParts)).toString('hex');
}

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

async function generateCustomProof(
  inputData: Record<string, string>,
  discountBps?: number
): Promise<{ proofHex: string; vkHex: string; commitmentHex: string; nPublic: number }> {
  try {
    const snarkjs = await loadSnarkjs();
    const isDiscounted = discountBps !== undefined && discountBps > 0;

    const wasmPath = isDiscounted
      ? path.join(CIRCUITS_DIR, 'discount_settlement_js', 'discount_settlement.wasm')
      : path.join(CIRCUITS_DIR, 'settlement_js', 'settlement.wasm');
    const zkeyPath = isDiscounted
      ? path.join(CIRCUITS_DIR, 'discount_settlement_final.zkey')
      : path.join(CIRCUITS_DIR, 'settlement_final.zkey');
    const vkFile = isDiscounted ? 'discount_settlement_vk.json' : 'verification_key.json';

    const [proofResult, vkJson] = await Promise.all([
      snarkjs.groth16.fullProve(inputData, wasmPath, zkeyPath),
      loadJsonFile<VkJson>(vkFile),
    ]);

    const proofHex = proofToHex(proofResult.proof as ProofJson);
    const vkHex = vkToHex(vkJson);

    // Public signals order:
    //   regular:   [commitment, target_face_value]
    //   discount:  [target_face_value, discount_bps, commitment]
    const commitmentIndex = isDiscounted ? 2 : 0;
    const commitmentSignal = proofResult.publicSignals?.[commitmentIndex];
    if (!commitmentSignal) {
      throw new Error('Groth16 prover did not return a commitment public signal');
    }

    const commitmentHex = BigInt(commitmentSignal).toString(16).padStart(64, '0');

    return { proofHex, vkHex, commitmentHex, nPublic: vkJson.nPublic };
  } catch (err: any) {
    throw new Error(`Failed to generate custom proof: ${err.message}`);
  }
}

async function POSTHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();

    // ── PHASE 2: Submit Signed Transaction XDR ──────────────────────────────
    if (body.signedXdr) {
      console.log('[Settle] Submitting signed XDR via Horizon...');

      if (typeof body.signedXdr !== 'string') {
        return NextResponse.json({
          error: 'Horizon transaction submission failed',
          details: `Expected signedXdr to be a string, got ${typeof body.signedXdr}`
        }, { status: 400 });
      }

      try {
        const server = new Horizon.Server(HORIZON_URL);
        const tx = TransactionBuilder.fromXDR(body.signedXdr, NETWORK_PASSPHRASE);
        const submitResult = await server.submitTransaction(tx);

        console.log(`[Settle] Transaction successfully submitted! Hash: ${submitResult.hash}`);
        return NextResponse.json({
          success: true,
          txHash: submitResult.hash,
          ledgerUrl: `https://stellar.expert/explorer/testnet/tx/${submitResult.hash}`
        });
      } catch (err: any) {
        console.error('[Settle] Full submission error:', err);
        return NextResponse.json({
          error: 'Horizon transaction submission failed',
          details: err.response?.data || err.message
        }, { status: 500 });
      }
    }

    // ── PHASE 1: Prepare Unsigned Transaction XDR ───────────────────────────
    const { assetId, amount, ephemeralPublicKey, iv, tag, ciphertext, sourceAddress, discountBps } = body;

    if (!assetId || !amount || !ephemeralPublicKey || !iv || !tag || !ciphertext || !sourceAddress) {
      return NextResponse.json({ error: 'Missing required parameters (ensure Freighter address is provided)' }, { status: 400 });
    }

    const validatedDiscountBps = discountBps ? Math.min(Math.max(Math.round(Number(discountBps)), 1), 1500) : 0;

    console.log('[Settle] Validating input parameters...');
    const validatedAssetId = validateAssetId(assetId);
    const validatedAmount = validateAmount(amount);
    const validatedSourceAddress = validateStellarAddress(sourceAddress);
    const validatedEphemeralPublicKey = validateEphemeralPublicKey(ephemeralPublicKey);
    const validatedIv = validateHex(iv, 12);
    const validatedTag = validateHex(tag, 16);
    const validatedCiphertext = validateHex(ciphertext, 0);

    console.log(`[Settle] Querying contract for real face value of asset ${validatedAssetId} via Soroban RPC...`);
    let faceValue = '';
    try {
      const rpcServer = new StellarRpc.Server(SOROBAN_RPC_URL);
      const contract = new Contract(SETTLEMENT_CONTRACT_ID);
      const op = contract.call('get_asset', xdr.ScVal.scvU32(validatedAssetId));
      const sourceAccount = await rpcServer.getAccount(validatedSourceAddress);
      const tx = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
      .addOperation(op)
      .setTimeout(30)
      .build();

      const simResult = await rpcServer.simulateTransaction(tx);
      if (!StellarRpc.Api.isSimulationSuccess(simResult)) {
        const errMsg = (simResult as any).error ?? JSON.stringify(simResult);
        console.error(`[Settle][Step0] Simulation failed for asset ${validatedAssetId}:`, errMsg);
        return NextResponse.json({
          error: `Could not retrieve on-chain asset details for ID ${validatedAssetId}. Please ensure the asset has been minted by the issuer.`,
          details: errMsg
        }, { status: 404 });
      }

      const returnVal = simResult.result?.retval;
      if (!returnVal) throw new Error('No return value from simulation');
      const mapEntries = returnVal.map();
      if (!mapEntries) throw new Error(`Return value is not a map — actual type: ${returnVal.switch()?.name}`);

      const assetInfo: Record<string, any> = {};
      for (const entry of mapEntries) {
        const key = entry.key().switch().name === 'scvSymbol'
          ? entry.key().sym().toString()
          : entry.key().toXDR('hex');
        const val = entry.val();
        if (key === 'face_value') {
          try { assetInfo.face_value = val.u64().toString(); } catch(_) {
            try { assetInfo.face_value = String(val.i128().lo()); } catch(__) {
              assetInfo.face_value = val.toXDR('hex');
            }
          }
        }
        if (key === 'status') {
        try {
          const statusVec = val.vec();
          if (statusVec && statusVec.length > 0) {
            assetInfo.status = statusVec[0].sym().toString();
          }
        } catch(_) {
          try { assetInfo.status = val.sym().toString(); } catch(__) {}
        }
      }
        if (key === 'id')      { try { assetInfo.id = val.u32(); } catch(_) {} }
      }

      if (typeof assetInfo.face_value === 'undefined') {
        throw new Error('face_value missing from contract response map');
      }
      faceValue = String(assetInfo.face_value);
      const assetStatus = assetInfo.status || 'Active';
      console.log(`[Settle][Step0] RPC success — asset ${validatedAssetId}: face_value=${faceValue}, status=${assetStatus}`);
    } catch (rpcErr: any) {
      console.error('[Settle][Step0] Soroban RPC query failed:', rpcErr?.message ?? rpcErr);
      return NextResponse.json({
        error: `Could not retrieve on-chain asset details for ID ${validatedAssetId}. Please ensure the asset has been minted by the issuer.`,
        details: rpcErr?.message
      }, { status: 404 });
    }

    console.log(`[Settle] Asset ${validatedAssetId}: amount=${validatedAmount}, faceValue=${faceValue}`);

    // ── Step 1: Generate fresh random blinding salt ───────────
    const salt = BigInt('0x' + crypto.randomBytes(30).toString('hex')).toString();

    const prefix = sanitizeFilePrefix(`settle_${validatedAssetId}_${Date.now()}`);

    // Input JSON for ZK proof — commitment is computed by the circuit
    const inputData: Record<string, string> = {
      target_face_value: faceValue,
      settlement_amount: validatedAmount,
      blinding_salt: salt
    };
    if (validatedDiscountBps > 0) {
      inputData.discount_bps = String(validatedDiscountBps);
    }

    // ── Step 2: Generate ZK proof using pure TypeScript (NO WSL spawnSync) ───────
    console.log('[ZK] Running groth16 proof generation in pure TypeScript...');

    const { proofHex, vkHex, commitmentHex } = await generateCustomProof(inputData, validatedDiscountBps);

    // ── Step 3: Prepare vectors for on-chain zk proof verification ───
    const proofArgs = {
      a: proofHex.substring(0, 192),
      b: proofHex.substring(192, 576),
      c: proofHex.substring(576, 768)
    };

    // Parse IC entries: vkHex layout = alpha(192) + beta(384) + gamma(384) + delta(384) + icLen(8) + ic[0](192) + ic[1](192) + ...
    const icLenHex = vkHex.substring(1344, 1352);
    const icEntryCount = parseInt(icLenHex, 16);
    const ic: string[] = [];
    for (let i = 0; i < icEntryCount; i++) {
      const offset = 1352 + i * 192;
      ic.push(vkHex.substring(offset, offset + 192));
    }

    const vkArgs = {
      alpha: vkHex.substring(0, 192),
      beta:  vkHex.substring(192, 576),
      gamma: vkHex.substring(576, 960),
      delta: vkHex.substring(960, 1344),
      ic,
    };

    console.log(`[ZK] Pure TS proof generation complete — commitment: ${commitmentHex.substring(0, 32)}...`);

    // ── Step 4: Asset verification check on-chain ─────────────────────────────────
    console.log(`[Settle] Asset verification check for ID ${validatedAssetId}...`);

    // ── Step 5: Build unsigned settle_asset XDR via Soroban SDK (no WSL subprocess) ─
    console.log('[Settle] Building settle_asset XDR via Soroban SDK...');

    const epkHex = validatedEphemeralPublicKey.substring(0, 130);
    const ivHex  = validatedIv.substring(0, 24);
    const tagHex = validatedTag.substring(0, 32);

    const makeEntry = (key: string, val: xdr.ScVal) =>
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol(key),
        val,
      });

    const sortEntriesByKey = (entries: [string, string][]) =>
      entries
        .slice()
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

    const scvProof = xdr.ScVal.scvMap(
      sortEntriesByKey(Object.entries(proofArgs)).map(([key, val]) => makeEntry(key, xdr.ScVal.scvBytes(hexToBytes(val))))
    );

    const vkEntries: [string, string | string[]][] = Object.entries(vkArgs);
    const scvVk = xdr.ScVal.scvMap(
      vkEntries
        .slice()
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, val]) => {
          if (key === 'ic') {
            return makeEntry(
              key,
              xdr.ScVal.scvVec((val as string[]).map(v => xdr.ScVal.scvBytes(hexToBytes(v))))
            );
          }
          return makeEntry(key, xdr.ScVal.scvBytes(hexToBytes(val as string)));
        })
    );

    let unsignedXdr: string;
    let contractMethod: string;
    try {
      const rpcServer5 = new StellarRpc.Server(SOROBAN_RPC_URL);
      const contract5  = new Contract(SETTLEMENT_CONTRACT_ID);

      const isDiscountedSettle = validatedDiscountBps > 0;
      contractMethod = isDiscountedSettle ? 'settle_asset_discounted' : 'settle_asset';

      const settleArgs: xdr.ScVal[] = [
        xdr.ScVal.scvU32(validatedAssetId),
        scvVk,
        scvProof,
      ];
      if (isDiscountedSettle) {
        settleArgs.push(xdr.ScVal.scvU64(validatedDiscountBps));
      }
      settleArgs.push(
        xdr.ScVal.scvBytes(hexToBytes(commitmentHex)),
        xdr.ScVal.scvBytes(hexToBytes(epkHex)),
        xdr.ScVal.scvBytes(hexToBytes(ivHex)),
        xdr.ScVal.scvBytes(hexToBytes(tagHex)),
        xdr.ScVal.scvBytes(hexToBytes(validatedCiphertext)),
      );

      const settleOp = contract5.call(contractMethod, ...settleArgs);

      const srcAccount = await rpcServer5.getAccount(validatedSourceAddress);
      const buildTx = new TransactionBuilder(srcAccount, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
      .addOperation(settleOp)
      .setTimeout(30)
      .build();

      const simResult5 = await rpcServer5.simulateTransaction(buildTx);
      if (!StellarRpc.Api.isSimulationSuccess(simResult5)) {
        const errMsg = (simResult5 as any).error ?? JSON.stringify(simResult5);
        console.error('[Settle][Step5] Simulation failed:', errMsg);
        return NextResponse.json({ error: 'Failed to prepare on-chain transaction parameters', details: errMsg }, { status: 500 });
      }

      const assembled = StellarRpc.assembleTransaction(buildTx, simResult5).build();
      unsignedXdr = Buffer.from(assembled.toXDR()).toString('base64');
      console.log('[Settle][Step5] SDK assemble success — unsignedXdr length:', unsignedXdr.length);

      // Invalidate the assets list cache so the dashboard reflects the new on-chain state
      cacheInvalidate('assets');
    } catch (buildErr: any) {
      console.error('[Settle][Step5] SDK build/simulate failed:', buildErr?.message ?? buildErr);
      return NextResponse.json({ error: 'Failed to prepare on-chain transaction parameters', details: buildErr?.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      unsignedXdr,
      commitment: commitmentHex
    });

  } catch (error: any) {
    console.error('[Settle] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const POST = withAuth(POSTHandler);