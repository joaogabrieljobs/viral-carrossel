// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { lsGet } from '../utils/telemetry.js';
import { lsSet } from '../utils/storage.js';

// Hook: state que sincroniza com localStorage (debounced) + sync entre abas
// via evento `storage` (que só dispara em OUTRAS abas — não na que escreveu).
function usePersistedState(key, initial) {
  const [val, setVal] = React.useState(() => lsGet(key, initial));
  const tRef = React.useRef(null);
  const lastWrittenRef = React.useRef(null);
  React.useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      lastWrittenRef.current = JSON.stringify(val);
      lsSet(key, val);
    }, 300);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [key, val]);
  React.useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== key || e.newValue == null) return;
      // Ignora eco da própria escrita (alguns browsers reentram)
      if (e.newValue === lastWrittenRef.current) return;
      try {
        setVal(JSON.parse(e.newValue));
      } catch (err) {
        console.warn(`[usePersistedState] storage event JSON inválido para "${key}":`, err.message);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);
  return [val, setVal];
}

// Hook: histórico para undo/redo. Mudanças muito próximas no tempo
// (ex: digitar em um input) são agrupadas em um único snapshot.
// canUndo e canRedo são booleanos reativos — mudam de valor quando o histórico muda,
// o que permite que botões de undo/redo reflitam o estado corretamente sem polling.
function useHistory(initialState, { limit = 100, coalesceMs = 600 } = {}) {
  const [state, setStateInternal] = React.useState(initialState);
  const past = React.useRef([]);
  const future = React.useRef([]);
  const skipNext = React.useRef(false);
  const lastPushAt = React.useRef(0);
  // Guards contra StrictMode double-invoke: React 18 roda o updater 2× em dev
  // pra detectar side-effects. Sem isso, push duplica entradas e undo/redo pulam steps.
  const lastPushedPrev = React.useRef(null);
  const lastUndoPrev = React.useRef(null);
  const lastRedoPrev = React.useRef(null);
  // Versão incremental: muda sempre que o histórico muda → permite derivar canUndo/canRedo reativos
  const [histVer, setHistVer] = React.useState(0);
  const bumpHist = React.useCallback(() => setHistVer(v => v + 1), []);

  const push = React.useCallback((updater) => {
    setStateInternal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      if (skipNext.current) { skipNext.current = false; return next; }
      // Guard StrictMode: se já empurramos exatamente este prev no último ciclo, é re-invoke
      if (lastPushedPrev.current === prev) return next;
      lastPushedPrev.current = prev;
      const now = Date.now();
      const coalesce = (now - lastPushAt.current) < coalesceMs;
      lastPushAt.current = now;
      if (!coalesce) {
        past.current.push(prev);
        if (past.current.length > limit) past.current.shift();
        future.current = [];
        Promise.resolve().then(bumpHist);
      } else {
        future.current = [];
      }
      return next;
    });
  }, [limit, coalesceMs, bumpHist]);

  // setState que NÃO grava no histórico (uso interno)
  const setSilent = React.useCallback((updater) => {
    skipNext.current = true;
    setStateInternal(updater);
  }, []);

  const undo = React.useCallback(() => {
    setStateInternal((prev) => {
      if (lastUndoPrev.current === prev) return prev; // StrictMode guard
      if (!past.current.length) return prev;
      lastUndoPrev.current = prev;
      const previous = past.current.pop();
      future.current.push(prev);
      Promise.resolve().then(bumpHist);
      return previous;
    });
  }, [bumpHist]);

  const redo = React.useCallback(() => {
    setStateInternal((prev) => {
      if (lastRedoPrev.current === prev) return prev; // StrictMode guard
      if (!future.current.length) return prev;
      lastRedoPrev.current = prev;
      const next = future.current.pop();
      past.current.push(prev);
      Promise.resolve().then(bumpHist);
      return next;
    });
  }, [bumpHist]);

  const reset = React.useCallback((next) => {
    past.current = [];
    future.current = [];
    setStateInternal(next);
    bumpHist();
  }, [bumpHist]);

  // Valores reativos derivados da versão do histórico
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canUndo = React.useMemo(() => past.current.length > 0, [histVer]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canRedo = React.useMemo(() => future.current.length > 0, [histVer]);

  return { state, set: push, setSilent, undo, redo, reset, canUndo, canRedo };
}

export {
  usePersistedState,
  useHistory,
};
