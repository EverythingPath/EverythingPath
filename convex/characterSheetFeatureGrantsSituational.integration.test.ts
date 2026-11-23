// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { releaseFixture } from '../tests/catalog-release-fixture';
import {
  installReleasedBodies,
  readSavedSheet,
} from '../tests/released-catalog-entries';
import { reviewedLevelGrants } from '../scripts/catalog/launch-mechanism-proofs';
import {
  calculateCharacterSheet,
  type ResolvedStatistic,
} from '../src/lib/character-sheet';
import { findReviewedClassCasting } from '../src/lib/character-sheet-casting-tables';
import type { RequestedSituation } from '../src/lib/character-sheet-situations';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

const modules = import.meta.glob('./**/*.ts');

// The class-feature level-grant family's public proof for parents with
// curated Situational Modifiers (#775 slice 1b,
// `scripts/catalog/launch-mechanism-proofs.ts`, `class-feature-level-grants`):
// a released class's `featuresByLevel` grants the parent, and its Modifiers,
// formulas on `@classLevel.<tag>`, stay out of every total, are listed in
// `conditional` with their Situation and apply in it, as the client requests
// it; a multiclass sum and a dodge bonus, a higher-class max and a cap, local
// Situations on skills and routine lines, dormancy, replacement and access
// hold. The four features carry their release keys, class levels and the
// exact Modifiers the importer gives them (pf1 418761d2 packs/class-abilities:
// Bravery CRB p. 55, Trap Sense CRB pp. 31 and 69, Poison Resistance APG
// p. 31, Studied Target ACG p. 53); the classes carry their release keys,
// tags and the real `featuresByLevel` for these features and their schedule
// increments (packs/classes). The Investigator lists none of them here: it
// only gives `@classLevel.investigator` levels. The Archetype is shaped as
// the Two-Handed Fighter's Shattering Strike, which replaces Bravery. Every
// read and write the test makes is public.
const keys = {
  fighter: 'pf1/WLqBCT5DqmGAx8Wd',
  rogue: 'pf1/24b0LaabeAlUx5gN',
  barbarian: 'pf1/g3pq7xWWdUVYw6ai',
  alchemist: 'pf1/JcaqlAawhf14q1lq',
  investigator: 'pf1/s27zdYVFenYBVtfu',
  slayer: 'pf1/cOY76lMUkupH534m',
  bravery: 'pf1/h0Brxw6khcjlEf1T',
  trapSense: 'pf1/BoEkMviJrW0PKmhj',
  poisonResistance: 'pf1/2qcz39w9O2Qlms0Q',
  studiedTarget: 'pf1/JnXrphJlr1ULx1MK',
  archetype: 'pf1/featureGrantsSituationalProofArchetype',
  sword: 'pf1/featureGrantsSituationalProofSword',
  bow: 'pf1/featureGrantsSituationalProofBow',
} as const;
type ClassName = keyof typeof classes;

type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  modifiers?: unknown[];
};
function body({ externalKey, name, pack, detail, modifiers = [] }: Body) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack,
    name,
    detail,
    description: `<p>${name} body.</p>`,
    sources: [{ book: 'PZO1110', pages: '9' }],
    modifiers,
    unsupported: [],
  };
}
/** A Situational Modifier: `<target> <bonus type> <formula>` in a Situation. */
const modifier = (
  [target, bonusType, formula]: [string, string, string],
  situation: string | { local: string },
) => ({ target, bonusType, value: { formula }, condition: { situation } });
const trapSenseFormula =
  'floor(@classLevel.barbarian / 3) + floor(@classLevel.rogue / 3) + floor(@classLevel.investigator / 3)';
