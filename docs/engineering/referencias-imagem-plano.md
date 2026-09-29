# Referências do projeto nas imagens do plano

28/09/2026. Complemento à revisão `docs/revisao-style-kit-musa.md`.

## Problema e contrato

SJinn recebe referências por URL, mas o projeto guarda os arquivos no IndexedDB do navegador. O plano precisa transformar até quatro anexos em URLs temporárias, preservando ordem, direção visual e override da referência do card. Não há mudança de fornecedor, preço ou regra de quota.

- Navegador envia `imageList` com HTTPS e/ou data URLs PNG/JPEG/WebP para o endpoint existente. Cópias acima de 700 KiB são reduzidas somente para o transporte. Os originais ficam intactos.
- Servidor valida quantidade, tamanho, base64 e assinatura de arquivo antes de reservar o crédito. Quatro anexos no limite ocupam menos de 4 MB codificados.
- Sessão, plano e quota continuam sendo verificados antes de upload. Falha posterior usa o reembolso já existente.
- Arquivos são enviados ao Vercel Blob **privado**. Nomes aleatórios, sem nome/email do usuário. O servidor cria uma URL assinada de GET válida por 15 minutos, restrita a cada arquivo. Chaves e URLs assinadas não voltam na resposta do navegador.
- Só após todos os uploads concluírem o servidor inicia uma tarefa SJinn. O provedor recebe `image_list` na ordem original.
- Limpeza após sucesso/erro e também após upload parcial. Uma falha de limpeza não descarta uma imagem entregue. A rotina diária remove sobras com mais de uma hora, limitadas ao prefixo `image-references/temporary/`, com paginação e autenticação `CRON_SECRET`. Limite de 5.000 arquivos examinados por execução; backlog restante aparece como `hasMore`.
- URLs expiradas não permitem novas leituras. Cópias órfãs permanecem privadas até a limpeza (normalmente na próxima execução diária; falhas/backlog podem prolongar a retenção). Os arquivos enviados ao fornecedor seguem também a política dele; a limpeza local não apaga eventuais cópias do fornecedor.

## Infraestrutura

SDK `@vercel/blob` 2.8.0. Store privada conectada ao projeto Vercel. Credencial apenas no servidor: `BLOB_READ_WRITE_TOKEN` ou `BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`. `CRON_SECRET` exclusivo para limpeza, sem prefixo `VITE_`. `vercel.json` agenda `/api/cron/cleanup-image-references` diariamente às 04:00 UTC. Não há upload público nem chave do Blob no bundle. A rota de limpeza é a única exceção ao redirecionamento de hosts técnicos: cron da Vercel não segue redirects, e a própria função valida o segredo. [Documentação de cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-jobs-and-redirects).

O armazenamento e as operações usam a cobrança normal do Vercel Blob; não foi implementada compra de pacote nem alteração do plano do cliente. URLs HTTPS já existentes continuam passando sem cópia no Blob. Não existe fallback silencioso para geração sem referências.

## Validação

1. Testes: quatro anexos; misto HTTPS/local; limite/arquivo inválido; autorização; upload parcial; falha SJinn; reembolso; limpeza segura/paginada; sem armazenamento configurado.
2. Navegador: upload no kit → três cards → três chamadas de imagem contendo os anexos e o estilo atuais.
3. Smoke real de armazenamento: gravar imagem sintética, verificar acesso anônimo recusado, GET assinado válido e exclusão. Separado de testes automáticos, que usam serviços simulados.
4. Build e suíte completa antes da publicação.

Fontes: [SJinn GPT Image 2](https://sjinn.ai/docs/api/tool/gpt-image-2), [Vercel Signed URLs](https://vercel.com/docs/vercel-blob/vercel-signed-urls), [SDK Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk). As assinaturas foram conferidas também nos tipos do SDK instalado.

Resultado local: 313 testes unitários/de integração; 56 cenários E2E cobertos entre rodada ampla e repetição focada (respostas de IA simuladas). Smoke Blob real passou; referências removidas, store vazia. Geração SJinn autorizada pelo usuário, mas pendente de executar no servidor: chave local recusada, segredo de produção não exportável. Não houve publicação nesta revisão.
