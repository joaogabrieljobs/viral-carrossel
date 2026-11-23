import { describe, it, expect } from 'vitest';
import { createHistoryStore } from '../../src/utils/history-store.js';

// Relógio controlado: o agrupamento de digitação depende do intervalo entre gravações.
function storeAt(initial, options = {}) {
  let now = 10_000;
  const store = createHistoryStore(initial, { ...options, now: () => now });
  return { store, tick: (ms) => { now += ms; } };
}

describe('histórico do editor (desfazer/refazer)', () => {
  it('desfazer e editar de novo grava o novo passo e descarta o ramo abandonado', () => {
    const { store, tick } = storeAt('S0');
    store.set('A');
    tick(50);
    store.undo();
    expect(store.getState()).toBe('S0');
    tick(50);
    store.set('B');
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
    store.undo();
    expect(store.getState()).toBe('S0');
    store.redo();
    expect(store.getState()).toBe('B');
  });

  it('com histórico anterior, o desfazer não pula o estado para onde a pessoa voltou', () => {
    const { store, tick } = storeAt('S0');
    store.set('A1'); tick(1000);
    store.set('A2'); tick(1000);
    store.undo();
    expect(store.getState()).toBe('A1');
    tick(10);
    store.set('B');
    store.undo();
    expect(store.getState()).toBe('A1');
    store.undo();
    expect(store.getState()).toBe('S0');
  });

  it('desfazer, refazer e desfazer de novo funciona quantas vezes forem pedidas', () => {
    const { store } = storeAt('S0');
    store.set('A');
    for (let round = 0; round < 3; round += 1) {
      store.undo();
      expect(store.getState()).toBe('S0');
      expect(store.canRedo()).toBe(true);
      store.redo();
      expect(store.getState()).toBe('A');
      expect(store.canUndo()).toBe(true);
    }
  });

  it('digitação seguida vira um passo só; pausa maior abre outro', () => {
    const { store, tick } = storeAt('');
    store.set('a'); tick(100);
    store.set('ab'); tick(100);
    store.set('abc'); tick(900);
    store.set('abc d');
    store.undo();
    expect(store.getState()).toBe('abc');
    store.undo();
    expect(store.getState()).toBe('');
    expect(store.canUndo()).toBe(false);
  });

  it('atualização por função recebe o estado mais recente, mesmo em sequência no mesmo instante', () => {
    const { store } = storeAt(1);
    store.set((n) => n + 1);
    store.set((n) => n * 10);
    expect(store.getState()).toBe(20);
    store.undo();
    expect(store.getState()).toBe(1);
  });

  it('gravação igual ao estado atual não cria passo nem apaga o refazer', () => {
    const { store, tick } = storeAt('S0');
    store.set('A'); tick(1000);
    store.undo();
    store.set((s) => s);
    expect(store.canRedo()).toBe(true);
    expect(store.canUndo()).toBe(false);
  });

  it('setSilent troca o estado sem tocar no histórico', () => {
    const { store } = storeAt('S0');
    store.set('A');
    store.setSilent('A*');
    expect(store.getState()).toBe('A*');
    store.undo();
    expect(store.getState()).toBe('S0');
    store.redo();
    expect(store.getState()).toBe('A*');
  });

  it('reset limpa passado e futuro e o próximo passo é gravado mesmo logo em seguida', () => {
    const { store } = storeAt('S0');
    store.set('A');
    store.undo();
    store.reset('N0');
    expect([store.canUndo(), store.canRedo()]).toEqual([false, false]);
    store.set('N1');
    store.undo();
    expect(store.getState()).toBe('N0');
  });

  it('respeita o limite de passos guardados', () => {
    const { store, tick } = storeAt(0, { limit: 3 });
    for (let n = 1; n <= 6; n += 1) { store.set(n); tick(1000); }
    const seen = [];
    while (store.canUndo()) { store.undo(); seen.push(store.getState()); }
    expect(seen).toEqual([5, 4, 3]);
  });

  it('avisa quem observa só quando o estado ou o histórico mudam', () => {
    const { store } = storeAt('S0');
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.undo();
    store.redo();
    expect(calls).toBe(0);
    store.set('A');
    store.undo();
    expect(calls).toBe(2);
  });
});
