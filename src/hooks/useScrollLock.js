import React from 'react';

// ─── SCROLL LOCK (modais grandes) ────────────────────────────────────────────
// Trava scroll do body enquanto modal está aberto + preserva scroll position no close.
// Conta abertura simultânea de múltiplos modais (caso raro de modal sobre modal).
let __vcScrollLockCount = 0;
let __vcSavedScrollY = 0;

export function useScrollLock(active) {
  React.useEffect(() => {
    if (!active) return undefined;
    if (__vcScrollLockCount === 0) {
      __vcSavedScrollY = window.scrollY || 0;
      const body = document.body;
      body.style.position = 'fixed';
      body.style.top = `-${__vcSavedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.overflow = 'hidden';
    }
    __vcScrollLockCount++;
    return () => {
      __vcScrollLockCount--;
      if (__vcScrollLockCount <= 0) {
        __vcScrollLockCount = 0;
        const body = document.body;
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.overflow = '';
        window.scrollTo(0, __vcSavedScrollY);
      }
    };
  }, [active]);
}
