/**
 * Foto de exemplo da capa de cada família editorial nas miniaturas do seletor.
 * Uma foto por família, escolhida pelo assunto que o estilo costuma vestir,
 * para a grade não repetir a mesma imagem nove vezes.
 *
 * Os nomes são arquivos <familia>-<n>.jpg da galeria de apresentações (CC0 ou
 * domínio público), a mesma pasta que scripts/build-style-thumbnails.mjs já
 * recebe. Créditos em docs/presentation/creditos-miniaturas.md.
 */
export const SOCIAL_FAMILY_COVER_PHOTO = Object.freeze({
  revista: 'photo-2',      // padaria artesanal: pauta de estilo de vida
  manchete: 'cinematic-0', // cidade vista de cima: notícia urbana
  grade: 'swiss-0',        // torre de vidro: arquitetura e linhas
  documental: 'photo-1',   // cozinha em serviço: bastidor de trabalho
  produto: 'luxury-3',     // xícara de café: objeto em destaque
  ficha: 'technical-1',    // placa de circuito: assunto técnico
  minimal: 'luxury-0',     // porcelana em fundo claro: poucos elementos
  poster: 'cultural-5',    // louça colorida: cor forte em primeiro plano
  cinema: 'cinematic-1',   // rastros de luz à noite: cena escura
});
