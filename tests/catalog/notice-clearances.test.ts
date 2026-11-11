// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { z } from 'zod';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import knownNoticeHolds from '../../scripts/catalog/legal/known-notice-holds.json';
import section15Holds from '../../scripts/catalog/legal/section15-holds-716.json';
import {
  committedNoticeClearances,
  heldNoticeInForce,
  knownNoticeHoldsInForce,
  noticeClearancesSchema,
} from '../../scripts/catalog/legal/notice-clearances';

// Owner decisions 2026-10-30 (items 2, 3 and 5, "All books, all holds"): every
// notice hold is cleared and recorded beside its hold, which stays as evidence.
const legal = new URL('../../scripts/catalog/legal/', import.meta.url);
/** The holds a wording batch's evidence records; every one records a list. */
const wordingHoldsSchema = z.object({
  holds: z.array(z.object({ id: z.string().trim().min(1) })),
});

it('records the owner decision, its date and record', () => {
  expect(committedNoticeClearances).toMatchObject({
    decidedOn: '2026-10-30',
    ownerDecision: {
      path: 'ep-orch/mvp-20261023/owner-decision-20261030-notice-holds.md',
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
  });
});

it('clears exactly the holds in held-notices.json, which keeps every entry', () => {
  const ids = heldNotices.map(({ id }) => id).sort();
  expect(ids).toHaveLength(5367);
  expect(committedNoticeClearances.cleared.heldNotices).toEqual(ids);
});

it('clears the #716 book holds and every wording hold', () => {
  const cleared = new Set(committedNoticeClearances.cleared.heldNotices);
  const holds716 = section15Holds.holds.map(({ id }) => id);
  expect(holds716).toHaveLength(17);
  const wording = readdirSync(legal)
    .filter((file) => /^inherited-notices-\d+\.json$/.test(file))
    .flatMap((file) => {
      const evidence: unknown = JSON.parse(
        readFileSync(new URL(file, legal), 'utf8'),
      );
      return wordingHoldsSchema.parse(evidence).holds.map(({ id }) => id);
    });
  expect(wording.length).toBeGreaterThan(0);
  for (const id of [...holds716, ...wording])
    expect(cleared.has(id), id).toBe(true);
});

it('clears every importer source group, so none stays in force', () => {
  expect(committedNoticeClearances.cleared.knownNoticeHolds).toEqual(
    knownNoticeHolds.map(({ id }) => id).sort(),
  );
  expect(knownNoticeHoldsInForce()).toEqual([]);
  // A hold the clearance doesn't name stays in force.
  const [first] = knownNoticeHolds;
  expect(
    knownNoticeHoldsInForce(
      committedNoticeClearances.cleared.knownNoticeHolds.filter(
        (id) => id !== first?.id,
      ),
    ),
  ).toEqual([first]);
});

it('holds only the notice holds the clearance does not name', () => {
  const [cleared] = committedNoticeClearances.cleared.heldNotices;
  expect(cleared && heldNoticeInForce()(cleared)).toBe(false);
  // A hold the clearance doesn't name stays in force.
  expect(heldNoticeInForce()('feats-999-notice-PZO9999-complete-chain')).toBe(
    true,
  );
  const inForce = heldNoticeInForce([
    'spells-516-a-notice-PZO1115-complete-chain',
  ]);
  expect(inForce('spells-516-a-notice-PZO1115-complete-chain')).toBe(false);
  expect(cleared && inForce(cleared)).toBe(true);
});

it('refuses wording evidence without a valid holds list', () => {
  for (const evidence of [{}, { holds: [{}] }, { holds: [{ id: '' }] }])
    expect(wordingHoldsSchema.safeParse(evidence).success).toBe(false);
});

it('refuses a duplicate or unsorted hold ID', () => {
  const { cleared } = committedNoticeClearances;
  for (const heldNotices of [
    [...cleared.heldNotices, cleared.heldNotices[0]],
    [...cleared.heldNotices].reverse(),
  ])
    expect(
      noticeClearancesSchema.safeParse({
        ...committedNoticeClearances,
        cleared: { ...cleared, heldNotices },
      }).success,
    ).toBe(false);
});
