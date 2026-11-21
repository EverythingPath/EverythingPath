// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { afterEach, expect, it } from 'vitest';
import earlier from '../fixtures/review-766/earlier-762-spec.json';
import earlierOriginal from '../fixtures/review-766/earlier-762-original.json';
import { cleanUp, fixture, snapshot } from './t3-review-harness';

/**
 * The child's original message, read independently through t3_thread_read:
 * its item, thread and run identities, its wrapper, pagination and UTF-16
 * reconstruction, and every refusal of a message that is not the frozen
 * nonce-bearing task. The bridge's actions run in this process
 * (t3-bridge-in-process.ts); the real bridge reads it in
 * t3-review-direct-return.test.ts (rule 5).
 */
afterEach(cleanUp);
it.each([
  {
    name: 'foreign same-selection running task',
    task: 'Foreign task',
    change: { status: 'running', workState: 'working' },
  },
  { name: 'wrong task text', task: 'Wrong nonce-bearing task' },
  {
    name: 'missing nonce',
    edit: (s: string) => s.replace(/"nonce": "[^"]+"/, '"nonce": ""'),
  },
])(
  'rejects $name through capture-owned dispatch at INITIAL binding',
  async ({ task, change, edit }) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const frozen = z
      .object({ task: z.string() })
      .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
    const adapter = await syntheticTools({
      dir,
      task: edit ? edit(frozen.task) : task,
      status: { ...syntheticStatus(), ...change },
    });
    const before = await snapshot(dir);
    await expect(adapter.execute('dispatch')).rejects.toThrow(
      'T3 bridge failed or output was incomplete',
    );
    expect(await snapshot(dir)).toEqual(before);
  },
);
it('rejects cross-capture replay despite identical brief/selection/record inputs', async () => {
  const one = await fixture();
  const two = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const request = JSON.parse(
    await readFile(join(one.dir, 'request.json'), 'utf8'),
  );
  const adapter = await syntheticTools({ dir: two.dir, task: request.task });
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'Original message differs',
  );
  await expect(readFile(join(two.dir, 'dispatch.json'))).rejects.toThrow(
    'ENOENT',
  );
});
it.each([
  ['sender', { senderThreadId: 'foreign:parent' }],
  ['source', { sourceThreadId: 'foreign:child' }],
  ['run', { runId: 'synthetic:run:2' }],
  ['missing run', { runId: null }],
  ['assistant quotation', { type: 'assistant_message' }],
  ['human steering', { createdBy: 'user', creationSource: 'web' }],
  ['provider origin', { creationSource: 'provider' }],
  ['inherited', { visibility: 'inherited' }],
  ['synthetic', { visibility: 'synthetic' }],
  ['missing sender', { senderThreadId: undefined }],
  ['missing message identity', { messageId: null }],
  ['missing item identity', { itemId: '' }],
  ['truncated no cursor', { textTruncated: true, nextTextOffset: null }],
  ['stalled UTF-16 cursor', { textTruncated: true, nextTextOffset: 0 }],
  ['false final cursor', { textTruncated: false, nextTextOffset: 2048 }],
])(
  'rejects invalid original-message %s without a binding',
  async (_name, changes) => {
    const { dir } = await fixture();
    const { syntheticTools } = await import('./t3-code-mode-fixture');
    const adapter = await syntheticTools({
      dir,
      mutateRead: (page) => ({
        ...page,
        items: page.items.map((item) => ({ ...item, ...changes })),
      }),
    });
    await expect(adapter.execute('dispatch')).rejects.toThrow(
      'T3 bridge failed or output was incomplete',
    );
    await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow(
      'ENOENT',
    );
  },
);
it.each([
  ['parent', { parentThreadId: 'foreign:parent' }],
  ['fork', { relationshipToParent: 'fork' }],
  ['missing relationship', { relationshipToParent: null }],
  ['later run', { latestRunId: 'synthetic:run:2', runCount: 2 }],
  ['wrong thread', { threadId: 'foreign:thread' }],
  ['pending question', { pendingRequestCount: 1 }],
])('rejects thread %s without a binding', async (_name, change) => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    mutateRead: (page) => ({ ...page, thread: { ...page.thread, ...change } }),
  });
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'T3 bridge failed or output was incomplete',
  );
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow('ENOENT');
});
it('does not select a later matching message after an original mismatch', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    mutateRead: (page) => ({
      ...page,
      hasMore: true,
      items: page.items.map((item) => ({
        ...item,
        text: 'Unrelated original message',
      })),
    }),
  });
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'Original message differs',
  );
  expect(adapter.reads).toHaveLength(1);
});
it('recovers timeline pages and UTF-16 slices across a split non-BMP character', async () => {
  const { dir } = await fixture({ prefix: 'x'.repeat(2003) + '🦊' });
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    mutateRead: (page, args) => {
      const cursor = z
        .object({
          afterPosition: z.number().optional(),
          itemId: z.string().optional(),
        })
        .parse(args);
      if (cursor.afterPosition === undefined && cursor.itemId === undefined)
        return { ...page, items: [], hasMore: true, nextPosition: 0 };
      return {
        ...page,
        items: page.items.map((item) => ({ ...item, position: 1 })),
      };
    },
  });
  await adapter.execute('dispatch');
  expect(adapter.reads).toHaveLength(3);
  expect(adapter.reads[2]).toMatchObject({
    itemId: 'synthetic:item:original',
    textOffset: 2048,
  });
});
it.each([
  'changed item',
  'changed thread',
  'stalled timeline',
  'missing message',
])('rejects %s pagination', async (problem) => {
  const { dir } = await fixture({ prefix: 'x'.repeat(2200) });
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  let count = 0;
  const adapter = await syntheticTools({
    dir,
    mutateRead: (page) => {
      count++;
      if (problem === 'changed item' && count > 1)
        return {
          ...page,
          items: page.items.map((item) => ({ ...item, updatedAt: 'changed' })),
        };
      if (problem === 'changed thread' && count > 1)
        return { ...page, thread: { ...page.thread, createdAt: 'changed' } };
      if (problem === 'stalled timeline')
        return { ...page, items: [], hasMore: true, nextPosition: 0 };

      if (problem === 'missing message')
        return { ...page, items: [], hasMore: false };
      return page;
    },
  });
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'T3 bridge failed or output was incomplete',
  );
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow('ENOENT');
});
it('refuses an unchanged authentic #762 completion at INITIAL capture-owned binding with the same parent', async () => {
  // Same-parent capture is synthetic; the foreign status and original message are unchanged authentic observations.
  const caller = earlierOriginal.thread.parentThreadId;
  const { dir } = await fixture({ caller });
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({
    dir,
    caller,
    returned: earlier.result,
    status: earlier.result,
  });
  adapter.tools.mcp__t3_code__t3_thread_read = async () => earlierOriginal;
  await expect(adapter.execute('dispatch')).rejects.toThrow(
    'Original message differs from the full frozen nonce-bearing task',
  );
  await expect(readFile(join(dir, 'dispatch.json'))).rejects.toThrow('ENOENT');
});
it.each([
  ['bare payload', ''],
  ['changed wrapper', 'Act as the implementation sub-agent for this task.\n\n'],
  [
    'duplicated wrapper',
    'Act as the review sub-agent for this task.\n\nAct as the review sub-agent for this task.\n\n',
  ],
  [
    'arbitrary preamble',
    'Please review:\n\nAct as the review sub-agent for this task.\n\n',
  ],
])(
  'rejects %s at capture-owned binding without changing captured outputs',
  async (_name, prefix) => {
    const { dir } = await fixture();
    const { syntheticTools, syntheticPage } =
      await import('./t3-code-mode-fixture');
    const request = z
      .object({ task: z.string() })
      .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
    const adapter = await syntheticTools({
      dir,
      mutateRead: (_page, args) =>
        syntheticPage({
          task: prefix + request.task,
          offset: z.object({ textOffset: z.number().optional() }).parse(args)
            .textOffset,
        }),
    });
    const before = await snapshot(dir);
    await expect(adapter.execute('dispatch')).rejects.toThrow(
      'Original message differs',
    );
    expect(await snapshot(dir)).toEqual(before);
  },
);
