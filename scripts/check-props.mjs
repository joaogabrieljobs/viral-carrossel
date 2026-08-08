#!/usr/bin/env node
/**
 * Auditoria de props entre componentes extraídos do monólito.
 *
 * Classe de bug que `check-undefined` NÃO pega: um componente que antes vivia
 * no mesmo escopo do App passou a receber tudo por prop; se o call site esquecer
 * uma, o valor chega `undefined` — sem erro de build, sem erro de escopo, e a
 * feature simplesmente não funciona (foi o caso de `setHookLibrary`/`niche`).
 *
 * Compara, para cada componente com props desestruturadas na assinatura, o que
 * ele DECLARA contra o que os call sites JSX PASSAM. Reporta:
 *   - prop usada no corpo, sem default, e nunca passada por nenhum call site
 *   - prop passada por algum call site mas ausente da assinatura (typo)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default ?? _traverse;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.js', '.jsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const files = ['ViralCarrossel.jsx', ...walk('src')];
const parsed = new Map();
for (const f of files) {
  try {
    parsed.set(f, {
      code: readFileSync(f, 'utf8'),
      ast: parse(readFileSync(f, 'utf8'), {
        sourceType: 'module',
        plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
      }),
    });
  } catch { /* já reportado por check-undefined */ }
}

/** componente -> { declaradas:Set, comDefault:Set, arquivo } */
const componentes = new Map();
for (const [file, { ast, code }] of parsed) {
  traverse(ast, {
    Function(path) {
      const id =
        path.node.id?.name ||
        (path.parent.type === 'VariableDeclarator' && path.parent.id.type === 'Identifier'
          ? path.parent.id.name
          : null);
      if (!id || !/^[A-Z]/.test(id)) return;
      const p0 = path.node.params[0];
      if (!p0 || p0.type !== 'ObjectPattern') return;
      const declaradas = new Set();
      const comDefault = new Set();
      for (const prop of p0.properties) {
        if (prop.type === 'RestElement') { declaradas.add('...rest'); continue; }
        const nome = prop.key?.name;
        if (!nome) continue;
        declaradas.add(nome);
        if (prop.value?.type === 'AssignmentPattern') comDefault.add(nome);
      }
      componentes.set(id, { declaradas, comDefault, file, code: code.slice(path.node.start, path.node.end) });
    },
  });
}

/** componente -> Set(props passadas em algum call site) */
const passadas = new Map();
for (const [, { ast }] of parsed) {
  traverse(ast, {
    JSXOpeningElement(path) {
      const nome = path.node.name.type === 'JSXIdentifier' ? path.node.name.name : null;
      if (!nome || !componentes.has(nome)) return;
      const set = passadas.get(nome) ?? new Set();
      for (const attr of path.node.attributes) {
        if (attr.type === 'JSXSpreadAttribute') set.add('...spread');
        else if (attr.name?.name) set.add(attr.name.name);
      }
      passadas.set(nome, set);
    },
  });
}

let problemas = 0;
for (const [nome, { declaradas, comDefault, file, code }] of componentes) {
  const dadas = passadas.get(nome);
  if (!dadas) continue;               // não instanciado via JSX neste repo
  if (dadas.has('...spread')) continue; // spread — não dá para concluir

  for (const prop of declaradas) {
    // `children` chega pelos filhos do JSX, não como atributo
    if (prop === '...rest' || prop === 'children' || comDefault.has(prop)) continue;
    if (dadas.has(prop)) continue;
    // só reporta se a prop é REALMENTE usada no corpo
    const usada = new RegExp(`\\b${prop}\\b`).test(code.replace(/^[^)]*\)/, ''));
    if (!usada) continue;
    console.error(`✖ ${file}  <${nome}> declara e usa '${prop}', mas nenhum call site passa`);
    problemas++;
  }
  for (const prop of dadas) {
    if (prop === 'key' || prop === 'ref' || prop === '...spread') continue;
    if (declaradas.has(prop) || declaradas.has('...rest')) continue;
    console.error(`⚠ ${basename(file)}  <${nome}> recebe '${prop}', que não existe na assinatura`);
    problemas++;
  }
}

if (problemas) {
  console.error(`\n${problemas} inconsistência(s) de props.`);
  process.exit(1);
}
console.log(`✓ ${componentes.size} componentes: props consistentes com os call sites`);
