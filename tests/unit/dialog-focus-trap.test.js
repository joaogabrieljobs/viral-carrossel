import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OnboardingTour from '../../src/components/OnboardingTour.jsx';

// MOO-43 (auditoria 20/11): o tour e a tela cheia declaravam role="dialog"
// aria-modal="true", mas só tratavam Escape — o Tab saía para o editor atrás.
// Os dois passam a usar useModalDialog (foco inicial, armadilha de Tab, fundo
// inerte e retorno do foco), igual aos demais diálogos do editor.
// O ambiente de teste é node (sem jsdom); o comportamento do Tab é do hook
// compartilhado — aqui garantimos que os dois diálogos estão ligados a ele.
const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('MOO-43 — tour e tela cheia prendem o foco', () => {
  it.each([
    ['src/components/OnboardingTour.jsx', "import { useModalDialog } from '../hooks/useModalDialog.js'"],
    ['src/components/card/FullscreenViewer.jsx', "import { useModalDialog } from '../../hooks/useModalDialog.js'"],
  ])('%s usa o contrato useModalDialog', (path, importLine) => {
    const modal = source(path);
    expect(modal).toContain(importLine);
    expect(modal).toContain('useModalDialog({');
    expect(modal).toMatch(/ref=\{(overlayRef|setDialogNode)\}/);
    expect(modal).toMatch(/ref=\{(dialogRef|setDialogNode)\}/);
    expect(modal).toContain('onKeyDown={onDialogKeyDown}');
    expect(modal).toContain('tabIndex={-1}');
  });

  it('Escape sem duplicar: o listener global ignora evento já tratado pelo diálogo', () => {
    for (const path of ['src/components/OnboardingTour.jsx', 'src/components/card/FullscreenViewer.jsx']) {
      expect(source(path)).toContain('e.defaultPrevented');
    }
  });

  it('o tour renderiza o cartão como diálogo focável, com o foco inicial em Avançar', () => {
    const html = renderToStaticMarkup(React.createElement(OnboardingTour, {
      open: true, onDismiss: () => {}, isMobile: false, empty: true,
    }));
    expect(html).toMatch(/<div[^>]*role="dialog"[^>]*aria-modal="true"[^>]*tabindex="-1"[^>]*data-vc-tour-card=""/);
    expect(source('src/components/OnboardingTour.jsx')).toContain('initialFocusRef: advanceRef');
  });
});
