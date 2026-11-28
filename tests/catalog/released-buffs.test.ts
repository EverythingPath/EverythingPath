// @vitest-environment node
// pbl-released-buffs (PRD #251): the buff batch units' resolver blocks
// (buffs-547, pf-buffs-548 and pf-buffs-549), on entries imported from the
// pinned store, and the rule-bearing checks of their proof blocks: the
// Situational Notes of six named buffs, each named buff's detail, Modifiers
// and Note structure as the re-extraction compared them with the batch
// preview (released-buff-rules.ts), and the admission gate's result for each
// named buff on the released import (released-buff-gate.ts). One import holds
// every key of the three batch key lists (released-buff-keys.ts); each
// describe looks its buffs up by name within its batch's list
// (released-buff-sheet.ts). Each case asserts only what the importer emits
// for the entries, what the resolver computes from them or what the gate
// gives them, against literals; the batch reviews and legal records are not
// read.
import { describe, expect, it } from 'vitest';
import type {
  InputSourcedModifier,
  LeafTarget,
} from '../../src/lib/character-sheet';
import { importReleasedEntries } from './released-entries';
import { buffGateStates } from './released-buff-gate';
import { buffKeys } from './released-buff-keys';
import { buffRules } from './released-buff-rules';
import {
  buffBatch,
  releasedGateStates,
  total,
  type BuffSituation,
  type ImportedBuff,
} from './released-buff-sheet';

const { entries, artifact } = await importReleasedEntries(buffKeys());
const gateStates = await releasedGateStates(artifact);

/** A buff's Situational Notes without their text, which the digest pins. */
const noteRules = (row: ImportedBuff) =>
  row.situationalNotes?.map(({ text: _text, ...rule }) => rule);

/**
 * A buff's rule-bearing fields as released-buff-rules.ts holds them: its
 * detail and Modifiers whole, and its Notes' structure where it has Notes.
 */
function ruleFields(row: ImportedBuff) {
  const notes = noteRules(row);
  return {
    detail: row.detail,
    modifiers: row.modifiers,
    ...(notes === undefined ? {} : { notes }),
  };
}

