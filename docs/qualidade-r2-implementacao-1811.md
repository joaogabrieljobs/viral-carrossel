# Qualidade R2 — implementação de 18/11/2026

Branch `claude/qualidade-r2`, criada a partir de `7088a34` (o commit publicado em moont.ai). **Nada foi publicado, nada foi enviado ao remoto e nenhuma imagem foi gerada.** Todos os testes usam IA simulada.

Origem: revisão independente da rodada R2 (16 modos, 15–16/11/2026) e as especificações das etapas 1 e 2, guardadas na pasta pai do repositório:

- `REVISAO-INDEPENDENTE-MOONT-18-11-2026-v2.md`
- `ESPEC-ETAPA-1-ASSINATURA-RODAPE-ALINHAMENTO.md`
- `ESPEC-ETAPA-2-TIPOGRAFIA-LEGIBILIDADE.md`

## Estado de publicação

| Item | Estado |
|---|---|
| Último deploy | `7088a34`, 15/11/2026 (`dpl_2d9CdkXcMj3v5sQZzg9GZRfZtiD7`) |
| Esta branch | Só local. Sem push, sem PR, sem deploy |
| Checkout principal (`main`) | Tem alterações não commitadas de outra sessão em 7 arquivos (enquadramento de foto). Não foram tocadas e **não estão nesta branch** |
| Validação com IA real | Nenhuma. Ver "O que não foi validado" |

## O que foi feito

### Etapa 1 — assinatura provisória, rodapé e alinhamento (completa)

Problema da R2: carrosséis sem marca saíam com `SUA MARCA`, `@seuperfil`, `#SUAHASHTAG`, `Sua editoria`, e o selo do rodapé cobria o subtítulo da capa.

- A origem do texto fica no próprio campo. Campo que ainda tem token é automático; texto digitado é da pessoa e sempre aparece. Não há filtro por valor: `tests/e2e/marca-assinatura.spec.js` digita `SUA EDITORIA` de propósito e continua passando.
- `{handle}` e `{marca}` sem valor resolvem para vazio no card. Novo token `{exemplo:TEXTO}`: aparece na miniatura do seletor, nunca no card.
- Regras por grupo: selo; cabeçalho (ano sozinho não sustenta a barra); barra de três colunas atômica.
- A composição social recebe marca e formato e já nasce acima da reserva do rodapé. Sem rodapé visível, a geometria é a de antes.
- Proteção no render para zonas gravadas que ainda colidem (projetos antigos, selo acrescentado depois). Desligada quando a pessoa editou a zona ou arrastou o elemento.
- O alinhamento vem do `slideDefaults` do preset. Exceção aprovada: coluna estreita com mais de 120 caracteres de apoio fica à esquerda.
- O selo centra na coluna de texto quando a foto é lateral. Selo do `@` sem handle não é exportado.

Arquivos: `src/utils/preset-tokens.js`, `src/utils/card-chrome.js` (novo), `src/utils/social-visual-composition.js`, `src/styles/visual-presets.jsx`, `src/utils/design-data.js`, `src/components/card/SlideCardInner.jsx`, `src/components/SidebarContent.jsx`, `src/components/panels/CardTextFontPanel.jsx`, `src/components/TemplatesModal.jsx`, `ViralCarrossel.jsx`.

### Etapa 2 — tipografia e legibilidade (completa)

Problema da R2: todos os carrosséis saíram com título, subtítulo e apoio em 100/100/100; o apoio das apresentações saía com 18 px num slide de 1920.

**Reproduzido** com IA simulada antes de corrigir (`tests/e2e/project-creation-flow.spec.js`, "geração social conserva a tipografia que a composição definiu": falhava com 100/100/100, agora passa com 76/108/140).

- Causa: um efeito regravava os nove campos de tipografia em todos os slides a cada mudança de `brand.text*`, inclusive as feitas por código. Na criação, os três tamanhos da marca iam de 100 para `undefined` e o efeito disparava.
- O efeito saiu. A tipografia da marca chega aos slides só por ação explícita (controles de "Texto nos slides", seletor de par de fontes, troca de perfil de marca, "Aplicar a todos"), na mesma gravação da marca. Só o campo alterado é propagado; tamanhos em proporção.
- Apoio no deck: a vista 16:9 multiplica os tamanhos do slide por 0,45 e limita a 52–130. O valor fixo 110 chegava à tela como 52%. A composição agora grava o valor que entrega o corpo do preset depois da conversão, nunca abaixo de 24 px.
- O carrossel gerado deixou de herdar os pisos de redução do deck.
- Aviso não bloqueante `text-below-floor` na auditoria de render do deck.
- Ação explícita "Restaurar hierarquia do estilo" para projetos já achatados. Nada é corrigido ao abrir.

Arquivos: `src/utils/brand-typography.js` (novo), `ViralCarrossel.jsx`, `src/components/SidebarContent.jsx`, `src/components/card/SlideCardInner.jsx`, `src/utils/presentation-composition.js`, `src/utils/presentation-quality.js`, `src/utils/social-visual-composition.js`.

### Etapa 3 — imagem (parte determinística)

Problema da R2: 7 de 9 carrosséis com foto contradizendo o briefing; rosto cortado; objeto mudando entre cards.

