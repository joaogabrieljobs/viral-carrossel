# Revisão de sessões paralelas — 30/10/2026

## Estado conferido

- **Produção web:** Vercel servia o deployment Production `7421325540`, commit `c7cad93`.
- **Tronco:** `main` e `origin/main` apontavam para `c7cad93`.
- **PR #1:** desktop Tauri, head `40ac46c`, fora do tronco.
- **PR #2:** login e integrações, head `49a1d7a`, fora do tronco.
- **PR #3:** biblioteca de fontes e contexto MCP, head `5219493`, fora do tronco.
- **Banco:** nenhuma migração foi executada nesta revisão.

## Decisões do dono

Decisões respondidas por João em 30/10/2026:

1. Publicar somente fontes gratuitas com licença comercial comprovada; remover trial, demo e personal use.
2. Corrigir os achados dos três PRs e estabilizar o E2E antes de qualquer merge.
3. Corrigir links externos no desktop e validar login, download e pagamento antes do merge.
4. Usar `contato@moont.ai` como canal de Privacidade/LGPD.
5. As sete fotos de “Branddy | Testadores e oportunidades” aparecem; incidente encerrado.
6. Preservar `bgImageAssetId` na limpeza local, com teste de regressão.
7. Versionar auditorias e revisão social como documentação histórica; descartar somente o patch superado.
8. Um push autorizado para `main` também autoriza o deploy automático correspondente.
9. Autorizar correções, testes, commits e push para os PRs. Merge, deploy e limpeza aguardam CI verde e validação do desktop.

## Contradições resolvidas

- O rollback de 18/10 foi superado por `c7cad93` em produção.
- O Brand Kit não estava perdido: `5c5f168` já pertencia ao `main`.
- O projeto antigo sem fotos foi criado antes da geração de imagens pelo MCP; o fluxo atual existe no tronco.
- A restauração das sete fotos foi confirmada pelo dono.
- O deploy automático decorrente de push autorizado estava incluído na autorização anterior.

## Integração autorizada

1. Estabilizar os E2E que falhavam no próprio `main`.
2. Preservar referências `bgImageAssetId` durante a limpeza local.
3. Publicar `contato@moont.ai` no texto de privacidade.
4. Versionar os relatórios históricos e esta revisão.
5. Corrigir os achados específicos dos PRs #1, #2 e #3.
6. Rodar testes unitários, E2E e builds aplicáveis.
7. Fazer commits e push nas branches de revisão.

## Ainda depende do dono

- Validar login, download e pagamento no aplicativo desktop corrigido.
- Autorizar merges, deploy de produção e limpeza dos worktrees após CI verde.

## Evidências

- GitHub deployment Production `7421325540` → `c7cad93`.
- PR #1: <https://github.com/joaogabrieljobs/viral-carrossel/pull/1>
- PR #2: <https://github.com/joaogabrieljobs/viral-carrossel/pull/2>
- PR #3: <https://github.com/joaogabrieljobs/viral-carrossel/pull/3>
- `src/utils/image-store.js`: inventário de IDs usados pela limpeza local.
- `src/LegalPage.jsx`: política de privacidade vigente.

## Próximo ponto de partida

Revisar a CI das branches enviadas nesta sessão. Não mesclar nem apagar worktrees antes de confirmar CI verde e a validação manual do desktop.
