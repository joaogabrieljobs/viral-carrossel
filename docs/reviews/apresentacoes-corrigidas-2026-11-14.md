# Moont — correções do fluxo de apresentações

14/11/2026 · Correções publicadas e reteste real documentado. Validação editorial integral permanece pendente de acesso para os testes restantes.

## Problema observado

A [avaliação em produção](apresentacoes-producao-2026-11-14.md) executou os sete caminhos de apresentação com 12 slides e um controle Auto com seis slides. As oito tentativas pararam no planejamento: cinco por resposta incompleta e três por validação do roteiro. Nenhuma entregou um deck ou prévia de slides. Os testes ocorreram na aba que ainda servia `9a38663`; o patch seguinte `a4f72af` corrigiu persistência e nome, sem alterar a geração de apresentações.

Essas observações demonstram falha de entrega naquele protocolo. Elas não identificam, sozinhas, a causa de cada resposta nem permitem comparar a qualidade editorial dos sete modos. O relatório original e suas sete capturas permanecem como evidência separada das correções abaixo.

## Correções desta rodada

- **Planejamento compacto e recuperável:** o orçamento solicitado e o contrato do prompt passam a usar o mesmo teto de 8.192 tokens. Um system prompt próprio delimita a etapa ao JSON de planejamento. Há no máximo duas tentativas, com diagnóstico específico e uma recuperação mais compacta quando a resposta estiver truncada, inválida ou fora do contrato.
- **Validação das fontes preservada:** fontes, citações, estágios de evidência, quantidade, ordem e referências continuam sendo conferidos antes de o plano chegar à redação. A recuperação não autoriza inventar fontes nem retirar evidências necessárias para fazer a validação passar. O parser desta etapa não registra trechos privados em mensagens de erro do parser genérico.
- **Diagnóstico de resposta:** o transporte compatível informa metadados de provedor/modelo, motivo de término e uso de tokens quando fornecidos. Os diagnósticos de validação usam códigos e posições, sem incluir texto privado do material. A opção de desativar raciocínio separado é limitada às chamadas de apresentação e aos modelos Z.ai compatíveis.
- **Redação progressiva:** a apresentação é escrita em grupos de até três slides. Cada grupo precisa ser completo e válido antes de aparecer na prévia. O fluxo permite uma recuperação limitada por grupo; se um grupo posterior falhar, os slides concluídos podem ser preservados como rascunho incompleto, com contagem explícita e sem iniciar a geração de imagens. Cancelar após um grupo concluído também mantém o conteúdo completo para abrir e salvar: notas, blocos, legenda e plano, além do texto visível. Respostas tardias não substituem esse rascunho.
- **Acompanhamento no assistente, modal e editor:** a sequência sugerida fica disponível antes de gerar; o roteiro validado aparece antes dos slides; a prévia mostra o conteúdo preparado e a quantidade concluída. Falhas permanecem junto ao ponto de acompanhamento. A quantidade escolhida pelo usuário é preservada ao trocar de caminho.
- **Prompts por finalidade:** Auto, Pitch, Aula/Workshop, Proposta, Relatório, Caso e Keynote/Manifesto reforçam argumentos distintos, limites do material e ações sustentadas. Piloto não vira contrato pago, antes/depois não prova causalidade, proposta não vira compromisso e dado ausente não vira meta. Etapas podem ser combinadas sem gerar páginas repetidas só para preencher um modelo.

## Escopo da preparação de release

A base isolada é `a4f72afa450fdba6876f340387d021e9c569d7c3`, no checkout temporário `/private/tmp/moont-release-1411.g8s5MD`. A seleção inclui o fluxo de apresentações, prompts, componentes de progresso, testes relacionados e os dois relatórios desta rodada com as sete capturas da avaliação original.

O checkout principal contém trabalho anterior de enquadramento de fotos e documentos históricos. Eles serão preservados fora deste pacote. Em `ViralCarrossel.jsx`, cinco hunks pertencem ao enquadramento: importação de `automaticPhotoFramingPatch`, aplicação ao upload, chaves de posição da imagem, aplicação à imagem gerada e aplicação ao recorte. Os arquivos integrais de enquadramento e seus testes também ficam fora. A seleção foi copiada após a liberação do responsável: 40 arquivos, incluindo sete capturas e a documentação do pipeline. Foram aplicados somente os 18 hunks desta rodada em `ViralCarrossel.jsx`; os cinco hunks de enquadramento foram excluídos e os seis arquivos integrais relacionados continuam idênticos à base no checkout isolado. O snapshot final inclui os testes de cancelamento, o reparo visual com orçamento de tokens consistente e o teste de encaminhamento de `thinking` pelo backend.

