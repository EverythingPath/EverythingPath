// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { findReviewedClassCasting } from '../src/lib/character-sheet-casting-tables';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// #781: `@classLevel.<tag>` counts a released class's levels by its source
// class tag (Foundry `system.tag`). A released class's rule identity is its
// release key, so the tag must reach its stored definition through the
// Catalog Release's candidate conversion. The classes carry their release
// keys and tags (pf1 418761d2 packs/classes); the three features carry their
// release keys, class levels and curated Modifiers as the importer emits them
// (packs/class-abilities: Bravery CRB p. 55, Trap Sense CRB pp. 31 and 69,
// Poison Resistance APG p. 31 and ACG p. 31). Every read and write the test
// makes is public.
const keys = {
  fighter: 'pf1/WLqBCT5DqmGAx8Wd',
  rogue: 'pf1/24b0LaabeAlUx5gN',
  barbarian: 'pf1/g3pq7xWWdUVYw6ai',
  barbarianUnchained: 'pf1/W3EjUgYLJ1D9qDKw',
  alchemist: 'pf1/JcaqlAawhf14q1lq',
  investigator: 'pf1/s27zdYVFenYBVtfu',
  bravery: 'pf1/h0Brxw6khcjlEf1T',
  trapSense: 'pf1/BoEkMviJrW0PKmhj',
  poisonResistance: 'pf1/2qcz39w9O2Qlms0Q',
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
const feature = (externalKey: string, name: string, modifiers: unknown[]) =>
  body({
    externalKey,
    name,
    pack: 'class-abilities',
    detail: { kind: 'classFeature' },
    modifiers,
  });
const trapSenseFormula =
  'floor(@classLevel.barbarian / 3) + floor(@classLevel.rogue / 3) + floor(@classLevel.investigator / 3)';
const features = [
  feature(keys.bravery, 'Bravery', [
    {
      target: 'save.will',
      bonusType: 'untyped',
      value: { formula: 'floor((@classLevel.fighter + 2) / 4)' },
      condition: { situation: 'fear' },
    },
  ]),
  feature(keys.trapSense, 'Trap Sense', [
    {
      target: 'save.ref',
      bonusType: 'untyped',
      value: { formula: trapSenseFormula },
      condition: { situation: { local: 'vs. traps' } },
    },
    {
      target: 'ac',
      bonusType: 'dodge',
      value: { formula: trapSenseFormula },
      condition: { situation: { local: 'vs. traps' } },
    },
  ]),
  feature(keys.poisonResistance, 'Poison Resistance', [
    {
      target: 'saves',
      bonusType: 'untyped',
      value: {
        formula:
          'min(6, floor((max(@classLevel.alchemist, @classLevel.investigator) + 1) / 3) * 2)',
      },
      condition: { situation: 'poison' },
    },
  ]),
];

const alchemy = {
  type: 'prepared',
  spellKind: 'alchemy',
  casterLevelOffset: 0,
};
/** Each released class: its tag, the features it lists and its casting. */
const classes = {
  fighter: { name: 'Fighter', tag: 'fighter', features: { [keys.bravery]: 2 } },
  rogue: { name: 'Rogue', tag: 'rogue', features: { [keys.trapSense]: 3 } },
  barbarian: {
    name: 'Barbarian',
    tag: 'barbarian',
    features: { [keys.trapSense]: 3 },
  },
  barbarianUnchained: {
    name: 'Barbarian (Unchained)',
    tag: 'barbarianUnchained',
    features: {},
    counterpartOf: 'barbarian' as const,
  },
  alchemist: {
    name: 'Alchemist',
    tag: 'alchemist',
    features: { [keys.poisonResistance]: 2 },
    casting: alchemy,
  },
  investigator: {
    name: 'Investigator',
    tag: 'investigator',
    features: { [keys.poisonResistance]: 2 },
    casting: alchemy,
  },
} satisfies Record<
  string,
  {
    name: string;
    tag: string;
    features: Record<string, number>;
    casting?: Record<string, unknown>;
    counterpartOf?: string;
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
const bodies = [...features, ...classBodies];

type Viewer = Awaited<ReturnType<typeof releaseFixture>>['owner'];
/** One public saved-sheet read with its catalog. */
async function readSheet(
  viewer: Viewer,
  scope: { organizationId: string; characterId: Id<'character'> },
) {
  const sheet = withSheetCatalog(
    await viewer.query(api.characterSheet.read, scope),
  );
  if (!sheet) throw new Error('Missing saved sheet');
  return sheet;
}
type Sheet = Awaited<ReturnType<typeof readSheet>>;

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion, as `characterSheetFeatureGrants.integration.test.ts` installs
 * them: stored identity stubs (a caster's with its reviewed casting, the
 * Unchained Class's naming its original), then each replaced by its release
 * candidate.
 */
async function fixture() {
  const { t, owner, scope, create } = await releaseFixture(modules);
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
    const identity = (externalKey: string, name: string) => ({
      scope: 'global' as const,
      name,
      ruleIdentity: externalKey,
      modifiers: [],
      sources: [],
      stacksWithItself: false,
    });
    for (const { externalKey, name } of features)
      ids.set(
        externalKey,
        await ctx.db.insert('catalogEntry', {
          ...identity(externalKey, name),
          detail: { kind: 'classFeature' },
        }),
      );
    // The original before its Unchained Class, which names it.
    const ordered = Object.entries(classes).sort(
      ([, a], [, b]) =>
        Number('counterpartOf' in a) - Number('counterpartOf' in b),
    );
    for (const [className, value] of ordered) {
      const externalKey = keys[className as ClassName];
      const casting =
        'casting' in value ? findReviewedClassCasting(value.tag) : undefined;
      ids.set(
        externalKey,
        await ctx.db.insert('catalogEntry', {
          ...identity(externalKey, value.name),
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
            ...('counterpartOf' in value
              ? { counterpartOf: id(keys[value.counterpartOf]) }
              : {}),
          },
        }),
      );
    }
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
    for (const { externalKey } of bodies) {
      const stored = await ctx.db.get('catalogEntry', id(externalKey));
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });

  let characters = 0;
  /**
   * A Character whose Class Levels are these released classes in order, the
   * first replacing the initial Class Level, read after each prefix.
   */
  async function character(levels: readonly ClassName[]) {
    characters += 1;
    const characterId =
      characters === 1
        ? scope.characterId
        : await create(`Tagged ${characters}`);
    const own = { organizationId: 'org', characterId };
    const read = () => readSheet(member, own);
    const initial = await readSheet(owner, own);
    const first = initial.entries.find((entry) => entry.kind === 'classLevel');
    if (!first) throw new Error('Missing first Class Level');
    const sheets: Sheet[] = [];
    for (const [index, className] of levels.entries()) {
      const classEntryId = id(keys[className]);
      if (index === 0)
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
          operationId: `level-${index + 1}`,
        });
      sheets.push(await read());
    }
    return sheets;
  }
  return { id, character };
}

