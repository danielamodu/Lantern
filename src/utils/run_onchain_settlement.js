import { spawnSync, execSync } from 'child_process';
import { generateAuditorKeyPair, encryptSettlement, decryptSettlement } from './cryptoDisclosure.js';
import { xdr, scValToNative } from '@stellar/stellar-sdk';

function runOnChainSettlement() {
  console.log("=== Starting End-to-End On-Chain Private Settlement & Disclosure Process ===");

  // 1. Generate real fresh keypair for the Auditor
  const auditorKeys = generateAuditorKeyPair();
  console.log(`Auditor Public Key:  ${auditorKeys.publicKeyHex}`);
  console.log(`Auditor Private Key: ${auditorKeys.privateKeyHex}`);

  // 2. Encrypt the private settlement amount off-chain using the Auditor's public key
  const amount = "1000";
  const encryptedPayload = encryptSettlement(amount, auditorKeys.publicKeyHex);
  console.log(`\nEncrypted Amount "${amount}" client-side:`);
  console.log(`- Ephemeral Public Key (BytesN<65>): ${encryptedPayload.ephemeralPublicKeyHex}`);
  console.log(`- IV (BytesN<12>):                    ${encryptedPayload.ivHex}`);
  console.log(`- Tag (BytesN<16>):                   ${encryptedPayload.tagHex}`);
  console.log(`- Ciphertext (Bytes):                 ${encryptedPayload.ciphertextHex}`);

  // 3. Setup parameters
  const contractId = 'CACFHOCMFKHVUR4UKS5W5XG4QCQBDCDDDT54SOOMHYBHKZIQA43MREUT';
  // Generate a random unique asset ID to avoid collision on repeated runs
  const assetId = String(Math.floor(Math.random() * 100000) + 1000);
  const commitment = '572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532';
  const issuer = 'GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4';

  console.log(`\nUsing Asset ID: ${assetId} for this run.`);

  // 4. Mint the asset dynamically first
  console.log(`Minting asset ${assetId} on-chain...`);
  const mintArgs = [
    'contract', 'invoke',
    '--id', contractId,
    '--source', 'deployer',
    '--network', 'testnet',
    '--send', 'yes',
    '--', 'mint_asset',
    '--asset_id', assetId,
    '--issuer', issuer,
    '--face_value', '1000'
  ];

  const mintResult = spawnSync('/home/xbt/.local/bin/stellar', mintArgs, { encoding: 'utf8' });
  if (mintResult.status !== 0) {
    console.error("❌ On-chain mint failed: ", mintResult.stderr);
    process.exit(1);
  }
  console.log("Asset minted successfully!");

  // Wait a few seconds for sequence numbers to settle
  console.log("Waiting 3 seconds for ledger sequence sync...");
  execSync('sleep 3');

  // 5. Invoke settle_asset
  const settleArgs = [
    'contract', 'invoke',
    '--id', contractId,
    '--source', 'deployer',
    '--network', 'testnet',
    '--send', 'yes',
    '--', 'settle_asset',
    '--asset_id', assetId,
    '--vk-file-path', '/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/circuits/custom_vk_args.json',
    '--proof-file-path', '/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/stellar-rwa-marketplace/circuits/custom_proof_args.json',
    '--commitment', commitment,
    '--ephemeral_public_key', encryptedPayload.ephemeralPublicKeyHex,
    '--iv', encryptedPayload.ivHex,
    '--tag', encryptedPayload.tagHex,
    '--ciphertext', encryptedPayload.ciphertextHex
  ];

  console.log(`\nInvoking settle_asset on-chain via stellar-cli...`);
  const result = spawnSync('/home/xbt/.local/bin/stellar', settleArgs, { encoding: 'utf8' });
  
  if (result.status !== 0) {
    console.error("❌ On-chain invocation failed: ", result.stderr);
    process.exit(1);
  }

  // Extract transaction hash from stderr (Signing transaction: <hash>)
  const txHashMatch = result.stderr.match(/Signing transaction: ([a-f0-9]{64})/);
  if (!txHashMatch) {
    console.error("❌ Could not extract transaction hash from stellar-cli stderr!");
    process.exit(1);
  }
  const txHash = txHashMatch[1];
  console.log(`\n✅ Settlement Transaction Committed! Hash: ${txHash}`);
  console.log(`🔗 https://stellar.expert/explorer/testnet/tx/${txHash}`);

  // Wait 5 seconds for Horizon to index the transaction
  console.log("Waiting 5 seconds for ledger indexing...");
  execSync('sleep 5');

  // 6. Retrieve event payload from Horizon for this transaction and decrypt
  console.log(`\nRetrieving contract event payload from Horizon for transaction ${txHash}...`);
  const txUrl = `https://horizon-testnet.stellar.org/transactions/${txHash}`;
  let txInfoOutput;
  try {
    txInfoOutput = execSync(`curl -s ${txUrl}`, { encoding: 'utf8' });
  } catch (error) {
    console.error("❌ Failed to query Horizon transactions API: ", error.message);
    process.exit(1);
  }
  
  const txInfo = JSON.parse(txInfoOutput);
  const ledger = txInfo.ledger;
  console.log(`Transaction was committed in ledger: ${ledger}. Querying Soroban RPC getEvents...`);

  const rpcUrl = "https://soroban-testnet.stellar.org";
  const rpcPayload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getEvents",
    params: {
      startLedger: ledger,
      filters: [
        {
          type: "contract",
          contractIds: [contractId]
        }
      ]
    }
  };

  let rpcOutput;
  try {
    rpcOutput = execSync(`curl -s -X POST -H "Content-Type: application/json" -d '${JSON.stringify(rpcPayload)}' ${rpcUrl}`, { encoding: 'utf8' });
  } catch (error) {
    console.error("❌ Failed to query Soroban RPC getEvents: ", error.message);
    process.exit(1);
  }

  const rpcResponse = JSON.parse(rpcOutput);
  if (rpcResponse.error) {
    console.error("❌ Soroban RPC error: ", rpcResponse.error);
    process.exit(1);
  }

  const events = rpcResponse.result.events;
  if (!events || events.length === 0) {
    console.error("❌ No contract events found for this ledger range!");
    process.exit(1);
  }

  // Find the event matching our transaction hash
  const targetEvent = events.find(ev => ev.txHash === txHash);
  if (!targetEvent) {
    console.error("❌ No contract event matched our transaction hash!");
    process.exit(1);
  }

  console.log("\nFound event data in transaction result meta! Decoding XDR...");
  
  // Parse XDR value
  const scVal = xdr.ScVal.fromXDR(Buffer.from(targetEvent.value, 'base64'));
  const nativeValue = scValToNative(scVal);

  // Re-assemble the EncryptedPayload from the event data
  const retrievedPayload = {
    ephemeralPublicKeyHex: nativeValue[0].toString('hex'),
    ivHex: nativeValue[1].toString('hex'),
    tagHex: nativeValue[2].toString('hex'),
    ciphertextHex: nativeValue[3].toString('hex'),
  };

  console.log(`Retrieved ECIES Ciphertext Envelope from Ledger:`);
  console.log(`- Ephemeral Key: ${retrievedPayload.ephemeralPublicKeyHex}`);
  console.log(`- IV:            ${retrievedPayload.ivHex}`);
  console.log(`- Tag:           ${retrievedPayload.tagHex}`);
  console.log(`- Ciphertext:    ${retrievedPayload.ciphertextHex}`);

  // 7. Decrypt using the Auditor's private key
  console.log(`\nDecrypting ciphertext using the Auditor's private View Key: ${auditorKeys.privateKeyHex}...`);
  try {
    const decryptedAmount = decryptSettlement(retrievedPayload, auditorKeys.privateKeyHex);
    console.log(`\n[SUCCESS] Decrypted Amount: "${decryptedAmount}"`);
    if (decryptedAmount === amount) {
      console.log("✅ Selective Disclosure Successful! Verified settled amount matches original.");
    } else {
      console.error("❌ Mismatch recovered!");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Decryption failed: ", error.message);
    process.exit(1);
  }
}

runOnChainSettlement();
