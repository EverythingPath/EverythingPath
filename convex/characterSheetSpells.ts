import { effectiveSpellListLevel } from '../src/lib/character-sheet-archetype-casting';
import { releaseByteCount } from '../src/lib/catalog/release-schema';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';
import { ConvexError, v, type Infer } from 'convex/values';
import { sheetCharacterMutation } from './lib/campaignRuntime';
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
import { sheetCharacterInternalMutation } from './lib/writeGate';
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
import type { Doc, Id } from './_generated/dataModel';
import { isSelectedCatalogDefinitionSelectable } from './lib/catalogReleaseBoundary';
import {
  createSpellMetadataReadBudget,
  isReplacedByRelease,
  isShownReleaseChange,
  readListedReleaseSpells,
  readReleaseSpellOverlay,
  readReleaseSpellRange,
  readReleaseSpellSearch,
  releaseRangeRow,
  releaseSpellBrowseRow,
  releaseSpellRanges,
  type ReleaseRangePosition,
  type ReleaseSpellRange,
} from './lib/releaseSpellBrowser';
import type { LoadedCharacterSheet } from './lib/characterSheet';
import type { ResolvedArchetypeSpellList } from '../src/lib/character-sheet-archetype-casting';

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

export const record = sheetCharacterMutation({
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

export const remove = sheetCharacterMutation({
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
    /** Release rows stop being read here, leaving the rest to hydrate a page. */
    isHalfSpent() {
      return (
        bytesRead * 2 > (options.maximumBytesRead ?? 256_000) ||
        rowsRead * 2 >
          (options.maximumRowsRead ?? catalogReleaseLimits.spellPageRows)
      );
    },
    accountRead(value: unknown) {
      if (value === null || value === undefined) return;
      bytesRead += releaseByteCount(value);
      rowsRead++;
      if (
        bytesRead > (options.maximumBytesRead ?? 256_000) ||
        rowsRead >
          (options.maximumRowsRead ?? catalogReleaseLimits.spellPageRows)
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
      value: maximumRowsRead ?? catalogReleaseLimits.spellPageRows,
      maximum: catalogReleaseLimits.spellPageRows,
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
    maximumRowsRead: maximumRowsRead ?? catalogReleaseLimits.spellPageRows,
    maximumBytesRead: maximumBytesRead ?? 256_000,
  };
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

/**
 * Under a selected release a browser lists in phases (#413 F2): the listed
 * Spells (`release-spells:`, an offset), each release index range
 * (`release-range:<n>:`, the last row read) or the release's search matches
 * (`release-search:`, an offset), then the indexed rows the release does not
 * replace (`release-base:`, the one paginated query). One call fills its
 * page across phases, reading at most the page's row budget of release rows.
 */
type BrowserPhase =
  | { kind: 'listed'; offset: number }
  | { kind: 'range'; range: number; after: ReleaseRangePosition | null }
  | { kind: 'search'; offset: number }
  | { kind: 'base'; cursor: string | null };

function browserPhaseCursor(releaseNumber: number | null, phase: BrowserPhase) {
  if (phase.kind === 'listed')
    return `release-spells:${releaseNumber}:${phase.offset}`;
  if (phase.kind === 'search')
    return `release-search:${releaseNumber}:${phase.offset}`;
  if (phase.kind === 'range')
    return `release-range:${releaseNumber}:${phase.range}:${phase.after ? JSON.stringify([phase.after.name, phase.after.creationTime]) : ''}`;
  return `release-base:${releaseNumber}:${phase.cursor ?? ''}`;
}

function parseOffset(value: string) {
  const offset = Number(value);
  if (!value || !Number.isSafeInteger(offset) || offset < 0)
    throw new ConvexError('Invalid Spell browser cursor');
  return offset;
}

function parseRangePosition(value: string): ReleaseRangePosition | null {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ConvexError('Invalid Spell browser cursor');
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== 'string' ||
    typeof parsed[1] !== 'number'
  )
    throw new ConvexError('Invalid Spell browser cursor');
  return { name: parsed[0], creationTime: parsed[1] };
}

function parseBrowserPhase(
  releaseNumber: number | null,
  cursor: string | null | undefined,
): BrowserPhase | null {
  if (!cursor) return null;
  const prefix = (name: string) => `${name}:${releaseNumber}:`;
  for (const [name, read] of [
    [
      'release-spells',
      (rest: string): BrowserPhase => ({
        kind: 'listed',
        offset: parseOffset(rest),
      }),
    ],
    [
      'release-search',
      (rest: string): BrowserPhase => ({
        kind: 'search',
        offset: parseOffset(rest),
      }),
    ],
    [
      'release-range',
      (rest: string): BrowserPhase => {
        const split = rest.indexOf(':');
        return {
          kind: 'range',
          range: parseOffset(rest.slice(0, split)),
          after: parseRangePosition(rest.slice(split + 1)),
        };
      },
    ],
    [
      'release-base',
      (rest: string): BrowserPhase => ({ kind: 'base', cursor: rest || null }),
    ],
  ] as const)
    if (cursor.startsWith(prefix(name)))
      return read(cursor.slice(prefix(name).length));
  throw new ConvexError('Invalid Spell browser cursor');
}

/** The phase after `phase`, skipping release phases with nothing in them. */
function nextBrowserPhase(
  phase: BrowserPhase | null,
  {
    listedCount,
    ranges,
  }: { listedCount: number; ranges: readonly ReleaseSpellRange[] },
): BrowserPhase {
  if (!phase)
    return listedCount ? { kind: 'listed', offset: 0 } : rangePhase(ranges, 0);
  if (phase.kind === 'listed') return rangePhase(ranges, 0);
  if (phase.kind === 'range') return rangePhase(ranges, phase.range + 1);
  return { kind: 'base', cursor: null };
}

/** The phase reading `ranges[range]`, or the indexed rows after the last. */
function rangePhase(
  ranges: readonly ReleaseSpellRange[],
  range: number,
): BrowserPhase {
  const next = ranges[range];
  if (!next) return { kind: 'base', cursor: null };
  return next.kind === 'search'
    ? { kind: 'search', offset: 0 }
    : { kind: 'range', range, after: null };
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
    const hydrate = async (row: Doc<'spellCatalogIndex'>) => {
      const hydrated = await releaseSpellBrowseRow({
        ctx,
        sheet,
        row,
        list: casting.spellList,
        release: overlay.release,
        readBudget,
      });
      return hydrated && { ...hydrated, ...releaseTag };
    };
    const release = overlay.release;
    if (!release) {
      const rows = await readStoredBrowserRows(ctx, args, paginationOpts);
      return { ...rows, page: await hydrateBrowserRows(rows.page, hydrate) };
    }
    const spellcasting = {
      sheet,
      castingClassId: args.castingClassId,
      list: casting.spellList,
    };
    const listed = await readListedReleaseSpells({
      ctx,
      overlay,
      readBudget,
      ...spellcasting,
    });
    const shownListed = listed.changes.filter((change) =>
      isShownReleaseChange(change, args),
    );
    const plan = {
      listedCount: shownListed.length,
      ranges: releaseSpellRanges(casting.spellList, args),
    };
    const cursorOf = (next: BrowserPhase) =>
      browserPhaseCursor(overlay.releaseNumber, next);
    let phase =
      parseBrowserPhase(overlay.releaseNumber, paginationOpts.cursor) ??
      nextBrowserPhase(null, plan);
    const shown: Doc<'spellCatalogIndex'>[] = [];
    let rowsLeft = paginationOpts.maximumRowsRead;
    const readRow = (
      row: Doc<'catalogReleaseSpellIndex'>,
      range: ReleaseSpellRange,
    ) =>
      releaseRangeRow({
        ctx,
        row,
        range,
        listed: listed.keys,
        filters: args,
        readBudget,
        ...spellcasting,
      });
    const canRead = () =>
      shown.length < numItems && rowsLeft > 0 && !readBudget.isHalfSpent();
    while (phase.kind !== 'base' && canRead()) {
      if (phase.kind === 'listed') {
        const rows = shownListed.slice(
          phase.offset,
          phase.offset + numItems - shown.length,
        );
        shown.push(...rows.map(({ next }) => next));
        const offset = phase.offset + rows.length;
        phase =
          offset < shownListed.length
            ? { kind: 'listed', offset }
            : nextBrowserPhase(phase, plan);
        continue;
      }
      const range = plan.ranges[phase.kind === 'range' ? phase.range : 0];
      if (!range) throw new ConvexError('Invalid Spell browser cursor');
      if (phase.kind === 'search') {
        if (range.kind !== 'search')
          throw new ConvexError('Invalid Spell browser cursor');
        const matches = await readReleaseSpellSearch(ctx, {
          releaseId: release._id,
          search: range.search,
          filters: args,
        });
        let offset = phase.offset;
        while (offset < matches.length && canRead()) {
          const match = matches[offset++];
          rowsLeft--;
          const change = match && (await readRow(match, range));
          if (change) shown.push(change.next);
        }
        phase =
          offset < matches.length
            ? { kind: 'search', offset }
            : nextBrowserPhase(phase, plan);
        continue;
      }
      if (range.kind === 'search')
        throw new ConvexError('Invalid Spell browser cursor');
      let after = phase.after;
      let isRangeDone = true;
      for await (const row of readReleaseSpellRange(ctx, {
        releaseId: release._id,
        range,
        filters: args,
        after,
      })) {
        if (!canRead()) {
          isRangeDone = false;
          break;
        }
        rowsLeft--;
        after = { name: row.name, creationTime: row._creationTime };
        const change = await readRow(row, range);
        if (change) shown.push(change.next);
      }
      phase = isRangeDone ? nextBrowserPhase(phase, plan) : { ...phase, after };
    }
    if (phase.kind !== 'base' || !canRead())
      return {
        page: await hydrateBrowserRows(shown, hydrate),
        isDone: false,
        continueCursor: cursorOf(phase),
      };
    const end = parseBrowserPhase(
      overlay.releaseNumber,
      paginationOpts.endCursor,
    );
    const rows = await readStoredBrowserRows(ctx, args, {
      ...paginationOpts,
      numItems: numItems - shown.length,
      cursor: phase.cursor,
      endCursor: end?.kind === 'base' ? (end.cursor ?? undefined) : undefined,
    });
    for (const row of rows.page)
      if (
        !(await isReplacedByRelease({
          ctx,
          overlay,
          row,
          readBudget,
          ...spellcasting,
        }))
      )
        shown.push(row);
    return {
      ...rows,
      continueCursor: cursorOf({ kind: 'base', cursor: rows.continueCursor }),
      ...(rows.splitCursor
        ? { splitCursor: cursorOf({ kind: 'base', cursor: rows.splitCursor }) }
        : {}),
      page: await hydrateBrowserRows(shown, hydrate),
    };
  },
});

type BrowserProbe = {
  ctx: QueryCtx;
  overlay: Awaited<ReturnType<typeof readReleaseSpellOverlay>>;
  listed: Awaited<ReturnType<typeof readListedReleaseSpells>>;
  readBudget: { accountRead(value: unknown): void };
  /** Release and indexed rows the probes may still read. */
  probe: { remaining: number };
  sheet: LoadedCharacterSheet;
  castingClassId: Id<'catalogEntry'>;
  list: ResolvedArchetypeSpellList;
};
type ProbeFilters = BrowseFilters & { isUnrecordedOnly?: boolean };

function isProbeShown(row: Doc<'spellCatalogIndex'>, filters: ProbeFilters) {
  return !filters.isUnrecordedOnly || !row.recorded;
}

/**
 * Whether a browser page with these filters would show any row, reading at
 * most `probe.remaining` release and indexed rows; past that it answers yes
 * (#413 F2: browser info no longer reads the whole release).
 */
async function hasReleaseBrowserRow(
  probe: BrowserProbe,
  filters: ProbeFilters,
) {
  return (
    probe.listed.changes.some(
      (change) =>
        isShownReleaseChange(change, filters) &&
        isProbeShown(change.next, filters),
    ) ||
    (await hasReleaseRangeRow(probe, filters)) ||
    (await hasIndexedBrowserRow(probe, filters))
  );
}

async function hasReleaseRangeRow(probe: BrowserProbe, filters: ProbeFilters) {
  const { ctx, overlay, listed, readBudget, sheet, castingClassId, list } =
    probe;
  if (!overlay.release) return false;
  for (const range of releaseSpellRanges(list, filters)) {
    if (range.kind === 'search') continue;
    for await (const row of readReleaseSpellRange(ctx, {
      releaseId: overlay.release._id,
      range,
      filters,
      after: null,
    })) {
      if (probe.probe.remaining-- <= 0) return true;
      const change = await releaseRangeRow({
        ctx,
        row,
        range,
        listed: listed.keys,
        filters,
        readBudget,
        sheet,
        castingClassId,
        list,
      });
      if (change && isProbeShown(change.next, filters)) return true;
    }
  }
  return false;
}

async function hasIndexedBrowserRow(
  probe: BrowserProbe,
  filters: ProbeFilters,
) {
  const { ctx, overlay, readBudget, sheet, castingClassId, list } = probe;
  for await (const row of browseIndex(ctx, filters)) {
    if (probe.probe.remaining-- <= 0) return true;
    if (!isProbeShown(row, filters)) continue;
    const isReplaced = await isReplacedByRelease({
      ctx,
      overlay,
      row,
      readBudget,
      sheet,
      castingClassId,
      list,
    });
    if (!isReplaced) return true;
  }
  return false;
}

/** Each distinct value of a release range's level or school, in order. */
async function readReleaseGroupValues(
  ctx: QueryCtx,
  releaseId: Id<'catalogRelease'>,
  classTag: string,
) {
  const levels: (number | null)[] = [];
  const schools: string[] = [];
  for (
    let level: number | null | undefined = undefined;
    levels.length <= maxSpellBrowserMetadataRows;
  ) {
    const after: number | null | undefined = level;
    const row = await ctx.db
      .query('catalogReleaseSpellIndex')
      .withIndex('by_releaseId_and_classTag_and_level_and_name', (q) => {
        const tagged = q.eq('releaseId', releaseId).eq('classTag', classTag);
        return after === undefined ? tagged : tagged.gt('level', after);
      })
      .first();
    if (!row) break;
    levels.push(row.level);
    level = row.level;
  }
  for (
    let school: string | undefined = undefined;
    schools.length <= maxSpellBrowserMetadataRows;
  ) {
    const after: string | undefined = school;
    const row = await ctx.db
      .query('catalogReleaseSpellIndex')
      .withIndex('by_releaseId_and_classTag_and_school_and_name', (q) => {
        const tagged = q.eq('releaseId', releaseId).eq('classTag', classTag);
        return after === undefined ? tagged : tagged.gt('school', after);
      })
      .first();
    if (!row) break;
    schools.push(row.school);
    school = row.school;
  }
  if (
    levels.length > maxSpellBrowserMetadataRows ||
    schools.length > maxSpellBrowserMetadataRows
  )
    throw new ConvexError('Spell catalog has too many levels or schools');
  return { levels, schools };
}

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
    const highestCastable = Math.max(0, ...casting.castableSpellLevels);
    const castable = [...casting.castableSpellLevels].sort((a, b) => a - b);
    const result = overlay.release
      ? await readReleaseBrowserInfo({
          ctx,
          overlay,
          baseRows,
          args,
          sheet,
          list: casting.spellList,
        })
      : readIndexedBrowserInfo(baseRows, args.includeOtherLists === true);
    const levels = [...new Set(result.levels)].sort((a, b) => a - b);
    const schools = [...new Set(result.schools)].sort();
    const fallback = levels.includes(1) ? 1 : (levels[0] ?? 0);
    if (casting.record === 'none')
      return {
        levels,
        schools,
        defaultLevel: levels.includes(highestCastable)
          ? highestCastable
          : fallback,
        ...releaseTag,
      };
    let defaultLevel = fallback;
    for (const level of castable)
      if (await result.hasUnrecorded(level)) {
        defaultLevel = level;
        break;
      }
    return { levels, defaultLevel, schools, ...releaseTag };
  },
});

