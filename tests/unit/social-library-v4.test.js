import { describe, it, expect } from 'vitest';
import { VISUAL_PRESETS, SOCIAL_FAMILY_PRESETS, applyVisualPreset, getSlideOverridesForPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition, restyleSocialSlides, socialFormatPatch, SOCIAL_COMPOSITION_VERSION } from '../../src/utils/social-visual-composition.js';
import { SOCIAL_FAMILIES, SOCIAL_FAMILY_KEYS, LEGACY_SOCIAL_STYLE_FAMILY, socialCardLayout, socialFamilyFor, SOCIAL_FUNCTIONS, socialPhotoDirection } from '../../src/utils/social-families.js';
import { assignSocialFunctions, NARRATIVE_VISUAL_MATRIX } from '../../src/utils/social-sequence.js';
import { socialChromeElements, socialGround, contrastRatio } from '../../src/utils/social-chrome.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
import { footerChromeReservePct } from '../../src/utils/card-chrome.js';
import { resolvePresetChrome } from '../../src/utils/preset-tokens.js';
import { PRESENTATION_FONT_FACES } from '../../src/utils/presentation-font-manifest.js';

const FORMATOS = ['carrossel', 'quadrado', 'stories'];
const fim = (z) => z.y + z.h;
const cruza = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;

const card = (title, subtitle = '', foto = false, extra = {}) => ({ id: title.slice(0, 12), title, subtitle, bodyAfterImage: '', imageQuery: foto ? 'cena' : '', ...extra });
const sequencia = (carga = 'balanceado') => {
  const longo = carga === 'longo' ? ' Este trecho a mais simula um texto longo para conferir quebras e hierarquia sem cortar palavra alguma do autor.' : '';
  const curto = carga === 'curto';
  return [
    card('A padaria que abriu a cozinha para a rua', curto ? 'Um ensaio.' : `Um ensaio sobre mostrar o processo antes do produto.${longo}`, true),
    card('Durante anos, o balcão escondia o trabalho', curto ? 'O pão chegava pronto.' : `O pão chegava pronto à vitrine. Quem comprava via o resultado e nunca o tempo.${longo}`),
    card('A massa descansa à vista', `A janela da cozinha virou parte da loja.${longo}`, true),
    card('Ver o processo muda a conversa.', ''),
    card('O que mudou', '- A bancada saiu dos fundos\n- O horário ficou na porta\n- O balcão ganhou uma janela'),
    card('O cliente passa a perguntar', `Em vez de comparar etiquetas, as perguntas passam a ser sobre fermentação e forno.${longo}`),
    card('Uma cozinha aberta também é vitrine', curto ? '' : `Salve para quando repensar o seu espaço.${longo}`, true),
  ];
};
const presetDe = (fam) => SOCIAL_FAMILY_PRESETS.find((p) => p.socialFamily === fam);

