// "Salvar padrão" e "Publicar como modelo" capturam a mesma estrutura visual
// (docs/product/publicar-modelo.md, adendo 27/11). Antes, salvar guardava um
// card só (o ativo) e aplicá-lo apagava família, fundo, paleta e composição
// de cada página: capa, miolo e fechamento saíam iguais. Agora o padrão salvo
// leva o modelo do projeto inteiro e aplicar segue o mesmo caminho do
// "Usar modelo" da galeria.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyCustomVisualPresetTemplate,
  captureCustomPresetTemplate,
  packPresetTemplate,
  unpackPresetTemplate,
} from '../../src/utils/custom-preset-template.js';
import {
  CUSTOM_PRESET_TEMPLATES_MAX_BYTES,
  createCustomVisualPreset,
  normalizeCustomVisualPresets,
} from '../../src/utils/custom-visual-presets.js';
import {
  applyTemplateToDoc, buildTemplateContent, sanitizeTemplateContent, templateContentBytes,
} from '../../src/utils/published-template.js';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { PRESENTATION_VISUAL_PRESET_CATALOG } from '../../src/styles/presentation-presets.jsx';
import { VISUAL_PRESETS, applyVisualPreset, getSlideOverridesForPreset } from '../../src/styles/visual-presets.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyFreeSocialDesign } from '../../src/utils/social-free-design.js';
import { restyleSocialSlides } from '../../src/utils/social-visual-composition.js';

const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const palavras = (n, base = 'festa cidade ritmo encontro noite cultura') => {
  let out = '';
  while (out.length < n) out += (out ? ' ' : '') + base;
  return out.slice(0, n).trim();
};
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
/** O que se vê: marca, cards, ajustes por proporção e formato. */
const visual = (doc) => ({ fmt: doc.fmt, brand: doc.brand, slides: doc.slides, formatViews: doc.formatViews ?? null });

const presentationSlides = (prefix, base) => apoteose.slides.map((s, i) => ({
  id: `${prefix}-${i + 1}`,
  title: palavras(s.titulo, base),
  subtitle: palavras(s.apoio, base),
  bodyAfterImage: palavras(s.final, base),
  ...(s.foto ? { bgImage: FOTO, imageQuery: 'editorial photo' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `${n * 12}%`, detail: palavras(55, base) })) }] : [],
  presentationPlan: { visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.' },
}));
const presentationDoc = (presetId, { prefix = 'autora', base, brand } = {}) => applyPresentationVisualPresetToDoc({
  brand: brand || { name: 'Marca da autora', handle: '@autora', accent: '#B4235A', bg: '#101010', titleColor: '#FAFAFA', footerPillText: '@autora' },
  presentationPath: 'auto',
  slides: presentationSlides(prefix, base),
}, presetId);

const socialSlides = (prefix, titles) => titles.map((title, index) => ({
  ...mkSlide(index + 1, DEFAULT_BRAND),
  id: `${prefix}${index}`,
  title,
  subtitle: `Apoio ${index + 1} de ${prefix}.`,
  eyebrow: index ? 'A OFICINA' : '',
  ...(index === 0 ? { bgImageId: `${prefix}-foto`, bgImage: FOTO, imageQuery: 'workshop' } : {}),
}));
const socialFree = (prefix = 'c', titles = ['Uma oficina aberta', 'Uma ideia por vez', 'Outra ideia', 'Participe da conversa']) => {
  const slides = applyFreeSocialDesign(socialSlides(prefix, titles).map((slide, index) => ({
    ...slide,
    socialFreeDesign: { family: index % 2 ? 'editorial' : 'revista', ground: index === 0 ? 'photo' : 'bg', photo: index === 0 ? 'full' : 'none', block: 'none' },
  })), { preset: 'social_free', formato: 'carrossel' });
  return {
    fmt: 'carrossel', productKind: 'carrossel', creativePreset: 'livre', visualPreset: 'social_free',
    brand: { ...DEFAULT_BRAND, name: 'Marca social', handle: '@social', logo: FOTO },
    slides, socialDeckDesign: slides[0].socialDeckDesign, formatViews: {},
  };
};
const socialFixed = (presetId, prefix = 'f', titles = ['Capa forte', 'Ponto um', 'Ponto dois', 'Ponto três', 'Chamada final']) => {
  const preset = VISUAL_PRESETS.find((item) => item.id === presetId);
  const brand = applyVisualPreset({ ...DEFAULT_BRAND, name: 'Marca fixa', handle: '@fixa' }, preset.id);
  return {
    fmt: 'carrossel', productKind: 'carrossel', creativePreset: preset.creativePreset || 'livre', visualPreset: preset.id,
    brand,
    slides: restyleSocialSlides(socialSlides(prefix, titles), {
      preset, brand, formato: 'carrossel', overrides: getSlideOverridesForPreset(preset.id),
    }),
    formatViews: {},
  };
};

