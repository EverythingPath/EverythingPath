// @vitest-environment edge-runtime
// sheet-write-release-check (PRD #251): at the end-of-write step a reference
// new to the sheet must be one the selected Catalog Release would offer
// (convex/lib/sheetReleaseReferences.ts). Each row of the table below runs
// on a fresh Character: `before` runs with no release selected, then a
// release is activated, the row reads what the public read shows for the
// reference its save would add, and saves it through the real mutations.
// Every end-of-write step these rows reach also checks that the stored rows
// equal the in-memory ones (the design's stale-rows risk), and each check
// records the references it found new and the reads it made.
import { afterEach, expect, test, vi } from 'vitest';
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
import type * as CharacterSheetModule from './lib/characterSheet';
import {
  listSheetReferences,
  notReferenceFields,
  sheetReferenceFields,
} from './lib/sheetReleaseReferences';
import type * as SheetReleaseReferencesModule from './lib/sheetReleaseReferences';
import schema from './schema';

const staleRows = vi.hoisted(() => ({
  checked: 0,
  mismatches: [] as string[],
}));
/** Each end-of-write check: the references it found new, and its reads. */
const checks = vi.hoisted(() => [] as { added: string[]; reads: number }[]);

/** Counts the reads the end-of-write check makes, and what it found new. */
vi.mock('./lib/sheetReleaseReferences', async (importOriginal) => {
  const original = await importOriginal<typeof SheetReleaseReferencesModule>();
  return {
    ...original,
    requireAcceptedNewReferences: async (
      ...[ctx, sheet, before]: Parameters<
        typeof original.requireAcceptedNewReferences
      >
    ) => {
      const known = new Set(before);
      const record = {
        added: original
          .listSheetReferences(sheet.entries)
          .filter((key) => !known.has(key)),
        reads: 0,
      };
      checks.push(record);
      const db = new Proxy(ctx.db, {
        get(target, property, receiver) {
          const value: unknown = Reflect.get(target, property, receiver);
          if (
            (property === 'get' || property === 'query') &&
            typeof value === 'function'
          )
            return (...args: unknown[]) => {
              record.reads++;
              return Reflect.apply(value, target, args);
            };
          return value;
        },
      });
      return original.requireAcceptedNewReferences(
        { ...ctx, db },
        sheet,
        before,
      );
    },
  };
});

/** Every end-of-write step compares the stored rows with the sheet's own. */
vi.mock('./lib/characterSheet', async (importOriginal) => {
  const original = await importOriginal<typeof CharacterSheetModule>();
  const stable = (value: unknown): string =>
    JSON.stringify(value, (_, item: unknown) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          )
        : item,
    );
  return {
    ...original,
    pruneWarningAcceptancesAndRecordChange: async (
      ctx: MutationCtx,
      args: Parameters<
        typeof original.pruneWarningAcceptancesAndRecordChange
      >[1],
    ) => {
      const stored = await ctx.db
        .query('characterSheetEntry')
        .withIndex('by_characterId', (q) =>
          q.eq('characterId', args.sheet.character._id),
        )
        .collect();
      const byId = (rows: readonly { _id: string }[]) =>
        [...rows].sort((left, right) => left._id.localeCompare(right._id));
      staleRows.checked++;
      if (stable(byId(stored)) !== stable(byId(args.sheet.entries)))
        staleRows.mismatches.push(args.operationId);
      return original.pruneWarningAcceptancesAndRecordChange(ctx, args);
    },
  };
});

const modules = import.meta.glob('./**/*.ts');

const refusal =
  'Catalog Entry is not in the catalog; keep existing selections or choose another entry';
const retiredRefusal =
  'Catalog Entry is retired; keep existing selections or choose another entry';

const keys = {
  human: 'swrc/human',
  humanTrait: 'swrc/human-trait',
  otherTrait: 'swrc/trait-other',
  kobold: 'swrc/kobold',
  admitted: 'swrc/feat-admitted',
  outside: 'swrc/feat-outside',
  retired: 'swrc/feat-retired',
  granter: 'swrc/feat-granter',
  granted: 'swrc/feat-granted',
  preferred: 'swrc/feat-preferred',
  option: 'swrc/feat-option',
  feature: 'swrc/feature-outside',
  kept: 'swrc/class-kept',
  first: 'swrc/class-first',
  copied: 'swrc/class-copied',
  spell: 'swrc/spell-outside',
  preferredSpell: 'swrc/spell-preferred',
  retiredSpell: 'swrc/spell-retired',
} as const;
type Key = keyof typeof keys;

const releaseBody = ({
  externalKey,
  pack,
  detail,
  extra = {},
}: {
  externalKey: string;
  pack: string;
  detail: Record<string, unknown>;
  extra?: Record<string, unknown>;
}) => ({
  externalKey,
  upstreamKey: externalKey,
  pack,
  name: externalKey,
  description: `${externalKey}.`,
  sources: [{ book: 'PZO1110', pages: '1' }],
  modifiers: [],
  unsupported: [],
  detail,
  ...extra,
});
type ReleaseBody = ReturnType<typeof releaseBody>;
const raceBody = (key: string, racialTraits: string[]) =>
  releaseBody({
    externalKey: key,
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits,
      size: 'medium',
    },
  });
const featBody = (key: string, extra: Record<string, unknown> = {}) =>
  releaseBody({
    externalKey: key,
    pack: 'feats',
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
    extra,
  });
const spellBody = (key: string) =>
  releaseBody({
    externalKey: key,
    pack: 'spells',
    detail: {
      kind: 'spell',
      levels: { wizard: 1 },
      grantedLevels: {},
      school: 'evo',
      subschools: [],
      descriptors: [],
    },
  });
