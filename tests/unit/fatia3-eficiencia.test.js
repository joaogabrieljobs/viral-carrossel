import { describe, it, expect } from 'vitest';
import { mkLibEntry } from '../../src/utils/landing-gate.js';
import {
  OBJECTIVE_TEMPLATES,
  applyObjectiveTemplate,
  resolveObjectiveTemplate,
} from '../../src/utils/objective-templates.js';
import { resolveQuickNarrativeMode } from '../../src/components/panels/CriarRapidoHome.jsx';
import {
  buildSeriesIdeasPrompt,
  normalizeSeriesIdeas,
  buildSeriesDraftSeed,
  cloneSeriesBrand,
} from '../../src/utils/series-drafts.js';
import { buildSeededLibraryDoc } from '../../src/hooks/useLibrary.js';
import {
  stampLogoVisibleOnSlides,
  hideLogoOnSlides,
  applyLogoVisibilityOnSlides,
} from '../../src/utils/slide-logo.js';
import { buildIdentityChecklist, resolveContextStatus } from '../../src/utils/context-status.js';

describe('objective-templates (Fatia 3)', () => {
  it('tem os 4 objetivos canónicos', () => {
    expect(OBJECTIVE_TEMPLATES.map((t) => t.id)).toEqual([
      'lancar', 'educar', 'prova_social', 'bastidor',
    ]);
  });

  it('Criar rápido aplica o modo do objetivo e preserva o modo salvo sem objetivo', () => {
    expect(resolveQuickNarrativeMode('educar', 'none')).toBe('how_to');
    expect(resolveQuickNarrativeMode('bastidor', 'none')).toBe('storytelling');
    expect(resolveQuickNarrativeMode(null, 'viral')).toBe('viral');
  });

  it('aplica template sem apagar pedido existente', () => {
    const kept = applyObjectiveTemplate('educar', { quickPrompt: 'Já tenho um pedido' });
    expect(kept.quickPrompt).toBe('Já tenho um pedido');
    expect(kept.narrativeMode).toBe('how_to');
    const empty = applyObjectiveTemplate('lancar', { quickPrompt: '' });
    expect(empty.quickPrompt).toMatch(/lançamento/i);
  });

  it('resolve desconhecido como null', () => {
    expect(resolveObjectiveTemplate('xyz')).toBeNull();
    expect(applyObjectiveTemplate('xyz')).toBeNull();
  });
});

describe('series-drafts (Fatia 3)', () => {
  it('monta prompt com quantidade e objetivo', () => {
    const prompt = buildSeriesIdeasPrompt({
      brandBio: 'Clínica estética',
      objectiveId: 'prova_social',
      ideaCount: 4,
    });
    expect(prompt).toMatch(/exatamente 4/);
    expect(prompt).toMatch(/Prova social/);
    expect(prompt).toMatch(/Clínica estética/);
  });

  it('normaliza ideias e descarta vazias', () => {
    const ideas = normalizeSeriesIdeas({
      ideas: [
        { title: 'Hook A', angle: 'ângulo' },
        { title: '  ' },
        { title: 'Hook B' },
      ],
    });
    expect(ideas).toHaveLength(2);
    expect(ideas[0].title).toBe('Hook A');
  });

  it('cria seed com contexto, marca e pedido persistidos no próprio rascunho', () => {
    const logo = 'data:image/png;base64,LOGO_DA_MARCA';
    const brand = {
      id: 'musa',
      name: 'MUSA',
      logo,
      titleColor: '#ff5500',
      textTitleSize: 143,
      useBrandVoice: true,
      brandTone: {
        summary: 'Editorial e direto',
        traits: ['preciso', 'provocador'],
        samplePhrases: ['O improviso cobra caro.'],
        method: 'MÉTODO TOM DA MARCA — perfil MUSA persistido.',
      },
    };
    const seed = buildSeriesDraftSeed({
      idea: { title: 'Tema X', angle: 'prova' },
      brand,
      styleKit: {
        contextMd: '# Brief',
        stylePrompt: 'editorial',
        logo: { imageId: 'logo1' },
        logoOnGenerate: true,
        refImages: [{ id: 'r1' }],
      },
      objectiveId: 'bastidor',
      folderId: 'pasta-1',
      publicationDate: '2026-10-08',
    });
    expect(seed.name).toBe('Tema X');
    expect(seed.folderId).toBe('pasta-1');
    expect(seed.publicationDate).toBe('2026-10-08');
    expect(seed.seedDoc.styleKit.contextMd).toBe('# Brief');
    expect(seed.seedDoc.styleKit.logo.imageId).toBe('logo1');
    expect(seed.seedDoc.brand).toMatchObject({ id: 'musa', logo, titleColor: '#ff5500' });
    expect(seed.seedDoc.brand).not.toBe(brand);
    expect(seed.seedDoc.brand.brandTone).not.toBe(brand.brandTone);
    expect(seed.seedDoc.brand.brandTone.traits).not.toBe(brand.brandTone.traits);
    expect(seed.seedDoc.slides).toBeUndefined();
    expect(seed.quickPrompt).toMatch(/Tema X/);
    expect(seed.seedDoc.quickPromptDraft).toBe(seed.quickPrompt);
  });

  it('não duplica strings pesadas ao copiar a marca da série', () => {
    const logo = `data:image/png;base64,${'A'.repeat(2000)}`;
    const fontData = `data:font/woff2;base64,${'B'.repeat(2000)}`;
    const source = { logo, customTitleFont: { dataUrl: fontData }, brandTone: null };
    const cloned = cloneSeriesBrand(source);
    expect(cloned).not.toBe(source);
    expect(cloned.logo).toBe(logo);
    expect(cloned.customTitleFont.dataUrl).toBe(fontData);
  });

  it('não replica evidências brutas de tom em cada rascunho da série', () => {
    const cloned = cloneSeriesBrand({
      id: 'musa',
      brandTone: { summary: 'Direto', traits: ['claro'] },
      voiceImageTexts: [{ name: 'card.png', text: 'x'.repeat(6000) }],
      voiceSampleText: 'legendas antigas',
      voiceSourceUrls: ['https://instagram.com/musa'],
    });
    expect(cloned.id).toBe('musa');
    expect(cloned.brandTone.summary).toBe('Direto');
    expect(cloned.voiceImageTexts).toBeUndefined();
    expect(cloned.voiceSampleText).toBeUndefined();
    expect(cloned.voiceSourceUrls).toBeUndefined();
  });

  it('hidrata o primeiro card com a marca do seed, não com o perfil global', () => {
    const fallback = {
      id: 'global', titleColor: '#0000ff', textTitleSize: 70,
    };
    const seedBrand = {
      id: 'projeto',
      logo: 'data:image/png;base64,PROJETO',
      titleColor: '#ff3300',
      textTitleSize: 146,
      brandTone: {
        summary: 'Voz do projeto',
        method: 'MÉTODO TOM DA MARCA — voz específica deste projeto.',
      },
    };
    const doc = buildSeededLibraryDoc({
      brand: seedBrand,
      quickPromptDraft: 'Tema aprovado do rascunho',
    }, fallback);

    expect(doc.brand.id).toBe('projeto');
    expect(doc.brand.logo).toBe(seedBrand.logo);
    expect(doc.brand.brandTone.summary).toBe('Voz do projeto');
    expect(doc.quickPromptDraft).toBe('Tema aprovado do rascunho');
    expect(doc.slides).toHaveLength(1);
    expect(doc.slides[0].titleSize).toBe(146);
    expect(doc.brand.titleColor).toBe('#ff3300');
  });
  it('mkLibEntry agenda quando há data editorial', () => {
    const withDate = mkLibEntry({ slides: [] }, 'Campanha', {
      folderId: 'f1',
      publicationDate: '2026-10-08',
    });
    expect(withDate).toMatchObject({
      folderId: 'f1',
      publicationDate: '2026-10-08',
      status: 'scheduled',
    });
    const draft = mkLibEntry({ slides: [] }, 'Rascunho', { folderId: 'f1' });
    expect(draft.status).toBe('draft');
    expect(draft.publicationDate).toBe('');
  });
});

