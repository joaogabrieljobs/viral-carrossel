# Viral Carrossel — Uma plataforma, duas profundidades de criação

Atualizado em 04/10/2026. Spec de produto canónica para a entrada “Criar rápido” / “Controle profissional”. Complementa `guia-projetos-geracao.md` (fluxo operacional atual) e não substitui contratos de billing em `shared/plans.js`.

**Estado de implementação:** alinhamento tom/logo/rótulos + Fatia 1 + Fatia 2 + Fatia 3 (checklist profissional, logo em massa com undo, multi-select, templates por objetivo, gerar série ideias→rascunhos, novo com este contexto). Fatia 0 (validação com utilizadores) segue no roadmap.

## Tese do produto

O Viral Carrossel oferece o mesmo motor de criação em duas profundidades de uso:

- **Criar rápido:** para quem quer transformar uma ideia em carrossel sem configurar cada decisão editorial.
- **Controle profissional:** para quem quer dirigir voz, narrativa, densidade e identidade visual.

Não são dois produtos e não existem projetos separados por modo. O usuário pode começar no caminho simples, avançar para os controles profissionais e voltar quando quiser, preservando contexto, cards, identidade e histórico.

## Resultado desejado

> Em poucos minutos, uma pessoa consegue gerar e exportar um primeiro carrossel coerente com sua marca.  
> Com mais tempo, um profissional consegue dirigir voz, arco narrativo e visual sem trocar de ferramenta.

As metas de 3–5 e 15–30 minutos são hipóteses de produto. Devem ser medidas antes de virarem promessa pública.

## Os dois caminhos

| Necessidade do momento | Entrada apresentada | Resultado esperado |
| --- | --- | --- |
| Quero publicar sem configurar tudo | **Criar rápido** | Ideia → carrossel com minha identidade → revisar → baixar |
| Quero dirigir o resultado | **Controle profissional** | Contexto → estratégia narrativa → tom → refino → exportação |

Internamente, esses caminhos podem continuar correspondendo a Criador e Diretor. Na comunicação com o usuário, os rótulos devem descrever o resultado e evitar confusão com o plano comercial Criador.

O Studio continua sendo a camada de edição avançada: layout, canvas, composição e ajustes finos.

## Princípio de experiência

### Progressive disclosure

O produto apresenta primeiro apenas as decisões necessárias para chegar ao próximo resultado.

- **Criar rápido:** contexto essencial, pedido, geração, revisão e exportação.
- **Controle profissional:** contexto completo, narrativa, densidade, presets, refino e direção visual.
- **Studio:** edição fina do resultado.

Nenhum recurso fica preso para sempre a um perfil. Os controles avançados permanecem acessíveis por “Mais controle” ou pela troca do modo de interface.

## Fundamento compartilhado: identidade do projeto

A identidade do projeto é composta por camadas distintas:

- **Contexto:** o que a marca faz, para quem, fatos, restrições e objetivos.
- **Tom de voz:** como a marca fala.
- **Identidade visual:** logo, cores, tipografia, estilo e referências.
- **Material atual:** o conteúdo específico usado no post.
- **Pedido atual:** o que deve ser criado agora.
- **Modo narrativo:** como o conteúdo será estruturado.

Essa separação precisa aparecer também no motor:

> O pedido define a entrega.  
> O contexto sustenta os fatos.  
> O tom define a voz.  
> O modo narrativo organiza o arco.  
> A identidade visual orienta a apresentação.

### Estado do contexto

O produto pode apresentar três estados claros:

- **Sem contexto:** geração depende apenas do pedido e dos padrões gerais.
- **Contexto básico:** há descrição da marca ou tom suficiente para orientar o texto.
- **Contexto completo:** há brief, tom e identidade visual reutilizáveis.

Em vez de “Complete 2 passos”, a interface deve dizer o benefício concreto:

- “Adicione uma descrição para a IA entender sua marca.”
- “Adicione uma logo para reutilizá-la nos próximos carrosséis.”
- “Analise o tom para manter a mesma voz nas próximas criações.”

O nome “Contexto ON” pode continuar como indicador compacto após a configuração.

# Caminho 1 — Criar rápido

## Objetivo

Permitir que uma pessoa gere um primeiro carrossel exportável sem precisar entender linguagem editorial, modelos de IA, densidade, layout ou configuração de provedores.

## Primeira sessão

A Home apresenta uma sequência curta e retomável:

