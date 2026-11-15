# Geração de apresentações com planejamento e revisão

Versão inicial: 21/10/2026. Atualizado em 14/11/2026. Aplica-se à geração de novas apresentações nos sete
caminhos do Moont. Carrosséis e remix mantêm o fluxo existente.

## Etapas e contratos

1. **Material.** `presentation-material.js` divide as fontes em trechos,
   seleciona conteúdo por relevância e distribui a leitura ao longo do documento.
   O orçamento do bloco completo é 58 mil caracteres, incluindo referências e
   brief do projeto. Uma fonte sem texto legível não vira evidência. O fluxo
   social continua com o orçamento anterior.
2. **Roteiro.** `presentation-plan.js` produz e valida um contrato versionado
   antes da redação: objetivo, público, tese, fatos/propostas/lacunas e a função
   de cada slide. Evidências possuem IDs e citações que precisam existir nos
   trechos selecionados. Isso estabelece rastreabilidade; não verifica a verdade
   externa de uma fonte ou a interpretação semântica do modelo. O orquestrador
   `presentation-planning.js` permite uma recuperação para resposta truncada,
   JSON inválido ou contrato rejeitado. Usa system prompt próprio e teto de
   8.192 tokens; diagnósticos contêm códigos, posições e metadados de uso,
   sem texto privado. Só um roteiro validado chega à prévia e à redação.
3. **Redação.** A escrita recebe o roteiro validado e os limites da composição.
   Não recebe liberdade para executar código ou escolher coordenadas. Notas de
   apresentação são salvas no campo editável `caption` de cada slide. A escrita
   ocorre em grupos de até três slides, com uma recuperação por grupo. Cada
   grupo válido aparece na prévia antes de os próximos ficarem prontos. Se um
   grupo posterior falhar, o resultado preserva os slides concluídos, marca
   a apresentação como incompleta e informa a quantidade solicitada e obtida.
4. **Revisão editorial.** Desde `7d9d8f5`, usa um sistema próprio de revisão,
   `PRESENTATION_REVIEW_SYSTEM_PROMPT`, separado do sistema de redação. Recebe
   o pedido, as instruções atuais completas e os textos ou trechos originais
   selecionados das fontes. Não reutiliza o prompt expandido de geração com
   receitas visuais e exemplos de estilo. O roteiro fornece somente posições,
   funções e perguntas; suas afirmações geradas não servem como evidência.
   O rascunho inclui texto visível, blocos nativos, notas e resumo para conferência.
   A resposta aceita apenas `edits` e `caption` geral opcional. Cada edição usa
   índice, motivo e campos de conteúdo permitidos; não pode devolver outro deck,
   mudar imagens ou configurações visuais. Há uma revisão e, se os limites
   editoriais ainda exigirem correção, no máximo um reparo restrito aos slides
   afetados. O fluxo não corta frases por caracteres: se o reparo falhar, mantém
   o rascunho completo e informa que precisa de atenção. Resultados que precisam
   de atenção não iniciam geração de imagens.
5. **Composição.** `presentation-composition.js` associa funções a seis
   geometrias permitidas. Comparações, indicadores e sequências podem usar
   blocos nativos editáveis. A função planejada prevalece sobre a distribuição
   proporcional de estágios. Apresentações para leitura autônoma e para fala
   recebem orçamentos de texto diferentes.
6. **Conferência.** `presentation-quality.js` verifica áreas de texto e dados
   antes da montagem e mede a árvore real de exportação após fontes e imagens.
   Quando há transbordamento, `presentation-render-review.js` pode solicitar
   uma única reescrita dos slides afetados, preservando números, condições e
   notas. Alterações feitas pelo usuário enquanto a IA responde prevalecem.
   O resultado é medido novamente. Problemas restantes são informados; uma
   exportação com falhas detectadas é interrompida com mensagem acionável.
   Se uma fonte ou imagem impedir a conferência depois de o rascunho estar
   salvo, a apresentação permanece editável, com estado de conferência
   indisponível e aviso. Isso não exige outra geração; a exportação continua
   verificando fontes, assets e layout.

O percurso normal usa uma chamada de roteiro, uma por grupo de até três slides
e uma de revisão. Os limites da orquestração são duas chamadas de roteiro,
duas por grupo de redação, uma revisão mais um reparo editorial e uma única
reescrita visual por transbordamento real. São limites por etapa; o transporte
pode usar sua recuperação finita de indisponibilidade do provedor. Todas essas
etapas solicitam até 8.192 tokens e resposta sem raciocínio separado nos modelos
Z.ai que suportam essa opção; outros modelos mantêm suas configurações
compatíveis. O backend preserva essa opção e aplica o mesmo teto de tokens.
Não há repetição automática ilimitada.
Cancelamento e troca de projeto impedem a aplicação de respostas tardias. Na
criação de apresentação nova, cancelar permite abrir e salvar os grupos já
validados como rascunho incompleto no mesmo projeto. Não se substitui conteúdo
de um projeto existente ou remix com essa recuperação.

