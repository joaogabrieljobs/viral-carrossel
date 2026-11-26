// Teste 7: os contratos do diretor, além do e2e pelo assistente.
// A fixture conserva o roteiro e o texto que realmente falharam em produção.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { finishFreeDraft, personalityComparison, personalityPairs } from '../../src/utils/free-draft.js';
import {
  freePresentationCompositionOverrides, slideSkipsImageGeneration, snapDeckDesignToPalette, stripFreeSlideFields,
} from '../../src/utils/free-design.js';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { applyDeckArt, deckArtLayer } from '../../src/utils/deck-art.js';

const T7 = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste7.json', import.meta.url), 'utf8'));
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const draftSlides = () => T7.slides.map((s, index) => ({
  id: `t7-${index + 1}`, title: s.title, subtitle: s.subtitle, bodyAfterImage: s.bodyAfterImage, eyebrow: s.eyebrow,
  presentationBlocks: structuredClone(s.presentationBlocks),
  ...(s.design.photo !== 'none' ? { bgImage: PHOTO, imageQuery: 'foto editorial de teste' } : {}),
  presentationPlan: {
    schemaVersion: 3, visualRole: s.visualRole, purpose: s.purpose,
    design: structuredClone(s.design), scene: structuredClone(s.scene),
  },
}));
const compose = slides => applyPresentationVisualPresetToDoc({
  presentationPath: 'auto', brand: { showHandle: false }, presentationDeckDesign: T7.deckDesign, slides,
}, 'presentation_free', undefined, { initialize: true });

describe('Teste 7: comparação sustentada pelo texto, sem bloco da IA', () => {
  it('os chapéus nomeiam o assunto principal, sem uma menção incidental consumir o tema seguinte', () => {
    const finished = finishFreeDraft({ slides: draftSlides() });
    expect(finished.slides.slice(3, 6).map(slide => slide.eyebrow)).toEqual(['O ENCONTRO', 'A MÚSICA', 'O PÚBLICO']);
  });

  it('extrai os sete pares em minúsculas, separados por vírgula depois de um prefixo', () => {
    const pairs = personalityPairs(T7.slides[7].subtitle);
    expect(pairs).toHaveLength(7);
    expect(pairs[0]).toEqual(['brasileira', 'sem ser caricata.']);
    expect(pairs[6]).toEqual(['bem-humorada', 'sem recorrer ao humor óbvio.']);
  });

  it('comparison vazio usa os sete pares e preserva o prefixo nas notas, uma vez', () => {
    const original = draftSlides()[7];
    const slide = personalityComparison(original);
    expect(slide.presentationBlocks).toHaveLength(1);
    expect(slide.presentationBlocks[0]).toMatchObject({ type: 'comparison', variant: 'pairs', headers: ['Traço', 'Sem ser'] });
    expect(slide.presentationBlocks[0].rows).toHaveLength(7);
    expect(slide.subtitle).toBe('');
    expect(slide.speakerNotes).toBe('A personalidade vive nos contrastes:');
    expect(personalityComparison(slide)).toEqual(slide);
    expect(original.subtitle).toBe(T7.slides[7].subtitle);
  });

  it('não fabrica uma tabela sem três pares sustentados, nem substitui um bloco existente', () => {
    const unsupported = { ...draftSlides()[7], subtitle: 'A marca é brasileira, sofisticada e contemporânea.' };
    expect(personalityComparison(unsupported)).toBe(unsupported);
    const existing = { ...draftSlides()[7], presentationBlocks: [{ type: 'quote', text: 'Uma frase existente.' }] };
    expect(personalityComparison(existing)).toBe(existing);
  });
});

