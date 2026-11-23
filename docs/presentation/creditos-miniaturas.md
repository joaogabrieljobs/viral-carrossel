# Miniaturas dos estilos visuais

As miniaturas do seletor (`public/style-thumbs/*.jpg`) são fotografadas do renderer real
(`SlideCardInner`) por `scripts/build-style-thumbnails.mjs`, que também grava
`src/styles/style-thumbnails.generated.js`.

- Carrossel, 12 estilos virais e 9 famílias editoriais: capa com uma foto de exemplo por estilo (`scripts/style-thumbnail-photos.mjs`), da mesma galeria das apresentações. Nenhuma foto se repete; o gerador recusa arquivos de conteúdo igual.
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

## Fotos de exemplo dos estilos virais

| Estilo | Arquivo | Título | Autor | Licença | Página |
|---|---|---|---|---|---|
| Sports Editorial | `cultural-3.jpg` | 2014 Language Day at DLIFLC | Presidio of Monterey: DLIFLC & USAG | PDM | https://www.flickr.com/photos/38345529@N05/14144581891 |
| Case Study Neon | `executive-0.jpg` | Boardroom Business | Olu Eletu | CC0 | https://stocksnap.io/photo/boardroom-business-KCIU8RWM09 |
| Mood Sépia | `luxury-1.jpg` | Girl holding christmas coffee cup | freestocks.org | CC0 | https://www.flickr.com/photos/135396164@N05/31164821320 |
| Bold Promo Pink | `photo-3.jpg` | A close-up of a white plate filled with thinly sliced ibérico ham… | Nilo Velez | CC0 | ver `creditos-imagens.json` da galeria |
| Reflexivo Serif | `typographic-0.jpg` | Writing Drawing | Green Chameleon | CC0 | https://stocksnap.io/photo/writing-drawing-8Y0EDX4VP9 |
| Tabloid Keywords | `swiss-1.jpg` | 2011.06 - New arch-construction above the existing road… Central Station Amsterdam | Amsterdam free photos & pictures of the Dutch city | CC0 | ver `creditos-imagens.json` da galeria |
| Editorial Magazine | `photo-0.jpg` | The cook's smile, cooking vegetarian green bean soup… | Wonderlane | CC0 | https://www.flickr.com/photos/71401718@N00/6231890399 |
| Luxury Hybrid | `editorial-1.jpg` | Glass Perfume Bottles | Gary Lee Todd, Ph.D. | CC0 | https://www.flickr.com/photos/101561334@N08/43171501532 |
| Viral Hype Dark | `cinematic-2.jpg` | Light Trails on the Street | MyStockPhotos | CC0 | https://www.flickr.com/photos/136375272@N05/21762203635 |
| Cinematic Hybrid | `cinematic-4.jpg` | Aerial night photo of Holiday Inn, parking deck, I-405 | D Coetzee | CC0 | https://www.flickr.com/photos/29507259@N02/6812139718 |
| Authority Black | `typographic-2.jpg` | black-and-white-coffee-cup-apple | pixellaphoto | CC0 | https://www.flickr.com/photos/137643065@N06/23697457474 |
| Minimal Clean | `modular-1.jpg` | Office Work | Negative Space | CC0 | https://stocksnap.io/photo/office-work-VHXFNKMU96 |

## Regerar

Rode depois de mudar estilo, composição, fonte ou renderer:

```sh
node scripts/build-style-thumbnails.mjs <pasta com as fotos <familia>-<n>.jpg da galeria de apresentações>
```

`tests/unit/style-thumbnails.test.js` falha se um estilo visível ficar sem miniatura ou se
sobrar miniatura de estilo removido. Padrão personalizado continua com o desenho vetorial.
