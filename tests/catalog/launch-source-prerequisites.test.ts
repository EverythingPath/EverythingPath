// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import { launchMechanismProofs } from '../../scripts/catalog/launch-mechanism-proofs';
import {
  currentMechanismProofs,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchGate,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { representativeSelectionCatalog } from '../../convex/lib/representativeSelectionCatalog';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import { importedEvidence } from './launch-modifier-evidence';
import { materializePinnedTree, pinnedStore } from './pinned-sources';

// Content verification, source-prereqs S1 (#776): the feat Source-prerequisites
// family. The inventory names one `Source prerequisites` mechanism per source
// Prerequisites paragraph (`launch-inventory-build.ts`); the family proves it
// only for a reviewed, admitted feat whose scoped entry's clauses and source
// bytes equal the reviewed ones, whose every clause is an ability, BAB, feat
// or skill-rank atom the public saved-sheet proof
// (`convex/characterSheetSourcePrerequisites.integration.test.ts`) checks,
// whose `prerequisiteText` is its contract paragraph and whose named feats
// are all admitted. The rows, entries and reviewed records here are
// synthetic; the committed control below reads the real ones.
const proofTest =
  'convex/characterSheetSourcePrerequisites.integration.test.ts';
const name = 'Source prerequisites';
const repository = (path: string) => repositoryFileSha256('.', path);
const currentRegistry = {
  registry: launchMechanismProofs,
  sha256Of: repository,
};
const family = launchMechanismProofs.find(
  (proof) => proof.family === 'source-prerequisites',
);

/** The fixed root keys of #776, with their names. */
const listedRows = [
  ['pf1/ACEQfonKVqh0fwkK', 'Deflect Arrows'],
  ['pf1/nhUawPP4jfED3CYV', "Gorgon's Fist"],
  ['pf1/dn2KgHFQRbuoNRx0', 'Improved Bull Rush'],
  ['pf1/711B9WNFgpdDKKf2', 'Improved Disarm'],
  ['pf1/tocde3sKG1O3GKgd', 'Improved Feint'],
  ['pf1/ZmQkRk93nbHxsQSt', 'Improved Grapple'],
  ['pf1/cKxfEL5XOWuzLhfO', 'Improved Iron Will'],
  ['pf1/PrthT5jZl4t3znqR', 'Improved Lightning Reflexes'],
  ['pf1/gTrGPxzN054GfpkM', 'Improved Trip'],
  ['pf1/R7L4SlGRlnThqFrP', 'Mobility'],
  ['pf1/rp9HV7wYcMb333si', 'Mounted Archery'],
  ['pf1/0spsP9ylE3goD3jc', 'Mounted Combat'],
  ['pf1/VMVAqGze4cs3naya', 'Nimble Moves'],
  ['pf1/liPAO5urMI9chctT', 'Ride-By Attack'],
  ['pf1/2AfSIVge3bg8r6wr', 'Scorpion Style'],
  ['pf1/bHcqTC4Lf3aVl3VO', 'Snatch Arrows'],
  ['pf1/jKVhOxHu6VmUgFdp', 'Spirited Charge'],
  ['pf1/ugQyUpqPBDsqLyra', 'Spring Attack'],
  ['pf1/PkktjwppuVzoLn19', 'Strike Back'],
] as const;

const contractPrefix =
  'Preserve all alternatives, minima, conditions and recorded-level/active checks in the complete source requirement: ';
const sourcePrerequisites = (
  paragraph: string,
): LaunchRow['mechanisms'][number] => ({
  name,
  disposition: 'calculated',
  status: 'outstanding',
  contract: `${contractPrefix}${paragraph}`,
  evidence: ['row.sources', '#739'],
});
const source = 'e'.repeat(64);
type Row = Parameters<typeof verifyLaunchRows>[0]['rows'][number];
function featRow(key: string, paragraph: string, change: Partial<Row> = {}) {
  return {
    key,
    kind: 'feat',
    catalogKey: key,
    requirement: 'required' as const,
    holds: [],
    mechanisms: [sourcePrerequisites(paragraph)],
    sources: [
      {
        repository: 'pf1',
        pin: 'baseline',
        locator: `packs/feats/${key}.yaml`,
        rawSha256: source,
        effectiveSha256: source,
      },
    ],
    noticeEvidence: { state: 'unreviewed' as const, evidence: ['row.sources'] },
    ...change,
  } satisfies Row;
}
type EntryChange = {
  prerequisiteText?: string;
  prerequisites?: unknown[];
  [field: string]: unknown;
};
/** A scoped feat entry with its prerequisites and any other change. */
function featEntry(
  key: string,
  { prerequisiteText, prerequisites, ...change }: EntryChange,
) {
  return {
    externalKey: key,
    upstreamKey: key.split('/')[1],
    pack: 'feats',
    name: key,
    detail: { kind: 'feat', featTypes: ['Combat'], repeatable: 'no' },
    description: '',
    sources: [{ book: 'PZO1110' }],
    modifiers: [],
    unsupported: [],
    prerequisiteText,
    prerequisites,
    ...change,
  };
}

// Synthetic feats: A needs Dex 13; B names A and needs BAB +6; C needs one
// Ride rank. The control is identical to A but not reviewed.
const keys = {
  dex: 'pf1/proofDex',
  bab: 'pf1/proofBab',
  ride: 'pf1/proofRide',
  control: 'pf1/proofControl',
};
const dexClauses = [{ ability: 'dexterity', min: 13, kind: 'ability' }];
const babClauses = [
  { feat: keys.dex, kind: 'feat' },
  { bab: 6, kind: 'bab' },
];
const rideClauses = [{ skillRanks: 'skill.rid', min: 1, kind: 'skillRanks' }];
const synthetic = [
  {
    key: keys.dex,
    paragraph: 'Prerequisites: Dex 13.',
    text: 'Dex 13',
    clauses: dexClauses,
  },
  {
    key: keys.bab,
    paragraph:
      'Prerequisites: @UUID[Compendium.pf1.feats.Item.proofDex]{Proof Dex}, base attack bonus +6.',
    text: 'Proof Dex, base attack bonus +6',
    clauses: babClauses,
  },
  {
    key: keys.ride,
    paragraph: 'Prerequisites: Ride 1 rank.',
    text: 'Ride 1 rank',
    clauses: rideClauses,
  },
];
const reviewedRecord = (
  key: string,
  clauses: unknown[],
  change: Record<string, unknown> = {},
) => ({
  key,
  name: key,
  sourceSha256: source,
  clauses,
  basis: 'Synthetic.',
  body: 'no-sheet-number',
  ...change,
});
const syntheticReviewed = synthetic.map(({ key, clauses }) =>
  reviewedRecord(key, clauses),
);

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? { ...value } : {};
const isFamily = (proof: unknown) =>
  typeof proof === 'object' &&
  proof !== null &&
  'family' in proof &&
  proof.family === 'source-prerequisites';

/** The registry with the family's reviewed list (and scope) replaced. */
function withReviewed(
  reviewed: unknown[],
  scope: Record<string, unknown> = {},
): unknown[] {
  if (!family || !('prerequisites' in family))
    throw new Error('Missing the source-prerequisites family');
  return launchMechanismProofs.map((proof) =>
    proof === family
      ? {
          ...family,
          prerequisites: { ...family.prerequisites, reviewed, ...scope },
        }
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
  ...synthetic.map(({ key, paragraph }) => featRow(key, paragraph)),
  featRow(keys.control, 'Prerequisites: Dex 13.'),
];
const baseEntries = () => [
  ...synthetic.map(({ key, text, clauses }) =>
    featEntry(key, { prerequisiteText: text, prerequisites: clauses }),
  ),
  featEntry(keys.control, {
    prerequisiteText: 'Dex 13',
    prerequisites: dexClauses,
  }),
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

describe('the feat Source-prerequisites family', () => {
  it('names its public saved-sheet proof with its current bytes, the current calculation identity and its reviewed rows', () => {
    // The registry's whole family list is pinned once, in
    // `launch-mechanism-registry.test.ts`.
    expect(
      launchMechanismProofs.filter(
        (proof) => proof.family === 'source-prerequisites',
      ),
    ).toEqual([family]);
    expect(family).toMatchObject({
      mechanism: name,
      kinds: ['feat'],
      tests: [{ path: proofTest }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['prerequisites'],
      prerequisites: { kinds: ['ability', 'bab', 'feat', 'skillRanks'] },
    });
    const reviewed =
      family && 'prerequisites' in family ? family.prerequisites.reviewed : [];
    expect(reviewed.map(({ key, name: rowName }) => [key, rowName])).toEqual(
      listedRows,
    );
    expect(currentMechanismProofs(currentRegistry)).toContainEqual(family);
    // The entry with its test file's bytes changed proves nothing.
    expect(
      currentMechanismProofs({
        registry: launchMechanismProofs,
        sha256Of: (path) =>
          path === proofTest ? 'e'.repeat(64) : repository(path),
      }),
    ).not.toContainEqual(family);
  });

  it('proves a reviewed admitted feat whose clauses equal its reviewed clauses and whose named feats are admitted', () => {
    expect(proven()).toEqual({
      [keys.dex]: [name],
      [keys.bab]: [name],
      [keys.ride]: [name],
      [keys.control]: [],
    });
  });

  it('keeps the mechanism outstanding for any row, entry, review, gate or evidence that differs from the reviewed proof', () => {
    const [, babFeat] = synthetic;
    if (!babFeat) throw new Error('Missing the BAB feat');
    const babRow = (change: Partial<Row> = {}) =>
      featRow(keys.bab, babFeat.paragraph, change);
    const babEntry = (
      clauses: unknown[] = babClauses,
      change: Record<string, unknown> = {},
    ) =>
      featEntry(keys.bab, {
        prerequisiteText: babFeat.text,
        prerequisites: clauses,
        ...change,
      });
    const reviewedBab = (clauses: unknown[], change = {}) =>
      syntheticReviewed.map((record) =>
        record.key === keys.bab
          ? reviewedRecord(keys.bab, clauses, change)
          : record,
      );
    /** The BAB feat's proven mechanisms after one change. */
    function babProven({
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
            other.key === keys.bab ? (row ?? other) : other,
          ),
          entries: baseEntries().flatMap((other) =>
            other.externalKey !== keys.bab
              ? [other]
              : entry === undefined
                ? [other]
                : entry === null
                  ? []
                  : [entry],
          ),
          ...(registry ? { proofs: { registry, sha256Of: repository } } : {}),
          ...change,
        })[keys.bab] ?? []
      );
    }
    // A clause the entry and the review share, of a kind the proof doesn't
    // check, refuses the row although the clauses are equal.
    const sharedClause = (clause: unknown) => ({
      entry: babEntry([...babClauses, clause]),
      registry: withReviewed(reviewedBab([...babClauses, clause])),
    });
    const gateWithDex = (
      field: keyof Omit<LaunchGate, 'admitted'> | 'unassessed',
    ) => {
      const gate = admittedGate(
        Object.values(keys).filter((key) => key !== keys.dex),
      );
      return field === 'unassessed'
        ? gate
        : {
            ...gate,
            [field]: [{ externalKey: keys.dex, reason: 'Not admitted.' }],
          };
    };
    const cases: [string, Parameters<typeof babProven>[0]][] = [
      // The list and the source bytes.
      [
        'off the reviewed list',
        {
          registry: withReviewed(
            syntheticReviewed.filter(({ key }) => key !== keys.bab),
          ),
        },
      ],
      [
        'a reviewed source hash the row does not bind',
        {
          registry: withReviewed(
            reviewedBab(babClauses, { sourceSha256: 'f'.repeat(64) }),
          ),
        },
      ],
      [
        'changed source bytes',
        {
          row: babRow({
            sources: [
              {
                repository: 'pf1',
                pin: 'baseline',
                locator: 'packs/feats/proofBab.yaml',
                rawSha256: 'f'.repeat(64),
                effectiveSha256: 'f'.repeat(64),
              },
            ],
          }),
        },
      ],
      // The entry's clauses against the reviewed ones.
      [
        'a lower minimum',
        { entry: babEntry([babClauses[0], { bab: 5, kind: 'bab' }]) },
      ],
      ['a dropped clause', { entry: babEntry([babClauses[0]]) }],
      ['reordered clauses', { entry: babEntry([...babClauses].reverse()) }],
      [
        'a clause without its kind',
        { entry: babEntry([babClauses[0], { bab: 6 }]) },
      ],
      [
        'a clause with another field',
        {
          entry: babEntry([babClauses[0], { bab: 6, kind: 'bab', or: true }]),
        },
      ],
      [
        'a reviewed clause the entry lacks',
        {
          registry: withReviewed(reviewedBab([...babClauses, ...dexClauses])),
        },
      ],
      [
        'no prerequisites',
        { entry: babEntry([], { prerequisites: undefined }) },
      ],
      // Clause kinds the proof does not check.
      [
        'an unchecked clause',
        sharedClause({ unchecked: 'Elf', kind: 'unchecked' }),
      ],
      [
        'alternatives',
        sharedClause({
          anyOf: [
            { ability: 'strength', min: 13, kind: 'ability' },
            { bab: 1, kind: 'bab' },
          ],
        }),
      ],
      [
        'a class level',
        sharedClause({ classLevel: 'pf1/wizard', min: 1, kind: 'classLevel' }),
      ],
      ['a caster level', sharedClause({ casterLevel: 3, kind: 'casterLevel' })],
      [
        'a proficiency',
        sharedClause({ proficiency: { choice: true }, kind: 'proficiency' }),
      ],
      [
        'a class feature',
        sharedClause({ classFeature: 'pf1/kiPool', kind: 'classFeature' }),
      ],
      ['a race', sharedClause({ race: ['pf1/elf'], kind: 'race' })],
      ['an alignment', sharedClause({ alignment: ['LG'], kind: 'alignment' })],
      [
        'a feat with a chosen option',
        sharedClause({ feat: keys.ride, choice: 'longsword', kind: 'feat' }),
      ],
      [
        'a kind the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, {
            kinds: ['ability', 'feat', 'skillRanks'],
          }),
        },
      ],
      // The text tie and the row's mechanism.
      [
        'a prerequisite text other than the paragraph',
        { entry: babEntry(babClauses, { prerequisiteText: 'Proof Dex' }) },
      ],
      [
        'a changed paragraph',
        {
          row: babRow({
            mechanisms: [
              sourcePrerequisites(
                'Prerequisites: @UUID[Compendium.pf1.feats.Item.proofDex]{Proof Dex}, base attack bonus +7.',
              ),
            ],
          }),
        },
      ],
      [
        'a contract that is not the inventory’s',
        {
          row: babRow({
            mechanisms: [
              {
                ...sourcePrerequisites(babFeat.paragraph),
                contract: babFeat.paragraph,
              },
            ],
          }),
        },
      ],
      [
        'two Prerequisites paragraphs',
        {
          row: babRow({
            mechanisms: [
              sourcePrerequisites(babFeat.paragraph),
              sourcePrerequisites(babFeat.paragraph),
            ],
          }),
        },
      ],
      // The gate: the named feat and the row.
      ['a held named feat', { admission: gateWithDex('held') }],
      [
        'a dependently omitted named feat',
        { admission: gateWithDex('dependentOmissions') },
      ],
      [
        'a retained named feat',
        { admission: gateWithDex('retainedExceptions') },
      ],
      ['a failed named feat', { admission: gateWithDex('failures') }],
      ['an unassessed named feat', { admission: gateWithDex('unassessed') }],
      [
        'an unadmitted row',
        {
          admission: admittedGate(
            Object.values(keys).filter((key) => key !== keys.bab),
          ),
        },
      ],
      // Issues the family names, and the evidence.
      ...['prerequisites', 'prerequisites.clauses'].map(
        (field): [string, Parameters<typeof babProven>[0]] => [
          `a ${field} issue`,
          {
            unsupported: {
              entries: [{ externalKey: keys.bab, issues: [{ field }] }],
            },
          },
        ],
      ),
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
        { entry: babEntry(babClauses, { detail: { kind: 'classFeature' } }) },
      ],
      [
        'a Racial Trait carrying the mechanism',
        {
          row: babRow({ kind: 'racialTrait' }),
          entry: babEntry(babClauses, {
            detail: {
              kind: 'racialTrait',
              bonusSkillRanksPerLevel: 0,
              raceKeys: [],
              standard: true,
            },
          }),
        },
      ],
      [
        'a class feature carrying the mechanism',
        {
          row: babRow({ kind: 'classFeature' }),
          entry: babEntry(babClauses, { detail: { kind: 'classFeature' } }),
        },
      ],
    ];
    expect(babProven({})).toEqual([name]);
    for (const [label, change] of cases)
      expect(babProven(change), label).toEqual([]);
    // Even a registry entry widened to other kinds proves only feats.
    const widened = withReviewed(syntheticReviewed).map((proof) =>
      isFamily(proof)
        ? { ...asObject(proof), kinds: ['feat', 'racialTrait', 'classFeature'] }
        : proof,
    );
    expect(
      babProven({ registry: widened, row: babRow({ kind: 'racialTrait' }) }),
      'a Racial Trait row with a feat entry',
    ).toEqual([]);
    for (const kind of ['racialTrait', 'classFeature'])
      expect(
        babProven({
          registry: widened,
          row: babRow({ kind }),
          entry: babEntry(babClauses, {
            detail:
              kind === 'racialTrait'
                ? {
                    kind,
                    bonusSkillRanksPerLevel: 0,
                    raceKeys: [],
                    standard: true,
                  }
                : { kind },
          }),
        }),
        kind,
      ).toEqual([]);
    // Retained source fields and curation notes say nothing about the
    // prerequisites (R4).
    for (const field of ['gameContent', 'curation.mechanics', 'changes'])
      expect(
        babProven({
          unsupported: {
            entries: [{ externalKey: keys.bab, issues: [{ field }] }],
          },
        }),
        field,
      ).toEqual([name]);
  });

  it('never proves Source prerequisites from a named entry without the reviewed scope', () => {
    const entry = (change: Record<string, unknown> = {}) => ({
      family: 'unscoped',
      mechanism: name,
      kinds: ['feat'],
      tests: [{ path: proofTest, sha256: repository(proofTest) }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: [],
      ...change,
    });
    const without = launchMechanismProofs.filter(
      (proof) => proof.family !== 'source-prerequisites',
    );
    for (const [label, registry] of [
      ['an unscoped entry', [...without, entry()]],
      [
        'a scoped feat entry',
        [
          ...without,
          entry({ scope: { detailKind: 'feat', nonEmpty: [], empty: [] } }),
        ],
      ],
      ['beside the family', [...withReviewed(syntheticReviewed), entry()]],
    ] as const)
      expect(
        proven({ proofs: { registry, sha256Of: repository } }),
        label,
      ).toEqual({
        [keys.dex]: label === 'beside the family' ? [name] : [],
        [keys.bab]: label === 'beside the family' ? [name] : [],
        [keys.ride]: label === 'beside the family' ? [name] : [],
        [keys.control]: [],
      });
    // The same unscoped entry for another mechanism still proves it.
    const other = featRow('pf1/proofOther', 'Prerequisites: Dex 13.', {
      mechanisms: [{ ...sourcePrerequisites(''), name: 'Other mechanism' }],
    });
    expect(
      proven({
        rows: [other],
        entries: [
          featEntry(other.key, {
            prerequisiteText: '',
            prerequisites: dexClauses,
          }),
        ],
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
// store by the current importer, and the committed inventory's every row
// carrying the mechanism.

/** A contract's Prerequisites paragraph as plain text, read independently. */
function paragraphText(contract: string) {
  const paragraph = contract.split('complete source requirement: ')[1] ?? '';
  return paragraph
    .replaceAll(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1')
    .replace('Prerequisites: ', '')
    .replace(/\.$/, '');
}

/** A row's one Foundry source, as `<repo>/<path>`. */
function boundSource(row: LaunchRow) {
  const [source, ...others] = row.sources.filter(
    ({ repository: repo }) => repo === 'pf1' || repo === 'pf1-content',
  );
  return source && !others.length
    ? { file: `${source.repository}/${source.locator}`, source }
    : undefined;
}

/** The committed inventory's catalog rows, and those carrying the mechanism. */
async function committedRows() {
  const committed = parseLaunchInventory(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
    ),
  );
  const catalogRows = committed.rows.filter(
    ({ catalogKey, key }) => catalogKey && !/^(?:notice|rule)\//.test(key),
  );
  return {
    committed,
    catalogRows,
    carrying: catalogRows.filter(({ mechanisms }) =>
      mechanisms.some((mechanism) => mechanism.name === name),
    ),
  };
}

/**
 * The current importer's evidence for every feat row whose one Foundry
 * source the pinned store holds, each checked against the row's raw hash.
 */
async function storedFeatEvidence(rows: readonly LaunchRow[]) {
  const files = rows.flatMap((row) => {
    const found = boundSource(row);
    return row.kind === 'feat' &&
      found &&
      existsSync(join(pinnedStore, found.file))
      ? [found]
      : [];
  });
  const tree = await materializePinnedTree(
    files.map(({ file }) => file),
    {
      sha256: Object.fromEntries(
        files.map(({ file, source }) => [file, source.rawSha256]),
      ),
    },
  );
  try {
    return await importedEvidence(tree);
  } finally {
    await tree.dispose();
  }
}

type Evidence = Awaited<ReturnType<typeof storedFeatEvidence>>;
type Reviewed = Extract<
  (typeof launchMechanismProofs)[number],
  { prerequisites: unknown }
>['prerequisites']['reviewed'];

/**
 * One listed row against its real evidence: a required feat with one
 * Prerequisites paragraph and the reviewed source bytes, whose re-imported
 * clauses are the reviewed ones, whose text is the paragraph, and whose
 * prerequisites no issue names.
 */
function expectListedRow(
  record: Reviewed[number],
  row: LaunchRow | undefined,
  real: Evidence,
) {
  if (!row) throw new Error(`${record.name} is not in the inventory.`);
  const entry = real.entries.get(record.key) ?? {};
  const mechanisms = row.mechanisms.filter(
    (mechanism) => mechanism.name === name,
  );
  expect(
    {
      kind: row.kind,
      requirement: row.requirement,
      source: boundSource(row)?.source.rawSha256,
      paragraphs: mechanisms.length,
      clauses: entry.prerequisites,
      text: entry.prerequisiteText,
      issues: (real.issues.get(record.key) ?? []).filter(({ field }) =>
        field.startsWith('prerequisites'),
      ),
    },
    record.name,
  ).toEqual({
    kind: 'feat',
    requirement: 'required',
    source: record.sourceSha256,
    paragraphs: 1,
    clauses: record.clauses,
    text: paragraphText(mechanisms[0]?.contract ?? ''),
    issues: [],
  });
}

/**
 * A row carrying the mechanism with no real entry gets a best-case entry of
 * its own kind: one Str 13 clause and its paragraph as text, so only the
 * list can refuse it.
 */
const bestCase = (row: LaunchRow) =>
  featEntry(row.key, {
    prerequisiteText: paragraphText(
      row.mechanisms.find((mechanism) => mechanism.name === name)?.contract ??
        '',
    ),
    prerequisites: [{ ability: 'strength', min: 13, kind: 'ability' }],
    ...(row.kind === 'feat' ? {} : { detail: { kind: row.kind } }),
  });

/** The family's reviewed list. */
function reviewedList() {
  if (!family || !('prerequisites' in family))
    throw new Error('Missing the source-prerequisites family');
  return family.prerequisites.reviewed;
}

/**
 * The committed inventory with the current importer's evidence for its
 * stored feats, and the rows that prove the mechanism under a registry with
 * every catalog row admitted: real entries where the store holds the source,
 * and best-case ones elsewhere unless `best` is false. Loaded once.
 */
async function readControl() {
  const { committed, catalogRows, carrying } = await committedRows();
  const real = await storedFeatEvidence(catalogRows);
  const project = (registry: readonly unknown[], best = true) =>
    verifyLaunchRows(committed, {
      ...projectionInput(),
      admission: admittedGate(catalogRows.map(({ key }) => key)),
      scopeBuild: {
        entries: [
          ...real.entries.values(),
          ...(best
            ? carrying.filter(({ key }) => !real.entries.has(key)).map(bestCase)
            : []),
        ],
        remaps: new Map(),
        resources: new Map(),
      },
      unsupported: {
        entries: [...real.issues].map(([externalKey, issues]) => ({
          externalKey,
          issues,
        })),
      },
      proofs: { registry, sha256Of: repository },
    })
      .filter(({ mechanisms }) => mechanisms.includes(name))
      .map(({ key }) => key)
      .sort();
  return { catalogRows, carrying, real, project };
}
let control: ReturnType<typeof readControl> | undefined;
const committedControl = () => (control ??= readControl());

/**
 * The feats the sheet calculates by their hand-written rule identity rather
 * than by the imported row (#719/#720): the Routine Options
 * (`character-sheet-routine-options.ts`) and the feats
 * `character-sheet-attacks.ts` reads by identity. Combat Expertise is one:
 * a core flurry recomputes its steps for `combat-expertise` only
 * (`docs/character-sheet/attacks.md:100`). Proving such a feat's
 * prerequisites would count it met while the imported row misses that
 * calculation, so none is on the list.
 */
const handWrittenIdentities = [
  'arcane-strike',
  'combat-expertise',
  'deadly-aim',
  'double-slice',
  'greater-two-weapon-fighting',
  'greater-vital-strike',
  'improved-critical',
  'improved-two-weapon-fighting',
  'improved-unarmed-strike',
  'improved-vital-strike',
  'lunge',
  'manyshot',
  'medusas-wrath',
  'multiattack',
  'power-attack',
  'precise-shot',
  'quick-draw',
  'rapid-reload',
  'rapid-shot',
  'shield-master',
  'two-weapon-fighting',
  'two-weapon-rend',
  'vital-strike',
  'weapon-finesse',
];
const combatExpertise = 'pf1/NFxHebU1XhEs5WJh';

describe('the feat Source-prerequisites family over the committed inventory', () => {
  it('re-imports each listed row with its reviewed clauses, text and source bytes, and proves exactly the listed rows', async () => {
    const { catalogRows, carrying, real, project } = await committedControl();
    const reviewed = reviewedList();
    // Every listed row and every feat it names has real evidence.
    expect(
      [
        ...reviewed.map(({ key }) => key),
        ...reviewed.flatMap(({ clauses }) =>
          clauses.flatMap((clause) => ('feat' in clause ? [clause.feat] : [])),
        ),
      ].filter((key) => !real.entries.has(key)),
    ).toEqual([]);
    const byKey = new Map(catalogRows.map((row) => [row.key, row]));
    for (const record of reviewed)
      expectListedRow(record, byKey.get(record.key), real);
    // Every catalog row admitted, real entries where the store holds the
    // source and best-case ones elsewhere: exactly the listed rows prove.
    const listed = reviewed.map(({ key }) => key).sort();
    expect(
      carrying.filter(({ kind }) => kind === 'feat').length,
    ).toBeGreaterThan(listed.length);
    expect(project(launchMechanismProofs)).toEqual(listed);
    expect(project(launchMechanismProofs, false)).toEqual(listed);
    // The list is what refuses them: listing a best-case row with its bytes
    // and clauses proves it as well.
    const unlisted = carrying.find(
      (row) =>
        row.kind === 'feat' &&
        !real.entries.has(row.key) &&
        row.mechanisms.filter((mechanism) => mechanism.name === name).length ===
          1,
    );
    const sha = unlisted && boundSource(unlisted)?.source.rawSha256;
    if (!unlisted || !sha) throw new Error('Missing an unlisted feat');
    expect(
      project(
        withReviewed([
          ...reviewed,
          reviewedRecord(
            unlisted.key,
            [{ ability: 'strength', min: 13, kind: 'ability' }],
            { sourceSha256: sha },
          ),
        ]),
      ),
    ).toEqual([...listed, unlisted.key].sort());
  }, 300_000);

  it('refuses Combat Expertise and every other feat calculated by its hand-written identity, as unlisted admitted feats', async () => {
    const { carrying, real, project } = await committedControl();
    const reviewed = reviewedList();
    const names = new Set(
      handWrittenIdentities.map((identity) => {
        const definition = representativeSelectionCatalog.find(
          ({ ruleIdentity }) => ruleIdentity === identity,
        );
        if (!definition) throw new Error(`No hand-written ${identity}`);
        return definition.name;
      }),
    );
    // The refused set: every feat row carrying the mechanism whose name is a
    // hand-written identity's.
    const refused = carrying.filter(
      ({ kind, name: rowName }) => kind === 'feat' && names.has(rowName),
    );
    expect(refused.map(({ name: rowName }) => rowName).sort()).toEqual([
      'Arcane Strike',
      'Combat Expertise',
      'Double Slice',
      'Greater Two-Weapon Fighting',
      'Greater Vital Strike',
      'Improved Critical',
      'Improved Two-Weapon Fighting',
      'Improved Vital Strike',
      'Lunge',
      'Manyshot',
      "Medusa's Wrath",
      'Multiattack',
      'Power Attack',
      'Precise Shot',
      'Quick Draw',
      'Rapid Reload',
      'Rapid Shot',
      'Shield Master',
      'Two-Weapon Fighting',
      'Two-Weapon Rend',
      'Vital Strike',
    ]);
    const listed = new Set(reviewed.map(({ key }) => key));
    const proven = new Set(project(launchMechanismProofs));
    // With every catalog row admitted, best-case entries included, none is
    // listed or proven.
    expect(
      refused
        .filter(({ key }) => listed.has(key) || proven.has(key))
        .map(({ name: rowName }) => rowName),
    ).toEqual([]);
    // Combat Expertise fails only the list: admitted, with its real Int 13
    // clause, text and bytes, it proves once listed.
    const row = refused.find(({ key }) => key === combatExpertise);
    const clauses = real.entries.get(combatExpertise)?.prerequisites;
    const sha = row && boundSource(row)?.source.rawSha256;
    if (!sha || !Array.isArray(clauses))
      throw new Error('Missing Combat Expertise');
    expect(clauses).toEqual([
      { ability: 'intelligence', min: 13, kind: 'ability' },
    ]);
    expect(
      project(
        withReviewed([
          ...reviewed,
          reviewedRecord(combatExpertise, clauses, { sourceSha256: sha }),
        ]),
      ),
    ).toContain(combatExpertise);
  }, 300_000);
});
