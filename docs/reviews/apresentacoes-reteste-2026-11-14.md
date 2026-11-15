# Moont — reteste das apresentações corrigidas

14/11/2026, com verificação concluída na madrugada de 15/11 (UTC). Cinco apresentações completas e um Caso parcial. O acesso da conta interrompeu a rodada; isso não equivale à aprovação editorial dos sete modos.

## Protocolo

Publicações acompanhadas no domínio `moont.ai`:

| Versão | Mudança | Evidência da publicação |
|---|---|---|
| `dd5ef7a` | Planejamento recuperável, redação por grupos e prévias | Vercel `dpl_9PBSZpX8CSzNJRQrKwsPEraiE4gD`, READY; `/assets/index-JkNadsm1.js` |
| `861dd80` | Fontes completas na auditoria factual e rigor em todos os campos | Vercel `dpl_AhKKsFoJFKGeb5HRHw4qDLtU7qyU`, READY; `/assets/index-CO9Q0WmT.js` |
| `7d9d8f5` | Revisor dedicado, sem exemplos visuais como evidência; restrição didática de Aula | Vercel READY; `/assets/index-D9UlTFEb.js`; deploy `viral-carrossel-iv6av4yo4-elevessy-s-projects.vercel.app` |
| `1667497` | Ajuste do contrato E2E ao revisor dedicado, sem mudança no produto | CI verde: 2.197 testes + quatro falhas esperadas; 231 E2E passaram e 13 pulados. Vercel READY; mesmo bundle de `7d9d8f5`. |

A aba Chrome foi recarregada entre versões, fora de uma geração em andamento. Uma interrupção da ferramenta de automação durante a tentativa de exportar o Pitch obrigou a abrir uma nova aba; não é evidência de falha do produto. O download foi localizado depois: PDF de 12 páginas em 16:9, 3.966.368 bytes. Estrutura e quantidade verificadas com leitor de PDF; não foi feita inspeção visual completa de cada página. O conteúdo é o Pitch anterior aos refinamentos factuais e não deve ser tratado como versão editorial aprovada.

O [briefing fictício Mesa Clara](apresentacoes-producao-2026-11-14.md) é repetido literalmente: 2.330 caracteres de apoio, instruções adicionais, 12 slides em 16:9, Balanceado, texto primeiro, identidade padrão, sem logo ou referências. Projetos novos usam os prefixos `Reteste Apresentações 1411` e `Reteste final 1411`. Os testes não consumiram créditos de geração de imagem.

## Critérios

- Entrega: roteiro validado, prévias durante a redação, 12 slides completos, salvamento e reabertura.
- Fidelidade: natureza fictícia, observações versus propostas, sem atribuição causal ao método, condições e exclusões preservadas.
- Narrativa: finalidade própria de Auto, Pitch, Aula, Proposta, Relatório, Caso e Palestra.
- Composição: texto legível, informação editável, notas complementares e ausência de sobreposição.
- Limites: uma execução por modelo não mede a taxa geral de confiabilidade; texto primeiro não valida geração de fotos.

## Resultados

| Modo | Versão / projeto | Entrega observada | Avaliação editorial |
|---|---|---|---|
| Auto | `dd5ef7a` / `qrwwi9d`, v2 | 12 slides e salvamento confirmados; prévias de 6 e 9 slides observadas | Lógica de decisão reconhecível, mas notas inventaram encerramento contratual e trataram aprovação pendente como tomada. Motivou `861dd80`. |
| Pitch | `dd5ef7a` / `8zuno7d`, v2 | 12 slides, prévia de 3 e salvamento; conclusão observada em cerca de 182 s | Distingue segmento, aquisição e incertezas; notas acrescentaram desenho controlado e novos objetivos. Motivou `861dd80`. |
| Aula | `861dd80` / `hhw103h`, v2 | 12 slides e salvamento confirmados em até cerca de 4 min; prévia de 9 observada em 1:54 | Melhorou modalidade e contexto dos números. Ainda inventou nomes/datas em exemplo restrito e terminou como oferta. Motivou `7d9d8f5`; rerun pendente. |
| Proposta | `861dd80` / `kpchorl`, v2 | 12 slides; 9 na prévia em 2:51; salvamento confirmado pela interface e MCP | Escopo/exclusões/aceite completos; duas extrapolações: marco de pagamento restringido a materiais e garantia absoluta nas notas. Avaliação completa no arquivo abaixo. |
| Relatório | `7d9d8f5` / `map6qj1`, v2 | 12 slides, reabertura e salvamento confirmados. 3/12 em 1:26 e 9/12 em 2:05. Bloqueio do Mac impede cronometrar a conclusão. | Indicadores, conversões e limites causais corretos. Duas imprecisões em notas: “mesmos 20 encontros” e resumo incompleto do aceite em uma página; ver revisão detalhada. |
| Caso | `7d9d8f5` / `cfwc3y7`, rascunho local | 6/12 preservados; 3/12 na prévia em 2:21. Salvamento na conta pendente. Backup JSON exportado e conferido com seis slides, notas e blocos. | Rascunho sem revisão final; cálculo e limites causais corretos, mas há promessa excessiva de decisão garantida. Não avaliado como apresentação completa. |
| Palestra | Ainda não repetida após correção | Pendente | Sem conclusão editorial nesta rodada. |

