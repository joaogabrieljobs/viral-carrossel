// Plano grátis (docs/product/plano-gratis.md): a conta sem assinatura tem
// sessão, mas a sessão não é assinatura. O gate fica no servidor, rota por
// rota — esconder botão na interface não conta como bloqueio.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import { hashPassword } from '../../api/lib/password-auth.js';
import { resetActiveAccessCacheForTests } from '../../api/lib/require-access.js';
import { FREE_PLAN, FREE_PROJECT_LIMIT, PLAN_ORDER, PLAN_TIERS, getPlan } from '../../shared/plans.js';
import sessionHandler from '../../api/auth/session.js';
import loginHandler from '../../api/auth/login.js';
import registerHandler from '../../api/auth/register.js';
import checkoutHandler from '../../api/stripe/checkout.js';
import portalHandler from '../../api/stripe/portal.js';
import compatibleHandler from '../../api/ai/compatible.js';
import ocrHandler from '../../api/ai/ocr.js';
import sjinnHandler from '../../api/ai/sjinn-image.js';
import anthropicHandler from '../../api/anthropic/v1/messages.js';
import fetchSourceHandler from '../../api/fetch-source.js';
import projectsHandler from '../../api/projects.js';
import librarySyncHandler from '../../api/library-sync.js';
import accountMetaHandler from '../../api/account-library-meta.js';
import projectShareHandler from '../../api/project-share.js';
import agentAccessHandler from '../../api/agent-access.js';

const FREE = { id: 'cus_gratis', email: 'gratis@teste.exemplo' };
const freeCookie = () => `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({
  customerId: FREE.id, email: FREE.email,
}))}`;

beforeEach(() => {
  resetStripeMock();
  resetActiveAccessCacheForTests();
  // Conta existe e não tem assinatura nenhuma.
  stripeMock.customers.retrieve.mockResolvedValue({ id: FREE.id, email: FREE.email, metadata: {} });
  stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
  // Chaves da plataforma presentes: se o gate falhar, o teste veria o upstream ser chamado.
  vi.stubEnv('ZAI_API_KEY', 'zai-chave-da-plataforma');
  vi.stubEnv('SJINN_API_KEY', 'sjinn-chave-da-plataforma');
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-chave-da-plataforma');
  vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream não pode ser chamado no plano grátis')));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('plano grátis — definição', () => {
  it('não é um plano comprável: fica fora de PLAN_ORDER e de PLAN_TIERS', () => {
    expect(PLAN_ORDER).not.toContain('free');
    expect(PLAN_TIERS.free).toBeUndefined();
    expect(getPlan('free')).toBeNull();
    expect(FREE_PLAN).toMatchObject({ id: 'free', priceBRL: 0, imageQuota: 0, projectLimit: FREE_PROJECT_LIMIT });
    expect(FREE_PROJECT_LIMIT).toBe(3);
  });

  it('checkout pedindo o plano "free" não cria assinatura grátis: cai no plano pago padrão', async () => {
    const res = makeRes();
    await checkoutHandler(makeReq({
      method: 'POST', cookie: freeCookie(), body: { email: FREE.email, tier: 'free' },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.tier).toBe('creator');
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0]).toMatchObject({
      mode: 'subscription', customer: FREE.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    });
  });
});

