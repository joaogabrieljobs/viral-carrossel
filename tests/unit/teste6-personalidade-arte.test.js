// Revisão do coordenador sobre o slide 8 do Teste 6 (26/11):
// (a) no modo livre, o bloco de pares "traço / sem ser…" aceita até 7
//     linhas e nenhum par fica no apoio; presets comuns mantêm o teto de 5;
// (b) com o bloco de pares a página mantém o fundo art e a tabela fica no
//     lado liso (como a página 10 do alvo do ChatGPT).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { finishFreeDraft, personalityComparison } from '../../src/utils/free-draft.js';
import { normalizePresentationBlocks } from '../../src/utils/presentation-quality.js';
import { validateCarouselDraft } from '../../src/utils/editorial-review.js';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { FREE_ART_TEXT_MAX } from '../../src/utils/free-design.js';

const T6 = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste6.json', import.meta.url), 'utf8'));
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const draftSlides = () => T6.slides.map((s, i) => ({
  id: `t6-${i + 1}`, num: i + 1, title: s.title, subtitle: s.subtitle, bodyAfterImage: s.bodyAfterImage, eyebrow: '',
  presentationBlocks: structuredClone(s.presentationBlocks),
  ...(s.design.photo !== 'none' ? { bgImage: PHOTO, imageQuery: 'photo' } : {}),
  presentationPlan: { schemaVersion: 3, promptVersion: 'presentation-plan-v3', visualRole: s.visualRole, purpose: s.purpose,
    question: 'Por quê?', keyMessage: 'Mensagem.', scene: s.design.photo !== 'none' ? { subject: 'people' } : null, design: structuredClone(s.design) },
}));
const SETE = Array.from({ length: 7 }, (_, i) => [`Traço ${i + 1}`, `sem ser coisa ${i + 1}.`]);

describe('(a) pares em até 7 linhas só no modo livre', () => {
  it('slide 8: os 7 pares vão para a tabela e nenhum par fica no apoio', () => {
    const out = personalityComparison(draftSlides()[7]);
    const [block] = normalizePresentationBlocks(out.presentationBlocks);
    expect(block.rows).toHaveLength(7);
    expect(block.rows.at(-1)).toEqual(['Bem-humorada', 'sem recorrer ao humor óbvio.']);
    expect(out.subtitle).toBe('');
    expect(out.subtitle + out.bodyAfterImage).not.toMatch(/\bsem (ser|depender|recorrer)\b/);
  });

  it('tabela de pares que a IA escreveu com 5 linhas recebe os pares que ficaram no apoio', () => {
    const base = draftSlides()[7];
    const rows = [['Brasileira', 'sem ser caricata.'], ['Sofisticada', 'sem ser pretensiosa.'], ['Exclusiva', 'sem ser arrogante.'], ['Sensual', 'sem ser vulgar.'], ['Irreverente', 'sem ser infantil.']];
    const out = personalityComparison({ ...base, subtitle: 'Contemporânea sem depender de tendências. Bem-humorada sem recorrer ao humor óbvio.', presentationBlocks: [{ type: 'comparison', headers: ['Traço', 'Sem ser'], rows }] });
    expect(normalizePresentationBlocks(out.presentationBlocks)[0].rows).toHaveLength(7);
    expect(out.subtitle).toBe('');
    const outra = { ...base, presentationBlocks: [{ type: 'comparison', headers: ['A', 'B'], rows: [['x', 'y']] }] };
    expect(personalityComparison(outra)).toBe(outra);
  });

  it('o que sobra do texto vai para as notas, sem se perder', () => {
    const out = personalityComparison(draftSlides()[7]);
    expect(out.bodyAfterImage).toBe('');
    expect(out.speakerNotes).toContain('Cada par define um limite e um território');
  });

  it('presets comuns e blocos da IA mantêm o teto de 5 linhas', () => {
    expect(normalizePresentationBlocks([{ type: 'comparison', headers: ['A', 'B'], rows: SETE }])).toEqual([]);
    // A marca de pares só vale com a forma de pares (2 colunas, "sem …").
    expect(normalizePresentationBlocks([{ type: 'comparison', variant: 'pairs', headers: ['A', 'B'], rows: SETE.map(([a]) => [a, 'outra coisa']) }])).toEqual([]);
    expect(normalizePresentationBlocks([{ type: 'comparison', variant: 'pairs', headers: ['Traço', 'Sem ser'], rows: SETE }])[0].rows).toHaveLength(7);
    // A IA não passa a marca: o bloco escrito volta ao teto de 5.
    // (a tabela de 7 linhas é recusada como antes, com o projeto preservado).
    expect(() => validateCarouselDraft({ caption: '', presentationPlan: {}, slides: [{ title: 'Personalidade', subtitle: 'x', presentationBlocks: [{ type: 'comparison', variant: 'pairs', headers: ['Traço', 'Sem ser'], rows: SETE }] }] },
      { presetId: 'apresentacao', count: 1 })).toThrow(expect.objectContaining({ code: 'presentation_blocks_invalid' }));
    const cinco = validateCarouselDraft({ caption: '', presentationPlan: {}, slides: [{ title: 'Personalidade', subtitle: 'x', presentationBlocks: [{ type: 'comparison', variant: 'pairs', headers: ['Traço', 'Sem ser'], rows: SETE.slice(0, 5) }] }] },
      { presetId: 'apresentacao', count: 1 });
    expect(cinco.slides[0].presentationBlocks[0].variant).toBeUndefined();
  });

  it('ao trocar para um preset comum, a tabela volta a 5 linhas e os pares que sobram vão para o apoio', () => {
    const { slides } = finishFreeDraft({ slides: draftSlides() });
    const livre = applyPresentationVisualPresetToDoc({ presentationPath: 'auto', brand: { showHandle: false }, presentationDeckDesign: T6.deckDesign, slides }, 'presentation_free', undefined, { initialize: true });
    const comum = applyPresentationVisualPresetToDoc(livre, 'presentation_cinematic');
    const s8 = comum.slides[7];
    const [block] = normalizePresentationBlocks(s8.presentationBlocks);
    expect(block.rows).toHaveLength(5);
    expect(block.variant).toBeUndefined();
    expect(s8.subtitle).toBe('Contemporânea sem depender de tendências. Bem-humorada sem recorrer ao humor óbvio.');
  });
});

describe('(b) com o bloco de pares a página mantém o fundo art', () => {
  it('slide 8 do Teste 6: fundo art, sem foto, tabela e título no lado liso', () => {
    const { slides } = finishFreeDraft({ slides: draftSlides() });
    const deck = applyPresentationVisualPresetToDoc({ presentationPath: 'auto', brand: { showHandle: false }, presentationDeckDesign: T6.deckDesign, slides }, 'presentation_free', undefined, { initialize: true });
    const s8 = deck.slides[7];
    expect(s8.presentationFreeDesign.ground).toBe('art');
    expect(s8.presentationFreeDesign.photo).toBe('none');
    const { title, evidence } = s8.canvas.zones;
    expect(evidence.x + evidence.w).toBeLessThanOrEqual(FREE_ART_TEXT_MAX + 0.01);
    expect(title.x + title.w).toBeLessThanOrEqual(FREE_ART_TEXT_MAX + 0.01);
    expect(evidence.w).toBeGreaterThanOrEqual(50);
  });
});
