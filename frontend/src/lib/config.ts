function isValidContractId(v: string): boolean {
  return /^C[A-Z0-9]{55}$/.test(v);
}
function isValidPublicKey(v: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(v);
}
function isValidSecret(v: string): boolean {
  return /^S[A-Z2-7A-Z2-7]{55}$/.test(v);
}

const env = {
  SETTLEMENT_CONTRACT_ID: process.env.SETTLEMENT_CONTRACT_ID || 'CDGFOX2B3FS2SF2WQ76JPXFJI5RM5EFZ26DTGW3BTC2FWW2BTSVJJZ3A',
  VERIFIER_ID: process.env.VERIFIER_ID || 'CCRUK3TL4BQMSOI5KHC4DO2VIJ7P7TTWFVXYRKPCVGMCLW2YIAO5JI6B',
};

const warnings: string[] = [];
if (env.SETTLEMENT_CONTRACT_ID && !isValidContractId(env.SETTLEMENT_CONTRACT_ID)) warnings.push('SETTLEMENT_CONTRACT_ID');
if (env.VERIFIER_ID && !isValidContractId(env.VERIFIER_ID)) warnings.push('VERIFIER_ID');
if (warnings.length) console.warn('[Config] Invalid env vars:', warnings.join(', '));

export const {
  SETTLEMENT_CONTRACT_ID,
  VERIFIER_ID,
} = env;

export const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';