---
name: moont-slide-images
description: Gera imagens para cards do Moont a partir da imageQuery salva, com crédito do plano, controle de versão e acompanhamento do job.
---

# Imagens de cards no Moont

Leia o projeto com `get_project_content` e localize os cards com `hasPhoto: false`. A imagem nasce da `imageQuery` gravada em cada card; se a direção estiver vazia, fraca ou fora do briefing, corrija primeiro com `preview_text_edit` e `apply_text_edit`. Não existe campo de prompt na geração.

Antes de chamar `generate_slide_image`, diga à pessoa quantos cards serão gerados e que cada um consome 1 crédito de imagem do plano, e espere um sim explícito. Use a `baseVersion` lida imediatamente antes e um `requestId` novo. Sem `slideIds`, a ferramenta atende todos os cards sem foto, até 8 por chamada.

A resposta vem com `status: "pending"`. Aguarde cerca de 30 segundos e consulte `get_batch_status({ requestIds })` (ou `get_change_status` no MCP hospedado) até o job sair de `pending`. Não repita a chamada de geração com outro `requestId` enquanto o job estiver pendente; repetir com o mesmo `requestId` apenas devolve o estado atual.

Ao concluir, relate por card o resultado (`done` ou `failed` com o código) e a nova `afterVersion`. Créditos de cards que falharam são devolvidos. Se a resposta for `project_conflict`, releia o projeto e refaça a chamada; se for `quota_exhausted`, informe `needed` e `remaining` e não insista. Se a pessoa não gostar de uma imagem, ajuste a `imageQuery` e gere de novo só aquele card; `undo_project_change` desfaz o job inteiro enquanto o projeto estiver na versão produzida por ele.
