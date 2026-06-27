'use client';

import { useState, useEffect } from 'react';

interface CiphertextRevealProps {
  value: string;
  isDecrypted: boolean;
}

export function CiphertextReveal({ value, isDecrypted }: CiphertextRevealProps) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!isDecrypted) {
      // Return solid blocks for redacted states
      setDisplay('█'.repeat(value ? value.length : 12));
      return;
    }

    // Monospace scramble animation
    const target = value;
    const length = target.length;
    const glyphs = '0123456789X$#,';
    let frame = 0;

    const interval = setInterval(() => {
      let current = '';
      for (let i = 0; i < length; i++) {
        // Progressive reveal from left to right (4 ticks per character)
        if (frame > i * 4) {
          current += target[i];
        } else {
          // Scramble characters that are not yet locked
          current += glyphs[Math.floor(Math.random() * glyphs.length)];
        }
      }
      
      setDisplay(current);

      if (frame > length * 4) {
        clearInterval(interval);
        setDisplay(target);
      }
      frame++;
    }, 25);

    return () => clearInterval(interval);
  }, [value, isDecrypted]);

  return <span className="font-mono tracking-wider">{display}</span>;
}
