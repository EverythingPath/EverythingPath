import { z } from 'zod';
import knownNoticeHolds from './known-notice-holds.json' with { type: 'json' };
import clearancesData from './notice-clearances.json' with { type: 'json' };

/**
 * The owner's clearance of notice holds (decisions of 2026-10-30, items 2, 3
 * and 5: "All books, all holds"). Each cleared hold keeps its entry and
 * evidence (`held-notices.json`, `known-notice-holds.json`); this record names
 * the holds that no longer hold. A hold it doesn't name still holds, and a
 * cleared notice still needs a reviewed Registry identity to be admitted.
 */
const text = z.string().min(1);
/** Hold IDs, sorted and each named once, so the record has one form. */
const holdIds = z.array(text).refine(
  (ids) =>
    ids.slice(1).every((id, index) => {
      const previous = ids[index];
      return previous !== undefined && previous < id;
    }),
  { message: 'Hold IDs must be sorted and unique.' },
);
export const noticeClearancesSchema = z.strictObject({
  decision: text,
  decidedOn: z.iso.date(),
  /** The owner-decision record in the run directory, with its hash. */
  ownerDecision: z.strictObject({
    path: text,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  cleared: z.strictObject({
    /** IDs in `held-notices.json`: batch, wording and #716 book holds. */
    heldNotices: holdIds,
    /** Importer source groups in `known-notice-holds.json`. */
    knownNoticeHolds: holdIds,
  }),
});

export const committedNoticeClearances =
  noticeClearancesSchema.parse(clearancesData);

/**
 * Whether a notice hold (an ID in `held-notices.json`, as a legal record's
 * `noticeHoldIds` names it) is still in force: a cleared hold holds nothing
 * and stays in its file as evidence; a hold the clearance doesn't name still
 * holds.
 */
export function heldNoticeInForce(
  cleared: Iterable<string> = committedNoticeClearances.cleared.heldNotices,
) {
  const ids = new Set(cleared);
  return (id: string) => !ids.has(id);
}

/**
 * The reason the importer gives an entry a source group in
 * `known-notice-holds.json` matches (`map.ts`). It doesn't name the group.
 */
export const knownNoticeHoldReason =
  'Known notice/evidence hold (#227/#241); unavailable for new release admission.';

/** The importer's source groups the clearance doesn't name. */
export function knownNoticeHoldsInForce(
  cleared: Iterable<string> = committedNoticeClearances.cleared
    .knownNoticeHolds,
) {
  const ids = new Set(cleared);
  return knownNoticeHolds.filter(({ id }) => !ids.has(id));
}
