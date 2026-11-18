import type { Id } from '@convex/_generated/dataModel';
import { describe, expect, it } from 'vitest';
import type { CanonicalRoster } from './canonical-roster';
import {
  archiveKeeps,
  characterRows,
  managesText,
  officerBoard,
  pendingRoleChanges,
  type BoardRecord,
} from './officer-board';
import { projectOfficers, type FoundationCharacter } from './rules-officers';
import type { StagedActionChoice } from './weekly-draft-facts';

function facts(
  characterId: string,
  overrides: Partial<FoundationCharacter> = {},
): FoundationCharacter {
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
    ...overrides,
  };
}
function record(
  fact: FoundationCharacter,
  name: string,
  kind: BoardRecord['kind'] = 'pc',
): BoardRecord {
  return {
    ...fact,
    _id: fact.characterId as Id<'character'>,
    name,
    kind,
  };
}

const bren = facts('bren', { level: 7, strength: 18, wisdom: 13 });
const sera = facts('sera', { level: 4, charisma: 17, constitution: 12 });
const kess = facts('kess', { level: 5, dexterity: 17, intelligence: 15 });
const dalla = facts('dalla', { level: 4, isActive: false, strength: 15 });
const grom = facts('grom', { level: 3, wisdom: 18, strength: 16 });
const characters = [bren, sera, kess, dalla, grom];
const names = new Map([
  ['bren', 'Bren Ironhand'],
  ['sera', 'Sera of Phaendar'],
  ['kess', 'Kess'],
  ['dalla', 'Dalla Rook'],
  ['grom', 'Grom'],
]);
function roster(
  officers: CanonicalRoster['officers'],
  hitDice: Record<string, number | null> = {},
): CanonicalRoster {
  return {
    people: characters.map(({ characterId }) => ({
      characterId,
      kind: characterId === 'sera' || characterId === 'grom' ? 'npc' : 'pc',
      hitDice: hitDice[characterId] ?? null,
    })),
    teams: [],
    officers,
  };
}
const board = (
  value: CanonicalRoster,
  focus: 'Loyalty' | 'Security' | 'Secrecy' | null = 'Loyalty',
) => officerBoard({ roster: value, characters, names, focus, pending: [] });
const card = (cards: ReturnType<typeof board>, role: string) =>
  cards.find((value) => value.role === role)!;

