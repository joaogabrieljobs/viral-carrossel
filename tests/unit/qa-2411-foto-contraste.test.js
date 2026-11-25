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

  // Ajuste 24/11: a composição grava sempre um número no escurecimento (0 na
  // página sem foto), então 0 gravado não se distingue de 0 escolhido pela
  // pessoa. A vista não aplica véu nenhum por conta própria.
  it('escurecimento 0 gravado + foto: a vista mantém 0 (Ensaio fotográfico e Cinemático)', () => {
    for (const id of ['presentation_photo_essay', 'presentation_cinematic']) {
      const { slide } = pagina(id);
      expect(slide.overlay, id).toBe(0);
      const vista = comFoto(slide);
      expect(vista.overlay, id).toBe(0);
      expect(vista.overlayMode, id).toBe(slide.overlayMode);
    }
  });

  it('qualquer escurecimento gravado é respeitado como está', () => {
    for (const overlay of [0, 15, 40, 80]) {
      const { slide } = pagina('presentation_photo_essay');
      expect(comFoto({ ...slide, overlay }).overlay).toBe(overlay);
    }
  });

  it('texto que passa a ficar sobre a foto: cor e véu ficam como na página sem foto', () => {
    for (const id of ['presentation_photo_essay', 'presentation_cinematic']) for (const [role, index] of [['cover', 0], ['demo', 2]]) {
      const { slide } = pagina(id, role, index);
      const vista = comFoto(slide);
      expect([vista.titleColor, vista.subtitleColor, vista.textColor, vista.overlay], `${id} ${role}`)
        .toEqual([slide.titleColor, slide.subtitleColor, slide.textColor, slide.overlay]);
    }
  });

  it('só a capa do Executivo muda de cor ao receber a foto (dez famílias, seis funções)', () => {
    const mudou = [];
    for (const preset of PRESETS) for (const [role, index] of ROLES) {
      const { slide } = pagina(preset.id, role, index);
      const vista = comFoto(slide);
      const gravado = (s) => JSON.stringify([s.titleColor, s.subtitleColor, s.textColor, s.overlay, s.overlayMode]);
      if (gravado(slide) !== gravado(vista)) mudou.push(`${preset.id} ${role}`);
    }
    expect(mudou).toEqual(['presentation_executive_minimal cover']);
  });

  it('página com fundo próprio da família continua legível depois da foto (>= 4,5)', () => {
    for (const preset of PRESETS) for (const [role, index] of ROLES) {
      const { brand, slide } = pagina(preset.id, role, index);
      const vista = comFoto(slide);
      // Texto sobre a foto não entra: a superfície é a foto e o escurecimento é da pessoa.
      const z = vista.canvas.zones;
      const sobreFoto = z.photo.x <= z.title.x && z.photo.x + z.photo.w >= z.title.x + z.title.w && z.photo.y <= z.title.y && z.photo.y + z.photo.h >= z.title.y + z.title.h;
      if (sobreFoto) continue;
      const c = contrastes(vista, brand);
      expect(Math.min(c.titulo, c.apoio, c.corpo), `${preset.id} ${role}`).toBeGreaterThanOrEqual(4.5);
    }
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
