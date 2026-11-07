import { preparedItemWeapon } from '../../src/lib/catalog/imported-item';
import { ConvexError } from 'convex/values';
import { validate } from 'convex-helpers/validators';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { catalogEntryValidator } from '../schema';
import {
  releaseByteCount,
  isObject,
} from '../../src/lib/catalog/release-schema';
import {
  importedCatalogEntrySchema,
  type ImportedClassFeatureSpellcasting,
} from '../../src/lib/catalog/imported-entry-schema';
import {
  importedArchetypeKeys,
  preparedArchetypeDetail,
  type PreparedFeatureReference,
} from '../../src/lib/catalog/imported-archetype';
import type { z } from 'zod';
import { catalogReleaseLimits } from '../../src/lib/catalog/release-limits';
const maxSheetRows = catalogReleaseLimits.sheetRows;
const maxCandidateReadBytes = catalogReleaseLimits.candidateReadBytes;
export const retirementKeyPrefix = 'retirement:';
export const retirementKeyEnd = 'retirement;';
export function readRetiredDefinition(
  ctx: ReadCtx,
  releaseId: Id<'catalogRelease'>,
  ruleIdentity: string,
) {
  return releaseRow(
    ctx,
    releaseId,
    'report',
    `${retirementKeyPrefix}${ruleIdentity}`,
  );
}
export async function releaseRow(
  ctx: ReadCtx,
  releaseId: Id<'catalogRelease'>,
  kind: 'definition' | 'resource' | 'report',
  key: string,
) {
  return ctx.db
    .query('catalogReleaseRow')
    .withIndex('by_releaseId_and_kind_and_key', (q) =>
      q.eq('releaseId', releaseId).eq('kind', kind).eq('key', key),
    )
    .unique();
}

export type CandidateReadBudget = {
  bytes: number;
  accountRead?: (value: unknown) => void;
};

export function recordCandidateRead(
  budget: CandidateReadBudget,
  value: unknown,
  isNewRead = true,
) {
  if (isNewRead) budget.accountRead?.(value);
  budget.bytes += releaseByteCount(value);
  if (budget.bytes > maxCandidateReadBytes)
    throw new ConvexError('Candidate exceeds representative read byte limit');
}

type ImportedDefinition = z.infer<typeof importedCatalogEntrySchema>;

async function candidateClassDetail(
  ctx: ReadCtx,
  definition: Doc<'catalogEntry'>,
  detail: Extract<ImportedDefinition['detail'], { kind: 'class' }>,
  budget: CandidateReadBudget,
) {
  if (detail.featuresByLevel.length > maxSheetRows)
    throw new ConvexError(
      `Candidate features exceed ${maxSheetRows} for ${definition.ruleIdentity}`,
    );
  const featuresByLevel: {
    classLevel: number;
    catalogEntryId: Id<'catalogEntry'>;
  }[] = [];
  for (const feature of detail.featuresByLevel) {
    const target = await globalDefinition(ctx, feature.externalKey);
    recordCandidateRead(budget, target);
    if (!target)
      throw new ConvexError(
        `Candidate feature ${feature.externalKey} is unavailable for ${definition.ruleIdentity}`,
      );
    featuresByLevel.push({
      classLevel: feature.classLevel,
      catalogEntryId: target._id,
    });
  }
  const previousCasting =
    definition.detail.kind === 'class' && 'casting' in definition.detail
      ? definition.detail.casting
      : undefined;
  if (
    detail.casting &&
    (!previousCasting ||
      detail.tag !== previousCasting?.classTag ||
      Object.entries(detail.casting).some(
        ([key, value]) =>
          value !== undefined && value !== Reflect.get(previousCasting, key),
      ))
  )
    throw new ConvexError(
      `Candidate casting metadata is unsupported for ${definition.ruleIdentity}`,
    );
  return {
    ...definition.detail,
    hitDie: detail.hitDie,
    bab: detail.bab,
    saves: detail.saves,
    classSkills: detail.classSkills,
    skillRanksPerLevel: detail.skillRanksPerLevel,
    ...('classKind' in definition.detail
      ? { alignments: detail.alignments }
      : {}),
    casting: detail.casting ? previousCasting : undefined,
    // #716 P4: a prestige class's casting advances are release content.
    castingAdvances: detail.castingAdvances,
    featuresByLevel,
    // #716 P5: a class's choices per level are release content.
    ...(detail.picksByLevel ? { picksByLevel: detail.picksByLevel } : {}),
  };
}

