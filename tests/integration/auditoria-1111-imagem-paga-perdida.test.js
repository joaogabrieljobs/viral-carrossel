/** Auditoria 11/11, achado 2: imagem do plano cobrada e perdida.
 *
 *  DEFEITO ABERTO. Os testes abaixo descrevem o comportamento correto e estão
 *  marcados com `it.fails`: passam enquanto o defeito existe e ficam vermelhos
 *  no dia em que a correção entrar (aí basta trocar `it.fails` por `it`). */
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import sjinnHandler from '../../api/ai/sjinn-image.js';
import { resetMemoryQuotas } from '../../api/lib/image-quota.js';

const APP = 'https://moont.ai';
const CUSTOMER = 'cus_imagem_perdida';
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16, 1)]);
const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId: CUSTOMER, email: 'x@teste.exemplo' }))}`;

const json = (payload) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload });
const image = () => ({ ok: true, status: 200, headers: { get: () => 'image/png' }, arrayBuffer: async () => PNG });

async function gerar(operationId) {
  const res = makeRes();
  await sjinnHandler(makeReq({
    method: 'POST', headers: { origin: APP }, cookie,
    body: { prompt: 'uma foto editorial de consultório', operationId },
  }), res);
  return res;
}

beforeEach(() => {
  resetStripeMock();
  resetMemoryQuotas();
  vi.stubEnv('SJINN_API_KEY', 'sjinn-fake-key-123');
  stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...subAtiva(CUSTOMER), metadata: { product:'viral-carrossel', tier: 'creator' } }] });
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(json({ success: true, data: { task_id: 't1' } }))
    .mockResolvedValueOnce(json({ success: true, data: { status: 1, output_urls: ['https://cdn.exemplo/img.png'] } }))
    .mockResolvedValueOnce(image()));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('achado 2: imagem cobrada precisa continuar existindo', () => {
  it('fato de hoje: a primeira chamada gera, cobra 1 crédito e devolve a imagem só na resposta', async () => {
    const first = await gerar('op-resposta-perdida');
    expect(first.statusCode).toBe(200);
    expect(first.body.b64_json).toBe(PNG.toString('base64'));
    expect(first.body.quota.used).toBe(1);
  });

  it.fails('resposta perdida: repetir o mesmo operationId devolve a mesma imagem, sem cobrar de novo', async () => {
    // A rede cai depois de o servidor gerar e cobrar; o cliente repete com o mesmo operationId.
    await gerar('op-resposta-perdida');
    const retry = await gerar('op-resposta-perdida');
    // Hoje: 409 image_operation_replayed, sem imagem, e o crédito segue consumido.
    expect(retry.statusCode).toBe(200);
    expect(retry.body.b64_json).toBe(PNG.toString('base64'));
    expect(retry.body.quota.used).toBe(1);
  });

  it.fails('a imagem pronta fica guardada no servidor antes da resposta (assetId na resposta)', async () => {
    const first = await gerar('op-guardada');
    // Hoje: o servidor não grava a imagem em lugar nenhum; não existe assetId.
    expect(first.body.assetId).toEqual(expect.any(String));
  });

  it.fails('o editor não apaga a imagem recém-paga quando o card mudou', () => {
    const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    const descartes = app.split('if (patchImg.bgImageId) imageDelete(patchImg.bgImageId)').length - 1;
    // Hoje: 3 pontos (geração por card, geração do carrossel, imagens do template) apagam sem aviso.
    expect(descartes).toBe(0);
  });
});
