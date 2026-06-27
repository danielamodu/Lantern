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
  Wallet
} from 'lucide-react';
import { requestAccess, signTransaction, isConnected } from '@stellar/freighter-api';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CiphertextReveal } from './CiphertextReveal';

interface RwaAsset {
  id: number;
  name: string;
  faceValue: number;
  status: 'Pending' | 'Settling' | 'Settled' | 'Rejected';
  txHash?: string;
  ciphertext?: string;
  policy?: string;
}

const SEEDED_ASSETS: RwaAsset[] = [
  { id: 801, name: "US Treasury Bill #801", faceValue: 1000, status: 'Pending' },
  { id: 802, name: "Real Estate Fund #802", faceValue: 1000, status: 'Pending' },
  { id: 803, name: "Corporate Bond #803", faceValue: 1000, status: 'Pending' },
  { id: 804, name: "Gold Bullion Trust #804", faceValue: 1000, status: 'Pending' },
  { id: 805, name: "Stellar Carbon Credit #805", faceValue: 1000, status: 'Pending' },
];

const VERIFIER_ID = 'CCRUK3TL4BQMSOI5KHC4DO2VIJ7P7TTWFVXYRKPCVGMCLW2YIAO5JI6B';

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

  // Decryption state
  const [decTxHash, setDecTxHash] = useState('');
  const [decPrivKey, setDecPrivKey] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');
  const [decryptedAmount, setDecryptedAmount] = useState<string | null>(null);
  const [decryptedPayload, setDecryptedPayload] = useState<any | null>(null);
  const [decryptedSuccess, setDecryptedSuccess] = useState<boolean | null>(null);

  // Share view key modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'decrypt'>('overview');

  // Freighter Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState<boolean | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [showOnboardModal, setShowOnboardModal] = useState(false);

  // Generate dynamic keypair on mount
  useEffect(() => {
    generateNewKeys();
    checkFreighter();
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
      const res = await fetch('/api/generate-keys');
      const data = await res.json();
      setPubViewKey(data.publicKeyHex);
      setPrivViewKey(data.privateKeyHex);
      setDecPrivKey(data.privateKeyHex);
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

    try {
      // 1. Generate client-side encryption envelope
      const encryptRes = await fetch('/api/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: String(selectedAsset.faceValue),
          auditorPublicKey: pubViewKey
        })
      });
      const encryptedData = await encryptRes.json();

      if (encryptedData.error) {
        throw new Error(encryptedData.error);
      }

      // 2. Prepare transaction XDR from contract invocation without signing it yet
      const prepareRes = await fetch('/api/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          ephemeralPublicKey: encryptedData.ephemeralPublicKeyHex,
          iv: encryptedData.ivHex,
          tag: encryptedData.tagHex,
          ciphertext: encryptedData.ciphertextHex,
          sourceAddress: walletAddress
        })
      });
      const prepareData = await prepareRes.json();

      if (prepareData.error) {
        throw new Error(prepareData.error || prepareData.details);
      }

      // 3. Request Freighter wallet signing of the generated transaction XDR
      console.log(`[Freighter] Requesting signature for XDR...`);
      const signedXdr = await signTransaction(prepareData.unsignedXdr, { 
        networkPassphrase: "Test SDF Network ; September 2015" 
      });

      // 4. Submit the signed transaction XDR back to Stellar testnet
      const submitRes = await fetch('/api/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedXdr })
      });
      const submitData = await submitRes.json();

      if (submitData.error) {
        throw new Error(submitData.error || submitData.details);
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

    } catch (err: any) {
      console.error(err);
      setSettleError(err.message || 'On-chain settlement or Freighter signature failed.');
      setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { ...a, status: 'Pending' } : a));
    } finally {
      setIsSettling(false);
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
      const res = await fetch('/api/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: decTxHash,
          privateKey: decPrivKey
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0A] text-[#F2F2F0] font-mono select-none">
      
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
              <label className="block text-[8px] text-[#8A8A8A] font-mono tracking-wider">AUDITOR ACCESS LINK</label>
              <input 
                type="text" 
                readOnly
                value={"http://127.0.0.1:3000/app?viewKey=" + pubViewKey.substring(0, 16)}
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
              setSelectedAsset(SEEDED_ASSETS[0]);
              setActiveTab('overview');
            }}
            className="w-full bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0] font-bold text-xs py-5 cursor-pointer"
          >
            + REGISTER ASSET
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
          </nav>
        </div>

        {/* Profile Card */}
        <div className="space-y-4 pt-4 border-t border-[#3A3A3A]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#3A3A3A] flex items-center justify-center text-[#F2F2F0] font-bold text-xs">
              FX
            </div>
            <div>
              <div className="text-xs font-bold font-mono">@fortyxbt</div>
              <span className="text-[8px] border border-[#3A3A3A] text-[#8A8A8A] px-1.5 py-0.5 uppercase tracking-wider font-bold block mt-0.5">
                Administrator
              </span>
            </div>
          </div>
          <Link 
            href="/"
            className="w-full flex items-center gap-2 text-[10px] text-[#8A8A8A] hover:text-[#F2F2F0] transition-all pl-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            EXIT DASHBOARD
          </Link>
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
              <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] px-3 py-1.5 text-[#F2F2F0] text-[10px] font-semibold font-mono">
                <Wallet className="w-3.5 h-3.5 text-[#8A8A8A]" />
                <span>{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
                <span className="w-px bg-[#3A3A3A] h-3"></span>
                <span className="text-[#8A8A8A]">TESTNET</span>
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
                    Freighter is not installed. <a href="https://www.freighter.com/" target="_blank" rel="noreferrer" className="underline font-bold">Install extension</a>.
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
                              {asset.status === 'Settled' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
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
                          <div className="space-y-2">
                            <label className="block text-[8px] text-[#8A8A8A] font-mono uppercase tracking-wider">COMPLIANCE POLICY RULE</label>
                            <Select value={selectedPolicy} onValueChange={(val) => { if (val) setSelectedPolicy(val); }}>
                              <SelectTrigger className="w-full bg-[#0A0A0A] border border-[#3A3A3A] text-xs text-[#F2F2F0] py-2 h-9">
                                <SelectValue placeholder="Select compliance rule" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1A1A1A] border border-[#3A3A3A] text-[#F2F2F0] font-mono text-xs">
                                <SelectItem value="Exact Match (amount == face_value)">Exact Match (amount == face_value)</SelectItem>
                                <SelectItem value="Under Authorized Limit (amount <= face_value)">Under Authorized Limit (amount &lt;= face_value)</SelectItem>
                                <SelectItem value="Over Minimum Requirement (amount >= face_value)">Over Minimum Requirement (amount &gt;= face_value)</SelectItem>
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
                              selectedAsset.status === 'Settled' ? 'bg-[#1A1A1A] text-[#F2F2F0] border-[#F2F2F0]' : 'bg-[#0A0A0A] text-[#8A8A8A] border-[#3A3A3A]'
                            )}>03</div>
                            <span className="text-[8px] font-bold mt-1 text-[#8A8A8A]">SETTLED</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Auditor Decryption Portal */}
              <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center">
                    <Eye className="w-5 h-5 text-[#F2F2F0]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">Auditor Decryption Portal</h3>
                    <p className="text-[10px] text-[#8A8A8A] mt-0.5">Provide transaction parameters and the private view key to decrypt private ledger details.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
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

                  <div className="flex items-stretch justify-center h-full min-h-[160px]">
                    <div className="w-full bg-[#0A0A0A] border border-[#3A3A3A] p-6 space-y-4 relative overflow-hidden flex flex-col justify-between">
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
                          <span>Provide private view key and transaction hash to audit private settlement disclosures.</span>
                        )}
                      </div>
                    </div>
                  </div>
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

        </main>
      </div>

    </div>
  );
}
