import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import startGoogleLogin from '../../api/auth/google.js';
import googleCallback from '../../api/auth/google/callback.js';

afterEach(() => vi.unstubAllEnvs());

describe('OAuth Google em domínio canônico', () => {
  const canonical = 'https://moont.ai';

  function configure() {
    vi.stubEnv('APP_URL', 'https://alternativo.example');
    vi.stubEnv('GOOGLE_REDIRECT_URI', `${canonical}/api/auth/google/callback`);
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-test');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret-test');
  }

  it('domínio alternativo redireciona ao canônico antes de criar state/cookie', async () => {
    configure();
    const first = makeRes();
    await startGoogleLogin(makeReq({ headers: { host: 'alternativo.example' } }), first);
    expect(first.redirectUrl).toBe(`${canonical}/api/auth/google`);
    expect(cookieValue(first, 'vc_google_oauth')).toBeNull();

    const canonicalStart = makeRes();
    await startGoogleLogin(makeReq({ headers: { host: 'moont.ai' } }), canonicalStart);
    const state = cookieValue(canonicalStart, 'vc_google_oauth');
    expect(state).toBeTruthy();
    const googleUrl = new URL(canonicalStart.redirectUrl);
    expect(googleUrl.searchParams.get('state')).toBe(state);
    expect(googleUrl.searchParams.get('redirect_uri'))
      .toBe(`${canonical}/api/auth/google/callback`);

    const defaultPort = makeRes();
    await startGoogleLogin(makeReq({ headers: { host: 'moont.ai:443' } }), defaultPort);
    expect(defaultPort.redirectUrl).toContain('https://accounts.google.com/');
  });

  it('Host e X-Forwarded-Host falsos nunca entram no destino', async () => {
    configure();
    const res = makeRes();
    await startGoogleLogin(makeReq({ headers: {
      host: 'evil.example', 'x-forwarded-host': 'evil.example',
    } }), res);
    expect(res.redirectUrl).toBe(`${canonical}/api/auth/google`);
    expect(res.redirectUrl).not.toContain('evil.example');
  });

  it('callback devolve falhas ao domínio do cookie, mesmo se APP_URL difere', async () => {
    configure();
    const res = makeRes();
    await googleCallback(makeReq({
      url: '/api/auth/google/callback?code=abc&state=wrong',
      cookie: 'vc_google_oauth=expected',
      headers: { host: 'evil.example' },
    }), res);
    expect(res.redirectUrl).toBe(`${canonical}/?login=invalid_state`);
  });

  it('login iniciado no domínio antigo conserva cookie e callback no mesmo host', async () => {
    configure();
    const legacyOrigin = 'https://viralcarrossel.com.br';
    const start = makeRes();
    await startGoogleLogin(makeReq({ headers: { host: 'viralcarrossel.com.br' } }), start);
    expect(cookieValue(start, 'vc_google_oauth')).toBeTruthy();
    expect(new URL(start.redirectUrl).searchParams.get('redirect_uri'))
      .toBe(`${legacyOrigin}/api/auth/google/callback`);

    const callback = makeRes();
    await googleCallback(makeReq({
      url: '/api/auth/google/callback?code=abc&state=wrong',
      cookie: 'vc_google_oauth=expected',
      headers: { host: 'viralcarrossel.com.br' },
    }), callback);
    expect(callback.redirectUrl).toBe(`${legacyOrigin}/?login=invalid_state`);

    const www = makeRes();
    await startGoogleLogin(makeReq({ headers: { host: 'www.viralcarrossel.com.br' } }), www);
    expect(www.redirectUrl).toBe(`${legacyOrigin}/api/auth/google`);
    expect(cookieValue(www, 'vc_google_oauth')).toBeNull();
  });
});
