const { Horizon, TransactionBuilder, Keypair } = require('@stellar/stellar-sdk');
const crypto = require('crypto');

const CONTRACT_ID = 'CACFHOCMFKHVUR4UKS5W5XG4QCQBDCDDDT54SOOMHYBHKZIQA43MREUT';
const ISSUER = 'GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4';

async function runTest() {
  console.log("=== Starting Live E2E Verification ===");

  // 1. Generate a funded testnet keypair to sign the transaction (acting as Freighter)
  const testerKeypair = Keypair.random();
  const testerAddress = testerKeypair.publicKey();
  console.log(`Tester Address: ${testerAddress}`);
  
  console.log("Funding tester account via friendbot...");
  const fundRes = await fetch(`https://friendbot.stellar.org/?addr=${testerAddress}`);
  if (!fundRes.ok) {
    throw new Error("Failed to fund tester account");
  }
  console.log("Tester account funded successfully.");

  // 2. Generate ECIES Encryption Payload (mimicking client-side /api/encrypt)
  const amount = "5000"; // Real amount (matches Corporate Bond #803 Face Value)
  const ephemeralKeypair = Keypair.random();
  const iv = crypto.randomBytes(12).toString('hex');
  const tag = crypto.randomBytes(16).toString('hex');
  const ciphertext = crypto.randomBytes(16).toString('hex'); // dummy encryption for test
  const ephemeralPublicKeyHex = ephemeralKeypair.publicKey();

  // 3. call Settle preparation (mimicking client calling POST /api/settle Phase 1)
  console.log("Preparing settlement XDR...");
  
  // Call the Next.js settle API directly using a synthetic local POST request structure
  const fetchPayload = {
    assetId: 803,
    amount: amount,
    faceValue: "5000",
    ephemeralPublicKey: ephemeralPublicKeyHex,
    iv: iv,
    tag: tag,
    ciphertext: ciphertext,
    sourceAddress: testerAddress
  };

  const response = await fetch("http://localhost:3000/api/settle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fetchPayload)
  });

  const settleData = await response.json();
  if (settleData.error) {
    console.error("API Settle Phase 1 Error:", settleData);
    throw new Error(settleData.error);
  }

  console.log("Unsigned XDR built successfully.");
  const unsignedXdr = settleData.unsignedXdr;

  // 4. Sign transaction XDR using our funded Keypair
  console.log("Signing transaction XDR...");
  const tx = TransactionBuilder.fromXDR(unsignedXdr, 'Test SDF Network ; September 2015');
  tx.sign(testerKeypair);
  const signedXdr = tx.toXDR();

  // 5. Submit transaction XDR (mimicking client calling POST /api/settle Phase 2)
  console.log("Submitting signed transaction XDR...");
  const submitResponse = await fetch("http://localhost:3000/api/settle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedXdr })
  });

  const submitData = await submitResponse.json();
  if (submitData.error) {
    console.error("API Settle Phase 2 Error:", submitData);
    throw new Error(submitData.error);
  }

  console.log("=== SUCCESS ===");
  console.log("Transaction Hash:", submitData.txHash);
  console.log("Stellar Expert Explorer Link:", submitData.ledgerUrl);
}

runTest().catch(console.error);
