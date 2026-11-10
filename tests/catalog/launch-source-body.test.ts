// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import {
  launchMechanismProofSchema,
  launchMechanismProofs,
} from '../../scripts/catalog/launch-mechanism-proofs';
import { bodyOutputs } from '../../scripts/catalog/launch-source-body';
import {
  currentMechanismProofs,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchGate,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import {
  modifierTargets,
  personalBonusTypes,
} from '../../src/lib/character-sheet';
import {
  alternateTraits,
  type Alternate,
  traits as proofTraits,
} from '../source-body-proof-alternates';
import { realEntries, type RealEntry } from './launch-modifier-evidence';
import { pinnedStore } from './pinned-sources';

// Content verification, body S1 (#778): the Source-body family. The inventory
// names `Source body mechanics` for a row with no other mechanism
// (`launch-inventory-build.ts`); the family proves it only for a reviewed,
// admitted feat, Racial Trait or trait whose only mechanism it is, whose
// source bytes and scoped entry's mechanical outputs equal the reviewed ones,
// and whose every output is a Situational Modifier, situational note,
// `countsAsRaces`, `favoredClassCount` or `replaces` on the targets and bonus types the
// public saved-sheet proof (`convex/characterSheetSourceBody.integration.test.ts`)
// covers (body S1, #778; body-ext adds CMB, the saves, ten skills, spell DC,
// the `trait` bonus type and the `trait` kind; body-ext-2 adds damage, melee
// damage and the `circumstance` and `competence` bonus types; body-ext-3 the
// `replaces` kind, an alternate's replaced trait keys). The rows,
// entries and records here are synthetic; the committed control below reads
// the real ones.
const proofTest = 'convex/characterSheetSourceBody.integration.test.ts';
/** The public replacement fixture, bound beside the proof. */
const proofFixture = 'tests/source-body-proof-alternates.ts';
const name = 'Source body mechanics';
const repository = (path: string) => repositoryFileSha256('.', path);
const family = launchMechanismProofs.find(
  (proof) => proof.family === 'source-body',
);

/** The fixed root keys of #778, with their names. */
const listedRows = [
  ['pf1-content/iBCPIWFExt679Zhh', 'Defensive Training (Dwarf)'],
  ['pf1-content/IQ5vHUbNbGqVaVV5', 'Defensive Training (Gnome)'],
  ['pf1-content/yQvZ03xcsuM8b595', 'Elven Immunities (Elf)'],
  ['pf1-content/oTQL4P3IdoJQAkOB', 'Elven Immunities (Half-Elf)'],
  ['pf1-content/bRO90tmeaH1tFi2g', 'Elven Magic (Elf)'],
  ['pf1-content/qoCLqjadKmJEN9R7', 'Fearless (Halfling)'],
  ['pf1-content/2F4IRW8AAicQ3VYc', 'Greed (Dwarf)'],
  ['pf1-content/AO5nhhUfI1b4M37H', 'Hardy'],
  ['pf1-content/JtJKg8vV58UJ6m1m', 'Hatred (Dwarf)'],
  ['pf1-content/FD2SILZXcIMjauvr', 'Hatred (Gnome)'],
  ['pf1-content/YHwpeek5IHtcZNDF', 'Illusion Resistance'],
  ['pf1-content/T4PaZ33R29gTAFaT', 'Stability (Dwarf)'],
  ['pf1-content/6JCG0ei0s0ossrtx', 'Stonecunning (Dwarf)'],
  ['pf1/u7rGDZUL296QIuA0', 'Combat Casting'],
  ['pf1/nWFr8SNcjcMqsXSH', 'Spell Penetration'],
  ['pf1/8rsFtye3PwM6CKli', 'Point-Blank Shot'],
  ['pf1-content/rzYk40R1rWSfay4a', 'Elf Blood'],
  ['pf1-content/JWzMBJeAQYDav9gw', 'Orc Blood'],
  ['pf1-content/srOpqbXesXBuvTqe', 'Multitalented'],
] as const;

const sourceBody = (): LaunchRow['mechanisms'][number] => ({
  name,
  disposition: 'calculated',
  status: 'outstanding',
  contract:
    'The owning batch must prove every promised sheet mechanic in the full source body through the public saved-sheet boundary; absence of raw Modifiers is not a prose exception.',
  evidence: ['row.sources'],
});
const source = 'e'.repeat(64);
type Row = Parameters<typeof verifyLaunchRows>[0]['rows'][number];
function bodyRow(key: string, kind: string, change: Partial<Row> = {}) {
  return {
    key,
    kind,
    catalogKey: key,
    requirement: 'required' as const,
    holds: [],
    mechanisms: [sourceBody()],
    sources: [
      {
        repository: key.startsWith('pf1-content/')
          ? ('pf1-content' as const)
          : ('pf1' as const),
        pin: 'baseline',
        locator: `src/${key}.yaml`,
        rawSha256: source,
        effectiveSha256: source,
      },
    ],
    noticeEvidence: { state: 'unreviewed' as const, evidence: ['row.sources'] },
    ...change,
  } satisfies Row;
}
const traitDetail = {
  kind: 'racialTrait',
  bonusSkillRanksPerLevel: 0,
  raceKeys: ['pf1/proofRace'],
  standard: true,
};
const featDetail = { kind: 'feat', featTypes: ['General'], repeatable: 'no' };
const traitKindDetail = { kind: 'trait', traitType: 'combat' };
/** The targets body-ext adds, each with a case in the public proof. */
const extensionTargets = [
  'cmb',
  'save.fort',
  'save.ref',
  'save.will',
  'skill.blf',
  'skill.crf',
  'skill.dev',
  'skill.dip',
  'skill.esc',
  'skill.kpl',
  'skill.pro',
  'skill.sen',
  'skill.slt',
  'skill.sur',
  'spellDC',
] as const;
/** The targets body S1 proved. */
const priorTargets = [
  'saves',
  'ac',
  'cmd',
  'skill.apr',
  'skill.per',
  'skill.spl',
  'attack',
  'attack.ranged',
  'damage.ranged',
  'casterLevel',
  'concentration',
] as const;
/** The targets body-ext-2 adds, each with a case in the public proof. */
const damageTargets = ['damage', 'damage.melee'] as const;
const provenTargets: readonly string[] = [
  ...priorTargets,
  ...extensionTargets,
  ...damageTargets,
];
/** The bonus types body-ext-2 adds, each with a case in the public proof. */
const extensionBonusTypes = ['circumstance', 'competence'] as const;
const provenBonusTypes: readonly string[] = [
  'racial',
  'dodge',
  'untyped',
  'trait',
  ...extensionBonusTypes,
];
/** Every app target and bonus type the public proof does not cover. */
const unprovenTargets = modifierTargets.filter(
  (target) => !provenTargets.includes(target),
);
const unprovenBonusTypes = personalBonusTypes.filter(
  (bonusType) => !provenBonusTypes.includes(bonusType),
);
/** A scoped entry with its outputs and any other change. */
function bodyEntry(
  key: string,
  detail: Record<string, unknown>,
  change: Record<string, unknown> = {},
) {
  return {
    externalKey: key,
    upstreamKey: key.split('/')[1],
    pack:
      detail.kind === 'feat'
        ? 'feats'
        : detail.kind === 'trait'
          ? 'pf-traits'
          : 'racial-traits',
    name: key,
    detail,
    description: '',
    sources: [{ book: 'PZO1110' }],
    modifiers: [],
    unsupported: [],
    ...change,
  };
}

// Synthetic rows: a Racial Trait with a shared-Situation saves Modifier and a
// note (Hardy's shape), a Racial Trait counting as another race (Elf
// Blood's), a feat with a local-Situation concentration Modifier (Combat
// Casting's), a trait with a trait bonus on saves against fear
// (Courageous's), and a control identical to the first but not reviewed.
const keys = {
  saves: 'pf1-content/proofSaves',
  counts: 'pf1-content/proofCounts',
  casting: 'pf1/proofCasting',
  courage: 'pf1-content/proofCourage',
  control: 'pf1-content/proofControl',
};
const savesModifier = {
  target: 'saves',
  bonusType: 'racial',
  value: 2,
  condition: { situation: 'poison' },
};
const savesOutputs = {
  modifiers: [savesModifier],
  situationalNotes: [{ text: 'Immune to proof poison.' }],
};
const countsOutputs = { countsAsRaces: ['pf1/proofRace'] };
const castingOutputs = {
  modifiers: [
    {
      target: 'concentration',
      bonusType: 'untyped',
      value: 4,
      condition: { situation: { local: 'casting defensively' } },
    },
  ],
};
const courageModifier = {
  target: 'saves',
  bonusType: 'trait',
  value: 2,
  condition: { situation: 'fear' },
};
const courageOutputs = { modifiers: [courageModifier] };
const synthetic = [
  { key: keys.saves, kind: 'racialTrait', outputs: savesOutputs },
  { key: keys.counts, kind: 'racialTrait', outputs: countsOutputs },
  { key: keys.casting, kind: 'feat', outputs: castingOutputs },
  { key: keys.courage, kind: 'trait', outputs: courageOutputs },
];
const reviewedRecord = (
  key: string,
  outputs: unknown,
  change: Record<string, unknown> = {},
) => ({
  key,
  name: key,
  sourceSha256: source,
  outputs,
  basis: 'Synthetic.',
  body: 'situational-modifiers',
  ...change,
});
const syntheticReviewed = synthetic.map(({ key, outputs }) =>
  reviewedRecord(key, outputs),
);
const detailOf = (kind: string) =>
  kind === 'feat'
    ? featDetail
    : kind === 'trait'
      ? traitKindDetail
      : traitDetail;

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? { ...value } : {};
const isFamily = (proof: unknown) => asObject(proof).family === 'source-body';

/** The registry with the family's reviewed list (and scope) replaced. */
function withReviewed(
  reviewed: unknown[],
  scope: Record<string, unknown> = {},
): unknown[] {
  if (!family || !('body' in family))
    throw new Error('Missing the source-body family');
  return launchMechanismProofs.map((proof) =>
    proof === family
      ? { ...family, body: { ...family.body, reviewed, ...scope } }
      : proof,
  );
}

const admittedGate = (keysAdmitted: readonly string[]): LaunchGate => ({
  admitted: keysAdmitted.map((externalKey) => ({
    externalKey,
    reason: 'Admitted.',
  })),
  held: [],
  dependentOmissions: [],
  retainedExceptions: [],
  failures: [],
});
function projectionInput(
  change: Partial<LaunchVerificationInput> = {},
): LaunchVerificationInput {
  return {
    admission: admittedGate(Object.values(keys)),
    scopeBuild: { entries: [], remaps: new Map(), resources: new Map() },
    unsupported: { entries: [] },
    proofs: { registry: withReviewed(syntheticReviewed), sha256Of: repository },
    proseCases: [],
    calculationIdentity: currentCalculationIdentity,
    stale: [],
    ...change,
  };
}
const baseRows = () => [
  ...synthetic.map(({ key, kind }) => bodyRow(key, kind)),
  bodyRow(keys.control, 'racialTrait'),
];
const baseEntries = () => [
  ...synthetic.map(({ key, kind, outputs }) =>
    bodyEntry(key, detailOf(kind), outputs),
  ),
  bodyEntry(keys.control, traitDetail, savesOutputs),
];
/** Each row's proven mechanisms, keyed by row. */
function proven({
  rows = baseRows(),
  entries = baseEntries(),
  ...change
}: Partial<LaunchVerificationInput> & {
  rows?: Row[];
  entries?: unknown[];
} = {}) {
  return Object.fromEntries(
    verifyLaunchRows(
      { rows, edges: [] },
      projectionInput({
        scopeBuild: { entries, remaps: new Map(), resources: new Map() },
        ...change,
      }),
    ).map(({ key, mechanisms }) => [key, mechanisms]),
  );
}

/** The trait row's proven mechanisms, its entry and review changed. */
function courageProven(
  outputs: Record<string, unknown>,
  {
    reviewed = outputs,
    detail = traitKindDetail,
  }: { reviewed?: unknown; detail?: Record<string, unknown> } = {},
) {
  return proven({
    entries: baseEntries().map((entry) =>
      entry.externalKey === keys.courage
        ? bodyEntry(keys.courage, detail, outputs)
        : entry,
    ),
    proofs: {
      registry: withReviewed(
        syntheticReviewed.map((record) =>
          record.key === keys.courage
            ? reviewedRecord(keys.courage, reviewed)
            : record,
        ),
      ),
      sha256Of: repository,
    },
  })[keys.courage];
}
/** The trait row's outputs: its one Modifier changed. */
const withModifier = (change: Record<string, unknown>) => ({
  modifiers: [{ ...courageModifier, ...change }],
});
/** Whether the family parses with the trait row's record holding these. */
const courageParses = (outputs: unknown) =>
  launchMechanismProofSchema.safeParse(
    withReviewed([reviewedRecord(keys.courage, outputs)]).find(isFamily),
  ).success;

describe('the Source-body family', () => {
  it('names its public saved-sheet proof with its current bytes, the current calculation identity, its scope and its reviewed rows', () => {
    // The registry's whole family list is pinned once, in
    // `launch-mechanism-registry.test.ts`.
    expect(
      launchMechanismProofs.filter((proof) => proof.family === 'source-body'),
    ).toEqual([family]);
    expect(family).toMatchObject({
      mechanism: name,
      kinds: ['feat', 'racialTrait', 'trait'],
      tests: [{ path: proofTest }, { path: proofFixture }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['*'],
      body: {
        outputs: [
          'situationalModifier',
          'situationalNote',
          'countsAsRaces',
          'favoredClassCount',
          'replaces',
        ],
        targets: [...priorTargets, ...extensionTargets, ...damageTargets],
        bonusTypes: [
          'racial',
          'dodge',
          'untyped',
          'trait',
          'circumstance',
          'competence',
        ],
        mostReplaced: 3,
      },
    });
    const reviewed = family && 'body' in family ? family.body.reviewed : [];
    expect(reviewed.map(({ key, name: rowName }) => [key, rowName])).toEqual(
      listedRows,
    );
    expect(
      currentMechanismProofs({
        registry: launchMechanismProofs,
        sha256Of: repository,
      }),
    ).toContainEqual(family);
    // The entry with its test file's or its fixture's bytes changed proves
    // nothing.
    for (const changed of [proofTest, proofFixture])
      expect(
        currentMechanismProofs({
          registry: launchMechanismProofs,
          sha256Of: (path) =>
            path === changed ? 'e'.repeat(64) : repository(path),
        }),
        changed,
      ).not.toContainEqual(family);
  });

  it('proves a reviewed admitted row whose mechanical outputs equal its reviewed outputs', () => {
    expect(proven()).toEqual({
      [keys.saves]: [name],
      [keys.counts]: [name],
      [keys.casting]: [name],
      [keys.courage]: [name],
      [keys.control]: [],
    });
  });

  it('refuses a reviewed record with no outputs, or with an output of an unproven kind or shape', () => {
    const parses = (outputs: unknown) =>
      launchMechanismProofSchema.safeParse(
        withReviewed([reviewedRecord(keys.saves, outputs)]).find(isFamily),
      ).success;
    expect(parses(savesOutputs)).toBe(true);
    for (const [label, outputs] of [
      ['no outputs', {}],
      ['an empty Modifier list', { modifiers: [] }],
      ['an empty note list', { situationalNotes: [] }],
      ['an empty race list', { countsAsRaces: [] }],
      ['proficiencies', { proficiencies: [{ baseType: 'Longsword' }] }],
      ['a feat slot', { grantsSlots: [{ kind: 'feat', count: 1 }] }],
      ['prerequisites', { prerequisites: [{ bab: 1, kind: 'bab' }] }],
      ['bonus skill ranks', { detail: { bonusSkillRanksPerLevel: 1 } }],
      ['one favored class', { detail: { favoredClassCount: 1 } }],
      [
        'an unconditional Modifier',
        { modifiers: [{ ...savesModifier, condition: undefined }] },
      ],
      [
        'a formula',
        { modifiers: [{ ...savesModifier, value: { formula: '@cl' } }] },
      ],
      ...['weapon', 'school', 'castingClass', 'option', 'whileActive'].map(
        (condition): [string, unknown] => [
          `a ${condition} condition`,
          {
            modifiers: [
              {
                ...savesModifier,
                condition: { situation: 'poison', [condition]: '$self' },
              },
            ],
          },
        ],
      ),
      [
        'an option Situation',
        {
          modifiers: [
            { ...savesModifier, condition: { situation: { option: 'pf1/x' } } },
          ],
        },
      ],
      [
        'a note with a condition',
        { situationalNotes: [{ text: 'x', condition: { weapon: '$self' } }] },
      ],
      ['one of several races', { countsAsRaces: { oneOf: ['pf1/proofRace'] } }],
    ] as const)
      expect(parses(outputs), label).toBe(false);
  });

  it('proves each target body-ext adds with each proven bonus type, the trait bonus type on every proven target, and refuses an unproven target, an unproven type or a formula', () => {
    expect(courageProven(courageOutputs)).toEqual([name]);
    for (const target of extensionTargets) {
      for (const bonusType of provenBonusTypes)
        expect(
          courageProven(withModifier({ target, bonusType })),
          `${target} ${bonusType}`,
        ).toEqual([name]);
      // A local Situation, and a note on the target.
      expect(
        courageProven(
          withModifier({ target, condition: { situation: { local: 'x' } } }),
        ),
        `${target} local`,
      ).toEqual([name]);
      expect(
        courageProven({
          ...withModifier({ target }),
          situationalNotes: [{ text: 'x', target }],
        }),
        `${target} note`,
      ).toEqual([name]);
      // A wrong type, entry and review alike.
      for (const bonusType of unprovenBonusTypes)
        expect(
          courageProven(withModifier({ target, bonusType })),
          `${target} ${bonusType}`,
        ).toEqual([]);
      // A formula: no record holds one, and an entry with one differs from
      // the constant reviewed.
      const formula = withModifier({ target, value: { formula: '@cl' } });
      expect(courageParses(formula), `${target} formula`).toBe(false);
      expect(
        courageProven(formula, { reviewed: withModifier({ target }) }),
        `${target} formula`,
      ).toEqual([]);
      // Unconditional: the family proves Situational Modifiers only.
      expect(
        courageProven(withModifier({ target, condition: undefined })),
        `${target} unconditional`,
      ).toEqual([]);
      // The entry's target or type differs from the review's.
      for (const [label, change] of [
        ['target', { target: target === 'cmb' ? 'cmd' : 'cmb' }],
        ['type', { target, bonusType: 'racial' }],
      ] as const)
        expect(
          courageProven(withModifier(change), {
            reviewed: withModifier({ target }),
          }),
          `${target} another ${label}`,
        ).toEqual([]);
    }
    // The trait bonus type on each target body S1 proved.
    for (const target of priorTargets)
      expect(
        courageProven(withModifier({ target })),
        `${target} trait`,
      ).toEqual([name]);
    // A wrong target, as a Modifier or a note, entry and review alike.
    expect(unprovenTargets).toEqual(
      expect.arrayContaining([
        'init',
        'skills',
        'skill.acr',
        'attack.melee',
        'bab',
        'hp',
      ]),
    );
    for (const target of unprovenTargets) {
      expect(courageProven(withModifier({ target })), target).toEqual([]);
      expect(
        courageProven({
          ...courageOutputs,
          situationalNotes: [{ text: 'x', target }],
        }),
        `${target} note`,
      ).toEqual([]);
    }
  });

  it('proves damage and melee damage with each proven bonus type, the circumstance and competence types on every proven target, and refuses a formula, an unconditional Modifier or another target or type', () => {
    for (const target of damageTargets) {
      for (const bonusType of provenBonusTypes)
        expect(
          courageProven(withModifier({ target, bonusType })),
          `${target} ${bonusType}`,
        ).toEqual([name]);
      // A local Situation, and a note on the target (Brute's and Flame of
      // the Dawnflower's shapes).
      expect(
        courageProven(
          withModifier({ target, condition: { situation: { local: 'x' } } }),
        ),
        `${target} local`,
      ).toEqual([name]);
      expect(
        courageProven({
          ...withModifier({ target }),
          situationalNotes: [{ text: 'x', target }],
        }),
        `${target} note`,
      ).toEqual([name]);
      for (const bonusType of unprovenBonusTypes)
        expect(
          courageProven(withModifier({ target, bonusType })),
          `${target} ${bonusType}`,
        ).toEqual([]);
    }
    for (const bonusType of extensionBonusTypes)
      for (const target of provenTargets)
        expect(
          courageProven(withModifier({ target, bonusType })),
          `${target} ${bonusType}`,
        ).toEqual([name]);
    // A competence Modifier marked to add to its entry's own bonus (Shielded
    // Caster's shape): the public proof shows the mark on a competence type.
    const shielded = {
      modifiers: [
        {
          ...courageModifier,
          target: 'concentration',
          bonusType: 'competence',
        },
        {
          ...courageModifier,
          target: 'concentration',
          bonusType: 'competence',
          value: 1,
          condition: { situation: { local: 'x' } },
          stacksWithinEntry: true,
        },
      ],
    };
    expect(courageParses(shielded)).toBe(true);
    expect(courageProven(shielded)).toEqual([name]);
    // The constant-value rule, an unconditional Modifier, and an entry
    // whose target or type differs from the review's.
    for (const [target, bonusType] of [
      ...damageTargets.map((target) => [target, 'trait'] as const),
      ...extensionBonusTypes.map((bonusType) => ['attack', bonusType] as const),
    ]) {
      const label = `${target} ${bonusType}`;
      const formula = withModifier({
        target,
        bonusType,
        value: { formula: '@cl' },
      });
      expect(courageParses(formula), `${label} formula`).toBe(false);
      expect(
        courageProven(formula, {
          reviewed: withModifier({ target, bonusType }),
        }),
        `${label} formula`,
      ).toEqual([]);
      expect(
        courageProven(
          withModifier({ target, bonusType, condition: undefined }),
        ),
        `${label} unconditional`,
      ).toEqual([]);
      for (const [other, change] of [
        ['target', { target: target === 'damage' ? 'damage.melee' : 'damage' }],
        ['type', { target, bonusType: 'racial' }],
      ] as const)
        expect(
          courageProven(withModifier({ bonusType, ...change }), {
            reviewed: withModifier({ target, bonusType }),
          }),
          `${label} another ${other}`,
        ).toEqual([]);
    }
    // Ranged damage stays proven; the damage leaves no other one in scope.
    expect(provenTargets).toContain('damage.ranged');
    expect(unprovenTargets).not.toEqual(expect.arrayContaining(['damage']));
  });

  it('proves a trait only through a valid trait entry whose every field is known, and never its Requirements as prerequisites', () => {
    const courageProven = (entry: unknown, row?: Row) =>
      proven({
        rows: baseRows().map((other) =>
          other.key === keys.courage ? (row ?? other) : other,
        ),
        entries: baseEntries().map((other) =>
          other.externalKey === keys.courage ? entry : other,
        ),
      })[keys.courage];
    const courageEntry = (
      change: Record<string, unknown> = {},
      detail: Record<string, unknown> = traitKindDetail,
    ) => bodyEntry(keys.courage, detail, { ...courageOutputs, ...change });
    expect(courageProven(courageEntry())).toEqual([name]);
    for (const [label, entry, row] of [
      ['no trait type', courageEntry({}, { kind: 'trait' }), undefined],
      [
        'a detail field the projection does not know',
        courageEntry({}, { ...traitKindDetail, classSkills: ['skill.per'] }),
        undefined,
      ],
      [
        'a deity prerequisite',
        courageEntry({
          prerequisiteText: 'Iomedae',
          prerequisites: [{ deity: 'Iomedae', kind: 'deity' }],
        }),
        undefined,
      ],
      [
        'an unchecked prerequisite',
        courageEntry({
          prerequisiteText: 'Desna',
          prerequisites: [{ unchecked: 'Desna', kind: 'unchecked' }],
        }),
        undefined,
      ],
      ['a feat entry', courageEntry({}, featDetail), undefined],
      ['a feat row', courageEntry(), bodyRow(keys.courage, 'feat')],
    ] as const)
      expect(courageProven(entry, row), label).toEqual([]);
    // Prerequisites are no proven output kind, so no record lists them.
    expect(
      launchMechanismProofSchema.safeParse(
        withReviewed([
          reviewedRecord(keys.courage, {
            ...courageOutputs,
            prerequisites: [{ deity: 'Iomedae', kind: 'deity' }],
          }),
        ]).find(isFamily),
      ).success,
    ).toBe(false);
  });

  it('proves an alternate Racial Trait only when its record names exactly the replaced trait keys its entry carries, each a standard trait of its one race, and refuses a wrong, missing or extra key, a foreign or missing replaced trait, more than the scope certifies, a replaces with no record, an unresolved replacement and replaces on a feat or trait', () => {
    // An alternate shaped as Stubborn: the saves trait's body, replacing two
    // standard traits (its entry's `detail.replaces`, stable keys).
    const replaced = ['pf1-content/proofHardy', 'pf1-content/proofLuck'];
    const alternateDetail = (change: Record<string, unknown> = {}) => ({
      ...traitDetail,
      standard: false,
      replaces: replaced,
      ...change,
    });
    const alternateOutputs = (keysReplaced: unknown = replaced) => ({
      ...savesOutputs,
      detail: { replaces: keysReplaced },
    });
    /** A standard trait of the proof race, in the build. */
    const standardTrait = (key: string, change: Record<string, unknown> = {}) =>
      bodyEntry(key, { ...traitDetail, ...change });
    const replacedTraits = replaced.map((key) => standardTrait(key));
    /**
     * The saves row's proven mechanisms, its entry and record changed, beside
     * the replaced traits' entries (`build`) and any scope change.
     */
    const savesProven = (
      entry: unknown,
      record: unknown,
      {
        row = bodyRow(keys.saves, 'racialTrait'),
        build = replacedTraits,
        scope = {},
      }: {
        row?: Row;
        build?: unknown[];
        scope?: Record<string, unknown>;
      } = {},
    ) =>
      proven({
        rows: baseRows().map((other) =>
          other.key === keys.saves ? row : other,
        ),
        entries: [
          ...baseEntries().map((other) =>
            other.externalKey === keys.saves ? entry : other,
          ),
          ...build,
        ],
        proofs: {
          registry: withReviewed(
            syntheticReviewed.map((other) =>
              other.key === keys.saves ? record : other,
            ),
            scope,
          ),
          sha256Of: repository,
        },
      })[keys.saves];
    const parses = (outputs: unknown) =>
      launchMechanismProofSchema.safeParse(
        withReviewed([reviewedRecord(keys.saves, outputs)]).find(isFamily),
      ).success;
    const alternateEntry = bodyEntry(
      keys.saves,
      alternateDetail(),
      savesOutputs,
    );
    expect(bodyOutputs(alternateEntry)).toEqual(alternateOutputs());
    expect(
      savesProven(
        alternateEntry,
        reviewedRecord(keys.saves, alternateOutputs()),
      ),
    ).toEqual([name]);
    // `replaces` beside the other kinds, and alone.
    expect(parses({ detail: { replaces: replaced } })).toBe(true);
    expect(
      parses({
        ...countsOutputs,
        detail: { replaces: replaced, favoredClassCount: 2 },
      }),
    ).toBe(true);
    // The record's keys differ from the entry's: wrong, missing, extra,
    // reordered or repeated.
    for (const [label, keysReplaced] of [
      ['a wrong key', ['pf1-content/proofHardy', 'pf1-content/proofOther']],
      ['a missing key', ['pf1-content/proofHardy']],
      ['an extra key', [...replaced, 'pf1-content/proofOther']],
      ['reordered keys', [...replaced].reverse()],
      ['a repeated key', [...replaced, 'pf1-content/proofLuck']],
    ] as const) {
      expect(parses(alternateOutputs(keysReplaced)), label).toBe(true);
      expect(
        savesProven(
          alternateEntry,
          reviewedRecord(keys.saves, alternateOutputs(keysReplaced)),
        ),
        label,
      ).toEqual([]);
    }
    // Each replaced key must be a standard Racial Trait of the alternate's
    // one race, in the build (body-ext-3 fix r1).
    const exact = reviewedRecord(keys.saves, alternateOutputs());
    const [hardy = '', luck = ''] = replaced;
    const otherRace = { raceKeys: ['pf1/proofOtherRace'] };
    for (const [label, entry, build] of [
      [
        'a foreign race’s traits',
        alternateEntry,
        replaced.map((key) => standardTrait(key, otherRace)),
      ],
      [
        'one foreign race’s trait',
        alternateEntry,
        [standardTrait(hardy), standardTrait(luck, otherRace)],
      ],
      [
        'a replaced trait of no race',
        alternateEntry,
        [standardTrait(hardy), standardTrait(luck, { raceKeys: undefined })],
      ],
      [
        'an alternate replaced trait',
        alternateEntry,
        [standardTrait(hardy), standardTrait(luck, { standard: false })],
      ],
      [
        'a replaced trait that isn’t a Racial Trait',
        alternateEntry,
        [standardTrait(hardy), bodyEntry(luck, featDetail)],
      ],
      [
        'a replaced trait missing from the build',
        alternateEntry,
        [standardTrait(hardy)],
      ],
      [
        'an alternate of two races',
        bodyEntry(
          keys.saves,
          alternateDetail({
            raceKeys: ['pf1/proofRace', 'pf1/proofOtherRace'],
          }),
          savesOutputs,
        ),
        replaced.map((key) =>
          standardTrait(key, {
            raceKeys: ['pf1/proofRace', 'pf1/proofOtherRace'],
          }),
        ),
      ],
      [
        'an alternate of no race',
        bodyEntry(
          keys.saves,
          alternateDetail({ raceKeys: undefined }),
          savesOutputs,
        ),
        replacedTraits,
      ],
    ] as const)
      expect(savesProven(entry, exact, { build: [...build] }), label).toEqual(
        [],
      );
    // A replaced trait shared with other races proves, its race among them.
    expect(
      savesProven(alternateEntry, exact, {
        build: replaced.map((key) =>
          standardTrait(key, {
            raceKeys: ['pf1/proofOtherRace', 'pf1/proofRace'],
          }),
        ),
      }),
    ).toEqual([name]);
    // More replaced traits than the scope's `mostReplaced`: four traits are
    // refused under the registry's 3, and prove only under a scratch 4.
    const four = [
      ...replaced,
      'pf1-content/proofRace3',
      'pf1-content/proofRace4',
    ].sort();
    const fourEntry = bodyEntry(
      keys.saves,
      alternateDetail({ replaces: four }),
      savesOutputs,
    );
    const fourRecord = reviewedRecord(keys.saves, alternateOutputs(four));
    const fourBuild = four.map((key) => standardTrait(key));
    expect(savesProven(fourEntry, fourRecord, { build: fourBuild })).toEqual(
      [],
    );
    expect(
      savesProven(fourEntry, fourRecord, {
        build: fourBuild,
        scope: { mostReplaced: 4 },
      }),
    ).toEqual([name]);
    // The entry carries `replaces` and the record doesn't: the reviewed body
    // without its replacement is not this entry's.
    expect(
      savesProven(alternateEntry, reviewedRecord(keys.saves, savesOutputs)),
    ).toEqual([]);
    // The record names replaced keys the entry doesn't carry.
    expect(
      savesProven(
        bodyEntry(keys.saves, traitDetail, savesOutputs),
        reviewedRecord(keys.saves, alternateOutputs()),
      ),
    ).toEqual([]);
    // A record can't hold an empty, malformed or unresolved replacement.
    for (const [label, outputs] of [
      ['no replaced keys', alternateOutputs([])],
      ['a malformed key', alternateOutputs(['Hardy'])],
      [
        'an unresolved replacement',
        { ...savesOutputs, detail: { unresolvedReplacements: ['Hardy'] } },
      ],
      [
        'replaces beside an unresolved replacement',
        {
          ...savesOutputs,
          detail: { replaces: replaced, unresolvedReplacements: ['Hardy'] },
        },
      ],
    ] as const)
      expect(parses(outputs), label).toBe(false);
    // An entry whose replacement the importer left unresolved never proves.
    expect(
      savesProven(
        bodyEntry(
          keys.saves,
          alternateDetail({ replaces: [], unresolvedReplacements: ['Hardy'] }),
          savesOutputs,
        ),
        reviewedRecord(keys.saves, savesOutputs),
      ),
    ).toEqual([]);
    // Only a Racial Trait replaces: a feat or trait entry carrying it, or a
    // feat row, proves nothing.
    for (const [label, entry, row] of [
      [
        'a feat entry',
        bodyEntry(
          keys.saves,
          { ...featDetail, replaces: replaced },
          savesOutputs,
        ),
        undefined,
      ],
      [
        'a trait entry',
        bodyEntry(
          keys.saves,
          { ...traitKindDetail, replaces: replaced },
          savesOutputs,
        ),
        undefined,
      ],
      ['a feat row', alternateEntry, bodyRow(keys.saves, 'feat')],
    ] as const)
      expect(savesProven(entry, exact, row ? { row } : {}), label).toEqual([]);
    // A scope without the kind proves no record holding it.
    expect(
      savesProven(alternateEntry, exact, {
        scope: {
          outputs: [
            'situationalModifier',
            'situationalNote',
            'countsAsRaces',
            'favoredClassCount',
          ],
        },
      }),
    ).toEqual([]);
  });

  it('certifies only replaces shapes the public replacement fixture exercises (the coverage tie)', () => {
    if (!family || !('body' in family))
      throw new Error('Missing the source-body family');
    // What the fixture releases: each alternate's replaced-trait count, and
    // whether every trait it replaces is a standard trait of the proof race.
    const standardTraits: readonly string[] = Object.values(proofTraits);
    const exercised = (alternates: readonly Alternate[]) =>
      new Set(
        alternates.flatMap(({ replaces }) => [
          `replaces ${replaces.length}`,
          ...(replaces.every((key) => standardTraits.includes(key))
            ? ['replaces own-race standard traits']
            : []),
        ]),
      );
    // What a scope certifies, in the same words.
    const certified = (scope: {
      outputs: readonly string[];
      mostReplaced: number;
    }) =>
      scope.outputs.includes('replaces')
        ? [
            ...Array.from(
              { length: scope.mostReplaced },
              (_, index) => `replaces ${index + 1}`,
            ),
            'replaces own-race standard traits',
          ]
        : [];
    const uncovered = (
      scope: { outputs: readonly string[]; mostReplaced: number },
      alternates: readonly Alternate[] = Object.values(alternateTraits),
    ) => {
      const words = exercised(alternates);
      return certified(scope).filter((word) => !words.has(word));
    };
    // The tie: everything the family's scope certifies, the fixture
    // exercises.
    expect(certified(family.body)).toEqual([
      'replaces 1',
      'replaces 2',
      'replaces 3',
      'replaces own-race standard traits',
    ]);
    expect(uncovered(family.body)).toEqual([]);
    // Negative cases, each with exactly its uncovered word: a scratch scope
    // certifying four traits; the fixture without its three-trait alternate,
    // or without its two-trait one; and its alternates replacing a foreign
    // race's traits.
    expect(uncovered({ ...family.body, mostReplaced: 4 })).toEqual([
      'replaces 4',
    ]);
    const without = (label: keyof typeof alternateTraits) =>
      Object.entries(alternateTraits)
        .filter(([other]) => other !== label)
        .map(([, alternate]) => alternate);
    expect(uncovered(family.body, without('skySentinel'))).toEqual([
      'replaces 3',
    ]);
    expect(uncovered(family.body, without('spiritualSupport'))).toEqual([
      'replaces 2',
    ]);
    expect(
      uncovered(
        family.body,
        Object.values(alternateTraits).map((alternate) => ({
          ...alternate,
          replaces: alternate.replaces.map(
            () => 'pf1-content/IQ5vHUbNbGqVaVV5',
          ),
        })),
      ),
    ).toEqual(['replaces own-race standard traits']);
    // A scope without the kind certifies no replacement.
    expect(
      certified({
        ...family.body,
        outputs: family.body.outputs.filter((kind) => kind !== 'replaces'),
      }),
    ).toEqual([]);
  });

  it('keeps the mechanism outstanding for any row, entry, review, gate or evidence that differs from the reviewed proof', () => {
    const savesRow = (change: Partial<Row> = {}) =>
      bodyRow(keys.saves, 'racialTrait', change);
    const savesEntry = (
      change: Record<string, unknown> = savesOutputs,
      detail: Record<string, unknown> = traitDetail,
    ) => bodyEntry(keys.saves, detail, change);
    const reviewedSaves = (outputs: unknown, change = {}) =>
      syntheticReviewed.map((record) =>
        record.key === keys.saves
          ? reviewedRecord(keys.saves, outputs, change)
          : record,
      );
    /** The saves trait's proven mechanisms after one change. */
    function savesProven({
      row,
      entry,
      registry,
      ...change
    }: Partial<LaunchVerificationInput> & {
      row?: Row;
      entry?: unknown;
      registry?: unknown[];
    }) {
      return (
        proven({
          rows: baseRows().map((other) =>
            other.key === keys.saves ? (row ?? other) : other,
          ),
          entries: baseEntries().flatMap((other) =>
            other.externalKey !== keys.saves
              ? [other]
              : entry === undefined
                ? [other]
                : entry === null
                  ? []
                  : [entry],
          ),
          ...(registry ? { proofs: { registry, sha256Of: repository } } : {}),
          ...change,
        })[keys.saves] ?? []
      );
    }
    /** Outputs the entry and the review share, so only the scope refuses. */
    const shared = (outputs: Record<string, unknown>) => ({
      entry: savesEntry(outputs),
      registry: withReviewed(reviewedSaves(outputs)),
    });
    const changedModifier = (change: Record<string, unknown>) =>
      savesEntry({
        ...savesOutputs,
        modifiers: [{ ...savesModifier, ...change }],
      });
    const cases: [string, Parameters<typeof savesProven>[0]][] = [
      // The list and the source bytes.
      [
        'off the reviewed list',
        {
          registry: withReviewed(
            syntheticReviewed.filter(({ key }) => key !== keys.saves),
          ),
        },
      ],
      [
        'a reviewed source hash the row does not bind',
        {
          registry: withReviewed(
            reviewedSaves(savesOutputs, { sourceSha256: 'f'.repeat(64) }),
          ),
        },
      ],
      [
        'changed source bytes',
        {
          row: savesRow({
            sources: [
              {
                repository: 'pf1-content',
                pin: 'baseline',
                locator: 'src/proofSaves.yaml',
                rawSha256: 'f'.repeat(64),
                effectiveSha256: 'f'.repeat(64),
              },
            ],
          }),
        },
      ],
      // The entry's outputs against the reviewed ones.
      [
        'a dropped Modifier',
        { entry: savesEntry({ ...savesOutputs, modifiers: [] }) },
      ],
      ['a dropped note', { entry: savesEntry({ modifiers: [savesModifier] }) }],
      ['another value', { entry: changedModifier({ value: 4 }) }],
      [
        'another bonus type',
        { entry: changedModifier({ bonusType: 'dodge' }) },
      ],
      ['another target', { entry: changedModifier({ target: 'save.will' }) }],
      [
        'another Situation',
        { entry: changedModifier({ condition: { situation: 'fear' } }) },
      ],
      [
        'a local Situation',
        {
          entry: changedModifier({
            condition: { situation: { local: 'poison' } },
          }),
        },
      ],
      ['no Situation', { entry: changedModifier({ condition: undefined }) }],
      ...['weapon', 'school', 'castingClass', 'whileActive'].map(
        (condition): [string, Parameters<typeof savesProven>[0]] => [
          `a ${condition} condition`,
          {
            entry: changedModifier({
              condition: { situation: 'poison', [condition]: '$self' },
            }),
          },
        ],
      ),
      [
        'a Modifier marked to stack within its entry',
        { entry: changedModifier({ stacksWithinEntry: true }) },
      ],
      [
        'an extra note',
        {
          entry: savesEntry({
            ...savesOutputs,
            situationalNotes: [
              ...savesOutputs.situationalNotes,
              { text: 'More.' },
            ],
          }),
        },
      ],
      [
        'a targeted note',
        {
          entry: savesEntry({
            ...savesOutputs,
            situationalNotes: [
              { text: 'Immune to proof poison.', target: 'saves' },
            ],
          }),
        },
      ],
      [
        'added proficiencies',
        {
          entry: savesEntry({
            ...savesOutputs,
            proficiencies: [{ baseType: 'Longsword' }],
          }),
        },
      ],
      [
        'an added feat slot',
        {
          entry: savesEntry({
            ...savesOutputs,
            grantsSlots: [{ kind: 'feat', count: 1 }],
          }),
        },
      ],
      [
        'added prerequisites',
        {
          entry: savesEntry({
            ...savesOutputs,
            prerequisites: [{ bab: 1, kind: 'bab' }],
          }),
        },
      ],
      [
        'added race equivalence',
        {
          entry: savesEntry({
            ...savesOutputs,
            countsAsRaces: ['pf1/proofRace'],
          }),
        },
      ],
      [
        'a bonus skill rank',
        {
          entry: savesEntry(savesOutputs, {
            ...traitDetail,
            bonusSkillRanksPerLevel: 1,
          }),
        },
      ],
      [
        'two favored classes',
        {
          entry: savesEntry(savesOutputs, {
            ...traitDetail,
            favoredClassCount: 2,
          }),
        },
      ],
      [
        'a size',
        { entry: savesEntry(savesOutputs, { ...traitDetail, size: 'small' }) },
      ],
      [
        'replaced traits',
        {
          entry: savesEntry(savesOutputs, {
            ...traitDetail,
            standard: false,
            replaces: ['pf1-content/proofOther'],
          }),
        },
      ],
      [
        'an entry field the projection does not know',
        { entry: savesEntry({ ...savesOutputs, grantsBuffs: ['pf1/x'] }) },
      ],
      [
        'a detail field the projection does not know',
        {
          entry: savesEntry(savesOutputs, {
            ...traitDetail,
            senses: ['lowLight'],
          }),
        },
      ],
      [
        'a reviewed output the entry lacks',
        {
          registry: withReviewed(
            reviewedSaves({
              ...savesOutputs,
              countsAsRaces: ['pf1/proofRace'],
            }),
          ),
        },
      ],
      // Outputs both share that the scope does not cover.
      ...unprovenTargets.map(
        (target): [string, Parameters<typeof savesProven>[0]] => [
          `a ${target} Modifier`,
          shared({ modifiers: [{ ...savesModifier, target }] }),
        ],
      ),
      ...unprovenBonusTypes.map(
        (bonusType): [string, Parameters<typeof savesProven>[0]] => [
          `a ${bonusType} bonus`,
          shared({ modifiers: [{ ...savesModifier, bonusType }] }),
        ],
      ),
      [
        'a note targeting init',
        shared({ situationalNotes: [{ text: 'x', target: 'init' }] }),
      ],
      [
        'an unconditional Modifier',
        shared({ modifiers: [{ ...savesModifier, condition: undefined }] }),
      ],
      [
        'a kind the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, {
            outputs: [
              'situationalModifier',
              'countsAsRaces',
              'favoredClassCount',
            ],
          }),
        },
      ],
      [
        'a target the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, { targets: ['ac', 'cmd'] }),
        },
      ],
      [
        'a bonus type the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, { bonusTypes: ['dodge'] }),
        },
      ],
      // The row's mechanisms.
      [
        'a second mechanism',
        {
          row: savesRow({
            mechanisms: [
              sourceBody(),
              { ...sourceBody(), name: 'Modifier will 2' },
            ],
          }),
        },
      ],
      [
        'two Source body mechanics',
        { row: savesRow({ mechanisms: [sourceBody(), sourceBody()] }) },
      ],
      // Issues: the family names every field.
      ...[
        'gameContent',
        'curation.mechanics',
        'changes',
        'racialTraitRule',
      ].map((field): [string, Parameters<typeof savesProven>[0]] => [
        `a ${field} issue`,
        {
          unsupported: {
            entries: [{ externalKey: keys.saves, issues: [{ field }] }],
          },
        },
      ]),
      // The gate and the evidence.
      [
        'an unadmitted row',
        {
          admission: admittedGate(
            Object.values(keys).filter((key) => key !== keys.saves),
          ),
        },
      ],
      [
        'changed test bytes',
        {
          proofs: {
            registry: withReviewed(syntheticReviewed),
            sha256Of: (path) =>
              path === proofTest ? 'e'.repeat(64) : repository(path),
          },
        },
      ],
      [
        'another calculation identity',
        { calculationIdentity: `sha256:${'f'.repeat(64)}` },
      ],
      // The entry and row kinds.
      ['no scoped entry', { entry: null }],
      [
        'an entry of another kind',
        { entry: savesEntry(savesOutputs, featDetail) },
      ],
      [
        'one of several races',
        {
          entry: savesEntry({
            ...savesOutputs,
            countsAsRaces: { oneOf: ['pf1/proofRace'] },
          }),
        },
      ],
      [
        'a trait row with a Racial Trait entry',
        { row: savesRow({ kind: 'trait' }) },
      ],
      [
        'a Racial Trait row with a trait entry',
        { entry: savesEntry(savesOutputs, traitKindDetail) },
      ],
      [
        'a class feature carrying the mechanism',
        {
          row: savesRow({ kind: 'classFeature' }),
          entry: savesEntry(savesOutputs, { kind: 'classFeature' }),
        },
      ],
    ];
    expect(savesProven({})).toEqual([name]);
    for (const [label, change] of cases)
      expect(savesProven(change), label).toEqual([]);
    // Even a registry entry widened to other kinds proves only feats,
    // Racial Traits and traits.
    const widened = withReviewed(syntheticReviewed).map((proof) =>
      isFamily(proof)
        ? {
            ...asObject(proof),
            kinds: ['feat', 'racialTrait', 'trait', 'classFeature'],
          }
        : proof,
    );
    for (const [kind, detail] of [
      ['classFeature', { kind: 'classFeature' }],
      ['spell', { kind: 'spell' }],
    ] as const)
      expect(
        savesProven({
          registry: widened,
          row: savesRow({ kind }),
          entry: savesEntry(savesOutputs, detail),
        }),
        kind,
      ).toEqual([]);
    expect(
      savesProven({ registry: widened, row: savesRow({ kind: 'feat' }) }),
      'a feat row with a Racial Trait entry',
    ).toEqual([]);
  });

  it('never proves Source body mechanics from a named entry without the reviewed list', () => {
    const entry = (change: Record<string, unknown> = {}) => ({
      family: 'unscoped',
      mechanism: name,
      kinds: ['feat', 'racialTrait', 'trait'],
      tests: [{ path: proofTest, sha256: repository(proofTest) }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: [],
      ...change,
    });
    const without = launchMechanismProofs.filter(
      (proof) => proof.family !== 'source-body',
    );
    const besideFamily = {
      [keys.saves]: [name],
      [keys.counts]: [name],
      [keys.casting]: [name],
      [keys.courage]: [name],
      [keys.control]: [],
    };
    const none = {
      [keys.saves]: [],
      [keys.counts]: [],
      [keys.casting]: [],
      [keys.courage]: [],
      [keys.control]: [],
    };
    for (const [label, registry, expected] of [
      ['an unscoped entry', [...without, entry()], none],
      [
        'a scoped Racial Trait entry',
        [
          ...without,
          entry({
            scope: { detailKind: 'racialTrait', nonEmpty: [], empty: [] },
          }),
        ],
        none,
      ],
      [
        'beside the family',
        [...withReviewed(syntheticReviewed), entry()],
        besideFamily,
      ],
    ] as const)
      expect(
        proven({ proofs: { registry: [...registry], sha256Of: repository } }),
        label,
      ).toEqual(expected);
    // The same unscoped entry for another mechanism still proves it.
    const other = bodyRow('pf1/proofOther', 'feat', {
      mechanisms: [{ ...sourceBody(), name: 'Other mechanism' }],
    });
    expect(
      proven({
        rows: [other],
        entries: [bodyEntry(other.key, featDetail)],
        admission: admittedGate([other.key]),
        proofs: {
          registry: [...without, entry({ mechanism: 'Other mechanism' })],
          sha256Of: repository,
        },
      }),
    ).toEqual({ [other.key]: ['Other mechanism'] });
  });
});

