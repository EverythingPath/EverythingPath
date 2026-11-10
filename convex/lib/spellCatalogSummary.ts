import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

export const maxSpellBrowserMetadataRows = 128;

type SummaryRow = Pick<
  Doc<'spellCatalogIndex'>,
  | 'characterId'
  | 'castingClassId'
  | 'level'
  | 'school'
  | 'available'
  | 'recorded'
>;
type SummaryGroup =
  | { kind: 'level'; value: number | null }
  | { kind: 'school'; value: string };
type SummaryCounts = {
  count: number;
  availableCount: number;
  unrecordedCount: number;
};

function summaryGroups(row: SummaryRow): SummaryGroup[] {
  return [
    { kind: 'level', value: row.level },
    { kind: 'school', value: row.school },
  ];
}

/** Add counts to one level or school group, creating or removing it. */
async function addToSummaryGroup({
  ctx,
  characterId,
  castingClassId,
  group,
  counts,
}: {
  ctx: MutationCtx;
  characterId: Id<'character'>;
  castingClassId: Id<'catalogEntry'>;
  group: SummaryGroup;
  counts: SummaryCounts;
}) {
  const previous = await ctx.db
    .query('spellCatalogSummary')
    .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
      q
        .eq('characterId', characterId)
        .eq('castingClassId', castingClassId)
        .eq('kind', group.kind)
        .eq('value', group.value),
    )
    .unique();
  if (previous) {
    const next = {
      count: previous.count + counts.count,
      availableCount: previous.availableCount + counts.availableCount,
      unrecordedCount: previous.unrecordedCount + counts.unrecordedCount,
    };
    if (next.count === 0)
      await ctx.db.delete('spellCatalogSummary', previous._id);
    else await ctx.db.patch('spellCatalogSummary', previous._id, next);
    return;
  }
  if (counts.count <= 0) return;
  const existingGroups = await ctx.db
    .query('spellCatalogSummary')
    .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
      q
        .eq('characterId', characterId)
        .eq('castingClassId', castingClassId)
        .eq('kind', group.kind),
    )
    .take(maxSpellBrowserMetadataRows);
  if (existingGroups.length >= maxSpellBrowserMetadataRows)
    throw new ConvexError('Spell catalog has too many levels or schools');
  await ctx.db.insert('spellCatalogSummary', {
    characterId,
    castingClassId,
    ...group,
    ...counts,
  });
}

function rowCounts(row: SummaryRow, delta: number): SummaryCounts {
  return {
    count: delta,
    availableCount: row.available ? delta : 0,
    unrecordedCount: row.available && !row.recorded ? delta : 0,
  };
}

export async function updateSpellCatalogSummary({
  ctx,
  row,
  delta,
}: {
  ctx: MutationCtx;
  row: SummaryRow;
  delta: 1 | -1;
}) {
  if (delta < 0 && row.recorded === undefined) return;
  for (const group of summaryGroups(row))
    await addToSummaryGroup({
      ctx,
      characterId: row.characterId,
      castingClassId: row.castingClassId,
      group,
      counts: rowCounts(row, delta),
    });
}

/** Count many new rows at once: one write per level or school group. */
export async function addSpellCatalogSummaryRows({
  ctx,
  rows,
}: {
  ctx: MutationCtx;
  rows: readonly SummaryRow[];
}) {
  const groups = new Map<
    string,
    { row: SummaryRow; group: SummaryGroup; counts: SummaryCounts }
  >();
  for (const row of rows)
    for (const group of summaryGroups(row)) {
      const key = JSON.stringify([row.characterId, row.castingClassId, group]);
      const added = rowCounts(row, 1);
      const previous = groups.get(key)?.counts;
      groups.set(key, {
        row,
        group,
        counts: {
          count: (previous?.count ?? 0) + added.count,
          availableCount:
            (previous?.availableCount ?? 0) + added.availableCount,
          unrecordedCount:
            (previous?.unrecordedCount ?? 0) + added.unrecordedCount,
        },
      });
    }
  for (const { row, group, counts } of groups.values())
    await addToSummaryGroup({
      ctx,
      characterId: row.characterId,
      castingClassId: row.castingClassId,
      group,
      counts,
    });
}
