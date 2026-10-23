---
name: moont-content-edit
description: Revisa e edita textos de projetos do Moont com prévia, controle de versão e reversão, sem alterar fotos, logo ou layout.
---

# Edição de conteúdo no Moont

Use `list_projects` para localizar o projeto e `get_project_content` para ler seus textos e os IDs editáveis. Consulte `get_content_schema` antes de montar a alteração. Preserve o idioma, o objetivo, o tom de voz e fatos fornecidos pela pessoa. Não invente preço, prazo, garantia, resultado, estatística ou item incluso.

Edite somente os campos pedidos: nome do projeto, legenda, título, subtítulo, texto após a imagem, orientação de imagem ou texto de uma sobreposição. Fotos, logo, ordem dos cards e ajustes visuais ficam protegidos por este fluxo.

Execute `preview_text_edit` antes de gravar e confira cada trecho anterior e posterior. Se a prévia corresponder ao pedido já autorizado, aplique com `apply_text_edit`. Pergunte apenas quando houver ambiguidade material, mudança de escopo ou inclusão de uma afirmação que não esteja sustentada pelo material. Se o projeto mudar entre a prévia e a aplicação, faça uma nova leitura e uma nova prévia.

Depois de aplicar, informe quantos cards e campos foram alterados. Use `get_batch_status` quando precisar confirmar o estado da operação. Se a pessoa pedir reversão, ou se a aplicação tiver produzido resultado fora do pedido, use `undo_project_change` com o `requestId` retornado.