// The committed control: the real listed rows, re-imported from the pinned
// store by the current importer with its context packs
// (`launch-modifier-evidence.ts`), and the committed inventory's every row
// carrying the mechanism.

/** A row's one Foundry source, when the pinned store holds it. */
function storedSource(row: LaunchRow) {
  const [bound, ...others] = row.sources.filter(
    ({ repository: repo }) => repo === 'pf1' || repo === 'pf1-content',
  );
  return bound &&
    !others.length &&
    existsSync(join(pinnedStore, bound.repository, bound.locator))
    ? bound
    : undefined;
}

/**
 * A row carrying the mechanism with no stored source gets a best-case entry
 * of its own kind: one Situational saves Modifier, so only the list can
 * refuse it.
 */
const bestCase = (row: LaunchRow) =>
  bodyEntry(
    row.key,
    ['feat', 'racialTrait', 'trait'].includes(row.kind)
      ? detailOf(row.kind)
      : { kind: row.kind },
    { modifiers: [savesModifier] },
  );

/** The family's reviewed list. */
function reviewedList() {
  if (!family || !('body' in family))
    throw new Error('Missing the source-body family');
  return family.body.reviewed;
}

/**
 * The committed inventory with the current importer's evidence for every row
 * carrying the mechanism whose source the store holds and every standard
 * trait their alternates replace, and the rows that
 * prove it under a registry with every catalog row admitted: real entries
 * where the store holds the source, best-case ones elsewhere. Loaded once.
 */
