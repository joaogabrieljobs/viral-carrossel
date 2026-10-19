import { describe, it, expect } from 'vitest';
import { cultureAccentRenderablePieces } from '../../src/utils/text-spans.js';
import { cultureReadableInks, inkIfReadable } from '../../src/utils/brand-visuals.js';
import { DARK_CREAM } from '../../src/utils/slide-design-system.js';
import { collectSourceHosts, restoreSourceHosts } from '../../src/utils/generation-prompts.js';
import { explicitBrandColorsFromKit } from '../../src/utils/style-kit-design.js';
import { ensureDocShape, repairDefaultBrandHandle } from '../../src/utils/doc-schema.js';
import { visibleLogoPosition } from '../../src/utils/slide-logo.js';

describe('itálico do card', () => {
  it('pinta *vazia* em itálico e tira o asterisco', () => {
    const pieces = cultureAccentRenderablePieces('A CADEIRA *vazia* DO MARCOS');
    expect(pieces.map((p) => p.v).join('')).toBe('A CADEIRA vazia DO MARCOS');
    expect(pieces.find((p) => p.v === 'vazia')?.type).toBe('italic');
    expect(pieces.some((p) => p.v.includes('*'))).toBe(false);
  });

  it('mantém **vazia** como destaque', () => {
    const pieces = cultureAccentRenderablePieces('A CADEIRA **vazia** DO MARCOS');
    expect(pieces.find((p) => p.v === 'vazia')?.type).toBe('accent');
    expect(pieces.some((p) => p.type === 'italic')).toBe(false);
  });

  it('trata _esvaziou_ como itálico e não mostra o underscore', () => {
    const pieces = cultureAccentRenderablePieces('A AGENDA QUE _esvaziou_');
    expect(pieces.map((p) => p.v).join('')).toBe('A AGENDA QUE esvaziou');
    expect(pieces.find((p) => p.v === 'esvaziou')?.type).toBe('italic');
    expect(pieces.some((p) => p.v.includes('_'))).toBe(false);
  });

  it('não parte snake_case nem domínio', () => {
    const pieces = cultureAccentRenderablePieces('get_webexpresso.com ficou no ar');
    expect(pieces.map((p) => p.v).join('')).toBe('get_webexpresso.com ficou no ar');
    expect(pieces.some((p) => p.type === 'italic')).toBe(false);
  });
});

describe('contraste do título no grafite', () => {
  it('troca preto do minimal clean por tinta clara e mantém o rose', () => {
    const inks = cultureReadableInks('#1c1c1c', '#0a0a0a', '#3a3a3a', '#c45c6a');
    expect(inkIfReadable('#0a0a0a', '#1c1c1c', inks.titleInk, 3)).toBe(DARK_CREAM.title);
    expect(inkIfReadable('#3a3a3a', '#1c1c1c', inks.subtitleInk, 3)).toBe(inks.subtitleInk);
    expect(inks.titleInk).toBe(DARK_CREAM.title);
    expect(inks.accentInk.toLowerCase()).toBe('#c45c6a');
  });

  it('mantém o preto quando o fundo é claro', () => {
    expect(inkIfReadable('#0a0a0a', '#fafaf6', '#ffffff', 3)).toBe('#0a0a0a');
  });
});

describe('domínio do material', () => {
  it('recolhe o host e devolve o começo cortado', () => {
    const hosts = collectSourceHosts('Site https://getwebexpresso.com/planos');
    expect(hosts).toContain('getwebexpresso.com');
    expect(restoreSourceHosts('O endereço fica em webexpresso.', hosts)).toBe('O endereço fica em getwebexpresso.com');
    expect(restoreSourceHosts('O endereço fica em webexpresso. com', hosts)).toBe('O endereço fica em getwebexpresso.com');
  });
});

describe('cores do brief', () => {
  it('copia grafite e rose e não inventa cor sem hex', () => {
    const patch = explicitBrandColorsFromKit({
      contextMd: 'Fundo grafite #1c1c1c. Acento rose #c45c6a.',
    });
    expect(patch.bg).toBe('#1c1c1c');
    expect(patch.accent).toBe('#c45c6a');
    expect(explicitBrandColorsFromKit({ contextMd: 'Use grafite e rose.' })).toEqual({});
  });
});

describe('marca Padrão', () => {
  it('tira o @ da clínica que vazou para o perfil padrão', () => {
    const roster = repairDefaultBrandHandle([
      { id: 'default', name: 'Padrão', handle: '@clinicajaninearaujo', showHandle: true },
      { id: 'clinica', name: 'Clínica', handle: '@clinicajaninearaujo' },
    ]);
    expect(roster[0].handle).toBe('');
    expect(roster[0].showHandle).toBe(false);
    expect(roster[1].handle).toBe('@clinicajaninearaujo');
    const doc = ensureDocShape({ brand: { id: 'default', name: 'Padrão', handle: 'clinicajaninearaujo' } });
    expect(doc.brand.handle).toBe('');
  });
});

describe('logo sobre o texto', () => {
  it('tira a logo do centro quando ela não foi arrastada e o texto é longo', () => {
    const slide = { title: 'O CLIENTE achou', subtitle: 'Nada de template engessado com o nome cola', logoPosition: 'c' };
    expect(visibleLogoPosition({ logoPosition: 'c' }, slide)).toBe('tr');
    expect(visibleLogoPosition({ logoPosition: 'c' }, { ...slide, elementOffsets: { logo: { x: 1, y: 2 } } })).toBe('c');
    expect(visibleLogoPosition({ logoPosition: 'bl' }, { title: slide.title, subtitle: slide.subtitle })).toBe('bl');
  });
});
