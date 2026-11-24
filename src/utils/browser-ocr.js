let localOcrModulePromise = null;

function cancelledError() {
  return Object.assign(new Error('Leitura cancelada.'), { name: 'AbortError' });
}

async function loadTesseract() {
  if (!localOcrModulePromise) localOcrModulePromise = import('tesseract.js');
  return localOcrModulePromise;
}

/** Prazo para o leitor ficar pronto (baixa o motor e o idioma do próprio app). */
export const BROWSER_OCR_START_TIMEOUT_MS = 45_000;
/** Prazo para ler uma imagem depois que o leitor está pronto. */
export const BROWSER_OCR_READ_TIMEOUT_MS = 120_000;

const LOCAL_OCR_UNAVAILABLE = 'A leitura no aparelho não está disponível neste navegador.';

/**
 * A leitura no aparelho depende de Worker e de WebAssembly. Quando a política
 * de segurança da página recusa WebAssembly, o leitor aborta em segundo plano
 * e nunca responde; o módulo vazio abaixo (só cabeçalho e versão) compila na
 * hora ou é recusado na hora, sem baixar nada.
 */
export function browserOcrCanRun() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return false;
  const wasm = globalThis.WebAssembly;
  if (!wasm || typeof wasm.Module !== 'function') return false;
  try {
    return !!new wasm.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
  } catch {
    return false;
  }
}

/** Espera `promise` até `ms`; cancelar pelo `signal` interrompe na hora. */
function withDeadline(promise, { ms, signal, onTimeout }) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => { cleanup(); reject(cancelledError()); };
    const timer = setTimeout(() => { cleanup(); reject(onTimeout()); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); },
    );
  });
}

/**
 * OCR executado no próprio navegador. Os binários e o idioma ficam hospedados
 * no app para a recuperação continuar funcionando quando o provedor cair.
 */
export async function createBrowserOcrSession({
  signal,
  onProgress,
  loadModule = loadTesseract,
  startTimeoutMs = BROWSER_OCR_START_TIMEOUT_MS,
  readTimeoutMs = BROWSER_OCR_READ_TIMEOUT_MS,
} = {}) {
  if (!browserOcrCanRun()) throw new Error(LOCAL_OCR_UNAVAILABLE);
  if (signal?.aborted) throw cancelledError();

  const { createWorker } = await loadModule();
  let progressHandler = onProgress;
  let worker = null;
  let closed = false;
  const abort = () => {
    closed = true;
    worker?.terminate?.().catch?.(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });

  let startTimedOut = false;
  try {
    const starting = createWorker('por', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      logger: (message) => progressHandler?.(message),
    });
    // Sem prazo, um leitor que não sobe deixava a tela em "Lendo no aparelho…"
    // para sempre e a operação de IA aberta.
    worker = await withDeadline(starting, {
      ms: startTimeoutMs,
      signal,
      onTimeout: () => {
        startTimedOut = true;
        // Se ele ficar pronto depois do prazo, encerra: ninguém mais vai usar.
        Promise.resolve(starting).then((late) => late?.terminate?.()).catch(() => {});
        return new Error('A leitura no aparelho demorou demais para começar e foi interrompida.');
      },
    });
  } catch (error) {
    signal?.removeEventListener('abort', abort);
    if (signal?.aborted || closed) throw cancelledError();
    if (startTimedOut) throw error;
    throw new Error('Não foi possível iniciar a leitura local das imagens.');
  }

  // Leitura que estourou o prazo: o leitor foi encerrado e as próximas imagens
  // recebem o mesmo motivo sem esperar de novo.
  let failure = null;

  return {
    setProgress(handler) {
      progressHandler = handler;
    },
    async recognize(image) {
      if (failure) throw failure;
      if (signal?.aborted || closed) throw cancelledError();
      try {
        const result = await withDeadline(worker.recognize(image), {
          ms: readTimeoutMs,
          signal,
          onTimeout: () => {
            failure = new Error('A leitura no aparelho demorou demais nesta imagem e foi interrompida.');
            worker?.terminate?.().catch?.(() => {});
            return failure;
          },
        });
        if (signal?.aborted || closed) throw cancelledError();
        const text = String(result?.data?.text || '').trim();
        if (text.replace(/\s/g, '').length < 3) {
          throw new Error('Não encontrei texto legível nesta imagem.');
        }
        return text;
      } catch (error) {
        if (error === failure) throw error;
        if (signal?.aborted || closed || error?.name === 'AbortError') throw cancelledError();
        throw error instanceof Error ? error : new Error('Não foi possível ler a imagem neste dispositivo.');
      }
    },
    async terminate() {
      if (closed) return;
      closed = true;
      signal?.removeEventListener('abort', abort);
      if (failure) return;
      try { await worker?.terminate?.(); } catch { /* encerramento best-effort */ }
    },
  };
}

export function shouldUseBrowserOcrFallback(error) {
  const status = Number(error?.status || 0);
  if (status === 400 || status === 402) return false;
  return status === 0 || status === 401 || status === 403 || status === 408
    || status === 422 || status === 429 || status >= 500;
}
