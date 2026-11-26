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