async function readControl() {
  const committed = parseLaunchInventory(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
    ),
  );
  const catalogRows = committed.rows.filter(
    ({ catalogKey, key }) => catalogKey && !/^(?:notice|rule)\//.test(key),
  );
  const carrying = catalogRows.filter(({ mechanisms }) =>
    mechanisms.some((mechanism) => mechanism.name === name),
  );
  const stored = carrying.filter((row) => storedSource(row));
  const real: Map<string, RealEntry> = await realEntries(stored);
  // The standard traits the carrying alternates replace, re-imported too, so
  // the family reads each replaced trait's race as the build gives it.
  const replacedKeys = new Set(
    [...real.values()].flatMap(({ entry }) => {
      const { replaces } = asObject(asObject(entry).detail);
      return Array.isArray(replaces) ? replaces : [];
    }),
  );
  const replaced: Map<string, RealEntry> = await realEntries(
    catalogRows.filter(
      (row) =>
        replacedKeys.has(row.key) && !real.has(row.key) && storedSource(row),
    ),
  );
  const entries = (best: boolean) => [
    ...[...real.values(), ...replaced.values()].flatMap(({ entry }) =>
      entry ? [entry] : [],
    ),
    ...(best ? carrying.filter(({ key }) => !real.has(key)).map(bestCase) : []),
  ];
  const project = (registry: readonly unknown[], best = true) =>
    verifyLaunchRows(committed, {
      ...projectionInput(),
      admission: admittedGate(catalogRows.map(({ key }) => key)),
      scopeBuild: {
        entries: entries(best),
        remaps: new Map(),
        resources: new Map(),
      },
      unsupported: {
        entries: [...real].map(([externalKey, { issues }]) => ({
          externalKey,
          issues,
        })),
      },
      proofs: { registry, sha256Of: repository },
    })
      .filter(({ mechanisms }) => mechanisms.includes(name))
      .map(({ key }) => key)
      .sort();
  return { carrying, real, project };
}
/** What a listed row's check reads of its row and real evidence. */
function listedEvidence(row: LaunchRow | undefined, evidence?: RealEntry) {
  if (!row || !evidence) throw new Error('Missing a listed row');
  return {
    kind: row.kind,
    requirement: row.requirement,
    mechanisms: row.mechanisms.map((mechanism) => mechanism.name),
    source: storedSource(row)?.rawSha256,
    outputs: bodyOutputs(evidence.entry),
    issues: evidence.issues,
  };
}
/**
 * The pinned corpus's carrying rows with a casting-target output, and what
 * the family does with each listed alone. Proven: Situational Modifiers on
 * covered types (Elven Magic, Spell Penetration and Combat Casting are on the
 * list; Charming, Gifted Adept and, since body-ext-2's competence type,
 * Shielded Caster would join by a list amendment), and, since body-ext-3's
 * `replaces` kind, seven alternate Racial Traits (Aquatic Mastery, Arcane
 * Focus, Projection, a Shadowplay, Shadowplay (Gnome), Spiritual Support,
 * Unstoppable Magic). Refused by the record schema: Spell Focus's school
 * condition. Refused by the family: an unproven target (Creepy's
 * Intimidate, Dragon Scholar's Knowledge (arcana), Keeper of Secrets'
 * Linguistics), an `unsupported` issue (Fey Magic (Gnome - HftF), Magical
 * Linguist (Gnome), the other Shadowplay and Shadowplay (Half-Orc):
 * `gameContent`), and Elemental Focus's `curation.mechanics` issue. Two
 * rows are named Shadowplay.
 */
