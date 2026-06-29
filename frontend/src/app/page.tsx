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
  const [footerEmail, setFooterEmail] = useState('');
  const [footerEmailSent, setFooterEmailSent] = useState(false);

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

          <nav className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.15em] text-[#8A8A8A]">
            <a href="/#how-it-works" className="hover:text-[#F2F2F0] transition-colors">How it Works</a>
            <Link href="/playground" className="hover:text-[#F2F2F0] transition-colors">ZK Visualizer</Link>
            <Link href="/docs" className="hover:text-[#F2F2F0] transition-colors">Documentation</Link>
            <Link href="/terms" className="hover:text-[#F2F2F0] transition-colors">Terms of Service</Link>
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/login"
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
          <Link 
            href="/playground" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[#8A8A8A] hover:text-[#F2F2F0] py-3 border-b border-[#1A1A1A]"
          >
            ZK Visualizer
          </Link>
          <Link 
            href="/docs" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[#8A8A8A] hover:text-[#F2F2F0] py-3 border-b border-[#1A1A1A]"
          >
            Documentation
          </Link>
          <Link 
            href="/terms" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[#8A8A8A] hover:text-[#F2F2F0] py-3 border-b border-[#1A1A1A]"
          >
            Terms of Service
          </Link>
          <a 
            href="/#faq" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[#8A8A8A] hover:text-[#F2F2F0] py-3 border-b border-[#1A1A1A]"
          >
            FAQ
          </a>
          <Link
            href="/login"
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-full bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0] text-center py-3.5 mt-4"
          >
            Enter App
          </Link>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 md:px-12 pt-32 pb-16 flex flex-col">

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

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/app"
            className="group inline-flex items-center justify-center gap-3 bg-[#1A1A1A] hover:bg-[#3A3A3A] border border-[#3A3A3A] text-[#F2F2F0] text-xs px-8 py-3.5 transition-all"
          >
            Launch Settlement Dashboard
            <div className="w-5 h-5 bg-[#3A3A3A] flex items-center justify-center transition-transform group-hover:translate-x-1 border border-[#3A3A3A]">
              <ArrowRight className="w-3 h-3 text-[#F2F2F0]" />
            </div>
          </Link>
          <Link
            href="/playground"
            className="inline-flex items-center justify-center gap-2 border border-transparent hover:border-[#3A3A3A] text-[#8A8A8A] hover:text-[#F2F2F0] text-xs px-8 py-3.5 transition-all"
          >
            Curious how the ZK math works? Try the visualizer
          </Link>
        </div>
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
              <span className="text-[9px] font-bold text-[#8A8A8A] tracking-wider uppercase bg-[#0A0A0A] border border-[#3A3A3A] px-2.5 py-1">Conceptual Demo</span>
              <h2 className="text-lg font-bold text-[#F2F2F0] mt-4 uppercase">Try the ZK Visualizer</h2>
              <p className="text-xs text-[#8A8A8A] mt-2 leading-relaxed">
                Adjust simulated parameters below. Test how compliance verification mathematically operates to match rule statements, flagging discrepancies.
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
                {isPlaying ? 'Simulating Prover Calculations...' : 'Run Simulated Proof'}
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
                    ? '✅ SIMULATION COMPLIANT: Equations validated successfully.' 
                    : '❌ SIMULATION REJECTED: Constraint check equations returned mismatch.'}
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

      {/* ── MEGA FOOTER ── */}
      <footer className="relative overflow-hidden bg-[#0A0A0A] border-t border-[#1E1E1E] mt-0">

        {/* Subtle grid lines background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        {/* Top section — card + links + email */}
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-12 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">

            {/* LEFT — Branded Card */}
            <div className="md:col-span-4">
              <div
                className="relative rounded-2xl overflow-hidden h-64 flex flex-col justify-between p-6"
                style={{
                  background: 'linear-gradient(135deg, #0d1b35 0%, #050d1f 40%, #000510 70%, #0a0a18 100%)'
                }}
              >
                {/* Animated glow orb */}
                <div
                  className="absolute w-72 h-72 rounded-full opacity-30 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, #2563eb 0%, #1d4ed8 30%, transparent 70%)',
                    top: '-40px',
                    right: '-40px',
                    animation: 'orb-drift 8s ease-in-out infinite'
                  }}
                />
                <div
                  className="absolute w-40 h-40 rounded-full opacity-20 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
                    bottom: '20px',
                    left: '-20px',
                    animation: 'orb-drift 12s ease-in-out infinite reverse'
                  }}
                />

                {/* Light sweep */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.04) 50%, transparent 65%)',
                    animation: 'sweep 5s ease-in-out infinite'
                  }}
                />

                {/* Card content top */}
                <div className="relative z-10 flex items-center gap-2">
                  <div className="w-6 h-6 rotate-45 border border-[#F2F2F0]/60 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-[#F2F2F0]" />
                  </div>
                  <span className="text-[#F2F2F0] text-sm font-bold tracking-widest uppercase">Lantern</span>
                </div>

                {/* Card content bottom */}
                <div className="relative z-10">
                  <p className="text-white/90 text-sm font-medium leading-snug mb-4">
                    Private settlements,<br />cryptographically guaranteed.
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest">Stay in touch</span>
                    <div className="flex items-center gap-3">
                      {/* X / Twitter */}
                      <a href="https://x.com/fortyxbt" target="_blank" rel="noreferrer" className="text-white/40 hover:text-white/90 transition-colors duration-200">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                      {/* GitHub */}
                      <a href="https://github.com/danielamodu" target="_blank" rel="noreferrer" className="text-white/40 hover:text-white/90 transition-colors duration-200">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                      </a>
                      {/* Discord */}
                      <a href="https://discord.com/users/fortyxbt" target="_blank" rel="noreferrer" className="text-white/40 hover:text-white/90 transition-colors duration-200">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CENTRE — Links columns */}
            <div className="md:col-span-5 grid grid-cols-2 gap-8 pt-2">
              <div>
                <p className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] mb-4 font-semibold">Product</p>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Dashboard', href: '/app' },
                    { label: 'ZK Visualizer', href: '/playground' },
                    { label: 'Ledger Inspector', href: '/inspector' },
                    { label: 'How It Works', href: '/#how-it-works' },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href} className="text-[#8A8A8A] hover:text-[#F2F2F0] text-xs transition-colors duration-200">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] mb-4 font-semibold">Protocol</p>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Stellar Protocol 27', href: 'https://stellar.org', external: true },
                    { label: 'Soroban Smart Contracts', href: 'https://soroban.stellar.org', external: true },
                    { label: 'Docs', href: '/docs' },
                    { label: 'Terms of Service', href: '/terms' },
                  ].map(({ label, href, external }) => (
                    <li key={label}>
                      <a
                        href={href}
                        target={external ? '_blank' : undefined}
                        rel={external ? 'noreferrer' : undefined}
                        className="text-[#8A8A8A] hover:text-[#F2F2F0] text-xs transition-colors duration-200"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT — Email CTA */}
            <div className="md:col-span-3 pt-2">
              <p className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] mb-4 font-semibold">Stay Updated</p>
              <p className="text-[#8A8A8A] text-xs leading-relaxed mb-5">
                ZK moves fast.{' '}
                <span className="text-[#F2F2F0] font-medium">Get early access & protocol updates.</span>
              </p>
              {footerEmailSent ? (
                <div className="flex items-center gap-2 text-emerald-400 text-xs">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>You&apos;re on the list.</span>
                </div>
              ) : (
                <div className="flex border border-[#2A2A2A] overflow-hidden focus-within:border-[#4A4A4A] transition-colors duration-200">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={footerEmail}
                    onChange={(e) => setFooterEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && footerEmail.includes('@')) setFooterEmailSent(true); }}
                    className="flex-1 bg-[#111111] text-[#F2F2F0] text-[10px] px-3 py-2.5 outline-none placeholder-[#3A3A3A] font-mono tracking-wide"
                  />
                  <button
                    onClick={() => { if (footerEmail.includes('@')) setFooterEmailSent(true); }}
                    className="bg-[#F2F2F0] hover:bg-white text-[#0A0A0A] text-[9px] font-bold uppercase tracking-wider px-3 transition-colors duration-200 shrink-0"
                  >
                    Notify
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-12">
          <div className="h-px bg-gradient-to-r from-transparent via-[#2A2A2A] to-transparent" />
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-12 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <span className="text-[9px] text-[#4A4A4A] uppercase tracking-[0.2em]">
            © 2026 Lantern Protocol. All rights reserved.
          </span>
          <span className="text-[9px] text-[#4A4A4A] uppercase tracking-[0.2em]">
            Built for Stellar Protocol 27 · Testnet
          </span>
        </div>

        {/* Keyframe animations injected inline */}
        <style>{`
          @keyframes orb-drift {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(-12px, 16px) scale(1.05); }
            66% { transform: translate(10px, -10px) scale(0.97); }
          }
          @keyframes sweep {
            0% { transform: translateX(-100%); }
            60%, 100% { transform: translateX(100%); }
          }
        `}</style>
      </footer>
    </div>
  );
}
