import { expect, test } from 'vitest';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import { editWeeklyDraft } from './weekly-draft';
import { weeklyDraftSchema } from './weekly-draft-contract';

// Transfers became characterless under Ruleset Version 6 (#158, approved in
// #107). A transfer carries no character.

const actorless = {
  transferId: 'new',
  direction: 'withdraw' as const,
  copper: 7,
};

test('[rules.U05.transfer-schema] drafts and edits accept actorless transfers and refuse a character or any other extra field', () => {
  const { draft } = upkeepFixture();
  const staged = editWeeklyDraft(draft, {
    kind: 'upkeep',
    inputs: {
      rolls: {},
      treasuryTransfers: [actorless],
      teamDecisions: [],
    },
  });
  expect(staged.ok && staged.draft.upkeep.treasuryTransfers).toEqual([
    actorless,
  ]);
  const added = editWeeklyDraft(draft, {
    kind: 'upkeep_transfer',
    transfer: actorless,
  });
  expect(added.ok && added.draft.upkeep.treasuryTransfers).toEqual([actorless]);
  for (const transfer of [
    { ...actorless, characterId: 'pc' },
    { ...actorless, character: 'pc' },
    { ...actorless, direction: 'gift' },
    { ...actorless, copper: 0.5 },
    { direction: 'deposit', copper: 1 },
  ])
    expect(
      weeklyDraftSchema.safeParse({
        ...draft,
        upkeep: { ...draft.upkeep, treasuryTransfers: [transfer] },
      }).success,
    ).toBe(false);
});
