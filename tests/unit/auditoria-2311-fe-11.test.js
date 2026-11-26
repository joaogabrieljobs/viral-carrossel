import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as readiness from '../../src/utils/image-generation-readiness.js';

// Auditoria 23/11 (FE-11): num segundo aparelho, enquanto as fotos baixam da
// conta (ou quando o download falhou), o card tem `bgImageAssetId` e ainda não
// tem `bgImage`. "Gerar imagens (N)" contava e regerava esses cards: crédito
// gasto à toa ou foto original trocada por uma gerada.
const source = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const sidebar = source('src/components/SidebarContent.jsx');
const app = source('ViralCarrossel.jsx');

const slides = [
  { id: 'baixando', imageQuery: 'vitrine da loja', bgImageAssetId: 'asset-1', bgImage: null },
  { id: 'download-falhou', imageQuery: 'equipe reunida', bgImageAssetId: 'asset-2', bgImage: null, bgImageFailed: true },
  { id: 'pendente', imageQuery: 'produto na mesa', bgImage: null },
  { id: 'com-foto', imageQuery: 'fachada', bgImage: 'blob:foto' },
  { id: 'sem-pedido', imageQuery: '   ', bgImage: null },
  { id: 'so-local', imageQuery: 'detalhe', bgImageId: 'img-local', bgImage: null },
];

describe('auditoria 23/11 FE-11: foto que existe na conta não entra em "Gerar imagens"', () => {
  it('slide {imageQuery, bgImageAssetId, bgImage:null} não entra na contagem nem nos candidatos', () => {
    const pending = readiness.slidesPendingImageGeneration(slides);
    expect(pending.map(item => item.slide.id)).toEqual(['pendente', 'so-local']);
    expect(pending.map(item => item.index)).toEqual([2, 5]);
  });

  it('a seleção restringe os candidatos e não reintroduz foto da conta', () => {
    expect(readiness.slidesPendingImageGeneration(slides, ['baixando', 'pendente']).map(item => item.slide.id)).toEqual(['pendente']);
    expect(readiness.slidesPendingImageGeneration(slides, [])).toHaveLength(2);
    expect(readiness.slidesPendingImageGeneration(null)).toEqual([]);
  });

  it('a contagem do painel e os candidatos do lote usam a mesma regra', () => {
    // Direção de arte, parte 4: a arte de fundo do deck que faltou soma 1 à mesma contagem.
    expect(sidebar).toContain('const pendingImageCreditCount = slidesPendingImageGeneration(slides, selectedSlideIds).length\n');
    const start = app.indexOf('generateMissingImages: async (targetSlideIds = null) => {');
    const end = app.indexOf("trackEvent('criar_rapido_images'", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const candidates = app.slice(start, end);
    expect(candidates).toContain('slidesPendingImageGeneration(slides, targetSlideIds)');
    expect(candidates).not.toContain('.filter(({ s }) => !s.bgImage)');
  });

  it('o Criar rápido não pré-seleciona card com foto na conta', () => {
    expect(source('src/components/panels/CriarRapidoHome.jsx'))
      .toContain('.filter((s) => !(s.bgImage || s.bgImageId || s.bgImageAssetId) && String(s.imageQuery');
  });
});
