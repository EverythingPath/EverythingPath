// @vitest-environment edge-runtime
// race-save-release-membership, slice A (PRD #251): the read's catalog
// choices and their held IDs come from one decision,
// `readSelectedChoiceStates` (convex/lib/catalogReleaseBoundary.ts). For
// each definition shape in the table, with and without a selected release,
// the test asserts whether the public read lists that definition and,
// separately, whether its ID is among the read's held IDs. The table's rows
// are the expected values: a campaign preference hides its admitted
// original, an unreleased imported Spell stays listed, and held IDs are only
// of listed definitions. The saves asserted are the retirement refusals the
// base already makes; saves that succeed are the end-of-write check's
// subject (sheet-write-release-check).
import { expect, test } from 'vitest';
import { computeFingerprint } from '../scripts/catalog/admission';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import {
  activationArgs,
  prepare,
  reconcile,
  releaseFixture,
} from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import type { WithoutSystemFields } from 'convex/server';

const modules = import.meta.glob('./**/*.ts');

const heldRefusal =
  'Catalog Entry is retired; keep existing selections or choose another entry';

/** A release body, as the importer emits it. */
const releaseBody = (
  externalKey: string,
  pack: string,
  detail: Record<string, unknown>,
) => ({
  externalKey,
  upstreamKey: externalKey,
  pack,
  name: externalKey,
  description: `${externalKey}.`,
  sources: [{ book: 'PZO1110', pages: '1' }],
  modifiers: [],
  unsupported: [],
  detail,
});
type ReleaseBody = ReturnType<typeof releaseBody>;
const featBody = (key: string) =>
  releaseBody(key, 'feats', {
    kind: 'feat',
    featTypes: ['General'],
    repeatable: 'no',
  });
const spellBody = (key: string) =>
  releaseBody(key, 'spells', {
    kind: 'spell',
    levels: { wizard: 1 },
    grantedLevels: {},
    school: 'evo',
    subschools: [],
    descriptors: [],
  });
const releaseDefinition = (body: ReleaseBody) => ({
  kind: 'definition' as const,
  key: body.externalKey,
  payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(body))),
});
const releaseRetirement = (body: ReleaseBody) => ({
  kind: 'report' as const,
  key: `retirement:${body.externalKey}`,
  payload: parseReleaseJson(
    JSON.parse(
      canonicalReleaseJson({
        externalKey: body.externalKey,
        kind: 'definition',
        state: 'held',
        lastUsableDefinition: body,
        definitionFingerprint: computeFingerprint(body),
      }),
    ),
  ),
});

/** The shared feats every copy shape copies, by how the release holds them. */
const shared = {
  admitted: 'prop/admitted',
  outside: 'prop/outside',
  retired: 'prop/retired',
  both: 'prop/both',
  preferred: 'prop/preferred',
} as const;
const sharedRace = 'prop/race';
const spells = { unreleased: 'prop/spell', retired: 'prop/spell-retired' };

/** What the read shows for a shape: listed, listed and held, or neither. */
type Read = 'offered' | 'held' | 'unlisted';
type Stored = {
  globals: Map<string, Id<'catalogEntry'>>;
  campaignId: Id<'campaign'>;
  characterId: Id<'character'>;
};
type Shape = {
  name: string;
  /** Stores the shape, or, for a shared one, returns the global seeded first. */
  insert: (ctx: MutationCtx, stored: Stored) => Promise<Id<'catalogEntry'>>;
  /** Under the selected release. */
  read: Read;
  /** With no release selected; offered unless said. */
  readWithoutRelease?: Read;
};

const identity = (ruleIdentity: string) => ({
  name: ruleIdentity,
  ruleIdentity,
  modifiers: [],
  sources: [],
  stacksWithItself: false,
});
const feat = { kind: 'feat' as const };
const sharedId = (stored: Stored, key: string) => {
  const id = stored.globals.get(key);
  if (!id) throw new Error(`Missing ${key}`);
  return id;
};
const campaignOwned = (stored: Stored) => ({
  scope: 'campaign' as const,
  campaignId: stored.campaignId,
});
const characterOwned = (stored: Stored) => ({
  scope: 'character' as const,
  characterId: stored.characterId,
});
const insert = (
  ctx: MutationCtx,
  definition: WithoutSystemFields<Doc<'catalogEntry'>>,
) => ctx.db.insert('catalogEntry', definition);

