import { describe, it, expect } from 'vitest';
import {
  VISUAL_PRESETS,
  PRESET_BRAND_SIGNATURE_KEYS,
  PRESET_SLIDE_SIGNATURE_KEYS,
  applyVisualPreset,
  getSlideOverridesForPreset,
} from '../../src/styles/visual-presets.jsx';
import { wcagContrast } from '../../src/utils/wcag.js';

/** Campos de texto do preset que acabam impressos no card do usuário. */
const CAMPOS_TEXTO_BRAND = [
  'cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear',
  'footerPillText', 'footerBarLeft', 'footerBarCenter', 'footerBarRight',
];
const CAMPOS_TEXTO_SLIDE = ['eyebrowText', 'strikethroughText', 'afterTitleText'];

function textosDe(preset) {
  const out = [];
  for (const k of CAMPOS_TEXTO_BRAND) {
    const v = preset.brand?.[k];
    if (typeof v === 'string' && v.trim()) out.push([k, v]);
  }
  for (const k of CAMPOS_TEXTO_SLIDE) {
    const v = preset.slideDefaults?.[k];
    if (typeof v === 'string' && v.trim()) out.push([k, v]);
  }
  return out;
}

describe('padrões visuais — conteúdo', () => {
  it('nenhum texto de preset carrega marca de terceiro', () => {
    // Os presets nasceram de referências reais e já vazaram nomes de marcas
    // e de pessoas para o carrossel do usuário uma vez. Esta lista é a
    // cicatriz: qualquer reincidência reprova aqui.
    const proibidos = [
      'nmlss', 'cadore', 'coldplay', 'sociyell', 'educadora', 'linkedin',
      'instagram', 'canva', 'claude', 'postnews', 'nba', 'gary',
      'digital thinker', 'content machine',
    ];
    const achados = [];
    for (const p of VISUAL_PRESETS) {
      for (const [campo, valor] of textosDe(p)) {
        const baixo = valor.toLowerCase();
        for (const termo of proibidos) {
          if (baixo.includes(termo)) achados.push(`${p.id}.${campo} = "${valor}"`);
        }
      }
    }
    expect(achados).toEqual([]);
  });

  it('textos visíveis estão em português (sem resíduo em inglês)', () => {
    const ingles = ['news', 'trends', 'edition', 'topic', 'save', 'brought by', 'swipe'];
    const achados = [];
    for (const p of VISUAL_PRESETS) {
      for (const [campo, valor] of textosDe(p)) {
        const palavras = valor.toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean);
        for (const termo of ingles) {
          if (palavras.includes(termo)) achados.push(`${p.id}.${campo} = "${valor}"`);
        }
      }
    }
    expect(achados).toEqual([]);
  });

  it('cada preset tem id, label e desc únicos', () => {
    for (const chave of ['id', 'label']) {
      const vistos = VISUAL_PRESETS.map((p) => p[chave]);
      expect(new Set(vistos).size, `${chave} duplicado`).toBe(vistos.length);
    }
    for (const p of VISUAL_PRESETS) {
      expect(String(p.desc || '').length, `${p.id} sem desc`).toBeGreaterThan(10);
    }
  });

  it('nenhum par de presets tem a mesma assinatura cromática', () => {
    // Mood Sépia e Reflexivo eram o mesmo cartão com dois nomes: mesmo fundo,
    // mesmo accent e a mesma fonte de título.
    const assinaturas = VISUAL_PRESETS.map((p) => ({
      id: p.id,
      chave: [p.brand.bg, p.brand.accent, p.brand.titleFont].join('|'),
    }));
    const colisoes = [];
    for (let i = 0; i < assinaturas.length; i += 1) {
      for (let j = i + 1; j < assinaturas.length; j += 1) {
        if (assinaturas[i].chave === assinaturas[j].chave) {
          colisoes.push(`${assinaturas[i].id} ≡ ${assinaturas[j].id}`);
        }
      }
    }
    expect(colisoes).toEqual([]);
  });
});

