import { useCallback } from 'react';
import { copyTextToClipboard, exportCarouselPackage } from '../utils/export-package.js';
import { trackEvent } from '../utils/telemetry.js';

/** Desktop and mobile deliver the same publication caption. */
export function useCaptionDelivery({ caption, generateCaption, exportAll, toast, isPresentation }) {
  const captionText = useCallback(async () => {
    let text = String(caption || '').trim();
    if (!text && generateCaption) {
      toast?.(isPresentation ? 'Gerando o resumo…' : 'Gerando a legenda…', 'info');
      text = String(await generateCaption() || '').trim();
    }
    return text;
  }, [caption, generateCaption, isPresentation, toast]);

  const handleCopyCaption = useCallback(async () => {
    try {
      await copyTextToClipboard(await captionText());
      trackEvent('caption_copy');
      toast?.(isPresentation ? 'Resumo da apresentação copiado.' : 'Legenda da publicação copiada.', 'success');
    } catch (error) {
      toast?.(error.message || 'Não foi possível copiar o texto.', 'error');
    }
  }, [captionText, isPresentation, toast]);

  const handleExportPackage = useCallback(async () => {
    try {
      const text = await captionText();
      const result = await exportCarouselPackage({ exportAll, caption:text });
      trackEvent('export_package');
      toast?.(result.captionCopied
        ? (isPresentation ? 'Slides baixados e resumo copiado.' : 'Cards baixados e legenda copiada. Os arquivos estão prontos para publicar.')
        : 'Arquivos baixados. A legenda ainda está vazia.', 'success', 6000);
    } catch (error) {
      toast?.(error.message || 'Não foi possível preparar os arquivos.', 'error');
    }
  }, [captionText, exportAll, isPresentation, toast]);

  return { handleCopyCaption, handleExportPackage };
}
