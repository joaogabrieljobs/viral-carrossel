// Correções da integração dos 12 estilos (19/11/2026), conferidas nas capturas:
// 1) título sobre foto em sangria tem degradê até o topo do texto;
// 2) fios dos estilos centralizados seguem o centro da coluna do texto;
// 3) Minimal Clean usa os próprios dispositivos, não os da família Minimal da v4;
// 4) fio acima do título não é desenhado sobre a foto.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { VISUAL_PRESETS, applyVisualPreset, getSlideOverridesForPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';

const IDS = ['sports_editorial', 'case_study_neon', 'mood_sepia', 'bold_promo_rosa', 'reflexivo_cream', 'tabloid_keywords',
  'editorial_magazine', 'luxury_hybrid', 'viral_hype_dark', 'cinematic_hybrid', 'authority_black', 'minimal_clean'];
const LONGO = ' Uma mensagem mais longa para conferir as quebras e a hierarquia.';
const T = (title, subtitle, foto = false) => ({ title, subtitle, foto });
const CONTEUDO = [
  T('Ninguém lê o seu post inteiro', 'E tudo bem. O primeiro card decide se existe o segundo.', true),
  T('O polegar é mais rápido que a sua introdução', 'Abrir com contexto custa a atenção que a ideia principal precisaria.'),
  T('Mostre a coisa', 'Uma imagem concreta segura mais que três adjetivos.', true),
  T('Corte a primeira frase.', ''),
  T('Antes de publicar', '- Uma ideia por card\n- Título que se lê em um segundo\n- Final que diz o próximo passo'),
  T('Escreva para quem chegou agora', 'Cada card precisa funcionar para quem caiu nele direto, sem ter visto o anterior.'),
  T('Agora volte ao primeiro card', 'E pergunte se ele merece o segundo.', true),
];

function compor(id, { formato = 'carrossel', longo = false } = {}) {
  const preset = VISUAL_PRESETS.find((p) => p.id === id);
  const brand = applyVisualPreset({ ...DEFAULT_BRAND, name: 'Estúdio exemplo', handle: '', logo: null, showHandle: false }, id);
  const raw = CONTEUDO.map((c, i) => ({
    ...mkSlide(i + 1, brand), ...getSlideOverridesForPreset(id), id: `c${i}`,
    title: longo ? c.title + LONGO : c.title, subtitle: c.subtitle,
    bgImage: c.foto ? 'foto.jpg' : '', imageQuery: c.foto ? 'pessoa' : '',
  }));
  return applySocialVisualComposition(raw, { preset, brand, formato });
}

function topoDoTexto(slide) {
  const T = slide.canvas.zones.title;
  const usado = Math.min(T.h, slide.socialArt?.titleUsed ?? T.h);
  const ancora = slide.socialZoneAnchors?.title || 'start';
  return ancora === 'end' ? T.y + T.h - usado : ancora === 'center' ? T.y + (T.h - usado) / 2 : T.y;
}

const FORMATOS = ['carrossel', 'quadrado', 'stories'];

describe('12 estilos · proteção do título sobre foto', () => {
  for (const id of IDS) for (const formato of FORMATOS) for (const longo of [false, true]) {
    it(`${id} · ${formato}${longo ? ' · título longo' : ''}: degradê alcança o topo do texto`, () => {
      const cards = compor(id, { formato, longo }).filter((s) => s.overlayMode === 'scrim');
      expect(cards.length).toBeGreaterThan(0);
      for (const s of cards) {
        expect(Number.isFinite(s.socialScrimTop)).toBe(true);
        expect(s.socialScrimTop).toBeLessThanOrEqual(topoDoTexto(s));
      }
    });
  }
});

describe('12 estilos · fios e foto', () => {
  for (const id of IDS) for (const formato of FORMATOS) {
    it(`${id} · ${formato}: fio centralizado segue a coluna e não cai sobre a foto`, () => {
      for (const s of compor(id, { formato })) {
        const fios = (s.socialArt?.chrome || []).filter((c) => (c.t === 'block' || c.t === 'rule') && c.h < 1.2 && c.w < 40 && !c.rotate);
        const T = s.canvas.zones.title;
        const P = s.canvas.zones.photo;
        const temFoto = !!s.bgImage && !/Bleed/.test(s.socialArt?.archetype || '');
        for (const f of fios) {
          if (s.align === 'center') expect(Math.abs(f.x + f.w / 2 - (T.x + T.w / 2))).toBeLessThan(13);
          if (temFoto && P && P.w > 2) {
            const cruza = f.x < P.x + P.w && f.x + f.w > P.x && f.y < P.y + P.h && f.y + f.h > P.y;
            expect(cruza).toBe(false);
          }
        }
      }
    });
  }

  it('Minimal Clean não herda o fio à esquerda nem o número de página da família Minimal da v4', () => {
    for (const s of compor('minimal_clean')) {
      const chrome = s.socialArt?.chrome || [];
      expect(chrome.some((c) => c.t === 'rule')).toBe(false);
      expect(chrome.some((c) => c.t === 'text' && c.text === '{n}' && c.align === 'right')).toBe(false);
    }
  });
});
