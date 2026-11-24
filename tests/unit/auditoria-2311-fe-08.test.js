import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applyBatchPhotosToSlides } from '../../src/utils/batch-photos.js';
import * as operationTarget from '../../src/utils/operation-target.js';

// Auditoria 23/11 (FE-08): importar 10 fotos em A e abrir B com 4 lidas. A
// troca de projeto marca o mesmo `cancelled` do botão "Cancelar", e o parcial
// era aplicado nos cards 1 a 4 do projeto que acabou de abrir.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
const mkSlide = n => ({ id: `novo-${n}`, num: n, title: '', overlay: 40 });
const photo = n => ({ bgImage: `blob:foto-a-${n}`, bgImageId: `img-a-${n}` });

/** Fim da importação como no editor: aplica o que foi lido e avisa. */
function finishImport({ startedProjectId, editor, urls, toast }) {
  if (!operationTarget.isSameOpenProject(startedProjectId, editor.activeProjectId)) return;
  editor.slides = applyBatchPhotosToSlides(editor.slides, urls, mkSlide, null, {});
  toast(`${urls.length} fotos aplicadas antes do cancelamento.`);
}

describe('auditoria 23/11 FE-08: trocar de projeto durante a importação em lote', () => {
  it('os slides do projeto que abriu não mudam e o aviso não aparece', () => {
    const slidesB = [1, 2, 3, 4, 5].map(n => ({ id: `b-${n}`, num: n, title: `B ${n}`, bgImage: `blob:foto-b-${n}`, bgImageId: `img-b-${n}` }));
    const editor = { activeProjectId: 'A', slides: [{ id: 'a-1', num: 1, title: 'A 1' }] };
    const toast = vi.fn();
    const startedProjectId = editor.activeProjectId;
    // Quatro fotos lidas; a pessoa abre B.
    editor.activeProjectId = 'B';
    editor.slides = slidesB;
    finishImport({ startedProjectId, editor, urls: [1, 2, 3, 4].map(photo), toast });
    expect(editor.slides).toBe(slidesB);
    expect(editor.slides.map(slide => slide.bgImageId)).toEqual(['img-b-1', 'img-b-2', 'img-b-3', 'img-b-4', 'img-b-5']);
    expect(toast).not.toHaveBeenCalled();
  });

  it('"Cancelar" no mesmo projeto continua aplicando o que já foi lido', () => {
    const editor = { activeProjectId: 'A', slides: [1, 2, 3].map(n => ({ id: `a-${n}`, num: n, title: `A ${n}` })) };
    const toast = vi.fn();
    finishImport({ startedProjectId: 'A', editor, urls: [1, 2].map(photo), toast });
    expect(editor.slides.map(slide => slide.bgImageId)).toEqual(['img-a-1', 'img-a-2', undefined]);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('o editor guarda o projeto no início e confere antes das duas aplicações', () => {
    const start = app.indexOf('const handleBatchPhotos = useCallback((e) => {');
    const end = app.indexOf('const enableCanvasLayout = useCallback', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const handler = app.slice(start, end);
    const captured = handler.indexOf('const importProjectId = activeProjectRef.current;');
    expect(captured).toBeGreaterThanOrEqual(0);
    expect(captured).toBeLessThan(handler.indexOf('void (async () => {'));
    const guard = 'isSameOpenProject(importProjectId, activeProjectRef.current)';
    const partial = handler.indexOf('if (job.cancelled) {\n          //');
    const firstGuard = handler.indexOf(guard, partial);
    const partialApply = handler.indexOf('setSlides((prev) => applyBatchPhotosToSlides(prev, urls', partial);
    expect(firstGuard).toBeGreaterThan(partial);
    expect(firstGuard).toBeLessThan(partialApply);
    const secondGuard = handler.indexOf(guard, partialApply);
    const finalApply = handler.indexOf('setSlides((prev) => applyBatchPhotosToSlides(\n', partialApply);
    expect(secondGuard).toBeGreaterThan(partialApply);
    expect(secondGuard).toBeLessThan(finalApply);
  });
});
