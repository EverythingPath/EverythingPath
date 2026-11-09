// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import {
  launchMechanismProofs,
  levelGrantRows,
  reviewedLevelGrants,
  type NamedMechanismProof,
} from '../../scripts/catalog/launch-mechanism-proofs';
import {
  currentMechanismProofs,
  parseLaunchVerification,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import { importedEvidence } from './launch-modifier-evidence';
import { materializePinnedTree } from './pinned-sources';

// The class-feature level-grant family (#775): it proves "Feature/option
// grants and conditions" only for a reviewed parent that a required class's
// scoped entry lists, whose required increments the gate admits, and whose
// entry and edges carry nothing beyond the plain level grant the public
// saved-sheet proof covers. The rows and entries here are synthetic; the
// last describe block is the committed-inventory control.
const mechanism = 'Feature/option grants and conditions';
const proofTest = 'convex/characterSheetFeatureGrants.integration.test.ts';
const repository = (path: string) => repositoryFileSha256('.', path);
const family = launchMechanismProofs.find(
  (proof): proof is NamedMechanismProof =>
    'mechanism' in proof && proof.family === 'class-feature-level-grants',
);
if (!family?.scope?.featureGrants)
  throw new Error('Missing the class-feature level-grant family');
const familyScope = family.scope;
const familyGrants = family.scope.featureGrants;

/** The registry with the family's reviewed list replaced. */
function withReviewed(keys: readonly string[]) {
  return launchMechanismProofs.map((proof) =>
    proof === family
      ? {
          ...family,
          scope: {
            ...familyScope,
            featureGrants: {
              ...familyGrants,
              reviewed: keys.map((key) => ({
                key,
                name: key,
                basis: 'Synthetic.',
                bodyNumbersNotNamedAsMechanism: 'none',
                unmodelledNumber: false,
              })),
            },
          },
        }
      : proof,
  );
}

const keys = {
  parent: 'pf1/proofParent',
  // Shaped exactly like the parent, and off the reviewed list: Rage Powers.
  control: 'pf1/proofRagePowers',
  sixth: 'everythingpath/proof-parent-6',
  tenth: 'everythingpath/proof-parent-10',
  optionalIncrement: 'everythingpath/proof-unchained-parent-6',
  required: 'pf1/proofClass',
  optional: 'pf1/proofUnchainedClass',
};
const optionGrants = (): LaunchRow['mechanisms'][number] => ({
  name: mechanism,
  disposition: 'recorded choice',
  status: 'outstanding',
  contract: 'Retain the complete feature option.',
  evidence: ['row.sources'],
});
function row(
  key: string,
  change: Partial<LaunchRow> = {},
): Parameters<typeof verifyLaunchRows>[0]['rows'][number] {
  return {
    key,
    kind: 'classFeature',
    catalogKey: key,
    requirement: 'required',
    holds: [],
    mechanisms: [optionGrants()],
    sources: [],
    noticeEvidence: { state: 'unreviewed', evidence: ['row.sources'] },
    ...change,
  };
}
const incrementRow = (key: string, requirement: LaunchRow['requirement']) =>
  row(key, {
    requirement,
    mechanisms: [
      {
        name: 'Reviewed schedule increment',
        disposition: 'calculated',
        status: 'reused',
        contract: 'Parent computes the benefit once.',
        evidence: ['tests/catalog/pcgen-schedules.test.ts'],
      },
    ],
  });
const classRow = (key: string, requirement: LaunchRow['requirement']) =>
  row(key, { kind: 'class', requirement, mechanisms: [] });

function entry(key: string, detail: object, rest: object = {}) {
  return {
    externalKey: key,
    upstreamKey: key,
    pack: 'class-abilities',
    name: key,
    detail,
    description: '',
    sources: [{ book: 'PZO1110' }],
    modifiers: [],
    unsupported: [],
    ...rest,
  };
}
const classEntry = (key: string, features: readonly [number, string][]) =>
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
const requiredFeatures: [number, string][] = [
  [2, keys.parent],
  [6, keys.sixth],
  [10, keys.tenth],
  [2, keys.control],
];

type Case = {
  rows?: Partial<Record<keyof typeof keys, Partial<LaunchRow>>>;
  parentEntry?: object;
  requiredClass?: object | null;
  optionalClass?: object;
  admitted?: readonly string[];
  held?: readonly string[];
  edges?: Parameters<typeof verifyLaunchRows>[0]['edges'];
  issues?: readonly string[];
  input?: Partial<LaunchVerificationInput>;
  registry?: readonly unknown[];
};
/** The case's scoped entries: the parent, the control and both classes. */
function scopedEntries(change: Case) {
  const required =
    change.requiredClass === undefined
      ? classEntry(keys.required, requiredFeatures)
      : change.requiredClass;
  return [
    change.parentEntry ?? entry(keys.parent, { kind: 'classFeature' }),
    entry(keys.control, { kind: 'classFeature' }),
    ...(required ? [required] : []),
    change.optionalClass ??
      classEntry(keys.optional, [[6, keys.optionalIncrement]]),
  ];
}
/** The parent's and the control's proven mechanisms, for one synthetic build. */
function proven(change: Case = {}) {
  const rows = [
    row(keys.parent),
    row(keys.control),
    incrementRow(keys.sixth, 'required'),
    incrementRow(keys.tenth, 'required'),
    incrementRow(keys.optionalIncrement, 'optional'),
    classRow(keys.required, 'required'),
    classRow(keys.optional, 'optional'),
  ].map((built) => {
    const named = Object.entries(keys).find(([, key]) => key === built.key);
    const override = named && change.rows?.[named[0] as keyof typeof keys];
    return override ? { ...built, ...override } : built;
  });
  const edges = [
    { from: keys.sixth, to: keys.parent, kind: 'requirement' as const },
    { from: keys.tenth, to: keys.parent, kind: 'requirement' as const },
    {
      from: keys.optionalIncrement,
      to: keys.parent,
      kind: 'requirement' as const,
    },
    ...(change.edges ?? []),
  ];
  const held = change.held ?? [];
  // The classes are unadmitted (root decision R1); everything else is
  // admitted, except an unadmitted optional increment.
  const admitted = (
    change.admitted ?? [keys.parent, keys.control, keys.sixth, keys.tenth]
  ).filter((key) => !held.includes(key));
  const input: LaunchVerificationInput = {
    admission: {
      admitted: admitted.map((externalKey) => ({
        externalKey,
        reason: 'Admitted.',
      })),
      held: held.map((externalKey) => ({ externalKey, reason: 'Held.' })),
      dependentOmissions: [],
      retainedExceptions: [],
      failures: [],
    },
    scopeBuild: {
      entries: scopedEntries(change),
      remaps: new Map(),
      resources: new Map(),
    },
    unsupported: {
      entries: [
        {
          externalKey: keys.parent,
          issues: (change.issues ?? ['gameContent']).map((field) => ({
            field,
            reason: 'Why.',
          })),
        },
      ],
    },
    proofs: {
      registry: change.registry ?? withReviewed([keys.parent]),
      sha256Of: repository,
    },
    proseCases: [],
    calculationIdentity: currentCalculationIdentity,
    stale: [],
    ...change.input,
  };
  const verified = verifyLaunchRows({ rows, edges }, input);
  const of = (key: string) =>
    verified.find((found) => found.key === key)?.mechanisms;
  return { parent: of(keys.parent), control: of(keys.control) };
}
const outstanding = { parent: [], control: [] };

describe('the class-feature level-grant family', () => {
  it('names its public saved-sheet proof with its current bytes, the current calculation identity and its reviewed rows', () => {
    expect(family).toMatchObject({
      mechanism,
      kinds: ['classFeature'],
      tests: [{ path: proofTest }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['changes', 'curation'],
      scope: {
        detailKind: 'classFeature',
        nonEmpty: [],
        empty: [
          'parentFeature',
          'part',
          'duplicateUpgrade',
          'picksByLevel',
          'spellcasting',
        ],
        featureGrants: { shape: 'level-grant' },
      },
    });
    expect(
      currentMechanismProofs({
        registry: launchMechanismProofs,
        sha256Of: repository,
      }),
    ).toContainEqual(family);
    // #775's fixed keys, each with a cited review basis and its body's
    // numbers recorded (owner question O1).
    expect(reviewedLevelGrants.map(({ key }) => key).sort()).toEqual(
      [
        'pf1/TaBxJdJQp5SFDPyn',
        'pf1/h56K6HEBOItImPPL',
        'pf1/RENIeTVjWB7Mq6Mw',
        'pf1/msQWK7TW7mufzf8l',
        'pf1/NwTe1Q2utlsmOAqK',
        'pf1/2TsDfK0SKC8IGVx4',
        'pf1/2M56kfIOws5yYtxq',
        'pf1/2Og23i3rRXu5QQlg',
        'pf1/WNi2SBF6Z2zhBMCl',
        'pf1/yotHT522pQoKDhID',
        'pf1/7BfYNNkYjjBevun8',
        'pf1/Wl3FUflcmvQP0PaQ',
      ].sort(),
    );
    for (const reviewed of reviewedLevelGrants) {
      expect(reviewed.basis, reviewed.name).toMatch(
        /packs\/class-abilities\/.+\.yaml/,
      );
      expect(reviewed.bodyNumbersNotNamedAsMechanism, reviewed.name).not.toBe(
        '',
      );
    }
    expect(
      reviewedLevelGrants
        .filter(({ unmodelledNumber }) => !unmodelledNumber)
        .map(({ name }) => name),
    ).toEqual(["Slayer's Advance"]);
  });

  it('lists the reviewed rows the owner’s answer to O1 counts: all twelve, the one without an unmodelled number, or none', () => {
    const named = (answer: Parameters<typeof levelGrantRows>[0]) =>
      levelGrantRows(answer).map(({ name }) => name);
    expect(named('count')).toHaveLength(12);
    expect(named('without-numbers')).toEqual(["Slayer's Advance"]);
    expect(named('none')).toEqual([]);
    // The registry is built with the owner's answer (O1: yes, all 12).
    expect(familyGrants.reviewed).toEqual(levelGrantRows('count'));
  });

  it('proves a reviewed parent whose required class lists it and whose required increments are admitted', () => {
    expect(proven()).toEqual({ parent: [mechanism], control: [] });
    // Retained source fields say nothing about the grant.
    expect(proven({ issues: ['gameContent', 'changesNote'] })).toEqual({
      parent: [mechanism],
      control: [],
    });
    // Both on the list: the identical control then proves too.
    expect(
      proven({ registry: withReviewed([keys.parent, keys.control]) }),
    ).toEqual({ parent: [mechanism], control: [mechanism] });
  });

  it('keeps the mechanism outstanding when no required class lists the row, or a required increment is not admitted', () => {
    // Only an optional class lists it.
    expect(
      proven({
        requiredClass: classEntry(keys.required, [[10, keys.tenth]]),
        optionalClass: classEntry(keys.optional, [
          [2, keys.parent],
          [2, keys.control],
        ]),
      }),
    ).toEqual(outstanding);
    expect(proven({ rows: { required: { requirement: 'optional' } } })).toEqual(
      outstanding,
    );
    // No class lists it, or the required class has no scoped entry.
    expect(proven({ requiredClass: classEntry(keys.required, []) })).toEqual(
      outstanding,
    );
    expect(proven({ requiredClass: null })).toEqual(outstanding);
    // A required increment unadmitted or held.
    expect(
      proven({ admitted: [keys.parent, keys.control, keys.sixth] }),
    ).toEqual({ parent: [], control: [] });
    expect(proven({ held: [keys.tenth] })).toEqual(outstanding);
    // An admitted optional increment changes nothing; an unadmitted one
    // (above, by default) doesn't refuse.
    expect(
      proven({
        admitted: [
          keys.parent,
          keys.control,
          keys.sixth,
          keys.tenth,
          keys.optionalIncrement,
        ],
      }),
    ).toEqual({ parent: [mechanism], control: [] });
  });

  it('keeps the mechanism outstanding when the entry carries Modifiers, slots, prerequisites, proficiencies or increment, pick or casting detail', () => {
    const parent = (rest: object, detail: object = {}) => {
      const parentEntry = entry(
        keys.parent,
        { kind: 'classFeature', ...detail },
        rest,
      );
      // Each refused entry is a valid imported entry: the field refuses it.
      expect(importedCatalogEntrySchema.safeParse(parentEntry).success).toBe(
        true,
      );
      return proven({ parentEntry });
    };
    const modifier = { target: 'save.will', bonusType: 'morale', value: 1 };
    for (const [label, rest] of [
      ['modifier', { modifiers: [modifier] }],
      ['feat slot', { grantsSlots: [{ kind: 'feat', count: 1 }] }],
      ['prerequisite', { prerequisites: [{ bab: 1 }] }],
      ['proficiency', { proficiencies: [{ group: 'Heavy armor' }] }],
    ] as const)
      expect(parent(rest), label).toEqual(outstanding);
    // A descriptive note restating the body (Armor Mastery's) is no Modifier.
    expect(
      parent({
        situationalNotes: [{ text: 'Damage reduction 5/— while armored.' }],
      }),
    ).toEqual({ parent: [mechanism], control: [] });
    for (const [label, detail] of [
      ['parentFeature', { parentFeature: keys.control }],
      ['part', { part: `2:${keys.parent}` }],
      ['duplicateUpgrade', { duplicateUpgrade: keys.control }],
      [
        'picksByLevel',
        { picksByLevel: [{ classLevel: 2, list: 'Rage Powers', count: 1 }] },
      ],
      [
        'spellcasting',
        { spellcasting: { chooses: 'domain', optionGrantsSpells: false } },
      ],
    ] as const)
      expect(parent({}, detail), label).toEqual(outstanding);
    // An entry of another kind.
    expect(
      proven({ parentEntry: entry(keys.parent, { kind: 'manual' }) }),
    ).toEqual(outstanding);
  });

  it('keeps the mechanism outstanding with an outgoing requirement edge, a changes or curation issue, stale evidence or no gate admission', () => {
    expect(
      proven({
        edges: [
          { from: keys.parent, to: 'pf1/proofOption', kind: 'requirement' },
        ],
      }),
    ).toEqual(outstanding);
    // Other outgoing edges (notices, citations) don't refuse.
    expect(
      proven({
        edges: [{ from: keys.parent, to: 'notice/PZO1110', kind: 'notice' }],
      }),
    ).toEqual({ parent: [mechanism], control: [] });
    for (const field of [
      'changes',
      'changes.0.formula',
      'curation',
      'curation.mechanics',
    ])
      expect(proven({ issues: [field] }), field).toEqual(outstanding);
    expect(
      proven({ input: { calculationIdentity: 'sha256:' + 'f'.repeat(64) } }),
    ).toEqual({ parent: [], control: [] });
    expect(
      proven({
        input: {
          proofs: {
            registry: withReviewed([keys.parent]),
            sha256Of: (path) =>
              path === proofTest ? 'e'.repeat(64) : repository(path),
          },
        },
      }),
    ).toEqual(outstanding);
    // Not admitted: the row isn't verified at all.
    expect(
      proven({ admitted: [keys.control, keys.sixth, keys.tenth] }),
    ).toEqual({ parent: undefined, control: [] });
  });

  it('never proves a class feature through an entry without the level-grant scope', () => {
    const unscoped = {
      family: 'feature-option-grants',
      mechanism,
      kinds: ['classFeature', 'companionFeature'],
      tests: [
        { path: proofTest, sha256: repository(proofTest) ?? '0'.repeat(64) },
      ],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: [],
    };
    expect(proven({ registry: [unscoped] })).toEqual(outstanding);
    expect(
      proven({
        registry: [
          {
            ...unscoped,
            scope: { detailKind: 'classFeature', nonEmpty: [], empty: [] },
          },
        ],
      }),
    ).toEqual(outstanding);
    // The same entry still proves a row of another kind it names.
    expect(
      proven({
        registry: [unscoped],
        rows: { parent: { kind: 'companionFeature' } },
      }),
    ).toEqual({ parent: [mechanism], control: [] });
  });
});

/**
 * The committed-inventory control's evidence: every admitted classFeature row
 * carrying the mechanism at the base (the committed projection's rows are the
 * gate's admitted rows), and each class whose grant edge names one, with the
 * entries and issues the current importer gives them from the pinned store,
 * read as `buildLaunchVerification` reads the pinned checkouts
 * (`importedEvidence`). `project` runs the projection over the whole
 * committed inventory with the base's real gate.
 */
async function loadFeatureGrantControl() {
  const inventory = parseLaunchInventory(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
    ),
  );
  const base = parseLaunchVerification(
    JSON.parse(
      await readFile(
        'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
        'utf8',
      ),
    ),
  );
  const admitted = base.rows
    .map(({ key }) => key)
    .filter((key) => !key.startsWith('resource/'));
  const admittedKeys = new Set(admitted);
  const familyRows = inventory.rows.filter(
    (found) =>
      found.kind === 'classFeature' &&
      admittedKeys.has(found.key) &&
      found.mechanisms.some(
        ({ name, status }) => name === mechanism && status === 'outstanding',
      ),
  );
  const familyKeys = new Set(familyRows.map(({ key }) => key));
  const byKey = new Map(inventory.rows.map((found) => [found.key, found]));
  const classRows = [
    ...new Set(
      inventory.edges
        .filter(
          ({ kind, from, to }) =>
            kind === 'grant' &&
            familyKeys.has(to) &&
            byKey.get(from)?.kind === 'class',
        )
        .map(({ from }) => from),
    ),
  ].flatMap((key) => byKey.get(key) ?? []);
  const files = [...familyRows, ...classRows].map(({ key, sources }) => {
    const [bound, ...others] = sources.filter(
      ({ repository: repo }) => repo === 'pf1' || repo === 'pf1-content',
    );
    if (!bound || others.length)
      throw new Error(`${key} binds no single Foundry source.`);
    return {
      file: `${bound.repository}/${bound.locator}`,
      sha: bound.rawSha256,
    };
  });
  const tree = await materializePinnedTree(
    files.map(({ file }) => file),
    { sha256: Object.fromEntries(files.map(({ file, sha }) => [file, sha])) },
  );
  const evidence = await importedEvidence(tree).finally(() => tree.dispose());
  const keysRead = [...familyRows, ...classRows].map(({ key }) => key);
  const missing = keysRead.filter((key) => !evidence.entries.has(key));
  if (missing.length)
    throw new Error(`No real entry for ${missing.join(', ')}.`);
  const project = (registry: readonly unknown[]) =>
    verifyLaunchRows(inventory, {
      admission: {
        admitted: admitted.map((externalKey) => ({
          externalKey,
          reason: 'Admitted at the base.',
        })),
        held: [],
        dependentOmissions: [],
        retainedExceptions: [],
        failures: [],
      },
      scopeBuild: {
        entries: keysRead.map((key) => evidence.entries.get(key)),
        remaps: new Map(),
        resources: new Map(),
      },
      unsupported: {
        entries: keysRead.map((externalKey) => ({
          externalKey,
          issues: evidence.issues.get(externalKey) ?? [],
        })),
      },
      proofs: { registry, sha256Of: repository },
      proseCases: [],
      calculationIdentity: currentCalculationIdentity,
      stale: [],
    })
      .filter(({ mechanisms }) => mechanisms.includes(mechanism))
      .map(({ key }) => key)
      .sort();
  return { project, familyRows, classRows };
}

describe('the class-feature level-grant family over the committed inventory', () => {
  it('proves exactly the reviewed rows at the base’s gate, and the list is what refuses the structurally identical rows', async () => {
    const { project, familyRows } = await loadFeatureGrantControl();
    const reviewed = familyGrants.reviewed.map(({ key }) => key).sort();
    // The committed registry over the real entries and the base's gate.
    const control = project(launchMechanismProofs);
    expect(control).toEqual(reviewed);
    // Without the list (every admitted parent on it), the structural checks
    // alone pass more rows: the eleven chosen-option, conditional and
    // dual-shape parents (design Q4, risk 1), and Armor Training (Heavy
    // Armor), which the Fighter's entry lists at its Foundry level with no
    // grant edge in the inventory, so the design's rows missed it.
    const structural = project(withReviewed(familyRows.map(({ key }) => key)));
    const byKey = new Map(familyRows.map((found) => [found.key, found.name]));
    expect(
      structural
        .filter((key) => !reviewed.includes(key))
        .map((key) => byKey.get(key))
        .sort(),
    ).toEqual([
      'Armor Training (Heavy Armor)',
      'Bloodline Spells (BLO)',
      'Bloodline Spells (SOR)',
      'Channel Energy',
      'Favored Enemy',
      'Favored Terrain',
      'Rage Powers',
      'Revelation',
      'Rogue Talents',
      'Slow Fall',
      'Sorcerer Bloodline',
      'Weapon Mastery',
    ]);
    expect(reviewed.filter((key) => !structural.includes(key))).toEqual([]);
    // O1's other answers prove their own lists, and nothing else.
    for (const answer of ['without-numbers', 'none'] as const)
      expect(
        project(withReviewed(levelGrantRows(answer).map(({ key }) => key))),
        answer,
      ).toEqual(levelGrantRows(answer).map(({ key }) => key));
    // The committed projection proves the mechanism on exactly the list.
    const committed = parseLaunchVerification(
      JSON.parse(
        await readFile(
          'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
          'utf8',
        ),
      ),
    );
    expect(
      committed.rows
        .filter(({ mechanisms }) => mechanisms.includes(mechanism))
        .map(({ key }) => key)
        .sort(),
    ).toEqual(reviewed);
  }, 180_000);
});
