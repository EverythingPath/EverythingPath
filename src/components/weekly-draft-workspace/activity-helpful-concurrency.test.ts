import { expect, test } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { createDraftPersistence } from '~/lib/weekly-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { activityView } from './activity-facts';
import {
  helpfulAssignEdit,
  helpfulClearEdits,
  removeModifierEdit,
} from './activity-board';

type Device = ReturnType<typeof createDraftPersistence>;
const team = (
  teamId: string,
  teamType: UpkeepSnapshot['roster']['teams'][number]['teamType'],
) => ({
  teamId,
  teamType,
  name: teamId,
  status: 'active' as const,
  managerCharacterId: null,
  rewardCapExempt: false,
  notes: '',
});

// Three checks at a Helpful operating settlement; Helpful starts on Drill.
function week() {
  const input = foundationWeek(3);
  const snapshot = input.militiaSnapshot;
  snapshot.roster.officers = [{ role: 'strategist', characterId: 'pc' }];
  snapshot.roster.teams = [
    team('net', 'informants'),
    team('coin', 'merchants'),
  ];
  snapshot.settlements.push({
    settlementId: 'phaendar',
    name: 'Phaendar',
    reputation: 'Helpful',
    secured: false,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
  const draft = input.revision;
  draft.activity.operatingSettlementId = 'phaendar';
  draft.activity.slots = [
    {
      slotId: 'one',
      choice: {
        choiceId: 'drill',
        actionId: 'drill_militia',
        rolls: {
          check: {
            ...roll(20, 12),
            modifiers: [{ sourceId: 'helpful', value: 2, reason: 'Helpful' }],
          },
        },
      },
    },
    {
      slotId: 'two',
      choice: {
        choiceId: 'gather',
        actionId: 'gather_information',
        teamId: 'net',
        subject: 'Patrols',
        rolls: { check: roll(20, 11) },
      },
    },
    {
      slotId: 'three',
      choice: {
        choiceId: 'gold',
        actionId: 'earn_gold',
        teamId: 'coin',
        rolls: { check: roll(20, 9) },
      },
    },
  ];
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Ameiko' }],
  });
  const facts = (device: Device) => {
    const current = device.getSnapshot().observation!.draft!;
    return activityView(
      current,
      source,
      projectWeeklyDraft({ revision: current, militiaSnapshot: snapshot }),
    );
  };
  return { authority, facts };
}

// The Activity hook's ordered move: clear elsewhere, then assign from the
// device's newest facts. It stops at the first failed edit.
async function moveHelpful(
  device: Device,
  facts: (device: Device) => ReturnType<typeof activityView>,
  slotId: string,
) {
  for (const { edit } of helpfulClearEdits(facts(device), slotId))
    if ((await device.edit(edit)) !== 'accepted') return 'failed';
  const assign = helpfulAssignEdit(facts(device), slotId);
  return assign ? device.edit(assign) : 'failed';
}

test('[rules.ACT-12.helpful-concurrent] two devices moving Helpful at once leave it on one check; the rejected device retries from fresh facts', async () => {
  const { authority, facts } = week();
  const first = createDraftPersistence(authority.transport);
  const second = createDraftPersistence(authority.transport);
  await Promise.all([first.ready, second.ready]);
  const moves = [
    moveHelpful(first, facts, 'two'),
    moveHelpful(second, facts, 'three'),
  ];
  expect(await Promise.all(moves)).toEqual(['accepted', 'failed']);
  await Promise.all([first.settled(), second.settled()]);
  expect(facts(second).helpful?.usedIn).toEqual([
    { slotId: 'two', slotNumber: 2 },
  ]);
  // The unrelated subject survives the ordered edits.
  expect(facts(second).slots[1]!.choice).toMatchObject({ subject: 'Patrols' });
  expect(await moveHelpful(second, facts, 'three')).toBe('accepted');
  const final = facts(first);
  expect(final.helpful?.usedIn).toEqual([{ slotId: 'three', slotNumber: 3 }]);
  expect(final.requirements.filter((code) => code.includes('helpful'))).toEqual(
    [],
  );
  first.dispose();
  second.dispose();
});

test('[rules.ACT-12.helpful-duplicate] interleaved moves can record Helpful twice; the rules warning stays visible until one is removed', async () => {
  const { authority, facts } = week();
  const first = createDraftPersistence(authority.transport);
  const second = createDraftPersistence(authority.transport);
  await Promise.all([first.ready, second.ready]);
  // The first device has cleared Drill but not yet assigned Gather when the
  // second device, seeing Helpful unused, assigns it to Earn Gold.
  const [clear] = helpfulClearEdits(facts(first), 'two');
  expect(await first.edit(clear!.edit)).toBe('accepted');
  expect(await moveHelpful(second, facts, 'three')).toBe('accepted');
  expect(await first.edit(helpfulAssignEdit(facts(first), 'two')!)).toBe(
    'accepted',
  );
  const duplicated = facts(second);
  expect(duplicated.helpful?.usedIn.map((use) => use.slotNumber)).toEqual([
    2, 3,
  ]);
  expect(duplicated.slots[2]!.modifiers[0]).toMatchObject({
    kind: 'helpful',
    warning:
      'Helpful is already used on an earlier check this Activity. Remove one of them.',
  });
  expect(duplicated.requirements).toContain('gold:helpful-already-used');
  expect(await second.edit(removeModifierEdit(duplicated.slots[2]!, 0)!)).toBe(
    'accepted',
  );
  expect(
    facts(first).requirements.filter((code) => code.includes('helpful')),
  ).toEqual([]);
  first.dispose();
  second.dispose();
});