/**
 * A definition's release body as the candidate release has it: its live
 * definition row, else the retained `lastUsableDefinition` of its retirement,
 * else undefined, when the stored definition stands.
 */
async function releasePayloadValue({
  ctx,
  release,
  ruleIdentity,
  budget,
}: {
  ctx: ReadCtx;
  release: Doc<'catalogRelease'>;
  ruleIdentity: string;
  budget: CandidateReadBudget;
}): Promise<unknown> {
  const row = await releaseRow(ctx, release._id, 'definition', ruleIdentity);
  recordCandidateRead(budget, row);
  if (row) return row.payload;
  const retained = await readRetiredDefinition(ctx, release._id, ruleIdentity);
  recordCandidateRead(budget, retained);
  const retainedPayload: unknown = retained?.payload;
  return isObject(retainedPayload)
    ? retainedPayload.lastUsableDefinition
    : undefined;
}

type CandidateContext = {
  ctx: ReadCtx;
  release: Doc<'catalogRelease'>;
  definition: Doc<'catalogEntry'>;
  budget: CandidateReadBudget;
};

/** A stable key's global definition; a missing one refuses the candidate. */
async function requiredReference({
  context: { ctx, definition, budget },
  externalKey,
}: {
  context: CandidateContext;
  externalKey: string;
}) {
  const target = await globalDefinition(ctx, externalKey);
  recordCandidateRead(budget, target);
  if (!target)
    throw new ConvexError(
      `Candidate reference ${externalKey} is unavailable for ${definition.ruleIdentity}`,
    );
  return target;
}

/**
 * A referenced class feature's parent and part as the candidate release has
 * them: its live release body, else its retained one, else its stored
 * definition. The archetype and its features are selected together, so a
 * part change follows the feature's current identity (GLOSSARY, "Catalog
 * Release").
 */
async function candidateFeatureMetadata({
  context: { ctx, release, budget },
  target,
}: {
  context: CandidateContext;
  target: Doc<'catalogEntry'>;
}) {
  const payloadValue = await releasePayloadValue({
    ctx,
    release,
    ruleIdentity: target.ruleIdentity,
    budget,
  });
  const parsed =
    payloadValue === undefined
      ? undefined
      : importedCatalogEntrySchema.safeParse(payloadValue);
  const detail = parsed?.success
    ? parsed.data.detail
    : target.detail.kind === 'classFeature'
      ? target.detail
      : undefined;
  return detail?.kind === 'classFeature'
    ? {
        ...(detail.parentFeature
          ? { parentFeature: detail.parentFeature }
          : {}),
        ...(detail.part ? { part: detail.part } : {}),
      }
    : {};
}

/** #716 P5: an archetype's stable keys become stored IDs (#305). */
async function candidateArchetypeDetail({
  context,
  detail,
}: {
  context: CandidateContext;
  detail: Extract<ImportedDefinition['detail'], { kind: 'archetype' }>;
}) {
  const { definition } = context;
  const keys = importedArchetypeKeys(detail);
  if (keys.length > maxSheetRows)
    throw new ConvexError(
      `Candidate references exceed ${maxSheetRows} for ${definition.ruleIdentity}`,
    );
  const references = new Map<
    string,
    PreparedFeatureReference<Id<'catalogEntry'>>
  >();
  for (const externalKey of keys) {
    const target = await requiredReference({ context, externalKey });
    references.set(externalKey, {
      id: target._id,
      ruleIdentity: target.ruleIdentity,
      ...(await candidateFeatureMetadata({ context, target })),
    });
  }
  return preparedArchetypeDetail(detail, (key) => {
    const reference = references.get(key);
    if (!reference)
      throw new ConvexError(
        `Candidate reference ${key} is unavailable for ${definition.ruleIdentity}`,
      );
    return reference;
  });
}

