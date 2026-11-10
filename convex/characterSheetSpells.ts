import { effectiveSpellListLevel } from '../src/lib/character-sheet-archetype-casting';
import { releaseByteCount } from '../src/lib/catalog/release-schema';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';
import { ConvexError, v, type Infer } from 'convex/values';
import { legacyCharacterMutation } from './lib/campaignRuntime';
import {
  loadCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
} from './lib/characterSheet';
import { maxCharacterChildRows } from './lib/characterSheetData';
import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server';
import { query, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import {
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../src/lib/catalog/imported-entry-schema';
import { gatedInternalMutation } from './lib/writeGate';
import { requireCampaignWrites } from './lib/campaignRuntime';
import {
  reconcileSpellDefinition,
  cleanupCharacterSpellIndex,
  deleteSpellCatalogIndex,
} from './lib/spellCatalog';
import { installPreparedSpells } from './lib/spellCatalogInstall';
import { maxSpellBrowserMetadataRows } from './lib/spellCatalogSummary';
import type { QueryCtx } from './_generated/server';
import type { ReadCtx } from './types';
import type { CharacterScope } from './lib/characterAccess';
import { findPreferredCampaignCopy } from './lib/catalogCopies';
import type { Id } from './_generated/dataModel';
import { isSelectedCatalogDefinitionSelectable } from './lib/catalogReleaseBoundary';
import {
  readReleaseSpellOverlay,
  releaseSpellRows,
  mergeReleaseSpellSummary,
  releaseSpellBrowseRow,
  matchesSpellBrowser,
} from './lib/releaseSpellBrowser';

const scope = {
  organizationId: v.optional(v.string()),
  campaignId: v.optional(v.id('campaign')),
  characterId: v.id('character'),
};

async function requireSpellcasting({
  ctx,
  scope,
  castingClassId,
  isWritable = false,
}: {
  ctx: ReadCtx;
  scope: CharacterScope;
  castingClassId: Id<'catalogEntry'>;
  isWritable?: boolean;
}) {
  const sheet = await loadCharacterSheet(ctx, scope, { isWritable });
  if (!sheet) throw new ConvexError('Character has no sheet');
  const casting = sheet.calculated.spellcastings.find(
    (row) => row.classEntryId === castingClassId,
  );
  if (!casting)
    throw new ConvexError('Spellcasting does not belong to this Character');
  return { sheet, casting };
}

export const record = legacyCharacterMutation({
  args: {
    ...scope,
    castingClassId: v.id('catalogEntry'),
    catalogEntryId: v.id('catalogEntry'),
    level: v.optional(v.number()),
    operationId: v.string(),
  },
  returns: v.id('characterSheetEntry'),
  handler: async (ctx, args) => {
    const { sheet, casting } = await requireSpellcasting({
      ctx,
      scope: args,
      castingClassId: args.castingClassId,
      isWritable: true,
    });
    if (casting.record === 'none')
      throw new ConvexError(
        'This Spellcasting browses its whole list without recording Spells',
      );
    let definition = sheet.catalogEntries.find(
      (row) => row._id === args.catalogEntryId,
    );
    if (definition?.scope === 'global')
      definition =
        (await findPreferredCampaignCopy(ctx, {
          campaignId: sheet.character.campaignId,
          originalId: definition._id,
        })) ?? definition;
    const existing = sheet.entries.find(
      (row) =>
        row.kind === 'spell' &&
        !row.grantKey &&
        row.state.castingClassId === args.castingClassId &&
        sheet.catalogEntries.some(
          (catalog) =>
            catalog._id === row.catalogEntryId &&
            catalog.ruleIdentity === definition?.ruleIdentity,
        ),
    );
    if (existing?.kind === 'spell')
      definition =
        sheet.catalogEntries.find(
          (catalog) => catalog._id === existing.catalogEntryId,
        ) ?? definition;
    if (definition?.detail.kind !== 'spell')
      throw new ConvexError('Spell does not belong to this Character');
    if (
      !existing &&
      !(await isSelectedCatalogDefinitionSelectable(ctx, definition))
    )
      throw new ConvexError('Spell is not available for selection');
    // #422: the effective list; a level a pending choice decides is not listed.
    const listedLevel =
      effectiveSpellListLevel(casting.spellList, {
        ruleIdentity: definition.ruleIdentity,
        levels: definition.detail.levels,
      }) ?? undefined;
    const level =
      listedLevel ??
      args.level ??
      (existing?.kind === 'spell'
        ? (existing.state.level ?? undefined)
        : undefined);
    if (level === undefined)
      throw new ConvexError('Enter an explicit level for an off-list Spell');
    if (!Number.isSafeInteger(level) || level < 0)
      throw new ConvexError('Enter a whole nonnegative spell level');
    if (existing?.kind === 'spell') {
      if (listedLevel === undefined && existing.state.level !== level) {
        await ctx.db.patch('characterSheetEntry', existing._id, {
          state: { ...existing.state, level },
        });
        const updated = await ctx.db.get('characterSheetEntry', existing._id);
        if (!updated) throw new ConvexError('Spell is unavailable');
        sheet.entries = sheet.entries.map((row) =>
          row._id === existing._id ? updated : row,
        );
        await reconcileSpellDefinition({
          ctx,
          sheet,
          catalogEntryId: definition._id,
        });
        await pruneWarningAcceptancesAndRecordChange(ctx, {
          sheet,
          operationId: args.operationId,
        });
      }
      return existing._id;
    }
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const entryId = await ctx.db.insert('characterSheetEntry', {
      characterId: args.characterId,
      kind: 'spell',
      active: true,
      catalogEntryId: definition._id,
      state: { kind: 'spell', castingClassId: args.castingClassId, level },
    });
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    if (!entry) throw new ConvexError('Spell is unavailable');
    sheet.entries.push(entry);
    await reconcileSpellDefinition({
      ctx,
      sheet,
      catalogEntryId: definition._id,
    });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});

export const remove = legacyCharacterMutation({
  args: {
    ...scope,
    entryId: v.id('characterSheetEntry'),
    operationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
    if (!sheet) throw new ConvexError('Character has no sheet');
    const entry = sheet.entries.find((row) => row._id === args.entryId);
    if (entry?.kind !== 'spell' || entry.grantKey)
      throw new ConvexError('Recorded Spell does not belong to this Character');
    await ctx.db.delete('characterSheetEntry', entry._id);
    sheet.entries = sheet.entries.filter((row) => row._id !== entry._id);
    await reconcileSpellDefinition({
      ctx,
      sheet,
      catalogEntryId: entry.catalogEntryId,
    });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

const browseArgs = {
  ...scope,
  castingClassId: v.id('catalogEntry'),
  spellLevel: v.optional(v.number()),
  search: v.optional(v.string()),
  school: v.optional(v.string()),
  includeOtherLists: v.optional(v.boolean()),
  catalogReleaseNumber: v.optional(v.union(v.number(), v.null())),
};
const browseRow = v.object({
  catalogEntryId: v.id('catalogEntry'),
  ruleIdentity: v.string(),
  name: v.string(),
  school: v.string(),
  description: v.string(),
  spellLevel: v.union(v.number(), v.null()),
  onList: v.boolean(),
  recorded: v.boolean(),
  catalogReleaseNumber: v.optional(v.union(v.number(), v.null())),
});
type BrowseFilters = {
  characterId: Id<'character'>;
  castingClassId: Id<'catalogEntry'>;
  spellLevel?: number;
  school?: string;
  includeOtherLists?: boolean;
};
function browseIndex(ctx: QueryCtx, args: BrowseFilters) {
  const { characterId, castingClassId, spellLevel, school, includeOtherLists } =
    args;
  const indexed = ctx.db.query('spellCatalogIndex');
  if (includeOtherLists) {
    if (spellLevel !== undefined && school)
      return indexed.withIndex(
        'by_characterId_and_castingClassId_and_level_and_school_and_name',
        (q) =>
          q
            .eq('characterId', characterId)
            .eq('castingClassId', castingClassId)
            .eq('level', spellLevel)
            .eq('school', school),
      );
    if (spellLevel !== undefined)
      return indexed.withIndex(
        'by_characterId_and_castingClassId_and_level_and_name',
        (q) =>
          q
            .eq('characterId', characterId)
            .eq('castingClassId', castingClassId)
            .eq('level', spellLevel),
      );
    if (school)
      return indexed.withIndex(
        'by_characterId_and_castingClassId_and_school_and_name',
        (q) =>
          q
            .eq('characterId', characterId)
            .eq('castingClassId', castingClassId)
            .eq('school', school),
      );
    return indexed.withIndex(
      'by_characterId_and_castingClassId_and_name',
      (q) =>
        q.eq('characterId', characterId).eq('castingClassId', castingClassId),
    );
  }
  if (spellLevel !== undefined && school)
    return indexed.withIndex(
      'by_characterId_castingClassId_available_level_school_name',
      (q) =>
        q
          .eq('characterId', characterId)
          .eq('castingClassId', castingClassId)
          .eq('available', true)
          .eq('level', spellLevel)
          .eq('school', school),
    );
  if (spellLevel !== undefined)
    return indexed.withIndex(
      'by_characterId_castingClassId_available_level_name',
      (q) =>
        q
          .eq('characterId', characterId)
          .eq('castingClassId', castingClassId)
          .eq('available', true)
          .eq('level', spellLevel),
    );
  if (school)
    return indexed.withIndex(
      'by_characterId_castingClassId_available_school_name',
      (q) =>
        q
          .eq('characterId', characterId)
          .eq('castingClassId', castingClassId)
          .eq('available', true)
          .eq('school', school),
    );
  return indexed.withIndex(
    'by_characterId_and_castingClassId_and_available_and_name',
    (q) =>
      q
        .eq('characterId', characterId)
        .eq('castingClassId', castingClassId)
        .eq('available', true),
  );
}

const browseArguments = v.object({
  ...browseArgs,
  paginationOpts: paginationOptsValidator,
});
type BrowseArguments = Infer<typeof browseArguments>;
type BrowsePagination = Infer<typeof paginationOptsValidator>;

function createBrowserPageReadBudget(options: BrowsePagination) {
  let bytesRead = 0;
  let rowsRead = 0;
  return {
    accountRead(value: unknown) {
      if (value === null || value === undefined) return;
      bytesRead += releaseByteCount(value);
      rowsRead++;
      if (
        bytesRead > (options.maximumBytesRead ?? 256_000) ||
        rowsRead >
          (options.maximumRowsRead ?? catalogReleaseLimits.spellMetadataRows)
      )
        throw new ConvexError(
          'Spell browser page exceeds its read resource limit',
        );
    },
  };
}
/** Browser rows in order, without those whose definition is gone. */
async function hydrateBrowserRows<T, Result>(
  rows: readonly T[],
  read: (row: T) => Promise<Result | null>,
) {
  const results: Result[] = [];
  for (const row of rows) {
    const result = await read(row);
    if (result) results.push(result);
  }
  return results;
}

function boundedBrowserPagination(options: BrowsePagination) {
  const { numItems, maximumRowsRead, maximumBytesRead } = options;
  const readLimits = [
    { value: numItems, maximum: 100 },
    {
      value: maximumRowsRead ?? catalogReleaseLimits.spellMetadataRows,
      maximum: catalogReleaseLimits.spellMetadataRows,
    },
    { value: maximumBytesRead ?? 256_000, maximum: 256_000 },
  ];
  if (
    readLimits.some(
      ({ value, maximum }) =>
        !Number.isSafeInteger(value) || value < 1 || value > maximum,
    )
  )
    throw new ConvexError(
      'Spell browsing requires bounded pages, rows and bytes',
    );
  // Preserve native cursor/id/endCursor while bounding the stock React hook,
  // which supplies no read limits itself.
  return {
    ...options,
    maximumRowsRead: maximumRowsRead ?? catalogReleaseLimits.spellMetadataRows,
    maximumBytesRead: maximumBytesRead ?? 256_000,
  };
}
async function readReleaseBrowserCandidates({
  ctx,
  overlay,
  changedRows,
  args,
}: {
  ctx: ReadCtx;
  overlay: Awaited<ReturnType<typeof readReleaseSpellOverlay>>;
  changedRows: Awaited<ReturnType<typeof releaseSpellRows>>;
  args: BrowseArguments;
}) {
  const search = args.search?.trim();
  const releaseId = overlay.release?._id;
  const searchedKeys =
    search && releaseId
      ? new Set(
          (
            await ctx.db
              .query('catalogReleaseSpellIndex')
              .withSearchIndex('search_name', (q) =>
                q
                  .search('name', search)
                  .eq('releaseId', releaseId)
                  .eq('classTag', '*'),
              )
              .take(catalogReleaseLimits.spellMetadataRows + 1)
          ).map((row) => row.ruleIdentity),
        )
      : null;
  return changedRows
    .filter(
      ({ next, metadata }) =>
        metadata.isSelectable &&
        (!searchedKeys || searchedKeys.has(metadata.ruleIdentity)) &&
        matchesSpellBrowser(next, { ...args, search: undefined }),
    )
    .sort(
      (left, right) =>
        left.next.name.localeCompare(right.next.name) ||
        left.next._id.localeCompare(right.next._id),
    );
}
async function readStoredBrowserRows(
  ctx: ReadCtx,
  args: BrowseArguments,
  paginationOpts: BrowsePagination,
) {
  const search = args.search?.trim();
  return search
    ? await ctx.db
        .query('spellCatalogIndex')
        .withSearchIndex('search_name', (q) => {
          let range = q
            .search('name', search)
            .eq('characterId', args.characterId)
            .eq('castingClassId', args.castingClassId);
          if (!args.includeOtherLists) range = range.eq('available', true);
          if (args.school) range = range.eq('school', args.school);
          return range;
        })
        .paginate(paginationOpts)
    : await browseIndex(ctx, args).paginate(paginationOpts);
}

export const browse = query({
  args: browseArguments,
  returns: paginationResultValidator(browseRow),
  handler: async (ctx, args) => {
    const { sheet, casting } = await requireSpellcasting({
      ctx,
      scope: args,
      castingClassId: args.castingClassId,
    });
    const paginationOpts = boundedBrowserPagination(args.paginationOpts);
    const { numItems } = paginationOpts;
    const readBudget = createBrowserPageReadBudget(paginationOpts);
    const overlay = await readReleaseSpellOverlay(ctx);
    const releaseTag =
      args.catalogReleaseNumber !== undefined || overlay.release
        ? { catalogReleaseNumber: overlay.releaseNumber }
        : {};
    if (
      args.catalogReleaseNumber !== undefined &&
      args.catalogReleaseNumber !== overlay.releaseNumber
    )
      return { page: [], isDone: true, continueCursor: '' };
    const changedRows = await releaseSpellRows({
      ctx,
      sheet,
      castingClassId: args.castingClassId,
      list: casting.spellList,
      overlay,
      readBudget,
    });
    const candidates = await readReleaseBrowserCandidates({
      ctx,
      overlay,
      changedRows,
      args,
    });
    const candidatePrefix = `release-spells:${overlay.releaseNumber}:`;
    const basePrefix = `release-base:${overlay.releaseNumber}:`;
    const cursor = paginationOpts.cursor;
    const isCandidatePhase =
      overlay.release &&
      candidates.length &&
      (!cursor || cursor.startsWith(candidatePrefix));
    if (isCandidatePhase) {
      const offset = cursor ? Number(cursor.slice(candidatePrefix.length)) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0)
        throw new ConvexError('Invalid Spell browser cursor');
      const nextOffset = offset + numItems;
      return {
        page: await hydrateBrowserRows(
          candidates.slice(offset, nextOffset),
          async ({ next }) => {
            const hydrated = await releaseSpellBrowseRow({
              ctx,
              sheet,
              row: next,
              list: casting.spellList,
              release: overlay.release,
              readBudget,
            });
            return hydrated && { ...hydrated, ...releaseTag };
          },
        ),
        isDone: false,
        continueCursor:
          nextOffset < candidates.length
            ? `${candidatePrefix}${nextOffset}`
            : basePrefix,
      };
    }
    if (overlay.release && cursor && !cursor.startsWith(basePrefix))
      throw new ConvexError('Invalid Spell browser cursor');
    const basePaginationOpts = overlay.release
      ? {
          ...paginationOpts,
          cursor:
            cursor === basePrefix
              ? null
              : (cursor?.slice(basePrefix.length) ?? null),
          endCursor: paginationOpts.endCursor?.startsWith(basePrefix)
            ? paginationOpts.endCursor.slice(basePrefix.length)
            : undefined,
        }
      : paginationOpts;
    const rows = await readStoredBrowserRows(ctx, args, basePaginationOpts);
    return {
      ...rows,
      ...(overlay.release
        ? {
            continueCursor: `${basePrefix}${rows.continueCursor}`,
            ...(rows.splitCursor
              ? { splitCursor: `${basePrefix}${rows.splitCursor}` }
              : {}),
          }
        : {}),
      page: await hydrateBrowserRows(
        rows.page.filter(
          (row) => !changedRows.some(({ index }) => index._id === row._id),
        ),
        async (row) => {
          const hydrated = await releaseSpellBrowseRow({
            ctx,
            sheet,
            row,
            list: casting.spellList,
            release: overlay.release,
            readBudget,
          });
          return hydrated && { ...hydrated, ...releaseTag };
        },
      ),
    };
  },
});

export const browserInfo = query({
  args: {
    ...scope,
    castingClassId: v.id('catalogEntry'),
    includeOtherLists: v.optional(v.boolean()),
    catalogReleaseNumber: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.object({
    levels: v.array(v.number()),
    defaultLevel: v.number(),
    schools: v.array(v.string()),
    catalogReleaseNumber: v.optional(v.union(v.number(), v.null())),
  }),
  handler: async (ctx, args) => {
    const { sheet, casting } = await requireSpellcasting({
      ctx,
      scope: args,
      castingClassId: args.castingClassId,
    });
    const baseRows = await ctx.db
      .query('spellCatalogSummary')
      .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
        q
          .eq('characterId', args.characterId)
          .eq('castingClassId', args.castingClassId),
      )
      .take(maxSpellBrowserMetadataRows * 2 + 1);
    if (baseRows.length > maxSpellBrowserMetadataRows * 2)
      throw new ConvexError('Spell catalog has too many levels or schools');
    const overlay = await readReleaseSpellOverlay(ctx);
    const releaseTag =
      args.catalogReleaseNumber !== undefined || overlay.release
        ? { catalogReleaseNumber: overlay.releaseNumber }
        : {};
    if (
      args.catalogReleaseNumber !== undefined &&
      args.catalogReleaseNumber !== overlay.releaseNumber
    )
      return { levels: [], schools: [], defaultLevel: 0, ...releaseTag };
    const rows = mergeReleaseSpellSummary(
      baseRows,
      await releaseSpellRows({
        ctx,
        sheet,
        castingClassId: args.castingClassId,
        list: casting.spellList,
        overlay,
      }),
    );
    const visible = rows.filter(
      (row) => args.includeOtherLists === true || row.availableCount > 0,
    );
    const levels = visible
      .flatMap((row) =>
        row.kind === 'level' && row.value !== null ? [row.value] : [],
      )
      .sort((a, b) => a - b);
    const schools = visible
      .flatMap((row) => (row.kind === 'school' && row.value ? [row.value] : []))
      .sort();
    const fallback = levels.includes(1) ? 1 : (levels[0] ?? 0);
    const highestCastable = Math.max(0, ...casting.castableSpellLevels);
    if (casting.record === 'none')
      return {
        levels,
        schools,
        defaultLevel: levels.includes(highestCastable)
          ? highestCastable
          : fallback,
        ...releaseTag,
      };
    const defaultLevel =
      [...casting.castableSpellLevels]
        .sort((a, b) => a - b)
        .find((level) =>
          rows.some(
            (row) =>
              row.kind === 'level' &&
              row.value === level &&
              row.unrecordedCount > 0,
          ),
        ) ?? fallback;
    return { levels, defaultLevel, schools, ...releaseTag };
  },
});

const importedSpellValidator = zodOutputToConvex(
  importedCatalogEntrySchema.extend({
    detail: importedSpellDetailSchema,
  }),
);
export const installPreparedCatalog = gatedInternalMutation({
  args: {
    ...scope,
    spells: v.array(importedSpellValidator),
    operationId: v.string(),
  },
  returns: v.array(v.id('catalogEntry')),
  handler: async (ctx, args) => {
    await requireCampaignWrites(ctx);
    const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
    if (!sheet) throw new ConvexError('Character has no sheet');
    const ids = await installPreparedSpells({
      ctx,
      sheet,
      spells: args.spells,
    });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return ids;
  },
});

// The original deletion passed the Write Gate and removed access. Housekeeping
// must finish even if maintenance starts later; it never edits a live Character.
export const cleanupCatalog = internalMutation({
  args: { characterId: v.id('character') },
  returns: v.null(),
  handler: async (ctx, { characterId }) => {
    if (await ctx.db.get('character', characterId))
      throw new ConvexError('Remove the Character before cleaning its catalog');
    let removed = 0;
    for await (const definition of ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))) {
      await deleteSpellCatalogIndex(ctx, definition._id);
      await ctx.db.delete('catalogEntry', definition._id);
      removed += 1;
      const metrics = await ctx.meta.getTransactionMetrics();
      if (
        removed >= 64 ||
        metrics.bytesRead.remaining < 2_000_000 ||
        metrics.bytesWritten.remaining < 2_000_000 ||
        metrics.documentsWritten.remaining < 256
      ) {
        await ctx.scheduler.runAfter(
          0,
          internal.characterSheetSpells.cleanupCatalog,
          { characterId },
        );
        return null;
      }
    }
    if (await cleanupCharacterSpellIndex(ctx, characterId))
      await ctx.scheduler.runAfter(
        0,
        internal.characterSheetSpells.cleanupCatalog,
        { characterId },
      );
    return null;
  },
});
