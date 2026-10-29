# Sync de biblioteca na nuvem (multiutilizador)

Atualizado em 2026-10-13.

## Promessa

Cada conta autenticada (Stripe `customerId`) tem a sua biblioteca na nuvem. Login / logout / botão **Sync na nuvem** mantêm projetos entre browsers do mesmo utilizador. Contas diferentes nunca partilham o mesmo slot.

O compartilhamento de equipe não mistura esses slots. O registro do link mantém o documento e a origem dos assets citados na revisão. `/api/project-share?code=…&asset=…` só entrega um asset que esteja referenciado nessa revisão e busca seus bytes na conta que publicou a imagem. A conta convidada importa a foto para o armazenamento local e, no salvamento seguinte, envia uma cópia para o próprio namespace. `/api/library-sync?asset=…` continua restrito à conta autenticada.

## API

- `GET /api/library-sync` — meta
- `GET /api/library-sync?full=1` — manifesto
- `GET /api/library-sync?asset={id}` — asset
- `POST /api/library-sync` — `{ action: 'status' | 'putAsset' | 'push' }`

Auth: `requireActiveSubscription` (cookie `vc_access`).

## Storage

- Blob: `library-sync/{customerId}/manifest.json` e `.../assets/{assetId}`
- Redis: manifesto de fallback `vc:library-sync:meta:{customerId}:full` e meta `vc:library-sync:meta:{customerId}`
- Memória só em test/dev

Status e download escolhem o mesmo manifesto completo, pela maior revisão e data, entre Blob e Redis. Metadados isolados não comprovam que a biblioteca está disponível. Se uma leitura falhar ou a meta indicar uma versão posterior ao manifesto disponível, a API responde 503 e impede um push de sobrescrever projetos com uma lista incompleta.

### Biblioteca diretamente no Blob

`LIBRARY_SYNC_STORAGE=blob` define o Blob como armazenamento exclusivo da biblioteca. Status, pull e merge usam o mesmo manifesto privado; nenhum acesso ao Redis é feito pela biblioteca. As variáveis Redis continuam disponíveis para outros recursos. Falhas do Blob continuam sendo erros: não existe fallback silencioso para Redis nem sucesso sem gravação.

Essa escolha é explícita, não uma reação automática a indisponibilidade. Em instalações que já gravaram bibliotecas no Redis, reconciliar/exportar suas revisões antes de trocar de modo. Não remover dados antigos do Redis ao mudar a configuração.

Para implantação gradual, `LIBRARY_SYNC_BLOB_OWNERS` limita o modo Blob aos IDs de conta verificados (separados por vírgula). As demais contas continuam consultando ambas as fontes. Em produção, a mudança foi limitada à conta auditada. Não foi possível verificar dados eventualmente exclusivos do Redis indisponível; eles permanecem intactos, e uma futura reativação exige reconciliação por ID com o Blob atualizado.

Na investigação de produção de 13/10, a leitura direta do Blob confirmou nove projetos (revisão 137) na conta afetada. O bloqueio vinha do Redis configurado no servidor, cujo endereço falhava com `ENOTFOUND`. A biblioteca passa a usar diretamente o Blob já verificado, preservando o manifesto e os dados locais durante o merge. Os dados e a configuração global do Redis não são apagados.

## Cliente

`src/utils/library-sync.js` — pack (compacta imagens), upload de assets, push/pull, `reconcileLibraryCloud` no boot (`useAccess`).

## Fluxo de Salvar e Sync

1. Grava a edição atual no navegador, cancelando o autosave pendente; salva o cofre da conta.
2. Envia a estrutura. O servidor une projetos por `id`; vence o `updatedAt` mais recente. Exclusões usam `deletedIds` explícitos.
3. Envia as imagens disponíveis, com tentativa adicional. `assetIds` são referências, não recibos de upload: uma referência órfã não deve impedir o reenvio.
4. Baixa o manifesto completo e confirma sua revisão/contagem contra a resposta do push. Uma resposta mais antiga ou com contagem incompatível não substitui a lista local.
5. Hidrata fotos quando disponíveis. Erro de imagem, inclusive 404, preserva textos, projetos e referências para uma tentativa futura.
6. Verifica se a conta e o conteúdo local continuam iguais. Uma edição durante a requisição é preservada e pede um novo Salvar.
7. Grava a biblioteca e confere os IDs efetivamente persistidos. Falha de armazenamento local não gera sucesso; tenta reverter as chaves alteradas.
8. Trava a persistência e devolve um `snapshot` para o React. O aplicativo atualiza lista, pastas, marcas e documento aberto com `flushSync`, libera a trava e só então informa a contagem exibida.

Não há reload atrasado no fluxo manual. `pagehide` e autosave respeitam a trava. O boot só libera edição/persistência depois de isolar a conta e concluir a tentativa de restauração; o documento de exemplo inicial não é enviado antes disso.

Login pelo formulário passa pela mesma reconciliação do login Google. Logout faz flush, salva o cofre, trava as gravações, tenta um push com cancelamento em até 5 segundos e limpa o navegador. Esse push não executa pull nem regrava metadados locais enquanto a conta está sendo encerrada.

## Diagnóstico da falha de outubro de 2026

- O pull alterava `localStorage`, mas o estado React ainda continha 1–2 projetos. Autosave e `pagehide` podiam sobrescrever a lista restaurada antes do reload atrasado.
- Havia caminhos de login que não aplicavam a biblioteca restaurada à interface.
- A resposta de status podia usar meta do Redis mais recente que o manifesto lido do Blob, produzindo contagens diferentes.
- Falha de leitura no servidor podia ser interpretada como biblioteca vazia, tornando o merge inseguro.
- A gravação local não era conferida antes de informar sucesso.
- A tentativa de deploy `80bac9f` falhou por duas declarações de `reloadAfterCloudSync`. A produção permaneceu em `6144f17`, sem a correção posterior para fotos ausentes.

## Validação manual

Use uma conta de teste com cinco projetos na nuvem, incluindo um que tenha uma foto indisponível.

1. Faça hard refresh e abra a Home. A lista deve exibir os cinco nomes; a foto ausente não deve esconder seu projeto.
2. Clique **Sync na nuvem**. Conte os cinco cards da Home/biblioteca e confira a mesma contagem na mensagem. A página não deve precisar recarregar.
3. Abra um projeto, altere um título e clique **Salvar** imediatamente. Volte à Home e confirme cinco projetos. Recarregue e confira o título.
4. Saia da conta e entre novamente. Os cinco projetos e textos devem voltar.
5. Entre na mesma conta em outro navegador, sem cofre/localStorage prévio. Confira os cinco projetos e abra o projeto cuja foto está ausente.
6. Com o navegador offline ou armazenamento recusado, confirme que não há mensagem de sincronização concluída e que os projetos locais continuam disponíveis.

## Testes de regressão

- Unitários: `library-sync-client`, `library-sync-store`, `account-data-owner`, `account-vault`, `clear-account-data` e `library-organizer`.
- Navegador: `tests/e2e/library-cloud-sync.spec.js` usa o build real com API simulada e cinco projetos; cobre boot, Sync, Salvar imediato, refresh/pagehide, imagem 404, logout/login, login pelo formulário e falha de armazenamento.
- A simulação não valida credenciais nem a disponibilidade do Blob/Redis de produção. Confirmar o deploy **Ready** do commit publicado antes da validação na conta real.

## Fora de escopo (v1)

- Colaboração em tempo real
- Sync de chaves BYOK
- Merge slide-a-slide (a versão do projeto com maior `updatedAt` vence)
- Edição simultânea em vários dispositivos com transação/CAS entre escritores
