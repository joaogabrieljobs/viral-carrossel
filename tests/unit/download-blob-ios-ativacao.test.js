import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, saveFileTapLabels } from '../../src/utils/export-helpers.js';

// "Exportar em PDF gera um link e não um arquivo" (iPhone, 25/11). Reproduzido
// no Safari do Simulador iOS 26.4: o PDF leva vários segundos para montar, a
// ativação do toque expira (~5 s), navigator.share rejeita com NotAllowedError
// e o recurso `<a download>` com blob: tira a pessoa do app e só mostra o PDF.
// Com a ativação vencida, o arquivo agora espera um toque novo em "Salvar PDF".

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15';

const notAllowed = () => Object.assign(new Error('The request is not allowed by the user agent'), { name: 'NotAllowedError' });
const aborted = () => Object.assign(new Error('Abort due to cancellation of share.'), { name: 'AbortError' });
const pdf = () => new Blob(['%PDF-1.4 x'], { type: 'application/pdf' });

function iphone({ share = vi.fn().mockResolvedValue(undefined), active = true } = {}) {
  vi.stubGlobal('navigator', {
    userAgent: IPHONE_UA,
    maxTouchPoints: 5,
    share,
    canShare: () => true,
    userActivation: { isActive: active, hasBeenActive: true },
  });
  // Sem `document` de propósito: no iPhone a âncora blob: não pode ser usada.
  return share;
}

afterEach(() => vi.unstubAllGlobals());

describe('iPhone — PDF pronto depois que a ativação do toque expirou', () => {
  it('não chama share sem ativação: pede um toque novo e só então compartilha o arquivo', async () => {
    const share = iphone({ active: false });
    const askForTap = vi.fn(async ({ share: shareNow }) => {
      expect(share).not.toHaveBeenCalled();
      await shareNow();
      return true;
    });
    await expect(downloadBlob(pdf(), 'carrossel-clinica.pdf', { askForTap })).resolves.toBe(true);
    expect(askForTap).toHaveBeenCalledTimes(1);
    expect(askForTap.mock.calls[0][0]).toMatchObject({ filename: 'carrossel-clinica.pdf', labels: { action: 'Salvar PDF' } });
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('share só com o arquivo: sem title nem text, nome e mime do PDF', async () => {
    const share = iphone({ active: false });
    await downloadBlob(pdf(), 'carrossel-clinica.pdf', { askForTap: async ({ share: s }) => { await s(); return true; } });
    const data = share.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(['files']);
    expect(data.files).toHaveLength(1);
    expect(data.files[0].name).toBe('carrossel-clinica.pdf');
    expect(data.files[0].type).toBe('application/pdf');
  });

  it('ativação ainda valendo mas share rejeita NotAllowedError: pede toque, nunca abre blob:', async () => {
    const share = iphone({ active: true, share: vi.fn().mockRejectedValueOnce(notAllowed()).mockResolvedValueOnce(undefined) });
    const askForTap = vi.fn(async ({ share: s }) => { await s(); return true; });
    await expect(downloadBlob(pdf(), 'p.pdf', { askForTap })).resolves.toBe(true);
    expect(askForTap).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(2);
  });

  it('ativação valendo e share aceito: entrega direto, sem pedir toque e sem title', async () => {
    const share = iphone({ active: true });
    const askForTap = vi.fn();
    await expect(downloadBlob(pdf(), 'p.pdf', { askForTap })).resolves.toBe(true);
    expect(askForTap).not.toHaveBeenCalled();
    expect(Object.keys(share.mock.calls[0][0])).toEqual(['files']);
  });

  it('fechar o aviso sem salvar é cancelamento silencioso (MOO-27)', async () => {
    iphone({ active: false });
    await expect(downloadBlob(pdf(), 'p.pdf', { askForTap: async () => false })).resolves.toBe(false);
  });

  it('fechar a folha aberta pelo toque novo também é cancelamento (MOO-27)', async () => {
    iphone({ active: false, share: vi.fn().mockRejectedValue(aborted()) });
    const askForTap = async ({ share: s }) => s();
    await expect(downloadBlob(pdf(), 'p.pdf', { askForTap })).resolves.toBe(false);
  });

  it('share do toque novo falha de outro jeito: erro com mensagem, não um link', async () => {
    iphone({ active: false, share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'DataError' })) });
    const askForTap = async ({ share: s }) => s();
    await expect(downloadBlob(pdf(), 'p.pdf', { askForTap })).rejects.toThrow('Não deu para abrir a opção de salvar. Tente de novo.');
  });
});

describe('computador — continua baixando pela âncora', () => {
  it('Mac sem toque: âncora download com blob:, sem share e sem pedir toque', async () => {
    const share = vi.fn();
    const clicks = [];
    const anchor = { click() { clicks.push({ href: this.href, download: this.download }); }, remove() {} };
    vi.stubGlobal('navigator', { userAgent: MAC_UA, maxTouchPoints: 0, share, canShare: () => true, userActivation: { isActive: false } });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild() {} } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://x/1');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const askForTap = vi.fn();
    await expect(downloadBlob(pdf(), 'carrossel.pdf', { askForTap })).resolves.toBe(true);
    expect(clicks).toEqual([{ href: 'blob:http://x/1', download: 'carrossel.pdf' }]);
    expect(share).not.toHaveBeenCalled();
    expect(askForTap).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('textos do aviso de salvar', () => {
  it.each([
    ['carrossel-x.pdf', 'PDF pronto.', 'Salvar PDF'],
    ['carrossel-x.zip', 'ZIP pronto.', 'Salvar ZIP'],
    ['slide-01.png', 'Imagem pronta.', 'Salvar imagem'],
    ['slide-01-video.mp4', 'Vídeo pronto.', 'Salvar vídeo'],
    ['backup.json', 'Arquivo pronto.', 'Salvar arquivo'],
  ])('%s', (name, message, action) => {
    expect(saveFileTapLabels(name)).toEqual({ message, action });
  });
});
