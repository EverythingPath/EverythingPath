// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import {
  calculateCharacterSheet,
  type ResolvedStatistic,
} from '../src/lib/character-sheet';
import type { RequestedSituation } from '../src/lib/character-sheet-situations';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

const modules = import.meta.glob('./**/*.ts');

// The Source-body family's public proof (`scripts/catalog/launch-source-body.ts`):
// each output kind a reviewed body is delivered by, as the importer emits it,
// reaches the saved sheet through a Catalog Release, the app's candidate
// conversion and public reads and writes. Situational Modifiers on saves, AC
// (dodge), CMD, skills, caster level, concentration, attack and ranged attack
// and damage stay out of every total and are listed in `conditional` with
// their Situation; the read's own Situations apply them, as the client does;
// situational notes reach the entry or their statistic; counting as another
// race meets a race prerequisite; and two favored classes are allowed. The
// bodies are a synthetic fixture shaped as the imported rows they name: one
// race whose standard traits carry the racial outputs, two alternates, four
// feats, two classes and two weapons.
const race = 'pf1/sourceBodyProofRace';
const countedRace = 'pf1/sourceBodyProofCountedRace';
const traits = {
  // `ac` +4 dodge in `giants`, and its description note (Defensive Training).
  defensive: 'pf1-content/sourceBodyProofDefensive',
  // `saves` +2 racial in `poison`, `spells` and `spellLike` (Hardy).
  hardy: 'pf1-content/sourceBodyProofHardy',
  // `saves` +2 racial in `enchantment`, and an untargeted note (Elven
  // Immunities).
  immunities: 'pf1-content/sourceBodyProofImmunities',
  // `saves` +2 racial in `fear`, marked to stack within its entry (Fearless).
  fearless: 'pf1-content/sourceBodyProofFearless',
  // `saves` +1 racial, unconditional (Halfling Luck, beside Fearless).
  luck: 'pf1-content/sourceBodyProofLuck',
  // `cmd` +4 racial in `bullRushGround` and `tripGround` (Stability).
  stability: 'pf1-content/sourceBodyProofStability',
  // `skill.apr` +2 racial in a local Situation (Greed).
  greed: 'pf1-content/sourceBodyProofGreed',
  // `skill.per` +2 untyped in a local Situation, and an untargeted note
  // (Stonecunning).
  stonecunning: 'pf1-content/sourceBodyProofStonecunning',
  // `skill.spl` +2 racial in `identifyMagicItems` and `casterLevel` +2
  // racial in `spellResistance` (Elven Magic).
  magic: 'pf1-content/sourceBodyProofMagic',
  // `attack` +1 racial in two local Situations (Hatred).
  hatred: 'pf1-content/sourceBodyProofHatred',
  // A note on `saves` in `fear`: a targeted situational note.
  wary: 'pf1-content/sourceBodyProofWary',
  // `countsAsRaces` (Elf Blood).
  blood: 'pf1-content/sourceBodyProofBlood',
  // `favoredClassCount: 2` (Multitalented).
  multitalented: 'pf1-content/sourceBodyProofMultitalented',
} as const;
const alternates = {
  // Replaces the counting trait (as Dual Minded replaces Elf Blood).
  lineage: 'pf1-content/sourceBodyProofLineage',
  // Replaces the favored-class trait (as Arcane Training replaces
  // Multitalented).
  training: 'pf1-content/sourceBodyProofTraining',
} as const;
const feats = {
  // `concentration` +4 untyped in a local Situation (Combat Casting).
  casting: 'pf1/sourceBodyProofCasting',
  // `casterLevel` +2 untyped in `spellResistance` (Spell Penetration).
  penetration: 'pf1/sourceBodyProofPenetration',
  // `attack.ranged` and `damage.ranged` +1 untyped in `within30ft`
  // (Point-Blank Shot).
  pointBlank: 'pf1/sourceBodyProofPointBlank',
  // A feat whose one clause is the counted race.
  counted: 'pf1/sourceBodyProofCounted',
} as const;
const classes = {
  first: 'pf1/sourceBodyProofFirstClass',
  second: 'pf1/sourceBodyProofSecondClass',
} as const;
const weapons = {
  melee: 'pf1/sourceBodyProofSword',
  ranged: 'pf1/sourceBodyProofBow',
} as const;

