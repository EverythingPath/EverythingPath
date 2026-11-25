import { ConvexError } from 'convex/values';
import { recordCatalogImpactSpellReference } from './catalogReleaseImpact';
import type { WithoutSystemFields } from 'convex/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { listCatalogDependencies } from './characterSheetData';
import type { LoadedCharacterSheet } from './characterSheet';
import {
  effectiveSpellListLevel,
  type ResolvedArchetypeSpellList,
} from '../../src/lib/character-sheet-archetype-casting';
import {
  addSpellCatalogSummaryRows,
  maxSpellBrowserMetadataRows,
  updateSpellCatalogSummary,
} from './spellCatalogSummary';
import {
  projectSelectedCatalogDefinition,
  readSelectedCatalogBoundary,
} from './catalogReleaseBoundary';
import { spellListName } from '../../src/lib/character-sheet-casting-copy';

const maxCastingListsPerSpell = 64;

/** One Spell's index rows, refusing more casting lists than a sheet allows. */
export async function takeSpellListRows<Row>(query: {
  take(count: number): Promise<Row[]>;
}) {
  const rows = await query.take(maxCastingListsPerSpell + 1);
  if (rows.length > maxCastingListsPerSpell)
    throw new ConvexError('Spell has too many casting lists');
  return rows;
}

export type SpellCatalogSheet = Pick<
  LoadedCharacterSheet,
  'character' | 'entries' | 'catalogEntries'
> & {
  calculated?: {
    spellcastings: readonly {
      classEntryId: string;
      spellList: ResolvedArchetypeSpellList;
    }[];
  };
};

/** A Spellcasting's effective list (#422), or the class's own list. */
export function spellcastingListFor(
  sheet: SpellCatalogSheet,
  castingClassId: string,
  classTag: string | undefined,
): ResolvedArchetypeSpellList {
  return (
    sheet.calculated?.spellcastings.find(
      (casting) => casting.classEntryId === castingClassId,
    )?.spellList ?? {
      classTag: classTag ?? null,
      name: classTag ? spellListName(classTag) : null,
      added: [],
      removed: [],
      unresolved: [],
    }
  );
}

/** Whether a Spell is on an effective list, and the level the browser files it at. */
export function spellListPlacement({
  list,
  ruleIdentity,
  levels,
  recordedLevel,
}: {
  list: ResolvedArchetypeSpellList;
  ruleIdentity: string;
  levels: Readonly<Record<string, number>>;
  /** The recorded Spell's own level, or undefined when it is not recorded. */
  recordedLevel: number | null | undefined;
}) {
  const listLevel = effectiveSpellListLevel(list, { ruleIdentity, levels });
  const lowest = Object.values(levels).length
    ? Math.min(...Object.values(levels))
    : null;
  const onList = typeof listLevel === 'number';
  return {
    onList,
    level: onList
      ? listLevel
      : recordedLevel !== undefined
        ? (recordedLevel ?? lowest)
        : lowest,
  };
}

