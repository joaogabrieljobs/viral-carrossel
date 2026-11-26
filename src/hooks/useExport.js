/**
 * Pipeline de exportação — PNG por card, ZIP do carrossel, fotos limpas e PDF.
 * Extraído do App: era ~215 linhas de handlers no corpo do componente.
 *
 * Renderiza a partir dos refs OFFSCREEN (`slideRefs`), nunca do preview escalado,
 * então o resultado sai sempre nas dimensões reais do formato × 3 (retina).
 */
import { useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { slideShowsDeckArt } from '../utils/deck-art.js';
import JSZip from 'jszip';
import { FORMATS } from '../utils/formats.js';
import { videoGet } from '../utils/video-store.js';
import { canvasToPngBlob } from '../utils/image-storage.js';
import { downloadBlob, vcPrepareHtml2CanvasClone, downloadCanvasPng } from '../utils/export-helpers.js';
import { trackEvent } from '../utils/telemetry.js';
import { blobFromSlideRef } from '../utils/ai-client.js';
import { waitForExportFonts } from '../utils/export-fonts.js';
import { waitForPhotoFraming } from '../utils/photo-framing.js';
import { auditPresentationLayout, auditRenderedPresentationLayout } from '../utils/presentation-quality.js';

// O editor carrega seus exportadores junto com a própria versão. Buscar um
// chunk só no clique falhava em abas abertas durante um novo deploy.
export function exportFileStem(projectName, isPresentation = false) {
  const name = String(projectName || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  const kind = isPresentation ? 'apresentacao' : 'carrossel';
  return name ? `${kind}-${name}` : kind;
}

/**
 * Formato de cada página do PDF (spec 1.1, PDF). A Apoteose saía com 44 MB:
 * toda página ia como PNG de 5318 px, e foto em PNG não comprime. Página com
 * foto visível vai em JPEG de alta qualidade; página só de texto (mesmo com
 * logo) continua PNG, sem artefato em letra e logo sobre cor chapada. "Com
 * foto" é o que o card desenha: imagem de fundo presente, sem falha e sem a
 * composição ter suprimido a zona de foto. O PNG e o ZIP por card não mudam.
 *
 * Qualidade medida, não escolhida (25/11): o mesmo card com foto, logo
 * branca e dois CTAs sobre a foto foi codificado pelo Chrome em PNG e em JPEG
 * 0,92/0,95/0,97, a 5318 px (PDF no computador) e a 3840 px (no celular).
 * Nos recortes 1:1 de título, texto pequeno, logo e CTA nenhuma das três
 * borra; 0,92 é a menor. O aviso antigo ("0,92 esborratava logo branca e
 * CTAs") não se reproduziu nessas escalas.
 */
export const PDF_PHOTO_JPEG_QUALITY = 0.92;

export function pdfPageImageFormat(slide = {}) {
  const photo = (!!(slide?.bgImage || slide?.bgImageId || slide?.bgImageAssetId)
    && slide.bgImageFailed !== true && slide.presentationSuppressPhoto !== true)
    // Direção de arte, parte 4: a página com a arte de fundo do deck também é "com foto".
    || slideShowsDeckArt(slide);
  return photo
    ? { mime: 'image/jpeg', format: 'JPEG', quality: PDF_PHOTO_JPEG_QUALITY }
    : { mime: 'image/png', format: 'PNG' };
}

/** Codifica a página já renderizada no formato que ela pede. */
export function pdfPageImage(canvas, slide) {
  const kind = pdfPageImageFormat(slide);
  return { dataUrl: canvas.toDataURL(kind.mime, kind.quality), format: kind.format };
}

/** PDFs longos precisam de uma escala menor em aparelhos com pouca memória. */
export function pdfCanvasScale({
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
  deviceMemory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined,
} = {}) {
  return viewportWidth <= 760 || (Number.isFinite(deviceMemory) && deviceMemory <= 4) ? 2 : 3;
}

// Safari no iPhone e no iPad não desenha canvas acima de 16.777.216 px de área;
// o export de Stories/Apresentação a 3× (18,66 Mpx) saía vazio (MOO-02). A
// mesma escala vale em todo aparelho, para o arquivo sair igual em qualquer um.
const CANVAS_MAX_AREA = 16_000_000;

/** Maior escala ≤ `requested` cujo canvas cabe no teto de área do iOS. */
export function canvasScaleWithinArea(width, height, requested = 3) {
  const area = Math.max(1, width) * Math.max(1, height);
  const fit = Math.floor(Math.sqrt(CANVAS_MAX_AREA / area) * 100) / 100;
  return Math.min(requested, fit);
}

/**
 * Resultado de um pacote com arquivos que podem falhar um a um (MOO-08):
 * parcial vira aviso com a contagem real; nenhum arquivo vira erro.
 */
export function packagedFilesOutcome({ total, failed, label }) {
  const ok = total - failed;
  if (total > 0 && ok <= 0) {
    throw Object.assign(new Error(`Nenhuma das ${total} ${label} pôde ser lida. Nada foi baixado.`), { code: 'export_empty' });
  }
  if (failed > 0) {
    return { level: 'warning', message: `${ok} de ${total} ${label} baixadas no ZIP. ${failed} não pôde ser lida e ficou de fora.` };
  }
  return { level: 'success', message: `${total} ${label} baixadas no ZIP` };
}

// Folha de compartilhar fechada não é download feito (MOO-27): segue o mesmo
// caminho silencioso do cancelamento, sem aviso de sucesso.
function assertDelivered(delivered) {
  if (delivered === false) throw Object.assign(new Error('Download cancelado.'), { code: 'export_cancelled' });
}

/** Extrai todas as URLs de `background-image`, inclusive em camadas múltiplas. */
export function extractCssBackgroundUrls(backgroundImage) {
  const source = String(backgroundImage || '');
  const urls = [];
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
  let match;
  while ((match = re.exec(source))) {
    const value = String(match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (value) urls.push(value);
  }
  return urls;
}

/**
 * Aguarda tanto tags <img> quanto imagens usadas via CSS. Os cards renderizam
 * fotos principalmente em `background-image`; esperar só <img> permitia que
 * html2canvas capturasse um placeholder vazio.
 */
export async function waitForExportAssets(roots, {
  timeoutMs = 3000,
  imageUrls = [],
  ImageCtor = typeof globalThis.Image === 'function' ? globalThis.Image : null,
  getStyle = typeof globalThis.getComputedStyle === 'function'
    ? (node) => globalThis.getComputedStyle(node)
    : null,
} = {}) {
  const liveRoots = (Array.isArray(roots) ? roots : []).filter(Boolean);
  const domImages = [];
  const cssUrls = new Set(
    (Array.isArray(imageUrls) ? imageUrls : [])
      .map((url) => String(url || '').trim())
      .filter(Boolean),
  );

  liveRoots.forEach((root) => {
    root.querySelectorAll?.('img')?.forEach?.((img) => domImages.push(img));
    if (!getStyle) return;
    const nodes = [root, ...(root.querySelectorAll?.('*') || [])];
    nodes.forEach((node) => {
      let backgroundImage = '';
      try { backgroundImage = getStyle(node)?.backgroundImage || ''; } catch { return; }
      extractCssBackgroundUrls(backgroundImage).forEach((url) => cssUrls.add(url));
    });
  });

  const waitForDomImage = (img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      let timer;
      const done = () => {
        clearTimeout(timer);
        img.removeEventListener?.('load', done);
        img.removeEventListener?.('error', done);
        resolve();
      };
      img.addEventListener?.('load', done, { once: true });
      img.addEventListener?.('error', done, { once: true });
      timer = setTimeout(done, timeoutMs);
    });
  };

  const preloadCssImage = (url) => {
    if (!ImageCtor) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new ImageCtor();
      let timer;
      const done = () => {
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        resolve();
      };
      img.onload = done;
      img.onerror = done;
      timer = setTimeout(done, timeoutMs);
      img.src = url;
      if (img.complete) queueMicrotask(done);
    });
  };

  await Promise.all([
    ...domImages.map(waitForDomImage),
    ...Array.from(cssUrls, preloadCssImage),
  ]);
}

