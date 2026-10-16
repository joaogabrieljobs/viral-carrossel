# Moont no Codex

Este plugin conecta o Codex à sua conta Moont para inspecionar projetos e fazer alterações **visuais** em lote. É possível selecionar um projeto, vários projetos ou a biblioteca inteira, incluindo todos os cards. O plugin percorre as páginas da biblioteca e não impõe limite total de projetos ou cards.

## Instalação local

Na raiz deste repositório:

```sh
codex plugin marketplace add .
codex plugin add moont@moont-local
```

No Moont, abra **Perfil → Integração Codex**, crie um token para a conta e copie-o. Depois execute:

```sh
sh plugins/moont/bin/setup.sh add
```

Cole o token no prompt protegido do Chaves do macOS. O comando não recebe o token como argumento nem o grava no projeto. Reinicie o Codex para carregar o plugin. Para verificar ou remover a credencial local:

```sh
sh plugins/moont/bin/setup.sh status
sh plugins/moont/bin/setup.sh remove
```

Revogue o token também em **Perfil → Integração Codex** quando não quiser mais acesso ao Moont. A credencial é vinculada à conta autenticada e expira conforme indicado nessa página.

## Fluxo de edição

1. `get_visual_schema` mostra os campos permitidos.
2. `list_projects` e `get_project_design` mostram a biblioteca e o visual atual.
3. `preview_visual_batch` seleciona `projectId`, `projectIds` ou `allProjects`, além do patch visual. O resultado inclui um `planId` e um resumo. Nenhum projeto é modificado nesta etapa.
4. `get_batch_preview` pagina detalhes se a prévia cobrir muitos projetos.
5. `apply_visual_batch` recebe somente o `planId`; o plugin usa as versões capturadas na prévia e para se algum projeto mudou. Cada projeto é gravado de forma atômica pelo Moont.
6. `get_batch_status` consulta os IDs das operações. `undo_visual_batch` desfaz uma alteração se o projeto ainda estiver na versão produzida por ela.

Um lote interrompido pode ser retomado: uma prévia parcial retorna `planId`, usado como `resumePlanId` na próxima chamada; uma aplicação parcial conserva o mesmo `planId` e os mesmos IDs idempotentes; uma reversão parcial retorna `undoPlanId`, usado como `resumeUndoPlanId` para prosseguir. Os planos ficam em `PLUGIN_DATA/plans` (ou `~/.local/share/moont-codex/plans` fora do Codex) com acesso restrito ao usuário. Eles guardam apenas metadados e ajustes visuais; o token fica somente no Chaves.

Textos dos cards, fotos, referências de mídia e conteúdo narrativo não são editáveis pelo endpoint deste plugin. A exceção `patch.copyCtaFrom` copia um botão CTA existente de outro card do mesmo projeto, com estilo opcional, sem alterar o card de origem: `{ "copyCtaFrom": { "slideId": "origem", "overlayId": "botao", "style": { "x": 30, "y": 84 } } }`. Quando `patch.brand` é usado, indique `brandScope: "project"`: a marca afeta o projeto inteiro, inclusive cards fora da seleção. Prévia e aplicação usam controle de versão para evitar sobrescrever mudanças feitas em outro aparelho.

## Desenvolvimento

O servidor MCP usa apenas Node.js padrão e o transporte `stdio`; não requer `npm install` próprio. Para validar:

```sh
node --test plugins/moont/test/*.test.mjs
```

O endpoint HTTPS utilizado é `https://viralcarrossel.com.br/api/agent-visual-batch`. As respostas de erro não exibem o token. Requisições são espaçadas abaixo do limite da API; respostas 429 respeitam `Retry-After` e o lote pode ser retomado.
