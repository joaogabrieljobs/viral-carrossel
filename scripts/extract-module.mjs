#!/usr/bin/env node
/**
 * Extrator AST do monólito ViralCarrossel.jsx.
 *
 *   node scripts/extract-module.mjs <destino.js> <Nome1> [Nome2 ...] [--dry]
 *
 * Usa @babel/parser para achar os limites REAIS de cada declaração top-level
 * (a versão anterior, por regex de `}` em coluna 0, cortava errado em blocos
 * com `};` aninhado e comia funções vizinhas — build passava e o app quebrava
 * em runtime). Calcula o fecho transitivo das dependências pelo escopo do
 * programa, move tudo junto e injeta o import no monólito.
 *
 * Regras:
 *  - aborta se algum bloco arrastado contiver JSX ou hooks (é componente);
 *  - aborta se um bloco selecionado ainda for referenciado no monólito por
 *    algo que NÃO vai junto e não está no import gerado;
 *  - nunca sobrescreve destino existente sem --force.
 *
 * O gate de verdade continua sendo `npm test && npm run test:e2e` — build
 * sozinho não detecta identificador inexistente no mesmo arquivo.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default ?? _traverse;
const MONO = 'ViralCarrossel.jsx';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const force = argv.includes('--force');
/** --component: permite JSX/hooks (extração de componentes React). */
const asComponent = argv.includes('--component');
const args = argv.filter((a) => !a.startsWith('--'));
const [dest, ...seeds] = args;

if (!dest || seeds.length === 0) {
  console.error('uso: node scripts/extract-module.mjs <destino.js> <Nome...> [--dry] [--force]');
  process.exit(1);
}
if (existsSync(dest) && !force) {
  console.error(`!! ${dest} já existe (use --force)`);
  process.exit(1);
}

const code = readFileSync(MONO, 'utf8');
const ast = parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
});

/** nome -> { start, end, node, kind } de declarações top-level */
const decls = new Map();
const importedNames = new Set();

for (const node of ast.program.body) {
  if (node.type === 'ImportDeclaration') {
    for (const s of node.specifiers) importedNames.add(s.local.name);
    continue;
  }
  const register = (name, n) => {
    if (!decls.has(name)) decls.set(name, { start: n.start, end: n.end, node: n, loc: n.loc });
  };
  if (node.type === 'FunctionDeclaration' && node.id) register(node.id.name, node);
  else if (node.type === 'VariableDeclaration') {
    // uma declaração pode ter vários declarators; trata o statement inteiro
    for (const d of node.declarations) {
      if (d.id.type === 'Identifier') register(d.id.name, node);
    }
  } else if (node.type === 'ClassDeclaration' && node.id) register(node.id.name, node);
}

const srcOf = ({ start, end }) => code.slice(start, end);

/** estende o início para trás, capturando comentários de bloco/linha colados */
function withLeadingComments(name) {
  const { node } = decls.get(name);
  let start = node.start;
  const comments = node.leadingComments || [];
  if (comments.length) {
    // só comentários imediatamente acima (sem linha em branco dupla no meio)
    for (let i = comments.length - 1; i >= 0; i--) {
      const c = comments[i];
      const between = code.slice(c.end, start);
      if (/^\s*$/.test(between) && (between.match(/\n/g) || []).length <= 1) start = c.start;
      else break;
    }
  }
  return { start, end: node.end };
}

/** identificadores referenciados dentro de um nó, resolvidos no escopo do programa */
function referencedTopLevel(name) {
  const { node } = decls.get(name);
  const out = new Set();
  const visit = (n) => {
    traverse(
      ast,
      {
        Identifier(path) {
          if (path.node.start < n.start || path.node.end > n.end) return;
          const id = path.node.name;
          if (id === name || !decls.has(id) || importedNames.has(id)) return;
          // ignora chaves de objeto e propriedades de membro (obj.foo)
          const p = path.parent;
          if (p.type === 'MemberExpression' && p.property === path.node && !p.computed) return;
          if ((p.type === 'ObjectProperty' || p.type === 'ObjectMethod') && p.key === path.node && !p.computed) return;
          if (p.type === 'JSXAttribute') return;
          if (!path.scope.hasBinding(id, true) || path.scope.getBinding(id)?.scope.block.type === 'Program') {
            out.add(id);
          }
        },
      },
      undefined,
      {},
      undefined,
    );
  };
  visit(node);
  return out;
}

