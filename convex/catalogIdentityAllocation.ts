import { ConvexError, v } from 'convex/values';
import type { WithoutSystemFields } from 'convex/server';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import type { ReadCtx } from './types';
import { sheetCharacterInternalMutation } from './lib/writeGate';
import { requireCurrentPreparation } from './catalogRelease';
import {
  candidateStableReferences,
  globalDefinition,
  releaseRow,
  type CandidateKind,
} from './lib/catalogCandidateDefinition';
import { importedCatalogEntrySchema } from '../src/lib/catalog/imported-entry-schema';
import { isObject } from '../src/lib/catalog/release-schema';
import { findReviewedClassCasting } from '../src/lib/character-sheet-casting-tables';
import type { z } from 'zod';
import {
  allocationBatchValidator,
  type AllocationBatch,
  type IdentityConflict,
} from '../src/lib/catalog/identity-allocation';

// #413 F1: the initial import's stable global identities. A prepared
// release's definitions name their identities by `externalKey`; this module
// creates the missing ones as bodiless stored identities, in bounded batches.
// Each batch is one transaction that checks before it inserts, so a re-run
// after any interruption allocates nothing twice, and the only state it
// leaves is identities: reconciliation's identity coverage measures them
// itself and never reads an allocation as complete.

/** Definition rows per allocation batch. */
export const allocationBatchRows = 8;
const allocationBatchBytes = 512000;

type ImportedDefinition = z.infer<typeof importedCatalogEntrySchema>;
type StoredIdentity = WithoutSystemFields<Doc<'catalogEntry'>>;

type ImportedClass = Extract<ImportedDefinition['detail'], { kind: 'class' }>;
/** A body's stored identity, or why it has none. */
export type IdentityPlaceholder =
  | { kind: 'stored'; identity: StoredIdentity }
  | { kind: 'unsupported'; reason: string };

/** What every stored identity holds: its rule identity, name and scope. */
function sharedFields(body: ImportedDefinition) {
  return {
    scope: 'global' as const,
    name: body.name,
    ruleIdentity: body.externalKey,
    sources: [],
    modifiers: [],
    stacksWithItself: false,
  };
}
type SharedFields = ReturnType<typeof sharedFields>;

// The placeholder of each kind the candidate adapter converts but the class.
// Typed over the adapter's kinds, so a kind it gains needs a shape here.
const placeholders: Record<
  Exclude<CandidateKind, 'class'>,
  (shared: SharedFields) => StoredIdentity
> = {
  classFeature: (shared) => ({ ...shared, detail: { kind: 'classFeature' } }),
  archetype: (shared) => ({
    ...shared,
    detail: { kind: 'archetype', classEntryIds: [], replaces: [], adds: [] },
  }),
  feat: (shared) => ({ ...shared, detail: { kind: 'feat' } }),
  trait: (shared) => ({ ...shared, detail: { kind: 'trait' } }),
  spell: (shared) => ({ ...shared, detail: { kind: 'spell' } }),
  spellEffect: (shared) => ({
    ...shared,
    detail: {
      kind: 'spellEffect',
      defaultCasterLevel: 0,
      lastsOverOneDay: false,
    },
  }),
  race: (shared) => ({
    ...shared,
    detail: { kind: 'race', racialTraits: [] },
  }),
  racialTrait: (shared) => ({
    ...shared,
    detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
  }),
  item: (shared) => ({
    ...shared,
    detail: { kind: 'item', consumable: false },
  }),
  itemAbility: (shared) => ({
    ...shared,
    detail: { kind: 'itemAbility', appliesTo: 'weapon', bonusEquivalent: 0 },
  }),
  manual: (shared) => ({ ...shared, detail: { kind: 'manual' } }),
};

function isPlaceholderKind(kind: string): kind is keyof typeof placeholders {
  return Object.hasOwn(placeholders, kind);
}

/** The kinds allocation stores an identity for: the adapter's. */
export const allocatableKinds: readonly string[] = [
  'class',
  ...Object.keys(placeholders),
];

