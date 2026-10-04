# Organização de carrosséis e calendário editorial

Atualizado em 04/10/2026. Especificação de produto para organizar projetos em pastas e planejar sua publicação. Complementa `duas-profundidades-criacao.md` e `guia-projetos-geracao.md`.

**Estado de implementação:** V1 biblioteca (pastas, data, status Agendado, calendário, backup) + cola Criar rápido («Organizar para publicar») + Gerar série com pasta/data + **Fila editorial** (atrasados / 7 dias / sem data) + checklist Publicado no pacote de export.

## Problema

A biblioteca guarda carrosséis, mas ainda não responde com clareza a três perguntas: para qual cliente ou campanha este trabalho foi criado, quando ele deve ser publicado e em que etapa editorial está. À medida que o volume cresce, nomes e busca deixam de ser suficientes; o usuário passa a organizar a operação fora do Viral.

O objetivo desta camada é transformar a biblioteca em uma fila editorial simples, mantendo o carrossel como unidade principal do produto.

## Promessa por profundidade de uso

| Perfil | Experiência | Promessa |
| --- | --- | --- |
| **Criar rápido / Criador** | Pastas, data e estados com linguagem simples | “Encontro o que criei e sei o que publicar em seguida.” |
| **Controle profissional / Diretor** | Os mesmos dados com visão de calendário e filtros | “Organizo clientes, campanhas e entregas sem sair do fluxo de criação.” |

O Studio continua responsável pela edição fina dos cards. A organização pertence à biblioteca e acompanha o projeto independentemente da profundidade de interface escolhida.

## Três conceitos que não podem se misturar

- **Modo de interface** define quantos controles aparecem: Criar rápido, Controle profissional ou Studio.
- **Modo narrativo** define como a história do carrossel avança: Editorial, Storytelling, Passo a passo etc.
- **Status editorial** registra a etapa operacional do projeto: Rascunho, Pronto, Agendado ou Publicado.

Alterar um desses estados nunca deve alterar automaticamente os outros.

## Modelo V1

### Pasta

Uma pasta organiza projetos por marca, cliente, campanha ou frente editorial.

```js
{
  id: 'folder_xxx',
  name: 'MUSA — Lançamento',
  createdAt: 1791072000000,
}
```

### Metadados do projeto

Cada item da biblioteca recebe dois campos, sem mover o conteúdo do `doc`:

```js
{
  // dados já existentes: id, name, status, createdAt, updatedAt, doc
  folderId: 'folder_xxx', // vazio = Sem pasta
  publicationDate: '2026-10-08', // vazio = Sem data
}
```

`publicationDate` representa **planejamento editorial local**. Ela não agenda nem publica conteúdo no Instagram.

### Status editorial

| Status | Significado | Regra |
| --- | --- | --- |
| **Rascunho** | Ainda está sendo criado ou revisado | Estado inicial |
| **Pronto** | Conteúdo aprovado para uso | Pode ter ou não uma data |
| **Agendado** | Possui uma data editorial definida | Exige `publicationDate` válida |
| **Publicado** | A publicação foi concluída fora do Viral | Marcado manualmente |

Ao adicionar uma data, o projeto passa para **Agendado**. Ao remover a data de um projeto agendado, ele volta para **Pronto**. Marcar como Publicado preserva a data para histórico.

## Fluxo principal

1. O usuário abre **Projetos**.
2. Pode criar uma pasta ou continuar com **Sem pasta**.
3. Em cada projeto, escolhe a pasta e uma data editorial opcional.
4. A biblioteca permite filtrar por pasta, status e texto.
5. A aba **Calendário** mostra os projetos com data no mês escolhido.
6. Clicar em um item do calendário abre o projeto correspondente.
7. Projetos sem data continuam visíveis na biblioteca e em uma indicação “Sem data”.

No Criar rápido, pasta e data podem aparecer como uma ação curta depois da primeira geração: **Organizar para publicar**. No Controle profissional, os filtros e o calendário ficam sempre acessíveis na biblioteca.

## Regras de comportamento

### Criar e renomear pasta

