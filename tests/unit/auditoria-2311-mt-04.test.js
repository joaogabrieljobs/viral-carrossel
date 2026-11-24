// Auditoria 23/11 — MT-04: assinatura cancelada no fim do período não pode
// aparecer como "Renovação do ciclo" nem "período atual até".
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStripeMock, stripeMock } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/image-quota.js', () => ({
  getQuotaUsage: vi.fn(async () => ({ used: 3, limit: 50, remaining: 47, allowed: true })),
  getImageQuotaActivity: vi.fn(async () => []),
}));

import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import sessionHandler from '../../api/auth/session.js';
import { makeReq, makeRes } from '../helpers/http.js';
import { accessStateFromSession } from '../../src/hooks/useAccess.js';
import AccountUsage from '../../src/components/AccountUsage.jsx';
import AccountProfile from '../../src/components/AccountProfile.jsx';

const start = 1794524400; // 12/11/2026
const end = 1797116400; // 12/12/2026
const subscription = (extra = {}) => ({
  id: 'sub_mt04', status: 'active', metadata: { product: 'viral-carrossel', tier: 'creator' },
  items: { data: [{ current_period_start: start, current_period_end: end }] },
  ...extra,
});

async function session(sub) {
  stripeMock.subscriptions.list.mockResolvedValue({ data: [sub] });
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId: 'cus_mt04', email: 'mt04@teste.exemplo' }))}`;
  const res = makeRes();
  await sessionHandler(makeReq({ cookie }), res);
  return res.body;
}

beforeEach(resetStripeMock);

describe('MT-04 — a sessão diz quando a assinatura não vai renovar', () => {
  it('cancel_at_period_end: true → cancelAtPeriodEnd: true', async () => {
    const body = await session(subscription({ cancel_at_period_end: true, cancel_at: end }));
    expect(body).toMatchObject({
      active: true, status: 'active', cancelAtPeriodEnd: true,
      cancelAt: new Date(end * 1000).toISOString(),
      currentPeriodEnd: new Date(end * 1000).toISOString(),
    });
  });

  it('assinatura que renova → cancelAtPeriodEnd: false e sem data de encerramento', async () => {
    const body = await session(subscription({ cancel_at_period_end: false, cancel_at: null }));
    expect(body).toMatchObject({ active: true, cancelAtPeriodEnd: false, cancelAt: null });
  });

  it('data de cancelamento marcada sem a caixa de fim de período também chega ao cliente', async () => {
    const body = await session(subscription({ cancel_at_period_end: false, cancel_at: end - 86400 }));
    expect(body.cancelAt).toBe(new Date((end - 86400) * 1000).toISOString());
  });

  it('o estado de acesso do cliente guarda os dois campos', () => {
    const state = accessStateFromSession({
      active: true, status: 'active', accessSource: 'stripe', cancelAtPeriodEnd: true,
      cancelAt: '2026-12-12T15:00:00.000Z', currentPeriodEnd: '2026-12-12T15:00:00.000Z',
    });
    expect(state).toMatchObject({ cancelAtPeriodEnd: true, cancelAt: '2026-12-12T15:00:00.000Z' });
    expect(accessStateFromSession({ active: true, status: 'active' })).toMatchObject({ cancelAtPeriodEnd: false, cancelAt: null });
  });
});

describe('MT-04 — Uso e Perfil com assinatura que encerra', () => {
  const quota = { status: 'available', available: true, used: 3, limit: 50, remaining: 47, tier: 'creator' };
  const usageProps = {
    planTier: 'creator', imageQuota: quota,
    currentPeriodStart: '2026-11-12T15:00:00Z', currentPeriodEnd: '2026-12-12T15:00:00Z',
  };

  it('Uso não promete renovação e mostra quando a assinatura encerra', () => {
    const html = renderToStaticMarkup(React.createElement(AccountUsage, {
      ...usageProps, cancelAtPeriodEnd: true, cancelAt: '2026-12-12T15:00:00Z',
    }));
    expect(html).not.toMatch(/renova/i);
    expect(html).not.toContain('Ciclo em andamento');
    expect(html).toContain('Assinatura encerra em');
    expect(html).toContain('a conta volta ao plano grátis');
  });

  it('Uso de assinatura que renova continua igual', () => {
    const html = renderToStaticMarkup(React.createElement(AccountUsage, usageProps));
    expect(html).toContain('Renovação do ciclo');
    expect(html).toContain('Ciclo em andamento');
    expect(html).not.toContain('Assinatura encerra em');
  });

  const profile = accessStatus => renderToStaticMarkup(React.createElement(AccountProfile, {
    email: 'conta@example.test', planTier: 'creator', currentPeriodEnd: '2026-12-12T15:00:00Z',
    imageQuota: quota, accessStatus,
  }));

  it('Perfil troca "período atual até" por "Assinatura encerra em"', () => {
    const html = profile({ active: true, status: 'active', accessSource: 'stripe', cancelAtPeriodEnd: true, cancelAt: '2026-12-12T15:00:00Z' });
    expect(html).toContain('Assinatura encerra em 12/12/2026');
    expect(html).toContain('a conta volta ao plano grátis');
    expect(html).not.toContain('período atual até');
  });

  it('Perfil de assinatura que renova continua igual', () => {
    const html = profile({ active: true, status: 'active', accessSource: 'stripe', cancelAtPeriodEnd: false, cancelAt: null });
    expect(html).toContain('período atual até 12/12/2026');
    expect(html).not.toContain('Assinatura encerra em');
  });
});
