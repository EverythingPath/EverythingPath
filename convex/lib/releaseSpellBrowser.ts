import type { ResolvedArchetypeSpellList } from '../../src/lib/character-sheet-archetype-casting';
import { spellListPlacement } from './spellCatalog';
import { catalogReleaseLimits } from '../../src/lib/catalog/release-limits';
import { ConvexError } from 'convex/values';
import type { PaginationOptions } from 'convex/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import type { LoadedCharacterSheet } from './characterSheet';
import { candidateDefinition } from './catalogCandidateDefinition';
import { readSelectedCatalogBoundary } from './catalogReleaseBoundary';
import { releaseByteCount } from '../../src/lib/catalog/release-schema';

type IndexRow = Doc<'spellCatalogIndex'>;
type Metadata = Doc<'catalogReleaseSpellIndex'>;
type SpellReadBudget = { accountRead(value: unknown): void };
type Overlay = Awaited<ReturnType<typeof readReleaseSpellOverlay>>;
export type ReleaseSpellChange = {
  index: IndexRow;
  metadata: Metadata;
  next: IndexRow;
};
export type ReleaseBrowserFilters = {
  spellLevel?: number;
  school?: string;
  search?: string;
  includeOtherLists?: boolean;
};
type Casting = {
  sheet: LoadedCharacterSheet;
  castingClassId: Id<'catalogEntry'>;
  /** The Spellcasting's effective list (#422). */
  list: ResolvedArchetypeSpellList;
};

/**
 * The selected release. Its Spell metadata is read a bounded page at a time
 * (#413 F2): a first release stages every Spell, more than one read holds.
 */
export async function readReleaseSpellOverlay(ctx: ReadCtx) {
  const { release, control } = await readSelectedCatalogBoundary(ctx);
  return { release, releaseNumber: control?.releaseNumber ?? null };
}

/** One staged Spell's release metadata row (`classTag: '*'`), if any. */
export async function readReleaseSpellMetadata(
  ctx: ReadCtx,
  releaseId: Id<'catalogRelease'>,
  ruleIdentity: string,
) {
  // At most 33 rows share a rule identity: `*` and its 32 class lists.
  return await ctx.db
    .query('catalogReleaseSpellIndex')
    .withIndex('by_releaseId_and_ruleIdentity', (q) =>
      q.eq('releaseId', releaseId).eq('ruleIdentity', ruleIdentity),
    )
    .filter((q) => q.eq(q.field('classTag'), '*'))
    .first();
}

/**
 * The browser row a staged Spell gives this Spellcasting: its indexed row
 * and the row under the release, or null when the release leaves the indexed
 * row as it is (no row, a Character's own homebrew, a selectable copy).
 */
export async function releaseSpellChange({
  ctx,
  sheet,
  castingClassId,
  list,
  metadata,
  readBudget,
}: Casting & {
  ctx: ReadCtx;
  metadata: Metadata;
  readBudget: SpellReadBudget;
}): Promise<ReleaseSpellChange | null> {
  let index = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_castingClassId_and_ruleIdentity', (q) =>
      q
        .eq('characterId', sheet.character._id)
        .eq('castingClassId', castingClassId)
        .eq('ruleIdentity', metadata.ruleIdentity),
    )
    .first();
  if (!index) {
    const definitions = await readLegacySpellDefinitions(
      ctx,
      sheet,
      metadata.ruleIdentity,
      readBudget,
    );
    for (const definition of definitions) {
      const references = await ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_catalogEntryId', (q) =>
          q
            .eq('characterId', sheet.character._id)
            .eq('catalogEntryId', definition._id),
        )
        .take(catalogReleaseLimits.spellCopies + 1);
      if (references.length > catalogReleaseLimits.spellCopies)
        throw new ConvexError('Spell has too many casting lists');
      index =
        references.find((row) => row.castingClassId === castingClassId) ?? null;
      if (index) break;
    }
  }
  if (!index) return null;
  const definition = await ctx.db.get('catalogEntry', index.catalogEntryId);
  readBudget.accountRead(definition);
  // Player copies own their fields, while held identities stop being offered.
  if (
    !definition ||
    (definition.scope !== 'global' &&
      !definition.importedSpell &&
      !definition.copiedFrom)
  )
    return null;
  if (definition.copiedFrom)
    return metadata.isSelectable
      ? null
      : { index, metadata, next: { ...index, available: false } };
  const recorded = sheet.entries.find(
    (entry) =>
      entry.kind === 'spell' &&
      !entry.grantKey &&
      entry.catalogEntryId === definition._id &&
      entry.state.castingClassId === castingClassId,
  );
  const { onList, level } = spellListPlacement({
    list,
    ruleIdentity: metadata.ruleIdentity,
    levels: metadata.levels,
    recordedLevel:
      recorded?.state.kind === 'spell'
        ? (recorded.state.level ?? null)
        : undefined,
  });
  return {
    index,
    metadata,
    next: {
      ...index,
      level,
      name: metadata.name,
      school: metadata.school,
      levels: metadata.levels,
      available: metadata.isSelectable && (onList || Boolean(recorded)),
      recorded: Boolean(recorded),
    },
  };
}

