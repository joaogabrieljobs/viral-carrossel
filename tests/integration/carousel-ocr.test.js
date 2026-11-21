import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeReq, makeRes } from '../helpers/http.js';
import ocrHandler from '../../api/ai/ocr.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

beforeEach(() => {
  process.env.BILLING_DISABLED = 'true';
  delete process.env.VERCEL_ENV;
  process.env.ZAI_API_KEY = 'zai-teste';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BILLING_DISABLED;
  delete process.env.ZAI_API_KEY;
});

describe('/api/ai/ocr', () => {
  it('valida a imagem e devolve somente o texto reconhecido', async () => {
    const upstream = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ md_results: '# CAPA\nUma tese curta e direta.' }),
    });
    vi.stubGlobal('fetch', upstream);
    const req = makeReq({ method: 'POST', body: { image: `data:image/png;base64,${PNG}` } });
    const res = makeRes();
    await ocrHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, text: '# CAPA\nUma tese curta e direta.' });
    const body = JSON.parse(upstream.mock.calls[0][1].body);
    expect(body.model).toBe('glm-ocr');
    expect(body.file).toMatch(/^data:image\/png;base64,/);
  });

  it('recusa conteúdo que não é uma imagem antes do provedor', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const res = makeRes();
    await ocrHandler(makeReq({ method: 'POST', body: { image: 'data:image/png;base64,YQ==' } }), res);
    expect(res.statusCode).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('orienta o fallback local quando a chave do OCR externo expirou', async () => {
    const upstream = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ code: '401', message: 'token expired or incorrect' }),
    });
    vi.stubGlobal('fetch', upstream);
    const req = makeReq({ method: 'POST', body: { image: `data:image/png;base64,${PNG}` } });
    const res = makeRes();
    await ocrHandler(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/aparelho/i);
  });
});

// MOO-29 (a): o provedor cobra a chamada que responde 200, mesmo sem texto.
// Antes, a resposta sem texto era estornada e uma conta podia queimar custo
// da plataforma sem limite. Timeout continua estornado, mas até um teto
// diário por conta (OCR_REFUND_DAILY_LIMIT, padrão 10); depois conta como uso.
describe('/api/ai/ocr — estorno só para falha do provedor, com teto diário', () => {
  const imagem = () => makeReq({ method: 'POST', body: { image: `data:image/png;base64,${PNG}` } });
  let freshHandler;
  beforeEach(async () => {
    // Módulos novos: o 401 do teste anterior deixa o provedor em pausa por 5 min.
    vi.resetModules();
    freshHandler = (await import('../../api/ai/ocr.js')).default;
    const { resetRateLimits } = await import('../../api/lib/rate-limit.js');
    resetRateLimits();
  });
  afterEach(() => {
    delete process.env.OCR_DAILY_LIMIT;
    delete process.env.OCR_REFUND_DAILY_LIMIT;
  });

  it('resposta 200 sem texto conta como uso: a cota acaba e a próxima recebe 429', async () => {
    process.env.OCR_DAILY_LIMIT = '2';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ md_results: '  ' }),
    }));
    for (let i = 0; i < 2; i += 1) {
      const res = makeRes();
      await freshHandler(imagem(), res);
      expect(res.statusCode).toBe(422);
    }
    const res = makeRes();
    await freshHandler(imagem(), res);
    expect(res.statusCode).toBe(429);
  });

  it('timeout é estornado até o teto diário; passando dele, conta como uso', async () => {
    process.env.OCR_DAILY_LIMIT = '3';
    process.env.OCR_REFUND_DAILY_LIMIT = '2';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' })));
    for (let i = 0; i < 5; i += 1) {
      const res = makeRes();
      await freshHandler(imagem(), res);
      expect(res.statusCode).toBe(504);
    }
    // 2 estornados, 3 contados: a cota de 3 acabou.
    const res = makeRes();
    await freshHandler(imagem(), res);
    expect(res.statusCode).toBe(429);
  });

  it('erro do provedor (não 200) continua estornado sem consumir o teto', async () => {
    process.env.OCR_DAILY_LIMIT = '1';
    process.env.OCR_REFUND_DAILY_LIMIT = '1';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => JSON.stringify({ code: '500' }),
    }));
    for (let i = 0; i < 4; i += 1) {
      const res = makeRes();
      await freshHandler(imagem(), res);
      expect(res.statusCode).toBe(502);
    }
  });
});
