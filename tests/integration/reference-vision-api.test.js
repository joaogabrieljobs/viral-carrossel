import fs from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
const textQuota = vi.hoisted(() => ({ consume: vi.fn() }));
vi.mock('../../api/lib/text-quota.js', async (importOriginal) => ({
  ...(await importOriginal()), consumeTextCredit: textQuota.consume,
}));

import { makeReq, makeRes } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import { resetActiveAccessCacheForTests } from '../../api/lib/require-access.js';
import { consumeRateLimit, resetRateLimits } from '../../api/lib/rate-limit.js';
import { isPlatformModelAllowed, PLATFORM_MAX_PROMPT_CHARS, PLATFORM_MAX_TOKENS } from '../../shared/ai-models.js';
import handler from '../../api/ai/compatible.js';

const PURPOSE = 'reference_visual_analysis';
const MODEL = 'glm-4.6v';
const png = 'data:image/png;base64,' + fs.readFileSync(new URL('../../public/icon-512.png', import.meta.url)).toString('base64');
const jpeg = 'data:image/jpeg;base64,' + fs.readFileSync(new URL('../../public/style-thumbs/presentation_photo_essay.jpg', import.meta.url)).toString('base64');
const headers = { origin: 'https://moont.ai', 'x-real-ip': '10.8.0.1' };
const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId: 'cus_vision', email: 'fixture@teste.exemplo' }))}`;

const reply = (status = 200, body = { choices: [{ message: { content: '{"schemaVersion":1}' } }] }) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body),
});
function request(images = [png]) {
  return { provider: 'zai', operation: 'chat', purpose: PURPOSE, payload: {
    model: MODEL, max_tokens: 3500, temperature: 0.2,
    thinking: { type: 'disabled' }, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Analise apenas as imagens anexadas.' },
      { role: 'user', content: [{ type: 'text', text: 'Descreva luz, textura, grafismos e relação entre foto e espaço.' },
        ...images.map(url => ({ type: 'image_url', image_url: { url } }))] },
    ],
  } };
}
async function call(body, { authenticated = true, tier = 'essential' } = {}) {
  stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...subAtiva('cus_vision'), metadata: { product: 'viral-carrossel', tier } }] });
  const res = makeRes();
  await handler(makeReq({ method: 'POST', headers, cookie: authenticated ? cookie : null, body }), res);
  return res;
}
const sentPayload = () => JSON.parse(fetch.mock.calls[0][1].body);

beforeEach(() => {
  resetStripeMock();
  resetActiveAccessCacheForTests();
  resetRateLimits();
  vi.stubEnv('ZAI_API_KEY', 'zai-vision-fixture');
  vi.stubEnv('KIMI_API_KEY', 'kimi-vision-fixture');
  vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
  vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
  textQuota.consume.mockReset().mockResolvedValue({ allowed: true, used: 1, limit: 150 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply()));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('análise visual — purpose exclusivo e transporte multimodal limitado', () => {
  it('encaminha PNG/JPEG reais, conteúdo integral e um crédito pelo fluxo autenticado', async () => {
    const body = request([png, jpeg]);
    const res = await call(body);
    expect(res.statusCode).toBe(200);
    expect(textQuota.consume).toHaveBeenCalledExactlyOnceWith({ customerId: 'cus_vision', limit: 150 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.z.ai/api/paas/v4/chat/completions');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer zai-vision-fixture');
    expect(sentPayload()).toEqual({ ...body.payload, n: 1 });
    expect(sentPayload().purpose).toBeUndefined();
  });

  it('conta texto separado das quatro imagens, sem alargar o limite genérico de 120 mil', async () => {
    const body = request([jpeg, jpeg, jpeg, jpeg]);
    expect(JSON.stringify(body.payload.messages).length).toBeGreaterThan(120000);
    expect(jpeg.length).toBeLessThanOrEqual(360000);
    expect((await call(body)).statusCode).toBe(200);
    expect(sentPayload().messages).toEqual(body.payload.messages);
    expect(PLATFORM_MAX_PROMPT_CHARS).toBe(120000);
  });

  it.each([undefined, 0, 999999])('limita a saída de visão a 3500 tokens (pedido %s)', async (tokens) => {
    const body = request(); body.payload.max_tokens = tokens;
    expect((await call(body)).statusCode).toBe(200);
    expect(sentPayload().max_tokens).toBe(3500);
    expect(sentPayload().thinking).toEqual({ type: 'disabled' });
  });

  it('respeita um limite menor e força thinking disabled quando omitido', async () => {
    const body = request(); body.payload.max_tokens = 700; delete body.payload.thinking;
    expect((await call(body)).statusCode).toBe(200);
    expect(sentPayload()).toMatchObject({ max_tokens: 700, thinking: { type: 'disabled' }, n: 1 });
  });

  it.each([
    ['sem purpose', body => { delete body.purpose; }],
    ['purpose inexato', body => { body.purpose += ' '; }],
    ['provider diferente', body => { body.provider = 'kimi'; }],
    ['operação de imagem', body => { body.operation = 'images'; body.apiKey = 'fixture-byok'; }],
    ['modelo de texto no purpose visual', body => { body.payload.model = 'glm-4.7'; }],
  ])('recusa %s antes do crédito e do upstream', async (_label, alter) => {
    const body = request(); alter(body);
    expect((await call(body)).statusCode).toBe(400);
    expect(textQuota.consume).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('mantém o modelo de visão fora da allowlist e dos fallbacks genéricos', async () => {
    const { PLATFORM_TEXT_MODELS, ZAI_FALLBACK_MODELS } = await import('../../shared/ai-models.js');
    expect(isPlatformModelAllowed('zai', MODEL)).toBe(false);
    expect(PLATFORM_TEXT_MODELS.zai).not.toContain(MODEL);
    expect(ZAI_FALLBACK_MODELS).not.toContain(MODEL);
  });
});

describe('análise visual — pedido inválido não consome crédito nem chama rede', () => {
  const badRequests = [
    ['payload array', body => { body.payload = []; }],
    ['sem system', body => { body.payload.messages.shift(); }],
    ['system sem texto', body => { body.payload.messages[0].content = []; }],
    ['system vazio', body => { body.payload.messages[0].content = ' '; }],
    ['mensagem adicional', body => { body.payload.messages.push({ role: 'assistant', content: 'x' }); }],
    ['papéis invertidos', body => { body.payload.messages.reverse(); }],
    ['user em string', body => { body.payload.messages[1].content = 'Sem imagem'; }],
    ['sem texto do user', body => { body.payload.messages[1].content.shift(); }],
    ['texto vazio do user', body => { body.payload.messages[1].content[0].text = ''; }],
    ['segundo texto do user', body => { body.payload.messages[1].content.push({ type: 'text', text: 'outro' }); }],
    ['sem imagem', body => { body.payload.messages[1].content.pop(); }],
    ['cinco imagens', body => { body.payload.messages[1].content.push(...Array.from({ length: 4 }, () => ({ type: 'image_url', image_url: { url: png } }))); }],
    ['URL remota', body => { body.payload.messages[1].content[1].image_url.url = 'https://example.org/ref.png'; }],
    ['URL interna', body => { body.payload.messages[1].content[1].image_url.url = 'http://127.0.0.1/ref.png'; }],
    ['WebP', body => { body.payload.messages[1].content[1].image_url.url = 'data:image/webp;base64,UklGRgwAAABXRUJQVlA4IA=='; }],
    ['MIME não imagem', body => { body.payload.messages[1].content[1].image_url.url = 'data:text/plain;base64,aGVsbG8='; }],
    ['base64 inválido', body => { body.payload.messages[1].content[1].image_url.url = 'data:image/png;base64,###'; }],
    ['bytes sem assinatura', body => { body.payload.messages[1].content[1].image_url.url = 'data:image/png;base64,aGVsbG8='; }],
    ['MIME incompatível com bytes', body => { body.payload.messages[1].content[1].image_url.url = jpeg.replace('image/jpeg', 'image/png'); }],
    ['base64 não canônico', body => { body.payload.messages[1].content[1].image_url.url = jpeg.replace(/=+$/, ''); }],
    ['image_url em string', body => { body.payload.messages[1].content[1].image_url = png; }],
    ['parte de arquivo não suportada', body => { body.payload.messages[1].content[1] = { type: 'file', file: { file_data: png } }; }],
    ['tools', body => { body.payload.tools = []; }],
    ['functions', body => { body.payload.functions = []; }],
    ['tool_choice', body => { body.payload.tool_choice = 'auto'; }],
    ['function_call', body => { body.payload.function_call = 'auto'; }],
    ['stream', body => { body.payload.stream = true; }],
    ['fan-out', body => { body.payload.n = 2; }],
    ['thinking enabled', body => { body.payload.thinking = { type: 'enabled' }; }],
    ['temperatura acima de 1', body => { body.payload.temperature = 1.01; }],
    ['orçamento alternativo não suportado', body => { body.payload.max_completion_tokens = 100000; }],
  ];
  it.each(badRequests)('recusa %s com BYOK também, antes da quota', async (_label, alter) => {
    const body = request(); body.apiKey = 'fixture-byok'; alter(body);
    expect((await call(body)).statusCode).toBe(400);
    expect(textQuota.consume).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('recusa uma imagem de mais de 360 mil caracteres antes do crédito', async () => {
    const body = request(); body.payload.messages[1].content[1].image_url.url = 'data:image/png;base64,' + 'A'.repeat(360000);
    expect((await call(body)).statusCode).toBe(413);
    expect(textQuota.consume).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('aceita exatamente 18 mil caracteres somados e rejeita o próximo antes da quota', async () => {
    const body = request(); body.payload.messages[0].content = 's'.repeat(1000); body.payload.messages[1].content[0].text = 'u'.repeat(17000);
    expect((await call(body)).statusCode).toBe(200);
    textQuota.consume.mockClear(); fetch.mockClear();
    body.payload.messages[1].content[0].text += 'x';
    expect((await call(body)).statusCode).toBe(413);
    expect(textQuota.consume).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uma referência inválida com chave da plataforma não chega à quota', async () => {
    const body = request(['https://example.org/ref.png']);
    expect((await call(body)).statusCode).toBe(400);
    expect(textQuota.consume).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('análise visual — sessão, rate limit, quota e tentativa única', () => {
  it('recusa sessão ausente antes de crédito ou upstream', async () => {
    expect((await call(request(), { authenticated: false })).statusCode).toBe(401);
    expect(textQuota.consume).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it('usa o mesmo limite de 40 pedidos por minuto', async () => {
    for (let i = 0; i < 40; i++) await consumeRateLimit(makeReq({ headers }), { limit: 40, windowMs: 60000, keyPrefix: 'compatible' });
    const res = await call(request());
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(textQuota.consume).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it.each([['essential', 150], ['creator', 400], ['pro', 800], ['max', 800]])('usa o teto existente do plano %s', async (tier, limit) => {
    expect((await call(request(), { tier })).statusCode).toBe(200);
    expect(textQuota.consume).toHaveBeenCalledExactlyOnceWith({ customerId: 'cus_vision', limit });
  });

  it('retém o código de quota esgotada, sem fetch', async () => {
    textQuota.consume.mockResolvedValue({ allowed: false, used: 150, limit: 150 });
    const res = await call(request());
    expect(res.statusCode).toBe(429); expect(res.body.error.code).toBe('text_quota_exhausted');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falha fechada quando a quota está indisponível', async () => {
    textQuota.consume.mockRejectedValue(new Error('fixture quota indisponível'));
    expect((await call(request())).statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('BYOK válido mantém as validações de visão e não consome quota da plataforma', async () => {
    const body = request(); body.apiKey = 'fixture-byok'; body.payload.max_tokens = 9000;
    expect((await call(body)).statusCode).toBe(200);
    expect(textQuota.consume).not.toHaveBeenCalled();
    expect(sentPayload().max_tokens).toBe(3500);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture-byok');
  });

  it.each([[429, '1305'], [503, '1305']])('não repete overload %i/%s nem consome um segundo crédito', async (status, code) => {
    fetch.mockResolvedValue(reply(status, { error: { code, message: 'fixture overload' } }));
    expect((await call(request())).statusCode).toBe(status);
    expect(fetch).toHaveBeenCalledTimes(1); expect(textQuota.consume).toHaveBeenCalledTimes(1);
  });

  it('aborta a tentativa visual em até 90 segundos, sem usar os 240 segundos de texto', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      expect((await call(request())).statusCode).toBe(200);
      expect(timeout).toHaveBeenCalledTimes(1);
      expect(timeout.mock.calls[0][0]).toBeGreaterThan(85000);
      expect(timeout.mock.calls[0][0]).toBeLessThanOrEqual(90000);
    } finally { timeout.mockRestore(); }
  });
});

describe('compatibilidade — texto genérico não recebe exceção multimodal', () => {
  const textRequest = content => ({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', max_tokens: 100000, messages: [{ role: 'user', content }] } });
  it('mantém o teto de 120 mil caracteres e 8192 tokens', async () => {
    expect((await call(textRequest('x'.repeat(120000)))).statusCode).toBe(200);
    expect(sentPayload().max_tokens).toBe(8192); expect(PLATFORM_MAX_TOKENS).toBe(8192);
    textQuota.consume.mockClear(); fetch.mockClear();
    expect((await call(textRequest('x'.repeat(120001)))).statusCode).toBe(413);
    expect(textQuota.consume).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it('não aplica a exceção de bytes a imagens em uma chamada genérica', async () => {
    const body = request([jpeg, jpeg]); delete body.purpose; body.payload.model = 'glm-4.7';
    expect((await call(body)).statusCode).toBe(413);
    expect(textQuota.consume).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it('preserva o BYOK genérico e a lista anterior de modelos', async () => {
    const body = textRequest('x'); body.apiKey = 'fixture-byok'; body.payload.model = 'glm-4-plus';
    expect((await call(body)).statusCode).toBe(200);
    expect(sentPayload().max_tokens).toBe(100000);
    expect(textQuota.consume).not.toHaveBeenCalled();
  });

  it('não restringe modelos de visão no BYOK genérico previamente permitido', async () => {
    const body = request(); delete body.purpose; body.apiKey = 'fixture-byok'; body.payload.max_tokens = 9000;
    expect((await call(body)).statusCode).toBe(200);
    expect(sentPayload().max_tokens).toBe(9000);
    expect(textQuota.consume).not.toHaveBeenCalled();
  });
});
