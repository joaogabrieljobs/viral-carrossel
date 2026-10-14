# Moont — identidade de marca

## Essência

**Moont** é a plataforma que transforma contexto em narrativas visuais. O nome
expressa movimento e continuidade: uma ideia avança por etapas, ganha direção e
chega a um formato publicável.

**Posicionamento:** plataforma de narrativas visuais para comunicação e
apresentações.

**Promessa principal:** ideias que ganham forma. Histórias que movem.

**Princípio de produto:** conteúdo com direção.

**Assinatura curta de campanha:** ideias em movimento.

O nome deve ser escrito sempre como **Moont**, com M maiúsculo em texto corrido.
No wordmark, a forma é minúscula. A pronúncia recomendada é curta, “munt”.

## Símbolo e wordmark

O símbolo **Sequência** antecede o wordmark minúsculo. Três quadros arredondados,
do mesmo tamanho, avançam em diagonal da esquerda para a direita e de cima para
baixo. A construção mostra uma ideia que progride quadro a quadro até ganhar
direção:

- o primeiro quadro é o **contexto inicial**;
- o segundo organiza o contexto em um **sistema narrativo**;
- o terceiro sinaliza o **produto pronto para circular ou ser apresentado**;
- a repetição cria ritmo; o deslocamento indica progresso sem depender de uma
  seta ou de um ícone literal de tecnologia.

A leitura conceitual da marca é **ritmo · sistema · produto**. Os três quadros
formam uma única unidade e devem manter dimensões, raio, sobreposição e distância
relativa fixos.

Na versão institucional sobre fundo claro, o primeiro quadro usa Midnight
`#090A0F`, o segundo usa Orbital Blue `#5B53E8` e o terceiro usa Aurora
`#D7FF5A`. Sobre fundo escuro, apenas o primeiro muda para Moonlight `#F3F0E7`;
azul e aurora permanecem inalterados. Em aplicações de uma cor, os três quadros
e o wordmark usam a mesma cor sólida: Midnight em fundo claro, Moonlight em
fundo escuro ou uma única tinta de produção com contraste equivalente. A versão
monocromática não usa diferenças de opacidade para reconstruir a sequência.

O componente `BrandLogo` desenha o símbolo e o wordmark como vetores SVG,
com contornos tipográficos fixos para manter a mesma assinatura em todos os
sistemas, sem depender de uma imagem rasterizada ou de uma fonte instalada. A
variante `wordmark` é a assinatura principal. A variante
`mark` é o símbolo compacto; `compact` e `symbol` são aliases aceitos.

### Regras de uso

- Use o wordmark a partir de 88 px de largura.
- Use o símbolo a partir de 20 px de largura. Entre 16 e 19 px, use somente a
  versão de favicon ajustada em pixel grid, com os três quadros ainda legíveis.
- Abaixo de 16 px, não use a composição completa. Use o favicon simplificado e
  valide a leitura no tamanho final.
- Em reduções, preserve a sobreposição e o deslocamento entre os quadros. Se a
  sequência perder definição, use uma versão otimizada para o tamanho em vez de
  comprimir o desenho.
- Preserve uma área livre ao redor da assinatura equivalente à altura de um dos
  quadros do símbolo.
- Sobre fundos escuros, use o wordmark Moonlight. Sobre fundos claros, use
  Midnight.
- Use sempre a versão clara, escura ou monocromática prevista. Não troque a
  ordem das cores nem aplique cores distintas das institucionais em cada quadro.
- Não gire, espelhe, estique, comprima, separe ou reorganize os três quadros.
- Não altere o raio, a sobreposição, o espaçamento ou a direção descendente do
  símbolo.
- Símbolo e wordmark não recebem gradiente, sombra, brilho, textura ou contorno
  adicional.
- Não reorganize letras e símbolo nem substitua a tipografia da assinatura.
- Não acrescente “AI” ou “Studio” dentro do logo. Descritores ficam ao lado ou
  abaixo, com distância mínima igual à altura de um “o”.
