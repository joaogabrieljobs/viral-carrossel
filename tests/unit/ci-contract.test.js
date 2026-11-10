import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('contrato de CI e publicação', () => {
  const workflow = source('.github/workflows/ci.yml');
  const guide = source('docs/engineering/ci-deployment-gate.md');

  it('executa acessibilidade, testes, build e E2E antes do portão', () => {
    expect(workflow).toContain('run: npm run check:a11y');
    expect(workflow).toContain('run: npm test -- --reporter=default');
    expect(workflow).toContain('run: npm run build');
    expect(workflow).toContain('run: npm run test:e2e');
    expect(workflow).toMatch(/e2e:\n\s+name: e2e\n\s+needs: test/);
    expect(workflow).toMatch(/deployment-gate:\n\s+name: deployment-gate\n\s+if: \$\{\{ always\(\) \}\}\n\s+needs: \[test, e2e\]/);
  });

  it('cancela a validação obsoleta sem desativar previews legítimos', () => {
    expect(workflow).toContain('cancel-in-progress: true');
    expect(workflow).toContain('github.event.pull_request.number || github.ref');
    expect(guide).toContain('não desativa deployments de Preview');
    expect(guide).toContain('CI / deployment-gate');
    expect(guide).toContain('configurado no projeto hospedado');
  });
});
