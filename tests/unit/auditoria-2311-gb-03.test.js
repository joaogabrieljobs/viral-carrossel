import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as browserOcr from '../../src/utils/browser-ocr.js';
import * as carouselOcr from '../../src/utils/carousel-ocr.js';
import { getAIGenerationCount, startAIJob } from '../../src/utils/generation-control.js';

const { createBrowserOcrSession } = browserOcr;
const { extractCarouselImageEvidence } = carouselOcr;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function navegador({ wasmBloqueado = false } = {}) {
  vi.stubGlobal('window', {});
  vi.stubGlobal('Worker', class {});
  if (wasmBloqueado) {
    // É o que o navegador faz quando o CSP não libera WebAssembly.
    vi.stubGlobal('WebAssembly', {
      Module: class { constructor() { throw new Error('Refused to compile or instantiate WebAssembly module'); } },
    });
  }
}

function leitorDeArquivo() {
  class FileReaderMock {
    readAsDataURL() {
      this.result = 'data:image/png;base64,AAAA';
      this.onload?.();
    }
  }
  vi.stubGlobal('FileReader', FileReaderMock);
}

const nunca = () => new Promise(() => {});
const leituraOnlineFora = () => vi.fn(async () => ({
  ok: false,
  status: 503,
  json: async () => ({ error: 'A leitura online está indisponível.' }),
}));

/** Resolve com `{ ok }` ou `{ erro }`; sem resposta em `limiteMs`, devolve `{ pendente: true }`. */
async function desfecho(promise, limiteMs) {
  const settled = promise.then((ok) => ({ ok }), (erro) => ({ erro }));
  await vi.advanceTimersByTimeAsync(limiteMs);
  return Promise.race([settled, Promise.resolve({ pendente: true })]);
}

