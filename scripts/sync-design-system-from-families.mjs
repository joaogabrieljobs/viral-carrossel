import fs from 'node:fs';
// Sincroniza nome, paleta, tipografia e imagem do catálogo com presentation-families.js.
// Uso: node scripts/sync-design-system-from-families.mjs (rodar a partir de codigo/).
import { PRESENTATION_FAMILIES, FAMILY_KEYS } from '../src/utils/presentation-families.js';
const p = 'docs/presentation/presentation-design-system.json';
const src = JSON.parse(fs.readFileSync(p, 'utf8'));
const em = (v) => `${(v || 0) / 100}em`;
const gf = (fam, w) => `https://fonts.google.com/specimen/${fam.replace(/ /g, '+')}`;
for (const key of FAMILY_KEYS) {
  const f = PRESENTATION_FAMILIES[key];
  const pat = src.patterns.find((x) => x.id === f.patternId);
  pat.name = f.label;
  pat.description = f.intent;
  pat.familyKey = key;
  const pl = f.palette;
  Object.assign(pat.palette, { background: pl.bg, surface: pl.surface, surfaceAlt: pl.inverse, primary: pl.ink, secondary: pl.muted,
    accent: pl.accent, textPrimary: pl.ink, textSecondary: pl.muted, textMuted: pl.muted, textOnPrimary: pl.inverseInk, border: pl.rule, divider: pl.accent3 });
  const fonts = f.fonts;
  const res = (role) => typeof fonts[role] === 'string' ? fonts[fonts[role]] : fonts[role];
  const t = pat.typography;
  const set = (slot, font, extra = {}) => { t[slot] = { ...(t[slot] || {}), family: font.family, weight: font.weight, fallback: font.css.split(', ').slice(1).join(', '), source: 'google-fonts', license: 'SIL Open Font License 1.1', href: gf(font.family), letterSpacing: em(font.tracking), ...extra }; delete t[slot].case; if (extra.case) t[slot].case = extra.case; };
  set('title', fonts.display, fonts.display.case === 'upper' ? { case: 'uppercase' } : { case: 'sentence' });
  set('subtitle', fonts.text, { case: 'sentence', weight: Math.max(400, fonts.text.weight) });
  set('body', fonts.text, { weight: Math.max(400, fonts.text.weight) });
  set('label', res('label'), { case: 'sentence', weight: 500 });
  set('numeric', res('numeric'));
  pat.imagery = { ...(pat.imagery || {}), style: f.photo.direction, filters: f.photo.filter, radius: f.photo.radius };
  pat.graphicLanguage = f.graphic;
}
src.version = '2.0.0';
src.generatedAt = '2026-11-19';
fs.writeFileSync(p, JSON.stringify(src, null, 2) + '\n');
console.log('ok');