A publicação usa apenas esse checkout isolado. Commit e push fast-forward para `main`, com deploy automático correspondente, estão autorizados na sessão. A árvore de trabalho original permanece preservada.

## Verificação

| Verificação | Estado e limite |
|---|---|
| Base isolada e escopo | Confirmados em `a4f72af`; checkout isolado estava limpo antes desta preparação. Cinco hunks anteriores de enquadramento identificados em `ViralCarrossel.jsx`. |
| Testes automatizados da seleção final | `npm test -- --reporter=dot`: 202 arquivos aprovados; 2.172 testes passaram e quatro falhas esperadas (`it.fails`) permanecem explicitamente contadas. Check de identificadores e props passou. |
| Build da seleção final | `npm run build` passou novamente no checkout isolado após o ajuste de cancelamento; 1.914 módulos transformados. Permanecem avisos de tamanho de bundle e imports dinâmicos já presentes na base; não houve erro de build. |
| Acessibilidade estática e diff | `npm run check:a11y` passou: nenhum botão apenas com ícone sem rótulo. `git diff --check` passou na seleção isolada. |
| E2E da seleção final | Cinco testes de prévia e cancelamento passaram contra o build isolado em servidor próprio. Cobrem roteiro antes dos slides, prévia durante revisão, cancelamento com 3/6 slides, abertura do rascunho, resposta tardia e recarga com notas/blocos/legenda preservados. As APIs são simuladas; não comprovam a resposta real do provedor. |
| Primeira publicação e CI | `dd5ef7a5e1892615c378c3aee7e55b007904656b` enviado por fast-forward para `main`. [CI 43644310901](https://github.com/joaogabrieljobs/viral-carrossel/actions/runs/43644310901) passou: 2.172 testes + quatro falhas esperadas; 231 E2E passaram, 13 foram pulados, sem flaky reportado. Portão aprovado para esse SHA. |
| Produção da primeira publicação | Vercel `dpl_9PBSZpX8CSzNJRQrKwsPEraiE4gD` READY, target production, SHA `dd5ef7a`. Alias `moont.ai` aplicado; domínio respondeu HTTP 200 e serviu `/assets/index-JkNadsm1.js`. |
| Geração real por API local | As tentativas receberam HTTP 401; não produziram uma apresentação nem validaram os prompts. |
| Credenciais para reteste | Uma tentativa de obter o ambiente completo foi recusada pela revisão automática de aprovação. Não foi repetida e não integra o procedimento de verificação. |
| Reteste real pela aplicação | O responsável informou que Auto entregou e salvou 12 slides em `dd5ef7a`. Essa entrega não equivale à aprovação editorial dos sete caminhos. O reteste identificou alertas factuais indevidos para fatos presentes nas fontes e extrapolações nas notas; o ajuste complementar abaixo trata esses achados. As outras avaliações reais seguem documentadas separadamente. |

## Ajuste após o primeiro reteste real

A auditoria factual agora considera o texto original das fontes junto das instruções fornecidas. O plano e os argumentos gerados continuam excluídos como evidência. Uma exclusão explícita, como “não inclui software”, deixa de ser classificada como promessa positiva; a mesma exclusão no briefing não autoriza a geração de uma inclusão afirmativa. Números inventados continuam sinalizados.

Os prompts de redação e revisão exigem preservar decisões pendentes, não deduzir encerramento de contrato a partir de um aceite e conferir todos os campos, inclusive notas, blocos e legenda. Base, período e exclusões essenciais de indicadores ou escopo devem aparecer no slide correspondente. Diagnóstico não fornecido deve ser apresentado como hipótese, sem criar causalidade.

Este ajuste complementar altera sete arquivos de código/teste e este relatório. Ele não modifica layout, cancelamento ou o enquadramento de imagens. Verificação final no checkout isolado: `npm test` passou em 202 arquivos, com 2.187 testes aprovados e quatro falhas esperadas; build, checks de identificadores/props, acessibilidade estática e `git diff --check` passaram. O efeito real nas próximas respostas da IA exige reteste; a CI acompanhará o SHA do ajuste complementar.

## Revisão dedicada e aprendizagem — `7d9d8f5`

O reteste de Aula ainda acrescentou nomes, fornecedores e datas num exemplo, apesar de a instrução limitar o exercício aos dados fornecidos. A revisão planejada agora recebe um system prompt exclusivo para correções em JSON, o pedido e as fontes originais, sem reutilizar a receita visual de redação. O roteiro gerado entra apenas como estrutura; suas afirmações não se tornam evidência. Respostas que misturam correções com um novo deck ou configurações visuais são rejeitadas, preservando o rascunho.

O modelo Aula exige que exemplo, exercício e correção usem os mesmos insumos e avaliem a mesma entrega. A aplicação ao contexto pessoal fica separada. O encerramento e o resumo concluem a aprendizagem; haver preço no material não autoriza converter a aula em venda. Cabeçalhos sem item, como “Inclui e exclui”, deixam de ser tratados como promessa comercial pelo verificador literal.

O pacote altera seis arquivos. Passaram 285 testes focados, build e checks de identificadores, props, acessibilidade e diff. Publicação `7d9d8f5375aba0b177a22049c61d6df09052fded` em produção; Vercel READY e bundle `/assets/index-D9UlTFEb.js` confirmado. A CI e os resultados reais finais serão registrados no relatório de reteste. Melhor instrução e validação não garantem ausência de erros factuais em toda resposta; os testes reais distinguem entrega técnica de aprovação editorial.

## Critérios de conclusão

1. Confirmar testes de planejamento válido/inválido/truncado, recuperação limitada, cancelamento, fontes e metadados sem material privado.
2. Confirmar os grupos progressivos, títulos, ordem, total solicitado e preservação explícita de um rascunho parcial quando uma etapa posterior falhar.
3. Confirmar na interface o roteiro antes dos slides, evolução da contagem, visibilidade dos erros, troca de modo sem perder quantidade e ausência de regressão no carrossel.
4. Registrar build, CI, commit publicado e versão servida.
5. Repetir a avaliação real dos sete caminhos com o material documentado e distinguir entrega técnica de qualidade editorial, densidade, fidelidade factual e composição. Somente depois dessa observação será possível afirmar que o problema de produção foi resolvido.

O fluxo faz mais de uma chamada por apresentação, proporcionalmente ao total de slides. Grupos menores e recuperação limitada reduzem o tamanho de cada resposta; não constituem, antes do reteste real, garantia de menor duração, custo ou taxa de falhas.

## Interrupção explícita e preservação do diagnóstico

O Caso preservou seis de 12 slides quando o acesso ao serviço começou a retornar 402. Para que a próxima interrupção tenha causa verificável, cada grupo agora registra intervalo, tentativa, resultado, código/campo da validação, status HTTP e metadados permitidos do provedor. Briefing, texto gerado, credenciais e mensagens privadas de erro não entram nesse diagnóstico. A recuperação recebe o campo estrutural a corrigir, com a posição global do slide, mantendo no máximo duas tentativas.

A interface distingue redação incompleta, sessão, confirmação da assinatura, acesso negado e limite de solicitações. A mensagem não deduz “assinatura inativa” a partir de dados em cache. Quantidade solicitada, quantidade preservada, motivo explícito e diagnósticos sobrevivem à recarga. Respostas 401/402/403/429 não disparam uma nova tentativa de geração paga.

Verificação anterior ao pacote final: a [CI de `1667497`](https://github.com/joaogabrieljobs/viral-carrossel/actions/runs/43657887422) passou com 2.197 testes, quatro falhas esperadas, 231 E2E aprovados e 13 pulados; deploy READY. Esse commit ajustou apenas o teste ao novo revisor, sem alterar o bundle do produto. Para a interrupção explícita, 35 testes de geração, 15 de interface e seis E2E passaram; o E2E novo provoca 402 após três de seis slides, confirma ausência de nova chamada e verifica texto, causa e diagnósticos após recarga. A publicação final será registrada abaixo após sua confirmação.

O [reteste real](apresentacoes-reteste-2026-11-14.md) registra cinco apresentações completas, 60 slides, um Caso parcial com backup e as pendências. O PDF do Pitch foi baixado e conferido: 12 páginas em 16:9. As extrapolações editoriais encontradas foram usadas para refinar os prompts, mas as saídas anteriores não demonstram a eficácia integral da versão final.
