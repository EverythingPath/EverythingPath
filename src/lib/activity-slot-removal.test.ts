import { expect, test } from 'vitest';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import { slotRemovalRejection } from './activity-slot-removal';
import { projectActivity } from './rules-activity';
import { createWeeklyDraft } from './weekly-draft';

// Rank 3 allows two actions. The first militia week skips Upkeep, so the rank
// (and with it the allowance) is final from the start.
function settledWeek() {
  const { snapshot } = upkeepFixture();
  const draft = createWeeklyDraft({
    draftId: 'week-1',
    week: 1,
    slotIds: ['a', 'b', 'c', 'd'],
    context: {
      firstMilitiaWeek: true,
      startDay: 0,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  return { draft, snapshot };
}

test('[rules.ACT-19.predicate] only an empty slot positioned beyond the rules-derived allowance can be removed', () => {
  const { draft, snapshot } = settledWeek();
  expect(slotRemovalRejection(draft, snapshot, 'c')).toBeNull();
  expect(slotRemovalRejection(draft, snapshot, 'd')).toBeNull();
  expect(slotRemovalRejection(draft, snapshot, 'b')).toBe('within_allowance');
  expect(slotRemovalRejection(draft, snapshot, 'gone')).toBe('unknown_slot');
  draft.activity.slots[2]!.choice = { choiceId: 'x', actionId: 'lie_low' };
  expect(slotRemovalRejection(draft, snapshot, 'c')).toBe('occupied_slot');
  // A current Strategist adds the third action.
  snapshot.roster.officers = [{ role: 'strategist', characterId: 'pc' }];
  draft.activity.slots[2]!.choice = null;
  expect(slotRemovalRejection(draft, snapshot, 'c')).toBe('within_allowance');
  expect(slotRemovalRejection(draft, snapshot, 'd')).toBeNull();
});

test('[rules.ACT-19.sequential] an earlier officer change sets later positions; an unapplied one leaves them unknown', () => {
  const { draft, snapshot } = settledWeek();
  draft.activity.slots[0]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
    fromRole: 'ambassador',
    toRole: 'strategist',
  };
  const facts = projectActivity(draft, snapshot);
  expect(facts.slots.map((slot) => slot.allowance)).toEqual([2, 3, 3, 3]);
  expect(facts.slots.map((slot) => slot.beyondAllowance)).toEqual([
    false,
    false,
    false,
    true,
  ]);
  expect(facts.allowance).toMatchObject({
    rank: 3,
    rankActions: 2,
    strategistAssigned: true,
    actions: 3,
    known: true,
  });
  expect(slotRemovalRejection(draft, snapshot, 'c')).toBe('within_allowance');
  expect(slotRemovalRejection(draft, snapshot, 'd')).toBeNull();
  // Without its roles the change is not applied yet: later positions could
  // still gain the Strategist's action, so removal never guesses.
  draft.activity.slots[0]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
  };
  const pending = projectActivity(draft, snapshot);
  expect(pending.slots.map((slot) => slot.allowanceKnown)).toEqual([
    true,
    false,
    false,
    false,
  ]);
  expect(pending.allowance.known).toBe(false);
  expect(slotRemovalRejection(draft, snapshot, 'c')).toBe('allowance_unknown');
  // An officer change parked beyond the allowance never resolves, so it
  // cannot change later positions.
  draft.activity.slots.unshift({ slotId: 'e', choice: null });
  draft.activity.slots.splice(3, 0, {
    slotId: 'f',
    choice: {
      choiceId: 'late',
      actionId: 'change_officer_role',
      characterId: 'pc',
    },
  });
  draft.activity.slots[1]!.choice = null;
  expect(projectActivity(draft, snapshot).slots[3]).toMatchObject({
    overAllowance: true,
  });
  expect(slotRemovalRejection(draft, snapshot, 'd')).toBeNull();
});

test('[rules.ACT-19.upkeep] while Upkeep is incomplete the rank, and so the allowance, is not final', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.activity.slots.push({ slotId: 'extra', choice: null });
  expect(slotRemovalRejection(draft, snapshot, 'extra')).toBe(
    'allowance_unknown',
  );
});