/** URLs conhecidas pelo documento, ainda que o renderer não tenha montado o fundo. */
export function slideImageUrls(slides) {
  return Array.from(new Set(
    (Array.isArray(slides) ? slides : [])
      .map((slide) => String(slide?.bgImage || '').trim())
      .filter(Boolean),
  ));
}

/**
 * Prepara os assets em duas fases. A primeira usa o estado dos slides porque o
 * renderer só monta certos backgrounds depois do próprio preload. Depois que
 * React teve tempo de renderizar, a segunda fase inspeciona o DOM final e cobre
 * também logos, tags <img> e outras camadas CSS.
 */
export async function waitForExportReadiness({
  slides = [],
  roots = [],
  fontsReady = typeof document !== 'undefined' ? document.fonts?.ready : null,
  waitForFrames = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }),
  waitForAssets = waitForExportAssets,
  waitForFonts = waitForExportFonts,
} = {}) {
  const directUrls = slideImageUrls(slides);

  // Não depende do background já existir no DOM.
  await waitForAssets([], { imageUrls: directUrls });

  if (fontsReady) {
    try { await fontsReady; } catch {}
  }

  await waitForFonts((Array.isArray(roots) ? roots : []).filter(Boolean));

  await waitForFrames();
  await waitForPhotoFraming(roots);

  // Confirma os assets realmente montados depois do paint do renderer.
  await waitForAssets((Array.isArray(roots) ? roots : []).filter(Boolean), {
    imageUrls: directUrls,
  });
}