export async function reconcileSpellDefinition({
  ctx,
  sheet,
  catalogEntryId,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  catalogEntryId: Id<'catalogEntry'>;
}) {
  const rawDefinition = await ctx.db.get('catalogEntry', catalogEntryId);
  const definition = rawDefinition
    ? await projectSelectedCatalogDefinition(ctx, rawDefinition)
    : null;
  if (definition?.detail.kind !== 'spell') return;
  if (!belongsToSheet({ definition, sheet }))
    throw new ConvexError('Spell does not belong to this Character');
  if (definition.importedSpell && definition.scope === 'character') {
    const isNeeded =
      sheet.entries.some(
        (entry) =>
          'catalogEntryId' in entry && entry.catalogEntryId === catalogEntryId,
      ) ||
      sheet.catalogEntries.some(
        (catalog) =>
          catalog._id !== catalogEntryId &&
          listCatalogDependencies(catalog).some(
            ({ id }) => id === catalogEntryId,
          ),
      );
    const browseOnly = isNeeded ? undefined : true;
    if (definition.browseOnly !== browseOnly)
      await ctx.db.patch('catalogEntry', catalogEntryId, { browseOnly });
    sheet.catalogEntries = sheet.catalogEntries.filter(
      (row) => row._id !== catalogEntryId,
    );
    if (isNeeded) sheet.catalogEntries.push({ ...definition, browseOnly });
  }
  const previous = await takeSpellListRows(
    ctx.db
      .query('spellCatalogIndex')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q
          .eq('characterId', sheet.character._id)
          .eq('ruleIdentity', definition.ruleIdentity),
      ),
  );
  for (const row of previous) {
    await updateSpellCatalogSummary({ ctx, row, delta: -1 });
    await ctx.db.delete('spellCatalogIndex', row._id);
  }
  // Rows installed before identity indexing are reconciled without crossing sheets.
  for (const catalog of [
    definition,
    ...sheet.catalogEntries.filter(
      (catalog) => catalog.ruleIdentity === definition.ruleIdentity,
    ),
  ]) {
    const legacyRows = await takeSpellListRows(
      ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_catalogEntryId', (q) =>
          q
            .eq('characterId', sheet.character._id)
            .eq('catalogEntryId', catalog._id),
        ),
    );
    for (const row of legacyRows) {
      if (
        row.characterId !== sheet.character._id ||
        row.ruleIdentity !== undefined
      )
        continue;
      await updateSpellCatalogSummary({ ctx, row, delta: -1 });
      await ctx.db.delete('spellCatalogIndex', row._id);
    }
  }
  await syncSpellCatalogIndex({ ctx, definition, sheet });
}

/**
 * Rewrite a Spell's rows once a definition behind them is gone. They follow a
 * definition the rows still use, else the Character's own definition of that
 * Spell, else the original a deleted copy was made from. With none left, rows
 * naming missing definitions are removed.
 */
export async function reconcileSpellIdentity({
  ctx,
  sheet,
  ruleIdentity,
  removed,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  ruleIdentity: string;
  removed?: Pick<Doc<'catalogEntry'>, '_id' | 'copiedFrom'>;
}) {
  const rows = await takeSpellListRows(
    ctx.db
      .query('spellCatalogIndex')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q
          .eq('characterId', sheet.character._id)
          .eq('ruleIdentity', ruleIdentity),
      ),
  );
  const own = await takeSpellListRows(
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q
          .eq('characterId', sheet.character._id)
          .eq('ruleIdentity', ruleIdentity),
      ),
  );
  const ownPreference = (row: Doc<'catalogEntry'>) =>
    row.copiedFrom ? 2 : row.importedSpell ? 0 : 1;
  const candidates = [
    ...rows.filter((row) => !row.recorded).map((row) => row.catalogEntryId),
    ...rows.filter((row) => row.recorded).map((row) => row.catalogEntryId),
    ...own
      .sort((left, right) => ownPreference(left) - ownPreference(right))
      .map((row) => row._id),
    ...(removed?.copiedFrom ? [removed.copiedFrom] : []),
  ];
  for (const id of new Set(candidates)) {
    if (id === removed?._id) continue;
    const definition = await ctx.db.get('catalogEntry', id);
    if (
      definition?.detail.kind === 'spell' &&
      definition.ruleIdentity === ruleIdentity &&
      belongsToSheet({ definition, sheet })
    )
      return await reconcileSpellDefinition({
        ctx,
        sheet,
        catalogEntryId: id,
      });
  }
  for (const row of rows) {
    if (await ctx.db.get('catalogEntry', row.catalogEntryId)) continue;
    await updateSpellCatalogSummary({ ctx, row, delta: -1 });
    await ctx.db.delete('spellCatalogIndex', row._id);
  }
}

function belongsToSheet({
  definition,
  sheet,
}: {
  definition: Doc<'catalogEntry'>;
  sheet: SpellCatalogSheet;
}) {
  return (
    definition.scope === 'global' ||
    (definition.scope === 'campaign' &&
      definition.campaignId === sheet.character.campaignId) ||
    (definition.scope === 'character' &&
      definition.characterId === sheet.character._id)
  );
}

