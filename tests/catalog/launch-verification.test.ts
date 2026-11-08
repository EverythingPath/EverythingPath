// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  currentMechanismProofs,
  launchVerificationSchema,
  launchVerificationStaleness,
  parseLaunchVerification,
  repositoryFileSha256,
  scopeBuildResources,
  verifyLaunchRows,
  type LaunchGate,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import {
  archetypeProficiencyProseReason,
  launchProseCaseSchema,
  launchProseCases,
  parseLaunchProseCases,
  sourcePrerequisitesMechanism,
  type LaunchProseCase,
} from '../../scripts/catalog/launch-prose-categories';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import {
  classListCollectionPath,
  launchMechanismProofs,
  parseLaunchMechanismProofs,
  spellCollectionPaths,
  type LaunchMechanismProof,
  type NamedMechanismProof,
} from '../../scripts/catalog/launch-mechanism-proofs';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import { defaultCastingTables } from '../../src/lib/character-sheet-casting-tables';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import { fighterFeatures, importPinnedFighter } from './pinned-fighter';

// Real rows: the CRB Fighter's 2nd-level Bonus Feats increment, its parent
// feature, the Core Rulebook notice and the reviewed casting tables resource.
const increment = 'everythingpath/fighter-bonus-feats-2';
const parent = fighterFeatures.bonusFeats;
const notice = 'notice/PZO1110';
const castingTables = 'resource/builtin:casting-tables';
const castingTablesPath = 'scripts/catalog/reviewed-casting-tables.json';
const calculation = 'sha256:' + 'c'.repeat(64);
const optionGrants = 'Feature/option grants and conditions';
const proofTest = { path: 'tests/example.test.ts', sha256: 'a'.repeat(64) };
/** A checkout where only the proof's test file exists, with its recorded bytes. */
const proofCheckout = (path: string) =>
  path === proofTest.path ? proofTest.sha256 : undefined;
const registry = (...proofs: unknown[]) => ({
  registry: proofs,
  sha256Of: proofCheckout,
});

const unreviewed = { state: 'unreviewed' as const, evidence: ['row.sources'] };
const verifiedState = { state: 'verified' as const, evidence: ['notice'] };

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
    mechanisms: [],
    sources: [],
    noticeEvidence: unreviewed,
    ...change,
  };
}

const castingTablesSource = await readFile(castingTablesPath, 'utf8');
const castingTablesSha = createHash('sha256')
  .update(castingTablesSource)
  .digest('hex');

