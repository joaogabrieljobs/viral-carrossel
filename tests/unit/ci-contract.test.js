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

  // MT-13: CLAUDE.md e README.md diziam "2 jobs: test + e2e". Quem lia a
  // instrução conferia o check errado antes de considerar a publicação feita.
  it('CLAUDE.md e README.md citam os três jobs e o check exigido', () => {
    const jobNames = [...workflow.matchAll(/^  [a-z0-9-]+:\n\s+name: ([a-z0-9-]+)$/gm)].map((m) => m[1]);
    expect(jobNames).toEqual(['quality', 'e2e', 'deployment-gate']);
    for (const doc of ['CLAUDE.md', 'README.md']) {
      const text = source(doc);
      for (const job of jobNames) expect(text, `${doc} cita o job ${job}`).toContain(`\`${job}\``);
      expect(text, `${doc} cita o check exigido`).toContain('CI / deployment-gate');
      expect(text, `${doc} não fala mais em 2 jobs`).not.toMatch(/2 jobs/);
    }
  });
  // MT-03 (auditoria 23/11): a produção roda com Projetos V2 ligado e o CI só
  // testava o bundle sem a flag. Um defeito real de salvamento (projeto sumia
  // ao recarregar logo depois de editar) ficou escondido assim.
  it('o job de navegador roda também o caminho de produção dos Projetos V2', () => {
    const step = workflow.match(/- name: E2E Projetos V2[^\n]*\n(?:\s+.*\n)*?\s+run: ([^\n]+)/);
    expect(step, 'passo "E2E Projetos V2" no workflow').not.toBeNull();
    expect(workflow).toMatch(/- name: E2E Projetos V2[^\n]*\n\s+env:\n\s+VITE_PROJECTS_V2: 'true'/);
    for (const spec of ['projects-v2.spec.js', 'projects-v2-outbox-fallback.spec.js', 'save-after-deploy.spec.js', 'plano-gratis.spec.js', 'project-creation-flow.spec.js']) {
      expect(step[1], `o passo roda ${spec}`).toContain(`tests/e2e/${spec}`);
    }
  });
});