/**
 * Granted-levels S1: a class feature's Granted Spells name Spells by spell
 * key; each becomes its global Spell's ID. A missing or duplicated key, or
 * one that isn't a Spell, refuses the candidate. A powers-only chooser has
 * no Granted Spells and keeps its facts.
 */
async function candidateFeatureSpellcasting({
  context,
  spellcasting,
}: {
  context: CandidateContext;
  spellcasting: ImportedClassFeatureSpellcasting;
}) {
  if (!('grantedSpells' in spellcasting)) return spellcasting;
  const { grantedSpells } = spellcasting;
  if (grantedSpells.spells.length > maxSheetRows)
    throw new ConvexError(
      `Candidate Granted Spells exceed ${maxSheetRows} for ${context.definition.ruleIdentity}`,
    );
  const spells: { spellLevel: number; catalogEntryId: Id<'catalogEntry'> }[] =
    [];
  for (const { spellLevel, spellKey } of grantedSpells.spells) {
    const target = await requiredReference({ context, externalKey: spellKey });
    if (target.detail.kind !== 'spell')
      throw new ConvexError(
        `Candidate Granted Spell ${spellKey} is not a Spell`,
      );
    spells.push({ spellLevel, catalogEntryId: target._id });
  }
  return { ...spellcasting, grantedSpells: { ...grantedSpells, spells } };
}

/** #716 P5: a class feature's parent, part, upgrade, choices and casting. */
async function candidateClassFeatureDetail({
  context,
  detail,
}: {
  context: CandidateContext;
  detail: Extract<ImportedDefinition['detail'], { kind: 'classFeature' }>;
}) {
  const upgrade = detail.duplicateUpgrade
    ? await requiredReference({ context, externalKey: detail.duplicateUpgrade })
    : undefined;
  return {
    kind: detail.kind,
    ...(detail.parentFeature ? { parentFeature: detail.parentFeature } : {}),
    ...(detail.part ? { part: detail.part } : {}),
    ...(upgrade ? { duplicateUpgrade: upgrade._id } : {}),
    ...(detail.picksByLevel ? { picksByLevel: detail.picksByLevel } : {}),
    ...(detail.spellcasting
      ? {
          spellcasting: await candidateFeatureSpellcasting({
            context,
            spellcasting: detail.spellcasting,
          }),
        }
      : {}),
  };
}

function candidateItemWeapon({
  weapon,
  identity,
}: {
  weapon: Parameters<typeof preparedItemWeapon>[0]['weapon'];
  identity: string;
}) {
  try {
    return preparedItemWeapon({ weapon });
  } catch (error) {
    throw new ConvexError(
      `Unsupported candidate weapon ${identity}: ${error instanceof Error ? error.message : 'invalid weapon profile'}`,
    );
  }
}

