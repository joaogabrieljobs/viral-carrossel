# Auditoria 06/11 — remediação e portão de publicação

**Data:** 06/11/2026  
**Escopo:** `Moont-auditoria-completa-0611.pdf`, `Moont-rodada-2-tela-0611.pdf` e revisão adversarial do diff final.

## Resultado

Os achados bloqueadores foram corrigidos antes da publicação. O fluxo de criação preserva o trabalho do usuário, a geração informa progresso e consumo, imagens e referências mantêm integridade entre aparelho, nuvem e equipe, e os caminhos MCP/OAuth passaram por endurecimento de segurança e cobrança.

## Melhorias entregues

- **Criação e material:** limites visíveis por produto; conteúdo acima do limite é preservado e bloqueia a criação com orientação, sem truncamento silencioso ao trocar Apresentação por Carrossel.
- **Geração de texto:** rascunho é preservado se a revisão falhar; recuperação de títulos ganhou orçamento e fallback; idioma segue briefing e instruções; progresso mostra tempo decorrido e nova tentativa.
- **Imagens:** geração paga exige confirmação explícita; importação em lote valida formato e conteúdo; importação manual não cancela texto em andamento; enquadramento e referências persistem; ativos compartilhados são recuperados com autorização de membro.
- **Editor e biblioteca:** miniaturas representam o card real; modais prendem e devolvem foco; Escape funciona; projeto vazio não grava texto-placeholder como conteúdo.
- **Sincronização:** retries transitórios, fila offline e autosave não descartam edições; erros permanentes liberam a biblioteca para revisão.
- **Compartilhamento:** revogação usa tombstone autoritativo e falha fechada; um Blob antigo não pode reabrir uma partilha revogada.
- **MCP e créditos:** requestId valida projeto, versão e cards; reservas concorrentes são idempotentes; falhas devolvem créditos; um reconciliador persistente roda a cada 15 minutos para concluir settlements interrompidos.
- **OAuth:** códigos e refresh tokens ficam vinculados à sessão e à conta; logout revoga sessões sem invalidar integrações legítimas de outra sessão ativa.

## Banco e ordem de rollout

A migração `010_oauth_refresh_security_context.sql` deve entrar **antes** do código. Ela adiciona o contexto de sessão/conta aos códigos e refresh tokens OAuth e os índices correspondentes. A publicação foi preparada com esse portão explícito.

## Verificação

- Unitários: **1.797/1.797** aprovados em 179 arquivos.
- Navegador: **199** aprovados na suíte completa; os 2 cenários que ainda esperavam o CTA antigo foram atualizados para a confirmação de créditos e passaram na repetição dirigida. **13** cenários V2 ficaram pulados por dependerem do ambiente específico.
- Build de produção: aprovado.
- Acessibilidade estática: nenhum botão de ícone sem rótulo.
- `git diff --check`: aprovado.

Os testes não gastam créditos reais nem chamam a geração paga em produção; o pipeline e os estados de cobrança são validados com provedores simulados.
