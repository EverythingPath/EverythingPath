import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';

const text = z.string().min(1);
const itemSchema = z.object({
  itemId: text,
  messageId: text,
  position: z.number().int().nonnegative(),
  runId: text,
  sourceThreadId: text,
  senderThreadId: text,
  visibility: z.literal('local'),
  type: z.literal('user_message'),
  createdBy: z.literal('agent'),
  creationSource: z.literal('mcp'),
  status: z.literal('completed'),
  title: z.string().nullable(),
  updatedAt: text,
  text: z.string(),
  textTruncated: z.boolean(),
  nextTextOffset: z.number().int().nonnegative().nullable(),
});
const pageSchema = z.object({
  thread: z.object({
    threadId: text,
    parentThreadId: text,
    relationshipToParent: z.literal('subagent'),
    createdBy: z.literal('agent'),
    creationSource: z.literal('mcp'),
    createdAt: text,
    latestRunId: text,
    activeRunId: text.nullable(),
    runCount: z.literal(1),
    pendingRequestCount: z.literal(0),
  }),
  items: z.array(z.unknown()).max(1),
  hasMore: z.boolean(),
  nextPosition: z.number().int().nonnegative().nullable(),
});
type ThreadReadArgs = {
  threadId: string;
  view: 'messages';
  limit: number;
  maxCharsPerItem: number;
  runLimit: number;
  afterPosition?: number;
  itemId?: string;
  textOffset?: number;
};
function requireMatch(matches: boolean, message: string): asserts matches {
  if (!matches) throw new Error(message);
}
// Local review-role-v1 policy, observed in #766 qualification on 2026-10-23;
// not a server version guarantee. Bare equality is only for archived v2 replay.
const reviewRolePrefix = 'Act as the review sub-agent for this task.\n\n';
const originalTextBound = 16000;
export function requireT3ReviewTaskFits({ task }: { task: string }) {
  requireMatch(
    reviewRolePrefix.length + task.length <= originalTextBound,
    'Original-message text bound exceeded for review-role-v1.',
  );
}
/** Replay the exact reads from the beginning; never search later history for a match. */
export function recoverT3Original({
  parentThreadId,
  childThreadId,
  childRunId,
  expectedText,
  role,
  policy,
  observations,
  toolData,
}: {
  parentThreadId: string;
  childThreadId: string;
  childRunId: string;
  expectedText: string;
  role: string;
  policy: 'bare-task-v2' | 'review-role-v1';
  observations: { args: unknown; response: unknown }[];
  toolData: (response: unknown) => unknown;
}):
  | { kind: 'next'; args: ThreadReadArgs }
  | { kind: 'complete'; text: string; itemId: string; messageId: string } {
  let args: ThreadReadArgs = {
    threadId: childThreadId,
    view: 'messages',
    limit: 1,
    maxCharsPerItem: 2048,
    runLimit: 1,
  };
  let lineage: z.infer<typeof pageSchema>['thread'] | undefined;
  let original:
    | Omit<
        z.infer<typeof itemSchema>,
        'text' | 'textTruncated' | 'nextTextOffset'
      >
    | undefined;
  let fullText = '';
  for (const [index, observation] of observations.entries()) {
    requireMatch(index < 32, 'Original-message read bound exceeded.');
    requireMatch(
      isDeepStrictEqual(args, observation.args),
      'Original-message read cursor changed.',
    );
    const page = pageSchema.parse(toolData(observation.response));
    requireMatch(
      page.thread.threadId === childThreadId &&
        page.thread.parentThreadId === parentThreadId &&
        page.thread.latestRunId === childRunId &&
        (page.thread.activeRunId === null ||
          page.thread.activeRunId === childRunId),
      'Original-message thread/parent/run differs.',
    );
    // Only stable lineage is compared; item counts and thread activity can grow.
    const stable = { ...page.thread, activeRunId: null };
    if (lineage)
      requireMatch(
        isDeepStrictEqual(lineage, stable),
        'Original-message thread metadata changed.',
      );
    lineage = stable;
    const first = page.items[0];
    if (first === undefined) {
      requireMatch(
        !args.itemId &&
          page.hasMore &&
          page.nextPosition !== null &&
          page.nextPosition > (args.afterPosition ?? -1),
        'Missing original message or stalled timeline pagination.',
      );
      args = { ...args, afterPosition: page.nextPosition };
      continue;
    }
    const {
      text: slice,
      textTruncated,
      nextTextOffset,
      ...metadata
    } = itemSchema.parse(first);
    requireMatch(
      metadata.sourceThreadId === childThreadId &&
        metadata.senderThreadId === parentThreadId &&
        metadata.runId === childRunId,
      'Original message sender/source/run differs.',
    );
    requireMatch(
      metadata.position > (args.afterPosition ?? -1),
      'Original-message position did not advance.',
    );
    if (original)
      requireMatch(
        isDeepStrictEqual(original, metadata),
        'Original-message metadata changed between slices.',
      );
    original = metadata;
    const offset = args.textOffset ?? 0;
    requireMatch(
      offset === fullText.length && slice.length <= args.maxCharsPerItem,
      'Invalid UTF-16 slice offset/size.',
    );
    fullText += slice;
    requireMatch(
      fullText.length <= originalTextBound,
      'Original-message text bound exceeded.',
    );
    if (!textTruncated) {
      requireMatch(
        nextTextOffset === null && index === observations.length - 1,
        'Ambiguous/trailing original-message evidence.',
      );
      requireMatch(
        role === 'review' &&
          fullText ===
            (policy === 'review-role-v1'
              ? reviewRolePrefix + expectedText
              : expectedText),
        'Original message differs from the full frozen nonce-bearing task.',
      );
      return {
        kind: 'complete',
        text: fullText,
        itemId: metadata.itemId,
        messageId: metadata.messageId,
      };
    }
    requireMatch(
      slice.length > 0 &&
        nextTextOffset === fullText.length &&
        nextTextOffset > offset,
      'Truncated/stalled original-message text pagination.',
    );
    args = {
      threadId: childThreadId,
      view: 'messages',
      limit: 1,
      maxCharsPerItem: 2048,
      runLimit: 1,
      itemId: metadata.itemId,
      textOffset: nextTextOffset,
    };
  }
  requireMatch(
    observations.length < 32,
    'Original-message read bound exceeded.',
  );
  return { kind: 'next', args };
}