async function candidateDetail({
  context,
  payload,
}: {
  context: CandidateContext;
  payload: ImportedDefinition;
}) {
  const { ctx, definition, budget } = context;
  const detail = payload.detail;
  const resolveRacialReferences = async ({
    keys,
    kind,
  }: {
    keys: string[];
    kind: 'race' | 'racialTrait';
  }) => {
    if (keys.length > maxSheetRows)
      throw new ConvexError(
        'Candidate racial references exceed the sheet limit',
      );
    const ids: Id<'catalogEntry'>[] = [];
    for (const externalKey of keys) {
      const target = await requiredReference({ context, externalKey });
      if (target.detail.kind !== kind)
        throw new ConvexError(
          `Candidate racial reference ${externalKey} is not a ${kind}`,
        );
      ids.push(target._id);
    }
    return ids;
  };
  switch (detail.kind) {
    case 'item': {
      const { baseItemKey, weapon, ...item } = detail;
      const base = baseItemKey
        ? await requiredReference({ context, externalKey: baseItemKey })
        : undefined;
      if (base?._id === definition._id)
        throw new ConvexError(
          `Candidate Base Item ${baseItemKey} cannot reference itself`,
        );
      if (base && base.detail.kind !== 'item')
        throw new ConvexError(
          `Candidate Base Item ${baseItemKey} is not an item`,
        );
      return {
        ...item,
        ...(weapon
          ? {
              weapon: candidateItemWeapon({
                weapon,
                identity: definition.ruleIdentity,
              }),
            }
          : {}),
        ...(base ? { baseItem: base._id } : {}),
      };
    }
    case 'feat':
      return {
        kind: detail.kind,
        featTypes: detail.featTypes,
        repeatable: detail.repeatable,
        additionalTraits: detail.additionalTraits,
      };
    case 'trait':
      return { kind: detail.kind, traitType: detail.traitType };
    case 'classFeature':
      return candidateClassFeatureDetail({ context, detail });
    case 'archetype':
      return candidateArchetypeDetail({ context, detail });
    case 'spellEffect':
      return {
        kind: detail.kind,
        defaultCasterLevel: detail.defaultCasterLevel,
        lastsOverOneDay: detail.lastsOverOneDay,
        // The Spell's rule identity sets its default caster level.
        ...(detail.spellKey ? { spellKey: detail.spellKey } : {}),
      };
    case 'spell':
      return {
        kind: detail.kind,
        levels: detail.levels,
        school: detail.school,
        description: payload.description,
      };
    case 'racialTrait':
      return {
        ...definition.detail,
        abilityChoiceCount: detail.abilityChoiceCount,
        size: detail.size,
        ...(detail.raceKeys
          ? {
              raceEntryIds: await resolveRacialReferences({
                keys: detail.raceKeys,
                kind: 'race',
              }),
            }
          : {}),
        ...(detail.replaces
          ? {
              replaces: await resolveRacialReferences({
                keys: detail.replaces,
                kind: 'racialTrait',
              }),
            }
          : {}),
        ...(detail.unresolvedReplacements !== undefined ||
        detail.replaces !== undefined
          ? { unresolvedReplacements: detail.unresolvedReplacements }
          : {}),
        bonusSkillRanksPerLevel: detail.bonusSkillRanksPerLevel || undefined,
        favoredClassCount: detail.favoredClassCount,
      };
    case 'race':
      return {
        ...definition.detail,
        ...(detail.racialTraits
          ? {
              racialTraits: await resolveRacialReferences({
                keys: detail.racialTraits,
                kind: 'racialTrait',
              }),
            }
          : {}),
        racialHitDice: detail.racialHitDice,
        creatureTypes: detail.creatureTypes,
        creatureSubtypes: detail.creatureSubtypes,
        // #720: the release body's mapped size.
        ...(detail.size ? { size: detail.size } : {}),
      };
    case 'class':
      return candidateClassDetail(ctx, definition, detail, budget);
    default:
      return detail;
  }
}

/** A slot's named feats are stable keys in the body and stored IDs here. */
async function candidateSlots(
  ctx: ReadCtx,
  definition: Doc<'catalogEntry'>,
  payload: ImportedDefinition,
  budget: CandidateReadBudget,
) {
  if (!payload.grantsSlots) return undefined;
  const slots = [];
  for (const { feats, ...slot } of payload.grantsSlots) {
    if (!feats) {
      slots.push(slot);
      continue;
    }
    const ids: Id<'catalogEntry'>[] = [];
    for (const key of feats) {
      const target = await globalDefinition(ctx, key);
      recordCandidateRead(budget, target);
      if (!target)
        throw new ConvexError(
          `Candidate slot feat ${key} is unavailable for ${definition.ruleIdentity}`,
        );
      ids.push(target._id);
    }
    slots.push({ ...slot, feats: ids });
  }
  return slots;
}

