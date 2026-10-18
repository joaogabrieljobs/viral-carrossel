import { describe, it, expect, afterEach } from 'vitest';
import { getAppUrl, getBillingReturnUrl } from '../../api/lib/stripe.js';
import { getGoogleRedirectUri } from '../../api/lib/google-auth.js';

const ORIG = {
  APP_URL: process.env.APP_URL,
  VITE_APP_URL: process.env.VITE_APP_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  for (const [k, v] of Object.entries(ORIG)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('getAppUrl (WEB-001/006)', () => {
  it('usa APP_URL quando definida', () => {
    process.env.APP_URL = 'https://viralcarrossel.com.br/';
    delete process.env.VERCEL_URL;
    expect(getAppUrl({ headers: { host: 'evil.example' } })).toBe('https://viralcarrossel.com.br');
  });

  it('ignora Host / X-Forwarded-Host (sem open redirect)', () => {
    process.env.APP_URL = 'https://viralcarrossel.com.br';
    const url = getAppUrl({
      headers: {
        host: 'evil.example',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      },
    });
    expect(url).toBe('https://viralcarrossel.com.br');
    expect(url).not.toContain('evil');
  });

  it('em produção sem APP_URL lança', () => {
    delete process.env.APP_URL;
    delete process.env.VITE_APP_URL;
    delete process.env.VERCEL_URL;
    process.env.VERCEL_ENV = 'production';
    expect(() => getAppUrl({ headers: { host: 'evil.example' } }))
      .toThrow(/APP_URL/);
  });

  it('em preview usa VERCEL_URL, não o Host do pedido', () => {
    delete process.env.APP_URL;
    delete process.env.VITE_APP_URL;
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'viral-carrossel-git-x.vercel.app';
    expect(getAppUrl({ headers: { host: 'evil.example' } }))
      .toBe('https://viral-carrossel-git-x.vercel.app');
  });

  it('em dev sem env cai em localhost', () => {
    delete process.env.APP_URL;
    delete process.env.VITE_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = 'development';
    expect(getAppUrl({ headers: { host: 'evil.example' } })).toBe('http://localhost:5173');
  });

  it('redirect OAuth ignora X-Forwarded-Host', () => {
    const prev = process.env.GOOGLE_REDIRECT_URI;
    delete process.env.GOOGLE_REDIRECT_URI;
    process.env.APP_URL = 'https://viralcarrossel.com.br';
    const uri = getGoogleRedirectUri({
      headers: {
        host: 'evil.example',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      },
    });
    if (prev === undefined) delete process.env.GOOGLE_REDIRECT_URI;
    else process.env.GOOGLE_REDIRECT_URI = prev;
    expect(uri).toBe('https://viralcarrossel.com.br/api/auth/google/callback');
    expect(uri).not.toContain('evil');
  });

  it('Checkout volta ao host antigo somente quando o Host é um domínio próprio conhecido', () => {
    process.env.APP_URL = 'https://moont.ai';
    expect(getBillingReturnUrl({ headers: { host: 'viralcarrossel.com.br' } }))
      .toBe('https://viralcarrossel.com.br');
    expect(getBillingReturnUrl({ headers: { host: 'www.viralcarrossel.com.br:443' } }))
      .toBe('https://www.viralcarrossel.com.br');
    expect(getBillingReturnUrl({ headers: { host: 'evil.example', 'x-forwarded-host': 'viralcarrossel.com.br' } }))
      .toBe('https://moont.ai');
    expect(getBillingReturnUrl({ headers: { host: 'viralcarrossel.com.br.evil.example' } }))
      .toBe('https://moont.ai');
    process.env.APP_URL = 'https://example.invalid';
    expect(getBillingReturnUrl({ headers: { host: 'moont.ai' } })).toBe('https://moont.ai');
    expect(getBillingReturnUrl({ headers: { host: 'www.moont.com.br' } })).toBe('https://www.moont.com.br');
  });
});
