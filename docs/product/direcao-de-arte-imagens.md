# Direção de arte das imagens da apresentação

Pedido do João (26/11/2026). O deck da Apoteose que ele montou no ChatGPT ficou muito superior ao do Moont, e ele mandou o deck e os prompts que usou. Este documento leva para o código o método por trás desse resultado. Vale para todas as apresentações (roteiro v2 e v3). O carrossel continua fora do ciclo.

## Diagnóstico: Moont × ChatGPT

| Aspecto | ChatGPT | Moont hoje |
|---|---|---|
| Direção visual comum | Texto-base que dá a cada cor um papel e um hex: índigo `#171344` como base, laranja `#FF6A1A` como luz sobre as pessoas, magenta `#B41275` nas sombras, ciano `#27DDE5` nos grafismos e verde ácido `#60EC2E` em pequenos acentos. Somam-se acabamento (grão analógico, serigrafia), atmosfera e exclusões. | A referência vai anexada com "pegue só o visual". O modelo adivinha a paleta, e cada slide adivinha diferente. |
| Cena | É um briefing de foto: casting (pessoa, idade, tom de pele), figurino, ação, expressão, luz pela paleta e grafismos daquele slide. | Quatro campos curtos em inglês (subject, action, setting, shot), por exemplo "Crowd at a stylish party". |
| Imagem × layout | A imagem nasce com o espaço do texto definido, por exemplo "rosto nos 48% à direita; os 50% à esquerda índigo escuro para tipografia". A foto ocupa o slide inteiro e o texto fica sobre a área reservada. | A imagem é gerada sem conhecer o layout e depois recortada para o painel. |
| Fundo | Um fundo abstrato da identidade, gerado uma vez, serve para os slides de posicionamento, personalidade e fecho. | Página sem foto fica só com cor sólida, e cada foto custa uma imagem. |
| Texto | Títulos de autor ("Brasil na pista"), rótulo acima do título ("A FESTA"), slides só de texto em cor cheia e a personalidade em duas colunas. | Títulos longos e descritivos, sem rótulo. |

Montagem que o ChatGPT usa: referência visual + direção visual comum + personagem ou assunto + ação e expressão + enquadramento e espaço para o texto + luz, textura e grafismos + formato e restrições. A consistência vem da relação entre cor, luz e acabamento. Rosto, cena, figurino e enquadramento podem variar.

## O que muda

### 1. Direção visual do deck (`visualDirection`)

Fica no roteiro, uma vez por deck, sem nova chamada à IA. A Z.ai escreve, a partir do briefing e do kit (estilo escrito, cores da marca, descrição da referência quando existir):

- `palette`: 3 a 6 itens, cada um com `role` e `hex`. Os papéis possíveis são base, luz sobre o assunto, sombra, grafismo e acento.
- `finish`: acabamento da imagem (grão, textura, tipo de impressão, nível de realismo).
- `atmosphere`: clima em uma frase.
- `graphics`: linguagem dos grafismos e intervenções, ou "none".
- `avoid`: exclusões do deck.

O código valida em listas fechadas e hex válido. Com kit, as cores do kit têm prioridade sobre as propostas. No modo livre, a paleta do slide (`deckDesign.palette`) e a paleta da imagem (`visualDirection`) precisam combinar.

### 2. Cena como briefing

A cena de cada slide passa a ter os campos abaixo, todos opcionais e retrocompatíveis com o `scene` atual:

- `subject`: quem ou o quê, com casting quando houver pessoas;
- `wardrobe`;
- `action`;
- `expression`;
- `light`: pela paleta do deck;
- `graphics`: intervenções gráficas daquele slide;
- `shot`.

Diversidade de casting é pedida, nunca estereótipo. Pessoas reais e marcas não são reproduzidas.

### 3. Imagem que conhece o layout

O código calcula, a partir da composição final do slide, onde fica a área do texto e quanto ela ocupa. Esse cálculo entra no pedido de imagem como um bloco de composição, por exemplo: "keep the left 55% dark and quiet in the base colour for typography; place the subject in the right 45%".

Entra também uma composição **foto em tela cheia com texto sobre a área reservada**. O pedido de imagem reserva o lado do texto. O texto fica sobre essa área, com uma proteção leve de contraste e o mínimo de 4,5:1 garantido pelo código.

Ela é usada na capa e em slides de destaque, quando a família permite. No modo livre, `ground: 'photo'` passa a usar essa composição. O que já existe continua funcionando.

### 4. Arte de fundo reaproveitada (modo livre)

Uma imagem abstrata da identidade, sem pessoas, com o grafismo concentrado num lado e a maior parte lisa na cor base. Ela é gerada uma vez por deck e reaproveitada nos slides com `ground: 'art'`, um fundo novo do modo livre. Conta 1 crédito para o deck inteiro.

O diretor de arte usa esse fundo em até 3 slides sem foto. Sem crédito ou sem imagem, o fundo cai para a cor base.

### 5. Texto editorial

- **Título:** curto e de autor, com até 6 palavras quando possível, sem repetir o subtítulo.
- **Rótulo opcional acima do título** (`eyebrow`), de 1 a 3 palavras em caixa alta, renderizado pela família ou pelo modo livre.
- **No modo livre:** slide de texto em cor cheia (`ground: 'accent'` com título grande) entra no ritmo, e o bloco `comparison` aceita o par "traço / sem ser…" em duas colunas.
- **Fidelidade:** as regras de fato e de repetição continuam iguais.

## Regras que continuam valendo

Os itens abaixo não mudam:

- texto e logotipos nunca entram na imagem;
- contraste de pelo menos 4,5:1;
- ritmo de layout;
- piso de leitura;
- referência pelo visual, sem copiar pessoas;
- a assinatura do deck;
- o projeto salvo não muda ao abrir;
- o orçamento de tamanho do pedido de imagem: blocos novos entram com prioridade e corte definidos, e regras e composição nunca saem.

## Verificação

1. **Testes sem crédito:** o pedido de imagem completo do deck da Apoteose antes e depois, conferido bloco a bloco (direção visual, cena, composição com o percentual certo para o layout e restrições); layouts novos nas 10 famílias e no modo livre; capturas com fotos de teste.
2. **Geração real, com o sim do João:** gerar a Apoteose com o mesmo briefing e a mesma referência e comparar lado a lado com o PDF do ChatGPT.
