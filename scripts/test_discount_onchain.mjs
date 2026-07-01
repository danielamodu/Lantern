import { TransactionBuilder, rpc as StellarRpc, Contract, xdr, Keypair, Networks } from '@stellar/stellar-sdk';
import { readFileSync } from 'fs';

const CONTRACT_ID = 'CDGFOX2B3FS2SF2WQ76JPXFJI5RM5EFZ26DTGW3BTC2FWW2BTSVJJZ3A';
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

const hexToScvBytes = (hex) => xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'));

async function main() {
  const rpcServer = new StellarRpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);

  const deployerSecret = process.env.DEPLOYER_SECRET;
  if (!deployerSecret) { console.error('Set DEPLOYER_SECRET env var'); process.exit(1); }
  const deployerKeypair = Keypair.fromSecret(deployerSecret);
  const sourceAddress = deployerKeypair.publicKey();
  const srcAccount = await rpcServer.getAccount(sourceAddress);

  // ── Test A: Exact-match settle_asset ──────────────────────────────
  const assetIdExact = 301;
  console.log(`\n[Test A] settle_asset on asset ${assetIdExact}...`);

  const vkExact = JSON.parse(readFileSync('circuits/custom_vk_args.json', 'utf8'));
  const proofExact = JSON.parse(readFileSync('circuits/custom_proof_args.json', 'utf8'));
  const commitmentHex = '572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532';

  const scvVkExact = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('alpha'), val: hexToScvBytes(vkExact.alpha) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('beta'),  val: hexToScvBytes(vkExact.beta)  }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('delta'), val: hexToScvBytes(vkExact.delta) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('gamma'), val: hexToScvBytes(vkExact.gamma) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('ic'),    val: xdr.ScVal.scvVec(vkExact.ic.map(hexToScvBytes)) }),
  ]);

  const scvProofExact = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('a'), val: hexToScvBytes(proofExact.a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('b'), val: hexToScvBytes(proofExact.b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('c'), val: hexToScvBytes(proofExact.c) }),
  ]);

  const zeroHex = (len) => '0'.repeat(len * 2);

  const settleOpExact = contract.call(
    'settle_asset',
    xdr.ScVal.scvU32(assetIdExact),
    scvVkExact,
    scvProofExact,
    hexToScvBytes(commitmentHex),
    hexToScvBytes(zeroHex(65)),
    hexToScvBytes(zeroHex(12)),
    hexToScvBytes(zeroHex(16)),
    hexToScvBytes(''),
  );

  const txExact = new TransactionBuilder(srcAccount, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(settleOpExact)
    .setTimeout(30)
    .build();

  const simExact = await rpcServer.simulateTransaction(txExact);
  if (!StellarRpc.Api.isSimulationSuccess(simExact)) {
    console.error('[Test A] Simulation failed:', JSON.stringify(simExact.error || simExact));
    process.exit(1);
  }

  const assembledExact = StellarRpc.assembleTransaction(txExact, simExact).build();
  assembledExact.sign(deployerKeypair);

  const resultExact = await rpcServer.sendTransaction(assembledExact);
  console.log(`[Test A] settle_asset tx sent: ${resultExact.hash}`);
  console.log(`[Test A] https://stellar.expert/explorer/testnet/tx/${resultExact.hash}`);

  if (resultExact.status === 'ERROR') {
    console.error('[Test A] Error:', resultExact.errorResult);
    process.exit(1);
  }

  let txStatus = resultExact;
  while (txStatus.status === 'PENDING' || txStatus.status === 'NOT_FOUND') {
    await new Promise(r => setTimeout(r, 2000));
    txStatus = await rpcServer.getTransaction(resultExact.hash);
  }
  console.log(`[Test A] Final status: ${txStatus.status}`);

  // ── Test B: Discount settle_asset_discounted ──────────────────────
  const assetIdDiscount = 302;
  console.log(`\nMinting asset ${assetIdDiscount} for discount test...`);

  const mintOp = contract.call(
    'mint_asset',
    xdr.ScVal.scvU32(assetIdDiscount),
    xdr.ScVal.scvAddress(sourceAddress),
    xdr.ScVal.scvU64(1000),
  );

  const srcAccount2 = await rpcServer.getAccount(sourceAddress);
  const mintTx = new TransactionBuilder(srcAccount2, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(mintOp)
    .setTimeout(30)
    .build();

  const simMint = await rpcServer.simulateTransaction(mintTx);
  if (!StellarRpc.Api.isSimulationSuccess(simMint)) {
    console.error('Mint simulation failed:', JSON.stringify(simMint.error || simMint));
    process.exit(1);
  }
  const assembledMint = StellarRpc.assembleTransaction(mintTx, simMint).build();
  assembledMint.sign(deployerKeypair);
  const mintResult = await rpcServer.sendTransaction(assembledMint);
  console.log(`Mint tx sent: ${mintResult.hash}`);
  let mintStatus = mintResult;
  while (mintStatus.status === 'PENDING' || mintStatus.status === 'NOT_FOUND') {
    await new Promise(r => setTimeout(r, 2000));
    mintStatus = await rpcServer.getTransaction(mintResult.hash);
  }
  console.log(`Mint final status: ${mintStatus.status}`);

  console.log(`\n[Test B] settle_asset_discounted on asset ${assetIdDiscount}...`);

  const discountData = JSON.parse(readFileSync('circuits/discount_onchain_data.json', 'utf8'));
  const discountBps = 500;
  const discountCommitmentHex = discountData.publicSignals[2];

  const scvVkDiscount = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('alpha'), val: hexToScvBytes(discountData.vk.alpha) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('beta'),  val: hexToScvBytes(discountData.vk.beta)  }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('delta'), val: hexToScvBytes(discountData.vk.delta) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('gamma'), val: hexToScvBytes(discountData.vk.gamma) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('ic'),    val: xdr.ScVal.scvVec(discountData.vk.ic.map(hexToScvBytes)) }),
  ]);

  const scvProofDiscount = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('a'), val: hexToScvBytes(discountData.proof.a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('b'), val: hexToScvBytes(discountData.proof.b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('c'), val: hexToScvBytes(discountData.proof.c) }),
  ]);

  const srcAccount3 = await rpcServer.getAccount(sourceAddress);
  const settleOpDiscount = contract.call(
    'settle_asset_discounted',
    xdr.ScVal.scvU32(assetIdDiscount),
    scvVkDiscount,
    scvProofDiscount,
    xdr.ScVal.scvU64(discountBps),
    hexToScvBytes(discountCommitmentHex),
    hexToScvBytes(zeroHex(65)),
    hexToScvBytes(zeroHex(12)),
    hexToScvBytes(zeroHex(16)),
    hexToScvBytes(''),
  );

  const txDiscount = new TransactionBuilder(srcAccount3, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(settleOpDiscount)
    .setTimeout(30)
    .build();

  const simDiscount = await rpcServer.simulateTransaction(txDiscount);
  if (!StellarRpc.Api.isSimulationSuccess(simDiscount)) {
    console.error('[Test B] Simulation failed:', JSON.stringify(simDiscount.error || simDiscount));
    process.exit(1);
  }

  const assembledDiscount = StellarRpc.assembleTransaction(txDiscount, simDiscount).build();
  assembledDiscount.sign(deployerKeypair);

  const resultDiscount = await rpcServer.sendTransaction(assembledDiscount);
  console.log(`[Test B] settle_asset_discounted tx sent: ${resultDiscount.hash}`);
  console.log(`[Test B] https://stellar.expert/explorer/testnet/tx/${resultDiscount.hash}`);

  if (resultDiscount.status === 'ERROR') {
    console.error('[Test B] Error:', resultDiscount.errorResult);
    process.exit(1);
  }

  let txStatusD = resultDiscount;
  while (txStatusD.status === 'PENDING' || txStatusD.status === 'NOT_FOUND') {
    await new Promise(r => setTimeout(r, 2000));
    txStatusD = await rpcServer.getTransaction(resultDiscount.hash);
  }
  console.log(`[Test B] Final status: ${txStatusD.status}`);
  console.log('\n=== Both settlement paths tested on-chain ===');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
