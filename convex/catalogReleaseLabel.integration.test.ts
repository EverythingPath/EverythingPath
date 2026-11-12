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
import schema from './schema';
import { api, internal } from './_generated/api';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
afterEach(() => vi.useRealTimers());

// A released feat as the release build writes it, with its label (#227 slice 4).
const strengthFeat = (key: string, verification: unknown) => ({
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
        reasons: ['no curation record'],
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
  const read = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const labelOf = (
    rows: { _id: string; verification?: string }[],
    id: string,
  ) => rows.find((row) => row._id === id)?.verification;
  const sheet = await read();
  expect(labelOf(sheet.catalogEntries, verifiedId)).toBe('verified');
  expect(sheet.calculated.abilities.strength.score).toBe(12);
  const picker = await owner.query(api.catalogCopies.list, scope);
  expect(labelOf(picker, verifiedId)).toBe('verified');
  expect(labelOf(picker, uncuratedId)).toBe('unverified');
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
  expect(edited.calculated.abilities.strength.score).toBe(14);
  expect(labelOf(edited.catalogEntries, copyId)).toBeUndefined();
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