const studied = { local: 'against studied target' };
const studiedTargets = [
  'skill.blf',
  'skill.kar',
  'skill.kdu',
  'skill.ken',
  'skill.kge',
  'skill.khi',
  'skill.klo',
  'skill.kna',
  'skill.kno',
  'skill.kpl',
  'skill.kre',
  'skill.per',
  'skill.sur',
  'attack.melee',
  'damage.melee',
  'attack.ranged',
  'damage.ranged',
  'skill.sen',
] as const;
/** Each feature's Modifiers, exactly as the importer emits them. */
const featureModifiers = {
  [keys.bravery]: [
    modifier(
      ['save.will', 'untyped', 'floor((@classLevel.fighter + 2) / 4)'],
      'fear',
    ),
  ],
  [keys.trapSense]: [
    modifier(['save.ref', 'untyped', trapSenseFormula], { local: 'vs. traps' }),
    modifier(['ac', 'dodge', trapSenseFormula], { local: 'vs. traps' }),
  ],
  [keys.poisonResistance]: [
    modifier(
      [
        'saves',
        'untyped',
        'min(6, floor((max(@classLevel.alchemist, @classLevel.investigator) + 1) / 3) * 2)',
      ],
      'poison',
    ),
  ],
  [keys.studiedTarget]: studiedTargets.map((target) =>
    modifier([target, 'untyped', 'floor(@classLevel.slayer / 5) + 1'], studied),
  ),
};
const featureNames = {
  [keys.bravery]: 'Bravery',
  [keys.trapSense]: 'Trap Sense',
  [keys.poisonResistance]: 'Poison Resistance',
  [keys.studiedTarget]: 'Studied Target',
};
type FeatureKey = keyof typeof featureModifiers;
const features = Object.entries(featureModifiers).map(
  ([externalKey, modifiers]) =>
    body({
      externalKey,
      name: featureNames[externalKey as FeatureKey],
      pack: 'class-abilities',
      detail: { kind: 'classFeature' },
      modifiers,
    }),
);
/** A feature's schedule increments, as the importer gives them. */
const incrementKeys = (prefix: string, parent: string, levels: number[]) =>
  Object.fromEntries(
    levels.map((level) => [
      `everythingpath/${prefix}-${level}`,
      { level, parent },
    ]),
  );
const increments = {
  ...incrementKeys('fighter-bravery', keys.bravery, [6, 10, 14, 18]),
  ...incrementKeys(
    'alchemist-poison-resistance',
    keys.poisonResistance,
    [5, 8],
  ),
  ...incrementKeys(
    'slayer-studied-target',
    keys.studiedTarget,
    [5, 10, 15, 20],
  ),
};
const incrementBodies = Object.entries(increments).map(
  ([externalKey, { level, parent }]) =>
    body({
      externalKey,
      name: `${featureNames[parent as FeatureKey]} ${level}`,
      pack: 'everythingpath-schedules',
      detail: {
        kind: 'classFeature',
        parentFeature: parent,
        part: `${level}:${parent}`,
      },
    }),
);
const listed = (prefix: string) =>
  Object.fromEntries(
    Object.entries(increments)
      .filter(([key]) => key.startsWith(`everythingpath/${prefix}-`))
      .map(([key, { level }]) => [key, level]),
  );

const alchemy = {
  type: 'prepared',
  spellKind: 'alchemy',
  casterLevelOffset: 0,
};
/** Each released class: its tag, the features it lists and its casting. */
const classes = {
  fighter: {
    name: 'Fighter',
    tag: 'fighter',
    features: { [keys.bravery]: 2, ...listed('fighter-bravery') },
  },
  rogue: { name: 'Rogue', tag: 'rogue', features: { [keys.trapSense]: 3 } },
  barbarian: {
    name: 'Barbarian',
    tag: 'barbarian',
    features: { [keys.trapSense]: 3 },
  },
  alchemist: {
    name: 'Alchemist',
    tag: 'alchemist',
    features: {
      [keys.poisonResistance]: 2,
      ...listed('alchemist-poison-resistance'),
    },
    casting: alchemy,
  },
  investigator: {
    name: 'Investigator',
    tag: 'investigator',
    features: {},
    casting: alchemy,
  },
  slayer: {
    name: 'Slayer',
    tag: 'slayer',
    features: { [keys.studiedTarget]: 1, ...listed('slayer-studied-target') },
  },
} satisfies Record<
  string,
  {
    name: string;
    tag: string;
    features: Record<string, number>;
    casting?: Record<string, unknown>;
  }
