// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import { launchMechanismProofs } from '../../scripts/catalog/launch-mechanism-proofs';
import {
  currentMechanismProofs,
  launchVerificationStaleness,
  parseLaunchVerification,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import {
  asRecord,
  disqualifies,
  entryOutputs,
  importedEvidence,
  loadControlRows,
  modifierNames,
} from './launch-modifier-evidence';
import { materializePinnedTree } from './pinned-sources';

// Content verification slice 3: the plain-Modifiers family. An inventory row
// names one mechanism per source change, `Modifier <target> <formula>`
// (`launch-inventory-build.ts`); the family proves them only when every one
// is a (target, formula shape) pair the public saved-sheet proof
// (`convex/characterSheetModifiers.integration.test.ts`) covers, and the
// row's scoped entry carries exactly the outputs those pairs import as.
const proofTest = 'convex/characterSheetModifiers.integration.test.ts';
const repository = (path: string) => repositoryFileSha256('.', path);
const currentRegistry = {
  registry: launchMechanismProofs,
  sha256Of: repository,
};
const plainModifiers = launchMechanismProofs.find(
  (proof) => proof.family === 'plain-modifiers',
);

/**
 * The proven pairs, written out here: a source target and formula shape,
 * and what the importer emits for it. `constant` is a positive integer.
 */
const provenPairs = [
  ['will', 'constant', 'save.will', 'untyped'],
  ['fort', 'constant', 'save.fort', 'untyped'],
  ['ref', 'constant', 'save.ref', 'untyped'],
  ['init', 'constant', 'init', 'untyped'],
  ['allSavingThrows', 'constant', 'saves', 'racial'],
  ['skill.per', 'constant', 'skill.per', 'racial'],
  ['skill.int', 'constant', 'skill.int', 'racial'],
  ['skill.acr', 'constant', 'skill.acr', 'racial'],
  ['skill.clm', 'constant', 'skill.clm', 'racial'],
  ['skill.int', 'str', 'skill.int', 'untyped'],
  ['bonusFeats', 'constant', 'feat slot', ''],
  ['bonusSkillRanks', 'hit dice', 'rank per level', ''],
] as const;
type Pair = (typeof provenPairs)[number];

const mechanism = (name: string): LaunchRow['mechanisms'][number] => ({
  name,
  disposition: 'calculated',
  status: 'outstanding',
  contract: `${name} contract.`,
  evidence: ['row.sources'],
});
const source = 'e'.repeat(64);
function modifierRow(
  key: string,
  kind: string,
  names: readonly string[],
): Parameters<typeof verifyLaunchRows>[0]['rows'][number] {
  return {
    key,
    kind,
    catalogKey: key,
    requirement: 'required',
    holds: [],
    mechanisms: names.map(mechanism),
    sources: [
      {
        repository: 'pf1',
        pin: 'baseline',
        locator: `packs/${key}.yaml`,
        rawSha256: source,
        effectiveSha256: source,
      },
    ],
    noticeEvidence: { state: 'unreviewed', evidence: ['row.sources'] },
  };
}
type Output = {
  modifiers?: unknown[];
  grantsSlots?: unknown[];
  bonusSkillRanksPerLevel?: number;
  situationalNotes?: unknown[];
};
function modifierEntry(key: string, kind: string, output: Output = {}) {
  const { bonusSkillRanksPerLevel = 0, modifiers = [], ...rest } = output;
  return {
    externalKey: key,
    upstreamKey: key.split('/')[1],
    pack: kind === 'feat' ? 'feats' : 'pf-racial-traits',
    name: key,
    detail:
      kind === 'racialTrait'
        ? { kind, bonusSkillRanksPerLevel, raceKeys: [], standard: true }
        : kind === 'feat'
          ? { kind, featTypes: ['General'], repeatable: 'no' }
          : { kind },
    description: '',
    sources: [{ book: 'PZO1110' }],
    modifiers,
    unsupported: [],
    ...rest,
  };
}
const modifier = (
  target: string,
  value: number | { formula: string },
  bonusType = 'untyped',
) => ({ target, bonusType, value });

function projectionInput(
  keys: readonly string[],
  change: Partial<LaunchVerificationInput> = {},
): LaunchVerificationInput {
  return {
    admission: {
      admitted: keys.map((externalKey) => ({
        externalKey,
        reason: 'Admitted.',
      })),
      held: [],
      dependentOmissions: [],
      retainedExceptions: [],
      failures: [],
    },
    scopeBuild: { entries: [], remaps: new Map(), resources: new Map() },
    unsupported: { entries: [] },
    proofs: currentRegistry,
    proseCases: [],
    calculationIdentity: currentCalculationIdentity,
    stale: [],
    ...change,
  };
}

/** Each row's proven mechanisms, keyed by row. */
function proven(
  rows: Parameters<typeof verifyLaunchRows>[0]['rows'],
  change: Partial<LaunchVerificationInput> = {},
) {
  return Object.fromEntries(
    verifyLaunchRows(
      { rows, edges: [] },
      projectionInput(
        rows.map(({ key }) => key),
        change,
      ),
    ).map(({ key, mechanisms }) => [key, mechanisms]),
  );
}

describe('the plain-Modifiers family', () => {
  it('names the public saved-sheet proof with its current bytes, the current calculation identity and the exact proven pairs', () => {
    expect(launchMechanismProofs.map(({ family }) => family)).toEqual([
      'spell-class-list',
      'spell-granted-levels',
      'plain-modifiers',
    ]);
    expect(plainModifiers).toMatchObject({
      mechanismPrefix: 'Modifier ',
      kinds: ['feat', 'racialTrait'],
      tests: [{ path: proofTest }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['changes', 'curation', 'racialTraitRule'],
    });
    expect(
      plainModifiers && 'modifiers' in plainModifiers
        ? plainModifiers.modifiers
        : [],
    ).toEqual(
      provenPairs.map(([sourceTarget, shape, target, bonusType]) =>
        target === 'feat slot'
          ? { source: sourceTarget, formula: 'constant', grants: 'feat-slot' }
          : target === 'rank per level'
            ? {
                source: sourceTarget,
                formula: 'hit-dice',
                grants: 'skill-rank-per-level',
              }
            : shape === 'str'
              ? {
                  source: sourceTarget,
                  formula: 'ability-modifier',
                  abilities: ['str'],
                  target,
                  bonusTypes: [bonusType],
                }
              : {
                  source: sourceTarget,
                  formula: 'constant',
                  target,
                  bonusTypes: [bonusType],
                },
      ),
    );
    expect(currentMechanismProofs(currentRegistry)).toContainEqual(
      plainModifiers,
    );
    // The entry with its test file's bytes changed proves nothing.
    expect(
      currentMechanismProofs({
        registry: launchMechanismProofs,
        sha256Of: (path) =>
          path === proofTest ? 'e'.repeat(64) : repository(path),
      }).map(({ family }) => family),
    ).toEqual(['spell-class-list', 'spell-granted-levels']);
  });

  it('proves a row only when every Modifier it carries is a proven pair and its entry carries exactly what the pairs import as', () => {
    const cases: [string, string, string[], Output | undefined, boolean][] = [
      [
        'pf1/will',
        'feat',
        ['Modifier will 2'],
        { modifiers: [modifier('save.will', 2)] },
        true,
      ],
      [
        'pf1/init',
        'feat',
        ['Modifier init 4'],
        { modifiers: [modifier('init', 4)] },
        true,
      ],
      [
        'pf1/luck',
        'racialTrait',
        ['Modifier allSavingThrows 1'],
        { modifiers: [modifier('saves', 1, 'racial')] },
        true,
      ],
      [
        'pf1/footing',
        'racialTrait',
        ['Modifier skill.clm 2', 'Modifier skill.acr 2'],
        {
          modifiers: [
            modifier('skill.acr', 2, 'racial'),
            modifier('skill.clm', 2, 'racial'),
          ],
        },
        true,
      ],
      // Intimidating Prowess: its reviewed replacement drops Foundry's floor,
      // so the effective formula is the Strength modifier.
      [
        'pf1/O0jbkTJcIji9BNiF',
        'feat',
        ['Modifier skill.int max(0, @abilities.str.mod)'],
        { modifiers: [modifier('skill.int', { formula: '@ability.str.mod' })] },
        true,
      ],
      [
        'pf1/strength',
        'feat',
        ['Modifier skill.int @abilities.str.mod'],
        { modifiers: [modifier('skill.int', { formula: '@ability.str.mod' })] },
        true,
      ],
      // The same floor without a reviewed replacement is no proven shape.
      [
        'pf1/unproven-floor',
        'feat',
        ['Modifier skill.int max(0, @abilities.str.mod)'],
        {
          modifiers: [
            modifier('skill.int', { formula: 'max(0, @ability.str.mod)' }),
          ],
        },
        false,
      ],
      [
        'pf1/unproven-dexterity',
        'feat',
        ['Modifier skill.int @abilities.dex.mod'],
        { modifiers: [modifier('skill.int', { formula: '@ability.dex.mod' })] },
        false,
      ],
      [
        'pf1/bonus-feat',
        'racialTrait',
        ['Modifier bonusFeats 1'],
        { grantsSlots: [{ kind: 'feat', count: 1 }] },
        true,
      ],
      [
        'pf1/listed-feat',
        'racialTrait',
        ['Modifier bonusFeats 1'],
        { grantsSlots: [{ kind: 'feat', count: 1, feats: ['pf1/focus'] }] },
        true,
      ],
      [
        'pf1/unproven-typed-feat',
        'racialTrait',
        ['Modifier bonusFeats 1'],
        { grantsSlots: [{ kind: 'feat', count: 1, featTypes: ['Combat'] }] },
        false,
      ],
      [
        'pf1/unproven-scaled-feats',
        'racialTrait',
        ['Modifier bonusFeats 1 + floor(@attributes.hd.total / 8)'],
        { grantsSlots: [{ kind: 'feat', count: 1 }] },
        false,
      ],
      [
        'pf1/ranks',
        'racialTrait',
        ['Modifier bonusSkillRanks @attributes.hd.total'],
        { bonusSkillRanksPerLevel: 1 },
        true,
      ],
      [
        'pf1/unproven-ranks-unmapped',
        'racialTrait',
        ['Modifier bonusSkillRanks @attributes.hd.total'],
        {},
        false,
      ],
      // An unproven target, and unproven formula shapes on a proven target.
      [
        'pf1/unproven-stealth',
        'racialTrait',
        ['Modifier skill.ste 2'],
        { modifiers: [modifier('skill.ste', 2, 'racial')] },
        false,
      ],
      [
        'pf1/unproven-missing-target',
        'racialTrait',
        ['Modifier undefined 2'],
        { modifiers: [modifier('ability.$choice', 2, 'racial')] },
        false,
      ],
      [
        'pf1/unproven-penalty',
        'feat',
        ['Modifier will -2'],
        { modifiers: [modifier('save.will', -2)] },
        false,
      ],
      [
        'pf1/unproven-zero',
        'feat',
        ['Modifier will 0'],
        { modifiers: [modifier('save.will', 0)] },
        false,
      ],
      [
        'pf1/unproven-rank-scaled',
        'feat',
        ['Modifier will 2 + @attributes.hd.total'],
        { modifiers: [modifier('save.will', { formula: '2 + @hitDice' })] },
        false,
      ],
      // Partly proven: one proven pair beside an unproven one.
      [
        'pf1/unproven-partly',
        'racialTrait',
        ['Modifier skill.clm 2', 'Modifier skill.ste 2'],
        {
          modifiers: [
            modifier('skill.clm', 2, 'racial'),
            modifier('skill.ste', 2, 'racial'),
          ],
        },
        false,
      ],
      // A bonus type the proof does not cover for the pair.
      [
        'pf1/unproven-racial-will',
        'racialTrait',
        ['Modifier will 2'],
        { modifiers: [modifier('save.will', 2, 'racial')] },
        false,
      ],
      // The entry's outputs must be exactly the pairs' outputs.
      [
        'pf1/unproven-value',
        'feat',
        ['Modifier will 2'],
        { modifiers: [modifier('save.will', 3)] },
        false,
      ],
      ['pf1/unproven-dropped', 'feat', ['Modifier will 2'], {}, false],
      [
        'pf1/unproven-extra',
        'feat',
        ['Modifier will 2'],
        { modifiers: [modifier('save.will', 2), modifier('save.fort', 2)] },
        false,
      ],
      [
        'pf1/unproven-twice',
        'feat',
        ['Modifier will 2'],
        { modifiers: [modifier('save.will', 2), modifier('save.will', 2)] },
        false,
      ],
      [
        'pf1/unproven-conditional',
        'feat',
        ['Modifier will 2'],
        {
          modifiers: [
            { ...modifier('save.will', 2), condition: { situation: 'fear' } },
          ],
        },
        false,
      ],
      [
        'pf1/unproven-extra-slot',
        'racialTrait',
        ['Modifier skill.per 2'],
        {
          modifiers: [modifier('skill.per', 2, 'racial')],
          grantsSlots: [{ kind: 'feat', count: 1 }],
        },
        false,
      ],
      [
        'pf1/unproven-extra-ranks',
        'racialTrait',
        ['Modifier skill.per 2'],
        {
          modifiers: [modifier('skill.per', 2, 'racial')],
          bonusSkillRanksPerLevel: 1,
        },
        false,
      ],
      // A descriptive note is not a Modifier.
      [
        'pf1/noted',
        'racialTrait',
        ['Modifier skill.per 2'],
        {
          modifiers: [modifier('skill.per', 2, 'racial')],
          situationalNotes: [{ text: 'Race: Elf' }],
        },
        true,
      ],
      // A kind the proof does not cover, and a row without a scoped entry.
      [
        'pf1/unproven-trait',
        'trait',
        ['Modifier will 1'],
        { modifiers: [modifier('save.will', 1, 'trait')] },
        false,
      ],
      [
        'pf1/unproven-class-feature',
        'classFeature',
        ['Modifier bonusFeats 1'],
        { grantsSlots: [{ kind: 'feat', count: 1 }] },
        false,
      ],
      ['pf1/unproven-unbuilt', 'feat', ['Modifier will 2'], undefined, false],
    ];
    const rows = cases.map(([key, kind, names]) =>
      modifierRow(key, kind, names),
    );
    const entries = cases.flatMap(([key, kind, , output]) =>
      output ? [modifierEntry(key, kind, output)] : [],
    );
    const result = proven(rows, {
      scopeBuild: { entries, remaps: new Map(), resources: new Map() },
    });
    expect(
      Object.fromEntries(cases.map(([key]) => [key, result[key]])),
    ).toEqual(
      Object.fromEntries(
        cases.map(([key, , names, , expected]) => [key, expected ? names : []]),
      ),
    );
    // A row's other outstanding mechanism stays outstanding.
    const prerequisite = {
      ...modifierRow('pf1/with-prerequisite', 'feat', ['Modifier will 2']),
    };
    prerequisite.mechanisms = [
      ...prerequisite.mechanisms,
      mechanism('Source prerequisites'),
    ];
    expect(
      proven([prerequisite], {
        scopeBuild: {
          entries: [
            modifierEntry(prerequisite.key, 'feat', {
              modifiers: [modifier('save.will', 2)],
            }),
          ],
          remaps: new Map(),
          resources: new Map(),
        },
      }),
    ).toEqual({ [prerequisite.key]: ['Modifier will 2'] });
  });

  it('refuses a row with a changes, curation or racial trait rule issue, a changed calculation identity or no gate admission', () => {
    const key = 'pf1-content/HVI7FNwj2ng10qtj';
    const row = modifierRow(key, 'racialTrait', ['Modifier allSavingThrows 1']);
    const scopeBuild = {
      entries: [
        modifierEntry(key, 'racialTrait', {
          modifiers: [modifier('saves', 1, 'racial')],
        }),
      ],
      remaps: new Map(),
      resources: new Map(),
    };
    const withIssue = (field: string) =>
      proven([row], {
        scopeBuild,
        unsupported: {
          entries: [{ externalKey: key, issues: [{ field, reason: 'Why.' }] }],
        },
      })[key];
    expect(proven([row], { scopeBuild })[key]).toEqual([
      'Modifier allSavingThrows 1',
    ]);
    for (const field of [
      'changes',
      'curation',
      'curation.mechanics',
      'curation.outputs',
      'racialTraitRule',
    ])
      expect(withIssue(field), field).toEqual([]);
    // Retained source fields and other importer notes say nothing about the
    // changes.
    for (const field of ['gameContent', 'changesNote', 'weaponProf'])
      expect(withIssue(field), field).toEqual(['Modifier allSavingThrows 1']);
    expect(
      proven([row], {
        scopeBuild,
        calculationIdentity: 'sha256:' + 'f'.repeat(64),
      })[key],
    ).toEqual([]);
    expect(
      verifyLaunchRows(
        { rows: [row], edges: [] },
        {
          ...projectionInput([], { scopeBuild }),
          admission: {
            admitted: [],
            held: [{ externalKey: key, reason: 'Held.' }],
            dependentOmissions: [],
            retainedExceptions: [],
            failures: [],
          },
        },
      ),
    ).toEqual([]);
  });

  it('keeps a committed projection current only while each Modifier it names is a proven pair', async () => {
    const committed = parseLaunchVerification(
      JSON.parse(
        await readFile(
          'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
          'utf8',
        ),
      ),
    );
    const current = {
      scopeVersion: committed.scopeVersion,
      launchScopeIdentity: committed.binding.launchScopeIdentity,
      calculationIdentity: committed.binding.calculationIdentity,
      proofsSha256: committed.binding.proofsSha256,
      proofs: currentRegistry,
      proseCases: [],
      sha256Of: () => Promise.resolve(undefined),
      packages: () => Promise.resolve(committed.binding.packages),
    };
    const naming = (name: string) => ({
      ...committed,
      binding: { ...committed.binding, inputs: {} },
      rows: [
        {
          key: 'pf1/probe',
          verified: [],
          mechanisms: [name],
          prose: [],
          evidence: [],
        },
      ],
    });
    expect(
      await launchVerificationStaleness(naming('Modifier will 2'), current),
    ).toEqual([]);
    for (const name of [
      'Modifier skill.ste ifelse(gte(@skills.ste.rank,10),6,3)',
      'Modifier will -2',
      'Modifier ability.dex 2',
      'Modifier will',
      'Modifier ',
    ])
      expect(
        await launchVerificationStaleness(naming(name), current),
        name,
      ).toEqual(['1 row names a mechanism no current registry entry proves']);
  });
});

// The full-inventory control: real rows with their real entries and issues
// (`launch-modifier-evidence.ts`).

/** A source change's table pair, with its effective formula. */
function tablePair(key: string, name: string) {
  if (!name.startsWith('Modifier ')) return undefined;
  const rest = name.slice('Modifier '.length);
  const space = rest.indexOf(' ');
  if (space < 1) return undefined;
  const target = rest.slice(0, space);
  // Intimidating Prowess's reviewed replacement (#726) is the only one on a
  // proven target with a proven shape.
  const formula =
    key === 'pf1/O0jbkTJcIji9BNiF' &&
    rest.slice(space + 1) === 'max(0, @abilities.str.mod)'
      ? '@abilities.str.mod'
      : rest.slice(space + 1);
  const shape = /^[1-9][0-9]*$/.test(formula)
    ? 'constant'
    : formula === '@abilities.str.mod'
      ? 'str'
      : formula === '@attributes.hd.total'
        ? 'hit dice'
        : undefined;
  const pair = provenPairs.find(
    ([sourceTarget, pairShape]) =>
      sourceTarget === target && pairShape === shape,
  );
  return pair ? { pair, formula } : undefined;
}

/** The output a source change's table pair imports as, in `entryOutputs`'s words. */
function pairOutput(key: string, name: string) {
  const found = tablePair(key, name);
  if (!found) return undefined;
  const [, shape, output, bonusType] = found.pair;
  if (output === 'feat slot') return `slot ${found.formula}`;
  if (output === 'rank per level') return 'rank';
  return `${output} ${bonusType} ${shape === 'str' ? '@ability.str.mod' : found.formula}`;
}

/** The Modifier rows in the Race Builder subtree; Dual-Minded's +2 Will is one. */
const raceBuilderRows = [
  'pf1-content/4FwBwy4DCsyVzEzI',
  'pf1-content/5Pf9onFX3srkyard',
  'pf1-content/6am3c1HIosN3E6vk',
  'pf1-content/9jQBQeKCWdpqTw8e',
  'pf1-content/K9zkM020ZgkC0gYA',
  'pf1-content/T8sGSQi3ZjGk5lhB',
  'pf1-content/VPo3x8dFD4PXeN7s',
  'pf1-content/gxxo5ADAOJmasUMu',
];

describe('the plain-Modifiers family over the committed inventory', () => {
  it('excludes a Race Builder trait only with its folder ancestry, which the control carries', async () => {
    const dualMinded = 'pf1-content/VPo3x8dFD4PXeN7s';
    const { real } = await loadControlRows();
    expect(real.get(dualMinded)?.entry).toBeUndefined();
    // Without its folder records the importer cannot see the subtree: the
    // bare source imports as an entry carrying an untyped +2 Will.
    const bare = await materializePinnedTree([
      'pf1-content/src/pf-racial-traits/Dual_Minded_VPo3x8dFD4PXeN7s.yaml',
    ]);
    try {
      const { entries } = await importedEvidence(bare);
      const entry = entries.get(dualMinded);
      expect(entry && entryOutputs(entry)).toEqual(['save.will untyped 2']);
    } finally {
      await bare.dispose();
    }
  }, 120_000);

  it('proves exactly the rows whose every Modifier is a proven pair with its real entry’s outputs, and nothing without that evidence', async () => {
    const { committed, catalogRows, modifierRows, real } =
      await loadControlRows();
    const evidence = (key: string) => {
      const found = real.get(key);
      if (!found) throw new Error(`No real entry for ${key}.`);
      return found;
    };
    // Every pair named, read from the table.
    const named = (row: LaunchRow, pairs: readonly Pair[] = provenPairs) =>
      modifierNames(row).every((name) => {
        const found = tablePair(row.key, name);
        return found !== undefined && pairs.includes(found.pair);
      });
    const familyRows = modifierRows.filter(
      ({ kind }) => kind === 'feat' || kind === 'racialTrait',
    );
    const expected = (pairs: readonly Pair[] = provenPairs) =>
      familyRows
        .filter((row) => {
          if (!named(row, pairs)) return false;
          const { entry, issues } = evidence(row.key);
          const wanted = modifierNames(row)
            .map((name) => pairOutput(row.key, name) ?? '')
            .sort();
          return (
            entry !== undefined &&
            asRecord(entry.detail).kind === row.kind &&
            !issues.some(disqualifies) &&
            JSON.stringify(entryOutputs(entry)) === JSON.stringify(wanted)
          );
        })
        .map(({ key }) => key)
        .sort();
    // Every Modifier row admitted, each with its real entry, if the build
    // emits one, and its real issues.
    const keys = modifierRows.map(({ key }) => key);
    const entries = keys.flatMap((key) => evidence(key).entry ?? []);
    const issues = keys.map((externalKey) => ({
      externalKey,
      issues: evidence(externalKey).issues,
    }));
    const project = (
      registry: readonly unknown[] = launchMechanismProofs,
      unsupported: LaunchVerificationInput['unsupported']['entries'] = issues,
    ) =>
      verifyLaunchRows(
        committed,
        projectionInput(keys, {
          scopeBuild: { entries, remaps: new Map(), resources: new Map() },
          unsupported: { entries: unsupported },
          proofs: { registry, sha256Of: repository },
        }),
      )
        .filter(({ mechanisms }) =>
          mechanisms.some((name) => name.startsWith('Modifier ')),
        )
        .map(({ key }) => key)
        .sort();
    const control = project();
    expect(control).toEqual(expected());
    expect(control.length).toBeGreaterThan(0);
    // The refused set, from real rows: a family row only partly named, a fully
    // named family row its real entry or issues refuse, and a fully named row
    // of another kind. Each class is present and none proves.
    const partly = familyRows.filter(
      (row) =>
        !named(row) &&
        modifierNames(row).some((name) => tablePair(row.key, name)),
    );
    const refusedNamed = familyRows.filter(
      (row) => named(row) && !control.includes(row.key),
    );
    const otherKinds = modifierRows.filter(
      (row) => !familyRows.includes(row) && named(row),
    );
    // A row whose source the import loaded and emits no entry for: an
    // excluded record or a resource. The Race Builder subtree's eight are
    // excluded only by their folder ancestry, which the import must carry.
    const unemitted = modifierRows.filter(
      ({ key }) => evidence(key).entry === undefined,
    );
    expect(
      unemitted
        .filter(
          ({ key }) =>
            evidence(key).reason ===
            'Advanced Race Guide Race Builder subtree is explicitly excluded.',
        )
        .map(({ key }) => key)
        .sort(),
    ).toEqual(raceBuilderRows);
    for (const [label, refused] of [
      ['partly named', partly],
      ['named, refused by entry or issues', refusedNamed],
      ['named, another kind', otherKinds],
      ['no entry emitted', unemitted],
    ] as const) {
      expect(refused.length, label).toBeGreaterThan(0);
      expect(
        refused.filter(({ key }) => control.includes(key)),
        label,
      ).toEqual([]);
    }
    // Each proven row's Modifiers are all proven, and nothing else is; every
    // Modifier row was evaluated.
    const projected = verifyLaunchRows(
      committed,
      projectionInput(keys, {
        scopeBuild: { entries, remaps: new Map(), resources: new Map() },
        unsupported: { entries: issues },
      }),
    );
    expect(projected.map(({ key }) => key).sort()).toEqual([...keys].sort());
    const byKey = new Map(committed.rows.map((row) => [row.key, row]));
    for (const { key, mechanisms } of projected)
      expect(
        mechanisms.filter((name) => name.startsWith('Modifier ')).sort(),
        key,
      ).toEqual(
        control.includes(key) ? modifierNames(byKey.get(key)!).sort() : [],
      );
    // Negative, over every real row: a registry without one pair proves no row
    // needing it, and each removal disqualifies at least one.
    if (!plainModifiers || !('modifiers' in plainModifiers))
      throw new Error('Missing the plain-Modifiers family');
    for (const [index, pair] of provenPairs.entries()) {
      const narrowed = project(
        launchMechanismProofs.map((proof) =>
          proof === plainModifiers
            ? {
                ...plainModifiers,
                modifiers: plainModifiers.modifiers.filter(
                  (_, at) => at !== index,
                ),
              }
            : proof,
        ),
      );
      const without = provenPairs.filter((other) => other !== pair);
      expect(narrowed, pair.join(' ')).toEqual(expected(without));
      expect(narrowed.length, pair.join(' ')).toBeLessThan(control.length);
    }
    // Each disqualifier, added to a proven row's real issues, refuses it.
    for (const field of ['changes', 'curation.mechanics', 'racialTraitRule'])
      expect(
        project(
          launchMechanismProofs,
          issues.map(({ externalKey, issues: found }) => ({
            externalKey,
            issues: control.includes(externalKey)
              ? [...found, { field }]
              : found,
          })),
        ),
        field,
      ).toEqual([]);
    // No row proves without its scoped entry.
    expect(
      verifyLaunchRows(
        committed,
        projectionInput(catalogRows.map(({ key }) => key)),
      ).filter(({ mechanisms }) => mechanisms.length),
    ).toEqual([]);
    // The committed projection, from the real build, proves a Modifier on
    // exactly the control rows the inventory does not hold; a held row is
    // never admitted. No row is dropped from either side to make them agree.
    const committedProjection = parseLaunchVerification(
      JSON.parse(
        await readFile(
          'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
          'utf8',
        ),
      ),
    );
    const committedProven = committedProjection.rows
      .filter(({ mechanisms }) =>
        mechanisms.some((name) => name.startsWith('Modifier ')),
      )
      .map(({ key }) => key)
      .sort();
    const admittedKeys = new Set(
      committedProjection.rows.map(({ key }) => key),
    );
    const held = control.filter((key) => byKey.get(key)?.holds.length);
    expect(committedProven.length).toBeGreaterThan(0);
    expect([...committedProven, ...held].sort()).toEqual(control);
    expect(held.filter((key) => admittedKeys.has(key))).toEqual([]);
  }, 120_000);
});