export async function deleteSpellCatalogIndex(
  ctx: MutationCtx,
  catalogEntryId: Id<'catalogEntry'>,
) {
  const rows = await takeSpellListRows(
    ctx.db
      .query('spellCatalogIndex')
      .withIndex('by_catalogEntryId', (q) =>
        q.eq('catalogEntryId', catalogEntryId),
      ),
  );
  for (const row of rows) {
    await updateSpellCatalogSummary({ ctx, row, delta: -1 });
    await ctx.db.delete('spellCatalogIndex', row._id);
  }
}

/** The Character's casting classes, browse-only seeds included. */
async function readCastingClasses({
  ctx,
  sheet,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
}) {
  // Browse-only classes are not loaded with the sheet, yet a Spellcasting
  // taken later still needs their lists indexed.
  const browseOnlyClasses = await ctx.db
    .query('catalogEntry')
    .withIndex('by_characterId_and_browseOnly_and_detail_kind', (q) =>
      q
        .eq('characterId', sheet.character._id)
        .eq('browseOnly', true)
        .eq('detail.kind', 'class'),
    )
    .take(257);
  if (browseOnlyClasses.length > 256)
    throw new ConvexError('Character has too many classes');
  const loadedIds = new Set(sheet.catalogEntries.map((row) => row._id));
  const classes = [
    ...sheet.catalogEntries,
    ...browseOnlyClasses.filter((row) => !loadedIds.has(row._id)),
  ].filter(
    (row) =>
      row.detail.kind === 'class' &&
      'casting' in row.detail &&
      row.detail.casting,
  );
  if (classes.length > 64)
    throw new ConvexError('Character has too many casting lists');
  return classes;
}

/** The Spell a Spellcasting recorded under this rule identity, if any. */
function findRecordedSpell({
  sheet,
  castingClassId,
  ruleIdentity,
}: {
  sheet: SpellCatalogSheet;
  castingClassId: Id<'catalogEntry'>;
  ruleIdentity: string;
}) {
  const entry = sheet.entries
    .filter(
      (row) =>
        row.kind === 'spell' &&
        !row.grantKey &&
        sheet.catalogEntries.some(
          (catalog) =>
            catalog._id === row.catalogEntryId &&
            catalog.ruleIdentity === ruleIdentity,
        ) &&
        row.state.castingClassId === castingClassId,
    )
    .at(-1);
  if (entry?.kind !== 'spell') return undefined;
  return {
    level: entry.state.level ?? null,
    definition: sheet.catalogEntries.find(
      (catalog) => catalog._id === entry.catalogEntryId,
    ),
  };
}

/** One Spellcasting's browser row for a Spell: its recorded copy, else `spell`. */
function buildSpellIndexRow({
  sheet,
  castingClass,
  ruleIdentity,
  spell,
}: {
  sheet: SpellCatalogSheet;
  castingClass: Doc<'catalogEntry'>;
  ruleIdentity: string;
  spell: {
    _id: Id<'catalogEntry'>;
    name: string;
    school: string;
    levels: Record<string, number>;
  };
}) {
  if (
    castingClass.detail.kind !== 'class' ||
    !('casting' in castingClass.detail) ||
    !castingClass.detail.casting
  )
    return null;
  const recorded = findRecordedSpell({
    sheet,
    castingClassId: castingClass._id,
    ruleIdentity,
  });
  const recordedDetail = recorded?.definition?.detail;
  if (recordedDetail && recordedDetail.kind !== 'spell') return null;
  const selected =
    recorded?.definition && recordedDetail
      ? {
          _id: recorded.definition._id,
          name: recorded.definition.name,
          school: recordedDetail.school ?? '',
          levels: recordedDetail.levels ?? {},
        }
      : spell;
  const { onList, level } = spellListPlacement({
    list: spellcastingListFor(
      sheet,
      castingClass._id,
      castingClass.detail.casting.classTag,
    ),
    ruleIdentity,
    levels: selected.levels,
    recordedLevel: recorded?.level,
  });
  return {
    selectedDefinition: recorded?.definition,
    row: {
      characterId: sheet.character._id,
      ruleIdentity,
      levels: selected.levels,
      catalogEntryId: selected._id,
      castingClassId: castingClass._id,
      level,
      school: selected.school,
      name: selected.name,
      available: onList || Boolean(recorded),
      recorded: Boolean(recorded),
    },
  };
}

