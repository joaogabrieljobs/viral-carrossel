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
