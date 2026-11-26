# Outfit — fixture de fonte real para E2E

Estes arquivos servem somente aos testes de navegador. A família Outfit é a
fonte padrão de título em cenários que exportam PNG; os testes precisam carregar
a face original mesmo quando o Google Fonts está indisponível no ambiente.
Não há alteração no catálogo, nas fontes ou no carregamento de produção.

`Outfit-VariableFont_wght.ttf` é uma cópia sem modificações do arquivo
`ofl/outfit/Outfit[wght].ttf` do repositório oficial Google Fonts, apenas com um
nome de arquivo sem colchetes. A tabela de nomes identifica a família tipográfica
**Outfit**, versão **1.100;gftools[0.9.27]**; o eixo `wght` cobre **100–900**.

## Procedência

- Repositório: <https://github.com/google/fonts>
- Revisão fixa: `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`
- Fonte original: <https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/outfit/Outfit%5Bwght%5D.ttf>
- Licença original: <https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/outfit/OFL.txt>
- Metadados de origem: <https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/outfit/METADATA.pb>
- Upstream informado nesses metadados: `Outfitio/Outfit-Fonts`, revisão `902773808eb372f70fb34e8946dd1ffe604efc79`.
- Obtido em 2026-11-26; licenciado sob SIL Open Font License 1.1, incluída em `OFL.txt`.

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `Outfit-VariableFont_wght.ttf` | 110884 | `fc7287273e66929776e2ba54f144fe699080bec29f61bf649d70d871468aeade` |
| `OFL.txt` | 4388 | `e2a6bbb2589b85bac1690ec8f220b22a9c3af9bfda56df6391f7ab491c7a039f` |

Na licença, foi removido apenas um espaço ao fim de uma linha; o texto foi
preservado. O arquivo original tem 4389 bytes e SHA-256
`c676351bf8576b9aba743cd5eaa8c0e7ee0d51f805d720447b4df4ddb6a2e416`.

O helper `tests/e2e/helpers/outfit-font.js` responde à solicitação de CSS com um
`@font-face` que incorpora os bytes desta fonte. A escolha da família, os pesos,
o carregamento por `FontFaceSet` e a exportação real continuam ativos. Inter e as
demais famílias locais continuam sendo fornecidas pelos ativos do aplicativo.
