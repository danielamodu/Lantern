'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { isConnected as freighterIsConnected } from '@stellar/freighter-api';
import { Wallet, Sparkles, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { isInstalled, isConnecting, connect, isConnected, hasCheckedConnection } = useWallet();
  const router = useRouter();
  const [isFreighterDetected, setIsFreighterDetected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const pollIntervalMs = 100;
    const maxWaitMs = 3000;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) {
        return;
      }

      try {
        const status = await freighterIsConnected();

        if (status.isConnected) {
          setIsFreighterDetected(true);
          return;
        }
      } catch {
        // Keep polling until timeout; the extension may still be initializing.
      }

      if (Date.now() - startedAt >= maxWaitMs) {
        setIsFreighterDetected(false);
        return;
      }

      timeoutId = setTimeout(poll, pollIntervalMs);
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasCheckedConnection) {
      return;
    }

    if (isConnected) {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTarget = urlParams.get('redirect') || '/app';
      router.replace(redirectTarget);
    }
  }, [hasCheckedConnection, isConnected, router]);

  const handleConnect = async () => {
    const addr = await connect();
    if (addr) {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTarget = urlParams.get('redirect') || '/app';
      router.replace(redirectTarget);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#0A0A0A] text-[#F2F2F0] font-mono flex flex-col justify-between p-6 md:p-12 relative overflow-hidden select-none">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="grid grid-cols-12 h-full w-full">
          {Array.from({ length: 144 }).map((_, i) => (
            <div key={i} className="border border-[#F2F2F0] h-32"></div>
          ))}
        </div>
      </div>

      <header className="flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-3 text-xs text-[#8A8A8A] hover:text-[#F2F2F0] transition-colors font-bold uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" />
          BACK TO START
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center z-10 my-12">
        <div className="bg-[#1A1A1A] border border-[#3A3A3A] p-8 md:p-12 max-w-md w-full space-y-8 flex flex-col items-center relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#8A8A8A]"></div>
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#8A8A8A]"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#8A8A8A]"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#8A8A8A]"></div>

          <div className="w-12 h-12 rotate-45 border border-[#F2F2F0] flex items-center justify-center bg-transparent animate-pulse">
            <div className="w-2.5 h-2.5 bg-[#F2F2F0]"></div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-[#F2F2F0]">Lantern Registry Console</h1>
            <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider leading-relaxed">
              Secure Zero-Knowledge asset settlement & verification console
            </p>
          </div>

          <div className="w-full border-t border-[#3A3A3A] my-2"></div>

          <div className="text-center text-xs text-[#8A8A8A] leading-relaxed px-2">
            Authenticate with your Stellar address to unlock the registry, configure ZK compliance rules, and manage asset settlement events.
          </div>

          <div className="w-full space-y-4">
            {isFreighterDetected === false ? (
              <div className="space-y-4">
                <Button 
                  onClick={() => window.open('https://www.freighter.app/', '_blank', 'noopener,noreferrer')}
                  className="w-full bg-[#C41E1E] hover:bg-[#A31818] text-[#F2F2F0] text-xs font-bold py-6 rounded-none cursor-pointer"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Wallet className="w-4 h-4" />
                    INSTALL FREIGHTER WALLET
                  </span>
                </Button>
                <p className="text-[9px] text-[#8A8A8A] text-center uppercase tracking-wider">
                  Freighter extension was not detected in this browser.
                </p>
              </div>
            ) : isFreighterDetected === null ? (
              <div className="space-y-4">
                <Button 
                  disabled
                  className="w-full bg-[#F2F2F0] hover:bg-[#8A8A8A] text-[#0A0A0A] text-xs font-bold py-6 rounded-none cursor-not-allowed select-none transition-all duration-300"
                >
                  <RefreshCw className="w-4 h-4 animate-spin text-[#0A0A0A] mr-2" />
                  DETECTING FREIGHTER...
                </Button>
                <p className="text-[9px] text-[#8A8A8A] text-center uppercase tracking-wider">
                  Checking for the Freighter extension...
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

          <div className="flex items-center gap-1.5 text-[8px] text-[#8A8A8A] tracking-wider uppercase font-bold mt-2">
            <Sparkles className="w-3.5 h-3.5 text-[#8A8A8A]" />
            <span>STELLAR TESTNET GATEWAY</span>
          </div>
        </div>
      </main>

      <footer className="text-center text-[9px] text-[#8A8A8A] tracking-wider uppercase font-medium z-10">
        © {new Date().getFullYear()} LANTERN CRYPTOGRAPHIC PROTOCOLS. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
