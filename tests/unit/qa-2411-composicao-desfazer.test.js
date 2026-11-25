import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as copy from '../../src/utils/canvas-layout-copy.js';
import { toastTtl } from '../../src/hooks/useToasts.js';
import { createHistoryStore } from '../../src/utils/history-store.js';
import { enableCanvasLayoutSlides } from '../../src/utils/canvas-zones.js';

// QA 24/11 (editor 8, aviso): ativar a composição muda o layout de todos os
// cards e o aviso só dizia "ativada". O Desfazer ficava no menu ou no teclado.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
const notice = (undo) => copy.canvasLayoutEnabledToast?.(undo);

describe('QA 24/11 editor 8 — aviso da composição com Desfazer', () => {
  it('o aviso leva o botão Desfazer e fica tempo suficiente para usar', () => {
    const undo = vi.fn();
    const args = notice(undo);
    expect(Array.isArray(args), 'o aviso da composição não tem ação').toBe(true);
    const [message, kind, ttl, options] = args;
    expect(message).toBe('Composição ativada em todos os cards. Ligue «Mostrar zonas» para mover e redimensionar.');
    expect(kind).toBe('success');
    expect(toastTtl(kind, ttl)).toBeGreaterThanOrEqual(10000);
    expect(options.action.label).toBe('Desfazer');
    options.action.onClick();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('Desfazer devolve os cards ao layout que tinham, pelo histórico que já existe', () => {
    const before = { slides: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] };
    const history = createHistoryStore(before);
    history.set((doc) => ({ ...doc, slides: enableCanvasLayoutSlides(doc.slides, 'livre') }));
    expect(history.getState().slides.every((slide) => slide.canvas?.enabled)).toBe(true);
    const [, , , options] = notice(() => history.undo());
    options.action.onClick();
    expect(history.getState()).toBe(before);
  });

  it('o editor usa esse aviso ao ativar e sai do modo de edição ao desfazer', () => {
    const from = app.indexOf('const enableCanvasLayout = useCallback');
    const body = app.slice(from, app.indexOf('const disableCanvasLayout = useCallback', from));
    expect(body).toMatch(/toast\(\.\.\.canvasLayoutEnabledToast\(\(\) => \{[\s\S]{0,120}history\.undo\(\);[\s\S]{0,80}setCanvasEditMode\(false\);/);
  });
});
