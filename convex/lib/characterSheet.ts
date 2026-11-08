import { characterNotFound } from '../../src/lib/character-not-found';
import {
  projectCampaignCopies,
  type CatalogLoadReference,
} from './catalogCopies';
import { getCompanionSupportingEntryKeys } from './companionRelationshipGraph';
import { markCatalogImpactDirty } from './catalogReleaseImpact';
import { listCatalogReferences } from '../../src/lib/catalog-copy-references';
import { resolveCharacterSheetGrants } from '../../src/lib/character-sheet-grants';
import { ConvexError } from 'convex/values';
import { representativeRaceCatalog } from './representativeRaceCatalog';
import { representativeClassCatalog } from './representativeClassCatalog';
import { representativeSpellCatalog } from './representativeSpellCatalog';
import { installPreparedSpells } from './spellCatalogInstall';
import {
  indexSpellcastingClasses,
  reconcileSpellcastingDefinition,
} from './spellCatalog';
import type { ResolvedArchetypeSpellList } from '../../src/lib/character-sheet-archetype-casting';
import { representativeArchetypeCatalog } from './representativeArchetypeCatalog';
import { representativeWeaponCatalog } from './representativeWeaponCatalog';
import {
  representativeEquipmentCatalog,
  representativeWondrousItemCatalog,
  representativeItemAbilityCatalog,
  representativeMagicItemCatalog,
} from './representativeItemCatalog';
import { representativeGrantedSpellCatalog } from './representativeSpellcastingCatalog';
import { representativeSelectionCatalog } from './representativeSelectionCatalog';
import { seedRepresentativeCatalog } from './representativeSeeds';
import { reconcileCompanionRelationships } from './companionRelationships';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import {
  abilityKeys,
  abilityTargets,
  defaultAbilityScores,
  defaultCreationSettings,
  type AbilityScores,
  type SheetWarning,
} from '../../src/lib/character-sheet';
import { requireCharacterAccess, type CharacterScope } from './characterAccess';
import { updateCanonicalCharacter } from './canonicalCharacters';
import {
  cleanupCharacterSpellIndex,
  deleteSpellCatalogIndex,
} from './spellCatalog';
import { internal } from '../_generated/api';
import {
  calculateActiveCharacterSheet,
  requireCompatibleActiveRelease,
} from './catalogReleaseCompatibility';
import { warningsForAcceptanceThroughDormancy } from '../../src/lib/character-sheet-dormant-acceptance';
import { applyCompanionToSheet } from './characterSheetCompanion';
import {
  buildCharacterSheetInput,
  readCharacterSheetData,
  readCharacterSheetDataWithBudget,
  type CharacterSheetReadOptions,
  createReadBudget,
  maxCharacterChildRows,
  maxAcceptedWarnings,
  requireAbilityScore,
  requireWholeCalculatedAbilities,
} from './characterSheetData';

export function isManualCatalogEntry(
  entry: Doc<'catalogEntry'>,
): entry is Extract<Doc<'catalogEntry'>, { detail: { kind: 'manual' } }> {
  return entry.detail.kind === 'manual';
}

const seededRuleIdentities = new Set<string>(
  [
    ...representativeSelectionCatalog,
    ...representativeClassCatalog,
    ...representativeArchetypeCatalog,
    ...representativeWeaponCatalog,
    ...representativeEquipmentCatalog,
    ...representativeWondrousItemCatalog,
    ...representativeItemAbilityCatalog,
    ...representativeMagicItemCatalog,
    ...representativeRaceCatalog,
    ...representativeGrantedSpellCatalog,
  ].map((definition) => definition.ruleIdentity),
);

/** Rows every new sheet seeds; they outlive any entry that references them. */
export function isSeededCatalogEntry(entry: Doc<'catalogEntry'>) {
  return (
    entry.scope === 'character' &&
    entry.copiedFrom === undefined &&
    seededRuleIdentities.has(entry.ruleIdentity)
  );
}

export function requireFixtureCampaign(
  campaign: Doc<'campaign'>,
  message = "Character sheets aren't available for this campaign yet.",
) {
  if (!campaign.e2eFixture) throw new ConvexError(message);
}

