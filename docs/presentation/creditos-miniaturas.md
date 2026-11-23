# Miniaturas dos estilos visuais

As miniaturas do seletor (`public/style-thumbs/*.jpg`) são fotografadas do renderer real
(`SlideCardInner`) por `scripts/build-style-thumbnails.mjs`, que também grava
`src/styles/style-thumbnails.generated.js`.

- Carrossel, 12 estilos virais: card de abertura sem foto, no fundo próprio do estilo.
- Carrossel, 9 famílias editoriais: capa com uma foto de exemplo por família (`scripts/style-thumbnail-photos.mjs`), da mesma galeria das apresentações.
- Apresentação, 10 famílias: capa do deck de demonstração de `docs/presentation/template-gallery-content.json`.

Conteúdo fictício. As fotos das capas de apresentação são da galeria de templates 2.0,
licença CC0 ou domínio público (créditos completos em `creditos-imagens.json` da galeria;
autores e páginas listados por família lá).

## Fotos de exemplo das famílias editoriais

| Família | Arquivo | Título | Autor | Licença | Página |
|---|---|---|---|---|---|
| Revista | `photo-2.jpg` | Bread Bakery | Drew Coffman | CC0 | https://stocksnap.io/photo/bread-bakery-EA1243E167 |
| Manchete | `cinematic-0.jpg` | Tokyo Highway | romainguy | CC0 | https://www.flickr.com/photos/24046097@N00/3697251818 |
| Grade suíça | `swiss-0.jpg` | Bow Tower. Calgary | Bernard Spragg | CC0 | https://www.flickr.com/photos/88123769@N02/14954965437 |
| Documental | `photo-1.jpg` | Restaurant Kitchen | Michael Browning | CC0 | https://stocksnap.io/photo/restaurant-kitchen-0HCMIT272C |
| Produto | `luxury-3.jpg` | coffee-cup-spoon-cappuccino | pixellaphoto | CC0 | https://www.flickr.com/photos/137643065@N06/23697707474 |
| Ficha técnica | `technical-1.jpg` | 컴퓨터 회로 기판 PC Circuit board | CC0photo | CC0 | https://www.flickr.com/photos/137346712@N07/25341126831 |
| Minimal | `luxury-0.jpg` | Tea Set (Coffee Cup) LACMA 67.1.8 | Fæ | PDM | https://www.flickr.com/photos/50398299@N08/16258842100 |
| Pôster | `cultural-5.jpg` | I love these giant coffee cup planters! (my hand is there 4 perspec… | Susan Dennis | PDM | https://www.flickr.com/photos/23506271@N06/4497254333 |
| Cinema | `cinematic-1.jpg` | Long Exposure on Freeway at Night | Image Catalog | CC0 | https://www.flickr.com/photos/132795455@N08/19155567475 |

## Regerar

Rode depois de mudar estilo, composição, fonte ou renderer:

```sh
node scripts/build-style-thumbnails.mjs <pasta com as fotos <familia>-<n>.jpg da galeria de apresentações>
```

`tests/unit/style-thumbnails.test.js` falha se um estilo visível ficar sem miniatura ou se
sobrar miniatura de estilo removido. Padrão personalizado continua com o desenho vetorial.
