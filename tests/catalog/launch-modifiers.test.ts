// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import {
  launchMechanismProofs,
  provenModifierMechanisms,
  type ModifierMechanismProof,
} from '../../scripts/catalog/launch-mechanism-proofs';
import {
  currentMechanismProofs,
  launchVerificationStaleness,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import { personalBonusTypes } from '../../src/lib/character-sheet';
import {
  carrierKinds,
  wordBodies,
  wordBodiesOf,
  wordCases,
  wordBody,
  wordOutputs,
  type EmittedOutput,
  type WordCase,
} from '../plain-modifiers-proof-words';
import {
  committedProjection,
  confirmedAssessments,
  expectReviewedScopeAdmitted,
  type ProjectedRows,
} from './launch-admission-control';
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
 * The skills with a constant pair, each in the racial, trait and untyped
 * bonus types (the public proof's `listedSkills`).
 */
const provenSkills = [
  'acr',
  'apr',
  'blf',
  'clm',
  'dev',
  'dip',
  'dis',
  'esc',
  'han',
  'hea',
  'int',
  'kar',
  'kdu',
  'ken',
  'kge',
  'khi',
  'klo',
  'kna',
  'kno',
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
const skillTypes = ['racial', 'trait', 'untyped'] as const;
type Pair = readonly [
  source: string,
  shape: 'constant' | 'str' | 'hit dice',
  target: string,
  bonusTypes: readonly string[],
];
/**
 * The proven pairs, written out here: a source target and formula shape,
 * and what the importer emits for it, with its proven bonus types.
 * `constant` is a positive integer.
 */
const provenPairs: readonly Pair[] = [
  ['will', 'constant', 'save.will', ['untyped', 'trait']],
  ['fort', 'constant', 'save.fort', ['untyped', 'trait']],
  ['ref', 'constant', 'save.ref', ['untyped', 'trait']],
  ['init', 'constant', 'init', ['untyped', 'trait']],
  ['ac', 'constant', 'ac', ['dodge']],
  ['allSavingThrows', 'constant', 'saves', ['racial']],
  ...provenSkills.map(
    (skill): Pair => [
      `skill.${skill}`,
      'constant',
      `skill.${skill}`,
      skillTypes,
    ],
  ),
  ['skill.int', 'str', 'skill.int', ['untyped']],
  ['bonusFeats', 'constant', 'feat slot', []],
  ['bonusSkillRanks', 'hit dice', 'rank per level', []],
];
/** The pairs this extension added: their sources and bonus types. */
const extendedPairs = [
  ...(['will', 'fort', 'ref', 'init'] as const).map((source) => ({
    source,
    target: source === 'init' ? 'init' : `save.${source}`,
    bonusTypes: ['trait'],
  })),
  ...provenSkills.map((skill) => ({
    source: `skill.${skill}`,
    target: `skill.${skill}`,
    bonusTypes: [...skillTypes],
  })),
];
/** The kind a bonus type's proof carries it on. */
const kindOf = (bonusType: string) =>
  bonusType === 'racial'
    ? 'racialTrait'
    : bonusType === 'trait'
      ? 'trait'
      : 'feat';

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
    pack:
      kind === 'feat'
        ? 'feats'
        : kind === 'trait'
          ? 'pf-traits'
          : 'pf-racial-traits',
    name: key,
    detail:
      kind === 'racialTrait'
        ? { kind, bonusSkillRanksPerLevel, raceKeys: [], standard: true }
        : kind === 'feat'
          ? { kind, featTypes: ['General'], repeatable: 'no' }
          : kind === 'trait'
            ? { kind, traitType: 'social' }
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
    // The registry's whole family list is pinned once, in
    // `launch-mechanism-registry.test.ts`.
    expect(
      launchMechanismProofs.filter(
        ({ family }) => family === 'plain-modifiers',
      ),
    ).toEqual([plainModifiers]);
    expect(plainModifiers).toMatchObject({
      mechanismPrefix: 'Modifier ',
      kinds: ['feat', 'racialTrait', 'trait'],
      tests: [
        { path: proofTest },
        { path: 'tests/plain-modifiers-proof-words.ts' },
      ],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['changes', 'curation', 'racialTraitRule'],
    });
    expect(
      plainModifiers && 'modifiers' in plainModifiers
        ? plainModifiers.modifiers
        : [],
    ).toEqual(
      provenPairs.map(([sourceTarget, shape, target, types]) =>
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
                  bonusTypes: types,
                }
              : {
                  source: sourceTarget,
                  formula: 'constant',
                  target,
                  bonusTypes: types,
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
      }),
    ).not.toContainEqual(plainModifiers);
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
        'pf1/unproven-fly',
        'racialTrait',
        ['Modifier skill.fly 2'],
        { modifiers: [modifier('skill.fly', 2, 'racial')] },
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
        ['Modifier skill.clm 2', 'Modifier skill.fly 2'],
        {
          modifiers: [
            modifier('skill.clm', 2, 'racial'),
            modifier('skill.fly', 2, 'racial'),
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
      // A trait, and a trait row whose scoped entry is of another kind.
      [
        'pf1/trait',
        'trait',
        ['Modifier will 1'],
        { modifiers: [modifier('save.will', 1, 'trait')] },
        true,
      ],
      [
        'pf1/trait-two-pairs',
        'trait',
        ['Modifier init 1', 'Modifier skill.esc 1'],
        {
          modifiers: [
            modifier('init', 1, 'trait'),
            modifier('skill.esc', 1, 'trait'),
          ],
        },
        true,
      ],
      [
        'pf1/unproven-trait-as-feat',
        'trait',
        ['Modifier will 1'],
        undefined,
        false,
      ],
      // A trait bonus type on a pair the proof covers in other types only.
      [
        'pf1/unproven-trait-saves',
        'trait',
        ['Modifier allSavingThrows 1'],
        { modifiers: [modifier('saves', 1, 'trait')] },
        false,
      ],
      // A kind the proof does not cover, and a row without a scoped entry.
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
    const entries = [
      ...cases.flatMap(([key, kind, , output]) =>
        output ? [modifierEntry(key, kind, output)] : [],
      ),
      // The trait row's scoped entry is a feat's.
      modifierEntry('pf1/unproven-trait-as-feat', 'feat', {
        modifiers: [modifier('save.will', 1, 'trait')],
      }),
    ];
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

  it('proves each extended pair in each of its bonus types and refuses it with a wrong target, bonus type or formula', () => {
    type Case = {
      key: string;
      kind: string;
      names: string[];
      output: Output;
      proves: boolean;
    };
    const cases = extendedPairs.flatMap(({ source, target, bonusTypes }) => {
      // Another proven target: a skill's neighbour in the list, or Will.
      const others = extendedPairs.map((pair) => pair.target);
      const other =
        others[(others.indexOf(target) + 1) % others.length] ?? 'save.will';
      return bonusTypes.flatMap((type): Case[] => {
        const kind = kindOf(type);
        const at = (label: string) => `pf1/${source}-${type}-${label}`;
        const named = [`Modifier ${source} 2`];
        return [
          {
            key: at('proven'),
            kind,
            names: named,
            output: { modifiers: [modifier(target, 2, type)] },
            proves: true,
          },
          {
            key: at('wrong-target'),
            kind,
            names: named,
            output: { modifiers: [modifier(other, 2, type)] },
            proves: false,
          },
          {
            key: at('wrong-type'),
            kind,
            names: named,
            output: { modifiers: [modifier(target, 2, 'competence')] },
            proves: false,
          },
          {
            key: at('wrong-type-name'),
            kind,
            names: named,
            output: { modifiers: [modifier(target, 2, 'profane')] },
            proves: false,
          },
          {
            key: at('penalty'),
            kind,
            names: [`Modifier ${source} -2`],
            output: { modifiers: [modifier(target, -2, type)] },
            proves: false,
          },
          {
            key: at('formula'),
            kind,
            names: [`Modifier ${source} 1 + @attributes.hd.total`],
            output: {
              modifiers: [modifier(target, { formula: '1 + @hitDice' }, type)],
            },
            proves: false,
          },
          {
            key: at('wrong-value'),
            kind,
            names: named,
            output: { modifiers: [modifier(target, 1, type)] },
            proves: false,
          },
        ];
      });
    });
    expect(cases.filter(({ proves }) => proves)).toHaveLength(
      provenSkills.length * skillTypes.length + 4,
    );
    const result = proven(
      cases.map(({ key, kind, names }) => modifierRow(key, kind, names)),
      {
        scopeBuild: {
          entries: cases.map(({ key, kind, output }) =>
            modifierEntry(key, kind, output),
          ),
          remaps: new Map(),
          resources: new Map(),
        },
      },
    );
    expect(
      Object.fromEntries(cases.map(({ key }) => [key, result[key]])),
    ).toEqual(
      Object.fromEntries(
        cases.map(({ key, names, proves }) => [key, proves ? names : []]),
      ),
    );
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
    // A trait's retained class-skill field says nothing about its changes;
    // its disqualifiers refuse it as they refuse a Racial Trait.
    const traitKey = 'pf1-content/AqVT6NKa96JsBIbp';
    const traitRow = modifierRow(traitKey, 'trait', ['Modifier skill.blf 1']);
    const traitBuild = {
      entries: [
        modifierEntry(traitKey, 'trait', {
          modifiers: [modifier('skill.blf', 1, 'trait')],
        }),
      ],
      remaps: new Map(),
      resources: new Map(),
    };
    const traitWith = (field: string) =>
      proven([traitRow], {
        scopeBuild: traitBuild,
        unsupported: {
          entries: [
            {
              externalKey: traitKey,
              issues: [{ field, value: { classSkills: { blf: true } } }],
            },
          ],
        },
      })[traitKey];
    expect(traitWith('gameContent')).toEqual(['Modifier skill.blf 1']);
    for (const field of ['changes', 'curation.mechanics'])
      expect(traitWith(field), field).toEqual([]);
    // trait-cs: a trait whose class skill the importer maps (its detail's
    // `classSkills`, or a choice trait's `classSkillChoice`) keeps its pair:
    // the projection reads only Modifiers, slots and ranks.
    for (const classSkillDetail of [
      { classSkills: ['skill.blf'] },
      { classSkillChoice: ['skill.blf', 'skill.dip'] },
    ]) {
      const [traitEntry] = traitBuild.entries;
      expect(
        proven([traitRow], {
          scopeBuild: {
            ...traitBuild,
            entries: [
              {
                ...traitEntry!,
                detail: {
                  kind: 'trait',
                  traitType: 'social',
                  ...classSkillDetail,
                },
              },
            ],
          },
        })[traitKey],
        JSON.stringify(classSkillDetail),
      ).toEqual(['Modifier skill.blf 1']);
    }
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
    const committed = await committedProjection();
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
      'Modifier skill.apr ifelse(gte(@skills.apr.rank,10),6,3)',
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

// The coverage tie: every word the family certifies is one the public word
// fixture (`tests/plain-modifiers-proof-words.ts`, bound by bytes in the
// registry entry beside the proof) releases. A word is a carrier kind with
// one output the gate reads (`provenModifierMechanisms`): an unconditional
// Modifier's target, bonus type and value shape (a positive constant or an
// ability modifier), a feat slot (open or listing its only feats; of one or
// several) or a bonus skill rank per level. The certified words are the
// gate's own: a sweep over every pair's source, formula shape, bonus type
// and kind the entry names keeps the words of each row the gate proves.

/** The words of a body's or entry's outputs, as the gate reads them. */
function outputWords(kind: string, body: unknown) {
  const { modifiers, grantsSlots, detail } = asRecord(body);
  const listed = (value: unknown): unknown[] =>
    Array.isArray(value) ? value : [];
  const words = listed(modifiers).map((modifier) => {
    const { target, bonusType, value } = asRecord(modifier);
    const ability =
      typeof value === 'number'
        ? undefined
        : /^@ability\.([a-z]+)\.mod$/.exec(
            String(asRecord(value).formula),
          )?.[1];
    const shape =
      typeof value === 'number'
        ? value > 0
          ? 'constant'
          : 'nonpositive'
        : ability
          ? `${ability}-modifier`
          : 'formula';
    return `${kind} ${String(target)} ${String(bonusType)} ${shape}`;
  });
  for (const slot of listed(grantsSlots)) {
    const { count, feats } = asRecord(slot);
    words.push(
      `${kind} feat-slot ${listed(feats).length ? 'listed' : 'open'} ${count === 1 ? 'one' : 'several'}`,
    );
  }
  if (Number(asRecord(detail).bonusSkillRanksPerLevel ?? 0) > 0)
    words.push(`${kind} skill-rank-per-level`);
  return words;
}

/** What a word fixture releases, in the tie's words. */
function exercisedWords(bodies: readonly unknown[]) {
  return new Set(
    bodies.flatMap((body) =>
      outputWords(String(asRecord(asRecord(body).detail).kind), body),
    ),
  );
}

/**
 * What the gate certifies for a family, in the same words: the words of
 * every one-output row it proves, over each pair source the family names,
 * each formula shape (constants 1 to 3, every ability's modifier, the hit
 * dice), each bonus type on the source's pair targets, open and listed
 * slots, a bonus rank, and each of the family's kinds.
 */
function certifiedWords(proof: ModifierMechanismProof) {
  const words = new Set<string>();
  const formulas = [
    '1',
    '2',
    '3',
    ...['str', 'dex', 'con', 'int', 'wis', 'cha'].map(
      (ability) => `@abilities.${ability}.mod`,
    ),
    '@attributes.hd.total',
  ];
  const sources = [...new Set(proof.modifiers.map(({ source }) => source))];
  for (const kind of proof.kinds)
    for (const source of sources)
      for (const formula of formulas) {
        // The pair's own targets: another target is refused
        // (`proves each extended pair … and refuses it with a wrong target`).
        const targets = proof.modifiers.flatMap((pair) =>
          pair.source === source && 'target' in pair ? [pair.target] : [],
        );
        const ability = /^@abilities\.([a-z]+)\.mod$/.exec(formula)?.[1];
        const value = ability
          ? { formula: `@ability.${ability}.mod` }
          : Number(formula);
        const outputs: Output[] = [
          ...targets.flatMap((target) =>
            personalBonusTypes.map((bonusType) => ({
              modifiers: [modifier(target, value, bonusType)],
            })),
          ),
          ...(typeof value === 'number'
            ? [
                { grantsSlots: [{ kind: 'feat', count: value }] },
                {
                  grantsSlots: [
                    { kind: 'feat', count: value, feats: ['pf1/listed'] },
                  ],
                },
              ]
            : []),
          { bonusSkillRanksPerLevel: 1 },
        ];
        for (const output of outputs) {
          const entry = modifierEntry(`pf1/${kind}`, kind, output);
          const proven = provenModifierMechanisms(proof, {
            key: entry.externalKey,
            kind,
            names: [`Modifier ${source} ${formula}`],
            entry,
          });
          if (proven.length)
            for (const word of outputWords(kind, entry)) words.add(word);
        }
      }
  return words;
}

/** What the family certifies that no case of the fixture releases. */
function uncoveredWords(
  proof: ModifierMechanismProof,
  bodies: readonly unknown[] = wordBodies,
) {
  const released = exercisedWords(bodies);
  return [...certifiedWords(proof)]
    .filter((word) => !released.has(word))
    .sort();
}

describe('the plain-Modifiers scope’s coverage tie to its public word fixture', () => {
  const proof = () => {
    if (!plainModifiers || !('modifiers' in plainModifiers))
      throw new Error('Missing the plain-Modifiers family');
    return plainModifiers;
  };
  const wordsFile = 'tests/plain-modifiers-proof-words.ts';

  it('certifies only words a public case releases, each case one word, and binds the fixture beside the proof', () => {
    const certified = certifiedWords(proof());
    expect(uncoveredWords(proof())).toEqual([]);
    // Every carrier kind carries every constant pair, the Strength formula
    // and the four slot words; only a Racial Trait carries the bonus rank.
    expect(certified.size).toBe(3 * (101 + 4) + 1);
    expect([...certified].filter((word) => word.endsWith('per-level'))).toEqual(
      ['racialTrait skill-rank-per-level'],
    );
    // Each case releases exactly one word, a certified one, and no two cases
    // the same; the kind sheets release every case.
    const caseWords = wordCases.map((word) => {
      const body = wordBodies.find(
        ({ externalKey }) => externalKey === word.key,
      );
      return body ? outputWords(word.kind, body) : [];
    });
    for (const [index, words] of caseWords.entries()) {
      expect(words, wordCases[index]?.key).toHaveLength(1);
      expect(certified.has(words[0] ?? ''), words[0]).toBe(true);
    }
    expect(new Set(caseWords.flat()).size).toBe(wordCases.length);
    expect(
      carrierKinds
        .flatMap((kind) => wordBodiesOf(kind))
        .filter(({ externalKey }) =>
          wordCases.some(({ key }) => key === externalKey),
        ),
    ).toHaveLength(wordCases.length);
    // Within a kind, the constant cases each have their own target and
    // bonus type; the Strength formula alone shares one, `skill.int`
    // untyped, and untyped bonuses stack, so on the kind's sheet none
    // suppresses another.
    for (const kind of carrierKinds) {
      const pairsOf = (shape: 'constant' | 'ability-modifier') =>
        wordCases.flatMap(({ kind: carrier, output }) =>
          carrier === kind && output.kind === shape
            ? [`${output.target} ${output.bonusType}`]
            : [],
        );
      const constants = pairsOf('constant');
      const formulas = pairsOf('ability-modifier');
      expect(new Set(constants).size, kind).toBe(constants.length);
      expect(formulas, kind).toEqual(['skill.int untyped']);
      expect(
        constants.filter((pair) => formulas.includes(pair)),
        kind,
      ).toEqual(['skill.int untyped']);
    }
    // The fixture is bound beside the public test: a changed fixture leaves
    // the entry stale until it is pinned again.
    expect(proof().tests.map(({ path }) => path)).toEqual([
      proofTest,
      wordsFile,
    ]);
  });

  it('fails when a scratch scope certifies a word no case releases, or the fixture drops a case', () => {
    const base = proof();
    const [first, ...rest] = base.modifiers;
    if (!first) throw new Error('The family names no pair');
    const widened = (
      modifiers: ModifierMechanismProof['modifiers'][number][],
    ): ModifierMechanismProof => ({
      ...base,
      modifiers: [first, ...rest, ...modifiers],
    });
    // Acrobatics' own pair widened: the gate reads a source's first pair.
    const withCompetence = (
      pair: ModifierMechanismProof['modifiers'][number],
    ): ModifierMechanismProof['modifiers'][number] =>
      pair.source === 'skill.acr' && 'bonusTypes' in pair
        ? { ...pair, bonusTypes: [...pair.bonusTypes, 'competence'] }
        : pair;
    const cases: [string, ModifierMechanismProof, string[]][] = [
      [
        'an unproven bonus type on a listed skill',
        {
          ...base,
          modifiers: [withCompetence(first), ...rest.map(withCompetence)],
        },
        carrierKinds.map((kind) => `${kind} skill.acr competence constant`),
      ],
      [
        'an unproven skill',
        widened([
          {
            source: 'skill.crf',
            formula: 'constant',
            target: 'skill.crf',
            bonusTypes: ['racial'],
          },
        ]),
        carrierKinds.map((kind) => `${kind} skill.crf racial constant`),
      ],
      [
        'an unproven ability',
        widened([
          {
            source: 'skill.int',
            formula: 'ability-modifier',
            abilities: ['cha'],
            target: 'skill.int',
            bonusTypes: ['untyped'],
          },
        ]),
        carrierKinds.map((kind) => `${kind} skill.int untyped cha-modifier`),
      ],
    ];
    for (const [label, scratch, words] of cases)
      expect(uncoveredWords(scratch), label).toEqual(words.sort());
    const without = (drop: (word: WordCase) => boolean) =>
      wordBodies.filter(
        ({ externalKey }) =>
          !wordCases.some((word) => word.key === externalKey && drop(word)),
      );
    // A fixture without a trait's untyped initiative (Reactionary's shape on
    // a trait carrying `init` untyped, a TR1 candidate's word).
    expect(
      uncoveredWords(
        base,
        without(
          ({ kind, output }) =>
            kind === 'trait' &&
            output.kind === 'constant' &&
            output.target === 'init' &&
            output.bonusType === 'untyped',
        ),
      ),
    ).toEqual(['trait init untyped constant']);
    // Without a feat's open slot of two (PM1's shape).
    expect(
      uncoveredWords(
        base,
        without(
          ({ kind, output }) =>
            kind === 'feat' &&
            output.kind === 'feat-slot' &&
            output.feats === 'open' &&
            output.count === 2,
        ),
      ),
    ).toEqual(['feat feat-slot open several']);
    // Without every trait case: each trait word.
    expect(
      uncoveredWords(
        base,
        without(({ kind }) => kind === 'trait'),
      ),
    ).toHaveLength(101 + 4);
    // A case whose constant is made zero releases a nonpositive word, not
    // its own.
    expect(
      uncoveredWords(
        base,
        wordBodies.map((body) =>
          body.externalKey === wordCases[0]?.key
            ? {
                ...body,
                modifiers: body.modifiers.map((row) => ({ ...row, value: 0 })),
              }
            : body,
        ),
      ),
    ).toEqual([`${wordCases[0]?.kind} save.will untyped constant`]);
  });

  it('makes a case or an emitted output with no output, two outputs or a bonus rank off a Racial Trait unrepresentable', () => {
    const legal: WordCase[] = [
      {
        key: 'pf1/a',
        name: 'a',
        kind: 'trait',
        output: {
          kind: 'constant',
          target: 'init',
          bonusType: 'trait',
          value: 2,
        },
      },
      {
        key: 'pf1/b',
        name: 'b',
        kind: 'racialTrait',
        output: { kind: 'skill-rank-per-level' },
      },
      {
        key: 'pf1/c',
        name: 'c',
        kind: 'feat',
        output: { kind: 'feat-slot', count: 2, feats: 'open' },
      },
    ];
    const illegal = [
      // @ts-expect-error A case carries one output.
      { key: 'pf1/x', name: 'x', kind: 'feat' } satisfies WordCase,
      {
        key: 'pf1/x',
        name: 'x',
        kind: 'feat',
        // @ts-expect-error One output, not a list.
        output: [{ kind: 'skill-rank-per-level' }],
      } satisfies WordCase,
      {
        key: 'pf1/x',
        name: 'x',
        kind: 'feat',
        output: { kind: 'skill-rank-per-level' },
        // @ts-expect-error Only a Racial Trait's detail carries a bonus rank.
      } satisfies WordCase,
      {
        key: 'pf1/x',
        name: 'x',
        kind: 'trait',
        output: {
          kind: 'constant',
          target: 'init',
          bonusType: 'trait',
          // @ts-expect-error A constant's value is a number.
          value: { formula: '@ability.str.mod' },
        },
      } satisfies WordCase,
    ];
    const modifierRow = { target: 'init', bonusType: 'trait', value: 2 };
    const slot = { kind: 'feat', count: 1 } as const;
    const illegalEmitted = [
      // @ts-expect-error An emitted output is one of its variants.
      {} satisfies EmittedOutput,
      // @ts-expect-error A Modifier output carries one Modifier, not none.
      { kind: 'modifier', modifiers: [] } satisfies EmittedOutput,
      {
        kind: 'modifier',
        // @ts-expect-error Nor two.
        modifiers: [modifierRow, modifierRow],
      } satisfies EmittedOutput,
      {
        kind: 'modifier',
        modifiers: [modifierRow],
        // @ts-expect-error A Modifier output carries no slot beside it.
        grantsSlots: [slot],
      } satisfies EmittedOutput,
      // @ts-expect-error A slot output carries one slot, not none.
      { kind: 'slot', grantsSlots: [] } satisfies EmittedOutput,
      {
        kind: 'slot',
        grantsSlots: [slot],
        // @ts-expect-error A slot output carries no rank beside it.
        bonusSkillRanksPerLevel: 1,
      } satisfies EmittedOutput,
      // @ts-expect-error A rank output is one rank per level.
      { kind: 'rank', bonusSkillRanksPerLevel: 2 } satisfies EmittedOutput,
      // @ts-expect-error And not none.
      { kind: 'rank', bonusSkillRanksPerLevel: 0 } satisfies EmittedOutput,
      {
        kind: 'slot',
        // @ts-expect-error A listed slot lists one feat.
        grantsSlots: [{ kind: 'feat', count: 1, feats: [] }],
      } satisfies EmittedOutput,
    ];
    expect(legal.map((word) => wordOutputs(word))).toEqual([
      {
        kind: 'modifier',
        modifiers: [{ target: 'init', bonusType: 'trait', value: 2 }],
      },
      { kind: 'rank', bonusSkillRanksPerLevel: 1 },
      { kind: 'slot', grantsSlots: [{ kind: 'feat', count: 2 }] },
    ]);
    expect(illegal).toHaveLength(4);
    expect(illegalEmitted).toHaveLength(9);
    // Each case's body carries its one output and nothing beside it.
    for (const word of wordCases) {
      const body = wordBody(word);
      const output = wordOutputs(word);
      expect(
        {
          modifiers: body.modifiers.length,
          slots: 'grantsSlots' in body ? body.grantsSlots.length : 0,
          ranks: Number(asRecord(body.detail).bonusSkillRanksPerLevel ?? 0),
        },
        word.key,
      ).toEqual({
        modifiers: output.kind === 'modifier' ? 1 : 0,
        slots: output.kind === 'slot' ? 1 : 0,
        ranks: output.kind === 'rank' ? 1 : 0,
      });
    }
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

/**
 * The outputs a source change's table pair may import as, one per proven
 * bonus type, in `entryOutputs`'s words.
 */
function pairOutputs(key: string, name: string) {
  const found = tablePair(key, name);
  if (!found) return [];
  const [, shape, output, types] = found.pair;
  if (output === 'feat slot') return [`slot ${found.formula}`];
  if (output === 'rank per level') return ['rank'];
  const value = shape === 'str' ? '@ability.str.mod' : found.formula;
  return types.map((type) => `${output} ${type} ${value}`);
}

/**
 * Whether an entry's outputs are exactly one of each change's possible
 * outputs, each taken once.
 */
function outputsMatch(
  outputs: readonly (string | null)[] | null,
  wanted: readonly (readonly string[])[],
) {
  if (!outputs) return false;
  const left = [...outputs];
  return (
    wanted.every((choices) => {
      const at = left.findIndex(
        (output) => output !== null && choices.includes(output),
      );
      if (at < 0) return false;
      left.splice(at, 1);
      return true;
    }) && !left.length
  );
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

/**
 * How a projection's proven Modifier rows differ from the reviewed admitted
 * control rows: rows missing from it, and reviewed rows whose projected
 * Modifier mechanisms are not exactly the row's.
 */
function projectionAgreement(
  rows: ProjectedRows,
  expected: readonly string[],
  byKey: ReadonlyMap<string, LaunchRow>,
) {
  const proven = new Map(
    rows
      .filter(({ key, mechanisms }) =>
        mechanisms.some((name) => tablePair(key, name)),
      )
      .map(({ key, mechanisms }) => [key, mechanisms]),
  );
  const modifiers = (names: readonly string[]) =>
    names.filter((name) => name.startsWith('Modifier ')).sort();
  return {
    missing: expected.filter((key) => !proven.has(key)),
    mechanisms: expected.filter((key) => {
      const projected = proven.get(key);
      const row = byKey.get(key);
      return (
        projected &&
        row &&
        JSON.stringify(modifiers(projected)) !==
          JSON.stringify(modifiers(modifierNames(row)))
      );
    }),
  };
}

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
      ({ kind }) =>
        kind === 'feat' || kind === 'racialTrait' || kind === 'trait',
    );
    const expected = (pairs: readonly Pair[] = provenPairs) =>
      familyRows
        .filter((row) => {
          if (!named(row, pairs)) return false;
          const { entry, issues } = evidence(row.key);
          const wanted = modifierNames(row).map((name) =>
            pairOutputs(row.key, name),
          );
          return (
            entry !== undefined &&
            asRecord(entry.detail).kind === row.kind &&
            !issues.some(disqualifies) &&
            outputsMatch(entryOutputs(entry), wanted)
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
    // The rank-scaled family proves rank Modifiers on rows this table names
    // no pair for (`launch-rank-modifiers.test.ts`); the control reads the
    // registry without it.
    const registryWithoutRank = launchMechanismProofs.filter(
      ({ family }) => family !== 'rank-modifiers',
    );
    const project = (
      registry: readonly unknown[] = registryWithoutRank,
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
        proofs: { registry: registryWithoutRank, sha256Of: repository },
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
        registryWithoutRank.map((proof) =>
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
          registryWithoutRank,
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
    // The expected admission is the assessment path's, the frozen record of
    // the scope the family's design reviewed, and it comes from the gate's
    // reviewed input, not from the projection under test: a row is admitted
    // only with a confirmed attribution assessment
    // (`attribution-assessments.json`), and every confirmed control row is
    // admitted. A held row is never admitted.
    const { rows } = await committedProjection();
    const confirmed = await confirmedAssessments();
    const expectedAdmitted = control.filter((key) => confirmed.has(key));
    const agreement = (projected: ProjectedRows) =>
      projectionAgreement(projected, expectedAdmitted, byKey);
    const held = control.filter((key) => byKey.get(key)?.holds.length);
    expect(held.filter((key) => confirmed.has(key))).toEqual([]);
    // On the default path (#227): the committed projection, from the real
    // build, still proves a Modifier on every reviewed control row, each with
    // every Modifier mechanism the row names. Negative, over every reviewed
    // row: a projection missing any of them disagrees, naming that row
    // (`expectReviewedScopeAdmitted`).
    expectReviewedScopeAdmitted({
      rows,
      expected: expectedAdmitted,
      agreement,
    });
    // Dropping one Modifier mechanism from an admitted row disagrees too.
    for (const key of expectedAdmitted) {
      const dropped = agreement(
        rows.map((row) => {
          if (row.key !== key) return row;
          const at = row.mechanisms.findIndex((name) =>
            name.startsWith('Modifier '),
          );
          return {
            ...row,
            mechanisms: row.mechanisms.filter((_, index) => index !== at),
          };
        }),
      );
      expect([...dropped.missing, ...dropped.mechanisms], key).toEqual([key]);
    }
  }, 120_000);
});
