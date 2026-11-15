# Design na geração — 15/11/2026

Estado: alterações locais validadas; reteste com IA real ainda pendente. Base: `1751a84`. Sem publicação nesta rodada.

## Problema observado

Nos testes reais de produção, o início neutro mantinha cores e fontes básicas. O seletor de estilos ficava fechado por padrão. No social, fotos de miolo ocupavam uma faixa pequena; no deck, a adaptação ao conteúdo reduzia presets diferentes a coordenadas muito parecidas. Um card com foto escura e `useCultureLayout` sem corpo podia conservar texto escuro.

## Alterações

- O fluxo recomenda um preset válido para cada um dos nove modos sociais e sete caminhos de apresentação. A narrativa textual continua sendo a escolhida pela pessoa.
- A etapa Visual mostra três prévias antes de abrir o catálogo completo. A revisão informa o estilo efetivo.
- Sem identidade personalizada, o padrão aplica paleta e fontes do preset desde o rascunho. Marca salva ou ajustada mantém suas cores, fontes e arquivos no automático. A escolha explícita de um preset aplica a identidade dele; a opção de somente identidade conserva os tokens da marca.
- Os presets sociais oficiais recebem composição editável de capa, miolo e fecho: foto ampla, coluna editorial ou tipografia, conforme o estilo e a presença de imagem. O rodapé tem espaço reservado; o apoio textual continua visível.
- Apresentações preservam diferenças espaciais entre famílias editorial, cinematográfica, modular, técnica e executiva. As áreas nativas de métricas, passos e comparação continuam editáveis.
- O estilo cinematográfico usa um painel alto de imagem: a primeira inspeção local revelou que uma faixa panorâmica cortava o rosto da foto de teste. A geometria foi revista.
- Texto sobre foto escurecida ganha contraste também quando a marcação legada de Cultura não possui corpo. A narrativa Cultura não sobrescreve a composição social nova.
- Presets personalizados, remix e escolhas explícitas de posição da foto mantêm seus caminhos existentes. Nenhuma mudança global dos projetos já salvos é executada.

## Verificação

- `npm test -- --run`: 206 arquivos, 2.272 testes aprovados e quatro falhas esperadas já marcadas; checagens de identificadores e props aprovadas.
- Build de produção aprovado pelo servidor dos testes Playwright. Permanecem avisos preexistentes de tamanho de chunk e importações dinâmicas.
- Seleção E2E: 30 cenários aprovados na rodada principal (oito fixtures visuais, criação, mobile, blocos editáveis, enquadramento e exportação PDF/ZIP). O novo teste do design recomendado leu o seed antes da persistência terminar; foi corrigido para aguardar cinco slides e passou nas três repetições finais. São 31 cenários distintos verificados, sem chamadas reais de IA ou consumo de créditos.
- Capturas revisadas visualmente: editorial social, autoridade social, cinematográfico e ensaio fotográfico de apresentação; os oito estilos têm capturas de três páginas na galeria externa.
- `git diff --check`: aprovado.

Os testes visuais usam a mesma foto local e textos demonstrativos para comparar o renderer. As capturas esperam fontes e enquadramento automático. A galeria não representa novas gerações de produção.

## Limites e reteste real

A rodada original de produção segue parcial: nove projetos completos, 45 páginas e 17 imagens, além de duas falhas de Estudo de caso. O restante não foi contado como testado. O saldo observado foi 33 de 50 créditos.

Ainda é necessário retestar o novo build com geração real em todos os modos. Estes testes locais não comprovam fidelidade de personagens/objetos entre imagens geradas, qualidade de todas as combinações de texto nem ausência de recortes ruins em qualquer foto. O conteúdo dos projetos reais anteriores e os achados foram preservados na pasta externa `TESTES-VISUAIS-MOONT-15-11-2026`.

Os arquivos de enquadramento que já estavam modificados no checkout antes deste trabalho foram preservados; esta documentação distingue a nova composição da correção preexistente de importação/recorte.
