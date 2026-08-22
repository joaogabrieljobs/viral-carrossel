import { describe, it, expect } from 'vitest';
import { TEMPLATES, PALETTES } from '../../src/utils/design-data.js';
import {
  FONT_PAIRINGS, COMPOSITIONS,
  SUGGESTED_VISUAL_PRESET_BY_CREATIVE,
  suggestVisualPresetForCreative, suggestCreativePresetForVisual,
} from '../../src/utils/slide-design-system.js';
import { PRESET_BRAND_SIGNATURE_KEYS, VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';

describe('templates — integridade estrutural', () => {
  it('todo template referencia paleta, pairing e composições existentes', () => {
    for (const t of TEMPLATES) {
      expect(PALETTES[t.palette], `${t.id}: palette ${t.palette}`).toBeTruthy();
      expect(
        FONT_PAIRINGS.some((p) => p.id === t.pairingId),
        `${t.id}: pairing "${t.pairingId}" não existe`,
      ).toBe(true);
      for (const s of t.slides) {
        expect(COMPOSITIONS[s.composition], `${t.id}: composição "${s.composition}"`).toBeTruthy();
      }
    }
  });

  it('índices de fonte mortos não voltam (fonte vem só do pairing)', () => {
    // applyTemplate ignora titleFont/bodyFont numéricos; se voltarem, o preview
    // do modal e o card aplicado divergem em silêncio.
    for (const t of TEMPLATES) {
      expect(t.titleFont, `${t.id}.titleFont`).toBeUndefined();
      expect(t.bodyFont, `${t.id}.bodyFont`).toBeUndefined();
    }
  });

  it('assinatura só usa campos que a troca de padrão sabe limpar', () => {
    const conhecidos = new Set(PRESET_BRAND_SIGNATURE_KEYS);
    for (const t of TEMPLATES) {
      for (const k of Object.keys(t.signature || {})) {
        expect(conhecidos.has(k), `${t.id}.signature.${k} fora de PRESET_BRAND_SIGNATURE_KEYS`).toBe(true);
      }
    }
  });
});

describe('templates — regras de copy', () => {
  it('slide de stat não traz estatística inventada com cara de pesquisa', () => {
    // "47%", "72% dos consumidores", "3× mais retenção": usuário posta sem
    // saber que era para trocar e vira desinformação assinada pela marca dele.
    const pareceEstatistica = /^\d+([.,]\d+)?\s*[%×x]\s*$/i;
    for (const t of TEMPLATES) {
      for (const s of t.slides) {
        if (s.composition !== 'stat_proof') continue;
        expect(
          pareceEstatistica.test(String(s.title).trim()),
          `${t.id}: stat "${s.title}" parece dado de pesquisa inventado`,
        ).toBe(false);
        expect(String(s.subtitle || '')).not.toMatch(/\d+\s*%/);
      }
    }
  });

  it('arco: abre com hook, fecha com CTA, tem exatamente um stat', () => {
    for (const t of TEMPLATES) {
      expect(t.slides[0].composition, `${t.id}: primeiro slide`).toBe('hook_fullbleed');
      expect(t.slides[t.slides.length - 1].composition, `${t.id}: último slide`).toBe('cta_close');
      const stats = t.slides.filter((s) => s.composition === 'stat_proof');
      expect(stats.length, `${t.id}: ${stats.length} slides de stat`).toBe(1);
    }
  });

  it('CTA pede uma ação só (salvar OU comentar OU arrastar)', () => {
    for (const t of TEMPLATES) {
      const cta = t.slides[t.slides.length - 1];
      const texto = `${cta.title} ${cta.subtitle || ''}`.toLowerCase();
      const acoes = ['salve', 'comente', 'compartilhe', 'arrasta', 'siga', 'marque']
        .filter((a) => texto.includes(a));
      expect(acoes.length, `${t.id}: CTA pede ${acoes.join(' + ')}`).toBeLessThanOrEqual(1);
    }
  });

  it('nenhum título repete dentro do mesmo template e nenhum campo fica vazio', () => {
    for (const t of TEMPLATES) {
      const titulos = t.slides.map((s) => s.title.trim().toLowerCase());
      expect(new Set(titulos).size, `${t.id}: título repetido`).toBe(titulos.length);
      for (const s of t.slides) {
        expect(String(s.title).trim().length, `${t.id}: título vazio`).toBeGreaterThan(0);
        expect(String(s.subtitle || '').trim().length, `${t.id}: subtítulo vazio em "${s.title}"`).toBeGreaterThan(0);
      }
    }
  });

  it('títulos cabem no card sem estourar o autofit (máx. 60 caracteres)', () => {
    for (const t of TEMPLATES) {
      for (const s of t.slides) {
        expect(s.title.length, `${t.id}: "${s.title}"`).toBeLessThanOrEqual(60);
        expect(String(s.subtitle || '').length, `${t.id}: subtítulo de "${s.title}"`).toBeLessThanOrEqual(120);
      }
    }
  });
});

describe('ponte pacote criativo ↔ padrão visual', () => {
  it('todo template sugere um padrão visual que existe', () => {
    for (const t of TEMPLATES) {
      const sugerido = suggestVisualPresetForCreative(t.creativePreset);
      expect(sugerido, `${t.id} (${t.creativePreset}) sem padrão sugerido`).toBeTruthy();
      expect(
        VISUAL_PRESETS.some((p) => p.id === sugerido),
        `${t.id} sugere "${sugerido}", que não existe`,
      ).toBe(true);
    }
  });

  it('a sugestão é coerente com a volta (padrão → pacote)', () => {
    // A ponte é curada, não a inversa mecânica — vários padrões partilham o
    // mesmo pacote. Mas o padrão escolhido tem de apontar de volta ao pacote
    // que o sugeriu, senão a etiqueta "COMBINA" mente.
    for (const [creative, visual] of Object.entries(SUGGESTED_VISUAL_PRESET_BY_CREATIVE)) {
      expect(suggestCreativePresetForVisual(visual), `${visual} não volta para ${creative}`)
        .toBe(creative);
    }
  });

  it('nenhum padrão visual é sugerido para dois pacotes diferentes', () => {
    const usados = Object.values(SUGGESTED_VISUAL_PRESET_BY_CREATIVE);
    expect(new Set(usados).size, `sugestão repetida: ${usados.join(', ')}`).toBe(usados.length);
  });
});

describe('paletas — legibilidade em qualquer template', () => {
  /** Contraste WCAG 2.x entre duas cores sólidas. */
  const lum = (h) => {
    const v = h.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ct = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  it('título, subtítulo e corpo passam 4.5:1 sobre o fundo', () => {
    const falhas = [];
    for (const p of PALETTES) {
      for (const campo of ['title', 'subtitle', 'text']) {
        const r = ct(p[campo], p.bg);
        if (r < 4.5) falhas.push(`${p.name}.${campo} ${r.toFixed(2)}:1`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it('accent passa 3:1 — é riscado, palavra destacada e selo', () => {
    // Duas paletas da biblioteca de capas chegaram reprovando: âmbar sobre
    // areia (2.9:1) e verde elétrico sobre pedra (1.0:1, invisível).
    const falhas = [];
    for (const p of PALETTES) {
      const r = ct(p.accent, p.bg);
      if (r < 3) falhas.push(`${p.name} ${r.toFixed(2)}:1`);
    }
    expect(falhas).toEqual([]);
  });

  it('nenhuma paleta é duplicata cromática de outra', () => {
    const chaves = PALETTES.map((p) => `${p.bg}|${p.title}|${p.accent}`);
    expect(new Set(chaves).size, 'paleta repetida').toBe(chaves.length);
  });
});

describe('templates — catálogo navegável', () => {
  it('todo template declara categoria conhecida', () => {
    for (const t of TEMPLATES) {
      expect(['angulo', 'nicho'], `${t.id}: categoria "${t.categoria}"`).toContain(t.categoria);
    }
  });

  it('id, nome e descrição são únicos', () => {
    for (const campo of ['id', 'name', 'desc']) {
      const vistos = TEMPLATES.map((t) => t[campo]);
      expect(new Set(vistos).size, `${campo} duplicado`).toBe(vistos.length);
    }
  });

  it('cada template tem paleta própria — a grade não pode ter dois cards iguais', () => {
    const usadas = TEMPLATES.map((t) => t.palette);
    expect(new Set(usadas).size, `paleta repetida entre templates: ${usadas.join(', ')}`)
      .toBe(usadas.length);
  });

  it('nenhum texto de template carrega marca de terceiro', () => {
    const proibidos = ['coldplay', 'linkedin', 'instagram', 'canva', 'nmlss', 'cadore', 'nba'];
    const achados = [];
    for (const t of TEMPLATES) {
      for (const s of t.slides) {
        const texto = `${s.title} ${s.subtitle || ''} ${s.body || ''}`.toLowerCase();
        for (const termo of proibidos) if (texto.includes(termo)) achados.push(`${t.id}: ${termo}`);
      }
    }
    expect(achados).toEqual([]);
  });
});
