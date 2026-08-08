// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import { S } from '../components/ui/SectionLabel.jsx';

const VC_BG_SAVE_MAX_PX = 1536;
const VC_BG_SAVE_JPEG_Q = 0.88;
/** Só comprime fotos base64 «pesadas» — HEIC do iPhone passa quase sempre. */
const VC_BG_COMPRESS_MIN_CHARS = 380_000;

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
 * Ordem: createImageBitmap (melhor com Blob/File) → Image + object URL → FileReader + shrink.
 * Evita depender só de data URLs gigantes no Image (Safari/iOS) e cobre browsers sem createObjectURL estável.
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

    const tryDataUrlFallback = () => {
      const reader = new FileReader();
      reader.onload = () => {
        void vcShrinkDataUrlForStorage(String(reader.result || '')).then((url) =>
          finish(url),
        );
      };
      reader.onerror = () => finish('');
      reader.readAsDataURL(file);
    };

    const encodeFromWidthHeight = (drawable, w, h, closeFn) => {
      try {
        if (!w || !h) {
          closeFn?.();
          tryDataUrlFallback();
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
          closeFn?.();
          tryDataUrlFallback();
          return;
        }
        ctx.drawImage(drawable, 0, 0, w, h, 0, 0, nw, nh);
        closeFn?.();
        const jpeg = c.toDataURL('image/jpeg', VC_BG_SAVE_JPEG_Q);
        if (typeof jpeg === 'string' && jpeg.startsWith('data:') && jpeg.length >= 32) {
          finish(jpeg);
          return;
        }
        tryDataUrlFallback();
      } catch {
        try {
          closeFn?.();
        } catch {
          /* */
        }
        tryDataUrlFallback();
      }
    };

    const tryImageWithObjectUrl = () => {
      let objUrl = '';
      try {
        objUrl = URL.createObjectURL(file);
      } catch {
        tryDataUrlFallback();
        return;
      }
      const img = new Image();
      const cleanup = () => {
        if (objUrl) {
          try {
            URL.revokeObjectURL(objUrl);
          } catch {
            /* */
          }
          objUrl = '';
        }
      };

      const runDraw = () => {
        encodeFromWidthHeight(img, img.naturalWidth, img.naturalHeight, cleanup);
      };

      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().then(runDraw).catch(() => {
            cleanup();
            tryDataUrlFallback();
          });
        } else {
          requestAnimationFrame(() => requestAnimationFrame(runDraw));
        }
      };
      img.onerror = () => {
        cleanup();
        tryDataUrlFallback();
      };
      img.src = objUrl;
    };

    if (typeof createImageBitmap === 'function') {
      createImageBitmap(file)
        .then((bmp) => {
          encodeFromWidthHeight(bmp, bmp.width, bmp.height, () => {
            try {
              bmp.close();
            } catch {
              /* */
            }
          });
        })
        .catch(() => {
          tryImageWithObjectUrl();
        });
      return;
    }

    tryImageWithObjectUrl();
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
  vcShrinkDataUrlForStorage,
  vcImageFileToStorageDataUrl,
  canvasToPngBlob,
};
