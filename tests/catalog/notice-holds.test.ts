// @vitest-environment node
import { readdir, readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { z } from 'zod';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';

const legalDirectory = 'scripts/catalog/legal';
const text = z.string().trim().min(1);
const batchEvidenceSchema = z.object({
  holds: z
    .array(
      z.object({
        id: text,
        noticeKey: text,
        relatedNoticeKeys: z.array(text).default([]),
      }),
    )
    .default([]),
  noticeRequirements: z
    .array(
      z.object({
        book: text,
        registryKeys: z.array(text),
        holdId: text.nullable(),
        previouslyReviewedIn: z.array(text).default([]),
      }),
    )
    .default([]),
  inventoryOccurrences: z
    .array(
      z.object({
        key: text,
        previouslyReviewedIn: text.nullable().default(null),
      }),
    )
    .default([]),
});

type RecordedHold = { id: string; notices: string[]; evidence: string };
/** A notice this batch names as already reviewed, and the earlier evidence. */
type PreviousReview = {
  notice: string;
  held: boolean;
  evidence: string;
  previous: string;
};

/** Every notice hold a batch evidence file records, with the notices it holds. */
async function readNoticeEvidence() {
  const recorded: RecordedHold[] = [];
  const requirements = new Map<string, Set<string>>();
  const previousReviews: PreviousReview[] = [];
  for (const file of await readdir(legalDirectory)) {
    if (!file.endsWith('.json') || file === 'held-notices.json') continue;
    const evidence = `${legalDirectory}/${file}`;
    const data: unknown = JSON.parse(await readFile(evidence, 'utf8'));
    if (Array.isArray(data)) continue;
    const { holds, noticeRequirements, inventoryOccurrences } =
      batchEvidenceSchema.parse(data);
    for (const { id, noticeKey, relatedNoticeKeys } of holds)
      recorded.push({
        id,
        notices: [noticeKey, ...relatedNoticeKeys],
        evidence,
      });
    requirements.set(
      evidence,
      new Set(noticeRequirements.map((requirement) => requirement.book)),
    );
    for (const requirement of noticeRequirements) {
      const { holdId, book, registryKeys } = requirement;
      if (holdId)
        recorded.push({
          id: holdId,
          notices: [book, ...registryKeys],
          evidence,
        });
      for (const previous of requirement.previouslyReviewedIn)
        previousReviews.push({
          notice: book,
          held: holdId !== null,
          evidence,
          previous,
        });
    }
    for (const { key, previouslyReviewedIn } of inventoryOccurrences)
      if (previouslyReviewedIn)
        previousReviews.push({
          notice: key,
          held: true,
          evidence,
          previous: previouslyReviewedIn,
        });
  }
  return { recorded, requirements, previousReviews };
}

it('enforces every notice and notice-chain hold recorded in batch evidence', async () => {
  const enforced = new Map(heldNotices.map((hold) => [hold.id, hold]));
  const { recorded } = await readNoticeEvidence();
  expect(recorded.length).toBeGreaterThan(0);
  for (const hold of recorded) {
    expect(enforced.get(hold.id), hold.id).toMatchObject({
      notices: expect.arrayContaining(hold.notices),
      evidence: expect.arrayContaining([hold.evidence]),
    });
  }
  const recordedIds = new Set(recorded.map((hold) => hold.id));
  expect(heldNotices.filter((hold) => !recordedIds.has(hold.id))).toEqual([]);
  expect(heldNotices).toHaveLength(recordedIds.size);
});

it('reads a hold’s related notice keys as held notices', async () => {
  const { recorded } = await readNoticeEvidence();
  expect(
    recorded.find(
      (hold) => hold.id === 'notice-285-emerald-spire-variant-comparison',
    ),
  ).toEqual({
    id: 'notice-285-emerald-spire-variant-comparison',
    notices: [
      'pf1-content/notice/0d533c8c1bda63f24d18623acbcb2084e46697708d8126a10ba66bba82b0e19b',
      'pf1-content/notice/3f61d498de986d3fca03e8df628b9dbdbf14d808b06b84d7750d230568b0e65b',
    ],
    evidence: 'scripts/catalog/legal/inherited-notices-285.json',
  });
});

it('holds every previously reviewed notice through an enforced hold of the earlier evidence', async () => {
  const enforced = new Map(heldNotices.map((hold) => [hold.id, hold]));
  const { recorded, requirements, previousReviews } =
    await readNoticeEvidence();
  expect(previousReviews).toContainEqual({
    notice:
      'pf1-content/notice/113a416896c13ee93ce260c01a6054007e14a87545835976a41ae2ba5624ba49',
    held: true,
    evidence: 'scripts/catalog/legal/inherited-notices-271.json',
    previous: 'scripts/catalog/legal/inherited-notices-270.json',
  });
  for (const review of previousReviews) {
    const label = `${review.evidence}: ${review.notice} in ${review.previous}`;
    const previousHolds = recorded.filter(
      (hold) =>
        hold.evidence === review.previous &&
        hold.notices.includes(review.notice),
    );
    if (review.held) {
      expect(previousHolds.length, label).toBeGreaterThan(0);
      for (const hold of previousHolds)
        expect(enforced.get(hold.id)?.notices, label).toContain(review.notice);
    } else {
      expect(requirements.get(review.previous)?.has(review.notice), label).toBe(
        true,
      );
      expect(previousHolds, label).toEqual([]);
    }
  }
});

it('holds both #265 Core Rulebook compilation-line holds but never the reviewed CRB notice', () => {
  const variant =
    'pf1-content/notice/8dd5fab68911640215309a2982334c9a51203102bee87397d60992ea13717aed';
  expect(
    heldNotices
      .filter((hold) => hold.notices.includes(variant))
      .map((hold) => hold.id)
      .sort(),
  ).toEqual([
    'notice-265-complete-chain-8dd5fab68911640215309a2982334c9a51203102bee87397d60992ea13717aed',
    'notice-265-core-rulebook-variant-comparison',
  ]);
  const held = new Set(heldNotices.flatMap((hold) => hold.notices));
  expect(held.has('CRB')).toBe(false);
  expect(held.has('PZO1110')).toBe(false);
});