/**
 * Um slide PDS que chegou ao piso tipográfico e ainda transborda precisa ser
 * corrigido antes da captura; exportá-lo esconderia texto sem avisar.
 */
export function presentationOverflowAtFloor(roots) {
  return (Array.isArray(roots) ? roots : [])
    .filter(Boolean)
    .flatMap((root) => Array.from(
      root.querySelectorAll?.('[data-vc-overflow-at-floor="true"]') || [],
    ));
}

/**
 * Resolve o subconjunto que será preparado e validado para uma exportação.
 * Ao baixar um único slide, outro card ainda em edição não pode bloquear a
 * captura nem obrigar o preload de imagens que não pertencem a ela.
 */
export function exportRenderScope(slides, refs, slideIndexes = null) {
  const source = Array.isArray(slides) ? slides : [];
  const indexes = Array.isArray(slideIndexes)
    ? slideIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < source.length)
    : source.map((_, index) => index);
  const scopedIndexes = indexes.filter((index) => Boolean(source[index]));
  const scopedSlides = scopedIndexes.map((index) => source[index]);
  const rootMap = refs && typeof refs === 'object' ? refs : {};
  return {
    slides: scopedSlides,
    // Posição de cada slide no projeto, na mesma ordem de `slides`: quem avisa
    // um defeito precisa citar o número que a pessoa vê, não o do recorte.
    indexes: scopedIndexes,
    roots: scopedSlides.map((slide) => rootMap[slide.id]).filter(Boolean),
  };
}

/** Problema no conteúdo que impede um arquivo fiel: fica na tela até a
 * pessoa fechar o aviso e diz onde corrigir. */
export function exportQualityError(message) {
  const error = new Error(message);
  error.code = 'export_quality';
  return error;
}

function listNumbers(numbers) {
  return numbers.length > 1 ? `${numbers.slice(0, -1).join(', ')} e ${numbers.at(-1)}` : String(numbers[0]);
}

/**
 * O que fazer quando a conferência acha texto fora da área. Na apresentação a
 * medição é exata (área segura fixa) e o download é recusado. No carrossel ela
 * erra para mais em fonte de título com entrelinha folgada (conferência de
 * 24/11: Tabloid Keywords, 4 linhas, texto inteiro e download recusado), então
 * o app avisa e a pessoa decide. Devolve true para seguir; sem o sim, lança o
 * mesmo aviso, que diz onde corrigir.
 */
export function resolveOverflowExport({ numbers = [], hasOverflow = numbers.length > 0, itemLabel = 'slide', ask } = {}) {
  if (!hasOverflow) return true;
  const message = overflowExportMessage(numbers, { itemLabel });
  if (itemLabel === 'card' && typeof ask === 'function'
    && ask(`${message}\n\nConfira o card antes: se o texto estiver inteiro na tela, pode baixar. Baixar mesmo assim?`) === true) return true;
  throw exportQualityError(message);
}

