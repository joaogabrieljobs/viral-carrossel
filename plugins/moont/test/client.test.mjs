import assert from 'node:assert/strict';
import test from 'node:test';
import { MoontApiClient } from '../src/client.mjs';

test('client sends a Bearer token only to the fixed HTTPS Moont endpoint', async () => {
  let captured;
  const client = new MoontApiClient({
    getToken: async () => 'moont_pat_secret-test',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, json: async () => ({ ok: true, projects: [] }) };
    },
  });
  await client.listProjects();
  assert.equal(captured.url.origin, 'https://viralcarrossel.com.br');
  assert.equal(captured.url.pathname, '/api/agent-visual-batch');
  assert.equal(captured.options.headers.Authorization, 'Bearer moont_pat_secret-test');
  assert.equal(captured.options.redirect, 'error');
});

test('backend errors redact a token before reaching tools', async () => {
  const client = new MoontApiClient({
    getToken: async () => 'moont_pat_secret-test',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, code: 'forbidden', error: 'Denied moont_pat_secret-test' }),
    }),
  });
  await assert.rejects(() => client.getProject('p'), (error) => {
    assert.equal(error.code, 'forbidden');
    assert.doesNotMatch(error.message, /moont_pat_secret-test/);
    return true;
  });
});