/** Compor o deck Livre é caro: cada caso monta origem e destino uma vez e devolve cópias. */
const memo = (build) => { let cached; return () => structuredClone(cached ??= build()); };
const REVISTA = VISUAL_PRESETS.find((item) => item.socialFamily === 'revista').id;
const CASOS = [
  {
    nome: 'apresentação (estilo fixo)', productKind: 'apresentacao',
    origem: memo(() => presentationDoc('presentation_swiss_grid')),
    destino: memo(() => presentationDoc('presentation_editorial_magazine', { prefix: 'destino', base: 'clinica saude cuidado equipe', brand: { name: 'Clínica', handle: '@clinica' } })),
  },
  {
    nome: 'apresentação Livre (presentation_free)', productKind: 'apresentacao',
    origem: memo(() => presentationDoc('presentation_free')),
    destino: memo(() => presentationDoc('presentation_premium_dark', { prefix: 'destino', base: 'clinica saude cuidado equipe', brand: { name: 'Clínica', handle: '@clinica' } })),
  },
  {
    nome: 'carrossel (estilo fixo)', productKind: 'carrossel',
    origem: memo(() => socialFixed(REVISTA)),
    destino: memo(() => socialFixed('minimal_clean', 'd', ['Destino capa', 'Destino 1', 'Destino 2', 'Destino 3', 'Destino 4', 'Destino fim'])),
  },
  {
    nome: 'carrossel Livre (social_free)', productKind: 'carrossel',
    origem: memo(() => socialFree()),
    destino: memo(() => socialFixed('minimal_clean', 'd', ['Destino capa', 'Destino 1', 'Destino 2', 'Destino fim'])),
  },
];

/** Salvar como a interface salva e reler como a biblioteca lê (JSON + normalização). */
const salvar = (doc, productKind) => {
  const preset = createCustomVisualPreset({
    label: 'Meu padrão',
    brand: doc.brand,
    slide: doc.slides[0],
    creativePreset: doc.creativePreset,
    productKind,
    template: captureCustomPresetTemplate(doc),
  });
  const [lido] = normalizeCustomVisualPresets(JSON.parse(JSON.stringify([preset])));
  return lido;
};
/** Publicar como a galeria publica: o servidor reconstrói o modelo por lista permitida. */
const publicar = (doc) => sanitizeTemplateContent(JSON.parse(JSON.stringify(buildTemplateContent(doc))));

