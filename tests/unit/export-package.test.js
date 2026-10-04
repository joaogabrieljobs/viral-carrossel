import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyTextToClipboard, exportCarouselPackage } from '../../src/utils/export-package.js';

describe('export-package (Fatia 2)', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recusa legenda vazia ao copiar', async () => {
    await expect(copyTextToClipboard('')).rejects.toThrow(/legenda/i);
    await expect(copyTextToClipboard('   ')).rejects.toThrow(/legenda/i);
  });

  it('copia legenda via clipboard API', async () => {
    await copyTextToClipboard('  Hook do post #marca  ');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hook do post #marca');
  });

  it('exporta ZIP e copia legenda quando há texto', async () => {
    const exportAll = vi.fn().mockResolvedValue(undefined);
    const result = await exportCarouselPackage({
      exportAll,
      caption: 'Legenda pronta para o feed.',
    });
    expect(exportAll).toHaveBeenCalledTimes(1);
    expect(result.captionCopied).toBe(true);
    expect(result.checklist.some((i) => i.id === 'instagram')).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Legenda pronta para o feed.');
  });

  it('exporta ZIP sem copiar quando não há legenda', async () => {
    const exportAll = vi.fn().mockResolvedValue(undefined);
    const result = await exportCarouselPackage({ exportAll, caption: '' });
    expect(exportAll).toHaveBeenCalledTimes(1);
    expect(result.captionCopied).toBe(false);
    expect(result.checklist).toHaveLength(4);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('falha se exportAll não for função', async () => {
    await expect(exportCarouselPackage({})).rejects.toThrow(/indisponível/i);
  });
});
