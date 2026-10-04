import { describe, it, expect } from 'vitest';
import { mkLibEntry } from '../../src/utils/landing-gate.js';
import {
  OBJECTIVE_TEMPLATES,
  applyObjectiveTemplate,
  resolveObjectiveTemplate,
} from '../../src/utils/objective-templates.js';
import {
  buildSeriesIdeasPrompt,
  normalizeSeriesIdeas,
  buildSeriesDraftSeed,
} from '../../src/utils/series-drafts.js';
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

  it('cria seed de rascunho com styleKit herdado e slides omitidos', () => {
    const seed = buildSeriesDraftSeed({
      idea: { title: 'Tema X', angle: 'prova' },
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
    expect(seed.seedDoc.slides).toBeUndefined();
    expect(seed.quickPrompt).toMatch(/Tema X/);
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
