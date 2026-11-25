// Modo livre de apresentação, fase 1 (docs/product/modo-livre-apresentacao.md).
// Deck Apoteose (estrutura de 10 slides da QA 24/11) com palavras neutras do
// mesmo tamanho do texto do cliente.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS } from '../../src/styles/presentation-presets.jsx';
import {
  applyPresentationVisualPresetToDoc,
  applyPresentationVisualPresetToSlides,
} from '../../src/utils/presentation-state.js';

const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const palavras = (n) => {
  const base = 'festa cidade ritmo encontro noite cultura';
  let out = '';
  while (out.length < n) out += (out ? ' ' : '') + base;
  return out.slice(0, n).trim();
};
const deck = ({ fotoPronta = true } = {}) => apoteose.slides.map((s, i) => ({
  id: `apoteose-${i + 1}`,
  title: palavras(s.titulo),
  subtitle: palavras(s.apoio),
  bodyAfterImage: palavras(s.final),
  ...(s.foto ? { ...(fotoPronta ? { bgImage: FOTO } : {}), imageQuery: 'editorial photo' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `${n * 12}%`, detail: palavras(55) })) }] : [],
  presentationPlan: { visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.' },
}));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

// Medido antes da fase 1 (commit 3501c0a): composição dos 10 padrões na
// Apoteose, ao aplicar o estilo nos slides e no documento.
const BASELINE = {
  "presentation_executive_minimal": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"f41260853aa60b04","doc":"d4484ad4bd9384c6"},
  "presentation_editorial_magazine": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"d1f39ca16724bae2","doc":"12378acae456de4a"},
  "presentation_data_first": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"71b7995a0f8f7751","doc":"ee36b4c6a69405e6"},
  "presentation_swiss_grid": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"ab8d3d4dd7c5b9c3","doc":"b74dfddf7a212296"},
  "presentation_cinematic": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"0d186a4391fcf00a","doc":"7dafb5fe71bd2d5c"},
  "presentation_typographic_bold": {"sequencia":"cover,content,demo,content,content,demo,content,content,data,closing","slides":"10719236b13bfe6d","doc":"7f83b23b3bf2d50d"},
  "presentation_modular_cards": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"06fdb078f0818d9c","doc":"7ee85a225e7b60f7"},
  "presentation_photo_essay": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"2e42802cb0529780","doc":"84851086c1c45d89"},
  "presentation_technical_blueprint": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"9e9af0b874924859","doc":"9927f7ac0046759f"},
  "presentation_premium_dark": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"b1deafc38ee18c17","doc":"3b0af25911439eee"},
};

describe('modo livre, fase 1: os 10 padrões não mudam', () => {
  it('são 10 padrões no seletor', () => {
    expect(PRESENTATION_VISUAL_PRESETS).toHaveLength(10);
  });

  it.each(PRESENTATION_VISUAL_PRESETS.map(p => [p.id]))('%s: sequência e composição idênticas às de antes', (id) => {
    const slides = applyPresentationVisualPresetToSlides(deck(), id, 'auto');
    const doc = applyPresentationVisualPresetToDoc({ brand: { accent: '#B4235A', bg: '#101010', titleColor: '#FAFAFA' }, presentationPath: 'auto', slides: deck({ fotoPronta: false }) }, id);
    const got = {
      sequencia: slides.map(s => s.presentationComposition).join(','),
      slides: hash(slides),
      doc: hash(doc),
    };
    if (!BASELINE[id]) console.log(`BASELINE ${JSON.stringify(id)}: ${JSON.stringify(got)},`);
    expect(got).toEqual(BASELINE[id]);
  });
});
