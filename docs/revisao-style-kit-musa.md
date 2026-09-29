# Revisão do kit por projeto — caso MUSA

28/09/2026. Escopo: repositório aninhado `viral-carrossel/viral-carrossel`. O arquivo MUSA foi lido como material do produto, não como comando para executar o pipeline de criação descrito nele.

**Estado atualizado em 29/09/2026:** kit/referências publicados em `450e84d`; escopo texto/imagens, cancelamento global, modos, oito tons, aviso Contexto ON e logo por projeto publicados em `d2043b6`. CI da segunda versão: 343 testes de código e 66 de navegador aprovados. Guia atual em [Projetos e geração](product/guia-projetos-geracao.md). Os relatos abaixo preservam o histórico da investigação, incluindo pendências existentes antes desses deploys; não representam pendência atual de publicação. A qualidade criativa do resultado real não é comprovada pelas respostas simuladas dos testes.

## Diagnóstico

O prompt enviado era suficiente para expressar a intenção: **“CRIE 3 CARDS ANUNCIANDO LANÇAMENTO DO MUSA”**. O resultado das capturas ensinava como fazer um lançamento, tinha seis cards e texto escuro sobre imagem escurecida. Isso coincide com falhas concretas no fluxo, não demonstra que faltou uma “fórmula viral”.

O briefing descreve MUSA como Studio de Geração (imagem, vídeo, áudio, cinema, animação, personagens e produtos); Director Mode é um recurso. Pede tipografia condensada, imagem expressiva, cores de marca como elementos gráficos e logo original. O gerador acrescentava exigências de fotografia sóbria que conflitavam com essa direção.

## Achados priorizados e correções