/** Aviso da trava de exportação quando o texto não cabe; `numbers` começa em 1. */
export function overflowExportMessage(numbers = [], { itemLabel = 'slide' } = {}) {
  if (itemLabel === 'card') {
    const where = numbers.length
      ? `${numbers.length === 1 ? 'Card' : 'Cards'} ${listNumbers(numbers)}`
      : 'Um card';
    return `${where}: o texto pode não caber na área do card e sair cortado no arquivo. Abra ${numbers.length === 1 ? 'o card' : 'cada card'} e encurte o texto ou diminua o tamanho da letra.`;
  }
  const where = numbers.length
    ? `${numbers.length === 1 ? 'Slide' : 'Slides'} ${listNumbers(numbers)}`
    : 'Um slide';
  return `${where}: o texto passa da área segura e seria cortado no arquivo. Abra ${numbers.length === 1 ? 'o slide' : 'cada slide'} e reduza o texto na aba Texto, ou aumente a caixa arrastando a borda.`;
}

/** Legacy decks keep their existing export behavior. The new planning pipeline
 * opts into measured quality gates; native evidence blocks always opt in. */
export function assertPresentationExportQuality(scope) {
  const managed = (scope.slides || []).map((slide, index) => ({ slide, index: scope.indexes?.[index] ?? index }))
    .filter(({ slide }) => slide.presentationQualityVersion === 1 || slide.presentationBlocks?.length);
  if (!managed.length) return;
  const issues = managed.flatMap(({ slide, index }) => auditPresentationLayout(slide, { index }).issues);
  const roots = managed.map(({ slide }) => (scope.roots || []).find((root) =>
    root?.getAttribute?.('data-vc-card-surface') === slide.id
    || root?.closest?.('[data-vc-card-surface]')?.getAttribute?.('data-vc-card-surface') === slide.id));
  issues.push(...auditRenderedPresentationLayout(roots).issues.map((issue) => ({
    ...issue,
    slideIndex: managed[issue.slideIndex]?.index ?? issue.slideIndex,
  })));
  const error = issues.find((issue) => issue.severity === 'error');
  if (error) throw exportQualityError(`Slide ${error.slideIndex + 1}: ${error.message} Abra o slide ${error.slideIndex + 1} para corrigir antes de baixar.`);
}

