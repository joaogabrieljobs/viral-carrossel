# Perfil — estado confirmado do acesso

14/11/2026. Correção complementar ao reteste das apresentações. Este documento registra comportamento do produto e testes sintéticos; não registra dados de cobrança de uma conta.

## Falha

O Perfil renderizava “Plano individual ativo” literalmente e exibia o fim de período anteriormente recebido como renovação futura. O componente não recebia o estado da verificação atual. Ao consultar novamente o uso, uma resposta válida `active:false` podia tornar a quota indisponível sem substituir o estado ativo e as datas em memória.

A apresentação de dados antigos entrava em conflito com os gates do servidor: projetos, geração e MCP podem recusar acesso enquanto a interface continua afirmando que o plano está ativo. HTTP 402, sozinho, não identifica a causa comercial; não deve ser traduzido automaticamente como cancelamento ou falha de pagamento.

## Correção

- O Perfil recebe estado explícito de acesso e consulta novamente ao abrir. Mostra verificação em andamento, confirmação atual, acesso não confirmado ou indisponibilidade temporária, conforme a resposta.
- Datas são apresentadas como período atual confirmado, sem prometer renovação automática.
- Uma resposta válida negativa atualiza o acesso e remove tier/datas antigos. Falha temporária mantém o trabalho local, mas a interface deixa de anunciar confirmação que não possui.
- Respostas atrasadas não substituem o estado de outra conta. Nenhuma transição apaga ou restaura a biblioteca.
- A tela de acesso explica a transição e permite consultar o portal existente quando há uma sessão identificada. Abrir o portal não compra nem renova uma assinatura automaticamente.
- O servidor passa a aceitar uma isenção privada por conta, além da assinatura Stripe ativa. Sessão, projetos, proxies, login, OAuth e MCP consultam essa elegibilidade; a UI recebe `accessSource` e `billingExempt` explícitos. Autenticação, epochs, escopos MCP, isolamento de projetos e quotas finitas continuam exigidos. A operação e a separação da cobrança estão descritas no [guia de isenção por conta](../engineering/OPERACAO-isencao-conta.md).

## Verificação

Os testes cobrem renderização de estados distintos, resposta ativa seguida de negativa, indisponibilidade temporária, resposta de outra conta e preservação do rascunho. O teste de navegador usa o ramo real de navegação para a tela de acesso quando `active:false`, sem permitir acesso ao editor nem apagar o projeto. O número final de testes e o commit serão informados na entrega; a comprovação da CI pode ser consultada no histórico do GitHub para o commit que contém este arquivo.

A correção da indicação não regulariza uma assinatura. A isenção, quando concedida e confirmada pelo servidor, autoriza acesso por uma fonte própria e preserva a quota do plano; ela não modifica o estado financeiro no Stripe. Os retestes de apresentação dependentes de acesso continuam separados no [relatório de reteste](apresentacoes-reteste-2026-11-14.md).