## Continuidade instrucional da Aula

As instruções atuais completas são passadas separadamente ao planejamento,
à recuperação do roteiro, a cada lote de redação e à revisão. Assim, uma
restrição no fim dessas instruções não depende do recorte do briefing. A seleção
limitada de trechos das fontes continua existindo e não é ampliada por isso.

No caminho Aula, o planner recebe o contrato de atividade e correção antes de
distribuir as posições. A redação de um lote posterior recebe os campos textuais
e blocos de até quatro atividades anteriores marcadas como `purpose=practice`,
além dos títulos de continuidade. Esse conteúdo gerado não se torna evidência:
a correção deve conferir a mesma tarefa, entrega e critério nas fontes originais.
Título, apoio e notas precisam tratar do mesmo objeto. A resposta modelo mantém
lacunas do caso, e a transferência para o contexto do participante vem depois.

A revisão pode aproveitar uma posição redundante ou comercial sem função
pedagógica para corrigir a mesma atividade, preservando quantidade, ordem física
e mídia. A presença de uma oferta na fonte não exige páginas comerciais na Aula.
Esses ajustes não acrescentam chamadas de IA nem alteram o schema. Os testes
verificam a propagação integral das instruções e o conteúdo transmitido entre
lotes; não certificam que o modelo produziu um debrief semanticamente correto.
Essa aderência exige avaliação de uma nova amostra real.

## Conferência factual e limites

O guard local usa o contexto factual fornecido, as instruções atuais e os
textos/excertos originais das fontes. Nunca usa os fatos ou citações produzidos
pelo próprio plano como prova. Inspeciona títulos, subtítulos, corpo, resumo,
blocos nativos e notas de apresentação. Suspeitas são sinalizadas para revisão;
o conteúdo não é apagado nem reescrito mecanicamente para passar no guard.

Essa conferência é conservadora: identifica classes de números, condições e
alegações comerciais por correspondência literal ou normalização limitada.
Uma paráfrase legítima ou um cálculo pode exigir conferência manual. Exclusões
explícitas e títulos sem item concreto, como “O que o serviço inclui e exclui”,
não são tratados como promessa de inclusão; itens concretos continuam exigindo
base no material. Instruções negativas não comprovam a promessa que proíbem.

O guard não é um verificador semântico completo. Nomes, datas, mudança de estágio
de uma decisão, causalidade e condições contratuais também dependem da revisão
editorial e da avaliação humana do resultado. Uma resposta `edits: []` informa
apenas que o modelo não solicitou alterações, não certifica a fidelidade do
deck. Da mesma forma, uma citação literal válida estabelece rastreabilidade,
não a verdade externa da fonte nem que toda interpretação do trecho está correta.

## Imagens e compatibilidade

- Uma decisão de não usar imagem no roteiro é preservada na redação.
- Blocos nativos não geram imagens de tabelas ou indicadores.
- Fotos novas usam a proporção da moldura, `cover` e enquadramento automático.
  A análise local de detalhe/rostos ajuda a escolher o recorte; ela não certifica
  semanticamente que um produto inteiro ou todas as pessoas estão visíveis.
- Projetos antigos não recebem novos bloqueios geométricos por falta de
  metadados. A proteção anterior contra texto excedente permanece ativa.
- Padrões personalizados mantêm sua composição livre e não recebem blocos
  automáticos que seu layout não sabe acomodar.
- Textos, blocos, notas, intenção visual e tamanho da logo sobrevivem à
  reabertura. Ajustes manuais por formato continuam prevalecendo.

## Avaliação

Os testes de contrato usam casos de apresentação conceitual, proposta, relatório,
pitch e aula. Verificam citações falsas, origem inexistente, modalidade,
cancelamento, perda de condições, limites e conteúdo editável. São avaliações
determinísticas; não simulam uma nota de qualidade de um modelo real.

A validação local do ajuste de continuidade instrucional passou em 258 testes
de dez suítes, incluindo regressões de Social e Pitch. Esse resultado verifica
contratos e orquestração; não registra uma nova geração real como aprovada.

Os testes de navegador cobrem os sete caminhos, texto desenvolvido, geração de
imagem por moldura, edição de tabela, persistência, troca de formato e PDF.
O material final do ÉTER orienta os critérios de profundidade, variedade e
integridade visual. Seus textos e sua identidade não são inseridos nos prompts
de outros clientes.

Antes de trocar prompts/modelos, comparar amostras reais de geração: cobertura
dos pontos essenciais, progressão, fidelidade das condições, variedade visual,
legibilidade e o arquivo exportado. Uma suíte de contrato verde não substitui
essa revisão editorial de amostras.