describe('the buffs-547 keys', () => {
  const { entry, modifiers, situations } = buffBatch(entries, 'buffs-547');

  it('applies the reviewed Modifiers through the public resolver', () => {
    // Fighting defensively: -4 on attack rolls and +2 dodge to AC, +3 with 3
    // or more Acrobatics ranks.
    const fd = modifiers('Fighting Defensively');
    for (const [ranks, ac] of [
      [0, 2],
      [2, 2],
      [3, 3],
      [10, 3],
    ] as const)
      expect(
        total(fd, 'ac.other', { skillRanks: { 'skill.acr': ranks } }),
        `${ranks}`,
      ).toBe(ac);
    expect(total(fd, 'attack.melee')).toBe(-4);
    expect(total(fd, 'attack.ranged')).toBe(-4);
    // Total defense: +4 dodge, +6 with 3 Acrobatics ranks; dodge bonuses
    // stack, so the sheet doesn't stop both being on (an outstanding
    // calculation).
    const td = modifiers('Total Defense');
    expect(total(td, 'ac.other', { skillRanks: { 'skill.acr': 2 } })).toBe(4);
    expect(total(td, 'ac.other', { skillRanks: { 'skill.acr': 3 } })).toBe(6);
    expect(
      total([...td, ...fd], 'ac.other', { skillRanks: { 'skill.acr': 3 } }),
    ).toBe(9);
    // Caster-level formulas read the effect's recorded caster level.
    const cl = (name: string, target: LeafTarget) =>
      [1, 3, 5, 6, 9, 11, 12, 18, 20].map((casterLevel) =>
        total(modifiers(name, { casterLevel }), target),
      );
    expect(cl('Shield of Faith', 'ac.other')).toEqual([
      2, 2, 2, 3, 3, 3, 4, 5, 5,
    ]);
    expect(cl('Divine Favor', 'attack.melee')).toEqual([
      1, 1, 1, 2, 3, 3, 3, 3, 3,
    ]);
    expect(cl('Divine Favor', 'damage.ranged')).toEqual([
      1, 1, 1, 2, 3, 3, 3, 3, 3,
    ]);
    expect(cl('Barkskin', 'ac.natural')).toEqual([2, 2, 2, 3, 4, 4, 5, 5, 5]);
    expect(cl('Fly', 'skill.fly')).toEqual([4, 5, 6, 7, 8, 9, 10, 13, 14]);
    // Armor and shield bonuses sit on their own AC leaves (#734).
    expect(total(modifiers('Mage Armor'), 'ac.armor')).toBe(4);
    expect(total(modifiers('Shield'), 'ac.shield')).toBe(4);
    expect(total(modifiers('Hard Light Shield'), 'ac.shield')).toBe(2);
    expect(total(modifiers('Mage Armor'), 'ac.other')).toBe(0);
    // Haste: +1 on attack rolls, +1 dodge to AC and Reflex.
    const haste = modifiers('Haste');
    expect(
      (
        [
          'attack.melee',
          'attack.ranged',
          'ac.other',
          'save.ref',
          'save.fort',
        ] as const
      ).map((target) => total(haste, target)),
    ).toEqual([1, 1, 1, 1, 0]);
    // Rage: +4 morale to Strength and Constitution and +2 on Will, raised at
    // barbarian level 11 and 20; -2 AC. Foundry's own formula gave +2 at 1st.
    for (const [level, ability, will] of [
      [1, 4, 2],
      [10, 4, 2],
      [11, 6, 3],
      [19, 6, 3],
      [20, 8, 4],
    ] as const) {
      const rows = modifiers('Rage');
      const options = { classLevels: { barbarian: level } };
      expect(
        [
          total(rows, 'ability.str', options),
          total(rows, 'ability.con', options),
          total(rows, 'save.will', options),
          total(rows, 'ac.other', options),
        ],
        `${level}`,
      ).toEqual([ability, ability, will, -2]);
    }
    // Unchained rage and its stances read the unchained barbarian's level;
    // calm stance cancels the rage's bonuses and AC penalty.
    const unchained = (level: number) => ({
      classLevels: { barbarianUnchained: level },
    });
    const rage = modifiers('Rage (Unchained)');
    for (const [level, bonus] of [
      [1, 2],
      [11, 3],
      [20, 4],
    ] as const) {
      expect(
        (
          [
            'attack.melee',
            'damage.melee',
            'save.will',
            'attack.ranged',
          ] as const
        ).map((target) => total(rage, target, unchained(level))),
      ).toEqual([bonus, bonus, bonus, 0]);
      const calm = [...rage, ...modifiers('Calm Stance')];
      expect(
        (
          ['attack.melee', 'damage.melee', 'save.will', 'ac.other'] as const
        ).map((target) => total(calm, target, unchained(level))),
      ).toEqual([0, 0, 0, 0]);
    }
    for (const [level, bonus] of [
      [1, 1],
      [4, 2],
      [8, 3],
      [20, 6],
    ] as const) {
      expect(
        total(modifiers('Accurate Stance'), 'attack.melee', unchained(level)),
      ).toBe(bonus);
      expect(
        total(modifiers('Guarded Stance'), 'ac.other', unchained(level)),
      ).toBe(bonus);
      expect(
        total(modifiers('Powerful Stance'), 'damage.melee', unchained(level)),
      ).toBe(bonus);
      expect(total(modifiers('Strength Stance'), 'cmd', unchained(level))).toBe(
        bonus,
      );
      const reckless = modifiers('Reckless Stance');
      expect([
        total(reckless, 'attack.ranged', unchained(level)),
        total(reckless, 'ac.other', unchained(level)),
      ]).toEqual([bonus, -bonus]);
    }
    // Imported numbers that need no review.
    expect(total(modifiers("Bull's Strength"), 'ability.str')).toBe(4);
    expect(total(modifiers('Heroism, Greater'), 'skill.per')).toBe(4);
    expect(total(modifiers('Prayer (Negative)'), 'damage.melee')).toBe(-1);
    expect(total(modifiers('Dire Prophecy'), 'save.fort')).toBe(-4);
    // The reviewed change replacements: the black veemod's +10 becomes +2 and
    // the powered armor veemods' +5 becomes +10.
    expect(total(modifiers('Veemod (Black)'), 'skill.per')).toBe(2);
    expect(total(modifiers('Veemod (Powered Armor)'), 'skill.per')).toBe(10);
    expect(total(modifiers('Veemod (Green)'), 'skill.per')).toBe(10);
  });

  it('applies each situational Modifier only under its Situation, with the tiers mutually exclusive', () => {
    // Bless, aid and bane use the shared fear Situation on saves.
    for (const [name, value] of [
      ['Bless', 1],
      ['Aid', 1],
      ['Bane', -1],
    ] as const) {
      const rows = modifiers(name);
      expect(situations(name), name).toEqual(['fear']);
      expect(total(rows, 'save.will'), name).toBe(0);
      expect(total(rows, 'save.will', { situations: ['fear'] }), name).toBe(
        value,
      );
    }
    // Inspire courage: one tier per performing bard level, each with its own
    // Situations; selecting one tier applies only that tier.
    const courage = modifiers('Inspire Courage');
    const courageScopes = situations('Inspire Courage');
    expect(courageScopes).toHaveLength(8);
    expect(total(courage, 'attack.melee')).toBe(0);
    for (const tier of [1, 2, 3, 4]) {
      const scopes = courageScopes.filter(
        (scope) =>
          typeof scope !== 'string' &&
          scope.local.startsWith(`inspire courage +${tier} `),
      );
      expect(scopes, `${tier}`).toHaveLength(2);
      const [general, charmFear] = scopes;
      expect([
        total(courage, 'attack.melee', { situations: [general!] }),
        total(courage, 'damage.ranged', { situations: [general!] }),
        total(courage, 'save.will', { situations: [general!] }),
        total(courage, 'save.will', { situations: [charmFear!] }),
      ]).toEqual([tier, tier, 0, tier]);
    }
    // Ward: +2, +3 or +4 by the warding witch's level, on AC and saves.
    const ward = modifiers('Ward');
    const wardScopes = situations('Ward');
    expect(wardScopes).toHaveLength(3);
    expect(total(ward, 'ac.other')).toBe(0);
    expect(
      wardScopes.map((scope) => [
        total(ward, 'ac.other', { situations: [scope] }),
        total(ward, 'save.ref', { situations: [scope] }),
      ]),
    ).toEqual([
      [2, 2],
      [3, 3],
      [4, 4],
    ]);
    // Technology: magboots on Climb while climbing metal surfaces, the brown
    // veemod on saves against bright light; one Situation each.
    for (const [name, target, value] of [
      ['Magboots', 'skill.clm', 10],
      ['Veemod (Brown)', 'save.fort', 1],
    ] as const) {
      const rows = modifiers(name);
      const scopes = situations(name);
      expect(scopes, name).toHaveLength(1);
      expect(total(rows, target), name).toBe(0);
      expect(total(rows, target, { situations: scopes }), name).toBe(value);
    }
  });

  // The rule fields of buffs-547.test.ts:369, a proof block whose record
  // checks stay with the unit: the structure of Slow's and Knockdown
  // Stance's Notes (their text is the digest's).
  it("keeps Slow's two Notes at entry level and Knockdown Stance's one Note on attack rolls (buffs-547.test.ts:369)", () => {
    expect(noteRules(entry('Slow'))).toEqual([{}, {}]);
    expect(noteRules(entry('Knockdown Stance'))).toEqual([
      { target: 'attack' },
    ]);
  });

  // The rule fields and gate results of buffs-547.test.ts:618, a proof block whose
  // comparisons with the batch review and preview stay with the unit.
  it("emits each named buff's detail, Modifiers and Note structure as the batch preview held them (buffs-547.test.ts:618)", () => {
    const rules = Object.entries(buffRules['buffs-547']);
    expect(rules).toHaveLength(34);
    for (const [name, expected] of rules)
      expect(ruleFields(entry(name)), name).toEqual(expected);
  });

  it('the gate gives each named buff its list and reason on the released import (buffs-547.test.ts:618)', () => {
    const states = Object.entries(buffGateStates['buffs-547']);
    expect(states).toHaveLength(34);
    for (const [name, expected] of states)
      expect(gateStates.get(entry(name).externalKey), name).toEqual(expected);
  });
});

