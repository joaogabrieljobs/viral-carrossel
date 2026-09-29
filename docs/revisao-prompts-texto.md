# Revisão editorial dos prompts de texto — 22/09/2026

Registro da primeira etapa. A implementação posterior, incluindo limite de cinco hashtags e validação da resposta, está em [Geração editorial por objetivo](product/geracao-editorial-por-objetivo.md). O patch associado a esta revisão é o registro da primeira etapa.

## Diagnóstico

Os prompts favoreciam títulos formulaicos, abstrações de mercado e preenchimento de espaço. A ordem dos blocos deixava o modelo resolver conflitos entre regras de volume. Além disso, a legenda perdia parte do argumento porque não recebia `bodyAfterImage`; a geração inicial de `caption` não recebia as regras usadas ao regenerar legenda.

Esta revisão altera builders, o system de texto e conexões pontuais nos handlers. Não altera transporte de API, billing, UI ou gerador de imagens. As mudanças preexistentes nesses outros arquivos foram preservadas.

## Achados priorizados e mudanças aplicadas

As linhas abaixo são referências do código revisado; a coluna “antes” descreve o problema encontrado, não um resultado medido de geração.

| Prioridade | Local | Antes | Aplicado |
|---|---|---|---|
| 🔴 | `src/utils/generation-prompts.js:598` | Cultura mandava deixar o corpo do fecho vazio e também exigia corpo no “miolo e fecho com foto”. | Sanduíche restrito ao miolo; fechamento explícito na última posição, inclusive para N diferente de 9. |
| 🔴 | `src/utils/generation-prompts.js:770` | Personalizado 1/1 combinava 200–320 caracteres no miolo com 260–403 acima da foto; o fecho recebia teto 140 e faixa de miolo ao mesmo tempo. | Seleção única do layout híbrido, preservando o arco narrativo. Slide 2 desenvolve; não vira segunda abertura. |
| 🟠 | `src/utils/generation-prompts.js:454` | Uma instrução de tom ou URL sem texto já elevava todo o “material” acima do tema. | Tema define recorte; fontes sustentam fatos; voz não troca assunto; URL sem extração não comprova conteúdo. |
| 🟠 | `src/utils/generation-prompts.js:1150`, `ViralCarrossel.jsx:2540` | Legenda ignorava texto abaixo da imagem, exigia 8–12 linhas mesmo em modo curto e podia duplicar CTA/assinatura. | Contexto completo, limite de 2200 caracteres no prompt, parágrafos por conteúdo, uma ação final. Regras usadas também na geração principal. |
| 🟠 | `src/utils/generation-prompts.js:954` | Refine não sabia a faixa da posição no híbrido e recebia apenas títulos como contexto dos demais slides. Cultura incentivava expansão automática. | Contexto com os três campos, faixas por posição, preservação de função/voz/fatos e expansão apenas quando necessária ao pedido. |
| 🟠 | `src/utils/generation-prompts.js:1198` | O exemplo de JSON misturava conteúdo e instruções, inclusive valor inválido ilustrativo de `cultureTone`. | Exemplo parseável com strings; quantidade explícita; enum opcional separado; orientação de escape e campos vazios. É um contrato de prompt, não validação da resposta em runtime. |
| 🟡 | `src/utils/generation-prompts.js:20`, `:1192`, `src/utils/ai-client.js:92` | Exemplos incentivavam “Não é sobre X”, máximas de superioridade e números sem apoio. Proibição de rótulos repetida em múltiplos fluxos. | Mais observação e consequência concreta; variações preservam promessa; base de PT-BR, fatos e rótulos no system comum aos provedores. Sanitizadores mantidos. |
| 🟡 | `src/utils/generation-prompts.js:598`, `:995` | Cultura aceitava título separado no miolo e emojis na legenda, divergindo da skill. | Gancho na primeira frase e `title` vazio no miolo; legenda em dois parágrafos, sem emojis. |

## Os dois prompts finais

A montagem real não seguia exatamente o mapa resumido do pedido. Ela coloca material antes do tema quando existe, marca/contexto, direção de imagem, idioma, método/pacotes, layout, linguagem, direção de cena e schema. Agora insere também as regras compartilhadas de legenda antes do schema. Não houve reorganização ampla da montagem.

### Personalizado + editorial + 1/1, sete slides

- O método editorial define capa → camadas do argumento → conclusão.
- Slides 1 e 2 usam tela inteira e `bodyAfterImage` vazio. O segundo avança a tese. Subtítulo até 80 caracteres.
- Slides 3–7 usam o híbrido: `subtitle` 260–403 e `bodyAfterImage` 248–384 caracteres, incluindo espaços. O último fecha o arco apesar de ter dois blocos.
- Essas faixas são alvos; não se deve acrescentar informação inventada ou redundante para atingir um piso.
- Não há simultaneamente a faixa genérica 200–320 nem o teto genérico de 140 para o fecho híbrido.
- JSON com sete slides e legenda guiada pelo mesmo builder da regeneração.

### Tendência/Cultura + 1/1, nove slides

- O handler já força o modo efetivo `editorial`, mas injeta apenas o arco Cultura, sem o método editorial genérico.
- Capa e fecho: corpo vazio; subtítulo até 80 e 140 caracteres, respectivamente.
- Miolo: duas zonas de 260–403 e 248–384 caracteres; uma ideia editorial continuada entre elas. `title` vazio; primeira frase faz o gancho.
- Funções: contexto, mecanismo, dissonância, limite, paradoxo, contraste, releitura; fechamento reservado à última posição. Com N menor, combinar etapas; com N maior, aprofundar com evidência.
- Densidades menores escalam as mesmas faixas. Em 1/4–1/5, frases únicas/bullets curtos são permitidos, eliminando a proibição conflitante.
- Legenda Cultura: percepção articulada no primeiro parágrafo, pergunta ou convite no segundo, 5–8 hashtags específicas.

