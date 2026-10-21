# Geração de apresentações com planejamento e revisão

Versão inicial: 21/10/2026. Aplica-se à geração de novas apresentações nos sete
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
   externa de uma fonte ou a interpretação semântica do modelo.
3. **Redação.** A escrita recebe o roteiro validado e os limites da composição.
   Não recebe liberdade para executar código ou escolher coordenadas. Notas de
   apresentação são salvas no campo editável `caption` de cada slide.
4. **Revisão editorial.** Confere a redação com o roteiro e as evidências.
   Há uma tentativa adicional apenas para slides que excederam os limites.
   O novo fluxo não corta frases por caracteres: se o reparo falhar, mantém
   o rascunho completo e informa que precisa de atenção.
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

O percurso normal usa três chamadas de texto: roteiro, redação e revisão. Pode
usar mais uma para texto acima dos limites e mais uma para transbordamento real.
Não há repetição automática ilimitada. Cancelamento e troca de projeto impedem
a aplicação de respostas tardias.

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

Os testes de navegador cobrem os sete caminhos, texto desenvolvido, geração de
imagem por moldura, edição de tabela, persistência, troca de formato e PDF.
O material final do ÉTER orienta os critérios de profundidade, variedade e
integridade visual. Seus textos e sua identidade não são inseridos nos prompts
de outros clientes.

Antes de trocar prompts/modelos, comparar amostras reais de geração: cobertura
dos pontos essenciais, progressão, fidelidade das condições, variedade visual,
legibilidade e o arquivo exportado. Uma suíte de contrato verde não substitui
essa revisão editorial de amostras.
