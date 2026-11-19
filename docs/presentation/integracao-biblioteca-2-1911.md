# Integração da biblioteca 2.0 no Moont — 19/11/2026

## Escopo e referência

Biblioteca recebida nos arquivos `Moont-biblioteca-templates-2.zip` e `Moont-galeria-templates-2.zip`, construída sobre o recorte de `9131b79`. Referência visual confirmada pelo dono: https://claude.ai/artifact/UTfgWKaQppAirUiT2F1PEN#grid.

Decisão do dono: substituir apenas os templates de apresentação. A melhoria dos carrosséis será uma segunda etapa, com rodada própria. Nenhum preset social foi redesenhado nesta integração. A adaptação 4:5 recebida é tratada como compatibilidade de um deck, sem representar aprovação da criação de carrosséis.

O catálogo de seleção apresenta as dez famílias novas. Os seis IDs antigos continuam ocultos e resolvíveis para leitura dos projetos existentes; não há migração em massa dos documentos salvos.

## Integração e correções

- Aplicação limpa do patch sobre o checkout completo, sem usar o substituto de `formats.js` do ensaio externo.
- Fontes locais: 25 faces WOFF, convertidas dos TTF recebidos, preservando cmap e variações. Arquivos e licenças OFL acompanham o produto em `public/fonts/presentation/`. Proveniência e hashes em `fontes-locais.json`.
- Studio e exportação declaram as mesmas faces. A exportação exige a face realmente carregada e recusa a ausência das famílias novas; não trata Instrument Sans/Barlow como fontes de sistema.
- A família selecionada chega à camada de imagem da geração, inclusive no Pitch. O briefing prevalece sobre exemplos de assunto da direção fotográfica, e as regras contra provas e screenshots inventados continuam valendo.
- Templates novos também se aplicam pela edição manual, sem exigir `presentationPlan`. Prompts dos presets atuais deixam de herdar os tetos antigos de subtítulo de 40 caracteres.
- Compatibilidade da composição versão 3 com o cálculo compartilhado da proporção de imagem e com a normalização da logo ao reabrir documentos.
- Argumentos longos do Pitch, inclusive em capas e divisores sem foto, recebem área de leitura maior e corpo de pelo menos 30 px na referência 1920; o texto não é apagado para caber. Redação nova continua sujeita aos limites de cada página.
- Conversão do tracking do subtítulo considera a base −1 do controle; o texto não recebe um espaçamento adicional de −0,01 em.
- Texto sobre fotografia recebe tinta explícita e proteção de contraste. O laranja da família Tipográfica foi escurecido de `#FF4D1F` para `#E44318` para atender ao contrato de contraste do destaque.
- Expectativas antigas dos testes foram atualizadas para as novas fontes, superfícies e layouts. Permanecem os controles de integridade, limites, preservação do conteúdo e acesso a projetos antigos.
- Quadros de documentos anteriores conservam o renderer de evidência legado até a reaplicação do template. Ao escolher um preset pessoal, são limpos os descritores gráficos e o tratamento de foto do template oficial anterior.

## Verificação e limites

Primeira suíte do patch no repositório real: 1.495 testes passaram e quatro falharam. A suíte completa revelou incompatibilidades adicionais do contrato de versão e expectativas do catálogo antigo. Logs das rodadas e insumos originais ficam na pasta durável `INTEGRACAO-TEMPLATES-19-11-2026`, fora de `test-results/`.

Novas regressões locais cobrem ausência de fontes, registro antes do export, direção fotográfica por família, preservação do prompt social, escolha manual, quadros legados e reabertura com logo. A suíte completa final aprovou 4.132 testes, com quatro falhas esperadas, em 228 arquivos. Build e verificações estáticas passaram. A CI deve validar o próprio commit; o portão anterior de 9131b79 não aprova esta integração.

Foi aberto em Chrome real um ensaio isolado com o `SlideCardInner` do aplicativo, fontes locais e fotos ilustrativas do pacote. Foram inspecionadas páginas Editorial e Cinemática, com capa, seção, conteúdo, fotografia, tabela e encerramento em diferentes posições da rolagem. A inspeção ainda não cobre todas as páginas das dez famílias nem comprova nitidez em resolução final.

