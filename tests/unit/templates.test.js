import { describe, it, expect } from 'vitest';
import { TEMPLATES, PALETTES } from '../../src/utils/design-data.js';
import { FONT_PAIRINGS, COMPOSITIONS } from '../../src/utils/slide-design-system.js';
import { PRESET_BRAND_SIGNATURE_KEYS } from '../../src/styles/visual-presets.jsx';

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