describe('the pf-buffs-548 keys', () => {
  const { entry, modifiers, situations } = buffBatch(entries, 'pf-buffs-548');

  it('applies the reviewed Modifiers through the public resolver', () => {
    // Caster-level formulas read the effect's recorded caster level.
    const cl = (name: string, target: LeafTarget, levels: readonly number[]) =>
      levels.map((casterLevel) =>
        total(modifiers(name, { casterLevel }), target),
      );
    /** As `cl`, under the buff's own Situations. */
    const clUnderOwn = (
      name: string,
      target: LeafTarget,
      levels: readonly number[],
    ) =>
      levels.map((casterLevel) =>
        total(modifiers(name, { casterLevel }), target, {
          situations: situations(name),
        }),
      );
    const DIVINE_POWER_LEVELS = [7, 8, 9, 12, 18, 20];
    for (const target of [
      'attack.melee',
      'damage.ranged',
      'skill.clm',
      'skill.swm',
    ] as const)
      expect(cl('Divine Power', target, DIVINE_POWER_LEVELS), target).toEqual([
        2, 2, 3, 4, 6, 6,
      ]);
    expect(cl('Divine Power', 'skill.per', [12])).toEqual([0]);
    expect(cl('Acute Senses', 'skill.per', [1, 7, 8, 15, 16, 20])).toEqual([
      10, 10, 20, 20, 30, 30,
    ]);
    expect(cl('Sanctify Armor', 'ac.armor', [3, 4, 8, 12, 19, 20])).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(cl('Sanctify Armor', 'ac.other', [20])).toEqual([0]);
    // Situation-gated caster-level bonuses apply only when selected.
    expect(cl('Jump', 'skill.acr', [9])).toEqual([0]);
    expect(clUnderOwn('Jump', 'skill.acr', [1, 4, 5, 8, 9, 20])).toEqual([
      10, 10, 20, 20, 30, 30,
    ]);
    expect(
      clUnderOwn('Unerring Weapon', 'attack.melee', [1, 4, 19, 20]),
    ).toEqual([2, 3, 6, 7]);
    expect(clUnderOwn('Bullet Shield', 'ac.other', [3, 5, 19, 20])).toEqual([
      4, 5, 7, 8,
    ]);
    expect(cl('Bullet Shield', 'ac.other', [20])).toEqual([0]);
    expect(clUnderOwn('Lay of the Land', 'skill.kge', [3, 5, 9])).toEqual([
      3, 5, 5,
    ]);
    // Natural armor and armor bonuses sit on their own AC leaves (#734).
    expect(
      total(
        modifiers('Change Shape (Skinwalker - Beast Talker, Natural Armor)'),
        'ac.natural',
      ),
    ).toBe(1);
    const bear = modifiers('Aspect of the Bear');
    expect([
      total(bear, 'ac.natural'),
      total(bear, 'cmb'),
      total(bear, 'ac.other'),
    ]).toEqual([2, 2, 0]);
    // Foundry's private "resist" type: the reviewed resistance bonuses.
    expect(total(modifiers('Resistance'), 'save.fort')).toBe(1);
    const barrier = modifiers('Stunning Barrier');
    expect([total(barrier, 'ac.other'), total(barrier, 'save.will')]).toEqual([
      1, 1,
    ]);
    for (const name of ['Shield of Law', 'Cloak of Chaos']) {
      const rows = modifiers(name);
      expect([total(rows, 'ac.other'), total(rows, 'save.ref')], name).toEqual([
        4, 4,
      ]);
    }
    // Charisma-based skills, ability penalties and the imported numbers.
    const beauty = modifiers('Tap Inner Beauty');
    expect(
      (['skill.blf', 'skill.dip', 'skill.umd', 'skill.per'] as const).map(
        (target) => total(beauty, target),
      ),
    ).toEqual([2, 2, 2, 0]);
    const young = modifiers('Threefold Aspect (Young Adult)');
    expect(
      (['ability.dex', 'ability.con', 'ability.wis'] as const).map((target) =>
        total(young, target),
      ),
    ).toEqual([2, 2, -2]);
    const adult = modifiers('Threefold Aspect (Adult)');
    expect(
      (['ability.int', 'ability.wis', 'ability.dex'] as const).map((target) =>
        total(adult, target),
      ),
    ).toEqual([2, 2, -2]);
    const despair = modifiers('Crushing Despair');
    expect(
      (['attack.melee', 'damage.melee', 'save.will', 'skill.per'] as const).map(
        (target) => total(despair, target),
      ),
    ).toEqual([-2, -2, -2, -2]);
    expect(total(modifiers('Lunge'), 'ac.other')).toBe(-2);
    expect(total(modifiers('Great Cleave'), 'ac.other')).toBe(-2);
    const heroics = modifiers('Inspire Heroics');
    expect([total(heroics, 'ac.other'), total(heroics, 'save.ref')]).toEqual([
      4, 4,
    ]);
    expect(total(modifiers('Luckbringer'), 'save.will')).toBe(1);
    expect(
      total(
        modifiers('Change Shape (Skinwalker - Beast Talker, DEX)'),
        'ability.dex',
      ),
    ).toBe(2);
    // Veil of positive energy: the reviewed change replacements set the
    // imported +2 sacred bonuses to 0; the reviewed Modifiers apply them only
    // against undead.
    const veil = modifiers('Veil of Positive Energy');
    expect(veil.slice(0, 2).map((row) => row.value)).toEqual([0, 0]);
    expect([total(veil, 'ac.other'), total(veil, 'save.will')]).toEqual([0, 0]);
    const undead = { situations: situations('Veil of Positive Energy') };
    expect([
      total(veil, 'ac.other', undead),
      total(veil, 'save.will', undead),
    ]).toEqual([2, 2]);
  });

  it('applies each situational Modifier only under its Situation, with the tiers mutually exclusive', () => {
    // Shared Situations where the body's condition matches exactly.
    for (const [name, situation, target, value] of [
      ['Protection From Law', 'lawfulCreatures', 'ac.other', 2],
      ['Protection From Law', 'lawfulCreatures', 'save.ref', 2],
      ['Protection From Good', 'goodCreatures', 'ac.other', 2],
      ['Dispel Chaos', 'chaoticCreatures', 'ac.other', 4],
      ['Dispel Good', 'goodCreatures', 'ac.other', 4],
      ['Mind Blank', 'mindAffecting', 'save.will', 8],
      ['Blessing of Courage and Life', 'fear', 'save.will', 2],
      ['Blessing of Courage and Life', 'death', 'save.fort', 2],
      ['Burst of Glory', 'fear', 'save.ref', 1],
      ['Blessings of Luck and Resolve', 'fear', 'save.will', 2],
      ['Aspect of the Wolf', 'trip', 'cmb', 2],
    ] as const) {
      const rows = modifiers(name);
      expect(situations(name), name).toContain(situation);
      expect(total(rows, target), name).toBe(0);
      expect(total(rows, target, { situations: [situation] }), name).toBe(
        value,
      );
    }
    // Both morale bonuses of blessing of courage and life don't stack.
    expect(
      total(modifiers('Blessing of Courage and Life'), 'save.will', {
        situations: ['fear', 'death'],
      }),
    ).toBe(2);
    // Perfect placement: +1 insight to AC, +3 against attacks of opportunity.
    const placement = modifiers('Perfect Placement');
    expect(total(placement, 'ac.other')).toBe(1);
    expect(
      total(placement, 'ac.other', {
        situations: situations('Perfect Placement'),
      }),
    ).toBe(3);
    // Mutually exclusive tiers for another creature's level.
    const tiers = (
      name: string,
      target: LeafTarget,
      expected: readonly number[],
    ) => {
      const rows = modifiers(name);
      const scopes = situations(name);
      expect(scopes, name).toHaveLength(expected.length);
      expect(total(rows, target), name).toBe(0);
      expect(
        scopes.map((scope) => total(rows, target, { situations: [scope] })),
        name,
      ).toEqual(expected);
    };
    tiers('Evil Eye (Saves)', 'save.will', [-2, -4]);
    tiers('Evil Eye (AC)', 'ac.other', [-2, -4]);
    tiers('Animal Focus (Bear)', 'ability.con', [2, 4, 6]);
    tiers('Animal Focus (Falcon)', 'skill.per', [4, 6, 8]);
    tiers('Animal Focus (Owl)', 'skill.ste', [4, 6, 8]);
    // Disoriented: -2 on attack rolls, plus the rogue tier against the rogue.
    const disoriented = modifiers('Debilitating Injury (Disoriented)');
    const rogue = situations('Debilitating Injury (Disoriented)');
    expect(rogue).toHaveLength(3);
    expect(total(disoriented, 'attack.melee')).toBe(-2);
    expect(
      rogue.map((scope) =>
        total(disoriented, 'attack.melee', { situations: [scope] }),
      ),
    ).toEqual([-4, -6, -8]);
    // Guidance: +1 competence on the one chosen roll.
    const guidance = modifiers('Guidance');
    const chosen = { situations: situations('Guidance') };
    expect(situations('Guidance')).toHaveLength(1);
    expect([
      total(guidance, 'attack.melee'),
      total(guidance, 'save.fort'),
      total(guidance, 'skill.per'),
    ]).toEqual([0, 0, 0]);
    expect([
      total(guidance, 'attack.melee', chosen),
      total(guidance, 'save.fort', chosen),
      total(guidance, 'skill.per', chosen),
    ]).toEqual([1, 1, 1]);
    // Halo: two local Situations.
    const halo = modifiers('Halo');
    const [blinded, evil] = situations('Halo');
    expect([
      total(halo, 'save.fort', { situations: [blinded!] }),
      total(halo, 'skill.int', { situations: [evil!] }),
      total(halo, 'skill.int'),
    ]).toEqual([2, 2, 0]);
  });

  // The rule fields of pf-buffs-548.test.ts:420, a proof block whose record
  // checks stay with the unit: the structure of the Notes of Ill Omen and
  // Darkvision 60' (their text is the digest's).
  it("keeps one Note at entry level each for Ill Omen and Darkvision 60' (pf-buffs-548.test.ts:420)", () => {
    expect(noteRules(entry('Ill Omen'))).toEqual([{}]);
    expect(noteRules(entry("Darkvision 60'"))).toEqual([{}]);
  });

  // The rule fields and gate results of pf-buffs-548.test.ts:679, a proof block whose
  // comparisons with the batch review and preview stay with the unit.
  it("emits each named buff's detail, Modifiers and Note structure as the batch preview held them (pf-buffs-548.test.ts:679)", () => {
    const rules = Object.entries(buffRules['pf-buffs-548']);
    expect(rules).toHaveLength(44);
    for (const [name, expected] of rules)
      expect(ruleFields(entry(name)), name).toEqual(expected);
  });

  it('the gate gives each named buff its list and reason on the released import (pf-buffs-548.test.ts:679)', () => {
    const states = Object.entries(buffGateStates['pf-buffs-548']);
    expect(states).toHaveLength(42);
    for (const [name, expected] of states)
      expect(gateStates.get(entry(name).externalKey), name).toEqual(expected);
  });
});

