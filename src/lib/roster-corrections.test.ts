import { describe, expect, it } from 'vitest';
import type { CanonicalWeekState } from './canonical-weekly-source';
import { militiaSnapshotSchema } from './canonical-weekly-source';
import {
  applyOfficerCorrection,
  applyRosterCorrection,
  assignCandidates,
  assignOfficer,
  managerLimitWarnings,
  moveOfficer,
  moveTargets,
  pcAssignmentHints,
  removeOfficer,
  rosterBaselineKey,
  rosterRemovalWarnings,
} from './roster-corrections';
import { projectOfficers } from './rules-officers';

// Correct officers and Correct roster (#183) as pure changes to the latest
// accepted militia.

type Snapshot = CanonicalWeekState['militiaSnapshot'];

function facts(characterId: string, values: Record<string, number> = {}) {
  return {
    characterId,
    level: 3,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    isActive: true,
    ...values,
  };
}
const team = (teamId: string, managerCharacterId: string | null) => ({
  teamId,
  teamType: 'patrons' as const,
  name: teamId === 'smugglers' ? 'Smugglers' : 'Town Watch',
  status: 'active' as const,
  rewardCapExempt: false,
  managerCharacterId,
  notes: `${teamId} notes`,
});
function snapshot(): Snapshot {
  return {
    rank: 3,
    training: 30,
    treasuryCopper: 3000,
    notoriety: 0,
    focus: 'Loyalty',
    roster: {
      people: [
        { characterId: 'bren', kind: 'pc', hitDice: 5 },
        { characterId: 'sera', kind: 'npc', hitDice: null },
        { characterId: 'kess', kind: 'pc', hitDice: 0 },
      ],
      officers: [
        { role: 'marshal', characterId: 'bren' },
        { role: 'ambassador', characterId: 'sera' },
        { role: 'strategist', characterId: 'kess' },
      ],
      teams: [team('smugglers', 'sera'), team('watch', 'sera')],
    },
    characters: [
      facts('bren', { level: 7, strength: 18 }),
      facts('sera', { level: 4, charisma: 14 }),
      facts('kess', { level: 5, dexterity: 17 }),
      facts('nara', { level: 4, dexterity: 12 }),
    ],
    settlements: [],
    bonuses: [],
  };
}
const names = new Map([
  ['bren', 'Bren Ironhand'],
  ['sera', 'Sera of Phaendar'],
  ['kess', 'Kess'],
  ['nara', 'Nara'],
]);
const records = [
  { characterId: 'bren', kind: 'pc' as const },
  { characterId: 'sera', kind: 'npc' as const },
  { characterId: 'kess', kind: 'pc' as const },
  { characterId: 'nara', kind: 'npc' as const },
];
const entries = (value: Snapshot) =>
  value.roster.people.map(({ characterId, hitDice }) => ({
    characterId,
    hitDice,
  }));

describe('officer assignments', () => {
  const officers = snapshot().roster.officers;

  it('assign adds a second role without removing the first, never a duplicate pair', () => {
    const second = assignOfficer(officers, 'commandant', 'bren');
    expect(second.filter((o) => o.characterId === 'bren')).toEqual([
      { role: 'marshal', characterId: 'bren' },
      { role: 'commandant', characterId: 'bren' },
    ]);
    expect(assignOfficer(second, 'commandant', 'bren')).toEqual(second);
  });

  it('move replaces only the selected role and never double-counts a role already held', () => {
    const moved = moveOfficer(officers, 'bren', 'marshal', 'spymaster');
    expect(moved).toContainEqual({ role: 'spymaster', characterId: 'bren' });
    expect(moved).not.toContainEqual({ role: 'marshal', characterId: 'bren' });
    // Bren already Commandant: Move to Commandant only drops Marshal, and
    // the commandant total counts his Hit Dice once.
    const both = assignOfficer(officers, 'commandant', 'bren');
    const merged = moveOfficer(both, 'bren', 'marshal', 'commandant');
    expect(
      merged.filter((o) => o.role === 'commandant' && o.characterId === 'bren'),
    ).toHaveLength(1);
    const current = snapshot();
    expect(
      projectOfficers(
        { ...current.roster, officers: merged },
        current.characters,
        'Loyalty',
      ).commandantTrainingBonus,
    ).toBe(5);
  });

  it('offers only roles the holder does not already hold as Move to targets', () => {
    const both = assignOfficer(officers, 'commandant', 'bren');
    expect(moveTargets(both, 'bren', 'marshal')).toEqual([
      'ambassador',
      'spymaster',
      'strategist',
      'overseer',
    ]);
  });

  it('remove drops only that assignment', () => {
    expect(removeOfficer(officers, 'marshal', 'bren')).toEqual(
      officers.slice(1),
    );
  });

  it('an officer correction replaces only the assignments of the latest militia', () => {
    const latest = snapshot();
    latest.treasuryCopper = 9999;
    latest.roster.teams[0]!.name = 'Renamed';
    const corrected = applyOfficerCorrection(latest, []);
    expect(corrected.roster.officers).toEqual([]);
    expect(corrected.roster.people).toBe(latest.roster.people);
    expect(corrected.roster.teams).toBe(latest.roster.teams);
    expect(corrected.characters).toBe(latest.characters);
    expect(corrected.treasuryCopper).toBe(9999);
  });
});