export function requireCharacterLevel(level: number) {
  if (!Number.isInteger(level) || level < 0 || level >= maxCharacterChildRows)
    throw new ConvexError(
      `Enter a whole level between 0 and ${maxCharacterChildRows - 1}`,
    );
}

export async function insertClassLevel(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  position: number,
) {
  const entryId = await ctx.db.insert('characterSheetEntry', {
    characterId,
    kind: 'classLevel',
    active: true,
    state: { kind: 'classLevel', classEntryId: null, position, hpGained: null },
  });
  const entry = await ctx.db.get('characterSheetEntry', entryId);
  if (entry?.kind !== 'classLevel')
    throw new ConvexError('Class Level is unavailable');
  return entry;
}

export async function initializeCharacterSheet(
  ctx: MutationCtx,
  {
    characterId,
    operationId,
    updatedBy,
    sheetMode = 'full',
    level = 1,
    scores = defaultAbilityScores,
  }: {
    characterId: Id<'character'>;
    operationId: string;
    updatedBy: string;
    sheetMode?: 'militiaOnly' | 'full';
    level?: number;
    scores?: AbilityScores;
  },
) {
  requireCharacterLevel(level);
  for (const ability of abilityKeys) requireAbilityScore(scores[ability]);
  const existing = await ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .first();
  if (existing) throw new ConvexError('Character already has a sheet');
  const character = await ctx.db.get('character', characterId);
  if (!character) throw new ConvexError(characterNotFound);
  const campaign = character.campaignId
    ? await ctx.db.get('campaign', character.campaignId)
    : null;
  // Representative seeds are fixture and demo data; production sheets get none.
  const isPrepared = character.campaignId
    ? Boolean(campaign?.e2eFixture)
    : Boolean(character.sheetDemo);
  const catalogEntryId = await ctx.db.insert('catalogEntry', {
    scope: 'character',
    characterId,
    name: 'Base scores',
    ruleIdentity: `base:${characterId}`,
    stacksWithItself: false,
    detail: { kind: 'base' },
    sources: [],
    modifiers: abilityKeys.map((ability) => ({
      target: abilityTargets[ability],
      bonusType: 'base',
      value: scores[ability],
    })),
  });
  await ctx.db.insert('characterSheetEntry', {
    characterId,
    kind: 'base',
    active: true,
    catalogEntryId,
    state: {
      kind: 'base',
      ...defaultCreationSettings,
    },
  });
  if (isPrepared) {
    // Isolated prepared sheets carry representative definitions, not a Catalog Release.
    await seedRepresentativeCatalog(
      {
        insert: (definition) => ctx.db.insert('catalogEntry', definition),
        replace: (id, definition) =>
          ctx.db.replace('catalogEntry', id, definition),
        patch: (id, fields) => ctx.db.patch('catalogEntry', id, fields),
      },
      characterId,
    );
  }
  for (let position = 1; position <= level; position++)
    await insertClassLevel(ctx, characterId, position);
  await ctx.db.patch('character', characterId, {
    sheetMode,
    sheetRevision: 1,
    sheetLastOperationId: operationId,
    sheetUpdatedBy: updatedBy,
  });
  if (isPrepared) {
    const character = await ctx.db.get('character', characterId);
    if (!character) throw new ConvexError(characterNotFound);
    const sheet = await readCharacterSheetData(ctx, character);
    for (
      let offset = 0;
      offset < representativeSpellCatalog.length;
      offset += 64
    )
      await installPreparedSpells({
        ctx,
        sheet,
        spells: representativeSpellCatalog.slice(offset, offset + 64),
      });
  }
  await updateCanonicalCharacter(ctx, characterId);
}

