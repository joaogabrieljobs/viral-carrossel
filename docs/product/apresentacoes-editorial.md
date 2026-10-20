# Contrato editorial das apresentações

Atualizado em 20/10/2026.

Todos os caminhos de apresentação têm um papel de sistema próprio, com critérios compartilhados de fidelidade, profundidade, contexto e conclusão. O caminho é normalizado antes da chamada e acompanha geração, revisão, refinamento individual/em lote e resumo. Carrosséis mantêm seu papel anterior; o Pitch mantém seu contrato especializado.

| Caminho | Desenvolvimento esperado | Erros que a revisão deve procurar |
| --- | --- | --- |
| Automático | Escolher uma lógica dominante pelo público, objetivo e uso; explicar contexto, mecanismo, implicação e próximo passo. | Misturar objetivos, presumir uma captação e repetir generalidades. |
| Aula / Workshop | Objetivo observável, explicação, exemplo resolvido, verificação, prática, debrief e transferência. | Atividade sem tarefa/entrega, exemplo sem raciocínio e salto de pré-requisito. |
| Proposta comercial | Diagnóstico, abordagem, entregáveis, aceite, responsabilidades, condições e decisão. | Escopo, preço, calendário, garantia ou ROI inventados; compromissos contraditórios. |
| Relatório executivo | Recorte, período, achado, evidência, interpretação, implicação e recomendação. | Bases incompatíveis, falta de dados tratada como zero e correlação apresentada como causa. |
| Estudo de caso | Baseline, intervenção, escolhas, execução, resultados, limites e aprendizado transferível. | Meta apresentada como resultado, antes/depois incomparável e atribuição sem apoio. |
| Keynote / Manifesto | Tese, tensão, história/prova, nova interpretação, objeção, princípios e ação. | Slogans repetidos, história fictícia tratada como real, falsa dicotomia e promessa absoluta. |

## Integração

- `presentation-content.js`: regras comuns e critérios por finalidade.
- `presentation.js`: caminhos normalizados e acesso ao contrato.
- `ai-client.js`: papel local à chamada, preservado ao trocar de provedor ou usar a IA do plano.
- `editorial-review.js`: geração e uma revisão, com correções de texto e validação dos limites existentes.
- `generation-prompts.js`: campos, linguagem, imagem e material coerentes com o caminho.
- O editor usa o mesmo contrato no refinamento e no resumo.

O conteúdo base de todos os decks pode ocupar até 40 mil caracteres, como no Pitch, com aviso quando houver corte. A soma com textos obtidos de URLs mantém o orçamento existente de 60 mil caracteres para apresentações. O limite dos carrosséis não muda.

`subtitle` explica a ideia; `bodyAfterImage` pode complementá-la com critério, detalhe, instrução ou ressalva. Os limites de cada composição prevalecem. O texto essencial não deve ser transferido para uma nota pequena. Aula e Keynote preservam o ritmo ao vivo; Proposta e Relatório precisam funcionar na leitura posterior.

`imageQuery` vazia significa ausência intencional de imagem. A geração não cria uma foto ou um diagrama fictício para preencher o espaço de uma composição. Imagens solicitadas continuam disponíveis; fatos, etapas e comparações devem estar no texto ou em materiais reais.

Os prompts proíbem citar upload, arquivo ou processo de extração. Fontes factuais fornecidas, população, período e condições permanecem quando necessários. O código não apaga indiscriminadamente referências legítimas nos documentos existentes.

## Avaliação

Os testes de transporte verificam os quatro provedores, aliases, fallback, isolamento entre chamadas e a ligação entre geração e revisão. Os testes de navegador exercitam os seis caminhos com respostas simuladas, verificam a aplicação da revisão e confirmam que imagens não são solicitadas quando `imageQuery` está vazia. Nenhum desses testes equivale a uma avaliação da qualidade de uma geração real.

Nesta alteração, o build, os 1.404 testes de código e os nove cenários de navegador de apresentações/exportação passaram na árvore de trabalho. A suíte completa de navegador tem falhas preexistentes registradas no CI do commit anterior `9090c86`; não foi declarada aprovada por esses testes focados.

Para avaliar respostas reais, usar ao menos:

1. Aula para iniciantes com objetivo explícito e sem caso real: esperar exemplo hipotético identificado, tarefa e critério.
2. Proposta com escopo parcial e preço ausente: esperar pendências comerciais, sem pacote ou garantia inventada.
3. Relatório com duas bases de períodos diferentes e ausência de meta: esperar ressalva de comparabilidade, sem meta implícita.
4. Caso em andamento sem resultado medido: esperar processo em avaliação, sem linguagem de sucesso comprovado.
5. Keynote com tese e uma evidência: esperar progressão e objeção honesta, sem citações fabricadas.
6. Automático com objetivo de ensinar: esperar uma estrutura de aprendizagem, sem pedido de investimento.

Em todos: a abertura orienta, cada página acrescenta informação, o fecho decorre do desenvolvimento e não há referência ao processo de extração.