| Prioridade | Problema observado no código | Correção / limite | Referência atual |
|---|---|---|---|
| 🔴 | O callback rápido podia capturar `handleGenerate` anterior ao upload: suas dependências não incluíam o kit/material. | Handler usa o estado atual em cada render. Refine de todos também inclui o kit nas dependências. | `ViralCarrossel.jsx:2692`, `ViralCarrossel.jsx:2722` |
| 🔴 | A quantidade vinha dos slides anteriores ou do fallback seis, ignorando “3 cards”. | Extrai quantidade explícita (número ou palavra), valida 1–12 e mantém fallback só quando não há quantidade no pedido. | `src/utils/style-kit.js:92` |
| 🔴 | Pedido era tratado como assunto editorial: o produto virava aula sobre lançamento. | Pedido atual tem bloco próprio; anúncios recebem arco publicitário, texto curto e instrução de copy pronta. Brief vence identidade global conflitante. Nicho/público antigos não são impostos quando existe brief do projeto. | `src/utils/style-kit.js:53`, `src/utils/style-kit.js:102`, `ViralCarrossel.jsx:2317` |
| 🔴 | O brief era cortado na normalização e novamente para o prompt. | Limite único de 48 mil caracteres, envio integral dentro desse limite; arquivo maior é recusado com aviso, sem substituir o anterior. | `src/utils/style-kit.js:9`, `src/components/panels/ProjectStyleKitPanel.jsx:58` |
| 🔴 | Referências eram data URLs pesadas dentro de `vc_library`; upload assíncrono substituía o kit inteiro. | Novos uploads comprimidos e guardados no IndexedDB; documento tem IDs. Atualização funcional preserva brief/estilo. Upload cancelado ao desmontar/trocar projeto não escreve no novo projeto. Legado migra ao abrir o projeto. | `src/utils/style-kit-storage.js:5`, `src/components/panels/ProjectStyleKitPanel.jsx:72`, `ViralCarrossel.jsx:1242` |
| 🔴 | Gerador do plano descartava referência com apenas um aviso no console; OpenAI também podia cair silenciosamente para texto. | OpenAI envia até quatro referências em `/images/edits`, preservando override do card. Plano agora recebe também arquivos locais, envia cópias ao Blob privado e repassa links assinados de 15 minutos ao SJinn. Falha de upload devolve o crédito e impede geração sem referência. Cópias são apagadas após uso, com limpeza diária de órfãos. **Leitura dos links pelo SJinn ainda requer teste pago autorizado.** | `src/utils/ai-client.js:518`, `src/utils/ai-client.js:584`, `api/ai/sjinn-image.js` |
| 🟠 | Fonte e paleta citadas no brief nunca alteravam os campos editáveis. | JSON opcional `projectDesign`, apenas quando há brief/estilo. Fontes conhecidas, pesos, caixa, cores HEX e composição fullbleed são aplicados ao documento, sem CSS arbitrário nem logo inventado. | `src/utils/style-kit-design.js`, `ViralCarrossel.jsx:2279`, `ViralCarrossel.jsx:2354` |
| 🟠 | Exigência global de foto realista anulava 3D, fantasia e publicidade expressiva. | Direção do projeto substitui o bloco fotográfico genérico. A direção de imagem usa também trechos visuais do brief quando o campo de estilo está vazio. | `src/utils/generation-prompts.js` (`buildGenerationImageLayer`), `src/utils/ai-client.js:413`, `src/utils/style-kit.js:78` |
| 🟠 | Texto preto permanecia sobre foto escurecida. | Render usa texto claro em foto de fundo com overlay escuro; paleta salva, cards sem foto e fotos em áreas separadas são preservados. | `src/utils/style-kit-design.js` (`needsLightPhotoText`), `src/components/card/SlideCardInner.jsx:1273` |
| 🟠 | Troca/exportação podia acontecer antes do autosave; transição expunha documento anterior por um frame. | Snapshot imediato ao trocar/criar/duplicar/exportar; troca carrega o histórico antes da pintura. Resultados atrasados de geração/refine/legenda/imagem não entram em outro projeto. | `src/hooks/useLibrary.js:27`, `ViralCarrossel.jsx:896` |
| 🟠 | IDs de referência exigem backup portátil e proteção na limpeza de imagens. | Exportação embute bytes; importação recria IDs locais; referências entram na lista de imagens em uso. Limpeza dá margem para upload em andamento. Fallback de quota não apaga imagem que só existe no documento. | `src/hooks/useLibrary.js:111`, `src/utils/image-store.js`, `src/utils/storage.js` |
| 🟡 | Preview SVG repetia IDs ao aparecer em mais de um picker. | IDs únicos por instância com `useId`. | `src/styles/visual-presets.jsx:41` |

## O que já estava sólido

- `doc.styleKit` é a unidade correta de isolamento; documento novo recebe kit vazio.
- Contexto permanente, material da geração e perfil global têm campos distintos.
- Narrativa separa material de edição do card; um acordeão abre por vez e o prompt temporário é limpo ao trocar de projeto.
- Picker já tem proporção 4:5, seleção visível e descrição. Não foi redesenhado nesta revisão.
- Revisão editorial mantém a quantidade/ordem e o schema dos slides; a camada de identidade opcional não muda o contrato de carrosséis sem kit.

## Diffs essenciais

Os arquivos no diretório de trabalho contêm as mudanças executáveis. Estes trechos resumem o que muda no comportamento; não são um patch completo.

```diff
- const handleQuickGenerateFromNarrativa = useCallback(async (...) => {
-   const count = slides.length >= 3 && slides.length <= 12 ? slides.length : 6;
+ const handleQuickGenerateFromNarrativa = async (...) => {
+   const { count, announcement } = resolveQuickGenerationRequest(topic, fallbackCount);
```

```diff
- reader.onload = () => setStyleKit(workingKitComBase64);
+ const reference = await storeProjectReference(file);
+ setStyleKit(prev => ({ ...prev, refImages: [...prev.refImages, reference] }));
```

```diff
- refImage: resolveImageRef(styleKit, slide.refImage)
+ refImages: await resolveImageReferences(styleKit, slide.refImage)
```

