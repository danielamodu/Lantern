import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import { Horizon, TransactionBuilder, rpc as StellarRpc, Contract, xdr } from '@stellar/stellar-sdk';
import { writeFileSync, readFileSync } from 'fs';
import crypto from 'crypto';
import { bls12_381 } from '@noble/curves/bls12-381';

// ── circom2soroban: TypeScript port of stellar-circom2soroban Rust CLI ──────
// Replicates arkworks serialize_uncompressed for BLS12-381 G1 (96 bytes) and G2 (192 bytes).
// Input: decimal coordinate strings from snarkjs JSON files.
// Output: hex string identical to what the Rust binary produces.

/** Pad a BigInt to exactly `len` bytes, big-endian */
function bigintToBytesBE(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let tmp = n;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(tmp & BigInt(0xff));
    tmp >>= BigInt(8);
  }
  return out;
}

/** BLS12-381 G1 uncompressed serialization: x(48 BE) ++ y(48 BE) = 96 bytes */
function g1ToBytes(x: string, y: string): Uint8Array {
  const FP_SIZE = 48;
  const xBytes = bigintToBytesBE(BigInt(x), FP_SIZE);
  const yBytes = bigintToBytesBE(BigInt(y), FP_SIZE);
  const out = new Uint8Array(FP_SIZE * 2);
  out.set(xBytes, 0);
  out.set(yBytes, FP_SIZE);
  return out;
}

