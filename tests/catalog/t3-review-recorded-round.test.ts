// @vitest-environment node
import type * as Crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { afterEach, expect, it, vi } from 'vitest';
import recordedReads from '../fixtures/t3-direct-dispatch-2026-11-21/thread-reads.json';
import {
  recordedDirectReturn,
  recordedReadArgs,
  recordedThreadRead,
  syntheticTools,
} from './t3-code-mode-fixture';
import { cleanUp, fixture, snapshot } from './t3-review-harness';

/**
 * The first real round of the direct procedure (2026-11-21), replayed on its
 * sanitised recording: the direct delegate_task return (the bare task object)
 * and t3_thread_read answering exactly as recorded, the original message read
 * from the start and then from text offsets 2048 and 4096. The round here is
 * captured with a fixed nonce, request id and fetch time, so its frozen task
 * is the recorded original message's text after the review prefix. The
 * running child's thread read is a reconstruction (recordedThreadRead), and
 * so is the completed task_status. The bridge's actions run in this process
 * (t3-bridge-in-process.ts).
 */
afterEach(cleanUp);
/** The capture's random values, in the order it takes them. */
const uuids = vi.hoisted((): string[] => []);
vi.mock('node:crypto', async (importOriginal) => {
  const crypto = await importOriginal<typeof Crypto>();
  return { ...crypto, randomUUID: () => uuids.shift() ?? crypto.randomUUID() };
});
const nonce = '55555555-5555-4555-8555-555555555555';
// The child's thread id carries the request id (`t3-review-<id>`).
const requestId = '22222222-2222-4222-8222-222222222222';
const fetchedAt = '2026-11-21T22:00:00.000Z';
/** The task text before the manifest: made up, of the length that gives the recorded text's. */
const template = `Placeholder review task. ${'p'.repeat(2865)}`;
const reviewPrefix = 'Act as the review sub-agent for this task.\n\n';
const returned = recordedDirectReturn();
const caller = recordedReads.thread.parentThreadId;
/** The reviewer the recorded round dispatched, as its return names it. */
const target = {
  providerInstanceId: returned.providerInstanceId,
  model: returned.model,
  options: Object.fromEntries(
    returned.options.map(({ id, value }) => [id, value]),
  ),
};
/** A completed task status, built from the return: none was recorded. */
const completedStatus = {
  ...returned,
  status: 'completed',
  workState: 'result_available',
  latestTerminalRunId: returned.childRunId,
  latestTerminalStatus: 'completed',
  summary: 'Review report written.',
  resultContextTransferId: 'transfer:replay',
};
/** A served thread read, as a variant changes it. */
type Page = { items: Record<string, unknown>[] } & Record<string, unknown>;
async function round({
  task = template,
  roundCaller = caller,
}: { task?: string; roundCaller?: string } = {}) {
  uuids.splice(0, uuids.length, nonce, requestId);
  const { dir } = await fixture({
    caller: roundCaller,
    target,
    prefix: task,
    fetchedAt,
  });
  const frozen = z
    .object({ task: z.string() })
    .parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
  return { dir, frozen: frozen.task };
}
async function replay({
  state = 'running',
  roundCaller = caller,
  task,
  variant,
}: {
  state?: 'running' | 'completed';
  roundCaller?: string;
  task?: string;
  /** Changes a recorded page before it is served. */
  variant?: (page: Page, args: unknown) => Page;
} = {}) {
  const { dir } = await round({ task, roundCaller });
  const recorded = recordedThreadRead({ state });
  const world = await syntheticTools({
    dir,
    caller: roundCaller,
    status: state === 'running' ? returned : completedStatus,
    read: variant ? (args) => variant(recorded(args), args) : recorded,
  });
  return { dir, world };
}
const [firstPage, , lastPage] = recordedReads.fromStart.map(
  ({ response }) => response,
);
const original = firstPage?.items[0];
it("holds the replay round's frozen task, after the review prefix, as the recorded original message in three slices", async () => {
  const { frozen } = await round();
  expect(
    recordedReads.fromStart.map(({ response }) => response.items[0]?.text),
  ).toEqual([
    (reviewPrefix + frozen).slice(0, 2048),
    (reviewPrefix + frozen).slice(2048, 4096),
    (reviewPrefix + frozen).slice(4096),
  ]);
  expect(lastPage?.items[0]?.text).toHaveLength(144);
});
it.each(['running', 'completed'] as const)(
  'binds the recorded bare direct return with the recorded thread reads (%s child)',
  async (state) => {
    const { dir, world } = await replay({ state });
    await expect(world.bind(returned)).resolves.toEqual({ bound: true });
    // From the start, then the original message's text from 2048 and 4096;
    // no later message (a second message from the caller among them) is read.
    expect(world.reads).toEqual(recordedReadArgs.fromStart);
    expect(world.reads).toMatchObject([
      { threadId: returned.childThreadId, afterPosition: -1 },
      { itemId: original?.itemId, textOffset: 2048 },
      { itemId: original?.itemId, textOffset: 4096 },
    ]);
    const binding = JSON.parse(
      await readFile(join(dir, 'dispatch.json'), 'utf8'),
    );
    expect(binding.original.itemId).toBe(original?.itemId);
    expect(
      JSON.parse(await readFile(join(dir, 'dispatch-return.json'), 'utf8')),
    ).toEqual(returned);
  },
);
/** The recorded child's first assistant message at the thread's start. */
const childFirst = (page: Page, args: unknown): Page =>
  isDeepStrictEqual(args, recordedReadArgs.fromStart[0])
    ? {
        ...page,
        items: recordedThreadRead({ state: 'running' })(
          recordedReadArgs.laterMessage,
        ).items.map((item) => ({ ...item, position: 0 })),
      }
    : page;
/** One character of the original message's last slice changed. */
const changedText = (page: Page, args: unknown): Page =>
  isDeepStrictEqual(args, recordedReadArgs.fromStart[2])
    ? {
        ...page,
        items: page.items.map((item) => ({
          ...item,
          text: String(item.text).replace('p', 'q'),
        })),
      }
    : page;
it.each([
  [
    "a thread whose first message is the child's own",
    { variant: childFirst },
    'senderThreadId',
  ],
  [
    'another caller',
    { roundCaller: 'thread:another-caller' },
    'Original-message thread/parent/run differs.',
  ],
  [
    'changed text',
    { variant: changedText },
    'Original message differs from the full frozen nonce-bearing task.',
  ],
  [
    "another task's return (its child's original message is another task)",
    { task: `Another review task. ${'p'.repeat(2869)}` },
    'Original message differs from the full frozen nonce-bearing task.',
  ],
])(
  'refuses %s against the recorded reads, writing nothing',
  async (_name, given, reason) => {
    const { dir, world } = await replay(given);
    const before = await snapshot(dir);
    const refusal = world.bind(returned);
    await expect(refusal).rejects.toThrow(
      'T3 bridge failed or output was incomplete',
    );
    await expect(refusal).rejects.toThrow(reason);
    expect(await snapshot(dir)).toEqual(before);
  },
);
