// Spec 1.1, cobertura (pedido do dono, 25/11): as mudanças do spec 1.1 valem
// na CRIAÇÃO em todos os presets visuais e em todos os templates (caminhos de
// apresentação), não só nos casos medidos até agora (Apoteose no Cinemático,
// Executivo e Editorial). Esta matriz passa cada mudança por cada preset e
// cada caminho que dá para exercitar sem o navegador:
//   1. roteiro v2 (rules, scene, avoid, validação da cena, AVOID na imagem);
//   2. ritmo de layout (nunca a mesma geometria três vezes seguidas);
//   3. frase repetida em 2 slides e eco do título vão ao reparo;
//   4. leitura (descrição das colunas >= 25 px e 4,5:1; apoio cresce);
//   5. referência do kit em todas as imagens, só para o visual, com as cenas
//      dos outros slides no pedido (desfez "só capa e fecho" em 25/11).
// O que ainda não vale e depende de decisão fica em `it.fails`: o teste passa
// enquanto a regra NÃO vale e acusa quando alguém a fizer valer.
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import {
  LEGACY_PRESENTATION_VISUAL_PRESETS, PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides,
} from '../../src/styles/presentation-presets.jsx';
import { applyPresentationVisualPresetToSlides, presentationStageAt } from '../../src/utils/presentation-state.js';
import { PRESENTATION_PATHS, getPresentationPath } from '../../src/utils/presentation.js';
import {
  FAMILY_KEYS, brandPaletteOverrides, familyEvidenceStyle, familyFromPresetId, familyLayout, familySpec,
} from '../../src/utils/presentation-families.js';
import { createCustomVisualPreset } from '../../src/utils/custom-visual-presets.js';
import { applyTemplateToDoc, buildTemplateContent } from '../../src/utils/published-template.js';
import { docAfterReadyTemplate } from '../../src/utils/ready-template.js';
import {
  PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SCHEMA_VERSION, presentationPlanEntryImageQuery,
} from '../../src/utils/presentation-plan.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { buildImagePrompt, IMAGE_PROMPT_TEXT } from '../../shared/image-prompt.js';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const estrutura = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose.json', import.meta.url), 'utf8'));
const monolito = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');

const PRESETS = PRESENTATION_VISUAL_PRESETS.map(preset => preset.id);
const LEGADOS = LEGACY_PRESENTATION_VISUAL_PRESETS.map(preset => preset.id);
const CAMINHOS = PRESENTATION_PATHS.map(route => route.id);
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const palavras = (n) => 'festa cidade ritmo encontro noite cultura brasileira '.repeat(20).slice(0, n).trim();

/**
 * Deck com a estrutura da Apoteose (10 slides; o 9 tem bloco de métricas).
 * roteiro: 'conteudo' (papéis reais da Apoteose), 'demonstracao' (o roteiro
 * pede demo em todo o miolo) ou 'nenhum' (deck sem roteiro: carrossel
 * convertido, projeto antigo; o papel vem da etapa do caminho).
 */
const deck = ({ foto = true, roteiro = 'conteudo' } = {}) => estrutura.slides.map((s, i) => ({
  id: `s-${i + 1}`,
  title: palavras(s.titulo),
  subtitle: palavras(s.apoio),
  bodyAfterImage: palavras(s.final),
  ...(s.foto && foto ? { bgImage: FOTO, imageQuery: 'editorial photo' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `Valor ${n}`, detail: palavras(40) })) }] : [],
  ...(roteiro === 'nenhum' ? {} : {
    presentationPlan: {
      visualRole: roteiro === 'demonstracao' && s.visualRole === 'content' && !s.bloco ? 'demo' : s.visualRole,
      purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.',
    },
  }),
}));

/**
 * O que o olho vê como "mesma página" (a mesma chave da regra de ritmo):
 * chão, lado e largura da foto, texto sobre a foto e coluna do texto. A
 * página de dados com bloco tem também a zona da tabela: conta à parte.
 */
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
  const previous = [];
  return slides.map((s, i) => {
    const stageIndex = stages.length <= 1 || slides.length <= 1 ? 0 : Math.round((i * (stages.length - 1)) / (slides.length - 1));
    const stage = { ...(stages[stageIndex] || {}), deliveryMode: route.deliveryMode, ...(s.presentationPlan ? { visualRole: s.presentationPlan.visualRole, purpose: s.presentationPlan.purpose } : {}) };
    const out = getPresentationCompositionOverrides(preset, { slide: s, stage, index: i, count: slides.length, previous });
    previous.push(out);
    return { ...s, ...out };
  });
}