const local = {
  greed:
    'to determine the price of nonmagical goods containing precious metals or gemstones',
  stonework: 'to notice unusual stonework',
  orcs: 'vs. humanoids of the orc subtype',
  goblinoids: 'vs. humanoids of the goblinoid subtype',
  casting: 'casting defensively or while grappled',
};
const sleepNote = 'Immune to magic sleep effects.';
const stoneNote =
  'Receive a Perception check to notice unusual stonework whenever passing within 10 feet, even without actively looking.';
const fearNote = 'Reroll one failed save against fear each day.';

type Situation = string | { local: string };
type Modifier = {
  target: string;
  bonusType: string;
  value: number;
  condition?: { situation: Situation };
  stacksWithinEntry?: true;
};
type Note = { text: string; target?: string; situation?: Situation };
type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  modifiers?: Modifier[];
  situationalNotes?: Note[];
  countsAsRaces?: string[];
  prerequisites?: unknown[];
  prerequisiteText?: string;
};
const body = ({ externalKey, modifiers = [], ...rest }: Body) => ({
  externalKey,
  upstreamKey: externalKey,
  description: `${rest.name}.`,
  sources: [{ book: 'PZO1110', pages: '1' }],
  modifiers,
  unsupported: [],
  ...rest,
});
/** A Situational Modifier: `<target> <bonus type> <value>` in a Situation. */
const situational = (
  [target, bonusType, value]: [string, string, number],
  situation: Situation,
): Modifier => ({ target, bonusType, value, condition: { situation } });
const racialTrait = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'pack' | 'detail'> & {
    detail?: Record<string, unknown>;
  } = {},
) =>
  body({
    externalKey,
    name,
    pack: 'racial-traits',
    ...change,
    detail: {
      kind: 'racialTrait',
      bonusSkillRanksPerLevel: 0,
      raceKeys: [race],
      standard: true,
      ...change.detail,
    },
  });
const alternate = (externalKey: string, name: string, replaced: string) =>
  racialTrait(externalKey, name, {
    detail: { standard: false, replaces: [replaced] },
  });
const feat = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'pack' | 'detail'> = {},
) =>
  body({
    externalKey,
    name,
    pack: 'feats',
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
    ...change,
  });
