import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// MT-13: o .env.example não citava nenhuma flag `*_BACKEND`. Quem subia um
// ambiente pelo modelo ficava no armazenamento legado e sem cota de texto,
// sem aviso. Este teste lê só o modelo versionado e o código; nunca um .env real.
const root = fileURLToPath(new URL('../../', import.meta.url));

function sourceFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

function envNamesIn(dir, pattern) {
  const names = new Set();
  for (const file of sourceFiles(dir)) {
    for (const match of readFileSync(join(root, file), 'utf8').matchAll(pattern)) names.add(match[1]);
  }
  return [...names].sort();
}

const example = readFileSync(join(root, '.env.example'), 'utf8');
/** A variável conta como documentada quando aparece como atribuição, comentada ou não. */
const documented = (name) => new RegExp(`^#?\\s*${name}=`, 'm').test(example);

describe('.env.example × variáveis lidas pelo código', () => {
  it('cita toda flag *_BACKEND lida por process.env em api/', () => {
    const backends = envNamesIn('api', /process\.env\.([A-Z0-9_]+_BACKEND)\b/g);
    // Se a lista esvaziar, o teste deixou de olhar para o lugar certo.
    expect(backends).toContain('LIBRARY_SYNC_BACKEND');
    expect(backends.length).toBeGreaterThanOrEqual(6);
    expect(backends.filter((name) => !documented(name))).toEqual([]);
  });

  it('cita o banco, as cotas e os tetos de que a produção depende', () => {
    const required = [
      'DATABASE_URL',
      'UPSTASH_DISABLED',
      'TEXT_DAILY_LIMIT_ESSENTIAL',
      'TEXT_DAILY_LIMIT_CREATOR',
      'TEXT_DAILY_LIMIT_PRO',
      'TEXT_DAILY_LIMIT_MAX',
      'PROJECTS_MAX_PER_ACCOUNT',
      'MOONT_ADMIN_ACCOUNTS',
      'VITE_PROJECTS_V2',
    ];
    expect(required.filter((name) => !documented(name))).toEqual([]);
  });

  it('não traz valor real nem o nome antigo do produto', () => {
    expect(example).not.toMatch(/Viral\.\s*Studio/);
    expect(example).not.toMatch(/metadados do cliente Stripe \(chave vc_img_/);
    // Linhas ativas (sem #) fariam o modelo configurar algo sozinho ao ser copiado.
    expect(example.split('\n').filter((line) => /^[A-Z0-9_]+=/.test(line))).toEqual([]);
  });
});
