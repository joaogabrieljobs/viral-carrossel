/**
 * "Gerar de novo" num projeto que já tem cards (QA 24/11, editor 5).
 *
 * O assistente abria em branco: tema vazio, quantidade padrão e idioma padrão,
 * mesmo com o projeto em outro idioma. Aqui ficam os valores que vêm do projeto
 * atual e o aviso das fotos enviadas, que saem junto com os cards.
 */
import { projectHasCarouselContent } from './context-status.js';
import { resolveRequestedContentLanguage } from './generation-prompts.js';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** Texto visível dos cards, para o detector de idioma que já existe. */
export function slidesContentSample(slides) {
  return (Array.isArray(slides) ? slides : [])
    .flatMap((slide) => [slide?.title, slide?.subtitle, slide?.bodyAfterImage].map(text))
    .filter(Boolean)
    .join('\n');
}

const hasImportedPhoto = (slide) => slide?.bgImageSource === 'imported'
  && !!(slide.bgImage || slide.bgImageId || slide.bgImageAssetId);

/** Valores do projeto atual para abrir o assistente; projeto novo abre em branco. */
export function regenerationDefaults({ slides, editorialContext } = {}) {
  const list = Array.isArray(slides) ? slides : [];
  if (!projectHasCarouselContent(list)) {
    return { existing: false, topic: '', count: null, contentSample: '', importedPhotos: 0 };
  }
  return {
    existing: true,
    topic: text(editorialContext?.topic),
    count: list.length,
    contentSample: slidesContentSample(list),
    importedPhotos: list.filter(hasImportedPhoto).length,
  };
}

/** Frase do aviso das fotos enviadas, ou '' quando o projeto não tem nenhuma. */
export function importedPhotosWarning(count, itemsLabel = 'cards') {
  const total = Number.isInteger(count) && count > 0 ? count : 0;
  if (!total) return '';
  return total === 1
    ? `A foto que você enviou sai junto com os ${itemsLabel} atuais.`
    : `As ${total} fotos que você enviou saem junto com os ${itemsLabel} atuais.`;
}

/**
 * Idioma da nova geração. Instrução ou pedido com idioma reconhecível vencem;
 * sem isso, vale o idioma do conteúdo atual em vez do padrão. `input` é o que
 * segue para `resolveRequestedContentLanguage` e `buildContentLanguageRule`.
 */
export function resolveGenerationLanguage({ instructions = '', topic = '', content = '', currentContent = '' } = {}) {
  const input = { instructions, topic, content };
  const requested = resolveRequestedContentLanguage(input);
  if (requested.source !== 'default' || !text(currentContent)) return { input, language: requested };
  const currentInput = { instructions, topic: '', content: currentContent };
  const current = resolveRequestedContentLanguage(currentInput);
  if (current.source !== 'brief') return { input, language: requested };
  return { input: currentInput, language: { ...current, source: 'current' } };
}