const classBody = (externalKey: string, name: string, tag: string) =>
  body({
    externalKey,
    name,
    pack: 'classes',
    detail: {
      kind: 'class',
      tag,
      classKind: 'base',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      classSkills: [],
      skillRanksPerLevel: 2,
      featuresByLevel: [],
      picksByLevel: [],
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

const bodies = [
  body({
    externalKey: race,
    name: 'Source Body Proof Race',
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: Object.values(traits),
      size: 'medium',
    },
  }),
  body({
    externalKey: countedRace,
    name: 'Source Body Counted Race',
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: [],
      size: 'medium',
    },
  }),
  racialTrait(traits.defensive, 'Proof Defensive Training', {
    modifiers: [situational(['ac', 'dodge', 4], 'giants')],
    situationalNotes: [
      { text: 'Proof dwarves get a +4 dodge bonus to AC against giants.' },
    ],
  }),
  racialTrait(traits.hardy, 'Proof Hardy', {
    modifiers: ['poison', 'spells', 'spellLike'].map((situation) =>
      situational(['saves', 'racial', 2], situation),
    ),
  }),
  racialTrait(traits.immunities, 'Proof Immunities', {
    modifiers: [situational(['saves', 'racial', 2], 'enchantment')],
    situationalNotes: [{ text: sleepNote }],
  }),
  racialTrait(traits.fearless, 'Proof Fearless', {
    modifiers: [
      {
        ...situational(['saves', 'racial', 2], 'fear'),
        stacksWithinEntry: true,
      },
    ],
  }),
  racialTrait(traits.luck, 'Proof Luck', {
    modifiers: [{ target: 'saves', bonusType: 'racial', value: 1 }],
  }),
  racialTrait(traits.stability, 'Proof Stability', {
    modifiers: ['bullRushGround', 'tripGround'].map((situation) =>
      situational(['cmd', 'racial', 4], situation),
    ),
  }),
  racialTrait(traits.greed, 'Proof Greed', {
    modifiers: [
      situational(['skill.apr', 'racial', 2], { local: local.greed }),
    ],
  }),
  racialTrait(traits.stonecunning, 'Proof Stonecunning', {
    modifiers: [
      situational(['skill.per', 'untyped', 2], { local: local.stonework }),
    ],
    situationalNotes: [{ text: stoneNote }],
  }),
  racialTrait(traits.magic, 'Proof Magic', {
    modifiers: [
      situational(['skill.spl', 'racial', 2], 'identifyMagicItems'),
      situational(['casterLevel', 'racial', 2], 'spellResistance'),
    ],
  }),
  racialTrait(traits.hatred, 'Proof Hatred', {
    modifiers: [
      situational(['attack', 'racial', 1], { local: local.orcs }),
      situational(['attack', 'racial', 1], { local: local.goblinoids }),
    ],
  }),
  racialTrait(traits.wary, 'Proof Wary', {
    situationalNotes: [{ target: 'saves', situation: 'fear', text: fearNote }],
  }),
  racialTrait(traits.blood, 'Proof Blood', { countsAsRaces: [countedRace] }),
  racialTrait(traits.multitalented, 'Proof Multitalented', {
    detail: { favoredClassCount: 2 },
  }),
  alternate(alternates.lineage, 'Proof Lineage', traits.blood),
  alternate(alternates.training, 'Proof Training', traits.multitalented),
  feat(feats.casting, 'Proof Casting', {
    modifiers: [
      situational(['concentration', 'untyped', 4], { local: local.casting }),
    ],
  }),
  feat(feats.penetration, 'Proof Penetration', {
    modifiers: [situational(['casterLevel', 'untyped', 2], 'spellResistance')],
  }),
  feat(feats.pointBlank, 'Proof Point-Blank', {
    modifiers: [
      situational(['attack.ranged', 'untyped', 1], 'within30ft'),
      situational(['damage.ranged', 'untyped', 1], 'within30ft'),
    ],
  }),
  feat(feats.counted, 'Proof Counted', {
    prerequisiteText: 'Source Body Counted Race',
    prerequisites: [{ race: [countedRace], kind: 'race' }],
  }),
  classBody(classes.first, 'Proof First Class', 'sourceBodyProofFirst'),
  classBody(classes.second, 'Proof Second Class', 'sourceBodyProofSecond'),
  weapon(weapons.melee, 'Proof Sword', {
    baseType: 'Longsword',
    groups: ['bladesHeavy'],
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['slashing'],
    strengthDamage: 'melee',
  }),
  weapon(weapons.ranged, 'Proof Bow', {
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

/**
 * Inserts the stored identity a body starts from, before the release: the
 * stored class is a half-BAB class, so its full BAB comes from the release.
 */
function insertIdentity(
  ctx: MutationCtx,
  { externalKey, name, detail }: (typeof bodies)[number],
) {
  const identity = {
    scope: 'global' as const,
    name,
    ruleIdentity: externalKey,
    modifiers: [],
    sources: [],
    stacksWithItself: false,
  };
  switch (detail.kind) {
    case 'race':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'race', racialHitDice: 0, racialTraits: [] },
      });
    case 'racialTrait':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
      });
    case 'feat':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'feat' },
      });
    case 'item':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'item', consumable: false },
      });
    default:
      return ctx.db.insert('catalogEntry', {
        ...identity,
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
        },
      });
  }
}

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion (as `characterSheetModifiers.integration.test.ts` installs
 * them), and a Character of one level in each class with every score 10,
 * the race chosen and both weapons carried.
 */
