# Auditoria de Ingrid — segunda rodada

Revisão em 21/10/2026 do relato e das cinco capturas recebidas. Ingrid identificou a build `index-BvK15x-7`; as correções abaixo foram implementadas no checkout local, sobre `513fa07` e alterações de apresentações já existentes. Não houve deploy nem alteração dos projetos reais da campanha.

| Achado | Evidência e tratamento |
| --- | --- |
| Rose correto | O relato retifica a primeira auditoria: a palavra em itálico usou `#C9A9A6`. Não foi tratado como defeito novo. |
| PNG entrou e sobreviveu ao reload | Confirmado no relato. No código, a importação da logo da marca no Studio atualizava o documento, mas o perfil só recebia essa identidade automaticamente no modo Criador. Agora a importação explícita atualiza também o perfil; logos específicas de card continuam isoladas. Resolução por ID tem prioridade sobre inline antigo, sem retornar ao JPEG anterior quando o arquivo atual está indisponível. |
| Imagem sem Salvar | Ingrid não reproduziu perda da imagem: autosave funcionou. Não foi criada uma correção baseada na hipótese anterior. |
| Convite desaparecia | O efeito era cancelado por callbacks recriados a cada render, mantendo o código em andamento e descartando a resposta. Agora aguarda o restore, usa callbacks atuais, abre o projeto, informa andamento/erro e só consome o convite após aceite válido. Não foi usado o convite real. |
| Formatos durante autosave | No fluxo V2, o guard validava a biblioteca inteira durante o envio de um snapshot. Uma nova edição de formato invalidava o envio e produzia o aviso relatado. Agora o snapshot enviado é confirmado com sua versão real e a edição sucessora é preservada duravelmente e enviada em seguida. Sync com pull e logout continuam exigindo estado atual antes de substituir ou descartar dados. |
| Títulos ausentes em Prender atenção | O híbrido permitia título apenas “se fizer sentido” nos cards 3+ e impunha densidade de outro modo. Corrigidas as regras e a integração do modo com o validador. Um título ausente pode ser recuperado de uma frase completa já escrita; casos inseguros usam a revisão existente. Se ainda inválido, o resultado não substitui o projeto atual. |
| Cópia de conflito no reload | Reenfileiramento idêntico renovava a operação; uma resposta perdida seguida de edição podia parecer conflito externo. Operações idênticas conservam identidade, envios são serializados e o rebase exige prova do antecessor enviado pela própria fila. Conflitos externos reais preservam ambas as versões. A restauração respeita a seleção local válida antes da ordem da lista ou de metadados remotos antigos. |
| Markdown cru | Um ramo de subtítulo com rótulo automático imprimia o texto sem passar pelo mesmo formatador usado no restante do card. Corrigido em preview/exportação, preservando o conteúdo editável e underscores de URLs. |
| 5min30 para cinco cards | Duas chamadas sequenciais de texto e tentativas de provedor explicam a possibilidade desse tempo. O prompt do híbrido viral exigia prosa excessiva e foi corrigido. Não houve medição com provedor real nesta rodada; não se atribuiu causa operacional definitiva nem se prometeu novo tempo. |

## Persistência e limites

A fila guarda manifesto e bytes pendentes no IndexedDB, sem copiar imagens para localStorage. O upload precisa ser confirmado antes do PUT do projeto; falha mantém a operação pendente. O snapshot sucessor é enfileirado antes de encerrar o envio anterior. A aceitação de projetos compartilhados também fornece os assets à fila.

A revisão foi feita com código, testes automatizados e serviços simulados. Não foram apagados, renomeados ou exportados os projetos reais “Halloween WebExpresso” e “Halloween WebExpresso EN”. A correção do aviso de sincronização é específica do fluxo V2; o fluxo legado mantém as proteções anteriores.

## Validação

- Suíte completa: 153 arquivos e 1.590 testes passaram; verificações de identificadores e props também passaram.
- Builds com e sem sincronização V2: aprovados.
- Navegador V2: 19 cenários passaram, incluindo resposta perdida, alteração durante autosave, recarga com sucessor pendente, conflito externo, isolamento por conta, IndexedDB indisponível e convites.
- Navegador com fluxo legado: seis cenários de convite passaram; a troca de logo no Studio preservou pixels/transparência e os demais projetos após reload.
- Rodada final de controles e logo: 11 cenários passaram. Inclui cinco cards em Prender atenção com títulos 3–5 inicialmente ausentes, texto integral preservado, itálico após reload e exatamente duas chamadas de IA simuladas; remix com referências, cancelamentos e logo individual com transparência, recarga e backup também passaram.
- Cenários antigos de controles foram atualizados para os painéis atuais, sem alterar o produto para manter seletores antigos.
- Testes usam APIs simuladas. Sem geração paga, acesso a conta real ou publicação. O tempo de geração com o provedor continua pendente de medição real.
