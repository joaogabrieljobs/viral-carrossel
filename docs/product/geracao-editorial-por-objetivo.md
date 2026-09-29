# Geração editorial por objetivo

Data: 22/09/2026. Implementação da próxima etapa aprovada após a revisão dos prompts de texto.

Atualização de 29/09/2026: publicado junto ao pacote `450e84d`. O prompt rápido agora também oferece **Nenhum** como modo narrativo; nesse caso, a geração omite a seleção de estrutura editorial e a preferência histórica, seguindo pedido e brief. Validação estrutural e revisão editorial continuam ativas. [Guia atual](guia-projetos-geracao.md).

## Comportamento

Na etapa Ideia, o usuário escolhe o objetivo: automático, compartilhamentos, salvamentos, autoridade, conversas, interesse comercial ou interpretação cultural. A escolha acompanha geração, remix, refinamento, legenda e variações de gancho; fica salva no documento. Projetos antigos assumem automático.

A biblioteca contém seis estruturas: identificação, referência prática, análise sustentada, dilema real, diagnóstico/demonstração e leitura cultural. Cada entrada inclui quando usar, quando evitar, exemplo, CTA e data de revisão. Todas são identificadas como hipóteses editoriais, sem histórico de desempenho ou promessa de alcance. As fontes da plataforma ficam separadas das hipóteses.

Antes de redigir, o prompt pede comparação interna de três abordagens (utilidade, identificação, interpretação). O objetivo orienta o argumento e a ação final. Não substitui modo narrativo, arco de pacote, layout ou material factual. Capa e segundo slide são planejados em conjunto.

## Revisão automática

A geração principal faz duas chamadas lógicas de texto: rascunho e uma revisão. Os fallbacks já existentes do provedor permanecem no transporte; esta etapa não cria um ciclo de tentativas nem uma terceira chamada de correção.

A primeira resposta deve ter a quantidade de slides solicitada, os campos textuais esperados e legenda. Resposta estruturalmente inválida não substitui o documento. As regras de corpo vazio em capas/fechos são aplicadas antes da revisão.

A revisão recebe briefing e rascunho completos. Confere promessa/entrega, progressão, repetição, concretude, apoio factual, voz, densidade, legenda e CTA. Devolve edições pontuais por índice, com motivo; o app aceita somente campos textuais. Imagens, ordem, quantidade e configurações visuais permanecem iguais. Índices repetidos, campos desconhecidos, tipos inválidos ou corpo em posição proibida invalidam a revisão inteira.

Se a revisão falhar, o rascunho válido é mantido e aparece um aviso. O status fica registrado no documento: revised, unchanged ou unavailable. A revisão acrescenta uma chamada e latência à geração; não implica verificação factual independente nem previsão de resultado no Instagram.

## Atualização da plataforma

A legenda pede até cinco hashtags pertinentes e até 2200 caracteres. Uma normalização aplica esses limites tanto à geração quanto à regeneração de legenda, mesmo se o modelo excedê-los.

Fonte do limite anunciado de hashtags: https://www.threads.com/@creators/post/DSalXGPCWM4

Cobertura consultada que reproduz o anúncio: https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/

Orientações gerais e personalizadas do Instagram: https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/

A biblioteca é versionada em `editorial-strategy.js`. Atualizações futuras devem registrar fonte, data de revisão, mudança e testes. Não foi criada automação recorrente de pesquisa nem atualização automática de regras a partir de páginas externas.

## Pesquisa e referências

O painel usa um builder compartilhado que inclui data atual, objetivo e preferências narrativas. Com web, pede fonte, URL, data de publicação e data do evento quando disponível. Não exige quantidade mínima de notícias para evitar preenchimento inventado.

Sem web, usa um prompt próprio de hipóteses, sem ordem conflitante para pesquisar. A normalização remove URLs/datas dessa resposta. Resultados sem fonte datada ficam identificados como hipóteses; URLs clicáveis aceitam somente HTTP(S). Fontes são indicadas pelo modelo, não certificadas pelo app.

Ao escolher uma ideia, os fatos e links referenciados são acrescentados ao material existente, preservando as notas anteriores. Variações de gancho passam a receber o carrossel completo para conferir a promessa contra o miolo.

## Arquivos

- `src/utils/editorial-strategy.js`: objetivos, biblioteca, proveniência e limites de legenda.
- `src/utils/editorial-review.js`: validação, prompt de revisão, aplicação de edições e fallback.
- `src/utils/research-prompts.js`: pesquisa com/sem web, normalização e referências da ideia.
- `src/utils/generation-prompts.js`: regras de legenda e pesquisa alinhadas.
- `src/utils/doc-schema.js`: compatibilidade dos objetivos salvos.
- `ViralCarrossel.jsx` e painéis GenerateModal, ResearchPanel e HookVariationsModal: integração pontual.

## Validação

- Unidade/integração: `npm test` (243 testes, 34 arquivos, aprovados).
- Navegador: `npm run test:e2e -- tests/e2e/geracao-editorial.spec.js tests/e2e/ia-paineis.spec.js` — 6 testes aprovados; build de produção executado pelo Playwright.
- Chamadas de IA são simuladas nos testes; nenhuma publicação ou geração paga é necessária.

## Fora desta etapa

O registro manual de métricas e a orientação por histórico foram implementados na [etapa 2](resultados-editoriais.md). Não há conexão automática com contas Instagram, validação editorial com modelos reais nem garantia de aumento de alcance.
