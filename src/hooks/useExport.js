/**
 * Pipeline de exportação — PNG por card, ZIP do carrossel, fotos limpas e PDF.
 * Extraído do App: era ~215 linhas de handlers no corpo do componente.
 *
 * Renderiza a partir dos refs OFFSCREEN (`slideRefs`), nunca do preview escalado,
 * então o resultado sai sempre nas dimensões reais do formato × 2 (retina).
 */
import { useCallback } from 'react';
import { FORMATS } from '../utils/formats.js';
import { videoGet } from '../utils/video-store.js';
import { canvasToPngBlob } from '../utils/image-storage.js';
import { downloadBlob, vcFixHtml2CanvasImages, downloadCanvasPng } from '../utils/export-helpers.js';
import { trackEvent } from '../utils/telemetry.js';
import { blobFromSlideRef } from '../utils/ai-client.js';

const loadHtml2Canvas = async () => (await import('html2canvas')).default;
const loadJsPdf = async () => (await import('jspdf')).jsPDF;

export function useExport({
  slides,
  fmt,
  slideRefs,
  setExporting,
  setExportProgress,
  setError,
  toast,
}) {
  const waitForRender = async () => {
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch {}
    }
    // 2 frames pra garantir que o React fez paint do DOM offscreen
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Aguarda imagens dentro dos refs offscreen carregarem
    const imgs = [];
    for (const id in slideRefs.current) {
      const el = slideRefs.current[id];
      if (!el) continue;
      el.querySelectorAll('img').forEach(img => imgs.push(img));
    }
    await Promise.all(imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(res => {
        img.addEventListener('load',  res, { once:true });
        img.addEventListener('error', res, { once:true });
        setTimeout(res, 3000); // failsafe
      });
    }));
  };

  const renderSlideToCanvas = async (slideObj) => {
    const h2c = await loadHtml2Canvas();
    const el = slideRefs.current[slideObj.id];
    if (!el) throw new Error('Elemento de export não encontrado');
    const f = FORMATS[fmt] || FORMATS.carrossel;
    const w = Math.max(1, Math.round(el.offsetWidth || el.scrollWidth || f.w));
    const h = Math.max(1, Math.round(el.offsetHeight || el.scrollHeight || f.h));
    return h2c(el, {
      scale: 2,                 // 2× resolução final pra ficar nítido
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: null,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      onclone: (clonedDoc, clonedEl) => {
        vcFixHtml2CanvasImages(clonedDoc, clonedEl);
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
          await downloadBlob(entry.blob, `slide-${String(idx+1).padStart(2,'0')}-video.${ext}`);
          toast(`Vídeo do card ${idx+1} baixado. Adicione o texto no editor de vídeo (CapCut, InShot, etc).`, 'success', 6000);
          return;
        }
      }
      await loadHtml2Canvas();
      await waitForRender();
      const canvas = await renderSlideToCanvas(slide);
      await downloadCanvasPng(canvas, `slide-${String(idx+1).padStart(2,'0')}.png`);
      toast(`Card ${idx+1} baixado`, 'success');
    } catch(e) { setError('Erro ao exportar: '+e.message); }
    finally { setExporting(false); }
  };

  const exportAll = async () => {
    setExporting(true);
    setExportProgress({current:0,total:slides.length});
    try {
      await loadHtml2Canvas();
      await waitForRender();
      const { default: JSZip } = await import('jszip');
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
          '# Carrossel — Material de Exportação',
          '',
          `Este ZIP contém ${slides.length} card(s).`,
          `${videoSlides.length} card(s) têm VÍDEO em vez de foto estática.`,
          '',
          '## Cards com vídeo',
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
          '3. Exporta como MP4 com proporção 4:5 (1080×1350) pra feed do Instagram',
          '4. Pra carrossel misto (foto + vídeo), suba todos juntos no Instagram',
          '',
          '(Cards SEM vídeo já vêm prontos como PNG — basta postar.)',
        ].join('\n');
        zip.file('LEIA-ME.md', readme);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadBlob(zipBlob, `carrossel-${stamp}.zip`);
      const videoNote = videoSlides.length > 0 ? ` (${videoSlides.length} c/ vídeo — veja LEIA-ME.md)` : '';
      toast(`ZIP com ${slides.length} cards pronto${videoNote}`, 'success');
      trackEvent('export_zip', { card_count: String(slides.length), videos: String(videoSlides.length) });
    } catch(e) { setError('Erro ao exportar: '+e.message); }
    finally { setExporting(false); }
  };

  // Baixa as imagens RAW (sem texto/overlay) — útil pra guardar geração IA paga.
  // Filtra slides com bgImage; nomeia ia-NN.png pra geradas, foto-NN.png pra importadas.
  const exportPhotosOnly = async () => {
    const withPhotos = slides
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !!s.bgImage);
    if (withPhotos.length === 0) {
      toast('Nenhum card tem foto pra baixar.', 'info');
      return;
    }
    setExporting(true);
    setExportProgress({ current: 0, total: withPhotos.length });
    try {
      const { default: JSZip } = await import('jszip');
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
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadBlob(zipBlob, `carrossel-fotos-${stamp}.zip`);
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
      const [, JsPDF] = await Promise.all([loadHtml2Canvas(), loadJsPdf()]);
      await waitForRender();
      const f = FORMATS[fmt] || FORMATS.carrossel;
      const pdf = new JsPDF({ unit:'px', format:[f.w, f.h], orientation: f.h > f.w ? 'portrait' : 'landscape', compress:true });
      for (let i=0; i<slides.length; i++) {
        setExportProgress({current:i+1,total:slides.length});
        const canvas = await renderSlideToCanvas(slides[i]);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (i > 0) pdf.addPage([f.w, f.h], f.h > f.w ? 'portrait' : 'landscape');
        pdf.addImage(dataUrl, 'JPEG', 0, 0, f.w, f.h);
      }
      pdf.save(`carrossel-${Date.now()}.pdf`);
      toast(`PDF com ${slides.length} slides gerado`, 'success');
    } catch(e) { setError('Erro ao gerar PDF: '+e.message); }
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
