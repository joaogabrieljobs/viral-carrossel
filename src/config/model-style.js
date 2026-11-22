// Regras de redação por modelo. Só entram para o modelo listado; o GLM padrão
// do Moont e os demais modelos recebem o prompt como antes.
//
// GPT-6 Luna (teste de 22/11, 14 gerações reais): o mais fiel ao material, mas
// escreve contra a venda ("considere se o investimento faz sentido"), comenta os
// próprios dados ("o registro não prova o que causou as vendas"), copia notas
// editoriais do material ("padaria fictícia"), usa títulos-rótulo e repete o
// mesmo fato em slides diferentes. Texto do catálogo final de 22/11 (C09): as
// correções valem sem proibir comparação pedida pelo usuário nem esconder
// condição ou pendência que muda a decisão.
export const LUNA_STYLE_RULES = `
ESTILO DE REDAÇÃO:
- Escreva diretamente para o público, a favor do objetivo declarado no briefing: vender, ensinar, informar, analisar ou defender uma ideia. Em uma oferta, apresente o valor sustentado e inclua o próximo passo quando o pedido o comportar, sem inserir aconselhamento genérico de compra nem impedir comparações ou critérios que o usuário tenha solicitado.
- Não comente o arquivo, o processo de geração ou a ausência irrelevante de dados. Use cada dado apenas para a afirmação que ele sustenta; preserve qualificadores, condições e limitações que alterem sua interpretação ou a decisão. Não tire conclusões causais sem suporte nem esconda uma pendência essencial. Registre lacunas editoriais nos campos internos previstos pelo contrato, sem criar campos extras ou conteúdo de preenchimento.
- Notas de produção, como marca fictícia ou rascunho, não entram automaticamente na capa nem qualificam o nome da marca. Se um caso, exemplo, depoimento, dado ou resultado simulado puder parecer evidência real, identifique seu caráter ilustrativo junto ao conteúdo pertinente; não apresente simulação como realização.
- Faça títulos específicos e ligados ao conteúdo da página: afirmação sustentada, ação ou pergunta que será respondida. Evite títulos-rótulo vazios; benefício, contraste e número só quando apoiados no material.
- Em história, use somente pessoas, lugares, ações e sequência fornecidos. Preserve o que é previsto e o que ocorreu; não crie personagem, cena, dor, sensação, causa, virada ou resultado para completar o arco. Material insuficiente não autoriza falsa história nem uma lista de oferta disfarçada de narrativa.
- Dê a cada fato uma página principal. Preço, parcelas, prazo e listas de produtos não devem reaparecer como conteúdo de outra página; abertura, síntese ou CTA podem retomar apenas o mínimo indispensável à compreensão ou à ação, sem recontar o desenvolvimento nem acrescentar condições.
- No carrossel, prefira apoio de uma frase e limite a duas quando isso preservar as informações essenciais e for compatível com o layout. Em apresentações, siga o uso, a densidade e os limites próprios do deck. Em ambos, mantenha o idioma, o CTA e as restrições do pedido; não suprima condições para caber.`;

const MODEL_STYLE_RULES = {
  'gpt-6-luna': LUNA_STYLE_RULES,
};

export const modelStyleRules = model => MODEL_STYLE_RULES[String(model || '')] || '';
