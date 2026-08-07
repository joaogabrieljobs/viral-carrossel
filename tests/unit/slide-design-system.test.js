// Task 02 — RF-03: sistema de composição de slides (clamp de peso, inferência de arco).
import { describe, it, expect } from 'vitest';
import {
  clampTitleWeight,
  inferCompositionId,
  pairingMatchesBrand,
} from '../../src/utils/slide-design-system.js';

describe('clampTitleWeight', () => {
  it('fonte capada a 700 (Inter) não aceita 800', () => {
    expect(clampTitleWeight('"Inter", sans-serif', 800)).toBe(700);
  });

  it('fonte sem cap (Archivo Black) mantém 800', () => {
    expect(clampTitleWeight('"Archivo Black", sans-serif', 800)).toBe(800);
  });

  it('limites gerais: mínimo 400, máximo 900, inválido vira 700', () => {
    expect(clampTitleWeight('"Archivo Black"', 300)).toBe(400);
    expect(clampTitleWeight('"Archivo Black"', 950)).toBe(900);
    expect(clampTitleWeight('"Archivo Black"', undefined)).toBe(700);
  });
});

describe('inferCompositionId', () => {
  it('primeiro slide = hook_fullbleed, último = cta_close', () => {
    expect(inferCompositionId({ index: 0, total: 7, hasPhoto: true })).toBe('hook_fullbleed');
    expect(inferCompositionId({ index: 6, total: 7, hasPhoto: false })).toBe('cta_close');
  });

  it('miolo com corpo+foto = sandwich_editorial; corpo sem foto = stat_proof', () => {
    expect(inferCompositionId({ index: 2, total: 7, hasPhoto: true, hasBodyAfter: true })).toBe('sandwich_editorial');
    expect(inferCompositionId({ index: 2, total: 7, hasPhoto: false, hasBodyAfter: true })).toBe('stat_proof');
  });

  it('miolo sem foto nem corpo = list_beat', () => {
    expect(inferCompositionId({ index: 2, total: 7, hasPhoto: false, hasBodyAfter: false })).toBe('list_beat');
  });
});

describe('pairingMatchesBrand', () => {
  const pairing = { titleFont: '"Sora"', bodyFont: '"Inter"' };

  it('casa quando título e corpo batem; falha se um difere', () => {
    expect(pairingMatchesBrand({ titleFont: '"Sora"', bodyFont: '"Inter"' }, pairing)).toBe(true);
    expect(pairingMatchesBrand({ titleFont: '"Sora"', bodyFont: '"DM Sans"' }, pairing)).toBe(false);
    expect(pairingMatchesBrand(null, pairing)).toBe(false);
  });
});
