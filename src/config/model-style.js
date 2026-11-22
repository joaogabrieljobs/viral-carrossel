// Regras de redação por modelo. Só entram para o modelo listado; o GLM padrão
// do Moont e os demais modelos recebem o prompt como antes.
//
// GPT-6 Luna (teste de 22/11, 14 gerações reais): o mais fiel ao material, mas
// escreve contra a venda ("considere se o investimento faz sentido"), comenta os
// próprios dados ("o registro não prova o que causou as vendas"), copia notas
// editoriais do material ("padaria fictícia"), usa títulos-rótulo e repete o
// mesmo fato em slides diferentes.
export const LUNA_STYLE_RULES = `
ESTILO DE REDAÇÃO (obrigatório):
- Escreva como o redator da marca, a favor do objetivo do briefing. Apresente a oferta e o próximo passo com confiança. Não aconselhe o público a avaliar, considerar, comparar ou pensar antes de comprar.
- Não comente o material nem os dados. Nunca escreva que um número "não prova", "não mostra", "não permite avaliar" ou "não compara". Use o dado como fato; se ele não sustenta uma conclusão, não tire a conclusão e não fale da ausência dela.
- Notas para quem escreve, como "(fictícia)", "(exemplo)" ou "(rascunho)", nunca entram no texto.
- Título é uma afirmação concreta: benefício, contraste, número ou ação, ligada ao texto do mesmo card. Evite títulos-rótulo, como "A página começa a tomar forma" ou "O que considerar".
- Em história, conte uma sequência com começo, virada e desfecho usando só pessoas, lugares e fatos do material. Não crie personagem, cena, dor, sensação ou resultado que o material não dá.
- Cada fato aparece uma vez no projeto. Preço, parcelas, prazo e lista de modelos ou produtos não voltam em outro card ou slide.
- Texto de apoio curto: no máximo duas frases por card; prefira uma.`;

const MODEL_STYLE_RULES = {
  'gpt-6-luna': LUNA_STYLE_RULES,
};

export const modelStyleRules = model => MODEL_STYLE_RULES[String(model || '')] || '';
