'use client';

import { useState, useEffect } from 'react';
import MiniFooter from '@/components/MiniFooter';
import Link from 'next/link';
import { 
  Eye, 
  EyeOff, 
  Key, 
  Layers, 
  Terminal, 
  HelpCircle, 
  CheckCircle2, 
  Unlock, 
  Search,
  Menu,
  X,
  Home,
  LogOut,
  Cpu,
  Wallet
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { CiphertextReveal } from '../app/CiphertextReveal';

interface InspectorTx {
  txHash: string;
  assetId: number;
  assetName: string;
  faceValue: number;
  actualAmount: number;
  commitment: string;
  ephemeralKey: string;
  iv: string;
  tag: string;
  ciphertext: string;
  ledger: number;
}

const INITIAL_TXS: InspectorTx[] = [
  {
    txHash: '0x1de199e847c23bd32832049d5621b0a5a22e42ca09709f6d5216e84db9f39afb5',
    assetId: 801,
    assetName: 'US Treasury Bill #801',
    faceValue: 1000,
    actualAmount: 1000,
    commitment: '0x572516bc4e0bbaf9d5621b0a5a122e42ca09709f6d5216e84db9f39afb5fa532',
    ephemeralKey: '04a9e99c15814523d4e8992ca2516fa8a89ef239bd0102b489d81d2f9d8a9f2bc8a9b2b29188eef2f2ea8283a219bc29adbc09033333333333333333333333',
    iv: 'a8e99bc2d01a918a',
    tag: 'c891efbc9e823a8e9fa2818a1a9eef28',
    ciphertext: 'fa3a9188b2b9',
    ledger: 489912
  },
  {
    txHash: '0x5f2f98e847c92ad32e892c2ca8aef239bd0102b489d81d2f9d8a9f2bc8a9b2b2',
    assetId: 802,
    assetName: 'Real Estate Fund #802',
    faceValue: 1000,
    actualAmount: 1000,
    commitment: '0x2ea8283a219bc29adbc09038a89ef239bd0102b489d81d2f9d8a9f2bc8a9b2b2',
    ephemeralKey: '041a9ebc9e823a8e9fa2818a1a9eef28eef2f2ea8283a219bc29adbc090333333a8e99bc2d01a918aeef2f2ea8283a219bc29adbc09033333333333333333333',
    iv: '9e823a8e9fa2',
    tag: 'fa3a9188b2b9a8e99bc2d01a918aeef2',
    ciphertext: 'c891efbc9e82',
    ledger: 489914
  },
  {
    txHash: '0x8a92f02ca89709f6d5216e84db9f39afb5fa53272516bc4e0bbaf9d5621b0a5a',
    assetId: 803,
    assetName: 'Corporate Bond #803',
    faceValue: 1000,
    actualAmount: 1000,
    commitment: '0x8a9eef28eef2f2ea8283a219bc29adbc09038a89ef239bd0102b489d81d2f9d8',
    ephemeralKey: '043333333333333333333333a8e99bc2d01a918aeef2f2ea8283a219bc29adbc090333333a8e99bc2d01a918aeef2f2ea8283a219bc29adbc09033333333333333',
    iv: 'ea8283a219bc',
    tag: '9e823a8e9fa2fa3a9188b2b9a8e99bc2',
    ciphertext: '8a89ef239bd0',
    ledger: 489917
  }
];

export default function LedgerInspector() {
  const [txs, setTxs] = useState<InspectorTx[]>(INITIAL_TXS);
  const [viewKey, setViewKey] = useState('');
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptionError, setDecryptionError] = useState('');
  const [selectedTx, setSelectedTx] = useState<InspectorTx | null>(INITIAL_TXS[0]);

  // Mobile menu header toggles
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check wallet connection from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAddress = sessionStorage.getItem('lantern_wallet_address');
      if (!savedAddress) {
        window.location.href = '/login';
      } else {
        setWalletAddress(savedAddress);
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Check URL query parameters for pre-filled view key (Deep Link sharing)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const keyParam = params.get('viewKey') || params.get('key');
      if (keyParam) {
        setViewKey(keyParam);
        // Automatically activate decryption if a key is passed
        setIsDecrypted(true);
      }
    }
  }, []);

  const handleDecryptToggle = () => {
    if (isDecrypted) {
      setIsDecrypted(false);
      setDecryptionError('');
    } else {
      if (!viewKey.trim()) {
        setDecryptionError('Please enter an Auditor Private View Key to decrypt.');
        return;
      }
      // Simple simulation verification: check if key format looks like a view key (hex)
      if (viewKey.length < 10) {
        setDecryptionError('Invalid Private View Key size. Must be a valid Private Key.');
        return;
      }
      setIsDecrypted(true);
      setDecryptionError('');
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
      <div className="flex-1 flex overflow-hidden">
      
      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className="w-64 h-full bg-[#1A1A1A] border-r border-[#3A3A3A] text-[#F2F2F0] flex flex-col justify-between p-6">
        <div>
          {/* Brand Logo Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-5 h-5 rotate-45 border border-[#F2F2F0] flex items-center justify-center bg-transparent">
              <div className="w-1.5 h-1.5 bg-[#F2F2F0]"></div>
            </div>
            <span className="text-sm font-bold tracking-tight text-[#F2F2F0] uppercase">
              Lantern
            </span>
          </div>

          <nav className="space-y-1">
            <Link
              href="/app?tab=overview"
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all text-[#8A8A8A] hover:bg-[#3A3A3A]/50 hover:text-[#F2F2F0]"
            >
              <Home className="w-4 h-4 text-[#8A8A8A]" />
              OVERVIEW CONSOLE
            </Link>

            <Link
              href="/app?tab=keys"
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all text-[#8A8A8A] hover:bg-[#3A3A3A]/50 hover:text-[#F2F2F0]"
            >
              <Key className="w-4 h-4 text-[#8A8A8A]" />
              AUDITOR VIEW KEYS
            </Link>

            <Link
              href="/app?tab=decrypt"
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all text-[#8A8A8A] hover:bg-[#3A3A3A]/50 hover:text-[#F2F2F0]"
            >
              <Eye className="w-4 h-4 text-[#8A8A8A]" />
              DECRYPTION VAULT
            </Link>

            <div className="pt-4 border-t border-[#3A3A3A] mt-4 space-y-1">
              <span className="block text-[8px] text-[#8A8A8A] font-mono px-4 pb-1.5 uppercase tracking-wider font-bold">Tools</span>

              <Link
                href="/inspector"
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all bg-[#3A3A3A] text-[#F2F2F0]"
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
            <Layers className="w-4 h-4 text-[#F2F2F0]" />
            <span className="font-bold text-[#F2F2F0] uppercase tracking-wider">On-Chain Ledger Inspector</span>
          </div>
          
          <div className="flex items-center gap-4">
            {walletAddress && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#3A3A3A] px-2.5 py-1.5 text-[#F2F2F0] text-[10px] font-semibold font-mono">
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
            )}
            <div className="flex items-center gap-1.5 bg-[#0A0A0A] border border-[#3A3A3A] px-2.5 py-1 text-[#F2F2F0] font-bold">
              <span>AUDITOR INSPECTION CONSOLE</span>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-8 md:p-12 space-y-8 flex-1">
        
        {/* Title Banner */}
        <div className="border-b border-[#3A3A3A] pb-6 mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[9px] text-[#8A8A8A] uppercase tracking-[0.2em] font-bold">
              <Layers className="w-3.5 h-3.5" />
              <span>Soroban Event Parser</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold uppercase text-[#F2F2F0] tracking-tight mt-1">
              On-Chain Ledger Inspector
            </h1>
            <p className="text-xs text-[#8A8A8A] mt-2 max-w-xl leading-relaxed">
              Observe raw events emitted by the verifier contract. Compare public encrypted blocks with the decrypted compliant state using regulatory view keys.
            </p>
          </div>

          {/* Deep link indicator */}
          {isDecrypted && (
            <div className="bg-[#1A1A1A] border border-[#3A3A3A] px-3.5 py-2 text-[9px] text-[#F2F2F0] font-bold uppercase flex items-center gap-2 h-fit">
              <Unlock className="w-3.5 h-3.5 text-[#F2F2F0]" />
              <span>Auditor Session Active via View Key</span>
            </div>
          )}
        </div>

        {/* Decryption Controller Panel */}
        <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-6 mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
            <div className="space-y-2 flex-1 w-full">
              <label className="text-[9px] uppercase tracking-wider text-[#8A8A8A] font-bold flex items-center gap-1.5">
                <Key className="w-3 h-3" />
                Auditor Private View Key (Decryption Secret)
              </label>
              <input
                type="password"
                placeholder="Enter Private View Key to decrypt ciphertext logs (e.g. 0x81b0a5...)"
                value={viewKey}
                onChange={(e) => setViewKey(e.target.value)}
                disabled={isDecrypted}
                className="w-full bg-[#0A0A0A] border border-[#3A3A3A] p-3 text-xs text-[#F2F2F0] placeholder-[#8A8A8A]/50 focus:outline-none focus:border-[#8A8A8A] font-mono transition-all"
              />
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                onClick={handleDecryptToggle}
                className={`w-full md:w-48 py-6 text-xs font-bold uppercase tracking-wider cursor-pointer ${
                  isDecrypted 
                    ? 'bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0]' 
                    : 'bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A]'
                }`}
              >
                {isDecrypted ? (
                  <span className="flex items-center gap-1.5 justify-center"><EyeOff className="w-4 h-4" /> Lock Data</span>
                ) : (
                  <span className="flex items-center gap-1.5 justify-center"><Eye className="w-4 h-4" /> Decrypt Ledger</span>
                )}
              </Button>
            </div>
          </div>
          {decryptionError && (
            <p className="text-[10px] text-[#C41E1E] font-bold uppercase tracking-wide">{decryptionError}</p>
          )}
        </div>

        {/* Ledger Inspector Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Side: Ledger Events Table (Col 8) */}
          <div className="lg:col-span-8 bg-[#1A1A1A] border border-[#3A3A3A] p-6 space-y-4 overflow-x-auto">
            <div className="flex justify-between items-center border-b border-[#3A3A3A] pb-4">
              <h3 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">Verifier Event Feed</h3>
              <span className="text-[9px] text-[#8A8A8A] uppercase tracking-wider">Stellar Testnet Events</span>
            </div>

            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-[#3A3A3A] text-[9px] text-[#8A8A8A] uppercase font-bold">
                  <th className="py-2.5">Tx Hash</th>
                  <th>RWA Name</th>
                  <th>Ledger</th>
                  <th className="text-right">Settled Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]/40 text-xs">
                {txs.map((tx) => {
                  const isSelected = selectedTx?.txHash === tx.txHash;
                  return (
                    <tr 
                      key={tx.txHash}
                      onClick={() => setSelectedTx(tx)}
                      className={`hover:bg-[#0A0A0A]/40 cursor-pointer transition-all ${
                        isSelected ? 'bg-[#0A0A0A] font-bold' : ''
                      }`}
                    >
                      <td className="py-4 font-mono select-all text-[#8A8A8A]">
                        {tx.txHash.substring(0, 10)}...{tx.txHash.substring(tx.txHash.length - 8)}
                      </td>
                      <td className="font-bold text-[#F2F2F0]">{tx.assetName}</td>
                      <td className="font-mono text-[#8A8A8A]">{tx.ledger}</td>
                      <td className="text-right font-mono font-bold">
                        <CiphertextReveal 
                          value={`$${tx.actualAmount}`} 
                          isDecrypted={isDecrypted} 
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right Side: Event Details / ECIES payload (Col 4) */}
          <div className="lg:col-span-4 bg-[#1A1A1A] border border-[#3A3A3A] p-6 space-y-6">
            {selectedTx ? (
              <div className="space-y-4">
                <div className="border-b border-[#3A3A3A] pb-3">
                  <span className="text-[8px] text-[#8A8A8A] uppercase font-bold tracking-wider">Selected Payload</span>
                  <h4 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">{selectedTx.assetName}</h4>
                </div>

                <div className="space-y-3 text-[10px]">
                  
                  {/* Ledger */}
                  <div>
                    <label className="block text-[8px] text-[#8A8A8A] uppercase font-bold">Ledger Height</label>
                    <span className="font-mono text-[#F2F2F0]">{selectedTx.ledger}</span>
                  </div>

                  {/* Commitment */}
                  <div>
                    <label className="block text-[8px] text-[#8A8A8A] uppercase font-bold">Public Commitment</label>
                    <span className="font-mono break-all text-[#8A8A8A] block p-1.5 bg-[#0A0A0A] border border-[#3A3A3A] mt-1 select-all">{selectedTx.commitment}</span>
                  </div>

                  {/* ECIES Encrypted Envelope Details */}
                  <div className="space-y-2 pt-2 border-t border-[#3A3A3A]">
                    <span className="text-[8px] text-[#8A8A8A] uppercase font-bold tracking-widest block">ECIES Envelope Event Logs</span>
                    
                    {/* Ephemeral Key */}
                    <div>
                      <label className="block text-[8px] text-[#8A8A8A] uppercase">Ephemeral Pubkey</label>
                      <span className="font-mono break-all text-[#8A8A8A] block p-1 bg-[#0A0A0A] border border-[#3A3A3A]/40 mt-0.5 select-all">{selectedTx.ephemeralKey.substring(0, 36)}...</span>
                    </div>

                    {/* IV */}
                    <div>
                      <label className="block text-[8px] text-[#8A8A8A] uppercase">AES-GCM IV</label>
                      <span className="font-mono text-[#8A8A8A] block p-1 bg-[#0A0A0A] border border-[#3A3A3A]/40 mt-0.5 select-all">{selectedTx.iv}</span>
                    </div>

                    {/* Tag */}
                    <div>
                      <label className="block text-[8px] text-[#8A8A8A] uppercase">AES-GCM Tag</label>
                      <span className="font-mono text-[#8A8A8A] block p-1 bg-[#0A0A0A] border border-[#3A3A3A]/40 mt-0.5 select-all">{selectedTx.tag}</span>
                    </div>

                    {/* Ciphertext */}
                    <div>
                      <label className="block text-[8px] text-[#8A8A8A] uppercase">Encrypted Amount Payload</label>
                      <span className="font-mono text-[#8A8A8A] block p-1 bg-[#0A0A0A] border border-[#3A3A3A]/40 mt-0.5 select-all">{selectedTx.ciphertext}</span>
                    </div>

                  </div>

                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-center text-[#8A8A8A] opacity-40">
                <HelpCircle className="w-6 h-6 mr-2" />
                Select a transaction event log to inspect
              </div>
            )}
          </div>

        </div>

      </main>
      </div>
      </div>
      <MiniFooter />
    </div>
  );
}