describe('padrões visuais — contraste', () => {
  /** Só cores sólidas: pill com rgba() é medido contra o próprio fundo do pill. */
  const solido = (c) => /^#[0-9a-fA-F]{3,6}$/.test(String(c || ''));

  it('título, subtítulo e texto passam 4.5:1 contra o fundo', () => {
    const falhas = [];
    for (const p of VISUAL_PRESETS) {
      const bg = p.brand.bg;
      for (const campo of ['titleColor', 'subtitleColor', 'textColor']) {
        const cor = p.brand[campo];
        if (!solido(cor) || !solido(bg)) continue;
        const r = wcagContrast(cor, bg);
        if (r < 4.5) falhas.push(`${p.id}.${campo} ${r.toFixed(2)}:1`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it('accent passa 3:1 — é traço de riscado e palavra destacada', () => {
    const falhas = [];
    for (const p of VISUAL_PRESETS) {
      const { accent, bg } = p.brand;
      if (!solido(accent) || !solido(bg)) continue;
      const r = wcagContrast(accent, bg);
      if (r < 3) falhas.push(`${p.id} ${r.toFixed(2)}:1`);
    }
    expect(falhas).toEqual([]);
  });

  it('pill de rodapé com cores sólidas é legível', () => {
    const falhas = [];
    for (const p of VISUAL_PRESETS) {
      const { footerPillText, footerPillBg, footerPillFg } = p.brand;
      if (!footerPillText || !solido(footerPillBg) || !solido(footerPillFg)) continue;
      const r = wcagContrast(footerPillFg, footerPillBg);
      if (r < 4.5) falhas.push(`${p.id} ${r.toFixed(2)}:1`);
    }
    expect(falhas).toEqual([]);
  });
});

describe('applyVisualPreset — troca de padrão não acumula assinatura', () => {
  it('todo campo de assinatura escrito por algum preset está na lista de limpeza', () => {
    // A lista é o que impede o eyebrow de um padrão de sobreviver no próximo.
    // Um campo novo num preset sem entrada aqui volta a vazar em silêncio.
    const conhecidos = new Set([
      ...PRESET_BRAND_SIGNATURE_KEYS,
      'bg', 'titleColor', 'subtitleColor', 'textColor', 'accent',
      'titleFont', 'bodyFont',
      'textTitleWeight', 'textTitleCase', 'textTitleTracking',
      'textTitleLeading', 'textSubLeading',
    ]);
    const orfaos = new Set();
    for (const p of VISUAL_PRESETS) {
      for (const k of Object.keys(p.brand || {})) {
        if (!conhecidos.has(k)) orfaos.add(`${p.id}.${k}`);
      }
    }
    expect([...orfaos]).toEqual([]);
  });

  it('aplicar todos os padrões em sequência não deixa resíduo do anterior', () => {
    let brand = { handle: '@teste', name: 'Teste' };
    for (const p of VISUAL_PRESETS) brand = applyVisualPreset(brand, p.id);
    const ultimo = VISUAL_PRESETS[VISUAL_PRESETS.length - 1];
    for (const k of PRESET_BRAND_SIGNATURE_KEYS) {
      expect(brand[k], `${k} sobreviveu de um padrão anterior`).toEqual(ultimo.brand[k]);
    }
  });

  it('campos que não são assinatura sobrevivem à troca', () => {
    const brand = applyVisualPreset({ handle: '@teste', logo: 'x.png' }, 'minimal_clean');
    expect(brand.handle).toBe('@teste');
    expect(brand.logo).toBe('x.png');
  });

  it('overrides de slide zeram a assinatura do padrão anterior', () => {
    const overrides = getSlideOverridesForPreset('minimal_clean');
    for (const k of PRESET_SLIDE_SIGNATURE_KEYS) {
      expect(overrides).toHaveProperty(k);
      expect(overrides[k]).toBeUndefined();
    }
    expect(getSlideOverridesForPreset('bold_promo_rosa').strikethroughText).toBeTruthy();
  });
});