export async function candidateDefinition(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  definition: Doc<'catalogEntry'>,
  budget: CandidateReadBudget = { bytes: 0 },
): Promise<Doc<'catalogEntry'>> {
  recordCandidateRead(budget, definition, false);
  if (
    definition.copiedFrom ||
    (definition.scope !== 'global' && !definition.importedSpell)
  )
    return definition;
  const payloadValue = await releasePayloadValue({
    ctx,
    release,
    ruleIdentity: definition.ruleIdentity,
    budget,
  });
  if (payloadValue === undefined) return definition;
  const parsed = importedCatalogEntrySchema.safeParse(payloadValue);
  if (!parsed.success || parsed.data.modifiers.length > maxSheetRows)
    throw new ConvexError(
      `Unsupported candidate definition ${definition.ruleIdentity}`,
    );
  const payload = parsed.data;
  if (payload.detail.kind !== definition.detail.kind)
    throw new ConvexError(
      `Candidate definition ${definition.ruleIdentity} changes its stable identity kind`,
    );
  const detail = await candidateDetail({
    context: { ctx, release, definition, budget },
    payload,
  });
  const grantsSlots = await candidateSlots(ctx, definition, payload, budget);
  const { _id, _creationTime, ...body } = definition;
  const candidate: unknown = JSON.parse(
    JSON.stringify({
      ...body,
      name: payload.name,
      description:
        payload.description === '' && definition.description === undefined
          ? undefined
          : payload.description,
      guidanceText: payload.guidanceText,
      prerequisiteText: payload.prerequisiteText,
      grantsSlots,
      // #719: race equivalence and named weapon familiarity are release content.
      countsAsRaces: payload.countsAsRaces,
      proficiencies: payload.proficiencies,
      sources: payload.sources,
      modifiers: payload.modifiers,
      // #770 B2a: Notes are release content for every kind, as Modifiers
      // are. A Note the stored validator rejects refuses the candidate below.
      situationalNotes: payload.situationalNotes,
      // Rule-identity prerequisites are release content; held definitions carry them.
      prerequisites: payload.prerequisites,
      detail,
      sourceKey: payload.sourceKey,
    }),
  );
  // Imported definitions have no Grant bodies. Existing reviewed ID-based
  // Grants stay usable; future class features are mapped through stable keys.
  if (!validate(catalogEntryValidator, candidate, { db: ctx.db }))
    throw new ConvexError(
      `Candidate definition ${definition.ruleIdentity} is not supported by the prepared sheet resolver`,
    );
  return { ...candidate, _id, _creationTime };
}

export async function globalDefinition(ctx: ReadCtx, ruleIdentity: string) {
  const rows = await ctx.db
    .query('catalogEntry')
    .withIndex('by_scope_and_ruleIdentity', (q) =>
      q.eq('scope', 'global').eq('ruleIdentity', ruleIdentity),
    )
    .take(2);
  if (rows.length > 1)
    throw new ConvexError(`Duplicate global ruleIdentity ${ruleIdentity}`);
  return rows[0] ?? null;
}

export async function findStableDefinition(
  ctx: ReadCtx,
  key: string,
  isImportedSpellAllowed = true,
) {
  const global = await globalDefinition(ctx, key);
  if (global || !isImportedSpellAllowed) return global;
  const imports = await ctx.db
    .query('catalogEntry')
    .withIndex('by_ruleIdentity', (q) => q.eq('ruleIdentity', key))
    .take(catalogReleaseLimits.identityLookupRows);
  return (
    imports.find(
      (definition) => definition.importedSpell && !definition.copiedFrom,
    ) ?? null
  );
}