export async function loadCharacterSheet(
  ctx: ReadCtx,
  args: CharacterScope,
  {
    isWritable = false,
    isCompanionInputSkipped = false,
  }: {
    isWritable?: boolean;
    isCompanionInputSkipped?: boolean;
  } = {},
) {
  const access = await requireCharacterAccess(ctx, args);
  return await loadCharacterSheetFromAccess(ctx, access, {
    isWritable,
    isCompanionInputSkipped,
    additionalReferences: listCatalogReferences(args).map((reference) => ({
      ...reference,
      refusalMessage:
        reference.kind === 'condition'
          ? 'Modifier reference does not belong to this Character'
          : reference.kind === 'class'
            ? 'Class does not belong to this Character'
            : 'Catalog Entry does not belong to this Character',
    })),
  });
}

export async function loadCharacterSheetFromAccess(
  ctx: ReadCtx,
  {
    character,
    campaign,
    user,
  }: Awaited<ReturnType<typeof requireCharacterAccess>>,
  {
    isWritable = false,
    isCompanionInputSkipped = false,
    additionalReferences = [],
    resourceLimits,
    readBudget,
  }: {
    isWritable?: boolean;
    isCompanionInputSkipped?: boolean;
    additionalReferences?: CatalogLoadReference[];
    resourceLimits?: CharacterSheetReadOptions['resourceLimits'];
    readBudget?: ReturnType<typeof createReadBudget>;
  } = {},
) {
  if (isWritable) {
    if (campaign) {
      requireFixtureCampaign(campaign);
    } else if (!character.sheetDemo) {
      throw new ConvexError(
        "Editing isn't available for this character sheet yet.",
      );
    }
  }
  if (!character.sheetMode) return null;
  const companionReadBudget = readBudget ?? createReadBudget(resourceLimits);
  const data = await readCharacterSheetDataWithBudget(
    ctx,
    character,
    additionalReferences,
    { resourceLimits },
    companionReadBudget,
  );
  const sheet = {
    ...data,
    initialSupportingEntryKeys: getCompanionSupportingEntryKeys(data),
    companionReadBudget,
    campaign: campaign
      ? {
          campaignId: campaign._id,
          campaignName: campaign.name,
          organizationId: campaign.organizationId,
          ownershipAvailable: Boolean(campaign.e2eFixture),
        }
      : null,
    actor: user.tokenIdentifier,
  };
  if (!isCompanionInputSkipped && !isWritable)
    return await applyCompanionToSheet(ctx, sheet, {
      readBudget: companionReadBudget,
      readSheet: (endpoint) =>
        readCharacterSheetDataWithBudget(
          ctx,
          endpoint,
          [],
          { resourceLimits },
          companionReadBudget,
        ),
    });

  return sheet;
}

export type LoadedCharacterSheet = NonNullable<
  Awaited<ReturnType<typeof loadCharacterSheet>>
>;

type SpellListFacts = Pick<
  LoadedCharacterSheet['calculated'],
  'spellcastings' | 'archetypeCastings'
>;

function listKey(list: ResolvedArchetypeSpellList) {
  const { classTag, added, removed, unresolved } = list;
  return JSON.stringify({ classTag, added, removed, unresolved });
}

/**
 * #422: a Spellcasting whose effective list changed refiles its browser rows.
 * A class appearing first gets the Spells the Character already indexes
 * (#728); with its own list it needs nothing more unless an Archetype changed
 * its casting before, as a removed casting may have left rows filed under
 * another list.
 */
async function refileChangedSpellLists(
  ctx: MutationCtx,
  sheet: LoadedCharacterSheet,
  previous: SpellListFacts,
) {
  const previousLists = new Map(
    previous.spellcastings.map((casting) => [
      casting.classEntryId,
      listKey(casting.spellList),
    ]),
  );
  const previousArchetypeCastings = new Set(
    previous.archetypeCastings.map((row) => row.classEntryId),
  );
  const appeared = new Set(
    sheet.calculated.spellcastings
      .map((casting) => casting.classEntryId)
      .filter((id) => !previousLists.has(id)),
  );
  await indexSpellcastingClasses({
    ctx,
    sheet,
    castingClassIds: sheet.catalogEntries
      .filter((row) => appeared.has(row._id))
      .map((row) => row._id),
  });
  for (const casting of sheet.calculated.spellcastings) {
    const list = listKey(casting.spellList);
    const before = previousLists.get(casting.classEntryId);
    const ownList = listKey({
      classTag: casting.classTag,
      name: null,
      added: [],
      removed: [],
      unresolved: [],
    });
    if (
      before === list ||
      (before === undefined &&
        list === ownList &&
        !previousArchetypeCastings.has(casting.classEntryId))
    )
      continue;
    const castingClass = sheet.catalogEntries.find(
      (row) => row._id === casting.classEntryId,
    );
    if (castingClass)
      await reconcileSpellcastingDefinition({
        ctx,
        sheet,
        catalogEntryId: castingClass._id,
      });
  }
}

