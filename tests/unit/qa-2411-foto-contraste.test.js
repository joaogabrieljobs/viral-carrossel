import { describe, expect, it } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS, applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
import { brandPaletteOverrides, groundInks } from '../../src/utils/presentation-families.js';
import { needsLightPhotoText } from '../../src/utils/style-kit-design.js';
import { wcagContrast } from '../../src/utils/wcag.js';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';

// QA 24/11 (deck C): capa do Executivo planejada sem foto tem fundo marinho e
// título #F7F7F5. Ao importar uma foto, a vista recompõe a página (foto ao
// lado, fundo claro #F7F7F5) mas mantinha a tinta da capa escura: título e
// apoio sumiam, branco sobre branco.
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PRESETS = PRESENTATION_VISUAL_PRESETS.filter((preset) => preset.sourceId);
const ROLES = [['cover', 0], ['content', 2], ['divider', 2], ['demo', 2], ['data', 2], ['closing', 4]];

function pagina(presetId, role = 'cover', index = 0, extra = {}) {
  const brand = applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, presetId);
  const base = { ...mkSlide(index + 1, brand), title: 'A padaria que abriu a cozinha', subtitle: 'Um estudo sobre processo à vista.', presentationPlan: { visualRole: role } };
  const slide = { ...base, ...getPresentationCompositionOverrides(presetId, { slide: base, stage: { visualRole: role }, index, count: 5 }), ...extra };
  return { brand, slide };
}
/** Vista do slide depois que a pessoa importa uma foto (o documento só ganha a foto). */
const comFoto = (slide) => slideForFormatDisplay({ ...slide, bgImage: FOTO }, 'apresentacao', {}, 'apresentacao');
/** Fundo atrás do texto, como o card o resolve (SlideCardInner: foto com véu, fundo da família ou fundo da marca). */
function superficie(slide, brand) {
  if (needsLightPhotoText(slide)) return '#111111';
  const chrome = slide.presentationChrome;
  if (chrome?.ground && chrome.ground !== 'bg') return groundInks(chrome.family, chrome.ground, brandPaletteOverrides(chrome.family, brand)).bg;
  return brand.bg;
}
const tintas = (slide, brand) => ({
  titulo: slide.titleColor || brand.titleColor,
  apoio: slide.subtitleColor || brand.subtitleColor || brand.titleColor,
  corpo: slide.textColor || brand.textColor,
});
const contrastes = (slide, brand) => Object.fromEntries(Object.entries(tintas(slide, brand)).map(([nome, cor]) => [nome, wcagContrast(cor, superficie(slide, brand))]));

describe('QA 24/11 deck C: tinta do texto acompanha a superfície ao importar foto', () => {
  it('capa do Executivo: sem foto é clara sobre marinho; com foto importada lê no fundo claro (>= 4,5)', () => {
    const { brand, slide } = pagina('presentation_executive_minimal');
    expect(slide.presentationGround).toBe('inverse');
    expect(slide.titleColor).toBe('#F7F7F5');
    expect(contrastes(slide, brand).titulo).toBeGreaterThanOrEqual(4.5);

    const vista = comFoto(slide);
    expect(vista.presentationGround).toBe('bg');
    expect(superficie(vista, brand).toUpperCase()).toBe('#F7F7F5');
    const c = contrastes(vista, brand);
    expect(c.titulo).toBeGreaterThanOrEqual(4.5);
    expect(c.apoio).toBeGreaterThanOrEqual(4.5);
    expect(c.corpo).toBeGreaterThanOrEqual(4.5);
    // O documento não muda: a correção é da vista.
    expect(slide.titleColor).toBe('#F7F7F5');
  });

  it('caso inverso: capa do Ensaio fotográfico passa a ter o texto sobre a foto escurecida e a tinta fica clara', () => {
    const { brand, slide } = pagina('presentation_photo_essay');
    // Sem foto: tinta escura da marca sobre o papel claro, sem cor gravada no slide.
    expect(slide.titleColor).toBeUndefined();
    expect(wcagContrast(tintas(slide, brand).titulo, superficie(slide, brand))).toBeGreaterThanOrEqual(4.5);

    const vista = comFoto(slide);
    // O texto fica sobre a foto: véu da família no teto da foto própria (40) e tinta clara.
    expect(vista.overlay).toBe(40);
    expect(needsLightPhotoText(vista)).toBe(true);
    const c = contrastes(vista, brand);
    expect(c.titulo).toBeGreaterThanOrEqual(4.5);
    expect(c.apoio).toBeGreaterThanOrEqual(4.5);
    expect(c.corpo).toBeGreaterThanOrEqual(4.5);
  });

  it('escurecimento que a pessoa já ajustou no slide não é trocado pelo véu da família', () => {
    const { slide } = pagina('presentation_photo_essay');
    expect(comFoto({ ...slide, overlay: 15 }).overlay).toBe(15);
  });

  it('páginas em que o texto continua na mesma superfície não mudam de cor ao receber a foto (dez famílias, seis funções)', () => {
    const mudou = [];
    for (const preset of PRESETS) for (const [role, index] of ROLES) {
      const { brand, slide } = pagina(preset.id, role, index);
      const vista = comFoto(slide);
      const c = contrastes(vista, brand);
      expect(Math.min(c.titulo, c.apoio, c.corpo), `${preset.id} ${role}`).toBeGreaterThanOrEqual(4.5);
      const gravado = (s) => JSON.stringify([s.titleColor, s.subtitleColor, s.textColor, s.overlay || 0]);
      if (gravado(slide) !== gravado(vista)) mudou.push(`${preset.id} ${role}`);
    }
    // Muda só onde a superfície do texto trocou: capa do Executivo (marinho → claro)
    // e as páginas em que o texto passou a ficar sobre a foto.
    expect(mudou).toEqual(['presentation_executive_minimal cover', 'presentation_cinematic cover', 'presentation_cinematic demo', 'presentation_photo_essay cover']);
  });

  it('texto que passa a ficar sobre a foto mantém a tinta da família (Cinemático), agora com o véu', () => {
    const { brand, slide } = pagina('presentation_cinematic');
    const vista = comFoto(slide);
    expect(vista.overlay).toBe(40);
    // Mesma cor de título de antes da foto: a da família, não o branco genérico.
    expect(vista.titleColor.toLowerCase()).toBe(brand.titleColor.toLowerCase());
    expect(contrastes(vista, brand).titulo).toBeGreaterThanOrEqual(4.5);
  });

  it('cor escolhida pela pessoa que continua legível na superfície nova é mantida', () => {
    const { brand, slide } = pagina('presentation_executive_minimal');
    const vista = comFoto({ ...slide, titleColor: '#7A1F1F' });
    expect(vista.titleColor).toBe('#7A1F1F');
    expect(contrastes(vista, brand).titulo).toBeGreaterThanOrEqual(4.5);
  });

  it('marca própria com fundo escuro: a tinta clara da capa não é trocada por tinta escura', () => {
    const { brand, slide } = pagina('presentation_executive_minimal');
    const escura = { ...brand, bg: '#101418', titleColor: '#F2F2F0', subtitleColor: '#F2F2F0', textColor: '#C9CDD3' };
    const vista = comFoto(slide);
    const c = contrastes(vista, escura);
    expect(c.titulo).toBeGreaterThanOrEqual(4.5);
    expect(c.apoio).toBeGreaterThanOrEqual(4.5);
  });
});
