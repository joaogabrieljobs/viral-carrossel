# Landing copy — Viral. Carrossel Studio

Atualizada em 29/09/2026. Implementação: `src/components/OnboardingLanding.jsx`, `landing/ProjectWorkflowShowcase.jsx` e `landing/LandingPlans.jsx`. Preços e quotas: `shared/plans.js`.

## Posicionamento

**Categoria:** studio para criar, editar e exportar carrosséis com IA.

**Promessa:** transformar o pedido em um carrossel orientado pelo contexto e identidade do projeto, com escolhas explícitas sobre texto, imagens e refinamento.

**Tom:** PT-BR concreto e direto. Não prometer viralização, vendas, crescimento, resultados garantidos nem “agentes ultra avançados”. Não anunciar publicação/agendamento automático ou sincronização em nuvem.

## Hero

- Eyebrow: **Viral. · Studio editorial com IA**
- Headline: **Carrosséis com a sua voz. E a cara da sua marca.** A segunda frase usa a cor de destaque.
- Subheadline: **Reúna brief, referências e logo em um projeto. Gere só texto ou texto e imagens, refine o tom e exporte tudo no mesmo studio.**
- CTA: **Criar meu primeiro carrossel**
- Secundário: **Ver como funciona**
- Apoio: **Seu contexto orienta. Você escolhe a versão final.**

## Contexto e controles

Seção `#contexto-projeto`, depois do showcase.

**Eyebrow:** Mais contexto. Mais controle.

**Headline:** Seu projeto tem uma identidade. A criação parte dela.

**Body:** Traga o que a IA precisa saber sobre a sua marca. Depois, decida o que gerar, o que manter e onde aplicar sua assinatura.

| Benefício | Informação obrigatória |
| --- | --- |
| Um contexto para cada projeto | Brief, estilo, até quatro referências e aviso Contexto ON. |
| Você escolhe o que gerar | Só texto ou texto e imagens; oito modos narrativos + Nenhum. |
| Outro tom, a mesma identidade | Oito tons; remix só de texto preserva imagens, fontes, cores e composição. |
| Sua logo, no card que você escolher | PNG transparente salvo uma vez e reutilizado nos cards escolhidos. |
| Pode parar quando precisar | Cancelamento global e preservação do que já terminou. |

A prévia interativa é identificada como **ilustrativa e sem consumo de créditos**. Alternar escopo muda apenas a demonstração; selecionar um card e aplicar/remover a marca não altera projetos reais. O CTA **Criar com o contexto da minha marca** abre o fluxo existente do studio.

## Como funciona

| Passo | Texto |
| --- | --- |
| Traga uma ideia | Escreva o pedido e guarde brief, estilo, referências e logo no projeto. Esse contexto orienta as próximas gerações. |
| Escolha a direção | Escolha só texto ou texto e imagens. Selecione um modo narrativo ou Nenhum, para seguir o seu pedido sem uma estrutura predefinida. |
| Refine e publique | Varie o tom, aplique a logo nos cards escolhidos e ajuste o visual. Exporte em PNG ou PDF quando estiver pronto. |

“Publique” descreve o uso do arquivo exportado pelo usuário, não publicação automática. Criador/Diretor/Studio são níveis de ferramentas; não confundir com os oito modos narrativos.

## Capacidades

Contexto por projeto; escolha texto/imagens; oito modos + Nenhum; oito tons; logo salva; referências compatíveis; PNG/lote/PDF; criação e cancelamento no celular.

## Planos

**Headline:** Escolha pelo seu ritmo de criação.

**Body:** Texto com IA incluso em todos os planos. Para gerar imagens sem configurar uma chave própria, escolha Criador, Pro ou Max.

| Plano | Preço mensal | Imagens inclusas |
| --- | --- | --- |
| Essencial | R$ 19,90 | 0 |
| Criador | R$ 97 | 50 |
| Pro | R$ 197 | 150 |
| Max | R$ 297 | 300 |

A tabela é um retrato da configuração atual; a página e o FAQ leem `PLAN_TIERS`/`PLAN_ORDER`, sem duplicar números no JSX. Não anunciar o antigo anual de R$ 790: não é a oferta dos quatro planos atuais.

Todos têm editor/exportação, texto com IA e contexto/logo por projeto. O saldo de imagens renova por ciclo mensal. Chave própria é opcional e o provedor cobra seu uso diretamente. No Essencial, importação de imagens está disponível.

CTAs: **Escolher meu plano** e **Já assina? Entrar**. Abrem os fluxos existentes, sem iniciar cobrança na landing.

## FAQ — contratos de comunicação

O FAQ cobre preços, chave opcional, escopo do remix, brief e referências, reutilização de logo, cancelamento da geração, armazenamento local, limites de uso, modos de interface/narrativa, celular, senha e cancelamento da assinatura.

- Não dizer que “não há créditos”: há saldo de imagens por plano.
- Não prometer restituição ao cancelar geração: uma imagem já enviada pode consumir crédito.
- Logo: PNG até 2 MB, aplicada apenas aos cards escolhidos.
- Referências: até quatro; apenas geradores compatíveis.
- Projetos: salvos neste navegador; transferência por backup JSON, sem sincronização automática.
- Recuperação de senha: Entrar → Esqueci minha senha; link de 30 minutos e uso único.
- Sem teto mensal de projetos não significa chamadas de IA ilimitadas: existem limites de requisição e quota de imagens.

## CTA final e metadados

Headline: **Pare de acumular rascunhos. Publique o que você já tem para dizer.**

CTA: **Criar meu primeiro carrossel**.

Apoio: **Studio completo a partir de R$ 19,90/mês · Texto com IA incluso**, com preço vindo de `PLAN_TIERS.essential.priceLabel`.

Título da página: **Viral. Carrossel Studio — Carrosséis com a sua marca**.

Descrição: **Crie carrosséis com IA usando brief, referências e logo do seu projeto. Escolha texto ou texto e imagens, refine o tom e exporte em PNG ou PDF.**

## Validação

- `tests/e2e/landing.spec.js`: hero/CTAs, seções, planos ligados à configuração e demonstração em desktop/celular sem chamadas de IA.
- Fluxos de entrada e escolha de plano permanecem cobertos pelos testes de acesso/billing.
- Inspecionar desktop e celular, sem corte de texto ou rolagem horizontal nas seções novas.
- Preview: `http://127.0.0.1:5173/?landing=1`.