## Limites e divergências mantidas conscientemente

- A skill prevê oito headlines na triagem manual; o modal do produto pede cinco alternativas. Mantidas cinco, sem alteração de interface.
- O HTML da skill usa um parágrafo por slide; o app tem dois campos em torno da foto. A adaptação conserva um argumento contínuo e elimina o título separado, sem mudar o renderer.
- A skill fixa S6 como stat sem foto/accent; no app o bloco stat continua opcional. Não foi alterada a seleção de imagem ou a sequência visual para forçar esse contrato estático.
- Há ramos legados Cultura × modos em helpers de voz/linguagem, embora a geração atual force Cultura ao arco próprio. Remover todos seria limpeza adicional; não foi necessária para os dois fluxos ativos.
- O modal de ganchos só fornece capa/subtítulo e material, não o carrossel inteiro. O builder agora proíbe ampliar a promessa, mas não pode conferir provas ausentes desse contexto.
- O schema ficou mais claro no prompt. O código ainda não valida integralmente quantidade/tipos da resposta do modelo; isso não foi apresentado como resolvido.
- O fallback de `imageQuery` pode incorporar título/subtítulo em português. Registrado como inconsistência preexistente, sem alteração no pipeline de imagem.

## Exemplos antes → depois

Textos ilustrativos de edição, não capturas de saídas de modelo. Briefing hipotético: reuniões terminam sem decisão, responsável ou prazo; o carrossel discute esse hábito.

### Capa

**Antes**

Título: “Não é sobre reuniões. É sobre estratégia.”

Subtítulo: “Quem entende isso transforma a cultura e muda o jogo.”

**Depois**

Título: “A reunião acabou. A decisão ficou para depois.”

Subtítulo: “Todo mundo participou. Ninguém saiu responsável pelo próximo passo.”

### Miolo Cultura

**Antes**

Título: “Slide 3 — O poder do alinhamento”

Subtítulo: “Alinhar expectativas é fundamental para potencializar resultados.”

Corpo: “Equipes alinhadas constroem uma cultura de alta performance.”

**Depois**

Título: vazio.

Subtítulo: “A tarefa saiu da reunião sem dono. No exemplo, a equipe discutiu o problema, levantou alternativas e terminou com um ‘vamos acompanhar’. A conversa produziu concordância, mas deixou em aberto quem faria o próximo movimento e quando o grupo voltaria a avaliar o resultado.”

Corpo: “Na reunião seguinte, o assunto retorna ao mesmo ponto: cada pessoa esperava que outra tomasse a iniciativa. **Registrar a decisão, o responsável e o prazo** dá ao grupo algo concreto para acompanhar — e permite perceber se falta uma ação ou se a decisão ainda não foi tomada.”

### Legenda

**Antes**

“Reuniões estratégicas são a chave da alta performance! Salve, compartilhe, marque seu time e siga para mais insights. 🚀”

**Depois**

“Uma reunião pode terminar em concordância e ainda deixar a decisão pendente. No exemplo do carrossel, o assunto volta à pauta porque ninguém saiu responsável pelo próximo passo.

Quando isso acontece no seu time, o que costuma ficar em aberto: a decisão, o responsável ou o prazo?

#GestãoDeEquipes #ReuniõesDeTrabalho #ComunicaçãoInterna #RotinaDeTrabalho #Liderança”

## Regressão manual — três temas

1. **Reuniões sem pauta** — Personalizado, editorial, 1/1, sete slides. Usar só instrução “tom próximo”, sem fonte. Conferir preservação do tema, avanço no segundo slide, dois blocos desde o terceiro e conclusão no sétimo. Refinar um miolo com “retire abstrações”: não deve mudar promessa nem distribuir argumento entre outros slides.
2. **Brechós como escolha de identidade** — Cultura, nove slides; repetir em 1/1 e 1/5. Fornecer um relato fictício explicitamente identificado, sem números de mercado. Conferir ausência de pesquisa inventada/generalização como fato, título vazio no miolo, corpo vazio em capa/fecho e menor volume em 1/5. Regenerar legenda: usar consequência presente apenas em `bodyAfterImage`, dois parágrafos e uma pergunta.
3. **Como organizar referências de escrita** — Personalizado, passo a passo, 1/3, seis slides. Material contém uma lista de quatro passos. Conferir promessa de quatro passos, numeração real, último passo preservado no penúltimo slide e CTA útil. Gerar cinco ganchos sem mudar a quantidade; refinar todos com “mais direto” sem trocar ordem, tema ou acrescentar promessa de resultado.

## Validação automatizada

- Comando solicitado: `npm test -- tests/unit/generation-prompts.test.js tests/unit/prompt-regressao.test.js` — 18 testes aprovados; verificações de identificadores e props aprovadas.
- Testes adicionais relevantes: `tests/unit/prompt-densidade-tom.test.js`, junto dos dois arquivos acima — 24 testes aprovados em três arquivos; verificações de identificadores e props também aprovadas.
- Cobertura nova: oito modos × cinco densidades, posições Cultura/híbrido, material só com contexto, schema parseável, contexto com corpo inferior e avaliação do template literal real de geração nos dois presets.
- Não foram feitas chamadas pagas a modelos, avaliação comparativa de copy real, exportações nem deploy. Testes verificam instruções e montagem; o checklist manual continua necessário para avaliar as saídas.