describe('salvar padrão reproduz o mesmo que publicar modelo', { timeout: 30_000 }, () => {
  it.each(CASOS.map((caso) => [caso.nome, caso]))('%s: mesma composição (hash) em outro projeto', (_nome, caso) => {
    const preset = salvar(caso.origem(), caso.productKind);
    expect(preset.template, 'o padrão salvo leva o modelo do projeto').toBeTruthy();
    const viaPadrao = applyCustomVisualPresetTemplate(caso.destino(), preset);
    const viaModelo = applyTemplateToDoc(caso.destino(), publicar(caso.origem()));
    expect(viaPadrao).not.toBeNull();
    expect(hash(visual(viaPadrao))).toBe(hash(visual(viaModelo)));
    // O seletor continua marcando o padrão escolhido.
    expect(viaPadrao.visualPreset).toBe(preset.id);
    // Conteúdo do destino continua.
    const destino = caso.destino();
    viaPadrao.slides.forEach((slide, i) => {
      expect(slide.title).toBe(destino.slides[i].title);
      expect(slide.subtitle).toBe(destino.slides[i].subtitle);
      expect(slide.bgImage).toBe(destino.slides[i].bgImage);
    });
    expect(viaPadrao.brand.name).toBe(destino.brand.name);
    expect(viaPadrao.brand.handle).toBe(destino.brand.handle);
  });

  it.each(CASOS.map((caso) => [caso.nome, caso]))('%s: capa, miolo e fechamento continuam diferentes', (_nome, caso) => {
    const origem = caso.origem();
    const preset = salvar(origem, caso.productKind);
    const modelo = unpackPresetTemplate(preset.template);
    expect(modelo.slides.length).toBe(Math.min(origem.slides.length, 10));
    expect(modelo.slides[0].role).toBe('cover');
    expect(modelo.slides.at(-1).role).toBe('closing');
    // Antes: um card só, o ativo; a capa virava o padrão de todos.
    expect(preset.slideDefaults).toBeTruthy();
  });

  it('antes (sem modelo): aplicar o padrão salvo apagava a família e a composição de cada página', () => {
    const origem = presentationDoc('presentation_free');
    const legado = createCustomVisualPreset({ label: 'Antigo', brand: origem.brand, slide: origem.slides[0], creativePreset: 'apresentacao', productKind: 'apresentacao' });
    const reaplicado = applyPresentationVisualPresetToDoc(origem, legado.id, [...PRESENTATION_VISUAL_PRESET_CATALOG, legado]);
    expect(reaplicado.slides.every((slide) => slide.presentationDesignFamily == null)).toBe(true);
    expect(new Set(origem.slides.map((slide) => slide.presentationDesignFamily)).size).toBeGreaterThan(1);
    const comModelo = applyCustomVisualPresetTemplate(origem, salvar(origem, 'apresentacao'));
    expect(comModelo.slides.map((slide) => slide.presentationDesignFamily)).toEqual(origem.slides.map((slide) => slide.presentationDesignFamily));
    expect(comModelo.slides.map((slide) => slide.customBg)).toEqual(origem.slides.map((slide) => slide.customBg));
    expect(comModelo.slides.map((slide) => slide.canvas?.zones)).toEqual(origem.slides.map((slide) => slide.canvas?.zones));
    expect(comModelo.slides.map((slide) => slide.titleSize)).toEqual(origem.slides.map((slide) => slide.titleSize));
  });
});

describe('mesmo contrato do publicar: nada do conteúdo nem da identidade', { timeout: 30_000 }, () => {
  it.each(CASOS.map((caso) => [caso.nome, caso]))('%s', (_nome, caso) => {
    const json = JSON.stringify(salvar(caso.origem(), caso.productKind).template);
    for (const proibido of ['festa cidade', 'Marca da autora', '@autora', '@social', 'Marca social', 'data:image', 'Uma oficina aberta', 'A OFICINA', 'Capa forte', 'editorial photo', 'workshop', '-foto']) {
      expect(json, proibido).not.toContain(proibido);
    }
  });

  it('o formato do destino não muda e o padrão de outro produto não usa o modelo', () => {
    const preset = salvar(presentationDoc('presentation_swiss_grid'), 'apresentacao');
    expect(applyCustomVisualPresetTemplate(socialFixed('minimal_clean'), preset)).toBeNull();
    const social = salvar(socialFree(), 'carrossel');
    expect(applyCustomVisualPresetTemplate(presentationDoc('presentation_swiss_grid'), social)).toBeNull();
    const stories = { ...socialFixed('minimal_clean'), fmt: 'stories' };
    expect(applyCustomVisualPresetTemplate(stories, social).fmt).toBe('stories');
  });
});

