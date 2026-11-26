# Moont: levar as melhorias da apresentação ao carrossel e criar o modo livre do carrossel

Análise feita em 26/11/2026 sobre a main `c11f948`, só com leitura de código. Nada foi mudado.

## O que o carrossel tem hoje

O carrossel já tem um motor de layout próprio, e ele funciona bem: 9 famílias sociais, 12 estilos virais e cerca de 60 layouts de card (capa, abertura, desenvolvimento, foto, afirmação, lista, comparação, fecho). Cada card pega o layout pela combinação de família, função do card e variante (`social-visual-composition.js`, `social-families.js`, `social-sequence.js`).

O que só o carrossel tem, e precisa ser preservado:

- os formatos 4:5, 1:1 e 9:16, com zonas seguras do Instagram e edição por formato;
- ficha visual e âncora de pessoa, para manter a mesma pessoa em todos os cards;
- fecho com CTA, seta "arraste" na capa e selo;
- logo por card, legenda, templates prontos, remix e OCR;
- piso de leitura de 28 px a 1080, pensado para o celular.

Das 12 melhorias da apresentação, só o PDF mais leve já vale para o carrossel.

## As 12 melhorias, uma a uma

| # | Melhoria | No carrossel hoje | Proposta | Risco |
|---|---|---|---|---|
| 1 | Roteiro com cena, regras e o que evitar | Não. O roteiro de cada card é só a função do modo narrativo | **Roteiro social** com cena-briefing e o que evitar por card, no mesmo pedido de texto | Médio: muda o pedido de texto do carrossel (há linha de base) |
| 2 | Ritmo de layout | Parcial: evita só 2 afirmações seguidas | Nunca 3 layouts iguais seguidos, com a lógica da apresentação | Baixo |
| 3 | Frase repetida, assinatura e diagnóstico do reparo | Parcial: pega só repetição em 3 ou mais cards | Frase repetida em 2 cards; assinatura (capa e fecho) fora da conta; desfecho gravado | Médio: decisão de produto, e um teste muda junto |
| 4 | Leitura e contraste | Parcial: 28 px e 4,5:1 nos fundos sólidos | 4,5:1 também com texto sobre foto e no selo | Baixo |
| 5 | Referência só pelo visual, com as cenas dos outros cards | Não: o pedido de imagem ainda manda copiar a composição | Mesmo texto da apresentação, mais as cenas dos outros cards | **Alto**: muda os pedidos de imagem do carrossel (catálogo de 22/11) |
| 6 | Direção visual por papel, cena-briefing e espaço do texto | Não | Direção visual do projeto e bloco de composição calculado pelas zonas do card e pelo formato | Médio |
| 7 | Paleta tirada da referência | Não | Ligar a extração também no carrossel e alimentar o desenho do projeto | Baixo |
| 8 | Modo livre | Não | **"Livre: o Moont decide" no carrossel** (abaixo) | — |
| 9 | Arte de fundo reaproveitada | Não | Só no modo livre: uma arte por projeto nos cards sem foto | Baixo (fica isolada) |
| 10 | Rótulo acima do título e títulos editoriais | O lugar existe (chapéu), mas a IA não preenche | Preencher o chapéu e pedir títulos curtos; obrigatório só no modo livre | Baixo |
| 11 | PDF com JPEG só nas páginas com foto | **Sim** | — | — |
| 12 | Apoio repetindo o parágrafo e meta dada como fato | Não | Ligar no caminho do carrossel | Baixo |

## Modo livre do carrossel ("Livre: o Moont decide")

Como funciona:

- **Escolha por card:** a IA, junto do roteiro social e sem pedido extra, escolhe para cada card o layout entre todos os do carrossel, mais a geometria retrato das 10 famílias da apresentação, que já funciona em 4:5, 1:1 e 9:16. Escolhe também o fundo (claro, superfície, escuro, destaque, foto inteira ou arte), o tamanho da foto, o bloco (lista, comparação, número grande, citação, ícones) e o negrito.
- **Identidade do projeto:** paleta e fontes valem para o projeto inteiro e vêm do kit ou da referência.
- **Regras garantidas em código:**
  - capa como gancho, com título de até 8 palavras e a seta;
  - fecho com CTA;
  - zonas seguras de cada formato;
  - piso de 28 px e contraste de 4,5:1;
  - nunca 3 layouts iguais seguidos;
  - card sem foto não gera imagem;
  - a mesma pessoa em todos os cards quando há âncora.
