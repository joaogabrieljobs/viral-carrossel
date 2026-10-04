import { describe, it, expect } from 'vitest';
import {
  resolveContextStatus,
  buildIdentityChecklist,
  projectHasCarouselContent,
} from '../../src/utils/context-status.js';

describe('context-status (Fatia 2)', () => {
  it('classifica sem / básico / completo', () => {
    expect(resolveContextStatus({}).id).toBe('sem');
    expect(resolveContextStatus({
      brand: { bio: 'Estrategista de marca para clínicas de estética premium.' },
    }).id).toBe('basico');
    expect(resolveContextStatus({
      brand: {
        bio: 'Estrategista de marca para clínicas.',
        brandTone: { summary: 'Direto', method: 'MÉTODO TOM DA MARCA — voz editorial com conteúdo suficiente.' },
        logo: 'data:image/png;base64,xx',
      },
      styleKit: { contextMd: '# Brief\n'.padEnd(50, 'x') },
    }).id).toBe('completo');
  });

  it('checklist não bloqueia — só informa', () => {
    const { items } = buildIdentityChecklist({ brand: {}, styleKit: {} });
    expect(items.every((i) => typeof i.ready === 'boolean')).toBe(true);
    expect(items.find((i) => i.id === 'brief').ready).toBe(false);
  });

  it('detecta carrossel com conteúdo', () => {
    expect(projectHasCarouselContent([])).toBe(false);
    expect(projectHasCarouselContent([{ title: 'Seu título aqui' }])).toBe(false);
    expect(projectHasCarouselContent([{
      title: 'Seu título aqui',
      subtitle: 'Subtítulo descritivo que reforça o gancho principal do carrossel.',
    }])).toBe(false);
    expect(projectHasCarouselContent([{ title: 'Hook' }])).toBe(true);
    expect(projectHasCarouselContent([{ title: 'Seu título aqui', subtitle: 'Sub real' }])).toBe(true);
  });

  it('reconhece logo persistida no IndexedDB sem depender da URL de runtime', () => {
    expect(resolveContextStatus({ brand: { logoImageId: 'logo-1' } }).hasLogo).toBe(true);
  });
});