>;
const classBodies = Object.entries(classes).map(([className, value]) =>
  body({
    externalKey: keys[className as ClassName],
    name: value.name,
    pack: 'classes',
    detail: {
      kind: 'class',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      classSkills: [],
      tag: value.tag,
      classKind: 'base',
      skillRanksPerLevel: 2,
      featuresByLevel: Object.entries(value.features).map(
        ([externalKey, classLevel]) => ({ classLevel, externalKey }),
      ),
      picksByLevel: [],
      ...('casting' in value ? { casting: value.casting } : {}),
    },
  }),
);
const archetypeBody = body({
  externalKey: keys.archetype,
  name: 'Proof Shattering Archetype',
  pack: 'archetypes',
  detail: {
    kind: 'archetype',
    classKeys: [keys.fighter],
    replaces: [{ classLevel: 2, externalKey: keys.bravery, scope: 'whole' }],
    adds: [],
  },
});
const weapon = (
  externalKey: string,
  name: string,
  profile: Record<string, unknown>,
) =>
  body({
    externalKey,
    name,
    pack: 'weapons-and-ammo',
    detail: {
      kind: 'item',
      consumable: false,
      price: 15,
      weight: 3,
      weapon: {
        proficiency: 'martial',
        threat: 20,
        mult: 2,
        finesse: false,
        monk: false,
        thrown: false,
        ...profile,
      },
    },
  });
const weaponBodies = [
  weapon(keys.sword, 'Proof Sword', {
    baseType: 'Longsword',
    groups: ['bladesHeavy'],
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['slashing'],
    strengthDamage: 'melee',
  }),
  weapon(keys.bow, 'Proof Bow', {
    baseType: 'Shortbow',
    groups: ['bows'],
    handedness: 'twoHanded',
    attackType: 'ranged',
    dice: '1d6',
    damageTypes: ['piercing'],
    rangeIncrement: 60,
    strengthDamage: 'bow',
    reload: 'free',
  }),
];
const bodies = [
  ...features,
  ...incrementBodies,
  ...classBodies,
  archetypeBody,
  ...weaponBodies,
];

type Viewer = Awaited<ReturnType<typeof releaseFixture>>['owner'];
type Sheet = Awaited<ReturnType<typeof readSavedSheet>>;