- **O que se reaproveita de `free-design.js`:** paleta e fontes do deck, normalizador, diretor determinístico (variedade, contraste) e checagem de violações.
- **O que se escreve novo:** as medidas de texto em 1080 por formato e as funções do carrossel (gancho, desenvolvimento, lista, prova, CTA) no lugar das páginas da apresentação (divisor, demonstração, dados).

## O que não pode mudar

- Projeto salvo abre igual.
- Texto, foto e ordem dos cards nunca mudam por recomposição.
- Foto enviada pelo usuário nunca some.
- Card com estilo próprio e zonas editadas à mão ficam como estão.
- A edição feita num formato vence a recomposição.
- A âncora de pessoa e a ficha visual continuam valendo.
- Os 12 estilos virais e as 9 famílias continuam iguais quando o modo livre não está escolhido.

Proteção:

- as suítes `social-*`, `qa-2411-carrossel-*` e `rt24-carrossel-*`;
- os e2e `generated-visual-design`, `geracao-editorial`, `sem-sobreposicao`, `titulo-*`, `export-*`, `marca-*` e `logo-*`;
- a linha de base de pedidos de imagem (`image-prompt-catalogo-final.json`, cenários A–E de carrossel) e de texto (`prompts-carrossel-catalogo-2211.json`).

Falta uma linha de base da composição do carrossel. Ela precisa ser criada **antes** de mexer, como foi feito na apresentação.

## Ordem proposta

1. **Rede de proteção, sem mudar comportamento:** linha de base da composição dos 9 estilos de família e dos 12 virais nos 3 formatos, com um deck de teste fixo.
2. **Melhorias seguras para todos os carrosséis:** 2 (ritmo), 4 (contraste sobre foto), 7 (paleta da referência) e 12 (apoio repetido e meta como fato).
3. **Melhorias que mudam a imagem ou o texto de todos os carrosséis, com decisão:** 3 (repetição e assinatura), 5 (referência só pelo visual), 6 (direção visual e espaço do texto) e 1 (roteiro social). Cada uma tem antes e depois do pedido, e o catálogo é atualizado de forma consciente.
4. **Modo livre do carrossel:** preset `social_free`, roteiro social com o design de cada card, diretor por formato, arte de fundo, chapéu e cartão "Livre" no seletor de estilo do carrossel.
5. **Conferência:** capturas nos 3 formatos, bateria completa e depois um teste real feito pelo João (a mesma Apoteose em carrossel de 8 cards, com o flyer).

## Decisões do João

1. **As melhorias da etapa 3 valem para todos os carrosséis ou só para o modo livre?** Valer para todos muda os pedidos de imagem e texto de quem já usa.
2. **Modo livre do carrossel:** começa nos 3 formatos ao mesmo tempo, ou primeiro no Feed 4:5 e depois Quadrado e Stories?
3. **Criar rápido do carrossel:** passa a usar o modo livre como padrão, ou continua com o estilo sugerido pela rota?

## Decisões do João (26/11)

1. As melhorias que mudam a imagem ou o texto (1, 3, 5 e 6) valem **só no modo livre**. Os carrosséis de hoje continuam iguais.
2. O modo livre do carrossel entra nos **3 formatos juntos**.
3. O Criar rápido **continua** com o estilo sugerido pela rota. O modo livre fica no seletor de estilo.

## Implementação da Frente B — 26/11/2026

Este adendo registra o código implementado depois do fechamento da Frente A, a partir de `cdd3a97`. As seções anteriores são a análise e as decisões originais; a implantação não amplia aquelas decisões para os estilos existentes. As 24 capturas-base de `head-5` foram inspecionadas individualmente; os gates finais da Frente B ainda estavam em andamento ao atualizar este registro.

### Entrada explícita e identidade do projeto

`social_free` é uma opção virtual de geração, chamada **Livre: o Moont decide**, no seletor do assistente e da geração. `SOCIAL_VISUAL_PRESET_CATALOG` acrescenta essa opção sem modificar os 21 itens de `VISUAL_PRESETS`. O Criar rápido conserva a rota e o estilo sugerido anteriores. Escolher Livre preserva a assinatura da marca — logo, cabeçalho e rodapé — e não reaplica um conjunto fixo de ornamentos.