// The in-memory sheet must reflect the pending write before pruning acceptances.
export async function pruneWarningAcceptancesAndRecordChange(
  ctx: MutationCtx,
  {
    sheet,
    operationId,
  }: {
    sheet: LoadedCharacterSheet;
    operationId: string;
  },
) {
  const calculationIdentity = await requireCompatibleActiveRelease(ctx);
  const catalogEntries = projectCampaignCopies(sheet.catalogEntries);
  const projected = await applyCompanionToSheet(
    ctx,
    { ...sheet, catalogEntries },
    {
      trustedLinkedInputs: true,
      recalculate: true,
      calculationIdentity,
      readBudget: sheet.companionReadBudget,
      readSheet: (endpoint) =>
        readCharacterSheetDataWithBudget(
          ctx,
          endpoint,
          [],
          {},
          sheet.companionReadBudget,
        ),
    },
  );
  const calculated = projected.calculated;
  const permanent = projected.permanentCalculated;
  requireWholeCalculatedAbilities(calculated);
  requireWholeCalculatedAbilities(permanent);
  const availableGrantIds = resolveCharacterSheetGrants({
    entries: sheet.entries,
    catalogEntries,
    characterKind: sheet.character.kind,
  })
    .allEntries.filter((row) => row.origin === 'grant')
    .map((row) => row.entry._id);
  const removedAcceptanceIds = new Set<Id<'acceptedWarning'>>();
  const applies = (
    warnings: readonly SheetWarning[],
    accepted: (typeof sheet.acceptedWarnings)[number],
  ) =>
    warnings.some(
      (warning) =>
        warning.kind === 'rules' &&
        warning.check === accepted.check &&
        warning.subject === accepted.subject &&
        warning.fingerprint === accepted.fingerprint,
    );
  const current = [
    ...calculated.warningsForAcceptance,
    ...permanent.warningsForAcceptance,
  ];
  // Owner (#583): warnings a dormant Selection would raise keep their
  // acceptance, so dormancy alone never reopens one. Calculated only when an
  // acceptance would otherwise go.
  let throughDormancy: readonly SheetWarning[] | null = null;
  const acceptableThroughDormancy = () =>
    (throughDormancy ??= warningsForAcceptanceThroughDormancy({
      entries: sheet.entries,
      calculated: {
        resolvedEntries: calculated.resolvedEntries,
        warningsForAcceptance: current,
      },
      calculate: (entries) => {
        const revived = calculateActiveCharacterSheet(
          buildCharacterSheetInput({ ...sheet, entries, catalogEntries }),
          calculationIdentity,
        );
        return [
          ...revived.current.warningsForAcceptance,
          ...revived.permanent.warningsForAcceptance,
        ];
      },
    }));
  for (const accepted of sheet.acceptedWarnings) {
    // No row is needed for an untouched Grant's warning acceptance. Its facts
    // are checked again when the absent source returns.
    const absentGrant =
      accepted.subject.startsWith('grant:') &&
      !availableGrantIds.some(
        (id) =>
          accepted.subject === id || accepted.subject.startsWith(`${id}:`),
      );
    if (
      absentGrant ||
      applies(current, accepted) ||
      applies(acceptableThroughDormancy(), accepted)
    )
      continue;
    await ctx.db.delete('acceptedWarning', accepted._id);
    removedAcceptanceIds.add(accepted._id);
  }
  sheet.acceptedWarnings = sheet.acceptedWarnings.filter(
    (accepted) => !removedAcceptanceIds.has(accepted._id),
  );
  await ctx.db.patch('character', sheet.character._id, {
    sheetRevision: (sheet.character.sheetRevision ?? 0) + 1,
    sheetLastOperationId: operationId,
    sheetUpdatedBy: sheet.actor,
  });
  const permanentCalculated = permanent;
  await updateCanonicalCharacter(ctx, sheet.character._id, {
    permanentCalculated,
  });
  const previous = sheet.calculated;
  sheet.calculated = calculated;
  sheet.permanentCalculated = permanentCalculated;
  sheet.permanentResolvedEntries = projected.permanentResolvedEntries;
  await refileChangedSpellLists(ctx, sheet, previous);
  await reconcileCompanionRelationships(ctx, {
    characterId: sheet.character._id,
    operationId: operationId,
    loadedSheets: [sheet],
    previousCountingEntries: sheet.initialSupportingEntryKeys,
  });
}

