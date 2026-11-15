# Moont — continuação dos retestes de apresentações

Rodada iniciada em 14/11/2026 e encerrada na madrugada de 15/11, horário de São Paulo. Complementa o [relatório anterior](./apresentacoes-reteste-2026-11-14.md).

## Execução real

Mesmo briefing fictício Mesa Clara, 12 slides, 16:9, Balanceado, identidade neutra e texto primeiro. Nenhum crédito de imagem foi consumido. Quatro novas apresentações completas, 48 slides, foram conferidas pela interface e pelo MCP; versões originais foram preservadas, sem corrigir manualmente os resultados para fazê-los passar.

| Modo | Produto / projeto / versão | Resultado operacional | Resultado editorial |
|---|---|---|---|
| Aula | `c46a4c9` / `lst8g3j` / v2 | 12 slides em até 189 s; prévia de 6/12 observada; salvo às 23:29 | Atividade sem resposta modelo, exemplo não fornecido e duas páginas comerciais. Motivou o refinamento seguinte. |
| Caso | `c46a4c9` / `e82r3dz` / v2 | 12 slides em até 278 s; prévia de 3/12 observada; salvo às 23:38 | Números e condições preservados; ainda atribui impacto causal e promete resultado. |
| Palestra | `b45f1e0` / `nt7xpyl` / v2 | Editor completo observado até cerca de 188 s; 12 slides confirmados pelo MCP; reabertura confirmou salvamento | Tese reconhecível; ainda há universalizações, contraste absoluto e uma omissão no aceite das notas. |
| Aula refinada | `b45f1e0` / `79kwu3m` / v2 | 12 slides em até 228 s; atividade/correção/transferência presentes; salvo às 23:55 | Avanço estrutural, mas a resposta modelo continua abstrata, há cenário novo nas notas e o fecho retorna à oferta. Pendência didática permanece aberta. |

Tempos são limites observados entre o clique de geração e a coleta da interface, não medições precisas de latência do servidor. O Caso antigo `cfwc3y7` também sincronizou seus seis slides; não é contado como apresentação completa.

## Refinamento publicado

`b45f1e0` leva as instruções completas ao planejamento, à recuperação, aos lotes de redação e à revisão. A correção da atividade recebe o conteúdo efetivamente escrito, sem usar esse rascunho como evidência factual. Os contratos reforçam consistência entre tarefa e resposta, preservação de qualificadores, distinção entre finalidade e causalidade, e prioridade de aprendizagem em Aula.

[CI da publicação](https://github.com/joaogabrieljobs/viral-carrossel/actions/runs/43669089926): 2.261 testes aprovados e quatro falhas esperadas; 237 E2E passaram diretamente, um após retry (`card-text-fonts.spec.js:127`, viewport 1680), 13 pulados. Produção READY, bundle `index-B6pMQaBD.js`. Isso comprova a entrega técnica, não a aprovação semântica das saídas.

## Salvamento observado e regressão reproduzida

A Palestra estava salva no servidor em v2 com 12 slides, enquanto o editor ainda dizia “pendente na conta”. Reabri-la pela biblioteca mudou o aviso para “Salvo na conta às 23:59”. Não houve evidência de perda de conteúdo.

A investigação identificou dois caminhos reproduzíveis: uma pendência de outro projeto podia impedir o recibo do projeto confirmado; e a adoção de IDs de mídia podia usar o documento atual como baseline, absorvendo uma edição feita durante o envio. A correção registra recibo por confirmação e usa como baseline somente o snapshot enviado com IDs estáveis. Conflitos de outros projetos continuam visíveis. Isso não prova retrospectivamente qual ramo ocorreu na conta.

Validação específica: cinco E2E de sincronização V2 e 27 testes unitários, além de build e verificações estáticas. As regressões preservam a revisão do projeto B e exigem dois PUTs versionados para a edição sucessora de A, com o mesmo asset, tanto pela fila como pelo caminho direto. O commit que inclui este relatório registra a publicação dessa correção.

## Evidências e limites

A [revisão editorial detalhada](./apresentacoes-reteste-2026-11-14-continuacao/revisao-editorial.md) contém todos os achados, acertos e limites por slide. O [diretório de evidências](./apresentacoes-reteste-2026-11-14-continuacao/) preserva JSONs textuais, árvores da interface e capturas por versão.

Não foi observado excesso generalizado de texto básico nas quatro saídas; um slide de Caso chegou a 72 palavras antes dos blocos e precisa condensação. Contagens não substituem inspeção geométrica completa. Não foi feita nova exportação/inspeção integral de PDF ou geração de fotos nesta continuação.

Os sete modos já têm execuções completas ao longo das duas rodadas, mas em versões diferentes. Auto, Pitch e Proposta não foram repetidos em `b45f1e0`; não há aprovação global dos sete modos nem estimativa estatística de confiabilidade. Os problemas semânticos remanescentes estão explicitamente abertos, sobretudo resposta modelo e fecho de Aula. Melhorar o contrato de geração não equivale a garantir que toda saída o cumpra.