- Favicons e ícones de aplicativo podem usar o símbolo sobre um quadrado
  Midnight com cantos arredondados. Esse contêiner não integra a assinatura
  horizontal e não deve ser acrescentado ao wordmark.

### Acessibilidade

- Em links e cabeçalhos, o nome acessível é `Moont`.
- Quando o texto próximo já diz “Moont”, passe `alt=""` para tornar o SVG
  decorativo e evitar leitura duplicada.
- O azul orbital é uma cor de marca e de superfície. Não use azul pequeno sobre
  Midnight como texto corrente; use Moonlight.
- Em botões Aurora, use texto Midnight. Em botões Azul Orbital, use texto
  Moonlight.

## Paleta

| Token | Cor | Uso principal |
|---|---|---|
| Midnight | `#090A0F` | fundo principal, fundos de apresentação |
| Graphite | `#181B25` | painéis, cartões e superfícies elevadas |
| Moonlight | `#F3F0E7` | wordmark, títulos e texto principal |
| Mist | `#BBB9C7` | texto secundário, metadados e divisores |
| Orbital Blue | `#5B53E8` | quadro intermediário da marca, foco e Narrativa de comunicação |
| Aurora | `#D7FF5A` | quadro final da marca, Apresentações e momentos de conclusão |

O sistema deixa de usar magenta como cor principal. Durante a migração, o
magenta legado pode aparecer apenas em conteúdo antigo ou em presets criados
pelo usuário; não deve ser aplicado a novos componentes institucionais.

### Proporção recomendada

- 70% Midnight, Graphite e neutros;
- 20% Moonlight e Mist;
- 8% Orbital Blue;
- 2% Aurora.

Aurora funciona melhor como sinal: seleção, avanço, insight e confirmação. Uma
tela inteira em Aurora perde o sentido de destaque.

## Tipografia

O wordmark usa contornos vetoriais de Manrope ExtraBold (800), com escala uniforme nos dois eixos e espaçamento óptico compacto. Os contornos são independentes das fontes instaladas. A versão de interface reserva 272 × 55 unidades; nunca comprima as letras para caber em uma largura fixa.

Para produto e comunicação:

- **Display:** Manrope 600–800. Fallback: Inter, SF Pro Display, system-ui.
- **Interface e corpo:** Inter 400–700. Fallback: SF Pro Text, system-ui.
- **Dados e marcadores:** JetBrains Mono 500–700. Fallback: SF Mono, monospace.

Títulos usam entrelinha curta, de 0,95 a 1,1. Texto corrente usa 1,4 a 1,6.
Evite caixa alta em parágrafos. Caixa alta fica reservada para pequenos rótulos,
índices e categorias.

## Arquitetura de produtos

### Moont

É a marca principal e aparece no login, cobrança, biblioteca, conta e navegação
global. Não é necessário repetir “Studio” na interface.

**Descrição:** crie narrativas visuais a partir do seu contexto.

### Moont Comunica — Narrativa de comunicação

É a evolução do produto antes chamado Viral Carrossel. “Carrossel” continua
existindo como formato de saída, junto de feed, quadrado e stories; deixa de ser
o nome da plataforma.

**Promessa:** transforme contexto em uma narrativa que circula.

**Cor de orientação:** Orbital Blue.

Ao abrir um projeto Comunica, foco, seleção e ações principais usam Orbital
Blue. O símbolo Moont mantém a sequência institucional de três quadros.

**Estrutura narrativa típica:** gancho → tensão → desenvolvimento → prova →
síntese → convite. O conteúdo é curto, sequencial e pensado para leitura
individual na tela.

`Moont Comunica` é o nome da família. `Narrativa de comunicação` é o descritor
que explica o produto na navegação, no onboarding e nas telas de criação.

Rótulos de interface recomendados:

- `Moont Comunica`
- `Narrativa de comunicação`
- `Criar narrativa`
- `Formato social`
- `Cards`

### Moont Apresenta — Apresentações