const definitionRow = (body: ReleaseBody) => ({
  kind: 'definition' as const,
  key: body.externalKey,
  payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(body))),
});
const retirementRow = (body: ReleaseBody) => ({
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
/** The release: what it admits and retires; everything else stays out. */
const releaseRows = [
  definitionRow(raceBody(keys.human, [keys.humanTrait])),
  definitionRow(featBody(keys.admitted)),
  retirementRow(featBody(keys.retired)),
  definitionRow(featBody(keys.granter)),
  definitionRow(featBody(keys.preferred)),
  retirementRow(spellBody(keys.retiredSpell)),
  definitionRow(spellBody(keys.preferredSpell)),
];

const identity = (ruleIdentity: string) => ({
  name: ruleIdentity,
  ruleIdentity,
  modifiers: [],
  sources: [],
  stacksWithItself: false,
});
const raceDetail = {
  kind: 'race' as const,
  racialHitDice: 0,
  racialTraits: [],
};
const classDetail = {
  kind: 'class' as const,
  classKind: 'base' as const,
  hitDie: 8,
  bab: 'threeQuarters' as const,
  saves: { fort: 'poor' as const, ref: 'good' as const, will: 'good' as const },
  skillRanksPerLevel: 6,
  classSkills: [],
  featuresByLevel: [],
  picksByLevel: [],
};
const spellDetail = {
  kind: 'spell' as const,
  levels: { wizard: 1 },
  school: 'evocation',
};
const insert = (
  ctx: MutationCtx,
  definition: WithoutSystemFields<Doc<'catalogEntry'>>,
) => ctx.db.insert('catalogEntry', definition);

/** The stored shared definitions, by key, before any release. */
async function insertShared(ctx: MutationCtx) {
  const ids = {} as Record<Key, Id<'catalogEntry'>>;
  for (const key of ['humanTrait', 'otherTrait'] as const)
    ids[key] = await insert(ctx, {
      ...identity(keys[key]),
      scope: 'global',
      detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
    });
  ids.human = await insert(ctx, {
    ...identity(keys.human),
    scope: 'global',
    detail: { ...raceDetail, racialTraits: [ids.humanTrait] },
  });
  ids.kobold = await insert(ctx, {
    ...identity(keys.kobold),
    scope: 'global',
    detail: raceDetail,
  });
  for (const key of [
    'admitted',
    'outside',
    'retired',
    'granted',
    'preferred',
  ] as const)
    ids[key] = await insert(ctx, {
      ...identity(keys[key]),
      scope: 'global',
      detail: { kind: 'feat' },
    });
  ids.granter = await insert(ctx, {
    ...identity(keys.granter),
    scope: 'global',
    detail: { kind: 'feat' },
    grants: [{ catalogEntryId: ids.granted }],
  });
  // A Routine Option: a feat whose Modifier applies while it is switched on.
  ids.option = await insert(ctx, {
    ...identity(keys.option),
    scope: 'global',
    modifiers: [
      {
        target: 'attack',
        bonusType: 'untyped',
        value: 1,
        condition: { option: true },
      },
    ],
    detail: { kind: 'feat' },
  });
  ids.feature = await insert(ctx, {
    ...identity(keys.feature),
    scope: 'global',
    detail: { kind: 'classFeature' },
  });
  for (const key of ['kept', 'first', 'copied'] as const)
    ids[key] = await insert(ctx, {
      ...identity(keys[key]),
      scope: 'global',
      detail: classDetail,
    });
  for (const key of ['spell', 'retiredSpell', 'preferredSpell'] as const)
    ids[key] = await insert(ctx, {
      ...identity(keys[key]),
      scope: 'global',
      detail: spellDetail,
    });
  return ids;
}

type Fixture = Awaited<ReturnType<typeof releaseFixture>> & {
  ids: Record<Key, Id<'catalogEntry'>>;
  campaignId: Id<'campaign'>;
  /** Definitions a row adds before the release, by its own names. */
  own: Record<string, Id<'catalogEntry'>>;
  /** Sheet entries a row records before the release, by its own names. */
  rows: Record<string, Id<'characterSheetEntry'>>;
};

async function fixture(
  before?: (context: Fixture) => Promise<void>,
  { isReleased = true }: { isReleased?: boolean } = {},
) {
  const base = await releaseFixture(modules);
  const { t, scope } = base;
  const ids = await t.run(insertShared);
  const campaignId = await t.run(async (ctx) => {
    const character = await ctx.db.get('character', scope.characterId);
    if (!character?.campaignId) throw new Error('Missing campaign');
    return character.campaignId;
  });
  const context: Fixture = { ...base, ids, campaignId, own: {}, rows: {} };
  await before?.(context);
  if (!isReleased) return context;
  await prepare(t, releaseRows);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(await reconcile(t, scope.characterId)),
  );
  return context;
}

async function readSheet({ owner, scope }: Fixture) {
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!sheet) throw new Error('Missing sheet');
  return sheet;
}

/**
 * How the public read's catalog choices show a Catalog Entry to this
 * Character. They leave Spells to the Spell browser, so a Spell reads
 * unlisted here.
 */
async function readOf(context: Fixture, reference: Reference) {
  const sheet = await readSheet(context);
  const listed = (sheet.catalogView?.definitions ?? []).some(
    (row) => row._id === reference.id,
  );
  if (!listed) return 'unlisted';
  return (sheet.catalogView?.heldDefinitionIds ?? []).includes(reference.id)
    ? 'held'
    : 'offered';
}

async function outcomeOf(save: Promise<unknown>) {
  try {
    await save;
    return 'saves';
  } catch (error) {
    const message = String(error);
    if (message.includes(refusal)) return 'refused';
    if (message.includes(retiredRefusal)) return 'refused as retired';
    return message;
  }
}

type Reference = { id: Id<'catalogEntry'> };
type Row = {
  name: string;
  /** Pre-release history. */
  before?: (context: Fixture) => Promise<void>;
  /** The reference the save writes, and how the read's listing shows it. */
  reference: (context: Fixture) => Reference;
  read: 'offered' | 'held' | 'unlisted';
  /** Whether the sheet already references it before the save. */
  onSheet?: true;
  save: (context: Fixture) => Promise<unknown>;
  expected: 'saves' | 'refused' | 'refused as retired';
  /** What the saved sheet then stores, where the row's name claims it. */
  stores?: (context: Fixture) => Partial<Doc<'characterSheetEntry'>>;
};

const selectEntry = (
  { owner, scope }: Fixture,
  catalogEntryId: Id<'catalogEntry'>,
  extra: { choice?: string | null } = {},
) =>
  owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId,
    ...extra,
    operationId: `select-${catalogEntryId}-${extra.choice ?? ''}`,
  });
const editSelection = (
  { owner, scope }: Fixture,
  entryId: Id<'characterSheetEntry'>,
  changes: {
    catalogEntryId?: Id<'catalogEntry'>;
    choice?: string | null;
    notes?: string;
  },
) =>
  owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    ...changes,
    operationId: `edit-${entryId}-${JSON.stringify(changes)}`,
  });
const firstLevel = async (context: Fixture) => {
  const level = (await readSheet(context)).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!level) throw new Error('Missing Class Level');
  return level._id;
};
const needRow = (context: Fixture, name: string) => {
  const id = context.rows[name];
  if (!id) throw new Error(`Missing row ${name}`);
  return id;
};
const needOwn = (context: Fixture, name: string) => {
  const id = context.own[name];
  if (!id) throw new Error(`Missing definition ${name}`);
  return id;
};
/** The Character's own Catalog Copy of a shared definition, as it is stored. */
const characterCopy = (context: Fixture, key: Key) =>
  context.t.run(async (ctx) => {
    const original = await ctx.db.get('catalogEntry', context.ids[key]);
    if (!original) throw new Error(`Missing ${key}`);
    const { _id, _creationTime, ...body } = original;
    return insert(ctx, {
      ...body,
      scope: 'character',
      characterId: context.scope.characterId,
      copiedFrom: _id,
    });
  });