const castingVerdicts: [string, string][] = [
  ['Aquatic Mastery', 'proven'],
  ['Arcane Focus', 'proven'],
  ['Charming', 'proven'],
  ['Combat Casting', 'proven'],
  ['Creepy', 'refused'],
  ['Dragon Scholar', 'refused'],
  ['Elemental Focus', 'refused'],
  ['Elven Magic (Elf)', 'proven'],
  ['Fey Magic (Gnome - HftF)', 'refused'],
  ['Gifted Adept', 'proven'],
  ['Keeper of Secrets', 'refused'],
  ['Magical Linguist (Gnome)', 'refused'],
  ['Projection', 'proven'],
  ['Shadowplay', 'refused'],
  ['Shadowplay', 'proven'],
  ['Shadowplay (Gnome)', 'proven'],
  ['Shadowplay (Half-Orc)', 'refused'],
  ['Shielded Caster', 'proven'],
  ['Spell Focus', 'record refused'],
  ['Spell Penetration', 'proven'],
  ['Spiritual Support', 'proven'],
  ['Unstoppable Magic', 'proven'],
];
let control: ReturnType<typeof readControl> | undefined;
const committedControl = () => (control ??= readControl());

describe('the Source-body family over the committed inventory', () => {
  it('re-imports each listed row with its reviewed outputs and source bytes, and proves exactly the listed rows', async () => {
    const { carrying, real, project } = await committedControl();
    const reviewed = reviewedList();
    const byKey = new Map(carrying.map((row) => [row.key, row]));
    for (const record of reviewed)
      expect(
        listedEvidence(byKey.get(record.key), real.get(record.key)),
        record.name,
      ).toEqual({
        kind: record.key.startsWith('pf1/') ? 'feat' : 'racialTrait',
        requirement: 'required',
        mechanisms: [name],
        source: record.sourceSha256,
        outputs: record.outputs,
        issues: [],
      });
    // Every catalog row admitted, real entries where the store holds the
    // source and best-case ones elsewhere: exactly the listed rows prove.
    const listed = reviewed.map(({ key }) => key).sort();
    expect(carrying.length).toBeGreaterThan(400);
    expect(project(launchMechanismProofs)).toEqual(listed);
    expect(project(launchMechanismProofs, false)).toEqual(listed);
    // The list is what refuses the others: Low-Light Vision, whose real
    // entry carries only its note, proves once listed with its bytes and
    // outputs.
    const lowLight = carrying.find(
      ({ name: rowName, kind }) =>
        kind === 'racialTrait' && rowName === 'Low-Light Vision (Elf)',
    );
    const lowLightSource = lowLight && storedSource(lowLight);
    const lowLightOutputs = bodyOutputs(
      lowLight && real.get(lowLight.key)?.entry,
    );
    if (!lowLight || !lowLightSource || !lowLightOutputs)
      throw new Error('Missing Low-Light Vision (Elf)');
    expect(Object.keys(lowLightOutputs)).toEqual(['situationalNotes']);
    expect(
      project(
        withReviewed([
          ...reviewed,
          reviewedRecord(lowLight.key, lowLightOutputs, {
            sourceSha256: lowLightSource.rawSha256,
          }),
        ]),
      ),
    ).toEqual([...listed, lowLight.key].sort());
  }, 300_000);

  it('over the pinned corpus, proves a casting-target body (spell DC, caster level, concentration) only when listed with Situational Modifiers the public proof covers, and refuses the rest', async () => {
    // The class body-ext fix r1 closes: every carrying row whose real entry
    // gives a Modifier or note on a target the Spellcasting reads, listed
    // alone with its real bytes and outputs beside the real list.
    const castingTargets: readonly unknown[] = [
      'spellDC',
      'casterLevel',
      'concentration',
    ];
    const { carrying, real, project } = await committedControl();
    const reviewed = reviewedList();
    const listedKeys = reviewed.map(({ key }) => key);
    const casting = carrying.flatMap((row) => {
      const stored = storedSource(row);
      const outputs = bodyOutputs(real.get(row.key)?.entry);
      const held = asObject(outputs);
      const targets = [held.modifiers, held.situationalNotes].flatMap((list) =>
        Array.isArray(list) ? list.map((item) => asObject(item).target) : [],
      );
      return stored &&
        outputs &&
        targets.some((t) => castingTargets.includes(t))
        ? [{ row, outputs, sourceSha256: stored.rawSha256 }]
        : [];
    });
    const verdicts = casting
      .map(({ row, outputs, sourceSha256 }) => {
        const records = listedKeys.includes(row.key)
          ? reviewed
          : [...reviewed, reviewedRecord(row.key, outputs, { sourceSha256 })];
        const parses = launchMechanismProofSchema.safeParse(
          withReviewed(records).find(isFamily),
        ).success;
        const proves =
          parses && project(withReviewed(records)).includes(row.key);
        const verdict = proves
          ? 'proven'
          : parses
            ? 'refused'
            : 'record refused';
        return [row.name, verdict] satisfies [string, string];
      })
      .sort(([a], [b]) => a.localeCompare(b));
    expect(verdicts).toEqual(castingVerdicts);
  }, 300_000);

  it('refuses a reviewed record or entry whose every output kind is absent, undefined, null, an empty list or an empty object', async () => {
    // Each output field the family reads, with every way of holding
    // nothing; `favoredClassCount` and `replaces` are the fields read inside
    // `detail`, so a detail holds each combination of their empty values.
    const nothing = [{}, { value: undefined }, { value: null }, { value: [] }];
    const holdsNothing = [...nothing, { value: {} }];
    const emptyDetails = [{}, { value: undefined }, { value: null }].flatMap(
      (favored) =>
        nothing.flatMap((replaces) => {
          const detail = {
            ...('value' in favored ? { favoredClassCount: favored.value } : {}),
            ...('value' in replaces ? { replaces: replaces.value } : {}),
          };
          return Object.keys(detail).length ? [{ value: detail }] : [];
        }),
    );
    expect(emptyDetails).toHaveLength(3 * 4 - 1);
    const fields: [string, { value?: unknown }[]][] = [
      ['modifiers', holdsNothing],
      ['situationalNotes', holdsNothing],
      ['countsAsRaces', holdsNothing],
      ['detail', [...holdsNothing, ...emptyDetails]],
    ];
    const shapes = fields.reduce<Record<string, unknown>[]>(
      (combined, [field, values]) =>
        combined.flatMap((shape) =>
          values.map((held) =>
            'value' in held ? { ...shape, [field]: held.value } : shape,
          ),
        ),
      [{}],
    );
    expect(shapes).toHaveLength(5 * 5 * 5 * 16);
    const reviewed = reviewedList();
    const familyParses = (records: unknown[]) =>
      launchMechanismProofSchema.safeParse(withReviewed(records).find(isFamily))
        .success;
    /** The saves trait's entry carrying a shape's fields. */
    const shapedEntry = ({ detail, ...outputs }: Record<string, unknown>) =>
      bodyEntry(keys.saves, { ...traitDetail, ...asObject(detail) }, outputs);
    const shapedProven = (outputs: Record<string, unknown>) =>
      proven({
        entries: baseEntries().map((entry) =>
          entry.externalKey === keys.saves ? shapedEntry(outputs) : entry,
        ),
        proofs: {
          registry: withReviewed(
            syntheticReviewed.map((record) =>
              record.key === keys.saves
                ? reviewedRecord(keys.saves, outputs)
                : record,
            ),
          ),
          sha256Of: repository,
        },
      })[keys.saves];
    // An undefined field beside a held output is no refusal.
    const besideHeld = {
      ...savesOutputs,
      countsAsRaces: undefined,
      detail: undefined,
    };
    expect(familyParses([reviewedRecord(keys.saves, besideHeld)])).toBe(true);
    expect(shapedProven(besideHeld)).toEqual([name]);
    for (const shape of shapes) {
      const label = JSON.stringify(shape, (_, value: unknown) =>
        value === undefined ? 'undefined' : value,
      );
      // Every pinned listed record, its outputs replaced, is refused.
      for (const record of reviewed)
        expect(
          familyParses([{ ...record, outputs: shape }]),
          `${record.name} ${label}`,
        ).toBe(false);
      expect(shapedProven(shape), label).toEqual([]);
    }
    // The pinned corpus: every carrying row whose real entry holds no
    // output, listed with its bytes and no outputs beside the real list,
    // proves nothing.
    const { carrying, real, project } = await committedControl();
    const outputless = carrying.flatMap((row) => {
      const stored = storedSource(row);
      const outputs = bodyOutputs(real.get(row.key)?.entry);
      return stored && outputs && !Object.keys(outputs).length
        ? [{ key: row.key, sourceSha256: stored.rawSha256 }]
        : [];
    });
    expect(outputless.length).toBeGreaterThan(0);
    for (const outputs of [
      { modifiers: undefined },
      {
        modifiers: undefined,
        situationalNotes: undefined,
        countsAsRaces: undefined,
        detail: undefined,
      },
    ]) {
      const listed = project(
        withReviewed([
          ...reviewed,
          ...outputless.map(({ key, sourceSha256 }) =>
            reviewedRecord(key, outputs, { sourceSha256 }),
          ),
        ]),
      );
      for (const { key } of outputless)
        expect(listed, `${key} ${Object.keys(outputs).join()}`).not.toContain(
          key,
        );
    }
  }, 300_000);
});
