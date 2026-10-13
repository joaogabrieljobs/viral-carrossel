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

    if (data && typeof data === 'object') {
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

export function summarizeBatchPhotoImport({ applied, created, leftoverSlides, skippedNulls }) {
  if (created > 0) {
    return {
      tone: 'success',
      message: created === applied
        ? `${applied} foto${applied === 1 ? '' : 's'} → ${applied} card${applied === 1 ? '' : 's'} criados.`
        : `${applied} fotos aplicadas (${created} card${created === 1 ? '' : 's'} novos).`,
    };
  }
  if (leftoverSlides > 0) {
    return {
      tone: 'info',
      message: `${applied} foto${applied === 1 ? '' : 's'} aplicadas aos primeiros cards; ${leftoverSlides} card${leftoverSlides === 1 ? '' : 's'} ficaram sem ficheiro novo.`,
    };
  }
  if (skippedNulls > 0 && applied === 0) {
    return { tone: 'error', message: 'Nenhuma imagem válida para importar.' };
  }
  return {
    tone: 'success',
    message: `${applied} foto${applied === 1 ? '' : 's'} aplicadas (slide 1 a ${applied}).`,
  };
}
