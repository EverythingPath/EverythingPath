// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// The rank-modifiers mechanism family's public proof
// (`scripts/catalog/launch-mechanism-proofs.ts`, #777): a rank-threshold
// change's reviewed output, `L + (H−L) * min(1, floor(@skillRanks.<s> / 10))`
// (#724), reaches its skill's saved-sheet total through a Catalog Release, the
// app's candidate conversion and public reads and writes, for every listed
// skill and both proven thresholds. The bodies are a synthetic fixture shaped
// as imported feats: one Skill-Focus-shaped feat per listed skill (+3, or +6
// with 10 ranks), and skill-pair feats (+2, or +4 with 10 ranks) covering the
// same skills two at a time, as the Core Rulebook's skill-pair feats do.
const listedSkills = [
  'acr',
  'blf',
  'clm',
  'crf',
  'dev',
  'dip',
  'dis',
  'esc',
  'fly',
  'han',
  'hea',
  'int',
  'kar',
  'kdu',
  'khi',
  'kna',
  'kpl',
  'kre',
  'per',
  'rid',
  'sen',
  'slt',
  'spl',
  'ste',
  'sur',
  'swm',
  'umd',
] as const;
type Skill = (typeof listedSkills)[number];
const target = (skill: Skill) => `skill.${skill}` as const;

const focus = (skill: Skill) => `pf1/rankProofFocus-${skill}`;
// Perception and Sense Motive share one feat (Alertness's skills); the rest
// pair in list order, the last on its own.
const others = listedSkills.filter(
  (skill) => skill !== 'per' && skill !== 'sen',
);
const pairs: Skill[][] = [
  ['per', 'sen'],
  ...Array.from({ length: Math.ceil(others.length / 2) }, (_, index) =>
    others.slice(index * 2, index * 2 + 2),
  ),
];
const pairKey = (skills: readonly Skill[]) =>
  `pf1/rankProofPair-${skills.join('-')}`;
const pairOf = (skill: Skill) => {
  const found = pairs.find((skills) => skills.includes(skill));
  if (!found) throw new Error(`No pair feat for ${skill}`);
  return pairKey(found);
};

/** #724's reviewed output for a threshold of `below`, rising by `step` at 10. */
const rankModifier = (skill: Skill, below: number, step: number) => ({
  target: target(skill),
  bonusType: 'untyped',
  value: {
    formula: `${below} + ${step} * min(1, floor(@skillRanks.${skill} / 10))`,
  },
});
function feat(
  externalKey: string,
  name: string,
  modifiers: ReturnType<typeof rankModifier>[],
) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack: 'feats',
    name,
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
    description: `${name}.`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers,
    unsupported: [],
  };
}
const bodies = [
  ...listedSkills.map((skill) =>
    feat(focus(skill), `Rank Proof Focus (${skill})`, [
      rankModifier(skill, 3, 3),
    ]),
  ),
  ...pairs.map((skills) =>
    feat(
      pairKey(skills),
      `Rank Proof Pair (${skills.join(', ')})`,
      skills.map((skill) => rankModifier(skill, 2, 2)),
    ),
  ),
];
const fixtureKeys = new Set(bodies.map(({ externalKey }) => externalKey));

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion (as `characterSheetModifiers.integration.test.ts` installs
 * them), and a Cleric 10 with every score 10.
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
    for (const { externalKey, name } of bodies)
      ids[externalKey] = await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name,
        ruleIdentity: externalKey,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
        detail: { kind: 'feat' },
      });
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
  const initial = await read();
  const first = initial.entries.find((entry) => entry.kind === 'classLevel');
  const cleric = initial.catalogEntries.find(
    (entry) => entry.detail.kind === 'class' && entry.name === 'Cleric',
  );
  if (!first || !cleric) throw new Error('Missing Cleric baseline');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: cleric._id,
    operationId: 'cleric-1',
  });
  for (let index = 2; index <= 10; index += 1)
    await member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: cleric._id,
      operationId: `cleric-${index}`,
    });
  const levels = (await read()).entries
    .filter((entry) => entry.kind === 'classLevel')
    .map((entry) => entry._id);
  expect(levels).toHaveLength(10);
  return { owner, member, outsider, scope, id, read, levels };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
type Sheet = Awaited<ReturnType<Fixture['read']>>;
type Ranks = Record<Skill, number>;
const everySkill = (ranks: number) =>
  Object.fromEntries(listedSkills.map((skill) => [skill, ranks])) as Ranks;

/**
 * Records each skill's ranks across the ten levels through public writes:
 * level i holds floor(n / 10) ranks, plus one while i < n mod 10.
 */
async function recordRanks(
  { member, scope, levels }: Fixture,
  ranks: Ranks,
  label: string,
) {
  for (const [index, entryId] of levels.entries())
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId,
      skillRanks: Object.fromEntries(
        listedSkills.flatMap((skill) => {
          const count =
            Math.floor(ranks[skill] / 10) + (index < ranks[skill] % 10 ? 1 : 0);
          return count ? [[target(skill), count]] : [];
        }),
      ),
      operationId: `${label}-${index}`,
    });
}