export function useExport({
  slides,
  fmt,
  projectName = '',
  productKind = '',
  slideRefs,
  setExporting,
  setExportProgress,
  setError,
  toast,
}) {
  const exportInFlightRef = useRef(false);
  const cancelExportRef = useRef(false);
  const isPresentation = productKind === 'apresentacao' || fmt === 'apresentacao';
  const itemLabel = isPresentation ? 'slide' : 'card';
  const fileStem = exportFileStem(projectName, isPresentation);
  // Arquivo pronto: o "Exportando n/n" sai antes da entrega. No celular ela pode
  // esperar o toque em "Salvar PDF", e o Cancelar do progresso já não valeria.
  const deliverFile = (blob, name) => {
    setExportProgress({ current: 0, total: 0 });
    return downloadBlob(blob, name);
  };
  const waitForRender = async (slideIndexes = null) => {
    const scope = exportRenderScope(slides, slideRefs.current, slideIndexes);
    await waitForExportReadiness(scope);
    const { roots } = scope;
    const overflowSlides = scope.slides
      .map((slide, i) => (presentationOverflowAtFloor([roots.find((root) => root?.getAttribute?.('data-vc-card-surface') === slide.id
        || root?.closest?.('[data-vc-card-surface]')?.getAttribute?.('data-vc-card-surface') === slide.id)]).length
        ? slides.indexOf(slide) + 1 : null))
      .filter(Boolean);
    resolveOverflowExport({
      numbers: overflowSlides, hasOverflow: overflowSlides.length > 0 || presentationOverflowAtFloor(roots).length > 0,
      itemLabel, ask: (message) => window.confirm(message),
    });
    if (isPresentation) assertPresentationExportQuality(scope);
  };

  const beginExport = () => {
    if (exportInFlightRef.current) {
      toast('Uma exportação já está em andamento.', 'info');
      return false;
    }
    exportInFlightRef.current = true;
    cancelExportRef.current = false;
    return true;
  };
  const finishExport = () => {
    exportInFlightRef.current = false;
    cancelExportRef.current = false;
    setExporting(false);
  };
  const throwIfExportCancelled = () => {
    if (cancelExportRef.current) {
      throw Object.assign(new Error('Exportação cancelada.'), { code: 'export_cancelled' });
    }
  };
  const cancelExport = useCallback(() => {
    if (!exportInFlightRef.current) return;
    cancelExportRef.current = true;
    toast('Cancelando após o arquivo atual…', 'info');
  }, [toast]);

  const renderSlideToCanvas = async (slideObj, { scale = 3, backgroundColor = null } = {}) => {
    const el = slideRefs.current[slideObj.id];
    if (!el) throw new Error('Elemento de export não encontrado');
    const f = FORMATS[fmt] || FORMATS.carrossel;
    const w = Math.max(1, Math.round(el.offsetWidth || el.scrollWidth || f.w));
    const h = Math.max(1, Math.round(el.offsetHeight || el.scrollHeight || f.h));
    return html2canvas(el, {
      scale: canvasScaleWithinArea(w, h, scale),
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      imageTimeout: 15000,
      onclone: async (clonedDoc, clonedEl) => {
        await waitForExportFonts([clonedEl], { doc: clonedDoc });
        await vcPrepareHtml2CanvasClone(clonedDoc, clonedEl);
      },
    });
  };

  const exportSlide = async (idx) => {
    if (!beginExport()) return false;
    setExporting(true); setExportProgress({current:1,total:1});
    try {
      throwIfExportCancelled();
      const slide = slides[idx];
      // Se card tem vídeo, baixa o vídeo bruto + uma cópia PNG do card sem o vídeo
      // (pra você sobrepor manualmente no CapCut/InShot)
      if (slide?.videoId) {
        const entry = await videoGet(slide.videoId);
        if (entry?.blob) {
          const ext = (entry.mime || 'video/mp4').split('/')[1].split(';')[0] || 'mp4';
          assertDelivered(await downloadBlob(entry.blob, `${isPresentation ? `${fileStem}-` : ''}slide-${String(idx+1).padStart(2,'0')}-video.${ext}`));
          toast(`Vídeo do ${itemLabel} ${idx+1} baixado. Adicione o texto no editor de vídeo (CapCut, InShot, etc).`, 'success', 6000);
          return true;
        }
      }
      await waitForRender([idx]);
      const canvas = await renderSlideToCanvas(slide);
      assertDelivered(await downloadCanvasPng(canvas, `${isPresentation ? `${fileStem}-` : ''}slide-${String(idx+1).padStart(2,'0')}.png`));
      toast(`${isPresentation ? 'Slide' : 'Card'} ${idx+1} baixado`, 'success');
      return true;
    } catch(e) {
      if (e?.code === 'export_quality') toast(e.message, 'error', 0); else if (e?.code !== 'export_cancelled') setError('Erro ao exportar: '+e.message);
      return false;
    }
    finally { finishExport(); }
  };

  const exportAll = async () => {
    if (!beginExport()) return false;
    setExporting(true);
    setExportProgress({current:0,total:slides.length});
    try {
      await waitForRender();
      const zip = new JSZip();
      const videoSlides = [];
      let missingVideos = 0;
      for (let i=0; i<slides.length; i++) {
        throwIfExportCancelled();
        setExportProgress({current:i+1,total:slides.length});
        const slide = slides[i];
        if (slide?.videoId) {
          // Slide com vídeo: empacota o vídeo bruto + ainda gera o PNG do preview
          // (o PNG ajuda a visualizar; o vídeo é o material editável no CapCut)
          try {
            const entry = await videoGet(slide.videoId);
            if (entry?.blob) {
              const ext = (entry.mime || 'video/mp4').split('/')[1].split(';')[0] || 'mp4';
              zip.file(`slide-${String(i+1).padStart(2,'0')}-video.${ext}`, entry.blob);
              videoSlides.push({ idx: i+1, title: slide.title, subtitle: slide.subtitle, body: slide.bodyAfterImage || '' });
            } else missingVideos += 1;
          } catch (e) {
            missingVideos += 1;
            console.warn(`Falha ao empacotar vídeo do slide ${i+1}:`, e.message);
          }
        }
        // PNG do preview sempre (mesmo se tem vídeo — útil de referência)
        const canvas = await renderSlideToCanvas(slide);
        const blob = await canvasToPngBlob(canvas);
        // Libera a memória do canvas antes do próximo slide (MOO-09).
        canvas.width = 0; canvas.height = 0;
        const suffix = slide?.videoId ? '-preview' : '';
        zip.file(`slide-${String(i+1).padStart(2,'0')}${suffix}.png`, blob);
      }
      // README explicando como usar quando há vídeos
      if (videoSlides.length > 0) {
        const readme = [
          `# ${isPresentation ? 'Apresentação' : 'Carrossel'} — Material de Exportação`,
          '',
          `Este ZIP contém ${slides.length} ${itemLabel}(s).`,
          `${videoSlides.length} ${itemLabel}(s) têm VÍDEO em vez de foto estática.`,
          '',
          `## ${isPresentation ? 'Slides' : 'Cards'} com vídeo`,
          '',
          ...videoSlides.map(v => [
            `### Slide ${String(v.idx).padStart(2, '0')}`,
            `- Vídeo bruto: slide-${String(v.idx).padStart(2, '0')}-video.*`,
            `- Preview com texto: slide-${String(v.idx).padStart(2, '0')}-preview.png`,
            `- Título: ${v.title || '(vazio)'}`,
            v.subtitle ? `- Subtítulo: ${v.subtitle}` : null,
            v.body ? `- Corpo: ${v.body}` : null,
            '',
          ].filter(Boolean).join('\n')),
          '',
          '## Como combinar texto + vídeo',
          '',
          '1. Abre o vídeo no CapCut, InShot, Premiere ou similar',
          '2. Adiciona uma camada de texto por cima usando o título/subtítulo acima',
          isPresentation ? '3. Exporte o vídeo na mesma proporção dos slides.' : '3. Exporta como MP4 com proporção 4:5 (1080×1350) pra feed do Instagram',
          isPresentation ? '4. Insira os vídeos no aplicativo usado para apresentar.' : '4. Pra carrossel misto (foto + vídeo), suba todos juntos no Instagram',
          '',
          isPresentation ? '(Slides sem vídeo já estão prontos como PNG.)' : '(Cards SEM vídeo já vêm prontos como PNG — basta postar.)',
        ].join('\n');
        zip.file('LEIA-ME.md', readme);
      }
      // PNG e vídeo já são comprimidos: STORE poupa CPU e memória (MOO-09).
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      throwIfExportCancelled();
      assertDelivered(await deliverFile(zipBlob, `${fileStem}.zip`));
      const videoNote = videoSlides.length > 0 ? ` (${videoSlides.length} c/ vídeo — veja LEIA-ME.md)` : '';
      if (missingVideos > 0) {
        // Vídeo que não pôde ser lido não some em silêncio (MOO-08).
        toast(`ZIP com ${slides.length} ${itemLabel}s pronto, mas ${missingVideos} vídeo(s) não puderam ser lidos e ficaram só como imagem.`, 'warning', 0);
      } else toast(`ZIP com ${slides.length} ${itemLabel}s pronto${videoNote}`, 'success');
      trackEvent('export_zip', { card_count: String(slides.length), videos: String(videoSlides.length) });
      return true;
    } catch(e) {
      if (e?.code === 'export_quality') toast(e.message, 'error', 0); else if (e?.code !== 'export_cancelled') setError('Erro ao exportar: '+e.message);
      return false;
    }
    finally { finishExport(); }
  };

  // Baixa as imagens RAW (sem texto/overlay) — útil pra guardar geração IA paga.
  // Filtra slides com bgImage; nomeia ia-NN.png pra geradas, foto-NN.png pra importadas.
  const exportPhotosOnly = async () => {
    const withPhotos = slides
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !!s.bgImage);
    if (withPhotos.length === 0) {
      toast(`Nenhum ${itemLabel} tem foto para baixar.`, 'info');
      return;
    }
    if (!beginExport()) return false;
    setExporting(true);
    setExportProgress({ current: 0, total: withPhotos.length });
    try {
      const zip = new JSZip();
      let aiCount = 0;
      let failedPhotos = 0;
      for (let k = 0; k < withPhotos.length; k++) {
        throwIfExportCancelled();
        setExportProgress({ current: k + 1, total: withPhotos.length });
        const { s, i } = withPhotos[k];
        try {
          const blob = await blobFromSlideRef(s.bgImage);
          const ext = blob.type.includes('png') ? 'png'
            : blob.type.includes('jpeg') ? 'jpg'
            : blob.type.includes('webp') ? 'webp'
            : 'png';
          const tag = s.bgImageSource === 'ai' ? 'ia' : 'foto';
          if (s.bgImageSource === 'ai') aiCount++;
          zip.file(`${tag}-${String(i + 1).padStart(2, '0')}.${ext}`, blob);
        } catch (e) {
          failedPhotos += 1;
          console.warn(`Falha ao empacotar foto do slide ${i + 1}:`, e.message);
        }
      }
      const outcome = packagedFilesOutcome({ total: withPhotos.length, failed: failedPhotos, label: 'fotos' });
      // Fotos e vídeos já são comprimidos: STORE poupa CPU e memória (MOO-09).
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      throwIfExportCancelled();
      assertDelivered(await deliverFile(zipBlob, `${fileStem}-fotos.zip`));
      toast(
        outcome.level === 'success' && aiCount > 0
          ? `${outcome.message} (${aiCount} geradas por IA, guarde para reuso)`
          : outcome.message,
        outcome.level,
        outcome.level === 'success' ? 5000 : 0,
      );
      return true;
    } catch (e) {
      if (e?.code === 'export_empty') toast(e.message, 'error', 0);
      else if (e?.code !== 'export_cancelled') setError('Erro ao baixar fotos: ' + e.message);
      return false;
    } finally {
      finishExport();
    }
  };

  // Exporta todos os slides em UM único PDF (1 slide por página, dimensões reais)
  const exportPDF = async () => {
    if (!beginExport()) return false;
    setExporting(true);
    setExportProgress({current:0,total:slides.length});
    try {
      await waitForRender();
      const f = FORMATS[fmt] || FORMATS.carrossel;
      const pdf = new jsPDF({ unit:'px', format:[f.w, f.h], orientation: f.h > f.w ? 'portrait' : 'landscape', compress:true });
      pdf.setProperties({ title: projectName || (isPresentation ? 'Apresentação' : 'Carrossel') });
      const scale = pdfCanvasScale();
      for (let i=0; i<slides.length; i++) {
        throwIfExportCancelled();
        setExportProgress({current:i+1,total:slides.length});
        // JPEG não tem transparência: a página com foto é desenhada sobre
        // branco, a mesma cor que a página do PDF mostrava sob o PNG.
        const photoPage = pdfPageImageFormat(slides[i]).format === 'JPEG';
        const canvas = await renderSlideToCanvas(slides[i], { scale, backgroundColor: photoPage ? '#ffffff' : null });
        let page = pdfPageImage(canvas, slides[i]);
        if (i > 0) pdf.addPage([f.w, f.h], f.h > f.w ? 'portrait' : 'landscape');
        pdf.addImage(page.dataUrl, page.format, 0, 0, f.w, f.h);
        page = null;
        canvas.width = 1;
        canvas.height = 1;
      }
      throwIfExportCancelled();
      assertDelivered(await deliverFile(pdf.output('blob'), `${fileStem}.pdf`));
      toast(`PDF com ${slides.length} ${itemLabel}s gerado`, 'success');
      return true;
    } catch(e) {
      if (e?.code === 'export_quality') toast(e.message, 'error', 0); else if (e?.code !== 'export_cancelled') setError('Erro ao gerar PDF: '+e.message);
      return false;
    }
    finally { finishExport(); }
  };

  return {
    waitForRender,
    renderSlideToCanvas,
    exportSlide,
    exportAll,
    exportPhotosOnly,
    exportPDF,
    cancelExport,
  };
}