1. **Conte sobre sua marca**
   - Texto curto: “O que você faz, para quem e o que torna sua marca diferente?”
   - Ações: escrever, colar um brief ou começar com um exemplo.
   - O usuário pode continuar sem preencher, mas recebe a indicação de que o resultado será mais genérico.

2. **Adicione sua identidade**
   - Logo PNG opcional.
   - Opção visível: “Aplicar esta logo a todos os cards que eu gerar neste projeto”.
   - Marcada inicialmente no onboarding; pode ser desativada.
   - Depois da geração, cada card continua permitindo ocultar, reposicionar ou substituir a logo.

3. **Descubra o tom da marca**
   - CTA: “Analisar meu tom”.
   - A análise apresenta um resumo editável antes de salvar.
   - Exemplo: “Direto, confiante e didático. Frases curtas. Sem promessas exageradas.”
   - O usuário pode reanalisar ou editar manualmente.

4. **Diga o que quer publicar**
   - Prompt principal grande.
   - Exemplos de intenção:
     - “Explique por que…”
     - “Anuncie o lançamento de…”
     - “Conte a história de…”
     - “Crie um passo a passo sobre…”

5. **Gerar carrossel**
   - Padrão: só texto.
   - Alternativa clara: texto e imagens.
   - Antes de qualquer consumo, mostrar o escopo e a quantidade prevista.

O checklist deixa de ser exibido como obrigação depois do primeiro resultado. Ele permanece acessível como “Identidade do projeto”.

## Defaults

- **Tom:** usa o tom salvo da marca; se não existir, aplica PT-BR direto e concreto.
- **Narrativa:** “Seguir meu pedido”.
- **Escopo:** só texto.
- **Quantidade:** interpreta o pedido; na ausência, usa um padrão curto e informa quantos cards serão criados.
- **Logo:** aplica em todos somente quando o usuário ativou essa preferência.
- **Visual:** usa o padrão atual do projeto.
- **Revisão:** mantém checagem editorial antes de aplicar o resultado.

O sistema não deve usar “Tom da marca” como substituto do modo narrativo. O tom acompanha todos os modos.

## Linguagem do caminho rápido

| Termo interno | Rótulo para o usuário |
| --- | --- |
| Nenhum | Seguir meu pedido |
| Editorial | Explicar com autoridade |
| Viral Trends | Prender atenção |
| Passo a passo | Ensinar passo a passo |
| Storytelling | Contar uma história |
| Brand tone | Falar como minha marca |
| Text only | Gerar só o texto |
| Text and images | Gerar texto e imagens |
| Refine | Melhorar este card |
| Remix | Refazer com outro tom |

“Falar como minha marca” é uma preferência de voz aplicada sobre a estrutura escolhida. Caso apareça junto aos modos, deve estar visualmente separado como controle de voz.

## Estado depois da geração

A primeira camada apresenta quatro ações:

- **Ajustar texto**
- **Gerar imagens**
- **Baixar**
- **Mais controle**

“Mais controle” leva ao Diretor sem recriar o carrossel.

A opção de legenda pode ficar dentro de Baixar:

- Baixar PNGs
- Copiar legenda
- Baixar PNGs + copiar legenda
- Fazer backup do projeto

## Redução de insegurança

Microcopys fixas:

- “O Viral prepara os arquivos. A publicação é feita por você no Instagram.”
- “Seus projetos ficam neste navegador. Faça um backup para não perder o trabalho.”
- “Gerar só texto não consome o saldo de imagens do plano.”
- “Você poderá revisar tudo antes de baixar.”

Estados de progresso devem comunicar resultado:

- “Sua marca já tem contexto básico.”
- “Adicione uma logo para deixar os próximos carrosséis prontos mais rápido.”
- “Tudo pronto para gerar.”
- “Criando o texto do seu carrossel.”
- “Gerando imagem 2 de 5.”
- “Cancelar geração” permanece disponível globalmente.

# Caminho 2 — Controle profissional

## Objetivo

Dar ao social media controle editorial e visual sem repetir configuração, perder identidade entre gerações ou atravessar etapas desenhadas para iniciantes.

## Checklist profissional

Uma barra compacta mostra:

- Brief
- Tom de voz
- Logo global
- Estilo visual
- Referências
- Material do post

Cada item apresenta estado: ausente, parcial ou pronto. O checklist informa qualidade de contexto; não bloqueia a geração.

Exemplo:

> MUSA · Contexto completo  
> Brief ✓ · Tom ✓ · Logo ✓ · Estilo ✓ · 3 referências

## Controles preservados

