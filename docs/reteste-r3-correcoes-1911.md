# Reteste R3: correções e avanço aos 16 modos — 19/11/2026

## Evidência anterior

O reteste dirigido registrou 3 falhas de saída incompleta em Autoridade e 2 em Prender atenção, antes da revisão editorial. Caso completou na segunda tentativa e Pitch na primeira. Esses resultados não equivalem à aprovação dos 16 modos.

Evidências locais: `/Users/elevessy/Documents/viral-carrossel/RETESTE-MOONT-R3-19-11-2026/` (`RESULTADOS-R3.md`, `execucao-r3.json`, galeria e capturas).

## Correções

1. A geração e revisão sociais agora pedem `thinking: disabled`, como as etapas estruturadas das apresentações. O transporte só envia esse parâmetro a modelos Z.ai compatíveis. Nenhum teto de texto, verificação factual ou regra de cancelamento foi relaxado; nenhuma chamada automática foi acrescentada. A Z.ai documenta thinking ligado por padrão e consumo adicional de tokens: https://docs.z.ai/guides/capabilities/thinking . A associação com o corte observado é hipótese técnica até o reteste real do fluxo completo; não se apresenta como causa confirmada por telemetria de produção.
2. No canvas clássico, o convite de inserir/substituir foto usa uma região livre entre as caixas de texto, considerando deslocamentos manuais. A zona da foto e os textos mantêm suas posições. Se não existe região legível, o aviso visual é omitido; a zona continua acessível para upload. Exportação continua sem esse aviso.

## Verificação

- Teste de regressão do parâmetro social: vermelho nos nove modos antes da correção.
- Testes focados iniciais: 140 aprovados (geração, revisão, cancelamento e renderização).
- Suíte no checkout de desenvolvimento: 2.663 aprovados, 4 falhas esperadas, 223 arquivos. Execução com dois workers; uma execução anterior sem limite de concorrência teve um timeout de material, além de uma fixture de teste corrigida nesta rodada. Não foi alterado timeout de produto nem de teste.
- Build de produção aprovado; verificações de identificadores/props aprovadas na suíte.
- Chrome local: reproduzido o fechamento de Autoridade a partir do conteúdo e visual persistidos; convite e texto separados por geometria e captura. Isso verifica o renderer local, não um deploy em produção.
- Tentativa de sonda direta ao provedor não foi válida: a configuração disponível ao CLI não forneceu uma credencial utilizável (HTTP 401). Não conta como geração real aprovada.

## Próxima rodada

Pasta: `/Users/elevessy/Documents/viral-carrossel/RETESTE-MOONT-R4-16-MODOS-19-11-2026/`.

`plano-16-modos.json` contém os nove modos sociais e sete de apresentação, com material, instruções, cinco páginas, densidade Balanceado e critérios visuais/factuais da R2. Cada modo começa pendente; só muda depois de executado. Os assuntos e instruções da rodada anterior são preservados para permitir comparação.

Usuário autorizou quantas imagens forem necessárias. A cota efetivamente disponível deve ser conferida no servidor; não se confunde isenção de cobrança com ausência de teto de imagens.