O projeto continua sendo carrossel: `productKind: 'carrossel'`, formato social e plano `socialPlan`. Cada card persiste `socialFreeDesign`, `socialDeckDesign` e seu `socialPlan`, com cena, restrições, papel editorial e direção visual. Campos de blocos e arte já entendidos pelo renderer são reaproveitados, sem atribuir `presentationPresetId: 'presentation_free'`. O reconhecimento dos dois modos livres foi separado em código.

Paleta e fontes são compartilhadas pelo projeto. Cores explícitas do kit ou da marca prevalecem; amostras extraídas da referência mantêm seus pesos e alimentam os normalizadores usados na apresentação. A preferência por uma base escura saturada só atua sobre uma base neutra não explícita, dentro do contrato da Frente A. Não existe paleta, casting, acabamento ou conjunto de grafismos da Apoteose aplicado como padrão a outros projetos.

### Roteiro e revisão no mesmo fluxo de texto

`buildSocialFreePrompt` amplia somente o pedido opt-in. A primeira resposta contém a redação e as decisões visuais; não há uma chamada adicional de planejamento. O fluxo normal continua com redação e revisão, podendo fazer reparo editorial quando os diagnósticos o exigirem. A revisão conserva a direção da imagem e do layout.

O contrato pede capa de até oito palavras, chapéu sem numeração nos demais cards, contribuições distintas no miolo e CTA no fecho. A assinatura literal sustentada pelo material pode reaparecer na capa e no fecho; repetir a mesma frase em dois cards de miolo já é um problema. `bodyAfterImage` pode guardar a assinatura também na capa Livre. O acabamento e a revisão cuidam desses textos; o diretor visual não os reescreve para resolver geometria.

Listas, comparação, número grande, citação e ícones exigem conteúdo real. O normalizador conserva blocos declarados e pode converter pares presentes no texto em tabela, mantendo o contexto que não virou par. Os diagnósticos da revisão e as violações visuais ficam persistidos em `socialQuality`. Os pedidos e catálogos de texto dos estilos antigos conservam seu contrato.

### Diretor de composição nos três formatos

`applyFreeSocialDesign` escolhe geometria entre as famílias sociais e as dez famílias de apresentação, usando as funções de um carrossel. O cálculo usa medidas de 1080 px, não uma redução do slide horizontal. As vistas de outro formato derivam do mesmo design; uma vista editada manualmente prevalece sobre essa derivação.

| Formato | Medida | Faixa protegida no alto | Faixa protegida embaixo |
|---|---|---|---|
| Feed | 1080 × 1350 | 8,5% | 8,5% |
| Quadrado | 1080 × 1080 | 9% | 9% |
| Stories | 1080 × 1920 | 14% | 18% |

O piso de leitura é 28 px, incluindo apoio, chapéu, blocos e assinatura da marca. O ajuste do renderer para nesse piso mesmo quando sobra um problema de densidade. O contraste mínimo é 4,5:1; no texto sobre foto, o diretor calcula proteção contra o pior fundo claro sob o véu. Destaques recebem uma tinta legível por card, preservando a paleta original do projeto. Cabeçalho e rodapé sobre foto usam uma superfície protegida.

`socialFreeChromeGeometry` compartilha as posições automáticas e as reservas entre diretor e renderer. Logo, cabeçalho, handle, contador, barra e selo entram nas faixas seguras; Stories mantém também a elevação do rodapé. A reserva considera o retângulo real da marca. Nos cards quadrados mais densos, foto ou título podem ocupar a área livre ao lado dela, sem invadir o logo, reduzir a marca ou cortar conteúdo. Posições manuais permanecem sob controle do usuário.

A proteção do cabeçalho e da barra contra uma foto considera a interseção de seus retângulos efetivos, depois da margem segura e dos offsets. A posição antiga do chrome não é usada como aproximação. Essa verificação é exclusiva do Livre; os estilos anteriores conservam suas posições e sua detecção.

O diretor evita três geometrias iguais seguidas, registra uma troca necessária para o ritmo e conserva a família proposta quando possível. A seta aparece somente na capa. Arte pode aparecer em até três cards elegíveis, sempre sem foto; a geração compartilha um único asset de arte. Texto, CTA, logo e blocos continuam sendo camadas editáveis.

