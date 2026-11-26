# Validação dos prompts de imagem — 26/11/2026

Fechamento da melhoria do Livre solicitada depois das frentes A e B. O alvo é preservar o método dos sete prompts originais da Apoteose sem fixar essa estética em outros projetos.

## Código e defeito reproduzido

- Base local A+B: `807ddf486f998cbbd1451a2000b65f2e75723975`.
- Compilador de direção: `28e53f3` e `ca5b306`.
- Planejamento, paleta, geometria e transporte: `796f5fc`.
- Asserções semânticas no fluxo completo: `41ee8a0af3e4bd7a82a30d7b8524a4c307f2af92`.
- Captura nativa estabilizada apenas no harness: `f04dd50dbc6d68c3e507097b0838d604e2fed551`.

Os pedidos HTTP anteriores dos cards sociais 3 e 6 perdiam a instrução de luz ao reduzir o texto ao teto configurado da rota. Exclusões específicas e cenas vizinhas também desapareciam. O teste vermelho reproduziu essa perda no assistente completo. As regras repetidas de referência consumiam 1.455 caracteres de um pedido com âncora.

O contrato dirigido protege decisões concretas de cena, luz, composição, paleta, identidade, papéis dos anexos, exclusões e diferenças de outras cenas. Contexto opcional entra por blocos inteiros. Um núcleo que não caiba gera diagnóstico antes da chamada, sem enviar uma direção truncada. O caminho legado continua sem esse contrato.

## Transporte final observado

| Foto do Feed Livre | Antes | Depois | Resultado |
|---|---:|---:|---|
| Card 1 | 3.969 | 3.310 | Luz, exclusões e duas cenas vizinhas completas. |
| Card 3 | 3.995 | 3.885 | Luz restaurada, exclusões e duas cenas vizinhas completas. |
| Card 6 | 3.928 | 3.908 | Luz restaurada, exclusões e duas cenas vizinhas completas. |

São os comprimentos dos corpos HTTP da bateria geral final. As fotos da apresentação ficaram entre 3.289 e 3.518 caracteres, conservando cinco cenas vizinhas. A arte abstrata ficou com 2.389. Os seis grupos V2, com fotos e arte, coincidem em prompt e proporção com os grupos gerais. A compactação do cabeçalho conhecido da ficha libera 277 caracteres; a folga pode receber contexto opcional completo, portanto não se deve confundir esse ganho isolado com o comprimento final do pedido.

## Gates

| Comando | Resultado |
|---|---|
| `npx vitest run` | 470 arquivos; 9.622 aprovados, 6 falhas esperadas; 38,00 s. |
| `npm run check:undef` | 281 arquivos; nenhum identificador não resolvido. |
| `npm run check:props` | 171 componentes; propriedades consistentes. |
| `npm run build` | Aprovado; avisos de chunks/importação dinâmica preservados no log. |
| `CI=1 npx playwright test` | 367 aprovados, 24 ignorados, zero falhas/erros; 772,95 s. |
| Gate V2 abaixo | 66 aprovados, zero ignorados/falhas/erros; 189,05 s. |

```sh
CI=1 VITE_PROJECTS_V2=true npx playwright test \
  tests/e2e/projects-v2.spec.js \
  tests/e2e/projects-v2-outbox-fallback.spec.js \
  tests/e2e/save-after-deploy.spec.js \
  tests/e2e/plano-gratis.spec.js \
  tests/e2e/project-creation-flow.spec.js \
  tests/e2e/modo-livre-geracao-real.spec.js \
  tests/e2e/social-free-geracao-real.spec.js
```

As execuções usaram uma única instância Playwright na porta 4173. Os testes interceptaram as chamadas de IA; não houve geração paga. Variáveis `QA_IMAGE_PROMPTS_DIR`, `QA_OUTPUT_DIR`, `QA_PHASE=apresentacao` e `QA_SOCIAL_CAPTURE=1` habilitaram registros/capturas na última rodada V2. O navegador disponível foi Chromium 137.0.7151.0; o download da versão esperada pela instalação foi bloqueado no ambiente. Não houve mudança de dependência ou configuração do projeto para contornar essa limitação.

Vitest, verificações estáticas, build e bateria geral cobrem o código de produto de `41ee8a0`. O único commit posterior, antes deste documento, altera o caminho opcional de captura que não estava habilitado na bateria geral. O focal e o gate V2 completo cobrem esse caminho. Não houve mudança de produto entre os gates.

## Captura e inspeção

A primeira V2 com capturas opcionais teve 64 aprovações e duas falhas por PNG de 1920×1081, embora o DOM medisse 1920×1080. O screenshot de elemento envolvia uma origem fracionária com `floor/ceil`. No caso observado, `y=321,625` precisava de translação externa temporária de `+0,375` pixel.

O harness alinha somente o viewport externo, comprova tamanho e quatro bordas documentais inteiras, captura pelo método original, verifica que a captura não moveu o card e restaura a propriedade em `finally`. Não recorta nem redimensiona o PNG. O focal V2 passou em dois cenários, sem retentativa, em 58,2 s; o gate completo posterior aprovou os 66.

As 52 capturas finais estão cobertas por inspeção: 22 coincidem por SHA com arquivos já revisados e 30 capturas sociais foram abertas individualmente em tamanho nativo. As 21 da apresentação coincidem com o focal V2 corrigido, que havia aberto 11 imagens únicas novas e vinculado as restantes por hash. Nenhuma revisão ficou pendente. Títulos, apoios, listas, pares de comparação, assinaturas e recuperações mantêm o conteúdo íntegro.

Os pareceres registram limitações dos ativos simulados: piso predominante em um recorte estreito e faixa do cabeçalho sobre a testa do retrato do Feed. Na vista com estilo fixo Cinema, `CENA 06` fica perto do título e as caixas de linha se cruzam, sem perda visível de glifos. Não se alterou o estilo protegido. Contraste foi avaliado visualmente; não se acrescenta uma medição numérica WCAG nem uma avaliação de geração real.

## Compatibilidade e limites

Os três catálogos protegidos mantêm os bytes de `c188ac77d23e7a3857565711422a0ae0caf75c02`: composição dos 21 estilos sociais/63 hashes, prompts de imagem e prompts de texto. Hashes, logs, pedidos completos, capturas e procedência da inspeção integram o pacote de evidências entregue ao usuário.

A extração de paleta continua sendo medição de pixels. O planejador recebe as cores e o briefing; o gerador recebe a referência visual anexada. Este trabalho não acrescentou uma análise semântica completa da referência. A rota continua GPT Image 2/SJinn, com resolução `1K` fixada também no servidor. O PDF alvo não permite deduzir a resolução original da geração.

O que foi comprovado é o contrato exigido do planejador, a integridade do pedido transportado e os fluxos/layouts com ativos simulados. A equivalência estética com a Apoteose depende do Teste 8 real, a cargo do usuário. Banco, cobrança e modelo não foram alterados; nenhuma escrita no banco ou chamada paga foi feita.

Nenhum push ou deploy foi realizado. O handoff exige aprovação explícita para cada push à `main`; a publicação automática só pode seguir essa aprovação, sem deploy manual.
