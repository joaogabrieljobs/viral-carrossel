# Guia de projetos, contexto e geração

Atualizado em 29/09/2026. Aplicável ao [Viral. Carrossel Studio](https://viralcarrossel.com.br).

## Preparar um projeto

Na aba **Narrativa**, abra **Usar contexto da marca**. Esse painel pertence ao projeto aberto na biblioteca.

| Campo | Para que serve |
| --- | --- |
| Nome do contexto | Identifica a direção em uso, como `MUSA — Contexto ON`. |
| Brief do projeto | Conhecimento do produto, público, fatos, voz e restrições. Aceita Markdown de até 48 mil caracteres. |
| Estilo visual | Composição, tipografia, paleta, luz e atmosfera desejadas. |
| Referências de imagem | Até quatro imagens de moodboard; enviadas aos geradores compatíveis. |
| Logo do projeto | PNG de até 2 MB; mantém a transparência e fica disponível para aplicar nos cards. |

**Contexto ON** aparece quando existe brief, estilo ou referência. Salvar só um nome ou uma logo não ativa esse aviso. Nome, logo e kit acompanham o projeto; um projeto novo começa com kit vazio.

O **material** em Add Conteúdo é a matéria-prima do post: texto-base, fontes e contexto extra. O **brief** é o conhecimento permanente daquele projeto. A **marca** contém a identidade global/perfis. O pedido atual define a tarefa, e o brief orienta sua execução.

## Gerar um carrossel

Abra **Prompt para gerar** e escreva um pedido concreto, por exemplo: “Crie 3 cards anunciando o lançamento do MUSA. Destaque a geração de imagens e termine com um convite para conhecer o studio.”

1. Escolha um **modo narrativo**: Editorial, Profundo, Odisseia da Dor, Viral Trends, Storytelling, Passo-a-passo, Jornalístico ou Sensacionalista. **Seguir meu pedido** (Nenhum) segue o pedido e o brief sem impor uma fórmula narrativa. O **tom de voz da marca** é independente e acompanha qualquer modo quando analisado e activo.
2. Escolha **Só texto** ou **Texto e imagens**. Só texto é o padrão. Imagens exigem saldo no plano ou chave própria configurada.
3. Clique em **Gerar com contexto e referências**. A quantidade explícita no pedido é respeitada dentro do limite de 1–12 cards.
4. Revise o resultado antes de exportar. O brief orienta o modelo; não elimina a necessidade de conferir fatos e o visual.

No **Criar rápido**, a quantidade pode ficar em **Auto** ou ser definida antes da primeira geração. Auto respeita uma quantidade escrita no pedido e usa seis cards quando o pedido não informa esse número.

Depois de gerar, **Gerar imagens** abre a seleção de cards. Escolha todos ou somente os cards desejados. A lista **Cards** também oferece ações em massa para gerar imagens, autoajustar, excluir imagens e limpar textos. No card aberto, use **Excluir imagem deste card** ou **Limpar textos deste card**; o histórico permite desfazer.

**Autoajustar cards** coloca imagens em preenchimento total, centraliza o recorte e reduz blocos longos para as áreas seguras. Em Layout, a geração pode preparar zonas sugeridas sem ativar a composição. Quando o usuário ativa, move as áreas e conclui a edição, o arranjo permanece aplicado; **Remover composição** é a ação que volta ao layout padrão.

A opção de modo narrativo é salva no projeto. O rascunho do prompt permanece ao mudar a orientação/tamanho da tela, mas é limpo ao trocar de projeto e não é um arquivo salvo para reutilização após recarregar.

Os modos de interface **Criar rápido, Controle profissional e Studio** (internamente criador/diretor/studio) controlam ferramentas visíveis; não são modos narrativos nem o plano comercial «Criador».

## Refazer com outro tom

Depois de gerar, abra **Editar Card → Refazer com tom alternativo**.

- Selecione Analítico, Provocador, Leve, Didático, Inspirador, Acolhedor, Técnico ou Comercial. Selecionar um tom não inicia a geração.
- Escolha o escopo e confirme em **Refazer só texto** ou **Refazer texto e imagens**.
- Só texto mantém imagens, referências, tipografia, cores, composição e a ordem/quantidade de cards. O remix usa o brief e o estilo atuais do projeto.
- Com imagens, cada arte antiga só é substituída quando a nova termina. Em caso de falha, a anterior permanece.

O atalho do remix depende da última geração da sessão; trocar de projeto limpa esse atalho. Para alterar apenas um card, use **Refinar com IA** no card selecionado.

## Cancelar

Use **Cancelar geração** na barra fixa. Funciona para geração principal, imagens, refinamento, legenda, ganchos e pesquisa, mesmo ao mudar de aba. Novas etapas são interrompidas e respostas atrasadas não substituem o projeto. O que já ficou pronto é mantido.

Uma solicitação já aceita pelo provedor pode continuar sendo processada. O cancelamento não garante estorno de uma imagem já enviada.

## Aplicar uma logo já salva

1. Importe a logo PNG no contexto do projeto (ou em Marca).
2. Preferência do projeto: **Aplicar a logo nos novos cards deste projeto** (ligada por omissão após importar).
3. Em **Marca → Logo**, use **Inserir logo em todos os cards** para os cards já existentes.
4. Por card: ocultar, reposicionar, tamanho/opacidade ou PNG só deste card.

## Salvar, transferir e exportar

O salvamento automático é local ao navegador. A biblioteca guarda cada projeto; imagens e referências usam armazenamento separado para não ocupar o limite do documento no localStorage.

- **PNG/PDF**: arquivos finais para publicação, com a logo dos cards escolhidos.
- **Backup JSON**: cópia editável do projeto com brief, estilo, referências e logos. Use a biblioteca para exportar e importar em outro navegador.
- Entrar com a mesma conta em outro dispositivo não sincroniza projetos. Faça backup antes de limpar dados do navegador.

## Acesso à conta

O login permite mostrar/ocultar senha. Em **Esqueci minha senha**, solicite o link para o e-mail da conta; ele vale por 30 minutos e tem uso único. Se expirar, solicite outro. A troca de senha não transfere os projetos locais entre aparelhos.
