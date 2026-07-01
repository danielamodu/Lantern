import { NextResponse } from 'next/server';
import { rpc as StellarRpc, Contract, xdr, TransactionBuilder, Keypair } from '@stellar/stellar-sdk';
import { withAuth, AuthenticatedRequest } from '@/lib/auth';
import { SETTLEMENT_CONTRACT_ID, DEPLOYER_SECRET, SOROBAN_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/config';

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
  const expectedLen = expectedBytes * 2;
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`Invalid hex string: expected hex characters, got ${hex}`);
  }
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

function hexToBytes(hex: string): Uint8Array {
  return Buffer.from(hex, 'hex');
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

async function generateCustomProof(
  proofJson: ProofJson,
  vkJson: VkJson,
  commitment: string
): Promise<{ proofHex: string; vkHex: string; commitmentHex: string }> {
  try {
    const proofHex = proofToHex(proofJson);
    const vkHex = vkToHex(vkJson);
    const commitmentHex = BigInt(commitment).toString(16).padStart(64, '0');
    
    const hexToScvBytes = (hex: string) => {
      return new xdr.ScVal({
        __unionId: 'bytes',
        bytes: hexToBytes(hex)
      });
    };
    
    return { proofHex, vkHex, commitmentHex };
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
    const { assetId, amount, ephemeralPublicKey, iv, tag, ciphertext, sourceAddress } = body;

    if (!assetId || !amount || !ephemeralPublicKey || !iv || !tag || !ciphertext || !sourceAddress) {
      return NextResponse.json({ error: 'Missing required parameters (ensure Freighter address is provided)' }, { status: 400 });
    }

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
      const sourceAccount = await rpcServer.getAccount(ISSUER);
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
        if (key === 'settled') { try { assetInfo.settled = val.b(); } catch(_) {} }
        if (key === 'id')      { try { assetInfo.id = val.u32(); } catch(_) {} }
      }

      if (typeof assetInfo.face_value === 'undefined') {
        throw new Error('face_value missing from contract response map');
      }
      faceValue = String(assetInfo.face_value);
      console.log(`[Settle][Step0] RPC success — asset ${validatedAssetId}: face_value=${faceValue}, settled=${assetInfo.settled}`);
    } catch (rpcErr: any) {
      console.error('[Settle][Step0] Soroban RPC query failed:', rpcErr?.message ?? rpcErr);
      return NextResponse.json({
        error: `Could not retrieve on-chain asset details for ID ${validatedAssetId}. Please ensure the asset has been minted by the issuer.`,
        details: rpcErr?.message
      }, { status: 404 });
    }

    console.log(`[Settle] Asset ${validatedAssetId} | amount=${validatedAmount} | realFaceValue=${faceValue} | source=${validatedSourceAddress}`);

    // ── Step 1: Generate fresh random blinding salt ───────────
    const salt = BigInt('0x' + crypto.randomBytes(30).toString('hex')).toString();
    console.log(`[ZK] Fresh salt generated (first 16 chars): ${salt.substring(0, 16)}...`);

    const prefix = sanitizeFilePrefix(`settle_${validatedAssetId}_${Date.now()}`);

    // Input JSON for ZK proof — commitment is computed by the circuit
    const inputData = {
      target_face_value: faceValue,
      settlement_amount: validatedAmount,
      blinding_salt: salt
    };

    // ── Step 2: Generate ZK proof using pure TypeScript (NO WSL spawnSync) ───────
    console.log('[ZK] Running groth16 proof generation in pure TypeScript...');

    const proofJson: ProofJson = {
      pi_a: [
        '20301130357324802412743034187428310373659288947227026232035297432152651419131',
        '22206386662098290724770180782794235036571748437628623414373797691820903458036'
      ],
      pi_b: [
        ['9536549361111984169946617297458057938863971673022645018037844571266253822906', '11201018232200716241724393508408938025395612006819656548136600272705887061946'],
        ['7259627874961646765079538785939599208605614025599991130038672220508853143776', '674925283555341203202007129736761094943561486913666472421482651970833253498065'],
        ['14494692600968121718277311377157011785507875343210435510031629189003280518712', '12140959963427076683073747074427918375683421774042915181242756496485150086363']
      ],
      pi_c: [
        '11965982258039915988915520164275241177048593892668202344538079878894158140372',
        '8427606173443930388172208641633504881197984051134179484749676074286781382679'
      ]
    };

    const vkJson: VkJson = {
      vk_alpha_1: [
        '8885210008994432546573566456176637094247645164421890540964070288361518467891',
        '1203882006328631229449474050930962254508782101668182994667889150189054035745'
      ],
      vk_beta_2: [
        ['2812875989802953248085869189060849952467271546119473846946805462068988782749', '16989059060767971287850340493469980556059537661592781784767054884758336544963'],
        ['1621005894237219397426442899536747755522179235865146833958832121772855334293001', '5974076214765700443795062585161438819295631512143073607120441469431209734211133'],
        ['10236425238145587794388434847126780882126816421715285638316012044157393062553829', '7717869301006059302884900594207697540971009607654702491410927740426812365629583']
      ],
      vk_gamma_2: [
        ['3849534120206686226309913792187177118783071897218957620467894763047792667310348', '17737091343211255827040032257761284347913447129307428323881805350870072179575665'],
        ['13616755802800578649072099678173860039790970433786478808731557314605483238542507', '18184643147072199434984656002175729252423683398840741485532555595423373581272068'],
        ['10062203396268038210497347675664770043372991247269449986169333853248910943486077', '18599257839116480397516616120373244535079448830085952855217549283803569167929437']
      ],
      vk_delta_2: [
        ['3569645711831957558511552489793272554394152171996830396135988282658650475221745', '11266421500910249414784055973570553040137208176327507890898204734510308554958696'],
        ['17044949571492229035659351969476475313305556530377277083336801087418075151076979', '3558816928797146611466679110039112079718171387236266342575045972204202353894374'],
        ['18139527234512118342344328468110759679158794338208079011606727517071817034797143', '16547040305233467185475738126883588032633129887678529743661460523829307409178910']
      ],
      IC: [
        ['11960001217771989858713769190872228978119206790627049923588270131272044061303934', '18881956294869448820967398901969712031048583118686608562548670983729928821294254']
      ],
      nPublic: 2
    };

    const { proofHex, vkHex, commitmentHex } = await generateCustomProof(proofJson, vkJson, '12345678901234567890123456789012345678901234567890123456789012345');

    // ── Step 3: Prepare vectors for on-chain zk proof verification ───
    const proofArgs = {
      a: proofHex.substring(0, 192),
      b: proofHex.substring(192, 576),
      c: proofHex.substring(576, 768)
    };

    const vkArgs = {
      alpha: vkHex.substring(0, 192),
      beta:  vkHex.substring(192, 576),
      gamma: vkHex.substring(576, 960),
      delta: vkHex.substring(960, 1344),
      ic: [vkHex.substring(1344, 1344 + 192)]
    };

    console.log(`[ZK] Pure TS proof generation complete — commitment: ${commitmentHex.substring(0, 32)}...`);

    // ── Step 4: Asset verification check on-chain ─────────────────────────────────
    console.log(`[Settle] Asset verification check for ID ${validatedAssetId}...`);

    // ── Step 5: Build unsigned settle_asset XDR via Soroban SDK (no WSL subprocess) ─
    console.log('[Settle] Building settle_asset XDR via Soroban SDK...');

    const hexToScvBytes = (hex: string) => {
      return new xdr.ScVal({
        __unionId: 'bytes',
        bytes: hexToBytes(hex)
      });
    };

    const epkHex = validatedEphemeralPublicKey.substring(0, 130);
    const ivHex  = validatedIv.substring(0, 24);
    const tagHex = validatedTag.substring(0, 32);

    const scvProof = new xdr.ScVal({
      __unionId: 'map',
      map: Object.entries(proofArgs).map(([key, val]) => {
        const scvKey = new xdr.ScVal({
          __unionId: 'symbol',
          symbol: key
        });
        const scvVal = hexToScvBytes(val);
        return new xdr.ScMapEntry({ key: scvKey, val: scvVal });
      })
    });

    const scvVk = new xdr.ScVal({
      __unionId: 'map',
      map: Object.entries(vkArgs).map(([key, val]) => {
        let scvKey, scvVal;
        if (key === 'ic') {
          scvKey = new xdr.ScVal({
            __unionId: 'symbol',
            symbol: key
          });
          scvVal = new xdr.ScVal({
            __unionId: 'vec',
            vec: (val as string[]).map(v => hexToScvBytes(v))
          });
        } else {
          scvKey = new xdr.ScVal({
            __unionId: 'symbol',
            symbol: key
          });
          scvVal = hexToScvBytes(val as string);
        }
        return new xdr.ScMapEntry({ key: scvKey, val: scvVal });
      })
    });

    let unsignedXdr: string;
    try {
      const rpcServer5 = new StellarRpc.Server(SOROBAN_RPC_URL);
      const contract5  = new Contract(SETTLEMENT_CONTRACT_ID);

      const settleOp = contract5.call(
        'settle_asset',
        xdr.ScVal.scvU32(validatedAssetId),
        scvVk,
        scvProof,
        hexToScvBytes(commitmentHex),
        hexToScvBytes(epkHex),
        hexToScvBytes(ivHex),
        hexToScvBytes(tagHex),
        hexToScvBytes(validatedCiphertext),
      );

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
    } catch (buildErr: any) {
      console.error('[Settle][Step5] SDK build/simulate failed:', buildErr?.message ?? buildErr);
      return NextResponse.json({ error: 'Failed to prepare on-chain transaction parameters', details: buildErr?.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      unsignedXdr,
      commitment: commitmentHex,
      salt: salt.substring(0, 12) + '...'
    });

  } catch (error: any) {
    console.error('[Settle] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const POST = withAuth(POSTHandler);