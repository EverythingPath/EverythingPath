import { editWeeklyDraft } from '../../src/lib/weekly-draft';
import { activityFixture } from './activity-fixture';
import { characterFixture } from './character-fixture';
import { economyFixture } from './economy-fixture';
import { roll } from './upkeep-fixture';
import type { projectWeeklyDraft } from '../../src/lib/canonical-weekly-resolution';

export const upgradeEdges = [
  ['moles', 'propagandists', 25000],
  ['propagandists', 'saboteurs', 100000],
  ['propagandists', 'spies', 100000],
  ['informants', 'conspirators', 25000],
  ['conspirators', 'scholars', 100000],
  ['conspirators', 'spellcasters', 100000],
  ['defenders', 'infiltrators', 25000],
  ['infiltrators', 'guardians', 100000],
  ['infiltrators', 'specialists', 100000],
  ['patrons', 'merchants', 5000],
  ['merchants', 'blackMarketeers', 20000],
  ['merchants', 'fixers', 20000],
] as const;

type Input = Parameters<typeof projectWeeklyDraft>[0];
function ready(fixture: ReturnType<typeof activityFixture>): Input {
  fixture.draft.context = { ...fixture.draft.context, firstMilitiaWeek: true };
  fixture.draft.event.chanceRoll = roll(100, 100);
  return { revision: fixture.draft, militiaSnapshot: fixture.snapshot };
}

export function activityAcceptanceFixtures(): { name: string; input: Input }[] {
  const fixtures = upgradeEdges.map(([from, to]) => {
    const fixture = activityFixture('upgrade_team');
    fixture.snapshot.treasuryCopper = 200000;
    fixture.snapshot.roster.teams[0]!.teamType = from;
    fixture.draft.activity.slots[0]!.choice = {
      choiceId: 'upgrade',
      actionId: 'upgrade_team',
      targetTeamId: 'team',
      toTeamType: to,
    };
    return { name: `upgrade-${from}-${to}`, input: ready(fixture) };
  });
  for (const teamType of ['scholars', 'spellcasters'] as const) {
    const fixture = characterFixture('gather_information');
    fixture.snapshot.roster.teams[0]!.teamType = teamType;
    fixtures.push({
      name: `inherited-information-${teamType}`,
      input: ready(fixture),
    });
  }
  for (const teamType of ['blackMarketeers', 'fixers'] as const) {
    const fixture = economyFixture('earn_gold');
    fixture.snapshot.roster.teams[0]!.teamType = teamType;
    fixtures.push({
      name: `inherited-earn-${teamType}`,
      input: ready(fixture),
    });
  }
  const recruited = economyFixture('earn_gold');
  recruited.snapshot.roster.teams = [];
  recruited.draft.activity.slots[0]!.choice = {
    choiceId: 'join',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: roll(20, 15) },
  };
  recruited.draft.activity.slots[1]!.choice = {
    choiceId: 'earn',
    actionId: 'earn_gold',
    teamId: 'recruit:join',
    rolls: { check: roll(20, 10) },
  };
  fixtures.push({ name: 'recruit-then-act', input: ready(recruited) });
  const recovery = economyFixture('earn_gold');
  recovery.snapshot.training = 15;
  recovery.snapshot.treasuryCopper = 20000;
  recovery.snapshot.roster.teams[0]!.status = 'disabled';
  recovery.draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 1) };
  recovery.draft.event.chanceRoll = roll(100, 100);
  recovery.draft.upkeep.treasuryTransfers = [
    {
      transferId: 'deposit',
      direction: 'deposit',
      copper: 1234,
    },
  ];
  const edited = editWeeklyDraft(recovery.draft, {
    kind: 'upkeep_team',
    teamId: 'team',
    decision: { teamId: 'team', decision: 'recover', costCopper: 3000 },
    recoveryAdjustment: {
      deltaCopper: 3000,
      reason: 'The temple heals the team without charge',
    },
  });
  if (!edited.ok) throw new Error(edited.error);
  fixtures.push({
    name: 'narrative-recovery-deposit-action',
    // Install the already-staged choices as the initial accepted source.
    input: {
      revision: { ...edited.draft, revision: 0 },
      militiaSnapshot: recovery.snapshot,
    },
  });
  return fixtures;
}
