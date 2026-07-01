function isValidContractId(v: string): boolean {
  return /^C[A-Z0-9]{55}$/.test(v);
}
function isValidPublicKey(v: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(v);
}
function isValidSecret(v: string): boolean {
  return v.startsWith('S');
}
function isValidContractOrPublicKey(v: string): boolean {
  return isValidContractId(v) || isValidPublicKey(v);
}

const env = {
  CONTRACT_ID: process.env.CONTRACT_ID || 'CDGFOX2B3FS2SF2WQ76JPXFJI5RM5EFZ26DTGW3BTC2FWW2BTSVJJZ3A',
  SETTLEMENT_CONTRACT_ID: process.env.SETTLEMENT_CONTRACT_ID || process.env.CONTRACT_ID || 'CDGFOX2B3FS2SF2WQ76JPXFJI5RM5EFZ26DTGW3BTC2FWW2BTSVJJZ3A',
  VERIFIER_ID: process.env.VERIFIER_ID || 'CCRUK3TL4BQMSOI5KHC4DO2VIJ7P7TTWFVXYRKPCVGMCLW2YIAO5JI6B',
  ISSUER: process.env.ISSUER || 'GCTD7WUJYYE2FEGQ4IRHIASGL75MQFBZGTXRQGHJJVXBY73TRKHWK4J4',
  DEPLOYER_SECRET: process.env.DEPLOYER_SECRET || '',
};

const warnings: string[] = [];
if (env.CONTRACT_ID && !isValidContractId(env.CONTRACT_ID)) warnings.push('CONTRACT_ID');
if (env.SETTLEMENT_CONTRACT_ID && !isValidContractId(env.SETTLEMENT_CONTRACT_ID)) warnings.push('SETTLEMENT_CONTRACT_ID');
if (env.VERIFIER_ID && !isValidContractOrPublicKey(env.VERIFIER_ID)) warnings.push('VERIFIER_ID');
if (env.ISSUER && !isValidPublicKey(env.ISSUER)) warnings.push('ISSUER');
if (env.DEPLOYER_SECRET && !isValidSecret(env.DEPLOYER_SECRET)) warnings.push('DEPLOYER_SECRET');
if (warnings.length) console.warn('[Config] Invalid env vars:', warnings.join(', '));

export const {
  CONTRACT_ID,
  SETTLEMENT_CONTRACT_ID,
  VERIFIER_ID,
  ISSUER,
  DEPLOYER_SECRET,
} = env;

export const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
export const CIRCUITS_WSL = process.env.CIRCUITS_WSL || '/mnt/c/Users/USER/circuits';
export const CIRCUITS_WIN = process.env.CIRCUITS_WIN || 'C:\\Users\\USER\\circuits';
