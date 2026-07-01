'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Key, 
  Coins, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Unlock, 
  ChevronRight, 
  Lock,
  RefreshCw,
  Share2,
  FileSpreadsheet,
  Home,
  LogOut,
  Sparkles,
  Wallet,
  Cpu,
  Layers
} from 'lucide-react';
import { requestAccess, signTransaction, signMessage, isConnected } from '@stellar/freighter-api';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CiphertextReveal } from './CiphertextReveal';
import MiniFooter from '@/components/MiniFooter';

interface RwaAsset {
  id: number;
  name: string;
  faceValue: number;
  status: 'Pending' | 'Settling' | 'Settled' | 'Rejected' | 'Redeemed';
  txHash?: string;
  ciphertext?: string;
  policy?: string;
}

const SEEDED_ASSETS: RwaAsset[] = [
  { id: 801, name: "US Treasury Bill #801", faceValue: 1000, status: 'Pending' },
  { id: 812, name: "Real Estate Fund #802", faceValue: 2500, status: 'Pending' },
  { id: 813, name: "Corporate Bond #803", faceValue: 5000, status: 'Pending' },
  { id: 814, name: "Gold Bullion Trust #804", faceValue: 7500, status: 'Pending' },
  { id: 815, name: "Stellar Carbon Credit #805", faceValue: 12000, status: 'Pending' },
];

const VERIFIER_ID = process.env.NEXT_PUBLIC_VERIFIER_ID || 'CCRUK3TL4BQMSOI5KHC4DO2VIJ7P7TTWFVXYRKPCVGMCLW2YIAO5JI6B';
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || 'CACFHOCMFKHVUR4UKS5W5XG4QCQBDCDDDT54SOOMHYBHKZIQA43MREUT';

function base64UrlToHex(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  return Array.from(bin, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const nonce = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16);
  const msgResult = await signMessage(`LANtern-auth-${nonce}`, {
    networkPassphrase: 'Test SDF Network ; September 2015'
  });
  if (msgResult.error || !msgResult.signedMessage) {
    console.warn('[Auth] signMessage failed, sending without auth headers');
    return { 'x-nonce': nonce };
  }
  const sig = typeof msgResult.signedMessage === 'string'
    ? msgResult.signedMessage
    : Buffer.from(msgResult.signedMessage).toString('hex');
  return {
    'x-signer-address': msgResult.signerAddress,
    'x-signature': sig.padStart(128, '0').substring(0, 128),
    'x-nonce': nonce
  };
}