export async function updateCharacterArchive(
  ctx: MutationCtx,
  {
    characterId,
    isActive,
  }: { characterId: Id<'character'>; isActive: boolean },
) {
  await ctx.db.patch('character', characterId, { isActive });
  await updateCanonicalCharacter(ctx, characterId);
  await reconcileCompanionRelationships(ctx, { characterId: characterId });
}

async function listRowsForDeletion<Row>(
  query: { take: (limit: number) => Promise<Row[]> },
  overflowMessage: string,
  limit = maxCharacterChildRows,
) {
  const rows = await query.take(limit + 1);
  if (rows.length > limit) throw new ConvexError(overflowMessage);
  return rows;
}

export async function deleteCharacterSheet(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  operationId?: string,
) {
  const entries = await listRowsForDeletion(
    ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
    'Character sheet is too large to delete',
  );
  for (const entry of entries)
    await ctx.db.delete('characterSheetEntry', entry._id);
  const definitions = await listRowsForDeletion(
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', characterId).eq('browseOnly', undefined),
      ),
    'Character sheet is too large to delete',
  );
  for (const definition of definitions) {
    await deleteSpellCatalogIndex(ctx, definition._id);
    await ctx.db.delete('catalogEntry', definition._id);
  }
  const linkedInputs = await listRowsForDeletion(
    ctx.db
      .query('characterLinkedInput')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
    'Character sheet is too large to delete',
  );
  for (const row of linkedInputs)
    await ctx.db.delete('characterLinkedInput', row._id);
  const acceptedWarnings = await listRowsForDeletion(
    ctx.db
      .query('acceptedWarning')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
    'Character has too many accepted warnings',
    maxAcceptedWarnings,
  );
  for (const warning of acceptedWarnings)
    await ctx.db.delete('acceptedWarning', warning._id);
  const spells = await listRowsForDeletion(
    ctx.db
      .query('characterSpell')
      .withIndex('characterId', (q) => q.eq('characterId', characterId)),
    'Character spell list is too large to delete',
  );
  for (const spell of spells) await ctx.db.delete('characterSpell', spell._id);
  await markCatalogImpactDirty(ctx, characterId);
  await ctx.db.delete('character', characterId);
  const pendingMove = await ctx.db
    .query('characterMove')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .first();
  if (pendingMove)
    await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
      characterId,
    });
  const hasMoreSpellIndex = await cleanupCharacterSpellIndex(ctx, characterId);
  // Prepared sheets carry hundreds of browse-only seeds; batches remove them.
  const browseCatalog = await ctx.db
    .query('catalogEntry')
    .withIndex('by_characterId_and_browseOnly', (q) =>
      q.eq('characterId', characterId).eq('browseOnly', true),
    )
    .take(33);
  if (browseCatalog.length <= 32)
    for (const definition of browseCatalog) {
      await deleteSpellCatalogIndex(ctx, definition._id);
      await ctx.db.delete('catalogEntry', definition._id);
    }
  if (hasMoreSpellIndex || browseCatalog.length > 32)
    await ctx.scheduler.runAfter(
      0,
      internal.characterSheetSpells.cleanupCatalog,
      { characterId },
    );
  await reconcileCompanionRelationships(ctx, {
    characterId: characterId,
    operationId: operationId,
  });
}
