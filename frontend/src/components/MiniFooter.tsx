'use client';

import { useEffect, useState } from 'react';

export default function MiniFooter() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="h-10 border-t border-[#3A3A3A] bg-[#0A0A0A] flex items-center justify-between px-6 shrink-0">
      {/* Left — brand */}
      <span className="text-[9px] text-[#8A8A8A] uppercase tracking-[0.2em] font-medium">
        Lantern © 2026 · Zero-Knowledge Compliance Engine
      </span>

      {/* Centre — live pulse dot */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.2em]">Testnet Live</span>
      </div>

      {/* Right — live clock */}
      <span className="text-[9px] text-[#5A5A5A] uppercase tracking-[0.15em] tabular-nums font-mono">
        {time || '––:––:––'} UTC
      </span>
    </footer>
  );
}