- Brief completo e contexto por projeto
- Material específico do post
- Estilo visual e moodboard
- Modos narrativos completos
- Tom de voz aplicado a qualquer modo
- Densidade textual
- Presets criativos, incluindo Cultura
- Refinamento de um card ou de todos
- Variações de gancho
- Legenda
- Remix de tom
- Logo global e overrides por card
- Tipografia, paleta, layout e direção visual
- Escolha entre texto e texto + imagens
- Cancelamento global

## Separação conceitual na interface

Microcopy permanente:

> Modo de interface define quantos controles você vê.  
> Modo narrativo define como a história avança.  
> Tom de voz define como a marca fala.

Essa explicação deve aparecer perto da troca de interface ou como ajuda contextual curta, sem ocupar o editor continuamente.

## Logo profissional

O painel oferece três níveis:

1. **Logo do projeto**
   - Ativo reutilizável salvo uma vez.

2. **Aplicação automática**
   - “Aplicar a logo nos novos cards deste projeto”.
   - Preferência do projeto, reversível.

3. **Override por card**
   - Usar padrão do projeto.
   - Ocultar neste card.
   - Usar outra logo.
   - Ajustar tamanho, posição e opacidade.

A ação em massa deve existir também depois da geração:

- Aplicar em todos
- Remover de todos
- Aplicar somente nos cards selecionados

Sempre com undo.

## Gerar série

“Gerar série” merece backlog próprio e não deve ser apenas um prompt maior.

Entrada:

- contexto do projeto;
- objetivo;
- quantidade de temas;
- período opcional;
- nível de variedade;
- texto ou texto + imagens.

Saída inicial:

- lista de ideias e ângulos para aprovação;
- um projeto por tema somente depois da seleção;
- geração em fila com cancelamento global;
- indicação de possível consumo de imagens antes da confirmação.

Primeira versão recomendada:

> Gerar cinco ideias → selecionar ideias → criar rascunhos de projetos.

Isso reduz custo e evita gerar cinco carrosséis ruins de uma vez.

# Navegação entre os caminhos

O modo escolhido na entrada é uma preferência do projeto ou usuário, não uma categoria de conta.

Regras:

- A troca não remove nem recria dados.
- Criar rápido → Controle profissional revela os controles usados pelos defaults.
- Controle profissional → Criar rápido mantém as configurações e resume a interface.
- Uma geração já iniciada continua visível nos dois modos.
- Exportar e Cancelar geração permanecem globais.
- O usuário pode definir seu modo inicial nas preferências.

Entrada da landing:

- CTA principal: **Criar meu primeiro carrossel**
- Link secundário: **Quero controle profissional**

O segundo link abre o mesmo produto com Diretor ativo e checklist profissional expandido.

# O que não construir agora

- Publicação automática no Instagram
- Agendamento pela Meta
- Sincronização completa em nuvem
- Agente autônomo que cria e publica
- Calendário editorial completo
- Geração em massa sem etapa de aprovação
- Nova arquitetura ou backend separado por perfil

A promessa permanece centrada em criação, edição e exportação.

# Roadmap orientado a risco

## Fatia 0 — Validar a tese antes da nova Home

Objetivo: descobrir se simplificar a entrada melhora o primeiro resultado.

Experimentos:

- Prototipar “Criar rápido” com contexto curto, pedido e um CTA.
- Testar com pessoas que nunca usaram o produto.
- Observar onde param, quais termos não entendem e se conseguem exportar.
- Comparar “checklist obrigatório” com “checklist orientador e pulável”.
- Testar “Criar rápido / Controle profissional” contra “Criador / Diretor”.

Critério para seguir:

- maioria completa a tarefa sem ajuda;
- nenhuma confusão grave entre interface, plano e narrativa;
- logo e backup são compreendidos;
- o usuário entende que o Viral não publica no Instagram.

## Fatia 1 — Primeiro carrossel exportável

Entregas:

- Entrada “Criar rápido”.
- Contexto curto da marca.
- Prompt principal com só texto como padrão.
- Preferência de logo nos novos cards.
- Ações pós-geração simplificadas.
- Exportar sempre visível.
- Aviso de persistência local e backup.
- Microcopy interface × narrativa × voz.
- Telemetria mínima da jornada, sem conteúdo dos prompts.

Critérios de aceite:

- usuário pode concluir sem abrir Marca, Visual ou Layout;
- pode trocar para Diretor sem perder o projeto;
- pode cancelar qualquer geração em andamento;
- geração de texto não inicia imagens;
- logo automática respeita a preferência e pode ser desfeita;
- exportação não é apresentada como publicação.