/** Browser info from the indexed summary alone, without a selected release. */
function readIndexedBrowserInfo(
  baseRows: readonly Doc<'spellCatalogSummary'>[],
  includeOtherLists: boolean,
) {
  const visible = baseRows.filter(
    (row) => includeOtherLists || row.availableCount > 0,
  );
  return {
    levels: visible.flatMap((row) =>
      row.kind === 'level' && row.value !== null ? [row.value] : [],
    ),
    schools: visible.flatMap((row) =>
      row.kind === 'school' && row.value ? [row.value] : [],
    ),
    hasUnrecorded: (level: number) =>
      baseRows.some(
        (row) =>
          row.kind === 'level' &&
          row.value === level &&
          row.unrecordedCount > 0,
      ),
  };
}

/** The levels and schools any source holds before probing them. */
async function collectReleaseBrowserGroups({
  ctx,
  releaseId,
  baseRows,
  listed,
  tags,
}: {
  ctx: QueryCtx;
  releaseId: Id<'catalogRelease'>;
  baseRows: readonly Doc<'spellCatalogSummary'>[];
  listed: Awaited<ReturnType<typeof readListedReleaseSpells>>;
  tags: readonly string[];
}) {
  const levels = new Set<number | null>(
    baseRows.flatMap((row) => (row.kind === 'level' ? [row.value] : [])),
  );
  const schools = new Set<string>(
    baseRows.flatMap((row) => (row.kind === 'school' ? [row.value] : [])),
  );
  for (const { next } of listed.changes) {
    levels.add(next.level);
    schools.add(next.school);
  }
  for (const tag of tags) {
    const values = await readReleaseGroupValues(ctx, releaseId, tag);
    for (const level of values.levels) levels.add(level);
    for (const school of values.schools) schools.add(school);
  }
  const shownLevels = [...levels].filter((level) => level !== null);
  const shownSchools = [...schools].filter(Boolean);
  if (
    shownLevels.length > maxSpellBrowserMetadataRows ||
    shownSchools.length > maxSpellBrowserMetadataRows
  )
    throw new ConvexError('Spell catalog has too many levels or schools');
  return {
    levels: shownLevels.sort((a, b) => a - b),
    schools: shownSchools.sort(),
  };
}

