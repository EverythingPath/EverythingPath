import { expect, test } from 'vitest';
import { projectWeeklyDraft } from './canonical-weekly-resolution';
import { getEffectiveHitDice } from './canonical-roster';
import { projectOfficers } from './rules-officers';
import { projectRulesFoundations } from './rules-foundations';
import { COMPUTED_HIT_DICE_RULESET_VERSION } from './ruleset-versions';
import { roll, upkeepFixture } from '../../tests/rules/upkeep-fixture';
import type { CanonicalRoster } from './canonical-roster';
import type { Ability } from './character-sheet-abilities';

// PRD #251 decision 15/16 (#246, #249): an unresolved companion value blocks
// Confirmation only when this week's rules read it.
function companionWeek(
  role: CanonicalRoster['officers'][number]['role'] | null,
  unresolvedAbilities: Ability[] = ['strength', 'dexterity', 'constitution'],
) {
  const { draft, snapshot } = upkeepFixture();
  draft.event.chanceRoll = roll(100, 100);
  draft.upkeep.rolls = { check: roll(20, 19), training: roll(6, 1) };
  draft.acknowledgements.push({
    acknowledgementId: 'boon-4',
    subjectId: 'upkeep:boon:4:pc',
    outcome: 'Player recorded rank 4 reward.',
  });
  snapshot.roster.people.push({
    characterId: 'eidolon',
    kind: 'npc',
    hitDice: null,
  });
  snapshot.characters.push({
    characterId: 'eidolon',
    level: 0,
    actualHitDice: null,
    isActive: true,
    strength: 16,
    dexterity: 12,
    constitution: 13,
    intelligence: 7,
    wisdom: 10,
    charisma: 11,
    unresolvedAbilities,
  });
  snapshot.roster.officers = role
    ? [{ role, characterId: 'eidolon' }]
    : [{ role: 'ambassador', characterId: 'pc' }];
  return { revision: draft, militiaSnapshot: snapshot };
}

test('an officer whose role ability is unresolved blocks the week that makes that check', () => {
  // The Upkeep attrition check is a Loyalty check: the Ambassador adds the
  // better of Constitution and Charisma (Ultimate Campaign militia rules).
  const preview = projectWeeklyDraft(companionWeek('ambassador'));
  expect(preview.status).not.toBe('ready');
  expect(preview.requirements).toContain(
    'upkeep:attrition:officer:eidolon:unresolved-constitution',
  );
  // The partial Constitution decides no outcome, even in the preview.
  expect(
    preview.phases?.upkeep.checks.find(
      (check) => check.checkId === 'upkeep:attrition',
    )?.total,
  ).toBeNull();
});

test('unrelated unresolved values leave the week ready', () => {
  // A Spymaster's Dexterity is read only by Secrecy checks, which this week
  // does not make; a roster member without a role contributes no ability.
  for (const week of [
    companionWeek('spymaster'),
    companionWeek(null),
    companionWeek('ambassador', ['strength', 'dexterity']),
  ]) {
    const preview = projectWeeklyDraft(week);
    expect(preview.requirements).toEqual([]);
    expect(preview.status).toBe('ready');
  }
});

test('an Overseer’s unresolved ability blocks only the check they support', () => {
  const { militiaSnapshot } = companionWeek('overseer');
  const input = {
    rank: militiaSnapshot.rank,
    training: militiaSnapshot.training,
    focus: 'Loyalty' as const,
    week: 40,
    roster: militiaSnapshot.roster,
    characters: militiaSnapshot.characters,
    slots: [],
    settlements: [],
    operatingSettlementId: null,
    bonuses: [],
    queuedEffects: [],
  };
  const supported = projectRulesFoundations({
    ...input,
    checks: [
      {
        checkId: 'event:raid',
        phase: 'event',
        check: 'security',
        die: 10,
        eventId: 'raid',
        overseerCharacterId: 'eidolon',
      },
    ],
  });
  expect(supported.requirements).toEqual([
    'event:raid:overseer:eidolon:unresolved-strength',
  ]);
  const unsupported = projectRulesFoundations({
    ...input,
    checks: [
      { checkId: 'event:raid', phase: 'event', check: 'security', die: 10 },
    ],
  });
  expect(unsupported.requirements).toEqual([]);
});

test('a team manager’s unresolved Charisma blocks only the checks of the team they manage', () => {
  const { militiaSnapshot } = companionWeek(null, ['charisma']);
  const roster = {
    ...militiaSnapshot.roster,
    teams: [
      {
        teamId: 'scouts',
        teamType: 'defenders' as const,
        name: 'Scouts',
        status: 'active' as const,
        rewardCapExempt: false,
        managerCharacterId: 'eidolon',
        notes: '',
      },
    ],
  };
  const project = (teamId?: string) =>
    projectRulesFoundations({
      rank: militiaSnapshot.rank,
      training: militiaSnapshot.training,
      focus: 'Loyalty',
      week: 40,
      roster,
      characters: militiaSnapshot.characters,
      slots: [],
      settlements: [],
      operatingSettlementId: null,
      bonuses: [],
      queuedEffects: [],
      checks: [
        {
          checkId: 'event:raid',
          phase: 'event',
          check: 'security',
          die: 10,
          ...(teamId ? { teamId } : {}),
        },
      ],
    });
  const managed = project('scouts');
  expect(managed.requirements).toEqual([
    'event:raid:manager:eidolon:unresolved-charisma',
  ]);
  // The partial Charisma decides no outcome.
  expect(managed.checks[0]?.total).toBeNull();
  const unmanaged = project();
  expect(unmanaged.requirements).toEqual([]);
  expect(unmanaged.checks[0]?.total).not.toBeNull();
});

test('a commandant’s unresolved actual Hit Dice is required, while an override, zero included, replaces it', () => {
  const { militiaSnapshot } = companionWeek('commandant');
  const officers = projectOfficers(
    militiaSnapshot.roster,
    militiaSnapshot.characters,
    'Loyalty',
    COMPUTED_HIT_DICE_RULESET_VERSION,
  );
  expect(officers.unresolvedCommandants).toEqual(['eidolon']);
  militiaSnapshot.roster.people[1]!.hitDice = 0;
  const overridden = projectOfficers(
    militiaSnapshot.roster,
    militiaSnapshot.characters,
    'Loyalty',
    COMPUTED_HIT_DICE_RULESET_VERSION,
  );
  expect(overridden.unresolvedCommandants).toEqual([]);
  expect(overridden.commandantTrainingBonus).toBe(0);
  expect(
    getEffectiveHitDice(
      { hitDice: 0 },
      { level: 0, actualHitDice: null },
      COMPUTED_HIT_DICE_RULESET_VERSION,
    ),
  ).toBe(0);
});

test('a version 9 Drill keeps reading a companion commandant’s level until cutover', () => {
  const week = companionWeek('commandant', []);
  week.militiaSnapshot.characters[1]!.actualHitDice = null;
  week.revision.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 19), training: roll(6, 3, 3) },
  };
  // Version 9, still active before cutover, reads Class Levels, never the
  // unresolved actual Hit Dice.
  expect(projectWeeklyDraft(week).requirements).not.toContainEqual(
    expect.stringContaining('unresolved-hit-dice'),
  );
});
