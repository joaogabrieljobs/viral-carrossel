#!/usr/bin/env node
/**
 * Detecta identificadores referenciados mas nunca definidos/importados.
 *
 * O `vite build` NÃO pega isso: dentro de um módulo JS, referenciar um nome
 * inexistente só explode em runtime. Durante a decomposição do monólito esse
 * foi o modo de falha recorrente (`typographyPatchFromBrand`, `ClassicCanvasInner`,
 * `downloadCanvasPng`, `title`) — build verde, app quebrado.
 *
 * Roda junto do `npm test`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default ?? _traverse;

const GLOBALS = new Set([
  'window', 'document', 'navigator', 'console', 'localStorage', 'sessionStorage',
  'fetch', 'Promise', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Date', 'Error', 'TypeError', 'RangeError', 'Set', 'Map', 'WeakMap', 'Symbol',
  'RegExp', 'Intl', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
  'Image', 'Audio', 'Request', 'Response', 'Headers', 'AbortController', 'Event',
  'CustomEvent', 'IntersectionObserver', 'ResizeObserver', 'MutationObserver',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  'atob', 'btoa', 'structuredClone', 'crypto', 'performance', 'process',
  'Buffer', 'globalThis', 'undefined', 'NaN', 'Infinity', 'isNaN', 'isFinite',
  'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'indexedDB', 'IDBKeyRange', 'DataTransfer', 'Uint8Array', 'ArrayBuffer', 'Int32Array',
  'HTMLElement', 'Node', 'DOMParser', 'XMLHttpRequest', 'alert', 'confirm', 'prompt',
  'getComputedStyle', 'matchMedia', 'history', 'location', 'screen', 'CSS', 'Canvas',
  'HTMLCanvasElement', 'HTMLImageElement', 'OffscreenCanvas', 'createImageBitmap',
  'ClipboardItem', 'Notification', 'WebSocket', 'BroadcastChannel', 'Worker',
  'DOMException', 'TextEncoder', 'TextDecoder', 'CSSStyleSheet',
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (['.js', '.jsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const files = ['ViralCarrossel.jsx', ...walk('src')];
let problems = 0;

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (e) {
    console.error(`✖ ${file}: não parseia — ${e.message}`);
    problems++;
    continue;
  }

  const seen = new Set();
  traverse(ast, {
    ReferencedIdentifier(path) {
      const name = path.node.name;
      if (GLOBALS.has(name) || seen.has(name)) return;
      // JSX intrínseco (<div>, <span>) não é referência a variável
      if (path.parent.type?.startsWith('JSX') && /^[a-z]/.test(name)) return;
      if (path.scope.hasBinding(name, true)) return;
      seen.add(name);
      const line = code.slice(0, path.node.start).split('\n').length;
      console.error(`✖ ${file}:${line}  '${name}' não está definido nem importado`);
      problems++;
    },
  });
}

if (problems) {
  console.error(`\n${problems} identificador(es) não resolvido(s) — o app quebraria em runtime.`);
  process.exit(1);
}
console.log(`✓ ${files.length} arquivos: nenhum identificador não resolvido`);
