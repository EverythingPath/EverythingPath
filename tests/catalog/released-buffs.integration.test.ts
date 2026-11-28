/// <reference types="vite/client" />
// @vitest-environment edge-runtime
// pbl-released-buffs (PRD #251): the buff batches' integration tests
// (buffs547, pfBuffs548 and pfBuffs549), on entries imported from the pinned
// store. Each row of the table is one batch's saved-sheet test: a Character
// of an isolated campaign (after the Acrobatics ranks the buffs-547 test
// gave it), a character-scoped copy of one buff with its imported Modifiers,
// a player-written running Spell Effect carrying another buff's Modifiers at
// caster level 12, both switched off again, and an outsider refused. Every
// read checks the number of the saved sheet's entries, its totals and the
// client preview's against the row's literals, and the admission gate's
// result for the copied buff on the released import is a literal
// (`releasedGateStates`). The pfBuffs549 release test, which builds a Catalog
// Release of Combat Expertise from its two store records and selects it on a
// sheet, is the last test. The batch reviews and legal records are not read.
import { convexTest } from 'convex-test';
import {
  makeFunctionReference,
  type FunctionArgs,
  type FunctionReturnType,
} from 'convex/server';
import { describe, expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import type { personalBonusTypes } from '../../src/lib/character-sheet';
import { withSheetCatalog } from '../character-sheet-catalog';
import { preloadCalledConvexModules } from '../convex-modules';
import { importReleasedEntries, releasedRecordFiles } from './released-entries';
import { buffKeys, type BuffBatch } from './released-buff-keys';
import {
  buffBatch,
  releasedGateStates,
  type GateState,
  type ImportedBuff,
} from './released-buff-sheet';

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

type BonusType = (typeof personalBonusTypes)[number];
type ImportedModifier = ImportedBuff['modifiers'][number];
/** A Modifier target of a manual catalog entry, as the copy stores it. */
type ManualTarget = Extract<
  Doc<'catalogEntry'>,
  { detail: { kind: 'manual' } }
>['modifiers'][number]['target'];

/** The statistics a step reads, by the breakdown each comes from. */
const statistics = {
  ac: 'ac.other',
  attackMelee: 'attack.melee',
  attackRanged: 'attack.ranged',
  damageMelee: 'damage.melee',
  climb: 'skill.clm',
  cmb: 'cmb',
  will: 'save.will',
  bab: 'bab',
} as const;

/** The totals a step reads, on the saved sheet or the client preview. */
type Totals = Record<keyof typeof statistics, number>;

const untouched: Totals = {
  ac: 0,
  attackMelee: 0,
  attackRanged: 0,
  damageMelee: 0,
  climb: 0,
  cmb: 0,
  will: 0,
  bab: 0,
};

/** The totals of a saved sheet's or client preview's breakdowns. */
function totalsOf(
  breakdowns: Record<(typeof statistics)[keyof Totals], { total: number }>,
): Totals {
  const entries = Object.entries(statistics) as [
    keyof Totals,
    (typeof statistics)[keyof Totals],
  ][];
  return Object.fromEntries(
    entries.map(([name, target]) => [name, breakdowns[target].total]),
  ) as Totals;
}

/**
 * The buff a row copies onto the Character as a character-scoped catalog
 * entry, with the literals its steps check.
 */
type CopiedBuff = {
  name: string;
  key: string;
  /**
   * The admission gate's list and reason for it on the released import (the
   * batch test read the batch review's disposition instead).
   */
  gate: readonly [GateState, string];
  /** Its imported Modifiers, whole. */
  modifiers: readonly ImportedModifier[];
  /** What the saved sheet's AC breakdown lists for it. */
  appliedOnAc: { bonusType: BonusType; value: number };
  /** The totals with the copy on. */
  totals: Totals;
};

/**
 * The buff whose Modifiers a player writes as a running Spell Effect at
 * caster level 12, as the batch test wrote it, with its imported effect
 * detail and the totals while it runs beside the copy.
 */
type RunningEffect = {
  name: string;
  /** The name the batch test gave the written effect. */
  writtenName: string;
  spellKey: string;
  defaultCasterLevel: number;
  operationId: string;
  stopOperationId: string;
  totals: Totals;
};

/**
 * Whether the batch test gave the Character skill ranks before its baseline
 * (buffs547's 3 Acrobatics ranks, through the member's class-level edit):
 * the ranked path carries the ranks, the plain path none.
 */
type Setup =
  | {
      kind: 'skillRanks';
      skillRank: { skill: 'skill.acr'; ranks: number };
      operationId: string;
    }
  | { kind: 'plain'; skillRank?: never; operationId?: never };

type IntegrationRow = Setup & {
  batch: BuffBatch;
  /** The identity prefix, campaign and Character the batch test used. */
  tag: string;
  campaignName: string;
  characterName: string;
  createOperation: string;
  /** The totals once the setup is done, and again once both are off. */
  baseline: Totals;
  copy: CopiedBuff;
  running: RunningEffect;
  /**
   * How many entries the saved sheet holds once the setup is done, with the
   * copy, and with the running effect (both stay, switched off, at the end).
   */
  sheetEntries: { baseline: number; withCopy: number; running: number };
};

const COMBAT_EXPERTISE = 'pf1-content/Xwk4zZksBg2KvyEG';
/** Combat Expertise's imported Modifiers (the copy row and the release). */
const combatExpertiseModifiers = [
  {
    target: 'attack.melee',
    bonusType: 'untyped',
    value: { formula: '-(1 + (floor(@bab / 4)))' },
  },
  {
    target: 'ac',
    bonusType: 'dodge',
    value: { formula: '(1 + (floor(@bab / 4)))' },
  },
  {
    target: 'cmb',
    bonusType: 'untyped',
    value: { formula: '-(1 + (floor(@bab / 4)))' },
  },
] as const satisfies readonly ImportedModifier[];
/** The gate's result for Combat Expertise (the copy row and the release). */
const combatExpertiseGate = [
  'admitted',
  'Admitted under #227: scripted match PZO1110 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_feats.lst:33).',
] as const satisfies readonly [GateState, string];

const rows: readonly IntegrationRow[] = [
  {
    // buffs547.integration.test.ts:30
    batch: 'buffs-547',
    kind: 'skillRanks',
    skillRank: { skill: 'skill.acr', ranks: 3 },
    operationId: 'acrobatics',
    tag: 'buffs547',
    campaignName: 'Isolated reviewed buffs #547',
    characterName: 'Defender',
    createOperation: 'defender',
    baseline: untouched,
    // The held combat option: -4 on attack rolls and +2 dodge to AC, +3 with
    // 3 Acrobatics ranks.
    copy: {
      name: 'Fighting Defensively',
      key: 'pf1/V8cRFtOQA6ltklEl',
      gate: ['admitted', 'Admitted under #227: declared book PZO1110.'],
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: -4 },
        {
          target: 'ac',
          bonusType: 'dodge',
          value: { formula: '2 + min(1, floor(@skillRanks.acr / 3))' },
        },
      ],
      appliedOnAc: { bonusType: 'dodge', value: 3 },
      totals: { ...untouched, ac: 3, attackMelee: -4, attackRanged: -4 },
    },
    // Shield of faith at caster level 12: +4 deflection.
    running: {
      name: 'Shield of Faith',
      writtenName: 'Isolated running Shield of Faith',
      spellKey: 'pf1/y2uhoqr4itdbw5g4',
      defaultCasterLevel: 1,
      operationId: 'running-shield-of-faith',
      stopOperationId: 'stop-shield-of-faith',
      totals: { ...untouched, ac: 7, attackMelee: -4, attackRanged: -4 },
    },
    sheetEntries: { baseline: 2, withCopy: 3, running: 4 },
  },
  {
    // pfBuffs548.integration.test.ts:30
    batch: 'pf-buffs-548',
    kind: 'plain',
    tag: 'pfbuffs548',
    campaignName: 'Isolated reviewed pf-buffs #548',
    characterName: 'Squeezer',
    createOperation: 'squeezer',
    baseline: untouched,
    // The held combat state: -4 on attack rolls and -4 to AC.
    copy: {
      name: 'Squeezing (large)',
      key: 'pf1-content/Ej91vWnfFTaxMhyZ',
      gate: ['held', 'missing Attribution Assessment'],
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: -4 },
        { target: 'ac', bonusType: 'untyped', value: -4 },
      ],
      appliedOnAc: { bonusType: 'untyped', value: -4 },
      totals: { ...untouched, ac: -4, attackMelee: -4, attackRanged: -4 },
    },
    // Divine power at caster level 12: +4 luck on attack rolls, weapon
    // damage and Climb.
    running: {
      name: 'Divine Power',
      writtenName: 'Isolated running Divine Power',
      spellKey: 'pf1/0yvwyclhkf76veo1',
      defaultCasterLevel: 7,
      operationId: 'running-divine-power',
      stopOperationId: 'stop-divine-power',
      totals: { ...untouched, ac: -4, damageMelee: 4, climb: 4 },
    },
    sheetEntries: { baseline: 2, withCopy: 3, running: 4 },
  },
  {
    // pfBuffs549.integration.test.ts:32
    batch: 'pf-buffs-549',
    kind: 'plain',
    tag: 'pfbuffs549',
    campaignName: 'Isolated reviewed pf-buffs #549',
    characterName: 'Duelist',
    createOperation: 'duelist',
    // A level-0 character: base attack bonus +0.
    baseline: untouched,
    // The admitted combat buff at base attack bonus +0: -1 on melee attacks
    // and combat maneuver checks and +1 dodge to AC; ranged attacks as they
    // were.
    copy: {
      name: 'Combat Expertise',
      key: COMBAT_EXPERTISE,
      gate: combatExpertiseGate,
      modifiers: combatExpertiseModifiers,
      appliedOnAc: { bonusType: 'dodge', value: 1 },
      totals: { ...untouched, ac: 1, attackMelee: -1, cmb: -1 },
    },
    // Wrathful mantle at caster level 12: +3 resistance on saves.
    running: {
      name: 'Wrathful Mantle',
      writtenName: 'Isolated running Wrathful Mantle',
      spellKey: 'pf1/1gz3zdpxu7uic5ky',
      defaultCasterLevel: 5,
      operationId: 'running-wrathful-mantle',
      stopOperationId: 'stop-wrathful-mantle',
      totals: { ...untouched, ac: 1, attackMelee: -1, cmb: -1, will: 3 },
    },
    sheetEntries: { baseline: 2, withCopy: 3, running: 4 },
  },
];

