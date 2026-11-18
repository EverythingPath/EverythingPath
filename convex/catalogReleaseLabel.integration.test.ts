// @vitest-environment edge-runtime
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  activationArgs,
  prepare,
  reconcile,
  releaseFixture,
} from '../tests/catalog-release-fixture';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import {
  cleaveReleases,
  cleaveVerification,
} from '../tests/catalog/cleave-release-fixture';
import type { CatalogReleaseArtifact } from '../src/lib/catalog/release-schema';
import { calculateDefinitionFingerprint } from './lib/catalogCopies';
import { characterCopyDefinition } from './lib/characterMovePlan';
import schema from './schema';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
afterEach(() => vi.useRealTimers());

// A released feat as the release build writes it, with its label (#227 slice 4).
const strengthFeat = <Label>(key: string, verification: Label) => ({
  externalKey: key,
  upstreamKey: key,
  pack: 'feats',
  name: `Released ${key}`,
  description: '',
  sources: [],
  modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  unsupported: [],
  detail: { kind: 'feat', featTypes: ['general'], repeatable: 'no' },
  verification,
});

test('a released definition carries its label to the sheet read and the picker; a Catalog Copy carries none, and editing its Modifiers changes the sheet', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const insertGlobal = (ruleIdentity: string) =>
    t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'global',
        stacksWithItself: false,
        ruleIdentity,
        name: ruleIdentity,
        sources: [],
        modifiers: [],
        detail: { kind: 'feat' },
      }),
    );
  const verifiedId = await insertGlobal('pf1/Verified');
  const uncuratedId = await insertGlobal('pf1/Uncurated');
  const unlabelledId = await insertGlobal('pf1/Unlabelled');
  const { verification: _none, ...unlabelled } = strengthFeat(
    'pf1/Unlabelled',
    undefined,
  );
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/Verified',
      payload: strengthFeat('pf1/Verified', { state: 'verified' }),
    },
    {
      kind: 'definition',
      key: 'pf1/Uncurated',
      payload: strengthFeat('pf1/Uncurated', {
        state: 'unverified',
        reasons: ['outside the launch inventory', 'no curation record'],
      }),
    },
    // A release built before the label.
    { kind: 'definition', key: 'pf1/Unlabelled', payload: unlabelled },
  ]);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(await reconcile(t, scope.characterId)),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: verifiedId,
    operationId: 'select-verified',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: uncuratedId,
    operationId: 'select-uncurated',
  });
  const read = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const labelOf = (
    rows: { _id: string; verification?: unknown }[],
    id: string,
  ) => rows.find((row) => row._id === id)?.verification;
  const uncurated = {
    state: 'unverified',
    reasons: ['outside the launch inventory', 'no curation record'],
  };
  const sheet = await read();
  expect(labelOf(sheet.catalogEntries, verifiedId)).toEqual({
    state: 'verified',
  });
  expect(labelOf(sheet.catalogEntries, uncuratedId)).toEqual(uncurated);
  expect(sheet.calculated.abilities.strength.score).toBe(14);
  const picker = await owner.query(api.catalogCopies.list, scope);
  expect(labelOf(picker, verifiedId)).toEqual({ state: 'verified' });
  expect(labelOf(picker, uncuratedId)).toEqual(uncurated);
  expect(labelOf(picker, unlabelledId)).toBeUndefined();

  // A Catalog Copy of the verified definition carries no label, and the
  // Selection follows it.
  const copyId = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: verifiedId,
    operationId: 'customize',
  });
  const copied = await read();
  expect(copied.entries.find((row) => row._id === entryId)).toMatchObject({
    catalogEntryId: copyId,
  });
  expect(copied.catalogEntries.find((row) => row._id === copyId)).toMatchObject(
    { copiedFrom: verifiedId, name: 'Released pf1/Verified' },
  );
  expect(labelOf(copied.catalogEntries, copyId)).toBeUndefined();
  expect(
    await t.run((ctx) => ctx.db.get('catalogEntry', copyId)),
  ).not.toHaveProperty('verification');

  // Correcting a wrong number on the released entry: edit the copy's
  // Modifiers, and the sheet follows.
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'edit-copy',
  });
  const edited = await read();
  expect(edited.calculated.abilities.strength.score).toBe(16);
  expect(labelOf(edited.catalogEntries, copyId)).toBeUndefined();
});

