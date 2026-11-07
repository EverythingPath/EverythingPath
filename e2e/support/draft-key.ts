import type { Page } from '@playwright/test';
import { z } from 'zod';

const observeAdd = z.object({
  type: z.literal('ModifyQuerySet'),
  modifications: z.array(
    z
      .object({
        type: z.literal('Add'),
        udfPath: z.string(),
        args: z.tuple([
          z.object({
            campaignId: z.string(),
            militiaId: z.string(),
            draftId: z.string(),
          }),
        ]),
      })
      .or(z.object({ type: z.string() })),
  ),
});
export type DraftKey = {
  campaignId: string;
  militiaId: string;
  draftId: string;
};

// The draft keys a sent protocol frame starts observing.
function observedKeys(payload: string | Buffer): DraftKey[] {
  try {
    const parsed = observeAdd.safeParse(JSON.parse(payload.toString()));
    if (!parsed.success) return [];
    return parsed.data.modifications.flatMap((modification) =>
      'udfPath' in modification &&
      modification.udfPath.replace(/\.js$/, '') ===
        'canonicalDraftPersistence:observe'
        ? [modification.args[0]]
        : [],
    );
  } catch {
    /* Non-protocol frames are irrelevant. */
    return [];
  }
}

/**
 * Read-only: the key of the open weekly draft this page observes, taken from
 * the page's own first draft-observation subscription. Install before
 * navigating to the Week. Nothing is altered or replayed; the key is the
 * page's own request and never reaches an artifact.
 */
export function observeDraftKey(page: Page) {
  let key: DraftKey | undefined;
  page.on('websocket', (socket) => {
    socket.on('framesent', ({ payload }) => {
      key ??= observedKeys(payload)[0];
    });
  });
  return async () => {
    const deadline = Date.now() + 15_000;
    while (!key && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    if (!key) throw new Error('The page never observed a weekly draft');
    return key;
  };
}

/**
 * Read-only: every distinct weekly draft this page has started observing,
 * in order. Install before navigating.
 */
export function observeDraftIds(page: Page) {
  const ids: string[] = [];
  page.on('websocket', (socket) => {
    socket.on('framesent', ({ payload }) => {
      for (const key of observedKeys(payload))
        if (!ids.includes(key.draftId)) ids.push(key.draftId);
    });
  });
  return () => [...ids];
}