As execuções concluídas produziram 60 slides. Auto, Pitch, primeira Aula e Proposta foram gerados **antes** da revisão dedicada de `7d9d8f5`; não são prova de eficácia dessa última mudança. O Relatório foi iniciado já nessa versão.

## Fidelidade, composição e densidade

Os cinco decks completos têm títulos, blocos editáveis e narrativas distintas. Título + apoio + corpo variaram de 17 a 67 palavras por slide, sem contar os blocos nativos. Não foi observada uma parede de texto generalizada nas páginas inspecionadas, mas essa contagem não substitui inspeção geométrica de todos os slides e do PDF. Notas continuaram mais editoriais do que uma fala pronta, com trechos como “Abertura do deck”.

A verificação factual local é conservadora: valores derivados e paráfrases podem ser sinalizados mesmo corretos. Aviso automático não é prova de invenção; tampouco ausência de aviso certifica a verdade. A [revisão editorial detalhada](apresentacoes-reteste-2026-11-14/reviewnotes.md) compara as saídas ao briefing, incluindo notas, legenda e blocos visíveis.

## Evidências e limites

- [Auto — captura final](apresentacoes-reteste-2026-11-14/auto-concluido.jpg), [texto persistido](apresentacoes-reteste-2026-11-14/auto.json).
- [Pitch — indicadores](apresentacoes-reteste-2026-11-14/pitch-indicadores.jpg), [texto persistido](apresentacoes-reteste-2026-11-14/pitch.json).
- [Aula — captura final](apresentacoes-reteste-2026-11-14/aula-concluido.jpg), [texto persistido](apresentacoes-reteste-2026-11-14/aula.json).
- [Proposta — captura final](apresentacoes-reteste-2026-11-14/proposta-concluido.jpg), [texto persistido](apresentacoes-reteste-2026-11-14/proposta.json).
- [Relatório — primeiros três slides durante a geração](apresentacoes-reteste-2026-11-14/relatorio-3-de-12.jpg).
- [Caso — rascunho parcial](apresentacoes-reteste-2026-11-14/caso-incompleto.jpg), [backup exportado](apresentacoes-reteste-2026-11-14/caso-backup.json).
- [Diagnóstico agregado de acesso e CI](apresentacoes-reteste-2026-11-14/diagnostico-acesso.json).

O MCP confirma conteúdo e versão persistidos, mas seu retorno textual não contém todos os blocos nativos. Por isso a revisão também usa os arquivos `*-interface.txt`. A árvore nativa de acessibilidade limita a lista a 100 itens; no Relatório, os blocos dos slides 11–12 não foram recuperados por essa representação. A execução foi interrompida pelo bloqueio do Mac e retomada após o usuário desbloqueá-lo. O Relatório ficou temporariamente “pendente na conta” e sincronizou sozinho ao retornar à biblioteca; reabertura e leitura MCP confirmaram 12 slides. Não há aprovação global dos sete modos nem validação de geração de fotos nesta rodada. O download do Pitch confirmou PDF com 12 páginas; isso não certifica sua qualidade editorial ou todos os detalhes visuais.

Os testes automatizados e a publicação estão registrados no [relatório de correções](apresentacoes-corrigidas-2026-11-14.md). Eles cobrem contratos, recuperação, cancelamento, persistência e interface simulada; não substituem a avaliação semântica de saídas reais.

## Interrupção de acesso e pendências

Durante o Caso, o Perfil ainda mostrava plano ativo, enquanto a integração retornava “Assinatura inativa”. A geração e o salvamento passaram a receber HTTP 402. Na janela de 00:25–00:35 UTC de 15/11, as métricas de produção mostram um 402 em `/api/ai/compatible`, 23 em `/api/projects` e três em endpoints de acesso/visual. Também há um webhook de atualização de assinatura para `past_due`, recebido com 200 às 00:25:40 UTC. Esses dados são agregados; o webhook não foi vinculado individualmente à conta do teste e não prova, sozinho, a causa de cada chamada.

O backup do Caso registra seis slides e qualidade incompleta às 00:25:58 UTC. A versão servida ainda não registrava o diagnóstico detalhado de cada lote; portanto não é possível atribuir retrospectivamente a interrupção específica a uma resposta HTTP com certeza. O patch seguinte registra causas explícitas e evita novas tentativas pagas quando recebe 401, 402, 403 ou 429.

O rascunho foi mantido aberto e exportado antes de qualquer recarga. Nenhuma assinatura, cobrança, credencial ou permissão foi alterada. Foi pedido ao responsável que verificasse o acesso. Ficam pendentes, após regularização: Palestra, conclusão/reteste de Caso e novas execuções de Aula, Auto e Pitch na versão final. Os testes de interface simulados não fecham essas pendências reais.