describe('Teste 7: família escolhida e composição efetiva concordam', () => {
  it('slide 8 conserva a família Suíça mesmo depois das seis famílias do roteiro', () => {
    const finished = finishFreeDraft({ slides: draftSlides() });
    const slide = compose(finished.slides).slides[7];
    expect(slide.presentationPlan.design.family).toBe('swiss');
    expect(slide.presentationFreeDesign.family).toBe('swiss');
    expect(slide.presentationDesignFamily).toBe('swiss');
    expect(slide.presentationChrome.family).toBe('swiss');
    expect(slide.presentationFreeDesign).toMatchObject({ photo: 'none', block: 'comparison' });
    expect(slide.presentationBlocks[0].rows).toHaveLength(7);
    expect(slide.presentationFreeDesignOverride).toBeUndefined();
  });

  it('o compositor livre resolve a família antes de chamar a geometria, mesmo com base legada', () => {
    const slide = personalityComparison(draftSlides()[7]);
    const result = freePresentationCompositionOverrides({ presentationPresetId: 'presentation_cinematic' }, {
      slide, index: 7, count: 10, deckDesign: T7.deckDesign,
    });
    expect(result.presentationDesignFamily).toBe('swiss');
    expect(result.presentationDesignFamily).toBe(result.presentationFreeDesign.family);
    expect(result.presentationChrome.chrome.map(d => d.text || '').join(' ')).not.toMatch(/CENA\b/i);
  });

  it('uma troca inevitável por ritmo fica registrada com origem, destino e motivo', () => {
    const slide = personalityComparison(draftSlides()[7]);
    const first = freePresentationCompositionOverrides({}, { slide, index: 2, count: 5, deckDesign: T7.deckDesign });
    const next = freePresentationCompositionOverrides({}, { slide, index: 3, count: 5, previous: [first], deckDesign: T7.deckDesign });
    expect(first.presentationFreeDesign.family).toBe('swiss');
    expect(next.presentationFreeDesign.family).not.toBe('swiss');
    expect(next.presentationFreeDesignOverride).toMatchObject({
      fromFamily: 'swiss', toFamily: next.presentationFreeDesign.family, reason: 'rhythm_family_kind',
    });
  });

  it('nenhuma página do deck livre conserva o rótulo CENA das famílias', () => {
    const doc = compose(finishFreeDraft({ slides: draftSlides() }).slides);
    for (const slide of doc.slides) {
      expect(slide.presentationChrome.chrome.map(d => d.text || '').join(' '), slide.id).not.toMatch(/CENA\b/i);
    }
  });
});

describe('Teste 7: arte de fundo e base da identidade', () => {
  it('adota pelo menos uma arte em páginas elegíveis mesmo se todas pedirem fundo sólido', () => {
    const source = [0, 1, 2, 3, 4].map(index => ({
      id: `solid-${index}`, title: 'Uma identidade em movimento', subtitle: 'Presença, encontro e expressão.',
      presentationPlan: {
        schemaVersion: 3, visualRole: index === 0 ? 'cover' : index === 4 ? 'closing' : 'content',
        purpose: index === 0 ? 'introduction' : index === 4 ? 'decision' : 'vision',
        design: { family: ['editorial', 'swiss', 'cinematic', 'typographic', 'executive'][index], ground: 'inverse', photo: 'none', block: 'none' },
      },
    }));
    const doc = compose(source);
    const art = doc.slides.filter(slide => slide.presentationFreeDesign.ground === 'art');
    expect(art.length).toBeGreaterThanOrEqual(1);
    expect(art.length).toBeLessThanOrEqual(3);
    const withImage = applyDeckArt(doc.slides, { presentationArtImageId: 'arte-teste', presentationArtImage: PHOTO });
    for (const slide of withImage.filter(item => item.presentationFreeDesign.ground === 'art')) {
      expect(slide.presentationFreeDesign.photo).toBe('none');
      expect(deckArtLayer(slide)?.image).toBe(PHOTO);
    }
  });

  it('o snap usa os pesos: índigo de 23,1% prevalece sobre o preto neutro', () => {
    const next = snapDeckDesignToPalette(T7.deckDesign, T7.styleKit.referencePalette.colors);
    expect(next.palette.bg).toBe('#2B2158');
    expect(T7.deckDesign.palette.bg).toBe('#0E0E0F');
  });

  it('listas legadas sem pesos continuam apenas aproximando a cor', () => {
    const next = snapDeckDesignToPalette(T7.deckDesign, T7.styleKit.referencePalette.colors.map(c => c.hex));
    expect(next.palette.bg).toBe('#0E0E0F');
  });
});

describe('Teste 7: ausência temporária de foto não vira intenção permanente', () => {
  it('permite regenerar uma foto que falhou, mas não gera foto em uma página originalmente sem foto', () => {
    const slide = { presentationFreeDesign: { photo: 'none' }, presentationImageFallback: { reason: 'timeout' } };
    expect(slideSkipsImageGeneration(slide)).toBe(false);
    expect(slideSkipsImageGeneration({ presentationFreeDesign: { photo: 'none' } })).toBe(true);
  });

  it('retira o estado de fallback e a decisão de ritmo ao sair do modo livre', () => {
    const slide = {
      presentationFreeDesign: { photo: 'none' }, presentationImageFallback: { reason: 'timeout' },
      presentationFreeDesignOverride: { fromFamily: 'swiss', toFamily: 'editorial', reason: 'rhythm_family_kind' },
    };
    const next = stripFreeSlideFields(slide);
    expect(next).not.toHaveProperty('presentationImageFallback');
    expect(next).not.toHaveProperty('presentationFreeDesignOverride');
  });
});