/** The Character as the shared race, with a statistics copy on its row. */
async function statisticsCopyOf(context: Fixture, key: 'kobold') {
  await context.owner.mutation(api.characterSheet.selectRace, {
    ...context.scope,
    catalogEntryId: context.ids[key],
    operationId: `race-${key}`,
  });
  const race = (await readSheet(context)).entries.find(
    (entry) => entry.kind === 'race' && entry.active,
  );
  if (!race) throw new Error('Missing race row');
  context.rows.race = race._id;
  await context.owner.mutation(api.characterSheet.editRaceStatistics, {
    ...context.scope,
    entryId: race._id,
    racialHitDice: 2,
    operationId: 'statistics',
  });
}
const discard = (context: Fixture) =>
  context.owner.mutation(api.characterSheet.discardRaceStatistics, {
    ...context.scope,
    entryId: needRow(context, 'race'),
    operationId: 'discard',
  });
/** The Character's own alternate racial trait, selected. */
async function ownAlternateTrait(context: Fixture) {
  const trait = await context.t.run((ctx) =>
    insert(ctx, {
      ...identity('swrc/alternate-own'),
      scope: 'character',
      characterId: context.scope.characterId,
      detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
    }),
  );
  return selectEntry(context, trait);
}

const rows: Row[] = [
  {
    name: 'selecting an admitted shared feat',
    reference: ({ ids }) => ({ id: ids.admitted }),
    read: 'offered',
    save: (context) => selectEntry(context, context.ids.admitted),
    expected: 'saves',
  },
  {
    name: 'selecting a shared feat the release omits',
    reference: ({ ids }) => ({ id: ids.outside }),
    read: 'unlisted',
    save: (context) => selectEntry(context, context.ids.outside),
    expected: 'refused',
  },
  {
    name: 'selecting a retired feat, refused as today',
    reference: ({ ids }) => ({ id: ids.retired }),
    read: 'held',
    save: (context) => selectEntry(context, context.ids.retired),
    expected: 'refused as retired',
  },
  {
    name: 'a Selection switched to the original a preferred copy replaces',
    before: async (context) => {
      await context.t.run((ctx) =>
        insert(ctx, {
          ...identity(keys.preferred),
          scope: 'campaign',
          campaignId: context.campaignId,
          copiedFrom: context.ids.preferred,
          campaignPreference: true,
          detail: { kind: 'feat' },
        }),
      );
      context.rows.feat = await selectEntry(context, context.ids.admitted);
    },
    reference: ({ ids }) => ({ id: ids.preferred }),
    read: 'unlisted',
    save: (context) =>
      editSelection(context, needRow(context, 'feat'), {
        catalogEntryId: context.ids.preferred,
      }),
    expected: 'refused',
  },
  {
    name: 'a notes edit of a Selection the release omits',
    before: async (context) => {
      context.rows.feat = await selectEntry(context, context.ids.outside);
    },
    reference: ({ ids }) => ({ id: ids.outside }),
    onSheet: true,
    read: 'unlisted',
    save: (context) =>
      editSelection(context, needRow(context, 'feat'), { notes: 'Kept' }),
    expected: 'saves',
  },
  {
    name: 'a slot refilled with the Selection the release omits',
    before: async ({ owner, scope, ids }) => {
      await owner.mutation(api.characterSheet.fillSelectionSlot, {
        ...scope,
        slotId: 'feat:general',
        position: 0,
        catalogEntryId: ids.outside,
        operationId: 'slot-before',
      });
    },
    reference: ({ ids }) => ({ id: ids.outside }),
    onSheet: true,
    read: 'unlisted',
    save: ({ owner, scope, ids }) =>
      owner.mutation(api.characterSheet.fillSelectionSlot, {
        ...scope,
        slotId: 'feat:general',
        position: 0,
        catalogEntryId: ids.outside,
        notes: 'Refilled',
        operationId: 'slot-refill',
      }),
    expected: 'saves',
  },
  {
    name: 'a race row repointed from its copy to the omitted original',
    before: async (context) => {
      context.own.kobold = await characterCopy(context, 'kobold');
      await context.owner.mutation(api.characterSheet.selectRace, {
        ...context.scope,
        catalogEntryId: context.own.kobold,
        operationId: 'copy-race',
      });
    },
    reference: ({ ids }) => ({ id: ids.kobold }),
    read: 'unlisted',
    save: ({ owner, scope, ids }) =>
      owner.mutation(api.characterSheet.selectRace, {
        ...scope,
        catalogEntryId: ids.kobold,
        operationId: 'repoint',
      }),
    expected: 'refused',
  },
  {
    name: 'another level of a class the release omits, already on the sheet',
    before: async (context) => {
      await context.owner.mutation(api.characterSheet.editClassLevel, {
        ...context.scope,
        entryId: await firstLevel(context),
        classEntryId: context.ids.kept,
        operationId: 'kept-1',
      });
    },
    reference: ({ ids }) => ({ id: ids.kept }),
    onSheet: true,
    read: 'unlisted',
    save: ({ owner, scope, ids }) =>
      owner.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        classEntryId: ids.kept,
        operationId: 'kept-2',
      }),
    expected: 'saves',
  },
  {
    name: 'Insert Level beside levels of a class the release omits',
    before: async (context) => {
      await context.owner.mutation(api.characterSheet.editClassLevel, {
        ...context.scope,
        entryId: await firstLevel(context),
        classEntryId: context.ids.kept,
        operationId: 'kept-1',
      });
    },
    reference: ({ ids }) => ({ id: ids.kept }),
    onSheet: true,
    read: 'unlisted',
    save: async ({ owner, scope, ids }) => {
      const inserted = await owner.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        position: 1,
        operationId: 'insert-level',
      });
      await owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: inserted,
        classEntryId: ids.kept,
        operationId: 'insert-level-class',
      });
    },
    expected: 'saves',
  },
  {
    name: 'a first level of a class the release omits',
    reference: ({ ids }) => ({ id: ids.first }),
    read: 'unlisted',
    save: ({ owner, scope, ids }) =>
      owner.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        classEntryId: ids.first,
        operationId: 'first-1',
      }),
    expected: 'refused',
  },
  {
    name: 'a class version switch that rewrites its sibling levels to the omitted original',
    before: async (context) => {
      context.own.copy = await characterCopy(context, 'copied');
      const level = await firstLevel(context);
      context.rows.level = level;
      await context.owner.mutation(api.characterSheet.editClassLevel, {
        ...context.scope,
        entryId: level,
        classEntryId: context.own.copy,
        operationId: 'copy-1',
      });
      await context.owner.mutation(api.characterSheet.addClassLevel, {
        ...context.scope,
        classEntryId: context.own.copy,
        operationId: 'copy-2',
      });
    },
    reference: ({ ids }) => ({ id: ids.copied }),
    read: 'unlisted',
    save: (context) =>
      context.owner.mutation(api.characterSheet.switchClassVersion, {
        ...context.scope,
        entryId: needRow(context, 'level'),
        classEntryId: context.ids.copied,
        operationId: 'switch-original',
      }),
    expected: 'refused',
  },
  {
    name: 'a casting advance whose prefilled sibling names a class the release omits, already on the sheet',
    before: async (context) => {
      const sheet = await readSheet(context);
      const seeded = (ruleIdentity: string) => {
        const found = sheet.catalogEntries.find(
          (row) => row.ruleIdentity === ruleIdentity,
        );
        if (!found) throw new Error(`Missing ${ruleIdentity}`);
        return found._id;
      };
      // The divine class as a shared definition the release will omit.
      context.own.cleric = seeded('cleric');
      context.own.wizard = seeded('wizard');
      await context.t.run((ctx) =>
        ctx.db.patch('catalogEntry', needOwn(context, 'cleric'), {
          scope: 'global',
          characterId: undefined,
        }),
      );
      const classes = [
        'wizard',
        'wizard',
        'wizard',
        'cleric',
        'cleric',
        'cleric',
        'mystic-theurge',
      ];
      for (const [index, ruleIdentity] of classes.entries()) {
        const classEntryId =
          ruleIdentity === 'cleric'
            ? needOwn(context, 'cleric')
            : seeded(ruleIdentity);
        if (index === 0)
          await context.owner.mutation(api.characterSheet.editClassLevel, {
            ...context.scope,
            entryId: await firstLevel(context),
            classEntryId,
            operationId: `level-${index}`,
          });
        else
          context.rows.theurge = await context.owner.mutation(
            api.characterSheet.addClassLevel,
            { ...context.scope, classEntryId, operationId: `level-${index}` },
          );
      }
    },
    reference: (context) => ({ id: needOwn(context, 'cleric') }),
    onSheet: true,
    read: 'unlisted',
    save: (context) =>
      context.owner.mutation(api.characterSheet.assignCastingAdvance, {
        ...context.scope,
        entryId: needRow(context, 'theurge'),
        index: 0,
        classEntryId: needOwn(context, 'wizard'),
        operationId: 'theurge-arcane',
      }),
    expected: 'saves',
    stores: (context) => ({
      _id: needRow(context, 'theurge'),
      state: expect.objectContaining({
        castingAdvances: [
          { classEntryId: needOwn(context, 'wizard') },
          { classEntryId: needOwn(context, 'cleric') },
        ],
      }),
    }),
  },
  {
    name: 'a Grant of a feat the release omits recorded by a notes edit',
    before: async (context) => {
      await selectEntry(context, context.ids.granter);
    },
    reference: ({ ids }) => ({ id: ids.granted }),
    onSheet: true,
    read: 'unlisted',
    save: async (context) =>
      context.owner.mutation(api.characterSheet.editGrantState, {
        ...context.scope,
        grantKey: await grantKeyOf(context, context.ids.granted),
        state: { notes: 'Recorded' },
        operationId: 'grant-notes',
      }),
    expected: 'saves',
  },
  {
    name: "a Grant's copy changed to the Character's own copy",
    before: async (context) => {
      await selectEntry(context, context.ids.granter);
      context.own.granted = await characterCopy(context, 'granted');
    },
    reference: (context) => ({ id: needOwn(context, 'granted') }),
    read: 'offered',
    save: async (context) =>
      context.owner.mutation(api.characterSheet.editGrantState, {
        ...context.scope,
        grantKey: await grantKeyOf(context, context.ids.granted),
        state: { catalogEntryId: needOwn(context, 'granted') },
        operationId: 'grant-copy',
      }),
    expected: 'saves',
    stores: (context) => ({ catalogEntryId: needOwn(context, 'granted') }),
  },
  {
    name: 'the statistics discard restoring an omitted original another race row still references',
    before: async (context) => {
      await statisticsCopyOf(context, 'kobold');
      // An inactive race row of the same original.
      await context.t.run((ctx) =>
        ctx.db.insert('characterSheetEntry', {
          characterId: context.scope.characterId,
          kind: 'race',
          active: false,
          catalogEntryId: context.ids.kobold,
          state: { kind: 'race' },
        }),
      );
    },
    reference: ({ ids }) => ({ id: ids.kobold }),
    onSheet: true,
    read: 'unlisted',
    save: (context) => discard(context),
    expected: 'saves',
    stores: (context) => ({
      _id: needRow(context, 'race'),
      catalogEntryId: context.ids.kobold,
    }),
  },
  {
    name: 'the statistics discard restoring an omitted original new to the sheet',
    before: (context) => statisticsCopyOf(context, 'kobold'),
    reference: ({ ids }) => ({ id: ids.kobold }),
    read: 'unlisted',
    save: (context) => discard(context),
    expected: 'refused',
  },
  {
    name: 'a Routine Option the release omits, switched on with no Selection',
    reference: ({ ids }) => ({ id: ids.option }),
    read: 'unlisted',
    save: ({ owner, scope, ids }) =>
      owner.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: 'unarmed',
        options: [ids.option],
        operationId: 'routine-option',
      }),
    expected: 'refused',
  },
  {
    name: "another level of an omitted casting class a recorded Spell still names, after the class's last level left",
    before: async (context) => {
      const sheet = await readSheet(context);
      const wizard = sheet.catalogEntries.find(
        (row) => row.ruleIdentity === 'wizard',
      );
      if (!wizard) throw new Error('Missing wizard');
      context.own.wizard = wizard._id;
      // The casting class as a shared definition the release will omit.
      await context.t.run((ctx) =>
        ctx.db.patch('catalogEntry', wizard._id, {
          scope: 'global',
          characterId: undefined,
        }),
      );
      const level = await firstLevel(context);
      await context.owner.mutation(api.characterSheet.editClassLevel, {
        ...context.scope,
        entryId: level,
        classEntryId: wizard._id,
        operationId: 'wizard-1',
      });
      const spell = (await readSheet(context)).catalogEntries.find(
        (row) =>
          row.detail.kind === 'spell' &&
          'levels' in row.detail &&
          row.detail.levels?.wizard === 1,
      );
      if (!spell) throw new Error('Missing wizard Spell');
      await context.owner.mutation(api.characterSheetSpells.record, {
        ...context.scope,
        castingClassId: wizard._id,
        catalogEntryId: spell._id,
        operationId: 'record',
      });
      await context.owner.mutation(api.characterSheet.deleteClassLevel, {
        ...context.scope,
        entryId: level,
        operationId: 'delete-wizard',
      });
    },
    reference: (context) => ({ id: needOwn(context, 'wizard') }),
    onSheet: true,
    read: 'unlisted',
    save: (context) =>
      context.owner.mutation(api.characterSheet.addClassLevel, {
        ...context.scope,
        classEntryId: needOwn(context, 'wizard'),
        operationId: 'wizard-again',
      }),
    expected: 'saves',
  },
  {
    name: 'an alternate racial trait replacing a standard trait its race grants',
    before: async (context) => {
      await context.owner.mutation(api.characterSheet.selectRace, {
        ...context.scope,
        catalogEntryId: context.ids.human,
        operationId: 'human',
      });
      context.rows.trait = await ownAlternateTrait(context);
    },
    reference: ({ ids }) => ({ id: ids.humanTrait }),
    onSheet: true,
    read: 'unlisted',
    save: (context) =>
      context.owner.mutation(api.characterSheet.setRacialTraitReplacements, {
        ...context.scope,
        entryId: needRow(context, 'trait'),
        replaces: [context.ids.humanTrait],
        operationId: 'replace-granted',
      }),
    expected: 'saves',
  },
  {
    name: 'an alternate racial trait replacing a trait the release omits, new to the sheet',
    before: async (context) => {
      context.rows.trait = await ownAlternateTrait(context);
    },
    reference: ({ ids }) => ({ id: ids.otherTrait }),
    read: 'unlisted',
    save: (context) =>
      context.owner.mutation(api.characterSheet.setRacialTraitReplacements, {
        ...context.scope,
        entryId: needRow(context, 'trait'),
        replaces: [context.ids.otherTrait],
        operationId: 'replace-outside',
      }),
    expected: 'refused',
  },
  {
    name: 'an Archetype replacing a class feature the release omits, new to the sheet',
    before: async (context) => {
      await context.owner.mutation(api.characterSheet.editClassLevel, {
        ...context.scope,
        entryId: await firstLevel(context),
        classEntryId: context.ids.kept,
        operationId: 'kept-1',
      });
      context.own.archetype = await context.t.run((ctx) =>
        insert(ctx, {
          ...identity('swrc/archetype-own'),
          scope: 'character',
          characterId: context.scope.characterId,
          detail: {
            kind: 'archetype',
            classEntryIds: [context.ids.kept],
            replaces: [],
            adds: [],
          },
        }),
      );
      await context.owner.mutation(api.characterSheet.setArchetypeSelected, {
        ...context.scope,
        classEntryId: context.ids.kept,
        catalogEntryId: needOwn(context, 'archetype'),
        selected: true,
        operationId: 'archetype',
      });
      const row = (await readSheet(context)).entries.find(
        (entry) => entry.kind === 'archetype',
      );
      if (!row) throw new Error('Missing Archetype row');
      context.rows.archetype = row._id;
    },
    reference: ({ ids }) => ({ id: ids.feature }),
    read: 'unlisted',
    save: (context) =>
      context.owner.mutation(api.characterSheet.setArchetypePartChoices, {
        ...context.scope,
        entryId: needRow(context, 'archetype'),
        replacementChoices: [
          { classLevel: 1, catalogEntryId: context.ids.feature },
        ],
        operationId: 'archetype-replaces',
      }),
    expected: 'refused',
  },
  {
    name: "a Grant's copy changed to the Character's own copy with its choice cleared",
    before: async (context) => {
      await selectEntry(context, context.ids.granter);
      context.own.granted = await characterCopy(context, 'granted');
      // The Grant's saved choice, which the save clears.
      await context.owner.mutation(api.characterSheet.editGrantState, {
        ...context.scope,
        grantKey: await grantKeyOf(context, context.ids.granted),
        state: { choice: 'Seeded' },
        operationId: 'grant-choice',
      });
    },
    reference: (context) => ({ id: needOwn(context, 'granted') }),
    read: 'offered',
    save: async (context) =>
      context.owner.mutation(api.characterSheet.editGrantState, {
        ...context.scope,
        grantKey: await grantKeyOf(context, context.ids.granted),
        state: { catalogEntryId: needOwn(context, 'granted'), choice: null },
        operationId: 'grant-copy-clear',
      }),
    expected: 'saves',
    stores: (context) => ({
      catalogEntryId: needOwn(context, 'granted'),
      state: expect.objectContaining({ choice: null }),
    }),
  },
  {
    name: "a Spell Selection edited to a Spell original the campaign's preferred copy hides",
    before: async (context) => {
      await context.t.run((ctx) =>
        insert(ctx, {
          ...identity(keys.preferredSpell),
          scope: 'campaign',
          campaignId: context.campaignId,
          copiedFrom: context.ids.preferredSpell,
          campaignPreference: true,
          detail: spellDetail,
        }),
      );
      context.rows.spell = await selectEntry(context, context.ids.spell);
    },
    reference: ({ ids }) => ({ id: ids.preferredSpell }),
    read: 'unlisted',
    save: (context) =>
      editSelection(context, needRow(context, 'spell'), {
        catalogEntryId: context.ids.preferredSpell,
      }),
    expected: 'saves',
    stores: (context) => ({
      _id: needRow(context, 'spell'),
      catalogEntryId: context.ids.preferredSpell,
    }),
  },
  {
    name: 'a Routine Option held only by an older removed routine, which the write purges first, reused',
    before: async (context) => {
      const routine = (options: Id<'catalogEntry'>[], name: string) =>
        context.owner.mutation(api.characterSheet.createAttackRoutine, {
          ...context.scope,
          weaponEntryId: 'unarmed',
          options,
          operationId: `routine-${name}`,
        });
      const remove = (entryId: Id<'characterSheetEntry'>, name: string) =>
        context.owner.mutation(api.characterSheet.deleteAttackRoutine, {
          ...context.scope,
          entryId,
          operationId: `remove-${name}`,
        });
      const older = await routine([context.ids.option], 'older');
      await remove(older, 'older');
      // A historical sheet keeps a second, newer removed routine (deleting
      // one now purges the older ones at once).
      await context.t.run(async (ctx) => {
        const row = await ctx.db.get('characterSheetEntry', older);
        if (row?.kind !== 'attackRoutine') throw new Error('Missing routine');
        const { _id, _creationTime, ...body } = row;
        await ctx.db.insert('characterSheetEntry', {
          ...body,
          state: { ...body.state, name: 'Newer', options: [] },
        });
      });
    },
    reference: ({ ids }) => ({ id: ids.option }),
    onSheet: true,
    read: 'unlisted',
    save: ({ owner, scope, ids }) =>
      owner.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: 'unarmed',
        options: [ids.option],
        operationId: 'routine-reuse',
      }),
    expected: 'saves',
  },
  {
    name: 'a shared Spell the release omits on the generic Selection path',
    reference: ({ ids }) => ({ id: ids.spell }),
    read: 'unlisted',
    save: (context) => selectEntry(context, context.ids.spell),
    expected: 'saves',
  },
  {
    name: 'a retired Spell on the generic Selection path, refused as today',
    reference: ({ ids }) => ({ id: ids.retiredSpell }),
    read: 'unlisted',
    save: (context) => selectEntry(context, context.ids.retiredSpell),
    expected: 'refused as retired',
  },
];