- `shared/image-aspect.js` (novo): um seletor de proporção para editor, criação e templates. Pede o formato suportado mais próximo do painel da foto e acrescenta instrução de enquadramento.
- Ficha visual (`visualBible`): o rascunho do carrossel pode devolver até quatro entidades com os atributos do material. A ficha segue em todo pedido de imagem do projeto, junto do tema, sem trocar o ramo de direção de arte. **Opcional e à prova de falha**: ausente ou malformada, a geração segue como antes.
- A luz do brief deixou de ser repetida em toda query.
- O caminho de imagem do agente passou a enviar as regras fixas (sem texto, assunto inteiro).

Arquivos: `shared/image-aspect.js`, `src/utils/visual-bible.js` (novo), `src/utils/ai-client.js`, `src/utils/generation-prompts.js`, `ViralCarrossel.jsx`, `api/lib/agent-image-generation.js`.

### Etapa 4 — só a parte de recuperação do roteiro

- Na segunda tentativa de planejamento, o pedido de recuperação mostra ao modelo os trechos reais da fonte mais próximos de cada citação reprovada. É sugestão: o validador continua exigindo cópia literal.
- A mensagem de falha passa a dizer o motivo, a partir dos códigos do diagnóstico, sem expor conteúdo.
- A prévia progressiva deixou de mostrar marcadores `**` crus.

Arquivos: `src/utils/presentation-plan-repair.js` (novo), `src/utils/presentation-planning.js`, `src/components/GenerationPreview.jsx`.

## O que NÃO foi feito

| Item do plano | Por quê |
|---|---|
| Etapa 4: itens obrigatórios em texto visível (`mustKeep`) | Muda o contrato do roteiro, que o validador rejeita por campo desconhecido. Sem geração real não há como saber se o modelo cumpre |
| Etapa 4: conferência de força da afirmação (título do Pitch) | Depende de julgamento do modelo; precisa ser calibrada com respostas reais |
| Etapa 4: avisos de revisão com motivo e menos falsos positivos | Idem |
| Etapa 5: arquétipos de composição e dialetos de preset | Trabalho de design que precisa de decisão e revisão visual sua. Não cabe implementar sem você ver |
| Etapa 6: reteste real | Exige geração paga. Não executado |
| Zonas de foto reservadas sem foto no fluxo "texto primeiro" | Precisa definir os estados da zona (planejada, pendente, falhou) com você |
| Referência "mesmo objeto" entre imagens do projeto | Muda custo e fluxo de geração; decisão sua |
| Proporção por slide no caminho do agente | Mudaria o formato do job gravado; ficou só a regra fixa no prompt |
| Teste de navegador para os controles de tipografia da marca | A lógica tem teste unitário; a ligação com a interface não tem teste de navegador |

## O que não foi validado

1. **Prompts novos contra o modelo real.** A ficha visual acrescenta um campo ao contrato do rascunho. Se o modelo não o devolver, nada muda; se devolver algo inválido, é descartado. Não foi medido se a ficha de fato melhora as imagens.
2. **Imagens.** Nenhuma foi gerada. Proporção, enquadramento e ficha só têm teste de montagem do prompt.
3. **Exportação ZIP/PDF, mobile e Tauri** com as mudanças.
4. **Galeria antes/depois** revisada por pessoa. As capturas dos testes ficam em `test-results/` e são apagadas a cada execução.

## Riscos para revisar antes de publicar

- **Projetos antigos mudam de aparência em dois pontos, de propósito:** texto provisório vindo de token (`@seuperfil`, `SUA MARCA`) deixa de aparecer; texto sob o selo sobe no render. Texto provisório gravado como literal (`#SUAHASHTAG`) continua aparecendo: não há como distinguir do texto da pessoa.
- **Controle de tamanho da marca agora é proporcional.** Quem esperava valor absoluto usa "Aplicar tipografia a todos".
- **Apoio do deck maior** (24–28 px em vez de 18 px) em projetos novos. Decks antigos não mudam.
- **Conflito de merge provável** em `ViralCarrossel.jsx` com as alterações locais de enquadramento de foto do checkout principal (`generateSlideImageAt` e arredores). Os trechos são vizinhos, não os mesmos.
- **Divergência entre documento e código encontrada:** `docs/design-geracao-1511.md` afirma que "o rodapé tem espaço reservado" na composição social. Na versão publicada a reserva só existia no renderer legado; esta branch torna a afirmação verdadeira.

## Instabilidade já existente

`tests/e2e/project-creation-flow.spec.js` → "prévia mostra todos os textos durante a revisão sem salvar o rascunho incompleto" falha de forma intermitente **também em `7088a34`** (2 de 10 execuções lá; 3 de 10 aqui). A asserção que falha é a que protege contra uma gravação antiga da biblioteca desfazer o salvamento final (a biblioteca aparece com 1 slide logo depois de aparecer com 5). Não foi investigada. Vale olhar: pode ser só o teste, pode ser a corrida real.

## Como conferir

```bash
cd /Users/elevessy/Documents/viral-carrossel/_worktrees/moont-qualidade-r2
git log --oneline 7088a34..HEAD
npm test
npm run test:e2e
```

Para ver no navegador sem crédito: `npx playwright test tests/e2e/assinatura-sem-marca.spec.js` grava capturas dos 12 presets sociais, com e sem marca, em `test-results/`.
