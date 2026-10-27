# Kit de marca — Moont Sequence

Arquivos oficiais da assinatura **Moont Sequence**, preparados para interface, apresentações, documentos, redes sociais e produção gráfica.

## Estrutura

- `svg/wordmark/`: assinatura horizontal completa, com símbolo e nome.
- `svg/symbol/`: símbolo isolado para avatar, favicon e áreas compactas.
- `png/wordmark/transparent/`: assinatura horizontal em três tamanhos (480, 960 e 1920 px), sempre com fundo transparente.
- `png/symbol/transparent/`: símbolo isolado de 128 a 1024 px, sempre com fundo transparente.
- `presentation/`: arquivos prontos sobre fundos sólidos Moonlight e Midnight.
- `manifest.json`: dimensões, cores e inventário legível por sistemas.
- `checksums.sha256`: verificação de integridade dos arquivos.

## Qual versão usar

| Nome | Uso recomendado | Fundo |
| --- | --- | --- |
| `color-on-light` | versão colorida principal | branco, Moonlight e superfícies claras |
| `color-on-dark` | versão colorida invertida | Midnight, preto e superfícies escuras |
| `black` | impressão ou produção em uma cor | superfícies claras |
| `white` | impressão ou produção em uma cor | superfícies escuras |

Todos os arquivos em `svg/` e em `png/**/transparent/` têm fundo transparente. A palavra `transparent` no nome confirma essa característica.

## Cores oficiais

- Midnight: `#090A0F`
- Moonlight: `#F3F0E7`
- Orbital Blue: `#5B53E8`
- Aurora: `#D7FF5A`
- Preto monocromático: `#000000`
- Branco monocromático: `#FFFFFF`

## Área de proteção

Mantenha ao redor da marca uma área livre mínima equivalente à **altura de um dos quadros do símbolo**. A mesma regra vale para a assinatura horizontal e para o símbolo isolado.

Não encoste textos, molduras, fotos ou outras marcas nessa área. Os arquivos de `presentation/` já incluem uma margem maior para aplicação imediata.

## Tamanho mínimo

- Assinatura horizontal: **88 px de largura** em tela.
- Símbolo: **20 px de largura** em tela.
- Para impressão pequena, faça uma prova física antes da produção final.

## Nomenclatura

Os nomes seguem o padrão:

`moont-sequence-[wordmark|symbol]-[variante]-transparent-[largura]x[altura].png`

Exemplo: `moont-sequence-wordmark-color-on-light-transparent-960x256.png`.

## Recomendações

- Prefira SVG para interfaces, sites, apresentações e materiais que serão redimensionados.
- Use PNG quando o sistema não aceitar SVG.
- Não altere as proporções, a ordem dos três quadros, os cantos ou as cores.
- Não aplique sombra, contorno, gradiente ou efeitos sobre a marca.
- Não use a versão branca sobre fundo claro nem a versão preta sobre fundo escuro.

## Regeneração

Na raiz do projeto, execute:

`node scripts/generate-moont-brand-kit.mjs`

O gerador lê a geometria e os contornos vetoriais diretamente de `src/components/BrandLogo.jsx`, recria todo o kit e atualiza as verificações SHA-256. Com a mesma versão do Chromium/Playwright, duas execuções produzem arquivos idênticos.
