import { describe, expect, test } from 'vitest';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { compareWeekStates, shownRows } from './review-comparison';
import type { ReviewNames } from './review-text';

const names: ReviewNames = {
  team: () => 'Recorded team',
  settlement: () => 'Recorded settlement',
  character: (id) =>
    ({ ilsa: 'Ilsa', orin: 'Orin' })[id] ?? 'Unnamed character',
  event: (id) => ({ theft: 'Theft · Event 1' })[id] ?? 'Recorded event',
  item: () => 'Recorded item',
  cache: () => 'Recorded cache',
  source: (value) => value,
};

function state(week = 4): CanonicalWeekState {
  return {
    week,
    militiaSnapshot: {
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      notoriety: 3,
      focus: 'Loyalty',
      roster: {
        people: [
          { characterId: 'ilsa', kind: 'pc', hitDice: null },
          { characterId: 'orin', kind: 'npc', hitDice: 3 },
        ],
        teams: [
          {
            teamId: 'scouts',
            teamType: 'spies',
            name: 'Hollow Scouts',
            status: 'active',
            rewardCapExempt: false,
            managerCharacterId: null,
            notes: '',
          },
        ],
        officers: [{ role: 'commandant', characterId: 'ilsa' }],
      },
      characters: [
        {
          characterId: 'ilsa',
          level: 5,
          strength: 10,
          dexterity: 12,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 14,
          isActive: true,
        },
        {
          characterId: 'orin',
          level: 3,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
          isActive: true,
        },
      ],
      settlements: [
        {
          settlementId: 'phaendar',
          name: 'Phaendar',
          reputation: 'Indifferent',
          secured: null,
          occupied: null,
          temporaryReputationShift: null,
          refugeActivatedWeek: null,
          refugeActiveUntilWeek: null,
        },
      ],
      bonuses: [],
    },
    context: {
      firstMilitiaWeek: false,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [
        {
          eventId: 'theft',
          eventType: 'theft',
          startedWeek: 2,
          order: 0,
          targets: [],
        },
      ],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  };
}

const row = (rows: ReturnType<typeof compareWeekStates>, label: string) =>
  rows.find((entry) => entry.label === label)!;

describe('[SUM-06] Result comparison', () => {
  test('a baseline change reversed by a Table Adjustment stays in changed-only and is described in text', () => {
    const now = state();
    const baseline = state(5);
    baseline.militiaSnapshot.treasuryCopper = 4200;
    const final = state(5);
    const rows = compareWeekStates({ now, baseline, final, names });
    const treasury = row(rows, 'Treasury');
    expect(treasury).toMatchObject({
      now: { kind: 'value', text: '50 gp' },
      baseline: { kind: 'value', text: '42 gp' },
      final: { kind: 'value', text: '50 gp' },
      changed: true,
      finalDiffers: true,
    });
    expect(treasury.difference).toMatch(/reverse/i);
    expect(shownRows(rows, false)).toContain(treasury);
  });

  test('additions, removals and nonnumeric changes are retained from the union of states', () => {
    const now = state();
    const baseline = state(5);
    baseline.militiaSnapshot.roster.teams.push({
      teamId: 'rangers',
      teamType: 'defenders',
      name: 'Fangwood Rangers',
      status: 'active',
      rewardCapExempt: false,
      managerCharacterId: 'orin',
      notes: '',
    });
    baseline.militiaSnapshot.settlements[0]!.reputation = 'Friendly';
    baseline.context.carriedEvents = [];
    const final = structuredClone(baseline);
    final.militiaSnapshot.roster.teams[0]!.status = 'disabled';
    const rows = compareWeekStates({ now, baseline, final, names });
    expect(row(rows, 'Fangwood Rangers')).toMatchObject({
      now: { kind: 'absent' },
      baseline: { kind: 'value', text: 'Active' },
      changed: true,
    });
    expect(row(rows, 'Fangwood Rangers · manager').final).toMatchObject({
      text: 'Orin',
    });
    expect(row(rows, 'Theft · Event 1')).toMatchObject({
      now: { kind: 'value' },
      baseline: { kind: 'absent' },
      final: { kind: 'absent' },
      changed: true,
    });
    expect(row(rows, 'Phaendar')).toMatchObject({
      now: { text: 'Indifferent' },
      final: { text: 'Friendly' },
    });
    const scouts = row(rows, 'Hollow Scouts');
    expect(scouts).toMatchObject({ finalDiffers: true, changed: true });
    expect(scouts.difference).toMatch(/Active.*Disabled/);
    const shown = shownRows(rows, false).map((entry) => entry.label);
    expect(shown).not.toContain('Training');
    expect(shownRows(rows, true).map((entry) => entry.label)).toEqual(
      expect.arrayContaining(['Training', 'Ilsa', 'Commandant', 'Start day']),
    );
    expect(JSON.stringify(rows)).not.toMatch(
      /"(ilsa|orin|scouts|rangers|theft|phaendar)"/,
    );
  });

  test('a blank Hit Dice override reads as the level in a live review and a frozen record, and "not set" without a character', () => {
    const live = JSON.stringify(
      compareWeekStates({
        now: state(),
        baseline: state(),
        final: state(),
        names,
      }),
    );
    expect(live).toContain('Player character · 5 Hit Dice');
    expect(live).not.toContain('Hit Dice not');
    const orphan = state();
    orphan.militiaSnapshot.characters =
      orphan.militiaSnapshot.characters.filter(
        (character) => character.characterId !== 'ilsa',
      );
    const unknown = JSON.stringify(
      compareWeekStates({
        now: orphan,
        baseline: orphan,
        final: orphan,
        names,
      }),
    );
    expect(unknown).toContain('Player character · Hit Dice not set');
    const frozen = JSON.stringify(
      compareWeekStates({
        now: state(),
        baseline: state(),
        final: state(),
        names,
        unrecorded: 'Not recorded',
      }),
    );
    expect(frozen).toContain('Player character · 5 Hit Dice');
  });

  test('an incomplete preview leaves Rules Baseline and Final unavailable, never zero or unchanged', () => {
    const rows = compareWeekStates({
      now: state(),
      baseline: null,
      final: null,
      names,
    });
    expect(row(rows, 'Training')).toMatchObject({
      now: { kind: 'value', text: '14' },
      baseline: { kind: 'unavailable' },
      final: { kind: 'unavailable' },
      changed: false,
      finalDiffers: false,
    });
    expect(shownRows(rows, false)).toEqual([]);
  });

  test.each([
    { includeRacialHitDice: false, expected: 'Player character · 5 Hit Dice' },
    { includeRacialHitDice: true, expected: 'Player character · 9 Hit Dice' },
  ])(
    'result comparison includes racial HD when requested: $includeRacialHitDice, preserving an explicit zero override',
    ({ includeRacialHitDice, expected }) => {
      const now = state();
      const baseline = state();
      baseline.militiaSnapshot.characters[0]!.racialHitDice = 4;
      const final = structuredClone(baseline);
      final.militiaSnapshot.roster.people[0]!.hitDice = 0;
      const rows = compareWeekStates({
        now,
        baseline,
        final,
        names,
        includeRacialHitDice,
      });
      expect(row(rows, 'Ilsa')).toMatchObject({
        now: { text: 'Player character · 5 Hit Dice' },
        baseline: { text: expected },
        final: { text: 'Player character · 0 Hit Dice' },
        changed: true,
      });
    },
  );

  test('a state part a record cannot read leaves its values unrecorded, never None or unchanged', () => {
    const final = state(5);
    final.militiaSnapshot.treasuryCopper = 4000;
    const rows = compareWeekStates({
      now: { militiaSnapshot: null, context: state().context },
      baseline: { militiaSnapshot: null, context: null },
      final,
      names,
      unrecorded: 'Not recorded',
    });
    expect(row(rows, 'Treasury')).toMatchObject({
      now: { kind: 'unavailable', text: 'Not recorded' },
      baseline: { kind: 'unavailable', text: 'Not recorded' },
      final: { kind: 'value', text: '40 gp' },
      changed: false,
      finalDiffers: false,
    });
    // Recorded context still compares; an unrecorded one is never "None".
    expect(row(rows, 'Start day')).toMatchObject({
      now: { kind: 'value' },
      baseline: { kind: 'unavailable', text: 'Not recorded' },
    });
    expect(row(rows, 'Hollow Scouts')).toMatchObject({
      now: { kind: 'unavailable' },
      baseline: { kind: 'unavailable' },
      final: { kind: 'value', text: 'Active' },
      changed: false,
    });
  });

  test('semantic values are compared, not formatted text', () => {
    const now = state();
    const baseline = state(5);
    baseline.militiaSnapshot.roster.officers = [
      { role: 'commandant', characterId: 'orin' },
    ];
    const rows = compareWeekStates({ now, baseline, final: baseline, names });
    expect(row(rows, 'Commandant')).toMatchObject({
      now: { text: 'Ilsa' },
      baseline: { text: 'Orin' },
      changed: true,
      finalDiffers: false,
      difference: null,
    });
  });
});