```diff
- console.warn('Referência ignorada no modo plano');
+ const staged = await stageImageReferences(references);
+ // Arquivos locais → Blob privado → URLs GET assinadas no image_list.
+ // finally apaga as cópias; upload incompleto não inicia tarefa SJinn.
```

## Limites que permanecem

1. **Validação real com SJinn pendente:** transporte de uploads implementado e coberto por testes. Um smoke real confirmou Blob privado (GET assinado 200, GET sem assinatura 403, arquivo removido). O usuário autorizou uma geração de 100 créditos. A tentativa com a chave local foi recusada por autenticação; a credencial de produção é sensível e só pode ser usada no ambiente do servidor. Não se afirma ainda que o fornecedor leu o link ou que o resultado reproduz o moodboard. Código não publicado nesta revisão; store e segredo de limpeza já configurados na Vercel. A rotina diária só entra em operação após deploy.
2. **Fidelidade visual integral:** `projectDesign` aplica os controles que já existem: fontes de título/corpo, peso/caixa, cores e fullbleed. Não reconstrói automaticamente as seis composições MUSA nem cria uma terceira camada tipográfica Barlow Condensed. A aplicação de elementos gráficos e a posição do logo continuam no editor.
3. **Assets citados no Markdown não são anexos.** IDs `libfile_...` e nomes de arquivos não dão acesso ao logo original. Não se deve fabricar esse logo.
4. **O modelo de texto não analisa pixels do moodboard.** A copy recebe o brief; as imagens recebem referências no provedor compatível. A mensagem da interface foi corrigida para refletir isso.
5. A seleção de trechos visuais do brief para o prompt de imagem tem orçamento menor que o brief textual completo. Uma direção visual explícita e concisa no campo de estilo continua sendo a forma mais previsível de priorizar detalhes.
6. Migração de referências antigas ocorre ao abrir cada projeto; não recupera conteúdo já perdido antes desta correção. Backup continua necessário antes de limpar dados do navegador.

## Exemplos antes → depois

Texto ilustrativo para revisão editorial, não saída certificada de uma geração real nem promessa comercial.

- **Capa:** “Lançamento do MUSA — Se você tenta vender tudo de uma vez, não vende nada.” → **“SUA IDEIA GANHA MUNDO.”** / “Conheça o MUSA. Seu Studio de Geração.”
- **Miolo:** “Card 1: O problema. A maioria dos lançamentos abre com a solução…” → **“IMAGEM. VÍDEO. ÁUDIO.”** / “Explore linguagens e transforme ideias em novas cenas com o MUSA.”
- **Legenda, antes ilustrativo:** “Entenda a regra de três toques para fazer um lançamento que vende.” → **“Uma ideia pode virar imagem, ganhar movimento ou encontrar uma voz. É esse espaço de criação que o MUSA apresenta: um Studio de Geração para explorar diferentes linguagens. O que você criaria primeiro?”**

Sem preço, data, gratuidade, garantia de resultados ou disponibilidade de modelo externo inventados.

## Validação

- Suíte completa de unidade/integração: 297 testes passaram antes da adição do teste específico de proteção de quota.
- Teste novo de proteção de quota e testes de referências, kit e endpoint passaram depois dessa adição.
- Verificações `check:undef` e `check:props` passaram.
- E2E do kit: upload de brief maior que 24 mil caracteres; dois anexos no IndexedDB; pedido de três cards; aplicação de Anton/Inter/acento; projeto B vazio; retorno e reload do projeto A. Respostas de IA simuladas, sem consumir geração paga.
- Regressões de geração editorial (4 cenários) e persistência de fotos (2 cenários) passaram.
- Validação final: 7 E2E passaram no build real, incluindo backup com bytes das referências e importação com novos IDs; 46 testes dos módulos de kit, prompts, picker e quota passaram na última rodada.
- Não foi feita geração paga com o MUSA nem deploy nesta revisão.

## Checklist manual — três temas

