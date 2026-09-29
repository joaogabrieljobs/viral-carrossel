# Recuperação de senha

Implementação em 28/09/2026. Domínio `viralcarrossel.com.br` verificado no Resend e as duas variáveis de envio adicionadas à produção na Vercel. Publicação e envio real em validação.

## Experiência

- Login e cadastro têm botão **Mostrar/Ocultar** fora do campo, com texto e ícone de alto contraste mesmo com autofill claro.
- **Esqueci minha senha** mantém o e-mail preenchido e pede o envio de um link.
- O link abre `/redefinir-senha#token=...`, mesmo para quem já dispensou a landing. O fragmento é removido do endereço e mantido somente na memória da página; recarregar permite solicitar outro link.
- Nova senha de 8 a 128 caracteres, confirmação obrigatória, estados de erro, sucesso e link expirado. Depois da troca, o usuário entra normalmente.

## Configuração para produção

1. No Resend, verificar um domínio de envio controlado pelo projeto e configurar os registros DNS solicitados.
2. Na Vercel, neste projeto, definir **RESEND_API_KEY** como segredo de servidor com permissão de envio e **AUTH_EMAIL_FROM** como `Viral Carrossel <remetente@dominio-verificado>`. Não usar prefixo `VITE_` nem colocar a chave no chat/repositório.
3. Manter `APP_URL=https://viralcarrossel.com.br`, `STRIPE_SECRET_KEY` e `ACCESS_COOKIE_SECRET`, já utilizados pelo app.
4. Publicar e solicitar um link para uma conta de teste controlada. Confirmar recebimento (inclusive spam), redefinição, login novo, rejeição da senha antiga e do link usado. Não alterar senha de cliente durante smoke tests.

Sem as duas configurações de e-mail, o endpoint responde indisponibilidade explícita; a UI não diz que enviou. A configuração local foi validada com credenciais sintéticas e Resend simulado; nenhum e-mail real foi enviado nesta revisão.

## Contratos e segurança

- `POST /api/auth/forgot-password`, JSON `{email}`. Resposta genérica igual para conta existente/inexistente. Consulta e envio acontecem com `waitUntil` da Vercel após a resposta, para não revelar a existência da conta por tempo de resposta. Erros de entrega ficam nos logs sem e-mail, chave ou token; aceitação do pedido não confirma entrega na caixa postal.
- Limite por IP de 5 pedidos/15 minutos, por instância (limitação do rate limiter existente). A chave de idempotência do Resend reduz reenvios para a mesma conta a uma mensagem por janela de 3 minutos, inclusive entre instâncias. Pode haver dois envios próximos na fronteira entre janelas; para volume maior, adicionar WAF/rate limit distribuído.
- `POST /api/auth/reset-password`, JSON `{token,password,confirmPassword}`. 200 após salvar; 400 para link inválido/expirado/usado ou senha inválida; 503 para falha temporária de infraestrutura. Nunca retorna a senha ou autentica automaticamente.
- Token com HMAC SHA-256, domínio criptográfico `password-reset:v1`, nonce aleatório de 256 bits, finalidade, expiração e vínculo à versão da senha/e-mail da conta. Não é cookie de acesso. Trocar senha ou e-mail invalida todos os links emitidos anteriormente. Rotacionar `ACCESS_COOKIE_SECRET` também invalida os links.
- Atualização Stripe usa uma chave de idempotência por versão da senha, impedindo que duas submissões concorrentes com parâmetros diferentes consumam a mesma versão. Atualiza somente os três metadados de autenticação, preservando quota/assinatura. Em falhas ambíguas, a Stripe pode conservar a resposta da operação por 24h: consultar logs antes de repetir intervenções administrativas.
- `vc_session_revoked_before` invalida cookies anteriores na consulta de sessão, portal e recursos protegidos. A verificação consulta o customer Stripe em cada requisição autenticada; não há cache que adie a revogação. Cookies antigos sem `iatMs` usam `iat` em segundos.
- E-mail de aviso após a troca, sem senha. Falha no aviso não desfaz uma senha já alterada.
- Link usa exclusivamente `APP_URL` HTTPS, nunca o Host do pedido. Token em fragmento, API `no-store`, rota `no-referrer` e `noindex`, sem analytics/scripts externos na página de recuperação. Apenas abrir o link não muda a conta.

## Validação

Resultado local: **325 testes em 42 arquivos aprovados**, verificações de identificadores/props e build aprovados. **61 cenários de navegador aprovados** na suíte completa, incluindo os 5 de recuperação, billing, landing, kit do projeto, geração e exportação. Inspeção visual da tela de login e recuperação no celular concluída.

- `tests/integration/password-recovery.test.js`: envio, resposta genérica, configuração, rate limit, expiração, adulteração, confirmação, concorrência, replay, preservação de quota e revogação de sessão.
- `tests/e2e/password-recovery.spec.js`: mostrar/ocultar, recuperação pelo modal, criação de senha, link expirado, celular e erro de serviço (APIs simuladas, dados fictícios).
- Suíte completa e jornadas de landing/billing verificam compatibilidade com o acesso existente.

Referências usadas: [OWASP — Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Stripe — idempotência](https://docs.stripe.com/api/idempotent_requests), [Resend — envio](https://resend.com/docs/api-reference/emails/send-email), [Resend — idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel — waitUntil](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).
