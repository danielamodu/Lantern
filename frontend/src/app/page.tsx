'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  ShieldCheck, 
  KeyRound, 
  Eye, 
  ChevronDown, 
  HelpCircle, 
  Cpu, 
  Zap,
  Building,
  FolderLock
} from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "How does private settlement work on a public ledger like Stellar?",
    answer: "Lantern uses Zero-Knowledge (ZK) proofs. When you settle an asset, you generate a cryptographic proof off-chain stating that your transaction complies with the compliance policy (e.g., matching the face value) without revealing the actual amount. Only the proof is submitted and verified on-chain by the Stellar smart contract."
  },
  {
    question: "What is an Auditor View Key?",
    answer: "A View Key is an asymmetric cryptographic key pair based on ECIES (elliptic curve integrated encryption scheme). Before submitting the settlement transaction, the client encrypts the private amount under the Auditor's public View Key. This encrypted payload is attached to the ledger transaction. Only an auditor possessing the private View Key can decrypt and audit the amount."
  },
  {
    question: "How does this comply with regulatory AML/KYC requirements?",
    answer: "Unlike traditional mixer-based privacy tools, Lantern is built for compliance. Because it emits an encrypted ECIES payload matching the Auditor's view key, you maintain full regulatory auditability. This ensures that assets are private to the public, but selectively decodable for authorized compliance officers."
  },
  {
    question: "What compliance rules can be verified on-chain?",
    answer: "The on-chain verifier can validate different mathematical constraints. Common policies include exact face-value matching (validating that the payment matches the token's face value), under maximum investment limits, or over minimum threshold requirements."
  }
];

