// Spec 1.1, conferência visual (25/11), família Tipográfico expressivo.
//
// Defeito 1 (ritmo): no deck Apoteose gerado pelo assistente real, os slides
// 2, 3 e 4 saíram com a mesma geometria (foto 26% à direita, texto na coluna
// x = 4). spec11-cobertura passava porque o deck dela não é o da Apoteose: as
// palavras neutras perdem o espaço final no `trim()`, o apoio do slide 4 fica
// com 253 caracteres e o final com 58, e a leitura (253 + 58 × 0,8 = 299,4)
// não chega ao limite de leitura longa (> 300). Com o texto real (254 e 59 →
// 301,2) o slide 4 vira leitura larga. No Tipográfico a leitura larga põe a
// foto em 70:26 e o texto em x = 4, a mesma geometria da página de conteúdo,
// e toda alternativa com foto (demonstração) também vira leitura larga: o
// slide 4 não tem para onde ir. A regra só olhava as duas anteriores, então o
// slide 3 repetia o 2 e o 4 fechava a trinca.
//
// Defeito 2 (fecho): o fecho do Tipográfico é sem foto por desenho, mas a
// foto que o roteiro pediu chega depois e a vista "restaura" a composição com
// foto. A página de fecho da família não tem zona de foto: a zona inativa
// (96, 94, 1, 1) era desenhada com o tamanho mínimo de zona (8 × 5) e a foto
// aparecia num retângulo de ~150 × 65 px no canto inferior direito. Já
// acontecia em main (e235c41), antes do spec 1.1.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { applyPresentationVisualPresetToSlides, presentationStageAt } from '../../src/utils/presentation-state.js';
import { PRESENTATION_PATHS, getPresentationPath } from '../../src/utils/presentation.js';
import {
  contentAwarePresentationLayout, resolvePresentationCompositionKind, restorePresentationPhotoComposition,
} from '../../src/utils/presentation-composition.js';
import { FAMILY_KEYS, familyFromPresetId, familyLayout } from '../../src/utils/presentation-families.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

const estrutura = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const monolito = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
const PRESETS = PRESENTATION_VISUAL_PRESETS.map(preset => preset.id);
const CAMINHOS = PRESENTATION_PATHS.map(route => route.id);
const TIPOGRAFICO = 'presentation_typographic_bold';
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';

/** Exatamente `n` caracteres, sem espaço nas pontas (o tamanho do texto real). */
const exato = (n) => {
  const s = 'festa cidade ritmo encontro noite cultura brasileira '.repeat(Math.ceil(n / 50) + 1).slice(0, n);
  return s.endsWith(' ') ? `${s.slice(0, -1)}a` : s;
};

/** Slides como o assistente os devolve: texto, pedido de imagem e roteiro. */
const deck = () => estrutura.slides.map((s, i) => ({
  id: `s-${i + 1}`,
  title: exato(s.titulo),
  subtitle: exato(s.apoio),
  bodyAfterImage: s.final ? exato(s.final) : '',
  ...(s.foto ? { imageQuery: 'editorial photo of a carnival warm-up party' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `Valor ${n}`, detail: exato(40) })) }] : [],
  presentationPlan: { visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.' },
}));

const geometria = (slide) => {
  const z = slide.canvas?.zones || {};
  const foto = slide.presentationSuppressPhoto || !z.photo ? 'sem foto' : `${Math.round(z.photo.x)}:${Math.round(z.photo.w)}`;
  return [slide.presentationGround || 'bg', foto, Number(slide.overlay) > 0 ? 'scrim' : '', Math.round(z.title?.x), Math.round(z.subtitle?.x), z.evidence ? 'tabela' : ''].join('|');
};
const trincas = (slides) => slides.map(geometria).flatMap((g, i, all) => (i >= 2 && g === all[i - 1] && g === all[i - 2] ? [i + 1] : []));

/** Montagem do deck na geração, como em handleGenerate (ViralCarrossel.jsx). */
function gerar(preset, pathId, slides) {
  const route = getPresentationPath(pathId);
  const stages = route.stages || [];
  const stageAt = (i, s) => ({
    ...(stages[stages.length <= 1 || slides.length <= 1 ? 0 : Math.round((i * (stages.length - 1)) / (slides.length - 1))] || {}),
    deliveryMode: route.deliveryMode,
    ...(s.presentationPlan ? { visualRole: s.presentationPlan.visualRole, purpose: s.presentationPlan.purpose } : {}),
  });
  const previous = [];
  return slides.map((s, i) => {
    const out = getPresentationCompositionOverrides(preset, {
      slide: s, stage: stageAt(i, s), index: i, count: slides.length, previous,
      next: i + 1 < slides.length ? { slide: slides[i + 1], stage: stageAt(i + 1, slides[i + 1]) } : null,
    });
    previous.push(out);
    return { ...s, ...out };
  });
}

