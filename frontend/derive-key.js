const StellarSdk = require('@stellar/stellar-sdk');

const mnemonic = "taste oyster brush appear purpose veteran random antique oil ripple vapor problem orphan bracket hunt kangaroo tag stamp comfort bitter skull human dwarf valley";

// Derive the secret key from mnemonic
const keypair = StellarSdk.Keypair.fromMnemonic(mnemonic);
const secretKey = keypair.secret();
const publicKey = keypair.publicKey();

console.log('SECRET_KEY=' + secretKey);
console.log('PUBLIC_KEY=' + publicKey);