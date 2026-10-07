# Design system de apresentações

`presentation-design-system.json` é a fonte versionada dos dez padrões de
apresentação. O Studio não importa esse arquivo no navegador: o comando
`npm run build:presentation-design-system` valida o contrato e gera
`src/generated/presentation-design-system.generated.js` com apenas os tokens,
limites editoriais e seis composições que o renderer atual usa.

O build executa o compilador automaticamente. Alterações na fonte precisam
manter:

- canvas 1920 × 1080 e proporção 16:9;
- os dez IDs `pds.*` declarados no compilador;
- seis mapeamentos explícitos por padrão: capa, conteúdo, divisor, dados,
  demonstração e encerramento;
- fontes presentes na allowlist local;
- zonas dentro do canvas, sem sobreposição entre título e texto de apoio.

Gráficos, tabelas, SVGs e grupos do documento completo ainda não são inseridos
como elementos nativos editáveis. O compilador os marca como evidência
adaptada e nunca envia SVG, URL de fonte, exemplo ou thumbnail ao runtime.
Projetos antigos continuam resolvendo os seis presets legados, que permanecem
ocultos da grade de novos padrões.