/**
 * Spells whose place on this Spellcasting is not its class list's level
 * alone: an Archetype's added, removed or unresolved Spells and the
 * recorded ones. They are read one by one; every other staged Spell is read
 * by its list's own index range.
 */
function listedSpellKeys({ sheet, castingClassId, list }: Casting) {
  const keys = new Set([
    ...list.added.map((row) => row.ruleIdentity),
    ...list.removed,
    ...list.unresolved,
  ]);
  for (const entry of sheet.entries) {
    if (
      entry.kind !== 'spell' ||
      entry.grantKey ||
      entry.state.castingClassId !== castingClassId
    )
      continue;
    const catalog = sheet.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    if (catalog) keys.add(catalog.ruleIdentity);
  }
  return keys;
}

/**
 * The listed Spells in browser order, from the loaded sheet alone, so a
 * browser page reads them a bounded slice at a time from an offset (#413 F2
 * fix r1): by the name the sheet holds for each, else its rule identity.
 */
export function listedReleaseSpellOrder(casting: Casting) {
  const keys = listedSpellKeys(casting);
  const names = new Map<string, string>();
  for (const row of casting.sheet.catalogEntries) {
    const name = names.get(row.ruleIdentity);
    if (keys.has(row.ruleIdentity) && (name === undefined || row.name < name))
      names.set(row.ruleIdentity, row.name);
  }
  const order = [...keys]
    .map((key) => ({ key, name: names.get(key) ?? key }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        (left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
    )
    .map(({ key }) => key);
  return { keys, order };
}

/** One listed Spell's release row: its metadata and the change it makes. */
export async function readListedReleaseSpell({
  ctx,
  release,
  key,
  readBudget,
  ...casting
}: Casting & {
  ctx: ReadCtx;
  release: Doc<'catalogRelease'>;
  key: string;
  readBudget: SpellReadBudget;
}) {
  const metadata = await readReleaseSpellMetadata(ctx, release._id, key);
  if (!metadata) return null;
  return await releaseSpellChange({ ctx, ...casting, metadata, readBudget });
}

/**
 * Browser info's listed Spells, in browser order: at most `probe.remaining`
 * of them, each counted against it. `isComplete` is false when some were
 * left unread, and browser info then shows every group.
 */
export async function readListedReleaseSpells({
  ctx,
  overlay,
  readBudget,
  probe,
  ...casting
}: Casting & {
  ctx: ReadCtx;
  overlay: Overlay;
  readBudget: SpellReadBudget;
  probe: { remaining: number };
}) {
  const { keys, order } = listedReleaseSpellOrder(casting);
  const changes: ReleaseSpellChange[] = [];
  const release = overlay.release;
  if (!release) return { keys, changes, isComplete: true };
  for (const key of order) {
    if (probe.remaining-- <= 0) return { keys, changes, isComplete: false };
    const change = await readListedReleaseSpell({
      ctx,
      release,
      key,
      readBudget,
      ...casting,
    });
    if (change) changes.push(change);
  }
  return { keys, changes, isComplete: true };
}

/**
 * The release index ranges that hold every other staged Spell a browser
 * page can show: the class list's rows at the page's level, and with other
 * lists the Spells off it (`*` rows, whose level is the lowest one).
 */
export type ReleaseSpellRange =
  | { kind: 'list'; classTag: string }
  | { kind: 'all'; skipTag: string | null }
  | { kind: 'search'; search: string };

export function releaseSpellRanges(
  list: ResolvedArchetypeSpellList,
  filters: ReleaseBrowserFilters,
): ReleaseSpellRange[] {
  const search = filters.search?.trim();
  if (search) return [{ kind: 'search', search }];
  const own: ReleaseSpellRange[] = list.classTag
    ? [{ kind: 'list', classTag: list.classTag }]
    : [];
  if (!filters.includeOtherLists) return own;
  if (filters.spellLevel === undefined) return [{ kind: 'all', skipTag: null }];
  return [...own, { kind: 'all', skipTag: list.classTag }];
}

/** A range position: the last row read, by its index name and creation time. */
export type ReleaseRangePosition = { name: string; creationTime: number };

/**
 * A release range's rows in index order after `after`, read without
 * `.paginate`, so one browser page can continue into the indexed rows'
 * paginated phase (a deployment runs one paginated query per function).
 */
type ReleaseRangeRead = {
  releaseId: Id<'catalogRelease'>;
  range: Exclude<ReleaseSpellRange, { kind: 'search' }>;
  filters: ReleaseBrowserFilters;
  after: ReleaseRangePosition | null;
};

export async function* readReleaseSpellRange(
  ctx: ReadCtx,
  read: ReleaseRangeRead,
) {
  for (const query of releaseRangeQueries(ctx, read))
    for await (const row of query) yield row;
}

function releaseRangeQueries(
  ctx: ReadCtx,
  {
    releaseId,
    range,
    filters: { spellLevel, school },
    after,
  }: ReleaseRangeRead,
) {
  const metadata = () => ctx.db.query('catalogReleaseSpellIndex');
  const classTag = range.kind === 'list' ? range.classTag : '*';
  if (spellLevel !== undefined && school) {
    const index = 'by_releaseId_and_classTag_and_level_and_school_and_name';
    if (!after)
      return [
        metadata().withIndex(index, (q) =>
          q
            .eq('releaseId', releaseId)
            .eq('classTag', classTag)
            .eq('level', spellLevel)
            .eq('school', school),
        ),
      ];
    return [
      metadata().withIndex(index, (q) =>
        q
          .eq('releaseId', releaseId)
          .eq('classTag', classTag)
          .eq('level', spellLevel)
          .eq('school', school)
          .eq('name', after.name)
          .gt('_creationTime', after.creationTime),
      ),
      metadata().withIndex(index, (q) =>
        q
          .eq('releaseId', releaseId)
          .eq('classTag', classTag)
          .eq('level', spellLevel)
          .eq('school', school)
          .gt('name', after.name),
      ),
    ];
  }
  if (spellLevel !== undefined) {
    const index = 'by_releaseId_and_classTag_and_level_and_name';
    if (!after)
      return [
        metadata().withIndex(index, (q) =>
          q
            .eq('releaseId', releaseId)
            .eq('classTag', classTag)
            .eq('level', spellLevel),
        ),
      ];
    return [
      metadata().withIndex(index, (q) =>
        q
          .eq('releaseId', releaseId)
          .eq('classTag', classTag)
          .eq('level', spellLevel)
          .eq('name', after.name)
          .gt('_creationTime', after.creationTime),
      ),
      metadata().withIndex(index, (q) =>
        q
          .eq('releaseId', releaseId)
          .eq('classTag', classTag)
          .eq('level', spellLevel)
          .gt('name', after.name),
      ),
    ];
  }
  if (school) {
    const index = 'by_releaseId_and_classTag_and_school_and_name';
    if (!after)
      return [
        metadata().withIndex(index, (q) =>
          q
            .eq('releaseId', releaseId)
            .eq('classTag', classTag)
            .eq('school', school),
        ),
      ];
    return [
      metadata().withIndex(index, (q) =>
        q
          .eq('releaseId', releaseId)
          .eq('classTag', classTag)
          .eq('school', school)
          .eq('name', after.name)
          .gt('_creationTime', after.creationTime),
      ),
      metadata().withIndex(index, (q) =>
        q
          .eq('releaseId', releaseId)
          .eq('classTag', classTag)
          .eq('school', school)
          .gt('name', after.name),
      ),
    ];
  }
  const index = 'by_releaseId_and_classTag_and_name';
  if (!after)
    return [
      metadata().withIndex(index, (q) =>
        q.eq('releaseId', releaseId).eq('classTag', classTag),
      ),
    ];
  return [
    metadata().withIndex(index, (q) =>
      q
        .eq('releaseId', releaseId)
        .eq('classTag', classTag)
        .eq('name', after.name)
        .gt('_creationTime', after.creationTime),
    ),
    metadata().withIndex(index, (q) =>
      q
        .eq('releaseId', releaseId)
        .eq('classTag', classTag)
        .gt('name', after.name),
    ),
  ];
}

/**
 * One page of a search range's matches, by relevance, from `paginationOpts`'
 * cursor: the browser page's one paginated query (#413 F2 fix r1), so a
 * search with more matches than a page reads continues on the next call.
 */
export async function readReleaseSpellSearch(
  ctx: ReadCtx,
  {
    releaseId,
    search,
    filters: { school },
    paginationOpts,
  }: {
    releaseId: Id<'catalogRelease'>;
    search: string;
    filters: ReleaseBrowserFilters;
    paginationOpts: PaginationOptions;
  },
) {
  return await ctx.db
    .query('catalogReleaseSpellIndex')
    .withSearchIndex('search_name', (q) => {
      const matched = q
        .search('name', search)
        .eq('releaseId', releaseId)
        .eq('classTag', '*');
      return school ? matched.eq('school', school) : matched;
    })
    .paginate(paginationOpts);
}

/** A range row's browser row, or null when the page does not show it. */
export async function releaseRangeRow({
  ctx,
  row,
  range,
  listed,
  filters,
  readBudget,
  ...casting
}: Casting & {
  ctx: ReadCtx;
  row: Metadata;
  range: ReleaseSpellRange;
  listed: ReadonlySet<string>;
  filters: ReleaseBrowserFilters;
  readBudget: SpellReadBudget;
}) {
  if (listed.has(row.ruleIdentity)) return null;
  // The list's own Spells are read by its range.
  if (
    range.kind === 'all' &&
    range.skipTag !== null &&
    Object.hasOwn(row.levels, range.skipTag)
  )
    return null;
  const change = await releaseSpellChange({
    ctx,
    ...casting,
    metadata: row,
    readBudget,
  });
  return change &&
    isShownReleaseChange(change, { ...filters, search: undefined })
    ? change
    : null;
}

export function isShownReleaseChange(
  { metadata, next }: ReleaseSpellChange,
  filters: ReleaseBrowserFilters,
) {
  return metadata.isSelectable && matchesSpellBrowser(next, filters);
}

/**
 * Whether the release replaces this indexed row; the release's own phases
 * then show it, or nothing does.
 */
export async function isReplacedByRelease({
  ctx,
  overlay,
  row,
  readBudget,
  ...casting
}: Casting & {
  ctx: ReadCtx;
  overlay: Overlay;
  row: IndexRow;
  readBudget: SpellReadBudget;
}) {
  const release = overlay.release;
  if (!release) return false;
  let ruleIdentity = row.ruleIdentity;
  if (ruleIdentity === undefined) {
    const definition = await ctx.db.get('catalogEntry', row.catalogEntryId);
    readBudget.accountRead(definition);
    if (!definition) return false;
    ruleIdentity = definition.ruleIdentity;
  }
  const metadata = await readReleaseSpellMetadata(
    ctx,
    release._id,
    ruleIdentity,
  );
  if (!metadata) return false;
  const change = await releaseSpellChange({
    ctx,
    ...casting,
    metadata,
    readBudget,
  });
  return change?.index._id === row._id;
}

export async function releaseSpellBrowseRow({
  ctx,
  sheet,
  row,
  list,
  release,
  readBudget,
}: {
  ctx: ReadCtx;
  sheet: LoadedCharacterSheet;
  row: IndexRow;
  list: ResolvedArchetypeSpellList;
  release: Doc<'catalogRelease'> | null;
  readBudget?: { accountRead(value: unknown): void };
}) {
  const raw = await ctx.db.get('catalogEntry', row.catalogEntryId);
  readBudget?.accountRead(raw);
  // A row stored before #728 may name a deleted definition; it lists nothing.
  if (!raw) return null;
  const definition = release
    ? await candidateDefinition(ctx, release, raw, {
        bytes: 0,
        accountRead: (value) => readBudget?.accountRead(value),
      })
    : raw;
  if (
    definition?.detail.kind !== 'spell' ||
    (definition.scope !== 'global' &&
      !(
        definition.scope === 'campaign' &&
        definition.campaignId === sheet.character.campaignId
      ) &&
      !(
        definition.scope === 'character' &&
        definition.characterId === sheet.character._id
      ))
  )
    throw new ConvexError('Spell does not belong to this Character');
  return {
    catalogEntryId: definition._id,
    ruleIdentity: definition.ruleIdentity,
    name: definition.name,
    school: definition.detail.school ?? '',
    description: definition.detail.description ?? '',
    spellLevel: row.level,
    onList: spellListPlacement({
      list,
      ruleIdentity: definition.ruleIdentity,
      levels: definition.detail.levels ?? {},
      recordedLevel: undefined,
    }).onList,
    recorded: sheet.entries.some(
      (entry) =>
        entry.kind === 'spell' &&
        !entry.grantKey &&
        sheet.catalogEntries.some(
          (catalog) =>
            catalog._id === entry.catalogEntryId &&
            catalog.ruleIdentity === definition.ruleIdentity,
        ) &&
        entry.state.castingClassId === row.castingClassId,
    ),
  };
}

export function matchesSpellBrowser(
  row: IndexRow,
  args: {
    includeOtherLists?: boolean;
    spellLevel?: number;
    school?: string;
    search?: string;
  },
) {
  return (
    (args.includeOtherLists === true || row.available) &&
    (args.spellLevel === undefined || row.level === args.spellLevel) &&
    (!args.school || row.school === args.school) &&
    (!args.search?.trim() ||
      args.search
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .every((term) => row.name.toLowerCase().includes(term)))
  );
}

async function readLegacySpellDefinitions(
  ctx: ReadCtx,
  sheet: LoadedCharacterSheet,
  key: string,
  readBudget: SpellReadBudget,
) {
  const global = await ctx.db
    .query('catalogEntry')
    .withIndex('by_scope_and_ruleIdentity', (q) =>
      q.eq('scope', 'global').eq('ruleIdentity', key),
    )
    .unique();
  readBudget.accountRead(global);
  const personal = await readLegacySpellCopies(
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', sheet.character._id).eq('ruleIdentity', key),
      ),
    readBudget,
  );
  const campaign = sheet.character.campaignId
    ? await readLegacySpellCopies(
        ctx.db
          .query('catalogEntry')
          .withIndex('by_campaignId_and_scope_and_ruleIdentity', (q) =>
            q
              .eq('campaignId', sheet.character.campaignId)
              .eq('scope', 'campaign')
              .eq('ruleIdentity', key),
          ),
        readBudget,
      )
    : [];
  const definitions = [...personal, ...campaign, ...(global ? [global] : [])];
  if (definitions.length > catalogReleaseLimits.spellCopies)
    throw new ConvexError('Spell has too many stable copies');
  return definitions;
}

async function readLegacySpellCopies(
  query: AsyncIterable<Doc<'catalogEntry'>>,
  readBudget: SpellReadBudget,
) {
  const definitions: Doc<'catalogEntry'>[] = [];
  for await (const definition of query) {
    readBudget.accountRead(definition);
    definitions.push(definition);
    if (definitions.length > catalogReleaseLimits.spellCopies)
      throw new ConvexError('Spell has too many stable copies');
  }
  return definitions;
}

/** One Spell browser request's definition reads, together. */
export function createSpellMetadataReadBudget(): SpellReadBudget {
  let bytesRead = 0;
  return {
    accountRead(value) {
      if (value === null || value === undefined) return;
      bytesRead += releaseByteCount(value);
      if (bytesRead > catalogReleaseLimits.spellPageBytes)
        throw new ConvexError(
          'Selected Spell browser metadata exceeds its read resource limit',
        );
    },
  };
}