/** Componente = tem nó JSX real ou chama hook. Via AST, não regex no texto:
 *  `<video>` citado num comentário não é JSX. */
function looksLikeComponent(name) {
  const { node } = decls.get(name);
  let found = false;
  traverse(ast, {
    enter(path) {
      if (found) return;
      if (path.node.start < node.start || path.node.end > node.end) return;
      if (path.node.type === 'JSXElement' || path.node.type === 'JSXFragment') found = true;
      if (
        path.node.type === 'CallExpression' &&
        path.node.callee.type === 'Identifier' &&
        /^use[A-Z]/.test(path.node.callee.name)
      ) found = true;
      if (
        path.node.type === 'CallExpression' &&
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.property?.type === 'Identifier' &&
        /^use[A-Z]/.test(path.node.callee.property.name)
      ) found = true;
    },
  });
  return found;
}

// ── fecho transitivo ─────────────────────────────────────────────────────────
const selected = [];
const seen = new Set();
const queue = [...seeds];
while (queue.length) {
  const n = queue.shift();
  if (seen.has(n)) continue;
  if (!decls.has(n)) {
    console.error(`!! declaração top-level não encontrada: ${n}`);
    process.exit(2);
  }
  seen.add(n);
  if (!asComponent && looksLikeComponent(n)) {
    console.error(`!! ${n} contém JSX/hooks (componente React) — use --component se for intencional`);
    process.exit(3);
  }
  selected.push(n);
  for (const dep of referencedTopLevel(n)) if (!seen.has(dep)) queue.push(dep);
}

selected.sort((a, b) => decls.get(a).start - decls.get(b).start);

// ── verifica que nada além do import fica pendurado ───────────────────────────
const ranges = selected.map((n) => withLeadingComments(n)).sort((a, b) => a.start - b.start);
// funde ranges que se tocam
const merged = [];
for (const r of ranges) {
  if (merged.length && r.start <= merged[merged.length - 1].end + 1) {
    merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
  } else merged.push({ ...r });
}

const moduleBody = merged.map((r) => code.slice(r.start, r.end)).join('\n\n');

// imports que o módulo precisa, derivados dos imports do monólito.
// Um identificador é "usado" quando aparece como Identifier/JSXIdentifier no
// corpo movido — regex de palavra basta aqui porque nomes importados são únicos.
const usedInModule = (nm) => new RegExp(`\\b${nm}\\b`).test(moduleBody);
/** caminho relativo do destino (src/components/x.jsx) para o alvo de import do monólito */
const destDir = dest.replace(/\/[^/]+$/, '');
function rewriteSource(source) {
  if (!source.startsWith('./src/')) return source;
  const abs = source.replace('./src/', 'src/');
  const from = destDir.split('/').filter(Boolean);
  const to = abs.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  const ups = from.length - i;
  const rel = (ups ? '../'.repeat(ups) : './') + to.slice(i).join('/');
  return rel.startsWith('.') ? rel : './' + rel;
}

