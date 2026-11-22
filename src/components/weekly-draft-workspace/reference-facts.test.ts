import { expect, test } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { upkeepFixture, roll } from '../../../tests/rules/upkeep-fixture';
import { derivePhaseReadiness } from './phase-readiness';
import { referenceFacts } from './reference-facts';

function fixture() {
  const { draft, snapshot } = upkeepFixture();
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  return { draft, source };
}
function project({ draft, source }: ReturnType<typeof fixture>) {
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const { views } = derivePhaseReadiness(draft, source, preview);
  return { preview, facts: referenceFacts(source, draft, preview, views) };
}

test('Now remains the source while complete After includes Table Adjustments', () => {
  const input = fixture();
  input.draft.tableAdjustments.push({
    adjustmentId: 'reward',
    kind: 'militia_value',
    field: 'treasuryCopper',
    operation: 'add',
    value: 700,
    reason: 'Narrative reward',
  });
  const { preview, facts } = project(input);
  expect(preview.status).toBe('ready');
  expect(facts.now.treasuryCopper).toBe(3000);
  expect(facts.after?.treasuryCopper).toBe(3700);
  expect(facts.now.minimumTreasuryCopper).toBe(3000);
});

test('a partial outcome never becomes After and this-week context marks unfinished upstream decisions', () => {
  const input = fixture();
  input.draft.context = { ...input.draft.context, firstMilitiaWeek: false };
  const { preview, facts } = project(input);
  expect(preview.outcome).not.toBeNull();
  expect(preview.finalPlan).toBeNull();
  expect(facts.after).toBeNull();
  expect(facts.thisWeek.actions.provisional).toBe(true);
  expect(facts.thisWeek.eventChance?.provisional).toBe(true);
});

test('action allowance includes strategist and is independent of supplied slot count and final rank adjustments', () => {
  const input = fixture();
  input.source.snapshot.roster.officers.push({
    role: 'strategist',
    characterId: 'pc',
  });
  input.draft.activity.slots = [
    {
      slotId: 'only-slot',
      choice: { choiceId: 'quiet-week', actionId: 'lie_low' },
    },
  ];
  input.draft.tableAdjustments.push({
    adjustmentId: 'rank',
    kind: 'militia_value',
    field: 'rank',
    operation: 'set',
    value: 7,
    reason: 'Table decision',
  });
  const { facts } = project(input);
  expect(facts.thisWeek.actions).toEqual({
    used: 1,
    allowance: 3,
    provisional: false,
  });
  expect(facts.after?.rank).toBe(7);
});

test('carried event comparison is unavailable until the final successor exists', () => {
  const input = fixture();
  input.draft.context = {
    ...input.draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'morale',
        eventType: 'low_morale',
        startedWeek: 38,
        order: 0,
        targets: [],
      },
    ],
  };
  delete input.draft.event.chanceRoll;
  const { facts } = project(input);
  expect(facts.carriedEvents).toEqual([
    {
      eventId: 'morale',
      name: 'Low Morale · Event 1',
      ageWeeks: 2,
      targetNames: [],
    },
  ]);
  expect(facts.afterCarriedEvents).toBeNull();
});

test('reference facts preserve exceptional teams, unknown focus, unnamed and unassigned officers without exposing raw state', () => {
  const input = fixture();
  input.source.snapshot.focus = null;
  input.source.snapshot.roster.teams = (
    ['active', 'disabled', 'missing', 'blocked'] as const
  ).map((status) => ({
    teamId: status,
    name: `${status} team`,
    status,
    teamType: 'defenders',
    rewardCapExempt: false,
    managerCharacterId: null,
    notes: 'Private editor detail',
  }));
  input.source.snapshot.roster.officers.push({
    role: 'strategist',
    characterId: 'pc',
  });
  input.source.snapshot.roster.people.push({
    characterId: 'unassigned',
    kind: 'npc',
    hitDice: null,
  });
  input.source.snapshot.characters.push({
    ...input.source.snapshot.characters[0]!,
    characterId: 'unassigned',
  });
  input.source.people.push({ characterId: 'unassigned', name: 'Mira' });
  const { facts } = project(input);
  expect(facts.now.focus).toBeNull();
  expect(facts.now.teams).toEqual([
    { teamId: 'active', name: 'active team', status: 'active' },
    { teamId: 'disabled', name: 'disabled team', status: 'disabled' },
    { teamId: 'missing', name: 'missing team', status: 'missing' },
    { teamId: 'blocked', name: 'blocked team', status: 'blocked' },
  ]);
  expect(facts.officers).toEqual([
    {
      characterId: 'pc',
      name: 'Unnamed character',
      roles: ['ambassador', 'strategist'],
    },
    { characterId: 'unassigned', name: 'Mira', roles: [] },
  ]);
  expect(Object.keys(facts).sort()).toEqual([
    'after',
    'afterCarriedEvents',
    'carriedEvents',
    'now',
    'officers',
    'thisWeek',
  ]);
  expect(Object.keys(facts.now).sort()).toEqual([
    'focus',
    'minimumTreasuryCopper',
    'notoriety',
    'rank',
    'teams',
    'training',
    'treasuryCopper',
  ]);
});

test('unsupported rank has no invented treasury threshold', () => {
  const input = fixture();
  input.source.snapshot.rank = -2;
  expect(project(input).facts.now.minimumTreasuryCopper).toBeNull();
});

test('final carried events reflect a paid ending instead of repeating Now events', () => {
  const input = fixture();
  input.source.snapshot.treasuryCopper = 100000;
  input.draft.context = {
    ...input.draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'morale',
        eventType: 'low_morale',
        startedWeek: 38,
        order: 0,
        targets: [],
      },
    ],
  };
  input.draft.persistent.decisions = [{ eventId: 'morale', kind: 'buyoff' }];
  const { preview, facts } = project(input);
  expect(preview.requirements).toEqual([]);
  expect(facts.carriedEvents).toHaveLength(1);
  expect(facts.afterCarriedEvents).toEqual([]);
});