type Statistic = 'will' | 'reflex' | 'fortitude';
/**
 * The feature's conditional values on a save, one per Grant: a feature two
 * classes grant is listed under each, with the same Source.
 */
function conditional(sheet: Sheet, statistic: Statistic, featureKey: string) {
  return sheet.calculated.derivedStatistics[statistic].conditional
    .filter(({ source }) => source === featureKey)
    .map(({ value }) => value);
}
function formulaWarnings(sheet: Sheet) {
  return sheet.calculated.warnings.filter(({ check }) =>
    ['unsupportedFormula', 'formulaDependency'].includes(check),
  );
}
const repeat = (className: ClassName, count: number) =>
  Array.from({ length: count }, () => className);

test('the class tag reaches each released class definition, caster or not', async () => {
  const { id, character } = await fixture();
  const sheet = (await character(Object.keys(classes) as ClassName[])).at(-1);
  if (!sheet) throw new Error('Missing sheet');
  for (const [className, { tag }] of Object.entries(classes)) {
    const definition = sheet.catalogEntries.find(
      ({ _id }) => _id === id(keys[className as ClassName]),
    );
    expect(definition?.ruleIdentity).toBe(keys[className as ClassName]);
    expect(definition?.detail).toMatchObject({ kind: 'class', tag });
  }
});

