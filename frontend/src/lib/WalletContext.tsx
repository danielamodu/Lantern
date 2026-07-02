'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isConnected, requestAccess, isAvailable } from '@stellar/freighter-api';

interface WalletState {
  address: string | null;
  isInstalled: boolean | null;
  isConnecting: boolean;
  isCheckingConnection: boolean;
  hasCheckedConnection: boolean;
  isConnected: boolean;
  connect: () => Promise<string | null>;
  refreshConnection: () => Promise<string | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null,
  isInstalled: null,
  isConnecting: false,
  isCheckingConnection: false,
  hasCheckedConnection: false,
  isConnected: false,
  connect: async () => null,
  refreshConnection: async () => null,
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [hasCheckedConnection, setHasCheckedConnection] = useState(false);

  const applyWalletAddress = useCallback((nextAddress: string | null) => {
    setAddress(nextAddress);

    if (typeof window === 'undefined') {
      return;
    }

    if (nextAddress) {
      sessionStorage.setItem('lantern_wallet_address', nextAddress);
      return;
    }

    sessionStorage.removeItem('lantern_wallet_address');
  }, []);

  const syncWalletConnection = useCallback(async (allowPrompt = false): Promise<string | null> => {
    setIsCheckingConnection(true);

    try {
      const avail = await isAvailable();
      setIsInstalled(!!avail);

      const status = await isConnected();
      const connected = !!status.isConnected;

      if (!connected) {
        if (allowPrompt) {
          const access = await requestAccess();
          if (!access.error && access.address) {
            applyWalletAddress(access.address);
            setIsInstalled(true);
            return access.address;
          }
        }

        applyWalletAddress(null);
        return null;
      }

      if (typeof window !== 'undefined') {
        const cachedAddress = sessionStorage.getItem('lantern_wallet_address');
        if (cachedAddress) {
          applyWalletAddress(cachedAddress);
          return cachedAddress;
        }
      }

      if (allowPrompt) {
        const access = await requestAccess();
        if (!access.error && access.address) {
          applyWalletAddress(access.address);
          setIsInstalled(true);
          return access.address;
        }
      }

      return null;
    } catch {
      setIsInstalled(false);
      applyWalletAddress(null);
      return null;
    } finally {
      setHasCheckedConnection(true);
      setIsCheckingConnection(false);
    }
  }, [applyWalletAddress]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await syncWalletConnection(false);
      } catch {
        if (!cancelled) setIsInstalled(false);
        if (!cancelled) {
          applyWalletAddress(null);
          setHasCheckedConnection(true);
          setIsCheckingConnection(false);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [applyWalletAddress, syncWalletConnection]);

  const connect = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true);
    try {
      const addr = await syncWalletConnection(true);
      if (!addr) {
        setIsInstalled(false);
      }

      if (addr) {
        // Account exists and is connected
      }

      return addr;
    } catch (err) {
      console.error('[Wallet] Connection error:', err);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [syncWalletConnection]);

  const refreshConnection = useCallback(async (): Promise<string | null> => {
    return syncWalletConnection(false);
  }, [syncWalletConnection]);

  const disconnect = useCallback(() => {
    setAddress(null);
    sessionStorage.removeItem('lantern_wallet_address');
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isInstalled,
        isConnecting,
        isCheckingConnection,
        hasCheckedConnection,
        isConnected: !!address,
        connect,
        refreshConnection,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
