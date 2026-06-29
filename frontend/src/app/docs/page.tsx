'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import MiniFooter from '@/components/MiniFooter';

const sections = [
  {
    id: 'overview',
    title: 'Overview',
    content: [
      {
        heading: 'What is Lantern?',
        body: `Lantern is a zero-knowledge compliance engine built on Stellar's Soroban smart contract platform. It enables institutional-grade settlement of tokenized Real World Assets (RWAs) while preserving transaction privacy.

The core guarantee: regulators and counterparties can verify that a transaction's amount matches the asset's declared face value — without ever seeing the actual amount on-chain.`,
      },
      {
        heading: 'Who is it for?',
        body: `Lantern is designed for:
— Asset managers tokenizing bonds, equities, or real estate on Stellar
— Compliance officers who need audit trails without exposing private transaction data
— Smart contract developers building privacy-preserving DeFi on Soroban
— Institutions operating under AML/KYC frameworks that require auditable settlement`,
      },
    ],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    content: [
      {
        heading: 'System Components',
        body: `Lantern is composed of three primary components:

1. ZK Proof Engine — Client-side proof generation using elliptic curve pairing. The prover constructs a proof that amount == face_value without revealing either value on-chain.

2. Soroban Smart Contract — Deployed on Stellar's testnet. Receives the ZK proof and public inputs, verifies the proof on-chain, and emits a compliance event.

3. Compliance Dashboard — The frontend interface for asset managers to initiate settlements, monitor proof status, and export audit logs.`,
      },
      {
        heading: 'Data Flow',
        body: `Settlement flow from initiation to finality:

Step 1  →  Asset manager inputs private amount and face value in the dashboard
Step 2  →  Client-side ZK prover generates proof parameters (never leaves browser)
Step 3  →  Proof + public commitment hash submitted to Soroban contract
Step 4  →  Contract runs on-chain verification
Step 5  →  Compliance event emitted to Stellar ledger (publicly auditable)
Step 6  →  Settlement confirmed; audit log available for export`,
      },
    ],
  },
  {
    id: 'zk-proofs',
    title: 'ZK Proof Design',
    content: [
      {
        heading: 'Proof Construction',
        body: `Lantern uses a commitment-based ZK proof scheme. The prover commits to a value v using a Pedersen commitment C = v·G + r·H where G and H are independent curve generators and r is a blinding factor.

The verifier receives C, the public face value F, and a range proof π. The contract checks:
— π is a valid proof that C commits to F
— C is well-formed (no negative values, no overflow)
— The proof is fresh (replay protection via Stellar sequence number)`,
      },
      {
        heading: 'Security Assumptions',
        body: `The security of Lantern's proof system relies on:
— Discrete log hardness on the BLS12-381 curve
— Collision resistance of SHA-256 (used in public input hashing)
— Trusted setup not required (transparent setup)

Current deployment is on Stellar testnet. Production deployment pending formal audit.`,
      },
      {
        heading: 'Limitations',
        body: `Current limitations in v0.1:
— Proof generation is CPU-bound and takes 1-3 seconds on modern hardware
— Maximum asset face value: 10^12 (1 trillion base units)
— Single-asset proofs only; multi-asset batch proofs in roadmap
— No recursive proof composition yet`,
      },
    ],
  },
  {
    id: 'stellar',
    title: 'Stellar Integration',
    content: [
      {
        heading: 'Soroban Contract',
        body: `The Lantern compliance contract is deployed on Stellar Futurenet (Protocol 22+). Contract ID and ABI are available in the repository.

The contract exposes two entry points:
— verify_compliance(proof, commitment, face_value) → Result<bool, Error>
— get_audit_log(asset_id) → Vec<ComplianceEvent>

Calling verify_compliance with a valid proof emits a ComplianceVerified event that is permanently recorded on the Stellar ledger.`,
      },
      {
        heading: 'Wallet Integration',
        body: `Lantern uses Freighter wallet for transaction signing. All ZK proof data is generated client-side and never transmitted to any server. The only on-chain interaction is the final proof submission transaction signed by Freighter.

Supported wallets: Freighter (required), xBull (planned), Rabet (planned).`,
      },
    ],
  },
  {
    id: 'api',
    title: 'API Reference',
    content: [
      {
        heading: 'Key Generation',
        body: `GET /api/generate-keys

Generates a fresh keypair for proof parameter initialization.

Response:
{
  "publicKey": "G...",
  "privateKey": "S...",
  "network": "testnet"
}

Note: Keys are ephemeral and generated server-side for demo purposes only. Production systems must generate keys client-side.`,
      },
      {
        heading: 'Proof Verification (Local)',
        body: `POST /api/verify-proof

Request body:
{
  "commitment": "0x...",
  "faceValue": 1000000,
  "proof": "0x..."
}

Response:
{
  "valid": true,
  "verifiedAt": "2026-06-28T12:00:00Z",
  "publicInputHash": "0x..."
}

This endpoint runs verification off-chain for development/testing. On-chain verification via Soroban is the production path.`,
      },
    ],
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const current = sections.find(s => s.id === activeSection)!;

  return (
    <div className="bg-[#0A0A0A] text-[#F2F2F0] min-h-screen flex flex-col font-mono">

      {/* Header */}
      <header className="border-b border-[#1E1E1E] px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-md z-40">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-[#8A8A8A] hover:text-[#F2F2F0] transition-colors text-xs">
            <ArrowLeft className="w-3 h-3" />
            Back
          </Link>
          <div className="w-px h-4 bg-[#2A2A2A]" />
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rotate-45 border border-[#F2F2F0]/40 flex items-center justify-center">
              <div className="w-1 h-1 bg-[#F2F2F0]" />
            </div>
            <span className="text-[#F2F2F0] text-xs font-bold tracking-widest uppercase">Lantern</span>
            <span className="text-[#3A3A3A] text-xs">/</span>
            <span className="text-[#8A8A8A] text-xs">Docs</span>
          </div>
        </div>
        <div className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] border border-[#1E1E1E] px-2 py-1">
          v0.1 · Testnet
        </div>
      </header>

      <div className="flex flex-1 max-w-[1200px] mx-auto w-full px-6 md:px-12 py-12 gap-12">

        {/* Sidebar nav */}
        <aside className="w-48 shrink-0">
          <p className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] mb-4">Contents</p>
          <nav className="flex flex-col gap-0.5">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`text-left text-xs px-3 py-2 transition-all flex items-center gap-2 ${
                  activeSection === s.id
                    ? 'text-[#F2F2F0] bg-[#1A1A1A] border-l border-[#F2F2F0]'
                    : 'text-[#5A5A5A] hover:text-[#8A8A8A] border-l border-transparent'
                }`}
              >
                {activeSection === s.id && <ChevronRight className="w-2.5 h-2.5 shrink-0" />}
                {s.title}
              </button>
            ))}
          </nav>

          <div className="mt-10 pt-6 border-t border-[#1E1E1E]">
            <p className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] mb-3">Links</p>
            <div className="flex flex-col gap-2">
              <a href="https://stellar.org" target="_blank" rel="noreferrer" className="text-[10px] text-[#5A5A5A] hover:text-[#F2F2F0] transition-colors">Stellar.org →</a>
              <a href="https://soroban.stellar.org" target="_blank" rel="noreferrer" className="text-[10px] text-[#5A5A5A] hover:text-[#F2F2F0] transition-colors">Soroban →</a>
              <Link href="/terms" className="text-[10px] text-[#5A5A5A] hover:text-[#F2F2F0] transition-colors">Terms of Service</Link>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="mb-10">
            <div className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] mb-2">
              Documentation · {current.title}
            </div>
            <h1 className="text-2xl font-bold text-[#F2F2F0] tracking-tight">{current.title}</h1>
          </div>

          <div className="space-y-10">
            {current.content.map((block, i) => (
              <div key={i} className="border-l border-[#1E1E1E] pl-6">
                <h2 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-[0.15em] mb-4">
                  {block.heading}
                </h2>
                <div className="space-y-3">
                  {block.body.split('\n').map((line, j) => (
                    line.trim() === '' ? null : (
                      <p key={j} className={`text-xs leading-relaxed ${
                        line.startsWith('—') || line.match(/^Step \d/) || line.match(/^\d\./)
                          ? 'text-[#8A8A8A] pl-4'
                          : line.startsWith('{') || line.startsWith('"') || line.startsWith('GET') || line.startsWith('POST')
                          ? 'text-[#F2F2F0] bg-[#111111] border border-[#1E1E1E] px-3 py-2 font-mono text-[10px]'
                          : 'text-[#8A8A8A]'
                      }`}>
                        {line}
                      </p>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Section nav */}
          <div className="mt-16 pt-8 border-t border-[#1E1E1E] flex justify-between items-center">
            {sections.findIndex(s => s.id === activeSection) > 0 ? (
              <button
                onClick={() => setActiveSection(sections[sections.findIndex(s => s.id === activeSection) - 1].id)}
                className="flex items-center gap-2 text-xs text-[#8A8A8A] hover:text-[#F2F2F0] transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                {sections[sections.findIndex(s => s.id === activeSection) - 1].title}
              </button>
            ) : <div />}
            {sections.findIndex(s => s.id === activeSection) < sections.length - 1 && (
              <button
                onClick={() => setActiveSection(sections[sections.findIndex(s => s.id === activeSection) + 1].id)}
                className="flex items-center gap-2 text-xs text-[#8A8A8A] hover:text-[#F2F2F0] transition-colors"
              >
                {sections[sections.findIndex(s => s.id === activeSection) + 1].title}
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </main>
      </div>

      <MiniFooter />
    </div>
  );
}