const manifest = {
  rows: [
    row(increment, {
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
    row(parent, {
      mechanisms: [
        {
          name: optionGrants,
          disposition: 'recorded choice',
          status: 'outstanding',
          contract: 'Retain the complete feature option.',
          evidence: ['row.sources'],
        },
      ],
    }),
    row(notice, {
      kind: 'notice',
      catalogKey: null,
      noticeEvidence: verifiedState,
    }),
    row(castingTables, {
      kind: 'resource',
      catalogKey: null,
      mechanisms: [],
      sources: [
        {
          repository: 'everythingpath',
          pin: 'baseline',
          locator: castingTablesPath,
          rawSha256: castingTablesSha,
          effectiveSha256: castingTablesSha,
        },
      ],
    }),
    row('resource/companion-progression-rules', {
      kind: 'resource',
      catalogKey: null,
      sources: [
        {
          repository: 'everythingpath',
          pin: 'baseline',
          locator: 'src/lib/catalog/representative-companion-rules.ts',
          rawSha256: castingTablesSha,
          effectiveSha256: castingTablesSha,
        },
      ],
    }),
  ],
  edges: [
    { from: increment, to: parent, kind: 'requirement' as const },
    { from: increment, to: notice, kind: 'notice' as const },
    { from: parent, to: notice, kind: 'notice' as const },
  ],
};

function admitted(...keys: string[]) {
  return keys.map((externalKey) => ({
    externalKey,
    reason: 'Admitted.',
    missingNotices: [],
    evidence: [`class-abilities-608-${externalKey.split('/')[1]}`],
  }));
}
const noGate: LaunchGate = {
  admitted: [],
  held: [],
  dependentOmissions: [],
  retainedExceptions: [],
  failures: [],
};

let entries: unknown[];
beforeAll(async () => {
  entries = (await importPinnedFighter()).catalog.entries;
}, 120_000);

function input(change: Partial<LaunchVerificationInput> = {}) {
  return {
    admission: { ...noGate, admitted: admitted(increment, parent) },
    scopeBuild: {
      entries,
      remaps: new Map(),
      resources: scopeBuildResources({
        authored: [
          { key: 'builtin:casting-tables', source: castingTablesSource },
        ],
      }),
    },
    unsupported: { entries: [] },
    proofs: { registry: [], sha256Of: () => undefined },
    proseCases: [],
    calculationIdentity: calculation,
    stale: [],
    ...change,
  } satisfies LaunchVerificationInput;
}
const verifiedOf = (rows: ReturnType<typeof verifyLaunchRows>, key: string) =>
  rows.find((entry) => entry.key === key);

describe('verifyLaunchRows', () => {
  it('verifies an admitted, fresh row and nothing that is held, failed, omitted or unassessed', () => {
    const rows = verifyLaunchRows(manifest, input());
    expect(verifiedOf(rows, increment)).toMatchObject({
      verified: ['admission', 'structure', 'contentEvidence', 'noticeEvidence'],
      mechanisms: [],
      evidence: [
        'class-abilities-608-fighter-bonus-feats-2',
        expect.stringMatching(/^entry:sha256:[a-f0-9]{64}$/),
      ],
    });
    // Notice rows keep their own readiness; they are never projected.
    expect(verifiedOf(rows, notice)).toBeUndefined();
    for (const [gate, list] of [
      ['held', 'held'],
      ['failed', 'failures'],
      ['omitted', 'dependentOmissions'],
      ['retained', 'retainedExceptions'],
    ] as const) {
      const failed = verifyLaunchRows(
        manifest,
        input({
          admission: {
            ...noGate,
            admitted: admitted(increment, parent),
            [list]: [{ externalKey: parent, reason: gate }],
          },
        }),
      );
      expect(verifiedOf(failed, parent), gate).toBeUndefined();
    }
    const unassessed = verifyLaunchRows(manifest, input({ admission: noGate }));
    expect(unassessed.map(({ key }) => key)).toEqual([castingTables]);
  });

  it('verifies nothing from stale evidence', () => {
    expect(
      verifyLaunchRows(
        manifest,
        input({ stale: ['the calculation identity changed'] }),
      ),
    ).toEqual([]);
  });

  it('keeps a held row unmet on content evidence, and a missing notice unmet on notice evidence', () => {
    const held = {
      ...manifest,
      rows: manifest.rows.map((entry) =>
        entry.key === increment
          ? {
              ...entry,
              holds: [
                {
                  reason: 'class-abilities-608-whole-content-hold',
                  owner: {
                    issue: 608,
                    responsibility: 'Fighter class abilities',
                    evidence: ['#608'],
                  },
                },
              ],
            }
          : entry.key === notice
            ? { ...entry, noticeEvidence: unreviewed }
            : entry,
      ),
    };
    expect(
      verifiedOf(verifyLaunchRows(held, input()), increment),
    ).toMatchObject({ verified: ['admission', 'structure'] });
  });

  it('lets an increment follow its parent: an unadmitted parent verifies none of its increments', () => {
    const rows = verifyLaunchRows(
      manifest,
      input({ admission: { ...noGate, admitted: admitted(increment) } }),
    );
    expect(verifiedOf(rows, increment)).toBeUndefined();
  });

  it('verifies structure only when the scoped build emits the entry', () => {
    const rows = verifyLaunchRows(
      manifest,
      input({
        scopeBuild: {
          ...input().scopeBuild,
          entries: entries.filter(
            (entry) =>
              (entry as { externalKey: string }).externalKey !== increment,
          ),
        },
      }),
    );
    expect(verifiedOf(rows, increment)?.verified).not.toContain('structure');
  });

  it('verifies a resource only from the bytes its row binds, and never one the release does not emit', () => {
    const rows = verifyLaunchRows(manifest, input());
    expect(verifiedOf(rows, castingTables)).toEqual({
      key: castingTables,
      verified: ['admission', 'structure', 'contentEvidence', 'noticeEvidence'],
      mechanisms: [],
      prose: [],
      evidence: [`source:sha256:${castingTablesSha}`],
    });
    expect(
      verifiedOf(rows, 'resource/companion-progression-rules'),
    ).toBeUndefined();
    const changed = verifyLaunchRows(
      manifest,
      input({
        scopeBuild: {
          ...input().scopeBuild,
          resources: scopeBuildResources({
            authored: [
              {
                key: 'builtin:casting-tables',
                source: `${castingTablesSource} `,
              },
            ],
          }),
        },
      }),
    );
    expect(verifiedOf(changed, castingTables)).toBeUndefined();
  });

  it('proves a mechanism only with a current registry entry and no disqualifying unsupported issue', () => {
    const proof: LaunchMechanismProof = {
      family: 'feature-option-grants',
      mechanism: optionGrants,
      kinds: ['classFeature'],
      tests: [proofTest],
      calculationIdentity: calculation,
      disqualifying: ['changes'],
    };
    const mechanismsOf = (change: Partial<LaunchVerificationInput>) =>
      verifiedOf(verifyLaunchRows(manifest, input(change)), parent)?.mechanisms;
    expect(mechanismsOf({})).toEqual([]);
    expect(mechanismsOf({ proofs: registry(proof) })).toEqual([optionGrants]);
    expect(
      mechanismsOf({
        proofs: registry({
          ...proof,
          calculationIdentity: 'sha256:' + 'd'.repeat(64),
        }),
      }),
    ).toEqual([]);
    expect(
      mechanismsOf({ proofs: registry({ ...proof, kinds: ['feat'] }) }),
    ).toEqual([]);
    const issue = (field: string) => ({
      proofs: registry(proof),
      unsupported: { entries: [{ externalKey: parent, issues: [{ field }] }] },
    });
    expect(mechanismsOf(issue('changes.0.formula'))).toEqual([]);
    expect(mechanismsOf(issue('changesFormula'))).toEqual([optionGrants]);
  });

  it('never proves permitted prose', () => {
    const prose = {
      ...manifest,
      rows: manifest.rows.map((entry) =>
        entry.key === parent
          ? {
              ...entry,
              mechanisms: [
                {
                  name: optionGrants,
                  disposition: 'permitted prose' as const,
                  status: 'outstanding' as const,
                  contract: 'Applied by hand.',
                  evidence: ['row.sources'],
                },
              ],
            }
          : entry,
      ),
    };
    const proof: LaunchMechanismProof = {
      family: 'feature-option-grants',
      mechanism: optionGrants,
      kinds: ['classFeature'],
      tests: [proofTest],
      calculationIdentity: calculation,
      disqualifying: [],
    };
    expect(
      verifiedOf(
        verifyLaunchRows(prose, input({ proofs: registry(proof) })),
        parent,
      )?.mechanisms,
    ).toEqual([]);
  });
});

describe('launchVerificationStaleness', () => {
  const packages = {
    parsers: {
      dependencyVersions: { yaml: '2.9.1' },
      resolutionSha256: '6'.repeat(64),
    },
    imports: { zod: { version: '4.3.6', lockSha256: '7'.repeat(64) } },
  };
  const document = parseLaunchVerification({
    version: 1,
    scopeVersion: 'campaign-mvp-v1',
    binding: {
      launchScopeIdentity: 'sha256:' + '1'.repeat(64),
      calculationIdentity: calculation,
      proofsSha256: '2'.repeat(64),
      gate: {
        extractionFingerprint: '3'.repeat(64),
        reviewedInputsFingerprint: '4'.repeat(64),
        legalResourcesFingerprint: '5'.repeat(64),
        upstream: [],
      },
      inputs: { [castingTablesPath]: castingTablesSha },
      packages,
    },
    rows: [],
  });
  const current = {
    scopeVersion: 'campaign-mvp-v1',
    launchScopeIdentity: 'sha256:' + '1'.repeat(64),
    calculationIdentity: calculation,
    proofsSha256: '2'.repeat(64),
    proofs: registry(),
    proseCases: [] as unknown[],
    sha256Of: (path: string) =>
      Promise.resolve(
        path === castingTablesPath ? castingTablesSha : undefined,
      ),
    packages: () => Promise.resolve(packages),
  };

  it('reports a current header as current and names each stale binding', async () => {
    await expect(
      launchVerificationStaleness(document, current),
    ).resolves.toEqual([]);
    await expect(
      launchVerificationStaleness(document, {
        ...current,
        launchScopeIdentity: 'sha256:' + '9'.repeat(64),
        calculationIdentity: 'sha256:' + '8'.repeat(64),
        proofsSha256: '7'.repeat(64),
        sha256Of: () => Promise.resolve('6'.repeat(64)),
      }),
    ).resolves.toEqual([
      'the launch inventory identity changed',
      'the calculation identity changed',
      'the mechanism proof registry changed',
      `1 bound input changed (${castingTablesPath})`,
    ]);
  });

  it('is stale when the parser or package resolution changed or cannot be read', async () => {
    const changed = (next: typeof packages) =>
      launchVerificationStaleness(document, {
        ...current,
        packages: () => Promise.resolve(next),
      });
    await expect(
      changed({
        ...packages,
        parsers: {
          ...packages.parsers,
          dependencyVersions: { yaml: '2.9.2' },
        },
      }),
    ).resolves.toEqual(['the package resolution changed (parsers)']);
    await expect(
      changed({
        ...packages,
        parsers: { ...packages.parsers, resolutionSha256: '8'.repeat(64) },
      }),
    ).resolves.toEqual(['the package resolution changed (parsers)']);
    await expect(
      changed({
        ...packages,
        imports: { zod: { version: '4.3.6', lockSha256: '8'.repeat(64) } },
      }),
    ).resolves.toEqual(['the package resolution changed (zod)']);
    await expect(
      launchVerificationStaleness(document, {
        ...current,
        packages: () =>
          Promise.reject(new Error('Missing parser version: yaml.')),
      }),
    ).resolves.toEqual([
      'the package resolution cannot be read (Missing parser version: yaml.)',
    ]);
  });

  it('is stale when a row names a mechanism no current registry entry proves', async () => {
    const claimed = parseLaunchVerification({
      ...document,
      rows: [
        {
          key: parent,
          verified: ['admission'],
          mechanisms: [optionGrants],
          prose: [],
          evidence: [],
        },
      ],
    });
    const proof = {
      family: 'feature-option-grants',
      mechanism: optionGrants,
      kinds: ['classFeature'],
      tests: [proofTest],
      calculationIdentity: calculation,
      disqualifying: [],
    };
    const reason = '1 row names a mechanism no current registry entry proves';
    await expect(
      launchVerificationStaleness(claimed, current),
    ).resolves.toEqual([reason]);
    await expect(
      launchVerificationStaleness(claimed, {
        ...current,
        proofs: registry({ ...proof, tests: [] }),
      }),
    ).resolves.toEqual([reason]);
    await expect(
      launchVerificationStaleness(claimed, {
        ...current,
        proofs: registry(proof),
      }),
    ).resolves.toEqual([]);
  });

  it('is stale when a row names reviewed-case prose no current case records', async () => {
    const reviewed: LaunchProseCase = {
      category: 'attack-feat-text',
      key: parent,
      mechanism: optionGrants,
      sourceSha256: 'f'.repeat(64),
      decision: '#237: Text.',
    };
    const claimed = parseLaunchVerification({
      ...document,
      rows: [
        {
          key: parent,
          verified: ['admission'],
          mechanisms: [],
          prose: [{ mechanism: optionGrants, category: reviewed.category }],
          evidence: [],
        },
      ],
    });
    const reason = '1 row names prose no reviewed case records';
    await expect(
      launchVerificationStaleness(claimed, current),
    ).resolves.toEqual([reason]);
    await expect(
      launchVerificationStaleness(claimed, {
        ...current,
        proseCases: [{ ...reviewed, category: 'mystery-patron-spirit' }],
      }),
    ).resolves.toEqual([reason]);
    await expect(
      launchVerificationStaleness(claimed, {
        ...current,
        proseCases: [reviewed],
      }),
    ).resolves.toEqual([]);
  });

  it('checks every prose category a projection can name against a current case on read, and refuses archetype proficiency (D7)', async () => {
    const claim = (category: string) =>
      launchVerificationSchema.safeParse({
        ...document,
        rows: [
          {
            key: parent,
            verified: ['admission'],
            mechanisms: [],
            prose: [{ mechanism: optionGrants, category }],
            evidence: [],
          },
        ],
      });
    // The categories the projection's schema accepts are exactly the case
    // categories, so none escapes the on-read case check.
    const named =
      launchVerificationSchema.shape.rows.element.shape.prose.element.shape
        .category.options;
    expect([...named].sort()).toEqual(
      [...launchProseCaseSchema.shape.category.options].sort(),
    );
    for (const category of named) {
      const parsed = claim(category);
      if (!parsed.success) throw parsed.error;
      const reviewed = {
        category,
        key: parent,
        mechanism: optionGrants,
        sourceSha256: 'f'.repeat(64),
        decision: 'Reviewed.',
      };
      await expect(
        launchVerificationStaleness(parsed.data, current),
        category,
      ).resolves.toEqual(['1 row names prose no reviewed case records']);
      await expect(
        launchVerificationStaleness(parsed.data, {
          ...current,
          proseCases: [reviewed],
        }),
        category,
      ).resolves.toEqual([]);
    }
    for (const category of ['archetype-proficiency', 'magical-lineage', ''])
      expect(claim(category).success, category).toBe(false);
  });
});

describe('the mechanism proof registry', () => {
  const proof = {
    family: 'feature-option-grants',
    mechanism: optionGrants,
    kinds: ['classFeature'],
    tests: [proofTest],
    calculationIdentity: calculation,
    disqualifying: [],
  };

  it('refuses an entry without tests, or with a malformed test', () => {
    expect(parseLaunchMechanismProofs([proof])).toEqual([proof]);
    expect(() => parseLaunchMechanismProofs([{ ...proof, tests: [] }])).toThrow(
      /tests/,
    );
    expect(() =>
      parseLaunchMechanismProofs([
        { ...proof, tests: [{ path: '', sha256: proofTest.sha256 }] },
      ]),
    ).toThrow(/tests/);
    expect(() =>
      parseLaunchMechanismProofs([
        { ...proof, tests: [{ path: proofTest.path, sha256: 'a' }] },
      ]),
    ).toThrow(/tests/);
  });

  it('counts an entry only when every test it names exists with its recorded bytes', () => {
    const other = { path: 'tests/other.test.ts', sha256: 'b'.repeat(64) };
    const checkout = (path: string) =>
      path === proofTest.path
        ? proofTest.sha256
        : path === other.path
          ? other.sha256
          : undefined;
    const current = (entry: unknown) =>
      currentMechanismProofs({ registry: [entry], sha256Of: checkout });
    expect(current(proof)).toEqual([proof]);
    expect(current({ ...proof, tests: [proofTest, other] })).toHaveLength(1);
    // No test, a missing file, and a test whose bytes changed each prove nothing.
    expect(current({ ...proof, tests: [] })).toEqual([]);
    expect(
      current({
        ...proof,
        tests: [
          proofTest,
          { path: 'tests/missing.test.ts', sha256: other.sha256 },
        ],
      }),
    ).toEqual([]);
    expect(
      current({ ...proof, tests: [{ ...other, sha256: 'c'.repeat(64) }] }),
    ).toEqual([]);
  });

  it('proves no mechanism anywhere in the committed inventory from an entry without current test evidence', async () => {
    const committed = parseLaunchInventory(
      JSON.parse(
        await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
      ),
    );
    const catalogRows = committed.rows.filter(
      ({ catalogKey, key }) => catalogKey && !/^(?:notice|rule)\//.test(key),
    );
    // Every outstanding mechanism, for every kind, on a gate admitting every row.
    const outstanding = new Set(
      catalogRows.flatMap(({ mechanisms }) =>
        mechanisms
          .filter(({ status }) => status === 'outstanding')
          .map(({ name }) => name),
      ),
    );
    const kinds = [...new Set(catalogRows.map(({ kind }) => kind))];
    const entriesFor = (tests: unknown) =>
      [...outstanding].map((mechanism) => ({
        ...proof,
        family: mechanism,
        mechanism,
        kinds,
        tests,
      }));
    const proven = (proofs: LaunchVerificationInput['proofs']) =>
      verifyLaunchRows(committed, {
        ...input(),
        admission: {
          ...noGate,
          admitted: catalogRows.map(({ key }) => ({
            externalKey: key,
            reason: 'Admitted.',
          })),
        },
        proofs,
      }).filter(({ mechanisms }) => mechanisms.length > 0);
    expect(outstanding.size).toBeGreaterThan(0);
    // The control: a current entry proves rows, so the refusals below are real.
    expect(proven(registry(...entriesFor([proofTest]))).length).toBeGreaterThan(
      0,
    );
    for (const [why, tests] of [
      ['no test', []],
      [
        'a missing file',
        [{ path: 'tests/missing.test.ts', sha256: proofTest.sha256 }],
      ],
      ['changed bytes', [{ ...proofTest, sha256: 'e'.repeat(64) }]],
      ['no tests field', undefined],
    ] as const)
      expect(proven(registry(...entriesFor(tests))), why).toEqual([]);
  });
});

// Content verification slice 2: the registry's first family, the spell class
// list, and permitted prose by category (owner decision 2026-11-03).
const classList = 'Class-list and granted-spell metadata';
const spellSource = 'd'.repeat(64);
const repository = (path: string) => repositoryFileSha256('.', path);
const currentRegistry = {
  registry: launchMechanismProofs,
  sha256Of: repository,
};
/** The spell class-list family's registry entry. */
const spellClassList = launchMechanismProofs.find(
  (proof): proof is NamedMechanismProof =>
    'mechanism' in proof && proof.family === 'spell-class-list',
);

function spellEntry(
  key: string,
  detail: { levels?: object; grantedLevels?: object } = {},
) {
  return {
    externalKey: key,
    upstreamKey: key.split('/')[1],
    pack: 'spells',
    name: key,
    detail: {
      kind: 'spell',
      levels: { wizard: 2 },
      grantedLevels: {},
      school: 'enc',
      subschools: [],
      descriptors: [],
      ...detail,
    },
    description: '',
    sources: [{ book: 'PZO1110' }],
    modifiers: [],
    unsupported: [],
  };
}

type SpellLists = {
  levels: Record<string, unknown>;
  grantedLevels: Record<string, unknown>;
};
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};

/**
 * Each inventory spell's real class and granted lists, as the importer maps
 * them (`mapSpell`): from its pinned source in the store
 * (`tests/fixtures/pinned`), with the bytes the row binds, where the store has
 * it, else from the committed spell batch preview that imported it.
 */
async function realSpellLists(rows: readonly LaunchRow[]) {
  const previews = await previewSpellLists();
  const lists = new Map<string, SpellLists>();
  for (const row of rows) {
    const found =
      (await pinnedSpellLists(row)) ?? previews.get(row.catalogKey ?? row.key);
    if (!found) throw new Error(`No real lists for ${row.key}.`);
    lists.set(row.key, found);
  }
  return lists;
}

/** Every spell entry's lists in the committed spell batch previews. */
async function previewSpellLists() {
  const previews = new Map<string, SpellLists>();
  const batches = (await readdir('tests/fixtures')).filter((batch) =>
    batch.startsWith('spells-'),
  );
  const paths = batches
    .flatMap((batch) =>
      ['preview.json', 'binding-preview.json'].map((file) =>
        join('tests/fixtures', batch, file),
      ),
    )
    .filter((path) => existsSync(path));
  for (const path of paths) {
    const preview: { entries?: unknown[] } = JSON.parse(
      await readFile(path, 'utf8'),
    );
    for (const entry of preview.entries ?? []) {
      const { externalKey, detail } = asRecord(entry);
      const { kind, levels, grantedLevels } = asRecord(detail);
      if (kind === 'spell' && typeof externalKey === 'string')
        previews.set(externalKey, {
          levels: asRecord(levels),
          grantedLevels: asRecord(grantedLevels),
        });
    }
  }
  return previews;
}

/** The row's lists from its one pinned source, when the store has it. */
async function pinnedSpellLists(
  row: LaunchRow,
): Promise<SpellLists | undefined> {
  const [source, ...others] = row.sources;
  if (!source || others.length)
    throw new Error(`${row.key} binds no single source.`);
  const pinned = join(
    'tests/fixtures/pinned',
    source.repository,
    source.locator,
  );
  if (!existsSync(pinned)) return undefined;
  const bytes = await readFile(pinned);
  expect(createHash('sha256').update(bytes).digest('hex'), row.key).toBe(
    source.rawSha256,
  );
  const { system } = asRecord(parseYaml(bytes.toString('utf8')));
  const { class: levels, ...grantedLevels } = asRecord(
    asRecord(system).learnedAt,
  );
  return { levels: asRecord(levels), grantedLevels };
}

/** A class's collection path, read straight from the reviewed casting data. */
function reviewedPath(classTag: string) {
  const { classes } = defaultCastingTables;
  if (!Object.hasOwn(classes, classTag)) return undefined;
  const { record, bookType, spellKind } = classes[classTag] ?? {};
  if (record === 'none') return 'whole-list';
  if (record === 'known') return 'known';
  if (bookType === 'familiar') return 'familiar';
  return bookType === 'formula' || spellKind === 'alchemy' ? 'formula' : 'book';
}

function spellRow(key: string) {
  return row(key, {
    kind: 'spell',
    mechanisms: [
      {
        name: classList,
        disposition: 'recorded choice',
        status: 'outstanding',
        contract: 'Preserve every applicable class list level.',
        evidence: ['row.sources'],
      },
    ],
    sources: [
      {
        repository: 'pf1' as const,
        pin: 'baseline',
        locator: `packs/spells/${key}.yaml`,
        rawSha256: spellSource,
        effectiveSha256: spellSource,
      },
    ],
  });
}

describe('the spell class-list family', () => {
  const family = spellClassList;

  it('names the public saved-sheet proof with its current bytes and the current calculation identity', () => {
    expect(family).toMatchObject({
      family: 'spell-class-list',
      mechanism: classList,
      kinds: ['spell'],
      calculationIdentity: currentCalculationIdentity,
      scope: { detailKind: 'spell', nonEmpty: ['levels'] },
    });
    expect(family?.scope?.empty).toContain('grantedLevels');
    // The proof records into a book, known, familiar and formula collection
    // and browses a whole list read-only: every path a reviewed casting uses,
    // each at levels 1 to 9, and level 0 on every path but formula.
    const nonZero = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(family?.scope?.collections).toEqual(
      spellCollectionPaths.map((path) => ({
        path,
        levels: path === 'formula' ? nonZero : [0, ...nonZero],
      })),
    );
    expect(currentMechanismProofs(currentRegistry)).toContainEqual(family);
    // The same entry with any test file's bytes changed proves nothing.
    for (const test of family?.tests ?? [])
      expect(
        currentMechanismProofs({
          registry: launchMechanismProofs,
          sha256Of: (path) =>
            path === test.path ? 'e'.repeat(64) : repository(path),
        }),
      ).not.toContainEqual(family);
  });

  it('proves only plain class-list membership: granted levels, a list issue or no scoped entry stays outstanding', () => {
    const keys = {
      plain: 'pf1/plain-class-list',
      domain: 'pf1/domain-granted',
      bloodline: 'pf1/bloodline-granted',
      unknownClass: 'pf1/unknown-class-tag',
      noLevels: 'pf1/no-class-list',
      unbuilt: 'pf1/not-in-scoped-build',
      effectNote: 'pf1/running-effect-note',
    };
    const spells = {
      rows: Object.values(keys).map(spellRow),
      edges: [],
    };
    const proven = (change: Partial<LaunchVerificationInput> = {}) =>
      Object.fromEntries(
        verifyLaunchRows(spells, {
          ...input(),
          admission: { ...noGate, admitted: admitted(...Object.values(keys)) },
          scopeBuild: {
            ...input().scopeBuild,
            entries: [
              spellEntry(keys.plain),
              spellEntry(keys.domain, {
                grantedLevels: { domain: { War: 2 } },
              }),
              spellEntry(keys.bloodline, {
                grantedLevels: { bloodline: { Arcane: 2 } },
              }),
              spellEntry(keys.unknownClass),
              spellEntry(keys.noLevels, { levels: {} }),
              spellEntry(keys.effectNote),
            ],
          },
          unsupported: {
            entries: [
              {
                externalKey: keys.unknownClass,
                issues: [{ field: 'levels.mystic', reason: 'No class.' }],
              },
              // Retained source fields and running-effect notes are not lists.
              {
                externalKey: keys.effectNote,
                issues: [
                  { field: 'gameContent', reason: 'Retained.' },
                  { field: 'curation.mechanics', reason: 'Running effect.' },
                ],
              },
            ],
          },
          proofs: currentRegistry,
          calculationIdentity: currentCalculationIdentity,
          ...change,
        }).map(({ key, mechanisms }) => [key, mechanisms]),
      );
    expect(proven()).toEqual({
      [keys.plain]: [classList],
      [keys.domain]: [],
      [keys.bloodline]: [],
      [keys.unknownClass]: [],
      [keys.noLevels]: [],
      [keys.unbuilt]: [],
      [keys.effectNote]: [classList],
    });
    // A changed calculation identity proves nothing.
    expect(
      Object.values(
        proven({ calculationIdentity: 'sha256:' + 'f'.repeat(64) }),
      ).flat(),
    ).toEqual([]);
  });

  it('reads each class’s collection path from the app’s reviewed casting, and none for a class without one', () => {
    expect(
      Object.fromEntries(
        [
          'wizard',
          'arcanist',
          'sorcerer',
          'inquisitor',
          'witch',
          'alchemist',
          'investigator',
          'cleric',
          'druid',
          'paladin',
          'ranger',
          'adept',
        ].map((tag) => [tag, classListCollectionPath(tag)]),
      ),
    ).toEqual({
      wizard: 'book',
      arcanist: 'book',
      sorcerer: 'known',
      inquisitor: 'known',
      witch: 'familiar',
      alchemist: 'formula',
      investigator: 'formula',
      cleric: 'whole-list',
      druid: 'whole-list',
      paladin: 'whole-list',
      ranger: 'whole-list',
      adept: 'whole-list',
    });
    for (const tag of ['mystic', 'Wizard', 'toString', ''])
      expect(classListCollectionPath(tag), tag).toBeNull();
    // Every reviewed casting uses one of the paths.
    for (const tag of Object.keys(defaultCastingTables.classes))
      expect(spellCollectionPaths, tag).toContain(classListCollectionPath(tag));
  });

  it('proves a Spell only when every class and level on its lists is a (path, level) pair the proof covers', () => {
    const lists = {
      'pf1/book': { wizard: 1 },
      'pf1/known': { sorcerer: 1 },
      'pf1/familiar': { witch: 1 },
      'pf1/formula': { alchemist: 1 },
      'pf1/whole-list': { cleric: 1 },
      'pf1/book-and-whole-list': { wizard: 1, cleric: 1 },
      'pf1/cantrip': { wizard: 0, druid: 0 },
      'pf1/ninth': { wizard: 9, investigator: 9 },
      // Level 0 on the formula path, which the proof does not cast.
      'pf1/unproven-formula-cantrip': { alchemist: 0 },
      'pf1/unproven-cantrip-and-book': { wizard: 0, investigator: 0 },
      // Levels no casting table has.
      'pf1/unproven-level-ten': { wizard: 10 },
      'pf1/unproven-fractional-level': { sorcerer: 1.5 },
      // A class without a reviewed casting, with no importer issue recorded.
      'pf1/unproven-unmapped': { mystic: 1 },
      'pf1/unproven-book-and-unmapped': { wizard: 1, mystic: 1 },
    };
    const keys = Object.keys(lists);
    const every = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const pairs = (paths: readonly string[], levels = every) =>
      paths.map((path) => ({ path, levels }));
    const proven = (collections: readonly object[]) =>
      verifyLaunchRows(
        { rows: keys.map(spellRow), edges: [] },
        {
          ...input(),
          admission: { ...noGate, admitted: admitted(...keys) },
          scopeBuild: {
            ...input().scopeBuild,
            entries: Object.entries(lists).map(([key, levels]) =>
              spellEntry(key, { levels }),
            ),
          },
          proofs: {
            registry: [{ ...family, scope: { ...family?.scope, collections } }],
            sha256Of: repository,
          },
          calculationIdentity: currentCalculationIdentity,
        },
      )
        .filter(({ mechanisms }) => mechanisms.includes(classList))
        .map(({ key }) => key)
        .sort();
    // The registry's own pairs: every row but the unproven ones.
    expect(proven(family?.scope?.collections ?? [])).toEqual(
      keys.filter((key) => !key.startsWith('pf1/unproven-')).sort(),
    );
    // The formula path's level 0 is the pair that refuses the Alchemist
    // cantrip: granting it admits the row, and only rows needing it.
    expect(
      proven(pairs(spellCollectionPaths)).filter(
        (key) => !proven(family?.scope?.collections ?? []).includes(key),
      ),
    ).toEqual([
      'pf1/unproven-cantrip-and-book',
      'pf1/unproven-formula-cantrip',
    ]);
    // A path the proof does not cover disqualifies every row with a class on it.
    expect(proven(pairs(['book', 'known', 'familiar', 'formula']))).toEqual([
      'pf1/book',
      'pf1/familiar',
      'pf1/formula',
      'pf1/known',
      'pf1/ninth',
      'pf1/unproven-cantrip-and-book',
      'pf1/unproven-formula-cantrip',
    ]);
    expect(proven(pairs(['whole-list']))).toEqual(['pf1/whole-list']);
    expect(proven(pairs(['known', 'familiar']))).toEqual([
      'pf1/familiar',
      'pf1/known',
    ]);
    // So does a level the proof does not cover on a path it does.
    expect(proven(pairs(spellCollectionPaths, [1]))).toEqual([
      'pf1/book',
      'pf1/book-and-whole-list',
      'pf1/familiar',
      'pf1/formula',
      'pf1/known',
      'pf1/whole-list',
    ]);
    expect(proven(pairs(spellCollectionPaths, [0]))).toEqual([
      'pf1/cantrip',
      'pf1/unproven-cantrip-and-book',
      'pf1/unproven-formula-cantrip',
    ]);
  });
});

describe('permitted prose by category', () => {
  const feat = 'pf1-content/attack-feat';
  const prerequisiteFeat = 'pf1/caster-level-feat';
  const archetype = 'everythingpath/archetype-proficiency';
  const source = 'b'.repeat(64);
  const mechanism = (name: string) => ({
    name,
    disposition: 'calculated' as const,
    status: 'outstanding' as const,
    contract: `${name} contract.`,
    evidence: ['row.sources'],
  });
  const sources = [
    {
      repository: 'pf1-content' as const,
      pin: 'baseline',
      locator: 'src/feat.yaml',
      rawSha256: source,
      effectiveSha256: source,
    },
  ];
  const rows = {
    rows: [
      row(feat, {
        kind: 'feat',
        sources,
        mechanisms: [mechanism('Source body mechanics')],
      }),
      row(prerequisiteFeat, {
        kind: 'feat',
        sources,
        mechanisms: [
          mechanism(sourcePrerequisitesMechanism),
          mechanism('Source body mechanics'),
        ],
      }),
      row(archetype, {
        kind: 'archetype',
        sources,
        mechanisms: [mechanism('Exploits at 1')],
      }),
    ],
    edges: [],
  };
  const featEntry = (key: string, prerequisites?: unknown[]) => ({
    externalKey: key,
    upstreamKey: key.split('/')[1],
    pack: 'feats',
    name: key,
    detail: { kind: 'feat', featTypes: ['General'] },
    description: '',
    sources: [{ book: 'PZO1110' }],
    modifiers: [],
    unsupported: [],
    ...(prerequisites ? { prerequisites } : {}),
  });
  const unparsed = [{ kind: 'unchecked', unchecked: 'Caster level 5th' }];
  const attackCase: LaunchProseCase = {
    category: 'attack-feat-text',
    key: feat,
    mechanism: 'Source body mechanics',
    sourceSha256: source,
    decision: '#237: Text.',
  };
  const prerequisiteCase: LaunchProseCase = {
    category: 'unparsed-prerequisite',
    key: prerequisiteFeat,
    mechanism: sourcePrerequisitesMechanism,
    sourceSha256: source,
    decision: 'D12: a clause outside the parsed kinds.',
  };
  const project = (change: Partial<LaunchVerificationInput> = {}) =>
    Object.fromEntries(
      verifyLaunchRows(rows, {
        ...input(),
        admission: {
          ...noGate,
          admitted: admitted(feat, prerequisiteFeat, archetype),
        },
        scopeBuild: {
          ...input().scopeBuild,
          entries: [featEntry(feat), featEntry(prerequisiteFeat, unparsed)],
        },
        ...change,
      }).map(({ key, mechanisms, prose }) => [key, { mechanisms, prose }]),
    );

  it('qualifies a reviewed case only with its row, mechanism and source bytes', () => {
    expect(project({ proseCases: [attackCase] })[feat]).toEqual({
      mechanisms: [],
      prose: [
        { mechanism: 'Source body mechanics', category: 'attack-feat-text' },
      ],
    });
    expect(
      project({
        proseCases: [{ ...attackCase, category: 'mystery-patron-spirit' }],
      })[feat]?.prose,
    ).toEqual([
      { mechanism: 'Source body mechanics', category: 'mystery-patron-spirit' },
    ]);
    // Look-alikes: no case, another row's case, a changed source, another
    // mechanism, or a case on an unadmitted row.
    for (const [why, change] of [
      ['no case', {}],
      ['another row', { proseCases: [{ ...attackCase, key: archetype }] }],
      [
        'changed source',
        { proseCases: [{ ...attackCase, sourceSha256: 'c'.repeat(64) }] },
      ],
      [
        'another mechanism',
        { proseCases: [{ ...attackCase, mechanism: 'Feat grants' }] },
      ],
    ] as const)
      expect(project(change)[feat]?.prose, why).toEqual([]);
    expect(
      project({
        proseCases: [attackCase],
        admission: { ...noGate, admitted: admitted(prerequisiteFeat) },
      })[feat],
    ).toBeUndefined();
  });

  it('qualifies an unparsed prerequisite only from a reviewed case while the parser records every clause unparsed', () => {
    const prose = [
      {
        mechanism: sourcePrerequisitesMechanism,
        category: 'unparsed-prerequisite',
      },
    ];
    expect(
      project({ proseCases: [prerequisiteCase] })[prerequisiteFeat]?.prose,
    ).toEqual(prose);
    // The parser's unchecked clause alone is no evidence: it also leaves
    // modeled kinds such as this caster level unparsed.
    expect(project()[prerequisiteFeat]?.prose).toEqual([]);
    const withEntry = (prerequisites?: unknown[]) =>
      project({
        proseCases: [prerequisiteCase],
        scopeBuild: {
          ...input().scopeBuild,
          entries: [featEntry(prerequisiteFeat, prerequisites)],
        },
      })[prerequisiteFeat]?.prose;
    expect(
      withEntry([...unparsed, { kind: 'bab', bab: 1 }]),
      'a parsed clause',
    ).toEqual([]);
    expect(withEntry(undefined), 'no recorded prerequisites').toEqual([]);
    expect(
      withEntry([{ anyOf: [{ kind: 'unchecked', unchecked: 'x' }] }]),
      'an alternative',
    ).toEqual([]);
    expect(
      project({
        proseCases: [prerequisiteCase],
        unsupported: {
          entries: [
            {
              externalKey: prerequisiteFeat,
              issues: [{ field: 'prerequisites.0', reason: 'Unmapped.' }],
            },
          ],
        },
      })[prerequisiteFeat]?.prose,
      'a prerequisite issue',
    ).toEqual([]);
    expect(
      project({
        proseCases: [
          { ...prerequisiteCase, mechanism: 'Source body mechanics' },
        ],
      })[prerequisiteFeat]?.prose,
      'another mechanism',
    ).toEqual([]);
  });

  it('lets only the archetype mapper’s recorded proficiency reason pass a proof’s disqualifier', () => {
    const proof: LaunchMechanismProof = {
      family: 'archetype-exploits',
      mechanism: 'Exploits at 1',
      kinds: ['archetype'],
      tests: [proofTest],
      calculationIdentity: calculation,
      disqualifying: ['proficiencies'],
    };
    const withIssue = (issue: { field: string; reason?: string }) =>
      project({
        proofs: registry(proof),
        unsupported: { entries: [{ externalKey: archetype, issues: [issue] }] },
      })[archetype]?.mechanisms;
    expect(
      withIssue({
        field: 'proficiencies',
        reason: archetypeProficiencyProseReason,
      }),
    ).toEqual(['Exploits at 1']);
    expect(
      withIssue({ field: 'proficiencies', reason: 'Not mapped.' }),
    ).toEqual([]);
    expect(withIssue({ field: 'proficiencies' })).toEqual([]);
    // The same reason on another kind is no D7 evidence.
    expect(
      verifyLaunchRows(
        { rows: [{ ...rows.rows[2]!, kind: 'classFeature' }], edges: [] },
        {
          ...input(),
          admission: { ...noGate, admitted: admitted(archetype) },
          proofs: registry({ ...proof, kinds: ['classFeature'] }),
          unsupported: {
            entries: [
              {
                externalKey: archetype,
                issues: [
                  {
                    field: 'proficiencies',
                    reason: archetypeProficiencyProseReason,
                  },
                ],
              },
            ],
          },
        },
      )[0]?.mechanisms,
    ).toEqual([]);
  });

  it('refuses a malformed case and a case for a category the build records', () => {
    expect(parseLaunchProseCases([attackCase])).toEqual([attackCase]);
    for (const [value, field] of [
      [{ ...attackCase, category: 'archetype-proficiency' }, /category/],
      [{ ...attackCase, sourceSha256: 'b' }, /sourceSha256/],
      [{ ...attackCase, decision: '' }, /decision/],
    ] as const)
      expect(() => parseLaunchProseCases([value])).toThrow(field);
    expect(launchProseCases).toEqual([]);
  });

  it('qualifies no row in the committed inventory as prose or spell class list without its recorded evidence', async () => {
    const committed = parseLaunchInventory(
      JSON.parse(
        await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
      ),
    );
    const catalogRows = committed.rows.filter(
      ({ catalogKey, key }) => catalogKey && !/^(?:notice|rule)\//.test(key),
    );
    const everyRow = catalogRows.map(({ key }) => key);
    const spellRows = catalogRows.filter(({ kind }) => kind === 'spell');
    const lists = await realSpellLists(spellRows);
    // Every row admitted and built with every clause unparsed, every spell
    // with its real class and granted lists: the strongest look-alike
    // evidence short of a record.
    const lookAlike = (key: string, kind: string) =>
      kind === 'spell'
        ? spellEntry(key, lists.get(key))
        : { ...featEntry(key, unparsed), pack: kind };
    const project = (change: Partial<LaunchVerificationInput>) =>
      verifyLaunchRows(committed, {
        ...input(),
        admission: {
          ...noGate,
          admitted: everyRow.map((externalKey) => ({
            externalKey,
            reason: 'Admitted.',
          })),
        },
        proofs: currentRegistry,
        calculationIdentity: currentCalculationIdentity,
        ...change,
      });
    const lookAlikes = {
      ...input().scopeBuild,
      entries: catalogRows.map(({ key, kind }) => lookAlike(key, kind)),
    };
    // Control: a spell proves exactly when each class and level on its real
    // lists is a proven (path, level) pair: every path at levels 1 to 9, and
    // level 0 on every path but formula. The expectation reads the reviewed
    // casting data directly, not the app's path function.
    const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const pairKey = (path: string | undefined, level: unknown) =>
      `${path}:${String(level)}`;
    const registryPairs = new Set(
      spellCollectionPaths.flatMap((path) =>
        levels
          .filter((level) => path !== 'formula' || level > 0)
          .map((level) => pairKey(path, level)),
      ),
    );
    const realPairs = (key: string) =>
      Object.entries(lists.get(key)?.levels ?? {}).map(([tag, level]) =>
        pairKey(reviewedPath(tag), level),
      );
    const expected = (covered: ReadonlySet<string>) =>
      spellRows
        .filter(({ key }) => {
          const pairs = realPairs(key);
          return (
            Object.keys(lists.get(key)?.grantedLevels ?? {}).length === 0 &&
            pairs.length > 0 &&
            pairs.every((pair) => covered.has(pair))
          );
        })
        .map(({ key }) => key)
        .sort();
    const control = project({ scopeBuild: lookAlikes })
      .filter(({ mechanisms }) => mechanisms.length)
      .map(({ key }) => key)
      .sort();
    expect(control).toEqual(expected(registryPairs));
    expect(control.length).toBeGreaterThan(0);
    expect(control.length).toBeLessThan(spellRows.length);
    // No real spell is on a formula list at level 0, so the unproven pair
    // refuses no real row, yet any row needing it stays outstanding.
    expect(
      spellRows.filter(({ key }) => realPairs(key).includes('formula:0')),
    ).toEqual([]);
    // The committed projection proves no spell outside the control.
    const projected: { rows: { key: string; mechanisms: string[] }[] } =
      JSON.parse(
        await readFile(
          'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
          'utf8',
        ),
      );
    const proven = projected.rows
      .filter(({ mechanisms }) => mechanisms.includes(classList))
      .map(({ key }) => key);
    expect(proven.length).toBeGreaterThan(0);
    expect(proven.filter((key) => !control.includes(key))).toEqual([]);
    // Negative, over every real spell: a proof without one path, or without
    // level 0, proves no spell needing it, and each removal disqualifies at
    // least one; granting the unproven formula level 0 changes nothing.
    const spellsOnly = { rows: spellRows, edges: [] };
    const narrowed = (covered: ReadonlySet<string>) =>
      verifyLaunchRows(spellsOnly, {
        ...input(),
        admission: {
          ...noGate,
          admitted: spellRows.map(({ key }) => ({
            externalKey: key,
            reason: 'Admitted.',
          })),
        },
        scopeBuild: lookAlikes,
        proofs: {
          registry: [
            {
              ...spellClassList,
              scope: {
                ...spellClassList?.scope,
                collections: spellCollectionPaths.flatMap((path) => {
                  const covering = levels.filter((level) =>
                    covered.has(pairKey(path, level)),
                  );
                  return covering.length ? [{ path, levels: covering }] : [];
                }),
              },
            },
          ],
          sha256Of: repository,
        },
        calculationIdentity: currentCalculationIdentity,
      })
        .filter(({ mechanisms }) => mechanisms.length)
        .map(({ key }) => key)
        .sort();
    const without = (drop: (pair: string) => boolean) =>
      new Set([...registryPairs].filter((pair) => !drop(pair)));
    for (const [why, covered] of [
      ...spellCollectionPaths.map(
        (path) =>
          [path, without((pair) => pair.startsWith(`${path}:`))] as const,
      ),
      ['level 0', without((pair) => pair.endsWith(':0'))] as const,
    ]) {
      const remaining = narrowed(covered);
      expect(remaining, why).toEqual(expected(covered));
      expect(remaining.length, why).toBeLessThan(control.length);
    }
    expect(narrowed(new Set([...registryPairs, 'formula:0']))).toEqual(control);
    // No prose anywhere without a reviewed case, even with every clause
    // unparsed and every importer reason recorded.
    const prose = (change: Partial<LaunchVerificationInput>) =>
      project({ scopeBuild: lookAlikes, ...change }).filter(
        (entry) => entry.prose.length,
      );
    expect(prose({})).toEqual([]);
    expect(
      prose({
        unsupported: {
          entries: everyRow.map((externalKey) => ({
            externalKey,
            issues: [
              {
                field: 'proficiencies',
                reason: archetypeProficiencyProseReason,
              },
            ],
          })),
        },
      }),
    ).toEqual([]);
    // Cases for every row that bind other source bytes qualify nothing.
    expect(
      prose({
        proseCases: catalogRows.flatMap(({ key, mechanisms }) =>
          mechanisms.map(({ name }) => ({
            ...attackCase,
            key,
            mechanism: name,
            sourceSha256: '0'.repeat(64),
          })),
        ),
      }),
    ).toEqual([]);
    // No spell proves without a scoped entry, or with granted levels.
    for (const [why, entries] of [
      ['no scoped entry', []],
      [
        'granted levels',
        catalogRows.map(({ key }) =>
          spellEntry(key, { grantedLevels: { domain: { War: 1 } } }),
        ),
      ],
    ] as const)
      expect(
        project({
          scopeBuild: { ...input().scopeBuild, entries: [...entries] },
        }).filter(({ mechanisms }) => mechanisms.length),
        why,
      ).toEqual([]);
  }, 120_000);
});