// A definition read before the label kept its reasons stored the state alone.
test('a definition stored with its state alone stays valid and reads without reasons', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const catalogEntryId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      stacksWithItself: false,
      ruleIdentity: 'pf1/StateOnly',
      name: 'State only',
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
      verification: 'unverified',
    }),
  );
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId,
    operationId: 'select-state-only',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.catalogEntries.find((row) => row._id === catalogEntryId)
      ?.verification,
  ).toBe('unverified');
});

// The stored reasons are bounded by the reason vocabulary: each reason once.
test('a released definition that repeats a reason reads it once', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const repeatedId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      stacksWithItself: false,
      ruleIdentity: 'pf1/Repeated',
      name: 'pf1/Repeated',
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    }),
  );
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/Repeated',
      payload: strengthFeat('pf1/Repeated', {
        state: 'unverified',
        reasons: [
          'no curation record',
          'unproven mechanism',
          'no curation record',
        ],
      }),
    },
  ]);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(await reconcile(t, scope.characterId)),
  );
  const picker = await owner.query(api.catalogCopies.list, scope);
  expect(picker.find((row) => row._id === repeatedId)?.verification).toEqual({
    state: 'unverified',
    reasons: ['no curation record', 'unproven mechanism'],
  });
});

test('a one-off definition cannot claim a label', async () => {
  const { owner, scope } = await releaseFixture(modules);
  await expect(
    owner.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      definition: {
        name: 'Homebrew feat',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'feat' },
        verification: 'verified',
      } as never,
      operationId: 'one-off',
    }),
  ).rejects.toThrow('Validator error');
});

test('a personal adjustment carries no label', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Ironfang drill',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'adjust',
    },
  );
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const adjustment = sheet?.entries.find((row) => row._id === entryId);
  const catalogEntryId =
    adjustment?.kind === 'manual' ? adjustment.catalogEntryId : undefined;
  if (!catalogEntryId) throw new Error('Missing personal adjustment');
  expect(
    sheet?.catalogEntries.find((row) => row._id === catalogEntryId),
  ).not.toHaveProperty('verification');
  expect(
    await t.run((ctx) => ctx.db.get('catalogEntry', catalogEntryId)),
  ).not.toHaveProperty('verification');
});

test("a moved Character's copy carries no label, and a copy's fingerprint does not depend on its original's label", async () => {
  const { scope } = await releaseFixture(modules);
  const definition = (verification?: 'verified' | 'unverified') =>
    ({
      _id: 'catalogEntry-id' as Id<'catalogEntry'>,
      _creationTime: 0,
      scope: 'global',
      stacksWithItself: false,
      ruleIdentity: 'pf1/Verified',
      name: 'Released pf1/Verified',
      sources: [],
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      detail: { kind: 'feat' },
      ...(verification ? { verification } : {}),
    }) satisfies Doc<'catalogEntry'>;
  const moved = await characterCopyDefinition(
    definition('verified'),
    scope.characterId,
  );
  expect(moved).toMatchObject({
    scope: 'character',
    copiedFrom: 'catalogEntry-id',
  });
  expect(moved).not.toHaveProperty('verification');
  const fingerprint = await calculateDefinitionFingerprint(definition());
  expect(await calculateDefinitionFingerprint(definition('verified'))).toBe(
    fingerprint,
  );
  expect(await calculateDefinitionFingerprint(definition('unverified'))).toBe(
    fingerprint,
  );
  expect(moved.copiedFromFingerprint).toBe(fingerprint);
});

