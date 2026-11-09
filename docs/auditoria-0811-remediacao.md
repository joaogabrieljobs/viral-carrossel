# Auditoria de fluxos 08/11 — remediação

**Data da correção:** 09/11/2026
**Escopo:** `Moont-fluxos-0811.pdf`, `Moont-adendo-tela-0811.pdf` e revisão adversarial do diff.

## Resultado

Os bloqueadores encontrados nos fluxos de compartilhamento, vídeo e navegação foram corrigidos antes da publicação. A revisão adversarial também encontrou e fechou dois caminhos indiretos: duplicação de um projeto de equipe e cópia automática de conflito não podem mais conservar o código do projeto original.

## Melhorias entregues

- **Compartilhamento de equipe:** o código agora é escopado pelo ID do projeto no painel; respostas atrasadas não vinculam outro projeto; cliente e API recusam documento cujo código não corresponde à partilha; cópias comuns e cópias de conflito tornam-se projetos pessoais independentes.
- **Vídeo e Desfazer:** remover ou substituir o vídeo de uma cópia não apaga o Blob usado pelo original; Desfazer recupera o vídeo; órfãos ficam protegidos durante a sessão e são limpos com segurança no boot seguinte.
- **Abertura sem falsa edição:** abrir ou hidratar um projeto sem alterar conteúdo não muda `updatedAt` nem cria salvamento pendente. O snapshot persistente ignora URLs locais, IDs de cache e falhas transitórias quando o asset remoto é o mesmo.
- **Modais e teclado:** Templates, Pesquisa, Login, Perfil, Posicionar foto, Recortar imagem e Importar texto agora têm foco inicial, armadilha de Tab, Escape, isolamento do fundo e devolução do foco ao gatilho. Atalhos do editor não atuam por trás de diálogos; ao escolher um template, a confirmação também é trazida para a área visível.
- **Biblioteca e ajuda:** a busca ignora espaços antes/depois; `Cmd/Ctrl+S` está documentado como salvar; `Delete` está documentado como apagar o elemento selecionado.
- **Uso de imagens:** a conta mostra até 50 atividades recentes do ciclo, identifica Editor ou Integração de IA e diferencia crédito utilizado, devolvido e em processamento. A galeria explica por que imagens substituídas podem contar no plano sem permanecer visíveis.
- **Texto acessível:** os campos de título e subtítulo receberam nomes acessíveis próprios, eliminando seleção ambígua na edição e nos testes.

## Verificação local

- Vitest: **1.809/1.809** testes aprovados em 180 arquivos.
- Playwright: **212** cenários aprovados; **13** pulados por dependerem da flag/ambiente V2; nenhuma falha.
- Ciclo de vídeo: **4/4** cenários aprovados, incluindo exclusão do card, espera da limpeza, Desfazer e coleta segura no boot seguinte.
- Cenário visual antes instável: **4/4** repetições aprovadas após tornar o campo de subtítulo determinístico.
- Build de produção: aprovado durante o portão Playwright.
- Acessibilidade estática: nenhum botão de ícone puro sem rótulo.
- Identificadores, props e `git diff --check`: aprovados.

## Publicação

Esta remediação viaja no mesmo commit das correções. O destino de produção é `https://moont.ai/`; o hash exato e o resultado do smoke ficam registrados no histórico Git, no deployment da Vercel e no handoff da publicação.