async function syncSpellCatalogIndex({
  ctx,
  definition,
  sheet,
}: {
  ctx: MutationCtx;
  definition: Doc<'catalogEntry'>;
  sheet: SpellCatalogSheet;
}) {
  if (definition.detail.kind !== 'spell') return;
  for (const castingClass of await readCastingClasses({ ctx, sheet })) {
    const built = buildSpellIndexRow({
      sheet,
      castingClass,
      ruleIdentity: definition.ruleIdentity,
      spell: {
        _id: definition._id,
        name: definition.name,
        school: definition.detail.school ?? '',
        levels: definition.detail.levels ?? {},
      },
    });
    if (!built) continue;
    await ctx.db.insert('spellCatalogIndex', built.row);
    await recordCatalogImpactSpellReference(
      ctx,
      sheet.character._id,
      built.selectedDefinition ?? definition,
    );
    await updateSpellCatalogSummary({ ctx, row: built.row, delta: 1 });
  }
}

async function countSpellcastingRows({
  ctx,
  characterId,
  castingClassId,
}: {
  ctx: MutationCtx;
  characterId: Id<'character'>;
  castingClassId: Id<'catalogEntry'>;
}) {
  const levels = await ctx.db
    .query('spellCatalogSummary')
    .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
      q
        .eq('characterId', characterId)
        .eq('castingClassId', castingClassId)
        .eq('kind', 'level'),
    )
    .take(maxSpellBrowserMetadataRows + 1);
  return levels.reduce((total, row) => total + row.count, 0);
}

async function readSpellcastingRows({
  ctx,
  characterId,
  castingClassId,
}: {
  ctx: MutationCtx;
  characterId: Id<'character'>;
  castingClassId: Id<'catalogEntry'>;
}) {
  const rows = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_castingClassId_and_name', (q) =>
      q.eq('characterId', characterId).eq('castingClassId', castingClassId),
    )
    .take(8193);
  if (rows.length > 8192)
    throw new ConvexError('Spellcasting catalog is too large to index');
  return rows;
}

/**
 * The casting list a class should copy its missing rows from: the one with
 * the most rows, when it has more than the class itself.
 */
export function selectSpellcastingTemplate({
  counts,
  castingClassId,
}: {
  counts: ReadonlyMap<Id<'catalogEntry'>, number>;
  castingClassId: Id<'catalogEntry'>;
}) {
  let template: { id: Id<'catalogEntry'>; count: number } | undefined;
  for (const [id, count] of counts)
    if (id !== castingClassId && count > (template?.count ?? 0))
      template = { id, count };
  return template && template.count > (counts.get(castingClassId) ?? 0)
    ? template.id
    : undefined;
}

/**
 * Casting classes added after the Character's Spells were indexed get their
 * browser rows, taken from the casting list that indexes the most Spells.
 */
export async function indexSpellcastingClasses({
  ctx,
  sheet,
  castingClassIds,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  castingClassIds: readonly Id<'catalogEntry'>[];
}) {
  const targets = sheet.catalogEntries.filter(
    (row) =>
      castingClassIds.includes(row._id) &&
      row.detail.kind === 'class' &&
      'casting' in row.detail &&
      row.detail.casting,
  );
  if (!targets.length) return;
  const characterId = sheet.character._id;
  const counts = new Map<Id<'catalogEntry'>, number>();
  for (const castingClass of [
    ...(await readCastingClasses({ ctx, sheet })),
    ...targets,
  ])
    if (!counts.has(castingClass._id))
      counts.set(
        castingClass._id,
        await countSpellcastingRows({
          ctx,
          characterId,
          castingClassId: castingClass._id,
        }),
      );
  for (const castingClass of targets) {
    const templateId = selectSpellcastingTemplate({
      counts,
      castingClassId: castingClass._id,
    });
    if (!templateId) continue;
    await copySpellcastingRows({ ctx, sheet, castingClass, templateId });
    counts.set(
      castingClass._id,
      await countSpellcastingRows({
        ctx,
        characterId,
        castingClassId: castingClass._id,
      }),
    );
  }
}

