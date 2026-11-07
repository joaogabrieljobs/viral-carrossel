/**
 * Importação em lote: cada imagem vira (ou atualiza) um card.
 * Sem teto — se houver mais fotos do que slides, cria slides novos.
 */

/**
 * @param {object[]} slides
 * @param {Array<object|null>} imagePayloads — cada item é o patch de imagem (`bgImage`/`bgImageId`) ou null
 * @param {(n: number, brand: object|null) => object} mkSlide
 * @param {object|null} brand
 * @param {{ isPresentation?: boolean }} [opts]
 */
export function applyBatchPhotosToSlides(slides, imagePayloads, mkSlide, brand, opts = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const payloads = Array.isArray(imagePayloads) ? imagePayloads : [];
  if (!payloads.length) return list;

  const isPresentation = !!opts.isPresentation;
  const next = [];

  for (let i = 0; i < payloads.length; i += 1) {
    const data = payloads[i];
    const existing = i < list.length ? list[i] : null;
    let base = existing
      ? { ...existing, num: i + 1 }
      : {
          ...mkSlide(i + 1, brand),
          title: '',
          subtitle: '',
          bodyAfterImage: '',
          ...(isPresentation
            ? {
                layout: 'ml',
                align: 'left',
                photoRegion: 'full',
                showSwipeCue: false,
              }
            : {
                layout: 'bl',
                align: 'left',
                photoRegion: 'full',
              }),
        };

    // Só aplica patch com foto real — `{ bgImage: null }` não pode apagar o card.
    const hasPhoto = !!(data && typeof data === 'object' && (data.bgImage || data.bgImageId));
    if (hasPhoto) {
      base = {
        ...base,
        ...data,
        num: i + 1,
        bgImageSource: 'imported',
        bgImageFailed: false,
        bgImageError: null,
      };
    }
    next.push(base);
  }

  // Mantém slides sobrantes (mais cards do que fotos) sem apagar texto/imagem antiga.
  if (list.length > payloads.length) {
    for (let i = payloads.length; i < list.length; i += 1) {
      next.push({ ...list[i], num: i + 1 });
    }
  }

  return next;
}

const IMPORT_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export async function validateImportedPhotoFile(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (!file || !IMPORT_IMAGE_MIMES.has(mime) || typeof file.arrayBuffer !== 'function') {
    return { valid:false, message:'Use somente imagens PNG, JPEG ou WebP.' };
  }
  let bytes;
  try {
    // Só o cabeçalho identifica PNG/JPEG/WebP; não duplique fotos grandes na
    // memória do celular apenas para validar a assinatura.
    const header = typeof file.slice === 'function' ? file.slice(0, 12) : file;
    bytes = new Uint8Array(await header.arrayBuffer());
  }
  catch { return { valid:false, message:'Não foi possível ler este arquivo de imagem.' }; }
  const isPng = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const signatureMatches = mime === 'image/png' ? isPng
    : (mime === 'image/jpeg' || mime === 'image/jpg') ? isJpeg
      : isWebp;
  return signatureMatches
    ? { valid:true, mime:mime === 'image/jpg' ? 'image/jpeg' : mime }
    : { valid:false, message:'O arquivo não corresponde a uma imagem PNG, JPEG ou WebP válida.' };
}

export function summarizeBatchPhotoImport({
  applied,
  created,
  leftoverSlides,
  skippedNulls,
  rejected = 0,
  rejectedFiles = [],
}) {
  const rejectedNames = (Array.isArray(rejectedFiles) ? rejectedFiles : [])
    .map((name) => String(name || '').trim().slice(0, 80))
    .filter(Boolean);
  const visibleRejectedNames = rejectedNames.slice(0, 3);
  const moreRejected = Math.max(0, rejectedNames.length - visibleRejectedNames.length);
  const rejectedFilesNote = visibleRejectedNames.length
    ? ` Arquivo${visibleRejectedNames.length === 1 && !moreRejected ? '' : 's'}: ${visibleRejectedNames.join(', ')}${moreRejected ? ` e mais ${moreRejected}` : ''}.`
    : '';
  const rejectedNote = rejected > 0
    ? ` ${rejected} arquivo${rejected === 1 ? '' : 's'} recusado${rejected === 1 ? '' : 's'}: use PNG, JPEG ou WebP.${rejectedFilesNote}`
    : '';
  if (created > 0) {
    return {
      tone: rejected ? 'warning' : 'success',
      message: created === applied
        ? `${applied} foto${applied === 1 ? '' : 's'} → ${applied} card${applied === 1 ? '' : 's'} criados.${rejectedNote}`
        : `${applied} fotos aplicadas (${created} card${created === 1 ? '' : 's'} novos).${rejectedNote}`,
    };
  }
  if (leftoverSlides > 0) {
    return {
      tone: rejected ? 'warning' : 'info',
      message: `${applied} foto${applied === 1 ? '' : 's'} aplicadas aos primeiros cards; ${leftoverSlides} card${leftoverSlides === 1 ? '' : 's'} ficaram sem arquivo novo.${rejectedNote}`,
    };
  }
  if (skippedNulls > 0 && applied === 0) {
    return { tone: 'error', message: `Nenhuma imagem válida para importar.${rejectedNote}` };
  }
  return {
    tone: rejected ? 'warning' : 'success',
    message: `${applied} foto${applied === 1 ? '' : 's'} aplicadas (slide 1 a ${applied}).${rejectedNote}`,
  };
}
