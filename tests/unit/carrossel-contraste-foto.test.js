// Etapa 2, melhoria 4 do plano do carrossel (26/11/2026): 4,5:1 também para o
// texto sobre a foto e no selo/chapéu. Mesmo mecanismo da apresentação
// (image-composition.js, sideScrim/inkOver): o pior pixel da foto é branco
// atrás de tinta clara; a proteção escura sobe até a tinta ler 4,5:1 e, se nem
// a proteção máxima basta, a tinta clareia o mínimo rumo ao branco. Fonte e
// tamanho não mudam.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition, socialFormatPatch } from '../../src/utils/social-visual-composition.js';
import { SOCIAL_FAMILY_KEYS } from '../../src/utils/social-families.js';
import { VIRAL_STYLE_KEYS } from '../../src/utils/social-viral-styles.js';
import { contrastRatio, socialScrimAlphas, socialChromeElements, socialChromeTokens } from '../../src/utils/social-chrome.js';
import { footerPillColors } from '../../src/utils/card-chrome.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

const deck = JSON.parse(readFileSync(new URL('../fixtures/carrossel-linha-de-base.json', import.meta.url), 'utf8'));
const FORMATOS = ['carrossel', 'quadrado', 'stories'];
const ESTILOS = [...SOCIAL_FAMILY_KEYS, ...VIRAL_STYLE_KEYS];
const presetDe = (e) => VISUAL_PRESETS.find((p) => (SOCIAL_FAMILY_KEYS.includes(e) ? p.socialFamily === e : p.id === e));
const marcaDe = (e, extra = {}) => ({ ...applyVisualPreset({ ...deck.marca }, presetDe(e).id), ...extra });
const cards = () => deck.cards.map(({ papel: _p, ...c }) => ({ ...c }));
const compor = (e, formato, slides = cards(), brand = marcaDe(e)) => applySocialVisualComposition(slides, { preset: presetDe(e), brand, formato, narrative: 'editorial' });

/** Cinza do pior pixel (branco) sob preto com opacidade a. */
const cinza = (a) => { const v = Math.round(255 * (1 - a)).toString(16).padStart(2, '0'); return `#${v}${v}${v}`; };
/** Tinta do título que o card desenha sobre a foto (SlideCardInner: cor do estilo se lê 3:1 no escuro, senão branco). */
const tintaTitulo = (s, brand) => {
  const t = s.titleColor || brand.titleColor;
  return contrastRatio(t, '#111111') >= 3 ? t : '#ffffff';
};
const sobreFoto = (s) => /Bleed/.test(s.socialArt?.archetype || '');
/** Opacidade mínima da proteção atrás do texto: o degradê cai a 90% da força no topo do texto. */
const menorVeu = (s) => socialScrimAlphas(s).strong * 0.9;