describe('the pf-buffs-549 keys', () => {
  const { entry, modifiers, situations } = buffBatch(entries, 'pf-buffs-549');
  /** A base attack bonus row, as pf-buffs-549.test.ts's `BAB` fixture. */
  const BAB = (value: number): InputSourcedModifier => ({
    target: 'bab',
    bonusType: 'base',
    value,
    sheetEntryId: 'fixture-bab',
    catalogEntryId: 'fixture-bab',
    entryName: 'Fixture BAB',
    source: 'fixture-bab',
    builtIn: false,
  });
  /** A Charisma score row, as pf-buffs-549.test.ts's `CHARISMA` fixture. */
  const CHARISMA = (value: number): InputSourcedModifier => ({
    target: 'ability.cha',
    bonusType: 'base',
    value,
    sheetEntryId: 'fixture-cha',
    catalogEntryId: 'fixture-cha',
    entryName: 'Fixture Charisma',
    source: 'fixture-cha',
    builtIn: false,
  });

  it('applies the reviewed Modifiers through the public resolver', () => {
    const cl = (
      name: string,
      target: LeafTarget,
      {
        levels,
        under = [],
      }: { levels: readonly number[]; under?: readonly BuffSituation[] },
    ) =>
      levels.map((casterLevel) =>
        total(modifiers(name, { casterLevel }), target, {
          situations: under,
        }),
      );
    // Caster-level formulas read the effect's recorded caster level.
    expect(cl('Anticipate Peril', 'init', { levels: [1, 3, 5, 8] })).toEqual([
      1, 3, 5, 5,
    ]);
    expect(
      cl('Wrathful Mantle', 'save.fort', { levels: [5, 8, 19, 20] }),
    ).toEqual([1, 2, 4, 5]);
    const [onArmor, onShield] = situations('Magic Vestment');
    expect(cl('Magic Vestment', 'ac.armor', { levels: [12] })).toEqual([0]);
    expect(
      cl('Magic Vestment', 'ac.armor', {
        levels: [5, 12, 20],
        under: [onArmor!],
      }),
    ).toEqual([1, 3, 5]);
    expect(
      cl('Magic Vestment', 'ac.shield', { levels: [12], under: [onArmor!] }),
    ).toEqual([0]);
    expect(
      cl('Magic Vestment', 'ac.shield', { levels: [12], under: [onShield!] }),
    ).toEqual([3]);
    expect(
      cl('Magic Vestment', 'ac.other', { levels: [20], under: [onArmor!] }),
    ).toEqual([0]);
    const weapon = situations('Magic Weapon, Greater');
    expect(
      cl('Magic Weapon, Greater', 'attack.melee', { levels: [12] }),
    ).toEqual([0]);
    expect(
      cl('Magic Weapon, Greater', 'attack.ranged', {
        levels: [8, 12, 20],
        under: weapon,
      }),
    ).toEqual([2, 3, 5]);
    expect(
      cl('Magic Weapon, Greater', 'damage.melee', {
        levels: [20],
        under: weapon,
      }),
    ).toEqual([5]);
    const [oneWeapon, allNatural] = situations('Magic Fang, Greater');
    expect(
      cl('Magic Fang, Greater', 'attack.melee', {
        levels: [8, 12, 20],
        under: [oneWeapon!],
      }),
    ).toEqual([2, 3, 5]);
    expect(
      cl('Magic Fang, Greater', 'damage.melee', {
        levels: [20],
        under: [allNatural!],
      }),
    ).toEqual([1]);
    expect(cl('Magic Fang, Greater', 'attack.melee', { levels: [20] })).toEqual(
      [0],
    );
    // Magic fang: the reviewed replacements zero the imported +1s; the
    // reviewed Modifiers apply them only with the affected natural weapon.
    const fang = modifiers('Magic Fang');
    expect(fang.slice(0, 2).map((row) => row.value)).toEqual([0, 0]);
    expect([total(fang, 'attack.melee'), total(fang, 'damage.melee')]).toEqual([
      0, 0,
    ]);
    const natural = { situations: situations('Magic Fang') };
    expect([
      total(fang, 'attack.melee', natural),
      total(fang, 'damage.melee', natural),
      total(fang, 'attack.ranged', natural),
    ]).toEqual([1, 1, 0]);
    // Foundry's private "resist" and "haste" types: the reviewed bonuses.
    for (const name of ['Holy Aura', 'Unholy Aura']) {
      const rows = modifiers(name);
      expect([total(rows, 'ac.other'), total(rows, 'save.ref')], name).toEqual([
        4, 4,
      ]);
      expect(
        total(rows, 'save.will', { situations: situations(name) }),
        name,
      ).toBe(6);
    }
    const fervor = modifiers('Blessing of Fervor (Atk, AC, Ref)');
    expect([
      total(fervor, 'attack.melee'),
      total(fervor, 'ac.other'),
      total(fervor, 'save.ref'),
      total(fervor, 'save.will'),
    ]).toEqual([2, 2, 2, 0]);
    const limbs = modifiers('Channel Vigor (Limbs)');
    expect([
      total(limbs, 'attack.ranged'),
      total(limbs, 'ac.other'),
      total(limbs, 'save.ref'),
    ]).toEqual([1, 1, 1]);
    const torso = modifiers('Channel Vigor (Torso)');
    expect([total(torso, 'concentration'), total(torso, 'save.fort')]).toEqual([
      6, 6,
    ]);
    // Death knell's +1 caster level and +2 Strength.
    const knell = modifiers('Death Knell');
    expect([total(knell, 'casterLevel'), total(knell, 'ability.str')]).toEqual([
      1, 2,
    ]);
    // Dexterity-based skills, ability penalties and the imported numbers.
    const jitterbugs = modifiers('Jitterbugs');
    expect(
      (
        [
          'skill.acr',
          'skill.ste',
          'skill.fly',
          'skill.esc',
          'skill.per',
        ] as const
      ).map((target) => total(jitterbugs, target)),
    ).toEqual([-4, -4, -4, -4, 0]);
    const elderly = modifiers('Threefold Aspect (Elderly)');
    expect(
      (
        ['ability.int', 'ability.wis', 'ability.str', 'ability.dex'] as const
      ).map((target) => total(elderly, target)),
    ).toEqual([4, 4, -2, -2]);
    const might = modifiers('Righteous Might');
    expect(
      (
        [
          'ability.str',
          'ability.con',
          'ability.dex',
          'ac.natural',
          'ac.other',
        ] as const
      ).map((target) => total(might, target)),
    ).toEqual([4, 4, -2, 2, 0]);
    const hope = modifiers('Good Hope');
    expect(
      (
        ['attack.melee', 'damage.ranged', 'save.will', 'skill.per'] as const
      ).map((target) => total(hope, target)),
    ).toEqual([2, 2, 2, 2]);
    expect(total(modifiers('Alter Self (Small)'), 'ability.dex')).toBe(2);
    expect(
      total(
        modifiers('Change Shape (Skinwalker, Natural Armor)'),
        'ac.natural',
      ),
    ).toBe(1);
    expect(
      total(
        modifiers('Change Shape (Skinwalker - Beast Talker, CON)'),
        'ability.con',
      ),
    ).toBe(2);
    // Combat expertise: the penalty on melee attacks and combat maneuver
    // checks and the dodge bonus grow with base attack bonus.
    for (const [bab, step] of [
      [0, 1],
      [4, 2],
      [8, 3],
      [20, 6],
    ] as const) {
      const expertise = [...modifiers('Combat Expertise'), BAB(bab)];
      expect(
        [
          total(expertise, 'attack.melee'),
          total(expertise, 'cmb'),
          total(expertise, 'ac.other'),
          total(expertise, 'attack.ranged'),
        ],
        `BAB ${bab}`,
      ).toEqual([-step, -step, step, 0]);
    }
    // Smite evil reads the paladin's own Charisma and paladin level.
    const smite = [...modifiers('Smite Evil'), CHARISMA(16)];
    const target = { situations: situations('Smite Evil') };
    expect([total(smite, 'attack.melee'), total(smite, 'ac.other')]).toEqual([
      0, 0,
    ]);
    expect([
      total(smite, 'attack.melee', target),
      total(smite, 'damage.melee', { ...target, classLevels: { paladin: 7 } }),
      total(smite, 'ac.other', target),
    ]).toEqual([3, 7, 3]);
    // A negative Charisma modifier (score 6) adds nothing.
    expect(
      total([...modifiers('Smite Evil'), CHARISMA(6)], 'attack.melee', target),
    ).toBe(0);
  });

  it('applies each situational Modifier only under its Situation, with the tiers mutually exclusive', () => {
    // Each total without its Situation, then under it: the old test's "total
    // under the Situation equals the total without it plus the value", as
    // the two literals.
    for (const [name, situation, target, without, under] of [
      ['Dispel Law', 'lawfulCreatures', 'ac.other', 0, 4],
      ['Pernicious Poison', 'poison', 'save.fort', 0, -4],
      ['Remove Fear', 'fear', 'save.will', 0, 4],
      ['Remove Fear', 'fear', 'save.ref', 0, 4],
      ['Joyous Companion', 'fear', 'save.will', 0, 1],
      ['Small Quarter Ally', 'fear', 'save.fort', 0, 1],
      ['Charging', 'bullRush', 'cmb', 0, 2],
      ['Certain Grip', 'trip', 'cmd', 0, 4],
      ['Certain Grip', 'bullRush', 'cmd', 0, 4],
    ] as const) {
      const rows = modifiers(name);
      expect(situations(name), name).toContain(situation);
      expect(total(rows, target), name).toBe(without);
      expect(total(rows, target, { situations: [situation] }), name).toBe(
        under,
      );
    }
    // Certain grip: one competence bonus to CMD, however many maneuvers apply.
    expect(
      total(modifiers('Certain Grip'), 'cmd', {
        situations: ['bullRush', 'drag', 'reposition', 'trip'],
      }),
    ).toBe(4);
    // Local Situations.
    for (const [name, target, value] of [
      ['Protection From Evil', 'ac.other', 2],
      ['Protection From Evil', 'save.ref', 4],
      ['Angelic Aspect (Lesser)', 'save.will', 4],
      ['Dispel Evil', 'ac.other', 4],
      ['Adoration', 'skill.dip', 2],
      ['Chastise', 'skill.int', 5],
      ['Glibness', 'skill.blf', 20],
      ['Identify', 'skill.spl', 10],
      ['Unbreakable Heart', 'save.will', 4],
      ['Banner, Greater', 'save.fort', 2],
      ['Weapon of Awe', 'damage.melee', 2],
      ['Certain Grip', 'skill.acr', 4],
      ['Cover (Soft)', 'ac.other', 4],
    ] as const) {
      const rows = modifiers(name);
      expect(total(rows, target), name).toBe(0);
      expect(total(rows, target, { situations: situations(name) }), name).toBe(
        value,
      );
    }
    const smiteGood = modifiers('Smite Good (Tiefling)');
    expect(
      total(smiteGood, 'damage.melee', {
        situations: situations('Smite Good (Tiefling)'),
        hitDice: 6,
      }),
    ).toBe(6);
    // Mutually exclusive tiers for another creature's level.
    const tiers = (
      name: string,
      target: LeafTarget,
      { under, without = 0 }: { under: readonly number[]; without?: number },
    ) => {
      const rows = modifiers(name);
      const scopes = situations(name);
      expect(scopes, name).toHaveLength(under.length);
      expect(total(rows, target), name).toBe(without);
      expect(
        scopes.map((scope) => total(rows, target, { situations: [scope] })),
        name,
      ).toEqual(under);
    };
    tiers('Evil Eye (Atk)', 'attack.melee', { under: [-2, -4] });
    tiers('Evil Eye (Skill)', 'skill.per', { under: [-2, -4] });
    tiers('Animal Focus (Frog)', 'skill.swm', { under: [4, 6, 8] });
    tiers('Touch of Good', 'attack.ranged', {
      under: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    tiers('Touch of Good', 'save.will', {
      under: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    // Bewildered: -2 to AC, plus the rogue tier against the rogue's attacks.
    tiers('Debilitating Injury (Bewildered)', 'ac.other', {
      under: [-4, -6, -8],
      without: -2,
    });
  });

  // The rule fields of pf-buffs-549.test.ts:498, a proof block whose record
  // checks stay with the unit: the structure of the Notes of Animal Focus
  // (Wolf) and Tremorsense 30' (their text is the digest's).
  it("keeps one Note at entry level each for Animal Focus (Wolf) and Tremorsense 30' (pf-buffs-549.test.ts:498)", () => {
    expect(noteRules(entry('Animal Focus (Wolf)'))).toEqual([{}]);
    expect(noteRules(entry("Tremorsense 30'"))).toEqual([{}]);
  });

  // The rule fields and gate results of pf-buffs-549.test.ts:750, a proof block whose
  // comparisons with the batch review and preview stay with the unit.
  it("emits each named buff's detail, Modifiers and Note structure as the batch preview held them (pf-buffs-549.test.ts:750)", () => {
    const rules = Object.entries(buffRules['pf-buffs-549']);
    expect(rules).toHaveLength(47);
    for (const [name, expected] of rules)
      expect(ruleFields(entry(name)), name).toEqual(expected);
  });

  it('the gate gives each named buff its list and reason on the released import (pf-buffs-549.test.ts:750)', () => {
    const states = Object.entries(buffGateStates['pf-buffs-549']);
    expect(states).toHaveLength(44);
    for (const [name, expected] of states)
      expect(gateStates.get(entry(name).externalKey), name).toEqual(expected);
  });
});
