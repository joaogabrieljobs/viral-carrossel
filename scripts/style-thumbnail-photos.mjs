/**
 * Foto de exemplo da capa de cada estilo de carrossel nas miniaturas do seletor.
 * Uma foto por estilo, escolhida pelo assunto que o estilo costuma vestir,
 * para a grade não repetir a mesma imagem.
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

/**
 * Os 12 estilos virais ("Estilos para começar"), por id do preset. Nenhuma
 * repete as fotos das famílias. A pasta tem arquivos iguais com nomes
 * diferentes (ex.: editorial-2 e swiss-0); o gerador recusa conteúdo repetido.
 */
export const VIRAL_PRESET_COVER_PHOTO = Object.freeze({
  sports_editorial: 'cultural-3',   // dançarina em movimento ao ar livre: ação
  case_study_neon: 'executive-0',   // tablet com gráficos: resultado de caso
  mood_sepia: 'luxury-1',           // caneca entre as mãos: clima quente
  bold_promo_rosa: 'photo-3',       // pratos servidos: produto em oferta
  reflexivo_cream: 'typographic-0', // mão escrevendo com café: reflexão
  tabloid_keywords: 'swiss-1',      // rua e estação: notícia de cidade
  editorial_magazine: 'photo-0',    // cozinheira no fogão: revista de estilo de vida
  luxury_hybrid: 'editorial-1',     // ânforas em vitrine: objeto de luxo
  viral_hype_dark: 'cinematic-2',   // rastro de luz na rua escura: drama
  cinematic_hybrid: 'cinematic-4',  // luzes da cidade à noite: noir
  authority_black: 'typographic-2', // mesa de trabalho em preto e branco: autoridade
  minimal_clean: 'modular-1',       // caderno e caneta em fundo claro: poucos elementos
});