/** The applied contributions a definition makes to a breakdown. */
function applied(
  breakdown: { applied: readonly { source?: string; value: number }[] },
  key: string,
) {
  return breakdown.applied
    .filter((row) => row.source === key)
    .map((row) => row.value);
}
/** Each listed skill's total and its fixture feats' applied rows. */
function skillRows({ calculated }: Sheet) {
  return Object.fromEntries(
    listedSkills.map((skill) => {
      const breakdown = calculated.breakdowns[target(skill)];
      return [
        skill,
        {
          total: breakdown.total,
          feats: Object.fromEntries(
            [...fixtureKeys].flatMap((key) => {
              const values = applied(breakdown, key);
              return values.length ? [[key, values]] : [];
            }),
          ),
        },
      ];
    }),
  );
}

/**
 * Each skill's expected row at these ranks: only its own two feats apply to
 * it, each once, +3 or +6 and +2 or +4 from 10 ranks, and the total moves by
 * exactly their sum from its total without them; untyped, they stack.
 */
function expectedRows(ranks: Ranks, base: Ranks | undefined) {
  return Object.fromEntries(
    listedSkills.map((skill) => {
      const reached = ranks[skill] >= 10;
      const focused = reached ? 6 : 3;
      const paired = reached ? 4 : 2;
      return [
        skill,
        {
          total: (base?.[skill] ?? NaN) + focused + paired,
          feats: { [focus(skill)]: [focused], [pairOf(skill)]: [paired] },
        },
      ];
    }),
  );
}

// Each skill's ranks per state: 0, 9, 10 and 20 everywhere (20 catches a
// threshold without its `min`), and one state where a pair's two skills
// differ (Perception at 10, Sense Motive at 9) and Craft alone of the
// category skills reaches 10.
const states: [string, Ranks][] = [
  ['zero', everySkill(0)],
  ['nine', everySkill(9)],
  ['ten', everySkill(10)],
  ['twenty', everySkill(20)],
  ['split', { ...everySkill(0), per: 10, sen: 9, crf: 10, kar: 9 }],
];

test('each listed skill’s rank-threshold Modifiers reach its saved-sheet total: +3 or +6, and +2 or +4, from its own recorded ranks', async () => {
  const proof = await fixture();
  const { member, scope, id, read } = proof;
  // Without the feats, each state's totals.
  const base: Record<string, Ranks> = {};
  for (const [label, ranks] of states) {
    await recordRanks(proof, ranks, `base-${label}`);
    const rows = skillRows(await read());
    base[label] = Object.fromEntries(
      listedSkills.map((skill) => [skill, rows[skill]?.total ?? NaN]),
    ) as Ranks;
    for (const skill of listedSkills) expect(rows[skill]?.feats).toEqual({});
  }
  // Every Skill-Focus-shaped and skill-pair feat, selected once.
  const selections: Record<string, Id<'characterSheetEntry'>> = {};
  for (const key of fixtureKeys)
    selections[key] = await member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `select-${key}`,
    });
  for (const [label, ranks] of states) {
    await recordRanks(proof, ranks, `feats-${label}`);
    expect(skillRows(await read()), label).toEqual(
      expectedRows(ranks, base[label]),
    );
  }
});

test('two copies on one skill do not stack, switching a feat off removes its contribution, another member reads the same totals and an outsider is refused', async () => {
  const proof = await fixture();
  const { owner, member, outsider, scope, id, read } = proof;
  await recordRanks(proof, everySkill(10), 'ten');
  const before = skillRows(await read());
  const select = (key: string, operationId: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId,
    });
  const perception = await select(focus('per'), 'focus-per');
  await select(pairOf('per'), 'pair-per');
  const arcana = await select(focus('kar'), 'focus-kar');
  const selected = await read();
  expect(skillRows(selected).per).toEqual({
    total: (before.per?.total ?? NaN) + 6 + 4,
    feats: { [focus('per')]: [6], [pairOf('per')]: [4] },
  });
  expect(skillRows(selected).kar).toEqual({
    total: (before.kar?.total ?? NaN) + 6,
    feats: { [focus('kar')]: [6] },
  });
  // A second copy of one Skill-Focus-shaped feat is one Source: it adds
  // nothing more, and its contribution is suppressed.
  const copy = await select(focus('per'), 'focus-per-again');
  const copied = await read();
  expect(skillRows(copied).per).toEqual(skillRows(selected).per);
  expect(
    copied.calculated.breakdowns['skill.per'].suppressed.filter(
      (row) => row.source === focus('per'),
    ),
  ).toHaveLength(1);
  expect(copy).not.toBe(perception);
  // Switching a feat off removes its contribution; switching it on restores
  // it.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: arcana,
    active: false,
    operationId: 'arcana-off',
  });
  expect(skillRows(await read()).kar).toEqual({
    total: before.kar?.total,
    feats: {},
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: arcana,
    active: true,
    operationId: 'arcana-on',
  });
  const restored = skillRows(await read());
  expect(restored).toEqual(skillRows(copied));
  // Another member reads the same totals; an outsider is refused.
  expect(skillRows(await read(member))).toEqual(restored);
  expect(skillRows(await read(owner))).toEqual(restored);
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});