O chapéu tem prioridade na reserva de texto. Um fólio ou outro ornamento textual que colidir com ele é omitido somente naquele card Livre; o conteúdo editorial permanece inteiro.

### Fotos, arte, remix e persistência

O lote exclui cards com `photo: 'none'`. Uma solicitação individual explícita pode preparar uma zona de foto antes de chamar a IA, sem mudar a intenção salva usada pelo lote. Upload ou retorno de imagem aplica `socialFreePhotoPatch` na transição de mídia e persiste o resultado. A hidratação dos mesmos bytes ao abrir o projeto não dispara recomposição.

Em card manual, a foto utiliza uma zona existente ou um espaço livre; se não houver área disponível, pode ser inserida como fundo protegido. Zonas de texto, offsets e mídia do usuário não são apagados. Estilo próprio, canvas manual e edições por formato são reconhecidos antes de qualquer reset de estilo. A geração Livre também evita os ajustes genéricos posteriores que sobrescreveriam as zonas e escalas calculadas.

Quando a vista ativa tem uma composição manual salva, o reconciliador de mídia atualiza também essa entrada de `formatViews`. Isso evita que uma antiga zona de foto de 1×1 se sobreponha à foto recém-enviada no documento-base. A correção só ocorre diante de mídia nova em uma vista Livre: preserva as caixas de texto, os offsets, os demais cards e as outras vistas. Hidratação do mesmo asset e uma vista já convertida para estilo fixo não acionam essa adaptação.

Os pedidos de foto levam a cena do card, as cenas dos outros cards, a ficha visual e a âncora de pessoa já existentes. A referência de estilo fornece aparência; não autoriza copiar seu sujeito ou composição. O bloco de composição usa as zonas reais do card e o formato atual, inclusive uma vista editada. A arte usa a união das áreas de texto dos cards que a compartilham e respeita `graphics`, `finish`, iluminação e `avoid`, inclusive ausência de grafismos ou de grão.

O remix de texto conserva direção, geometria, mídia, blocos e rótulos aprovados, aplicando somente os campos de redação. Com imagens solicitadas, a cena pode ser atualizada nos cards que já admitem foto. A quantidade é preservada e cards sem foto continuam fora do lote.

### Evidência e limites da conferência

A linha de base de composição protege os 21 estilos anteriores nos três formatos; os catálogos existentes de pedidos de texto e imagem não foram regravados. Os testes novos cobrem opt-in, plano e revisão, direção da imagem, arte, piso e contraste, mudança de formato, importação de foto, remix e chrome. A correção das faixas da marca foi reproduzida antes da implementação: oito testes falharam; o conjunto focal seguinte passou com 143 testes, além de `check:undef` e `check:props`.

A detecção do header sobre foto teve seis casos vermelhos antes da correção e 149 testes focais verdes depois. O upload em vista manual foi reproduzido nas três direções de formato, com três falhas e duas guardas já passando; após a correção, a regressão focal A+B passou em 171 testes de nove arquivos. Esses conjuntos se sobrepõem e não devem ser somados como uma suíte única.

O E2E da Apoteose começa no assistente com uma conta vazia e recebe uma resposta de redação com plano, sem injetar um projeto composto. Confere geração, chamadas de imagem, persistência local e remota simulada, reabertura e geometria no DOM de exportação. As 24 capturas-base de `head-5` — oito de Feed, oito de Quadrado e oito de Stories — foram abertas em resolução nativa. A inspeção confirmou texto integral, tabela e lista completas, chapéus separados, arte visível, assinatura na capa e no fecho e rodapé dentro da faixa segura. As etapas adicionais de edição e os gates completos continuam necessários para fechar a Frente B.

APIs, armazenamento remoto e imagens geradas são simulados; isso prova a integração e os contratos enviados, não a qualidade artística de uma geração real da IA nem o serviço de produção. O retrato determinístico é repetido nos cards fotográficos e não foi composto para suas zonas; em Stories 1 e 3, o cabeçalho protegido atravessa partes do rosto. Essa limitação fica registrada na avaliação visual e impede tratar as capturas de teste como aprovação criativa da fotografia final.