/** BLS12-381 G2 uncompressed serialization: x.c0(48) ++ x.c1(48) ++ y.c0(48) ++ y.c1(48) = 192 bytes */
function g2ToBytes(x1: string, x2: string, y1: string, y2: string): Uint8Array {
  const FP_SIZE = 48;
  const xc0 = bigintToBytesBE(BigInt(x1), FP_SIZE);
  const xc1 = bigintToBytesBE(BigInt(x2), FP_SIZE);
  const yc0 = bigintToBytesBE(BigInt(y1), FP_SIZE);
  const yc1 = bigintToBytesBE(BigInt(y2), FP_SIZE);
  const out = new Uint8Array(FP_SIZE * 4);
  out.set(xc0,           0);
  out.set(xc1,    FP_SIZE);
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

/** Returns the full raw bytes that stellar-circom2soroban outputs for a proof JSON */
function proofToHex(proofJson: ProofJson): string {
  const a = g1ToBytes(proofJson.pi_a[0], proofJson.pi_a[1]);
  // snarkjs stores G2 elements as [c1, c0] (imaginary, real).
  // We must swap the indexing to pass them as [c0, c1] to matches G2 uncompressed structure.
  const b = g2ToBytes(proofJson.pi_b[0][1], proofJson.pi_b[0][0], proofJson.pi_b[1][1], proofJson.pi_b[1][0]);
  const c = g1ToBytes(proofJson.pi_c[0], proofJson.pi_c[1]);
  return Buffer.from(concat(a, b, c)).toString('hex');
}

/** Returns the full raw bytes that stellar-circom2soroban outputs for a vk JSON */
function vkToHex(vkJson: VkJson): string {
  const alpha = g1ToBytes(vkJson.vk_alpha_1[0], vkJson.vk_alpha_1[1]);
  const beta  = g2ToBytes(vkJson.vk_beta_2[0][1],  vkJson.vk_beta_2[0][0],  vkJson.vk_beta_2[1][1],  vkJson.vk_beta_2[1][0]);
  const gamma = g2ToBytes(vkJson.vk_gamma_2[0][1], vkJson.vk_gamma_2[0][0], vkJson.vk_gamma_2[1][1], vkJson.vk_gamma_2[1][0]);
  const delta = g2ToBytes(vkJson.vk_delta_2[0][1], vkJson.vk_delta_2[0][0], vkJson.vk_delta_2[1][1], vkJson.vk_delta_2[1][0]);
  const icLen = uint32BE(vkJson.IC.length);
  const icParts = vkJson.IC.map(ic => g1ToBytes(ic[0], ic[1]));
  return Buffer.from(concat(alpha, beta, gamma, delta, icLen, ...icParts)).toString('hex');
}
// ─────────────────────────────────────────────────────────────────────────────

const CONTRACT_ID = 'CACFHOCMFKHVUR4UKS5W5XG4QCQBDCDDDT54SOOMHYBHKZIQA43MREUT';
const ISSUER = 'GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4';

const CIRCUITS_WSL = '/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/Lantern/circuits';
const CIRCUITS_WIN = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\scratch\\Lantern\\circuits';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ── PHASE 2: Submit Signed Transaction XDR ──────────────────────────────
    if (body.signedXdr) {
      console.log('[Settle] Submitting signed XDR via Horizon Server...');
      
      // Verify signedXdr is a plain string
      console.log(`[Settle] Verifying signedXdr type: ${typeof body.signedXdr}`);
      if (typeof body.signedXdr !== 'string') {
        console.error('[Settle] Error: signedXdr is not a plain string! Received:', body.signedXdr);
        return NextResponse.json({ 
          error: 'Horizon transaction submission failed', 
          details: `Expected signedXdr to be a string, got ${typeof body.signedXdr}` 
        }, { status: 400 });
      }

      try {
        const server = new Horizon.Server('https://horizon-testnet.stellar.org');
        const tx = TransactionBuilder.fromXDR(body.signedXdr, 'Test SDF Network ; September 2015');
        const submitResult = await server.submitTransaction(tx);

        console.log(`[Settle] Transaction successfully submitted! Hash: ${submitResult.hash}`);
        return NextResponse.json({
          success: true,
          txHash: submitResult.hash,
          ledgerUrl: `https://stellar.expert/explorer/testnet/tx/${submitResult.hash}`
        });
      } catch (err: any) {
        console.error('[Settle] Full submission error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        if (err.response?.status) {
          console.error(`[Settle] HTTP Status: ${err.response.status} — ${err.response.statusText}`);
        }
        const errDetails = err.response?.data || err.message;
        return NextResponse.json({ 
          error: 'Horizon transaction submission failed', 
          details: errDetails 
        }, { status: 500 });
      }
    }

    // ── PHASE 1: Prepare Unsigned Transaction XDR ───────────────────────────
    const { assetId, amount, ephemeralPublicKey, iv, tag, ciphertext, sourceAddress } = body;

    if (!assetId || !amount || !ephemeralPublicKey || !iv || !tag || !ciphertext || !sourceAddress) {
      return NextResponse.json({ error: 'Missing required parameters (ensure Freighter address is provided)' }, { status: 400 });
    }

    // ── Step 0: Query the REAL on-chain face_value via direct Soroban RPC (no WSL subprocess)
    // Root cause of prior ETIMEDOUT: WSL2 child processes spawned from Windows Node lose
    // their network bridge. Fix: call the Soroban JSON-RPC directly from Node's own network.
    console.log(`[Settle] Querying contract for real face value of asset ${assetId} via Soroban RPC...`);
    let faceValue = '';
    try {
      const rpcServer = new StellarRpc.Server('https://soroban-testnet.stellar.org');
      const contract = new Contract(CONTRACT_ID);
      // Build an invokeHostFunction operation for get_asset(asset_id: u32)
      const op = contract.call('get_asset', xdr.ScVal.scvU32(Number(assetId)));
      // We need a dummy source account to simulate — use a well-known funded testnet account
      // or the ISSUER address. simulateTransaction doesn't require signing.
      const sourceAccount = await rpcServer.getAccount(ISSUER);
      const tx = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const simResult = await rpcServer.simulateTransaction(tx);
      if (!StellarRpc.Api.isSimulationSuccess(simResult)) {
        const errMsg = (simResult as any).error ?? JSON.stringify(simResult);
        console.error(`[Settle][Step0] Simulation failed for asset ${assetId}:`, errMsg);
        return NextResponse.json({
          error: `Could not retrieve on-chain asset details for ID ${assetId}. Please ensure the asset has been minted by the issuer.`,
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
        if (key === 'settled') { try { assetInfo.settled = val.b(); } catch(_) {} }
        if (key === 'id')      { try { assetInfo.id = val.u32(); } catch(_) {} }
      }

      if (typeof assetInfo.face_value === 'undefined') {
        throw new Error('face_value missing from contract response map');
      }
      faceValue = String(assetInfo.face_value);
      console.log(`[Settle][Step0] RPC success — asset ${assetId}: face_value=${faceValue}, settled=${assetInfo.settled}`);
    } catch (rpcErr: any) {
      console.error('[Settle][Step0] Soroban RPC query failed:', rpcErr?.message ?? rpcErr);
      return NextResponse.json({
        error: `Could not retrieve on-chain asset details for ID ${assetId}. Please ensure the asset has been minted by the issuer.`,
        details: rpcErr?.message
      }, { status: 404 });
    }

    console.log(`[Settle] Asset ${assetId} | amount=${amount} | realFaceValue=${faceValue} | source=${sourceAddress}`);

    // ── Step 1: Generate fresh random blinding salt (per-request) ───────────
    // randomBytes(30) → BigInt so it fits safely in the BLS12-381 scalar field
    const salt = BigInt('0x' + crypto.randomBytes(30).toString('hex')).toString();
    console.log(`[ZK] Fresh salt generated (first 16 chars): ${salt.substring(0, 16)}...`);

    const now = Date.now();
    const prefix = `settle_${assetId}_${now}`;

    // Input JSON for fullProve — commitment is NOT provided; the circuit computes it
    const inputData = {
      target_face_value: faceValue,
      settlement_amount: String(amount),
      blinding_salt: salt
    };

    const inputWinPath  = `${CIRCUITS_WIN}\\${prefix}_input.json`;
    const proofWslPath  = `${CIRCUITS_WSL}/${prefix}_proof.json`;
    const publicWslPath = `${CIRCUITS_WSL}/${prefix}_public.json`;
    const proofWinPath  = `${CIRCUITS_WIN}\\${prefix}_proof.json`;
    const publicWinPath = `${CIRCUITS_WIN}\\${prefix}_public.json`;

    writeFileSync(inputWinPath, JSON.stringify(inputData, null, 2));

    // ── Step 2: Generate ZK proof — commitment comes OUT as publicSignals[0] ─
    // Run snarkjs via native Windows node (avoids WSL VM timeout crashes)
    console.log('[ZK] Running groth16 fullProve (native Windows node)...');
    const snarkjsCli = `${CIRCUITS_WIN}\\node_modules\\snarkjs\\build\\cli.cjs`;
    const wasmPath   = `${CIRCUITS_WIN}\\settlement_js\\settlement.wasm`;
    const zkeyPath   = `${CIRCUITS_WIN}\\settlement_final.zkey`;
    const proveResult = spawnSync('node', [
      snarkjsCli,
      'groth16', 'fullprove',
      inputWinPath,
      wasmPath,
      zkeyPath,
      proofWinPath,
      publicWinPath
    ], { encoding: 'utf8', timeout: 120000 });

    if (proveResult.status !== 0) {
      console.error('[ZK] fullProve failed with status:', proveResult.status);
      console.error('[ZK] fullProve stderr:', proveResult.stderr);
      console.error('[ZK] fullProve stdout:', proveResult.stdout);
      return NextResponse.json({
        error: `Zero-Knowledge Proof generation failed — settlement amount ${amount} does not satisfy compliance constraint (face value ${faceValue})`,
        details: (proveResult.stderr || '').substring(0, 500)
      }, { status: 400 });
    }

    // Read the fresh commitment from publicSignals[0] (circuit computed it)
    const publicSignals: string[] = JSON.parse(
      readFileSync(publicWinPath, 'utf8')
    );
    const freshCommitment = publicSignals[0]; // Poseidon255(amount, salt) — computed by WASM
    console.log(`[ZK] Fresh commitment: ${freshCommitment.substring(0, 32)}...`);
    console.log(`[ZK] Public face value confirmed: ${publicSignals[1]}`);

    // ── Step 3: Convert proof + VK to Soroban hex format (pure TS, no WSL subprocess) ─
    // stellar-circom2soroban ported inline: reads snarkjs JSON, serializes BLS12-381 points
    // to arkworks uncompressed format (G1=96 bytes, G2=192 bytes), concatenates into hex blob.
    const vkWinPath = `${CIRCUITS_WIN}\\verification_key.json`;
    let proofHex: string;
    let vkHex: string;
    try {
      const proofJson: ProofJson = JSON.parse(readFileSync(proofWinPath, 'utf8'));
      const vkJson: VkJson       = JSON.parse(readFileSync(vkWinPath,    'utf8'));
      proofHex = proofToHex(proofJson);
      vkHex    = vkToHex(vkJson);
      console.log(`[ZK] circom2soroban TS: proofHex length=${proofHex.length}, vkHex length=${vkHex.length}`);
    } catch (convErr: any) {
      console.error('[ZK] circom2soroban TS conversion failed:', convErr?.message, convErr?.stack);
      return NextResponse.json({ error: 'Failed to convert ZK proof/VK to Soroban format', details: convErr?.message }, { status: 500 });
    }

    const customProof = {
      a: proofHex.substring(0, 192),
      b: proofHex.substring(192, 576),
      c: proofHex.substring(576, 768)
    };

    const icLenHex = vkHex.substring(192 + 384 + 384 + 384, 192 + 384 + 384 + 384 + 8);
    const icLen    = parseInt(icLenHex, 16);
    const ic: string[] = [];
    let idx = 192 + 384 + 384 + 384 + 8;
    for (let i = 0; i < icLen; i++) { ic.push(vkHex.substring(idx, idx + 192)); idx += 192; }

    const customVk = {
      alpha: vkHex.substring(0, 192),
      beta:  vkHex.substring(192, 576),
      gamma: vkHex.substring(576, 960),
      delta: vkHex.substring(960, 1344),
      ic
    };

    const proofArgsWinPath = `${CIRCUITS_WIN}\\${prefix}_proof_args.json`;
    const vkArgsWinPath    = `${CIRCUITS_WIN}\\${prefix}_vk_args.json`;
    const proofArgsWslPath = `${CIRCUITS_WSL}/${prefix}_proof_args.json`;
    const vkArgsWslPath    = `${CIRCUITS_WSL}/${prefix}_vk_args.json`;

    writeFileSync(proofArgsWinPath, JSON.stringify(customProof, null, 2));
    writeFileSync(vkArgsWinPath,    JSON.stringify(customVk, null, 2));

    // Commitment as 32-byte hex for the on-chain call
    const commitmentHex = BigInt(freshCommitment).toString(16).padStart(64, '0');

    // ── Step 4: Asset verification checks on-chain ──────────────────────────
    // The asset must have been pre-minted by the issuer. We do not auto-mint on demand.
    console.log(`[Settle] Asset verification check for ID ${assetId}...`);

    // ── Step 5: Build unsigned settle_asset XDR via Soroban RPC (no WSL subprocess)
    // Same ETIMEDOUT root cause as Step 0: WSL2 child network bridge broken for Windows Node children.
    // Fix: use the SDK to simulate + assemble the transaction, which produces the same unsigned XDR
    // that `stellar contract invoke --build-only` would produce.
    console.log('[Settle] Building settle_asset XDR via Soroban SDK simulateTransaction + assembleTransaction...');

    // Helper: hex string → ScVal bytes
    const hexToScvBytes = (hex: string) => xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'));

    // Normalise ephemeral_public_key: must be 65 bytes (uncompressed, with 04 prefix)
    const epkHex = (ephemeralPublicKey.startsWith('04') ? ephemeralPublicKey : '04' + ephemeralPublicKey).substring(0, 130);
    // iv: 12 bytes (24 hex chars), tag: 16 bytes (32 hex chars)
    const ivHex  = iv.substring(0, 24);
    const tagHex = tag.substring(0, 32);

    // Read the proof/vk JSON files written in Step 3 (already on disk from circom2soroban)
    const proofArgs = JSON.parse(readFileSync(proofArgsWinPath, 'utf8')) as { a: string; b: string; c: string };
    const vkArgs    = JSON.parse(readFileSync(vkArgsWinPath,    'utf8')) as { alpha: string; beta: string; gamma: string; delta: string; ic: string[] };

    // Build ScVal representations of proof and vk as maps matching the contract's Rust struct layout.
    // Each field is a hex-encoded compressed/uncompressed curve point → ScVal::Bytes.
    const scvProof = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('a'), val: hexToScvBytes(proofArgs.a) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('b'), val: hexToScvBytes(proofArgs.b) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('c'), val: hexToScvBytes(proofArgs.c) }),
    ]);

    const scvVk = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('alpha'), val: hexToScvBytes(vkArgs.alpha) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('beta'),  val: hexToScvBytes(vkArgs.beta)  }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('delta'), val: hexToScvBytes(vkArgs.delta) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('gamma'), val: hexToScvBytes(vkArgs.gamma) }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('ic'),
        val: xdr.ScVal.scvVec(vkArgs.ic.map(hexToScvBytes)),
      }),
    ]);

    let unsignedXdr: string;
    try {
      const rpcServer5 = new StellarRpc.Server('https://soroban-testnet.stellar.org');
      const contract5  = new Contract(CONTRACT_ID);

      const settleOp = contract5.call(
        'settle_asset',
        xdr.ScVal.scvU32(Number(assetId)),
        scvVk,
        scvProof,
        hexToScvBytes(commitmentHex),
        hexToScvBytes(epkHex),
        hexToScvBytes(ivHex),
        hexToScvBytes(tagHex),
        hexToScvBytes(ciphertext),
      );

      // Use sourceAddress as the transaction source — same as --source-account in the CLI call.
      // getAccount will fetch the current sequence number from the network.
      const srcAccount = await rpcServer5.getAccount(sourceAddress);
      const buildTx = new TransactionBuilder(srcAccount, {
        fee: '100',
        networkPassphrase: 'Test SDF Network ; September 2015',
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

      // assembleTransaction fills in the resource footprint, auth entries, and fee bump — 
      // producing the same unsigned XDR that `--build-only` returns.
      const assembled = StellarRpc.assembleTransaction(buildTx, simResult5).build();
      unsignedXdr = assembled.toXDR().toString('base64');
      console.log('[Settle][Step5] SDK assemble success — unsignedXdr length:', unsignedXdr.length);
    } catch (buildErr: any) {
      console.error('[Settle][Step5] SDK build/simulate failed:', buildErr?.message ?? buildErr);
      return NextResponse.json({ error: 'Failed to prepare on-chain transaction parameters', details: buildErr?.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      unsignedXdr,
      // Expose for debugging/audit — the fresh commitment this request proved
      commitment: freshCommitment,
      salt: salt.substring(0, 12) + '...' // partial for UI display
    });

  } catch (error: any) {
    console.error('[Settle] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