/**
 * A row's Spell: its rule identity and, when it has no level snapshot, the
 * levels of its definition. A row whose definition is gone or not the
 * Character's to use has no definition, so it is never copied.
 */
async function readRowSpell({
  ctx,
  sheet,
  row,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  row: Doc<'spellCatalogIndex'>;
}) {
  const stored = await ctx.db.get('catalogEntry', row.catalogEntryId);
  if (
    stored?.detail.kind !== 'spell' ||
    !belongsToSheet({ definition: stored, sheet })
  )
    return { ruleIdentity: row.ruleIdentity, definition: null };
  const projected = row.levels
    ? null
    : await projectSelectedCatalogDefinition(ctx, stored);
  return {
    ruleIdentity: row.ruleIdentity ?? stored.ruleIdentity,
    definition: {
      _id: row.catalogEntryId,
      name: row.name,
      school: row.school,
      levels:
        row.levels ??
        (projected?.detail.kind === 'spell' ? projected.detail.levels : {}) ??
        {},
    },
  };
}

/**
 * Index for one casting class the Spells another class's rows hold. A Spell
 * whose template row names a deleted definition has its rows repaired
 * instead.
 */
async function copySpellcastingRows({
  ctx,
  sheet,
  castingClass,
  templateId,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  castingClass: Doc<'catalogEntry'>;
  templateId: Id<'catalogEntry'>;
}) {
  const characterId = sheet.character._id;
  const indexed = new Set<string>();
  for (const row of await readSpellcastingRows({
    ctx,
    characterId,
    castingClassId: castingClass._id,
  })) {
    const { ruleIdentity } = row.ruleIdentity
      ? row
      : await readRowSpell({ ctx, sheet, row });
    if (ruleIdentity) indexed.add(ruleIdentity);
  }
  const added = [];
  const stale = new Set<string>();
  for (const row of await readSpellcastingRows({
    ctx,
    characterId,
    castingClassId: templateId,
  })) {
    const { ruleIdentity, definition } = await readRowSpell({
      ctx,
      sheet,
      row,
    });
    if (!ruleIdentity || indexed.has(ruleIdentity)) continue;
    indexed.add(ruleIdentity);
    if (!definition) {
      stale.add(ruleIdentity);
      continue;
    }
    const built = buildSpellIndexRow({
      sheet,
      castingClass,
      ruleIdentity,
      spell: definition,
    });
    if (!built) continue;
    await ctx.db.insert('spellCatalogIndex', built.row);
    added.push(built.row);
  }
  await addSpellCatalogSummaryRows({ ctx, rows: added });
  for (const ruleIdentity of stale)
    await reconcileSpellIdentity({ ctx, sheet, ruleIdentity });
}

/** A casting copy has the same list facts; move its lightweight browser state. */
export async function reconcileCopiedSpellcasting({
  ctx,
  sheet,
  originalId,
  copyId,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  originalId: Id<'catalogEntry'>;
  copyId: Id<'catalogEntry'>;
}) {
  const copy = sheet.catalogEntries.find((row) => row._id === copyId);
  if (copy?.detail.kind !== 'class') return;
  const rows = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_castingClassId_and_name', (q) =>
      q.eq('characterId', sheet.character._id).eq('castingClassId', originalId),
    )
    .take(8193);
  if (rows.length > 8192)
    throw new ConvexError('Spellcasting catalog is too large to copy');
  for (const row of rows)
    await ctx.db.patch('spellCatalogIndex', row._id, {
      castingClassId: copyId,
    });
  const summaries = await ctx.db
    .query('spellCatalogSummary')
    .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
      q.eq('characterId', sheet.character._id).eq('castingClassId', originalId),
    )
    .take(257);
  if (summaries.length > 256)
    throw new ConvexError('Spell catalog has too many levels or schools');
  for (const row of summaries)
    await ctx.db.patch('spellCatalogSummary', row._id, {
      castingClassId: copyId,
    });
}