describe('GB-03: leitura no aparelho que não pode rodar termina com mensagem', () => {
  it('WebAssembly recusado pela página: falha na hora, sem abrir o leitor', async () => {
    navegador({ wasmBloqueado: true });
    const createWorker = vi.fn(nunca);
    await expect(createBrowserOcrSession({ loadModule: async () => ({ createWorker }) }))
      .rejects.toThrow(/não está disponível neste navegador/i);
    expect(createWorker).not.toHaveBeenCalled();
    expect(browserOcr.browserOcrCanRun()).toBe(false);
  });

  it('com WebAssembly liberado, a leitura no aparelho é dada como disponível', () => {
    navegador();
    expect(browserOcr.browserOcrCanRun()).toBe(true);
  });

  it('leitor que nunca fica pronto: termina em erro dentro do prazo', async () => {
    vi.useFakeTimers();
    navegador();
    const sessao = createBrowserOcrSession({ loadModule: async () => ({ createWorker: nunca }) });
    const resultado = await desfecho(sessao, browserOcr.BROWSER_OCR_START_TIMEOUT_MS + 1_000);
    expect(resultado.pendente).toBeUndefined();
    expect(resultado.erro?.message).toMatch(/demorou demais/i);
    expect(resultado.erro?.name).not.toBe('AbortError');
  });

  it('leitor que fica pronto depois do prazo é encerrado', async () => {
    vi.useFakeTimers();
    navegador();
    const terminate = vi.fn(async () => {});
    let entregar;
    const createWorker = () => new Promise((resolve) => { entregar = resolve; });
    const sessao = createBrowserOcrSession({ loadModule: async () => ({ createWorker }) });
    const resultado = await desfecho(sessao, browserOcr.BROWSER_OCR_START_TIMEOUT_MS + 1_000);
    expect(resultado.erro).toBeTruthy();
    entregar({ terminate, recognize: nunca });
    await vi.advanceTimersByTimeAsync(0);
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('imagem que nunca termina de ser lida: erro no prazo, e as seguintes não esperam de novo', async () => {
    vi.useFakeTimers();
    navegador();
    const terminate = vi.fn(async () => {});
    const recognize = vi.fn(nunca);
    const sessao = await createBrowserOcrSession({
      loadModule: async () => ({ createWorker: async () => ({ recognize, terminate }) }),
    });
    const primeira = await desfecho(sessao.recognize('data:image/png;base64,AAAA'), browserOcr.BROWSER_OCR_READ_TIMEOUT_MS + 1_000);
    expect(primeira.erro?.message).toMatch(/demorou demais/i);
    expect(primeira.erro?.name).not.toBe('AbortError');
    expect(terminate).toHaveBeenCalledTimes(1);
    const segunda = await desfecho(sessao.recognize('data:image/png;base64,BBBB'), 0);
    expect(segunda.erro?.message).toMatch(/demorou demais/i);
    expect(recognize).toHaveBeenCalledTimes(1);
  });

  it('cancelar durante a espera interrompe na hora', async () => {
    vi.useFakeTimers();
    navegador();
    const controller = new AbortController();
    const sessao = createBrowserOcrSession({ signal: controller.signal, loadModule: async () => ({ createWorker: nunca }) });
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    const resultado = await desfecho(sessao, 0);
    expect(resultado.erro?.name).toBe('AbortError');
  });
});

describe('GB-03: a leitura dos prints não fica presa nem prende as outras ações de IA', () => {
  it('sem leitura no aparelho, cada imagem sai com motivo claro e o leitor só é tentado uma vez', async () => {
    leitorDeArquivo();
    const browserOcrFactory = vi.fn(async () => { throw new Error('A leitura no aparelho não está disponível neste navegador.'); });
    const files = [1, 2, 3].map((n) => ({ name: `card-${n}.png`, type: 'image/png', size: 100 }));

    const result = await extractCarouselImageEvidence(files, { fetchImpl: leituraOnlineFora(), browserOcrFactory });

    expect(result.evidence).toHaveLength(0);
    expect(result.failures).toHaveLength(3);
    expect(browserOcrFactory).toHaveBeenCalledTimes(1);
    for (const failure of result.failures) {
      expect(failure.error).toMatch(/leitura online falhou/i);
      expect(failure.error).toMatch(/não está disponível neste navegador/i);
      // A tela não repete a promessa de ler no aparelho quando isso não aconteceu.
      expect(failure.error).not.toMatch(/tentará ler/i);
    }
  });

  it('o motivo do servidor que interessa à pessoa (sem texto legível, limite do dia) é mantido', async () => {
    leitorDeArquivo();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ error: 'Não encontrei texto legível nesta imagem.' }) }));
    const browserOcrFactory = vi.fn(async () => { throw new Error('A leitura no aparelho não está disponível neste navegador.'); });
    const result = await extractCarouselImageEvidence(
      [{ name: 'card.png', type: 'image/png', size: 100 }],
      { fetchImpl, browserOcrFactory },
    );
    expect(result.failures[0].error).toMatch(/^Não encontrei texto legível nesta imagem\./);
  });

  it('leitor travado (WebAssembly recusado em segundo plano): a operação termina e a fila de IA esvazia', async () => {
    vi.useFakeTimers();
    navegador();
    leitorDeArquivo();
    const job = startAIJob();
    expect(getAIGenerationCount()).toBe(1);
    const files = [1, 2].map((n) => ({ name: `card-${n}.png`, type: 'image/png', size: 100 }));
    const leitura = extractCarouselImageEvidence(files, {
      fetchImpl: leituraOnlineFora(),
      signal: job.signal,
      browserOcrFactory: (options) => createBrowserOcrSession({ ...options, loadModule: async () => ({ createWorker: nunca }) }),
    }).finally(() => job.finish());

    const resultado = await desfecho(leitura, browserOcr.BROWSER_OCR_START_TIMEOUT_MS + 1_000);

    expect(resultado.pendente).toBeUndefined();
    expect(resultado.ok.failures).toHaveLength(2);
    expect(resultado.ok.failures[0].error).toMatch(/demorou demais/i);
    expect(getAIGenerationCount()).toBe(0);
  });
});

describe('GB-03: a tela só promete a leitura no aparelho quando ela pode rodar', () => {
  it('com a leitura no aparelho disponível, o texto diz que o app tenta', () => {
    const texto = carouselOcr.carouselOcrHelpText({ localAvailable: true });
    expect(texto).toMatch(/tenta ler o texto no seu aparelho/i);
    expect(texto).not.toMatch(/é extraído no seu aparelho/i);
  });

  it('sem ela, o texto não menciona o aparelho', () => {
    const texto = carouselOcr.carouselOcrHelpText({ localAvailable: false });
    expect(texto).not.toMatch(/aparelho/i);
    expect(texto).toMatch(/Até 10 imagens PNG\/JPG/);
  });

  it('o painel de tom de voz usa esse texto', () => {
    const fonte = readFileSync(new URL('../../src/components/panels/BrandTonePanel.jsx', import.meta.url), 'utf8');
    expect(fonte.includes('carouselOcrHelpText('), 'usa carouselOcrHelpText').toBe(true);
    expect(fonte.includes('o texto é extraído no seu aparelho'), 'promessa fixa removida').toBe(false);
  });
});
