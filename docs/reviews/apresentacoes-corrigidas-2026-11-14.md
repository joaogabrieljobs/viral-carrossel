# Moont — correções do fluxo de apresentações

14/11/2026 · Correções validadas localmente; publicação e reteste real acompanhados nesta rodada.

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
| CI, push e deploy desta rodada | Acompanhar após o commit desta seleção. O reteste real depende da confirmação do mesmo SHA em produção. |
| Geração real por API local | As tentativas receberam HTTP 401; não produziram uma apresentação nem validaram os prompts. |
| Credenciais para reteste | Uma tentativa de obter o ambiente completo foi recusada pela revisão automática de aprovação. Não foi repetida e não integra o procedimento de verificação. |
| Reteste real pela aplicação | Planejado após testes automatizados e publicação. Usará a sessão normal da aplicação em produção, sem exportar segredos. Ainda não há resultado real atribuível a estas correções. |

## Critérios para encerrar a rodada

1. Confirmar testes de planejamento válido/inválido/truncado, recuperação limitada, cancelamento, fontes e metadados sem material privado.
2. Confirmar os grupos progressivos, títulos, ordem, total solicitado e preservação explícita de um rascunho parcial quando uma etapa posterior falhar.
3. Confirmar na interface o roteiro antes dos slides, evolução da contagem, visibilidade dos erros, troca de modo sem perder quantidade e ausência de regressão no carrossel.
4. Registrar build, CI, commit publicado e versão servida.
5. Repetir a avaliação real dos sete caminhos com o material documentado e distinguir entrega técnica de qualidade editorial, densidade, fidelidade factual e composição. Somente depois dessa observação será possível afirmar que o problema de produção foi resolvido.

O fluxo faz mais de uma chamada por apresentação, proporcionalmente ao total de slides. Grupos menores e recuperação limitada reduzem o tamanho de cada resposta; não constituem, antes do reteste real, garantia de menor duração, custo ou taxa de falhas.
