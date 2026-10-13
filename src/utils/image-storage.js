// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).

const VC_BG_SAVE_MAX_PX = 1536;
const VC_BG_SAVE_JPEG_Q = 0.88;
/** Só comprime fotos base64 «pesadas» — HEIC do iPhone passa quase sempre. */
const VC_BG_COMPRESS_MIN_CHARS = 380_000;
/** createImageBitmap/HEIC pode nunca resolver — não deixar o import pendurado. */
const VC_FILE_DECODE_TIMEOUT_MS = 12_000;

/** Redimensiona/recomprime data URLs de fundo antes de meter no localStorage (alivia quota). */
function vcShrinkDataUrlForStorage(dataUrl) {
  return new Promise((resolve) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    if (dataUrl.length < VC_BG_COMPRESS_MIN_CHARS) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }
        const fac = VC_BG_SAVE_MAX_PX / Math.max(w, h);
        const scale = fac < 1 ? fac : 1;
        const nw = Math.max(2, Math.round(w * scale));
        const nh = Math.max(2, Math.round(h * scale));
        const c = document.createElement('canvas');
        c.width = nw;
        c.height = nh;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, nw, nh);
        const jpeg = c.toDataURL('image/jpeg', VC_BG_SAVE_JPEG_Q);
        resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Importação de ficheiro → JPEG (~max VC_BG_SAVE_MAX_PX).
 * Ordem: FileReader (fiável para uploads) → Image+objectURL → createImageBitmap.
 * Timeout duro: createImageBitmap com HEIC/RAW pode nunca resolver nem rejeitar.
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

    const encodeFromWidthHeight = (drawable, w, h, closeFn) => {
      try {
        if (!w || !h) {
          closeFn?.();
          return false;
        }
        const fac = VC_BG_SAVE_MAX_PX / Math.max(w, h);
        const scale = fac < 1 ? fac : 1;
        const nw = Math.max(2, Math.round(w * scale));
        const nh = Math.max(2, Math.round(h * scale));
        const c = document.createElement('canvas');
        c.width = nw;
        c.height = nh;
        const ctx = c.getContext('2d');
        if (!ctx) {
          closeFn?.();
          return false;
        }
        ctx.drawImage(drawable, 0, 0, w, h, 0, 0, nw, nh);
        closeFn?.();
        const jpeg = c.toDataURL('image/jpeg', VC_BG_SAVE_JPEG_Q);
        if (typeof jpeg === 'string' && jpeg.startsWith('data:') && jpeg.length >= 32) {
          done(jpeg);
          return true;
        }
        return false;
      } catch {
        try { closeFn?.(); } catch { /* */ }
        return false;
      }
    };

    const tryImageWithObjectUrl = () => {
      let objUrl = '';
      try {
        objUrl = URL.createObjectURL(file);
      } catch {
        done('');
        return;
      }
      const img = new Image();
      const cleanup = () => {
        if (objUrl) {
          try { URL.revokeObjectURL(objUrl); } catch { /* */ }
          objUrl = '';
        }
      };
      img.onload = () => {
        const ok = encodeFromWidthHeight(img, img.naturalWidth, img.naturalHeight, cleanup);
        if (!ok) {
          cleanup();
          done('');
        }
      };
      img.onerror = () => {
        cleanup();
        done('');
      };
      img.src = objUrl;
    };

    const tryBitmap = () => {
      if (typeof createImageBitmap !== 'function') {
        tryImageWithObjectUrl();
        return;
      }
      createImageBitmap(file)
        .then((bmp) => {
          const ok = encodeFromWidthHeight(bmp, bmp.width, bmp.height, () => {
            try { bmp.close(); } catch { /* */ }
          });
          if (!ok) tryImageWithObjectUrl();
        })
        .catch(() => tryImageWithObjectUrl());
    };

    // Primário: FileReader — não depende de decode bitmap (HEIC/RAW).
    try {
      const reader = new FileReader();
      reader.onload = () => {
        void vcShrinkDataUrlForStorage(String(reader.result || '')).then((url) => {
          if (typeof url === 'string' && url.startsWith('data:') && url.length >= 32) {
            done(url);
            return;
          }
          tryBitmap();
        });
      };
      reader.onerror = () => tryBitmap();
      reader.readAsDataURL(file);
    } catch {
      tryBitmap();
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
