/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterAll, describe, expect, it } from 'vitest';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  pcgenOwnerSelection,
  type PcgenOwnerSelector,
} from '../../scripts/catalog/pcgen-owners';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import { readPcgenTree } from '../../scripts/catalog/pcgen/lst';
import {
  prestigeFeatureRows,
  reviewedPrestigeSchedule,
  type ReviewedPrestigeSchedule,
} from '../../scripts/catalog/pcgen/prestige-schedules';
import { classTableRows } from '../../scripts/catalog/prd-coverage';
import {
  createCatalogRelease,
  serializeCatalogRelease,
} from '../../scripts/catalog/release';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import { legalResources } from '../../src/lib/catalog/legal-resources-data';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { preloadCalledConvexModules } from '../convex-modules';
import { pcgenOwnerEmissionFiles } from '../fixtures/pcgen-716/owner-emission-files';
import { readPrdText } from './pcgen-716-schedules';
import { materializePinnedTree, readPinned } from './pinned-sources';

// #716 D1 (research party-code §1): the importer emits a selected prestige
// class, Dragon Disciple, with every feature it owns, its features by level
// from the reviewed level grants, through the structure gate.

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const tree = await materializePinnedTree(
  pcgenOwnerEmissionFiles.map((path) => `pcgen/${pcgenPin.directory}/${path}`),
);
afterAll(() => tree.dispose());

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8'));
const remaps = await readJson('scripts/catalog/reviewed-remaps.json');
const curation = (await readJson('scripts/catalog/reviewed-curation.json')) as {
  records: unknown[];
  structures?: unknown[];
};
const registry = reviewedAdmissionSchema.shape.registry.parse(
  await readJson('src/lib/catalog/data/section15-registry.json'),
);
/** No Attribution Assessments: #716 rows admit on their declared books (#227). */
const attribution = { assessments: [], registry, evidence: {} };

const crClasses = 'roleplaying_game/core_rulebook/cr_classes.lst';
const crAbilities = 'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const dragonDisciple = 'everythingpath/dragon-disciple';
const feature = (name: string) => `${dragonDisciple}-${name}`;
/** The eleven features, by level and in the PRD's table order (dragonDisciple.html:363-371). */
const featuresByLevel = [
  { classLevel: 1, externalKey: feature('weapon-and-armor-proficiency') },
  { classLevel: 1, externalKey: feature('spells-per-day') },
  { classLevel: 1, externalKey: feature('blood-of-dragons') },
  { classLevel: 1, externalKey: feature('natural-armor-increase') },
  { classLevel: 2, externalKey: feature('ability-boost') },
  { classLevel: 2, externalKey: feature('bloodline-feat') },
  { classLevel: 2, externalKey: feature('dragon-bite') },
  { classLevel: 3, externalKey: feature('breath-weapon') },
  { classLevel: 5, externalKey: feature('blindsense') },
  { classLevel: 7, externalKey: feature('dragon-form') },
  { classLevel: 9, externalKey: feature('wings') },
];
const emittedKeys = [
  dragonDisciple,
  ...featuresByLevel.map(({ externalKey }) => externalKey),
];
const selector: PcgenOwnerSelector = pcgenOwnerSelection.find(
  ({ key }) => key === 'Dragon Disciple',
)!;
const selection = [selector];

type Artifact = Awaited<ReturnType<typeof importCatalog>>;
const emit = ({
  structures,
  pcgenSelection = selection,
}: {
  structures: unknown[];
  pcgenSelection?: PcgenOwnerSelector[];
}) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation: { ...curation, structures },
    pcgen: { path: tree.pcgenPath, selection: pcgenSelection },
  });
const entryOf = (artifact: Artifact, key: string) =>
  artifact.catalog.entries.find((entry) => entry.externalKey === key);
const outcomesOf = (artifact: Artifact) => {
  const gate = assessCatalogAdmission({ artifact, ...attribution });
  return Object.fromEntries(
    emittedKeys.map((key) => {
      for (const kind of ['admitted', 'held', 'dependentOmissions'] as const) {
        const row = gate[kind].find((item) => item.externalKey === key);
        if (row) return [key, { kind, reason: row.reason }];
      }
      const failure = gate.failures.find((item) => item.externalKey === key);
      return [key, failure && { kind: 'failed', reason: failure.reason }];
    }),
  );
};

const unsettled = await emit({ structures: [] });
const pcgenTree = await readPcgenTree(tree.pcgenPath);