async function fixture() {
  const { t, owner, outsider, scope } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids: Record<string, Id<'catalogEntry'>> = await t.run(async (ctx) => {
    const ids: Record<string, Id<'catalogEntry'>> = {};
    for (const entry of bodies)
      ids[entry.externalKey] = await insertIdentity(ctx, entry);
    return ids;
  });
  await prepare(
    t,
    bodies.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    for (const id of Object.values(ids)) {
      const stored = await ctx.db.get('catalogEntry', id);
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });
  const id = (key: string) => {
    const found = ids[key];
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  const read = async (viewer = owner) => {
    const sheet = withSheetCatalog(
      await viewer.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  };
  const first = (await read()).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!first) throw new Error('Missing first Class Level');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: id(classes.first),
    operationId: 'level-1',
  });
  const second = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: id(classes.second),
    operationId: 'level-2',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
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
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(race),
    operationId: 'race',
  });
  const select = (key: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `select-${key}`,
    });
  const sword = await select(weapons.melee);
  const bow = await select(weapons.ranged);
  return {
    owner,
    member,
    outsider,
    scope,
    id,
    read,
    select,
    levels: [first._id, second],
    sword,
    bow,
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
type Sheet = Awaited<ReturnType<Fixture['read']>>;
type Statistic = Pick<ResolvedStatistic, 'total' | 'conditional'>;

/** A source's conditional contributions to a statistic, with their Situations. */
function conditionalOf(statistic: Statistic, key: string) {
  return statistic.conditional
    .filter((row) => row.source === key)
    .map(({ value, bonusType, condition }) => ({
      value,
      bonusType,
      situation: condition?.situation,
    }));
}

/**
 * Every Situation the read lists in `conditional`, as the client requests
 * it: a shared key as it is, a local one with its sheet entry.
 */
function listedSituations(sheet: Sheet): RequestedSituation[] {
  const { breakdowns, derivedStatistics, attackRoutines } = sheet.calculated;
  const statistics: Statistic[] = [
    ...Object.values(breakdowns),
    ...Object.values(derivedStatistics),
    ...attackRoutines.flatMap((routine) =>
      routine.single.flatMap((line) => [line.attackBonus, line.damageBonus]),
    ),
  ];
  const found = new Map<string, RequestedSituation>();
  for (const { conditional } of statistics)
    for (const { condition, sheetEntryId } of conditional) {
      const situation = condition?.situation;
      if (typeof situation === 'string') found.set(situation, situation);
      else if (situation && 'local' in situation)
        found.set(`${sheetEntryId}:${situation.local}`, {
          local: situation.local,
          sheetEntryId,
        });
    }
  return [...found.values()];
}

/** The sheet as if these Situations held, from one read's own data. */
function resolved(sheet: Sheet, situations: readonly RequestedSituation[]) {
  return calculateCharacterSheet(
    { ...sheet, characterKind: sheet.character.kind },
    { situations: [...situations] },
  );
}
type Calculated = ReturnType<typeof resolved> | Sheet['calculated'];

/** The totals the family's situational Modifiers reach. */
function totals(calculated: Calculated) {
  const { breakdowns, derivedStatistics: statistics } = calculated;
  return {
    fortitude: statistics.fortitude.total,
    reflex: statistics.reflex.total,
    will: statistics.will.total,
    ac: statistics.ac.total,
    touchAc: statistics.touchAc.total,
    flatFootedAc: statistics.flatFootedAc.total,
    cmd: statistics.cmd.total,
    appraise: breakdowns['skill.apr'].total,
    perception: breakdowns['skill.per'].total,
    spellcraft: breakdowns['skill.spl'].total,
    casterLevel: breakdowns.casterLevel.total,
    concentration: breakdowns.concentration.total,
  };
}

/** One weapon's first single-attack line. */
function line(calculated: Calculated, weaponEntryId: string) {
  const found = calculated.attackRoutines.find(
    (routine) => routine.weaponEntryId === weaponEntryId,
  )?.single[0];
  if (!found) throw new Error(`Missing a routine for ${weaponEntryId}`);
  return found;
}

/** The requested Situation a source's local Situation is, on this read. */
function localSituation(
  statistic: Statistic,
  key: string,
  name: string,
): RequestedSituation {
  const row = statistic.conditional.find(
    ({ source, condition }) =>
      source === key &&
      typeof condition?.situation === 'object' &&
      'local' in condition.situation &&
      condition.situation.local === name,
  );
  if (!row) throw new Error(`Missing the local Situation ${name}`);
  return { local: name, sheetEntryId: row.sheetEntryId };
}

test('situational Modifiers stay out of every total and are listed in conditional with their Situation', async () => {
  const { read, select } = await fixture();
  const raced = await read();
  for (const key of [feats.casting, feats.penetration, feats.pointBlank])
    await select(key);
  const sheet = await read();
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  // Only the unconditional +1 racial on saves enters a total, and the feats
  // change none.
  expect(totals(sheet.calculated)).toEqual(totals(raced.calculated));
  expect(
    statistics.will.applied
      .filter(({ source }) => source?.startsWith('pf1'))
      .map(({ source, value }) => [source, value]),
  ).toEqual([[traits.luck, 1]]);
  for (const save of ['fortitude', 'reflex', 'will'] as const) {
    expect(conditionalOf(statistics[save], traits.hardy), save).toEqual(
      ['poison', 'spells', 'spellLike'].map((situation) => ({
        value: 2,
        bonusType: 'racial',
        situation,
      })),
    );
    expect(conditionalOf(statistics[save], traits.immunities)).toEqual([
      { value: 2, bonusType: 'racial', situation: 'enchantment' },
    ]);
    expect(conditionalOf(statistics[save], traits.fearless)).toEqual([
      { value: 2, bonusType: 'racial', situation: 'fear' },
    ]);
  }
  // The dodge bonus is listed on AC, touch AC and CMD, never flat-footed AC.
  const giants = [{ value: 4, bonusType: 'dodge', situation: 'giants' }];
  expect(conditionalOf(statistics.ac, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.touchAc, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.cmd, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.flatFootedAc, traits.defensive)).toEqual([]);
  expect(conditionalOf(statistics.cmd, traits.stability)).toEqual(
    ['bullRushGround', 'tripGround'].map((situation) => ({
      value: 4,
      bonusType: 'racial',
      situation,
    })),
  );
  expect(conditionalOf(breakdowns['skill.apr'], traits.greed)).toEqual([
    { value: 2, bonusType: 'racial', situation: { local: local.greed } },
  ]);
  expect(conditionalOf(breakdowns['skill.per'], traits.stonecunning)).toEqual([
    { value: 2, bonusType: 'untyped', situation: { local: local.stonework } },
  ]);
  expect(conditionalOf(breakdowns['skill.spl'], traits.magic)).toEqual([
    { value: 2, bonusType: 'racial', situation: 'identifyMagicItems' },
  ]);
  expect(conditionalOf(breakdowns.casterLevel, traits.magic)).toEqual([
    { value: 2, bonusType: 'racial', situation: 'spellResistance' },
  ]);
  expect(conditionalOf(breakdowns.casterLevel, feats.penetration)).toEqual([
    { value: 2, bonusType: 'untyped', situation: 'spellResistance' },
  ]);
  expect(conditionalOf(breakdowns.concentration, feats.casting)).toEqual([
    { value: 4, bonusType: 'untyped', situation: { local: local.casting } },
  ]);
  const hatred = [local.orcs, local.goblinoids].map((name) => ({
    value: 1,
    bonusType: 'racial',
    situation: { local: name },
  }));
  expect(conditionalOf(breakdowns['attack.melee'], traits.hatred)).toEqual(
    hatred,
  );
  expect(conditionalOf(breakdowns['attack.ranged'], traits.hatred)).toEqual(
    hatred,
  );
  const within = [{ value: 1, bonusType: 'untyped', situation: 'within30ft' }];
  expect(conditionalOf(breakdowns['attack.ranged'], feats.pointBlank)).toEqual(
    within,
  );
  expect(conditionalOf(breakdowns['damage.ranged'], feats.pointBlank)).toEqual(
    within,
  );
  expect(conditionalOf(breakdowns['attack.melee'], feats.pointBlank)).toEqual(
    [],
  );
  expect(conditionalOf(breakdowns['damage.melee'], feats.pointBlank)).toEqual(
    [],
  );
});

test('the read’s own Situations apply them: AC reaches touch AC and CMD, one entry’s Situations never stack, separate traits do, and caster level rises only against spell resistance', async () => {
  const { read, select } = await fixture();
  for (const key of [feats.casting, feats.penetration]) await select(key);
  const sheet = await read();
  const base = totals(sheet.calculated);
  const { breakdowns } = sheet.calculated;
  const under = (...situations: RequestedSituation[]) =>
    totals(resolved(sheet, situations));
  // The listed Situations, and nothing applies with none of them.
  expect(listedSituations(sheet)).toEqual(
    expect.arrayContaining([
      'giants',
      'poison',
      'spells',
      'spellLike',
      'enchantment',
      'fear',
      'bullRushGround',
      'tripGround',
      'identifyMagicItems',
      'spellResistance',
    ]),
  );
  expect(under()).toEqual(base);
  // +4 dodge against giants: AC, touch AC and CMD, never flat-footed AC.
  expect(under('giants')).toEqual({
    ...base,
    ac: base.ac + 4,
    touchAc: base.touchAc + 4,
    cmd: base.cmd + 4,
  });
  // One entry's Situations: +2 against poison, and still +2 against a
  // poisonous spell.
  const saves = (change: number) => ({
    fortitude: base.fortitude + change,
    reflex: base.reflex + change,
    will: base.will + change,
  });
  expect(under('poison')).toEqual({ ...base, ...saves(2) });
  expect(under('poison', 'spells', 'spellLike')).toEqual({
    ...base,
    ...saves(2),
  });
  expect(under('enchantment')).toEqual({ ...base, ...saves(2) });
  // Separate traits stack: Fearless's +2 against fear beside the
  // unconditional +1 already in the total, +3 in all, and Hardy's +2
  // against a frightening poison.
  expect(under('fear')).toEqual({ ...base, ...saves(2) });
  const racialOn = (calculated: Calculated) =>
    calculated.derivedStatistics.will.applied
      .filter(({ bonusType }) => bonusType === 'racial')
      .map(({ source, value }) => [source, value]);
  expect(racialOn(sheet.calculated)).toEqual([[traits.luck, 1]]);
  expect(racialOn(resolved(sheet, ['fear'])).sort()).toEqual(
    [
      [traits.luck, 1],
      [traits.fearless, 2],
    ].sort(),
  );
  expect(under('fear', 'poison')).toEqual({ ...base, ...saves(4) });
  // +4 CMD in either ground Situation, and +4 with both.
  expect(under('bullRushGround')).toEqual({ ...base, cmd: base.cmd + 4 });
  expect(under('tripGround')).toEqual({ ...base, cmd: base.cmd + 4 });
  expect(under('bullRushGround', 'tripGround')).toEqual({
    ...base,
    cmd: base.cmd + 4,
  });
  expect(under('giants', 'tripGround')).toEqual({
    ...base,
    ac: base.ac + 4,
    touchAc: base.touchAc + 4,
    cmd: base.cmd + 8,
  });
  // Skills, each in its own Situation, local ones with their entry.
  expect(
    under(localSituation(breakdowns['skill.apr'], traits.greed, local.greed)),
  ).toEqual({ ...base, appraise: base.appraise + 2 });
  expect(
    under(
      localSituation(
        breakdowns['skill.per'],
        traits.stonecunning,
        local.stonework,
      ),
    ),
  ).toEqual({ ...base, perception: base.perception + 2 });
  expect(under('identifyMagicItems')).toEqual({
    ...base,
    spellcraft: base.spellcraft + 2,
  });
  // A local Situation named alike on another entry matches nothing.
  expect(under({ local: local.greed, sheetEntryId: 'another-entry' })).toEqual(
    base,
  );
  // Caster level: +2 racial and +2 untyped stack, against spell resistance
  // only; the ordinary caster level is unchanged, in any other Situation.
  expect(under('spellResistance')).toEqual({
    ...base,
    casterLevel: base.casterLevel + 4,
  });
  expect(under('spells', 'identifyMagicItems').casterLevel).toBe(
    base.casterLevel,
  );
  expect(
    under(
      localSituation(breakdowns.concentration, feats.casting, local.casting),
    ),
  ).toEqual({ ...base, concentration: base.concentration + 4 });
});

test('routine lines carry the attack and ranged Modifiers in their Situations', async () => {
  const { read, select, sword, bow } = await fixture();
  await select(feats.pointBlank);
  const sheet = await read();
  const { breakdowns } = sheet.calculated;
  const lines = (situations: RequestedSituation[]) => {
    const calculated = resolved(sheet, situations);
    return {
      swordAttack: line(calculated, sword).attackBonus.total,
      swordDamage: line(calculated, sword).damageBonus.total,
      bowAttack: line(calculated, bow).attackBonus.total,
      bowDamage: line(calculated, bow).damageBonus.total,
    };
  };
  const base = lines([]);
  expect({
    swordAttack: line(sheet.calculated, sword).attackBonus.total,
    swordDamage: line(sheet.calculated, sword).damageBonus.total,
    bowAttack: line(sheet.calculated, bow).attackBonus.total,
    bowDamage: line(sheet.calculated, bow).damageBonus.total,
  }).toEqual(base);
  // Each line lists its Modifiers in their Situations.
  const hatred = [local.orcs, local.goblinoids].map((name) => ({
    value: 1,
    bonusType: 'racial',
    situation: { local: name },
  }));
  const within = [{ value: 1, bonusType: 'untyped', situation: 'within30ft' }];
  expect(
    conditionalOf(line(sheet.calculated, sword).attackBonus, traits.hatred),
  ).toEqual(hatred);
  expect(
    conditionalOf(line(sheet.calculated, bow).attackBonus, traits.hatred),
  ).toEqual(hatred);
  expect(
    conditionalOf(line(sheet.calculated, bow).attackBonus, feats.pointBlank),
  ).toEqual(within);
  expect(
    conditionalOf(line(sheet.calculated, bow).damageBonus, feats.pointBlank),
  ).toEqual(within);
  expect(
    conditionalOf(line(sheet.calculated, sword).attackBonus, feats.pointBlank),
  ).toEqual([]);
  // Against an orc: +1 on every line's attack; two of the entry's
  // Situations together are still +1.
  const orcs = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.orcs,
  );
  const goblinoids = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.goblinoids,
  );
  expect(lines([orcs])).toEqual({
    ...base,
    swordAttack: base.swordAttack + 1,
    bowAttack: base.bowAttack + 1,
  });
  expect(lines([orcs, goblinoids])).toEqual(lines([orcs]));
  // Within 30 feet: +1 attack and +1 damage on ranged lines only.
  expect(lines(['within30ft'])).toEqual({
    ...base,
    bowAttack: base.bowAttack + 1,
    bowDamage: base.bowDamage + 1,
  });
  expect(lines(['within30ft', orcs])).toEqual({
    ...base,
    swordAttack: base.swordAttack + 1,
    bowAttack: base.bowAttack + 2,
    bowDamage: base.bowDamage + 1,
  });
});

