// Etapa 2, melhoria 7 do plano do carrossel (26/11/2026): a paleta tirada da
// imagem de referência do kit (Teste 6, item 1) passa a valer também na
// geração de carrossel. Ela alimenta o desenho do projeto (projectDesign),
// abaixo das cores escritas no kit, e fica guardada no kit como na
// apresentação. Nenhum pedido de texto ou de imagem muda: as cores saem da
// imagem no navegador, pelo código.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../helpers/png.js';
import { extractPaletteFromPixels, normalizeReferencePalette } from '../../src/utils/reference-palette.js';
import { explicitBrandColorsFromKit, projectDesignBrandPatch, projectDesignWithReferencePalette } from '../../src/utils/style-kit-design.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const FLYER = decodePng(new URL('../fixtures/apoteose-flyer-referencia.png', import.meta.url));
const PALETA = extractPaletteFromPixels(FLYER.data, FLYER);
const HEXES = PALETA.map((c) => c.hex);
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');

describe('paleta da referência no desenho do projeto do carrossel', () => {
  it('sem desenho da IA: fundo, título e acento saem da referência, com leitura garantida', () => {
    const design = projectDesignWithReferencePalette(null, PALETA);
    expect(design.bg).toBe(PALETA[0].hex);
    expect(HEXES).toContain(design.accent);
    expect(wcagContrast(design.titleColor, design.bg)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(design.subtitleColor, design.bg)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(design.textColor, design.bg)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(design.accent, design.bg)).toBeGreaterThanOrEqual(3);
    // Vira patch de marca pelo mesmo caminho do projectDesign.
    expect(projectDesignBrandPatch(design)).toMatchObject({ bg: design.bg, accent: design.accent, titleColor: design.titleColor });
  });

  it('cor que a IA inventou (#F5C842 no Teste 6) vai para a cor mais próxima da referência', () => {
    const design = projectDesignWithReferencePalette({ bg: '#1A0B2E', accent: '#F5C842', titleColor: '', titleFont: 'Anton' }, PALETA);
    expect(HEXES).toContain(design.bg);
    expect(HEXES).toContain(design.accent);
    expect(design.accent).not.toBe('#F5C842');
    // Campos que não são cor ficam como vieram.
    expect(design.titleFont).toBe('Anton');
  });

  it('cores escritas no kit vencem a referência', () => {
    const kit = { contextMd: 'Fundo #112233 e título #FAFAFA.', stylePrompt: '' };
    const escritas = explicitBrandColorsFromKit(kit);
    const design = projectDesignWithReferencePalette({ bg: '#112233' }, PALETA, { kitColors: Object.values(escritas) });
    expect(design.bg).toBe('#112233');
    const marca = { ...projectDesignBrandPatch(design), ...escritas };
    expect(marca.bg).toBe('#112233');
    expect(marca.titleColor).toBe('#FAFAFA');
  });

  it('sem referência, o desenho do projeto fica exatamente como antes', () => {
    const raw = { bg: '#101010', titleColor: '#FFFFFF', accent: '#FF0000', titleFont: 'Inter' };
    expect(projectDesignWithReferencePalette(raw, [])).toBe(raw);
    expect(projectDesignWithReferencePalette(undefined, normalizeReferencePalette([]))).toBeUndefined();
  });

  it('o app extrai e guarda a paleta também no carrossel, sem misturar as paletas do planejamento', () => {
    // A extração do carrossel tem variável própria: as cores da apresentação
    // (planningContext.referenceColors) continuam só da apresentação.
    expect(app).toMatch(/let carouselReferenceColors = \[\];/);
    const planStart = app.indexOf('planningContext:');
    expect(planStart).toBeGreaterThan(0);
    const planning = app.slice(planStart, app.indexOf('presentationLimitsForPlan:', planStart));
    expect(planning).toMatch(/\n\s+referenceColors,/);
    expect(planning).toContain("sources: [{ id: 'request'");
    expect(planning).not.toContain('carouselReferenceColors');
    // Alimenta o projectDesign, antes das cores escritas no kit.
    const i = app.indexOf('projectDesignWithReferencePalette(result.projectDesign, carouselReferenceColors');
    expect(i).toBeGreaterThan(0);
    expect(app.indexOf('...explicitBrandColorsFromKit(styleKit),', i)).toBeGreaterThan(i);
    // Guardada no kit pelo mesmo campo da apresentação.
    expect(app).toMatch(/styleKit: \{ \.\.\.normalizeStyleKit\(d\.styleKit\),\s+\.\.\.\(referencePaletteField \? \{ referencePalette: referencePaletteField \}/);
  });
});