/** Limites pedidos ao modelo, como em presentationLimitsForPlan (ViralCarrossel.jsx). */
function limitesDoPlano(preset, pathId, plan, drafted = []) {
  const route = getPresentationPath(pathId);
  const previous = [];
  return plan.slides.map((entry, index) => {
    const stage = { ...presentationStageAt(pathId, index, plan.slides.length), deliveryMode: route.deliveryMode, visualRole: entry.visualRole };
    const out = getPresentationCompositionOverrides(preset, {
      slide: { ...(drafted[index] || {}), presentationPlan: entry, imageQuery: presentationPlanEntryImageQuery(entry) },
      stage, index, count: plan.slides.length, previous,
    });
    previous.push(out);
    return out;
  });
}

describe('inventário (spec 1.1, cobertura)', () => {
  it('dez presets oferecidos na criação, um por família; seis legados só para projeto antigo; sete caminhos', () => {
    expect(PRESETS).toHaveLength(10);
    expect(PRESETS.map(familyFromPresetId).sort()).toEqual([...FAMILY_KEYS].sort());
    expect(LEGADOS).toHaveLength(6);
    expect(CAMINHOS).toEqual(['auto', 'pitch', 'aula_workshop', 'proposta_comercial', 'relatorio_executivo', 'estudo_de_caso', 'keynote_manifesto']);
  });

  it('todo caminho de criação de apresentação passa pelo roteiro; só "Refazer com tom" (remix) não', () => {
    // Criar rápido, assistente (creationGenerateRef), GenerateModal e "Gerar de novo" chamam handleGenerate sem remix.
    expect(monolito).toContain('presentationPlanning: isPresentationGeneration && !remix,');
    expect(monolito).toContain('creationGenerateRef.current = handleGenerate;');
    expect(monolito).toContain('onGenerate={handleGenerate}');
    expect(monolito.match(/remix: true/g)).toHaveLength(1);
    expect(monolito).toContain('...prev, tone: blendedTone, count: slides.length, remix: true,');
  });

  it('template pronto vira carrossel: as regras da apresentação não se aplicam a ele', () => {
    const doc = docAfterReadyTemplate({ fmt: 'apresentacao', productKind: 'apresentacao' }, { slides: [], brand: {}, creativePreset: 'livre' });
    expect(doc).toMatchObject({ productKind: 'carrossel', fmt: 'carrossel', visualPreset: null });
    // O botão "Templates prontos" nem aparece no deck.
    expect(monolito).toContain("{!isMobile && activeProductKind !== 'apresentacao' && editorIconBtn({\n        onClick: () => setTemplatesOpen(true),");
  });
});