test('untargeted notes reach the entry and a targeted note its statistic, changing no number', async () => {
  const { read } = await fixture();
  const sheet = await read();
  const { entryNotes, derivedStatistics, breakdowns } = sheet.calculated;
  expect(
    entryNotes
      .filter(({ text }) => [sleepNote, stoneNote].includes(text))
      .map(({ source, text }) => [source, text]),
  ).toEqual([
    [traits.immunities, sleepNote],
    [traits.stonecunning, stoneNote],
  ]);
  expect(entryNotes.some(({ text }) => text === fearNote)).toBe(false);
  for (const save of ['save.fort', 'save.ref', 'save.will'] as const)
    expect(
      (breakdowns[save].notes ?? []).map(({ source, situation, text }) => ({
        source,
        situation,
        text,
      })),
      save,
    ).toEqual([{ source: traits.wary, situation: 'fear', text: fearNote }]);
  expect(totals(resolved(sheet, ['fear'])).will).toBe(
    derivedStatistics.will.total + 2,
  );
});

test('counting as another race meets a race prerequisite only while the trait is active', async () => {
  const { member, scope, read, select, id } = await fixture();
  const counted = await select(feats.counted);
  const met = async () =>
    (await read()).calculated.prerequisites
      .filter((row) => row.entryId === counted && row.view === 'current')
      .map((row) => row.met);
  expect((await read()).calculated.racial.countsAsRaces).toContain(countedRace);
  expect(await met()).toEqual([true]);
  // The alternate replaces the counting trait: the clause is unmet.
  const lineage = (selected: boolean, operationId: string) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: id(alternates.lineage),
      selected,
      operationId,
    });
  await lineage(true, 'lineage');
  expect((await read()).calculated.racial.countsAsRaces).not.toContain(
    countedRace,
  );
  expect(await met()).toEqual([false]);
  expect(
    (await read()).calculated.warnings.filter((warning) =>
      warning.check.startsWith('prerequisites.'),
    ),
  ).not.toEqual([]);
  // Restored, it is met again.
  await lineage(false, 'restore');
  expect(await met()).toEqual([true]);
});

