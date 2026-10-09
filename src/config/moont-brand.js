/**
 * Identidade pública da Moont.
 *
 * Os IDs internos do produto continuam `carrossel` e `apresentacao` para
 * preservar documentos e preferências já salvos. Esta camada define apenas a
 * linguagem que a pessoa vê.
 */

export const MOONT_BRAND = Object.freeze({
  name: 'Moont',
  descriptor: 'Studio de narrativas visuais com IA',
  promise: 'Ideias que ganham forma. Histórias que movem.',
  pronunciation: 'Munt',
});

export const MOONT_NARRATIVES = Object.freeze({
  carrossel: Object.freeze({
    id: 'carrossel',
    family: 'Comunica',
    name: 'Moont Comunica',
    eyebrow: 'Narrativa de comunicação',
    format: 'Carrossel 4:5',
    output: 'PNG para publicar',
    title: 'Transforme uma ideia em uma história que circula.',
    description: 'Gancho, argumento, ritmo visual e fechamento para comunicar com clareza nas redes.',
    shortDescription: 'Narrativas visuais para conteúdo social.',
  }),
  apresentacao: Object.freeze({
    id: 'apresentacao',
    family: 'Apresenta',
    name: 'Moont Apresenta',
    eyebrow: 'Narrativa de apresentação',
    format: 'Apresentação 16:9',
    output: 'PDF para apresentar',
    title: 'Conduza pessoas da primeira ideia à decisão.',
    description: 'Pitches, aulas, propostas, relatórios e keynotes com começo, progressão e conclusão próprios.',
    shortDescription: 'Decks estruturados para explicar, convencer e ensinar.',
  }),
});

export function moontNarrative(kind) {
  return MOONT_NARRATIVES[kind === 'apresentacao' ? 'apresentacao' : 'carrossel'];
}