/** Limites pedidos ao modelo, como em presentationLimitsForPlan (ViralCarrossel.jsx). */
function limitesDoPlano(preset, pathId, plan, drafted = []) {
  const route = getPresentationPath(pathId);
  const previous = [];
  const entrada = (entry, index) => ({
    slide: { ...(drafted[index] || {}), presentationPlan: entry, imageQuery: entry.imageBrief ? 'editorial photo' : (drafted[index]?.imageQuery || '') },
    stage: { ...presentationStageAt(pathId, index, plan.slides.length), deliveryMode: route.deliveryMode, visualRole: entry.visualRole },
  });
  return plan.slides.map((entry, index) => {
    const out = getPresentationCompositionOverrides(preset, {
      ...entrada(entry, index), index, count: plan.slides.length, previous,
      next: index + 1 < plan.slides.length ? entrada(plan.slides[index + 1], index + 1) : null,
    });
    previous.push(out);
    return out;
  });
}

describe('defeito 1: ritmo do Tipográfico no deck Apoteose real', () => {
  it('o deck de teste tem o tamanho do texto real: o slide 4 é leitura longa', () => {
    const s4 = deck()[3];
    expect(s4.subtitle).toHaveLength(254);
    expect(s4.bodyAfterImage).toHaveLength(59);
    expect(contentAwarePresentationLayout('content', s4, 'typographic').longReading).toBe(true);
    // Leitura larga do Tipográfico = a mesma geometria da página de conteúdo.
    const larga = contentAwarePresentationLayout('content', s4, 'typographic');
    const normal = familyLayout('typographic', 'content', { photo: true });
    expect([larga.photo.x, larga.photo.w, larga.title.x, larga.subtitle.x]).toEqual([normal.photo.x, normal.photo.w, normal.title.x, normal.subtitle.x]);
  });

  it.each(['auto', 'pitch'])('Tipográfico · %s: geração sem trinca, com as páginas que a família já tem', (pathId) => {
    const slides = gerar(TIPOGRAFICO, pathId, deck());
    expect(trincas(slides), slides.map(geometria).join('\n')).toEqual([]);
    expect(slides.map(s => s.presentationComposition)).toEqual(
      ['cover', 'content', 'demo', 'content', 'content', 'demo', 'content', 'content', 'data', 'closing']);
    // A foto que o roteiro pediu continua em todo slide do miolo.
    slides.forEach((slide, i) => {
      if (i > 0 && i < 9 && estrutura.slides[i].foto) expect(slide.presentationSuppressPhoto, `slide ${i + 1}`).toBe(false);
    });
  });

  it.each(PRESETS.flatMap(preset => CAMINHOS.map(path => [preset, path])))('%s · %s: geração, limites e "aplicar estilo" sem trinca', (preset, path) => {
    const slides = deck();
    const gerado = gerar(preset, path, slides);
    const aplicado = applyPresentationVisualPresetToSlides(slides.map(s => ({ ...s, bgImage: s.imageQuery ? FOTO : undefined })), preset, path);
    expect({ gerado: trincas(gerado), aplicado: trincas(aplicado) }).toEqual({ gerado: [], aplicado: [] });
    // Texto pedido na caixa que o slide terá (o plano já conhece o texto escrito).
    const plan = { slides: slides.map(s => ({ ...s.presentationPlan, imageBrief: s.imageQuery || '' })) };
    expect(limitesDoPlano(preset, path, plan, slides).map(o => o.presentationComposition)).toEqual(gerado.map(s => s.presentationComposition));
  });

  it('a geração e a recuperação passam o slide seguinte; "aplicar estilo" também', () => {
    expect(monolito).toContain('next: i + 1 < nSlides ? { slide: result.slides[i + 1], stage: generationStageAt(i + 1, result.slides[i + 1]) } : null,');
    expect(monolito).toContain('next: index + 1 < plan.slides.length ? planInput(plan.slides[index + 1], index + 1) : null,');
    expect(monolito).toContain('next: index + 1 < snapshot.draft.slides.length ? recoveredInput(snapshot.draft.slides[index + 1], index + 1) : null,');
  });

  it('escolha manual da pessoa não muda: slide movido fica na página de sempre', () => {
    const slides = deck();
    slides[2] = { ...slides[2], elementOffsets: { title: { x: 2, y: 0 } } };
    expect(gerar(TIPOGRAFICO, 'auto', slides)[2].presentationComposition).toBe('content');
  });

  it('projeto salvo não é recomposto: sem vizinhas, a composição é a de sempre', () => {
    const [, , s3, s4] = deck();
    expect(resolvePresentationCompositionKind({ slide: s3, index: 2, count: 10 })).toBe('content');
    expect(resolvePresentationCompositionKind({ slide: s3, index: 2, count: 10, next: { slide: s4 } })).toBe('content');
  });
});
