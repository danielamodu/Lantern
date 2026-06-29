'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import MiniFooter from '@/components/MiniFooter';

const terms = [
  {
    id: '01',
    title: 'Acceptance of Terms',
    body: `By accessing or using the Lantern protocol interface ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.

The Service is provided by Lantern Protocol ("we", "us", or "our") as an experimental, open-source cryptographic tool. These terms are effective as of the date you first access the Service.`,
  },
  {
    id: '02',
    title: 'Nature of Service — Testnet Only',
    body: `Lantern is currently deployed exclusively on Stellar Testnet. All transactions, proofs, and assets processed through this Service are non-real and carry no monetary value.

Do not send real XLM or mainnet assets to any addresses or contracts associated with this Service. We accept no responsibility for any loss of real funds resulting from misuse of testnet infrastructure.

The Service is provided for demonstration, development, and research purposes only.`,
  },
  {
    id: '03',
    title: 'Cryptographic Disclaimers',
    body: `The zero-knowledge proof system used in Lantern has not been formally audited by an independent security firm. While we have implemented best-practice cryptographic primitives, the system may contain vulnerabilities.

You acknowledge that:
— Cryptographic systems can fail due to implementation errors, mathematical breakthroughs, or hardware vulnerabilities
— ZK proofs do not constitute legal evidence of compliance in any jurisdiction
— Proof verification outcomes should not be relied upon for financial or regulatory decision-making without independent verification

We make no warranty, express or implied, regarding the correctness, completeness, or fitness for purpose of the proof system.`,
  },
  {
    id: '04',
    title: 'Wallet & Key Management',
    body: `Lantern requires connection to a compatible Stellar wallet (e.g., Freighter). You are solely responsible for the security of your private keys and seed phrases.

We never have access to your private keys. All signing operations occur client-side within your wallet application. We cannot recover lost keys, reverse transactions, or restore access to locked wallets.

You are responsible for maintaining the security of any device on which you access this Service.`,
  },
  {
    id: '05',
    title: 'Prohibited Uses',
    body: `You agree not to use the Service to:
— Attempt to break, exploit, or reverse-engineer the cryptographic proof system for malicious purposes
— Submit fraudulent proof parameters or manipulate the verification system
— Interfere with or disrupt the Stellar network or Soroban infrastructure
— Use the Service for any unlawful purpose under applicable law
— Misrepresent the outputs of the Service as legally binding compliance evidence

Violation of these restrictions may result in suspension of access and reporting to relevant authorities.`,
  },
  {
    id: '06',
    title: 'Privacy & Data Collection',
    body: `Lantern is designed with a privacy-first architecture. Specifically:
— Private transaction amounts never leave your browser
— We do not store wallet addresses or transaction history on any central server
— ZK proof parameters are generated entirely client-side
— On-chain data (compliance events) is permanently public on the Stellar ledger

We may collect anonymised usage analytics to improve the Service. No personally identifiable information is collected or sold to third parties.

The email address provided via the "Stay Updated" form is used solely for product updates and may be unsubscribed at any time.`,
  },
  {
    id: '07',
    title: 'Limitation of Liability',
    body: `To the fullest extent permitted by applicable law, Lantern Protocol and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill.

Our total aggregate liability for any claims arising from your use of the Service shall not exceed USD $0, reflecting the non-commercial, testnet nature of the current deployment.

Some jurisdictions do not allow the exclusion of certain warranties or limitations of liability, so some of the above may not apply to you.`,
  },
  {
    id: '08',
    title: 'Open Source & Intellectual Property',
    body: `The Lantern protocol smart contracts and core cryptographic libraries are open-source software released under the MIT License. You are free to fork, modify, and deploy these components subject to the terms of that license.

The Lantern brand, logo, and UI design are proprietary. You may not use the Lantern name or visual identity to create derivative products without written permission.`,
  },
  {
    id: '09',
    title: 'Changes to Terms',
    body: `We reserve the right to update these Terms of Service at any time. Changes will be reflected by the "Last Updated" date below. Continued use of the Service following any changes constitutes acceptance of the revised terms.

We will make reasonable efforts to notify users of material changes via the product interface or the email list.`,
  },
  {
    id: '10',
    title: 'Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of England and Wales, without regard to its conflict of law provisions.

Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
  },
];

export default function TermsPage() {
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
            <span className="text-[#8A8A8A] text-xs">Terms of Service</span>
          </div>
        </div>
        <div className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] border border-[#1E1E1E] px-2 py-1">
          Last updated: Jun 2026
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-[#1E1E1E] px-6 md:px-12 py-14">
        <div className="max-w-[800px]">
          <div className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em] mb-4">Legal · Terms of Service</div>
          <h1 className="text-3xl font-bold text-[#F2F2F0] tracking-tight mb-4">Terms of Service</h1>
          <p className="text-xs text-[#8A8A8A] leading-relaxed max-w-xl">
            Please read these terms carefully before using the Lantern protocol interface. By connecting your wallet or accessing any part of this service, you agree to the following terms.
          </p>
        </div>
      </div>

      {/* Terms content */}
      <main className="flex-1 max-w-[800px] mx-auto w-full px-6 md:px-12 py-14">
        <div className="space-y-0">
          {terms.map((term, i) => (
            <div key={term.id} className="border-b border-[#1A1A1A] py-8 flex gap-8">
              {/* Number */}
              <div className="shrink-0 w-8">
                <span className="text-[9px] text-[#3A3A3A] font-bold tracking-widest">{term.id}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xs font-bold text-[#F2F2F0] uppercase tracking-[0.15em] mb-5">
                  {term.title}
                </h2>
                <div className="space-y-3">
                  {term.body.split('\n').map((line, j) => (
                    line.trim() === '' ? null : (
                      <p key={j} className={`text-xs leading-relaxed ${
                        line.startsWith('—')
                          ? 'text-[#8A8A8A] pl-4'
                          : 'text-[#6A6A6A]'
                      }`}>
                        {line}
                      </p>
                    )
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-14 pt-8 border-t border-[#1E1E1E] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-[10px] text-[#3A3A3A]">
            Questions? Reach out on{' '}
            <a href="https://discord.com/users/fortyxbt" target="_blank" rel="noreferrer" className="text-[#8A8A8A] hover:text-[#F2F2F0] transition-colors">
              Discord
            </a>
            {' '}or{' '}
            <a href="https://x.com/fortyxbt" target="_blank" rel="noreferrer" className="text-[#8A8A8A] hover:text-[#F2F2F0] transition-colors">
              X (Twitter)
            </a>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-[10px] text-[#5A5A5A] hover:text-[#F2F2F0] transition-colors">
              Documentation
            </Link>
            <Link href="/" className="text-[10px] text-[#5A5A5A] hover:text-[#F2F2F0] transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>

      <MiniFooter />
    </div>
  );
}