describe('mudança 2, ritmo: todo preset, todo caminho', () => {
  const variantes = [true, false].flatMap(foto => ['conteudo', 'demonstracao'].map(roteiro => ({ foto, roteiro })));

  it.each(PRESETS.flatMap(preset => CAMINHOS.map(path => [preset, path])))('%s · %s: geração e "aplicar estilo" sem trinca', (preset, path) => {
    const falhas = variantes.flatMap(({ foto, roteiro }) => {
      const nome = `${foto ? 'com' : 'sem'} foto, roteiro ${roteiro}`;
      const gerado = trincas(gerar(preset, path, deck({ foto, roteiro })));
      const aplicado = trincas(applyPresentationVisualPresetToSlides(deck({ foto, roteiro }), preset, path));
      return [...(gerado.length ? [`geração (${nome}): ${gerado}`] : []), ...(aplicado.length ? [`aplicar estilo (${nome}): ${aplicado}`] : [])];
    });
    expect(falhas).toEqual([]);
  });

  it.each(PRESETS.flatMap(preset => CAMINHOS.map(path => [preset, path])))('%s · %s: texto pedido na caixa que o slide terá', (preset, path) => {
    const slides = deck({ roteiro: 'demonstracao' });
    const plan = { slides: slides.map(slide => slide.presentationPlan) };
    const pedidos = limitesDoPlano(preset, path, plan, slides).map(out => out.presentationComposition);
    expect(pedidos).toEqual(gerar(preset, path, slides).map(slide => slide.presentationComposition));
  });

  it.each(PRESETS.flatMap(preset => CAMINHOS.map(path => [preset, path])))('%s · %s: deck sem roteiro, "aplicar estilo" sem trinca', (preset, path) => {
    const falhas = [true, false].flatMap((foto) => {
      const aplicado = trincas(applyPresentationVisualPresetToSlides(deck({ foto, roteiro: 'nenhum' }), preset, path));
      return aplicado.length ? [`${foto ? 'com' : 'sem'} foto: ${aplicado}`] : [];
    });
    expect(falhas).toEqual([]);
  });

  it.each(LEGADOS.flatMap(preset => CAMINHOS.map(path => [preset, path])))('legado %s · %s: "Gerar de novo" em projeto antigo sem trinca', (preset, path) => {
    const falhas = [true, false].flatMap((foto) => {
      const gerado = trincas(gerar(preset, path, deck({ foto })));
      return gerado.length ? [`${foto ? 'com' : 'sem'} foto: ${gerado}`] : [];
    });
    expect(falhas).toEqual([]);
  });

  it('a página alternada mantém a foto que o roteiro pediu, em todo preset e caminho', () => {
    // Capa e fecho não entram no rodízio (o fecho do Tipográfico é sem foto por desenho).
    const perdidas = PRESETS.flatMap(preset => CAMINHOS.flatMap(path => gerar(preset, path, deck({ roteiro: 'demonstracao' }))
      .flatMap((slide, i) => (i > 0 && i < 9 && estrutura.slides[i].foto && !estrutura.slides[i].bloco && slide.presentationSuppressPhoto ? [`${preset} ${path} slide ${i + 1}`] : []))));
    expect(perdidas).toEqual([]);
  });

  // Preset personalizado: a geração não compõe (compositionOverrides = {}) e
  // "aplicar estilo" põe a zona salva pela pessoa em todo slide. Não há família
  // de onde tirar outra página; alternar seria inventar layout ou desfazer a
  // escolha da pessoa. Decisão do dono.
  it.fails('LACUNA ABERTA (decisão): preset personalizado salvo repete a mesma geometria', () => {
    const [modelo] = applyPresentationVisualPresetToSlides(deck().slice(1, 2), 'presentation_cinematic', 'auto');
    const custom = { ...createCustomVisualPreset({ label: 'Meu deck', brand: {}, slide: modelo, productKind: 'apresentacao' }), id: 'custom_teste' };
    const slides = applyPresentationVisualPresetToSlides(deck(), custom.id, 'auto', [custom]);
    expect(trincas(slides)).toEqual([]);
  });

  // Modelo da galeria: a capa vai no primeiro, o fecho no último e os cards de
  // conteúdo do modelo se repetem no meio. Com um só card de conteúdo no
  // modelo, todo o miolo sai igual. Alternar pede uma página que o modelo não tem.
  it.fails('LACUNA ABERTA (decisão): modelo da galeria com um card de conteúdo repete a geometria no miolo', () => {
    const origem = applyPresentationVisualPresetToSlides(deck().slice(0, 3), 'presentation_cinematic', 'auto');
    const modelo = buildTemplateContent({ fmt: 'apresentacao', brand: {}, slides: origem });
    const doc = applyTemplateToDoc({ fmt: 'apresentacao', slides: applyPresentationVisualPresetToSlides(deck(), 'presentation_cinematic', 'auto') }, modelo);
    expect(trincas(doc.slides)).toEqual([]);
  });
});

