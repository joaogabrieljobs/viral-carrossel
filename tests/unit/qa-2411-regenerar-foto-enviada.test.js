import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as readiness from '../../src/utils/image-generation-readiness.js';

// QA 24/11 (editor 7): "Regenerar imagem" num card com foto enviada trocava a
// foto por uma imagem de IA sem perguntar e sem dizer o custo.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
const ask = (slide, options) => readiness.importedPhotoRegenerationPrompt?.(slide, options);
const enviada = { id: 'a', bgImage: 'blob:foto', bgImageId: 'img-1', bgImageSource: 'imported' };

describe('QA 24/11 editor 7 — regenerar imagem em card com foto enviada', () => {
  it('no plano, pede confirmação e diz que usa 1 crédito e quantos restam', () => {
    const message = ask(enviada, { imageQuota: { used: 12, limit: 50, tier: 'creator' } });
    expect(message).toContain('Este card tem uma foto que você enviou.');
    expect(message).toContain('troca essa foto');
    expect(message).toContain('usa 1 crédito de imagem do plano');
    expect(message).toContain('Restam 38 neste ciclo.');
    expect(message).toContain('Cancelar mantém a foto e não usa crédito.');
  });

  it('com chave própria fala da chave e não fala em crédito do plano', () => {
    const message = ask(enviada, { useOwnImageKey: true, imageQuota: { used: 12, limit: 50, tier: 'creator' }, itemLabel: 'slide' });
    expect(message).toContain('Este slide tem uma foto que você enviou.');
    expect(message).toContain('sua chave de imagem');
    expect(message).toContain('cobrança é do provedor da chave');
    expect(message).not.toMatch(/crédito|plano|Restam/);
    expect(message).toContain('Cancelar mantém a foto e não gera nada.');
  });

  it('conta sem limite ou sem saldo confirmado não inventa número', () => {
    expect(ask(enviada, { imageQuota: { used: 4, limit: 50, unlimited: true } })).not.toMatch(/Restam/);
    expect(ask(enviada, { imageQuota: { status: 'unavailable', used: 0, limit: 50 } })).not.toMatch(/Restam/);
    expect(ask(enviada, {})).toContain('usa 1 crédito de imagem do plano');
  });

  it('foto que só está na conta também conta como foto enviada', () => {
    expect(ask({ id: 'b', bgImageAssetId: 'asset-1', bgImageSource: 'imported' }, {})).toContain('foto que você enviou');
  });

  it('imagem de IA, card sem foto e foto removida seguem sem pergunta', () => {
    expect(ask({ id: 'c', bgImage: 'blob:x', bgImageId: 'i', bgImageSource: 'ai' }, {})).toBe('');
    expect(ask({ id: 'd' }, {})).toBe('');
    expect(ask({ id: 'e', bgImageSource: 'imported' }, {})).toBe('');
  });

  it('o editor pergunta antes de marcar o card como gerando e de chamar a IA', () => {
    const from = app.indexOf('const generateSlideImageAt = useCallback');
    const body = app.slice(from, app.indexOf('generateDALLEWithRetry(imageState.query', from));
    const question = body.indexOf('importedPhotoRegenerationPrompt(');
    expect(question, 'a geração avulsa não pergunta').toBeGreaterThan(0);
    expect(question).toBeLessThan(body.indexOf('slideImgGenIdsRef.current.add(slideId)'));
    expect(body).toMatch(/window\.confirm\(importedPhotoQuestion\)/);
    expect(body).toContain("reason: 'imported_photo_kept'");
  });
});
