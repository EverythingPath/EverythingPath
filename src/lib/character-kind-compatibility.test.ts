import { expect, test } from 'vitest';
import {
  prepareCanonicalResolutionRecord,
  projectWeeklyDraft,
  resolveCanonicalWeeklyDraft,
} from './canonical-weekly-resolution';
import { canonicalResolutionRecordSchema } from './canonical-resolution-record';
import { projectActivity } from './rules-activity';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import { weeklySourceKey } from './canonical-weekly-source';
import {
  militiaSetupSchema,
  newMilitiaSetup,
  prepareMilitiaSetup,
} from './canonical-setup';
import { persistentEventFixture } from '../../tests/rules/persistent-event-fixture';
import { kindSnapshot } from '../../tests/rules/character-kind-fixture';

// A ready week whose roster also carries PCs and NPCs with every Hit Dice form.
function kindWeek() {
  const { draft, snapshot } = persistentEventFixture('low_morale');
  snapshot.training = 15;
  const people = kindSnapshot();
  snapshot.characters.push(...people.characters);
  snapshot.roster.people.push(...people.roster.people);
  snapshot.roster.officers.push({ role: 'commandant', characterId: 'vessa' });
  snapshot.roster.teams[0]!.managerCharacterId = 'vessa';
  snapshot.roster.teams[1]!.managerCharacterId = 'vessa';
  return { revision: draft, militiaSnapshot: snapshot };
}

test('Setup keeps PC-only rules on PCs', () => {
  const setup = newMilitiaSetup('Loyalty');
  const snapshot = kindSnapshot();
  snapshot.rank = 7;
  const parsed = militiaSetupSchema.parse({
    ...setup,
    mode: 'existing',
    state: {
      ...setup.state,
      context: { ...setup.state.context, firstMilitiaWeek: false },
      militiaSnapshot: snapshot,
    },
  });
  expect(parsed.state.militiaSnapshot.roster).toEqual(snapshot.roster);
  // The highest active PC level is Mara's 3 (Aubrin 2); NPC levels never
  // count, and Rook is archived.
  expect(prepareMilitiaSetup(parsed, 'setup').warnings).toContain(
    'Rank exceeds the highest active PC level.',
  );
});

test('confirmed records keep their kinds and null or zero Hit Dice through history parsing', () => {
  const resolved = resolveCanonicalWeeklyDraft(kindWeek());
  const record = prepareCanonicalResolutionRecord(resolved, 'record');
  const recorded = kindWeek().militiaSnapshot.roster.people;
  expect(record.sourceMilitiaSnapshot.roster.people).toEqual(recorded);
  const outcome = record.finalOutcome.data as {
    militiaSnapshot: { roster: { people: unknown } };
  };
  expect(outcome.militiaSnapshot.roster.people).toEqual(recorded);
  const stored = JSON.parse(JSON.stringify(record)) as unknown;
  const reread = canonicalResolutionRecordSchema.parse(stored);
  expect(reread).toEqual(record);
  expect(weeklySourceKey(reread)).toBe(weeklySourceKey(stored));
  expect(
    projectWeeklyDraft({
      revision: reread.source,
      militiaSnapshot: reread.sourceMilitiaSnapshot,
    }).sourceKey,
  ).toBe(resolved.sourceKey);
});

test('Change Officer Role needs the PC exception for an NPC', () => {
  for (const kind of ['pc', 'npc'] as const) {
    const { draft, snapshot } = upkeepFixture();
    snapshot.roster.people[0]!.kind = kind;
    draft.activity.slots[0]!.choice = {
      choiceId: 'role',
      actionId: 'change_officer_role',
      characterId: 'pc',
      fromRole: 'ambassador',
    };
    expect(
      projectActivity(draft, snapshot).requirements.includes(
        'role:officer-pc:exception',
      ),
    ).toBe(kind !== 'pc');
  }
});
