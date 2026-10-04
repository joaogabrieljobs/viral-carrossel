import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
    expect(source).toContain("useState(defaultCreativePreset || 'livre')");
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
});
