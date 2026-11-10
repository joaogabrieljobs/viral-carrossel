# Portão de CI e publicação

## O que fica versionado

O workflow `.github/workflows/ci.yml` é a fonte de verdade para aprovar um commit:

1. `quality` instala as dependências, executa a verificação estática de acessibilidade, a suíte Vitest e o build de produção;
2. `e2e` só começa depois de `quality` e executa o Playwright no build real;
3. `deployment-gate` só aprova quando os dois jobs anteriores terminam com sucesso;
4. a concorrência é agrupada por pull request ou branch, com cancelamento da execução anterior. Assim, um push novo impede que o SHA anterior continue até o portão.

O workflow roda em pull requests destinados a `main` e em pushes para `main`. Ele não desativa deployments de Preview de outras branches no Vercel.

## Configuração externa obrigatória

O `vercel.json` não associa um deployment a um status check arbitrário do GitHub. Portanto, o vínculo que impede a publicação antes da CI precisa ser configurado no projeto hospedado:

- em `main`, exija o check **`CI / deployment-gate`** e a branch atualizada antes do merge;
- na integração Vercel/GitHub, configure a produção para aguardar o mesmo check antes de promover o commit;
- mantenha os previews de pull request habilitados; eles também recebem o resultado do workflow, mas não são promovidos para produção;
- restrinja deploys manuais de produção a quem também pode confirmar que o SHA está no `HEAD` de `main` e que o check terminou com sucesso.

Os nomes das telas variam conforme o plano e a versão do GitHub/Vercel. A evidência de conclusão deve registrar o SHA publicado e o status `CI / deployment-gate` correspondente. Não considere apenas um build verde da Vercel como aprovação da CI.

## Verificação local

```bash
npm run check:a11y
npm test
npm run build
npm run test:e2e
```

O teste `tests/unit/ci-contract.test.js` protege o contrato versionado do workflow e a documentação da parte externa do portão.