`scripts/build-presentation-library-review.mjs` reproduz esse ensaio com proveniência e aviso de limites. `tests/e2e/presentation-library-browser.spec.js` usa o editor real com serviços simulados para verificar seis páginas por família, fontes locais, overflow e quadros, além de guardar capturas de capa, evidência e encerramento. A exportação continua sujeita aos cenários próprios da suíte do app.

Não houve geração com IA real nesta integração; os prompts melhorados permanecem sem confirmação de qualidade por geração real. A galeria do designer usa renderer simplificado, enquanto o ensaio e os testes descritos acima usam o renderer do Moont. As fotos recebidas de cerca de 1.000 px são demonstrações, sem garantia de qualidade para sangria em 1920.

Não publicado em produção nesta etapa. Resultados finais de testes e CI devem ser registrados no relatório da rodada, com o SHA validado.

## Verificação da rodada da tarde (antes do push)

- Vitest completo: 229 arquivos, 5.580 testes aprovados e as 4 falhas esperadas. `check:undef`, `check:props`, `check:a11y` e `npm run build` sem erro.
- `presentation-library-browser.spec.js`: as dez famílias, seis páginas cada, em 16:9 e nas três adaptações, com fontes locais carregadas, texto completo, sem overflow, evidência sem corte, original 16:9 intacto e reabertura no formato salvo. A falha anterior de reabertura era do teste (recarregava antes do autosave gravar o formato) e do estado de carregamento da foto (`bgImageFailed`/`bgImageError`) comparado como conteúdo.
- `presentation-library-export.spec.js` (novo): Editorial, Cinemático e Técnico exportam PDF de 6 páginas 16:9, ZIP com 6 PNG (5760 × 3240) e PNG de Stories (3240 × 5760); o PNG repete a composição do preview (deslocamento ≤ 4 px).
- Suíte E2E completa com `SEM_FONTES_DA_REDE=1`: 311 aprovados, 18 pulados, 1 falha em `project-creation-flow.spec.js:710`. A mesma falha ocorre em 1 de 5 repetições no `5502ee0` sem as mudanças desta rodada; no estado atual passou 5 de 5 e o arquivo inteiro passou. A CI tem uma nova tentativa automática.
- Inspeção visual: as dez famílias, seis páginas, quatro formatos, no `SlideCardInner` real (ensaio `RENDERER-REAL.html`), mais PNG exportado contra preview em três famílias. As fotos são do pacote do designer (~1.000 px) ou a foto local de teste; não comprovam nitidez de sangria em 1920 nem pertinência semântica.
- Não houve geração com IA real.

## Adaptações para Feed 4:5, Quadrado 1:1 e Stories 9:16 (rodada da tarde)

As apresentações das dez famílias agora são recompostas pela família nos três formatos sociais (`presentationForSocialFormat` → `familyCarouselAdaptation(source, fmt)`), em lugar do fallback genérico que valia para Quadrado e Stories. O dado canônico continua em 16:9; trocar de formato muda só a vista, e a vista escolhida persiste ao salvar e reabrir.

- **Stories**: título, apoio e quadros ficam entre 14% e 82% da altura, as mesmas áreas seguras de `formats.js` (`topSafePct: 14`, `bottomSafePct: 18`, ou 269 px e 346 px em 1080 × 1920). É mais conservador que as zonas de 210/300 px do pacote do designer, que também ficam respeitadas. Fotos de sangria continuam até a borda; a faixa vazia na base é a área segura, intencional.
- **Quadrado**: parte da composição retrato da família com hierarquia própria (título ×0,82, leitura ×0,9, piso de 56/25 px). Círculos decorativos passam a acompanhar a altura útil (diâmetro ×0,8); sem isso, no Cultural o círculo da abertura cobria o título.
- O pacote posterior do designer (`Moont-biblioteca-templates-2 (3).zip`, patch 5/5) trazia uma implementação paralela dos mesmos formatos. Ela não foi reaplicada: a do checkout já estava integrada e validada no navegador. Do pacote foram adotados o contrato das zonas do Stories e os dois pontos de revisão apontados (faixa inferior do Stories e fio do Tipográfico no quadrado).