test('Bravery on a released Fighter reads the Fighter level by its tag', async () => {
  const { character } = await fixture();
  const sheets = await character(repeat('fighter', 18));
  const bravery = (level: number) => {
    const sheet = sheets[level - 1];
    if (!sheet) throw new Error(`Missing level ${level}`);
    expect(formulaWarnings(sheet)).toEqual([]);
    return conditional(sheet, 'will', keys.bravery);
  };
  // CRB p. 55: +1 at 2nd, and +1 more for every four levels beyond 2nd.
  expect(bravery(1)).toEqual([]);
  expect(bravery(2)).toEqual([1]);
  expect(bravery(5)).toEqual([1]);
  expect(bravery(6)).toEqual([2]);
  expect(bravery(18)).toEqual([5]);
});

test('Trap Sense sums a released Rogue and Barbarian, and reads an absent tag as 0', async () => {
  const { character } = await fixture();
  const sheets = await character([
    ...repeat('rogue', 3),
    ...repeat('barbarian', 3),
  ]);
  const [rogueOnly, multiclass] = [sheets[2], sheets[5]];
  if (!rogueOnly || !multiclass) throw new Error('Missing sheets');
  // Rogue 3: Barbarian and Investigator are absent tags and read 0.
  expect(conditional(rogueOnly, 'reflex', keys.trapSense)).toEqual([1]);
  // Rogue 3 / Barbarian 3: "bonuses gained from multiple classes stack", so
  // each class's Grant reads the sum, floor(3 / 3) + floor(3 / 3).
  expect(conditional(multiclass, 'reflex', keys.trapSense)).toEqual([2, 2]);
  expect(
    multiclass.calculated.derivedStatistics.ac.conditional
      .filter(({ source }) => source === keys.trapSense)
      .map(({ value, bonusType }) => [bonusType, value]),
  ).toEqual([
    ['dodge', 2],
    ['dodge', 2],
  ]);
  expect(formulaWarnings(multiclass)).toEqual([]);
});

test('Poison Resistance takes the higher of a released Alchemist and Investigator', async () => {
  const { character } = await fixture();
  const sheets = await character([
    ...repeat('alchemist', 5),
    ...repeat('investigator', 3),
  ]);
  const [alchemistOnly, multiclass] = [sheets[4], sheets[7]];
  if (!alchemistOnly || !multiclass) throw new Error('Missing sheets');
  // Alchemist 5 (Investigator absent): +4.
  expect(
    conditional(alchemistOnly, 'fortitude', keys.poisonResistance),
  ).toEqual([4]);
  // Alchemist 5 / Investigator 3: max(5, 3) gives +4; the sum, 8, would give +6.
  for (const save of ['fortitude', 'reflex', 'will'] as const)
    expect(conditional(multiclass, save, keys.poisonResistance)).toEqual([
      4, 4,
    ]);
  expect(formulaWarnings(multiclass)).toEqual([]);
});

test('a released Unchained Class counts under its original class family', async () => {
  const { character } = await fixture();
  const sheets = await character([
    ...repeat('rogue', 3),
    ...repeat('barbarianUnchained', 3),
  ]);
  const multiclass = sheets[5];
  if (!multiclass) throw new Error('Missing sheet');
  // docs/character-sheet/unchained-classes.md: Unchained levels count as
  // levels of the original wherever something counts levels in that class,
  // so Rogue 3 / Barbarian (Unchained) 3 reads @classLevel.barbarian as 3
  // on the Rogue's Trap Sense.
  expect(conditional(multiclass, 'reflex', keys.trapSense)).toEqual([2]);
  expect(formulaWarnings(multiclass)).toEqual([]);
});