describe('mudança 4, leitura: descrição das colunas com a cor da marca', () => {
  const DETALHES = ['Curadoria de público fortalece a festa', 'Remixes sem fronteiras rígidas', 'Identidade própria que gera desejo'];
  const blocos = {
    métricas: [{ type: 'metrics', items: DETALHES.map((detail, i) => ({ label: `Rótulo ${i + 1}`, value: `Valor ${i + 1}`, detail })) }],
    etapas: [{ type: 'steps', items: DETALHES.map((body, i) => ({ title: `Etapa ${i + 1}`, body })) }],
  };
  const estilo = attrs => Object.fromEntries((attrs.match(/style="([^"]*)"/)?.[1] || '').split(';').filter(Boolean).map((par) => {
    const i = par.indexOf(':');
    return [par.slice(0, i), par.slice(i + 1)];
  }));
  const hex = (value) => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
    if (m) return m[1];
    const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(String(value || ''));
    return rgb ? rgb.slice(1, 4).map(n => Number(n).toString(16).padStart(2, '0')).join('') : null;
  };
  const efetiva = (cor, superficie, opacidade = 1) => {
    const a = hex(cor); const b = hex(superficie);
    return '#' + [0, 2, 4].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * opacidade + parseInt(b.slice(i, i + 2), 16) * (1 - opacidade))
      .toString(16).padStart(2, '0')).join('');
  };
  // "Usar somente minha identidade": fundo e tinta vêm da marca, não da família.
  const MARCAS = {
    'marca clara com texto cinza': { bg: '#FFFFFF', textColor: '#8C8C8C', accent: '#E4572E' },
    'marca escura com texto apagado': { bg: '#101820', textColor: '#5A6570', accent: '#F2AA4C' },
    'marca creme': { bg: '#F4EFE6', textColor: '#3B3A36', accent: '#1F6F8B' },
  };

  it.each(FAMILY_KEYS.flatMap(family => Object.keys(MARCAS).flatMap(marca => Object.keys(blocos).map(tipo => [family, marca, tipo]))))('%s, %s, %s: >= 25 px e 4,5:1', (family, marca, tipo) => {
    const brand = MARCAS[marca];
    const st = familyEvidenceStyle(family);
    const html = renderToStaticMarkup(React.createElement(PresentationBlocks, {
      blocks: blocos[tipo], rect: { x: 40, y: 33, w: 54, h: 54 }, frame: { w: 1920, h: 1080 }, family, ink: brand.textColor,
      background: brand.bg, fontFamily: 'Barlow', forExport: true, accent: brand.accent, paletteOverrides: brandPaletteOverrides(family, brand),
    }));
    const superficie = st.panel ? st.panelColor : brand.bg;
    for (const texto of DETALHES) {
      const m = html.match(new RegExp(`<span([^>]*)>${texto}</span>`));
      expect(m, texto).toBeTruthy();
      const css = estilo(m[1]);
      const cor = css.color || (st.panel ? st.ink : brand.textColor);
      expect(parseFloat(css['font-size'] || '26')).toBeGreaterThanOrEqual(25);
      expect(wcagContrast(efetiva(cor, superficie, Number(css.opacity ?? 1)), superficie)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('mudança 4, leitura: apoio da página de conteúdo com foto, todo preset e caminho', () => {
  const px = slide => Math.round(slide.subSize / 100 * 1920 * 0.028 * 10) / 10;
  const fotoAoLado = (slide) => {
    const { photo, subtitle } = slide.canvas.zones;
    return slide.presentationComposition === 'content' && !slide.presentationSuppressPhoto && !(Number(slide.overlay) > 0)
      && Math.min(subtitle.x + subtitle.w, photo.x + photo.w) - Math.max(subtitle.x, photo.x) <= 0;
  };

  it.each(PRESETS.flatMap(preset => CAMINHOS.map(path => [preset, path])))('%s · %s: a zona desce até o fim da leitura e o corpo fica entre o da família e 32 px', (preset, path) => {
    const family = familyFromPresetId(preset);
    const corpo = familyLayout(family, 'content', { photo: true }).bodyPx;
    const slides = gerar(preset, path, deck());
    const paginas = slides.filter(fotoAoLado);
    // Nas dez famílias a página de conteúdo põe a foto ao lado do texto.
    expect(paginas.length).toBeGreaterThanOrEqual(3);
    for (const slide of paginas) {
      const { photo, subtitle } = slide.canvas.zones;
      expect(subtitle.y + subtitle.h, slide.id).toBeCloseTo(Math.max(familyLayout(family, 'content', { photo: true }).subtitle.y + familyLayout(family, 'content', { photo: true }).subtitle.h, Math.min(90, photo.y + photo.h)), 1);
      expect(px(slide), slide.id).toBeGreaterThanOrEqual(corpo - 0.5);
      expect(px(slide), slide.id).toBeLessThanOrEqual(32.5);
    }
    // O apoio curto (slide 8, 57 caracteres) sempre cresce acima do corpo da família.
    const curto = slides[7];
    if (fotoAoLado(curto)) expect(px(curto)).toBeGreaterThan(corpo);
  });
});

describe('mudança 5, referência: em todas as imagens, em todo caminho', () => {
  const kit = { stylePrompt: 'Cores e luz da referência anexada.', refImages: [{ id: 'img_ref', name: 'referencia.jpeg', dataUrl: FOTO }] };
  const comCena = slides => slides.map((slide, i) => (slide.imageQuery
    ? { ...slide, presentationPlan: { ...(slide.presentationPlan || {}), scene: { subject: `subject ${i + 1}`, action: 'a', setting: 's', shot: 'wide' } } }
    : slide));
  const pedidos = slides => slides.map((slide, i) => composeImageDirection({ styleKit: kit, slide, fmt: 'apresentacao', baseReferenceCount: 1, presentationPanel: true, deckSlides: slides, slideIndex: i }));
  const todos = (slides, test) => slides.map(test).every(Boolean);

  it.each(PRESETS.flatMap(preset => CAMINHOS.map(path => [preset, path])))('%s · %s: deck com roteiro e deck sem roteiro', (preset, path) => {
    const comRoteiro = comCena(gerar(preset, path, deck()));
    const semRoteiro = applyPresentationVisualPresetToSlides(deck({ roteiro: 'nenhum' }), preset, path);
    for (const slides of [comRoteiro, semRoteiro]) {
      expect(todos(pedidos(slides), d => d.referenceCount === 1 && d.styleReferenceLook === true)).toBe(true);
      const prompt = buildImagePrompt({ scene: 'party', ...pedidos(slides)[3] }, { route: 'sjinn' }).prompt;
      expect(prompt).toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
    }
    // Cenas dos outros só no deck com roteiro v2 (cena no plano).
    expect(pedidos(comRoteiro)[3].otherScenes).toHaveLength(5);
    expect(todos(pedidos(semRoteiro), d => !d.otherScenes)).toBe(true);
  });

  it('preset personalizado e modelo da galeria seguem a mesma regra', () => {
    const custom = { ...createCustomVisualPreset({ label: 'Meu deck', brand: {}, slide: {}, productKind: 'apresentacao' }), id: 'custom_teste' };
    expect(todos(pedidos(applyPresentationVisualPresetToSlides(deck(), custom.id, 'pitch', [custom])), d => d.styleReferenceLook)).toBe(true);
    const origem = applyPresentationVisualPresetToSlides(deck().slice(0, 3), 'presentation_cinematic', 'auto');
    const doc = applyTemplateToDoc({ fmt: 'apresentacao', slides: gerar('presentation_swiss_grid', 'auto', deck()) }, buildTemplateContent({ fmt: 'apresentacao', brand: {}, slides: origem }));
    expect(todos(pedidos(doc.slides), d => d.styleReferenceLook)).toBe(true);
    // A geração do deck manda o kit inteiro e o deck, por formato, não por preset.
    expect(monolito).toContain('deckSlides: isPresentationGeneration || isSocialFreeGeneration ? newSlides : null,');
    expect(monolito).not.toContain('presentationStyleKitForSlide');
  });
});

describe('mudanças 1 e 3: roteiro v2 e repetição, todo caminho, preset oficial e personalizado', () => {
  const sources = [{ id: 'source-base', text: apoteose.presentationPlan.evidence.map(item => item.quote).join('\n') }];
  const subjects = ['city skyline', 'friends toasting', 'confetti-free dance floor', 'street musicians', 'vinyl records on a mixer', 'stylish crowd in line', 'graphic tropical prints', 'rooftop garden', 'empty table', 'guests leaving at sunrise'];
  const mask = { subject: 'woman in golden carnival mask', action: 'looking at the camera', setting: 'night party', shot: 'close-up' };
  const planV2 = () => {
    const plan = structuredClone(apoteose.presentationPlan);
    plan.schemaVersion = PRESENTATION_PLAN_SCHEMA_VERSION;
    plan.promptVersion = PRESENTATION_PLAN_PROMPT_VERSION;
    plan.rules = [{ id: 'r1', level: 'avoid', target: 'image', instruction: 'fantasias, plumas e confetes literais' }];
    plan.slides = plan.slides.map(({ imageBrief, ...slide }, index) => ({
      ...slide, scene: index === 8 ? null : { subject: subjects[index], action: 'talking', setting: 'rooftop at dusk', shot: 'wide' }, avoid: index === 3 ? 'carnival costumes' : '',
    }));
    return plan;
  };
  const comCenaRepetida = () => {
    const plan = planV2();
    [2, 4, 5].forEach((index) => { plan.slides[index].scene = { ...mask }; });
    return plan;
  };
  const presets = [['oficial', 'presentation_cinematic'], ['personalizado', null]];

  it.each(CAMINHOS.flatMap(path => presets.map(([tipo, preset]) => [path, tipo, preset])))('%s, preset %s', async (path, tipo, preset) => {
    const textos = apoteose.slides.map(({ presentationComposition, ...slide }) => ({ ...slide, speakerNotes: '', ...(preset ? {} : { presentationBlocks: [] }) }));
    const ai = vi.fn()
      .mockResolvedValueOnce(comCenaRepetida())
      .mockResolvedValueOnce(planV2())
      .mockResolvedValueOnce({ caption: '', slides: textos.slice(0, 3) })
      .mockResolvedValueOnce({ caption: '', slides: textos.slice(3, 6) })
      .mockResolvedValueOnce({ caption: '', slides: textos.slice(6, 9) })
      .mockResolvedValueOnce({ caption: '', slides: textos.slice(9) })
      .mockResolvedValue({ edits: [] });
    const output = await generateReviewedCarousel({
      prompt: 'Material.',
      config: {
        count: 10, presetId: 'apresentacao', presentationPath: path, presentationPlanning: true, nativeBlocks: !!preset,
        planningContext: { brief: 'Apresentar a Apoteose.', sources },
        // Mesmo contrato do monólito: personalizado devolve null.
        presentationLimitsForPlan: (plan, drafted = []) => (preset ? limitesDoPlano(preset, path, plan, drafted).map((out) => {
          const limits = out.presentationTextLimits || {};
          return { title: limits.title, subtitle: limits.subtitle, bodyAfterImage: limits.body };
        }) : null),
      },
    }, ai);
    const prompts = ai.mock.calls.map(call => call[0]);
    // 1: contrato v2 pedido, cena repetida vai ao reparo do roteiro.
    expect(prompts[0]).toContain('"scene":{"subject":"who or what"');
    expect(prompts[0]).not.toContain('imageBrief');
    expect(prompts[1]).toContain('RECUPERAÇÃO LIMITADA DO PLANEJAMENTO');
    expect(prompts[1]).toContain('scene_repeated');
    // 1: imagem vem da cena e leva o AVOID (regra de imagem do briefing e avoid da posição).
    const slides = output.result.slides;
    expect(slides[3].imageQuery).toBe('street musicians, talking, rooftop at dusk, wide');
    expect(slides[3].presentationPlan).toMatchObject({ avoid: 'carnival costumes', imageRules: ['fantasias, plumas e confetes literais'] });
    const direction = composeImageDirection({ styleKit: apoteose.styleKit, slide: slides[3], fmt: 'apresentacao', presentationPanel: true, presentationFamily: preset || '' });
    expect(buildImagePrompt({ scene: slides[3].imageQuery, ...direction }, { route: 'sjinn' }).prompt).toContain('AVOID (from the brief and this slide plan');
    // 3: frase repetida em dois slides e eco do título vão ao reparo de repetição.
    const reparo = prompts.find(prompt => prompt.includes('REPARO DE REPETIÇÃO')) || '';
    expect(reparo).toContain('Frase repetida em dois slides');
    expect(reparo).toContain('Apoio que termina repetindo o título do próprio slide: slideIndex 9');
  });
});