describe('roster membership', () => {
  it('joins with the record kind and a blank override, after the people who stay', () => {
    const latest = snapshot();
    const corrected = applyRosterCorrection(
      latest,
      [...entries(latest), { characterId: 'nara', hitDice: null }],
      records,
    );
    expect(corrected.roster.people.map((p) => p.characterId)).toEqual([
      'bren',
      'sera',
      'kess',
      'nara',
    ]);
    expect(corrected.roster.people[3]).toEqual({
      characterId: 'nara',
      kind: 'npc',
      hitDice: null,
    });
    expect(militiaSnapshotSchema.safeParse(corrected).success).toBe(true);
  });

  it('keeps blank, zero and explicit Hit Dice overrides distinct', () => {
    const latest = snapshot();
    const corrected = applyRosterCorrection(
      latest,
      [
        { characterId: 'bren', hitDice: null },
        { characterId: 'sera', hitDice: 0 },
        { characterId: 'kess', hitDice: 6 },
      ],
      records,
    );
    expect(corrected.roster.people.map((p) => p.hitDice)).toEqual([null, 0, 6]);
  });

  it('leaving removes only that person’s roles and managers, using the latest teams', () => {
    const latest = snapshot();
    // Another player renamed a team and added one; both are kept.
    latest.roster.teams[1]!.name = 'Night Watch';
    latest.roster.teams.push({ ...team('smugglers', 'bren'), teamId: 'rats' });
    const corrected = applyRosterCorrection(
      latest,
      entries(latest).filter((entry) => entry.characterId !== 'sera'),
      records,
    );
    expect(corrected.roster.officers).toEqual([
      { role: 'marshal', characterId: 'bren' },
      { role: 'strategist', characterId: 'kess' },
    ]);
    expect(
      corrected.roster.teams.map((t) => [t.name, t.managerCharacterId]),
    ).toEqual([
      ['Smugglers', null],
      ['Night Watch', null],
      ['Smugglers', 'bren'],
    ]);
    expect(corrected.roster.teams[0]!.notes).toBe('smugglers notes');
    // The record and its facts remain.
    expect(corrected.characters).toBe(latest.characters);
    expect(militiaSnapshotSchema.safeParse(corrected).success).toBe(true);
  });

  it('mirrors each person’s current record kind', () => {
    const latest = snapshot();
    latest.roster.people[1]!.kind = 'pc';
    const corrected = applyRosterCorrection(latest, entries(latest), records);
    expect(corrected.roster.people[1]!.kind).toBe('npc');
  });
});

describe('roster baseline', () => {
  const key = rosterBaselineKey;

  it('changes with people, overrides, kinds, assignments and managers', () => {
    const base = key(snapshot());
    const changed = [
      (s: Snapshot) => (s.roster.people[0]!.hitDice = 6),
      (s: Snapshot) => (s.roster.people[1]!.kind = 'pc'),
      (s: Snapshot) => s.roster.officers.pop(),
      (s: Snapshot) => (s.roster.teams[0]!.managerCharacterId = null),
      (s: Snapshot) => s.roster.people.pop(),
    ];
    for (const change of changed) {
      const value = snapshot();
      change(value);
      expect(key(value)).not.toBe(base);
    }
  });

  it('ignores team names, new unmanaged teams, character facts and other sections', () => {
    const value = snapshot();
    value.roster.teams[0]!.name = 'Renamed';
    value.roster.teams[0]!.status = 'disabled';
    value.roster.teams.push(team('new', null));
    value.characters[0]!.strength = 8;
    value.treasuryCopper = 1;
    expect(key(value)).toBe(key(snapshot()));
  });
});