describe('contraste sobre a foto: título e apoio leem 4,5:1 no pior pixel', () => {
  const casos = ESTILOS.flatMap((e) => FORMATOS.map((f) => [e, f]));
  it.each(casos)('%s · %s', (estilo, formato) => {
    const brand = marcaDe(estilo);
    const slides = compor(estilo, formato);
    const vistas = compor(estilo, 'carrossel').map((s) => slideForFormatDisplay(s, formato, {}, 'livre'));
    for (const s of [...slides, ...vistas].filter(sobreFoto)) {
      const fundo = cinza(menorVeu(s));
      expect(contrastRatio(tintaTitulo(s, brand), fundo), `${s.id} título`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(s.subtitleColor || '#f5f5f7', fundo), `${s.id} apoio`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('o véu fica abaixo do máximo que o card já desenhava e só sobe onde não lia', () => {
    for (const estilo of ESTILOS) for (const s of compor(estilo, 'carrossel').filter(sobreFoto)) {
      expect(socialScrimAlphas(s).strong).toBeLessThanOrEqual(0.9);
    }
    // Manchete (branco puro) já lia: nada novo gravado.
    for (const s of compor('manchete', 'carrossel').filter(sobreFoto)) expect(s.socialScrimMin).toBeUndefined();
  });

  it('cinematic_hybrid: o vermelho sobre a foto clareia o mínimo, no mesmo matiz', () => {
    const brand = marcaDe('cinematic_hybrid');
    const capa = compor('cinematic_hybrid', 'carrossel')[0];
    expect(capa.titleColor).not.toBe(brand.titleColor);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(capa.titleColor.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    // Card sem foto continua com o vermelho do estilo.
    const semFoto = compor('cinematic_hybrid', 'carrossel')[2];
    expect(semFoto.titleColor ?? brand.titleColor).toBe(brand.titleColor);
  });

  it('cor de título escolhida pela pessoa no card não muda', () => {
    const slides = cards();
    slides[0] = { ...slides[0], titleColor: '#ef4444' };
    const [capa] = compor('cinematic_hybrid', 'carrossel', slides);
    expect(capa.titleColor).toBe('#ef4444');
  });

  it('fonte e tamanho do texto não mudam por causa do contraste', () => {
    for (const estilo of ESTILOS) for (const s of compor(estilo, 'carrossel').filter(sobreFoto)) {
      const semCorrecao = socialFormatPatch({ ...s, socialArt: { ...s.socialArt, photoInks: undefined } }, 'carrossel');
      expect([s.titleSize, s.subSize, s.bodyAfterSize]).toEqual([semCorrecao.titleSize, semCorrecao.subSize, semCorrecao.bodyAfterSize]);
    }
  });

  it('projeto salvo (sem a correção gravada no card) desenha igual em todos os formatos', () => {
    for (const s of compor('sports_editorial', 'carrossel').filter(sobreFoto)) {
      const salvo = { ...s, socialArt: { ...s.socialArt, photoInks: undefined }, socialScrimMin: undefined };
      for (const formato of ['quadrado', 'stories']) expect(socialFormatPatch(salvo, formato).socialScrimMin).toBeUndefined();
    }
  });
});

describe('chapéu e selo leem 4,5:1', () => {
  it.each(FORMATOS)('chapéu da capa do Case Study sobre a foto fica dentro da proteção · %s', (formato) => {
    const brand = marcaDe('case_study_neon');
    const slides = cards();
    slides[0] = { ...slides[0], eyebrowText: 'Estudo de caso' };
    const [capa] = compor('case_study_neon', formato, slides, brand);
    const chapeu = capa.socialArt.chrome.find((d) => d.requires === 'eyebrow');
    expect(chapeu).toBeTruthy();
    expect(capa.socialScrimTop).toBeLessThanOrEqual(chapeu.y - 1);
    const frame = { w: 1080, h: 1350 };
    const el = socialChromeElements(capa.socialArt, { frame, brand, tokens: socialChromeTokens(brand, { slide: capa }), fonts: {} }).find((e) => e.text);
    expect(contrastRatio(el.style.color, cinza(menorVeu(capa)))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ESTILOS)('selo com texto da pessoa · %s', (estilo) => {
    const brand = marcaDe(estilo, { footerPillText: 'SIGA O PERFIL' });
    const { bg, fg } = footerPillColors(brand);
    const por = (rgba, fundo) => {
      const m = /rgba?\(([^)]+)\)/.exec(rgba);
      if (!m) return rgba;
      const [r, g, b, a = 1] = m[1].split(',').map(Number);
      const B = [1, 3, 5].map((i) => parseInt(fundo.slice(i, i + 2), 16));
      return `#${[r, g, b].map((c, i) => Math.round(c * a + B[i] * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
    };
    // Atrás do selo: o fundo do card ou, nos cards de foto em sangria, o pé do degradê.
    const fundos = [brand.bg, ...compor(estilo, 'carrossel', cards(), brand).filter(sobreFoto).map((s) => cinza(socialScrimAlphas(s).base))];
    for (const fundo of fundos) expect(contrastRatio(por(bg, fundo), fg), `${estilo} sobre ${fundo}`).toBeGreaterThanOrEqual(4.5);
  });
});