## Fatia 2 — Parece minha marca

Entregas:

- Análise de tom com confirmação e edição.
- Tom aplicado transversalmente aos modos narrativos.
- Reanálise sem sobrescrever silenciosamente a versão editada.
- Pacote manual: PNGs + legenda.
- Rótulos humanos no caminho rápido.
- Estado básico/completo do contexto.
- Backup JSON integrado à primeira sessão.

Critérios de aceite:

- segundo carrossel reutiliza contexto, tom e preferência de logo;
- mudar o modo narrativo não apaga o tom;
- atualizar o tom pede confirmação antes de alterar gerações futuras;
- pacote exportado contém os cards esperados e oferece a legenda separadamente.

## Fatia 3 — Eficiência profissional

Entregas:

- Checklist profissional compacto.
- Ações em massa de logo com undo.
- Seleção múltipla de cards.
- Gerar série: ideias → seleção → rascunhos.
- Templates por objetivo: lançar, educar, prova social e bastidor.
- Melhorias de velocidade para projetos recorrentes.

A sincronização em nuvem permanece uma decisão separada, pois altera custo, privacidade, autenticação e promessa de persistência.

# Métricas

## Métrica principal do caminho rápido

**Taxa de primeiro valor:**

> Percentual de novos usuários que geram e exportam pelo menos um carrossel na primeira sessão.

Métricas auxiliares:

- tempo mediano até a primeira geração;
- tempo mediano até o primeiro export;
- abandono por etapa;
- percentual que usa só texto;
- percentual que entende o armazenamento local;
- percentual que volta e cria um segundo carrossel no mesmo projeto.

## Métrica principal do caminho profissional

**Reutilização de identidade:**

> Percentual de projetos com contexto e tom reutilizados em duas ou mais gerações.

Métricas auxiliares:

- gerações semanais por projeto ativo;
- percentual de projetos com brief, tom, logo e referências;
- uso de refino e remix;
- tempo entre geração e exportação;
- percentual que troca do modo rápido para o profissional;
- percentual de séries aprovadas antes da geração completa.

Eventos não devem capturar texto do prompt, brief, legenda ou conteúdo dos cards.

# Hipóteses que precisam ser testadas

1. Simplificar a interface aumenta o primeiro export sem piorar a qualidade percebida.
2. Usuários entendem “Criar rápido” e “Controle profissional” melhor do que Criador e Diretor.
3. Contexto curto é suficiente para o primeiro resultado útil.
4. Analisar tom produz ganho percebido que justifica uma etapa adicional.
5. Aplicar logo automaticamente é desejado pela maioria e não gera retrabalho frequente.
6. Só texto como padrão reduz receio de crédito sem reduzir ativação.
7. Profissionais querem reutilização e ações em massa mais do que novos controles individuais.
8. A pessoa entende que seus projetos estão no navegador e executa backup quando orientada.

A hipótese mais arriscada é que o primeiro problema seja excesso de controles. O problema também pode estar na qualidade percebida da primeira geração. Antes de esconder grande parte da interface, o protótipo deve testar se simplificação aumenta a conclusão e se o resultado continua parecendo suficientemente “da marca”.

# Mensagem de produto

## Versão principal

> Crie seu primeiro carrossel pelo caminho simples.  
> Quando quiser mais controle, dirija voz, narrativa e visual no mesmo studio.

## Para quem trabalha com a própria marca

> Conte o que sua marca faz, diga o que quer publicar e receba um carrossel pronto para revisar e baixar.

## Para social media e agência

> Reúna brief, tom, referências e logo por projeto. Dirija a narrativa, refine os cards e exporte sem reconstruir sua identidade a cada post.

CTA principal: **Criar meu primeiro carrossel**

CTA secundário: **Quero controle profissional**

Apoio permanente:

> O Viral cria e exporta seus arquivos. A publicação continua sob seu controle.

# Decisão recomendada

Construir primeiro a entrada “Criar rápido” como uma camada sobre o fluxo atual, mantendo o mesmo documento, motor de geração e editor.

Não duplicar geração, persistência ou modelos de projeto. A diferença entre os caminhos deve estar em:

- quantidade de decisões expostas;
- linguagem usada;
- defaults escolhidos;
- ações prioritárias depois da geração.

Tom de voz permanece independente do modo narrativo. Logo automática vira preferência explícita do projeto. O usuário pode mudar de profundidade sem perder trabalho.

Essa arquitetura mantém uma promessa simples para iniciantes e preserva o valor profissional do Studio.
