import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FONT_ALLOWLIST,
  OUTPUT_PATH,
  PATTERN_CONFIG,
  SOURCE_PATH,
  compileDesignSystem,
  renderGeneratedModule,
  validateDesignSystem,
} from '../../scripts/build-presentation-design-system.mjs';
import {
  GENERATED_PRESENTATION_COMPOSITIONS,
  GENERATED_PRESENTATION_PATTERNS,
  PRESENTATION_DESIGN_SYSTEM_VERSION,
} from '../../src/generated/presentation-design-system.generated.js';

function readSource() {
  return JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x
    && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe('compilador do design system de apresentações', () => {
  it('valida a fonte 16:9 com exatamente os dez padrões revisados', () => {
    const source = readSource();

    expect(validateDesignSystem(source)).toBe(source);
    expect(source.$schema).toBe('./presentation-design-system.schema.json');
    expect(source.canvas).toMatchObject({ width: 1920, height: 1080, aspectRatio: '16:9', unit: 'px' });
    expect(source.patterns).toHaveLength(10);
    expect(source.selection.orderedIds).toEqual(Object.keys(PATTERN_CONFIG));
  });

  it('documenta coordenadas e os dois formatos de grupo no schema local', () => {
    const schemaPath = SOURCE_PATH.replace(/\.json$/, '.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    expect(schema.$schema).toContain('2020-12');
    expect(schema.$defs.coordinateSpace.description).toContain('top-left');
    expect(schema.$defs.slot.properties.item.description).toContain('repetido');
    expect(schema.$defs.slot.properties.slots.description).toContain('Filhos internos');
  });

  it('falha cedo para quantidade, id duplicado ou canvas incompatível', () => {
    const missing = clone(readSource());
    missing.patterns.pop();
    expect(() => validateDesignSystem(missing)).toThrow(/exactly 10 patterns/);

    const duplicate = clone(readSource());
    duplicate.patterns[1].id = duplicate.patterns[0].id;
    expect(() => validateDesignSystem(duplicate)).toThrow(/ids must be unique/);

    const wrongCanvas = clone(readSource());
    wrongCanvas.patterns[0].canvas.width = 1280;
    expect(() => validateDesignSystem(wrongCanvas)).toThrow(/must be 1920x1080/);
  });

  it('gera o módulo versionado de forma determinística', () => {
    const compiled = compileDesignSystem(readSource());
    const generatedOnDisk = fs.readFileSync(OUTPUT_PATH, 'utf8');

    expect(renderGeneratedModule(compiled)).toBe(generatedOnDisk);
    expect(PRESENTATION_DESIGN_SYSTEM_VERSION).toBe(compiled.version);
    expect(GENERATED_PRESENTATION_PATTERNS).toEqual(compiled.patterns);
    expect(GENERATED_PRESENTATION_COMPOSITIONS).toEqual(compiled.compositions);
  });

  it('expõe dez padrões canônicos e seis composições por padrão', () => {
    expect(GENERATED_PRESENTATION_PATTERNS).toHaveLength(10);
    expect(Object.keys(GENERATED_PRESENTATION_COMPOSITIONS)).toHaveLength(60);
    expect(GENERATED_PRESENTATION_PATTERNS.map((pattern) => pattern.id)).toEqual(
      Object.values(PATTERN_CONFIG).map((config) => config.id),
    );

    for (const pattern of GENERATED_PRESENTATION_PATTERNS) {
      expect(pattern).toMatchObject({
        sourceVersion: '1.0.0',
        previewVariant: expect.any(String),
        brand: {
          titleFont: expect.any(String),
          subtitleFont: expect.any(String),
          bodyFont: expect.any(String),
        },
        textLimits: expect.any(Object),
        autofit: expect.any(Object),
        capabilities: expect.any(Object),
      });
      for (const field of [
        'coverComposition', 'contentComposition', 'dividerComposition',
        'dataComposition', 'demoComposition', 'closingComposition',
      ]) {
        expect(GENERATED_PRESENTATION_COMPOSITIONS[pattern.presentationDefaults[field]])
          .toBeTruthy();
      }
      const adaptedKinds = pattern.capabilities.adaptedKinds;
      expect(new Set(adaptedKinds).size).toBe(adaptedKinds.length);
      expect(adaptedKinds.every((kind) => (
        ['chart', 'table', 'svg', 'group', 'synthetic'].includes(kind)
      ))).toBe(true);
    }
  });

  it('mantém todas as zonas dentro do canvas e nunca sobrepõe os textos', () => {
    for (const [id, composition] of Object.entries(GENERATED_PRESENTATION_COMPOSITIONS)) {
      expect(composition).toMatchObject({
        titlePosition: expect.any(String),
        imagePosition: expect.any(String),
        photoRegion: 'full',
        archetypeId: expect.any(String),
        evidenceFallback: expect.any(Boolean),
        requiresImage: expect.any(Boolean),
        evidenceGlass: expect.any(Boolean),
        titleTypographyRole: expect.any(String),
      });
      for (const [zoneName, rect] of Object.entries(composition.zones)) {
        expect(rect.x, `${id}.${zoneName}.x`).toBeGreaterThanOrEqual(0);
        expect(rect.y, `${id}.${zoneName}.y`).toBeGreaterThanOrEqual(0);
        expect(rect.w, `${id}.${zoneName}.w`).toBeGreaterThan(0);
        expect(rect.h, `${id}.${zoneName}.h`).toBeGreaterThan(0);
        expect(rect.x + rect.w, `${id}.${zoneName}.right`).toBeLessThanOrEqual(100);
        expect(rect.y + rect.h, `${id}.${zoneName}.bottom`).toBeLessThanOrEqual(100);
      }
      expect(overlaps(composition.zones.title, composition.zones.subtitle), id).toBe(false);
      expect(composition.zones.title.h, `${id}.title.h`).toBeGreaterThanOrEqual(16);
      expect(composition.zones.subtitle.h, `${id}.subtitle.h`).toBeGreaterThanOrEqual(14);
    }
  });

  it('publica só fontes permitidas e remove payloads externos da fonte', () => {
    const allowedValues = new Set(Object.values(FONT_ALLOWLIST));
    for (const pattern of GENERATED_PRESENTATION_PATTERNS) {
      expect(allowedValues.has(pattern.brand.titleFont)).toBe(true);
      expect(allowedValues.has(pattern.brand.subtitleFont)).toBe(true);
      expect(allowedValues.has(pattern.brand.bodyFont)).toBe(true);
      expect(pattern.brand.titleFont).not.toMatch(/^https?:/);
      expect(pattern.brand.subtitleFont).not.toMatch(/^https?:/);
      expect(pattern.brand.bodyFont).not.toMatch(/^https?:/);
    }

    const editorial = GENERATED_PRESENTATION_PATTERNS.find(
      (pattern) => pattern.id === 'presentation_editorial_magazine',
    );
    expect(editorial.brand).toMatchObject({
      titleFont: '"Playfair Display", serif',
      subtitleFont: '"Libre Franklin", sans-serif',
      bodyFont: '"Source Serif 4", serif',
    });
    expect(
      GENERATED_PRESENTATION_PATTERNS.find(
        (pattern) => pattern.id === 'presentation_cinematic',
      ).brand.textTitleCase,
    ).toBe('upper');

    const runtimePayload = fs.readFileSync(OUTPUT_PATH, 'utf8');
    expect(runtimePayload).not.toContain('thumbnail');
    expect(runtimePayload).not.toContain('fonts.googleapis.com');
    expect(runtimePayload).not.toContain('"href"');
    expect(runtimePayload).not.toContain('"example"');
    expect(runtimePayload).not.toContain('<svg');
  });

  it('marca superfícies avançadas convertidas em evidência', () => {
    expect(GENERATED_PRESENTATION_COMPOSITIONS['presentation_data_first:data'])
      .toMatchObject({ archetypeId: 'chart-insight', evidenceFallback: true, requiresImage: false });
    expect(GENERATED_PRESENTATION_COMPOSITIONS['presentation_technical_blueprint:data'])
      .toMatchObject({ archetypeId: 'line-chart-tech', evidenceFallback: true, requiresImage: false });
    expect(GENERATED_PRESENTATION_COMPOSITIONS['presentation_photo_essay:demo'])
      .toMatchObject({ archetypeId: 'single-mat', evidenceFallback: false, requiresImage: true });
    expect(
      GENERATED_PRESENTATION_PATTERNS.find(
        (pattern) => pattern.id === 'presentation_data_first',
    ).capabilities.adaptedKinds,
    ).toEqual(['group', 'chart', 'table']);
  });

  it('protege o contraste quando texto e evidência ocupam a mesma região', () => {
    const dataComposition = GENERATED_PRESENTATION_COMPOSITIONS['presentation_data_first:data'];
    expect(overlaps(dataComposition.zones.photo, dataComposition.zones.title)
      || overlaps(dataComposition.zones.photo, dataComposition.zones.subtitle)).toBe(true);
    expect(dataComposition).toMatchObject({
      evidenceFallback: true,
      requiresImage: false,
      overlay: 48,
    });
  });

  it('preserva limites editoriais específicos de cada composição', () => {
    expect(GENERATED_PRESENTATION_COMPOSITIONS['presentation_premium_dark:cover'])
      .toMatchObject({
        textLimits: {
          title: { maxChars: 50, maxLines: 2, role: 'display' },
          subtitle: { maxChars: 40, maxLines: 1, role: 'subtitle' },
          body: { maxChars: 220, maxLines: 6, role: 'body' },
        },
      });
    expect(GENERATED_PRESENTATION_COMPOSITIONS['presentation_executive_minimal:content'])
      .toMatchObject({
        textLimits: {
          title: { maxChars: 60, maxLines: 3, role: 'h1' },
          subtitle: { maxChars: 360, maxLines: 9, role: 'body' },
        },
      });
  });

  it('não reduz a altura válida do título Premium ao separar título e subtítulo', () => {
    const demo = GENERATED_PRESENTATION_COMPOSITIONS['presentation_premium_dark:demo'];
    expect(demo.archetypeId).toBe('hero-product');
    expect(demo.zones.title.h).toBeCloseTo(22.22, 2);
    expect(overlaps(demo.zones.title, demo.zones.subtitle)).toBe(false);
  });

  it('preserva a tipografia relativa, o glass e o contrato de autofit da fonte', () => {
    const executive = GENERATED_PRESENTATION_PATTERNS.find(
      (pattern) => pattern.id === 'presentation_executive_minimal',
    );
    expect(executive.brand).toMatchObject({
      textTitleTracking: 1,
      textSubTracking: 1,
      textTitleSize: 39.68,
      textSubSize: 59.52,
      subtitleWeight: 500,
      subtitleCase: 'normal',
      textTitleLeading: 110,
      textSubLeading: 130,
      textBodyAfterSize: 81.02,
      bodyWeight: 400,
      textBodyTracking: 0.4,
      textBodyLeading: 145,
    });

    const editorial = GENERATED_PRESENTATION_PATTERNS.find(
      (pattern) => pattern.id === 'presentation_editorial_magazine',
    );
    expect(editorial.brand).toMatchObject({
      subtitleWeight: 600,
      subtitleCase: 'upper',
      textSubTracking: 15,
      textSubSize: 40.92,
    });

    const premium = GENERATED_PRESENTATION_PATTERNS.find(
      (pattern) => pattern.id === 'presentation_premium_dark',
    );
    expect(premium.brand.textTitleWeight).toBe(300);
    expect(premium.slideDefaults).toMatchObject({
      titleWeight: 300,
      bodyAfterSize: 75.23,
      bodyWeight: 400,
      bodyTracking: 0.4,
      bodyLeading: 150,
      textBg: false,
      textBgOpacity: 5,
      presentationGlass: {
        enabled: true,
        background: 'rgba(255,255,255,0.05)',
        backdropBlur: 24,
        border: '1px solid rgba(255,255,255,0.12)',
        radius: 24,
        applyTo: ['content', 'data'],
      },
      presentationAutofit: premium.autofit,
    });
    expect(premium.slideDefaults.presentationTitleSizeByComposition).toMatchObject({
      cover: 89.29,
      content: 54.56,
      divider: 32.24,
      closing: 54.56,
    });
    expect(premium.slideDefaults.presentationTypographyByComposition).toMatchObject({
      cover: {
        title: {
          role: 'display',
          fontFamily: '"Cormorant", serif',
          sizePercent: 89.29,
          leadingPercent: 100,
          weight: 300,
        },
      },
      divider: {
        title: { role: 'h2', sizePercent: 32.24, leadingPercent: 115 },
        subtitle: {
          role: 'display',
          fontFamily: '"Cormorant", serif',
          sizePercent: 267.86,
          weight: 300,
        },
      },
      closing: {
        subtitle: {
          role: 'caption',
          fontFamily: '"Manrope", sans-serif',
          sizePercent: 37.2,
          weight: 400,
        },
      },
    });
    expect(premium.autofit.minScale).toBe(0.85);
    const cinematic = GENERATED_PRESENTATION_PATTERNS.find(
      (pattern) => pattern.id === 'presentation_cinematic',
    );
    expect(cinematic.slideDefaults.presentationTypographyByComposition).toMatchObject({
      content: {
        title: {
          role: 'subtitleCaption',
          sizePercent: 22.32,
          leadingPercent: 135,
        },
      },
      data: {
        subtitle: {
          role: 'subtitleCaption',
          sizePercent: 66.96,
          leadingPercent: 135,
        },
      },
    });
    expect(GENERATED_PRESENTATION_PATTERNS.find(
      (pattern) => pattern.id === 'presentation_typographic_bold',
    ).autofit.minScale).toBe(0.7);
    expect(GENERATED_PRESENTATION_COMPOSITIONS['presentation_premium_dark:cover'])
      .toMatchObject({ titleTypographyRole: 'display', evidenceGlass: false });
    expect(GENERATED_PRESENTATION_COMPOSITIONS['presentation_premium_dark:content'])
      .toMatchObject({ titleTypographyRole: 'h1', evidenceGlass: true });
  });
});