## Defeitos encontrados na inspeção visual e corrigidos

Inspeção feita no renderer real (`SlideCardInner`), nas dez famílias, seis páginas cada, em 16:9, Feed, Quadrado e Stories, com fontes locais carregadas e conferidas.

1. **Fios atravessando o texto.** Quando a pilha título → apoio sobe (título mais curto que a zona) ou a leitura ocupa a área de uma evidência ausente, fios fixos ficavam dentro do apoio. Aparecia no Tipográfico (conteúdo, demonstração e evidência), no Editorial (capa sem foto), no Suíço (evidência sem quadro, inclusive o fio vertical no 16:9) e no Tipográfico 16:9 (fio sobre o topo do quadro). `keepRulesOffText` reposiciona o fio horizontal no vão acima do apoio ou do quadro e encurta o vertical antes do texto; sem vão, o fio sai, nunca o texto. Novo contrato nos 1.920 casos geométricos: nenhum fio cruza título, apoio ou quadro.
2. **Acento do Anton colidindo com a linha anterior.** Medido no navegador: a maiúscula acentuada do Anton (É, Á, Ô) sobe 110% do corpo; com entrelinha 1,03 o acento de “É VERBO” tocava o pé do “L” de “LER”. Entrelinha do Tipográfico passou para 1,15. As outras nove famílias têm folga positiva entre a maiúscula acentuada e a linha de base anterior.
3. **Títulos de conteúdo na cor secundária.** O renderer aplicava a regra legada do carrossel (cards do meio com a cor do apoio) e os títulos de conteúdo, demonstração e evidência saíam em `muted` (ex.: `#4A4740` no Tipográfico, `#A39E95` no Cinemático). A galeria de referência usa a tinta da família em todas as páginas. Corrigido só para `presentationArtDirectionVersion: 2`; carrosséis e projetos antigos não mudam.
4. **Fólio ilegível em fundo invertido ou de cor** (aberturas do Executivo, Suíço, Cultural, Modular). O fólio usava a cor de texto da marca em todas as páginas; agora usa a tinta gravada para o fundo da página.
5. **Fólio encostado nos cartões no Quadrado** (Modular). Distância da base ajustada só no 1:1.
6. **PNG/PDF diferente do preview: título e apoio ~26 px mais baixos no arquivo.** O DOM de exportação era idêntico ao do editor; o desvio nascia no clone do html2canvas: o ajuste de “placas de texto escuras” tratava fundo transparente (`rgba(0,0,0,0)`) como placa e somava padding às zonas. Para a biblioteca 2.0, fundo com alfa 0 deixa de ser placa e a folga do `h1` é devolvida por margem. Medido por correlação de perfis em 1920 px: 25 px antes, até 4 px depois.
7. **Tratamento de foto ausente no arquivo.** html2canvas ignora `filter` CSS; o clone de exportação aplica o filtro da família no bitmap da foto (com fallback de pixels). Regressão lê pixels do PNG do Suíço.

O mesmo falso positivo de placa existe na exportação de carrosséis e projetos antigos; não foi alterado aqui para não mudar arquivos já publicados sem uma rodada própria.

## Diferenças que permanecem

- Conteúdo curto deixa vazio na metade inferior em várias páginas (Editorial conteúdo, Suíço evidência 16:9, Modular cartão alto). É o comportamento documentado pelo designer; a correção é editorial (mais texto) e não foi feita completando conteúdo.
- O apoio (`subtitle`) sai na cor `muted` em fundo claro; a galeria do designer usa a tinta cheia no apoio e `muted` só no corpo. Não alterado nesta rodada.
- Círculos do Cultural ficam ao lado do título em capa, evidência e encerramento; com títulos bem mais longos que os do exemplo o texto pode passar sobre o círculo (mesma geometria no 4:5 original do designer).
- Técnico 1:1: o rótulo “§01 · RFC interna” fica muito junto da base da foto e das marcas de corte.
- No Modular retrato o cartão de acento ao lado do numeral é uma superfície lisa, sem conteúdo.
