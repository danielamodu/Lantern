'use client';

import { useState, useEffect } from 'react';
import MiniFooter from '@/components/MiniFooter';
import Link from 'next/link';
import { 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  ShieldCheck, 
  TrendingUp, 
  Lock,
  ArrowRight,
  Menu,
  X,
  Home,
  Key,
  Eye,
  LogOut,
  Layers,
  Wallet
} from 'lucide-react';
import { Button } from "@/components/ui/button";

interface ZkPolicy {
  id: string;
  name: string;
  description: string;
  formula: string;
  validate: (amount: number, faceValue: number) => boolean;
}

const POLICIES: ZkPolicy[] = [
  {
    id: 'exact',
    name: 'Exact Face Value',
    description: 'Verifies that the settlement amount matches the tokenized asset face value exactly.',
    formula: 'amount == face_value',
    validate: (amount, faceValue) => amount === faceValue
  },
  {
    id: 'yield',
    name: 'Matured Yield (5%)',
    description: 'Proves the amount corresponds to the tokenized asset face value plus 5% matured coupon interest.',
    formula: 'amount == face_value * 1.05',
    validate: (amount, faceValue) => Math.abs(amount - (faceValue * 1.05)) < 0.01
  },
  {
    id: 'cap',
    name: 'Allocation Cap (150%)',
    description: 'Proves that the trade amount does not exceed 150% of the single-buyer regulatory allocation limit.',
    formula: 'amount <= face_value * 1.50',
    validate: (amount, faceValue) => amount <= (faceValue * 1.5)
  }
];

interface MockAsset {
  id: number;
  name: string;
  faceValue: number;
}

const MOCK_ASSETS: MockAsset[] = [
  { id: 901, name: 'US Treasury Bill #901', faceValue: 1000 },
  { id: 902, name: 'Corporate Yield Bond #902', faceValue: 2000 },
  { id: 903, name: 'Stellar Carbon Trust #903', faceValue: 500 }
];

