#!/usr/bin/env node
/**
 * Lista `<button>` sem rótulo acessível: só ícone, sem `aria-label` /
 * `aria-labelledby` e sem texto entre as tags. Leitor de tela anuncia
 * "botão" e nada mais.
 *
 *   node scripts/check-a11y.mjs          # relatório
 *   node scripts/check-a11y.mjs --fix    # converte `title` em `aria-label`
 *   node scripts/check-a11y.mjs --strict # sai 1 se houver pendência (CI)
 *
 * `--fix` só age onde existe `title`: copiar um texto que já foi escrito para
 * o usuário é seguro. Botão de ícone puro sem `title` exige decidir o rótulo —
 * inventar às cegas é pior que a ausência, então esses só são listados.
 *
 * NÃO roda no `npm test` de propósito: hoje há 28 pendências conhecidas e o
 * gate ficaria vermelho permanentemente. Use `--strict` quando a fila zerar.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default ?? _traverse;
const fix = process.argv.includes('--fix');
const strict = process.argv.includes('--strict');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.js', '.jsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

/** um <button> tem rótulo se traz aria-* ou qualquer filho que renderize texto */
function temRotulo(node, attrs) {
  const nomes = attrs.map((a) => a.name.name);
  if (nomes.includes('aria-label') || nomes.includes('aria-labelledby')) return true;
  return node.children.some(
    (c) =>
      (c.type === 'JSXText' && c.value.trim()) ||
      (c.type === 'JSXExpressionContainer' &&
        c.expression.type !== 'JSXEmptyExpression' &&
        c.expression.type !== 'JSXElement'),
  );
}

let semTitle = 0;
let corrigidos = 0;

for (const file of ['ViralCarrossel.jsx', ...walk('src')]) {
  const code = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties'] });
  } catch {
    continue;
  }

  const inserts = [];
  const pendentes = [];

  traverse(ast, {
    JSXElement(path) {
      const open = path.node.openingElement;
      if (open.name.name !== 'button') return;
      const attrs = open.attributes.filter((a) => a.type === 'JSXAttribute');
      if (temRotulo(path.node, attrs)) return;

      const linha = code.slice(0, open.start).split('\n').length;
      const title = attrs.find((a) => a.name.name === 'title');
      if (title?.value) {
        if (fix) {
          inserts.push({
            pos: title.start,
            texto: `${code.slice(title.start, title.end).replace(/^title=/, 'aria-label=')} `,
          });
        } else {
          pendentes.push(`${file}:${linha}  tem title — corrigível com --fix`);
        }
      } else {
        pendentes.push(`${file}:${linha}  ícone puro — precisa de rótulo escrito à mão`);
        semTitle++;
      }
    },
  });

  if (fix && inserts.length) {
    let out = code;
    for (const ins of inserts.sort((a, b) => b.pos - a.pos)) {
      out = out.slice(0, ins.pos) + ins.texto + out.slice(ins.pos);
    }
    writeFileSync(file, out);
    console.log(`${file}: +${inserts.length} aria-label`);
    corrigidos += inserts.length;
  }
  for (const p of pendentes) console.log(p);
}

if (fix) {
  console.log(`\n${corrigidos} aria-label adicionados a partir de title.`);
} else {
  console.log(`\n${semTitle} botão(ões) de ícone puro sem rótulo — backlog (docs/audit-produto.md).`);
}
if (strict && semTitle) process.exit(1);
