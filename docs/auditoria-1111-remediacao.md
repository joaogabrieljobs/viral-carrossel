# Auditoria completa 11/11 — remediação

**Data da correção:** 12/11/2026  
**Base auditada:** `576b6e3`  
**Ramo de correção:** `codex/fix-fluxos-0811`

## Resultado

Os achados de fluxo F1–F10 e os achados novos N1–N13 foram reavaliados contra o código, não apenas contra o patch proposto. Os controles que podiam ser fechados com segurança receberam implementação e regressão automatizada. Quatro provas permanecem marcadas como falha esperada para impedir que F2 e F3 sejam esquecidos ou declarados resolvidos sem uma trilha durável do asset gerado.

## Fechados

### Fluxos F

- **F1 — crons na Vercel:** todo o prefixo `/api/cron/` passa pelo middleware sem redirecionamento; cada função continua responsável por validar `CRON_SECRET`.
- **F4 — espera de imagem SJinn:** polling usa prazo real de até 240 segundos e tolera até duas falhas consecutivas de consulta antes de propagar a terceira.
- **F5 — assinatura recuperável:** `past_due`, `unpaid` e `incomplete` levam à fatura ou ao portal; assinaturas canceladas/expiradas podem iniciar checkout novo.
- **F6 — produto Stripe:** uma assinatura só libera o Moont quando pertence explicitamente ao produto, a um preço conhecido ou ao formato legado com `metadata.tier` válido.
- **F7 — concorrência na geração por agente:** a imagem é aplicada card a card sobre a versão atual; edição em outro card é preservada, foto nova do usuário não é sobrescrita e Desfazer remove apenas a imagem daquele job.
- **F8 — presets e hooks:** padrões visuais personalizados e biblioteca de hooks passam a integrar o cofre local durável e os metadados sincronizados da conta.
- **F9 — pesquisa de nicho:** execução single-flight, cancelamento no fechamento/desmonte e entrada limitada a 200 caracteres.
- **F10 — idempotência de webhook:** eventos Stripe ganham trilha mínima, sem payload bruto/PII, com `event_id` único e resposta segura para reentregas.
- **Concorrência de checkout (revisão):** criação de customer e sessão usa chaves idempotentes por produto/conta/plano; sessão aberta é reutilizada e a prova provisória sobrevive a falha intermediária por até 24 horas.

### Achados N

- **N1 — colisão de operação de imagem:** o editor recusa IDs reservados `mcp_`; o agente não reaproveita reserva que não prove pertencer ao próprio job.
- **N2 — crescimento sem teto:** IDs usam a mesma validação em rotas nova e legada; a conta tem limites configuráveis de projetos/bytes e a fila do agente é podada.
- **N3 — convite em token de leitura:** `projects:read` não recebe `shareCode`/`shareUrl`; esses campos só aparecem para credencial com `projects:write`.
- **N4 — rate limit degradado:** rotas públicas sensíveis falham fechadas em produção quando o contador compartilhado está ausente ou indisponível.
- **N5 — checkout abandonado:** cliente sem senha e sem assinatura pode retomar checkout com identidade comprovada, sem ficar preso a uma senha inexistente.
- **N6 — cadastros simultâneos:** criação recebe chave determinística por e-mail e persistência compare-and-set, evitando duas contas para a mesma corrida.
- **N7 — código de convite no analytics:** links com `?share=` não carregam Plausible.
- **N9 — acúmulo OAuth:** rotação mantém uma conexão ativa por cliente, a listagem não cresce sem limite e o cron remove tokens antigos.
- **N9 — identidade e atomicidade OAuth (revisão):** conexões são isoladas por `client_id`, não pelo nome; rotação ocorre numa única transação e falha transitória responde `temporarily_unavailable` sem consumir o refresh válido.
- **N11 — computador compartilhado:** nova ação **Sair e apagar deste aparelho** exige salvamento confirmado e remove projetos, fotos, vídeos e cofre locais; o logout comum continua preservando o trabalho.
- **N13 — mídia no Desfazer:** snapshots preservam campos `data:`/`blob:`; desfazer uma edição do agente não apaga logo ou mídia incorporada.
- **Jobs do agente (revisão):** jobs `pending` nunca entram na poda; o 501º job ativo é recusado; prompt e referências do card recebem fingerprint para que uma imagem antiga não vença uma direção editada durante a geração.
- **Sincronização de presets (revisão):** conflitos de metadados releem a nuvem e mesclam hooks/presets por ID e data; mudanças incompatíveis continuam como conflito em vez de sobrescrita silenciosa.
- **Limpeza do aparelho (revisão):** uma limpeza destrutiva interrompida conserva o modo `device-wipe`, repete a exclusão no próximo boot e só libera o acesso quando cofre, fotos e vídeos forem confirmados como removidos.

## Parciais e abertos

- **F2 e F3 — asset pago sem persistência/reconciliação:** continuam abertos. Há quatro regressões `it.fails` documentando os caminhos. O fechamento correto exige persistir o asset antes de liquidar/reconciliar o crédito; não foi aplicada uma devolução automática que pudesse entregar imagem sem cobrança.
- **N8 — CSP:** scripts inline foram externalizados e `script-src 'unsafe-inline'` foi removido. O Plausible ainda é terceiro sem SRI ou proxy próprio.
- **N10 — assinatura de assets:** upload usa lista fechada de MIME e confere os bytes; SVG, conteúdo forjado e MIME divergente são recusados. Falta armazenar um descritor de extensão para eliminar as tentativas múltiplas na leitura de assets legados.
- **N12 — domínio antigo:** retirada de `viralcarrossel.com.br` depende da data definida pelo dono e da limpeza coordenada no Google, Stripe e CORS.

## Decisões antes de produção

1. Confirmar que assinaturas `past_due` e `unpaid` devem abrir o portal, sem período de graça, e que `paused` continua sem acesso.
2. Definir a data de aposentadoria do domínio antigo.
3. Aplicar as migrações pendentes **antes** do código, nesta ordem:
   - `db/migrations/011_image_quota_metadata.sql`;
   - `db/migrations/012_billing_events.sql`;
   - `db/migrations/013_oauth_connection_identity.sql`.

A migração 012 cria `moont.billing_events`, ativa RLS, revoga acesso público e guarda apenas metadados operacionais necessários à idempotência. Se a persistência do evento falhar, o webhook responde `503`, permitindo a reentrega do Stripe em vez de confirmar processamento sem trilha. A migração 013 liga cada credencial do agente ao `oauth_client_id`; ela é obrigatória antes do código porque toda nova chave passa a referenciar essa coluna.

## Verificação local

- Vitest completo: **2.052 testes aprovados** em **198 arquivos**.
- Regressões conhecidas: **4 falhas esperadas** (`it.fails`) para F2/F3.
- Build de produção: aprovado.
- Acessibilidade estática: aprovado, sem botões de ícone puro sem nome acessível.
- Recorte Playwright de cobrança, uso da conta, partilha, presets, painéis de IA e modais: **30/30 aprovado**.
- `git diff --check`: aprovado.
- Banco real: **não alterado e não validado nesta correção**. As migrações 011–013 precisam de backup, aplicação controlada e smoke do papel de produção antes do deploy.

## Ordem segura de publicação

1. Fazer backup e aplicar 011, 012 e 013 no Supabase de produção.
2. Confirmar a existência das tabelas/colunas e os grants esperados.
3. Publicar o código.
4. Executar smoke de login, checkout, webhook duplicado, geração de imagem, logout comum e **Sair e apagar deste aparelho**.
5. Acompanhar `503`, falhas de rate limit e reentregas Stripe durante a primeira janela de produção.

