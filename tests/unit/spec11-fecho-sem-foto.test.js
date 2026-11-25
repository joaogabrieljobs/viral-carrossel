// Spec 1.1, conferência visual (25/11), Tipográfico expressivo, defeito 2.
//
// O fecho do Tipográfico é sem foto por desenho, mas a foto que o roteiro
// pediu chega depois e a vista (slideForFormatDisplay) "restaurava" a
// composição com foto. A página de fecho da família não tem zona de foto: a
// zona inativa (96, 94, 1, 1) era desenhada com o tamanho mínimo de zona
// (8 × 5, canvas-layout.js) e a foto aparecia num recorte de ~150 × 65 px no
// canto inferior direito. Já acontecia em main (e235c41), antes do spec 1.1.
// O mesmo valia para a abertura de seção do Tipográfico e do Cinemático.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { getPresentationPath } from '../../src/utils/presentation.js';
import { contentAwarePresentationLayout, restorePresentationPhotoComposition } from '../../src/utils/presentation-composition.js';
import { FAMILY_KEYS, familyFromPresetId } from '../../src/utils/presentation-families.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

const estrutura = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const PRESETS = PRESENTATION_VISUAL_PRESETS.map(preset => preset.id);
const TIPOGRAFICO = 'presentation_typographic_bold';
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const exato = (n) => {
  const s = 'festa cidade ritmo encontro noite cultura brasileira '.repeat(Math.ceil(n / 50) + 1).slice(0, n);
  return s.endsWith(' ') ? `${s.slice(0, -1)}a` : s;
};
const deck = () => estrutura.slides.map((s, i) => ({
  id: `s-${i + 1}`, title: exato(s.titulo), subtitle: exato(s.apoio), bodyAfterImage: s.final ? exato(s.final) : '',
  ...(s.foto ? { imageQuery: 'editorial photo of a carnival warm-up party' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `Valor ${n}`, detail: exato(40) })) }] : [],
  presentationPlan: { visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.' },
}));
/** Composição na geração (ritmo pelas anteriores), como em handleGenerate. */
function gerar(preset, pathId, slides) {
  const route = getPresentationPath(pathId);
  const stages = route.stages || [];
  const previous = [];
  return slides.map((s, i) => {
    const stage = { ...stages[Math.round((i * (stages.length - 1)) / (slides.length - 1))], deliveryMode: route.deliveryMode,
      visualRole: s.presentationPlan.visualRole, purpose: s.presentationPlan.purpose };
    const out = getPresentationCompositionOverrides(preset, { slide: s, stage, index: i, count: slides.length, previous });
    previous.push(out);
    return { ...s, ...out };
  });
}

describe('defeito 2: página sem zona de foto não ganha foto na vista', () => {
  it.each(['auto', 'pitch'])('Tipográfico · %s: o fecho com a foto do roteiro continua sem foto', (pathId) => {
    const fecho = { ...gerar(TIPOGRAFICO, pathId, deck())[9], bgImage: FOTO, bgImageId: 'foto-10' };
    expect(fecho.presentationSuppressPhoto).toBe(true);
    const vista = slideForFormatDisplay(fecho, 'apresentacao', {}, 'apresentacao');
    expect(vista.presentationSuppressPhoto).toBe(true);
    expect(vista.canvas.zones).toEqual(fecho.canvas.zones);
  });

  it('em toda família, página sem zona de foto fica sem foto; com zona, a foto volta', () => {
    expect(FAMILY_KEYS.map(family => !!PRESETS.find(id => familyFromPresetId(id) === family))).not.toContain(false);
    const falhas = [];
    for (const family of FAMILY_KEYS) {
      for (const kind of ['cover', 'divider', 'content', 'demo', 'closing']) {
        const preset = PRESETS.find(id => familyFromPresetId(id) === family);
        const slide = { title: 'Título', subtitle: exato(120), presentationPlan: { visualRole: kind === 'content' ? 'content' : kind } };
        const composto = { ...slide, ...getPresentationCompositionOverrides(preset, { slide, index: kind === 'cover' ? 0 : kind === 'closing' ? 9 : 4, count: 10 }) };
        expect(composto.presentationSuppressPhoto).toBe(true);
        const comFoto = { ...composto, bgImage: FOTO, bgImageId: 'x' };
        const temZona = !!contentAwarePresentationLayout(composto.presentationComposition, comFoto, family).photo;
        const vista = restorePresentationPhotoComposition(comFoto);
        if (vista.presentationSuppressPhoto === temZona) falhas.push(`${family} ${composto.presentationComposition}: zona ${temZona}, suprimida ${vista.presentationSuppressPhoto}`);
      }
    }
    expect(falhas).toEqual([]);
  });
});