describe('officerBoard', () => {
  it('always shows all six roles in board order, vacant ones with their rule', () => {
    const cards = board(roster([]));
    expect(cards.map((value) => value.label)).toEqual([
      'Marshal',
      'Ambassador',
      'Spymaster',
      'Strategist',
      'Commandant',
      'Overseer',
    ]);
    for (const value of cards) {
      expect(value.vacant).toBe(true);
      expect(value.holders).toEqual([]);
      expect(value.rule).not.toBe('');
      expect(value.source).toBeNull();
    }
    expect(card(cards, 'spymaster').effect).toBe('Vacant: no Secrecy bonus');
    expect(card(cards, 'strategist').effect).toBe('Vacant: no extra action');
    expect(card(cards, 'commandant').effect).toBe(
      'Vacant: no Drill training bonus',
    );
    expect(card(cards, 'overseer').effect).toBe(
      'Vacant: no secondary-check bonus',
    );
  });

  it('adds the better allowed ability and names its holder and ability as the source', () => {
    const cards = board(
      roster([
        { role: 'marshal', characterId: 'bren' },
        { role: 'ambassador', characterId: 'sera' },
      ]),
    );
    const marshal = card(cards, 'marshal');
    expect(marshal.effect).toBe('Security +4');
    expect(marshal.source).toBe('Bren Ironhand, Str');
    expect(marshal.holders).toEqual([
      {
        characterId: 'bren',
        name: 'Bren Ironhand',
        archived: false,
        counts: true,
        contribution: 'Security +4',
        nonStacking: null,
      },
    ]);
    expect(card(cards, 'ambassador').effect).toBe('Loyalty +3');
    expect(card(cards, 'ambassador').source).toBe('Sera of Phaendar, Cha');
  });

  it('counts one holder of a non-stacking role, the first on a tie, and tells the others', () => {
    const value = roster([
      { role: 'marshal', characterId: 'grom' },
      { role: 'marshal', characterId: 'bren' },
      { role: 'spymaster', characterId: 'kess' },
      { role: 'spymaster', characterId: 'bren' },
    ]);
    const cards = board(value);
    // Grom (Wis 18) and Bren (Str 18) tie at +4: only Grom counts.
    const marshal = card(cards, 'marshal');
    expect(marshal.effect).toBe('Security +4');
    expect(marshal.source).toBe('Grom, Wis');
    expect(marshal.holders.map((holder) => holder.counts)).toEqual([
      true,
      false,
    ]);
    expect(marshal.holders[1]).toMatchObject({
      contribution: null,
      nonStacking: "Doesn't stack with Grom",
    });
    // The better holder counts even when assigned later.
    const spymaster = card(cards, 'spymaster');
    expect(spymaster.source).toBe('Kess, Dex');
    // Matches the rules' own bonus (no Overseer, so no secondary +1).
    const rules = projectOfficers(value, characters, 'Loyalty');
    expect(marshal.effect).toBe(`Security +${rules.bonuses.security}`);
    expect(spymaster.effect).toBe(`Secrecy +${rules.bonuses.secrecy}`);
  });

  it('shows a negative best modifier as a penalty', () => {
    const weak = facts('weak', { strength: 6, wisdom: 7 });
    const cards = officerBoard({
      roster: {
        people: [{ characterId: 'weak', kind: 'pc', hitDice: null }],
        teams: [],
        officers: [{ role: 'marshal', characterId: 'weak' }],
      },
      characters: [weak],
      names: new Map([['weak', 'Weak']]),
      focus: 'Loyalty',
      pending: [],
    });
    expect(card(cards, 'marshal').effect).toBe('Security −2');
  });

  it("totals distinct commandants' effective Hit Dice, archived holders and zero overrides included", () => {
    const value = roster(
      [
        { role: 'commandant', characterId: 'bren' },
        { role: 'commandant', characterId: 'dalla' },
        { role: 'commandant', characterId: 'kess' },
      ],
      { bren: 5, kess: 0 },
    );
    const commandant = card(board(value), 'commandant');
    // Bren's override 5, Dalla's blank override follows level 4, Kess's zero.
    expect(commandant.effect).toBe('+9 training on a successful Drill');
    expect(commandant.source).toBe(
      'Bren Ironhand 5 HD + Dalla Rook 4 HD + Kess 0 HD',
    );
    expect(commandant.holders.map((holder) => holder.counts)).toEqual([
      true,
      true,
      true,
    ]);
    expect(commandant.holders[1]).toMatchObject({
      name: 'Dalla Rook',
      archived: true,
      contribution: '4 HD',
      nonStacking: null,
    });
    expect(
      projectOfficers(value, characters, 'Loyalty').commandantTrainingBonus,
    ).toBe(9);
    // The card keeps the warning even when the archived row is hidden.
    expect(commandant.warnings).toEqual([
      'Dalla Rook is archived but still assigned.',
    ]);
  });

  it('shows the strategist allowance and the Overseer secondary checks from the focus', () => {
    const cards = board(
      roster([
        { role: 'strategist', characterId: 'kess' },
        { role: 'strategist', characterId: 'sera' },
        { role: 'overseer', characterId: 'grom' },
      ]),
      'Security',
    );
    const strategist = card(cards, 'strategist');
    expect(strategist.effect).toBe('+1 militia action; that action gets +2');
    expect(strategist.source).toBe('Kess');
    expect(strategist.holders[1]).toMatchObject({
      counts: false,
      nonStacking: "Doesn't stack with Kess",
    });
    const overseer = card(cards, 'overseer');
    expect(overseer.effect).toBe(
      "+1 to Loyalty and Secrecy; supports one chosen event's checks",
    );
    expect(overseer.holders[0]!.contribution).toBe('+1 Loyalty, Secrecy');
    // Without a focus there is no secondary check to add to.
    expect(
      card(
        board(roster([{ role: 'overseer', characterId: 'grom' }]), null),
        'overseer',
      ).effect,
    ).toBe("Supports one chosen event's checks");
  });

  it('never reads an unresolved role ability as a score: the holder is Unresolved and adds no partial bonus', () => {
    // A dormant eidolon: its Strength, Dexterity and Constitution are
    // partial totals until its sheet can calculate them (#423).
    const ixa = facts('ixa', {
      strength: 18,
      constitution: 18,
      unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
    });
    const companionBoard = (officers: CanonicalRoster['officers']) =>
      officerBoard({
        roster: {
          people: [
            ...roster([]).people,
            { characterId: 'ixa', kind: 'npc', hitDice: null },
          ],
          teams: [],
          officers,
        },
        characters: [...characters, ixa],
        names: new Map([...names, ['ixa', 'Ixa']]),
        focus: 'Loyalty',
        pending: [],
      });
    const unresolved = {
      characterId: 'ixa',
      name: 'Ixa',
      archived: false,
      counts: false,
      contribution: 'Unresolved',
      nonStacking: null,
    };
    const alone = companionBoard([
      { role: 'marshal', characterId: 'ixa' },
      { role: 'ambassador', characterId: 'ixa' },
    ]);
    expect(card(alone, 'marshal')).toMatchObject({
      vacant: false,
      effect: 'Security bonus needs Strength',
      source: null,
      holders: [unresolved],
    });
    expect(card(alone, 'ambassador').effect).toBe(
      'Loyalty bonus needs Constitution',
    );
    // A resolved holder's bonus applies; the unresolved one is not compared.
    const shared = card(
      companionBoard([
        { role: 'marshal', characterId: 'ixa' },
        { role: 'marshal', characterId: 'grom' },
      ]),
      'marshal',
    );
    expect(shared).toMatchObject({
      effect: 'Security +4',
      source: 'Grom, Wis',
      holders: [
        unresolved,
        { characterId: 'grom', counts: true, contribution: 'Security +4' },
      ],
    });
  });

  it('keeps a holder whose record is missing without inventing a contribution', () => {
    const value = roster([{ role: 'marshal', characterId: 'ghost' }]);
    const marshal = card(board(value), 'marshal');
    expect(marshal.vacant).toBe(false);
    expect(marshal.effect).toBe('No Security bonus');
    expect(marshal.holders).toEqual([
      {
        characterId: 'ghost',
        name: 'Missing character',
        archived: false,
        counts: false,
        contribution: null,
        nonStacking: null,
      },
    ]);
  });

  it('lists pending Change Officer Role actions on both the roles they leave and join', () => {
    const pending = pendingRoleChanges(
      [
        { choice: null },
        {
          choice: {
            choiceId: 'c2',
            actionId: 'change_officer_role',
            characterId: 'kess',
            fromRole: 'strategist',
            toRole: 'spymaster',
          },
        },
        {
          choice: {
            choiceId: 'c3',
            actionId: 'change_officer_role',
            characterId: 'bren',
          },
        },
        { choice: { choiceId: 'c4', actionId: 'lie_low' } },
        {
          choice: {
            choiceId: 'c5',
            actionId: 'change_officer_role',
            characterId: 'sera',
            fromRole: 'ambassador',
          },
        },
      ] as { choice: StagedActionChoice | null }[],
      names,
    );
    expect(pending).toEqual([
      {
        key: 'c2',
        slot: 2,
        characterId: 'kess',
        fromRole: 'strategist',
        toRole: 'spymaster',
        text: 'Kess: Strategist → Spymaster (Activity, slot 2)',
      },
      {
        key: 'c5',
        slot: 5,
        characterId: 'sera',
        fromRole: 'ambassador',
        toRole: null,
        text: 'Sera of Phaendar: Ambassador → no role (Activity, slot 5)',
      },
    ]);
    const cards = officerBoard({
      roster: roster([{ role: 'strategist', characterId: 'kess' }]),
      characters,
      names,
      focus: 'Loyalty',
      pending,
    });
    expect(card(cards, 'spymaster').pending.map((p) => p.key)).toEqual(['c2']);
    expect(card(cards, 'strategist').pending.map((p) => p.key)).toEqual(['c2']);
    expect(card(cards, 'ambassador').pending.map((p) => p.key)).toEqual(['c5']);
    // Pending roles are never applied early.
    expect(card(cards, 'spymaster').vacant).toBe(true);
    expect(card(cards, 'strategist').holders[0]!.name).toBe('Kess');
  });
});

