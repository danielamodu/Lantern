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
import { signTransaction } from '@stellar/freighter-api';
import { useWallet } from '@/lib/WalletContext';
import { SETTLEMENT_CONTRACT_ID, NETWORK_PASSPHRASE } from '@/lib/config';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CiphertextReveal } from './CiphertextReveal';
import MiniFooter from '@/components/MiniFooter';
import { decryptSettlementClient, EncryptedPayload } from '@/utils/clientCrypto';

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
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

function base64UrlToHex(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  return Array.from(bin, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

const ASSET_CLASS_MAP: Record<string, string> = {
  'Government Bond': 'TreasuryBill',
  'Real Estate': 'InvoiceReceivable',
  'Corporate Debt': 'CorporateBond',
  'Precious Metals': 'CommodityToken',
  'Carbon Credit': 'CarbonCredit',
};

let sessionTokenPromise: Promise<string | null> | null = null;

async function establishSession(walletAddress: string): Promise<string | null> {
  try {
    const challengeRes = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'challenge', sourceAddress: walletAddress }),
    });
    const challengeData = await challengeRes.json();
    if (!challengeData.success) throw new Error(challengeData.error || 'Challenge failed');

    const signResult = await signTransaction(challengeData.unsignedXdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    const signedXdr = typeof signResult === 'string'
      ? signResult
      : (signResult as any).result ?? (signResult as any).signedTxXdr ?? '';

    if (!signedXdr) throw new Error('Failed to sign auth challenge');

    const verifyRes = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedXdr, sourceAddress: walletAddress }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.success) throw new Error(verifyData.error || 'Verification failed');

    return verifyData.token;
  } catch (err) {
    console.error('[Auth] Session establishment failed:', err);
    return null;
  }
}

function getSessionToken(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('lantern_session_token');
  }
  return null;
}

function setSessionToken(token: string | null) {
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('lantern_session_token', token);
    } else {
      sessionStorage.removeItem('lantern_session_token');
    }
  }
}

async function getAuthHeaders(fallbackSignerAddress?: string): Promise<Record<string, string>> {
  const signerAddress = fallbackSignerAddress;
  if (!signerAddress) {
    return {};
  }

  let token = getSessionToken();
  if (!token && sessionTokenPromise) {
    token = await sessionTokenPromise;
  }
  if (!token) {
    sessionTokenPromise = establishSession(signerAddress);
    token = await sessionTokenPromise;
    if (token) {
      setSessionToken(token);
    }
  }

  if (token) {
    return { 'x-session-token': token, 'x-signer-address': signerAddress };
  }

  return { 'x-signer-address': signerAddress };
}

async function authedFetch(url: string, opts: RequestInit = {}, signerAddress?: string): Promise<Response> {
  const authHeaders = await getAuthHeaders(signerAddress);
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts.headers,
      ...authHeaders,
    },
  });
}