export default function ZkPlayground() {
  const [selectedAsset, setSelectedAsset] = useState<MockAsset>(MOCK_ASSETS[0]);
  const [selectedPolicy, setSelectedPolicy] = useState<ZkPolicy>(POLICIES[0]);
  const [settlementAmount, setSettlementAmount] = useState<number>(1000);
  
  // Simulation states
  const [isProving, setIsProving] = useState(false);
  const [provingLogs, setProvingLogs] = useState<string[]>([]);
  const [provingStatus, setProvingStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [zkProofHash, setZkProofHash] = useState('');
  const [publicInputs, setPublicInputs] = useState<string[]>([]);
  
   // Mobile header toggles
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Check if wallet connection exists to populate view layout elements
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAddress = sessionStorage.getItem('lantern_wallet_address');
      if (savedAddress) {
        setWalletAddress(savedAddress);
      }
    }
  }, []);

  // Keep settlement amount locked to asset face value when selected asset changes (for ease of matching)
  useEffect(() => {
    if (selectedPolicy.id === 'exact') {
      setSettlementAmount(selectedAsset.faceValue);
    } else if (selectedPolicy.id === 'yield') {
      setSettlementAmount(selectedAsset.faceValue * 1.05);
    } else {
      setSettlementAmount(selectedAsset.faceValue);
    }
    setProvingStatus('idle');
    setProvingLogs([]);
  }, [selectedAsset, selectedPolicy]);

  const handleProve = () => {
    setIsProving(true);
    setProvingStatus('idle');
    setProvingLogs([]);
    setZkProofHash('');
    setPublicInputs([]);

    const logs = [
      `1. Fetching parameters for circuit: settlement.r1cs...`,
      `2. Injecting private value inputs: amount = ${settlementAmount}, salt = 0x8a92f0...`,
      `3. Injecting public signal inputs: face_value = ${selectedAsset.faceValue}, policy = ${selectedPolicy.formula}...`,
      `4. Compiling witness files and calculating constraint matrices...`
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < logs.length) {
        setProvingLogs(prev => [...prev, logs[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        
        // Execute math verification
        const isVerified = selectedPolicy.validate(settlementAmount, selectedAsset.faceValue);
        
        setTimeout(() => {
          if (isVerified) {
            setProvingLogs(prev => [
              ...prev,
              `5. Formulating conceptual proof parameters...`,
              `6. Simulated off-chain proof generation finished.`,
              `7. Running verification logic locally...`,
              `✅ LOCAL VERIFIER: SUCCESS! (Constraint equations resolved successfully)`
            ]);
            setProvingStatus('success');
            setZkProofHash('SIMULATED_' + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join(''));
            setPublicInputs([
              `Concept Hash: ${Math.floor(Math.random()*1000000)}`,
              `Asset: ${selectedAsset.name}`,
              `Target Limit: ${selectedAsset.faceValue}`
            ]);
          } else {
            setProvingLogs(prev => [
              ...prev,
              `❌ LOCAL VERIFIER: REJECTED!`,
              `Reason: Mathematical constraint (proposed amount satisfying ${selectedPolicy.formula}) was violated.`,
              `Simulation failed: proof is structurally impossible to generate.`
            ]);
            setProvingStatus('failed');
          }
          setIsProving(false);
        }, 1200);
      }
    }, 450);
  };

  // Always allow viewing the educational visualizer without login
  const isLoaded = true;

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
                href="/playground"
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold transition-all bg-[#3A3A3A] text-[#F2F2F0]"
              >
                <Cpu className="w-4 h-4 text-[#8A8A8A]" />
                ZK VISUALIZER
              </Link>

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
            <Cpu className="w-4 h-4 text-[#F2F2F0]" />
            <span className="font-bold text-[#F2F2F0] uppercase tracking-wider">ZK Educational Visualizer</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-[#0A0A0A] border border-[#3A3A3A] px-2.5 py-1 text-[#F2F2F0] font-bold">
              <span>SIMULATION ENVIRONMENT</span>
            </div>
          </div>
        </header>

        {/* Disclaimer Banner */}
        <div className="bg-[#1A1105] border-b border-[#D97706]/30 px-8 py-3.5 flex items-start gap-3 text-xs text-[#F59E0B]">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold uppercase">Educational Visualizer</span> — Illustrates how Circom + Groth16 zero-knowledge proving conceptually works. This page is a teaching tool and is not connected to live testnet or real settlements.
          </div>
        </div>

        {/* Sandbox Workspace Container */}
        <main className="p-8 md:p-12 space-y-8 flex-1">
        
        {/* Title */}
        <div className="border-b border-[#3A3A3A] pb-6 mb-8">
          <div className="flex items-center gap-2 text-[9px] text-[#8A8A8A] uppercase tracking-[0.2em] font-bold">
            <Cpu className="w-3.5 h-3.5" />
            <span>Interactive Prover Concepts</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold uppercase text-[#F2F2F0] tracking-tight mt-1">
            Zero-Knowledge Verification Simulator
          </h1>
          <p className="text-xs text-[#8A8A8A] mt-2 max-w-2xl leading-relaxed">
            Interactively simulate compliance constraints. Propose trade values below to see how off-chain solvers mathematically assert that compliance policies are met, flagging violations immediately.
          </p>
        </div>

        {/* Content Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Parameters (Col 5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Step 1: Select RWA Asset */}
            <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#F2F2F0]">1. Select Asset</h3>
              <div className="space-y-2">
                {MOCK_ASSETS.map((asset) => {
                  const isSelected = selectedAsset.id === asset.id;
                  return (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`w-full flex items-center justify-between p-3 border text-left text-xs transition-all ${
                        isSelected 
                          ? 'border-[#F2F2F0] bg-[#0A0A0A]' 
                          : 'border-[#3A3A3A] hover:border-[#8A8A8A]'
                      }`}
                    >
                      <span className="font-bold">{asset.name}</span>
                      <span className="font-mono text-[#8A8A8A]">Face Value: ${asset.faceValue}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Choose Policy */}
            <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#F2F2F0]">2. Select Compliance Policy</h3>
              <div className="space-y-3">
                {POLICIES.map((policy) => {
                  const isSelected = selectedPolicy.id === policy.id;
                  return (
                    <button
                      key={policy.id}
                      onClick={() => setSelectedPolicy(policy)}
                      className={`w-full p-4 border text-left transition-all ${
                        isSelected 
                          ? 'border-[#F2F2F0] bg-[#0A0A0A]' 
                          : 'border-[#3A3A3A] hover:border-[#8A8A8A]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold uppercase text-[#F2F2F0]">{policy.name}</span>
                        <span className="font-mono text-[9px] bg-[#3A3A3A]/30 text-[#8A8A8A] px-1.5 py-0.5 border border-[#3A3A3A]">
                          {policy.formula}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8A8A8A] leading-relaxed">{policy.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Input Proposed Amount */}
            <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#F2F2F0]">3. Proposed Amount</h3>
                <span className="text-xs font-mono font-bold">${settlementAmount} USD</span>
              </div>
              
              <div className="space-y-4">
                <input 
                  type="range"
                  min={Math.floor(selectedAsset.faceValue * 0.5)}
                  max={Math.floor(selectedAsset.faceValue * 2)}
                  step={selectedPolicy.id === 'yield' ? 25 : 50}
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  className="w-full h-1 bg-[#3A3A3A] appearance-none cursor-pointer accent-[#F2F2F0]"
                />
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (selectedPolicy.id === 'exact') {
                        setSettlementAmount(selectedAsset.faceValue);
                      } else if (selectedPolicy.id === 'yield') {
                        setSettlementAmount(selectedAsset.faceValue * 1.05);
                      } else {
                        setSettlementAmount(selectedAsset.faceValue);
                      }
                    }}
                    className="flex-1 py-2 border border-[#3A3A3A] hover:border-[#8A8A8A] bg-transparent text-[10px] uppercase font-bold"
                  >
                    Set Compliant Amount
                  </button>
                  <button 
                    onClick={() => {
                      setSettlementAmount(selectedAsset.faceValue - 150);
                    }}
                    className="flex-1 py-2 border border-[#3A3A3A] hover:border-[#C41E1E] hover:text-[#C41E1E] bg-transparent text-[10px] uppercase font-bold"
                  >
                    Tamper Value
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={handleProve}
              disabled={isProving}
              className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-6 cursor-pointer uppercase tracking-wider animate-none rounded-none"
            >
              {isProving ? 'SIMULATING...' : 'RUN SIMULATED PROOF'}
            </Button>
          </div>

          {/* Right Column: Execution Console (Col 7) */}
          <div className="lg:col-span-7 bg-[#1A1A1A] border border-[#3A3A3A] p-6 space-y-6 min-h-[480px] flex flex-col justify-between">
            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center border-b border-[#3A3A3A] pb-4">
                <div>
                  <h3 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-wider">Concept Execution Console</h3>
                  <p className="text-[9px] text-[#8A8A8A] mt-0.5">Simulated off-chain prover timeline</p>
                </div>
                <div className="w-2.5 h-2.5 bg-[#8A8A8A] rounded-full"></div>
              </div>

              {/* Logs output */}
              <div className="bg-[#0A0A0A] border border-[#3A3A3A] p-4 font-mono text-[10px] h-[320px] overflow-y-auto space-y-2 leading-relaxed text-[#8A8A8A]">
                {provingLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-8">
                    <Lock className="w-8 h-8 mb-2" />
                    <p>Enter parameters on the left and click "RUN SIMULATED PROOF" to view the conceptual timeline</p>
                  </div>
                ) : (
                  provingLogs.map((log, index) => {
                    const logStr = String(log || '');
                    const isSuccess = logStr.includes('SUCCESS');
                    const isError = logStr.includes('error') || logStr.includes('❌');
                    return (
                      <div 
                        key={index} 
                        className={`py-0.5 ${
                          isSuccess ? 'text-[#F2F2F0] font-bold border-l-2 border-[#F2F2F0] pl-2 mt-2' : 
                          isError ? 'text-[#C41E1E] font-bold border-l-2 border-[#C41E1E] pl-2 mt-2' : 
                          ''
                        }`}
                      >
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Visual verification result display */}
            {provingStatus !== 'idle' && (
              <div className={`border p-4 mt-4 space-y-3 ${
                provingStatus === 'success' ? 'border-[#3A3A3A] bg-[#1A1A1A]' : 'border-[#C41E1E]/50 bg-[#C41E1E]/5'
              }`}>
                <div className="flex items-center gap-3">
                  {provingStatus === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#F2F2F0]" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#C41E1E]" />
                  )}
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${
                      provingStatus === 'success' ? 'text-[#F2F2F0]' : 'text-[#C41E1E]'
                    }`}>
                      {provingStatus === 'success' ? 'Simulated Verification Passed' : 'Simulation Rejected'}
                    </h4>
                    <p className="text-[9px] text-[#8A8A8A] mt-0.5">
                      {provingStatus === 'success' 
                        ? 'Simulated off-chain validation checked locally. Local rules resolved successfully.' 
                        : 'Constraint check failed. Simulated verifier equations rejected proposed parameters.'
                      }
                    </p>
                  </div>
                </div>

                {provingStatus === 'success' && zkProofHash && (
                  <div className="space-y-1.5 pt-2 border-t border-[#3A3A3A]">
                    <div className="grid grid-cols-4 text-[9px] text-[#8A8A8A]">
                      <span className="font-bold">SIMULATION HASH:</span>
                      <span className="col-span-3 font-mono break-all select-all text-[#F2F2F0]">{zkProofHash}</span>
                    </div>
                    <div className="grid grid-cols-4 text-[9px] text-[#8A8A8A]">
                      <span className="font-bold">CONCEPT SIGNALS:</span>
                      <div className="col-span-3 space-y-0.5 font-mono text-[#F2F2F0]">
                        {publicInputs.map((input, idx) => (
                          <div key={idx}>{input}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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
