import { generateAuditorKeyPair, encryptSettlement, decryptSettlement } from './cryptoDisclosure.js';

function runTests() {
  console.log("=== Running off-chain Selective Disclosure Cryptographic Tests ===");

  // 1. Generate auditor's keypair
  const keyPair = generateAuditorKeyPair();
  console.log("Generated Auditor Public Key: ", keyPair.publicKeyHex);
  console.log("Generated Auditor Private Key (View Key): ", keyPair.privateKeyHex);

  const amountToEncrypt = "1000";
  console.log(`\nPlaintext Amount to Encrypt: "${amountToEncrypt}"`);

  // 2. Encrypt the amount using auditor's public key
  const payload = encryptSettlement(amountToEncrypt, keyPair.publicKeyHex);
  console.log("\nGenerated Encrypted Payload:");
  console.log(`- Ephemeral Public Key: ${payload.ephemeralPublicKeyHex}`);
  console.log(`- IV: ${payload.ivHex}`);
  console.log(`- Auth Tag: ${payload.tagHex}`);
  console.log(`- Ciphertext: ${payload.ciphertextHex}`);

  // 3. Test Successful Decryption Path (Correct Key)
  try {
    const decryptedAmount = decryptSettlement(payload, keyPair.privateKeyHex);
    console.log(`\n[SUCCESS] Decryption with correct view key returned: "${decryptedAmount}"`);
    if (decryptedAmount === amountToEncrypt) {
      console.log("✅ Assertion Passed: Decrypted value matches original value.");
    } else {
      console.error("❌ Assertion Failed: Decrypted value does not match original value.");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Decryption with correct key failed unexpectedly: ", error);
    process.exit(1);
  }

  // 4. Test Rejection Decryption Path (Incorrect/Random Key)
  const wrongKeyPair = generateAuditorKeyPair();
  console.log(`\nAttempting decryption with an incorrect View Key: ${wrongKeyPair.privateKeyHex}`);
  
  let didFailCleanly = false;
  try {
    const garbageAmount = decryptSettlement(payload, wrongKeyPair.privateKeyHex);
    console.error(`❌ FAILURE: Decryption with incorrect key did not throw! Returned: "${garbageAmount}"`);
    process.exit(1);
  } catch (error) {
    didFailCleanly = true;
    console.log("✅ Assertion Passed: Decryption failed cleanly (as expected) with GCM tag verification error:");
    console.log(`   Message: "${error.message}"`);
  }

  if (didFailCleanly) {
    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
  } else {
    process.exit(1);
  }
}

runTests();