// The spec review's sequence (#227 slice 4 r1), through the release build and
// the sheet read: Cleave released at release 1, then held at release 2 by its
// revoked comparison while a Character keeps its Selection, which reads the
// retained body with the label release 2 gives it.
const staleLabel = {
  state: 'unverified',
  reasons: ['verification projection stale'],
} as const;
test.each([
  {
    firstProjection: 'current',
    secondProjection: 'stale',
    firstLabel: { state: 'verified' },
    secondLabel: staleLabel,
  },
  {
    firstProjection: 'stale',
    secondProjection: 'current',
    firstLabel: staleLabel,
    secondLabel: { state: 'verified' },
  },
  {
    firstProjection: 'stale',
    secondProjection: 'current but without it',
    firstLabel: staleLabel,
    secondLabel: {
      state: 'unverified',
      reasons: ['outside the launch inventory'],
    },
  },
] as const)(
  'a retained definition reads the label each build gives it: released with a $firstProjection projection, retained with a $secondProjection one',
  async ({ firstProjection, secondProjection, firstLabel, secondLabel }) => {
    const { t, owner, scope } = await releaseFixture(modules);
    const {
      createCatalogRelease,
      computeFingerprint,
      entry,
      assess,
      comparison,
      original,
      options,
      row,
    } = await cleaveReleases();
    const verificationOf = (
      projection: 'stale' | 'current' | 'current but without it',
    ) =>
      cleaveVerification(
        projection === 'stale'
          ? { stale: ['the calculation identity changed'] }
          : projection === 'current but without it'
            ? { inInventory: false }
            : {},
      );
    const first = await createCatalogRelease({
      ...options,
      attribution: original,
      releaseNumber: 1,
      verification: await verificationOf(firstProjection),
    });
    const use = {
      useId: 'vessa-cleave',
      externalKey: entry.externalKey,
      name: 'Cleave',
      characterId: scope.characterId,
      definitionFingerprint: computeFingerprint(entry),
      admittedRelease: 1,
      requiredNotices: ['CRB'],
    };
    const second = await createCatalogRelease({
      ...options,
      attribution: {
        ...assess(
          { comparison: { ...comparison, revoked: true } },
          'comparison',
        ),
        retainedUses: [use],
        retainedExceptions: [
          {
            useId: use.useId,
            externalKey: use.externalKey,
            definitionFingerprint: use.definitionFingerprint,
            reason: 'Attribution evidence revoked; the existing use is kept.',
            requiredNotices: ['CRB'],
          },
        ],
      },
      previous: first,
      releaseNumber: 2,
      verification: await verificationOf(secondProjection),
    });
    const builtRow = (artifact: CatalogReleaseArtifact, key: string) => {
      const payload = row(artifact, key);
      if (payload === undefined) throw new Error(`Missing release row ${key}`);
      return payload;
    };
    const cleaveId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'global',
        stacksWithItself: false,
        ruleIdentity: entry.externalKey,
        name: entry.name,
        sources: [],
        modifiers: [],
        detail: { kind: 'feat' },
      }),
    );
    const releaseOne = await prepare(t, [
      {
        kind: 'definition',
        key: entry.externalKey,
        payload: builtRow(first, entry.externalKey),
      },
    ]);
    await t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(await reconcile(t, scope.characterId)),
    );
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: cleaveId,
      operationId: 'select-cleave',
    });
    const label = async () =>
      withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      )?.catalogEntries.find((candidate) => candidate._id === cleaveId)
        ?.verification;
    expect(await label()).toEqual(firstLabel);

    const retirementKey = `retirement:${entry.externalKey}`;
    await prepare(
      t,
      [
        {
          kind: 'report',
          key: retirementKey,
          payload: builtRow(second, retirementKey),
        },
      ],
      2,
      {
        releaseNumber: 1,
        artifactFingerprint: releaseOne.manifest.artifactFingerprint,
      },
    );
    await t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(await reconcile(t, scope.characterId, 2), 2),
    );
    expect(await label()).toEqual(secondLabel);
  },
);
