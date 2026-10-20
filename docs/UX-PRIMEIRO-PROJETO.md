# Primeira experiência de um social media

Implementação de 20/10/2026 sobre `59ef95d`, a partir da revisão do primeiro uso.

## Mudanças

- Biblioteca vazia até criar ou importar um projeto. Criar uma peça pede cliente/marca e nome do projeto na mesma janela. Uma nova marca não herda referências de outro cliente. Excluir o último projeto mantém a biblioteca vazia.
- Boas-vindas em três passos. Tour disponível pela Ajuda, sem abrir automaticamente sobre formulários. Texto disponível em todos os modos; “Ajustar texto” leva o foco ao campo.
- Cabeçalho móvel identifica cliente, projeto e estado de salvamento. “Salvo na conta” exige confirmação remota correspondente ao conteúdo atual e à mesma conta; alterações posteriores ficam pendentes.
- Escolha explícita entre gerar texto ou texto e imagens, com quantidade de cards. Padrões visuais indicam “Este card” ou “Todos os cards”, com desfazer. Estilos individuais continuam editáveis e não trocam os textos, fotos ou identidade da marca.
- Legenda única da publicação, revisável e igual à entregue pelo menu de exportação. Notas por slide continuam separadas nas apresentações.
- Exportação móvel e desktop com o conjunto completo primeiro, imagem individual identificada, PDF e legenda. Download não marca o projeto como publicado.
- Aprovação separada do convite para editar: PDF para envio manual, situação da aprovação e registro do retorno. Não há envio automático, portal público ou captura automática de comentários do cliente nesta versão.
- Zoom da área dos cards entre 25% e 300%, botões, controle deslizante no desktop, Ctrl/Cmd + rolagem e pinça no celular. Navegador de cards e ajuste à tela. O zoom é exclusivo da visualização; a árvore de exportação mantém a resolução original.
- Rolagem móvel com alça visível de 10 px e área de toque de 44 px, arrastável e operável por teclado. Funciona sem depender da personalização da barra nativa do iOS.
- Entrada comercial explícita: escolher plano para começar, demonstração existente e acesso direto a criar conta.

## Validação

- Build de produção, verificação de símbolos/props e 1.430 testes unitários passaram.
- Testes de navegador para primeira criação e exclusão, isolamento de cliente, legenda após recarga, alcance de estilo, aprovação, zoom, pinça real simulada por eventos de toque, rolagem móvel e salvamento com falha/retomada.
- Regressão de biblioteca: restauração, edição durante sincronização, quota local, fotos em IndexedDB, troca de conta, importação e exclusão. Os testes do armazenamento por projeto também exercitam conflito, leitura pendurada, fotos lentas e fallback sem IndexedDB.
- PDF e ZIP testados com arquivos baixados; o zoom não altera a árvore usada pela exportação.
- Testes de primeira experiência usam conta vazia. Testes que exercitam um editor existente agora declaram explicitamente seu projeto de teste, em vez de depender de um rascunho criado implicitamente pelo produto.

Os serviços de conta e IA são simulados nos testes locais de navegador. Isso valida o comportamento do cliente, não a qualidade das respostas da IA ou a latência real da nuvem.

## Limite da suíte geral

A execução geral anterior a esta alteração já falhava em 18 cenários na
[CI da base 59ef95d](https://github.com/joaogabrieljobs/viral-carrossel/actions/runs/39435795634).
Os grupos incluem geração/remix, logos, assinatura/tamanhos da marca, style kit,
resultados editoriais, texto móvel e apresentação. A suíte geral não deve ser
descrita como inteiramente verde. Os fluxos alterados nesta entrega foram
verificados separadamente; essas falhas anteriores permanecem como trabalho de
manutenção da suíte e investigação dos respectivos fluxos.