- O nome é obrigatório, sem espaços apenas no início ou fim.
- Não podem existir duas pastas com o mesmo nome, ignorando maiúsculas e minúsculas.
- Renomear uma pasta preserva os projetos vinculados pelo `folderId`.

### Excluir pasta

- Excluir uma pasta não exclui carrosséis.
- Seus projetos passam para **Sem pasta**.
- Data e status editorial dos projetos são preservados.
- A interface deve explicar esse efeito antes de confirmar.

### Duplicar projeto

- A cópia permanece na mesma pasta.
- A cópia nasce sem data editorial, para não criar dois itens no mesmo dia por acidente.
- O status da cópia volta para **Rascunho**.

### Importar backup

- O backup completo inclui o catálogo de pastas e os metadados editoriais dos projetos.
- Se já existir uma pasta com o mesmo nome, a importação reutiliza essa pasta.
- Caso contrário, cria uma nova pasta e remapeia o `folderId` importado.
- Backups antigos, sem pastas ou datas, continuam válidos e entram como **Sem pasta** e **Sem data**.
- Importar um único projeto traz apenas as pastas necessárias para esse projeto.

## Escopo da V1

- Catálogo local de pastas.
- Associação de um projeto a uma pasta.
- Data editorial única por projeto.
- Novo status Agendado.
- Filtros por pasta, status e busca.
- Calendário mensal de leitura e acesso ao projeto.
- Migração silenciosa dos projetos atuais.
- Inclusão dos novos dados em exportação e importação JSON.
- Persistência no mesmo armazenamento local já usado pela biblioteca.

## Não objetivos

- Publicar ou agendar automaticamente no Instagram/Meta.
- Enviar notificações de publicação.
- Sincronizar calendário ou projetos entre dispositivos.
- Criar calendário em nuvem, colaboração multiusuário ou permissões por cliente.
- Suportar múltiplas datas ou canais por carrossel na V1.
- Transformar pastas em uma nova hierarquia de arquivos dentro do documento.

## Critérios de aceite

1. Um projeto existente abre normalmente e aparece em **Sem pasta**, sem perda de conteúdo.
2. O usuário cria, renomeia e filtra uma pasta sem recarregar a página.
3. Excluir uma pasta preserva todos os carrosséis e os move para **Sem pasta**.
4. Definir uma data válida coloca o projeto no calendário e muda seu status para **Agendado**.
5. Remover a data de um projeto agendado o retira do calendário e o deixa **Pronto**.
6. O calendário começa na segunda-feira, navega entre meses e abre o projeto selecionado.
7. Busca, filtro de pasta e filtro de status podem ser combinados.
8. Duplicar preserva a pasta, remove a data e cria um Rascunho.
9. Exportar e reimportar a biblioteca preserva pastas, datas e status.
10. Um backup antigo continua importando sem erro.
11. A interface informa que a data é planejamento local e que publicar continua sendo feito pelo usuário.
12. Nenhuma ação de organização altera modo de interface, modo narrativo, cards, brief, tom ou identidade visual.

## Métricas

- Percentual de projetos colocados em uma pasta.
- Percentual de projetos com data editorial.
- Projetos que avançam de Rascunho para Pronto, Agendado e Publicado.
- Taxa de abertura de projeto a partir do calendário.
- Tempo entre criação do projeto e primeira data editorial.
- Retenção semanal de usuários com dois ou mais projetos na mesma pasta.

Essas métricas devem ser agregadas sem armazenar o conteúdo dos carrosséis.

## Próximas etapas

1. ~~**Fila editorial:** visão “Próximos 7 dias”, atrasados e sem data.~~ (entregue na aba Fila.)
2. ~~**Gerar série:** criar vários projetos na mesma pasta a partir de temas ou ângulos.~~ (MVP entregue: ideias → seleção → rascunhos com pasta/data.)
3. ~~**Pacote de publicação manual:** PNGs + legenda + checklist de publicado.~~ (pacote + confirmação pós-export + botão na Fila.)
4. **Objetivos e canais:** campanha, formato e canal por item, se o uso justificar.
5. **Sincronização opcional:** somente depois de validar privacidade, conflito entre dispositivos e modelo de conta.

