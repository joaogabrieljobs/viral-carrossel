/**
 * Pipeline de exportação — PNG por card, ZIP do carrossel, fotos limpas e PDF.
 * Extraído do App: era ~215 linhas de handlers no corpo do componente.
 *
 * Renderiza a partir dos refs OFFSCREEN (`slideRefs`), nunca do preview escalado,
 * então o resultado sai sempre nas dimensões reais do formato × 3 (retina).
 */
import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
  const scopedSlides = indexes.map((index) => source[index]).filter(Boolean);
  const rootMap = refs && typeof refs === 'object' ? refs : {};
  return {
    slides: scopedSlides,
    roots: scopedSlides.map((slide) => rootMap[slide.id]).filter(Boolean),
  };
}

/** Legacy decks keep their existing export behavior. The new planning pipeline
 * opts into measured quality gates; native evidence blocks always opt in. */
export function assertPresentationExportQuality(scope) {
  const managed = (scope.slides || []).map((slide, index) => ({ slide, index }))
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
  if (error) throw new Error(`Revise o slide ${error.slideIndex + 1} antes de baixar: ${error.message}`);
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
  const isPresentation = productKind === 'apresentacao' || fmt === 'apresentacao';
  const itemLabel = isPresentation ? 'slide' : 'card';
  const fileStem = exportFileStem(projectName, isPresentation);
  const waitForRender = async (slideIndexes = null) => {
    const scope = exportRenderScope(slides, slideRefs.current, slideIndexes);
    await waitForExportReadiness(scope);
    const { roots } = scope;
    const overflow = presentationOverflowAtFloor(roots);
    if (overflow.length) {
      throw new Error(
        `O texto excede a área segura em ${overflow.length} slide${overflow.length === 1 ? '' : 's'}. Use “Autoajustar todos” ou reduza o texto antes de baixar.`,
      );
    }
    if (isPresentation) assertPresentationExportQuality(scope);
  };

  const renderSlideToCanvas = async (slideObj) => {
    const el = slideRefs.current[slideObj.id];
    if (!el) throw new Error('Elemento de export não encontrado');
    const f = FORMATS[fmt] || FORMATS.carrossel;
    const w = Math.max(1, Math.round(el.offsetWidth || el.scrollWidth || f.w));
    const h = Math.max(1, Math.round(el.offsetHeight || el.scrollHeight || f.h));
    return html2canvas(el, {
      scale: 3,                 // 3× — logos finas e CTAs saem nítidos no PNG
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: null,
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
    setExporting(true); setExportProgress({current:1,total:1});
    try {
      const slide = slides[idx];
      // Se card tem vídeo, baixa o vídeo bruto + uma cópia PNG do card sem o vídeo
      // (pra você sobrepor manualmente no CapCut/InShot)
      if (slide?.videoId) {
        const entry = await videoGet(slide.videoId);
        if (entry?.blob) {
          const ext = (entry.mime || 'video/mp4').split('/')[1].split(';')[0] || 'mp4';
          await downloadBlob(entry.blob, `${isPresentation ? `${fileStem}-` : ''}slide-${String(idx+1).padStart(2,'0')}-video.${ext}`);
          toast(`Vídeo do ${itemLabel} ${idx+1} baixado. Adicione o texto no editor de vídeo (CapCut, InShot, etc).`, 'success', 6000);
          return;
        }
      }
      await waitForRender([idx]);
      const canvas = await renderSlideToCanvas(slide);
      await downloadCanvasPng(canvas, `${isPresentation ? `${fileStem}-` : ''}slide-${String(idx+1).padStart(2,'0')}.png`);
      toast(`${isPresentation ? 'Slide' : 'Card'} ${idx+1} baixado`, 'success');
    } catch(e) { setError('Erro ao exportar: '+e.message); }
    finally { setExporting(false); }
  };

  const exportAll = async () => {
    setExporting(true);
    setExportProgress({current:0,total:slides.length});
    try {
      await waitForRender();
      const zip = new JSZip();
      const videoSlides = [];
      for (let i=0; i<slides.length; i++) {
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
            }
          } catch (e) {
            console.warn(`Falha ao empacotar vídeo do slide ${i+1}:`, e.message);
          }
        }
        // PNG do preview sempre (mesmo se tem vídeo — útil de referência)
        const canvas = await renderSlideToCanvas(slide);
        const blob = await canvasToPngBlob(canvas);
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
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      await downloadBlob(zipBlob, `${fileStem}.zip`);
      const videoNote = videoSlides.length > 0 ? ` (${videoSlides.length} c/ vídeo — veja LEIA-ME.md)` : '';
      toast(`ZIP com ${slides.length} ${itemLabel}s pronto${videoNote}`, 'success');
      trackEvent('export_zip', { card_count: String(slides.length), videos: String(videoSlides.length) });
      return true;
    } catch(e) { setError('Erro ao exportar: '+e.message); return false; }
    finally { setExporting(false); }
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
    setExporting(true);
    setExportProgress({ current: 0, total: withPhotos.length });
    try {
      const zip = new JSZip();
      let aiCount = 0;
      for (let k = 0; k < withPhotos.length; k++) {
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
          console.warn(`Falha ao empacotar foto do slide ${i + 1}:`, e.message);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      await downloadBlob(zipBlob, `${fileStem}-fotos.zip`);
      toast(
        aiCount > 0
          ? `${withPhotos.length} fotos baixadas (${aiCount} geradas por IA — guarde pra reuso!)`
          : `${withPhotos.length} fotos baixadas no ZIP`,
        'success',
        5000,
      );
    } catch (e) {
      setError('Erro ao baixar fotos: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // Exporta todos os slides em UM único PDF (1 slide por página, dimensões reais)
  const exportPDF = async () => {
    setExporting(true);
    setExportProgress({current:0,total:slides.length});
    try {
      await waitForRender();
      const f = FORMATS[fmt] || FORMATS.carrossel;
      const pdf = new jsPDF({ unit:'px', format:[f.w, f.h], orientation: f.h > f.w ? 'portrait' : 'landscape', compress:true });
      pdf.setProperties({ title: projectName || (isPresentation ? 'Apresentação' : 'Carrossel') });
      for (let i=0; i<slides.length; i++) {
        setExportProgress({current:i+1,total:slides.length});
        const canvas = await renderSlideToCanvas(slides[i]);
        // PNG no PDF: JPEG a 0.92 esborratava logo branca e CTAs.
        const dataUrl = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage([f.w, f.h], f.h > f.w ? 'portrait' : 'landscape');
        pdf.addImage(dataUrl, 'PNG', 0, 0, f.w, f.h);
      }
      await downloadBlob(pdf.output('blob'), `${fileStem}.pdf`);
      toast(`PDF com ${slides.length} ${itemLabel}s gerado`, 'success');
      return true;
    } catch(e) { setError('Erro ao gerar PDF: '+e.message); return false; }
    finally { setExporting(false); }
  };

  return {
    waitForRender,
    renderSlideToCanvas,
    exportSlide,
    exportAll,
    exportPhotosOnly,
    exportPDF,
  };
}
