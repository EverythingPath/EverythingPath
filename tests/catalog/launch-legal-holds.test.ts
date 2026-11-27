// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { launchManifestCopies } from './launch-manifest';
import { legalHolds } from '../../scripts/catalog/launch-inventory-build';
import {
  committedNoticeClearances,
  heldNoticeInForce,
} from '../../scripts/catalog/legal/notice-clearances';

// Moved from launch-notices.test.ts when the inventory lost its notice rows
// (pbl-notice-rows): a content row's holds, which the next slice removes.
const document: unknown = JSON.parse(
  await readFile(
    new URL(
      '../../scripts/catalog/scopes/campaign-mvp-v1.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const freshManifest = launchManifestCopies(document);

// Clearance projection (owner decisions 2026-10-30, "All books, all holds"): a
// content row takes its legal record's notice holds through the clearances, as
// notice readiness does. A cleared hold stays in the legal record as evidence.
const clearedHold = 'feats-330-abcdefghijklmnop-notice-PZO1115-complete-chain';
const heldHold = 'feats-330-abcdefghijklmnop-notice-PZO9413-complete-chain';
const wholeContent =
  'feats-330-abcdefghijklmnop-whole-content-abcdefghijklmnop';
const inForce = heldNoticeInForce([clearedHold]);

it('drops a cleared notice hold from a content row and keeps an uncleared one', () => {
  expect(
    legalHolds(
      { holdIds: [wholeContent], noticeHoldIds: [clearedHold, heldHold] },
      inForce,
    ),
  ).toEqual({ holdIds: [wholeContent, heldHold] });
});

it('leaves no hold when every hold was a cleared notice hold', () => {
  expect(legalHolds({ noticeHoldIds: [clearedHold] }, inForce)).toEqual({
    holdIds: [],
  });
  // Other holds stay.
  expect(
    legalHolds(
      { holdIds: [wholeContent], noticeHoldIds: [clearedHold] },
      inForce,
    ),
  ).toEqual({ holdIds: [wholeContent] });
  // races-328 and feats-335 record some notice holds under holdIds.
  expect(
    legalHolds({ holdIds: [clearedHold, wholeContent, heldHold] }, inForce),
  ).toEqual({
    holdIds: [wholeContent, heldHold],
  });
  expect(legalHolds(undefined, inForce)).toEqual({
    holdIds: [],
  });
});

it('reads the committed clearances by default', () => {
  const [cleared] = committedNoticeClearances.cleared.heldNotices;
  if (!cleared) throw new Error('No committed clearance.');
  expect(legalHolds({ noticeHoldIds: [cleared, heldHold] })).toEqual({
    holdIds: [heldHold],
  });
});

it('keeps no cleared notice hold on any committed inventory row', () => {
  const cleared = new Set(committedNoticeClearances.cleared.heldNotices);
  const { rows } = freshManifest();
  expect(
    rows.flatMap(({ key, holds }) =>
      holds.flatMap(({ reason }) => (cleared.has(reason) ? [key] : [])),
    ),
  ).toEqual([]);
});