1. **MUSA — três anúncios:** subir o Markdown completo e três referências; pedir exatamente “CRIE 3 CARDS ANUNCIANDO LANÇAMENTO DO MUSA”. Esperar três peças prontas, produto correto, sem aula sobre lançamento, Anton/Inter e título legível. No plano ou com chave OpenAI, conferir se as três referências influenciam as artes. No plano, confirmar erro claro sem perda de crédito se o upload falhar. Essa avaliação visual exige uma geração real após autorização e publicação.
2. **Reuniões sem pauta — Cultura:** projeto separado, preset Tendência/Cultura, densidade 1/1, sete slides. Conferir arco, miolo sanduíche, `bodyAfterImage`, legenda e ausência do contexto MUSA. Refinar um card e depois todos sem mudar ordem/quantidade.
3. **Produto de skincare — quatro cards:** outro projeto, brief/estilo próprios e referência específica no segundo card. Verificar prioridade da referência do card, isolamento do moodboard, geração de legenda/ganchos, backup JSON e importação em outro perfil de navegador.

## Continuação — transporte de referências do plano

- Implementado upload temporário privado de até quatro anexos; cópia de envio limitada a 700 KiB por imagem, sem alterar original no projeto.
- Direção visual passa a seguir as referências mesmo sem texto no campo de estilo; não impõe fotografia realista a um moodboard 3D.
- Handler desconta o tempo de upload do orçamento de espera e mostra erro específico de referência, parando o lote quando necessário.
- Store `viral-carrossel-references` criada como privada em `iad1`, vinculada somente ao app. `CRON_SECRET` configurado em produção; tarefa diária depende do deploy.
- Validação final: **313 testes unitários/de integração passaram**. Os **56 cenários E2E** foram cobertos entre a rodada ampla e a repetição dos casos ajustados: 48 passaram na rodada ampla; 10 passaram na rodada focada, dos quais dois já haviam passado. Inclui prompt rápido → três imagens → dois anexos e estilo preservados em cada chamada. Respostas de texto/imagem simuladas nesses E2E.
- Smoke real do Blob: imagem sintética de 70 bytes; GET assinado **200**, acesso sem assinatura **403**, remoção concluída. Nenhum arquivo do usuário foi enviado nesse teste.
- Teste pago de SJinn foi autorizado, mas ainda não concluído: chave local recusada e chave de produção protegida. Publicação para testar no próprio app aguarda confirmação. A tentativa de baixar todo o ambiente de produção foi bloqueada pela revisão automática; a alternativa aprovada usou apenas a credencial específica de Blob em memória, sem gravar os demais segredos.

Contrato, limites e fontes oficiais em [Referências do plano](engineering/referencias-imagem-plano.md).

- A rotina de limpeza passa diretamente no domínio técnico da Vercel: exceção restrita à sua rota no middleware e nos redirects. A autenticação por segredo permanece obrigatória; outras páginas continuam redirecionando para o domínio oficial.

## Teste real autorizado — situação final da tentativa

O usuário autorizou uma geração de até 100 créditos SJinn. A tentativa não retornou tarefa: a chave local foi recusada; a consulta de uso confirmou HTTP 401 / `Invalid access token`. A credencial de produção é sensível na Vercel e sua leitura externa não foi liberada. Nenhum segredo de produção foi copiado para o disco.

Para testar com a credencial do servidor, foi solicitada confirmação para publicar esta correção e executar uma imagem pelo app. A aba disponível está sem sessão. A revisão automática bloqueou iniciar o OAuth Google sem autorização específica; o usuário foi solicitado a entrar na conta ou autorizar esse login. Não foram alteradas regras de autenticação para contornar o bloqueio.

A suíte de navegador também identificou seletores antigos que escreviam no brief ou buscavam controles escondidos antes de abrir EDITAR CARD. Os cenários foram atualizados para abrir o painel e selecionar Título/Subtítulo pelo rótulo. As verificações de renderização, geometria, destaque e gancho permanecem iguais.

Confirmação final do Blob após a tentativa: **0 arquivos, 0 bytes**, store privada. Build, verificações de identificadores/props e `git diff --check` passaram. Ainda sem deploy nesta revisão.