É uma experiência própria da Moont, e não um carrossel redimensionado. Usa
formato horizontal, leitura à distância, progressão argumentativa e espaço para
evidências.

**Promessa:** transforme contexto em uma apresentação que conduz decisões.

**Cor de orientação:** Aurora.

Ao abrir um projeto Apresenta, foco, seleção e ações principais usam Aurora,
sempre com texto Midnight para manter contraste. O símbolo Moont mantém a
sequência institucional de três quadros.

**Estrutura narrativa típica:** promessa → contexto → problema → evidência →
raciocínio → recomendação → próximos passos. A capa, as divisórias, os slides de
prova e o fechamento têm composições específicas.

`Moont Apresenta` é o nome da família. `Narrativa de apresentação` identifica o
método, enquanto `Apresentações` é o rótulo direto para seleção e biblioteca.

Rótulos de interface recomendados:

- `Moont Apresenta`
- `Narrativa de apresentação`
- `Apresentações`
- `Criar apresentação`
- `Formato 16:9`
- `Slides`

Os dois produtos compartilham marca, conta, contexto, biblioteca e editor. A cor
de orientação e os termos `cards`/`slides` ajudam a pessoa a entender em qual
experiência está sem criar duas marcas independentes.

## Linguagem visual

### Movimento

O movimento segue uma progressão quadro a quadro: entradas curtas, intervalos
regulares e continuidade entre estados. Use transições de 180–280 ms. Quando o
símbolo for animado, revele os quadros na ordem Midnight/Moonlight → Orbital
Blue → Aurora e encerre em estado estático. Evite loops e animações decorativas
que distraiam da criação.

### Formas

- quadros arredondados organizam ideias em etapas legíveis;
- sequências em diagonal indicam avanço e continuidade;
- grades editoriais organizam informação;
- a área de trabalho permanece discreta para o conteúdo ser protagonista.

### Imagens

Prefira imagens com sujeito claro, contraste controlado e espaço negativo para
texto. Em Narrativa de comunicação, recortes podem ser mais próximos e
dinâmicos. Em Apresentações, prefira enquadramentos panorâmicos, diagramas e
provas visuais legíveis à distância.

## Voz

A Moont fala como uma diretora editorial: clara, segura, prática e interessada
no resultado. Explica a próxima ação sem transformar a interface em tutorial.

Princípios:

1. **Direção antes de entusiasmo.** “Escolha o formato” é melhor que “Comece sua
   jornada incrível”.
2. **Verbos concretos.** Criar, organizar, ajustar, apresentar, publicar.
3. **IA em segundo plano.** A pessoa cria; a tecnologia organiza e acelera.
4. **Uma ideia por frase.** Textos curtos, sem jargão de agência.
5. **Resultado observável.** Diga o que será criado ou alterado.

Exemplos:

| Situação | Texto Moont |
|---|---|
| CTA global | `Criar com a Moont` |
| Seletor social | `Criar narrativa` |
| Seletor de deck | `Criar apresentação` |
| Geração | `Organizando sua narrativa…` |
| Ajuste automático | `Ajustar conteúdo ao quadro` |
| Sucesso | `Apresentação pronta para revisar` |
| Vazio | `Adicione contexto para começar` |

Evite “viral garantido”, “mágica”, “revolucionário”, “em um clique” e promessas
de resultado que a plataforma não controla.

## Migração do nome anterior

1. Trocar o wordmark e os nomes institucionais por Moont.
2. Renomear o modo de carrossel para **Narrativa de comunicação**.
3. Manter `carrossel` apenas como formato e em textos necessários para busca e
   onboarding durante a transição.
4. Identificar o modo horizontal como **Apresentações**, com termos e padrões
   narrativos próprios.
5. Atualizar favicon, metadados, e-mails, cobrança e arquivos exportados depois
   que domínio e registro forem confirmados.

Antes do lançamento público, validar disponibilidade jurídica, domínio e nomes
de usuário. A identidade definida aqui não substitui busca de marca no INPI.