describe('guardar o modelo no padrão', { timeout: 30_000 }, () => {
  it('compacta repetições e reabre igual', () => {
    const modelo = sanitizeTemplateContent(buildTemplateContent(presentationDoc('presentation_swiss_grid')));
    const packed = packPresetTemplate(modelo);
    expect(unpackPresetTemplate(packed)).toEqual(modelo);
    expect(JSON.stringify(packed).length).toBeLessThan(templateContentBytes(modelo) / 2);
  });

  it('padrão antigo (sem modelo) continua abrindo e aplicando pelo caminho antigo', () => {
    const antigo = {
      id: 'custom_antigo', label: 'Antigo', desc: 'Padrão visual personalizado salvo por você.', isCustom: true,
      brand: { bg: '#101010', footerPillText: '@minha' }, slideDefaults: { layout: 'bl', eyebrowText: 'NOVO' },
      creativePreset: 'livre', productKind: 'carrossel', aspectRatio: '4:5', savedAt: 1700000000000,
    };
    const [lido] = normalizeCustomVisualPresets([antigo]);
    expect(lido).toEqual(antigo);
    expect(Object.hasOwn(lido, 'template')).toBe(false);
    expect(applyCustomVisualPresetTemplate(socialFixed('minimal_clean'), lido)).toBeNull();
  });

  it('modelo inválido some sem apagar o padrão; normalizar duas vezes dá o mesmo resultado', () => {
    const base = createCustomVisualPreset({ label: 'X', brand: { bg: '#000000' }, slide: { layout: 'mc' }, productKind: 'carrossel' });
    for (const template of ['texto', { v: 2, format: 'carrossel', brand: {}, slides: [{}] }, { v: 1, format: 'carrossel', brand: {}, slides: [] }, { v: 1, format: 'outro', brand: {}, slides: [{}] }]) {
      const [lido] = normalizeCustomVisualPresets([{ ...base, template }]);
      expect(lido.id).toBe(base.id);
      expect(lido.template).toBeUndefined();
    }
    const valido = salvar(presentationDoc('presentation_free'), 'apresentacao');
    const uma = normalizeCustomVisualPresets([valido]);
    expect(normalizeCustomVisualPresets(JSON.parse(JSON.stringify(uma)))).toEqual(uma);
  });

  it('a soma dos modelos guardados respeita o limite da nuvem; os mais recentes ficam completos', () => {
    const template = captureCustomPresetTemplate(presentationDoc('presentation_free'));
    const muitos = Array.from({ length: 24 }, (_, i) => ({
      ...createCustomVisualPreset({ label: `P${i}`, brand: { bg: '#000000' }, slide: {}, productKind: 'apresentacao', template }),
      id: `custom_${i}`, savedAt: i,
    }));
    const lidos = normalizeCustomVisualPresets(muitos);
    expect(lidos).toHaveLength(24);
    const bytes = lidos.reduce((sum, item) => sum + (item.template ? new TextEncoder().encode(JSON.stringify(item.template)).length : 0), 0);
    expect(bytes).toBeLessThanOrEqual(CUSTOM_PRESET_TEMPLATES_MAX_BYTES);
    expect(lidos.at(-1).template).toBeTruthy();
    const comModelo = lidos.map((item) => !!item.template);
    // Sem buracos: só os mais antigos ficam sem modelo.
    expect(comModelo.indexOf(true)).toBeGreaterThan(-1);
    expect(comModelo.slice(comModelo.indexOf(true)).every(Boolean)).toBe(true);
  });
});