/**
 * Browser info under a selected release: each level and school any source
 * holds (the indexed summary, the release's list, the listed Spells) that a
 * browser page with it would show.
 */
async function readReleaseBrowserInfo({
  ctx,
  overlay,
  baseRows,
  args,
  sheet,
  list,
}: {
  ctx: QueryCtx;
  overlay: Awaited<ReturnType<typeof readReleaseSpellOverlay>>;
  baseRows: readonly Doc<'spellCatalogSummary'>[];
  args: {
    characterId: Id<'character'>;
    castingClassId: Id<'catalogEntry'>;
    includeOtherLists?: boolean;
  };
  sheet: LoadedCharacterSheet;
  list: ResolvedArchetypeSpellList;
}) {
  const release = overlay.release;
  if (!release) throw new ConvexError('Selected Catalog Release is missing');
  const readBudget = createSpellMetadataReadBudget();
  const spellcasting = { sheet, castingClassId: args.castingClassId, list };
  const listed = await readListedReleaseSpells({
    ctx,
    overlay,
    readBudget,
    ...spellcasting,
  });
  const groups = await collectReleaseBrowserGroups({
    ctx,
    releaseId: release._id,
    baseRows,
    listed,
    tags: [
      ...(list.classTag ? [list.classTag] : []),
      ...(args.includeOtherLists ? ['*'] : []),
    ],
  });
  const probe: BrowserProbe = {
    ctx,
    overlay,
    listed,
    readBudget,
    probe: { remaining: catalogReleaseLimits.spellPageRows },
    ...spellcasting,
  };
  const { characterId, castingClassId, includeOtherLists } = args;
  const scope = { characterId, castingClassId, includeOtherLists };
  const levels: number[] = [];
  for (const level of groups.levels)
    if (await hasReleaseBrowserRow(probe, { ...scope, spellLevel: level }))
      levels.push(level);
  const schools: string[] = [];
  for (const school of groups.schools)
    if (await hasReleaseBrowserRow(probe, { ...scope, school }))
      schools.push(school);
  return {
    levels,
    schools,
    hasUnrecorded: (level: number) =>
      hasReleaseBrowserRow(probe, {
        characterId,
        castingClassId,
        spellLevel: level,
        isUnrecordedOnly: true,
      }),
  };
}

const importedSpellValidator = zodOutputToConvex(
  importedCatalogEntrySchema.extend({
    detail: importedSpellDetailSchema,
  }),
);
export const installPreparedCatalog = sheetCharacterInternalMutation({
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