describe('characterRows', () => {
  const records = [
    record(sera, 'Sera of Phaendar', 'npc'),
    record(bren, 'Bren Ironhand', 'pc'),
    record(facts('wren', { level: 3 }), 'wren', 'npc'),
    record(dalla, 'Dalla Rook'),
    record(kess, 'Kess', 'pc'),
    record(grom, 'Grom', 'npc'),
    record(facts('aria', { level: 6 }), 'Aria Vell', 'pc'),
  ];
  const value: CanonicalRoster = {
    ...roster(
      [
        { role: 'commandant', characterId: 'bren' },
        { role: 'marshal', characterId: 'bren' },
        { role: 'commandant', characterId: 'dalla' },
        { role: 'ambassador', characterId: 'sera' },
      ],
      { bren: 5, kess: 0 },
    ),
    teams: ['Smugglers', 'Town Watch', 'Scouts', 'Foragers'].map(
      (name, index) => ({
        teamId: name,
        teamType: 'patrons' as const,
        name,
        status: 'active' as const,
        rewardCapExempt: false,
        managerCharacterId: ['sera', 'sera', 'kess', 'grom'][index]!,
        notes: '',
      }),
    ),
  };
  const rows = characterRows({ records, roster: value, characters });
  const row = (id: string) => rows.find((x) => x.characterId === id)!;

  it('lists every record alphabetically, whatever the case, archived ones included', () => {
    expect(rows.map((x) => x.name)).toEqual([
      'Aria Vell',
      'Bren Ironhand',
      'Dalla Rook',
      'Grom',
      'Kess',
      'Sera of Phaendar',
      'wren',
    ]);
    expect(row('dalla').archived).toBe(true);
  });

  it("shows each record's PC or NPC kind and effective Hit Dice", () => {
    expect(row('sera').kind).toBe('npc');
    expect(row('dalla').kind).toBe('pc');
    expect(row('bren').hitDice).toBe(5);
    expect(row('kess').hitDice).toBe(0);
    expect(row('sera').hitDice).toBe(4);
    // Off the roster, Hit Dice are the record's own number.
    expect(row('aria')).toMatchObject({ onRoster: false, hitDice: 6 });
    expect(row('aria').manages).toBeNull();
  });

  it('lists roles in board order and managed teams against the role-aware limit', () => {
    expect(row('bren').roles).toEqual(['marshal', 'commandant']);
    // An NPC holding a role manages up to their Charisma modifier.
    expect(row('sera').manages).toEqual({
      count: 2,
      limit: 3,
      teams: ['Smugglers', 'Town Watch'],
    });
    // An NPC with no role manages one.
    expect(row('grom').manages).toEqual({
      count: 1,
      limit: 1,
      teams: ['Foragers'],
    });
    expect(row('aria').roles).toEqual([]);
  });

  it("carries each person's own advisory warnings", () => {
    expect(row('bren').warnings).toEqual([
      'Bren Ironhand holds more than one officer role.',
    ]);
    expect(row('dalla').warnings).toEqual([
      'Dalla Rook is archived but still assigned.',
    ]);
    expect(row('kess').warnings).toEqual([]);
    const over = characterRows({
      records,
      roster: {
        ...value,
        teams: value.teams.map((team) => ({
          ...team,
          managerCharacterId: 'grom',
        })),
      },
      characters,
    });
    expect(over.find((x) => x.characterId === 'grom')!.warnings).toEqual([
      'Grom manages 4 teams; the normal limit is 1.',
    ]);
  });

  it('reports the scores a companion’s sheet cannot calculate yet', () => {
    const eidolon = facts('ixa', {
      level: 0,
      actualHitDice: null,
      unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
    });
    const companionRows = characterRows({
      records: [...records, record(eidolon, 'Ixa', 'npc')],
      roster: {
        ...value,
        people: [
          ...value.people,
          { characterId: 'ixa', kind: 'npc', hitDice: null },
        ],
      },
      characters: [...characters, eidolon],
    });
    const ixa = companionRows.find((x) => x.characterId === 'ixa');
    expect(ixa).toMatchObject({
      onRoster: true,
      unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
    });
    expect(row('sera').unresolvedAbilities).toEqual([]);
  });

  it('works without a militia: no roster, roles or teams', () => {
    const plain = characterRows({ records, roster: null, characters: [] });
    expect(plain.map((x) => x.onRoster)).toEqual(plain.map(() => false));
    expect(plain.find((x) => x.characterId === 'bren')!.hitDice).toBe(7);
  });

  it('reads managed teams as N of M against the limit', () => {
    expect(managesText(row('sera').manages!)).toBe('Manages 2 of 3 teams');
    expect(managesText(row('grom').manages!)).toBe('Manages 1 of 1 team');
    expect(managesText(row('bren').manages!)).toBe('Manages no teams');
    expect(managesText({ count: 2, limit: 1, teams: [] })).toBe(
      'Manages 2 of 1 teams',
    );
  });

  it('names the roles and teams archiving keeps', () => {
    expect(archiveKeeps(row('sera'))).toBe(
      'Archiving keeps Sera of Phaendar as Ambassador and manager of Smugglers and Town Watch.',
    );
    expect(archiveKeeps(row('bren'))).toBe(
      'Archiving keeps Bren Ironhand as Marshal and Commandant.',
    );
    expect(archiveKeeps(row('kess'))).toBe(
      'Archiving keeps Kess as manager of Scouts.',
    );
    expect(archiveKeeps(row('aria'))).toBeNull();
  });
});