test('two favored classes are allowed only with the trait, and a favored class bonus on either class counts', async () => {
  const { member, scope, read, id, levels } = await fixture();
  const [firstLevel, secondLevel] = levels;
  if (!firstLevel || !secondLevel) throw new Error('Missing Class Levels');
  const checks = (sheet: Sheet) =>
    sheet.calculated.warnings
      .map(({ check }) => check)
      .filter((check) => check.startsWith('favoredClass'))
      .sort();
  const hp = (sheet: Sheet) => sheet.calculated.breakdowns.hp.total;
  const before = await read();
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [id(classes.first), id(classes.second)],
    operationId: 'favored',
  });
  for (const [entryId, operationId] of [
    [firstLevel, 'bonus-1'],
    [secondLevel, 'bonus-2'],
  ] as const)
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId,
      favoredClassBonus: { choice: 'hp' },
      operationId,
    });
  const favored = await read();
  expect(favored.calculated.racial.favoredClassCount).toBe(2);
  // Both levels' +1 HP count, with no count or "not favored" warning.
  expect(checks(favored)).toEqual([]);
  expect(hp(favored)).toBe(hp(before) + 2);
  // The alternate replaces the trait: one favored class only.
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: id(alternates.training),
    selected: true,
    operationId: 'training',
  });
  const single = await read();
  expect(single.calculated.racial.favoredClassCount).toBe(1);
  expect(checks(single)).toContain('favoredClassCount');
});

test('an outsider is refused', async () => {
  const { outsider, scope } = await fixture();
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});