describe('biblioteca v4 — catálogo', () => {
  it('nove famílias visíveis; doze estilos antigos ocultos e mapeados', () => {
    expect(SOCIAL_FAMILY_KEYS).toHaveLength(9);
    const visiveis = VISUAL_PRESETS.filter((p) => !p.hidden);
    expect(visiveis.map((p) => p.socialFamily)).toEqual(SOCIAL_FAMILY_KEYS);
    const legados = VISUAL_PRESETS.filter((p) => p.legacySocialStyle);
    expect(legados).toHaveLength(12);
    for (const p of legados) {
      expect(p.hidden).toBe(true);
      expect(SOCIAL_FAMILIES[LEGACY_SOCIAL_STYLE_FAMILY[p.id]]).toBeTruthy();
      expect(socialFamilyFor(p.id)).toBe(LEGACY_SOCIAL_STYLE_FAMILY[p.id]);
    }
  });

  it('no máximo duas famílias tipográficas por página e só fontes com face local', () => {
    const locais = new Set(PRESENTATION_FONT_FACES.map((f) => f.family));
    for (const key of SOCIAL_FAMILY_KEYS) {
      const t = SOCIAL_FAMILIES[key].type;
      const nomes = new Set([t.title, t.body, t.label].filter(Boolean).map((v) => v.split(',')[0].replace(/"/g, '')));
      // Rótulo mono da Ficha é da mesma superfamília (IBM Plex).
      const familias = new Set([...nomes].map((n) => n.replace(/ (Mono|Sans)$/, '')));
      expect(familias.size).toBeLessThanOrEqual(2);
      for (const n of nomes) expect(locais.has(n), `${key}: ${n}`).toBe(true);
    }
  });

  it('peso do título existe na fonte (sem negrito sintético)', () => {
    const faixa = (face) => face.weight.split(' ').map(Number);
    for (const key of SOCIAL_FAMILY_KEYS) {
      const t = SOCIAL_FAMILIES[key].type;
      const nome = t.title.split(',')[0].replace(/"/g, '');
      const faces = PRESENTATION_FONT_FACES.filter((f) => f.family === nome && f.style === 'normal');
      const ok = faces.some((f) => { const [a, b = a] = faixa(f); return t.titleWeight >= a && t.titleWeight <= b; });
      expect(ok, `${key} ${nome} ${t.titleWeight}`).toBe(true);
    }
  });

  it('paleta padrão de cada família passa no contraste', () => {
    for (const key of SOCIAL_FAMILY_KEYS) {
      const b = SOCIAL_FAMILIES[key].brand;
      for (const ink of [b.titleColor, b.subtitleColor, b.textColor]) expect(contrastRatio(b.bg, ink)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(b.bg, b.accent)).toBeGreaterThanOrEqual(3);
    }
  });

  it('direção fotográfica de cada família não pede texto, gráfico ou logo à IA de imagem', () => {
    for (const key of SOCIAL_FAMILY_KEYS) {
      const d = socialPhotoDirection(key);
      expect(d.length).toBeGreaterThan(40);
      expect(/\b(logo|gráfico|tabela|título escrito|letreiro com)\b/i.test(d.replace(/sem texto/gi, ''))).toBe(false);
    }
  });
});

describe('biblioteca v4 — geometria em todos os formatos, funções e cargas', () => {
  const casos = [];
  for (const fam of SOCIAL_FAMILY_KEYS) for (const formato of FORMATOS) for (const carga of ['curto', 'balanceado', 'longo']) casos.push([fam, formato, carga]);

  it.each(casos)('%s · %s · %s', (fam, formato, carga) => {
    const preset = presetDe(fam);
    const brand = applyVisualPreset({ name: 'Estúdio', handle: '' }, preset.id);
    const slides = applySocialVisualComposition(sequencia(carga), { preset, brand, formato: 'carrossel' })
      .map((s) => slideForFormatDisplay(s, formato, {}, 'livre'));
    const base = 100 - footerChromeReservePct(resolvePresetChrome(brand), formato);
    for (const s of slides) {
      const { photo, title, subtitle } = s.canvas.zones;
      for (const z of [photo, title, subtitle]) {
        expect(z.x).toBeGreaterThanOrEqual(0); expect(z.y).toBeGreaterThanOrEqual(0);
        expect(z.x + z.w).toBeLessThanOrEqual(100.01); expect(fim(z)).toBeLessThanOrEqual(100.01);
        expect(z.h).toBeGreaterThan(0);
      }
      expect(fim(title)).toBeLessThanOrEqual(base + 0.01);
      expect(fim(subtitle)).toBeLessThanOrEqual(base + 0.01);
      expect(cruza(title, subtitle), `${s.socialArt.archetype} título×apoio`).toBe(false);
      if (s.socialArt.archetype && !['coverBleed', 'photoBleed', 'closingBleed'].includes(s.socialArt.archetype) && photo.w > 2) {
        expect(cruza(photo, title), `${s.socialArt.archetype} foto×título`).toBe(false);
        expect(cruza(photo, subtitle), `${s.socialArt.archetype} foto×apoio`).toBe(false);
      }
      // Pisos de leitura em px num card de 1080 de largura.
      expect(0.028 * s.subSize * 10.8).toBeGreaterThanOrEqual(29.9);
      expect(0.084 * s.titleSize * 10.8).toBeGreaterThanOrEqual(52);
      // Stories: texto fora das faixas da interface.
      if (formato === 'stories') {
        expect(title.y).toBeGreaterThanOrEqual(14 - 0.01);
        expect(fim(subtitle)).toBeLessThanOrEqual(82.01);
      }
      expect(s.socialCompositionVersion).toBe(4);
    }
    // Carga balanceada e curta cabem sem pedir revisão de texto.
    if (carga !== 'longo') expect(slides.filter((s) => s.socialArt.density === 'over').map((s) => s.socialArt.archetype)).toEqual([]);
  });
});

describe('biblioteca v4 — assinatura cheia no rodapé', () => {
  const CHEIA = { footerPillText: 'ARRASTA PRO LADO', footerPillArrow: true, footerBarLeft: 'Tema|Retratos', footerBarCenter: 'Por|Ateliê', footerBarRight: 'Salve|↓' };
  const casos = SOCIAL_FAMILY_KEYS.flatMap((f) => FORMATOS.map((m) => [f, m]));
  it.each(casos)('%s · %s', (fam, formato) => {
    const preset = presetDe(fam);
    const brand = { ...applyVisualPreset({ name: 'Ateliê' }, preset.id), ...CHEIA };
    const base = 100 - footerChromeReservePct(resolvePresetChrome(brand), formato);
    const slides = applySocialVisualComposition(sequencia(), { preset, brand }).map((s) => slideForFormatDisplay(s, formato, {}, 'livre'));
    for (const s of slides) {
      const { title, subtitle } = s.canvas.zones;
      expect(fim(title)).toBeLessThanOrEqual(base + 0.01);
      expect(fim(subtitle)).toBeLessThanOrEqual(base + 0.01);
      expect(cruza(title, subtitle)).toBe(false);
      // Altura mínima de uma linha de apoio (densidade 'ok' confere o resto).
      if (s.subtitle) { expect(subtitle.h).toBeGreaterThanOrEqual(4); expect(s.socialArt.density).toBe('ok'); }
    }
  });
});

describe('biblioteca v4 — sequência e matriz narrativa', () => {
  it('capa, abertura, foto, afirmação, lista e encerramento saem do conteúdo real', () => {
    expect(assignSocialFunctions(sequencia(), { narrative: 'editorial' }))
      .toEqual(['cover', 'opener', 'photo', 'statement', 'list', 'development', 'closing']);
  });
  it('as nove funções narrativas têm linha na matriz', () => {
    for (const k of ['none', 'editorial', 'how_to', 'storytelling', 'viral', 'pain', 'deep', 'jornalistico', 'sensacionalista']) expect(NARRATIVE_VISUAL_MATRIX[k]).toBeTruthy();
  });
  it('comparação só com dados estruturados', () => {
    const s = [card('Capa', 'x', true), card('A', 'b', false, { presentationBlocks: [{ type: 'comparison', headers: ['Antes', 'Depois'], rows: [['Balcão fechado', 'Janela aberta']] }] }), card('Fim', 'x')];
    expect(assignSocialFunctions(s)[1]).toBe('comparison');
    expect(assignSocialFunctions([card('Capa', 'x', true), card('Sem dados', 'Apenas texto corrido de apoio para desenvolver a ideia com calma.'), card('Fim', 'x')])[1]).not.toBe('comparison');
  });
  it('funções declaradas existem', () => {
    for (const fn of SOCIAL_FUNCTIONS) expect(socialCardLayout('revista', fn, { photo: fn === 'photo' }).title).toBeTruthy();
  });
});

describe('biblioteca v4 — conteúdo e escolhas do usuário intactos', () => {
  it('nunca muda texto, foto ou ordem', () => {
    const src = sequencia();
    for (const p of SOCIAL_FAMILY_PRESETS) {
      const out = applySocialVisualComposition(src, { preset: p, brand: applyVisualPreset({}, p.id) });
      out.forEach((s, i) => {
        expect(s.title).toBe(src[i].title); expect(s.subtitle).toBe(src[i].subtitle); expect(s.imageQuery).toBe(src[i].imageQuery);
      });
    }
  });
  it('foto do usuário nunca some (todo card com foto tem área de foto)', () => {
    for (const fam of SOCIAL_FAMILY_KEYS) for (const fn of SOCIAL_FUNCTIONS) for (const formato of FORMATOS) {
      const L = socialCardLayout(fam, fn, { formato, photo: true });
      if (fn !== 'comparison') expect(L.photo, `${fam} ${fn} ${formato}`).toBeTruthy();
    }
  });
  it('card com estilo próprio escolhido no card não é recomposto', () => {
    const p = presetDe('revista');
    const src = sequencia(); src[2] = { ...src[2], visualPresetId: 'social_manchete', socialCompositionVersion: 4, marca: 'manual' };
    const out = applySocialVisualComposition(src, { preset: p, brand: applyVisualPreset({}, p.id) });
    expect(out[2]).toBe(src[2]);
  });
  it('identidade própria: mantém fontes e pesos da marca, recebe a geometria da família', () => {
    const p = presetDe('manchete');
    const marca = { bg: '#FFFFFF', titleColor: '#14213D', subtitleColor: '#14213D', textColor: '#3D4A63', accent: '#C2410C', titleFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"Inter", sans-serif' };
    const out = applySocialVisualComposition(sequencia(), { preset: p, brand: marca });
    for (const s of out) {
      expect(s.socialFamily).toBe('manchete');
      expect(s.titleCase).toBeUndefined();
      expect(s.titleWeight).toBeUndefined();
      expect(s.titleItalic).toBe(false);
    }
  });
  it('padrão personalizado também é composto', () => {
    const custom = { id: 'custom_1', isCustom: true, label: 'Meu', brand: { bg: '#101820', titleColor: '#F2AA4C', titleFont: '"Fraunces", serif' } };
    const out = applySocialVisualComposition(sequencia(), { preset: custom, brand: custom.brand });
    expect(out[0].socialCompositionVersion).toBe(4);
    expect(out[0].socialFamily).toBe('revista');
  });
  it('estilos antigos continuam na v3 (projetos salvos abrem iguais)', () => {
    const legado = VISUAL_PRESETS.find((p) => p.id === 'editorial_magazine');
    const out = applySocialVisualComposition(sequencia(), { preset: legado, brand: applyVisualPreset({}, legado.id) });
    expect(out[0].socialCompositionVersion).toBe(SOCIAL_COMPOSITION_VERSION);
  });
  it('trocar de família recompõe e não deixa cor de chão antiga', () => {
    const a = presetDe('manchete'); const b = presetDe('minimal');
    const comp = applySocialVisualComposition(sequencia(), { preset: a, brand: applyVisualPreset({}, a.id) });
    expect(comp[3].customBg).toBeTruthy();
    const novo = restyleSocialSlides(comp, { preset: b, brand: applyVisualPreset({}, b.id), overrides: getSlideOverridesForPreset(b.id) });
    expect(novo[3].customBg ?? null).toBeNull();
    expect(novo[3].titleColor).toBeUndefined();
    expect(novo.every((s) => s.socialFamily === 'minimal')).toBe(true);
  });
  it('edição por formato vence a recomposição', () => {
    const p = presetDe('grade');
    const [s] = applySocialVisualComposition(sequencia(), { preset: p, brand: applyVisualPreset({}, p.id) });
    const zones = { ...socialFormatPatch(s, 'stories').canvas.zones, title: { x: 10, y: 20, w: 80, h: 20 } };
    const views = { stories: { slides: { [s.id]: { canvas: { ...s.canvas, zones, userEdited: true } } } } };
    const v = slideForFormatDisplay(s, 'stories', views, 'livre');
    expect(v.canvas.zones.title).toEqual({ x: 10, y: 20, w: 80, h: 20 });
  });
});

describe('biblioteca v4 — dispositivos gráficos', () => {
  it('chão invertido e de acento mantêm contraste ≥ 4,5', () => {
    for (const key of SOCIAL_FAMILY_KEYS) {
      const brand = applyVisualPreset({}, presetDe(key).id);
      for (const g of ['bg', 'inverse', 'inverseDark', 'accent', 'surface']) {
        const inks = socialGround(brand, g);
        expect(contrastRatio(inks.bg, inks.ink), `${key} ${g}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('sem marca cadastrada, rótulos com {marca} não aparecem vazios', () => {
    const els = socialChromeElements({ chrome: [{ t: 'text', x: 0, y: 0, w: 50, text: '{marca}', size: 20 }, { t: 'text', x: 0, y: 0, w: 50, text: '§{n} · {marca?}', size: 20 }], ground: 'bg' },
      { frame: { w: 1080, h: 1350 }, brand: {}, tokens: { n: '01', total: '07', marca: '' } });
    expect(els.map((e) => e.text)).toEqual(['§01']);
  });
  it('rótulos do topo saem do canto da logo', () => {
    const p = presetDe('minimal');
    const brand = { ...applyVisualPreset({}, p.id), logo: 'data:x', logoPosition: 'tr' };
    const out = applySocialVisualComposition(sequencia(), { preset: p, brand });
    for (const s of out) for (const d of s.socialArt.chrome) if (d.t === 'text' && d.y < 10) expect(d.x + (d.w ?? 30)).toBeLessThanOrEqual(66);
  });
});

import { buildSocialSequencePrompt } from '../../src/utils/social-sequence.js';
import { composeSceneDirection } from '../../src/utils/visual-bible.js';

describe('biblioteca v4 — prompts', () => {
  it('direção fotográfica da família chega ao pedido real de imagem', () => {
    const p = presetDe('documental');
    const [capa] = applySocialVisualComposition(sequencia(), { preset: p, brand: applyVisualPreset({}, p.id) });
    const cena = composeSceneDirection({ slide: capa, fmt: 'carrossel' });
    expect(cena).toContain('PHOTOGRAPHIC LANGUAGE');
    expect(cena).toContain(SOCIAL_FAMILIES.documental.photo.directionEn);
    expect(composeSceneDirection({ slide: { title: 'x' } })).not.toContain('PHOTOGRAPHIC LANGUAGE');
  });
  it('bloco de sequência não aumenta limites nem pede texto na imagem', () => {
    const txt = buildSocialSequencePrompt({ family: 'revista', narrative: 'how_to' });
    expect(txt).toContain(NARRATIVE_VISUAL_MATRIX.how_to.rhythm);
    expect(txt).toMatch(/não invente oferta/);
    expect(txt).toMatch(/Nunca escreva texto, título, gráfico, tabela ou logo para a imagem/);
    expect(buildSocialSequencePrompt({ family: null })).toBe('');
  });
  it('trocar de família não muda o pacote criativo', () => {
    for (const p of SOCIAL_FAMILY_PRESETS) expect(p.creativePreset).toBeUndefined();
  });
});

describe('biblioteca v4 — arquétipos', () => {
  it('todo arquétipo, em todo formato, reserva ao menos 10% para o apoio e 10% para o título', () => {
    for (const fam of SOCIAL_FAMILY_KEYS) for (const fn of SOCIAL_FUNCTIONS) for (const formato of FORMATOS) for (const photo of [true, false]) for (const variant of [0, 1]) {
      const L = socialCardLayout(fam, fn, { formato, photo, variant });
      expect(L.subtitle.h, `${fam} ${fn} ${formato} ${L.archetype}`).toBeGreaterThanOrEqual(10);
      expect(L.title.h, `${fam} ${fn} ${formato} ${L.archetype}`).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('biblioteca v4 — palavras inteiras e logo no topo', () => {
  it('o corpo do título deixa a palavra mais longa caber na caixa', () => {
    for (const fam of SOCIAL_FAMILY_KEYS) for (const formato of FORMATOS) {
      const preset = presetDe(fam);
      const src = [card('Capa', 'x', true), card('Camadas', 'A tinta seca entre uma visita e outra.', true), card('Desproporcionalmente', 'Palavra longa sozinha.'), card('Fim', 'x', true)];
      const out = applySocialVisualComposition(src, { preset, brand: applyVisualPreset({}, preset.id) }).map((s) => slideForFormatDisplay(s, formato, {}, 'livre'));
      for (const s of out) {
        const px = 1080 * 0.084 * s.titleSize / 100;
        const largura = (s.canvas.zones.title.w / 100) * 1080 * 0.94;
        const palavra = Math.max(...s.title.split(/\s+/).map((w) => w.length));
        // Larguras medidas (ver CHAR_WIDTH) + margem de palavra.
        const cw = { revista: 0.49, manchete: 0.43, grade: 0.53, documental: 0.36, produto: 0.48, ficha: 0.49, minimal: 0.47, poster: 0.6, cinema: 0.48 }[fam] * 1.1;
        expect(palavra * px * cw, `${fam} ${formato} "${s.title}"`).toBeLessThanOrEqual(largura);
      }
    }
  });
  it('logo no topo empurra o conteúdo para baixo da faixa dela', () => {
    const p = presetDe('grade');
    const brand = { ...applyVisualPreset({}, p.id), logo: 'data:x', logoPosition: 'tl', logoSize: 150 };
    const out = applySocialVisualComposition(sequencia(), { preset: p, brand });
    const faixa = ((1080 * 0.045 + 150) / 1350) * 100;
    for (const s of out) {
      const { title, photo } = s.canvas.zones;
      expect(title.y).toBeGreaterThanOrEqual(faixa);
      if (photo.w > 2 && photo.y > 0) expect(photo.y).toBeGreaterThanOrEqual(faixa);
    }
  });
});

describe('biblioteca v4 — sem itálico sintético nos dispositivos', () => {
  it('rótulo em itálico usa a fonte de título com face itálica real', () => {
    const faces = PRESENTATION_FONT_FACES;
    for (const fam of SOCIAL_FAMILY_KEYS) for (const fn of SOCIAL_FUNCTIONS) {
      const L = socialCardLayout(fam, fn, { photo: true });
      for (const d of L.chrome.filter((x) => x.t === 'text' && x.italic)) {
        expect(d.role, `${fam} ${fn}`).toBe('title');
        const nome = SOCIAL_FAMILIES[fam].type.title.split(',')[0].replace(/"/g, '');
        expect(faces.some((f) => f.family === nome && f.style === 'italic'), nome).toBe(true);
      }
    }
  });
});
