import { describe, expect, it, vi } from 'vitest';
import metadata from '../../api/oauth/metadata.js';
import protectedResource from '../../api/oauth-protected-resource.js';
import { normalizeOAuthResource, normalizeScopes, oauthResource } from '../../api/lib/oauth-store.js';

function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res); return res;
}

describe('descoberta OAuth do MCP', () => {
  it('publica recurso, PKCE, DCR e refresh token coerentes', () => {
    const resourceRes = response(); protectedResource({}, resourceRes);
    expect(resourceRes.json.mock.calls[0][0]).toMatchObject({ resource: oauthResource, authorization_servers: ['https://moont.ai'] });
    const authRes = response(); metadata({}, authRes);
    expect(authRes.json.mock.calls[0][0]).toMatchObject({
      issuer: 'https://moont.ai', code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      registration_endpoint: 'https://moont.ai/oauth/register',
    });
  });

  it('aceita somente os escopos conhecidos', () => {
    expect(normalizeScopes('projects:read projects:write')).toEqual(['projects:read', 'projects:write']);
    expect(() => normalizeScopes('projects:read admin')).toThrow(/Permissões inválidas/);
  });

  it('aceita clientes MCP 2025-03-26 sem resource e recusa outro destino', () => {
    expect(normalizeOAuthResource()).toBe(oauthResource);
    expect(normalizeOAuthResource(oauthResource)).toBe(oauthResource);
    expect(() => normalizeOAuthResource('https://outro.example/mcp')).toThrow(/Recurso OAuth inválido/);
  });
});