async function grantKeyOf(
  context: Fixture,
  catalogEntryId: Id<'catalogEntry'>,
) {
  const row = (await readSheet(context)).calculated.resolvedEntries.find(
    ({ entry, origin }) =>
      origin === 'grant' &&
      'catalogEntryId' in entry &&
      entry.catalogEntryId === catalogEntryId,
  );
  if (!row || !('grantKey' in row.entry) || !row.entry.grantKey)
    throw new Error('Missing Grant');
  return row.entry.grantKey;
}

/**
 * Whether the sheet references this entry before the save, by the stored
 * rows and the Grants the read resolves, as `listSheetReferences` reads them.
 */
async function isOnSheet(context: Fixture, reference: Reference) {
  const stored = await context.t.run((ctx) =>
    ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) =>
        q.eq('characterId', context.scope.characterId),
      )
      .collect(),
  );
  const { calculated } = await readSheet(context);
  return listSheetReferences(stored, calculated.resolvedEntries).includes(
    `catalog:${reference.id}`,
  );
}

afterEach(() => {
  staleRows.mismatches.length = 0;
});

test.each(rows)('$name', async (row) => {
  const context = await fixture(row.before);
  const reference = row.reference(context);
  const onSheet = await isOnSheet(context, reference);
  const read = await readOf(context, reference);
  const checkedBefore = staleRows.checked;
  const outcome = await outcomeOf(row.save(context));
  expect({ onSheet, read, outcome }).toEqual({
    onSheet: row.onSheet ?? false,
    read: row.read,
    outcome: row.expected,
  });
  if (row.stores)
    expect((await readSheet(context)).entries).toContainEqual(
      expect.objectContaining(row.stores(context)),
    );
  if (outcome === 'saves')
    expect(staleRows.checked).toBeGreaterThan(checkedBefore);
  expect(staleRows.mismatches).toEqual([]);
});

