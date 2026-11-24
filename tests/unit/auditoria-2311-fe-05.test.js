import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition, restyleSocialSlides } from '../../src/utils/social-visual-composition.js';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyGenerationLogoPolicy, resolveLogoControls, LOGO_SIZE_IMPORT } from '../../src/utils/slide-logo.js';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// Auditoria 23/11 (FE-05): a correção de 22/11 baixou o tamanho de entrada da
// logo só no import de Marca → Logo. Pela criação do projeto a logo (só do
// projeto) entrava a 260, o padrão de fábrica da marca; pela Home do Criar
// rápido, a 300. E a composição não reservava o canto para a logo do projeto.
const preset = VISUAL_PRESETS.find((p) => p.id === 'viral_hype_dark');
/** Projeto novo: a marca não tem logo; a logo é só do projeto. */
const brand = { ...applyVisualPreset({ ...DEFAULT_BRAND, name: 'Ateliê Traço', handle: 'atelietraco' }, preset.id), logo: null, logoImageId: null };
const projectLogoAsset = { logoImageId: 'logo-projeto', logoImage: 'blob:logo-projeto' };
const deck = () => ['Uma ideia clara', 'Outra ideia', 'Fecho'].map((title, i) => ({
  ...mkSlide(i + 1, brand), id: `s${i}`, title, subtitle: 'Apoio curto.', imageQuery: i === 1 ? '' : 'cena',
}));
const generate = (slides, policy) => applySocialVisualComposition(
  applyGenerationLogoPolicy(slides, policy),
  { preset, photoRegion: 'full', brand, formato: 'carrossel' },
);

describe('auditoria 23/11 FE-05: tamanho de entrada da logo na criação', () => {
  it('logo só do projeto entra no tamanho de importação, não no padrão de fábrica da marca', () => {
    expect(brand.logoSize).toBe(260);
    const slides = applyGenerationLogoPolicy(deck(), { enabled: true, projectLogoAsset, hasBrandLogo: false });
    for (const slide of slides) {
      expect(slide.logoImageId).toBe('logo-projeto');
      expect(resolveLogoControls(brand, slide).logoSize).toBe(LOGO_SIZE_IMPORT);
    }
  });

  it('marca com logo própria: o card segue o tamanho que a pessoa deixou na marca', () => {
    const slides = applyGenerationLogoPolicy(deck(), { enabled: true, projectLogoAsset, hasBrandLogo: true });
    for (const slide of slides) expect(slide.logoSize).toBeUndefined();
    expect(resolveLogoControls({ ...brand, logo: 'marca.png', logoSize: 120 }, slides[0]).logoSize).toBe(120);
  });

  it('tamanho que o card já traz (composição de apresentação) é mantido', () => {
    const slides = applyGenerationLogoPolicy(deck().map(slide => ({ ...slide, logoSize: 80 })), { enabled: true, projectLogoAsset, hasBrandLogo: false });
    expect(slides.map(slide => slide.logoSize)).toEqual([80, 80, 80]);
  });

  it('a composição reserva o canto para a logo do projeto, no tamanho com que ela entra', () => {
    const slides = generate(deck(), { enabled: true, projectLogoAsset, hasBrandLogo: false });
    for (const slide of slides) {
      expect(slide.socialArt.logoCorner).toBe('tr');
      expect(slide.socialArt.logo).toEqual({ pos: 'tr', size: LOGO_SIZE_IMPORT });
    }
  });

  it('sem logo nenhuma, ou com a logo desligada no projeto, nada é reservado', () => {
    for (const slide of generate(deck(), { enabled: true, projectLogoAsset: null, hasBrandLogo: false })) expect(slide.socialArt.logoCorner).toBeNull();
    for (const slide of generate(deck(), { enabled: false, projectLogoAsset, hasBrandLogo: false })) expect(slide.socialArt.logoCorner).toBeNull();
  });

  it('reaplicar o estilo num projeto com logo só nos cards mantém a reserva', () => {
    const generated = generate(deck(), { enabled: true, projectLogoAsset, hasBrandLogo: false });
    for (const slide of restyleSocialSlides(generated, { preset, brand, formato: 'carrossel' })) expect(slide.socialArt.logoCorner).toBe('tr');
  });

  it('a geração põe a logo nos cards antes de compor', () => {
    const app = source('ViralCarrossel.jsx');
    const policy = app.indexOf('newSlides = applyGenerationLogoPolicy(newSlides');
    const composition = app.indexOf('newSlides = applySocialVisualComposition(newSlides');
    expect(policy).toBeGreaterThan(0);
    expect(policy).toBeLessThan(composition);
  });

  it('a Home do Criar rápido usa o mesmo tamanho de entrada', () => {
    const quick = source('src/components/panels/CriarRapidoHome.jsx');
    expect(quick).not.toMatch(/logoSize:\s*\d/);
    expect(quick).toContain('logoSize: LOGO_SIZE_IMPORT');
  });
});
