// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).

// Exportações legadas mantidas por compatibilidade com o App extraído.
// Estes limites não se aplicam aos originais guardados no IndexedDB.
const VC_BG_SAVE_MAX_PX = 1536;
const VC_BG_SAVE_JPEG_Q = 0.88;
const VC_BG_COMPRESS_MIN_CHARS = 380_000;
/** Uma leitura de ficheiro nunca deve deixar o import pendurado. */
const VC_FILE_DECODE_TIMEOUT_MS = 12_000;

/**
 * Compatibilidade com o import antigo. Os bytes vivem no IndexedDB; reduzir a
 * única cópia para poupar localStorage descartava detalhe e transparência.
 */
function vcShrinkDataUrlForStorage(dataUrl) {
  return Promise.resolve(dataUrl);
}

/**
 * Importação de ficheiro → data URL com os bytes e o MIME originais.
 * FileReader é o caminho principal; arrayBuffer é o fallback de leitura.
 * Nenhum caminho rasteriza/recomprime a foto, inclusive PNGs transparentes.
 */
function vcImageFileToStorageDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }

    let settled = false;
    const finish = (url) => {
      if (settled) return;
      settled = true;
      resolve(typeof url === 'string' && url.length >= 32 ? url : '');
    };

    const watchdog = setTimeout(() => finish(''), VC_FILE_DECODE_TIMEOUT_MS);
    const done = (url) => {
      clearTimeout(watchdog);
      finish(url);
    };

    const tryArrayBuffer = async () => {
      if (settled) return;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (settled) return;
        // Blocos pequenos evitam exceder a pilha ao ler fotos grandes.
        const chunks = [];
        for (let offset = 0; offset < bytes.length; offset += 32768) {
          chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
        }
        done(`data:${file.type || 'application/octet-stream'};base64,${btoa(chunks.join(''))}`);
      } catch {
        done('');
      }
    };

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        if (url.startsWith('data:') && url.length >= 32) done(url);
        else void tryArrayBuffer();
      };
      reader.onerror = () => { void tryArrayBuffer(); };
      reader.onabort = () => done('');
      reader.readAsDataURL(file);
    } catch {
      void tryArrayBuffer();
    }
  });
}

/** PNG a partir do canvas (toBlob; fallback se o browser devolver null). */
function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          try {
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            if (!base64) throw new Error('PNG vazio');
            const bin = atob(base64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            resolve(new Blob([arr], { type: 'image/png' }));
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
        'image/png',
        1,
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

export {
  VC_BG_SAVE_MAX_PX,
  VC_BG_SAVE_JPEG_Q,
  VC_BG_COMPRESS_MIN_CHARS,
  VC_FILE_DECODE_TIMEOUT_MS,
  vcShrinkDataUrlForStorage,
  vcImageFileToStorageDataUrl,
  canvasToPngBlob,
};
