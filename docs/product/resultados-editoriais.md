# Etapa 2 — resultados das publicações

O editor oferece um painel “Resultados das publicações” na Home do projeto. O usuário registra manualmente os números do Instagram, a conta, o link, a data, o período observado (1, 7 ou 30 dias), a distribuição e a estrutura que de fato publicou. Campo vazio é dado ausente; zero é um resultado medido.

Cada registro conserva uma cópia do texto no primeiro salvamento. Atualizar os números não troca essa cópia pelo rascunho atual. Resultados vivem na entrada da biblioteca, fora do histórico de desfazer do documento; entram nos backups existentes e não são copiados ao duplicar o projeto. Link e período identificam uma medição; importações repetidas não multiplicam a amostra.

Comparações usam a mesma conta, objetivo, período, nicho, modo e pacote, somente publicações orgânicas dos últimos 180 dias. A taxa é a métrica do objetivo por mil contas alcançadas; a tabela mostra a mediana por estrutura e a amostra. Autoridade usa visitas ao perfil como indicador indireto; cultura usa compartilhamentos, sem inferir qualidade editorial desses números.

Orientar geração exige ao menos três publicações por estrutura e duas estruturas elegíveis. Empates não escolhem preferência. O histórico é uma observação, sem causalidade ou garantia de desempenho. O usuário pode desativá-lo por projeto; o automático não escolhe objetivo a partir de métricas incompatíveis. Não atribuímos automaticamente uma estrutura ao texto: o usuário confirma qual foi publicada.

O gerador recebe apenas resumo agregado e estrutura sugerida, preservando tema, fatos, modo, pacote e densidade. Sem base suficiente, mantém o comportamento anterior. Geração salva tema e nicho para contextualizar futuros registros. Não há conexão ou envio de conteúdo ao Instagram, coleta automática, publicação automática ou mudança em billing.

Validação: testes de cálculo, ausência versus zero, datas, duplicatas, filtros, amostra mínima, snapshot e integração do prompt; fluxo no navegador de registro, atualização, persistência, comparação e orientação da geração.

## Uso

1. No editor, abra **Home → Resultados das publicações**.
2. Registre o post correspondente ao texto do projeto. A data da medição precisa coincidir com o período escolhido em dias de calendário; não use números acumulados de 30 dias como se fossem de 7 dias.
3. Escolha a conta e o período que vão orientar este projeto. Confira a estrutura publicada; “não informada” permite guardar a medição, mas a exclui da comparação.
4. Na próxima geração, escolha objetivo e nicho. Com amostra suficiente, o briefing indica que vai considerar o histórico. Pacotes com arco fixo preservam esse arco.

Recomendação descritiva: duas estruturas com ao menos três posts cada é o mínimo do produto, não um teste de significância estatística. Não há estimativa de ganho esperado nem conclusão de causalidade. Empate, falta de alcance, métrica não medida, conta diferente ou amostra insuficiente mantêm a geração sem preferência histórica.

## Arquivos

- `src/utils/publication-results.js`: validação, snapshots, identidade da medição, deduplicação, comparação e resumo agregado para o prompt.
- `src/components/panels/PublicationResultsModal.jsx`: registro, histórico, comparação e controle de uso.
- `src/utils/editorial-strategy.js`: admite a estrutura sugerida pelo histórico entre as candidatas do objetivo.
- `ViralCarrossel.jsx`, `SidebarContent.jsx` e `GenerateModal.jsx`: entrada no painel, persistência na biblioteca e integração com o briefing.
- `tests/unit/publication-results.test.js`, `tests/unit/prompt-regressao.test.js` e `tests/e2e/resultados-editoriais.spec.js`: cobertura de cálculo, proteção do prompt e jornadas.

## Regressão manual

- **Reuniões sem pauta / salvamentos:** iniciar sem registros, gerar e confirmar que não há preferência inventada; registrar métricas de 7 dias e conferir taxa por alcance.
- **Hobby virando trabalho / Cultura:** comparar estruturas com dados reais da mesma conta e pacote; confirmar que o histórico não troca o arco Cultura e que posts impulsionados não entram na análise.
- **Propostas comerciais / contatos:** preencher somente contatos atribuídos ao post; importar um backup repetido, atualizar e excluir uma medição. Amostra não pode duplicar nem ressurgir após exclusão. Desligar o histórico deve removê-lo do próximo briefing.

## Publicação anterior

A etapa 1 foi publicada antes desta implementação, a pedido do usuário: `dpl_BdHb7Z6B3NMS6TU2nLxzBQ3Zz3vU`, em https://viralcarrossel.com.br. Antes daquele deploy passaram 243 testes unitários/de integração e 52 cenários de navegador. Página, arquivo da aplicação com as novas regras editoriais e endpoint público de sessão responderam com sucesso após a publicação.

Esta etapa 2 ainda não faz parte daquele deploy. Os testes usam métricas sintéticas e respostas de IA simuladas; nenhum registro fictício é incluído na aplicação.

Verificação da etapa 2: 277 testes de unidade/integração aprovados em 35 arquivos; os dois novos fluxos de navegador aprovados, incluindo persistência, atualização/exclusão, painel a 390 px, histórico no prompt e desativação. Os quatro cenários de geração/pesquisa da etapa 1 também passaram na execução conjunta. Build de produção aprovado pelo servidor de testes do Playwright; verificação de diferenças sem erros de formatação.
