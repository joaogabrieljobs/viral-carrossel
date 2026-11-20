# Miniaturas dos estilos visuais

As miniaturas do seletor (`public/style-thumbs/*.jpg`) são fotografadas do renderer real
(`SlideCardInner`) por `scripts/build-style-thumbnails.mjs`, que também grava
`src/styles/style-thumbnails.generated.js`.

- Carrossel, 12 estilos virais: card de abertura sem foto, no fundo próprio do estilo.
- Carrossel, 9 famílias editoriais: capa com a foto `public/landing/hero-creator-photo.jpg` do próprio app.
- Apresentação, 10 famílias: capa do deck de demonstração de `docs/presentation/template-gallery-content.json`.

Conteúdo fictício. As fotos das capas de apresentação são da galeria de templates 2.0,
licença CC0 ou domínio público (créditos completos em `creditos-imagens.json` da galeria;
autores e páginas listados por família lá).

## Regerar

Rode depois de mudar estilo, composição, fonte ou renderer:

```sh
node scripts/build-style-thumbnails.mjs <pasta com as fotos <familia>-<n>.jpg da galeria de apresentações>
```

`tests/unit/style-thumbnails.test.js` falha se um estilo visível ficar sem miniatura ou se
sobrar miniatura de estilo removido. Padrão personalizado continua com o desenho vetorial.
