import { expect, test } from 'vitest';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import {
  checkModifiersEdit,
  clearRetainedEdit,
  modifierList,
  officerCheckEdit,
  theftRollEdit,
  type Mitigation,
} from './persistent-check-edits';

const total = (value: number, modifiers: RawRoll['modifiers'] = []) =>
  ({
    diceTotal: value,
    diceCount: 1,
    sides: 20,
    provenance: { kind: 'generated', sourceId: 'roller' },
    modifiers,
  }) satisfies RawRoll;

// A check decision with every field a mitigation decision can record.
const full: Mitigation = {
  kind: 'mitigate',
  eventId: 'carried',
  overseerCharacterId: 'pc',
  rolls: {
    check: total(12, [{ sourceId: 'custom:a', value: 2, reason: 'Speech' }]),
  },
  officerCheck: {
    characterId: 'pc',
    skill: 'bluff',
    skillBonus: 3,
    roll: total(9, [{ sourceId: 'custom:b', value: 1, reason: 'Flattery' }]),
  },
};
const decision = (edit: ReturnType<typeof theftRollEdit> | null) => {
  if (edit?.kind !== 'persistent_decision') throw new Error('no edit');
  return edit.decision;
};

test('[PER-04.theft-roll] the Theft roll changes alone and a blank clears only it', () => {
  const next = decision(theftRollEdit(full, total(18)));
  expect(next).toEqual({ ...full, rolls: { check: total(18) } });
  const { rolls: _rolls, ...rest } = full;
  expect(decision(theftRollEdit(full, null))).toEqual(rest);
});

test('[PER-04.officer] each officer field keeps its siblings; a blank skill bonus or roll is cleared, never zeroed', () => {
  expect(
    decision(officerCheckEdit(full, { field: 'skill', value: 'intimidate' })),
  ).toEqual({
    ...full,
    officerCheck: { ...full.officerCheck, skill: 'intimidate' },
  });
  expect(
    decision(officerCheckEdit(full, { field: 'skillBonus', value: 0 })),
  ).toMatchObject({ officerCheck: { skillBonus: 0 } });
  const blank = decision(
    officerCheckEdit(full, { field: 'skillBonus', value: null }),
  );
  expect(blank).toEqual({
    ...full,
    officerCheck: {
      characterId: 'pc',
      skill: 'bluff',
      roll: full.officerCheck!.roll,
    },
  });
  const noRoll = decision(
    officerCheckEdit(full, { field: 'roll', value: null }),
  );
  expect(noRoll).toMatchObject({
    overseerCharacterId: 'pc',
    rolls: full.rolls,
  });
  expect(noRoll.kind === 'mitigate' && noRoll.officerCheck?.roll).toBe(
    undefined,
  );
});

test('[PER-04.officer-pending] a new officer check waits for both its character and its skill', () => {
  const empty: Mitigation = { kind: 'mitigate', eventId: 'rivalry' };
  expect(
    officerCheckEdit(empty, { field: 'characterId', value: 'pc' }),
  ).toBeNull();
  expect(
    officerCheckEdit(
      empty,
      { field: 'skillBonus', value: 2 },
      {
        characterId: 'pc',
      },
    ),
  ).toBeNull();
  expect(
    decision(
      officerCheckEdit(
        empty,
        { field: 'skill', value: 'diplomacy' },
        { characterId: 'pc' },
      ),
    ),
  ).toEqual({
    kind: 'mitigate',
    eventId: 'rivalry',
    officerCheck: { characterId: 'pc', skill: 'diplomacy' },
  });
});

test('[PER-04.modifiers] modifiers are added, edited in place with their source identity, and removed', () => {
  const added = modifierList(full, 'theft', {
    kind: 'add',
    modifier: { sourceId: 'custom:c', value: -1, reason: 'Rain' },
  })!;
  expect(added.map((entry) => entry.sourceId)).toEqual([
    'custom:a',
    'custom:c',
  ]);
  const flattery = { ...full.officerCheck!.roll!.modifiers[0]!, index: 0 };
  const edited = modifierList(full, 'rivalry', {
    kind: 'edit',
    shown: flattery,
    value: 4,
    reason: 'Better flattery',
  })!;
  expect(edited).toEqual([
    { sourceId: 'custom:b', value: 4, reason: 'Better flattery' },
  ]);
  expect(decision(checkModifiersEdit(full, 'rivalry', edited))).toEqual({
    ...full,
    officerCheck: {
      ...full.officerCheck,
      roll: { ...full.officerCheck!.roll!, modifiers: edited },
    },
  });
  const speech = { ...full.rolls!.check!.modifiers[0]!, index: 0 };
  expect(
    modifierList(full, 'theft', { kind: 'remove', shown: speech }),
  ).toEqual([]);
  // A modifier belongs to its roll: nothing to change before the roll.
  const bare: Mitigation = { kind: 'mitigate', eventId: 'carried' };
  expect(
    modifierList(bare, 'theft', {
      kind: 'add',
      modifier: { sourceId: 'custom:c', value: 1, reason: 'Rain' },
    }),
  ).toBeNull();
  expect(checkModifiersEdit(bare, 'theft', [])).toBeNull();
});

test('[PER-04.modifier-identity] a peer’s earlier change never redirects an edit or removal to another modifier', () => {
  const rain = { sourceId: 'custom:rain', value: -1, reason: 'Rain' };
  const speech = { sourceId: 'custom:a', value: 2, reason: 'Speech' };
  // The player saw Speech first and Rain second; a peer removed Speech.
  const moved: Mitigation = {
    ...full,
    rolls: { check: total(12, [rain]) },
  };
  expect(
    modifierList(moved, 'theft', {
      kind: 'remove',
      shown: { ...rain, index: 1 },
    }),
  ).toEqual([]);
  expect(
    modifierList(moved, 'theft', {
      kind: 'edit',
      shown: { ...speech, index: 0 },
      value: 3,
      reason: 'Speech',
    }),
  ).toBeNull();
  // A peer changed the entry the player is editing: nothing is overwritten.
  expect(
    modifierList(
      { ...full, rolls: { check: total(12, [{ ...speech, value: 5 }]) } },
      'theft',
      { kind: 'remove', shown: { ...speech, index: 0 } },
    ),
  ).toBeNull();
});

test('[PER-04.retained-clear] a retained field is removed deliberately; everything else stays', () => {
  const { officerCheck: _officer, ...rest } = full;
  expect(decision(clearRetainedEdit(full, 'officerCheck'))).toEqual(rest);
});

test('[PER-04.valid] every field edit is a valid persistent_decision for the draft', () => {
  const { draft } = persistentEventFixture('theft');
  for (const edit of [
    theftRollEdit(full, total(18)),
    officerCheckEdit(full, { field: 'skillBonus', value: -2 }),
    clearRetainedEdit(full, 'officerCheck'),
  ])
    expect(editWeeklyDraft(draft, edit!).ok).toBe(true);
});
