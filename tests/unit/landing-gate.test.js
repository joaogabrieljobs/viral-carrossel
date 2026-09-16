// Bug 2026-09-15: `?billing=cancel` carregava o bundle da landing (LandingFirst),
// que não monta `useAccess` — o paywall nunca abria e o param ficava preso na URL.
import { describe, it, expect } from 'vitest';
import { landingGateDecision } from '../../src/utils/landing-gate.js';

describe('landingGateDecision', () => {
  it('primeira visita sem params mostra a landing', () => {
    expect(landingGateDecision('', false)).toBe(true);
    expect(landingGateDecision('?utm_source=ig', false)).toBe(true);
  });

  it('já dispensada nesta aba vai direto ao studio', () => {
    expect(landingGateDecision('', true)).toBe(false);
  });

  it('app=1 e studio=1 saltam a landing', () => {
    expect(landingGateDecision('?app=1', false)).toBe(false);
    expect(landingGateDecision('?studio=1', false)).toBe(false);
  });

  it('qualquer retorno de checkout carrega o studio (inclui cancel)', () => {
    for (const b of ['success', 'restored', 'cancel']) {
      expect(landingGateDecision(`?billing=${b}`, false), b).toBe(false);
    }
  });

  it('qualquer retorno de login carrega o studio (inclui no_subscription e denied)', () => {
    for (const l of ['google', 'password', 'no_subscription', 'denied', 'error']) {
      expect(landingGateDecision(`?login=${l}`, false), l).toBe(false);
    }
  });

  it('landing=1 / intro=1 / welcome=1 forçam a landing mesmo já dispensada', () => {
    expect(landingGateDecision('?landing=1', true)).toBe(true);
    expect(landingGateDecision('?intro=1', true)).toBe(true);
    expect(landingGateDecision('?welcome=1', true)).toBe(true);
  });

  it('search sem "?" e valores vazios são tolerados', () => {
    expect(landingGateDecision('billing=cancel', false)).toBe(false);
    expect(landingGateDecision('?billing=', false)).toBe(false);
  });
});