describe('save-point warnings', () => {
  it('names the roles and teams a roster removal clears', () => {
    const latest = snapshot();
    const without = (id: string) =>
      applyRosterCorrection(
        latest,
        entries(latest).filter((entry) => entry.characterId !== id),
        records,
      );
    expect(rosterRemovalWarnings(latest, without('sera'), names)).toEqual([
      'Removing Sera of Phaendar removes them as Ambassador and clears the manager of Smugglers and Town Watch.',
    ]);
    expect(rosterRemovalWarnings(latest, without('kess'), names)).toEqual([
      'Removing Kess removes them as Strategist.',
    ]);
    const plain = applyRosterCorrection(
      latest,
      [...entries(latest), { characterId: 'nara', hitDice: null }],
      records,
    );
    expect(
      rosterRemovalWarnings(
        plain,
        applyRosterCorrection(plain, entries(latest), records),
        names,
      ),
    ).toEqual([]);
  });

  it('warns when an NPC loses their last role with more teams than their new limit', () => {
    const latest = snapshot();
    // Charisma 14 (+2): Sera may manage 2 teams as an Officer, 1 without.
    const corrected = applyOfficerCorrection(
      latest,
      removeOfficer(latest.roster.officers, 'ambassador', 'sera'),
    );
    expect(managerLimitWarnings(latest, corrected, names)).toEqual([
      "Removing Sera of Phaendar's last officer role lowers their team limit to 1; they manage 2 teams.",
    ]);
    // A PC's limit follows Charisma whatever they hold.
    latest.roster.people[1]!.kind = 'pc';
    const pc = applyOfficerCorrection(
      latest,
      removeOfficer(latest.roster.officers, 'ambassador', 'sera'),
    );
    expect(managerLimitWarnings(latest, pc, names)).toEqual([]);
  });

  it('hints the Change Officer Role action only for newly assigned PCs', () => {
    const latest = snapshot();
    const corrected = applyOfficerCorrection(
      latest,
      assignOfficer(
        assignOfficer(latest.roster.officers, 'spymaster', 'kess'),
        'overseer',
        'sera',
      ),
    );
    expect(pcAssignmentHints(latest, corrected, names)).toEqual([
      'Assigning Kess as Spymaster is normally a Change Officer Role action.',
    ]);
  });
});

describe('Assign candidates', () => {
  const candidates = (
    role: Parameters<typeof assignCandidates>[0]['role'],
    value = snapshot(),
  ) =>
    assignCandidates({
      role,
      roster: value.roster,
      characters: value.characters,
      names,
      focus: value.focus,
    });

  it('lists roster people without the role, PCs then NPCs, with their roles', () => {
    expect(
      candidates('ambassador').map((c) => [c.name, c.kind, c.holds]),
    ).toEqual([
      ['Bren Ironhand', 'pc', ['marshal']],
      ['Kess', 'pc', ['strategist']],
    ]);
    expect(candidates('marshal').map((c) => c.name)).toEqual([
      'Kess',
      'Sera of Phaendar',
    ]);
  });

  it('compares each candidate’s contribution with the current effect', () => {
    const spymaster = candidates('spymaster');
    expect(spymaster.find((c) => c.characterId === 'kess')!.detail).toBe(
      'Dex +3 → Secrecy +3 (currently no Secrecy bonus)',
    );
    // Str 10 does not beat Bren's +4.
    expect(
      candidates('marshal').find((c) => c.characterId === 'kess')!.detail,
    ).toBe('Str +0: no change from Security +4');
    // Commandants stack; the Strategist does not.
    expect(
      candidates('commandant').find((c) => c.characterId === 'bren')!.detail,
    ).toBe(
      '5 HD → +5 training on a successful Drill (currently no Drill training bonus)',
    );
    expect(
      candidates('strategist').find((c) => c.characterId === 'bren')!.detail,
    ).toBe("Doesn't stack with Kess");
  });

  it('previews an unresolved role ability as unknown, never as a partial score', () => {
    const value = snapshot();
    value.roster.people.push({ characterId: 'nara', kind: 'npc', hitDice: 4 });
    value.characters[3] = {
      ...facts('nara', { level: 4, strength: 20 }),
      unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
    };
    const nara = (role: Parameters<typeof candidates>[0]) =>
      candidates(role, value).find((c) => c.characterId === 'nara')!.detail;
    expect(nara('spymaster')).toBe(
      'Dex unresolved → Secrecy bonus needs Dexterity (currently no Secrecy bonus)',
    );
    // Bren's +4 still applies; Nara's partial Str 20 never reads as +5.
    expect(nara('marshal')).toBe('Str unresolved: no change from Security +4');
  });
});
