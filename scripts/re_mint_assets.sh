#!/usr/bin/env bash
set -euo pipefail
STELLAR="/home/xbt/.local/bin/stellar"
CONTRACT="CDGFOX2B3FS2SF2WQ76JPXFJI5RM5EFZ26DTGW3BTC2FWW2BTSVJJZ3A"
ISSUER="GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4"

echo "Minting TreasuryBill 801..."
$STELLAR contract invoke --id $CONTRACT --source deployer --network testnet --send yes -- \
  mint_asset --asset_id 801 --issuer "$ISSUER" --face_value 1000 \
  --asset_class TreasuryBill --maturity_timestamp 1762000000 --coupon_bps 0
sleep 3

echo "Minting CorporateBond 812..."
$STELLAR contract invoke --id $CONTRACT --source deployer --network testnet --send yes -- \
  mint_asset --asset_id 812 --issuer "$ISSUER" --face_value 2500 \
  --asset_class CorporateBond --maturity_timestamp 1788000000 --coupon_bps 450
sleep 3

echo "Minting InvoiceReceivable 813..."
$STELLAR contract invoke --id $CONTRACT --source deployer --network testnet --send yes -- \
  mint_asset --asset_id 813 --issuer "$ISSUER" --face_value 5000 \
  --asset_class InvoiceReceivable --maturity_timestamp 1757000000 --coupon_bps 0
sleep 3

echo "Minting CommodityToken 814..."
$STELLAR contract invoke --id $CONTRACT --source deployer --network testnet --send yes -- \
  mint_asset --asset_id 814 --issuer "$ISSUER" --face_value 7500 \
  --asset_class CommodityToken --maturity_timestamp 1792000000 --coupon_bps 0
sleep 3

echo "Minting CarbonCredit 815..."
$STELLAR contract invoke --id $CONTRACT --source deployer --network testnet --send yes -- \
  mint_asset --asset_id 815 --issuer "$ISSUER" --face_value 12000 \
  --asset_class CarbonCredit --maturity_timestamp 0 --coupon_bps 0

echo "Done re-minting all 5 assets with RWA domain model"
