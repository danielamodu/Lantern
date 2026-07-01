#!/usr/bin/env bash
set -euo pipefail

STELLAR="/home/xbt/.local/bin/stellar"
CONTRACT="CDGFOX2B3FS2SF2WQ76JPXFJI5RM5EFZ26DTGW3BTC2FWW2BTSVJJZ3A"
NETWORK="testnet"
SOURCE="deployer"
CIRCUITS="/mnt/c/Users/USER/.gemini/antigravity-ide/scratch/Lantern/circuits"

echo "=== On-chain test: exact-match settle_asset ==="

# Test A: mint asset 401 for exact-match test
ASSET_A=401
echo "Minting asset $ASSET_A..."
$STELLAR contract invoke \
  --id $CONTRACT --source $SOURCE --network $NETWORK --send yes \
  -- mint_asset \
  --asset_id $ASSET_A \
  --issuer GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4 \
  --face_value 1000

echo "Waiting 3s for ledger sync..."
sleep 3

echo "Invoking settle_asset on asset $ASSET_A..."
$STELLAR contract invoke \
  --id $CONTRACT --source $SOURCE --network $NETWORK --send yes \
  -- settle_asset \
  --asset_id $ASSET_A \
  --vk-file-path "$CIRCUITS/custom_vk_args.json" \
  --proof-file-path "$CIRCUITS/custom_proof_args.json" \
  --commitment 572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532 \
  --ephemeral_public_key 0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 \
  --iv 000000000000000000000000 \
  --tag 00000000000000000000000000000000 \
  --ciphertext ""

echo ""
echo "=== On-chain test: discount settle_asset_discounted ==="

# Test B: mint asset 402 for discount test
ASSET_B=402
echo "Minting asset $ASSET_B..."
$STELLAR contract invoke \
  --id $CONTRACT --source $SOURCE --network $NETWORK --send yes \
  -- mint_asset \
  --asset_id $ASSET_B \
  --issuer GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4 \
  --face_value 1000

echo "Waiting 3s for ledger sync..."
sleep 3

echo "Invoking settle_asset_discounted on asset $ASSET_B..."
$STELLAR contract invoke \
  --id $CONTRACT --source $SOURCE --network $NETWORK --send yes \
  -- settle_asset_discounted \
  --asset_id $ASSET_B \
  --vk-file-path "$CIRCUITS/discount_vk_args.json" \
  --proof-file-path "$CIRCUITS/discount_proof_args.json" \
  --discount_bps 500 \
  --commitment 0e2af42d136edccc7d4629bced04e547066cd7033464986a684eb7a64a5b3464 \
  --ephemeral_public_key 0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 \
  --iv 000000000000000000000000 \
  --tag 00000000000000000000000000000000 \
  --ciphertext ""

echo ""
echo "=== Both paths tested ==="
