let localOcrModulePromise = null;

function cancelledError() {
  return Object.assign(new Error('Leitura cancelada.'), { name: 'AbortError' });
}

async function loadTesseract() {
  if (!localOcrModulePromise) localOcrModulePromise = import('tesseract.js');
  return localOcrModulePromise;
}

/**
 * OCR executado no próprio navegador. Os binários e o idioma ficam hospedados
 * no app para a recuperação continuar funcionando quando o provedor cair.
 */
export async function createBrowserOcrSession({ signal, onProgress } = {}) {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('A leitura local não está disponível neste dispositivo.');
  }
  if (signal?.aborted) throw cancelledError();

  const { createWorker } = await loadTesseract();
  let progressHandler = onProgress;
  let worker = null;
  let closed = false;
  const abort = () => {
    closed = true;
    worker?.terminate?.().catch?.(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    worker = await createWorker('por', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      logger: (message) => progressHandler?.(message),
    });
  } catch (error) {
    signal?.removeEventListener('abort', abort);
    if (signal?.aborted || closed) throw cancelledError();
    throw new Error('Não foi possível iniciar a leitura local das imagens.');
  }

  return {
    setProgress(handler) {
      progressHandler = handler;
    },
    async recognize(image) {
      if (signal?.aborted || closed) throw cancelledError();
      try {
        const result = await worker.recognize(image);
        if (signal?.aborted || closed) throw cancelledError();
        const text = String(result?.data?.text || '').trim();
        if (text.replace(/\s/g, '').length < 3) {
          throw new Error('Não encontrei texto legível nesta imagem.');
        }
        return text;
      } catch (error) {
        if (signal?.aborted || closed || error?.name === 'AbortError') throw cancelledError();
        throw error instanceof Error ? error : new Error('Não foi possível ler a imagem neste dispositivo.');
      }
    },
    async terminate() {
      if (closed) return;
      closed = true;
      signal?.removeEventListener('abort', abort);
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