describe('plano grátis — sessão', () => {
  it('sessão informa o plano grátis sem nunca marcar a conta como ativa', async () => {
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: freeCookie() }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      active: false, free: true, tier: 'free', status: 'inactive',
      email: FREE.email, customerId: FREE.id, plan: { id: 'free' },
    });
  });

  it('sem cookie continua anônimo: grátis exige conta', async () => {
    const res = makeRes();
    await sessionHandler(makeReq({}), res);
    expect(res.body).toMatchObject({ active: false, status: 'anonymous', email: null });
    expect(res.body.free).toBeUndefined();
  });

  it('assinante continua ativo e não é rotulado como grátis', async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva(FREE.id)] });
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: freeCookie() }), res);
    expect(res.body.active).toBe(true);
    expect(res.body.free).toBeUndefined();
    expect(res.body.tier).not.toBe('free');
  });

  it('cadastro entra direto no grátis; a sessão emitida é recusada pela IA', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [], has_more: false });
    const created = { id: 'cus_cadastro', email: 'nova@teste.exemplo', metadata: { product: 'viral-carrossel' } };
    stripeMock.customers.create.mockResolvedValue(structuredClone(created));
    stripeMock.customers.update.mockImplementation(async (_, data) => {
      created.metadata = { ...created.metadata, ...data.metadata };
      return structuredClone(created);
    });
    stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(created));
    const res = makeRes();
    await registerHandler(makeReq({ method: 'POST', body: { email: created.email, password: 'SenhaSegura123!' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: false, free: true, plan: 'free', customerId: created.id });
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(cookieValue(res, COOKIE_NAME))}`;

    const session = makeRes();
    await sessionHandler(makeReq({ cookie }), session);
    expect(session.body).toMatchObject({ active: false, free: true, customerId: created.id });

    const ai = makeRes();
    await compatibleHandler(makeReq({ method: 'POST', cookie, body: { payload: { messages: [] } } }), ai);
    expect(ai.statusCode).toBe(402);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('login por senha sem assinatura entra no grátis; senha errada não emite sessão', async () => {
    const { salt, hash } = hashPassword('SenhaCerta123!');
    const customer = { id: FREE.id, email: FREE.email, metadata: { vc_pw_salt: salt, vc_pw_hash: hash } };
    stripeMock.customers.list.mockResolvedValue({ data: [customer], has_more: false });
    stripeMock.customers.retrieve.mockResolvedValue(customer);

    const wrong = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: { email: FREE.email, password: 'SenhaErrada123!' } }), wrong);
    expect(wrong.statusCode).toBe(401);
    expect(cookieValue(wrong, COOKIE_NAME)).toBeNull();

    const ok = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: { email: FREE.email, password: 'SenhaCerta123!' } }), ok);
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({ active: false, free: true, plan: 'free', customerId: FREE.id });
    expect(cookieValue(ok, COOKIE_NAME)).toBeTruthy();
  });
});

describe('plano grátis — o servidor recusa tudo o que é pago (402)', () => {
  const rotas = [
    ['texto com IA (/api/ai/compatible)', compatibleHandler, { method: 'POST', body: { payload: { messages: [{ role: 'user', content: 'oi' }] } } }],
    ['texto com chave própria (/api/ai/compatible)', compatibleHandler, { method: 'POST', body: { apiKey: 'sk-chave-do-usuario', provider: 'openai', payload: { messages: [] } } }],
    ['leitura de imagem (/api/ai/ocr)', ocrHandler, { method: 'POST', body: { image: 'data:image/png;base64,AAAA' } }],
    ['imagem gerada (/api/ai/sjinn-image)', sjinnHandler, { method: 'POST', body: { prompt: 'um gato', requestId: 'req-gratis-1' } }],
    ['Claude (/api/anthropic/v1/messages)', anthropicHandler, { method: 'POST', body: {} }],
    ['Claude com chave própria', anthropicHandler, { method: 'POST', body: {}, headers: { 'x-anthropic-key': 'sk-ant-do-usuario' } }],
    ['importar de link (/api/fetch-source)', fetchSourceHandler, { method: 'POST', body: { url: 'https://example.com/artigo' } }],
    ['listar projetos da conta (/api/projects)', projectsHandler, { method: 'GET', url: '/api/projects', headers: { 'x-project-owner': FREE.id } }],
    ['gravar projeto na conta (/api/projects)', projectsHandler, { method: 'PUT', url: '/api/projects?id=p1', headers: { 'x-project-owner': FREE.id }, body: { entry: { id: 'p1' }, baseVersion: 0 } }],
    ['biblioteca na nuvem (/api/library-sync)', librarySyncHandler, { method: 'GET', url: '/api/library-sync' }],
    ['enviar biblioteca (/api/library-sync)', librarySyncHandler, { method: 'POST', url: '/api/library-sync', body: { action: 'push', manifest: { docs: [] } } }],
    ['metadados da conta (/api/account-library-meta)', accountMetaHandler, { method: 'GET', url: '/api/account-library-meta', headers: { 'x-account-owner': FREE.id } }],
    ['compartilhar por código (/api/project-share)', projectShareHandler, { method: 'POST', url: '/api/project-share', body: { action: 'create', doc: { slides: [] } } }],
    ['abrir código de equipe (/api/project-share)', projectShareHandler, { method: 'GET', url: '/api/project-share?code=ABCDEFGH' }],
    ['criar chave de agente (/api/agent-access)', agentAccessHandler, { method: 'POST', url: '/api/agent-access', headers: { 'content-type': 'application/json' }, body: { action: 'create' } }],
    ['listar chaves de agente (/api/agent-access)', agentAccessHandler, { method: 'GET', url: '/api/agent-access' }],
  ];

  it.each(rotas)('%s', async (_nome, handler, req) => {
    const res = makeRes();
    await handler(makeReq({ ...req, cookie: freeCookie(), headers: { origin: 'https://moont.ai', ...(req.headers || {}) } }), res);
    expect(res.statusCode).toBe(402);
    expect(JSON.stringify(res.body)).toMatch(/Assinatura inativa/);
    // Nenhuma chamada a provedor de IA, a site de terceiro ou a armazenamento.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('as mesmas rotas, sem sessão nenhuma, respondem 401 (não confundem anônimo com grátis)', async () => {
    for (const [nome, handler, req] of rotas) {
      const res = makeRes();
      // eslint-disable-next-line no-await-in-loop
      await handler(makeReq({ ...req, headers: { origin: 'https://moont.ai', ...(req.headers || {}) } }), res);
      expect(res.statusCode, nome).toBe(401);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('conta grátis pode abrir o portal do cliente e iniciar a assinatura', async () => {
    const portal = makeRes();
    await portalHandler(makeReq({ method: 'POST', cookie: freeCookie() }), portal);
    expect(portal.statusCode).toBe(200);
    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: FREE.id }),
    );
    vi.stubEnv('STRIPE_PRICE_ID_ESSENTIAL', 'price_test_essencial');
    const checkout = makeRes();
    await checkoutHandler(makeReq({
      method: 'POST', cookie: freeCookie(), body: { email: FREE.email, tier: 'essential' },
    }), checkout);
    expect(checkout.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0]).toMatchObject({
      customer: FREE.id, line_items: [{ price: 'price_test_essencial', quantity: 1 }],
    });
  });
});
