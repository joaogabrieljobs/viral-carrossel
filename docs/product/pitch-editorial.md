# Geração de Pitch

Atualizado em 20/10/2026.

O caminho Pitch usa um papel de sistema próprio na geração, na revisão automática e no refinamento individual ou em lote. Os quatro provedores de texto recebem esse papel; a mudança para a IA do plano também o preserva. Outros caminhos mantêm o papel anterior.

## Contrato editorial

- Planejar a cobertura das perguntas de negócio antes de redigir: produto, cliente, pagador, mecanismo, mercado, estágio, execução e decisão.
- Separar fato realizado, capacidade disponível, plano, hipótese e informação ausente.
- Preservar condições, população, unidades, períodos e grau de certeza dos números e afirmações.
- Explicar serviço humano, responsabilidades e custos quando forem parte do modelo.
- Identificar decisões pendentes em linguagem de negócio, sem inventar equipe, preço, rodada, métricas ou parcerias.
- Concluir com decisão ou próximo passo. Não criar epílogo só com imagem ou promessa.
- Usar imagem apenas quando contribuir para o argumento. Fluxos, modelo comercial, métricas e marcos podem ficar sem fotografia, com informação nos campos editáveis existentes.
- Excluir nomes de arquivos e referências ao processo de extração. Uma instituição e um ano fornecidos podem contextualizar evidência externa no argumento ou resumo.

Os campos e os limites de texto continuam os mesmos. Essa mudança não adiciona tabelas, gráficos ou novas áreas ao renderizador, não altera apresentações já salvas e não corrige por si só limites visuais de layouts personalizados.

## Validação

`tests/unit/pitch-system-prompt.test.js` verifica o envio do papel aos provedores, o fallback para a IA do plano, o isolamento entre chamadas, a ligação geração/revisão e a coerência das regras no refinamento. Os cenários usam respostas simuladas; não constituem avaliação da qualidade criativa de uma geração real.

Cinco falhas de testes anteriores foram reproduzidas em uma cópia de `7757564`. As expectativas foram atualizadas para a versão já publicada: variável mutável de marca, mensagem de carregamento, limpeza do foco do editor e argumento do caminho nos builders. Não houve mudança funcional para contornar esses testes.

Na árvore de trabalho validada, `npm test` passou com 1.358 testes e o build passou. A suíte de navegador terminou com 133 aprovados, 11 ignorados e 18 falhas; os mesmos cenários com falha também aparecem na execução anterior do CI de `7757564` (incluindo uma falha intermitente de fonte individual). O cenário de apresentação passou. A suíte completa de navegador ainda não está aprovada; esses resultados não certificam uma publicação.

## Roteiro para avaliar a saída real

Usar um briefing de produto construído, cobrança não ativa, retenção a validar, equipe e rodada indefinidas, e uma estatística com universo e período explícitos.

Verificar:

1. O título não transforma hipótese em prova.
2. O modelo de receita está identificado como proposto e concorda com o estágio.
3. O mecanismo de entrega inclui as responsabilidades humanas relevantes.
4. Mercado, aquisição, retenção e margem não são tratados como equivalentes.
5. A estatística preserva universo e período.
6. As lacunas aparecem como decisões pendentes, sem dados fictícios.
7. Cada slide acrescenta informação e o fecho tem um próximo passo.
8. Não há referências ao upload, manual ou extração.

O diagnóstico da revisão final considera esses critérios. A revisão continua limitada a duas chamadas no total (geração e revisão), com as políticas de cancelamento e fallback já existentes.
