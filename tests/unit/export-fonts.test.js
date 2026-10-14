import { describe, expect, it, vi } from 'vitest';
import { waitForExportFonts } from '../../src/utils/export-fonts.js';

function setup({ family = '"Outfit", sans-serif', faces = [{ family: 'Outfit', status: 'loaded' }], load } = {}) {
  const node = { childNodes: [{ nodeType: 3, textContent: 'Cuidado, ação e precisão.' }], querySelectorAll: () => [] };
  const fonts = Object.assign(faces, { load: load || vi.fn(async () => faces) });
  const doc = {
    fonts,
    defaultView: { getComputedStyle: () => ({ fontFamily: family, fontWeight: '700', fontStyle: 'italic', fontSize: '64px' }) },
    getElementById: () => null,
  };
  return { node, doc, fonts };
}

describe('tipografia pronta antes de exportar', () => {
  it('carrega família, peso, estilo e caracteres usados no card', async () => {
    const { node, doc, fonts } = setup();
    await waitForExportFonts([node], { doc });
    expect(fonts.load).toHaveBeenCalledWith('italic 700 64px "Outfit"', 'Cuidado, ação e precisão.A');
  });

  it('não confunde uma família web ausente com fonte de sistema', async () => {
    const { node, doc } = setup({ faces: [] });
    await expect(waitForExportFonts([node], { doc })).rejects.toThrow('Não foi possível carregar a fonte “Outfit”');
    const system = setup({ family: 'Arial, sans-serif', faces: [] });
    await expect(waitForExportFonts([system.node], { doc: system.doc })).resolves.toBeUndefined();
  });

  it('impede export de fonte custom inválida mesmo após fonts.ready resolver', async () => {
    const { node, doc } = setup({ family: 'VCBrandTitle-b1, serif', load: vi.fn(async () => { throw new Error('Font decode failed'); }) });
    await expect(waitForExportFonts([node], { doc })).rejects.toThrow('Não foi possível carregar a fonte da marca');
  });

  it('permite fallback de símbolos quando a família do lettering está carregada', async () => {
    const { node, doc, fonts } = setup({ load: vi.fn(async (_font, text) => text.includes('A') ? [{ status: 'loaded' }] : []) });
    node.childNodes[0].textContent = '→';
    await expect(waitForExportFonts([node], { doc })).resolves.toBeUndefined();
    expect(fonts.load).toHaveBeenCalledWith('italic 700 64px "Outfit"', '→A');
  });

  it('aguarda a folha tardia antes de carregar a face', async () => {
    const { node, doc, fonts } = setup();
    const listeners = {};
    const sheet = { sheet: null,
      addEventListener: (type, fn) => { listeners[type] = fn; },
      removeEventListener: vi.fn() };
    doc.getElementById = () => sheet;
    const pending = waitForExportFonts([node], { doc });
    await Promise.resolve();
    expect(fonts.load).not.toHaveBeenCalled();
    sheet.sheet = {};
    listeners.load();
    await pending;
    expect(fonts.load).toHaveBeenCalledOnce();
    expect(sheet.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('encerra espera por fonte travada sem gerar arquivo com substituta', async () => {
    const { node, doc } = setup({ load: vi.fn(() => new Promise(() => {})) });
    await expect(waitForExportFonts([node], { doc, timeoutMs: 5 })).rejects.toThrow('antes de exportar');
  });
});