const neededImports = [];
if (asComponent) {
  const hooks = ['useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useMemo', 'useCallback']
    .filter(usedInModule);
  const needsReact = /\bReact\./.test(moduleBody) || /<[A-Za-z]/.test(moduleBody);
  if (needsReact || hooks.length) {
    neededImports.push(
      `import React${hooks.length ? `, { ${hooks.join(', ')} }` : ''} from 'react';`,
    );
  }
}
for (const node of ast.program.body) {
  if (node.type !== 'ImportDeclaration') continue;
  const source = node.source.value;
  if (source === 'react') continue; // tratado acima
  // preserva a forma do specifier: default, namespace ou named
  const defaults = [];
  const named = [];
  for (const s of node.specifiers) {
    const nm = s.local.name;
    if (selected.includes(nm) || !usedInModule(nm)) continue;
    if (s.type === 'ImportDefaultSpecifier') defaults.push(nm);
    else if (s.type === 'ImportNamespaceSpecifier') defaults.push(`* as ${nm}`);
    else {
      // preserva alias: `import { SectionLabel as S }` — usar só `{ S }` quebra
      const orig = s.imported?.name ?? nm;
      named.push(orig === nm ? nm : `${orig} as ${nm}`);
    }
  }
  if (!defaults.length && !named.length) continue;
  const clause = [defaults.join(', '), named.length ? `{ ${named.join(', ')} }` : '']
    .filter(Boolean)
    .join(', ');
  neededImports.push(`import ${clause} from '${rewriteSource(source)}';`);
}

const header =
  `// Extraído de ${MONO} pelo extrator AST (scripts/extract-module.mjs).\n` +
  (neededImports.length ? neededImports.join('\n') + '\n' : '');
const moduleText =
  header + '\n' + moduleBody + '\n\nexport {\n' + selected.map((n) => `  ${n},\n`).join('') + '};\n';

// ── novo monólito ────────────────────────────────────────────────────────────
let out = code;
for (let i = merged.length - 1; i >= 0; i--) {
  out = out.slice(0, merged[i].start) + out.slice(merged[i].end);
}
const importPath = './' + dest.replace(/^\.\//, '');
const importStmt = `import {\n${selected.map((n) => `  ${n},\n`).join('')}} from '${importPath}';`;
const anchor = "import { GLOBAL_STYLE } from './src/styles/global-style.js';";
if (!out.includes(anchor)) {
  console.error('!! âncora de import não encontrada no monólito');
  process.exit(4);
}
out = out.replace(anchor, anchor + '\n' + importStmt);

// ── sanidade: o novo monólito ainda parseia? ─────────────────────────────────
try {
  parse(out, { sourceType: 'module', plugins: ['jsx', 'classProperties'] });
} catch (e) {
  console.error('!! monólito resultante não parseia:', e.message);
  process.exit(5);
}
try {
  parse(moduleText, { sourceType: 'module', plugins: ['jsx', 'classProperties'] });
} catch (e) {
  console.error('!! módulo gerado não parseia:', e.message);
  process.exit(6);
}

// ── sanidade: identificadores órfãos no monólito resultante ──────────────────
const outAst = parse(out, { sourceType: 'module', plugins: ['jsx', 'classProperties'] });
const outTop = new Set();
const outImported = new Set();
for (const node of outAst.program.body) {
  if (node.type === 'ImportDeclaration') for (const s of node.specifiers) outImported.add(s.local.name);
  else if (node.type === 'FunctionDeclaration' && node.id) outTop.add(node.id.name);
  else if (node.type === 'ClassDeclaration' && node.id) outTop.add(node.id.name);
  else if (node.type === 'VariableDeclaration')
    for (const d of node.declarations) if (d.id.type === 'Identifier') outTop.add(d.id.name);
}
const orphans = new Set();
traverse(outAst, {
  Identifier(path) {
    const id = path.node.name;
    if (!selected.includes(id)) return;
    if (outTop.has(id) || outImported.has(id)) return;
    orphans.add(id);
  },
});
if (orphans.size) {
  console.error(`!! nomes movidos ainda referenciados sem import: ${[...orphans].join(', ')}`);
  process.exit(7);
}

console.log(`${dry ? '[dry] ' : ''}${dest}: ${selected.length} declarações, ${moduleText.split('\n').length} linhas`);
console.log('   ', selected.join(', '));
if (dry) process.exit(0);

writeFileSync(dest, moduleText);
writeFileSync(MONO, out);
console.log('   monólito:', out.split('\n').length, 'linhas');