describe('logo em massa (Fatia 3)', () => {
  const slides = [
    { id: 'a', logoHidden: true },
    { id: 'b', logoHidden: false },
    { id: 'c', logoHidden: true },
  ];

  it('mostra em todos ou só nos ids', () => {
    expect(stampLogoVisibleOnSlides(slides).every((s) => !s.logoHidden)).toBe(true);
    const only = stampLogoVisibleOnSlides(slides, ['a']);
    expect(only[0].logoHidden).toBe(false);
    expect(only[2].logoHidden).toBe(true);
  });

  it('oculta em todos ou só nos ids', () => {
    expect(hideLogoOnSlides(slides).every((s) => s.logoHidden)).toBe(true);
    const only = hideLogoOnSlides(slides, ['b']);
    expect(only[1].logoHidden).toBe(true);
    expect(only[0].logoHidden).toBe(true);
  });

  it('applyLogoVisibilityOnSlides escolhe mostrar/ocultar', () => {
    expect(applyLogoVisibilityOnSlides(slides, { ids: ['a'], hidden: false })[0].logoHidden).toBe(false);
    expect(applyLogoVisibilityOnSlides(slides, { ids: ['b'], hidden: true })[1].logoHidden).toBe(true);
  });
});

describe('checklist profissional (Fatia 3)', () => {
  it('separa Brief, Estilo e Referências', () => {
    const { items, status } = buildIdentityChecklist({
      brand: {
        bio: 'Estrategista de marca para clínicas de estética premium.',
        brandTone: { summary: 'Direto', method: 'MÉTODO TOM DA MARCA — conteúdo suficiente para validar.' },
        logo: 'data:image/png;base64,xx',
      },
      styleKit: {
        contextMd: '# Brief longo o suficiente para contar',
        stylePrompt: 'editorial clean',
        refImages: [{ id: '1' }, { id: '2' }],
      },
    });
    expect(status.id).toBe('completo');
    expect(items.find((i) => i.id === 'brief')?.ready).toBe(true);
    expect(items.find((i) => i.id === 'style')?.ready).toBe(true);
    expect(items.find((i) => i.id === 'refs')?.label).toMatch(/2 referências/);
    expect(items.find((i) => i.id === 'desc')).toBeUndefined();
  });

  it('resolveContextStatus expõe refCount', () => {
    expect(resolveContextStatus({
      styleKit: { refImages: [{}, {}] },
    }).refCount).toBe(2);
  });
});