export default function AppDashboard() {
  const { address: walletAddress, isInstalled: isFreighterInstalled, isConnecting: isConnectingWallet, hasCheckedConnection, connect: connectWallet } = useWallet();
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
      `[${time}] [SYSTEM] Connected to Soroban Contract: ${SETTLEMENT_CONTRACT_ID}`,
      `[${time}] [SYSTEM] Verifier Identity key active: CCRUK3TL4BQMSOI5...`
    ];
  });

  const addTelemetryLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTelemetryLogs(prev => [...prev.slice(-49), `[${time}] ${msg}`]);
  };

  // Auth state — auth headers are now generated lazily per-request via authedFetch
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'decrypt' | 'issuance'>('overview');
  const [showOnboardModal, setShowOnboardModal] = useState(false);

  // Generate dynamic keypair on mount
  useEffect(() => {
    generateNewKeys();

    // Hydrate asset list from live on-chain API instead of seeded data
    const fetchLiveAssets = async () => {
      try {
        const res = await fetch('/api/assets/list');
        const data = await res.json();
        if (data.success && data.assets && data.assets.length > 0) {
          const liveAssets: RwaAsset[] = data.assets.map((a: any) => ({
            id: a.id,
            name: a.name,
            faceValue: a.faceValue,
            status: a.status as RwaAsset['status'],
            txHash: a.txHash,
          }));
          setAssets(liveAssets);
          setSelectedAsset(liveAssets[0]);
          return;
        }
      } catch (err) {
        console.error("Failed to fetch live assets from API, falling back to seeded data:", err);
      }

      // Fallback: sync status of seeded assets on-chain
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
                  status: (syncInfo.status === 'Settled' ? 'Settled' : 'Pending') as 'Settled' | 'Pending',
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
                status: (syncInfo.status === 'Settled' ? 'Settled' : 'Pending') as 'Settled' | 'Pending',
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
    fetchLiveAssets();

    // Check URL query parameters for pre-filled view key (Deep Link sharing)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      const tabParam = params.get('tab');
      if (tabParam === 'overview' || tabParam === 'keys' || tabParam === 'decrypt') {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  useEffect(() => {
    if (!hasCheckedConnection) {
      return;
    }

    if (!walletAddress) {
      window.location.href = '/login';
    }
  }, [hasCheckedConnection, walletAddress]);

  const handleConnectWallet = async () => {
    setSettleError('');
    const addr = await connectWallet();
    if (addr) {
      const hasOnboarded = localStorage.getItem('lantern_onboarded');
      if (!hasOnboarded) {
        setShowOnboardModal(true);
      }
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
    } catch (err) {
      console.error("Failed to generate keys:", err);
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  // Settle asset handler (with Freighter Wallet signing)
  const handleSettle = async () => {
    if (!selectedAsset) return;
    if (!hasCheckedConnection) return;
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
    const currentPublicKey = pubViewKey;

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
      const encryptRes = await authedFetch('/api/encrypt', {
        method: 'POST',
        body: JSON.stringify({
          amount: currentAmount,
          auditorPublicKey: currentPublicKey
        })
      }, walletAddress ?? undefined);
      const encryptedData = await encryptRes.json();

      if (encryptedData.error) {
        throw new Error(encryptedData.error);
      }

      addTelemetryLog(`[ZK-ECIES] Encryption complete. Ephemeral Key: ${encryptedData.ephemeralPublicKeyHex.substring(0, 16)}...`);
      addTelemetryLog(`[ZK-ECIES] Ciphertext: ${encryptedData.ciphertextHex.substring(0, 16)}...`);

      addTelemetryLog('[ZK-PROOF] Witness constraints matching... Proving amount matches policy on-chain...');

      const prepareRes = await authedFetch('/api/settle', {
        method: 'POST',
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
      }, walletAddress ?? undefined);
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
        networkPassphrase: NETWORK_PASSPHRASE
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
        const horizonRes = await fetch(`${HORIZON_URL}/transactions`, {
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
        const submitRes = await authedFetch('/api/settle', {
          method: 'POST',
          body: JSON.stringify({ signedXdr })
        }, walletAddress ?? undefined);
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
    if (!hasCheckedConnection) return;
    if (!walletAddress) {
      setSettleError("Please connect your Freighter wallet to authorize redemption.");
      return;
    }

    setIsSettling(true);
    setSettleError('');
    addTelemetryLog(`[INIT] Requesting maturity redemption for settled RWA #${selectedAsset.id} (${selectedAsset.name})...`);
    addTelemetryLog('[WALLET] Requesting unsigned transaction to execute redemption...');

    try {
      // Phase 1: Prepare unsigned transaction via backend API
      const prepRes = await authedFetch('/api/redeem/prepare', {
        method: 'POST',
        body: JSON.stringify({ assetId: selectedAsset.id, sourceAddress: walletAddress }),
      }, walletAddress ?? undefined);

      const prepData = await prepRes.json();
      if (!prepRes.ok || prepData.error) {
        throw new Error(prepData.error || prepData.details || 'Failed to prepare transaction.');
      }

      addTelemetryLog('[WALLET] Transaction built successfully. Requesting Freighter signature...');

      // Phase 2: Sign transaction via Freighter
      const signedTxResult = await signTransaction(prepData.unsignedXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedXdr = typeof signedTxResult === 'string'
        ? signedTxResult
        : (signedTxResult as any)?.signedTxXdr;

      if (!signedXdr) {
        throw new Error('Failed to sign transaction or signature was rejected.');
      }

      addTelemetryLog('[HORIZON] Submitting signed redemption to Horizon testnet...');

      // Submit transaction directly from browser to Horizon
      const submitRes = await fetch(`${HORIZON_URL}/transactions`, {
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
      addTelemetryLog(`[LEDGER] Redemption transaction confirmed on-chain! Hash: ${txHash}`);
      addTelemetryLog(`[SYSTEM] Asset RWA #${selectedAsset.id} state updated to REDEEMED. Lifecycle closed.`);

      setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { ...a, status: 'Redeemed', txHash } : a));
      setSelectedAsset(prev => prev ? { ...prev, status: 'Redeemed', txHash } : null);
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

    const assetId = Math.floor(Math.random() * 100000) + 1000;

    addTelemetryLog(`[INIT] Tokenizing new Real World Asset: ${newName} (Par: $${newFaceValue} USD)...`);

    try {
      // Phase 1: Build unsigned mint XDR
      const response = await authedFetch('/api/mint', {
        method: 'POST',
        body: JSON.stringify({
          id: assetId,
          faceValue: Number(newFaceValue),
          assetClass: ASSET_CLASS_MAP[newAssetClass] || 'TreasuryBill',
          issuer: walletAddress,
          sourceAddress: walletAddress
        }),
      }, walletAddress ?? undefined);

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || data.details || 'On-chain minting failed.');
      }

      addTelemetryLog('[WALLET] Unsigned transaction prepared. Requesting Freighter signature...');

      // Phase 2: Sign via Freighter
      const signedTxResult = await signTransaction(data.unsignedXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedXdr = typeof signedTxResult === 'string'
        ? signedTxResult
        : (signedTxResult as any)?.signedTxXdr;

      if (!signedXdr) {
        throw new Error('Failed to sign transaction or signature was rejected.');
      }

      // Submit to Horizon
      const submitRes = await fetch(`${HORIZON_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tx: signedXdr }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok || submitData.error) {
        throw new Error(submitData.detail || submitData.title || 'Horizon transaction submission failed');
      }

      const txHash = submitData.hash;
      addTelemetryLog(`[LEDGER] RWA Token successfully minted on-chain! Tx: ${txHash}`);

      const newAsset: RwaAsset = {
        id: assetId,
        name: newName,
        faceValue: Number(newFaceValue),
        status: 'Pending',
        txHash
      };

      setAssets(prev => [...prev, newAsset]);
      setSelectedAsset(newAsset);

      setNewName('');
      setNewFaceValue('');
      setActiveTab('overview');
    } catch (err: any) {
      console.error("Minting error:", err);
      addTelemetryLog(`[ERROR] Tokenization failed: ${err.message || err}`);
      setSettleError(err.message || "Tokenization failed.");
    } finally {
      setIsMinting(false);
    }
  };

  const resolveEventPayload = async (txHash: string): Promise<{ payload: EncryptedPayload; eventType: string } | null> => {
    const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

    const horizonRes = await fetch(`${HORIZON_URL}/transactions/${txHash}`);
    if (!horizonRes.ok) return null;
    const txInfo = await horizonRes.json();
    const ledger = txInfo.ledger;
    if (!ledger) return null;

    const rpcRes = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getEvents',
        params: {
          startLedger: ledger,
          filters: [{ type: 'contract', contractIds: [SETTLEMENT_CONTRACT_ID] }]
        }
      })
    });
    if (!rpcRes.ok) return null;
    const rpcData = await rpcRes.json();
    const events = rpcData.result?.events || [];
    const targetEvent = events.find((ev: any) => ev.txHash === txHash);
    if (!targetEvent) return null;

    const valueXdr = targetEvent.value;
    const segments = await extractEventSegments(valueXdr);
    if (!segments || segments.length < 4) return null;

    return {
      payload: {
        ephemeralPublicKeyHex: segments[0],
        ivHex: segments[1],
        tagHex: segments[2],
        ciphertextHex: segments[3]
      },
      eventType: targetEvent.type || ''
    };
  };

  function extractEventSegments(valueB64: string): Promise<string[]> {
    return Promise.resolve(() => {
      const buf = new Uint8Array(
        atob(valueB64).split('').map(c => c.charCodeAt(0))
      );
      const results: string[] = [];
      let offset = 0;
      if (buf[offset] === 0x0c) {
        offset++;
        const vecLen = (buf[offset++] << 8) | buf[offset++];
        for (let i = 0; i < vecLen && offset < buf.length; i++) {
          if (buf[offset] === 0x0a || buf[offset] === 0x0b) {
            offset++;
            const bLen = (buf[offset++] << 8) | buf[offset++];
            results.push(
              Array.from(buf.slice(offset, offset + bLen))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
            );
            offset += bLen;
          } else break;
        }
      }
      return results;
    })();
  }

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
      const eventResult = await resolveEventPayload(decTxHash);
      if (!eventResult) {
        throw new Error('No settlement event found for this transaction hash.');
      }

      const decrypted = await decryptSettlementClient(eventResult.payload, decPrivKey);
      setDecryptedAmount(decrypted);
      setDecryptedPayload(eventResult.payload);
      setDecryptedSuccess(true);
    } catch (err: any) {
      setDecryptError(err.message || 'Decryption failed. Ensure the key matches the transaction.');
      setDecryptedSuccess(false);
    } finally {
      setIsDecrypting(false);
    }
  };

  // Guard render until wallet connection check completes — prevents /login flash
  if (!hasCheckedConnection) {
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
                value={typeof window !== 'undefined' ? window.location.origin + "/inspector?pubKey=" + pubViewKey : "http://localhost:3000/inspector?pubKey=" + pubViewKey}
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
              setSessionToken(null);
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
                  onClick={handleConnectWallet}
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
                  onClick={handleConnectWallet}
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
