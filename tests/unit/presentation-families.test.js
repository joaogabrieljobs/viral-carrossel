import { describe, it, expect } from 'vitest';
import { FAMILY_KEYS, PAGE_KINDS, familyLayout, familyFont, libraryFontFamilies, familyFromPresetId, normalizeFamilyKey } from '../../src/utils/presentation-families.js';
import { chromeElements, fillChromeTokens } from '../../src/utils/presentation-chrome.js';

const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.2;
const inside = (r) => r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= 100.01 && r.y + r.h <= 100.01;
const TITLES = ['Curto', 'Um título de duas linhas para teste', 'Um título bem mais longo para verificar se a família mantém hierarquia e leitura'];
const cases = [];
for (const family of FAMILY_KEYS) for (const kind of PAGE_KINDS) for (const format of ['16:9', '4:5', '1:1', '9:16'])
  for (const photo of [true, false]) for (const structured of [true, false]) for (const title of TITLES)
    cases.push({ family, kind, format, photo, structured, title });

describe('biblioteca de famílias', () => {
  it('declara dez famílias com no máximo duas famílias tipográficas por página', () => {
    expect(FAMILY_KEYS).toHaveLength(10);
    for (const key of FAMILY_KEYS) {
      const names = new Set(['display', 'text', 'numeric', 'label'].map((r) => familyFont(key, r).family));
      expect(names.size).toBeLessThanOrEqual(2);
    }
    expect(libraryFontFamilies().length).toBeGreaterThanOrEqual(15);
  });

  it('mantém projetos salvos: ids legados resolvem família', () => {
    expect(familyFromPresetId('presentation_data_first')).toBe('cultural');
    expect(familyFromPresetId('presentation_premium_dark')).toBe('luxury');
    expect(normalizeFamilyKey('premium')).toBe('luxury');
  });

  it.each(cases)('$family/$kind/$format foto=$photo quadro=$structured "$title"', ({ family, kind, format, photo, structured, title }) => {
    const l = familyLayout(family, kind, { format, photo, structured, title });
    const zones = { title: l.title, subtitle: l.subtitle, evidence: l.evidence, photo: l.photo };
    for (const [k, r] of Object.entries(zones)) if (r) expect(inside(r), `${k} fora do canvas`).toBe(true);
    if (format === '9:16') for (const r of [l.title, l.subtitle, l.evidence].filter(Boolean)) {
      expect(r.y).toBeGreaterThanOrEqual(14);
      expect(r.y + r.h).toBeLessThanOrEqual(82.01);
    }
    expect(overlap(l.title, l.subtitle), 'título sobre apoio').toBe(false);
    if (l.evidence) {
      expect(overlap(l.title, l.evidence)).toBe(false);
      expect(overlap(l.subtitle, l.evidence)).toBe(false);
      expect(l.evidence.w).toBeGreaterThanOrEqual(50);
      expect(l.evidence.h).toBeGreaterThanOrEqual(25);
    }
    if (l.photo && !l.scrim) {
      expect(overlap(l.photo, l.title), 'foto sob título sem scrim').toBe(false);
      expect(overlap(l.photo, l.subtitle), 'foto sob apoio sem scrim').toBe(false);
    }
    if (structured && kind === 'data') expect(l.evidence).toBeTruthy();
    // Fios são separadores: não atravessam título, apoio ou quadro (1% de borda é respiro).
    for (const c of (l.chrome || []).filter(c => c.t === 'rule' && c.w != null && c.h != null)) {
      for (const [name, r] of Object.entries({ title: l.title, subtitle: l.subtitle, evidence: l.evidence })) {
        if (!r) continue;
        const cross = Math.min(c.x + c.w, r.x + r.w) - Math.max(c.x, r.x) > 0.3 && c.y + c.h > r.y + 1 && c.y < r.y + r.h - 1;
        expect(cross, `fio atravessa ${name}`).toBe(false);
      }
    }
    expect(l.titlePx).toBeGreaterThanOrEqual(56);
    expect(l.bodyPx).toBeGreaterThanOrEqual(25);
  });

  it('chrome não inventa texto: token ausente remove o dispositivo', () => {
    expect(fillChromeTokens('{caption}', {})).toBeNull();
    expect(fillChromeTokens('§{index} · {kicker?}', { index: '03' })).toBe('§03');
    const l = familyLayout('editorial', 'content', { photo: true });
    const texts = chromeElements(l, { frame: { w: 1920, h: 1080 }, tokens: { index: '02' } }).filter((e) => e.text);
    expect(texts.every((e) => /^\d|^§|^“|^→|^FIG|^TAB|^CENA|^FIM|^NOTA/.test(e.text))).toBe(true);
  });
  it('o fio editorial acompanha o apoio sem atravessar as letras nas adaptações', () => {
    for (const format of ['4:5', '1:1', '9:16']) {
      const layout = familyLayout('editorial', 'cover', { format, photo: true, title: 'Casas que aprendem a respirar' });
      const rule = layout.chrome.find(c => c.t === 'rule' && c.color === 'accent');
      expect(rule.y + rule.h).toBeLessThan(layout.subtitle.y);
    }
  });
});
