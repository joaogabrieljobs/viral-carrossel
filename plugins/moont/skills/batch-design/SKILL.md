---
name: moont-batch-design
description: Ajusta o layout de muitos cards e projetos no Moont sem alterar textos ou fotos, com prévia e possibilidade de reversão.
---

# Edição visual em lote no Moont

Use as ferramentas do MCP Moont para ler o projeto e a lista de campos visuais permitidos. Preserve os textos, a ordem dos cards, fotos e referências de mídia. Descreva o resultado desejado em campos visuais específicos, sem inventar uma alteração narrativa. Quando a pessoa pedir explicitamente para repetir um botão existente, `copyCtaFrom` pode copiar apenas o CTA de origem para os cards selecionados; revise o texto e o estilo da origem antes da prévia.

Antes de gravar, execute `preview_visual_batch`. Examine o total de cards afetados e consulte `get_batch_preview` nas páginas seguintes quando necessário. Mostre esse resumo — quantos projetos e cards mudam — e espere um sim explícito antes de `apply_visual_batch`. Se a prévia atingir mais de um projeto, ou a biblioteca inteira, esse sim é obrigatório mesmo que o pedido inicial já fale em editar. Não aplique só porque a tarefa parece autorizada. Não limite artificialmente a quantidade de cards ou projetos solicitados.

Se houver conflito de versão, faça nova leitura e nova prévia; não force uma versão anterior. Se um lote longo for interrompido, retome a prévia com `resumePlanId` ou repita `apply_visual_batch` com o mesmo `planId`. Use `get_batch_status` para acompanhar e `undo_visual_batch` quando a pessoa pedir reversão ou quando uma correção exigir voltar ao estado anterior. Uma reversão parcial pode ser retomada com `resumeUndoPlanId`. Relate quantos projetos e cards foram alterados, e qualquer item que tenha falhado.
