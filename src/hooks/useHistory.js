// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { lsGet } from '../utils/telemetry.js';
import { lsSet } from '../utils/storage.js';
import { createHistoryStore } from '../utils/history-store.js';

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
// canUndo e canRedo acompanham o histórico e servem direto aos botões.
// A regra vive em `history-store.js`; o hook só espelha o estado no React.
function useHistory(initialState, { limit = 100, coalesceMs = 600 } = {}) {
  const storeRef = React.useRef(null);
  if (!storeRef.current) storeRef.current = createHistoryStore(initialState, { limit, coalesceMs });
  const store = storeRef.current;
  const snapshot = () => ({ state: store.getState(), canUndo: store.canUndo(), canRedo: store.canRedo() });
  const [view, setView] = React.useState(snapshot);
  React.useEffect(() => {
    const sync = () => setView((current) => {
      const next = snapshot();
      return current.state === next.state && current.canUndo === next.canUndo && current.canRedo === next.canRedo
        ? current : next;
    });
    // Uma gravação feita entre o render e este efeito não pode ficar de fora.
    sync();
    return store.subscribe(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const set = React.useCallback((updater) => store.set(updater), [store]);
  // setState que NÃO grava no histórico (uso interno)
  const setSilent = React.useCallback((updater) => store.setSilent(updater), [store]);
  const undo = React.useCallback(() => store.undo(), [store]);
  const redo = React.useCallback(() => store.redo(), [store]);
  const reset = React.useCallback((next) => store.reset(next), [store]);
  // Estado atual sem esperar o render (operações assíncronas conferem o alvo).
  const getState = React.useCallback(() => store.getState(), [store]);

  return { state: view.state, getState, set, setSilent, undo, redo, reset, canUndo: view.canUndo, canRedo: view.canRedo };
}

export {
  usePersistedState,
  useHistory,
};
