# E-mails da Moont

Atualizado em 27/11/2026. Todo e-mail que o nosso código manda passa pelo layout único
`api/lib/email-layout.js` (tabelas e estilo inline, símbolo em `https://moont.ai/icon-192.png`,
cores e tom do `brand/moont-brand-kit`). Cada função devolve `{ subject, html, text }`; o envio
manda HTML e texto puro ao Resend. Testes: `tests/unit/emails-identidade-2711.test.js`.

## Inventário

| E-mail | Quem envia | Onde | Função |
| --- | --- | --- | --- |
| Recuperação de senha | Resend, nosso código | `api/lib/password-reset.js` `sendPasswordReset` | `emailRecuperacaoSenha` |
| Cadastro com e-mail que já tem conta (MOO-16) | Resend, nosso código | `api/lib/password-reset.js` `sendExistingAccountNotice` | `emailContaExistente` |
| Senha alterada | Resend, nosso código | `api/lib/password-reset.js` `sendPasswordChanged` | `emailSenhaAlterada` |
| Código do console admin (interno) | Resend, nosso código | `api/admin.js` `defaultSendCode` | `emailCodigoAdmin` |
| Recibo, fatura, cobrança falha, renovação | Stripe | painel da conta MOONT | idioma por `preferred_locales` do cliente |

Remetente: `AUTH_EMAIL_FROM` = `Moont <nao-responda@moont.ai>` (Vercel). Não existe Supabase Auth
nem confirmação de cadastro por e-mail: o cadastro cria a conta direto. Não há boas-vindas,
suporte por chamado, comunicado em massa nem exportação por e-mail.

## Regras

- Texto em português do Brasil, "a Moont", sem travessão, sem emoji, sem promessa que o produto não cumpre.
- Quem chama entrega texto puro; o layout escapa tudo. Link de botão só https.
- Novo e-mail: criar a função em `email-layout.js` e um caso no teste.
- Stripe: clientes novos nascem com `preferred_locales: ['pt-BR']`. Clientes antigos sem idioma
  usam o "Idioma padrão" de e-mails de clientes do painel da Stripe.
