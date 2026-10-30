# App desktop do Moont (Tauri 2)

Criado em 29/10/2026. A referência foi o desktop da Branddy, com a decisão de
arquitetura validada depois no MUSA.

## Arquitetura

O Moont é uma SPA Vite + React servida pela Vercel, mas usa funções serverless
da mesma implantação para login, assinatura, projetos, imagens e geração. A
casca Tauri carrega diretamente `https://moont.ai` para manter página, APIs,
cookies e retornos de pagamento na mesma origem.

Esta opção elimina:

- servidor HTTP embarcado e porta de loopback;
- CORS específico para desktop;
- Redirect URLs adicionais de autenticação;
- URLs especiais de retorno de checkout;
- endpoint local `/__moont/abrir-login`;
- User-Agent customizado.

O login Google deve ser testado primeiro dentro do WKWebView. Essa abordagem
funcionou de ponta a ponta no MUSA usando a origem de produção; o problema da
Branddy ocorreu com a origem `127.0.0.1`.

```text
desktop/
  app-icon.png                 fonte 1024² do ícone
  package.json                 @tauri-apps/cli 2.12.x
  package-lock.json            instalação congelada pelo portão
  placeholder/index.html       frontendDist formal; não é carregado
  src-tauri/
    tauri.conf.json            Moont · ai.moont.desktop · macOS 11.3+
    Cargo.toml                 Tauri, opener, single-instance e url
    capabilities/default.json nenhuma permissão para a página remota
    src/origem.rs              origem, _blank e nomes de download
    src/lib.rs                 janela, downloads e instância única
scripts/build-desktop.sh       portão de build
tests/unit/desktop-tauri.test.js  invariantes entre os arquivos
```

## Comportamentos da casca

- **Janela principal:** abre `https://moont.ai` em 1440 × 900, com mínimo de
  1024 × 640 e atalhos de zoom.
- **`window.open` e `_blank`:** `about:blank` e `https://moont.ai` permanecem
  no webview. URLs HTTP(S) externas e `mailto:` abrem no navegador do sistema.
  Esquemas desconhecidos são recusados.
- **Login e checkout:** navegação na mesma janela não é interceptada; Google e
  Stripe podem sair e voltar pela própria origem de produção.
- **Downloads:** o WKWebView precisa de `on_download`. O destino é
  `~/Downloads`, sem sobrescrever arquivo existente; ao terminar, o Finder
  revela o arquivo. `DownloadEvent` tem braço `_ => {}` por ser
  `non_exhaustive`.
- **Instância única:** uma segunda abertura apenas restaura e foca a janela já
  aberta.
- **Segurança:** `withGlobalTauri: false`, capability com `permissions: []` e
  CSP `null` na casca. A página recebe os cabeçalhos da produção e nenhuma API
  Tauri fica disponível para JavaScript remoto.
- **User-Agent:** padrão do WKWebView. Não há marca `MoontDesktop`, porque UAs
  customizados podem ser recusados pelo Google.

## Portão de build

Na raiz do projeto:

```bash
npm run desktop:check
npm run desktop:build
npm run desktop:dev
```

O portão:

1. recusa alterações não commitadas em `desktop/`, no script e no teste de
   invariantes. `MOONT_DESKTOP_PERMITIR_SUJO=1` serve apenas para diagnóstico e
   grava `sujo: true`;
2. procura padrões de segredo no crate e confere origem, placeholder e
   capability vazia;
3. grava `resources/version.json` **antes** dos testes, com commit, branch,
   data, versão, canal `desktop`, origem e indicador de árvore suja;
4. executa a suíte Vitest completa e `cargo test`;
5. instala a CLI com `npm ci` e executa `tauri build`.

`build.rs` cria um `version.json` de desenvolvimento marcado como sujo quando
o arquivo ainda não existe. Isso permite `cargo test` num clone limpo, pois
`tauri-build` valida `bundle.resources` durante a compilação.

Em worktree isolado, podem ser ligados `node_modules` e `.env.local` do
checkout principal. `CARGO_TARGET_DIR` pode apontar para o target principal
para reaproveitar a compilação Rust.

## Saída e primeiro uso

O build cria:

```text
desktop/src-tauri/target/release/bundle/macos/Moont.app
desktop/src-tauri/target/release/bundle/dmg/Moont_<versão>_aarch64.dmg
```

Sem Developer ID, a assinatura é ad hoc. No primeiro uso: clique com o botão
direito no aplicativo e escolha **Abrir**. Para distribuição sem esse passo,
faltam certificado Developer ID Application e notarização da Apple.

## Verificação

### Provado pelo desenvolvimento

- invariantes de origem, ausência de loopback, capability vazia, CSP, versão,
  `on_new_window`, `on_download` e single-instance;
- testes puros de classificação de URLs, nome seguro e destino numerado;
- suíte do projeto, `cargo test`, build `.app`/`.dmg`, conteúdo do Info.plist,
  assinatura e ausência de padrões de segredo;
- abertura do aplicativo, processo único e carregamento de rede da produção.

Os itens acima devem ser atualizados com o resultado real de cada build, sem
registrar como provado algo que tenha sido apenas revisado no código.

### A confirmar pelo dono dentro do aplicativo

- login Google completo e retorno ao projeto;
- exportação/download de PNG, ZIP e PDF;
- checkout e retorno de pagamento;
- abertura de link externo no navegador do sistema.

O aplicativo precisa ser aberto uma vez antes de o macOS poder associar a ele
permissões de captura de tela. A captura pode pedir **Gravação de Tela** e a
automação pode pedir **Acessibilidade**.

## Pendências de distribuição

1. Assinar e notarizar com Developer ID.
2. Gerar instalador Windows numa máquina Windows ou CI.
3. Definir atualização automática da casca; o conteúdo web já acompanha a
   produção sem nova instalação.

