'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
  const aliveRef = useRef(true);

  const safeSetState = useCallback(<T,>(setter: (val: T) => void, val: T) => {
    if (aliveRef.current) setter(val);
  }, []);

  const applyWalletAddress = useCallback((nextAddress: string | null) => {
    safeSetState(setAddress, nextAddress);

    if (typeof window === 'undefined') {
      return;
    }

    if (nextAddress) {
      sessionStorage.setItem('lantern_wallet_address', nextAddress);
      return;
    }

    sessionStorage.removeItem('lantern_wallet_address');
  }, [safeSetState]);

  const syncWalletConnection = useCallback(async (allowPrompt = false): Promise<string | null> => {
    safeSetState(setIsCheckingConnection, true);

    try {
      const avail = await isAvailable();
      if (!aliveRef.current) return null;
      safeSetState(setIsInstalled, !!avail);

      const status = await isConnected();
      if (!aliveRef.current) return null;
      const connected = !!status.isConnected;

      if (!connected) {
        if (allowPrompt) {
          const access = await requestAccess();
          if (!aliveRef.current) return null;
          if (!access.error && access.address) {
            applyWalletAddress(access.address);
            safeSetState(setIsInstalled, true);
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
        if (!aliveRef.current) return null;
        if (!access.error && access.address) {
          applyWalletAddress(access.address);
          safeSetState(setIsInstalled, true);
          return access.address;
        }
      }

      return null;
    } catch {
      if (!aliveRef.current) return null;
      safeSetState(setIsInstalled, false);
      applyWalletAddress(null);
      return null;
    } finally {
      if (aliveRef.current) {
        safeSetState(setHasCheckedConnection, true);
        safeSetState(setIsCheckingConnection, false);
      }
    }
  }, [applyWalletAddress, safeSetState]);

  useEffect(() => {
    aliveRef.current = true;

    (async () => {
      try {
        await syncWalletConnection(false);
      } catch {
        if (aliveRef.current) {
          safeSetState(setIsInstalled, false);
          applyWalletAddress(null);
          safeSetState(setHasCheckedConnection, true);
          safeSetState(setIsCheckingConnection, false);
        }
      }
    })();

    return () => { aliveRef.current = false; };
  }, [applyWalletAddress, safeSetState, syncWalletConnection]);

  const connect = useCallback(async (): Promise<string | null> => {
    safeSetState(setIsConnecting, true);
    try {
      const addr = await syncWalletConnection(true);
      if (!aliveRef.current) return null;
      if (!addr) {
        safeSetState(setIsInstalled, false);
      }

      return addr;
    } catch (err) {
      console.error('[Wallet] Connection error:', err);
      return null;
    } finally {
      if (aliveRef.current) safeSetState(setIsConnecting, false);
    }
  }, [syncWalletConnection, safeSetState]);

  const refreshConnection = useCallback(async (): Promise<string | null> => {
    return syncWalletConnection(false);
  }, [syncWalletConnection]);

  const disconnect = useCallback(() => {
    safeSetState(setAddress, null);
    sessionStorage.removeItem('lantern_wallet_address');
  }, [safeSetState]);

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
