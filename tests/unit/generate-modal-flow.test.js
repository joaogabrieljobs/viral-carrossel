import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  filterVisualPresetsForProduct,
  resolveCreativePresetForProduct,
  resolveInitialVisualPreset,
} from '../../src/components/panels/GenerateModal.jsx';

const source = readFileSync(
  new URL('../../src/components/panels/GenerateModal.jsx', import.meta.url),
  'utf8',
);

function sectionBetween(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from, `marcador ausente: ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `marcador ausente: ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe('fluxo do modal de geração', () => {
  it('mostra o pedido antes dos pacotes e mantém a lista completa recolhida por padrão', () => {
    const idea = sectionBetween('ETAPA 1 — IDEIA', 'ETAPA 2 — FORMATO');
    const topicPosition = idea.indexOf('htmlFor="generation-topic"');
    const presetsPosition = idea.indexOf('data-vc-collapsible="creative-presets"');

    expect(topicPosition).toBeGreaterThanOrEqual(0);
    expect(presetsPosition).toBeGreaterThan(topicPosition);
    expect(idea).toContain('CREATIVE_PRESETS.map');
    expect(idea).toContain('CREATIVE_PRESET_BY_ID[packCreative]?.label');
    expect(idea).toContain('aria-expanded={creativePresetsOpen}');
    expect(idea).toContain('{creativePresetsOpen && (');
    expect(source).toContain('const [creativePresetsOpen, setCreativePresetsOpen] = useState(false)');
  });

  it('preserva os padrões e valores iniciais do fluxo profissional', () => {
    expect(source).toContain('resolveCreativePresetForProduct(defaultCreativePreset, productKind)');
    expect(source).toContain('useState(!!hasOpenAI && !!defaultWithImages)');
    expect(source).toContain('<ModePicker value={mode} onChange={setMode}/>');
    expect(source).toContain('<ReferenceProfilesCuradoria material={material} setMaterial={setMaterial} />');
    expect(source).toContain('<VisualStylePicker');
    expect(source).toContain('<ImgParamsPanel value={params} onChange={setAxis} />');
  });

  it('limpa rascunhos de outro projeto e oferece um diálogo acessível', () => {
    expect(source).toContain("setTopic(defaultTopic || '')");
    expect(source).toContain("setNiche(defaultNiche || '')");
    expect(source).toContain("setAudience(defaultAudience || '')");
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain("event.key !== 'Tab'");
    expect(source).toContain('ref={stepPanelRef}');
    expect(source).toContain('aria-labelledby={`gen-step-tab-${step}`}');
    expect(source).toContain('stepPanelRef.current?.focus({ preventScroll: true })');
  });

  it('usa o token de contraste em todos os controles magenta do fluxo', () => {
    expect(source).toContain("color: (isActive || isCompleted) ? 'var(--text-on-accent)'");
    expect(source).not.toMatch(/color:\s*['"]#fff['"]/i);
  });

  it('usa uma única escolha de escopo para comandar a ação final', () => {
    const images = sectionBetween('ETAPA 3 — IMAGENS', 'ETAPA 4 — REVISÃO');
    const review = sectionBetween('ETAPA 4 — REVISÃO', 'RODAPÉ FIXO');

    expect(images).toContain('role="radiogroup" aria-label="Escopo da geração"');
    expect(images).toContain("label:'Só texto'");
    expect(images).toContain("label:'Texto e imagens'");
    expect(images).toContain('checked={selected}');
    expect(review).toContain("{hasOpenAI && wantImages ? 'Texto e imagens' : 'Só texto'}");
    expect(source.match(/onClick=\{\(\) => run\(\{/g) || []).toHaveLength(1);
    expect(source).not.toContain('withImages: !wantImages');
  });

  it('mantém a redação do escopo consistente em português', () => {
    expect(source).toContain('Pronto para gerar');
    expect(source).toContain('Gerar texto e imagens');
    expect(source).toContain('Gerar só texto');
    expect(source).not.toContain('Texto + imagem');
    expect(source).not.toContain('Pular imagens');
    expect(source).not.toContain('Pronto pra gerar');
  });

  it('oferece um fluxo próprio para apresentações, com caminhos e presets 16:9', () => {
    const idea = sectionBetween('ETAPA 1 — IDEIA', 'ETAPA 2 — FORMATO');
    const format = sectionBetween('ETAPA 2 — FORMATO', 'ETAPA 3 — IMAGENS');

    expect(source).toContain("productKind = 'carrossel'");
    expect(source).toContain("productKind === 'apresentacao'");
    expect(source).toContain("'Configurar apresentação'");
    expect(idea).toContain('PRESENTATION_PATHS.map');
    expect(idea).toContain('aria-label="Caminho da apresentação"');
    expect(source).toContain('filterVisualPresetsForProduct(visualPresets, productKind)');
    expect(format).toContain("aspectRatio={isPresentation ? '16 / 9' : '4 / 5'}");
    expect(format).toContain("Array.from({ length: 11 }, (_, index) => index + 6)");
  });

  it('isola presets por produto, inclui personalizados e usa o catálogo oficial como fallback', () => {
    const legacyCarousel = { id: 'legacy-carousel' };
    const customCarousel = { id: 'custom-carousel', productKind: 'carrossel', isCustom: true };
    const customPresentation = { id: 'custom-presentation', productKind: 'apresentacao', isCustom: true };
    const mixed = [legacyCarousel, customPresentation, customCarousel];

    expect(filterVisualPresetsForProduct(mixed, 'apresentacao')).toEqual([customPresentation]);
    expect(filterVisualPresetsForProduct(mixed, 'carrossel')).toEqual([legacyCarousel, customCarousel]);

    const presentationFallback = filterVisualPresetsForProduct([customCarousel], 'apresentacao');
    const carouselFallback = filterVisualPresetsForProduct([customPresentation], 'carrossel');
    expect(presentationFallback.length).toBeGreaterThan(0);
    expect(presentationFallback.every((preset) => preset.productKind === 'apresentacao')).toBe(true);
    expect(carouselFallback.length).toBeGreaterThan(0);
    expect(carouselFallback.every((preset) => preset.productKind !== 'apresentacao')).toBe(true);
  });

  it('preserva um preset personalizado compatível ao abrir e elimina seleção de outro produto', () => {
    const customCarousel = { id: 'custom-carousel', productKind: 'carrossel', isCustom: true };
    const customPresentation = { id: 'custom-presentation', productKind: 'apresentacao', isCustom: true };
    const mixed = [customCarousel, customPresentation];

    expect(resolveInitialVisualPreset({
      presets: mixed,
      productKind: 'apresentacao',
      defaultVisualPreset: customPresentation.id,
      presentationPath: 'pitch',
    })).toBe(customPresentation.id);
    expect(resolveInitialVisualPreset({
      presets: mixed,
      productKind: 'carrossel',
      defaultVisualPreset: customPresentation.id,
    })).toBeNull();
  });

  it('nunca herda o pacote Apresentação ao abrir o fluxo de carrossel', () => {
    expect(resolveCreativePresetForProduct('apresentacao', 'carrossel')).toBe('livre');
    expect(resolveCreativePresetForProduct('tendencia_cultura', 'carrossel')).toBe('tendencia_cultura');
    expect(resolveCreativePresetForProduct('livre', 'apresentacao')).toBe('apresentacao');
  });

  it('não altera o documento antes nem depois de uma geração iniciada pelo modal', () => {
    const run = sectionBetween('const run = async', '\n\n  return (');
    const callbackInvocations = [
      'onImgParamsChange?.(',
      'onModeChange?.(',
      'onCreativePresetChange?.(',
      'onSlideTextDensityChange?.(',
      'onCardVisualStyleChange?.(',
      'onVisualPresetChange(',
    ];

    expect(run).toContain('const result = await onGenerate({');
    for (const invocation of callbackInvocations) expect(run).not.toContain(invocation);
    expect(run).toContain('if (!result?.cancelled) onClose()');
  });

  it('envia apresentação sem herdar pacote, objetivo ou estilo de card do Instagram', () => {
    expect(source).toContain('creativePreset: creativePresetForGenerate');
    expect(source).toContain("contentObjective: isPresentation ? 'auto' : contentObjective");
    expect(source).toContain('presentationPath: isPresentation ? presentationPath : undefined');
    expect(source).toContain("cardVisualStyle: isPresentation ? 'full' : cardStyle");
    expect(source).toContain('{!isPresentation && (() => {');
    expect(source).toContain('{!isPresentation && (');
  });
});