test('a sheet holding references the release omits loads, calculates and saves unrelated edits', async () => {
  const context = await fixture(async (context) => {
    context.rows.feat = await selectEntry(context, context.ids.outside);
    await context.owner.mutation(api.characterSheet.selectRace, {
      ...context.scope,
      catalogEntryId: context.ids.kobold,
      operationId: 'kobold',
    });
  });
  const before = await readSheet(context);
  expect(before.entries).toContainEqual(
    expect.objectContaining({ catalogEntryId: context.ids.outside }),
  );
  await context.owner.mutation(api.characterSheet.editBaseScores, {
    ...context.scope,
    scores: {
      strength: 12,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'scores',
  });
  const after = await readSheet(context);
  expect(after.calculated.abilities.strength.score).toBe(12);
  expect(after.entries.filter((entry) => entry.kind !== 'base')).toEqual(
    before.entries.filter((entry) => entry.kind !== 'base'),
  );
  expect(staleRows.mismatches).toEqual([]);
});

test("a one-off's own new definition is new to the sheet at the end of the write, measured against the sheet before it", async () => {
  const context = await fixture();
  checks.length = 0;
  const entryId = await context.owner.mutation(api.catalogCopies.createOneOff, {
    ...context.scope,
    definition: {
      name: 'One-off feat',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    },
    operationId: 'one-off',
  });
  const entry = (await readSheet(context)).entries.find(
    (row) => row._id === entryId,
  );
  if (!entry || !('catalogEntryId' in entry))
    throw new Error('Missing one-off');
  expect(checks.map(({ added }) => added)).toEqual([
    [`catalog:${entry.catalogEntryId}`],
  ]);
  expect(staleRows.mismatches).toEqual([]);
});

/** The end-of-write checks one mutation made: how many, and their reads. */
async function measured(save: () => Promise<unknown>) {
  checks.length = 0;
  await save();
  return checks.map(({ added, reads }) => ({ added: added.length, reads }));
}

test("the release-reference check's reads: with no release selected it does not run; with one, none for an unchanged write and a counted few for one new reference", async () => {
  const plain = await fixture(undefined, { isReleased: false });
  const { ids } = plain;
  const scores = (context: Fixture, strength: number) => () =>
    context.owner.mutation(api.characterSheet.editBaseScores, {
      ...context.scope,
      scores: {
        strength,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      operationId: `scores-${strength}`,
    });
  // No release: the writable load still stamps its before-set, but the
  // step's compatibility read finds no release, so the step does not run
  // the check, for an addition, an unchanged write and the statistics
  // discard.
  expect({
    addition: await measured(() => selectEntry(plain, ids.outside)),
    unchanged: await measured(scores(plain, 12)),
    discard: await measured(async () => {
      await statisticsCopyOf(plain, 'kobold');
      checks.length = 0;
      await discard(plain);
    }),
  }).toEqual({ addition: [], unchanged: [], discard: [] });
  const context = await fixture();
  expect({
    unchanged: await measured(scores(context, 12)),
    oneAdmitted: await measured(() =>
      selectEntry(context, context.ids.admitted),
    ),
  }).toEqual({
    unchanged: [{ added: 0, reads: 0 }],
    // The selected boundary (with the fixture-only activation's authority),
    // the stored row, its release row and retirement report, and the
    // campaign's preferred-copy lookup.
    oneAdmitted: [{ added: 1, reads: 9 }],
  });
});

/**
 * A union member's branch in a path: its index in the union, `#<index>`,
 * after its literal discriminant field (`kind` first) as `name=value` when
 * it has one, for reading.
 */
function branchOf(member: unknown, index: number) {
  const fields: unknown =
    member &&
    typeof member === 'object' &&
    Reflect.get(member, 'kind') === 'object'
      ? Reflect.get(member, 'fields')
      : undefined;
  const literals = Object.entries(fields ?? {}).filter(
    ([, field]) => field && Reflect.get(field, 'kind') === 'literal',
  );
  const [name, field] =
    literals.find(([key]) => key === 'kind') ?? literals[0] ?? [];
  return name
    ? `${name}=${String(Reflect.get(field, 'value'))}#${index}`
    : `#${index}`;
}

/**
 * A validator's nested validators, each with its path; a union member's
 * path carries its branch (`|` and `branchOf`).
 */
function nestedValidators(
  validator: object,
  path: string,
): [unknown, string][] {
  const read = (key: string): unknown => Reflect.get(validator, key);
  const kind = read('kind');
  if (kind === 'object')
    return Object.entries(read('fields') ?? {}).map(([key, field]) => [
      field,
      path ? `${path}.${key}` : key,
    ]);
  if (kind === 'array') return [[read('element'), `${path}[]`]];
  if (kind === 'record')
    return [
      [read('key'), `${path}{key}`],
      [read('value'), `${path}{}`],
    ];
  if (kind === 'union') {
    const members = [read('members')].flat();
    const labels = members.map((member, index) => branchOf(member, index));
    if (new Set(labels).size !== labels.length)
      throw new Error(`Union branches at ${path} share a label`);
    return members.map((member, index) => [member, `${path}|${labels[index]}`]);
  }
  return [];
}

/** A branch-qualified path as the extractor reads it: no `|` branches. */
const unqualified = (field: string) => field.replace(/\|[^.[\]{}|]+/g, '');

/**
 * Visits a validator and every validator nested in it, each with its path
 * (`nestedValidators`).
 */
function walkValidators(
  validator: unknown,
  path: string,
  visit: (node: object, path: string) => void,
) {
  if (!validator || typeof validator !== 'object') return;
  visit(validator, path);
  for (const [child, childPath] of nestedValidators(validator, path))
    walkValidators(child, childPath, visit);
}

/** Visits every validator of every registered sheet entry kind. */
function walkRegistered(visit: (node: object, field: string) => void) {
  for (const member of schema.tables.characterSheetEntry.validator.members)
    walkValidators(member, '', (node, path) =>
      visit(node, `${member.fields.kind.value} ${path}`),
    );
}

/**
 * Each `v.any()` declaration the schema registers (a Zod schema converted by
 * `zodOutputToConvex`), branch-qualified, with what is stored there and
 * what validates it.
 */
const opaqueFields: Readonly<Record<string, string>> = {
  'base state.companionProgression|kind=eidolon#0.skillRanks':
    "the Eidolon's skill ranks: whole numbers by known skill, companionSkillRanksSchema (src/lib/character-sheet-companion-sources.ts:44)",
  'base state.companionProgression|kind=eidolon#0.classSkills':
    "the Eidolon's chosen class skills: skill codes checked against skillKeys (src/lib/character-sheet-eidolon-progression.ts:173)",
  'base state.companionProgression|#1.skillRanks':
    "the animal companion's skill ranks: companionSkillRanksSchema (src/lib/character-sheet-companion-sources.ts:44)",
};

/**
 * Each Catalog Entry ID field the schema registers, branch-qualified as the
 * walk finds it; each falls under the `sheetReferenceFields` or
 * `notReferenceFields` entry its unqualified path names.
 */
const qualifiedIdFields: readonly string[] = [
  'archetype catalogEntryId',
  'archetype state.classEntryId',
  'archetype state.replaces[].catalogEntryId',
  'attackRoutine state.options[]',
  'base catalogEntryId',
  'base state.favoredClassIds[]',
  'classFeature catalogEntryId',
  'classLevel state.castingAdvances[]|#0.classEntryId|#0',
  'classLevel state.classEntryId|#0',
  'condition catalogEntryId',
  'feat catalogEntryId',
  'item catalogEntryId',
  'item state.abilities[].catalogEntryId',
  'item state.bash.abilities[].catalogEntryId',
  'item state.otherEnd.abilities[].catalogEntryId',
  'manual catalogEntryId',
  'race catalogEntryId',
  'racialTrait catalogEntryId',
  'racialTrait state.replaces[]',
  'spell catalogEntryId',
  'spell state.castingClassId',
  'spellEffect catalogEntryId',
  'trait catalogEntryId',
];

/**
 * The known-shapes pass: throws on the first validator anywhere in the
 * registered sheet entry validator (every union member, field, key and
 * element) whose kind has no case in `sampleCases`, except an
 * `opaqueFields` declaration, and returns every opaque declaration it met.
 */
function requireKnownShapes() {
  const opaque: string[] = [];
  walkRegistered((node, field) => {
    const kind = String(Reflect.get(node, 'kind'));
    if (Object.hasOwn(sampleCases, kind)) return;
    if (kind === 'any' && field in opaqueFields) opaque.push(field);
    else throw new Error(`The reading probe does not know ${field}: ${kind}`);
  });
  return opaque.sort();
}

/**
 * Every `v.id('catalogEntry')` field of a stored sheet row, at any depth,
 * from the validator the schema registers on the `characterSheetEntry`
 * table, as branch-qualified `<kind> <path>`, one per occurrence.
 */
function catalogIdFields() {
  const fields: string[] = [];
  walkRegistered((node, field) => {
    if (
      Reflect.get(node, 'kind') === 'id' &&
      Reflect.get(node, 'tableName') === 'catalogEntry'
    )
      fields.push(field);
  });
  return fields.sort();
}

test('every Catalog Entry ID field of a stored sheet row is a reference the check reads or is listed as not one', () => {
  // Every occurrence, branch-qualified, is declared exactly once.
  expect(catalogIdFields()).toEqual([...qualifiedIdFields].sort());
  const listed = [...sheetReferenceFields, ...Object.keys(notReferenceFields)];
  expect(
    qualifiedIdFields.filter((field) => !listed.includes(unqualified(field))),
  ).toEqual([]);
  // Both lists name only real fields.
  expect(
    listed.filter(
      (field) =>
        !qualifiedIdFields.some(
          (qualified) => unqualified(qualified) === field,
        ),
    ),
  ).toEqual([]);
});

/** One step of a registered path: a field, an array item, a record value or key. */
type PathStep =
  | { kind: 'field'; name: string }
  | { kind: 'item' }
  | { kind: 'recordValue' }
  | { kind: 'recordKey' };

function parsePath(path: string): PathStep[] {
  return path.split('.').flatMap((segment): PathStep[] => {
    const [name = '', ...shapes] = segment.split(/(?=\[\]|\{\}|\{key\})/);
    return [
      { kind: 'field', name },
      ...shapes.map((shape): PathStep => {
        if (shape === '[]') return { kind: 'item' };
        if (shape === '{}') return { kind: 'recordValue' };
        if (shape === '{key}') return { kind: 'recordKey' };
        throw new Error(`Unknown path shape ${shape} in ${path}`);
      }),
    ];
  });
}

/**
 * A probe: one run's random token, the record keys and array lengths it
 * drew, and a counter that keeps every ID and key in the sample distinct.
 */
type Probe = {
  token: string;
  count: number;
  keys: string[];
  lengths: number[];
};
function draw(probe: Probe, label: 'id' | 'key') {
  probe.count += 1;
  return `${probe.token}-${label}-${probe.count}`;
}
/** A length from 4 to 7, recorded for a failing run's message. */
function drawLength(probe: Probe) {
  const length = 4 + Math.floor(Math.random() * 4);
  probe.lengths.push(length);
  return length;
}

type Sample = { value: unknown; ids: string[] };
/** A validator that does not carry the path: a union tries its next member. */
class NotOnPath extends Error {}
type SampleCase = (
  read: (key: string) => unknown,
  steps: readonly PathStep[],
  probe: Probe,
) => Sample;

/** Samples drawn `drawLength` times, joined into one value by `join`. */
function repeat(
  probe: Probe,
  sample: () => Sample,
  join: (values: unknown[]) => unknown,
): Sample {
  const items = Array.from({ length: drawLength(probe) }, sample);
  return {
    value: join(items.map(({ value }) => value)),
    ids: items.flatMap(({ ids }) => ids),
  };
}

/** Validator kinds that hold no Catalog Entry ID below them. */
const leafKinds = [
  'string',
  'float64',
  'int64',
  'boolean',
  'literal',
  'null',
  'bytes',
];

const sampleCases: Record<string, SampleCase> = {
  id: (_, [step], probe) => {
    if (step) throw new NotOnPath('A path continues past an ID');
    const id = draw(probe, 'id');
    return { value: id, ids: [id] };
  },
  object: (read, [step, ...rest], probe) => {
    if (step?.kind !== 'field') throw new NotOnPath('An object needs a field');
    const field: unknown = Reflect.get(read('fields') ?? {}, step.name);
    if (!field) throw new NotOnPath(`No field ${step.name}`);
    const inner = sampleAlong(field, rest, probe);
    return { value: { [step.name]: inner.value }, ids: inner.ids };
  },
  array: (read, [step, ...rest], probe) => {
    if (step?.kind !== 'item') throw new NotOnPath('An array needs an item');
    return repeat(
      probe,
      () => sampleAlong(read('element'), rest, probe),
      (values) => values,
    );
  },
  record: (read, [step, ...rest], probe) => {
    if (step?.kind === 'recordKey') {
      const keys = repeat(
        probe,
        () => sampleAlong(read('key'), rest, probe),
        (values) => values,
      );
      // ID-valued keys are generated keys too (no registered path has one yet).
      probe.keys.push(...keys.ids);
      return {
        value: Object.fromEntries(keys.ids.map((id) => [id, true])),
        ids: keys.ids,
      };
    }
    if (step?.kind !== 'recordValue')
      throw new NotOnPath('A record needs a value or key step');
    const keys: string[] = [];
    return repeat(
      probe,
      () => {
        const key = draw(probe, 'key');
        keys.push(key);
        probe.keys.push(key);
        return sampleAlong(read('value'), rest, probe);
      },
      (values) =>
        Object.fromEntries(values.map((value, index) => [keys[index], value])),
    );
  },
  ...Object.fromEntries(
    leafKinds.map((kind): [string, SampleCase] => [
      kind,
      () => {
        throw new NotOnPath(`A ${kind} holds no ID`);
      },
    ]),
  ),
  union: (read, steps, probe) => {
    // The first member that carries the path; any other error propagates.
    for (const member of [read('members')].flat())
      try {
        return sampleAlong(member, steps, probe);
      } catch (error) {
        if (!(error instanceof NotOnPath)) throw error;
      }
    throw new NotOnPath('No union member carries the path');
  },
};

/**
 * A minimal partial row along `steps`, shaped by the registered `validator`
 * and holding fresh IDs at the end of the path, with the IDs it holds; it
 * has no other field, so the validator would not accept it as a document.
 * Each validator kind has a case in `sampleCases`, a leaf (`leafKinds`)
 * ending no ID path; an `opaqueFields` declaration has none and holds no ID;
 * an optional field is the same validator marked optional in Convex.
 */
function sampleAlong(
  validator: unknown,
  steps: readonly PathStep[],
  probe: Probe,
): Sample {
  if (!validator || typeof validator !== 'object')
    throw new Error('Not a validator');
  const read = (key: string): unknown => Reflect.get(validator, key);
  const kind = String(read('kind'));
  const sampleCase = Object.hasOwn(sampleCases, kind)
    ? sampleCases[kind]
    : undefined;
  // The known-shapes pass allows no kind without a case but the opaque
  // declarations, which hold no ID.
  if (!sampleCase) throw new NotOnPath(`A ${kind} holds no ID`);
  return sampleCase(read, steps, probe);
}

/** Every object field name the registered sheet entry validator declares. */
function declaredFieldNames() {
  const names = new Set<string>();
  walkRegistered((node) => {
    const fields: unknown = Reflect.get(node, 'fields');
    if (Reflect.get(node, 'kind') === 'object' && fields)
      for (const name of Object.keys(fields)) names.add(name);
  });
  return names;
}

/** A thrown value's message, if reading it does not itself throw. */
function describeThrown(error: unknown) {
  try {
    return error instanceof Error ? error.message : `a thrown ${typeof error}`;
  } catch {
    return 'a thrown value that cannot be described';
  }
}

/**
 * One path's whole probe step. On any error it throws one built from the
 * token and lengths, with the thrown value attached untouched as `cause`.
 */
function replayable(probe: Probe, field: string, run: () => void) {
  try {
    run();
  } catch (error) {
    throw new Error(
      `${field}: token ${probe.token}, lengths ${probe.lengths.join(',')}: ${describeThrown(error)}`,
      { cause: error },
    );
  }
}

/**
 * The reading probe, drawn fresh each run: every invented record key and
 * every ID carries this run's random token and a counter, so each is
 * distinct within the sample, and every array and record holds 4 to 7
 * entries, an ID at each. The known-shapes pass runs first; each path's
 * whole step (build, extract, compare, assert) runs in `replayable`.
 */
test('listSheetReferences reads exactly the IDs placed at every registered field, with random keys and lengths', () => {
  // The opaque list names exactly the `any` fields the schema declares.
  // Every opaque declaration occurs exactly as listed.
  expect(requireKnownShapes()).toEqual(Object.keys(opaqueFields).sort());
  const declared = declaredFieldNames();
  const probe: Probe = {
    token: crypto.randomUUID(),
    count: 0,
    keys: [],
    lengths: [],
  };
  const registered = schema.tables.characterSheetEntry.validator.members;
  for (const field of sheetReferenceFields)
    replayable(probe, field, () => {
      const [kind = '', path = ''] = field.split(' ');
      const member = registered.find(
        (candidate) => candidate.fields.kind.value === kind,
      );
      const keysBefore = probe.keys.length;
      const sample = sampleAlong(member, parsePath(path), probe);
      const row = {
        kind,
        ...(sample.value as object),
      } as Doc<'characterSheetEntry'>;
      const found = listSheetReferences([row]);
      const placed = sample.ids.map((id) => `catalog:${id}`).sort();
      expect({ field, found }).toEqual({ field, found: placed });
      expect(
        probe.keys.slice(keysBefore).filter((key) => declared.has(key)),
      ).toEqual([]);
    });
});
