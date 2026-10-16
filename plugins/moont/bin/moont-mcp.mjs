#!/usr/bin/env node
import readline from 'node:readline';
import { MoontApiClient, MoontApiError } from '../src/client.mjs';
import { createMoontTools, TOOL_DEFINITIONS } from '../src/tools.mjs';

const service = createMoontTools(new MoontApiClient());
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const supportedVersions = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function toolResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    isError: value?.ok === false,
  };
}

async function dispatch(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    if (message?.id !== undefined) send({ jsonrpc: '2.0', id: message.id, error: { code: -32600, message: 'Invalid request' } });
    return;
  }
  if (message.id === undefined) return; // MCP notifications do not receive responses.

  const { id, method, params = {} } = message;
  try {
    let result;
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: supportedVersions.has(params.protocolVersion) ? params.protocolVersion : '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'moont', version: '0.1.3' },
          instructions: 'Consulte get_visual_schema. Faça preview_visual_batch antes de apply_visual_batch. O plugin edita somente visual; textos e fotos são preservados.',
        };
        break;
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = { tools: TOOL_DEFINITIONS };
        break;
      case 'tools/call': {
        if (typeof params.name !== 'string') throw new MoontApiError('Nome da ferramenta ausente.', { code: 'invalid_input' });
        result = toolResult(await service.invoke(params.name, params.arguments || {}));
        break;
      }
      default:
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
        return;
    }
    send({ jsonrpc: '2.0', id, result });
  } catch (error) {
    // Never forward raw network errors, headers, or credentials over the protocol.
    const publicError = error instanceof MoontApiError
      ? { ok: false, code: error.code, status: error.status, message: error.message, cloudVersion: error.cloudVersion }
      : { ok: false, code: 'internal_error', message: 'Falha inesperada no plugin Moont. Tente novamente.' };
    send({ jsonrpc: '2.0', id, result: toolResult(publicError) });
  }
}

let queue = Promise.resolve();
input.on('line', (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  queue = queue.then(() => dispatch(message)).catch(() => {
    // Keep the transport alive. All tool errors are returned by dispatch.
  });
});
