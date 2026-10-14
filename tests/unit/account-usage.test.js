import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AccountUsage from '../../src/components/AccountUsage.jsx';
import { normalizeAccountUsage } from '../../src/utils/account-usage.js';

describe('account usage summary', () => {
  it('keeps unknown usage distinct from a confirmed unused allowance', () => {
    expect(normalizeAccountUsage({ planTier: 'creator' })).toMatchObject({
      planName: 'Criador', limit: 50, used: null, remaining: null, hasUsage: false, percentage: null,
    });
    expect(normalizeAccountUsage({ imageQuota: { used: 0, limit: 50, tier: 'creator' } })).toMatchObject({
      used: 0, remaining: 50, hasUsage: true, percentage: 0,
    });
  });

  it('disregards fallback counters when the server reports unavailable usage', () => {
    expect(normalizeAccountUsage({ imageQuota: { status: 'unavailable', used: 0, limit: 150, remaining: 150 } })).toMatchObject({
      limit: 150, used: null, remaining: null, hasUsage: false, exhausted: false,
    });
    expect(normalizeAccountUsage({ imageQuota: { available: false, used: 0, limit: 50 } }).hasUsage).toBe(false);
  });

  it.each([null, undefined, '', '12', false, -1, Infinity, NaN, 1.5])('does not coerce an invalid used count (%s) into available quota', (used) => {
    expect(normalizeAccountUsage({ imageQuota: { used, limit: 50, remaining: 50 } })).toMatchObject({
      used: null, remaining: null, hasUsage: false,
    });
  });

  it('does not infer a plan or zero allowance from unknown data', () => {
    expect(normalizeAccountUsage({ planTier: 'unknown', imageQuota: { limit: null } })).toMatchObject({
      planName: null, limit: null, used: null, remaining: null, noIncludedImages: false,
    });
  });

  it('distinguishes a plan without images from an exhausted allowance', () => {
    expect(normalizeAccountUsage({ planTier: 'essential', imageQuota: { used: 0, limit: 0 } })).toMatchObject({
      planName: 'Essencial', noIncludedImages: true, exhausted: false, percentage: null,
    });
    expect(normalizeAccountUsage({ imageQuota: { used: 50, limit: 50 } })).toMatchObject({
      remaining: 0, exhausted: true, percentage: 100,
    });
  });

  it('preserves recorded usage above the allowance while clamping remaining and progress', () => {
    expect(normalizeAccountUsage({ imageQuota: { used: 160, limit: 150, remaining: 20 } })).toMatchObject({
      used: 160, remaining: 0, exhausted: true, percentage: 100,
    });
  });

  it('shows the quota tier and its period when present', () => {
    expect(normalizeAccountUsage({
      planTier: 'creator', currentPeriodStart: '2026-08-01T12:00:00Z', currentPeriodEnd: '2026-09-01T12:00:00Z',
      imageQuota: { tier: 'pro', used: 25, limit: 150, periodStart: '2026-09-01T12:00:00Z', periodEnd: '2026-10-01T12:00:00Z' },
    })).toMatchObject({ planName: 'Pro', periodStart: '2026-09-01T12:00:00.000Z', periodEnd: '2026-10-01T12:00:00.000Z' });
  });

  it('uses valid session dates, rejects invalid dates, and never invents a cycle', () => {
    expect(normalizeAccountUsage({ currentPeriodStart: 'invalid', currentPeriodEnd: null })).toMatchObject({ periodStart: null, periodEnd: null });
    expect(normalizeAccountUsage({ currentPeriodEnd: '2026-10-01T12:00:00Z' }).periodEnd).toBe('2026-10-01T12:00:00.000Z');
    expect(normalizeAccountUsage({ currentPeriodStart: '2026-10-02T12:00:00Z', currentPeriodEnd: '2026-10-01T12:00:00Z' })).toMatchObject({ periodStart: null, periodEnd: null });
  });
});

describe('account usage page', () => {
  const render = (props = {}) => renderToStaticMarkup(React.createElement(AccountUsage, props));

  it('shows unavailable consumption without a fabricated progress indicator', () => {
    const html = render({ planTier: 'creator', imageQuota: { status: 'unavailable', used: 0, limit: 50 } });
    expect(html).toContain('Uso indisponível');
    expect(html).toContain('title="Indisponível"');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('0% utilizado');
  });

  it('exposes accurate accessible progress and a next step for exhausted quotas', () => {
    const html = render({ imageQuota: { used: 50, limit: 50 }, onManageBilling: () => {} });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="50"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('Limite do ciclo atingido');
    expect(html).toContain('Ver opções do plano');
  });

  it('explains the Essential allowance without presenting it as exhausted', () => {
    const html = render({ planTier: 'essential', imageQuota: { used: 0, limit: 0 }, onManageBilling: () => {} });
    expect(html).toContain('Sem imagens inclusas');
    expect(html).toContain('Este plano não inclui geração de imagens');
    expect(html).not.toContain('Limite do ciclo atingido');
    expect(html).not.toContain('role="progressbar"');
  });

  it('keeps plan consumption visible while explaining separate provider billing for BYOK', () => {
    const html = render({ imageQuota: { used: 12, limit: 50 }, useOwnImageKey: true, onOpenSettings: () => {} });
    expect(html).toContain('aria-valuenow="12"');
    expect(html).toContain('Uso com chave própria selecionado');
    expect(html).toContain('O consumo e a cobrança ficam no provedor da chave');
    expect(html).toContain('Gerenciar chave de imagem');
  });

  it('identifies incomplete legacy cycles without carrying the notice into the next cycle', () => {
    const props = { imageQuota: { used: 0, limit: 50 } };
    expect(render({ ...props, currentPeriodStart: '2026-10-01T12:00:00Z' })).toContain('anteriores à correção do contador');
    expect(render({ ...props, currentPeriodStart: '2026-11-01T12:00:00Z' })).not.toContain('anteriores à correção do contador');
  });
});
