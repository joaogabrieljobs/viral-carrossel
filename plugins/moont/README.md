# Moont no Codex

Este plugin conecta o Codex à sua conta Moont para inspecionar projetos, fazer alterações **visuais** em lote e revisar **textos** com prévia. É possível selecionar um projeto, vários projetos ou a biblioteca inteira para ajustes visuais. Edições de conteúdo são aplicadas a um projeto por vez para facilitar a revisão.

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

## Instalação sem ficar dentro do app

A pasta `plugins/moont` é o plugin. No Codex, adicione o marketplace a partir do diretório que contém `.codex-plugin` (a raiz deste repositório, ou uma cópia só da pasta do plugin se ela estiver empacotada com o manifesto). A chave não depende do código do app:

```sh
export MOONT_TOKEN="cole-a-chave-criada-em-Perfil"
```

No macOS, `sh plugins/moont/bin/setup.sh add` grava a mesma chave no Chaves. Em Linux ou Windows, `MOONT_TOKEN` é o caminho. Sem a variável e sem o Chaves, o plugin explica como conectar em vez de exigir um Mac.

## Fluxo de edição

1. `get_visual_schema` mostra os campos permitidos.
2. `list_projects` e `get_project_design` mostram a biblioteca e o visual atual.
3. `preview_visual_batch` seleciona `projectId`, `projectIds` ou `allProjects`, além do patch visual. O resultado inclui um `planId` e um resumo. Nenhum projeto é modificado nesta etapa.
4. `get_batch_preview` pagina detalhes se a prévia cobrir muitos projetos.
5. `apply_visual_batch` recebe somente o `planId`; o plugin usa as versões capturadas na prévia e para se algum projeto mudou. Cada projeto é gravado de forma atômica pelo Moont.
6. `get_batch_status` consulta os IDs das operações. `undo_visual_batch` desfaz uma alteração se o projeto ainda estiver na versão produzida por ela.

### Edição de conteúdo

1. `get_project_content` lê textos e IDs editáveis sem transportar as fotos.
2. `get_content_schema` informa os campos e limites aceitos.
3. `preview_text_edit` mostra cada alteração antes/depois sem gravar.
4. `apply_text_edit` aplica exatamente a prévia, com controle de versão e ID idempotente.
5. `undo_project_change` reverte alterações textuais ou visuais enquanto o projeto ainda estiver na versão produzida pelo MCP.

Um lote interrompido pode ser retomado: uma prévia parcial retorna `planId`, usado como `resumePlanId` na próxima chamada; uma aplicação parcial conserva o mesmo `planId` e os mesmos IDs idempotentes; uma reversão parcial retorna `undoPlanId`, usado como `resumeUndoPlanId` para prosseguir. Os planos ficam em `PLUGIN_DATA/plans` (ou `~/.local/share/moont-codex/plans` fora do Codex) com acesso restrito ao usuário. Eles guardam apenas metadados e ajustes visuais; o token fica somente no Chaves.

Fotos, logos e referências de mídia permanecem protegidos contra escrita. O conteúdo editável inclui nome e legenda do projeto, título, subtítulo, texto inferior, legenda e direção de imagem de cada card, além do texto de áreas adicionais. `patch.copyCtaFrom` continua copiando um botão CTA existente de outro card do mesmo projeto, com estilo opcional, sem alterar o card de origem. Quando `patch.brand` é usado, indique `brandScope: "project"`: a marca afeta o projeto inteiro, inclusive cards fora da seleção. Toda prévia e aplicação usa controle de versão para evitar sobrescrever mudanças feitas em outro aparelho.

O ajuste visual `{ "procedureLabelEmphasis": true }` destaca o rótulo inicial em maiúsculas do subtítulo apenas nos cards selecionados, mantendo o texto salvo e a edição intactos. Novos cards começam com esse ajuste desligado.

## Desenvolvimento

O servidor MCP usa apenas Node.js padrão e o transporte `stdio`; não requer `npm install` próprio. Para validar:

```sh
node --test plugins/moont/test/*.test.mjs
```

O endpoint HTTPS utilizado é `https://moont.ai/api/agent-visual-batch`. O serviço do Chaves do macOS conserva o identificador anterior para não perder a credencial já instalada. As respostas de erro não exibem o token. Requisições são espaçadas abaixo do limite da API; respostas 429 respeitam `Retry-After` e o lote pode ser retomado.
