/**
 * Idioma do conteúdo para os rótulos fixos que o desenho escreve no card
 * ("CENA 02", "§02 · CONTEXTO", selo "ARRASTA PRO LADO").
 *
 * O detector é o mesmo do rótulo "Passo N" na geração
 * (`resolveRequestedContentLanguage`), lendo o texto que está nos cards: assim
 * o rótulo acompanha o conteúdo também em projeto antigo ou escrito à mão.
 * Sem texto suficiente para decidir, vale o padrão do projeto (português).
 */
import { createContext } from 'react';
import { resolveRequestedContentLanguage } from './generation-prompts.js';

/** Código do idioma ('pt-BR' | 'en' | 'es') para os cards desenhados abaixo. */
export const ContentLabelLanguageContext = createContext('pt-BR');

export function contentLabelLanguage(slides) {
  const content = (Array.isArray(slides) ? slides : [])
    .map((slide) => [slide?.title, slide?.subtitle, slide?.bodyAfterImage].filter((text) => typeof text === 'string' && text.trim()).join('\n'))
    .filter(Boolean)
    .join('\n');
  return resolveRequestedContentLanguage({ content }).code;
}
