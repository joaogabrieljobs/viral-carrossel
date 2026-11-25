import { afterEach, describe, expect, it, vi } from 'vitest';
import * as audit from '../../src/utils/image-audit.js';

// Spec 1.1, entrega 5: uma chamada por geração, sem laço, atrás da flag. A
// auditoria só aponta; nenhuma imagem é gerada por ela. Nenhum teste chama IA:
// fetch e resposta do modelo são simulados.
const plan = { rules: [
  { id: 'r1', level: 'avoid', target: 'image', instruction: 'Sem máscara ou plumas de carnaval' },
  { id: 'r2', level: 'avoid', target: 'copy', instruction: 'Sem clichês' },
] };
const slides = [
  { id: 's1', title: 'Apoteose, o esquenta' },
  { id: 's2', title: 'Carnaval como comportamento, não como fantasia' },
  { id: 's3', title: 'Para quem faz a festa' },
];
const images = [
  { slideId: 's2', dataUrl: 'data:image/png;base64,AAA' },
  { slideId: 's3', dataUrl: 'data:image/png;base64,BBB' },
];
const finding = { slide: 2, ruleId: 'r1', evidence: 'Mulher com máscara dourada e plumas azuis' };
const mosaic = { dataUrl: 'data:image/jpeg;base64,MOSAICO', width: 1024, height: 288, slides: [{ slideId: 's2', slideIndex: 1 }, { slideId: 's3', slideIndex: 2 }] };

function spies(response = JSON.stringify({ findings: [finding] })) {
  return {
    buildMosaic: vi.fn(async () => mosaic),
    transport: vi.fn(async () => response),
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('spec 1.1 entrega 5 — fluxo da auditoria de imagem', () => {
  it('flag desligada não chama nada: nem mosaico, nem modelo, nem rede', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const s = spies();
    const result = await audit.runImageAudit?.({ enabled: false, plan, slides, images, model: 'modelo-teste', ...s });
    expect(result).toEqual({ status: 'disabled', findings: [] });
    expect(s.buildMosaic).not.toHaveBeenCalled();
    expect(s.transport).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sem modelo que leia imagem configurado, não monta mosaico nem chama a IA', async () => {
    expect(audit.IMAGE_AUDIT_MODEL).toBe('');
    const s = spies();
    const result = await audit.runImageAudit?.({ enabled: true, plan, slides, images, ...s });
    expect(result).toMatchObject({ status: 'unavailable', reason: 'model_not_configured', findings: [] });
    expect(s.buildMosaic).not.toHaveBeenCalled();
    expect(s.transport).not.toHaveBeenCalled();
  });

  it('roteiro sem rule de imagem ou deck sem imagem gerada não gasta pedido', async () => {
    const s = spies();
    expect(await audit.runImageAudit?.({ enabled: true, plan: { rules: [plan.rules[1]] }, slides, images, model: 'm', ...s }))
      .toMatchObject({ status: 'skipped', reason: 'no_image_rules' });
    expect(await audit.runImageAudit?.({ enabled: true, plan, slides, images: [], model: 'm', ...s }))
      .toMatchObject({ status: 'skipped', reason: 'no_images' });
    expect(await audit.runImageAudit?.({ enabled: true, plan, slides, images: [{ slideId: 'apagado', dataUrl: 'data:image/png;base64,X' }], model: 'm', ...s }))
      .toMatchObject({ status: 'skipped', reason: 'no_images' });
    expect(s.transport).not.toHaveBeenCalled();
  });

  it('uma chamada só com o mosaico, os títulos e as rules de imagem; devolve achados validados', async () => {
    const s = spies();
    const result = await audit.runImageAudit?.({ enabled: true, plan, slides, images, model: 'modelo-teste', ...s });
    expect(s.buildMosaic).toHaveBeenCalledTimes(1);
    expect(s.buildMosaic.mock.calls[0][0]).toEqual([
      { slideId: 's2', slideIndex: 1, dataUrl: images[0].dataUrl },
      { slideId: 's3', slideIndex: 2, dataUrl: images[1].dataUrl },
    ]);
    expect(s.transport).toHaveBeenCalledTimes(1);
    const [messages, options] = s.transport.mock.calls[0];
    expect(options.model).toBe('modelo-teste');
    const user = messages.find(message => message.role === 'user');
    const prompt = user.content.find(part => part.type === 'text').text;
    expect(prompt).toContain('Slide 2: Carnaval como comportamento, não como fantasia');
    expect(prompt).toContain('Slide 3: Para quem faz a festa');
    expect(prompt).not.toContain('Slide 1:');
    expect(prompt).toContain('r1');
    expect(prompt).toContain('Sem máscara ou plumas de carnaval');
    expect(prompt).not.toContain('Sem clichês');
    expect(user.content.filter(part => part.type === 'image_url')).toEqual([{ type: 'image_url', image_url: { url: mosaic.dataUrl } }]);
    expect(result).toEqual({ status: 'done', findings: [{
      slideId: 's2', slideIndex: 1, ruleId: 'r1', level: 'avoid', rule: 'Sem máscara ou plumas de carnaval', evidence: finding.evidence,
    }] });
  });

  it('auditoria com achado não dispara nenhuma geração de imagem: um pedido de texto e mais nada', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true, status: 200, headers: { get: () => null },
      text: async () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ findings: [finding] }) } }] }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await audit.runImageAudit?.({ enabled: true, plan, slides, images, model: 'modelo-teste', buildMosaic: async () => mosaic });
    expect(result.findings).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/ai/compatible');
    const body = JSON.parse(init.body);
    // Pedido de texto (conta 1 na cota diária de texto em api/ai/compatible.js), nunca de imagem.
    expect(body).toMatchObject({ provider: 'zai', operation: 'chat' });
    expect(body.payload).toMatchObject({ model: 'modelo-teste', response_format: { type: 'json_object' } });
    expect(body.payload.n).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/images\/generations|"operation":"images"/);
    expect(Object.keys(result).sort()).toEqual(['findings', 'status']);
  });

  it('falha da auditoria não bloqueia nada nem tenta de novo', async () => {
    const transport = vi.fn(async () => { throw Object.assign(new Error('limite'), { code: 'text_quota_exhausted' }); });
    const result = await audit.runImageAudit?.({ enabled: true, plan, slides, images, model: 'm', buildMosaic: async () => mosaic, transport });
    expect(result).toEqual({ status: 'failed', reason: 'text_quota_exhausted', findings: [] });
    expect(transport).toHaveBeenCalledTimes(1);
    const noMosaic = await audit.runImageAudit?.({ enabled: true, plan, slides, images, model: 'm', buildMosaic: async () => null, transport });
    expect(noMosaic).toMatchObject({ status: 'skipped', reason: 'mosaic_unavailable' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('resposta do servidor com erro vira falha, sem achado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, headers: { get: () => null },
      text: async () => JSON.stringify({ error: { message: 'O modelo não está incluído no plano.' } }) })));
    const result = await audit.runImageAudit?.({ enabled: true, plan, slides, images, model: 'm', buildMosaic: async () => mosaic });
    expect(result).toMatchObject({ status: 'failed', findings: [] });
  });
});