describe('Dragon Disciple (#716 D1)', () => {
  it('is selected as a prestige class, a data change beside the archetypes', () => {
    expect(selector).toEqual({
      kind: 'prestige',
      file: crClasses,
      key: 'Dragon Disciple',
    });
    expect(
      pcgenOwnerSelection.filter(({ kind }) => kind === 'prestige'),
    ).toEqual([selector]);
  });

  it('is emitted with every feature it owns, its book code and comparison records', () => {
    expect(
      unsettled.catalog.entries
        .filter(({ upstreamKey }) => upstreamKey?.startsWith('pcgen:'))
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([...emittedKeys].sort());
    expect(entryOf(unsettled, dragonDisciple)).toMatchObject({
      upstreamKey: `pcgen:${crClasses}#Dragon Disciple`,
      name: 'Dragon Disciple',
      sources: [{ book: 'PZO1110', pages: '380' }],
      detail: {
        kind: 'class',
        classKind: 'prestige',
        hitDie: 12,
        bab: 'threeQuarters',
        saves: { fort: 'good', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 2,
        featuresByLevel,
        // The table's Spells per Day column (dragonDisciple.html:364-372).
        castingAdvances: [2, 3, 4, 6, 7, 8, 10].map((classLevel) => ({
          classLevel,
          kinds: ['arcane'],
        })),
      },
    });
    expect(entryOf(unsettled, feature('wings'))).toMatchObject({
      upstreamKey: `pcgen:${crAbilities}#Dragon Disciple ~ Wings`,
      name: 'Wings',
      sources: [{ book: 'PZO1110', pages: '382' }],
      detail: { kind: 'classFeature' },
    });
    const comparison = unsettled.comparison.records
      .filter(({ repo }) => repo === 'pcgen')
      .map(({ externalKey }) => externalKey);
    for (const key of emittedKeys)
      expect(comparison).toContain(entryOf(unsettled, key)?.upstreamKey);
  });

  it('is held on structure review: its four unchecked requirements and its eleven owned features', () => {
    const outcomes = outcomesOf(unsettled);
    expect(outcomes[dragonDisciple]).toEqual({
      kind: 'held',
      reason:
        'Structure hand review (#716 plan §6): uncheckedRequirement PRELANG:1,Draconic; uncheckedRequirement PREMULT:1,[PREFACT:1,ABILITIES,QualifiedForDragonDisciple=true],[PREMULT:3,[PRESPELLCAST:MEMORIZE=N],[PRESPELLCAST:TYPE=Arcane],[!PRECLASS:1,Sorcerer=1]],[PREMULT:2,[PRECLASS:1,Sorcerer=1],[PREABILITY:1,CATEGORY=Special Ability,Sorcerer Bloodline ~ Draconic]]; uncheckedRequirement !PRERACE:1,RACETYPE=Dragon; uncheckedRequirement !PRETEMPLATE:1,Half Dragon.',
    });
    expect(outcomes[feature('wings')]).toEqual({
      kind: 'held',
      reason: `Structure hand review (#716 plan §6): owned feature pcgen:${crAbilities}#Dragon Disciple ~ Wings.`,
    });
    expect(Object.values(outcomes).map((outcome) => outcome?.kind)).toEqual(
      emittedKeys.map(() => 'held'),
    );
    // Its requirements stay readable: the null resolver checks nothing.
    expect(entryOf(unsettled, dragonDisciple)?.prerequisites).toEqual([
      { kind: 'unchecked', unchecked: 'speaks Draconic' },
      expect.objectContaining({ kind: 'unchecked' }),
      { kind: 'unchecked', unchecked: 'not: race: type Dragon' },
      { kind: 'skillRanks', skillRanks: 'skill.kar', min: 5 },
      { kind: 'unchecked', unchecked: 'not: template: Half Dragon' },
    ]);
  });

  it('refuses a selected prestige class without a reviewed schedule', async () => {
    await expect(
      emit({
        structures: [],
        pcgenSelection: [{ ...selector, key: 'Arcane Trickster' }],
      }),
    ).rejects.toThrow('No reviewed prestige schedule for Arcane Trickster.');
  });

  it('is admitted once checked records settle it, and its release stores every feature it schedules', async () => {
    const report = unsettled.structure;
    if (!report) throw new Error('No structure report');
    const reviewer = {
      status: 'checked' as const,
      reviewedBy: 'Test fixture',
      reviewedOn: '2026-11-14',
      receipt: 'reviewer-20261018-081620-1216172',
    };
    const [first] = report.handReview;
    if (!first) throw new Error('No hand review item');
    const settled = await emit({
      structures: [
        {
          externalKey: first.externalKey,
          sourceSha256: first.sourceSha256,
          fields: {
            prerequisites: entryOf(unsettled, dragonDisciple)?.prerequisites,
          },
          resolves: report.handReview.map(({ kind, id }) => ({ kind, id })),
          rationale: 'Test-only: the mapper’s requirements, re-affirmed.',
          ...reviewer,
        },
        ...report.unreviewedFeatures.map((owned) => ({
          externalKey: owned.externalKey,
          sourceSha256: owned.sourceSha256,
          fields: {},
          noMechanics: true as const,
          resolves: [{ kind: 'ownedFeature' as const, id: owned.locator }],
          rationale: 'Test-only disposition.',
          ...reviewer,
        })),
      ],
    });
    expect(settled.structure?.passed).toBe(true);
    expect(outcomesOf(settled)).toEqual(
      Object.fromEntries(
        emittedKeys.map((key) => [
          key,
          {
            kind: 'admitted',
            reason: 'Admitted under #227: declared book PZO1110.',
          },
        ]),
      ),
    );

    const release = await createCatalogRelease({
      artifact: settled,
      attribution,
      legalResources,
      releaseNumber: 716,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation,
        localData: [],
        parsers: 'pcgen-prestige-emission-proof',
        sanitizers: 'pcgen-prestige-emission-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    const t = convexTest(schema, modules);
    const writeBatch = makeFunctionReference<
      'mutation',
      { releaseNumber: number; batchIndex: number; rows: unknown },
      CatalogReleaseStatus
    >('catalogRelease:writeBatch');
    await t.mutation(internal.catalogRelease.begin, {
      manifest: transported.manifest,
    });
    for (const [batchIndex, batch] of transported.batches.entries())
      await t.mutation(writeBatch, {
        releaseNumber: 716,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 716 });
    const stored = await t.run((ctx) =>
      ctx.db
        .query('catalogReleaseRow')
        .collect()
        .then((rows) =>
          rows.filter(
            (row) => row.kind === 'definition' && emittedKeys.includes(row.key),
          ),
        ),
    );
    expect(stored.map(({ key }) => key).sort()).toEqual(
      [...emittedKeys].sort(),
    );
    expect(
      stored.find(({ key }) => key === dragonDisciple)?.payload,
    ).toMatchObject({
      sources: [{ book: 'PZO1110', pages: '380' }],
      detail: { kind: 'class', classKind: 'prestige', featuresByLevel },
    });
  });
});

describe('a reviewed schedule PCGen has drifted from (#716 D1)', () => {
  const abilities = join(tree.pcgenPath, crAbilities);
  /** Imports Dragon Disciple from the tree with one gate edited, then restores the file. */
  const emitDrifted = async (from: string, to: string) => {
    const original = await readFile(abilities, 'utf8');
    if (original.split(from).length !== 2)
      throw new Error(`Not exactly one ${from} in ${crAbilities}.`);
    await writeFile(abilities, original.replace(from, to));
    try {
      return await emit({ structures: [] });
    } finally {
      await writeFile(abilities, original);
    }
  };
  const refusal = (...findings: string[]) =>
    `The reviewed Dragon Disciple schedule no longer matches PCGen: ${findings.join(' ')}`;
  const breathWeapon =
    'Dragon Disciple ~ Breath Weapon|PREVARGTEQ:DragonDisciple_CFP_Level,3';
  const wings = 'Dragon Disciple ~ Wings|PREVARGTEQ';

  it('refuses a feature PCGen grants at another level', async () => {
    await expect(
      emitDrifted(breathWeapon, breathWeapon.replace(/3$/, '4')),
    ).rejects.toThrow(
      refusal(
        `Dragon Disciple ~ Breath Weapon is granted at level 4 (${crAbilities}:357), not at level 3 (${crAbilities}:357).`,
      ),
    );
  });

  it('refuses a reviewed feature PCGen no longer grants', async () => {
    const line = `CATEGORY=Class|Dragon Disciple.MOD\tABILITY:Dragon Disciple Class Feature|AUTOMATIC|${breathWeapon}`;
    await expect(emitDrifted(line, '')).rejects.toThrow(
      refusal(
        'Dragon Disciple ~ Breath Weapon has no DragonDisciple_CFP_Level gate.',
        'Dragon Disciple ~ Breath Weapon is not an owned feature.',
      ),
    );
  });

  it('refuses a feature PCGen grants that the schedule has no row for', async () => {
    await expect(
      emitDrifted(
        wings,
        'Dragon Disciple ~ Wings|Assassin ~ Swift Death|PREVARGTEQ',
      ),
    ).rejects.toThrow(
      refusal(
        'Assassin ~ Swift Death is an owned feature with no reviewed row.',
      ),
    );
  });

  it('refuses a granted feature no record has', async () => {
    await expect(
      emitDrifted(
        wings,
        'Dragon Disciple ~ Wings|Dragon Disciple ~ No Such Record|PREVARGTEQ',
      ),
    ).rejects.toThrow(
      refusal(
        'Dragon Disciple ~ No Such Record is granted but no record has its KEY.',
      ),
    );
  });

  it('imports again once the gates are restored', async () => {
    const restored = await emit({ structures: [] });
    expect(entryOf(restored, dragonDisciple)?.detail).toMatchObject({
      featuresByLevel,
    });
  });
});

describe('the reviewed Dragon Disciple schedule (#716 D1)', () => {
  const schedule = reviewedPrestigeSchedule('Dragon Disciple');
  if (!schedule) throw new Error('No reviewed Dragon Disciple schedule');
  const record = pcgenTree.prestigeClasses.find(
    ({ locator }) =>
      locator.file === crClasses && locator.key === 'Dragon Disciple',
  );
  if (!record) throw new Error('No Dragon Disciple block');
  const owned = inventoryPcgen(pcgenTree).rows.filter(
    (row) => row.owner.record === record,
  );
  const check = (reviewed: ReviewedPrestigeSchedule) =>
    prestigeFeatureRows({ tree: pcgenTree, record, owned, schedule: reviewed });

  it('matches every DragonDisciple_CFP_Level gate and every owned feature', () => {
    const { rows, findings } = check(schedule);
    expect(findings).toEqual([]);
    expect(
      rows.map(({ classLevel, feature: { locator } }) => [
        classLevel,
        locator.line,
      ]),
    ).toEqual([
      [1, 2962],
      [1, 2963],
      [1, 2964],
      [1, 2965],
      [2, 2966],
      [2, 2967],
      [2, 2968],
      [3, 2969],
      [5, 2970],
      [7, 2971],
      [9, 2972],
    ]);
  });

  it('finds a row whose level or gate PCGen no longer gives, and an owned feature it leaves out', () => {
    const [first, ...rest] = schedule.rows;
    const moved = { ...first, classLevel: 2 };
    expect(check({ ...schedule, rows: [moved, ...rest] }).findings).toEqual([
      `Dragon Disciple ~ Weapon and Armor Proficiency is granted at level 1 (${crAbilities}:353), not at level 2 (${crAbilities}:353).`,
    ]);
    const [, ...withoutFirst] = schedule.rows;
    const [second, ...others] = withoutFirst;
    if (!second) throw new Error('One reviewed row');
    expect(check({ ...schedule, rows: [second, ...others] }).findings).toEqual([
      `Dragon Disciple ~ Weapon and Armor Proficiency is an owned feature with no reviewed row.`,
    ]);
  });

  it('cites each row to the PRD class table, and each later step it prints', async () => {
    const { page, caption } = schedule.printedTable;
    const table = classTableRows(
      await readPinned('prd', `pages/${page}`),
      caption,
    );
    const printed = (level: number) =>
      schedule.rows
        .flatMap(({ classLevel, printed: cited }) =>
          cited.kind === 'special'
            ? [
                ...(classLevel === level ? [cited.entry] : []),
                ...(cited.laterSteps ?? []).flatMap((step) =>
                  step.level === level ? [step.entry] : [],
                ),
              ]
            : [],
        )
        .sort();
    expect(table.map(({ level }) => level)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    for (const row of table)
      expect({ level: row.level, entries: printed(row.level) }).toEqual({
        level: row.level,
        entries: [...row.special].sort(),
      });
    expect(
      table
        .filter(({ columns }) =>
          columns['Spells per Day']?.startsWith('+1 level'),
        )
        .map(({ level }) => level),
    ).toEqual([2, 3, 4, 6, 7, 8, 10]);
  });

  it('cites the two rows the Special column does not print to their class feature paragraphs', async () => {
    const unprinted = await Promise.all(
      schedule.rows.flatMap(({ feature: key, printed: cited }) =>
        cited.kind === 'classFeature'
          ? [
              readPrdText({
                page: schedule.printedTable.page,
                from: cited.line,
                to: cited.line,
              }).then((text) => [key, text.trim().slice(0, 40)]),
            ]
          : [],
      ),
    );
    expect(unprinted).toEqual([
      [
        'Dragon Disciple ~ Weapon and Armor Proficiency',
        'Weapon and Armor Proficiency: Dragon dis',
      ],
      [
        'Dragon Disciple ~ Spells per Day',
        'Spells per Day: At the indicated levels,',
      ],
    ]);
  });
});
