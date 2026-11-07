import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, setAIRuntimeSettings } from '../../src/utils/ai-client.js';
import { formatGenerationElapsed } from '../../src/components/GenerationStatus.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
  setAIRuntimeSettings({});
});

describe('feedback de espera e nova tentativa', () => {
  it('informa a troca de tentativa quando o serviço está temporariamente ocupado', async () => {
    setAIRuntimeSettings({ textProvider:'zai', keys:{} });
    const onRetry = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error:{ message:'temporarily overloaded' },
      }), { status:503, headers:{ 'Content-Type':'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices:[{ message:{ content:JSON.stringify({ ok:true }) } }],
      }), { status:200, headers:{ 'Content-Type':'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAI('teste', { json:true, onRetry })).resolves.toEqual({ ok:true });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
      attempt:2,
      reason:'serviço temporariamente ocupado',
    }));
  });

  it('formata o tempo decorrido sem sugerir avanço inexistente', () => {
    expect(formatGenerationElapsed(0)).toBe('0:00');
    expect(formatGenerationElapsed(75)).toBe('1:15');
    expect(formatGenerationElapsed(-3)).toBe('0:00');
  });
});