/** What an outsider reading the Character is told. */
const notFound = 'Character not found';

const { entries, artifact } = await importReleasedEntries(buffKeys());
const gateStates = await releasedGateStates(artifact);

type Harness = ReturnType<typeof convexTest>;
type Sheet = NonNullable<FunctionReturnType<typeof api.characterSheet.read>>;

/**
 * The saved sheet holds that many entries, and its totals and the client
 * preview's equal the literals.
 */
function expectSheet(
  sheet: Sheet | null,
  expected: { totals: Totals; entries: number },
  stage: string,
) {
  if (!sheet) throw new Error(`Missing saved sheet: ${stage}`);
  expect(sheet.entries, stage).toHaveLength(expected.entries);
  expect(totalsOf(sheet.calculated.breakdowns), stage).toEqual(expected.totals);
  expect(
    totalsOf(calculateCharacterSheetPreview(sheet).breakdowns),
    `${stage}, client preview`,
  ).toEqual(expected.totals);
  return sheet;
}

/** An organization with an owner and a member, an outsider of another, and the row's campaign. */
async function campaignOf(t: Harness, row: IntegrationRow) {
  const campaignId = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `${row.tag}|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: row.campaignName,
      description: '',
      organizationId: 'org',
      ownerId: `${row.tag}|owner`,
      e2eFixture: {
        namespace: row.batch,
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
  });
  return {
    campaignId,
    owner: t.withIdentity({ tokenIdentifier: `${row.tag}|owner` }),
    member: t.withIdentity({ tokenIdentifier: `${row.tag}|member` }),
    outsider: t.withIdentity({ tokenIdentifier: `${row.tag}|outsider` }),
  };
}

describe('the row table', () => {
  test('a ranked row needs its skill ranks and a plain row takes none', () => {
    const ranked = rows.find((row) => row.kind === 'skillRanks');
    const plain = rows.find((row) => row.kind === 'plain');
    if (ranked?.kind !== 'skillRanks' || plain?.kind !== 'plain')
      throw new Error('Missing a row of each path');
    const skillRank = { skill: 'skill.acr', ranks: 3 } as const;
    const refused = [
      // @ts-expect-error A ranked path without its skill ranks.
      ((): Setup => ({ kind: 'skillRanks', operationId: 'ranks' }))(),
      // @ts-expect-error A plain row spread onto the ranked path.
      ((): IntegrationRow => ({ ...plain, kind: 'skillRanks' }))(),
      // @ts-expect-error A plain path with skill ranks.
      ((): Setup => ({ kind: 'plain', skillRank }))(),
      // @ts-expect-error A plain row spread with skill ranks.
      ((): IntegrationRow => ({ ...plain, skillRank }))(),
      // @ts-expect-error A ranked row spread onto the plain path.
      ((): IntegrationRow => ({ ...ranked, kind: 'plain' }))(),
    ];
    expect(refused).toHaveLength(5);
  });
});

describe('the buff batches on a saved sheet', () => {
  test.each(rows)(
    '$batch: a saved sheet applies a copied $copy.name and a running $running.name at caster level 12, and refuses an outsider',
    async (row) => {
      const { entry } = buffBatch(entries, row.batch);
      const copied = entry(row.copy.name);
      const effect = entry(row.running.name);
      expect(copied.externalKey).toBe(row.copy.key);
      expect(gateStates.get(row.copy.key)).toEqual(row.copy.gate);
      expect(copied.modifiers).toEqual(row.copy.modifiers);
      expect(effect.detail).toMatchObject({
        kind: 'spellEffect',
        spellKey: row.running.spellKey,
        defaultCasterLevel: row.running.defaultCasterLevel,
      });
      const t = convexTest(schema, modules);
      const { campaignId, owner, member, outsider } = await campaignOf(t, row);
      const characterId = await owner.mutation(api.characterSheet.create, {
        campaignId,
        organizationId: 'org',
        name: row.characterName,
        kind: 'pc',
        operationId: row.createOperation,
      });
      const scope = { characterId };
      if (row.kind === 'skillRanks') {
        const created = await owner.query(api.characterSheet.read, scope);
        const level = created?.entries.find(
          (sheetEntry) => sheetEntry.kind === 'classLevel',
        );
        if (!level) throw new Error('Class Level fixture missing');
        await member.mutation(api.characterSheet.editClassLevel, {
          ...scope,
          entryId: level._id,
          skillRank: row.skillRank,
          operationId: row.operationId,
        });
      }
      expectSheet(
        withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
        { totals: row.baseline, entries: row.sheetEntries.baseline },
        'baseline',
      );

      // The copy is a fixture row: a character-scoped catalog entry with the
      // imported Modifiers, switched on.
      const sheetEntryId = await t.run(async (ctx) => {
        const catalogEntryId = await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: copied.name,
          ruleIdentity: copied.externalKey,
          stacksWithItself: false,
          modifiers: copied.modifiers.map((modifier) => ({
            target: modifier.target as ManualTarget,
            bonusType: modifier.bonusType as BonusType,
            value: modifier.value,
          })),
          sources: copied.sources,
          detail: { kind: 'manual' },
        });
        return ctx.db.insert('characterSheetEntry', {
          characterId,
          kind: 'manual',
          active: true,
          catalogEntryId,
          state: { kind: 'manual' },
        });
      });
      const withCopy = expectSheet(
        withSheetCatalog(await member.query(api.characterSheet.read, scope)),
        { totals: row.copy.totals, entries: row.sheetEntries.withCopy },
        `with ${row.copy.name}`,
      );
      expect(
        withCopy.calculated.breakdowns['ac.other'].applied.find(
          (applied) => applied.entryName === row.copy.name,
        ),
      ).toMatchObject(row.copy.appliedOnAc);

      // The running effect is written through the public writer, never an
      // imported or admitted Spell Effect.
      const effectId = await member.mutation(
        api.characterSheet.createSheetEntry,
        {
          ...scope,
          name: row.running.writtenName,
          modifiers: effect.modifiers.map((modifier) => ({
            target: modifier.target as FunctionArgs<
              typeof api.characterSheet.createSheetEntry
            >['modifiers'][number]['target'],
            bonusType: modifier.bonusType as BonusType,
            value: modifier.value,
          })),
          detail: {
            kind: 'spellEffect',
            spellKey: row.running.spellKey,
            defaultCasterLevel: row.running.defaultCasterLevel,
            lastsOverOneDay: false,
          },
          casterLevel: 12,
          operationId: row.running.operationId,
        },
      );
      expectSheet(
        withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
        { totals: row.running.totals, entries: row.sheetEntries.running },
        `with ${row.running.name} running`,
      );

      // Switching both off restores the sheet: the running effect through
      // the public writer, the copy directly.
      await member.mutation(api.characterSheet.editSheetEntry, {
        ...scope,
        entryId: effectId,
        active: false,
        operationId: row.running.stopOperationId,
      });
      await t.run((ctx) => ctx.db.patch(sheetEntryId, { active: false }));
      expectSheet(
        withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
        { totals: row.baseline, entries: row.sheetEntries.running },
        'both off',
      );
      await expect(
        outsider.query(api.characterSheet.read, scope),
      ).rejects.toThrow(notFound);
    },
  );
});

/**
 * pfBuffs549.integration.test.ts:208. The admitted Combat Expertise through
 * the release path: its store record and the Core Rulebook feat it links,
 * checked against their recorded digests, are imported as the batch test
 * imported them, built into a Catalog Release with the reviewed attribution,
 * transported and published in convex-test's isolated database, selected as
 * the fixture-only release, and its released definition chosen on a sheet
 * through the public writer. The global catalog row is only the stable
 * identity the release projects onto (its stored Modifiers are empty); every
 * number comes from the release.
 */
const RELEASE = {
  releaseNumber: 549,
  buff: COMBAT_EXPERTISE,
  /** The Combat Expertise feat (Core Rulebook) the buff links. */
  feat: 'pf1/NFxHebU1XhEs5WJh',
  /** The two store files with the SHA-256 the batch review recorded. */
  files: {
    'pf1-content/src/pf-buffs/Combat_Expertise_Xwk4zZksBg2KvyEG.yaml':
      '83a388196dc2fae32a9c5462c8629a6b6797f536205937d81a9e86cb1903b951',
    'pf1/packs/feats/combat-expertise.NFxHebU1XhEs5WJh.yaml':
      'e815034f7bbf83e11d8fef7e9167d97d91d01eb2f94fbc8d8d2d684ed6d0fb55',
  },
} as const;

test('an isolated release publishes the admitted Combat Expertise, and a sheet that selects it applies the released penalties and dodge bonus', async () => {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const { serializeCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { createBatchRelease } = await import('./batch-admission');
  const { validateCatalogReleaseArtifact } =
    await import('../../src/lib/catalog/release-schema');
  const { catalogRuntimeCompatibility } =
    await import('../../src/lib/catalog/runtime-compatibility');
  const { releaseLegalInputsSchema } =
    await import('../../src/lib/catalog/release-legal-inputs');
  const { collectReferences, computeFingerprint } =
    await import('../../scripts/catalog/admission');
  const { legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const { releaseNumber, buff, feat } = RELEASE;
  expect(gateStates.get(buff)).toEqual(combatExpertiseGate);
  // The buff and its governing feat, and nothing else.
  const files = await releasedRecordFiles([buff, feat]);
  expect(files).toEqual(Object.keys(RELEASE.files));
  const tree = await materializePinnedTree(files, { sha256: RELEASE.files });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: [buff, feat],
      wholeCorpus: false,
    });
    expect(artifact.curation.missing).toEqual([]);
    const imported = artifact.catalog.entries.find(
      (row) => row.externalKey === buff,
    );
    if (!imported) throw new Error('Combat Expertise was not imported');
    expect(collectReferences(imported)).toEqual([feat]);
    const release = await createBatchRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-pf-buffs-549-proof',
        sanitizers: 'isolated-pf-buffs-549-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const published = transported.batches
      .flat()
      .find(
        (candidate) =>
          candidate.kind === 'definition' && candidate.key === buff,
      );
    if (!published) throw new Error('Combat Expertise was not published');
    expect(published.payload).toMatchObject({
      name: 'Combat Expertise',
      detail: { kind: 'manual' },
      modifiers: combatExpertiseModifiers,
    });
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
      await t.mutation(writeBatch, { releaseNumber, batchIndex, rows: batch });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber });
    // This control exists only in convex-test's isolated database. No
    // deployment or production catalog is touched by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) =>
            q.eq('releaseNumber', releaseNumber),
          )
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber,
        releaseId,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        isFixtureOnly: true,
      });
    });
    const legal = releaseLegalInputsSchema.parse(
      await t.query(api.catalogRelease.legalInputs, {}),
    );
    expect(legal.requiredNotices).toEqual(['PZO1110']);
    const campaignId = await t.run(async (ctx) => {
      await ctx.db.insert('user', {
        tokenIdentifier: 'pfbuffs549release|owner',
        orgIds: [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
      return ctx.db.insert('campaign', {
        name: 'Isolated released pf-buffs #549',
        description: '',
        organizationId: 'org',
        ownerId: 'pfbuffs549release|owner',
        e2eFixture: {
          namespace: 'pf-buffs-549',
          version: 1,
          workerKey: '0',
          caseKey: 'released',
          campaignKey: 'released',
        },
      });
    });
    const owner = t.withIdentity({
      tokenIdentifier: 'pfbuffs549release|owner',
    });
    const characterId = await owner.mutation(api.characterSheet.create, {
      campaignId,
      organizationId: 'org',
      name: 'Released duelist',
      kind: 'pc',
      operationId: 'released-duelist',
    });
    const scope = { characterId };
    // A level-0 character: base attack bonus +0.
    expectSheet(
      withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
      { totals: untouched, entries: 2 },
      'before the release is selected',
    );
    // The stable global identity the selected release projects onto.
    const globalId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: 'Combat Expertise',
        ruleIdentity: buff,
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'manual' },
      }),
    );
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: globalId,
      operationId: 'select-released-combat-expertise',
    });
    // At base attack bonus +0: -1 on melee attacks and combat maneuver
    // checks, +1 dodge to AC, ranged attacks unchanged.
    expectSheet(
      withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
      {
        totals: { ...untouched, ac: 1, attackMelee: -1, cmb: -1 },
        entries: 3,
      },
      'with the released Combat Expertise',
    );
  } finally {
    await tree.dispose();
  }
}, 90_000);
