import type { ResolvedArchetypeSpellList } from '../../src/lib/character-sheet-archetype-casting';
import { spellListPlacement } from './spellCatalog';
import { catalogReleaseLimits } from '../../src/lib/catalog/release-limits';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import type { LoadedCharacterSheet } from './characterSheet';
import { candidateDefinition } from './catalogCandidateDefinition';
import { readSelectedCatalogBoundary } from './catalogReleaseBoundary';
import { releaseByteCount } from '../../src/lib/catalog/release-schema';

type IndexRow = Doc<'spellCatalogIndex'>;
type Metadata = Doc<'catalogReleaseSpellIndex'>;
type SpellReadBudget = { accountRead(value: unknown): void };
type Summary = (
  | { kind: 'level'; value: number | null }
  | { kind: 'school'; value: string }
) &
  Pick<
    Doc<'spellCatalogSummary'>,
    'count' | 'availableCount' | 'unrecordedCount'
  >;

export async function readReleaseSpellOverlay(ctx: ReadCtx) {
  const { release, control } = await readSelectedCatalogBoundary(ctx);
  const rows = release
    ? await ctx.db
        .query('catalogReleaseSpellIndex')
        .withIndex('by_releaseId_and_classTag_and_name', (q) =>
          q.eq('releaseId', release._id).eq('classTag', '*'),
        )
        .take(catalogReleaseLimits.spellMetadataRows + 1)
    : [];
  if (
    rows.length > catalogReleaseLimits.spellMetadataRows ||
    new TextEncoder().encode(JSON.stringify(rows)).byteLength >
      catalogReleaseLimits.spellMetadataBytes
  )
    throw new ConvexError(
      'Selected Spell browser metadata exceeds its prepared bounds',
    );
  return { release, releaseNumber: control?.releaseNumber ?? null, rows };
}

export async function releaseSpellRows({
  ctx,
  sheet,
  castingClassId,
  list,
  overlay,
  readBudget = createSpellMetadataReadBudget(),
}: {
  ctx: ReadCtx;
  sheet: LoadedCharacterSheet;
  castingClassId: Id<'catalogEntry'>;
  /** The Spellcasting's effective list (#422). */
  list: ResolvedArchetypeSpellList;
  overlay: Awaited<ReturnType<typeof readReleaseSpellOverlay>>;
  readBudget?: SpellReadBudget;
}) {
  const rows: { index: IndexRow; metadata: Metadata; next: IndexRow }[] = [];
  if (!overlay.release) return rows;
  if (!overlay.rows.length) return rows;
  for (const metadata of overlay.rows) {
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
          references.find((row) => row.castingClassId === castingClassId) ??
          null;
        if (index) break;
      }
    }
    if (!index) continue;
    const definition = await ctx.db.get('catalogEntry', index.catalogEntryId);
    readBudget.accountRead(definition);
    // Player copies own their fields, while held identities stop being offered.
    if (
      !definition ||
      (definition.scope !== 'global' &&
        !definition.importedSpell &&
        !definition.copiedFrom)
    )
      continue;
    if (definition.copiedFrom) {
      if (!metadata.isSelectable)
        rows.push({ index, metadata, next: { ...index, available: false } });
      continue;
    }
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
    rows.push({
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
    });
  }
  return rows;
}

export function mergeReleaseSpellSummary(
  base: readonly Summary[],
  changes: Awaited<ReturnType<typeof releaseSpellRows>>,
) {
  const groups = new Map(
    base.map((row) => [JSON.stringify([row.kind, row.value]), { ...row }]),
  );
  for (const { index, metadata, next } of changes) {
    for (const [row, delta] of [
      [index, -1],
      [next, metadata.isSelectable ? 1 : 0],
    ] as const) {
      if (!delta) continue;
      for (const group of [
        { kind: 'level', value: row.level },
        { kind: 'school', value: row.school },
      ] as const) {
        const key = JSON.stringify([group.kind, group.value]);
        const previous = groups.get(key);
        groups.set(key, {
          ...group,
          count: (previous?.count ?? 0) + delta,
          availableCount:
            (previous?.availableCount ?? 0) + Number(row.available) * delta,
          unrecordedCount:
            (previous?.unrecordedCount ?? 0) +
            Number(row.available && !row.recorded) * delta,
        });
      }
    }
  }
  return [...groups.values()].filter((row) => row.count > 0);
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

function createSpellMetadataReadBudget(): SpellReadBudget {
  let bytesRead = 0;
  return {
    accountRead(value) {
      if (value === null || value === undefined) return;
      bytesRead += releaseByteCount(value);
      if (bytesRead > catalogReleaseLimits.spellMetadataBytes)
        throw new ConvexError(
          'Selected Spell browser metadata exceeds its read resource limit',
        );
    },
  };
}
