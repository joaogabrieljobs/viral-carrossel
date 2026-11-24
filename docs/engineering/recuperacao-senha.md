# Recuperação de senha

Implementação e publicação em 28/09/2026, commit `450e84d`, com o domínio `viralcarrossel.com.br` verificado no Resend. Desde 23/11/2026 o envio sai por `moont.ai` e o domínio antigo só redireciona. O envio real autorizado foi aceito pelo serviço de e-mail. Isso não confirma chegada à caixa postal; a senha do usuário não foi alterada no teste.

## Experiência

- Login e cadastro têm botão **Mostrar/Ocultar** fora do campo, com texto e ícone de alto contraste mesmo com autofill claro.
- **Esqueci minha senha** mantém o e-mail preenchido e pede o envio de um link.
- O link abre `/redefinir-senha#token=...`, mesmo para quem já dispensou a landing. O fragmento é removido do endereço e mantido somente na memória da página; recarregar permite solicitar outro link.
- Nova senha de 8 a 128 caracteres, confirmação obrigatória, estados de erro, sucesso e link expirado. Depois da troca, o usuário entra normalmente.

## Configuração para produção

1. No Resend, verificar um domínio de envio controlado pelo projeto e configurar os registros DNS solicitados.
2. Na Vercel, neste projeto, definir **RESEND_API_KEY** como segredo de servidor com permissão de envio e **AUTH_EMAIL_FROM** como `Moont <nao-responda@moont.ai>` (em produção desde 23/11/2026; a chave do Resend precisa ter permissão de envio para o domínio moont.ai). Não usar prefixo `VITE_` nem colocar a chave no chat/repositório.
3. Configurar `APP_URL=https://moont.ai`; manter `STRIPE_SECRET_KEY` e `ACCESS_COOKIE_SECRET`. Sem qualquer uma das quatro (`STRIPE_SECRET_KEY`, `ACCESS_COOKIE_SECRET`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`) a recuperação responde indisponível.
4. Publicar e solicitar um link para uma conta de teste controlada. Confirmar recebimento (inclusive spam), redefinição, login novo, rejeição da senha antiga e do link usado. Não alterar senha de cliente durante smoke tests.

Sem essas configurações, o endpoint responde indisponibilidade explícita; a UI não diz que enviou. Os testes automatizados usam credenciais sintéticas e Resend simulado. O smoke de envio em produção foi feito separadamente, com autorização, sem consumir o link para alterar a senha.

## Contratos e segurança

- `POST /api/auth/forgot-password`, JSON `{email}`. Resposta genérica igual para conta existente/inexistente. Consulta e envio acontecem com `waitUntil` da Vercel após a resposta, para não revelar a existência da conta por tempo de resposta. Erros de entrega ficam nos logs sem e-mail, chave ou token; aceitação do pedido não confirma entrega na caixa postal.
- Limite por IP de 5 pedidos/15 minutos (`api/auth/forgot-password.js`). Com `RATE_LIMIT_BACKEND=postgres` (produção) o contador é um só para todas as funções. A rota usa `failClosed`: em produção, se o contador partilhado não responder, o pedido é recusado com 503 em vez de contar por instância. O contador em memória, por instância, só vale em desenvolvimento e teste. A chave de idempotência do Resend reduz reenvios para a mesma conta a uma mensagem por janela de 3 minutos, inclusive entre instâncias. Pode haver dois envios próximos na fronteira entre janelas.
- `POST /api/auth/reset-password`, JSON `{token,password,confirmPassword}`. 200 após salvar; 400 para link inválido/expirado/usado ou senha inválida; 503 para falha temporária de infraestrutura. Nunca retorna a senha ou autentica automaticamente.
- Token com HMAC SHA-256, domínio criptográfico `password-reset:v1`, nonce aleatório de 256 bits, finalidade, expiração e vínculo à versão da senha/e-mail da conta. Não é cookie de acesso. Trocar senha ou e-mail invalida todos os links emitidos anteriormente. Rotacionar `ACCESS_COOKIE_SECRET` também invalida os links.
- Com `ACCOUNT_IDENTITY_BACKEND=postgres` (produção), a senha nova é gravada em `moont.account_password_credentials` numa transação que confere o hash e a versão de identidade esperados (`api/lib/account-identity-postgres.js`, `setAccountPassword`). Duas submissões concorrentes do mesmo link não passam as duas: a segunda encontra a credencial mudada e recebe link inválido. A mesma transação troca `identity_epoch` e `agent_epoch` e grava `session_revoked_before` em `moont.accounts`. Nada é escrito no Stripe.
- A revogação de sessão vale na consulta de sessão, portal e recursos protegidos: `readCurrentAccessCookie` (`api/lib/access.js`) lê a conta no Postgres em cada requisição autenticada e recusa cookie com versão de identidade diferente ou emitido antes de `session_revoked_before`. Não há cache que adie a revogação. Cookies antigos sem `iatMs` usam `iat` em segundos.
- Sem a flag vale o caminho antigo: a senha e os campos `vc_session_revoked_before`, `vc_identity_epoch` e `vc_agent_epoch` ficam no metadata do cliente Stripe, a atualização usa uma chave de idempotência por versão da senha e a verificação consulta o cliente Stripe em cada requisição. Em falhas ambíguas, a Stripe pode conservar a resposta da operação por 24h: consultar logs antes de repetir intervenções administrativas.
- E-mail de aviso após a troca, sem senha. Falha no aviso não desfaz uma senha já alterada.
- Link usa exclusivamente `APP_URL` HTTPS, nunca o Host do pedido. Token em fragmento, API `no-store`, rota `no-referrer` e `noindex`, sem analytics/scripts externos na página de recuperação. Apenas abrir o link não muda a conta.

## Validação

Resultado local: **325 testes em 42 arquivos aprovados**, verificações de identificadores/props e build aprovados. **61 cenários de navegador aprovados** na suíte completa, incluindo os 5 de recuperação, billing, landing, kit do projeto, geração e exportação. Inspeção visual da tela de login e recuperação no celular concluída.

- `tests/integration/password-recovery.test.js`: envio, resposta genérica, configuração, rate limit, expiração, adulteração, confirmação, concorrência, replay, preservação de quota e revogação de sessão.
- `tests/e2e/password-recovery.spec.js`: mostrar/ocultar, recuperação pelo modal, criação de senha, link expirado, celular e erro de serviço (APIs simuladas, dados fictícios).
- Suíte completa e jornadas de landing/billing verificam compatibilidade com o acesso existente.

Referências usadas: [OWASP — Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Stripe — idempotência](https://docs.stripe.com/api/idempotent_requests), [Resend — envio](https://resend.com/docs/api-reference/emails/send-email), [Resend — idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel — waitUntil](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).