export default function LandingPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Playground state
  const [playAmount, setPlayAmount] = useState<number>(1000);
  const [playFaceValue, setPlayFaceValue] = useState<number>(1000);
  const [playLogs, setPlayLogs] = useState<string[]>(['System idle. Set values and verify.']);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSuccess, setPlaySuccess] = useState<boolean | null>(null);

  const runPlaygroundVerify = () => {
    setIsPlaying(true);
    setPlaySuccess(null);
    setPlayLogs([
      "1. Generating client-side ZK proof parameters...",
      `Amount: ████████████ (Hidden value: ${playAmount}) | Face Value: ${playFaceValue}`,
      "2. Building witness constraints..."
    ]);

    setTimeout(() => {
      setPlayLogs(prev => [...prev, "3. Running elliptic curve pairing calculations..."]);
      setTimeout(() => {
        const isMatch = playAmount === playFaceValue;
        setPlayLogs(prev => [...prev, isMatch 
          ? "✅ ZK Proof verification: SUCCESS (Amount matches Face Value)" 
          : "❌ ZK Proof verification: REJECTED (Amount mismatch detected)"
        ]);
        setPlaySuccess(isMatch);
        setIsPlaying(false);
      }, 1000);
    }, 1000);
  };

  return (
    <div className="bg-[#0A0A0A] text-[#F2F2F0] min-h-[100dvh] flex flex-col font-mono relative">
      {/* Sticky Header styled like Titan.com */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        isScrolled 
          ? 'bg-[#0A0A0A]/95 backdrop-blur-md border-[#3A3A3A] py-3' 
          : 'bg-[#0A0A0A]/0 border-transparent py-5'
      }`}>
        <div className="max-w-[1200px] mx-auto w-full px-6 md:px-12 flex justify-between items-center">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-70 transition-all">
            <div className="w-5 h-5 rotate-45 border border-[#F2F2F0] flex items-center justify-center bg-transparent">
              <div className="w-1.5 h-1.5 bg-[#F2F2F0]"></div>
            </div>
            <span className="text-sm font-bold tracking-tight text-[#F2F2F0] uppercase">
              Lantern
            </span>
          </Link>

          {/* Center Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.15em] text-[#8A8A8A]">
            <a href="#how-it-works" className="hover:text-[#F2F2F0] transition-colors">How it Works</a>
            <a href="#zk-sandbox" className="hover:text-[#F2F2F0] transition-colors">ZK Sandbox</a>
            <a href="#faq" className="hover:text-[#F2F2F0] transition-colors">FAQ</a>
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/app" className="text-[11px] uppercase tracking-[0.15em] text-[#8A8A8A] hover:text-[#F2F2F0] transition-colors">
              Log In
            </Link>
            <Link
              href="/app"
              className="bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0] text-[11px] px-5 py-2 transition-all uppercase tracking-[0.15em]"
            >
              Enter App
            </Link>
          </div>

          {/* Mobile Hamburger Menu Toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex flex-col justify-center items-center w-6 h-6 space-y-1 focus:outline-none"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-[#F2F2F0] transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
            <span className={`block w-5 h-0.5 bg-[#F2F2F0] transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block w-5 h-0.5 bg-[#F2F2F0] transition-transform duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-[#0A0A0A] pt-8 px-6 flex flex-col space-y-6 text-xs uppercase tracking-[0.15em] font-mono border-t border-[#3A3A3A] md:hidden">
          <a 
            href="#how-it-works" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[#8A8A8A] hover:text-[#F2F2F0] py-3 border-b border-[#1A1A1A]"
          >
            How it Works
          </a>
          <a 
            href="#zk-sandbox" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[#8A8A8A] hover:text-[#F2F2F0] py-3 border-b border-[#1A1A1A]"
          >
            ZK Sandbox
          </a>
          <a 
            href="#faq" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[#8A8A8A] hover:text-[#F2F2F0] py-3 border-b border-[#1A1A1A]"
          >
            FAQ
          </a>
          <Link 
            href="/app" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[#8A8A8A] hover:text-[#F2F2F0] py-3 border-b border-[#1A1A1A]"
          >
            Log In
          </Link>
          <Link
            href="/app"
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-full bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0] text-center py-3.5 mt-4"
          >
            Enter App
          </Link>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 md:px-12 pt-32 pb-16 flex flex-col justify-between">

      {/* Hero Headline Block */}
      <header className="text-center max-w-4xl mx-auto mb-28">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1A1A1A] border border-[#3A3A3A] text-[9px] uppercase tracking-[0.2em] font-medium text-[#8A8A8A] mb-6">
          Compliance Meets Cryptography
        </div>
        <h1 className="font-serif text-5xl md:text-[76px] leading-[1.08] font-medium tracking-tight text-[#F2F2F0] mb-6">
          Private settlement of tokenized RWAs on Stellar
        </h1>
        <p className="text-xs md:text-sm text-[#8A8A8A] max-w-2xl leading-relaxed mx-auto mb-10">
          Verify asset face-value compliance cryptographically on the public ledger without exposing private transaction amounts.
        </p>

        <Link
          href="/app"
          className="group inline-flex items-center gap-3 bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0] text-xs px-8 py-3.5 transition-all"
        >
          Launch Settlement Dashboard
          <div className="w-5 h-5 bg-[#3A3A3A] flex items-center justify-center transition-transform group-hover:translate-x-1 border border-[#3A3A3A]">
            <ArrowRight className="w-3 h-3 text-[#F2F2F0]" />
          </div>
        </Link>
      </header>

      {/* 3-Step Visual Sequence */}
      <section id="how-it-works" className="mb-32 scroll-mt-28">
        <div className="text-center mb-16">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#F2F2F0]">
            How Lantern Works
          </h2>
          <p className="text-xs text-[#8A8A8A] mt-2">Three steps to compliant, private token settlement</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {/* Step 1 */}
          <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 flex flex-col justify-between min-h-[220px]">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center text-[#F2F2F0]">
                <KeyRound className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-[#3A3A3A]">01</span>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[#F2F2F0] mb-2 uppercase">
                Settle Privately
              </h3>
              <p className="text-xs text-[#8A8A8A] leading-relaxed">
                Initiate asset settlement off-chain. The exact amount is hidden as ciphertext (e.g. ████████████).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 flex flex-col justify-between min-h-[220px]">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center text-[#F2F2F0]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-[#3A3A3A]">02</span>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[#F2F2F0] mb-2 uppercase">
                Verify On-Chain
              </h3>
              <p className="text-xs text-[#8A8A8A] leading-relaxed">
                Stellar smart contracts verify compliance proof against the token's original face-value.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 flex flex-col justify-between min-h-[220px]">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 bg-[#0A0A0A] border border-[#3A3A3A] flex items-center justify-center text-[#F2F2F0]">
                <Eye className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-[#3A3A3A]">03</span>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[#F2F2F0] mb-2 uppercase">
                Auditable Disclosure
              </h3>
              <p className="text-xs text-[#8A8A8A] leading-relaxed">
                Designated auditors holding the View Key can decrypt the ciphertext (████████████) for compliance checks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive ZK Playground Widget */}
      <section id="zk-sandbox" className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 md:p-12 mb-32 max-w-5xl mx-auto w-full scroll-mt-28">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
          <div className="md:col-span-5 flex flex-col justify-between space-y-6">
            <div>
              <span className="text-[9px] font-bold text-[#8A8A8A] tracking-wider uppercase bg-[#0A0A0A] border border-[#3A3A3A] px-2.5 py-1">Interactive Engine</span>
              <h2 className="text-lg font-bold text-[#F2F2F0] mt-4 uppercase">Try the ZK Verifier</h2>
              <p className="text-xs text-[#8A8A8A] mt-2 leading-relaxed">
                Adjust the private amount and the asset's face value. Test how the ZK Prover confirms compliance without revealing the inputs.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Private Amount</span>
                  <span className="text-[#8A8A8A]">${playAmount}</span>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="1500" 
                  step="100"
                  value={playAmount} 
                  onChange={(e) => setPlayAmount(Number(e.target.value))}
                  className="w-full accent-[#F2F2F0] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Target Face Value</span>
                  <span className="text-[#8A8A8A]">${playFaceValue}</span>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="1500" 
                  step="100"
                  value={playFaceValue} 
                  onChange={(e) => setPlayFaceValue(Number(e.target.value))}
                  className="w-full accent-[#F2F2F0] cursor-pointer"
                />
              </div>

              <button
                onClick={runPlaygroundVerify}
                disabled={isPlaying}
                className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-3 transition-all disabled:opacity-50"
              >
                {isPlaying ? 'Computing Proving Circuit...' : 'Compute & Verify ZK Proof'}
              </button>
            </div>
          </div>

          <div className="md:col-span-7">
            <div className="bg-[#0A0A0A] border border-[#3A3A3A] p-6 h-full min-h-[220px] flex flex-col justify-between text-[10px] text-[#F2F2F0]">
              <div className="space-y-1.5">
                <span className="text-[#8A8A8A] block mb-3 border-b border-[#3A3A3A] pb-1.5 uppercase tracking-wider text-[9px]">ZK Proof Logs</span>
                {playLogs.map((log, index) => (
                  <div key={index} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                ))}
              </div>

              {playSuccess !== null && (
                <div className={`mt-4 p-3 border text-xs font-bold ${
                  playSuccess 
                    ? 'bg-[#1A1A1A] border-[#3A3A3A] text-[#F2F2F0]' 
                    : 'bg-[#1A1A1A] border-[#C41E1E] text-[#C41E1E]'
                }`}>
                  {playSuccess 
                    ? '✅ COMPLIANT: ZK Verification returns TRUE.' 
                    : '❌ COMPLIANCE BREACH: ZK Verification returns FALSE.'
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Security Pillars Grid */}
      <section className="mb-32">
        <div className="text-center mb-16">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#F2F2F0]">
            Institutional Privacy Standards
          </h2>
          <p className="text-xs text-[#8A8A8A] mt-2">Built for enterprise asset issuers and compliance guidelines</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-6">
            <Building className="w-5 h-5 text-[#F2F2F0] mb-4" />
            <h4 className="text-xs font-bold text-[#F2F2F0] mb-1 uppercase">Asset Tokenization</h4>
            <p className="text-[10px] text-[#8A8A8A] leading-relaxed">
              Compatible with all Stellar-native tokenized real-world assets (RWAs).
            </p>
          </div>

          <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-6">
            <Cpu className="w-5 h-5 text-[#F2F2F0] mb-4" />
            <h4 className="text-xs font-bold text-[#F2F2F0] mb-1 uppercase">Fast Proving Time</h4>
            <p className="text-[10px] text-[#8A8A8A] leading-relaxed">
              Optimized BN254 pairing limits computation overhead for snappy execution.
            </p>
          </div>

          <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-6">
            <FolderLock className="w-5 h-5 text-[#F2F2F0] mb-4" />
            <h4 className="text-xs font-bold text-[#F2F2F0] mb-1 uppercase">Encrypted Audit Trail</h4>
            <p className="text-[10px] text-[#8A8A8A] leading-relaxed">
              Ensures plaintext values are visible only to View Key holders.
            </p>
          </div>

          <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-6">
            <Zap className="w-5 h-5 text-[#F2F2F0] mb-4" />
            <h4 className="text-xs font-bold text-[#F2F2F0] mb-1 uppercase">Low Ledger Footprint</h4>
            <p className="text-[10px] text-[#8A8A8A] leading-relaxed">
              Verifies compliance directly on-chain without storing private data.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="max-w-3xl mx-auto w-full mb-24 scroll-mt-28">
        <div className="text-center mb-16">
          <HelpCircle className="w-6 h-6 text-[#F2F2F0] mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#F2F2F0]">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-[#8A8A8A] mt-2">Everything you need to know about Lantern</p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div 
                key={index} 
                className="bg-[#1A1A1A] border border-[#3A3A3A] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left font-bold text-xs text-[#F2F2F0] focus:outline-none"
                >
                  <span>{faq.question}</span>
                  <ChevronDown className={`w-4 h-4 text-[#8A8A8A] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpen && (
                  <div className="px-6 pb-6 text-xs text-[#8A8A8A] leading-relaxed border-t border-[#3A3A3A] pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#3A3A3A] pt-8 mt-12 flex flex-col md:flex-row justify-between items-center text-[10px] text-[#8A8A8A] gap-4 max-w-[1200px] mx-auto w-full px-6 md:px-12 mb-8">
        <div>Lantern © 2026. Zero-Knowledge Compliance Engine.</div>
        <div>Built for Stellar Protocol 27.</div>
      </footer>
    </div>
  );
}