const identity = (externalKey: string, name: string) => ({
  scope: 'global' as const,
  name,
  ruleIdentity: externalKey,
  modifiers: [],
  sources: [],
  stacksWithItself: false,
});
/** The stored identity a body starts from, before the release. */
function insertIdentity(
  ctx: MutationCtx,
  { externalKey, name, detail }: (typeof bodies)[number],
  id: (key: string) => Id<'catalogEntry'>,
) {
  switch (detail.kind) {
    case 'classFeature':
      return ctx.db.insert('catalogEntry', {
        ...identity(externalKey, name),
        detail: { kind: 'classFeature' },
      });
    case 'item':
      return ctx.db.insert('catalogEntry', {
        ...identity(externalKey, name),
        detail: { kind: 'item', consumable: false },
      });
    case 'archetype':
      return ctx.db.insert('catalogEntry', {
        ...identity(externalKey, name),
        detail: {
          kind: 'archetype',
          classEntryIds: [id(keys.fighter)],
          replaces: [],
          adds: [],
        },
      });
    default: {
      const tag = detail.tag as string;
      const casting =
        'casting' in detail ? findReviewedClassCasting(tag) : undefined;
      return ctx.db.insert('catalogEntry', {
        ...identity(externalKey, name),
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 6,
          bab: 'half',
          saves: { fort: 'poor', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
          classSkills: [],
          featuresByLevel: [],
          picksByLevel: [],
          ...(casting ? { casting } : {}),
        },
      });
    }
  }
}

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion, as `characterSheetFeatureGrants.integration.test.ts` installs
 * them: stored identity stubs (a caster's with its reviewed casting), then
 * each replaced by its release candidate.
 */
async function fixture() {
  const { t, owner, outsider, scope, create } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids = new Map<string, Id<'catalogEntry'>>();
  const id = (key: string) => {
    const found = ids.get(key);
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  await t.run(async (ctx) => {
    // The classes before the Archetype, which names the Fighter.
    const ordered = [...bodies].sort(
      (a, b) =>
        Number(a.detail.kind === 'archetype') -
        Number(b.detail.kind === 'archetype'),
    );
    for (const entry of ordered)
      ids.set(entry.externalKey, await insertIdentity(ctx, entry, id));
  });
  await installReleasedBodies(t, bodies, id);

  let characters = 0;
  /**
   * A Character whose Class Levels are these released classes in order, the
   * first replacing the initial Class Level, with every score 10.
   */
  async function character(levels: readonly ClassName[]) {
    characters += 1;
    const characterId =
      characters === 1
        ? scope.characterId
        : await create(`Situational ${characters}`);
    const own = { organizationId: 'org', characterId };
    const read = (viewer: Viewer = member) => readSavedSheet(viewer, own);
    const first = (await read(owner)).entries.find(
      (entry) => entry.kind === 'classLevel',
    );
    if (!first) throw new Error('Missing first Class Level');
    await member.mutation(api.characterSheet.editBaseScores, {
      ...own,
      scores: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      operationId: 'scores',
    });
    let count = 0;
    const add = async (className: ClassName) => {
      count += 1;
      const classEntryId = id(keys[className]);
      if (count === 1)
        await member.mutation(api.characterSheet.editClassLevel, {
          ...own,
          entryId: first._id,
          classEntryId,
          operationId: 'first-level',
        });
      else
        await member.mutation(api.characterSheet.addClassLevel, {
          ...own,
          classEntryId,
          operationId: `level-${count}`,
        });
    };
    for (const className of levels) await add(className);
    return { scope: own, read, add };
  }
  return { t, owner, member, outsider, id, character };
}

type Statistic = Pick<ResolvedStatistic, 'total' | 'conditional'>;
type Calculated = ReturnType<typeof resolved> | Sheet['calculated'];
/** The sheet as if these Situations held, from one read's own data. */
function resolved(sheet: Sheet, situations: readonly RequestedSituation[]) {
  return calculateCharacterSheet(
    { ...sheet, characterKind: sheet.character.kind },
    { situations: [...situations] },
  );
}
/** A feature's conditional contributions to a statistic, one per Grant. */
function conditionalOf(statistic: Statistic, key: FeatureKey) {
  return statistic.conditional
    .filter((row) => row.source === key)
    .map(({ value, bonusType, condition }) => ({
      value,
      bonusType,
      situation: condition?.situation,
    }));
}
/** The requested Situations a feature's local Situation is, one per Grant. */
function localSituations(
  statistic: Statistic,
  key: FeatureKey,
  name: string,
): RequestedSituation[] {
  return statistic.conditional
    .filter(
      ({ source, condition }) =>
        source === key &&
        typeof condition?.situation === 'object' &&
        'local' in condition.situation &&
        condition.situation.local === name,
    )
    .map(({ sheetEntryId }) => ({ local: name, sheetEntryId }));
}
/** The totals the features' Modifiers reach. */
function totals(calculated: Calculated) {
  const { derivedStatistics: statistics } = calculated;
  return {
    fortitude: statistics.fortitude.total,
    reflex: statistics.reflex.total,
    will: statistics.will.total,
    ac: statistics.ac.total,
    touchAc: statistics.touchAc.total,
    flatFootedAc: statistics.flatFootedAc.total,
    cmd: statistics.cmd.total,
  };
}
function formulaWarnings(sheet: Sheet) {
  return sheet.calculated.warnings.filter(({ check }) =>
    ['unsupportedFormula', 'formulaDependency'].includes(check),
  );
}
const repeat = (className: ClassName, count: number) =>
  Array.from({ length: count }, () => className);

test('the proof’s features carry exactly the reviewed Situation outputs of the family’s listed parents', () => {
  const reviewed = reviewedLevelGrants.filter(({ situational }) => situational);
  expect(reviewed.map(({ key }) => key).sort()).toEqual(
    Object.keys(featureModifiers).sort(),
  );
  for (const { key, name, situational } of reviewed)
    expect(featureModifiers[key as FeatureKey], name).toEqual(
      situational?.modifiers,
    );
});

test('Bravery on a released Fighter stays out of the Will total, is listed in fear, and applies there by level', async () => {
  const { character } = await fixture();
  const fighter = await character([]);
  const fear = { value: 0, bonusType: 'untyped', situation: 'fear' };
  // CRB p. 55: +1 at 2nd, and +1 more for every four levels beyond 2nd; the
  // increments add nothing of their own.
  const expected = new Map([
    [1, 0],
    [2, 1],
    [5, 1],
    [6, 2],
    [10, 3],
    [18, 5],
  ]);
  for (let level = 1; level <= 18; level += 1) {
    await fighter.add('fighter');
    const bonus = expected.get(level);
    if (bonus === undefined) continue;
    const sheet = await fighter.read();
    const { will } = sheet.calculated.derivedStatistics;
    expect(formulaWarnings(sheet), `level ${level}`).toEqual([]);
    expect(
      will.applied.some(({ source }) => source === keys.bravery),
      `level ${level}`,
    ).toBe(false);
    expect(conditionalOf(will, keys.bravery), `level ${level}`).toEqual(
      bonus ? [{ ...fear, value: bonus }] : [],
    );
    const base = totals(sheet.calculated);
    expect(totals(resolved(sheet, [])), `level ${level}`).toEqual(base);
    expect(totals(resolved(sheet, ['fear'])), `level ${level}`).toEqual({
      ...base,
      will: base.will + bonus,
    });
    expect(totals(resolved(sheet, ['poison'])), `level ${level}`).toEqual(base);
  }
});

test('Trap Sense sums a released Rogue and Barbarian once, on Reflex and dodge AC against traps: touch AC, never flat-footed AC', async () => {
  const { character } = await fixture();
  const rogue = await character(repeat('rogue', 3));
  const rogueSheet = await rogue.read();
  const vsTraps = (value: number, bonusType = 'untyped') => ({
    value,
    bonusType,
    situation: { local: 'vs. traps' },
  });
  const rogueStatistics = rogueSheet.calculated.derivedStatistics;
  // Rogue 3: the absent Barbarian and Investigator tags read 0.
  expect(conditionalOf(rogueStatistics.reflex, keys.trapSense)).toEqual([
    vsTraps(1),
  ]);
  const rogueBase = totals(rogueSheet.calculated);
  expect(
    totals(
      resolved(
        rogueSheet,
        localSituations(rogueStatistics.reflex, keys.trapSense, 'vs. traps'),
      ),
    ),
  ).toEqual({
    ...rogueBase,
    reflex: rogueBase.reflex + 1,
    ac: rogueBase.ac + 1,
    touchAc: rogueBase.touchAc + 1,
    cmd: rogueBase.cmd + 1,
  });

  for (const className of repeat('barbarian', 3)) await rogue.add(className);
  const sheet = await rogue.read();
  const statistics = sheet.calculated.derivedStatistics;
  expect(formulaWarnings(sheet)).toEqual([]);
  // "Bonuses gained from multiple classes stack": each class's Grant lists
  // the sum, floor(3 / 3) + floor(3 / 3).
  expect(conditionalOf(statistics.reflex, keys.trapSense)).toEqual([
    vsTraps(2),
    vsTraps(2),
  ]);
  for (const ac of ['ac', 'touchAc', 'cmd'] as const)
    expect(conditionalOf(statistics[ac], keys.trapSense), ac).toEqual([
      vsTraps(2, 'dodge'),
      vsTraps(2, 'dodge'),
    ]);
  expect(conditionalOf(statistics.flatFootedAc, keys.trapSense)).toEqual([]);
  for (const save of ['fortitude', 'will'] as const)
    expect(conditionalOf(statistics[save], keys.trapSense), save).toEqual([]);
  const base = totals(sheet.calculated);
  expect(
    statistics.reflex.applied.some(({ source }) => source === keys.trapSense),
  ).toBe(false);
  const grants = localSituations(
    statistics.reflex,
    keys.trapSense,
    'vs. traps',
  );
  expect(grants).toHaveLength(2);
  const againstTraps = {
    ...base,
    reflex: base.reflex + 2,
    ac: base.ac + 2,
    touchAc: base.touchAc + 2,
    cmd: base.cmd + 2,
  };
  // Either Grant's Situation, or both: one Source, so +2, never +4.
  expect(totals(resolved(sheet, grants.slice(0, 1)))).toEqual(againstTraps);
  expect(totals(resolved(sheet, grants.slice(1)))).toEqual(againstTraps);
  expect(totals(resolved(sheet, grants))).toEqual(againstTraps);
  // A local Situation named alike on another entry matches nothing.
  expect(
    totals(
      resolved(sheet, [{ local: 'vs. traps', sheetEntryId: 'another-entry' }]),
    ),
  ).toEqual(base);
});

test('Poison Resistance takes the higher of a released Alchemist and Investigator, capped at +6', async () => {
  const { character } = await fixture();
  const poison = (value: number) => ({
    value,
    bonusType: 'untyped',
    situation: 'poison',
  });
  // One Grant each: only the Alchemist lists the feature.
  const onSaves = async (sheet: Sheet, bonus: number, label: string) => {
    expect(formulaWarnings(sheet), label).toEqual([]);
    const { derivedStatistics: statistics } = sheet.calculated;
    for (const save of ['fortitude', 'reflex', 'will'] as const)
      expect(
        conditionalOf(statistics[save], keys.poisonResistance),
        `${label} ${save}`,
      ).toEqual([poison(bonus)]);
    const base = totals(sheet.calculated);
    expect(totals(resolved(sheet, ['poison'])), label).toEqual({
      ...base,
      fortitude: base.fortitude + bonus,
      reflex: base.reflex + bonus,
      will: base.will + bonus,
    });
  };
  const alchemist = await character(repeat('alchemist', 5));
  // APG p. 31: +4 at 5th.
  await onSaves(await alchemist.read(), 4, 'Alchemist 5');
  // Alchemist 5 / Investigator 3: max(5, 3) gives +4; the sum, 8, would give +6.
  for (const className of repeat('investigator', 3))
    await alchemist.add(className);
  await onSaves(await alchemist.read(), 4, 'Alchemist 5 / Investigator 3');
  // Alchemist 8: +6; Alchemist 20 stays +6 (the formula alone would give +14).
  const capped = await character(repeat('alchemist', 8));
  await onSaves(await capped.read(), 6, 'Alchemist 8');
  for (const className of repeat('alchemist', 12)) await capped.add(className);
  await onSaves(await capped.read(), 6, 'Alchemist 20');
});

/** One weapon's first single-attack line. */
function line(calculated: Calculated, weaponEntryId: string) {
  const found = calculated.attackRoutines.find(
    (routine) => routine.weaponEntryId === weaponEntryId,
  )?.single[0];
  if (!found) throw new Error(`Missing a routine for ${weaponEntryId}`);
  return found;
}
const studiedSkills = studiedTargets.filter((target) =>
  target.startsWith('skill.'),
);

test('Studied Target on a released Slayer reaches every listed skill and the melee and ranged routine lines against the studied target, with a non-zero slayer value', async () => {
  const { character, member, id } = await fixture();
  const slayer = await character(['slayer']);
  const select = (key: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...slayer.scope,
      catalogEntryId: id(key),
      operationId: `select-${key}`,
    });
  const sword = await select(keys.sword);
  const bow = await select(keys.bow);
  const skills = (calculated: Calculated) =>
    Object.fromEntries(
      studiedSkills.map((target) => [
        target,
        calculated.breakdowns[target].total,
      ]),
    );
  const lines = (calculated: Calculated) => ({
    swordAttack: line(calculated, sword).attackBonus.total,
    swordDamage: line(calculated, sword).damageBonus.total,
    bowAttack: line(calculated, bow).attackBonus.total,
    bowDamage: line(calculated, bow).damageBonus.total,
  });
  const plus = (values: Record<string, number>, bonus: number) =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value + bonus]),
    );
  const check = async (bonus: number, label: string) => {
    const sheet = await slayer.read();
    const { breakdowns } = sheet.calculated;
    expect(formulaWarnings(sheet), label).toEqual([]);
    const listed = [{ value: bonus, bonusType: 'untyped', situation: studied }];
    // Bluff, every Knowledge, Perception, Sense Motive and Survival, and
    // melee and ranged attack and damage, each listed once.
    for (const target of studiedTargets)
      expect(
        conditionalOf(breakdowns[target], keys.studiedTarget),
        `${label} ${target}`,
      ).toEqual(listed);
    for (const weapon of [sword, bow]) {
      expect(
        conditionalOf(
          line(sheet.calculated, weapon).attackBonus,
          keys.studiedTarget,
        ),
        label,
      ).toEqual(listed);
      expect(
        conditionalOf(
          line(sheet.calculated, weapon).damageBonus,
          keys.studiedTarget,
        ),
        label,
      ).toEqual(listed);
    }
    const situations = localSituations(
      breakdowns['skill.per'],
      keys.studiedTarget,
      studied.local,
    );
    expect(situations, label).toHaveLength(1);
    // Out of every total and line; against the studied target, +bonus on
    // each skill and line, and nothing else changes.
    const ordinary = resolved(sheet, []);
    expect(skills(ordinary), label).toEqual(skills(sheet.calculated));
    expect(lines(ordinary), label).toEqual(lines(sheet.calculated));
    const against = resolved(sheet, situations);
    expect(skills(against), label).toEqual(
      plus(skills(sheet.calculated), bonus),
    );
    expect(lines(against), label).toEqual(plus(lines(sheet.calculated), bonus));
    expect(totals(against), label).toEqual(totals(sheet.calculated));
    expect(
      against.breakdowns['skill.dip'].total,
      `${label} Diplomacy is not listed`,
    ).toBe(sheet.calculated.breakdowns['skill.dip'].total);
  };
  // ACG p. 53: +1 at 1st, +1 more at 5th.
  await check(1, 'Slayer 1');
  for (const className of repeat('slayer', 4)) await slayer.add(className);
  await check(2, 'Slayer 5');
});

