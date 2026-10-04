import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLOBAL_STYLE } from '../../src/styles/global-style.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('contratos críticos de acessibilidade da interface', () => {
  it('mantém contraste AA do texto sobre o magenta normal e hover', () => {
    const textOnAccent = /--text-on-accent:\s*(#[0-9a-f]{6})/i.exec(GLOBAL_STYLE)?.[1];
    expect(textOnAccent).toBeTruthy();
    expect(wcagContrast(textOnAccent, '#ff2d8d')).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(textOnAccent, '#ff4fa1')).toBeGreaterThanOrEqual(4.5);
  });

  it('mantém todos os tipos de toast com contraste AA', () => {
    const pairs = [
      ['#ffffff', '#b42318'],
      ['#ffffff', '#0c6b3a'],
      ['#17131e', '#f5f5f7'],
      ['#ffffff', '#8a4b00'],
    ];
    for (const [foreground, background] of pairs) {
      expect(wcagContrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(GLOBAL_STYLE).toContain('.toast-item.toast-warning');
    expect(GLOBAL_STYLE).toContain('min-width: 44px; min-height: 44px');
  });

  it('remove o drawer mobile fechado da árvore focável e expõe um diálogo quando aberto', () => {
    const code = source('src/components/ui/editor-chrome.jsx');
    expect(code).toContain('if (!open) return null;');
    expect(code).toContain('aria-label="Editor do card"');
    expect(code).toContain("event.key === 'Escape'");
    expect(code).toContain('returnFocusRef.current?.focus?.()');
  });

  it('limpa filtros invisíveis ao sair da Biblioteca e usa a coleção completa no calendário', () => {
    const code = source('src/components/LibraryModal.jsx');
    expect(code).toContain("if (nextView !== 'library')");
    expect(code).toContain("setFilter('all')");
    expect(code).toContain("setFolderFilter('all')");
    expect(code).toContain("setSearch('')");
    expect(code).toMatch(/<LibraryCalendar\s+library=\{library\}/);
  });

  it('mantém foco e nomes completos nas ações dinâmicas da Biblioteca', () => {
    const code = source('src/components/LibraryModal.jsx');
    expect(code).toContain('folderDeleteConfirmRef.current?.focus()');
    expect(code).toContain('projectDeleteConfirmRef.current?.focus()');
    expect(code).toContain('focusEditorAfterCloseRef.current = true');
    expect(code).toContain('returnTarget.isConnected');
    expect(code).toContain('Status: ${status.label}. Pasta: ${folderName || \'Sem pasta\'}');
    expect(code).toContain("isToday ? 'var(--text-on-accent)'");
    expect(code).not.toContain('clique duplo para renomear');
    expect(code).not.toContain('onDoubleClick');
  });

  it('mantém Escape, foco e estado de seleção nos modais de modos e série', () => {
    const modes = source('src/components/ModesIntroModal.jsx');
    const series = source('src/components/panels/SeriesPanel.jsx');
    for (const code of [modes, series]) {
      expect(code).toContain("event.key === 'Escape'");
      expect(code).toContain('returnFocusRef.current?.focus?.()');
      expect(code).toContain('aria-modal="true"');
    }
    expect(modes).toContain('aria-pressed={isCurrent}');
    expect(series).toContain('aria-pressed={objectiveId === t.id}');
    expect(series).toContain('aria-pressed={on}');
    expect(series).toContain('role="alert"');
    expect(series).toContain('role="status"');
    expect(series).toContain('Cancelar geração de ideias');
    expect(series).toContain('signal: job.signal');
  });

  it('preserva a evidência OCR no perfil salvo e não restaura marca antiga durante autosave', () => {
    const app = source('ViralCarrossel.jsx');
    const panel = source('src/components/panels/BrandTonePanel.jsx');
    expect(app).toContain('voiceImageTexts: brand.voiceImageTexts');
    expect(app).toContain('logoImageId: brand.logoImageId');
    expect(app).toMatch(/useLayoutEffect\(\(\) => \{[\s\S]*?\}, \[activeDocId\]\);/);
    expect(panel).toContain('}, [projectId, brand?.id]);');
    expect(panel).not.toContain('}, [brand?.voiceSourceUrls, brand?.voiceSampleText, brand?.voiceImageTexts]);');
    expect(panel.match(/onBlur=\{persistSourceDraft\}/g) || []).toHaveLength(2);
    expect(panel).toContain('persistSourceDraft();');
    expect(panel).toContain('aria-hidden="true"');
    expect(panel).toContain('tabIndex={-1}');
  });

  it('anuncia de forma imediata erros na revisão final da geração', () => {
    const modal = source('src/components/panels/GenerateModal.jsx');
    expect(modal).toContain('<div role="alert" aria-live="assertive"');
    expect(modal).toContain("color:'var(--danger-text)'");
    expect(modal).toContain('aria-pressed={count === n}');
    const library = source('src/components/LibraryModal.jsx');
    expect(library).toContain('aria-live="polite" aria-atomic="true"');
  });
});
