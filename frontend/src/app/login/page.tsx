'use client';

import { useState, useEffect } from 'react';
import { requestAccess, isConnected } from '@stellar/freighter-api';
import { Wallet, Sparkles, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [isFreighterInstalled, setIsFreighterInstalled] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
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

  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');
    try {
      const installed = await isConnected();
      if (!installed) {
        setIsFreighterInstalled(false);
        setIsConnecting(false);
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

      // Store in session storage to persist login state for the app dashboard
      sessionStorage.setItem('lantern_wallet_address', address);
      
      // Auto-fund testnet account for seamless developer testing
      fetch("https://friendbot.stellar.org/?addr=" + address).catch(() => {});

      // Redirect to target redirect URL parameter or default to /app dashboard
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTarget = urlParams.get('redirect') || '/app';
      window.location.href = redirectTarget;
    } catch (err: any) {
      console.error("Authentication error:", err);
      setError("Failed to connect Freighter wallet. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#0A0A0A] text-[#F2F2F0] font-mono flex flex-col justify-between p-6 md:p-12 relative overflow-hidden select-none">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="grid grid-cols-12 h-full w-full">
          {Array.from({ length: 144 }).map((_, i) => (
            <div key={i} className="border border-[#F2F2F0] h-32"></div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-3 text-xs text-[#8A8A8A] hover:text-[#F2F2F0] transition-colors font-bold uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" />
          BACK TO START
        </Link>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center z-10 my-12">
        <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 md:p-12 max-w-md w-full space-y-8 flex flex-col items-center relative">
          
          {/* Subtle Ambient Glowing Corners */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#8A8A8A]"></div>
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#8A8A8A]"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#8A8A8A]"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#8A8A8A]"></div>

          {/* Logo Brand Icon */}
          <div className="w-12 h-12 rotate-45 border border-[#F2F2F0] flex items-center justify-center bg-transparent animate-pulse">
            <div className="w-2.5 h-2.5 bg-[#F2F2F0]"></div>
          </div>

          {/* Title Text */}
          <div className="text-center space-y-2">
            <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-[#F2F2F0]">Lantern Registry Console</h1>
            <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider leading-relaxed">
              Secure Zero-Knowledge asset settlement & verification console
            </p>
          </div>

          <div className="w-full border-t border-[#3A3A3A] my-2"></div>

          {/* Prompt / Instructions */}
          <div className="text-center text-xs text-[#8A8A8A] leading-relaxed px-2">
            Authenticate with your Stellar address to unlock the registry, configure ZK compliance rules, and manage asset settlement events.
          </div>

          {/* Error Message */}
          {error && (
            <div className="w-full flex items-center gap-2 p-3.5 border border-[#C41E1E] text-[#C41E1E] text-xs bg-[#C41E1E]/5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="w-full space-y-4">
            {isFreighterInstalled === false ? (
              <div className="space-y-4">
                <Button 
                  asChild
                  className="w-full bg-[#C41E1E] hover:bg-[#A31818] text-[#F2F2F0] text-xs font-bold py-6 rounded-none cursor-pointer"
                >
                  <a href="https://www.freighter.app/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
                    <Wallet className="w-4 h-4" />
                    INSTALL FREIGHTER WALLET
                  </a>
                </Button>
                <p className="text-[9px] text-[#8A8A8A] text-center uppercase tracking-wider">
                  Freighter extension was not detected in this browser.
                </p>
              </div>
            ) : (
              <Button 
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-6 rounded-none cursor-pointer select-none transition-all duration-300 transform hover:scale-[1.01]"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#0A0A0A] mr-2" />
                    AUTHENTICATING...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    CONNECT FREIGHTER WALLET
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Footer Metadata */}
          <div className="flex items-center gap-1.5 text-[8px] text-[#8A8A8A] tracking-wider uppercase font-bold mt-2">
            <Sparkles className="w-3.5 h-3.5 text-[#8A8A8A]" />
            <span>STELLAR TESTNET GATEWAY</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[9px] text-[#8A8A8A] tracking-wider uppercase font-medium z-10">
        © {new Date().getFullYear()} LANTERN CRYPTOGRAPHIC PROTOCOLS. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