const shapes: Shape[] = [
  ...(['admitted', 'outside', 'retired', 'both'] as const).flatMap(
    (kind): Shape[] => {
      const key = shared[kind];
      const copyRead: Read =
        kind === 'admitted' || kind === 'outside' ? 'offered' : 'held';
      return [
        {
          name: `shared ${kind}`,
          insert: async (_, stored) => sharedId(stored, key),
          read: kind === 'outside' ? 'unlisted' : copyRead,
        },
        {
          name: `campaign copy of shared ${kind}`,
          insert: (ctx, stored) =>
            insert(ctx, {
              ...identity(key),
              ...campaignOwned(stored),
              copiedFrom: sharedId(stored, key),
              detail: feat,
            }),
          read: copyRead,
        },
        {
          name: `Character's copy of shared ${kind}`,
          insert: (ctx, stored) =>
            insert(ctx, {
              ...identity(key),
              ...characterOwned(stored),
              copiedFrom: sharedId(stored, key),
              detail: feat,
            }),
          read: copyRead,
        },
      ];
    },
  ),
  {
    name: "the campaign's",
    insert: (ctx, stored) =>
      insert(ctx, {
        ...identity('prop/campaign'),
        ...campaignOwned(stored),
        detail: feat,
      }),
    read: 'offered',
  },
  {
    name: "the Character's own",
    insert: (ctx, stored) =>
      insert(ctx, {
        ...identity('prop/own'),
        ...characterOwned(stored),
        detail: feat,
      }),
    read: 'offered',
  },
  {
    name: "a shared original the campaign's preferred copy replaces",
    insert: async (_, stored) => sharedId(stored, shared.preferred),
    read: 'unlisted',
    readWithoutRelease: 'unlisted',
  },
  {
    name: "the campaign's preferred copy",
    insert: (ctx, stored) =>
      insert(ctx, {
        ...identity(shared.preferred),
        ...campaignOwned(stored),
        copiedFrom: sharedId(stored, shared.preferred),
        campaignPreference: true,
        detail: feat,
      }),
    read: 'offered',
  },
  {
    name: "the Character's racial statistics copy",
    insert: (ctx, stored) =>
      insert(ctx, {
        ...identity(sharedRace),
        ...characterOwned(stored),
        copiedFrom: sharedId(stored, sharedRace),
        racialStatisticsCopy: true,
        detail: { kind: 'race', racialHitDice: 1, racialTraits: [] },
      }),
    read: 'unlisted',
    readWithoutRelease: 'unlisted',
  },
  ...(['unreleased', 'retired'] as const).map(
    (kind): Shape => ({
      name: `the Character's imported Spell, ${kind}`,
      insert: (ctx, stored) =>
        insert(ctx, {
          ...identity(spells[kind]),
          ...characterOwned(stored),
          importedSpell: true,
          detail: { kind: 'spell', levels: { wizard: 1 }, school: 'evocation' },
        }),
      read: kind === 'retired' ? 'held' : 'offered',
    }),
  ),
];

/**
 * Every shape stored, and a release admitting `admitted`, `both` and
 * `preferred`, retiring `retired`, `both` and the retired Spell, and leaving
 * the rest out. `check` runs before the release is activated, then after.
 */
async function propertyFixture(
  check: (context: {
    ids: Map<Shape, Id<'catalogEntry'>>;
    owner: Awaited<ReturnType<typeof releaseFixture>>['owner'];
    scope: Awaited<ReturnType<typeof releaseFixture>>['scope'];
    stage: 'no release' | 'release';
  }) => Promise<void>,
) {
  const { t, owner, scope } = await releaseFixture(modules);
  const shapeIds = await t.run(async (ctx) => {
    const character = await ctx.db.get('character', scope.characterId);
    const campaignId = character?.campaignId;
    if (!campaignId) throw new Error('Missing campaign');
    const globals = new Map<string, Id<'catalogEntry'>>();
    for (const key of Object.values(shared))
      globals.set(
        key,
        await insert(ctx, { ...identity(key), scope: 'global', detail: feat }),
      );
    globals.set(
      sharedRace,
      await insert(ctx, {
        ...identity(sharedRace),
        scope: 'global',
        detail: { kind: 'race', racialHitDice: 0, racialTraits: [] },
      }),
    );
    const stored = { globals, campaignId, characterId: scope.characterId };
    const ids: Id<'catalogEntry'>[] = [];
    for (const shape of shapes) ids.push(await shape.insert(ctx, stored));
    return ids;
  });
  const ids = new Map(
    shapes.flatMap((shape, index) => {
      const id = shapeIds[index];
      return id ? [[shape, id] as const] : [];
    }),
  );
  await check({ ids, owner, scope, stage: 'no release' });
  await prepare(t, [
    releaseDefinition(featBody(shared.admitted)),
    releaseDefinition(featBody(shared.both)),
    releaseDefinition(featBody(shared.preferred)),
    releaseRetirement(featBody(shared.retired)),
    releaseRetirement(featBody(shared.both)),
    releaseRetirement(spellBody(spells.retired)),
  ]);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(await reconcile(t, scope.characterId)),
  );
  await check({ ids, owner, scope, stage: 'release' });
}

/** What the read is expected to show for a shape at a stage. */
function expectedRead(shape: Shape, stage: 'no release' | 'release') {
  const read =
    stage === 'release' ? shape.read : (shape.readWithoutRelease ?? 'offered');
  return { listed: read !== 'unlisted', held: read === 'held' };
}

test("for each table shape, with and without a release, the public read's listing and held IDs match the table; held content stays refused as retired", async () => {
  const seen: string[] = [];
  await propertyFixture(async ({ ids, owner, scope, stage }) => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const listed = new Set<string>(
      (sheet?.catalogView?.definitions ?? []).map(({ _id }) => _id),
    );
    const held = new Set<string>(sheet?.catalogView?.heldDefinitionIds ?? []);
    for (const shape of shapes) {
      const id = ids.get(shape);
      if (!id) throw new Error(`Missing ${shape.name}`);
      const expected = expectedRead(shape, stage);
      seen.push(`${stage}: ${shape.name}`);
      expect({
        shape: shape.name,
        stage,
        listed: listed.has(id),
        held: held.has(id),
      }).toEqual({ shape: shape.name, stage, ...expected });
      // The base's retirement refusal, unchanged.
      if (expected.held)
        await expect(
          owner.mutation(api.characterSheet.selectEntry, {
            ...scope,
            catalogEntryId: id,
            operationId: `${stage}-${shape.name}`,
          }),
        ).rejects.toThrow(heldRefusal);
    }
  });
  expect(seen).toHaveLength(shapes.length * 2);
});