test('deleting the granting Class Level makes Bravery dormant and removes its contribution, an Archetype replacing it removes it too, and only members read it', async () => {
  const { character, member, owner, outsider, id } = await fixture();
  const fighter = await character(['fighter', 'fighter']);
  const bravery = async (viewer?: Viewer) => {
    const sheet = await fighter.read(viewer);
    const row = sheet.calculated.resolvedEntries.find(
      ({ entry }) =>
        entry.kind === 'classFeature' &&
        entry.catalogEntryId === id(keys.bravery),
    );
    const { will } = sheet.calculated.derivedStatistics;
    return {
      counting: row?.counting ?? false,
      dormant: row?.dormant ?? null,
      reason: row?.reason?.kind ?? null,
      listed: conditionalOf(will, keys.bravery).map(({ value }) => value),
      inFear: totals(resolved(sheet, ['fear'])).will - will.total,
    };
  };
  // A member's note records the Grant, so it is kept while dormant.
  await member.mutation(api.characterSheet.editGrantState, {
    ...fighter.scope,
    grantKey: { source: keys.fighter, classLevel: 2, entry: keys.bravery },
    state: { notes: 'Table note' },
    operationId: 'grant-note',
  });
  const granted = {
    counting: true,
    dormant: false,
    reason: null,
    listed: [1],
    inFear: 1,
  };
  expect(await bravery()).toEqual(granted);
  // Another member's read and the owner's match.
  expect(await bravery(owner)).toEqual(granted);

  const second = (await fighter.read()).entries.filter(
    (entry) => entry.kind === 'classLevel',
  )[1];
  if (!second) throw new Error('Missing second Class Level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    ...fighter.scope,
    entryId: second._id,
    operationId: 'delete-level',
  });
  expect(await bravery()).toEqual({
    counting: false,
    dormant: true,
    reason: 'sourceMissing',
    listed: [],
    inFear: 0,
  });
  await fighter.add('fighter');
  expect(await bravery()).toEqual(granted);

  const archetype = (selected: boolean) =>
    member.mutation(api.characterSheet.setArchetypeSelected, {
      ...fighter.scope,
      classEntryId: id(keys.fighter),
      catalogEntryId: id(keys.archetype),
      selected,
      operationId: `archetype-${String(selected)}`,
    });
  await archetype(true);
  expect(await bravery()).toEqual({
    counting: false,
    dormant: true,
    reason: 'replaced',
    listed: [],
    inFear: 0,
  });
  await archetype(false);
  expect(await bravery()).toEqual(granted);

  await expect(
    outsider.query(api.characterSheet.read, fighter.scope),
  ).rejects.toThrow('You do not have access to this org');
  await expect(
    outsider.mutation(api.characterSheet.setArchetypeSelected, {
      ...fighter.scope,
      classEntryId: id(keys.fighter),
      catalogEntryId: id(keys.archetype),
      selected: true,
      operationId: 'outsider-archetype',
    }),
  ).rejects.toThrow('You do not have access to this org');
});
