import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('contrato de acessibilidade dos diálogos do editor', () => {
  it('centraliza Escape, armadilha de foco, retorno ao gatilho e fundo inerte', () => {
    const hook = source('src/hooks/useModalDialog.js');
    expect(hook).toContain("event.key === 'Escape'");
    expect(hook).toContain("event.key !== 'Tab'");
    expect(hook).toContain("sibling.setAttribute('inert', '')");
    expect(hook).toContain("sibling.setAttribute('aria-hidden', 'true')");
    expect(hook).toContain("sibling.removeAttribute('inert')");
    expect(hook).toContain('returnTarget.focus({ preventScroll: true })');
    expect(hook).toContain("document.addEventListener('focusin', keepFocusInside, true)");
  });

  it('aplica o contrato ao diálogo Configurar IA', () => {
    const modal = source('src/components/KeysModal.jsx');
    expect(modal).toContain("import { useModalDialog } from '../hooks/useModalDialog.js'");
    expect(modal).toContain('ref={overlayRef}');
    expect(modal).toContain('ref={dialogRef}');
    expect(modal).toContain('onKeyDown={onDialogKeyDown}');
    expect(modal).toContain('tabIndex={-1}');
  });

  it('impede interação atrás da confirmação de substituição dos cards', () => {
    const dialogs = source('src/components/PromptDialog.jsx');
    const app = source('ViralCarrossel.jsx');
    expect(dialogs).toContain('useModalDialog({');
    expect(dialogs).toContain('initialFocusRef: confirmRef');
    expect(dialogs).toContain('ref={overlayRef}');
    expect(dialogs).toContain('onKeyDown={onDialogKeyDown}');
    expect(app).toContain('title="Substituir os cards?"');
  });
});