export default function AppDashboard() {
  const [assets, setAssets] = useState<RwaAsset[]>(SEEDED_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<RwaAsset | null>(SEEDED_ASSETS[0]);
  
  // View Key manager state
  const [pubViewKey, setPubViewKey] = useState('');
  const [privViewKey, setPrivViewKey] = useState('');
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

  // Settlement flow state
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState('');
  const [settleSuccessMsg, setSettleSuccessMsg] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState('Exact Match (amount == face_value)');
  const [settleAmount, setSettleAmount] = useState<number | ''>(1000);
  const [pricingMode, setPricingMode] = useState<'par' | 'discount'>('par');
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Auto-update settleAmount when selectedAsset, pricingMode, or discountPercent changes
  useEffect(() => {
    if (selectedAsset) {
      if (pricingMode === 'par') {
        setSettleAmount(selectedAsset.faceValue);
      } else {
        const discounted = Math.round(selectedAsset.faceValue * (1 - discountPercent / 100));
        setSettleAmount(discounted);
      }
    }
  }, [selectedAsset, pricingMode, discountPercent]);

  // Decryption state
  const [decTxHash, setDecTxHash] = useState('');
  const [decPrivKey, setDecPrivKey] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');

  // Issuance state
  const [newName, setNewName] = useState('');
  const [newFaceValue, setNewFaceValue] = useState<number | ''>('');
  const [newAssetClass, setNewAssetClass] = useState('Government Bond');
  const [isMinting, setIsMinting] = useState(false);
  const [decryptedAmount, setDecryptedAmount] = useState<string | null>(null);
  const [decryptedPayload, setDecryptedPayload] = useState<any | null>(null);
  const [decryptedSuccess, setDecryptedSuccess] = useState<boolean | null>(null);

  // ZK Telemetry Log state
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>(() => {
    const time = new Date().toLocaleTimeString();
    return [
      `[${time}] [SYSTEM] ZK Telemetry Engine initialized. Listening for compliance proofs...`,
      `[${time}] [SYSTEM] Connected to Soroban Contract: ${CONTRACT_ID}`,
      `[${time}] [SYSTEM] Verifier Identity key active: CCRUK3TL4BQMSOI5...`
    ];
  });

  const addTelemetryLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTelemetryLogs(prev => [...prev.slice(-49), `[${time}] ${msg}`]);
  };

  // Auth state
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authReadyTimer, setAuthReadyTimer] = useState(0);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [loginError, setLoginError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(120);
  const [authAttempts, setAuthAttempts] = useState(0);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [hasCreatedAuthOnce, setHasCreatedAuthOnce] = useState(false);
  const [isAuthRefreshing, setIsAuthRefreshing] = useState(false);
  const [fallbackAuthUsed, setFallbackAuthUsed] = useState(false);
  const [authDebugInfo, setAuthDebugInfo] = useState<any>(null);

  const DEFAULT_AUTH_TIMEOUT_SECONDS = 120;
  const MAX_AUTH_ATTEMPTS = 3;

  const logAuthEvent = (event: string, details?: any) => {
    console.log(`[AUTH] ${event}:`, details);
  };

  // Share view key modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'decrypt' | 'issuance'>('overview');

  // Freighter Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState<boolean | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(true);

  useEffect(() => {
    let authInterval: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        const currentAuthHeaders = await getAuthHeaders();
        logAuthEvent('[INIT] Created auth headers', { 
          hasAuth: !!currentAuthHeaders['x-signer-address']
        });
        setAuthHeaders(currentAuthHeaders);
        setIsAuthReady(true);
        setHasCreatedAuthOnce(true);
        setAuthAttempts(0);
        setAuthWarning(null);
      } catch (err) {
        logAuthEvent('[INIT] Auth initialization failed', err);
      }
    };

    initializeAuth();

    authInterval = setInterval(() => {
      if (!isAuthRefreshing && isAuthReady) {
        setIsAuthRefreshing(true);
        logAuthEvent('[REFRESH] Regenerating auth headers...');
        
        const refreshTimer = setTimeout(async () => {
          try {
            const currentAuthHeaders = await getAuthHeaders();
            setAuthHeaders(currentAuthHeaders);
            setIsAuthReady(true);
            setAuthReadyTimer(DEFAULT_AUTH_TIMEOUT_SECONDS);
            logAuthEvent('[REFRESH] Auth headers refreshed successfully');
          } catch (err) {
            logAuthEvent('[REFRESH] Failed to refresh auth headers', err);
            setAuthAttempts(prev => prev + 1);
            if (authAttempts >= MAX_AUTH_ATTEMPTS) {
              setAuthWarning('Authentication service unavailable. Using limited functionality.');
              setFallbackAuthUsed(true);
            }
          } finally {
            setIsAuthRefreshing(false);
          }
        }, 1000);
        
        return () => clearTimeout(refreshTimer);
      }
    }, 110 * 1000);

    return () => clearInterval(authInterval);
  }, [isAuthRefreshing]);

  // Generate dynamic keypair on mount
  useEffect(() => {
    generateNewKeys();
    
    const savedAddress = sessionStorage.getItem('lantern_wallet_address');
    if (savedAddress) {
      setWalletAddress(savedAddress);
      setIsAuthenticated(true);
      setShowLogin(false);
    } else {
      window.location.href = '/login';
      return;
    }

    checkFreighter();

    // Sync status of seeded assets on-chain
    const syncAssets = async () => {
      try {
        const res = await fetch('/api/assets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: SEEDED_ASSETS.map(a => a.id) }),
        });
        const data = await res.json();
        if (data.success && data.results) {
          setAssets(prev => {
            const updated = prev.map(asset => {
              const syncInfo = data.results[asset.id];
              if (syncInfo && syncInfo.exists) {
                return {
                  ...asset,
                  status: (syncInfo.settled ? 'Settled' : 'Pending') as 'Settled' | 'Pending',
                  faceValue: syncInfo.faceValue
                };
              }
              return asset;
            });
            return updated;
          });
          
          setSelectedAsset(prev => {
            if (!prev) return null;
            const syncInfo = data.results[prev.id];
            if (syncInfo && syncInfo.exists) {
              return {
                ...prev,
                status: (syncInfo.settled ? 'Settled' : 'Pending') as 'Settled' | 'Pending',
                faceValue: syncInfo.faceValue
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to sync on-chain assets on mount:", err);
      }
    };
    syncAssets();

    // Check URL query parameters for pre-filled view key (Deep Link sharing)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      const tabParam = params.get('tab');
      if (tabParam === 'overview' || tabParam === 'keys' || tabParam === 'decrypt') {
        setActiveTab(tabParam as any);
      }

      const keyParam = params.get('viewKey') || params.get('key');
      if (keyParam) {
        setDecPrivKey(keyParam);
        // Transition immediately to the Decryption Vault tab so they see it
        setActiveTab('decrypt');
      }
    }
  }, []);

  const checkFreighter = async () => {
    try {
      const installed = await isConnected();
      setIsFreighterInstalled(!!installed);
    } catch {
      setIsFreighterInstalled(false);
    }
  };

  const connectWallet = async () => {
    setIsConnectingWallet(true);
    setSettleError('');
    try {
      const installed = await isConnected();
      if (!installed) {
        setIsFreighterInstalled(false);
        setIsConnectingWallet(false);
        return;
      }
      setIsFreighterInstalled(true);
      const res = await requestAccess();
      let address = '';
      if (typeof res === 'string') {
        address = res;
      } else if (res && typeof res === 'object' && 'address' in res) {
        address = res.address;
      } else {
        throw new Error("Could not retrieve address from Freighter");
      }

      setWalletAddress(address);
      
      // Auto-fund testnet account with Friendbot for seamless developer testing
      fetch("https://friendbot.stellar.org/?addr=" + address).catch(() => {});

      // Onboarding check (show modal only once)
      const hasOnboarded = localStorage.getItem('lantern_onboarded');
      if (!hasOnboarded) {
        setShowOnboardModal(true);
      }
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      setSettleError("Failed to connect Freighter wallet.");
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const dismissOnboardModal = () => {
    localStorage.setItem('lantern_onboarded', 'true');
    setShowOnboardModal(false);
  };

  const generateNewKeys = async () => {
    setIsGeneratingKeys(true);
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
      );
      const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const jwkPub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

      const privHex = base64UrlToHex(jwkPriv.d!);
      const pubHex = '04' + base64UrlToHex(jwkPub.x!) + base64UrlToHex(jwkPub.y!);

      setPubViewKey(pubHex);
      setPrivViewKey(privHex);
      setDecPrivKey(privHex);
      sessionStorage.setItem('lantern_pub_view_key', pubHex);
      sessionStorage.setItem('lantern_priv_view_key', privHex);
    } catch (err) {
      console.error("Failed to generate keys:", err);
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  // Settle asset handler (with Freighter Wallet signing)
  const handleSettle = async () => {
    if (!selectedAsset) return;
    if (!walletAddress) {
      setSettleError("Please connect your Freighter wallet to sign the settlement.");
      return;
    }

    setIsSettling(true);
    setSettleError('');
    setSettleSuccessMsg('');

    // Update asset status locally to "Settling"
    setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { ...a, status: 'Settling' } : a));

    // 1. Validate variables population and log the payload exactly right before it is sent
    const currentAmount = String(settleAmount || '');
    const currentPublicKey = pubViewKey || sessionStorage.getItem('lantern_pub_view_key');

    console.log(`[handleSettle] Initiating ECIES encryption payload check:`, {
      amount: currentAmount,
      auditorPublicKey: currentPublicKey
    });

    addTelemetryLog(`[INIT] Starting private settlement for asset #${selectedAsset.id} (Target Value: $${selectedAsset.faceValue})...`);
    addTelemetryLog(`[INIT] Target Amount: $${currentAmount} | Policy: ${selectedPolicy}`);

    if (!currentAmount || !currentPublicKey) {
      const errMsg = `Pre-encryption validation failed: ${!currentAmount ? 'Amount' : 'Auditor Public Key'} is missing or not populated yet. Please rotate keys and try again.`;
      setSettleError(errMsg);
      setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { ...a, status: 'Pending' } : a));
      setIsSettling(false);
      addTelemetryLog(`[ERROR] Pre-encryption validation failed.`);
      return;
    }

    try {
      addTelemetryLog('[ZK-ECIES] Generating ephemeral view keypair and performing off-chain encryption...');
      // 1. Generate client-side encryption envelope
      const encryptRes = await fetch('/api/encrypt', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          amount: currentAmount,
          auditorPublicKey: currentPublicKey
        })
      });
      const encryptedData = await encryptRes.json();

      if (encryptedData.error) {
        throw new Error(encryptedData.error);
      }

      addTelemetryLog(`[ZK-ECIES] Encryption complete. Ephemeral Key: ${encryptedData.ephemeralPublicKeyHex.substring(0, 16)}...`);
      addTelemetryLog(`[ZK-ECIES] Ciphertext: ${encryptedData.ciphertextHex.substring(0, 16)}...`);

      addTelemetryLog('[ZK-PROOF] Witness constraints matching... Proving amount matches policy on-chain...');

      const prepareRes = await fetch('/api/settle', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          amount: currentAmount,
          faceValue: selectedAsset.faceValue,
          ephemeralPublicKey: encryptedData.ephemeralPublicKeyHex,
          iv: encryptedData.ivHex,
          tag: encryptedData.tagHex,
          ciphertext: encryptedData.ciphertextHex,
          sourceAddress: walletAddress
        })
      });
      const prepareData = await prepareRes.json();

      if (prepareData.error) {
        let cleanErr = prepareData.error;
        const details = typeof prepareData.details === 'string' ? prepareData.details : JSON.stringify(prepareData.details || '');
        if (details.includes('#101') || details.includes('AssetNotFound')) {
          cleanErr = "On-Chain Error: Asset ID not found on Stellar Ledger. Please mint it first.";
        } else if (details.includes('#102') || details.includes('AssetAlreadySettled')) {
          cleanErr = "On-Chain Error: Asset is already settled on-chain. State is locked.";
        } else if (details.includes('#103')) {
          cleanErr = "On-Chain Error: Verifier contract is not configured.";
        } else if (details.includes('#104') || details.includes('InvalidZkProof')) {
          cleanErr = "On-Chain Error: Invalid Zero-Knowledge Proof. Compliance policy validation failed.";
        } else if (details) {
          cleanErr = `${prepareData.error} (${details})`;
        }
        throw new Error(cleanErr);
      }

      addTelemetryLog('[ZK-PROOF] Groth16 proof compiled successfully. Policy check verified.');
      addTelemetryLog('[SOROBAN] Simulated contract execution; transaction resource footprint built.');

      // 3. Request Freighter wallet signing of the generated transaction XDR
      addTelemetryLog('[WALLET] Requesting signature from Freighter wallet...');
      console.log(`[Freighter] Requesting signature for XDR...`);
      const signResult = await signTransaction(prepareData.unsignedXdr, { 
        networkPassphrase: "Test SDF Network ; September 2015" 
      });
      // Freighter v6 returns { result: string }; older versions return string or { signedTxXdr }
      const signedXdr = typeof signResult === 'string'
        ? signResult
        : (signResult as any).result ?? (signResult as any).signedTxXdr ?? '';

      // Fail fast if Freighter returned nothing
      if (!signedXdr) throw new Error('Freighter did not return a signed XDR. Please try again.');

      addTelemetryLog('[WALLET] Transaction signed successfully by Freighter.');

      // 4. Submit the signed transaction XDR back to Stellar testnet
      let submitData: { txHash: string };
      try {
        addTelemetryLog('[HORIZON] Submitting transaction directly to Horizon testnet...');
        console.log('[Settle] Submitting transaction directly from browser to Horizon testnet...');
        const formData = new URLSearchParams();
        formData.append('tx', signedXdr);
        const horizonRes = await fetch('https://horizon-testnet.stellar.org/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        const horizonData = await horizonRes.json();
        if (!horizonRes.ok) {
          console.error('[Settle] Browser-side submission failed, details:', horizonData);
          throw new Error(horizonData.detail || horizonData.title || 'Horizon transaction submission failed');
        }
        console.log(`[Settle] Browser-side submission success! Hash: ${horizonData.hash}`);
        submitData = { txHash: horizonData.hash };
        addTelemetryLog(`[LEDGER] Direct Horizon submission success! Hash: ${submitData.txHash}`);
      } catch (clientErr: any) {
        console.warn('[Settle] Browser-side Horizon submission failed, falling back to backend:', clientErr.message);
        addTelemetryLog(`[SOROBAN] Browser submission bypassed/failed. Retrying via backend node router: ${clientErr.message}`);
        const submitRes = await fetch('/api/settle', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ signedXdr })
        });
        const submitDataBack = await submitRes.json();
        if (submitDataBack.error) {
          throw new Error(submitDataBack.error || submitDataBack.details);
        }
        submitData = submitDataBack;
        addTelemetryLog(`[LEDGER] Backend node submission success! Hash: ${submitData.txHash}`);
      }

      setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { 
        ...a, 
        status: 'Settled', 
        txHash: submitData.txHash,
        ciphertext: encryptedData.ciphertextHex,
        policy: selectedPolicy
      } : a));

      setSelectedAsset(prev => prev ? { 
        ...prev, 
        status: 'Settled', 
        txHash: submitData.txHash,
        ciphertext: encryptedData.ciphertextHex,
        policy: selectedPolicy
      } : null);

      setSettleSuccessMsg(`Asset successfully settled! Tx Hash: ${submitData.txHash.substring(0, 16)}...`);
      setDecTxHash(submitData.txHash);
      addTelemetryLog('[SYSTEM] Private settlement finalized. State locked in registry.');

    } catch (err: any) {
      console.error(err);
      addTelemetryLog(`[ERROR] Settlement failed: ${err.message || err}`);
      setSettleError(err.message || 'On-chain settlement or Freighter signature failed.');
      setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { ...a, status: 'Pending' } : a));
    } finally {
      setIsSettling(false);
    }
  };

  // Redeem settled asset at maturity
  const handleRedeem = async () => {
    if (!selectedAsset) return;
    if (!walletAddress) {
      setSettleError("Please connect your Freighter wallet to authorize redemption.");
      return;
    }

    setIsSettling(true);
    setSettleError('');
    addTelemetryLog(`[INIT] Requesting maturity redemption for settled RWA #${selectedAsset.id} (${selectedAsset.name})...`);
    addTelemetryLog('[WALLET] Requesting signature to execute redemption payment representing collateral unlock...');

    try {
      // 1. Prepare payment transaction via backend API
      const prepRes = await fetch('/api/redeem/prepare', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ userAddress: walletAddress, assetId: selectedAsset.id }),
      });

      const prepData = await prepRes.json();
      if (!prepRes.ok || prepData.error) {
        throw new Error(prepData.error || prepData.details || 'Failed to prepare transaction.');
      }

      addTelemetryLog('[WALLET] Transaction built successfully. Requesting Freighter signature...');

      // 2. Sign transaction via Freighter
      const signedTxResult = await signTransaction(prepData.xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      const signedXdr = typeof signedTxResult === 'string' 
        ? signedTxResult 
        : (signedTxResult as any)?.signedTxXdr;

      if (!signedXdr) {
        throw new Error('Failed to sign transaction or signature was rejected.');
      }

      addTelemetryLog('[HORIZON] Submitting payment instruction to Horizon testnet...');

      // 3. Submit transaction directly from browser to Horizon
      const submitRes = await fetch('https://horizon-testnet.stellar.org/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tx: signedXdr }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok || submitData.status === 400 || submitData.error) {
        const errDetails = submitData.extras?.result_codes?.operations?.[0] || submitData.detail || 'Horizon submission rejected.';
        throw new Error(`On-chain transaction failed: ${errDetails}`);
      }

      const txHash = submitData.hash;
      addTelemetryLog(`[LEDGER] Redemption payment transaction confirmed on-chain! Hash: ${txHash}`);
      addTelemetryLog(`[SYSTEM] Collateral cash-out approved. Locked cash collateral released to address: ${walletAddress}`);

      // Update local asset status
      setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { ...a, status: 'Redeemed', txHash } : a));
      setSelectedAsset(prev => prev ? { ...prev, status: 'Redeemed', txHash } : null);
      addTelemetryLog(`[SYSTEM] Asset RWA #${selectedAsset.id} state updated to REDEEMED. Lifecycle closed.`);
    } catch (err: any) {
      console.error("Redemption error:", err);
      addTelemetryLog(`[ERROR] Redemption failed: ${err.message || err}`);
      setSettleError(err.message || 'Maturity redemption failed.');
    } finally {
      setIsSettling(false);
    }
  };

  // Tokenize / Mint new RWA asset
  const handleMint = async () => {
    if (!newName || !newFaceValue) {
      setSettleError("Please enter asset name and face value.");
      return;
    }

    setIsMinting(true);
    setSettleError('');
    
    // Generate a unique random ID for the asset to register on-chain
    const assetId = Math.floor(Math.random() * 100000) + 1000;
    
    addTelemetryLog(`[INIT] Tokenizing new Real World Asset: ${newName} (Par: $${newFaceValue} USD)...`);
    addTelemetryLog(`[LEDGER] Submitting on-chain mint_asset invocation for Asset ID #${assetId}...`);

    try {
      const response = await fetch('/api/mint', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ id: assetId, faceValue: Number(newFaceValue) }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || data.details || 'On-chain minting failed.');
      }

      addTelemetryLog(`[LEDGER] RWA Token successfully minted on-chain. Contract binding active!`);
      addTelemetryLog(`[LEDGER] Transaction Hash: ${data.txHash}`);
      addTelemetryLog(`[SYSTEM] Compliance policy registered: Exact Match.`);

      // Create new asset object
      const newAsset: RwaAsset = {
        id: assetId,
        name: newName,
        faceValue: Number(newFaceValue),
        status: 'Pending',
        txHash: data.txHash || undefined
      };

      setAssets(prev => [...prev, newAsset]);
      setSelectedAsset(newAsset);
      
      // Reset form fields
      setNewName('');
      setNewFaceValue('');
      
      // Return to overview dashboard
      setActiveTab('overview');
      addTelemetryLog(`[SYSTEM] New RWA Asset #${newAsset.id} added to active registry ledger.`);
    } catch (err: any) {
      console.error("Minting error:", err);
      addTelemetryLog(`[ERROR] Tokenization failed: ${err.message || err}`);
      setSettleError(err.message || "Tokenization failed.");
    } finally {
      setIsMinting(false);
    }
  };

  // Decrypt transaction event handler
  const handleDecrypt = async () => {
    if (!decTxHash || !decPrivKey) {
      setDecryptError('Please fill in both fields.');
      return;
    }

    setIsDecrypting(true);
    setDecryptError('');
    setDecryptedAmount(null);
    setDecryptedPayload(null);
    setDecryptedSuccess(null);

    try {
      let eventValue: string | undefined;
      try {
        console.log('[Settle] Browser pre-fetching transaction details from Horizon...');
        const horizonRes = await fetch(`https://horizon-testnet.stellar.org/transactions/${decTxHash}`);
        if (horizonRes.ok) {
          const txInfo = await horizonRes.json();
          const ledger = txInfo.ledger;
          if (ledger) {
            console.log(`[Settle] Browser querying Soroban RPC for ledger ${ledger}...`);
            const rpcPayload = {
              jsonrpc: '2.0',
              id: 1,
              method: 'getEvents',
              params: {
                startLedger: ledger,
                filters: [
                  {
                    type: 'contract',
                    contractIds: [CONTRACT_ID]
                  }
                ]
              }
            };
            const rpcRes = await fetch('https://soroban-testnet.stellar.org', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(rpcPayload)
            });
            if (rpcRes.ok) {
              const rpcData = await rpcRes.json();
              const events = rpcData.result?.events || [];
              const targetEvent = events.find((ev: any) => ev.txHash === decTxHash);
              if (targetEvent) {
                eventValue = targetEvent.value;
                console.log('[Settle] Browser successfully pre-fetched eventValue!');
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[Settle] Browser-side event pre-fetch failed, letting backend query:', err.message);
      }

      const res = await fetch('/api/decrypt', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          txHash: decTxHash,
          privateKey: decPrivKey,
          eventValue
        })
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setDecryptedAmount(data.decryptedAmount);
      setDecryptedPayload(data.payload);
      setDecryptedSuccess(true);
    } catch (err: any) {
      setDecryptError(err.message || 'Decryption failed. Ensure the key matches the transaction.');
      setDecryptedSuccess(false);
    } finally {
      setIsDecrypting(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0A] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rotate-45 border border-[#F2F2F0] flex items-center justify-center bg-transparent animate-spin">
            <div className="w-2 h-2 bg-[#F2F2F0]"></div>
          </div>
          <span className="text-[10px] text-[#8A8A8A] uppercase tracking-wider">Verifying Session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0A0A0A] text-[#F2F2F0] font-mono select-none">
      
      {/* Onboarding Modal (shadcn Dialog wrapper) */}
      {showOnboardModal && (
        <Dialog open={showOnboardModal} onOpenChange={(open) => { if (!open) dismissOnboardModal(); }}>
          <DialogContent className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 max-w-md w-full space-y-6 text-[#F2F2F0] font-mono">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#F2F2F0]" />
                </div>
                <div>
                  <DialogTitle className="text-xs font-bold uppercase tracking-wider text-[#F2F2F0]">RWA Private Registry Console</DialogTitle>
                  <DialogDescription className="text-[9px] text-[#8A8A8A] font-mono">Selective disclosure & settlement overview</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-3 text-xs leading-relaxed text-[#8A8A8A]">
              <p>
                Welcome to the private registry. Here, you can mint tokenized assets and settle transactions on the Stellar network while keeping the private dollar amounts hidden from public view.
              </p>
              <p>
                Advanced ZK proofs verify compliance rules live on the ledger, and selective view keys allow only authorized auditors to decrypt the private details when needed.
              </p>
            </div>

            <Button 
              onClick={dismissOnboardModal}
              className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-5 cursor-pointer"
            >
              GOT IT
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* Share View Key Modal (shadcn Dialog wrapper) */}
      {showShareModal && (
        <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
          <DialogContent className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 max-w-sm w-full space-y-6 text-[#F2F2F0] font-mono">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-[#F2F2F0]" />
                </div>
                <div>
                  <DialogTitle className="text-xs font-bold uppercase tracking-wider text-[#F2F2F0]">Share Auditor Access</DialogTitle>
                  <DialogDescription className="text-[9px] text-[#8A8A8A] font-mono">Grant read-only audit permissions</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="w-full h-48 border border-[#3A3A3A] flex flex-col items-center justify-center bg-[#0A0A0A] p-4">
              <div className="grid grid-cols-8 gap-1.5 w-32 h-32 opacity-30">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div key={i} className={"w-full h-full " + ((i % 3 === 0 || i % 7 === 0) ? 'bg-[#F2F2F0]' : 'bg-transparent')}></div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[8px] text-[#8A8A8A] font-mono tracking-wider">REGULATORY AUDITOR ACCESS LINK</label>
              <input 
                type="text" 
                readOnly
                value={typeof window !== 'undefined' ? window.location.origin + "/inspector?viewKey=" + privViewKey : "http://localhost:3000/inspector?viewKey=" + privViewKey}
                className="w-full bg-[#0A0A0A] border border-[#3A3A3A] p-2 text-[10px] text-[#8A8A8A] font-mono focus:outline-none select-all"
              />
            </div>

            <Button 
              onClick={() => setShowShareModal(false)}
              className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-5 cursor-pointer"
            >
              CLOSE PANEL
            </Button>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex-1 flex overflow-hidden">
      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className="w-64 h-full bg-[#1A1A1A] border-r border-[#3A3A3A] text-[#F2F2F0] flex flex-col justify-between p-6">
        <div className="space-y-8">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rotate-45 border border-[#F2F2F0] flex items-center justify-center bg-transparent">
              <div className="w-1.5 h-1.5 bg-[#F2F2F0]"></div>
            </div>
            <span className="text-sm font-bold tracking-tight text-[#F2F2F0] uppercase">
              Lantern
            </span>
          </div>

          {/* New Asset Register button */}
          <Button 
            onClick={() => {
              setActiveTab('issuance');
            }}
            className="w-full bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0] font-bold text-xs py-5 cursor-pointer"
          >
            + ISSUE NEW ASSET
          </Button>

          {/* Navigation Items list */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={"w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all " + (
                activeTab === 'overview' ? 'bg-[#3A3A3A] text-[#F2F2F0]' : 'text-[#8A8A8A] hover:bg-[#3A3A3A]/50 hover:text-[#F2F2F0]'
              )}
            >
              <Home className="w-4 h-4 text-[#8A8A8A]" />
              OVERVIEW CONSOLE
            </button>

            <button
              onClick={() => setActiveTab('issuance')}
              className={"w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all " + (
                activeTab === 'issuance' ? 'bg-[#3A3A3A] text-[#F2F2F0]' : 'text-[#8A8A8A] hover:bg-[#3A3A3A]/50 hover:text-[#F2F2F0]'
              )}
            >
              <Sparkles className="w-4 h-4 text-[#8A8A8A]" />
              ASSET ISSUANCE
            </button>

            <button
              onClick={() => setActiveTab('keys')}
              className={"w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all " + (
                activeTab === 'keys' ? 'bg-[#3A3A3A] text-[#F2F2F0]' : 'text-[#8A8A8A] hover:bg-[#3A3A3A]/50 hover:text-[#F2F2F0]'
              )}
            >
              <Key className="w-4 h-4 text-[#8A8A8A]" />
              AUDITOR VIEW KEYS
            </button>

            <button
              onClick={() => setActiveTab('decrypt')}
              className={"w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all " + (
                activeTab === 'decrypt' ? 'bg-[#3A3A3A] text-[#F2F2F0]' : 'text-[#8A8A8A] hover:bg-[#3A3A3A]/50 hover:text-[#F2F2F0]'
              )}
            >
              <Eye className="w-4 h-4 text-[#8A8A8A]" />
              DECRYPTION VAULT
            </button>

            <div className="pt-4 border-t border-[#3A3A3A] mt-4 space-y-1">
              <span className="block text-[8px] text-[#8A8A8A] font-mono px-4 pb-1.5 uppercase tracking-wider font-bold">Tools</span>

              <Link
                href="/inspector"
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all text-[#8A8A8A] hover:bg-[#3A3A3A]/50 hover:text-[#F2F2F0]"
              >
                <Layers className="w-4 h-4 text-[#8A8A8A]" />
                LEDGER INSPECTOR
              </Link>
            </div>
          </nav>
        </div>

        {/* Profile Card */}
        <div className="space-y-4 pt-4 border-t border-[#3A3A3A]">
          <button 
            onClick={() => {
              sessionStorage.removeItem('lantern_wallet_address');
              window.location.href = '/';
            }}
            className="w-full flex items-center gap-2 text-[10px] text-[#8A8A8A] hover:text-[#F2F2F0] transition-all pl-2 cursor-pointer bg-transparent border-none outline-none font-bold"
          >
            <LogOut className="w-3.5 h-3.5" />
            EXIT DASHBOARD
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#0A0A0A]">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#3A3A3A] bg-[#1A1A1A] px-8 md:px-12 flex items-center justify-between text-xs text-[#8A8A8A]">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#F2F2F0]" />
            <span className="font-bold text-[#F2F2F0] uppercase tracking-wider">RWA Private Registry Console</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Freighter Connection Ribbon in Header */}
            {walletAddress ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] px-3 py-1.5 text-[#F2F2F0] text-[10px] font-semibold font-mono">
                  <Wallet className="w-3.5 h-3.5 text-[#8A8A8A]" />
                  <span>{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
                  <span className="w-px bg-[#3A3A3A] h-3"></span>
                  <span className="text-[#8A8A8A]">TESTNET</span>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.removeItem('lantern_wallet_address');
                    window.location.href = '/';
                  }}
                  className="bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#8A8A8A] hover:text-[#F2F2F0] text-[9px] px-2.5 py-1.5 uppercase tracking-wider font-bold transition-all cursor-pointer"
                >
                  DISCONNECT
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end relative">
                <Button 
                  onClick={connectWallet}
                  disabled={isConnectingWallet}
                  className="flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0] text-[10px] px-3.5 py-3 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#8A8A8A]" />
                  {isConnectingWallet ? 'CONNECTING...' : 'CONNECT FREIGHTER'}
                </Button>
                {isFreighterInstalled === false && (
                  <div className="absolute top-10 right-0 z-20 w-48 bg-[#1A1A1A] border border-[#C41E1E] p-2 text-[9px] text-[#C41E1E]">
                    Freighter is not installed. <a href="https://www.freighter.app/" target="_blank" rel="noreferrer" className="underline font-bold">Install extension</a>.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-[#0A0A0A] border border-[#3A3A3A] px-2.5 py-1 text-[#F2F2F0] font-bold">
              <span>STELLAR-ZK VERIFIER</span>
            </div>
          </div>
        </header>

        {/* Outer Content Area */}
        <main className="p-8 md:p-12 space-y-8 flex-1">
          
          {/* Dashboard Title */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#F2F2F0] uppercase">
              RWA Settlement Dashboard
            </h2>
            <p className="text-xs text-[#8A8A8A] mt-1">Configure compliance rules, compile zero-knowledge verification proofs, and submit private settlements.</p>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-8">
              
              {/* Note: Stat Cards have been removed as per core specifications to focus solely on registry & active flows */}

              {/* OVERVIEW CONTENT GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Side: Asset Registry Table (Col 7) */}
                <div className="lg:col-span-7 bg-[#1A1A1A] border border-[#3A3A3A] p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-[#3A3A3A] pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">Asset Registry Ledger</h3>
                      <p className="text-[9px] text-[#8A8A8A] mt-0.5">Select a minted RWA token to process settlement</p>
                    </div>
                    <span className="text-[9px] text-[#8A8A8A]">{assets.length} ACTIVE RECORDS</span>
                  </div>

                  <div className="space-y-3">
                    {assets.map((asset) => {
                      const isSelected = selectedAsset?.id === asset.id;
                      return (
                        <button
                          key={asset.id}
                          onClick={() => {
                            if (!isSettling) {
                              setSelectedAsset(asset);
                              setSettleError('');
                              setSettleSuccessMsg('');
                              if (asset.txHash) {
                                setDecTxHash(asset.txHash);
                              }
                            }
                          }}
                          className={"w-full flex items-center justify-between p-4 border text-left transition-all " + (
                            isSelected 
                              ? 'border-[#F2F2F0] bg-[#0A0A0A]' 
                              : 'border-[#3A3A3A] bg-[#1A1A1A] hover:border-[#8A8A8A]'
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 border border-[#3A3A3A] flex items-center justify-center text-[#8A8A8A]">
                              {asset.name.includes("Treasury") && <FileSpreadsheet className="w-4 h-4 text-blue-500" />}
                              {asset.name.includes("Real Estate") && <Home className="w-4 h-4 text-orange-400" />}
                              {asset.name.includes("Corporate") && <Coins className="w-4 h-4 text-violet-400" />}
                              {asset.name.includes("Gold") && <Sparkles className="w-4 h-4 text-amber-500" />}
                              {asset.name.includes("Carbon") && <Sparkles className="w-4 h-4 text-emerald-500" />}
                              {!["Treasury", "Real Estate", "Corporate", "Gold", "Carbon"].some(keyword => asset.name.includes(keyword)) && <Coins className="w-4 h-4 text-zinc-400" />}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-[#F2F2F0] uppercase">{asset.name}</h4>
                              <span className="font-mono text-[9px] text-[#8A8A8A] block mt-0.5">
                                ID: #{asset.id} • Target Value: ${asset.faceValue} • Settled Value: {asset.status === 'Settled' ? <CiphertextReveal value={`$${asset.faceValue}`} isDecrypted={false} /> : '████████████'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {asset.status === 'Settled' && (
                              <span className="text-[9px] text-[#8A8A8A] select-all">
                                Tx: {asset.txHash?.substring(0, 8)}...
                              </span>
                            )}
                            <span className={`text-[9px] font-bold px-2 py-0.5 border ${
                              asset.status === 'Settled' 
                                ? 'border-[#3A3A3A] text-[#F2F2F0]' 
                                : asset.status === 'Settling'
                                ? 'border-[#8A8A8A] text-[#8A8A8A] animate-pulse'
                                : 'border-[#3A3A3A] text-[#8A8A8A]'
                            }`}>
                              {asset.status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Settlement & Compliance Console (Col 5) */}
                {selectedAsset && (
                  <div className="lg:col-span-5 bg-[#1A1A1A] border border-[#3A3A3A] p-6 space-y-6">
                    <div className="flex justify-between items-center border-b border-[#3A3A3A] pb-4">
                      <div>
                        <span className="text-[8px] text-[#8A8A8A] uppercase">Active Focus</span>
                        <h4 className="text-xs font-bold text-[#F2F2F0] uppercase">{selectedAsset.name}</h4>
                      </div>
                      <span className="text-xs font-bold text-[#8A8A8A]">
                        Target: ${selectedAsset.faceValue}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {selectedAsset.status === 'Pending' && (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <label className="block text-[8px] text-[#8A8A8A] font-mono uppercase tracking-wider">Pricing Mode</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setPricingMode('par')}
                                className={`px-3 py-2 text-[10px] font-bold border transition-all cursor-pointer ${
                                  pricingMode === 'par' 
                                    ? 'bg-[#1A1A1A] text-[#F2F2F0] border-[#F2F2F0]' 
                                    : 'bg-[#0A0A0A] text-[#8A8A8A] border-[#3A3A3A] hover:border-[#8A8A8A]'
                                }`}
                              >
                                PAR VALUE (100%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPricingMode('discount')}
                                className={`px-3 py-2 text-[10px] font-bold border transition-all cursor-pointer ${
                                  pricingMode === 'discount' 
                                    ? 'bg-[#1A1A1A] text-[#F2F2F0] border-[#F2F2F0]' 
                                    : 'bg-[#0A0A0A] text-[#8A8A8A] border-[#3A3A3A] hover:border-[#8A8A8A]'
                                }`}
                              >
                                SECONDARY DISCOUNT
                              </button>
                            </div>
                          </div>

                          {pricingMode === 'discount' && (
                            <div className="space-y-2 p-3 bg-[#0A0A0A] border border-[#3A3A3A]">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-[#8A8A8A] uppercase font-mono">Discount Rate:</span>
                                <span className="text-[#F2F2F0] font-bold font-mono">{discountPercent}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="15" 
                                step="1" 
                                value={discountPercent} 
                                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                                className="w-full accent-[#F2F2F0] h-1 bg-[#1a1a1a] cursor-pointer"
                              />
                              <div className="text-[9px] text-[#8A8A8A] font-mono mt-1">
                                Negotiated Price: ${settleAmount} USD (vs ${selectedAsset.faceValue} Par)
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <label className="block text-[8px] text-[#8A8A8A] font-mono uppercase tracking-wider">Settlement Amount ($)</label>
                            <input 
                              type="number" 
                              value={settleAmount}
                              onChange={(e) => setSettleAmount(e.target.value ? Number(e.target.value) : '')}
                              disabled={pricingMode === 'discount'}
                              className="w-full bg-[#0A0A0A] border border-[#3A3A3A] text-xs text-[#F2F2F0] p-2.5 font-mono focus:outline-none focus:border-[#F2F2F0] h-9 disabled:opacity-75"
                              placeholder="Enter amount to pay..."
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[8px] text-[#8A8A8A] font-mono uppercase tracking-wider">COMPLIANCE POLICY RULE</label>
                            <Select value={selectedPolicy} onValueChange={(val) => { if (val) setSelectedPolicy(val); }}>
                              <SelectTrigger className="w-full bg-[#0A0A0A] border border-[#3A3A3A] text-xs text-[#F2F2F0] py-2 h-9">
                                <SelectValue placeholder="Select compliance rule" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1A1A1A] border border-[#3A3A3A] text-[#F2F2F0] font-mono text-xs">
                                <SelectItem value="Exact Match (amount == face_value)">Exact Match (amount == face_value)</SelectItem>
                                <SelectItem value="Accrued Yield (amount == face_value * 1.05)">Accrued Yield (amount == face_value * 1.05)</SelectItem>
                                <SelectItem value="Allocation Cap (amount <= face_value * 1.50)">Allocation Cap (amount &lt;= face_value * 1.50)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {settleError && (
                            <div className="flex items-center gap-2 p-3 border border-[#C41E1E] text-[#C41E1E] text-xs">
                              <AlertCircle className="w-4 h-4 flex-shrink-0" />
                              <span>{settleError}</span>
                            </div>
                          )}

                          {walletAddress ? (
                            <Button
                              onClick={handleSettle}
                              disabled={isSettling}
                              className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-5 transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {isSettling ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin text-[#0A0A0A] mr-2" />
                                  SIGNING TRANSACTION...
                                </>
                              ) : (
                                <>
                                  SETTLE PRIVATELY ON STELLAR
                                  <ChevronRight className="w-3.5 h-3.5 text-[#0A0A0A] ml-1" />
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={connectWallet}
                              disabled={isConnectingWallet}
                              className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-5 cursor-pointer"
                            >
                              <Wallet className="w-4 h-4 mr-2" />
                              CONNECT WALLET TO SETTLE
                            </Button>
                          )}
                        </div>
                      )}

                      {selectedAsset.status === 'Settling' && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                          <RefreshCw className="w-6 h-6 animate-spin text-[#F2F2F0]" />
                          <h4 className="text-xs font-bold text-[#F2F2F0] uppercase">Awaiting Freighter Signature...</h4>
                          <p className="text-[9px] text-[#8A8A8A] max-w-xs">Generating transaction envelope. Please open your Freighter extension popup to sign the transaction.</p>
                        </div>
                      )}

                      {selectedAsset.status === 'Settled' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-4 border border-[#3A3A3A] bg-[#0A0A0A] text-xs">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#F2F2F0]" />
                            <div>
                              <span className="font-bold block uppercase">ZK Proof Verified!</span>
                              Asset settled privately. State locked.
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[8px] text-[#8A8A8A] font-mono uppercase tracking-wider">Settled Amount (Private)</label>
                            <div className="text-sm font-bold text-[#F2F2F0] font-mono bg-[#0A0A0A] border border-[#3A3A3A] p-2.5">
                              <CiphertextReveal value={`$${selectedAsset.faceValue}`} isDecrypted={false} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[8px] text-[#8A8A8A] font-mono uppercase tracking-wider">Audit Trail Ciphertext Event</label>
                            <div className="bg-[#0A0A0A] border border-[#3A3A3A] p-3 font-mono text-[9px] break-all leading-normal select-all">
                              {selectedAsset.ciphertext || '20dae838'}
                            </div>
                            <span className="text-[8px] text-[#8A8A8A] mt-1 block">Ciphertext emitted on-chain via Stellar Ledger Event. Decryptable only via Auditor View Key.</span>
                          </div>

                          {settleError && (
                            <div className="flex items-center gap-2 p-3 border border-[#C41E1E] text-[#C41E1E] text-xs">
                              <AlertCircle className="w-4 h-4 flex-shrink-0" />
                              <span>{settleError}</span>
                            </div>
                          )}

                          <Button
                            onClick={handleRedeem}
                            disabled={isSettling}
                            className="w-full bg-[#C41E1E] hover:bg-[#A31818] text-[#F2F2F0] text-xs font-bold py-5 mt-4 transition-all cursor-pointer border border-[#3A3A3A]"
                          >
                            {isSettling ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin text-[#F2F2F0] mr-2" />
                                PROCESSING REDEMPTION...
                              </>
                            ) : (
                              'REDEEM AT MATURITY (BURN & UNLOCK)'
                            )}
                          </Button>
                        </div>
                      )}

                      {selectedAsset.status === 'Redeemed' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-4 border border-[#3A3A3A] bg-[#0A0A0A] text-xs">
                            <Unlock className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                            <div>
                              <span className="font-bold block uppercase text-emerald-400">RWA Lifecycle Retired</span>
                              Asset matured, burned, and collateral fully redeemed.
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[8px] text-[#8A8A8A] font-mono uppercase tracking-wider">Redeemed Collateral Value</label>
                            <div className="text-sm font-bold text-[#8a8a8a] font-mono bg-[#0A0A0A] border border-[#3A3A3A] p-2.5 line-through">
                              ${selectedAsset.faceValue} USD
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Visual Verification Timeline */}
                      <div className="border-t border-[#3A3A3A] pt-6 space-y-4">
                        <span className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider block">Verification Stages</span>
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex flex-col items-center flex-1">
                            <div className="w-6 h-6 border border-[#3A3A3A] bg-[#1A1A1A] flex items-center justify-center text-[9px] font-bold text-[#F2F2F0]">01</div>
                            <span className="text-[8px] font-bold mt-1 text-[#F2F2F0]">MINTED</span>
                          </div>
                          <div className="h-px bg-[#3A3A3A] flex-1"></div>
                          <div className="flex flex-col items-center flex-1">
                            <div className={"w-6 h-6 border flex items-center justify-center text-[9px] font-bold " + (
                              selectedAsset.status !== 'Pending' ? 'bg-[#1A1A1A] text-[#F2F2F0] border-[#F2F2F0]' : 'bg-[#0A0A0A] text-[#8A8A8A] border-[#3A3A3A]'
                            )}>02</div>
                            <span className="text-[8px] font-bold mt-1 text-[#8A8A8A]">PROVED</span>
                          </div>
                          <div className="h-px bg-[#3A3A3A] flex-1"></div>
                          <div className="flex flex-col items-center flex-1">
                            <div className={"w-6 h-6 border flex items-center justify-center text-[9px] font-bold " + (
                              (selectedAsset.status === 'Settled' || selectedAsset.status === 'Redeemed') ? 'bg-[#1A1A1A] text-[#F2F2F0] border-[#F2F2F0]' : 'bg-[#0A0A0A] text-[#8A8A8A] border-[#3A3A3A]'
                            )}>03</div>
                            <span className="text-[8px] font-bold mt-1 text-[#8A8A8A]">SETTLED</span>
                          </div>
                          <div className="h-px bg-[#3A3A3A] flex-1"></div>
                          <div className="flex flex-col items-center flex-1">
                            <div className={"w-6 h-6 border flex items-center justify-center text-[9px] font-bold " + (
                              selectedAsset.status === 'Redeemed' ? 'bg-[#1A1A1A] text-[#F2F2F0] border-[#F2F2F0]' : 'bg-[#0A0A0A] text-[#8A8A8A] border-[#3A3A3A]'
                            )}>04</div>
                            <span className="text-[8px] font-bold mt-1 text-[#8A8A8A]">REDEEMED</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ZK Compliance & Telemetry Engine */}
              <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-[#3A3A3A] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-[#F2F2F0] animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">ZK Compliance & Telemetry Engine</h3>
                      <p className="text-[10px] text-[#8A8A8A] mt-0.5">Real-time traces of zero-knowledge proofs, policy evaluations, and contract settlements.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setTelemetryLogs([
                      `[${new Date().toLocaleTimeString()}] [SYSTEM] Telemetry log cleared. Listening for new compliance proofs...`
                    ])}
                    className="text-[9px] text-[#8A8A8A] hover:text-[#F2F2F0] border border-[#3A3A3A] px-2.5 py-1 bg-[#0A0A0A] uppercase tracking-wider font-bold transition-all cursor-pointer"
                  >
                    Clear Log
                  </button>
                </div>

                <div className="bg-[#0A0A0A] border border-[#3A3A3A] p-5 font-mono text-[10px] text-[#8A8A8A] space-y-2 h-64 overflow-y-auto select-text">
                  {telemetryLogs.map((log, index) => {
                    let color = 'text-[#8A8A8A]';
                    if (log.includes('[ERROR]')) color = 'text-[#C41E1E]';
                    else if (log.includes('[LEDGER]') || log.includes('[SYSTEM]')) color = 'text-[#F2F2F0]';
                    else if (log.includes('[ZK-PROOF]')) color = 'text-amber-500';
                    else if (log.includes('[ZK-ECIES]')) color = 'text-blue-400';
                    else if (log.includes('[WALLET]')) color = 'text-purple-400';
                    else if (log.includes('[SOROBAN]')) color = 'text-emerald-400';
                    
                    return (
                      <div key={index} className={`${color} leading-relaxed break-all`}>
                        {log}
                      </div>
                    );
                  })}
                  <div className="animate-pulse text-[#F2F2F0] font-bold">_</div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'keys' && (
            <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 max-w-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center">
                    <Key className="w-5 h-5 text-[#F2F2F0]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">View Key Registry</h3>
                    <p className="text-[10px] text-[#8A8A8A] mt-0.5">Manage keys for selective disclosure checks</p>
                  </div>
                </div>

                <Button 
                  onClick={generateNewKeys}
                  disabled={isGeneratingKeys}
                  className="bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] px-4 py-2 text-[#F2F2F0] text-xs font-bold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKeys ? 'animate-spin' : ''} mr-1.5`} />
                  ROTATE KEYS
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[8px] text-[#8A8A8A] font-mono mb-1 uppercase tracking-wider">PUBLIC VIEW KEY</label>
                  <textarea 
                    value={pubViewKey}
                    readOnly 
                    rows={2}
                    className="w-full bg-[#0A0A0A] border border-[#3A3A3A] p-3 text-[10px] text-[#8A8A8A] font-mono focus:outline-none resize-none select-all"
                  />
                </div>
                <div>
                  <label className="block text-[8px] text-[#8A8A8A] font-mono mb-1 uppercase tracking-wider">PRIVATE VIEW KEY</label>
                  <textarea 
                    value={privViewKey}
                    readOnly 
                    rows={2}
                    className="w-full bg-[#0A0A0A] border border-[#3A3A3A] p-3 text-[10px] text-[#8A8A8A] font-mono focus:outline-none resize-none select-all"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'decrypt' && (
            <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 max-w-2xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[#F2F2F0]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">Audit Decryption Vault</h3>
                  <p className="text-[10px] text-[#8A8A8A] mt-0.5">Decrypt settlement event from ledger metadata</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[8px] text-[#8A8A8A] font-bold uppercase tracking-wider">Transaction Hash</label>
                    {assets.find(a => a.status === 'Settled')?.txHash && (
                      <button 
                        type="button" 
                        onClick={() => setDecTxHash(assets.find(a => a.status === 'Settled')?.txHash || '')} 
                        className="text-[9px] text-[#F2F2F0] hover:underline font-mono"
                      >
                        Use Settled Tx
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={decTxHash}
                    onChange={(e) => setDecTxHash(e.target.value)}
                    placeholder="a83f8695f1ccfaed4732..."
                    className="w-full bg-[#0A0A0A] border border-[#3A3A3A] px-3 py-2 text-xs focus:outline-none focus:border-[#8A8A8A] font-mono text-[#F2F2F0]"
                  />
                </div>

                <div>
                  <label className="block text-[8px] text-[#8A8A8A] font-bold uppercase tracking-wider mb-1">Private View Key</label>
                  <input 
                    type="text" 
                    value={decPrivKey}
                    onChange={(e) => setDecPrivKey(e.target.value)}
                    placeholder="2f0d526bbee510a175..."
                    className="w-full bg-[#0A0A0A] border border-[#3A3A3A] px-3 py-2 text-xs focus:outline-none focus:border-[#8A8A8A] font-mono text-[#F2F2F0]"
                  />
                </div>

                {decryptError && (
                  <div className="flex items-center gap-2 p-2 border border-[#C41E1E] text-[#C41E1E] text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{decryptError}</span>
                  </div>
                )}

                <Button
                  onClick={handleDecrypt}
                  disabled={isDecrypting}
                  className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-5 cursor-pointer"
                >
                  {isDecrypting ? (
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#0A0A0A]" />
                  ) : (
                    'DECRYPT LEDGER EVENT'
                  )}
                </Button>
              </div>

              <div className="mt-6">
                <div className="w-full bg-[#0A0A0A] border border-[#3A3A3A] p-6 space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                  {decryptedSuccess === true && (
                    <div className="absolute right-3 top-3 border border-[#3A3A3A] bg-[#1A1A1A] px-2.5 py-1 text-[8px] font-bold text-[#F2F2F0] select-none">
                      COMPLIANT PASS
                    </div>
                  )}
                  {decryptedSuccess === false && (
                    <div className="absolute right-3 top-3 border border-[#C41E1E] bg-[#1A1A1A] px-2.5 py-1 text-[8px] font-bold text-[#C41E1E] select-none">
                      DECRYPTION FAILED
                    </div>
                  )}
                  
                  <div className="border-b border-[#3A3A3A] pb-2">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#8A8A8A] block">🔐 SECURE DECRYPTION CERTIFICATE</span>
                    <span className="text-[8px] text-[#8A8A8A] font-mono block mt-0.5">VERIFIER ID: {VERIFIER_ID.substring(0, 16)}...</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#8A8A8A]">Decrypted Value:</span>
                    <span className="font-bold text-[#F2F2F0] font-mono">
                      {decryptedAmount !== null ? (
                        <CiphertextReveal value={`$${decryptedAmount} USD`} isDecrypted={true} />
                      ) : (
                        <CiphertextReveal value="████████████" isDecrypted={false} />
                      )}
                    </span>
                  </div>

                  <div className="text-[10px] text-[#8A8A8A] leading-relaxed">
                    {decryptedAmount !== null ? (
                      <span>Compliance Policy check results verified: **Exact match conditions satisfied**. Cryptographic verification confirms face-value compliance.</span>
                    ) : (
                      <span>Provide private view key and transaction hash to reveal audited details.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'issuance' && (
            <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 max-w-xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#F2F2F0]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">RWA Tokenization Portal</h3>
                  <p className="text-[10px] text-[#8A8A8A] mt-0.5">Mint dynamic digital twins representing real physical assets.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[8px] text-[#8A8A8A] font-bold uppercase tracking-wider mb-1">Asset Name / Security Label</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. US Treasury Bill #806"
                    className="w-full bg-[#0A0A0A] border border-[#3A3A3A] px-3 py-2 text-xs focus:outline-none focus:border-[#8A8A8A] font-mono text-[#F2F2F0]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[8px] text-[#8A8A8A] font-bold uppercase tracking-wider mb-1">Face Value (USD Par)</label>
                    <input 
                      type="number" 
                      value={newFaceValue}
                      onChange={(e) => setNewFaceValue(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 5000"
                      className="w-full bg-[#0A0A0A] border border-[#3A3A3A] px-3 py-2 text-xs focus:outline-none focus:border-[#8A8A8A] font-mono text-[#F2F2F0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-[#8A8A8A] font-bold uppercase tracking-wider mb-1">Asset Class</label>
                    <Select value={newAssetClass} onValueChange={(val) => { if (val) setNewAssetClass(val); }}>
                      <SelectTrigger className="w-full bg-[#0A0A0A] border border-[#3A3A3A] text-xs text-[#F2F2F0] py-2 h-9">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A1A] border border-[#3A3A3A] text-[#F2F2F0] font-mono text-xs">
                        <SelectItem value="Government Bond">Government Bond</SelectItem>
                        <SelectItem value="Real Estate">Real Estate</SelectItem>
                        <SelectItem value="Corporate Debt">Corporate Debt</SelectItem>
                        <SelectItem value="Precious Metals">Precious Metals</SelectItem>
                        <SelectItem value="Carbon Credit">Carbon Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {settleError && (
                  <div className="flex items-center gap-2 p-2 border border-[#C41E1E] text-[#C41E1E] text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{settleError}</span>
                  </div>
                )}

                <Button
                  onClick={handleMint}
                  disabled={isMinting}
                  className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-5 cursor-pointer"
                >
                  {isMinting ? (
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#0A0A0A]" />
                  ) : (
                    'MINT ON-CHAIN RWA TWIN'
                  )}
                </Button>
              </div>
            </div>
          )}

        </main>
      </div>
      </div>
      <MiniFooter />
    </div>
  );
}
