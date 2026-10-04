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
