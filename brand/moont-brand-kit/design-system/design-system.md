# Design system Moont

## Princípios

1. **Conteúdo protagonista.** A interface organiza e recua visualmente.
2. **Direção visível.** Seleção, avanço e conclusão devem ser fáceis de perceber.
3. **Uma decisão por vez.** Agrupe controles pela tarefa atual.
4. **Progressão.** Quadros, sequências e deslocamentos comunicam movimento.
5. **Clareza antes de efeito.** Contraste, hierarquia e leitura vencem decoração.

## Cores

| Token | Valor | Uso |
| --- | --- | --- |
| Midnight | `#090A0F` | fundo principal e apresentações escuras |
| Graphite | `#181B25` | painéis e superfícies elevadas |
| Moonlight | `#F3F0E7` | texto principal e superfícies claras |
| Mist | `#BBB9C7` | texto secundário, metadados e divisores |
| Orbital Blue | `#5B53E8` | ação principal e Moont Comunica |
| Aurora | `#D7FF5A` | conclusão, seleção e Moont Apresenta |
| Danger | `#FF6B6B` | erro e ação destrutiva |
| Warning | `#F2A93B` | atenção e estado pendente |

Distribuição recomendada: 70% neutros escuros, 20% Moonlight/Mist, 8% Orbital
Blue e 2% Aurora. Aurora é um sinal; evite usá-la como grande superfície.

## Tipografia

- Display: **Manrope**, pesos 600–800.
- Interface e corpo: **Inter**, pesos 400–700.
- Dados, índices e marcadores: **JetBrains Mono**, pesos 500–700.
- Títulos: entrelinha de 0,95–1,1 e tracking entre `-0.03em` e `-0.01em`.
- Corpo: entrelinha de 1,4–1,6.
- Caixa alta: apenas rótulos curtos, índices e categorias.

## Escala tipográfica recomendada

| Estilo | Desktop | Mobile | Peso |
| --- | ---: | ---: | ---: |
| Display XL | 64 px | 42 px | 750 |
| Display | 48 px | 34 px | 700 |
| Título 1 | 36 px | 28 px | 700 |
| Título 2 | 28 px | 24 px | 650 |
| Corpo grande | 20 px | 18 px | 450 |
| Corpo | 16 px | 16 px | 400 |
| Legenda | 13 px | 13 px | 500 |
| Marcador | 11 px | 11 px | 600 mono |

## Espaçamento e forma

- Unidade base: 4 px.
- Escala: 4, 8, 12, 16, 24, 32, 48, 64 e 96 px.
- Raios: 8 px para campos; 12–16 px para painéis; 999 px para ações pill.
- Área mínima de toque: 44 × 44 px.
- Bordas: 1 px, baixo contraste; seleção pode usar 2 px.
- Transições: 180–280 ms, sem loops decorativos.

## Componentes

### Botão primário

Orbital Blue com texto Moonlight. Em Moont Apresenta, Aurora com texto
Midnight. Deve conter verbo concreto: `Criar`, `Continuar`, `Gerar`, `Exportar`.

### Botão secundário

Superfície Graphite, borda suave e texto Moonlight. Não deve competir com a
ação principal.

### Campos

Texto digitado sempre em Moonlight e placeholder em Mist. Em mobile, a fonte
de campos deve ter no mínimo 16 px para evitar zoom automático.

### Cards e painéis

Use Graphite sobre Midnight. Hierarquia: título, explicação curta, ação. Evite
mais de três níveis de informação concorrendo no mesmo painel.

### Estados

- Sucesso: explique o que ficou pronto e a próxima ação.
- Erro: diga o que falhou e ofereça recuperação concreta.
- Vazio: explique o primeiro passo, sem culpar a pessoa.
- Carregamento: mostre etapa e progresso quando o processo exceder 2 segundos.

## Acessibilidade

- Texto comum deve alcançar WCAG AA.
- Nunca use apenas cor para comunicar estado.
- Foco de teclado precisa ser visível.
- Respeite `prefers-reduced-motion`.
- Logo ao lado do nome escrito deve usar descrição vazia para evitar repetição.

