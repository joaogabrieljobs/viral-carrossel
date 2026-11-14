# Ajustes de geração após o teste dos nove modos

Data: 14/11/2026. Base de implementação: `04949f2`. Para publicação, integrado sobre `f6cc5ea`, preservando os 13 commits remotos de correções. O SHA e o estado final da publicação são conferidos na CI e na Vercel.

## Problema observado

A rodada real descrita em `narrativas-producao-2026-11-14.md` concluiu os nove modos, mas encontrou detalhes não fornecidos no briefing em todos eles. Oito produziram texto excessivo no Balanceado. A interface só mostrava os cards depois da revisão inteira.

## O que mudou

- **Fatos separados das instruções.** O material usado como evidência contém pedido, conteúdo, fontes extraídas, brief e bio. Exemplos dos templates e referências de voz não viram prova de uma informação. Instruções adicionais podem fornecer fatos, mas suas proibições não comprovam uma oferta.
- **Regras comuns aos nove modos.** Narrativa organiza o arco, sem autorizar novos eventos, números, prazos, canais, públicos ou garantias. O caso da dona de negócio com telefone antigo não pode ganhar “há dois anos” ou “mudou três vezes”. O CTA segue a ação solicitada.
- **Revisão em duas camadas.** O modelo confere fidelidade semântica, progressão, repetição e condições. Uma auditoria local verifica sinais objetivos, incluindo números por extenso, promessas comerciais, canais não informados, alguns absolutos e a legenda. Ela é uma barreira conservadora, não uma certificação factual universal.
- **A revisão também é conferida.** Se a revisão introduzir uma informação sem apoio, o campo anterior é preservado; correções úteis nos outros campos permanecem.
- **Balanceado consistente.** Título de até 72 caracteres/10 palavras, subtítulo até 140, corpo inferior opcional até 100, apoio total até 220. A auditoria considera os dois blocos, incluindo seu espaço separador, e aplica o mesmo contrato a todos os modos. Não há piso para preencher nem corte automático de frases.
- **Recuperação útil.** Fluxo normal: rascunho + revisão. Se a resposta ainda viola um limite mensurável, há no máximo um reparo direcionado. Não há nova tentativa automática de revisão em falha de rede. Se persistir o problema, o conteúdo completo fica salvo como rascunho, com aviso permanente e identificação dos cards/legenda a conferir. Imagens não começam nesse caso.
- **Prévia durante a revisão.** Criação guiada, modal e editor mostram os textos assim que a primeira resposta chega, com tempo decorrido e rótulo de rascunho. Trata-se do lote da primeira resposta, não de streaming de cada card pelo provedor. O resumo deixa espaço para a prévia na criação guiada, inclusive no celular.
- **Cancelamento e isolamento.** A prévia é efêmera e separada do histórico. Respostas tardias não substituem o documento. Trocar de projeto não leva a prévia do anterior. Cancelar preserva a prévia identificada, sem aplicá-la ao projeto.
- **Idioma e refinamento.** Idioma explícito prevalece; na ausência, segue o briefing. Metaprompt e `imageQuery` não definem idioma. Refinamentos sociais usam o mesmo limite, rejeitam novas alegações detectadas e mantêm a quantidade. A resposta de um refinamento individual usa o ID do card original. A regeneração de legenda também confere os sinais factuais.

## Verificação

- `npm test`: 169 arquivos, 1.745 testes aprovados; verificações de identificadores e props aprovadas.
- Playwright nas cinco suítes afetadas: 34/34 aprovados, com build de produção. Cobrem criação, modal, editor, controles de geração, revisão e painéis de IA.
- Inspeção visual da captura mobile em 390 px: prévia legível, alinhada e com rolagem vertical; sem exceder a largura da tela. O aviso de API não simulada visível na captura é do fixture de testes, não evidência de comportamento da produção.
- A separação final da fonte de apresentação tem regressão própria, para não aplicar o auditor social sobre evidência incompleta de um deck.

Regressões automatizadas cobrem as falhas concretas da rodada, os nove modos, apoio distribuído em dois campos, legenda, fatos positivos em instruções, negativas, numerais por extenso, revisão que piora o texto, cancelamento e reparo limitado. Testes de navegador cobrem prévia antes da resposta de revisão, mobile, editor/modal, rascunho pendente, persistência do aviso e ausência de consumo de imagens quando há pendências.

As chamadas de IA são simuladas nos testes. Ainda é necessário repetir o briefing com o provedor real após publicar para medir qualidade editorial e duração. Não se afirma ausência absoluta de invenções nem redução medida de tempo de geração.

Alterações de enquadramento de fotos e os relatórios de auditoria que já estavam no checkout foram preservados.

## Integração para publicação

O checkout local e o GitHub tinham divergido. A release incorpora a geração sobre o `main` remoto, incluindo os dois commits locais da assinatura MUSA/Branddy no rodapé. Os ajustes de enquadramento não commitados continuam no checkout original e não fazem parte desta publicação.

Foram mantidos o roteiro explícito e sua confirmação, recuperação de respostas incompletas, normalização de wrappers, lista de campos editáveis, avisos `normalizationIssues`, `onRetry`, orçamento de tokens por quantidade e identificadores estáveis das operações de imagem. A política de idioma do transporte respeita `contentLanguage` passado pelo chamador, sem inferir idioma do prompt técnico expandido. Os novos avisos de revisão também representam normalização e recuperação de título.

A suíte completa após integrar passou em 200 arquivos: 2.109 testes aprovados e quatro falhas esperadas preexistentes. As cinco suítes de navegação passaram em 41/41 casos; build, identificadores, props e acessibilidade passaram. A revisão final também corrigiu a fonte factual dos refinamentos e da legenda para incluir o Tema persistido; uma regressão adicional de navegador passou nos três fluxos usando apenas o Tema como fonte de números e preço. O portão remoto `quality → e2e → deployment-gate` deve aprovar o SHA publicado. O build sozinho da Vercel não substitui esse portão.
