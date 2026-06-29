#!/bin/bash
# recompile_circuit.sh
# Recompiles settlement.circom with commitment as output, regenerates all keys

set -e

CIRCUITS_DIR="/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/Lantern/circuits"
CIRCOM="/home/xbt/.cargo/bin/circom"

source /home/xbt/.nvm/nvm.sh
nvm use v22.22.3 > /dev/null 2>&1

cd "$CIRCUITS_DIR"

echo "=== Step 1: Compiling settlement.circom ==="
$CIRCOM settlement.circom --r1cs --wasm --sym --output .
echo "COMPILE OK"

echo "=== Step 2: Setup proving key from existing ptau ==="
npx --yes snarkjs groth16 setup settlement.r1cs pot10_final.ptau settlement_0000.zkey
echo "SETUP OK"

echo "=== Step 3: Contribute randomness to proving key ==="
echo "random entropy $(date +%s%N)" | npx --yes snarkjs zkey contribute settlement_0000.zkey settlement_final.zkey --name="Lantern Final" -e="$(openssl rand -hex 32)"
echo "CONTRIBUTE OK"

echo "=== Step 4: Export verification key ==="
npx --yes snarkjs zkey export verificationkey settlement_final.zkey verification_key.json
echo "VK_EXPORT OK"

echo "=== Step 5: Sanity check — prove with fresh salt ==="
SALT=$(node -e "const crypto=require('crypto'); console.log(BigInt('0x'+crypto.randomBytes(16).toString('hex')).toString())")
cat > /tmp/test_fresh_input.json << EOF
{
  "target_face_value": "1000",
  "settlement_amount": "1000",
  "blinding_salt": "$SALT"
}
EOF
npx --yes snarkjs groth16 fullprove /tmp/test_fresh_input.json settlement_js/settlement.wasm settlement_final.zkey /tmp/test_fresh_proof.json /tmp/test_fresh_public.json
echo "FRESH_PROOF OK"
echo "Public signals (commitment, face_value):"
cat /tmp/test_fresh_public.json

echo "=== Step 6: Second proof with different salt — commitment must differ ==="
SALT2=$(node -e "const crypto=require('crypto'); console.log(BigInt('0x'+crypto.randomBytes(16).toString('hex')).toString())")
cat > /tmp/test_fresh2_input.json << EOF
{
  "target_face_value": "1000",
  "settlement_amount": "1000",
  "blinding_salt": "$SALT2"
}
EOF
npx --yes snarkjs groth16 fullprove /tmp/test_fresh2_input.json settlement_js/settlement.wasm settlement_final.zkey /tmp/test_fresh2_proof.json /tmp/test_fresh2_public.json
echo "FRESH_PROOF2 OK"
echo "Public signals (commitment2, face_value):"
cat /tmp/test_fresh2_public.json

echo "=== Step 7: Tamper test — amount 999 != face_value 1000 — MUST FAIL ==="
SALT3=$(node -e "const crypto=require('crypto'); console.log(BigInt('0x'+crypto.randomBytes(16).toString('hex')).toString())")
cat > /tmp/test_tamper_input.json << EOF
{
  "target_face_value": "1000",
  "settlement_amount": "999",
  "blinding_salt": "$SALT3"
}
EOF
if npx --yes snarkjs groth16 fullprove /tmp/test_tamper_input.json settlement_js/settlement.wasm settlement_final.zkey /tmp/test_tamper_proof.json /tmp/test_tamper_public.json 2>&1; then
  echo "TAMPER_TEST FAILED: proof succeeded when it should have been rejected"
else
  echo "TAMPER_TEST PASSED: proof correctly rejected mismatched amount"
fi

echo "=== ALL DONE ==="
