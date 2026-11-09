// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  classLevelSlotLevelGrant,
  classLevelSlotRows,
  reviewedClassLevelSlots,
  type ReviewedClassLevelSlot,
} from '../../scripts/catalog/launch-class-level-slots';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import {
  launchMechanismProofs,
  type LaunchMechanismProof,
} from '../../scripts/catalog/launch-mechanism-proofs';
import { unmappedChangeReason } from '../../scripts/catalog/formula';
import {
  currentMechanismProofs,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import {
  committedProjection,
  loadClassFeatureControl,
  provingKeys,
} from './launch-class-feature-evidence';

// The class-level slots family (#783, feature-grants slice 3a): it proves a
// class feature's `Modifier bonusFeats <formula>` only when the reviewed
// schedule slots of the parent's rows deliver the formula's count at every
// class level of every listing class, nothing else adds to it, and the raw
// change is the parent's only `changes` issue; the level-grant family then
// accepts the parent with its reviewed slot. The rows are synthetic, keyed as
// the real parents (a reviewed slot rule is read by key); the last describe
// block is the committed-inventory control.
const grants = 'Feature/option grants and conditions';
const proofTest = 'convex/characterSheetClassLevelSlots.integration.test.ts';
const repository = (path: string) => repositoryFileSha256('.', path);
const isSlotsFamily = (proof: { family: string }) =>
  proof.family === 'class-level-slots';
const isGrantsFamily = (proof: { family: string }) =>
  proof.family === 'class-feature-level-grants';
const family = launchMechanismProofs.find(isSlotsFamily);
const grantsFamily = launchMechanismProofs.find(isGrantsFamily);
if (!family || !('classLevelSlots' in family))
  throw new Error('Missing the class-level slots family');
if (
  !grantsFamily ||
  !('scope' in grantsFamily) ||
  !grantsFamily.scope?.featureGrants
)
  throw new Error('Missing the class-feature level-grant family');
const grantsScope = grantsFamily.scope;
const grantsList = grantsFamily.scope.featureGrants;

/** The Cavalier's, Magus', Fighter's and Inquisitor's bonus feat parents. */
const cavalierKey = 'pf1/vfu0FW2XYF7cBUQp';
const magusKey = 'pf1/gzBR0qkMdu0KkLV0';
const fighterKey = 'pf1/CV8BsY3ciUb9TA1Y';
const teamworkKey = 'pf1/717fyDCcfLtD345B';

/**
 * The registry with both families' lists of class-level slot parents replaced
 * by these records: the slots family's own, and their level-grant records
 * beside every other level-grant row.
 */
function withSlotRecords(records: readonly ReviewedClassLevelSlot[]) {
  const listed = new Set(reviewedClassLevelSlots.map(({ key }) => key));
  return launchMechanismProofs.map((proof): unknown => {
    if (isSlotsFamily(proof) && 'classLevelSlots' in proof)
      return {
        ...proof,
        classLevelSlots: { ...proof.classLevelSlots, reviewed: records },
      };
    if (proof === grantsFamily)
      return {
        ...grantsFamily,
        scope: {
          ...grantsScope,
          featureGrants: {
            ...grantsList,
            reviewed: [
              ...grantsList.reviewed.filter(({ key }) => !listed.has(key)),
              ...records.map(classLevelSlotLevelGrant),
            ],
          },
        },
      };
    return proof;
  });
}

type Feature = readonly [number, string];
/** A parent's schedule shape: its rows by class level, formula and slot. */
type Shape = {
  parent: string;
  sourceSha256: string;
  /** The acquisition's level, then each increment's key by level. */
  acquisition: number;
  increments: readonly Feature[];
  formula: string;
  slot?: object;
};
const combat = { kind: 'feat', count: 1, featTypes: ['Combat'] };
const cavalier: Shape = {
  parent: cavalierKey,
  sourceSha256:
    '75f98a28cc45d99d76052a7e971eb9a965b249e747b60c111b3fd7645d227075',
  acquisition: 6,
  increments: [
    [12, 'everythingpath/cavalier-bonus-feat-12'],
    [18, 'everythingpath/cavalier-bonus-feat-18'],
  ],
  formula: 'floor(@class.level / 6)',
  slot: combat,
};
const fighter: Shape = {
  parent: fighterKey,
  sourceSha256:
    'ab7655c67684faa9e8d317b850c7bc9ec286f8233d2d276a397c19d67737e441',
  acquisition: 1,
  increments: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((level) => [
    level,
    `everythingpath/fighter-bonus-feats-${level}`,
  ]),
  formula: '1 + floor(@class.level / 2)',
  slot: combat,
};
const [twelfth, eighteenth] = cavalier.increments.map(([, key]) => key) as [
  string,
  string,
];
const classKey = 'pf1/proofSlotsClass';
const optionalClassKey = 'pf1/proofSlotsOptionalClass';

const optionGrants = (): LaunchRow['mechanisms'][number] => ({
  name: grants,
  disposition: 'recorded choice',
  status: 'outstanding',
  contract: 'Retain the complete feature option.',
  evidence: ['row.sources'],
});
const modifierMechanism = (
  formula: string,
): LaunchRow['mechanisms'][number] => ({
  name: `Modifier bonusFeats ${formula}`,
  disposition: 'calculated',
  status: 'outstanding',
  contract: 'Preserve source target bonusFeats without double contribution.',
  evidence: ['row.sources'],
});
type Row = Parameters<typeof verifyLaunchRows>[0]['rows'][number];
function row(key: string, change: Partial<LaunchRow> = {}): Row {
  return {
    key,
    kind: 'classFeature',
    catalogKey: key,
    requirement: 'required',
    holds: [],
    mechanisms: [],
    sources: [],
    noticeEvidence: { state: 'unreviewed', evidence: ['row.sources'] },
    ...change,
  };
}
function source(rawSha256: string): LaunchRow['sources'][number] {
  return {
    repository: 'pf1',
    pin: '418761d2e16a6037c0156bb4a241f7cea5a2986d',
    locator: 'packs/class-abilities/proof-parent.yaml',
    rawSha256,
    effectiveSha256: rawSha256,
  };
}
function entry(key: string, detail: object, rest: object = {}) {
  return {
    externalKey: key,
    upstreamKey: key,
    pack: 'class-abilities',
    name: key,
    detail,
    description: '',
    sources: [{ book: 'PZO1115' }],
    modifiers: [],
    unsupported: [],
    ...rest,
  };
}
const slotted = (slot: object | undefined) =>
  slot ? { grantsSlots: [slot] } : {};
const parentEntry = (shape: Shape, rest: object = slotted(shape.slot)) =>
  entry(shape.parent, { kind: 'classFeature' }, rest);
const incrementEntry = (
  shape: Shape,
  [level, key]: Feature,
  rest: object = slotted(shape.slot),
) =>
  entry(
    key,
    {
      kind: 'classFeature',
      parentFeature: shape.parent,
      part: `${level}:${shape.parent}`,
    },
    { pack: 'everythingpath-schedules', ...rest },
  );
const classEntry = (key: string, features: readonly Feature[]) =>
  entry(key, {
    kind: 'class',
    hitDie: 10,
    bab: 'full',
    saves: { fort: 'good', ref: 'poor', will: 'poor' },
    classSkills: [],
    tag: key,
    classKind: 'base',
    skillRanksPerLevel: 2,
    featuresByLevel: features.map(([classLevel, externalKey]) => ({
      classLevel,
      externalKey,
    })),
    picksByLevel: [],
  });
const scheduleOf = (shape: Shape): Feature[] => [
  [shape.acquisition, shape.parent],
  ...shape.increments,
];
type Issue = { field: string; reason?: string; value?: unknown };
const rawIssue = (formula: string, change: object = {}): Issue => ({
  field: 'changes',
  reason: unmappedChangeReason,
  value: { target: 'bonusFeats', formula, type: 'untyped', ...change },
});

type Case = {
  /** The formula, in the mechanism name and the raw issue alike. */
  formula?: string;
  parent?: Partial<LaunchRow>;
  parentEntry?: object;
  /** Replaced increment entries by key; null leaves one out. */
  incrementEntries?: Record<string, object | null>;
  /** The listing class's rows; null for no listing class. */
  classFeatures?: readonly Feature[] | null;
  optionalFeatures?: readonly Feature[];
  /** The parent's issues; by default its source fields and the raw change. */
  issues?: readonly Issue[];
  unadmitted?: readonly string[];
  /** Increments whose requirement edge to the parent is dropped. */
  unlinked?: readonly string[];
  registry?: readonly unknown[];
  input?: Partial<LaunchVerificationInput>;
};
/** The case's scoped entries: the parent, its increments and the classes. */
function scopedEntries(shape: Shape, change: Case) {
  const increments = shape.increments.flatMap((increment) => {
    const replaced = change.incrementEntries?.[increment[1]];
    if (replaced === null) return [];
    return [replaced ?? incrementEntry(shape, increment)];
  });
  const classFeatures =
    change.classFeatures === undefined
      ? scheduleOf(shape)
      : change.classFeatures;
  return [
    change.parentEntry ?? parentEntry(shape),
    ...increments,
    ...(classFeatures ? [classEntry(classKey, classFeatures)] : []),
    ...(change.optionalFeatures
      ? [classEntry(optionalClassKey, change.optionalFeatures)]
      : []),
  ];
}
/** The parent's proven mechanisms, for one synthetic build. */
function proven(shape: Shape, change: Case = {}) {
  const formula = change.formula ?? shape.formula;
  const rows = [
    row(shape.parent, {
      mechanisms: [modifierMechanism(formula), optionGrants()],
      sources: [source(shape.sourceSha256)],
      ...change.parent,
    }),
    ...shape.increments.map(([, key]) =>
      row(key, {
        mechanisms: [
          {
            name: 'Reviewed schedule increment',
            disposition: 'calculated',
            status: 'reused',
            contract: 'Parent computes the benefit once.',
            evidence: ['tests/catalog/pcgen-schedules.test.ts'],
          },
        ],
      }),
    ),
    row(classKey, { kind: 'class' }),
    row(optionalClassKey, { kind: 'class', requirement: 'optional' }),
  ];
  const edges = shape.increments
    .filter(([, key]) => !change.unlinked?.includes(key))
    .map(([, key]) => ({
      from: key,
      to: shape.parent,
      kind: 'requirement' as const,
    }));
  const unadmitted = change.unadmitted ?? [];
  const input: LaunchVerificationInput = {
    admission: {
      admitted: [shape.parent, ...shape.increments.map(([, key]) => key)]
        .filter((key) => !unadmitted.includes(key))
        .map((externalKey) => ({ externalKey, reason: 'Admitted.' })),
      held: [],
      dependentOmissions: [],
      retainedExceptions: [],
      failures: [],
    },
    scopeBuild: {
      entries: scopedEntries(shape, change),
      remaps: new Map(),
      resources: new Map(),
    },
    unsupported: {
      entries: [
        {
          externalKey: shape.parent,
          issues: change.issues ?? [
            { field: 'gameContent', reason: 'Retained.' },
            rawIssue(formula),
          ],
        },
      ],
    },
    proofs: {
      registry: change.registry ?? launchMechanismProofs,
      sha256Of: repository,
    },
    proseCases: [],
    calculationIdentity: currentCalculationIdentity,
    stale: [],
    ...change.input,
  };
  return verifyLaunchRows({ rows, edges }, input).find(
    ({ key }) => key === shape.parent,
  )?.mechanisms;
}
const both = (shape: Shape, formula = shape.formula) => [
  `Modifier bonusFeats ${formula}`,
  grants,
];

describe('the class-level slots family', () => {
  it('names its public saved-sheet proof with its current bytes, the current calculation identity and its reviewed rows', () => {
    expect(family).toMatchObject({
      mechanismPrefix: 'Modifier ',
      kinds: ['classFeature'],
      tests: [{ path: proofTest }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['curation'],
      classLevelSlots: { source: 'bonusFeats' },
    });
    expect(
      currentMechanismProofs({
        registry: launchMechanismProofs,
        sha256Of: repository,
      }),
    ).toContainEqual(family);
    // Root decision R1: Cavalier and Magus; Fighter Bonus Feats and Teamwork
    // Feat wait on owner question O1 for their retraining limits.
    expect(family.classLevelSlots.reviewed.map(({ key }) => key)).toEqual([
      cavalierKey,
      magusKey,
    ]);
    expect(classLevelSlotRows('count').map(({ key }) => key)).toEqual([
      cavalierKey,
      magusKey,
      fighterKey,
      teamworkKey,
    ]);
    expect(
      classLevelSlotRows('count')
        .filter(({ retraining }) => retraining)
        .map(({ name }) => name),
    ).toEqual(['Bonus Feats (FGT)', 'Teamwork Feat']);
    for (const record of classLevelSlotRows('count')) {
      expect(record.basis, record.name).toMatch(
        /^packs\/class-abilities\/.+\.yaml: ".+"/,
      );
      expect(record.basis, record.name).toMatch(/\.html:\d+/);
    }
    // The listed rows join the level-grant list with their reviewed slot.
    for (const record of reviewedClassLevelSlots)
      expect(grantsList.reviewed).toContainEqual(
        classLevelSlotLevelGrant(record),
      );
  });

  it('proves a listed parent whose schedule slots give the formula’s count at every class level, and its level grant', () => {
    expect(proven(cavalier)).toEqual(both(cavalier));
    // A second listing class with the same schedule is checked as well.
    expect(
      proven(cavalier, { optionalFeatures: scheduleOf(cavalier) }),
    ).toEqual(both(cavalier));
    // Fighter Bonus Feats, listed (O1 answered yes), proves the same way.
    const withFighter = withSlotRecords(classLevelSlotRows('count'));
    expect(proven(fighter, { registry: withFighter })).toEqual(both(fighter));
  });

  it('refuses an unlisted parent with a bonusFeats Modifier, and changed source bytes', () => {
    // Fighter Bonus Feats is unlisted (root decision R1).
    expect(proven(fighter)).toEqual([]);
    expect(
      proven(cavalier, { parent: { sources: [source('d'.repeat(64))] } }),
    ).toEqual([]);
  });

  it('refuses a count off by one at any class level, of the formula or of the rows', () => {
    for (const formula of [
      'floor(@class.level / 6) + 1',
      // One too many from 17th to 17th only, and at 11th.
      'floor((@class.level + 1) / 6)',
      'floor(@class.level / 7)',
    ])
      expect(proven(cavalier, { formula }), formula).toEqual([]);
    const acquisition: Feature = [6, cavalierKey];
    for (const [label, classFeatures] of [
      [
        'an increment a level late',
        [acquisition, [12, twelfth], [19, eighteenth]],
      ],
      ['an increment missing', [acquisition, [12, twelfth]]],
      [
        'the acquisition a level early',
        [
          [5, cavalierKey],
          [12, twelfth],
          [18, eighteenth],
        ],
      ],
    ] as const)
      expect(proven(cavalier, { classFeatures }), label).toEqual([]);
  });

  it('refuses a listing class whose rows of the parent mismatch, even an optional one, and needs a listing class', () => {
    expect(
      proven(cavalier, {
        optionalFeatures: [
          [6, cavalierKey],
          [12, twelfth],
        ],
      }),
    ).toEqual([]);
    expect(proven(cavalier, { optionalFeatures: [[5, cavalierKey]] })).toEqual(
      [],
    );
    expect(proven(cavalier, { classFeatures: null })).toEqual([]);
  });

  it('refuses a double contribution against an increment’s slot: a second slot, a doubled count or row, a Modifier or an increment it does not know', () => {
    const doubled = { grantsSlots: [combat, combat] };
    for (const [label, change] of [
      [
        'two slots on an increment',
        {
          incrementEntries: {
            [twelfth]: incrementEntry(cavalier, [12, twelfth], doubled),
          },
        },
      ],
      [
        'two slots on the parent',
        { parentEntry: parentEntry(cavalier, doubled) },
      ],
      [
        'a slot of count 2',
        {
          incrementEntries: {
            [twelfth]: incrementEntry(cavalier, [12, twelfth], {
              grantsSlots: [{ ...combat, count: 2 }],
            }),
          },
        },
      ],
      [
        'an increment listed twice',
        { classFeatures: [...scheduleOf(cavalier), [12, twelfth]] },
      ],
      [
        'a Modifier on the parent',
        {
          parentEntry: parentEntry(cavalier, {
            ...slotted(combat),
            modifiers: [{ target: 'init', bonusType: 'untyped', value: 1 }],
          }),
        },
      ],
      [
        'a Modifier on an increment',
        {
          incrementEntries: {
            [twelfth]: incrementEntry(cavalier, [12, twelfth], {
              ...slotted(combat),
              modifiers: [{ target: 'init', bonusType: 'untyped', value: 1 }],
            }),
          },
        },
      ],
      [
        'a row of the parent that is no increment of it',
        { unlinked: [eighteenth] },
      ],
    ] as const)
      expect(proven(cavalier, change), label).toEqual([]);
  });

  it('refuses an open or differently typed slot in place of the reviewed one, and a missing slot', () => {
    const slot = (grantsSlots: object[]) =>
      incrementEntry(cavalier, [12, twelfth], { grantsSlots });
    for (const [label, entryOf12] of [
      ['an open slot', slot([{ kind: 'feat', count: 1 }])],
      ['another feat type', slot([{ ...combat, featTypes: ['Teamwork'] }])],
      ['a trait slot', slot([{ kind: 'trait', count: 1 }])],
      ['no slot', incrementEntry(cavalier, [12, twelfth], {})],
    ] as const)
      expect(
        proven(cavalier, { incrementEntries: { [twelfth]: entryOf12 } }),
        label,
      ).toEqual([]);
    expect(
      proven(cavalier, {
        parentEntry: parentEntry(cavalier, {
          grantsSlots: [{ kind: 'feat', count: 1 }],
        }),
      }),
    ).toEqual([]);
    // An increment's entry missing, or the gate not admitting it.
    expect(
      proven(cavalier, { incrementEntries: { [eighteenth]: null } }),
    ).toEqual([]);
    expect(proven(cavalier, { unadmitted: [eighteenth] })).toEqual([]);
  });

  it('refuses a missing, doubled or re-reasoned raw change issue, and any other changes issue', () => {
    const formula = cavalier.formula;
    const retained = { field: 'gameContent', reason: 'Retained.' };
    for (const [label, issues] of [
      ['missing', [retained]],
      ['doubled', [retained, rawIssue(formula), rawIssue(formula)]],
      ['re-reasoned', [retained, { ...rawIssue(formula), reason: 'Other.' }]],
      ['typed', [retained, rawIssue(formula, { type: 'competence' })]],
      ['another formula', [retained, rawIssue('floor(@class.level / 5)')]],
      ['an operator', [retained, rawIssue(formula, { operator: 'set' })]],
      ['a sub-field', [retained, { ...rawIssue(formula), field: 'changes.0' }]],
      [
        'another change beside it',
        [
          retained,
          rawIssue(formula),
          {
            ...rawIssue(formula),
            value: { target: 'ac', formula: '1', type: 'untyped' },
          },
        ],
      ],
      [
        'a curation issue',
        [
          retained,
          rawIssue(formula),
          { field: 'curation.mechanics', reason: 'Why.' },
        ],
      ],
    ] as const)
      expect(proven(cavalier, { issues }), label).toEqual([]);
  });

  it('refuses a formula it cannot read', () => {
    for (const formula of [
      'floor(@class.level / 6',
      'floor(@classLevel.cavalier / 6)',
      'floor(@class.level / 6) + @level',
      'if(gte(@class.level, 6), 1)',
      'floor(@class.level / (@class.level - @class.level))',
    ])
      expect(proven(cavalier, { formula }), formula).toEqual([]);
  });

  it('refuses the Wizard, Monk, Sorcerer and Bloodrager bonus feats, whose rows match their formulas, with no reviewed slot rule', () => {
    const shapes: (Shape & { name: string })[] = [
      {
        name: 'Bonus Feats (WIZ)',
        parent: 'pf1/2h3lI574tmVjOalQ',
        acquisition: 5,
        levels: [10, 15, 20],
        formula: 'floor(@class.level / 5)',
        slug: 'wizard-bonus-feats',
      },
      {
        name: 'Bonus Feat (MNK)',
        parent: 'pf1/VjHjPja5QABBgRvR',
        acquisition: 1,
        levels: [2, 6, 10, 14, 18],
        formula: '1 + floor((@class.level + 2) / 4)',
        slug: 'monk-bonus-feat',
      },
      {
        name: 'Bloodline Feat (SOR)',
        parent: 'pf1/W1KWAZxUNxfCv8rG',
        acquisition: 7,
        levels: [13, 19],
        formula: 'floor((@class.level - 1) / 6)',
        slug: 'sorcerer-bloodline-feat',
      },
      {
        name: 'Bloodline Feat (BLO)',
        parent: 'pf1/xxD5AbgfJ5OuzVld',
        acquisition: 6,
        levels: [9, 12, 15, 18],
        formula: 'floor(@class.level / 3) - 1',
        slug: 'bloodrager-bloodline-feat',
      },
    ].map(({ levels, slug, ...rest }) => ({
      ...rest,
      sourceSha256: 'a'.repeat(64),
      increments: levels.map(
        (level) =>
          [level, `everythingpath/${slug}-${level}`] as [number, string],
      ),
    }));
    const registry = withSlotRecords([
      ...reviewedClassLevelSlots,
      ...shapes.map(({ parent, name, sourceSha256 }) => ({
        key: parent,
        name,
        sourceSha256,
        basis: 'Synthetic.',
      })),
    ]);
    for (const shape of shapes) {
      // No slot, as the importer gives them; and a typed slot no reviewed
      // rule names.
      expect(proven(shape, { registry }), shape.name).toEqual([]);
      expect(
        proven(
          {
            ...shape,
            slot: { kind: 'feat', count: 1, featTypes: ['Metamagic'] },
          },
          { registry },
        ),
        shape.name,
      ).toEqual([]);
    }
  });

  it('lets the level-grant family take the parent only through this family: a stale proof, a plain record or any other changes issue refuses it', () => {
    // This family's proof stale: its raw issue then disqualifies the level
    // grant too.
    expect(
      proven(cavalier, {
        input: {
          proofs: {
            registry: launchMechanismProofs,
            sha256Of: (path) =>
              path === proofTest ? 'e'.repeat(64) : repository(path),
          },
        },
      }),
    ).toEqual([]);
    // The parent on the level-grant list as a plain level grant: its slot
    // refuses it there, and the Modifier is still proven.
    const plain = launchMechanismProofs.map(
      (proof): LaunchMechanismProof =>
        proof === grantsFamily
          ? {
              ...grantsFamily,
              scope: {
                ...grantsScope,
                featureGrants: {
                  ...grantsList,
                  reviewed: grantsList.reviewed.map((listed) =>
                    listed.key === cavalierKey
                      ? { ...listed, scheduleSlot: undefined }
                      : listed,
                  ),
                },
              },
            }
          : proof,
    );
    expect(proven(cavalier, { registry: plain })).toEqual([
      `Modifier bonusFeats ${cavalier.formula}`,
    ]);
    // Without this family in the registry, neither is proven.
    expect(
      proven(cavalier, {
        registry: launchMechanismProofs.filter(
          (proof) => !isSlotsFamily(proof),
        ),
      }),
    ).toEqual([]);
  });
});

describe('the class-level slots family over the committed inventory', () => {
  it('proves exactly the listed rows at the base’s gate, the rule alone passes exactly the four schedule-slot parents, and dropping one increment’s slot fails it', async () => {
    const { project, familyRows, inventory, admission } =
      await loadClassFeatureControl((found) =>
        found.mechanisms.some(
          ({ name, status }) =>
            name.startsWith('Modifier bonusFeats ') && status === 'outstanding',
        ),
      );
    const isSlotModifier = (name: string) =>
      name.startsWith('Modifier bonusFeats ');
    const listed = reviewedClassLevelSlots.map(({ key }) => key).sort();
    // Every bonusFeats parent the design reviewed is admitted at the base.
    const byKey = new Map(familyRows.map((found) => [found.key, found]));
    expect([...byKey.values()].map(({ name }) => name).sort()).toEqual([
      'Bloodline Feat (BLO)',
      'Bloodline Feat (SOR)',
      'Bonus Feat (CAV)',
      'Bonus Feat (MNK)',
      'Bonus Feats (FGT)',
      'Bonus Feats (MAG)',
      'Bonus Feats (WIZ)',
      'Teamwork Feat',
      'Unarmed Strike',
    ]);
    // Each record binds its row's committed source bytes.
    for (const record of classLevelSlotRows('count'))
      expect(
        byKey.get(record.key)?.sources.map(({ rawSha256 }) => rawSha256),
        record.name,
      ).toContain(record.sourceSha256);

    const control = project(launchMechanismProofs);
    expect(provingKeys(control, isSlotModifier)).toEqual(listed);
    for (const key of listed)
      expect(control.get(key), key).toEqual([
        ...(byKey.get(key)?.mechanisms ?? [])
          .filter(({ status }) => status === 'outstanding')
          .map(({ name }) => name),
      ]);

    // Every bonusFeats parent on both lists: the rule passes exactly the four
    // whose rows carry a reviewed slot.
    const everyParent = withSlotRecords(
      familyRows.map(
        (found) =>
          classLevelSlotRows('count').find(({ key }) => key === found.key) ?? {
            key: found.key,
            name: found.name,
            sourceSha256: found.sources[0]?.rawSha256 ?? '',
            basis: 'Synthetic.',
          },
      ),
    );
    const structural = project(everyParent);
    expect(provingKeys(structural, isSlotModifier)).toEqual(
      [cavalierKey, magusKey, fighterKey, teamworkKey].sort(),
    );
    // Their level grants: Teamwork Feat names the teamwork feats it may take
    // as requirement rules (rule/advanced/bounded/…), and a level grant with
    // an outgoing requirement edge stays outstanding, so it is refused there
    // even when listed.
    expect(
      provingKeys(structural, (name) => name === grants).filter((key) =>
        byKey.has(key),
      ),
    ).toEqual([cavalierKey, magusKey, fighterKey].sort());
    expect(
      inventory.edges.some(
        ({ from, to, kind }) =>
          from === teamworkKey &&
          kind === 'requirement' &&
          to.startsWith('rule/advanced/bounded/'),
      ),
    ).toBe(true);

    // A mutation: one increment's slot dropped refuses its parent in both
    // families, and nothing else.
    const mutated = project(launchMechanismProofs, (key, found) =>
      key === twelfth ? { ...found, grantsSlots: undefined } : found,
    );
    expect(provingKeys(mutated, isSlotModifier)).toEqual([magusKey]);
    expect(mutated.get(cavalierKey)).toEqual([]);
    expect(mutated.get(magusKey)).toEqual(control.get(magusKey));

    // The committed projection admits exactly the family's expected rows,
    // read from the confirmed attribution assessments and not from the
    // projection itself (`loadClassFeatureControl`). Negative, over the whole
    // scope: a projection missing any admitted row, or admitting any other
    // one, disagrees, naming that row.
    const { rows } = await committedProjection();
    expect(admission.expected.length).toBeGreaterThan(0);
    expect(admission.unadmitted.length).toBeGreaterThan(0);
    expect(admission.agreement(rows)).toEqual({ missing: [], extra: [] });
    for (const key of admission.expected)
      expect(
        admission.agreement(rows.filter((row) => row.key !== key)),
        key,
      ).toEqual({ missing: [key], extra: [] });
    for (const key of admission.unadmitted)
      expect(
        admission.agreement([
          ...rows,
          {
            key,
            verified: ['admission'],
            mechanisms: [],
            prose: [],
            evidence: [],
          },
        ]),
        key,
      ).toEqual({ missing: [], extra: [key] });
    // The committed projection proves the Modifier on exactly the listed
    // class features (plain-modifiers proves a feat's or racial trait's
    // `bonusFeats 1`).
    expect(
      provingKeys(
        new Map(
          rows
            .filter(({ key }) => byKey.has(key))
            .map(({ key, mechanisms }) => [key, mechanisms]),
        ),
        isSlotModifier,
      ),
    ).toEqual(listed);
  }, 240_000);
});