/** A class keeps its kind and, when it casts, its reviewed casting. */
function classPlaceholder(
  shared: SharedFields,
  detail: ImportedClass,
): IdentityPlaceholder {
  const casting = detail.casting
    ? findReviewedClassCasting(detail.tag)
    : undefined;
  if (detail.casting && !casting)
    return {
      kind: 'unsupported',
      reason: `No reviewed casting for class tag ${detail.tag}`,
    };
  return {
    kind: 'stored',
    identity: {
      ...shared,
      detail: {
        kind: 'class',
        classKind: detail.classKind,
        hitDie: 6,
        bab: 'half',
        saves: { fort: 'poor', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 0,
        classSkills: [],
        featuresByLevel: [],
        picksByLevel: [],
        ...(casting ? { casting } : {}),
      },
    },
  };
}

/**
 * The stored identity a body gets: its rule identity, name and kind, with
 * the placeholder content the release body replaces, as the E2E stand-in
 * has it. A class keeps its kind and, when it casts, its reviewed casting,
 * the stored fields the adapter keeps. No other body field is stored, so
 * ordinary reads see none of an unpublished body.
 */
export function storedIdentity(body: ImportedDefinition): IdentityPlaceholder {
  const shared = sharedFields(body);
  const detail = body.detail;
  if (detail.kind === 'class') return classPlaceholder(shared, detail);
  return isPlaceholderKind(detail.kind)
    ? { kind: 'stored', identity: placeholders[detail.kind](shared) }
    : {
        kind: 'unsupported',
        reason: `No stored identity shape for kind ${detail.kind}`,
      };
}

async function requirePreparedRelease(ctx: ReadCtx, releaseNumber: number) {
  const release = await ctx.db
    .query('catalogRelease')
    .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', releaseNumber))
    .unique();
  if (!release) throw new ConvexError('Catalog Release does not exist');
  if (release.state !== 'prepared')
    throw new ConvexError('Catalog Release is not prepared');
  await requireCurrentPreparation(ctx, release);
  return release;
}

/** A reference's target: stored, else this release's own definition. */
async function resolveReference(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  key: string,
) {
  const stored = await globalDefinition(ctx, key);
  if (stored)
    return {
      source: 'stored' as const,
      catalogEntryId: stored._id,
      kind: stored.detail.kind,
    };
  const row = await releaseRow(ctx, release._id, 'definition', key);
  const payload: unknown = row?.payload;
  return isObject(payload) &&
    isObject(payload.detail) &&
    typeof payload.detail.kind === 'string'
    ? { source: 'release' as const, kind: payload.detail.kind }
    : null;
}

/** The body's references that don't resolve as the adapter needs. */
async function referenceConflicts(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  body: ImportedDefinition,
) {
  const conflicts: IdentityConflict[] = [];
  const references = new Map<string, string | undefined>();
  for (const { key, kind } of candidateStableReferences(body))
    references.set(key, references.get(key) ?? kind);
  for (const [reference, expectedKind] of references) {
    const found = await resolveReference(ctx, release, reference);
    if (!found)
      conflicts.push({
        kind: 'unresolvedReference',
        key: body.externalKey,
        reference,
      });
    else if (expectedKind && found.kind !== expectedKind)
      conflicts.push({
        kind: 'referenceKind',
        key: body.externalKey,
        reference,
        expectedKind,
        found,
      });
  }
  return conflicts;
}

async function allocateDefinition(
  ctx: MutationCtx,
  release: Doc<'catalogRelease'>,
  row: Doc<'catalogReleaseRow'>,
): Promise<'allocated' | 'existing' | IdentityConflict[]> {
  const parsed = importedCatalogEntrySchema.safeParse(row.payload);
  if (!parsed.success || parsed.data.externalKey !== row.key)
    return [
      { kind: 'unsupported', key: row.key, reason: 'Unsupported release body' },
    ];
  const body = parsed.data;
  const releaseKind = body.detail.kind;
  // Only a global row is an identity: the adapter resolves every reference
  // to one, so a Character's privately imported Spell of the key never
  // stands in for it.
  const stored = await globalDefinition(ctx, row.key);
  if (stored)
    return stored.detail.kind === releaseKind
      ? 'existing'
      : [
          {
            kind: 'identityKind',
            key: row.key,
            releaseKind,
            stored: { catalogEntryId: stored._id, kind: stored.detail.kind },
          },
        ];
  const shape = storedIdentity(body);
  if (shape.kind === 'unsupported')
    return [{ kind: 'unsupported', key: row.key, reason: shape.reason }];
  const conflicts = await referenceConflicts(ctx, release, body);
  if (conflicts.length) return conflicts;
  await ctx.db.insert('catalogEntry', shape.identity);
  return 'allocated';
}

/**
 * One batch of a prepared release's definitions, in key order from
 * `cursor` (null for the first). Run it until `isDone`; any re-run from the
 * start ends in the same identities.
 */
export const allocate = sheetCharacterInternalMutation({
  args: {
    releaseNumber: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: allocationBatchValidator,
  handler: async (ctx, args): Promise<AllocationBatch> => {
    const release = await requirePreparedRelease(ctx, args.releaseNumber);
    const page = await ctx.db
      .query('catalogReleaseRow')
      .withIndex('by_releaseId_and_kind_and_key', (q) =>
        q.eq('releaseId', release._id).eq('kind', 'definition'),
      )
      .paginate({
        numItems: allocationBatchRows,
        cursor: args.cursor,
        maximumRowsRead: allocationBatchRows,
        maximumBytesRead: allocationBatchBytes,
      });
    const batch: AllocationBatch = {
      allocatedCount: 0,
      existingCount: 0,
      conflicts: [],
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
    for (const row of page.page) {
      const outcome = await allocateDefinition(ctx, release, row);
      if (outcome === 'allocated') batch.allocatedCount++;
      else if (outcome === 'existing') batch.existingCount++;
      else batch.conflicts.push(...outcome);
    }
    return batch;
  },
});
