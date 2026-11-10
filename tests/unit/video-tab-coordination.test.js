import { afterEach, describe, expect, it } from 'vitest';
import { createVideoTabCoordinator } from '../../src/utils/video-tab-coordination.js';

class FakeBroadcastChannel {
  static groups = new Map();

  constructor(name) {
    this.name = name;
    this.onmessage = null;
    const group = FakeBroadcastChannel.groups.get(name) || new Set();
    group.add(this);
    FakeBroadcastChannel.groups.set(name, group);
  }

  postMessage(data) {
    for (const peer of FakeBroadcastChannel.groups.get(this.name) || []) {
      if (peer === this) continue;
      queueMicrotask(() => peer.onmessage?.({ data: structuredClone(data) }));
    }
  }

  close() {
    FakeBroadcastChannel.groups.get(this.name)?.delete(this);
  }
}

describe('proteção de vídeos entre abas', () => {
  const coordinators = [];
  afterEach(() => {
    coordinators.splice(0).forEach((coordinator) => coordinator.close());
    FakeBroadcastChannel.groups.clear();
  });

  const tab = (tabId) => {
    const coordinator = createVideoTabCoordinator({
      BroadcastChannelCtor: FakeBroadcastChannel,
      channelName: 'test-video-gc',
      tabId,
      defaultWaitMs: 20,
    });
    coordinators.push(coordinator);
    return coordinator;
  };

  it('uma aba coleta IDs alcançáveis pelo Desfazer das outras abas vivas', async () => {
    const first = tab('aba-a');
    const second = tab('aba-b');
    first.register(() => ['video-editor-a', 'video-undo-a']);
    second.register(() => ['video-editor-b', 'video-undo-b']);

    const protectedIds = await first.collect(['video-biblioteca-a']);

    expect([...protectedIds].sort()).toEqual([
      'video-biblioteca-a', 'video-editor-a', 'video-editor-b', 'video-undo-a', 'video-undo-b',
    ]);
  });

  it('deixa de anunciar o histórico quando a aba remove o registro', async () => {
    const first = tab('aba-a');
    const second = tab('aba-b');
    const unregister = second.register(() => ['video-undo-b']);
    expect(await first.collect()).toContain('video-undo-b');

    unregister();

    expect(await first.collect()).not.toContain('video-undo-b');
  });

  it('sem BroadcastChannel conserva ao menos a proteção da própria aba', async () => {
    const coordinator = createVideoTabCoordinator({ BroadcastChannelCtor: null, tabId: 'sem-bc' });
    coordinators.push(coordinator);
    coordinator.register(() => ['video-local']);

    expect([...await coordinator.collect(['video-semente'])].sort())
      .toEqual(['video-local', 'video-semente']);
  });
});