/** Remove one bounded chunk of a deleted Character's shared browser rows. */
export async function cleanupCharacterSpellIndex(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  const rows = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_ruleIdentity', (q) =>
      q.eq('characterId', characterId),
    )
    .take(64);
  for (const row of rows) {
    await updateSpellCatalogSummary({ ctx, row, delta: -1 });
    await ctx.db.delete('spellCatalogIndex', row._id);
  }
  return rows.length === 64;
}

/** Recalculate a changed list from indexed facts, without loading browse descriptions. */
export async function reconcileSpellcastingDefinition({
  ctx,
  sheet,
  catalogEntryId,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  catalogEntryId: Id<'catalogEntry'>;
}) {
  // #422: the effective list after Archetypes, else the class's own.
  const listOf = (classTag: string | undefined) =>
    spellcastingListFor(sheet, catalogEntryId, classTag);
  const definition = sheet.catalogEntries.find(
    (row) => row._id === catalogEntryId,
  );
  if (definition?.detail.kind !== 'class') return;
  const casting =
    'casting' in definition.detail ? definition.detail.casting : undefined;
  const rows = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_castingClassId_and_name', (q) =>
      q
        .eq('characterId', sheet.character._id)
        .eq('castingClassId', catalogEntryId),
    )
    .take(8193);
  if (rows.length > 8192)
    throw new ConvexError('Spellcasting catalog is too large to edit');
  const summaries = await ctx.db
    .query('spellCatalogSummary')
    .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
      q
        .eq('characterId', sheet.character._id)
        .eq('castingClassId', catalogEntryId),
    )
    .take(257);
  if (summaries.length > 256)
    throw new ConvexError('Spell catalog has too many levels or schools');
  for (const row of summaries)
    await ctx.db.delete('spellCatalogSummary', row._id);
  const groups = new Map<
    string,
    WithoutSystemFields<Doc<'spellCatalogSummary'>>
  >();
  const hasLegacyRows = rows.some((row) => row.levels === undefined);
  const boundary = hasLegacyRows
    ? await readSelectedCatalogBoundary(ctx)
    : undefined;
  for (const row of rows) {
    const stored =
      row.levels === undefined
        ? await ctx.db.get('catalogEntry', row.catalogEntryId)
        : null;
    const legacyDefinition = stored
      ? await projectSelectedCatalogDefinition(ctx, stored, boundary)
      : null;
    const levels =
      row.levels ??
      (legacyDefinition?.detail.kind === 'spell'
        ? legacyDefinition.detail.levels
        : {}) ??
      {};
    const recorded = sheet.entries
      .filter(
        (entry) =>
          entry.kind === 'spell' &&
          !entry.grantKey &&
          entry.catalogEntryId === row.catalogEntryId &&
          entry.state.castingClassId === catalogEntryId,
      )
      .at(-1);
    const { onList, level } = spellListPlacement({
      list: listOf(casting?.classTag),
      ruleIdentity: row.ruleIdentity ?? '',
      levels,
      recordedLevel:
        recorded?.state.kind === 'spell'
          ? (recorded.state.level ?? null)
          : undefined,
    });
    const available = onList || Boolean(recorded);
    await ctx.db.patch('spellCatalogIndex', row._id, {
      levels,
      level,
      available,
      recorded: Boolean(recorded),
    });
    const values = [
      { kind: 'level', value: level },
      { kind: 'school', value: row.school },
    ] as const;
    for (const value of values) {
      const key = JSON.stringify(value);
      const previous = groups.get(key);
      groups.set(key, {
        ...value,
        characterId: sheet.character._id,
        castingClassId: catalogEntryId,
        count: (previous?.count ?? 0) + 1,
        availableCount: (previous?.availableCount ?? 0) + Number(available),
        unrecordedCount:
          (previous?.unrecordedCount ?? 0) + Number(available && !recorded),
      });
    }
  }
  if (groups.size > 256)
    throw new ConvexError('Spell catalog has too many levels or schools');
  for (const group of groups.values())
    await ctx.db.insert('spellCatalogSummary', group);
}
