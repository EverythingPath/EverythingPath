import {
  readSelectedCatalogBoundary,
  readSelectedCatalogResources,
  readSelectedRetired,
} from './catalogReleaseBoundary';
import {
  listCatalogReferences,
  type CatalogReference,
} from '../../src/lib/catalog-copy-references';
import {
  readReferencedCatalogDefinitions,
  type CatalogLoadReference,
} from './catalogCopies';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { jsonBytes } from '../../src/lib/json-bytes';
import { isUnarmedStrike } from '../../src/lib/character-sheet-attack-types';
import {
  catalogRuleLookupDetailKind,
  catalogRuleLookupKey,
  listCatalogRuleLookups,
  selectCatalogRuleLookupRows,
} from '../../src/lib/catalog-rule-lookups';
import {
  abilityKeys,
  type calculateCharacterSheet,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';
import { calculateActiveCharacterSheet } from './catalogReleaseCompatibility';

function isBaseCatalogEntry(
  entry: Doc<'catalogEntry'>,
): entry is Extract<Doc<'catalogEntry'>, { detail: { kind: 'base' } }> {
  return entry.detail.kind === 'base';
}

/** A Character's recorded sheet as the calculation reads it. */
export function buildCharacterSheetInput({
  character,
  entries,
  catalogEntries,
  resources,
  retired,
}: {
  character: Pick<
    Doc<'character'>,
    'kind' | 'sheetMode' | 'familiarBaseCreatureKey'
  >;
  entries: readonly Doc<'characterSheetEntry'>[];
  catalogEntries: CharacterSheetInput['catalogEntries'];
  resources: CharacterSheetInput['resources'];
  retired?: CharacterSheetInput['retired'];
}): CharacterSheetInput {
  const baseState = entries.find((entry) => entry.kind === 'base')?.state;
  return {
    entries,
    catalogEntries,
    characterKind: character.kind,
    sheetMode: character.sheetMode,
    companionProgression: baseState?.companionProgression,
    cohortEquivalence: baseState?.cohortEquivalence,
    familiarBaseCreatureKey: character.familiarBaseCreatureKey,
    resources,
    ...(retired ? { retired } : {}),
  };
}

export function requireAbilityScore(score: number) {
  if (!Number.isFinite(score))
    throw new ConvexError('Enter finite ability scores');
  if (!Number.isSafeInteger(score))
    throw new ConvexError('Enter whole ability scores');
}

export function requireWholeCalculatedAbilities(
  calculated: Pick<ReturnType<typeof calculateCharacterSheet>, 'abilities'>,
) {
  for (const ability of abilityKeys)
    requireAbilityScore(calculated.abilities[ability].score);
}

export const maxCharacterChildRows = 4096;
export const maxAcceptedWarnings = 8192;
export const maxPreparedCharacters = 256;

export type CharacterSheetReadOptions = {
  trustedLinkedInputs?: boolean;
  resourceLimits?: {
    maximumTotalBytesRead: number;
    maximumReferences: number;
  };
  includeAcceptedWarnings?: boolean;
};

export function createReadBudget(
  resourceLimits: CharacterSheetReadOptions['resourceLimits'],
) {
  let totalBytesRead = 0;
  const externalReferences = new Set<string>();
  return {
    accountRead(value: unknown) {
      if (!resourceLimits) return;
      totalBytesRead += jsonBytes(value);
      if (totalBytesRead > resourceLimits.maximumTotalBytesRead)
        throw new ConvexError(
          'Recorded sheet exceeds the backfill read resource limit',
        );
    },
    accountReference(id: string) {
      if (!resourceLimits) return;
      externalReferences.add(id);
      if (externalReferences.size > resourceLimits.maximumReferences)
        throw new ConvexError(
          'Recorded sheet exceeds the backfill reference resource limit',
        );
    },
  };
}

export async function readCharacterSheetData(
  ctx: ReadCtx,
  character: Doc<'character'>,
  referencesOrOptions: CatalogLoadReference[] | CharacterSheetReadOptions = [],
  options: CharacterSheetReadOptions = {},
) {
  const additionalReferences = Array.isArray(referencesOrOptions)
    ? referencesOrOptions
    : [];
  const readOptions = Array.isArray(referencesOrOptions)
    ? options
    : referencesOrOptions;
  return await readCharacterSheetDataWithBudget(
    ctx,
    character,
    additionalReferences,
    readOptions,
    createReadBudget(readOptions.resourceLimits),
  );
}

export async function readCharacterSheetDataWithBudget(
  ctx: ReadCtx,
  character: Doc<'character'>,
  additionalReferences: CatalogLoadReference[],
  { resourceLimits, includeAcceptedWarnings = true }: CharacterSheetReadOptions,
  readBudget: ReturnType<typeof createReadBudget>,
) {
  // One selected boundary serves every release read of this sheet.
  const boundary = await readSelectedCatalogBoundary(ctx, readBudget);
  const { calculationIdentity } = boundary;
  const resources = await readSelectedCatalogResources(
    ctx,
    readBudget,
    boundary,
  );
  async function readRows<T>(
    query: AsyncIterable<T> & { take(count: number): Promise<T[]> },
    maximumRows: number,
  ) {
    if (!resourceLimits) return await query.take(maximumRows + 1);
    const rows: T[] = [];
    for await (const row of query) {
      readBudget.accountRead(row);
      if (rows.length >= maximumRows)
        throw new ConvexError(
          'Recorded sheet exceeds the backfill read resource limit',
        );
      rows.push(row);
    }
    return rows;
  }
  const entries = await readRows(
    ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', character._id)),
    maxCharacterChildRows,
  );
  const localDefinitions = await readRows(
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', character._id).eq('browseOnly', undefined),
      ),
    maxCharacterChildRows,
  );
  const acceptedWarnings = includeAcceptedWarnings
    ? await readRows(
        ctx.db
          .query('acceptedWarning')
          .withIndex('by_characterId', (q) =>
            q.eq('characterId', character._id),
          ),
        maxAcceptedWarnings,
      )
    : [];
  if (
    entries.length > maxCharacterChildRows ||
    localDefinitions.length > maxCharacterChildRows
  )
    throw new ConvexError('Character sheet is too large to load');
  const referencedDefinitions = await readReferencedCatalogDefinitions(
    ctx,
    character,
    localDefinitions,
    [
      ...entries.flatMap((entry) =>
        listCatalogReferences(entry).map((reference) => ({
          ...reference,
          refusalMessage:
            reference.kind === 'class'
              ? 'Class does not belong to this Character'
              : entry.kind === 'archetype' &&
                  entry.state.replaces?.some(
                    (replacement) =>
                      replacement.catalogEntryId === reference.id,
                  )
                ? 'Replacement feature does not belong to this Character'
                : entry.kind === 'base'
                  ? 'Base scores do not belong to this Character'
                  : entry.kind === 'manual'
                    ? 'Personal adjustment does not belong to this Character'
                    : 'Catalog Entry does not belong to this Character',
        })),
      ),
      ...additionalReferences,
    ],
    readBudget,
    boundary,
  );
  // Browse-only definitions load when referenced, or when a rule finds them
  // by what they are rather than by a stored reference.
  async function readBoundedRows<T>(
    query: AsyncIterable<T> & { take(count: number): Promise<T[]> },
  ) {
    const rows = await readRows(query, maxCharacterChildRows);
    if (rows.length > maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large to load');
    return rows;
  }
  const browseOnlyRowsByKind = new Map<string, Doc<'catalogEntry'>[]>();
  async function readBrowseOnlyRows(kind: 'class' | 'item') {
    const known = browseOnlyRowsByKind.get(kind);
    if (known) return known;
    const rows = await readBoundedRows(
      ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_browseOnly_and_detail_kind', (q) =>
          q
            .eq('characterId', character._id)
            .eq('browseOnly', true)
            .eq('detail.kind', kind),
        ),
    );
    browseOnlyRowsByKind.set(kind, rows);
    return rows;
  }
  async function readIdentityRows(ruleIdentity: string) {
    return await readBoundedRows(
      ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', character._id).eq('ruleIdentity', ruleIdentity),
        ),
    );
  }
  let definitions = referencedDefinitions;
  const resolvedLookups = new Set<string>();
  for (;;) {
    const lookups = listCatalogRuleLookups({
      entries,
      catalogEntries: definitions,
    }).filter((lookup) => !resolvedLookups.has(catalogRuleLookupKey(lookup)));
    if (!lookups.length) break;
    if (resolvedLookups.size + lookups.length > maxCharacterChildRows)
      throw new ConvexError('Character has too many catalog lookups');
    const references: CatalogLoadReference[] = [];
    for (const lookup of lookups) {
      resolvedLookups.add(catalogRuleLookupKey(lookup));
      const detailKind = catalogRuleLookupDetailKind(lookup);
      const candidates = [
        ...(lookup.kind === 'weaponBaseType'
          ? []
          : await readIdentityRows(lookup.ruleIdentity)),
        ...(detailKind ? await readBrowseOnlyRows(detailKind) : []),
      ];
      for (const row of selectCatalogRuleLookupRows(
        lookup,
        candidates,
        definitions,
      ))
        references.push({ id: row._id, kind: 'definition' });
      if (
        lookup.kind !== 'castsSpell' ||
        definitions.some(
          (definition) => definition.ruleIdentity === lookup.ruleIdentity,
        )
      )
        continue;
      // A required Spell may be global or campaign content on a casting list.
      const spellRows = await readRows(
        ctx.db
          .query('spellCatalogIndex')
          .withIndex('by_characterId_and_ruleIdentity', (q) =>
            q
              .eq('characterId', character._id)
              .eq('ruleIdentity', lookup.ruleIdentity),
          ),
        64,
      );
      if (spellRows.length > 64)
        throw new ConvexError('Spell has too many casting lists');
      // A row whose definition is gone is skipped; the remaining rows decide.
      for (const row of spellRows)
        references.push({
          id: row.catalogEntryId,
          kind: 'definition',
          optional: true,
          refusalMessage: 'Spell does not belong to this Character',
        });
    }
    if (references.length)
      definitions = await readReferencedCatalogDefinitions(
        ctx,
        character,
        definitions,
        references,
        readBudget,
        boundary,
      );
  }
  if (acceptedWarnings.length > maxAcceptedWarnings)
    throw new ConvexError('Character has too many accepted warnings');
  const base = entries.find((entry) => entry.kind === 'base');
  const baseScoresEntry = base
    ? definitions.find((entry) => entry._id === base.catalogEntryId)
    : null;
  if (
    baseScoresEntry?.characterId !== character._id ||
    !isBaseCatalogEntry(baseScoresEntry)
  )
    throw new ConvexError('Base scores do not belong to this Character');
  // Recorded state and future Grants both depend on local catalog definitions.
  // Validate the complete prepared catalog, including untouched nested grants.
  const catalogEntries: Doc<'catalogEntry'>[] = [...definitions];
  const definitionsById = new Map<string, Doc<'catalogEntry'>>(
    definitions.map((row) => [row._id, row]),
  );
  const dependencies = definitions.flatMap(listCatalogDependencies);

  function requireDefinition(id: string, message: string) {
    const definition = definitionsById.get(id);
    if (!definition) throw new ConvexError(message);
    return definition;
  }
  function readClassDefinition(
    classEntryId: string,
    message = 'Class does not belong to this Character',
  ) {
    const local = definitionsById.get(classEntryId);
    if (local?.detail.kind === 'class') return local;
    // Missing definitions remain Unspecified. Existing foreign references fail.
    if (local) throw new ConvexError(message);
    return null;
  }
  for (const { id, kind } of dependencies) {
    if (kind === 'definition')
      requireDefinition(
        id,
        'Catalog dependency does not belong to this Character',
      );
    else if (kind === 'class')
      readClassDefinition(
        id,
        'Class counterpart does not belong to this Character',
      );
  }
  for (const classId of base?.state.favoredClassIds ?? [])
    readClassDefinition(classId);
  // A missing row is a removed reference, kept for repair.
  async function isOwnEntry(entryId: Id<'characterSheetEntry'>) {
    let row = entries.find((candidate) => candidate._id === entryId);
    if (!row) {
      readBudget.accountReference(entryId);
      row = (await ctx.db.get('characterSheetEntry', entryId)) ?? undefined;
      readBudget.accountRead(row ?? null);
    }
    return !row || row.characterId === character._id;
  }
  for (const entry of entries) {
    // A removed target stays recorded; another Character's never loads.
    if (
      entry.kind === 'spellEffect' &&
      entry.state.onItem &&
      !isUnarmedStrike(entry.state.onItem.entry) &&
      !(await isOwnEntry(entry.state.onItem.entry))
    )
      throw new ConvexError(
        'Spell Effect target does not belong to this Character',
      );
    if (entry.kind === 'attackRoutine') {
      const weaponIds = [
        entry.state.weaponEntryId,
        ...(entry.state.naturalAttackEntryIds ?? []),
      ];
      if (entry.state.offHand?.kind === 'weapon')
        weaponIds.push(entry.state.offHand.weaponEntryId);
      if (entry.state.ammunitionEntryId)
        weaponIds.push(entry.state.ammunitionEntryId);
      for (const weaponId of weaponIds) {
        if (isUnarmedStrike(weaponId)) continue;
        if (!(await isOwnEntry(weaponId)))
          throw new ConvexError('Weapon does not belong to this Character');
      }
      continue;
    }
    if (
      entry.kind === 'base' ||
      entry.kind === 'abilityDamage' ||
      entry.kind === 'abilityDrain'
    )
      continue;
    if (entry.kind === 'classLevel') {
      if (entry.state.classEntryId !== null)
        readClassDefinition(entry.state.classEntryId);
      for (const advance of entry.state.castingAdvances ?? [])
        if (advance?.classEntryId) readClassDefinition(advance.classEntryId);
      continue;
    }
    const definition = requireDefinition(
      entry.catalogEntryId,
      entry.kind === 'manual'
        ? 'Personal adjustment does not belong to this Character'
        : 'Catalog Entry does not belong to this Character',
    );
    if (definition.detail.kind !== entry.kind)
      throw new ConvexError('Catalog Entry does not match this sheet entry');
    if (entry.kind === 'spell' && entry.state.castingClassId)
      readClassDefinition(entry.state.castingClassId);
    if (entry.kind === 'archetype') {
      if (entry.state.classEntryId)
        readClassDefinition(entry.state.classEntryId);
      for (const replacement of entry.state.replaces ?? []) {
        const target = requireDefinition(
          replacement.catalogEntryId,
          'Replacement feature does not belong to this Character',
        );
        if (target.detail.kind !== 'classFeature')
          throw new ConvexError('Choose a class feature to replace');
      }
    }
  }
  const retired = await readSelectedRetired(
    ctx,
    character._id,
    catalogEntries,
    readBudget,
    boundary,
  );
  const { current: calculated, permanent } = calculateActiveCharacterSheet(
    buildCharacterSheetInput({
      character,
      entries,
      catalogEntries,
      resources,
      retired,
    }),
    calculationIdentity,
  );
  requireWholeCalculatedAbilities(calculated);
  requireWholeCalculatedAbilities(permanent);
  const { resolvedEntries: _resolvedEntries, ...permanentCalculated } =
    permanent;
  const classLevels = entries
    .filter((entry) => entry.kind === 'classLevel')
    .sort((a, b) => a.state.position - b.state.position);
  return {
    character,
    resources,
    retired,
    calculationIdentity,
    entries: [
      ...entries.filter((entry) => entry.kind === 'base'),
      ...classLevels,
      ...entries.filter(
        (entry) => entry.kind !== 'base' && entry.kind !== 'classLevel',
      ),
    ],
    catalogEntries,
    baseScoresEntry,
    calculated,
    permanentCalculated,
    permanentResolvedEntries: permanent.resolvedEntries,
    acceptedWarnings,
    revision: character.sheetRevision ?? 0,
    lastOperationId: character.sheetLastOperationId ?? null,
    updatedBy: character.sheetUpdatedBy ?? null,
  };
}

export type CatalogDependency = CatalogReference;

/** Every catalog reference, including future Grants and modifier conditions. */
export function listCatalogDependencies(
  definition: Doc<'catalogEntry'>,
): CatalogDependency[] {
  return listCatalogReferences(definition);
}
