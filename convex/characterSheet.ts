import { characterNotFound } from '../src/lib/character-not-found';
import { requireCatalogCharacterAdmission } from './lib/catalogFixturePolicy';
import { readCatalogChoices, readCatalogAdvisories } from './catalogCopies';
import { readLegalInputs } from './catalogRelease';
import {
  readSelectedCatalogBoundary,
  isSelectedCatalogDefinitionSelectable,
} from './lib/catalogReleaseBoundary';
import { releaseLegalInputsSchema } from '../src/lib/catalog/release-legal-inputs';
import { reviewedCastingTablesSchema } from '../src/lib/character-sheet-casting-tables';
import {
  companionProgressionResolutionSchema,
  companionProgressionSourceSchema,
  companionProgressionStateSchema,
  type CompanionProgressionState,
} from '../src/lib/character-sheet-companion-progression';
import { isEidolonState } from '../src/lib/character-sheet-eidolon-progression';
import {
  cohortEquivalenceStateSchema,
  maxCohortCreatureLength,
  maxCohortEquivalence,
} from '../src/lib/character-sheet-cohort';
import {
  cohortCalculationInputSchema,
  cohortResolutionSchema,
} from '../src/lib/character-sheet-cohort-schema';
import { companionLinkedInputResolutionSchema } from '../src/lib/character-sheet-linked-inputs';
import { sheetStatisticTargetSchema } from '../src/lib/character-sheet-unresolved-targets';
import { findArchetypeSelection } from '../src/lib/character-sheet-archetype-helpers';
import {
  archetypeCastingChangeSchema,
  archetypeCastingSummarySchema,
  resolvedArchetypeSpellListSchema,
  resolvedCastingFieldsSchema,
  resolvedCastingPropertySchema,
} from '../src/lib/character-sheet-archetype-casting';
import {
  UNARMED_STRIKE_ID,
  isUnarmedStrike,
  itemAbilityTargets,
} from '../src/lib/character-sheet-attack-types';
import { listCatalogReferences } from '../src/lib/catalog-copy-references';
import {
  defaultAttackRoutineConfiguration,
  maximumRangeIncrements,
  builtInUnarmedWeapon,
  type WeaponDetail,
} from '../src/lib/character-sheet-attacks';
import { isRoutineOptionDefinition } from '../src/lib/character-sheet-routine-options';
import { isFlurryIdentity } from '../src/lib/character-sheet-flurry';
import {
  selectionMetadata,
  orderedSelectionIdsAtLevel,
  buildSelectionEntry,
  replaceRecordedSelection,
} from '../src/lib/character-sheet-selection';
import {
  castingAdvanceKinds,
  extraSlotKinds,
  spellcastingOptionKinds,
} from '../src/lib/character-sheet-casting-tables';
import { familiarFactsSchema } from '../src/lib/character-sheet-familiar-schema';
import { type SelectionSlot } from '../src/lib/character-sheet-selection-rules';
import {
  manualProficiencySchema,
  proficiencyKey,
} from '../src/lib/character-sheet-proficiencies';
import {
  copyCatalogDefinition,
  findPreferredCampaignCopy,
  preserveCuratedModifierFields,
  projectCampaignCopies,
  requireEditableCharacterDefinition,
} from './lib/catalogCopies';
import {
  maxCharacterChildRows,
  maxAcceptedWarnings,
  requireAbilityScore,
  listCatalogDependencies,
} from './lib/characterSheetData';
import {
  characterSheetClassFamily,
  hasGrantAncestor,
  resolveCharacterSheetGrants,
  normalizeCharacterSheetChoiceName,
  type GrantKey,
} from '../src/lib/character-sheet-grants';
import {
  createCatalogSheetEntryState,
  isSelectableCatalogSheetEntryKind,
  isCatalogSheetEntry,
  isCatalogSheetDefinition,
  type SelectableCatalogSheetEntryKind,
} from '../src/lib/character-sheet-entries';
import {
  createItemState,
  itemPartState,
  resolveItemDefinition,
} from '../src/lib/character-sheet-items';
import {
  compareValues,
  ConvexError,
  v,
  type Infer,
  type Validator,
} from 'convex/values';
import {
  canonicalSkillKey,
  sumRanksBySkill,
  skillDefinitions,
} from '../src/lib/character-sheet-skills';
import {
  conditionEffectSchema,
  getConditionDefinition,
} from '../src/lib/character-sheet-conditions';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { WithoutSystemFields } from 'convex/server';
import type { MutationCtx } from './_generated/server';
import { query } from './_generated/server';
import { applyCompanionToSheet } from './lib/characterSheetCompanion';
import { legacyCharacterMutation as campaignMutation } from './lib/campaignRuntime';
import schema, {
  cohortEquivalenceStateValidator,
  companionProgressionStateValidator,
  creationSettingsValidator,
  favoredClassBonusValidator,
  characterSheetEntryValidator,
  modifierValidator,
  situationalNoteValidator,
  abilityValidator,
  alignmentValidator,
  abilityChangeKindValidator,
  sheetEntryDetailValidator,
  grantKeyValidator,
  selectionSourceValidator,
  manualProficiencyValidator,
  racialProgressionValidator,
  archetypeReplacementValidator,
  archetypeFeatureChangeValidator,
  attackRoutineHandsValidator,
  attackRoutineModeValidator,
  prerequisiteValidator,
  attackRoutineOffHandValidator,
  attackRoutineWeaponValidator,
  attackHandValidator,
  weaponEndValidator,
  itemPartValidator,
  itemAbilityRefValidator,
  type itemPartStateValidator,
  naturalAttackRoleValidator,
  spellSchoolValidator,
  spellSchoolOrUniversalValidator,
  spellEffectItemTargetValidator,
  spellEffectTargetValidator,
} from './schema';
import {
  defaultSpellEffectCasterLevel,
  readNewSpellEffectCasterLevel,
} from './lib/spellEffectCasterLevel';
import { getUser } from './user';
import {
  deleteSpellCatalogIndex,
  reconcileCopiedSpellcasting,
  reconcileSpellcastingDefinition,
  reconcileSpellDefinition,
  reconcileSpellIdentity,
} from './lib/spellCatalog';
import {
  applyClassSwitch,
  planClassSwitch,
  type ClassSwitchPlan,
} from '../src/lib/character-sheet-class-switch';
import {
  characterOwnerValidator,
  readCharacterOwners,
} from './lib/characterOwnership';
import {
  requireCharacterAccess,
  requireCharacterCampaignAccess,
  type CharacterScope,
} from './lib/characterAccess';
import {
  abilityKeys,
  abilityTargets,
  creatureSizes,
  proficiencyCategories,
  defaultAbilityScores,
  creationSettingsFor,
  modifierConditionSchema,
  personalAdjustmentConditionSchema,
  situationalNoteSchema,
  sourcedSituationalNoteSchema,
  characterSheetWarningSchema,
  type Modifier,
  type CatalogModifier,
  type BaseModifier,
  type SheetEntry,
  type SituationalNote,
} from '../src/lib/character-sheet';
import {
  deleteCharacterSheet,
  initializeCharacterSheet,
  isManualCatalogEntry,
  isSeededCatalogEntry,
  loadCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
  requireFixtureCampaign,
  updateCharacterArchive,
} from './lib/characterSheet';

const extraSlotKindValidator = v.union(
  ...extraSlotKinds.map((kind) => v.literal(kind)),
);
const spellcastingOptionKindValidator = v.union(
  ...spellcastingOptionKinds.map((kind) => v.literal(kind)),
);
const scope = {
  organizationId: v.optional(v.string()),
  campaignId: v.optional(v.id('campaign')),
  characterId: v.id('character'),
};
const abilityValue = v.object({ score: v.number(), modifier: v.number() });
const sourcedModifierComponentValidator = modifierValidator
  .omit('condition')
  .extend({
    armorItem: v.optional(
      v.object({
        entryId: v.string(),
        component: v.union(v.literal('base'), v.literal('enhancement')),
      }),
    ),
    modifierIndex: v.optional(v.number()),
    catalogEntryId: v.optional(v.string()),
    // The item part an Item Ability or targeted Spell Effect binds to.
    itemPart: v.optional(itemPartValidator),
    condition: v.optional(zodOutputToConvex(modifierConditionSchema)),
    value: v.number(),
    sheetEntryId: v.string(),
    entryName: v.string(),
    source: v.string(),
    builtIn: v.boolean(),
    stacksWithItself: v.optional(v.boolean()),
  });
const sourcedModifierValidator = sourcedModifierComponentValidator.extend({
  armorComponents: v.optional(v.array(sourcedModifierComponentValidator)),
});
const breakdownValidator = v.object({
  excluded: v.optional(v.array(sourcedModifierValidator)),
  notes: v.optional(v.array(zodOutputToConvex(sourcedSituationalNoteSchema))),
  total: v.number(),
  applied: v.array(sourcedModifierValidator),
  suppressed: v.array(
    sourcedModifierValidator.extend({
      reason: v.string(),
      suppressedBy: v.string(),
    }),
  ),
  conditional: v.array(sourcedModifierValidator),
});
const spellcastingValidator = v.object({
  classEntryId: v.string(),
  ...zodOutputToConvex(resolvedCastingFieldsSchema).fields,
  spellList: zodOutputToConvex(resolvedArchetypeSpellListSchema),
  castingProperties: v.array(zodOutputToConvex(resolvedCastingPropertySchema)),
  name: v.string(),
  classLevels: v.number(),
  advances: v.array(
    v.object({ classEntryId: v.string(), name: v.string(), count: v.number() }),
  ),
  pendingAdvances: v.number(),
  castingLevel: v.number(),
  tableLevel: v.number(),
  casterLevel: v.union(breakdownValidator, v.null()),
  concentration: v.union(breakdownValidator, v.null()),
  castableSpellLevels: v.array(v.number()),
  slots: v.array(
    v.object({
      spellLevel: v.number(),
      base: v.union(v.number(), v.null()),
      bonus: v.number(),
      extra: v.number(),
      total: v.union(v.number(), v.null()),
      known: v.union(v.number(), v.null()),
      prepared: v.union(v.number(), v.null()),
      dc: breakdownValidator,
      dcUnresolved: v.boolean(),
      schoolDCs: v.array(
        v.object({
          school: v.string(),
          breakdown: breakdownValidator,
          unresolved: v.boolean(),
        }),
      ),
    }),
  ),
  unresolved: v.array(v.string()),
  extraSlots: v.array(
    v.object({ kind: extraSlotKindValidator, label: v.string() }),
  ),
  grantedSpells: v.array(
    v.object({
      catalogEntryId: v.string(),
      ruleIdentity: v.string(),
      name: v.string(),
      school: v.optional(spellSchoolOrUniversalValidator),
      description: v.optional(v.string()),
      spellLevel: v.number(),
      style: v.union(v.literal('slot'), v.literal('schedule')),
      sources: v.array(v.object({ entryId: v.string(), name: v.string() })),
      optionKind: v.union(spellcastingOptionKindValidator, v.null()),
      domainSlotOnly: v.boolean(),
    }),
  ),
  school: v.union(
    v.object({
      entryId: v.string(),
      catalogEntryId: v.string(),
      name: v.string(),
      school: spellSchoolValidator,
      oppositionSchools: v.array(spellSchoolValidator),
      oppositionSchoolCount: v.number(),
    }),
    v.null(),
  ),
  choices: v.array(
    v.object({
      sourceEntryId: v.string(),
      sourceName: v.string(),
      list: v.string(),
      classLevel: v.number(),
      count: v.number(),
      optionKind: spellcastingOptionKindValidator,
      selected: v.array(
        v.object({
          entryId: v.string(),
          catalogEntryId: v.string(),
          name: v.string(),
        }),
      ),
    }),
  ),
});
const castingAdvanceValidator = v.object({
  entryId: v.string(),
  index: v.number(),
  prestigeClassEntryId: v.string(),
  prestigeName: v.string(),
  prestigeClassLevel: v.number(),
  kind: v.union(...castingAdvanceKinds.map((kind) => v.literal(kind))),
  eligibleClassEntryIds: v.array(v.string()),
  targetClassEntryId: v.union(v.string(), v.null()),
  prefilled: v.boolean(),
  problem: v.union(
    v.literal('missing'),
    v.literal('noCasting'),
    v.literal('later'),
    v.literal('kind'),
    v.null(),
  ),
  targetFamily: v.union(v.string(), v.null()),
});
const archetypeFeatureRowValidator = archetypeReplacementValidator
  .omit('catalogEntryId')
  .extend({ catalogEntryId: v.string() });
const archetypeConflictValidator = v.object({
  featureIdentity: v.string(),
  part: v.union(v.string(), v.null()),
  entryIds: v.array(v.string()),
  classIdentity: v.string(),
});
const archetypesValidator = v.object({
  classes: v.array(
    v.object({
      classEntryId: v.string(),
      classIdentity: v.string(),
      classLevel: v.number(),
      classSkills: v.array(v.string()),
      skillRanksPerLevel: v.union(v.number(), v.null()),
      archetypes: v.array(
        v.object({
          entryId: v.string(),
          catalogEntryId: v.string(),
          ruleIdentity: v.string(),
          name: v.string(),
          active: v.boolean(),
          applicable: v.boolean(),
          replacements: v.array(archetypeFeatureRowValidator),
          additions: v.array(archetypeFeatureRowValidator.omit('scope')),
          changes: v.array(archetypeFeatureChangeValidator),
          classSkillsAdded: v.array(v.string()),
          classSkillsRemoved: v.array(v.string()),
          skillRanksPerLevel: v.optional(v.number()),
          casting: v.optional(zodOutputToConvex(archetypeCastingChangeSchema)),
          castingChoices: v.array(v.string()),
        }),
      ),
      conflicts: v.array(archetypeConflictValidator),
    }),
  ),
  conflicts: v.array(archetypeConflictValidator),
  warnings: v.array(zodOutputToConvex(characterSheetWarningSchema)),
});
// Stored state shapes flow directly into the read DTO; only resolver identity differs.
const resolvedSheetEntryValidator = v.union(
  ...characterSheetEntryValidator.members.map((member) =>
    member.extend({
      _id: v.string(),
      _creationTime: v.optional(v.number()),
      characterId: v.optional(v.id('character')),
    }),
  ),
);
const resolvedEntryValidator = v.object({
  // Safe cast: each member is a stored entry validator extended with these
  // optional fields; Convex cannot infer the type through .map.
  entry: resolvedSheetEntryValidator as Validator<
    SheetEntry & {
      characterId?: Id<'character'>;
      _creationTime?: number;
    },
    'required',
    string
  >,
  origin: v.union(v.literal('grant'), v.literal('selection')),
  recorded: v.boolean(),
  dormant: v.boolean(),
  counting: v.boolean(),
  storedEntryId: v.optional(v.string()),
  reason: v.optional(
    v.union(
      v.object({ kind: v.literal('sourceMissing') }),
      v.object({
        kind: v.literal('replaced'),
        byEntryIds: v.array(v.string()),
      }),
      v.object({ kind: v.literal('retired') }),
    ),
  ),
});
const collectionSpellValidator = v.object({
  entryId: v.string(),
  catalogEntryId: v.string(),
  ruleIdentity: v.string(),
  name: v.string(),
  classEntryId: v.union(v.string(), v.null()),
  castingClassName: v.union(v.string(), v.null()),
  school: v.optional(v.string()),
  description: v.optional(v.string()),
  spellLevel: v.union(v.number(), v.null()),
  explicitLevel: v.union(v.number(), v.null()),
  offList: v.boolean(),
  twoSlots: v.boolean(),
});
const extraDamageValidator = v.object({
  dice: v.string(),
  damageType: v.union(v.string(), v.null()),
  on: v.union(v.literal('hit'), v.literal('crit')),
  // A shared, local or option Situation (#764), or none.
  situation: v.union(
    v.string(),
    v.object({ local: v.string() }),
    v.object({ option: v.string() }),
    v.null(),
  ),
  applies: v.boolean(),
  sheetEntryId: v.string(),
  catalogEntryId: v.string(),
  name: v.string(),
});
const itemPartsViewValidator = v.object({
  entryId: v.string(),
  name: v.string(),
  active: v.boolean(),
  baseItemId: v.union(v.string(), v.null()),
  bakedMaterial: v.union(
    v.object({ name: v.string(), includedInNumbers: v.boolean() }),
    v.null(),
  ),
  parts: v.array(
    v.object({
      part: itemPartValidator,
      kind: v.union(
        v.literal('melee'),
        v.literal('ranged'),
        v.literal('thrown'),
        v.literal('armor'),
        v.literal('shield'),
      ),
      enhancement: v.number(),
      recordedMasterwork: v.boolean(),
      masterwork: v.boolean(),
      material: v.union(v.string(), v.null()),
      bonusEquivalent: v.number(),
      abilities: v.array(
        v.object({
          catalogEntryId: v.id('catalogEntry'),
          name: v.string(),
          bonusEquivalent: v.number(),
          choice: v.union(v.string(), v.null()),
          choiceMissing: v.boolean(),
          available: v.boolean(),
          appliesTo: v.union(
            ...itemAbilityTargets.map((target) => v.literal(target)),
            v.null(),
          ),
          requiresChoice: v.union(v.literal('creatureType'), v.null()),
        }),
      ),
    }),
  ),
});
const spellEffectEndValidator = v.union(
  v.literal('otherEnd'),
  v.literal('bash'),
  v.null(),
);
const spellEffectViewValidator = v.object({
  entryId: v.string(),
  name: v.string(),
  active: v.boolean(),
  casterLevel: v.number(),
  defaultCasterLevel: v.number(),
  // "Summoner 4 casts 2nd-level spells"; null when unlinked.
  defaultSource: v.union(
    v.object({
      classTag: v.string(),
      classLevel: v.number(),
      spellLevel: v.number(),
    }),
    v.null(),
  ),
  spell: v.union(
    v.object({ name: v.string(), ruleIdentity: v.string() }),
    v.null(),
  ),
  duration: v.union(v.literal('temporary'), v.literal('permanent')),
  target: v.union(
    v.object({
      itemTarget: spellEffectItemTargetValidator,
      onItem: v.union(
        v.object({ entry: v.string(), end: spellEffectEndValidator }),
        v.null(),
      ),
      status: v.union(
        v.literal('missing'),
        v.literal('available'),
        v.literal('inactive'),
        v.literal('unavailable'),
      ),
      name: v.union(v.string(), v.null()),
      suitable: v.boolean(),
      options: v.array(
        v.object({
          entry: v.string(),
          end: spellEffectEndValidator,
          name: v.string(),
          kind: v.union(
            v.literal('weapon'),
            v.literal('natural'),
            v.literal('unarmed'),
            v.literal('ammunition'),
            v.literal('armor'),
            v.literal('shield'),
          ),
          active: v.boolean(),
          suitable: v.boolean(),
        }),
      ),
    }),
    v.null(),
  ),
});
function attackLineValidator() {
  return v.object({
    weaponEntryId: v.string(),
    weaponName: v.string(),
    launcherEntryId: v.union(v.string(), v.null()),
    ammunitionEntryId: v.union(v.string(), v.null()),
    hand: attackHandValidator,
    end: weaponEndValidator,
    mode: attackRoutineModeValidator,
    attackKind: v.union(
      v.literal('manufactured'),
      v.literal('natural'),
      v.literal('unarmed'),
    ),
    naturalRole: v.optional(naturalAttackRoleValidator),
    damageKind: v.optional(
      v.union(
        v.literal('lethal'),
        v.literal('nonlethal'),
        v.literal('lethalOrNonlethal'),
      ),
    ),
    damageDice: v.string(),
    damageType: v.string(),
    damageDiceSource: v.object({
      sheetEntryId: v.string(),
      entryName: v.string(),
      source: v.string(),
    }),
    extraDamage: v.array(extraDamageValidator),
    attackBonus: breakdownValidator,
    damageBonus: breakdownValidator,
    criticalThreat: breakdownValidator,
    criticalMultiplier: breakdownValidator,
    rangeIncrement: v.union(breakdownValidator, v.null()),
    rangePenalty: v.union(v.number(), v.null()),
    extraAttack: v.optional(
      v.object({
        kind: v.union(
          v.literal('haste'),
          v.literal('rapidShot'),
          v.literal('medusasWrath'),
          v.literal('flurry'),
        ),
        sheetEntryId: v.string(),
        name: v.string(),
      }),
    ),
    projectiles: v.optional(v.number()),
    vitalStrike: v.optional(
      v.object({
        multiplier: v.number(),
        weaponDice: v.string(),
        sheetEntryId: v.string(),
        name: v.string(),
      }),
    ),
  });
}
const routineOptionViewValidator = v.object({
  catalogEntryId: v.string(),
  name: v.string(),
  ruleIdentity: v.union(v.string(), v.null()),
  switchedOn: v.boolean(),
  available: v.boolean(),
  applicable: v.boolean(),
});
const calculatedValidator = v.object({
  affectedStatisticTargets: v.array(
    zodOutputToConvex(sheetStatisticTargetSchema),
  ),
  companionProgression: v.union(
    zodOutputToConvex(companionProgressionResolutionSchema),
    v.null(),
  ),
  cohort: v.union(zodOutputToConvex(cohortResolutionSchema), v.null()),
  familiar: v.union(zodOutputToConvex(familiarFactsSchema), v.null()),
  entryNotes: v.array(zodOutputToConvex(sourcedSituationalNoteSchema)),
  spellCollections: v.object({
    collections: v.array(
      v.object({
        classEntryId: v.string(),
        classTag: v.string(),
        // Null while an Archetype choice leaves the recording model pending.
        record: v.union(
          v.literal('known'),
          v.literal('book'),
          v.literal('none'),
          v.null(),
        ),
        heading: v.union(
          v.literal('Spells known'),
          v.literal('Spellbook'),
          v.literal('Formula book'),
          v.literal('Familiar'),
          v.null(),
        ),
        readOnly: v.boolean(),
        spells: v.array(collectionSpellValidator),
        levels: v.array(
          v.object({
            spellLevel: v.number(),
            count: v.number(),
            allowance: v.union(v.number(), v.null()),
          }),
        ),
      }),
    ),
    spellsWithoutSpellcasting: v.array(collectionSpellValidator),
  }),
  attackRoutines: v.array(
    v.object({
      entryId: v.string(),
      name: v.string(),
      weaponEntryId: v.string(),
      hands: attackRoutineHandsValidator,
      mode: attackRoutineModeValidator,
      offHand: v.optional(attackRoutineOffHandValidator),
      ammunitionEntryId: v.optional(v.string()),
      rangeIncrements: v.optional(v.number()),
      attackRateNotes: v.array(v.string()),
      twoWeaponPenaltySummary: v.union(v.string(), v.null()),
      options: v.array(routineOptionViewValidator),
      optionNotes: v.array(v.string()),
      twoWeaponRend: v.union(
        v.object({
          sheetEntryId: v.string(),
          name: v.string(),
          damageDice: v.string(),
          damageBonus: breakdownValidator,
        }),
        v.null(),
      ),
      flurry: v.union(
        v.object({
          version: v.union(v.literal('core'), v.literal('unchained')),
          sheetEntryId: v.string(),
          name: v.string(),
          monkLevel: v.number(),
          baseAttackBonus: breakdownValidator,
          extraAttacks: v.number(),
          attackPenalty: v.number(),
          combatExpertise: v.union(
            v.object({
              sheetEntryId: v.string(),
              name: v.string(),
              dodgeBonus: v.number(),
            }),
            v.null(),
          ),
        }),
        v.null(),
      ),
      single: v.array(attackLineValidator()),
      full: v.array(attackLineValidator()),
      warnings: v.array(zodOutputToConvex(characterSheetWarningSchema)),
    }),
  ),
  itemParts: v.array(itemPartsViewValidator),
  spellEffects: v.array(spellEffectViewValidator),
  spellcastings: v.array(spellcastingValidator),
  castingAdvances: v.array(castingAdvanceValidator),
  archetypeCastings: v.array(zodOutputToConvex(archetypeCastingSummarySchema)),
  spellcastingUnresolved: v.array(v.string()),
  racial: v.object({
    raceEntryId: v.union(v.string(), v.null()),
    size: v.union(
      v.union(...creatureSizes.map((size) => v.literal(size))),
      v.null(),
    ),
    creatureTypes: v.array(v.string()),
    creatureSubtypes: v.array(v.string()),
    countsAsRaces: v.array(v.string()),
    racialTraitIdentities: v.array(v.string()),
    favoredClassCount: v.number(),
    bonusSkillRanksPerLevel: v.number(),
    proficiencies: v.array(
      v.union(
        v.object({
          category: v.union(
            ...proficiencyCategories.map((value) => v.literal(value)),
          ),
        }),
        v.object({
          baseType: v.string(),
          asMartial: v.optional(v.literal(true)),
        }),
        v.object({ group: v.string() }),
      ),
    ),
  }),
  resolvedEntries: v.array(resolvedEntryValidator),
  calculationWarnings: v.optional(
    v.array(zodOutputToConvex(characterSheetWarningSchema)),
  ),
  warningsForAcceptance: v.array(
    zodOutputToConvex(characterSheetWarningSchema),
  ),
  conditionEffects: v.array(zodOutputToConvex(conditionEffectSchema)),
  archetypes: archetypesValidator,
  abilities: v.object({
    strength: abilityValue,
    dexterity: abilityValue,
    constitution: abilityValue,
    intelligence: abilityValue,
    wisdom: abilityValue,
    charisma: abilityValue,
  }),
  level: v.number(),
  hitDice: v.union(v.number(), v.null()),
  racialHitDice: v.number(),
  classLevels: v.array(
    v.object({
      entryId: v.string(),
      position: v.number(),
      classEntryId: v.union(v.string(), v.null()),
      classLevel: v.union(v.number(), v.null()),
      hitDice: v.number(),
      abilityIncreaseDue: v.boolean(),
      skillRankBudget: v.union(v.number(), v.null()),
      skillRanksSpent: v.number(),
      skillRanksRemaining: v.union(v.number(), v.null()),
      skillRankCap: v.number(),
      cumulativeSkillRanks: v.array(
        v.object({ skill: v.string(), ranks: v.number() }),
      ),
      exceededSkillRankCaps: v.array(
        v.object({ skill: v.string(), ranks: v.number() }),
      ),
    }),
  ),
  budgets: v.object({
    kind: v.union(
      v.literal('ordinary'),
      v.literal('animalCompanion'),
      v.literal('eidolon'),
    ),
    intelligenceModifier: v.number(),
    generalFeats: v.number(),
    racialSkillRanks: v.union(v.number(), v.null()),
    skillRanks: v.union(v.number(), v.null()),
    skillRankCap: v.number(),
  }),
  ownProgression: v.object({
    classBases: v.object({
      bab: v.union(v.number(), v.null()),
      saves: v.object({
        fort: v.union(v.number(), v.null()),
        ref: v.union(v.number(), v.null()),
        will: v.union(v.number(), v.null()),
      }),
    }),
    totalBases: v.object({
      bab: v.union(v.number(), v.null()),
      saves: v.object({
        fort: v.union(v.number(), v.null()),
        ref: v.union(v.number(), v.null()),
        will: v.union(v.number(), v.null()),
      }),
    }),
  }),
  skills: v.array(
    v.object({
      key: v.union(...skillDefinitions.map(({ key }) => v.literal(key))),
      name: v.string(),
      ability: abilityValidator,
      ranks: v.number(),
      ownRanks: v.number(),
      recordedRanks: v.number(),
      classSkill: v.boolean(),
      armorCheckPenalty: v.number(),
    }),
  ),
  equipment: v.object({
    items: v.array(
      v.object({
        entryId: v.string(),
        name: v.string(),
        slot: v.union(v.literal('armor'), v.literal('shield')),
        category: v.union(v.string(), v.null()),
        armorBonus: v.number(),
        enhancement: v.number(),
        maxDexterityBonus: v.union(v.number(), v.null()),
        armorCheckPenalty: v.number(),
        spellFailure: v.number(),
        masterwork: v.boolean(),
        materialNote: v.union(v.string(), v.null()),
        proficient: v.boolean(),
      }),
    ),
    armorCheckPenalty: v.number(),
    spellFailure: v.number(),
    maxDexterityBonus: v.union(v.number(), v.null()),
    nonproficiencyAttackPenalty: v.number(),
  }),
  proficiencies: v.object({
    grants: v.array(
      v.object({
        proficiency: manualProficiencyValidator,
        entryId: v.string(),
        name: v.string(),
      }),
    ),
    choices: v.array(
      v.object({
        entryId: v.string(),
        name: v.string(),
        choice: v.union(v.string(), v.null()),
      }),
    ),
    added: v.array(manualProficiencyValidator),
    removed: v.array(manualProficiencyValidator),
    missingChoices: v.array(
      v.object({
        entryId: v.string(),
        name: v.string(),
        kind: v.union(v.literal('classLevel'), v.literal('entry')),
      }),
    ),
  }),
  proficiencyPrerequisites: v.array(
    v.object({
      entryId: v.string(),
      view: v.union(v.literal('current'), v.literal('recorded')),
      proficiency: manualProficiencyValidator,
      met: v.boolean(),
    }),
  ),
  prerequisites: v.array(
    v.object({
      entryId: v.string(),
      view: v.union(v.literal('current'), v.literal('recorded')),
      clauseIndex: v.number(),
      clause: prerequisiteValidator,
      met: v.union(v.boolean(), v.null()),
    }),
  ),
  selectionRules: v.object({
    slots: v.array(
      v.object({
        id: v.string(),
        kind: v.union(v.literal('feat'), v.literal('trait')),
        label: v.string(),
        count: v.number(),
        used: v.number(),
        remaining: v.number(),
        grantedBy: v.optional(
          v.union(
            v.object({ kind: v.literal('grant'), grantKey: grantKeyValidator }),
            v.object({ kind: v.literal('entry'), entryId: v.string() }),
          ),
        ),
        slotIndex: v.optional(v.number()),
        featTypes: v.optional(v.array(v.string())),
        feats: v.optional(v.array(v.string())),
        ignoresPrerequisites: v.optional(v.boolean()),
      }),
    ),
    budgets: v.object({
      generalFeats: v.union(v.number(), v.null()),
      bonusFeats: v.number(),
      traits: v.number(),
      drawbacks: v.number(),
    }),
    warnings: v.array(zodOutputToConvex(characterSheetWarningSchema)),
  }),
  weaponProficiencies: v.array(
    v.object({
      entryId: v.string(),
      name: v.string(),
      hands: attackRoutineHandsValidator,
      proficient: v.boolean(),
      attackPenalty: v.number(),
      armorNonproficiencyPenalty: v.number(),
      totalAttackPenalty: v.number(),
      breakdown: breakdownValidator,
    }),
  ),
  hp: v.union(v.number(), v.null()),
  creationSettings: creationSettingsValidator,
  pointBuy: v.union(
    v.null(),
    v.object({
      spent: v.union(v.number(), v.null()),
    }),
  ),
  warnings: v.array(zodOutputToConvex(characterSheetWarningSchema)),
  breakdowns: v.record(v.string(), breakdownValidator),
  abilityModifierBreakdowns: v.record(v.string(), breakdownValidator),
  derivedStatistics: v.object({
    bab: breakdownValidator,
    fortitude: breakdownValidator,
    reflex: breakdownValidator,
    will: breakdownValidator,
    initiative: breakdownValidator,
    cmb: breakdownValidator,
    ac: breakdownValidator,
    touchAc: breakdownValidator,
    flatFootedAc: breakdownValidator,
    cmd: breakdownValidator,
    flatFootedCmd: breakdownValidator,
  }),
});
export const create = campaignMutation({
  args: {
    organizationId: v.optional(v.string()),
    campaignId: v.optional(v.id('campaign')),
    name: v.string(),
    kind: v.union(v.literal('pc'), v.literal('npc')),
    description: v.optional(v.string()),
    operationId: v.string(),
  },
  returns: v.id('character'),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Authentication required');
    const user = await getUser(ctx, identity.tokenIdentifier);
    if (args.campaignId) {
      if (!args.organizationId)
        throw new ConvexError('Organization is required for a campaign');
      const { campaign } = await requireCharacterCampaignAccess(ctx, {
        campaignId: args.campaignId,
        organizationId: args.organizationId,
      });
      requireFixtureCampaign(campaign);
    } else {
      if (args.organizationId !== undefined)
        throw new ConvexError('Campaign is required for an organization');
      if (!user.characterSheetDemo)
        throw new ConvexError(
          "Private character sheets aren't available for your account yet.",
        );
    }
    if (!args.name.trim())
      throw new ConvexError('Character name cannot be empty');
    await requireCatalogCharacterAdmission(ctx, {
      campaignId: args.campaignId,
    });
    const characterId = await ctx.db.insert('character', {
      ...(args.campaignId
        ? { campaignId: args.campaignId }
        : { sheetDemo: true as const }),
      name: args.name.trim(),
      kind: args.kind,
      description: args.description ?? '',
      ownerId: identity.tokenIdentifier,
      isActive: true,
      level: 1,
      ...defaultAbilityScores,
    });
    await initializeCharacterSheet(ctx, {
      characterId,
      operationId: args.operationId,
      updatedBy: identity.tokenIdentifier,
    });
    return characterId;
  },
});
const characterSheetReadValidator = v.union(
  v.null(),
  v.object({
    character: schema.doc('character'),
    owner: v.union(characterOwnerValidator, v.null()),
    campaign: v.union(
      v.null(),
      v.object({
        campaignId: v.id('campaign'),
        campaignName: v.string(),
        organizationId: v.string(),
        ownershipAvailable: v.boolean(),
      }),
    ),
    entries: v.array(schema.doc('characterSheetEntry')),
    catalogEntries: v.array(schema.doc('catalogEntry')),
    baseScoresEntry: schema.doc('catalogEntry'),
    familiarRelationshipId: v.union(v.id('companionRelationship'), v.null()),
    companionCalculationInputs: v.optional(
      v.union(
        v.null(),
        v.object({
          kind: v.literal('progression'),
          companionLinkedInputs: v.array(
            zodOutputToConvex(companionLinkedInputResolutionSchema),
          ),
          companionProgressionSources: v.array(
            zodOutputToConvex(companionProgressionSourceSchema),
          ),
        }),
        v.object({
          kind: v.literal('cohort'),
          cohort: zodOutputToConvex(cohortCalculationInputSchema),
        }),
      ),
    ),
    calculated: calculatedValidator,
    permanentCalculated: calculatedValidator.omit('resolvedEntries'),
    acceptedWarnings: v.array(schema.doc('acceptedWarning')),
    revision: v.number(),
    lastOperationId: v.union(v.string(), v.null()),
    updatedBy: v.union(v.string(), v.null()),
    catalogView: v.optional(
      v.object({
        releaseNumber: v.union(v.number(), v.null()),
        calculationIdentity: v.string(),
        resources: v.object({
          castingTables: v.optional(
            zodOutputToConvex(reviewedCastingTablesSchema).extend({
              tables: v.record(
                v.string(),
                zodOutputToConvex(
                  reviewedCastingTablesSchema.shape.tables.valueType,
                ),
              ),
            }),
          ),
        }),
        legalInputs: v.union(
          v.null(),
          zodOutputToConvex(releaseLegalInputsSchema),
        ),
        // #411: local previews calculate retired Grant targets as the server does.
        retired: v.optional(
          v.object({
            ruleIdentities: v.array(v.string()),
            retainedGrantIds: v.array(v.string()),
          }),
        ),
        definitions: v.array(schema.doc('catalogEntry')),
        // #411: offered definitions retired from the catalog; pickers show
        // them as unavailable except where the Character already uses them.
        heldDefinitionIds: v.optional(v.array(v.id('catalogEntry'))),
        advisories: v.array(
          v.object({
            catalogEntryId: v.id('catalogEntry'),
            originalId: v.id('catalogEntry'),
            originalName: v.string(),
          }),
        ),
      }),
    ),
  }),
);

export const read = query({
  args: { ...scope, characterId: v.string() },
  returns: characterSheetReadValidator,
  async handler(ctx, args) {
    const characterId = ctx.db.normalizeId('character', args.characterId);
    if (!characterId) throw new ConvexError(characterNotFound);
    const baseline = await loadCharacterSheet(
      ctx,
      { ...args, characterId },
      { isCompanionInputSkipped: true },
    );
    if (!baseline) return null;
    const sheet = await applyCompanionToSheet(ctx, baseline, {
      readBudget: baseline.companionReadBudget,
    });
    const {
      actor: _actor,
      permanentResolvedEntries: _permanentResolvedEntries,
      resources: _resources,
      retired: _retired,
      calculationIdentity: _calculationIdentity,
      initialSupportingEntryKeys: _initialSupportingEntryKeys,
      companionReadBudget: _companionReadBudget,
      ...result
    } = sheet;
    const persistedRoutines = (
      routines: typeof result.calculated.attackRoutines,
    ) =>
      routines.map(
        (
          routine,
        ): Infer<typeof calculatedValidator>['attackRoutines'][number] => {
          const { offHand, ...fields } = routine;
          if (!offHand || offHand.kind === 'otherEnd')
            return { ...fields, ...(offHand ? { offHand } : {}) };
          if (isUnarmedStrike(offHand.weaponEntryId))
            return {
              ...fields,
              offHand: { ...offHand, weaponEntryId: UNARMED_STRIKE_ID },
            };
          const weaponEntryId = ctx.db.normalizeId(
            'characterSheetEntry',
            offHand.weaponEntryId,
          );
          if (!weaponEntryId)
            throw new ConvexError('Off-hand weapon reference is invalid');
          return { ...fields, offHand: { ...offHand, weaponEntryId } };
        },
      );
    const owners = await readCharacterOwners(
      ctx,
      [sheet.character],
      sheet.actor,
    );
    const boundary = await readSelectedCatalogBoundary(ctx);
    // Item Ability references came from stored state, so each is a Catalog
    // Entry ID; the sheet hands them back as such.
    const persistedItemParts = (items: typeof result.calculated.itemParts) =>
      items.map(
        (item): Infer<typeof calculatedValidator>['itemParts'][number] => ({
          ...item,
          parts: item.parts.map((part) => ({
            ...part,
            abilities: part.abilities.map((ability) => {
              const catalogEntryId = ctx.db.normalizeId(
                'catalogEntry',
                ability.catalogEntryId,
              );
              if (!catalogEntryId)
                throw new ConvexError('Item Ability reference is invalid');
              return { ...ability, catalogEntryId };
            }),
          })),
        }),
      );
    const catalogChoices = await readCatalogChoices(
      ctx,
      sheet.character,
      sheet.catalogEntries.filter(
        (definition) =>
          definition.scope === 'character' &&
          definition.characterId === characterId &&
          !definition.browseOnly,
      ),
      { isSpellIncluded: false, isHeldIncluded: true },
    );
    const response = {
      ...result,
      calculated: {
        ...result.calculated,
        attackRoutines: persistedRoutines(result.calculated.attackRoutines),
        itemParts: persistedItemParts(result.calculated.itemParts),
      },
      permanentCalculated: {
        ...result.permanentCalculated,
        attackRoutines: persistedRoutines(
          result.permanentCalculated.attackRoutines,
        ),
        itemParts: persistedItemParts(result.permanentCalculated.itemParts),
      },
      catalogView: {
        releaseNumber: boundary.control?.releaseNumber ?? null,
        calculationIdentity: boundary.calculationIdentity,
        resources: sheet.resources,
        ...(sheet.retired
          ? {
              retired: {
                ruleIdentities: [...sheet.retired.ruleIdentities],
                retainedGrantIds: [...sheet.retired.retainedGrantIds],
              },
            }
          : {}),
        legalInputs: boundary.release
          ? await readLegalInputs(ctx, boundary.release)
          : null,
        definitions: catalogChoices.definitions,
        ...(catalogChoices.heldDefinitionIds.length
          ? { heldDefinitionIds: catalogChoices.heldDefinitionIds }
          : {}),
        advisories: await readCatalogAdvisories(ctx, sheet),
      },
      owner: sheet.character.ownerId
        ? (owners.get(sheet.character.ownerId) ?? null)
        : null,
    };
    const compatibleResponse: Omit<typeof response, 'catalogView'> & {
      catalogView?: typeof response.catalogView;
    } = response;
    return compatibleResponse;
  },
});

const writeScope = { ...scope, operationId: v.string() };
/**
 * An eidolon record without a version takes its Unchained eidolon
 * relationship's version, as the sheet's first record does, so it never
 * calculates as an original eidolon there. Elsewhere it stays original.
 */
async function withRelationshipEidolonVersion(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  progression: CompanionProgressionState | undefined,
): Promise<CompanionProgressionState | undefined> {
  if (!progression || !isEidolonState(progression) || progression.version)
    return progression;
  const unchained = await ctx.db
    .query('companionRelationship')
    .withIndex('by_companionCharacterId_and_kind', (q) =>
      q.eq('companionCharacterId', characterId).eq('kind', 'unchainedEidolon'),
    )
    .first();
  return unchained
    ? { ...progression, version: 'unchained' as const }
    : progression;
}
export const setCompanionProgression = campaignMutation({
  args: {
    ...writeScope,
    progression: v.union(companionProgressionStateValidator, v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    if (!args.operationId.trim())
      throw new ConvexError('Provide an operation identifier');
    const parsed =
      args.progression === null
        ? null
        : companionProgressionStateSchema.safeParse(args.progression);
    if (parsed && !parsed.success)
      throw new ConvexError(
        'Enter valid companion choices and whole nonnegative skill ranks',
      );
    const sheet = await loadWritableSheet(ctx, args);
    const progression = await withRelationshipEidolonVersion(
      ctx,
      args.characterId,
      parsed?.success ? parsed.data : undefined,
    );
    const base = sheet.entries.find((entry) => entry.kind === 'base');
    if (!base) throw new ConvexError('Base scores are unavailable');
    const state = { ...base.state, companionProgression: progression };
    if (compareValues(state, base.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', base._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === base._id ? { ...base, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
/**
 * Record or clear a cohort's monster equivalence on its own base entry
 * (#417): a published Bestiary mapping or an explicitly entered level for
 * an unlisted creature, `level: null` while it is missing. Clearing makes it
 * an ordinary cohort again. Its Class Levels and every other choice stay.
 */
export const setCohortEquivalence = campaignMutation({
  args: {
    ...writeScope,
    equivalence: v.union(cohortEquivalenceStateValidator, v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    if (!args.operationId.trim())
      throw new ConvexError('Provide an operation identifier');
    const parsed =
      args.equivalence === null
        ? null
        : cohortEquivalenceStateSchema.safeParse(args.equivalence);
    if (parsed && !parsed.success)
      throw new ConvexError(
        `Enter a Cohort Equivalence from 1 to ${maxCohortEquivalence} and a creature name of at most ${maxCohortCreatureLength} characters`,
      );
    const sheet = await loadWritableSheet(ctx, args);
    const base = sheet.entries.find((entry) => entry.kind === 'base');
    if (!base) throw new ConvexError('Base scores are unavailable');
    const { cohortEquivalence: _previous, ...rest } = base.state;
    const state = parsed?.success
      ? { ...rest, cohortEquivalence: parsed.data }
      : rest;
    if (compareValues(state, base.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', base._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === base._id ? { ...base, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const buildOut = campaignMutation({
  args: writeScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (sheet.character.sheetMode === 'full') return null;
    await ctx.db.patch('character', args.characterId, { sheetMode: 'full' });
    sheet.character = { ...sheet.character, sheetMode: 'full' };
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
const rowScope = { ...writeScope, entryId: v.id('characterSheetEntry') };
const personalAdjustmentFields = {
  name: v.string(),
  modifiers: v.array(modifierValidator.omit('stacksWithinEntry')),
};
async function loadWritableSheet(ctx: MutationCtx, args: CharacterScope) {
  const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
  if (!sheet) throw new ConvexError('Character has no sheet');
  return sheet;
}
async function loadProjectedWritableSheet(
  ctx: MutationCtx,
  args: CharacterScope,
) {
  const sheet = await loadWritableSheet(ctx, args);
  return await applyCompanionToSheet(ctx, sheet, {
    trustedLinkedInputs: true,
    readBudget: sheet.companionReadBudget,
  });
}

async function purgeRemovedAttackRoutines(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  keepEntryId?: Id<'characterSheetEntry'>,
) {
  const removed = ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId_and_kind_and_active', (q) =>
      q
        .eq('characterId', characterId)
        .eq('kind', 'attackRoutine')
        .eq('active', false),
    )
    .order('desc');
  const purgedIds = new Set<string>();
  let retainedId = keepEntryId;
  for await (const entry of removed) {
    retainedId ??= entry._id;
    if (entry._id === retainedId) continue;
    await ctx.db.delete('characterSheetEntry', entry._id);
    purgedIds.add(entry._id);
  }
  if (purgedIds.size) {
    const acceptances = await ctx.db
      .query('acceptedWarning')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(maxAcceptedWarnings + 1);
    for (const accepted of acceptances)
      if (purgedIds.has(accepted.subject.split(':')[0] ?? ''))
        await ctx.db.delete('acceptedWarning', accepted._id);
  }
  return purgedIds;
}
async function loadWritableRoutineSheet(
  ctx: MutationCtx,
  args: CharacterScope,
) {
  // Retire earlier Undo rows before the sheet-size guard can strand old removals.
  const access = await requireCharacterAccess(ctx, args);
  await purgeRemovedAttackRoutines(ctx, access.character._id);
  return await loadWritableSheet(ctx, args);
}
async function insertAttackRoutine(
  ctx: MutationCtx,
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  state: {
    name: string;
    weaponEntryId: Infer<typeof attackRoutineWeaponValidator>;
    hands: Infer<typeof attackRoutineHandsValidator>;
    mode: Infer<typeof attackRoutineModeValidator>;
    offHand?: Infer<typeof attackRoutineOffHandValidator>;
    ammunitionEntryId?: Id<'characterSheetEntry'>;
    rangeIncrements?: number;
    naturalAttackEntryIds?: Id<'characterSheetEntry'>[];
    availableLimbs?: number;
    options?: Id<'catalogEntry'>[];
  },
) {
  if (sheet.entries.length >= maxCharacterChildRows)
    throw new ConvexError('Character sheet is too large');
  const entryId = await ctx.db.insert('characterSheetEntry', {
    characterId: sheet.character._id,
    kind: 'attackRoutine',
    active: true,
    state: { kind: 'attackRoutine', ...state, revision: 0 },
  });
  const entry = await ctx.db.get('characterSheetEntry', entryId);
  if (!entry) throw new ConvexError('Attack Routine is unavailable');
  sheet.entries.push(entry);
  return entryId;
}
const attackRoutineFields = {
  name: v.optional(v.string()),
  hands: v.optional(attackRoutineHandsValidator),
  mode: v.optional(attackRoutineModeValidator),
  offHand: v.optional(v.union(attackRoutineOffHandValidator, v.null())),
  ammunitionEntryId: v.optional(v.union(v.id('characterSheetEntry'), v.null())),
  rangeIncrements: v.optional(v.number()),
  naturalAttackEntryIds: v.optional(v.array(v.id('characterSheetEntry'))),
  availableLimbs: v.optional(v.number()),
  options: v.optional(v.array(v.id('catalogEntry'))),
};
type AttackRoutineChoices = {
  hands?: Infer<typeof attackRoutineHandsValidator>;
  mode?: Infer<typeof attackRoutineModeValidator>;
  offHand?: Infer<typeof attackRoutineOffHandValidator> | null;
  ammunitionEntryId?: Id<'characterSheetEntry'> | null;
  rangeIncrements?: number;
  naturalAttackEntryIds?: Id<'characterSheetEntry'>[];
  availableLimbs?: number;
  options?: Id<'catalogEntry'>[];
};
/** The supplied routine choices; null clears are applied by the caller. */
function routineChoices({
  hands,
  mode,
  offHand,
  ammunitionEntryId,
  rangeIncrements,
  naturalAttackEntryIds,
  availableLimbs,
  options,
}: AttackRoutineChoices) {
  return {
    ...(options !== undefined ? { options: [...new Set(options)] } : {}),
    ...(hands !== undefined ? { hands } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(offHand ? { offHand } : {}),
    ...(ammunitionEntryId ? { ammunitionEntryId } : {}),
    ...(rangeIncrements !== undefined ? { rangeIncrements } : {}),
    ...(naturalAttackEntryIds !== undefined ? { naturalAttackEntryIds } : {}),
    ...(availableLimbs !== undefined ? { availableLimbs } : {}),
  };
}
/**
 * A new ammunition choice must be a Gear row; resending the retained choice
 * keeps it for repair even when that row is gone or no longer an item.
 */
function requireRoutineAmmunition(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  ammunitionEntryId: Id<'characterSheetEntry'> | null | undefined,
  retainedAmmunitionEntryId?: Id<'characterSheetEntry'>,
) {
  if (!ammunitionEntryId || ammunitionEntryId === retainedAmmunitionEntryId)
    return;
  const ammo = sheet.entries.find((row) => row._id === ammunitionEntryId);
  if (ammo?.kind !== 'item')
    throw new ConvexError('Ammunition does not belong to this Character');
}
/** CRB p. 180: a submitted range count is refused beyond the routine maximum. */
function requireRoutineRange(
  rangeIncrements: number | undefined,
  routine: Parameters<typeof maximumRangeIncrements>[0],
) {
  if (rangeIncrements === undefined) return;
  if (!Number.isSafeInteger(rangeIncrements) || rangeIncrements < 1)
    throw new ConvexError('Range increments must be a positive whole number');
  const maximum = maximumRangeIncrements(routine);
  if (rangeIncrements > maximum)
    throw new ConvexError(
      `${maximum === 5 ? 'Thrown' : 'Ranged'} attacks reach at most ${maximum} range increments`,
    );
}
function requireRoutineNaturals(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  naturalAttackEntryIds: Id<'characterSheetEntry'>[] | undefined,
  retainedIds: Id<'characterSheetEntry'>[] = [],
) {
  if (!naturalAttackEntryIds) return;
  if (naturalAttackEntryIds.length > maxCharacterChildRows)
    throw new ConvexError('Too many natural attacks');
  for (const entryId of naturalAttackEntryIds) {
    // The sheet loader checks ownership of every recorded routine reference.
    // Changed or missing definitions remain advisory for an unchanged choice.
    if (retainedIds.includes(entryId)) continue;
    const weapon = getRoutineWeapon(
      sheet,
      entryId,
      'Natural attack does not belong to this Character',
    );
    if (!weapon.detail.naturalAttack)
      throw new ConvexError('Choose a natural attack');
  }
}
const maxRoutineOptions = 64;
/**
 * A newly switched-on option must be a Routine Option feat definition this
 * Character can use; the sheet loader authorizes every submitted reference.
 * Without an active Selection of the feat the option is recorded with an
 * advisory warning. Resending a retained choice keeps it for repair.
 */
function requireRoutineOptions(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  options: Id<'catalogEntry'>[] | undefined,
  retainedIds: Id<'catalogEntry'>[] = [],
) {
  if (!options) return;
  if (options.length > maxRoutineOptions)
    throw new ConvexError('Too many Routine Options');
  for (const id of options) {
    if (retainedIds.includes(id)) continue;
    const definition = sheet.catalogEntries.find((row) => row._id === id);
    if (!definition)
      throw new ConvexError('Routine Option does not belong to this Character');
    if (!isRoutineOptionDefinition(definition))
      throw new ConvexError('Choose a Routine Option for this routine');
  }
}
function requireRoutineLimbs(availableLimbs: number | undefined) {
  if (availableLimbs !== undefined)
    requireNonnegativeInteger(availableLimbs, 'Available limbs');
}
function requireRoutineOffHand(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  offHand: Infer<typeof attackRoutineOffHandValidator> | null | undefined,
  retainedOffHand?: Infer<typeof attackRoutineOffHandValidator>,
) {
  if (offHand?.kind !== 'weapon') return;
  const retainedMissingWeapon =
    retainedOffHand?.kind === 'weapon' &&
    offHand.weaponEntryId === retainedOffHand.weaponEntryId &&
    !sheet.entries.some((row) => row._id === offHand.weaponEntryId);
  if (retainedMissingWeapon) return;
  getRoutineWeapon(
    sheet,
    offHand.weaponEntryId,
    'Off-hand weapon does not belong to this Character',
  );
}
function requireRoutineName(name: string) {
  if (!name.trim()) throw new ConvexError('Attack Routine name is required');
  if (name.trim().length > 256)
    throw new ConvexError('Attack Routine name is too long');
  return name.trim();
}
function getRoutineWeapon(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  weaponEntryId: Infer<typeof attackRoutineWeaponValidator>,
  message = 'Weapon does not belong to this Character',
): { name: string; detail: WeaponDetail } {
  if (isUnarmedStrike(weaponEntryId))
    return { name: 'Unarmed strike', detail: { ...builtInUnarmedWeapon } };
  const weapon = sheet.entries.find((row) => row._id === weaponEntryId);
  const definition =
    weapon?.kind === 'item'
      ? sheet.catalogEntries.find((row) => row._id === weapon.catalogEntryId)
      : undefined;
  if (definition?.detail.kind !== 'item' || !definition.detail.weapon)
    throw new ConvexError(message);
  return { name: definition.name, detail: definition.detail.weapon };
}
function getAttackRoutine(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'attackRoutine')
    throw new ConvexError('Attack Routine does not belong to this Character');
  return entry;
}
export const createAttackRoutine = campaignMutation({
  args: {
    ...writeScope,
    ...attackRoutineFields,
    weaponEntryId: attackRoutineWeaponValidator,
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const weapon = getRoutineWeapon(sheet, args.weaponEntryId);
    requireRoutineOffHand(sheet, args.offHand);
    requireRoutineAmmunition(sheet, args.ammunitionEntryId);
    requireRoutineNaturals(sheet, args.naturalAttackEntryIds);
    requireRoutineLimbs(args.availableLimbs);
    requireRoutineOptions(sheet, args.options);
    const state = {
      name: requireRoutineName(args.name ?? weapon.name),
      weaponEntryId: args.weaponEntryId,
      ...defaultAttackRoutineConfiguration(weapon.detail),
      ...routineChoices(args),
    };
    requireRoutineRange(args.rangeIncrements, state);
    const entryId = await insertAttackRoutine(ctx, sheet, state);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});
export const editAttackRoutine = campaignMutation({
  args: {
    ...rowScope,
    ...attackRoutineFields,
    weaponEntryId: v.optional(attackRoutineWeaponValidator),
  },
  returns: v.number(),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const entry = getAttackRoutine(sheet, args.entryId);
    if (!entry.active) throw new ConvexError('Attack Routine was deleted');
    requireRoutineOffHand(sheet, args.offHand, entry.state.offHand);
    requireRoutineAmmunition(
      sheet,
      args.ammunitionEntryId,
      entry.state.ammunitionEntryId,
    );
    requireRoutineNaturals(
      sheet,
      args.naturalAttackEntryIds,
      entry.state.naturalAttackEntryIds,
    );
    requireRoutineLimbs(args.availableLimbs);
    requireRoutineOptions(sheet, args.options, entry.state.options);
    const replacement =
      args.weaponEntryId !== undefined &&
      args.weaponEntryId !== entry.state.weaponEntryId
        ? getRoutineWeapon(sheet, args.weaponEntryId)
        : undefined;
    const state = {
      ...entry.state,
      ...(replacement
        ? defaultAttackRoutineConfiguration(replacement.detail)
        : {}),
      ...(args.name !== undefined
        ? { name: requireRoutineName(args.name) }
        : {}),
      ...routineChoices(args),
      ...(args.weaponEntryId !== undefined
        ? { weaponEntryId: args.weaponEntryId }
        : {}),
    };
    if (args.offHand === null) delete state.offHand;
    if (args.ammunitionEntryId === null) delete state.ammunitionEntryId;
    requireRoutineRange(args.rangeIncrements, state);
    if (compareValues(state, entry.state) === 0)
      return entry.state.revision ?? 0;
    state.revision = (entry.state.revision ?? 0) + 1;
    await ctx.db.patch('characterSheetEntry', entry._id, { state });
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? { ...entry, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return state.revision;
  },
});
export const deleteAttackRoutine = campaignMutation({
  args: rowScope,
  returns: v.number(),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const entry = getAttackRoutine(sheet, args.entryId);
    if (!entry.active) return entry.state.revision ?? 0;
    const purgedIds = await purgeRemovedAttackRoutines(
      ctx,
      sheet.character._id,
      entry._id,
    );
    sheet.entries = sheet.entries.filter((row) => !purgedIds.has(row._id));
    const state = {
      ...entry.state,
      revision: (entry.state.revision ?? 0) + 1,
    };
    await ctx.db.patch('characterSheetEntry', entry._id, {
      active: false,
      state,
    });
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? { ...entry, active: false, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return state.revision;
  },
});
export const restoreAttackRoutine = campaignMutation({
  args: rowScope,
  returns: v.number(),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const entry = getAttackRoutine(sheet, args.entryId);
    if (entry.active) return entry.state.revision ?? 0;
    const state = { ...entry.state, revision: (entry.state.revision ?? 0) + 1 };
    await ctx.db.patch('characterSheetEntry', entry._id, {
      active: true,
      state,
    });
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? { ...entry, active: true, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return state.revision;
  },
});
function getClassLevel(
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((item) => item._id === entryId);
  if (entry?.kind !== 'classLevel')
    throw new ConvexError('Class Level does not belong to this Character');
  return entry;
}
function requireClassDefinition(
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  classEntryId: Id<'catalogEntry'>,
) {
  const definition = sheet.catalogEntries.find(
    (entry) => entry._id === classEntryId,
  );
  if (definition?.detail.kind !== 'class')
    throw new ConvexError('Class does not belong to this Character');
  return definition;
}
/**
 * #411: the kinds of use a Character may continue with retired content: more
 * levels of a class it has, and its own race, Archetype or alternate trait.
 */
type ExistingUse = 'classLevel' | 'race' | 'archetype' | 'racialTrait';

/** Whether this Character already uses the rule identity as `use`. */
function hasExistingUse(
  sheet: WritableSheet,
  use: ExistingUse,
  ruleIdentity: string,
) {
  const identityOf = (id: string | null | undefined) =>
    sheet.catalogEntries.find((row) => row._id === id)?.ruleIdentity;
  return sheet.entries.some((entry) => {
    if (entry.kind !== use) return false;
    if (entry.kind === 'classLevel')
      return identityOf(entry.state.classEntryId) === ruleIdentity;
    return (
      !('grantKey' in entry && entry.grantKey) &&
      identityOf(entry.catalogEntryId) === ruleIdentity
    );
  });
}

/**
 * The campaign's preferred copy of a definition, refusing retired content
 * unless `existingUse` names a use this Character already has (#411).
 */
async function resolvePreferredCatalogEntryId(
  ctx: MutationCtx,
  sheet: WritableSheet,
  catalogEntryId: Id<'catalogEntry'>,
  existingUse: ExistingUse | null,
) {
  const preferred = await findPreferredCampaignCopy(ctx, {
    campaignId: sheet.character.campaignId,
    originalId: catalogEntryId,
    candidates: sheet.catalogEntries,
  });
  const id = preferred?._id ?? catalogEntryId;
  const definition = sheet.catalogEntries.find((row) => row._id === id);
  if (
    definition &&
    !(
      existingUse && hasExistingUse(sheet, existingUse, definition.ruleIdentity)
    ) &&
    !(await isSelectedCatalogDefinitionSelectable(ctx, definition))
  )
    throw new ConvexError(
      'Catalog Entry is retired; keep existing selections or choose another entry',
    );
  return id;
}
async function patchClassLevelStates(
  ctx: MutationCtx,
  sheet: WritableSheet,
  nextState: (
    row: ReturnType<typeof getClassLevel>,
  ) => ReturnType<typeof getClassLevel>['state'],
) {
  let changed = false;
  for (const row of sheet.entries) {
    if (row.kind !== 'classLevel') continue;
    const state = nextState(row);
    if (compareValues(state, row.state) === 0) continue;
    await ctx.db.patch('characterSheetEntry', row._id, { state });
    row.state = state;
    changed = true;
  }
  return changed;
}
async function renumberClassLevels(
  ctx: MutationCtx,
  levels: ReturnType<typeof getClassLevel>[],
) {
  const reordered = levels.map((row, index) => ({
    ...row,
    state: { ...row.state, position: index + 1 },
  }));
  for (const [index, row] of reordered.entries())
    if (levels[index]?.state.position !== row.state.position)
      await ctx.db.patch('characterSheetEntry', row._id, { state: row.state });
  return reordered;
}
function requireFiniteNumber(value: number) {
  if (!Number.isFinite(value)) throw new ConvexError('Enter a finite number');
}
function requireNonnegativeInteger(value: number, label: string) {
  requireFiniteNumber(value);
  if (!Number.isInteger(value) || value < 0)
    throw new ConvexError(`${label} must be a whole number of 0 or more`);
}
function requireSafeWholeNumber(value: number, label: string) {
  requireNonnegativeInteger(value, label);
  if (!Number.isSafeInteger(value))
    throw new ConvexError(`${label} must be a safe whole number`);
}
function modifierReferences(modifiers: readonly CatalogModifier[]) {
  return modifiers.flatMap((modifier) => {
    const situation = modifier.condition?.situation;
    return [
      modifier.condition?.whileActive,
      typeof situation === 'object' && 'option' in situation
        ? situation.option
        : undefined,
    ].filter((reference): reference is string => reference !== undefined);
  });
}
export function validatePersonalAdjustment({
  sheet,
  name,
  modifiers,
  previousModifiers = [],
  situationalNotes = [],
  previousSituationalNotes = [],
  conditionSchema = personalAdjustmentConditionSchema,
}: {
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>;
  name: string;
  modifiers: readonly CatalogModifier[];
  previousModifiers?: readonly CatalogModifier[];
  situationalNotes?: readonly SituationalNote[];
  previousSituationalNotes?: readonly SituationalNote[];
  conditionSchema?:
    | typeof modifierConditionSchema
    | typeof personalAdjustmentConditionSchema;
}) {
  if (!name.trim()) throw new ConvexError('Adjustment name cannot be empty');
  if (modifiers.length > 256)
    throw new ConvexError('An adjustment supports at most 256 Modifiers');
  for (const modifier of modifiers) {
    if (
      modifier.condition &&
      !conditionSchema.safeParse(modifier.condition).success
    )
      throw new ConvexError('Modifier condition is invalid');
    if (typeof modifier.value === 'number') {
      requireFiniteNumber(modifier.value);
      if (
        modifier.target.startsWith('ability.') &&
        !Number.isSafeInteger(modifier.value)
      )
        throw new ConvexError('Ability Modifiers must be whole numbers');
    } else if (modifier.value.formula.length > 4096)
      throw new ConvexError('Formula is too long');
    if (modifier.bonusType === 'base')
      throw new ConvexError('Base scores cannot be personal adjustments');
  }
  if (situationalNotes.length > 256)
    throw new ConvexError('An entry supports at most 256 Situational Notes');
  for (const note of situationalNotes)
    if (
      !situationalNoteSchema.safeParse(note).success ||
      (note.condition && !conditionSchema.safeParse(note.condition).success)
    )
      throw new ConvexError('Situational Note is invalid');
  const noteReferences = (notes: readonly SituationalNote[]) =>
    listCatalogReferences(notes).map((reference) => reference.id);
  const previousReferences = new Set([
    ...modifierReferences(previousModifiers),
    ...noteReferences(previousSituationalNotes),
  ]);
  for (const reference of [
    ...modifierReferences(modifiers),
    ...noteReferences(situationalNotes),
  ]) {
    if (
      !previousReferences.has(reference) &&
      !sheet.catalogEntries.some((entry) => entry._id === reference)
    )
      throw new ConvexError(
        'Modifier reference does not belong to this Character',
      );
  }
}
export const createPersonalAdjustment = campaignMutation({
  args: {
    ...writeScope,
    ...personalAdjustmentFields,
    gainedAtClassLevel: v.optional(v.id('characterSheetEntry')),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (args.gainedAtClassLevel !== undefined)
      getClassLevel(sheet, args.gainedAtClassLevel);
    validatePersonalAdjustment({
      sheet,
      name: args.name,
      modifiers: args.modifiers,
    });
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: args.characterId,
      name: args.name.trim(),
      ruleIdentity: `manual:${args.characterId}`,
      stacksWithItself: false,
      modifiers: args.modifiers,
      detail: { kind: 'manual' },
      sources: [],
    });
    await ctx.db.patch('catalogEntry', catalogEntryId, {
      ruleIdentity: `manual:${catalogEntryId}`,
    });
    const entryId = await ctx.db.insert('characterSheetEntry', {
      characterId: args.characterId,
      kind: 'manual',
      ...(args.gainedAtClassLevel !== undefined
        ? { gainedAtClassLevel: args.gainedAtClassLevel }
        : {}),
      active: true,
      catalogEntryId,
      state: { kind: 'manual' },
    });
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    const catalogEntry = await ctx.db.get('catalogEntry', catalogEntryId);
    if (!entry || !catalogEntry)
      throw new ConvexError('Personal adjustment is unavailable');
    sheet.entries.push(entry);
    sheet.catalogEntries.push(catalogEntry);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});
function getPersonalAdjustment(
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'manual' || entry.grantKey)
    throw new ConvexError(
      'Personal adjustment does not belong to this Character',
    );
  return entry;
}
export const editPersonalAdjustment = campaignMutation({
  args: {
    ...rowScope,
    ...v.object(personalAdjustmentFields).partial().fields,
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getPersonalAdjustment(sheet, args.entryId);
    const catalogEntry = sheet.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    if (!catalogEntry || !isManualCatalogEntry(catalogEntry))
      throw new ConvexError('Personal adjustment is unavailable');
    requireEditableCharacterDefinition(
      catalogEntry,
      args.characterId,
      args.name !== undefined || args.modifiers !== undefined,
    );
    const name = args.name?.trim() ?? catalogEntry.name;
    const modifiers = args.modifiers ?? catalogEntry.modifiers;
    validatePersonalAdjustment({
      sheet,
      name,
      modifiers,
      previousModifiers: catalogEntry.modifiers,
    });
    if (
      catalogEntry.name === name &&
      compareValues(catalogEntry.modifiers, modifiers) === 0 &&
      (args.active === undefined || args.active === entry.active)
    )
      return null;
    const catalogPatch = {
      ...(args.name !== undefined ? { name } : {}),
      ...(args.modifiers !== undefined ? { modifiers } : {}),
    };
    if (args.name !== undefined || args.modifiers !== undefined)
      await ctx.db.patch('catalogEntry', entry.catalogEntryId, catalogPatch);
    if (args.active !== undefined)
      await ctx.db.patch('characterSheetEntry', entry._id, {
        active: args.active,
      });
    sheet.catalogEntries = sheet.catalogEntries.map((row) =>
      row._id === catalogEntry._id && isManualCatalogEntry(row)
        ? { ...row, name, modifiers }
        : row,
    );
    sheet.entries = sheet.entries.map((row) =>
      row.kind === 'manual' &&
      row._id === entry._id &&
      args.active !== undefined
        ? { ...row, active: args.active }
        : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
function isCatalogDefinitionReferenced(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  catalogEntryId: Id<'catalogEntry'>,
  {
    removedEntryId,
    includeConditionReferences = false,
  }: {
    removedEntryId?: Id<'characterSheetEntry'>;
    includeConditionReferences?: boolean;
  } = {},
) {
  if (
    Object.values(sheet.character.carriedCatalogReferences ?? {}).includes(
      catalogEntryId,
    )
  )
    return true;
  if (
    sheet.entries.some(
      (entry) =>
        entry._id !== removedEntryId &&
        sheetEntryReferencesCatalog(entry, catalogEntryId),
    )
  )
    return true;
  return sheet.catalogEntries.some(
    (definition) =>
      definition._id !== catalogEntryId &&
      listCatalogDependencies(definition).some(
        ({ id, kind }) =>
          (includeConditionReferences || kind !== 'condition') &&
          id === catalogEntryId,
      ),
  );
}
/**
 * Manual and sheet entries own their private definitions, including a CRB
 * Condition stored under its canonical identity. Other Selections own only the
 * copies and one-offs created for them. Seeded rows and statistics copies have
 * separate lifecycles, even though they are local.
 */
function ownsCatalogDefinition(
  entry: Doc<'characterSheetEntry'>,
  definition: Doc<'catalogEntry'>,
) {
  if (definition.racialStatisticsCopy || isSeededCatalogEntry(definition))
    return false;
  return (
    entry.kind === 'manual' ||
    isCatalogSheetEntry(entry) ||
    definition.copiedFrom !== undefined ||
    definition.ruleIdentity === `one-off:${definition._id}` ||
    definition.ruleIdentity === `manual:${definition._id}` ||
    definition.ruleIdentity === `sheetEntry:${definition._id}`
  );
}
async function removeCatalogSelection(
  ctx: MutationCtx,
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entry: Doc<'characterSheetEntry'> & { catalogEntryId: Id<'catalogEntry'> },
  { preserveEntry = false }: { preserveEntry?: boolean } = {},
) {
  if (!preserveEntry) await ctx.db.delete('characterSheetEntry', entry._id);
  const definition = sheet.catalogEntries.find(
    (row) => row._id === entry.catalogEntryId,
  );
  const isDefinitionDeleted =
    definition?.scope === 'character' &&
    definition.characterId === sheet.character._id &&
    !definition.importedSpell &&
    ownsCatalogDefinition(entry, definition) &&
    !isCatalogDefinitionReferenced(sheet, entry.catalogEntryId, {
      removedEntryId: entry._id,
    });
  if (isDefinitionDeleted) {
    await deleteSpellCatalogIndex(ctx, entry.catalogEntryId);
    await ctx.db.delete('catalogEntry', entry.catalogEntryId);
    sheet.catalogEntries = sheet.catalogEntries.filter(
      (row) => row._id !== entry.catalogEntryId,
    );
  }
  if (!preserveEntry)
    sheet.entries = sheet.entries.filter((row) => row._id !== entry._id);
  // Another definition of a deleted Spell takes over its browser rows.
  if (isDefinitionDeleted && definition.detail.kind === 'spell')
    await reconcileSpellIdentity({
      ctx,
      sheet,
      ruleIdentity: definition.ruleIdentity,
      removed: definition,
    });
  else
    await reconcileSpellDefinition({
      ctx,
      sheet,
      catalogEntryId: entry.catalogEntryId,
    });
}
export const removePersonalAdjustment = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getPersonalAdjustment(sheet, args.entryId);
    await removeCatalogSelection(ctx, sheet, entry);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const editBaseScores = campaignMutation({
  args: {
    ...writeScope,
    scores: v.object({
      strength: v.optional(v.number()),
      dexterity: v.optional(v.number()),
      constitution: v.optional(v.number()),
      intelligence: v.optional(v.number()),
      wisdom: v.optional(v.number()),
      charisma: v.optional(v.number()),
    }),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const catalogEntry = sheet.baseScoresEntry;
    const values = new Map<BaseModifier['target'], number>();
    for (const ability of abilityKeys) {
      const value = args.scores[ability];
      if (value !== undefined) {
        requireAbilityScore(value);
        values.set(abilityTargets[ability], value);
      }
    }
    const modifiers = catalogEntry.modifiers.map((modifier) => ({
      ...modifier,
      value: values.get(modifier.target) ?? modifier.value,
    }));
    for (const [target, value] of values)
      if (!modifiers.some((modifier) => modifier.target === target))
        modifiers.push({ target, bonusType: 'base', value });
    const hasChanges =
      modifiers.length !== catalogEntry.modifiers.length ||
      modifiers.some(
        (modifier, index) =>
          modifier.value !== catalogEntry.modifiers[index]?.value,
      );
    const recordsPendingScores =
      sheet.character.familiarBaseScoresPending && values.size > 0;
    if (!hasChanges && !recordsPendingScores) return null;
    if (recordsPendingScores) {
      await ctx.db.patch('character', args.characterId, {
        familiarBaseScoresPending: undefined,
      });
      sheet.character = {
        ...sheet.character,
        familiarBaseScoresPending: undefined,
      };
    }
    await ctx.db.patch('catalogEntry', catalogEntry._id, { modifiers });
    sheet.catalogEntries = sheet.catalogEntries.map((entry) =>
      entry._id === catalogEntry._id ? { ...catalogEntry, modifiers } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const addClassLevel = campaignMutation({
  args: {
    ...writeScope,
    position: v.optional(v.number()),
    classEntryId: v.optional(v.union(v.id('catalogEntry'), v.null())),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const levels = sheet.entries.filter((entry) => entry.kind === 'classLevel');
    const position = args.position ?? levels.length + 1;
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > levels.length + 1
    )
      throw new ConvexError('Choose a valid Class Level position');
    const selected = args.classEntryId
      ? requireClassDefinition(
          sheet,
          await resolvePreferredCatalogEntryId(
            ctx,
            sheet,
            args.classEntryId,
            'classLevel',
          ),
        )
      : null;
    const chosen = selected ? continuedClassDefinition(sheet, selected) : null;
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const entryId = await ctx.db.insert('characterSheetEntry', {
      characterId: args.characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: chosen ?? selected?._id ?? null,
        position,
        hpGained: null,
      },
    });
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    if (!entry) throw new ConvexError('Class Level is unavailable');
    if (entry.kind !== 'classLevel')
      throw new ConvexError('Class Level is unavailable');
    levels.splice(position - 1, 0, entry);
    sheet.entries = [
      ...sheet.entries.filter((item) => item.kind !== 'classLevel'),
      ...(await renumberClassLevels(ctx, levels)),
    ];
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entry._id;
  },
});
export const editClassLevel = campaignMutation({
  args: {
    ...rowScope,
    hpGained: v.optional(v.union(v.number(), v.null())),
    classEntryId: v.optional(v.union(v.id('catalogEntry'), v.null())),
    favoredClassBonus: v.optional(favoredClassBonusValidator),
    abilityIncrease: v.optional(
      v.union(v.null(), ...abilityKeys.map((ability) => v.literal(ability))),
    ),
    skillRanks: v.optional(v.record(v.string(), v.number())),
    skillRank: v.optional(v.object({ skill: v.string(), ranks: v.number() })),
    proficiencyChoice: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getClassLevel(sheet, args.entryId);
    if (args.hpGained !== undefined && args.hpGained !== null)
      requireFiniteNumber(args.hpGained);
    if (
      args.favoredClassBonus?.choice === 'alt' &&
      !args.favoredClassBonus.note.trim()
    )
      throw new ConvexError('Describe the other favored-class bonus');
    if (args.skillRanks !== undefined && args.skillRank !== undefined)
      throw new ConvexError('Save one skill or the full allocation, not both');
    const allocation = args.skillRank
      ? { [args.skillRank.skill]: args.skillRank.ranks }
      : args.skillRanks;
    const normalizedAllocation = allocation && sumRanksBySkill(allocation);
    for (const [skill, ranks] of Object.entries(allocation ?? {})) {
      if (!canonicalSkillKey(skill))
        throw new ConvexError('Choose an available skill');
      requireSafeWholeNumber(ranks, 'Skill ranks');
    }
    const skillRanks = args.skillRank
      ? {
          ...sumRanksBySkill(entry.state.skillRanks ?? {}),
          ...normalizedAllocation,
        }
      : normalizedAllocation;
    for (const ranks of Object.values(skillRanks ?? {}))
      requireSafeWholeNumber(ranks, 'Skill ranks');
    const selected = args.classEntryId
      ? requireClassDefinition(
          sheet,
          await resolvePreferredCatalogEntryId(
            ctx,
            sheet,
            args.classEntryId,
            'classLevel',
          ),
        )
      : null;
    // #583: the row picker never switches a class. Another copy of this
    // level's own class keeps the class's definition, and a class other
    // levels already have continues theirs, whatever the picker preferred;
    // only `switchClassVersion` changes the definition of a whole class.
    const rowClass = sheet.catalogEntries.find(
      (definition) => definition._id === entry.state.classEntryId,
    );
    const classEntryId = !selected
      ? null
      : rowClass?.detail.kind === 'class' &&
          rowClass.ruleIdentity === selected.ruleIdentity
        ? rowClass._id
        : (continuedClassDefinition(sheet, selected, entry._id) ??
          selected._id);
    const proficiencyChoice = args.proficiencyChoice?.trim() ?? '';
    const changes = {
      ...(args.hpGained !== undefined ? { hpGained: args.hpGained } : {}),
      ...(args.classEntryId !== undefined ? { classEntryId } : {}),
      ...(args.favoredClassBonus !== undefined
        ? { favoredClassBonus: args.favoredClassBonus }
        : {}),
      ...(args.abilityIncrease !== undefined
        ? { abilityIncrease: args.abilityIncrease }
        : {}),
      ...(skillRanks !== undefined ? { skillRanks } : {}),
      ...(args.proficiencyChoice !== undefined
        ? {
            proficiencyChoice:
              proficiencyChoice === '' ? null : proficiencyChoice,
          }
        : {}),
    };
    const changed = await patchClassLevelStates(ctx, sheet, (row) =>
      row._id === entry._id ? { ...row.state, ...changes } : row.state,
    );
    if (!changed) return null;
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
/** Records the class one "+1 level of existing class" advance goes to. */
export const assignCastingAdvance = campaignMutation({
  args: {
    ...rowScope,
    index: v.number(),
    classEntryId: v.union(v.id('catalogEntry'), v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getClassLevel(sheet, args.entryId);
    const advances = sheet.calculated.castingAdvances.filter(
      (advance) => advance.entryId === entry._id,
    );
    if (!advances.some((advance) => advance.index === args.index))
      throw new ConvexError('Choose a casting advance of this Class Level');
    const target = args.classEntryId
      ? requireClassDefinition(
          sheet,
          await resolvePreferredCatalogEntryId(
            ctx,
            sheet,
            args.classEntryId,
            'classLevel',
          ),
        )._id
      : null;
    // Pre-filled siblings are recorded with the first explicit choice; an
    // untouched sibling without a pre-fill stays unrecorded (null).
    const castingAdvances = advances
      .sort((left, right) => left.index - right.index)
      .map((advance) => {
        if (advance.index === args.index) return { classEntryId: target };
        const recorded = entry.state.castingAdvances?.[advance.index];
        if (recorded) return recorded;
        const prefilled =
          advance.prefilled && advance.targetClassEntryId
            ? ctx.db.normalizeId('catalogEntry', advance.targetClassEntryId)
            : null;
        return prefilled ? { classEntryId: prefilled } : null;
      });
    const recorded = [
      ...castingAdvances,
      ...(entry.state.castingAdvances?.slice(castingAdvances.length) ?? []),
    ];
    while (recorded.length > 0 && recorded.at(-1) === null) recorded.pop();
    const changed = await patchClassLevelStates(ctx, sheet, (row) =>
      row._id === entry._id
        ? { ...row.state, castingAdvances: recorded }
        : row.state,
    );
    if (!changed) return null;
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
/** The class's flurry of blows feature, if its schedule has one. */
async function findClassFlurry(
  ctx: MutationCtx,
  sheet: WritableSheet,
  target: Doc<'catalogEntry'>,
) {
  if (target.detail.kind !== 'class' || !('featuresByLevel' in target.detail))
    return null;
  for (const feature of target.detail.featuresByLevel) {
    const definition =
      sheet.catalogEntries.find((row) => row._id === feature.catalogEntryId) ??
      (await ctx.db.get('catalogEntry', feature.catalogEntryId));
    if (
      definition?.detail.kind === 'classFeature' &&
      isFlurryIdentity(definition.ruleIdentity)
    )
      return definition;
  }
  return null;
}

/**
 * Owner (#414): a class-version switch rewrites each routine's recorded
 * flurry Routine Option to the target version's flurry of blows, so a
 * routine keeps flurrying with the class it now has. Other options stay as
 * recorded. Patches the routines and the loaded sheet's entries.
 */
async function remapFlurryOptionsToTarget(
  ctx: MutationCtx,
  sheet: WritableSheet,
  target: Doc<'catalogEntry'>,
) {
  const targetFlurry = await findClassFlurry(ctx, sheet, target);
  if (!targetFlurry) return;
  const isFlurryOption = (id: string) => {
    const definition = sheet.catalogEntries.find((row) => row._id === id);
    return (
      definition?.detail.kind === 'classFeature' &&
      isFlurryIdentity(definition.ruleIdentity)
    );
  };
  for (const entry of sheet.entries) {
    if (entry.kind !== 'attackRoutine' || !entry.state.options?.length)
      continue;
    const options = [
      ...new Set(
        entry.state.options.map((id) =>
          isFlurryOption(id) ? targetFlurry._id : id,
        ),
      ),
    ];
    if (compareValues(options, entry.state.options) === 0) continue;
    const state = {
      ...entry.state,
      options,
      revision: (entry.state.revision ?? 0) + 1,
    };
    await ctx.db.patch('characterSheetEntry', entry._id, { state });
    entry.state = state;
  }
}
const classSwitchRefusals: Record<
  Extract<ClassSwitchPlan, { kind: 'refused' }>['reason'],
  string
> = {
  notClassLevel: 'Class Level does not belong to this Character',
  noClass: 'Choose a class before switching its version',
  notClass: 'Class does not belong to this Character',
  unrelated:
    'Choose another copy, or the original or Unchained version, of this class',
};

/**
 * #583: one explicit switch of the definition every level of the class uses.
 * Links to the
 * class's earlier copies of the chosen rule identity follow it, with their
 * Spell browser rows; an original/Unchained version moves only the levels
 * (#406). Rows and their own state are kept; Grants and dormancy are
 * recalculated.
 */
async function switchClassDefinition(
  ctx: MutationCtx,
  sheet: WritableSheet,
  {
    entryId,
    classEntryId,
  }: {
    entryId: Id<'characterSheetEntry'>;
    classEntryId: Id<'catalogEntry'>;
  },
) {
  const plan = planClassSwitch({
    entries: sheet.entries,
    catalogEntries: sheet.catalogEntries,
    entryId,
    classEntryId,
  });
  if (plan.kind === 'refused')
    throw new ConvexError(classSwitchRefusals[plan.reason]);
  if (plan.kind === 'unchanged') return false;
  const target = requireClassDefinition(sheet, classEntryId);
  if (
    !hasExistingUse(sheet, 'classLevel', target.ruleIdentity) &&
    !(await isSelectedCatalogDefinitionSelectable(ctx, target))
  )
    throw new ConvexError(
      'Catalog Entry is retired; keep existing selections or choose another entry',
    );
  const entries = applyClassSwitch(sheet.entries, plan);
  for (const [index, row] of entries.entries()) {
    if (compareValues(row, sheet.entries[index] ?? null) === 0) continue;
    const { _id, _creationTime, ...body } = row;
    await ctx.db.replace('characterSheetEntry', _id, body);
  }
  sheet.entries = entries;
  if (plan.copyIds.length > 0) {
    for (const originalId of plan.copyIds) {
      const id = ctx.db.normalizeId('catalogEntry', originalId);
      if (id)
        await reconcileCopiedSpellcasting({
          ctx,
          sheet,
          originalId: id,
          copyId: target._id,
        });
    }
    await reconcileSpellcastingDefinition({
      ctx,
      sheet,
      catalogEntryId: target._id,
    });
  }
  await remapFlurryOptionsToTarget(ctx, sheet, target);
  return true;
}

/** The definition a class's existing levels use, which a new level continues. */
function continuedClassDefinition(
  sheet: WritableSheet,
  selected: Doc<'catalogEntry'>,
  exceptEntryId?: Id<'characterSheetEntry'>,
) {
  return (
    sheet.entries
      .flatMap((row) =>
        row.kind === 'classLevel' && row._id !== exceptEntryId ? [row] : [],
      )
      .sort((left, right) => left.state.position - right.state.position)
      .find(
        (row) =>
          row.state.classEntryId &&
          sheet.catalogEntries.find(
            (definition) => definition._id === row.state.classEntryId,
          )?.ruleIdentity === selected.ruleIdentity,
      )?.state.classEntryId ?? null
  );
}

/**
 * Switches the definition every level of a class uses. "Version" covers both
 * kinds of choice in the one "Rules used" control: another Catalog Copy of
 * the class (#583) and its original or Unchained version (#406). The switch
 * lands on exactly the chosen definition; campaign preferences never
 * redirect it.
 */
export const switchClassVersion = campaignMutation({
  args: { ...rowScope, classEntryId: v.id('catalogEntry') },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (!(await switchClassDefinition(ctx, sheet, args))) return null;
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const moveClassLevel = campaignMutation({
  args: { ...rowScope, position: v.number() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getClassLevel(sheet, args.entryId);
    const levels = sheet.entries
      .filter((item) => item.kind === 'classLevel')
      .filter((item) => item._id !== entry._id);
    if (
      !Number.isInteger(args.position) ||
      args.position < 1 ||
      args.position > levels.length + 1
    )
      throw new ConvexError('Choose a valid Class Level position');
    levels.splice(args.position - 1, 0, entry);
    sheet.entries = [
      ...sheet.entries.filter((entry) => entry.kind !== 'classLevel'),
      ...(await renumberClassLevels(ctx, levels)),
    ];
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const deleteClassLevel = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getClassLevel(sheet, args.entryId);
    await ctx.db.delete('characterSheetEntry', entry._id);
    const levels = sheet.entries
      .filter((item) => item.kind === 'classLevel')
      .filter((item) => item._id !== entry._id);
    sheet.entries = [
      ...sheet.entries.filter((entry) => entry.kind !== 'classLevel'),
      ...(await renumberClassLevels(ctx, levels)),
    ];
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const editCreationSettings = campaignMutation({
  args: {
    ...writeScope,
    settings: creationSettingsValidator.partial(),
    favoredClassIds: v.optional(v.array(v.id('catalogEntry'))),
    alignment: v.optional(v.union(alignmentValidator, v.null())),
    deity: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const base = sheet.entries.find((entry) => entry.kind === 'base');
    if (!base) throw new ConvexError('Base scores are unavailable');
    const previous = creationSettingsFor(base);
    const settings = { ...previous, ...args.settings };
    if (settings.abilityMethod.budget !== undefined)
      requireNonnegativeInteger(
        settings.abilityMethod.budget,
        'Point-buy budget',
      );
    requireNonnegativeInteger(settings.traitCount, 'Trait count');
    const favoredClassIds: Id<'catalogEntry'>[] = [];
    for (const classId of args.favoredClassIds ?? []) {
      if (!(await ctx.db.get('catalogEntry', classId))) continue;
      requireClassDefinition(sheet, classId);
      favoredClassIds.push(classId);
    }
    const deity = args.deity?.trim();
    const state = {
      ...base.state,
      ...settings,
      ...(args.alignment !== undefined
        ? { alignment: args.alignment ?? undefined }
        : {}),
      ...(args.deity !== undefined
        ? { deity: deity?.length ? deity : undefined }
        : {}),
      ...(args.favoredClassIds !== undefined ? { favoredClassIds } : {}),
    };
    if (compareValues(base.state, state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', base._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === base._id ? { ...base, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

const warningScope = { ...writeScope, check: v.string(), subject: v.string() };
export const acceptWarning = campaignMutation({
  args: { ...warningScope, fingerprint: v.string() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadProjectedWritableSheet(ctx, args);
    const warning = [
      ...sheet.calculated.warnings,
      ...sheet.permanentCalculated.warnings,
    ].find(
      (item) =>
        item.check === args.check &&
        item.subject === args.subject &&
        item.fingerprint === args.fingerprint,
    );
    if (warning?.kind !== 'rules')
      throw new ConvexError('Only a current rules warning can be accepted');
    const previous = sheet.acceptedWarnings.find(
      (item) => item.check === args.check && item.subject === args.subject,
    );
    if (previous?.fingerprint === warning.fingerprint) return null;
    if (previous) {
      await ctx.db.delete('acceptedWarning', previous._id);
      sheet.acceptedWarnings = sheet.acceptedWarnings.filter(
        (item) => item._id !== previous._id,
      );
    }
    if (sheet.acceptedWarnings.length >= maxAcceptedWarnings)
      throw new ConvexError('Character has too many accepted warnings');
    await ctx.db.insert('acceptedWarning', {
      characterId: args.characterId,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      acceptedBy: sheet.actor,
      acceptedAt: Date.now(),
    });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const reopenWarning = campaignMutation({
  args: warningScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.acceptedWarnings.find(
      (item) => item.check === args.check && item.subject === args.subject,
    );
    if (!previous) return null;
    await ctx.db.delete('acceptedWarning', previous._id);
    sheet.acceptedWarnings = sheet.acceptedWarnings.filter(
      (item) => item._id !== previous._id,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const archive = campaignMutation({
  args: { ...writeScope, isActive: v.boolean() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (!sheet.character.campaignId)
      throw new ConvexError('Only campaign Characters can be archived');
    await updateCharacterArchive(ctx, args);
    sheet.character = { ...sheet.character, isActive: args.isActive };
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const deletePrivate = campaignMutation({
  args: writeScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (sheet.character.campaignId)
      throw new ConvexError('Archive campaign Characters instead');
    await deleteCharacterSheet(ctx, args.characterId, args.operationId);
    return null;
  },
});

function getAbilityChange(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'abilityDamage' && entry?.kind !== 'abilityDrain')
    throw new ConvexError('Ability change does not belong to this Character');
  return entry;
}
export const createAbilityChange = campaignMutation({
  args: {
    ...writeScope,
    kind: abilityChangeKindValidator,
    ability: abilityValidator,
    points: v.number(),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    requireNonnegativeInteger(args.points, 'Ability change');
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const state = { ability: args.ability, points: args.points };
    const entryId = await ctx.db.insert(
      'characterSheetEntry',
      args.kind === 'abilityDamage'
        ? {
            characterId: args.characterId,
            kind: 'abilityDamage',
            active: true,
            state: { kind: 'abilityDamage', ...state },
          }
        : {
            characterId: args.characterId,
            kind: 'abilityDrain',
            active: true,
            state: { kind: 'abilityDrain', ...state },
          },
    );
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    if (!entry) throw new ConvexError('Ability change is unavailable');
    sheet.entries.push(entry);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});
export const editAbilityChange = campaignMutation({
  args: {
    ...rowScope,
    ability: v.optional(abilityValidator),
    points: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getAbilityChange(sheet, args.entryId);
    if (args.points !== undefined)
      requireNonnegativeInteger(args.points, 'Ability change');
    const changes = {
      ability: args.ability ?? entry.state.ability,
      points: args.points ?? entry.state.points,
    };
    const active = args.active ?? entry.active;
    // Keep each state discriminator correlated with its Convex patch variant.
    const patch =
      entry.kind === 'abilityDamage'
        ? { active, state: { ...entry.state, ...changes } }
        : { active, state: { ...entry.state, ...changes } };
    if (
      compareValues(patch.state, entry.state) === 0 &&
      active === entry.active
    )
      return null;
    await ctx.db.patch('characterSheetEntry', entry._id, patch);
    const updated = await ctx.db.get('characterSheetEntry', entry._id);
    if (!updated) throw new ConvexError('Ability change is unavailable');
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? updated : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const removeAbilityChange = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getAbilityChange(sheet, args.entryId);
    await ctx.db.delete('characterSheetEntry', entry._id);
    sheet.entries = sheet.entries.filter((row) => row._id !== entry._id);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

function getSheetEntry(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (!isCatalogSheetEntry(entry) || entry.grantKey)
    throw new ConvexError(
      'Character Sheet Entry does not belong to this Character',
    );
  const catalog = sheet.catalogEntries.find(
    (row) => row._id === entry.catalogEntryId,
  );
  if (!isCatalogSheetDefinition(catalog))
    throw new ConvexError('Catalog Entry definition is unavailable');
  return { entry, catalog };
}
const diceExpression = /^[1-9]\d*d[1-9]\d*$/;
const maxItemAbilities = 32;
const maxItemPartText = 64;
// A Spell's rule identity, as a Spell Effect names it.
const maxSpellKeyLength = 64;
/**
 * One item part's state as a writer takes it, for a sheet entry and a
 * definition's magic defaults alike: a safe whole enhancement, a material
 * and foe choices of at most 64 characters, and at most 32 Item Abilities.
 * A newly listed ability must be an accessible itemAbility definition; the
 * sheet loader authorizes every submitted reference. Retained ones stay for
 * repair. Duplicates and unsuitable abilities are recorded with advisory
 * warnings. Returns the abilities with each foe choice trimmed, an empty one
 * cleared.
 */
function requireItemPartState({
  state,
  catalogEntries,
  retained = [],
}: {
  state: {
    enhancement?: number;
    material?: string | null;
    abilities?: readonly Infer<typeof itemAbilityRefValidator>[];
  };
  catalogEntries: readonly Doc<'catalogEntry'>[];
  retained?: readonly { catalogEntryId: string }[];
}) {
  if (state.enhancement !== undefined)
    requireSafeWholeNumber(state.enhancement, 'Enhancement');
  if ((state.material?.trim().length ?? 0) > maxItemPartText)
    throw new ConvexError('Name the material in 64 characters or fewer');
  const abilities = state.abilities;
  if (!abilities) return undefined;
  if (abilities.length > maxItemAbilities)
    throw new ConvexError('Too many Item Abilities');
  return abilities.map(({ catalogEntryId, choice }) => {
    if (
      !retained.some((ability) => ability.catalogEntryId === catalogEntryId)
    ) {
      const definition = catalogEntries.find(
        (row) => row._id === catalogEntryId,
      );
      if (!definition)
        throw new ConvexError('Item Ability does not belong to this Character');
      if (definition.detail.kind !== 'itemAbility')
        throw new ConvexError('Choose an Item Ability');
    }
    const trimmed = choice?.trim();
    if (trimmed && trimmed.length > maxItemPartText)
      throw new ConvexError("An Item Ability's choice is too long");
    return {
      catalogEntryId,
      ...(choice !== undefined
        ? { choice: trimmed === '' || trimmed === undefined ? null : trimmed }
        : {}),
    };
  });
}
/**
 * A specific item's Base Item must be another item with weapon, armor or
 * ammunition statistics, and its magic defaults must name Item Abilities;
 * an Item Ability's dice and Situations must be well formed. The sheet
 * loader has already authorized every submitted reference.
 */
export function validateItemCatalogDetail({
  detail,
  catalogEntries,
  definitionId,
}: {
  detail: Doc<'catalogEntry'>['detail'];
  catalogEntries: readonly Doc<'catalogEntry'>[];
  /** The definition being edited, which can't be its own Base Item. */
  definitionId?: Id<'catalogEntry'>;
}) {
  if (detail.kind === 'itemAbility') {
    requireNonnegativeInteger(detail.bonusEquivalent, 'Bonus equivalent');
    if (detail.foeEnhancement !== undefined)
      requireNonnegativeInteger(detail.foeEnhancement, 'Foe enhancement');
    for (const dice of detail.damageDice ?? []) {
      if (!diceExpression.test(dice.dice.trim()))
        throw new ConvexError('Enter Item Ability dice such as 1d6');
      if (
        typeof dice.situation === 'string' &&
        (!dice.situation.trim() || dice.situation.length > 64)
      )
        throw new ConvexError('Name the Situation in 64 characters or fewer');
      if (
        typeof dice.situation === 'object' &&
        !modifierConditionSchema.shape.situation.safeParse(dice.situation)
          .success
      )
        throw new ConvexError('Item Ability dice name an invalid Situation');
    }
    return;
  }
  if (detail.kind !== 'item') return;
  if (detail.baseItem) {
    const base = catalogEntries.find((row) => row._id === detail.baseItem);
    if (
      detail.baseItem === definitionId ||
      base?.detail.kind !== 'item' ||
      !(base.detail.weapon || base.detail.armor || base.detail.ammunition)
    )
      throw new ConvexError(
        'Choose a Base Item with weapon or armor statistics',
      );
  }
  const magic = detail.magic;
  for (const state of [magic, magic?.otherEnd, magic?.bash])
    if (state) requireItemPartState({ state, catalogEntries });
}
export function validateSheetEntryDetail(
  detail: typeof sheetEntryDetailValidator.type,
  /** Null restores a Spell Effect's default caster level. */
  casterLevel?: number | null,
) {
  if (detail.kind === 'spell' && detail.levels) {
    for (const level of Object.values(detail.levels))
      requireNonnegativeInteger(level, 'Spell level');
  }
  if (detail.kind === 'item' && detail.weapon) {
    if (!detail.weapon.baseType.trim())
      throw new ConvexError('Weapon name is required');
    for (const value of [
      detail.weapon.threat,
      detail.weapon.mult,
      detail.weapon.rangeIncrement,
      detail.weapon.thrownRangeIncrement,
      detail.weapon.strengthRating,
      detail.weapon.otherEnd?.threat,
      detail.weapon.otherEnd?.mult,
    ])
      if (value !== undefined) requireFiniteNumber(value);
    for (const [index, dice] of [
      detail.weapon.dice,
      detail.weapon.otherEnd?.dice,
    ].entries())
      if (
        dice !== undefined &&
        !/^[1-9]\d*d[1-9]\d*$/.test(dice.trim()) &&
        !(
          index === 0 &&
          detail.weapon.naturalAttack &&
          /^[1-9]\d*$/.test(dice.trim())
        )
      )
        throw new ConvexError('Enter weapon damage dice such as 1d8');
  }
  if (detail.kind === 'item' && detail.armor) {
    requireFiniteNumber(detail.armor.armorCheckPenalty);
    if (detail.armor.armorCheckPenalty < 0)
      throw new ConvexError('Armor check penalty must be nonnegative');
    for (const value of [
      detail.armor.bonus,
      detail.armor.maxDex,
      detail.armor.asf,
    ])
      if (value !== undefined && value !== null) {
        requireFiniteNumber(value);
        if (value < 0)
          throw new ConvexError('Armor values must be nonnegative');
      }
  }
  if (detail.kind === 'spellEffect') {
    requireNonnegativeInteger(
      detail.defaultCasterLevel,
      'Default caster level',
    );
    if (casterLevel !== undefined && casterLevel !== null)
      requireNonnegativeInteger(casterLevel, 'Caster level');
    if (
      detail.spellKey !== undefined &&
      (!detail.spellKey.trim() || detail.spellKey.length > maxSpellKeyLength)
    )
      throw new ConvexError(
        `A Spell key must be 1 to ${maxSpellKeyLength} characters`,
      );
  } else if (casterLevel !== undefined)
    throw new ConvexError('Only a Spell Effect has a caster level');
}
function canonicalConditionFields({
  detail,
  name,
  modifiers,
  selectDefinition = false,
}: {
  detail: typeof sheetEntryDetailValidator.type;
  name?: string;
  modifiers?: readonly Modifier[];
  selectDefinition?: boolean;
}) {
  if (detail.kind !== 'condition' || detail.conditionKey === undefined)
    return null;
  const definition = getConditionDefinition(detail.conditionKey);
  if (name !== undefined && name.trim() !== definition.name)
    throw new ConvexError('A CRB condition must use its canonical name');
  if (
    modifiers !== undefined &&
    !(selectDefinition && modifiers.length === 0) &&
    compareValues([...modifiers], definition.modifiers) !== 0
  )
    throw new ConvexError('A CRB condition must use its canonical Modifiers');
  return {
    name: definition.name,
    modifiers: definition.modifiers,
    ruleIdentity: definition.ruleIdentity,
    sourceKey: definition.ruleIdentity,
    sources: definition.sources,
  };
}
function buildCatalogIdentityPatch({
  canonical,
  catalog,
}: {
  canonical: ReturnType<typeof canonicalConditionFields>;
  catalog: ReturnType<typeof getSheetEntry>['catalog'];
}) {
  if (catalog.copiedFrom) return {};
  if (canonical)
    return {
      ruleIdentity: canonical.ruleIdentity,
      sourceKey: canonical.sourceKey,
      sources: canonical.sources,
    };
  if (
    catalog.detail.kind === 'condition' &&
    catalog.detail.conditionKey !== undefined
  )
    return {
      ruleIdentity: `sheetEntry:${catalog._id}`,
      sourceKey: undefined,
      sources: [],
    };
  return {};
}
/**
 * A Spell Effect's target: an item on this sheet, its other end or bash, or
 * the unarmed strike. Whether the effect suits it is advisory.
 */
function requireSpellEffectTarget(
  sheet: WritableSheet,
  onItem: Infer<typeof spellEffectTargetValidator>,
): Infer<typeof spellEffectTargetValidator> {
  if (isUnarmedStrike(onItem.entry)) {
    if (onItem.end)
      throw new ConvexError('The unarmed strike has no other end or bash');
    return { entry: UNARMED_STRIKE_ID };
  }
  const item = sheet.entries.find((row) => row._id === onItem.entry);
  if (item?.kind !== 'item')
    throw new ConvexError('Choose an item on this sheet');
  if (!onItem.end) return { entry: item._id };
  const stored = sheet.catalogEntries.find(
    (row) => row._id === item.catalogEntryId,
  );
  const detail = stored
    ? resolveItemDefinition(stored, sheet.catalogEntries).detail
    : undefined;
  if (
    onItem.end === 'otherEnd' &&
    !(detail?.kind === 'item' && detail.weapon?.otherEnd)
  )
    throw new ConvexError('Choose a double weapon with an available other end');
  if (
    onItem.end === 'bash' &&
    !(
      detail?.kind === 'item' &&
      detail.armor?.slot === 'shield' &&
      detail.weapon
    )
  )
    throw new ConvexError('Choose a shield that can bash');
  return { entry: item._id, end: onItem.end };
}
export const createSheetEntry = campaignMutation({
  args: {
    ...writeScope,
    ...personalAdjustmentFields,
    detail: sheetEntryDetailValidator,
    casterLevel: v.optional(v.number()),
    situationalNotes: v.optional(v.array(situationalNoteValidator)),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const canonical = canonicalConditionFields({
      ...args,
      selectDefinition: true,
    });
    const name = canonical?.name ?? args.name.trim();
    const modifiers = canonical?.modifiers ?? args.modifiers;
    validatePersonalAdjustment({
      sheet,
      name,
      modifiers,
      conditionSchema: modifierConditionSchema,
      situationalNotes: args.situationalNotes,
    });
    validateSheetEntryDetail(args.detail, args.casterLevel);
    validateItemCatalogDetail({
      detail: args.detail,
      catalogEntries: sheet.catalogEntries,
    });
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: args.characterId,
      name,
      ruleIdentity: canonical?.ruleIdentity ?? `sheetEntry:${args.characterId}`,
      ...(canonical ? { sourceKey: canonical.sourceKey } : {}),
      stacksWithItself: false,
      modifiers,
      ...(args.situationalNotes
        ? { situationalNotes: args.situationalNotes }
        : {}),
      detail: args.detail,
      sources: canonical?.sources ?? [],
    });
    if (!canonical)
      await ctx.db.patch('catalogEntry', catalogEntryId, {
        ruleIdentity: `sheetEntry:${catalogEntryId}`,
      });
    const common = {
      characterId: args.characterId,
      active: true,
      catalogEntryId,
    };
    const detail = args.detail;
    const entryId = await ctx.db.insert(
      'characterSheetEntry',
      detail.kind === 'spellEffect'
        ? {
            ...common,
            kind: 'spellEffect',
            state: {
              kind: 'spellEffect',
              casterLevel:
                args.casterLevel ??
                (await readNewSpellEffectCasterLevel(ctx, args, sheet, detail)),
            },
          }
        : detail.kind === 'condition'
          ? { ...common, kind: 'condition', state: { kind: 'condition' } }
          : detail.kind === 'item'
            ? { ...common, kind: 'item', state: createItemState(detail.magic) }
            : { ...common, kind: 'spell', state: { kind: 'spell' } },
    );
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    const catalog = await ctx.db.get('catalogEntry', catalogEntryId);
    if (!entry || !catalog)
      throw new ConvexError('Character Sheet Entry is unavailable');
    sheet.entries.push(entry);
    sheet.catalogEntries.push(catalog);
    await reconcileSpellDefinition({ ctx, sheet, catalogEntryId: catalog._id });
    const resolvedItem = resolveItemDefinition(
      catalog,
      sheet.catalogEntries,
    ).detail;
    if (
      resolvedItem?.kind === 'item' &&
      resolvedItem.weapon &&
      !resolvedItem.weapon.naturalAttack &&
      !resolvedItem.armor
    )
      await insertAttackRoutine(ctx, sheet, {
        weaponEntryId: entryId,
        name,
        ...defaultAttackRoutineConfiguration(resolvedItem.weapon),
      });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});
export const editSheetEntry = campaignMutation({
  args: {
    ...rowScope,
    name: v.optional(v.string()),
    modifiers: v.optional(v.array(modifierValidator.omit('stacksWithinEntry'))),
    detail: v.optional(sheetEntryDetailValidator),
    // Null restores the default caster level.
    casterLevel: v.optional(v.union(v.number(), v.null())),
    // A Spell Effect's target; null clears it.
    onItem: v.optional(v.union(spellEffectTargetValidator, v.null())),
    active: v.optional(v.boolean()),
    situationalNotes: v.optional(v.array(situationalNoteValidator)),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const { entry, catalog } = getSheetEntry(sheet, args.entryId);
    requireEditableCharacterDefinition(
      catalog,
      args.characterId,
      args.name !== undefined ||
        args.modifiers !== undefined ||
        args.detail !== undefined ||
        args.situationalNotes !== undefined,
    );
    const detail = args.detail ?? catalog.detail;
    if (detail.kind !== entry.kind)
      throw new ConvexError('A Character Sheet Entry kind cannot be changed');
    const canonical = canonicalConditionFields({ ...args, detail });
    const name = canonical?.name ?? args.name?.trim() ?? catalog.name;
    const modifiers =
      canonical?.modifiers ??
      (args.modifiers
        ? preserveCuratedModifierFields(args.modifiers, catalog.modifiers)
        : catalog.modifiers);
    validatePersonalAdjustment({
      sheet,
      name,
      modifiers,
      previousModifiers: catalog.modifiers,
      conditionSchema: modifierConditionSchema,
      situationalNotes: args.situationalNotes ?? catalog.situationalNotes,
      previousSituationalNotes: catalog.situationalNotes,
    });
    validateSheetEntryDetail(detail, args.casterLevel);
    if (args.detail)
      validateItemCatalogDetail({
        detail: args.detail,
        catalogEntries: sheet.catalogEntries,
        definitionId: catalog._id,
      });
    if (args.onItem !== undefined && entry.kind !== 'spellEffect')
      throw new ConvexError('Only a Spell Effect has a target');
    const active = args.active ?? entry.active;
    // Construct each state with its patch so Convex retains the discriminator.
    const patch =
      entry.kind === 'spellEffect'
        ? {
            active,
            state: editSpellEffectState(entry.state, {
              casterLevel:
                args.casterLevel === null && detail.kind === 'spellEffect'
                  ? defaultSpellEffectCasterLevel(sheet, detail)
                  : (args.casterLevel ?? undefined),
              onItem:
                args.onItem === undefined || args.onItem === null
                  ? args.onItem
                  : requireSpellEffectTarget(sheet, args.onItem),
            }),
          }
        : entry.kind === 'condition'
          ? { active, state: entry.state }
          : entry.kind === 'item'
            ? { active, state: entry.state }
            : { active, state: entry.state };
    if (
      name === catalog.name &&
      compareValues(modifiers, catalog.modifiers) === 0 &&
      compareValues(detail, catalog.detail) === 0 &&
      compareValues(
        args.situationalNotes ?? catalog.situationalNotes,
        catalog.situationalNotes,
      ) === 0 &&
      active === entry.active &&
      compareValues(patch.state, entry.state) === 0
    )
      return null;
    if (
      args.name !== undefined ||
      args.modifiers !== undefined ||
      args.detail !== undefined ||
      args.situationalNotes !== undefined
    )
      await ctx.db.patch('catalogEntry', catalog._id, {
        name,
        modifiers,
        detail,
        ...(args.situationalNotes !== undefined
          ? { situationalNotes: args.situationalNotes }
          : {}),
        ...buildCatalogIdentityPatch({ canonical, catalog }),
      });
    await ctx.db.patch('characterSheetEntry', entry._id, patch);
    const updated = await ctx.db.get('characterSheetEntry', entry._id);
    const updatedCatalog = await ctx.db.get('catalogEntry', catalog._id);
    if (!updated || !updatedCatalog)
      throw new ConvexError('Character Sheet Entry is unavailable');
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? updated : row,
    );
    sheet.catalogEntries = sheet.catalogEntries.map((row) =>
      row._id === catalog._id ? updatedCatalog : row,
    );
    await reconcileSpellDefinition({
      ctx,
      sheet,
      catalogEntryId: updatedCatalog._id,
    });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
type SpellEffectState = Extract<
  Doc<'characterSheetEntry'>,
  { kind: 'spellEffect' }
>['state'];
function editSpellEffectState(
  state: SpellEffectState,
  {
    casterLevel = state.casterLevel,
    onItem,
  }: {
    casterLevel?: number;
    onItem?: SpellEffectState['onItem'] | null;
  },
): SpellEffectState {
  const { onItem: previous, ...rest } = state;
  const target = onItem === undefined ? previous : onItem;
  return { ...rest, casterLevel, ...(target ? { onItem: target } : {}) };
}
export const removeSheetEntry = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const { entry } = getSheetEntry(sheet, args.entryId);
    await removeCatalogSelection(ctx, sheet, entry);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

const dormantTargetValidator = v.union(
  v.object({ grantKey: grantKeyValidator }),
  v.object({ entryId: v.id('characterSheetEntry') }),
);
const grantStateValidator = v.object({
  active: v.optional(v.boolean()),
  choice: v.optional(v.union(v.string(), v.null())),
  notes: v.optional(v.string()),
  catalogEntryId: v.optional(v.id('catalogEntry')),
});

type WritableSheet = Awaited<ReturnType<typeof loadWritableSheet>>;
function findResolvedEntry(
  sheet: WritableSheet,
  target: { grantKey: GrantKey } | { entryId: Id<'characterSheetEntry'> },
) {
  const resolved = sheet.calculated.resolvedEntries.find((row) =>
    'grantKey' in target
      ? row.origin === 'grant' &&
        compareValues(
          'grantKey' in row.entry ? row.entry.grantKey : undefined,
          target.grantKey,
        ) === 0
      : row.storedEntryId === target.entryId && row.origin === 'selection',
  );
  if (!resolved)
    throw new ConvexError('Entry does not belong to this Character');
  return resolved;
}
function requireCatalogSheetDefinition(
  sheet: WritableSheet,
  id: Id<'catalogEntry'>,
) {
  const definition = sheet.catalogEntries.find((row) => row._id === id);
  if (!definition)
    throw new ConvexError('Catalog Entry does not belong to this Character');
  if (!isSelectableCatalogSheetEntryKind(definition.detail.kind))
    throw new ConvexError('Choose a feature or Selection');
  return { ...definition, kind: definition.detail.kind };
}
function sheetEntryReferencesCatalog(
  entry: Doc<'characterSheetEntry'>,
  catalogEntryId: Id<'catalogEntry'>,
) {
  if ('catalogEntryId' in entry && entry.catalogEntryId === catalogEntryId)
    return true;
  if (entry.kind === 'classLevel')
    return entry.state.classEntryId === catalogEntryId;
  if (entry.kind === 'base')
    return entry.state.favoredClassIds?.includes(catalogEntryId) ?? false;
  if (
    entry.kind === 'racialTrait' &&
    entry.state.replaces?.includes(catalogEntryId)
  )
    return true;
  return 'choice' in entry.state && entry.state.choice === catalogEntryId;
}
function isOwnRaceStatisticsDefinition({
  sheet,
  definition,
}: {
  sheet: WritableSheet;
  definition: Doc<'catalogEntry'>;
}) {
  return (
    definition.detail.kind === 'race' &&
    definition.scope === 'character' &&
    definition.characterId === sheet.character._id &&
    definition.racialStatisticsCopy === true
  );
}
function isOwnRaceStatisticsCopy({
  sheet,
  catalogEntryId,
}: {
  sheet: WritableSheet;
  catalogEntryId: Id<'catalogEntry'>;
}) {
  const definition = sheet.catalogEntries.find(
    (row) => row._id === catalogEntryId,
  );
  return (
    definition !== undefined &&
    isOwnRaceStatisticsDefinition({ sheet, definition })
  );
}
/** Points a race Sheet Entry at another definition of its race. */
async function repointRaceEntry(
  ctx: MutationCtx,
  {
    sheet,
    entryId,
    catalogEntryId,
  }: {
    sheet: WritableSheet;
    entryId: Id<'characterSheetEntry'>;
    catalogEntryId: Id<'catalogEntry'>;
  },
) {
  await ctx.db.patch('characterSheetEntry', entryId, {
    catalogEntryId,
    catalogOverride: undefined,
  });
  sheet.entries = sheet.entries.map((entry) =>
    entry._id === entryId && entry.kind === 'race'
      ? { ...entry, catalogEntryId, catalogOverride: undefined }
      : entry,
  );
}
/**
 * The race a discarded statistics copy returns to: its original while the
 * Character can still use it, otherwise a race with the same Rule Identity
 * from the Character's campaign, the global catalog or its own definitions.
 * Null when there is none. Read before the sheet loads, which authorizes it.
 */
async function findRaceForDiscardedStatistics(
  ctx: MutationCtx,
  {
    characterId,
    entryId,
  }: {
    characterId: Id<'character'>;
    entryId: Id<'characterSheetEntry'>;
  },
) {
  const [row, character] = await Promise.all([
    ctx.db.get('characterSheetEntry', entryId),
    ctx.db.get('character', characterId),
  ]);
  if (row?.kind !== 'race' || row.characterId !== characterId || !character)
    return null;
  const copy = await ctx.db.get('catalogEntry', row.catalogEntryId);
  if (!copy?.racialStatisticsCopy) return null;
  const isUsable = (definition: Doc<'catalogEntry'> | null) =>
    definition !== null &&
    definition.detail.kind === 'race' &&
    !definition.racialStatisticsCopy &&
    (definition.scope === 'global' ||
      (definition.scope === 'campaign' &&
        definition.campaignId !== undefined &&
        definition.campaignId === character.campaignId) ||
      (definition.scope === 'character' &&
        definition.characterId === characterId));
  const original = copy.copiedFrom
    ? await ctx.db.get('catalogEntry', copy.copiedFrom)
    : null;
  if (original && isUsable(original)) return original._id;
  const { campaignId } = character;
  const candidates = [
    ...(campaignId
      ? await ctx.db
          .query('catalogEntry')
          .withIndex('by_campaignId_and_scope_and_ruleIdentity', (q) =>
            q
              .eq('campaignId', campaignId)
              .eq('scope', 'campaign')
              .eq('ruleIdentity', copy.ruleIdentity),
          )
          .take(8)
      : []),
    ...(await ctx.db
      .query('catalogEntry')
      .withIndex('by_scope_and_ruleIdentity', (q) =>
        q.eq('scope', 'global').eq('ruleIdentity', copy.ruleIdentity),
      )
      .take(8)),
    ...(await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', copy.ruleIdentity),
      )
      .take(8)),
  ];
  return candidates.find(isUsable)?._id ?? null;
}
async function deleteUnusedRaceStatisticsCopies(
  ctx: MutationCtx,
  sheet: WritableSheet,
) {
  for (const definition of sheet.catalogEntries) {
    if (!isOwnRaceStatisticsDefinition({ sheet, definition })) continue;
    if (
      isCatalogDefinitionReferenced(sheet, definition._id, {
        includeConditionReferences: true,
      })
    )
      continue;
    await ctx.db.delete('catalogEntry', definition._id);
    sheet.catalogEntries = sheet.catalogEntries.filter(
      (entry) => entry._id !== definition._id,
    );
  }
}
async function persistRecordedEntry(
  ctx: MutationCtx,
  sheet: WritableSheet,
  row: WithoutSystemFields<Doc<'characterSheetEntry'>>,
  previousId?: Id<'characterSheetEntry'>,
) {
  const previous = sheet.entries.find((entry) => entry._id === previousId);
  // The concrete document is checked by the schema before it enters the sheet.
  if (previousId) await ctx.db.replace('characterSheetEntry', previousId, row);
  else if (sheet.entries.length >= maxCharacterChildRows)
    throw new ConvexError('Character sheet is too large');
  const id = previousId ?? (await ctx.db.insert('characterSheetEntry', row));
  const stored = await ctx.db.get('characterSheetEntry', id);
  if (!stored) throw new ConvexError('Entry is unavailable');
  sheet.entries = replaceRecordedSelection(sheet.entries, stored);
  const spellDefinitionIds = new Set([
    ...(previous?.kind === 'spell' ? [previous.catalogEntryId] : []),
    ...(stored.kind === 'spell' ? [stored.catalogEntryId] : []),
  ]);
  for (const catalogEntryId of spellDefinitionIds)
    await reconcileSpellDefinition({ ctx, sheet, catalogEntryId });
  return id;
}

export const editGrantState = campaignMutation({
  args: {
    ...writeScope,
    grantKey: grantKeyValidator,
    state: grantStateValidator,
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, { grantKey: args.grantKey });
    const previous = sheet.entries.find(
      (row) => row._id === resolved.storedEntryId,
    );
    if (!('catalogEntryId' in resolved.entry) || resolved.entry.kind === 'base')
      throw new ConvexError('Grant definition is unavailable');
    const catalogEntryId =
      args.state.catalogEntryId ??
      ctx.db.normalizeId('catalogEntry', resolved.entry.catalogEntryId);
    if (!catalogEntryId)
      throw new ConvexError('Grant definition is unavailable');
    const definition = requireCatalogSheetDefinition(sheet, catalogEntryId);
    const resolvedCatalogEntryId = resolved.entry.catalogEntryId;
    const resolvedDefinition = sheet.catalogEntries.find(
      (row) => row._id === resolvedCatalogEntryId,
    );
    if (
      definition.ruleIdentity !== resolvedDefinition?.ruleIdentity ||
      definition.detail.kind !== resolved.entry.kind
    )
      throw new ConvexError(
        'A Grant copy must retain its rule identity and kind',
      );
    requireRacialAbilityScoreChoice(definition, args.state.choice);
    const choice =
      args.state.choice ??
      ('choice' in resolved.entry.state
        ? resolved.entry.state.choice
        : undefined);
    const row = {
      characterId: sheet.character._id,
      catalogEntryId,
      ...buildRecordedCatalogState(
        ctx,
        resolved.entry,
        args.state.choice === null ? null : choice,
      ),
      active: args.state.active ?? resolved.entry.active,
      grantKey: args.grantKey,
      ...(args.state.catalogEntryId !== undefined ||
      (previous && 'catalogOverride' in previous && previous.catalogOverride)
        ? { catalogOverride: true as const }
        : {}),
      ...(previous && 'kept' in previous && previous.kept
        ? { kept: true as const }
        : {}),
      ...(args.state.notes !== undefined
        ? { notes: args.state.notes }
        : 'notes' in resolved.entry && resolved.entry.notes !== undefined
          ? { notes: resolved.entry.notes }
          : {}),
    };
    await persistRecordedEntry(ctx, sheet, row, previous?._id);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

/** Records an arcane school's opposition schools (CRB p. 77). */
export const setOppositionSchools = campaignMutation({
  args: {
    ...writeScope,
    target: dormantTargetValidator,
    schools: v.array(spellSchoolValidator),
  },
  returns: v.null(),
  async handler(ctx, args) {
    if (new Set(args.schools).size !== args.schools.length)
      throw new ConvexError('Choose each opposition school once');
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, args.target);
    const entry = resolved.entry;
    const definition =
      entry.kind === 'classFeature'
        ? sheet.catalogEntries.find((row) => row._id === entry.catalogEntryId)
        : undefined;
    if (
      entry.kind !== 'classFeature' ||
      definition?.detail.kind !== 'classFeature' ||
      !definition.detail.spellcasting?.school
    )
      throw new ConvexError('Choose opposition schools on an arcane school');
    const previous = sheet.entries.find(
      (row) => row._id === resolved.storedEntryId,
    );
    const state = { ...entry.state, oppositionSchools: args.schools };
    if (compareValues(state, entry.state) === 0) return null;
    if (previous?.kind === 'classFeature') {
      await ctx.db.patch('characterSheetEntry', previous._id, { state });
      sheet.entries = sheet.entries.map((row) =>
        row._id === previous._id ? { ...previous, state } : row,
      );
    } else {
      const { grantKey } = entry;
      if (!grantKey)
        throw new ConvexError('Entry does not belong to this Character');
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId: definition._id,
        kind: 'classFeature',
        active: entry.active,
        grantKey,
        state,
      });
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setDormantEntryKept = campaignMutation({
  args: { ...writeScope, target: dormantTargetValidator, kept: v.boolean() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, args.target);
    if (!resolved.dormant)
      throw new ConvexError('Only dormant entries can be kept or un-kept');
    const previous = sheet.entries.find(
      (entry) => entry._id === resolved.storedEntryId,
    );
    if (previous && 'kept' in previous && Boolean(previous.kept) === args.kept)
      return null;
    if (!previous && !args.kept) return null;
    if (previous) {
      if (!('catalogEntryId' in previous) || previous.kind === 'base')
        throw new ConvexError('Only features and Selections can be kept');
      const { _id, _creationTime, ...row } = previous;
      const definition = requireCatalogSheetDefinition(
        sheet,
        previous.catalogEntryId,
      );
      const defaultState = createCatalogSheetEntryState({
        kind: previous.kind,
        casterLevel:
          definition.detail.kind === 'spellEffect'
            ? defaultSpellEffectCasterLevel(sheet, definition.detail)
            : undefined,
        itemMagic:
          definition.detail.kind === 'item'
            ? definition.detail.magic
            : undefined,
      }).state;
      const state =
        'choice' in previous.state && previous.state.choice === null
          ? Object.fromEntries(
              Object.entries(previous.state).filter(
                ([key]) => key !== 'choice',
              ),
            )
          : previous.state;
      if (
        !args.kept &&
        previous.grantKey &&
        previous.active &&
        !previous.notes &&
        !previous.catalogOverride &&
        !previous.selectionSource &&
        !previous.gainedAtClassLevel &&
        compareValues(state, defaultState) === 0
      ) {
        await ctx.db.delete('characterSheetEntry', _id);
        sheet.entries = sheet.entries.filter((entry) => entry._id !== _id);
      } else
        await persistRecordedEntry(
          ctx,
          sheet,
          { ...row, kept: args.kept ? true : undefined },
          _id,
        );
    } else {
      if (
        !('catalogEntryId' in resolved.entry) ||
        !('grantKey' in resolved.entry) ||
        !resolved.entry.grantKey
      )
        throw new ConvexError('Grant definition is unavailable');
      const catalogEntryId = ctx.db.normalizeId(
        'catalogEntry',
        resolved.entry.catalogEntryId,
      );
      if (!catalogEntryId)
        throw new ConvexError('Grant definition is unavailable');
      requireCatalogSheetDefinition(sheet, catalogEntryId);
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId,
        ...buildRecordedCatalogState(ctx, resolved.entry),
        active: resolved.entry.active,
        grantKey: resolved.entry.grantKey,
        kept: true,
      });
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const discardDormantEntry = campaignMutation({
  args: { ...writeScope, target: dormantTargetValidator },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, args.target);
    if (!resolved.dormant)
      throw new ConvexError('Only dormant entries can be discarded');
    const previous = sheet.entries.find(
      (entry) => entry._id === resolved.storedEntryId,
    );
    if (!previous)
      throw new ConvexError('This entry has no recorded state to discard');
    const discardedIds = new Set<string>([resolved.entry._id, previous._id]);
    if (resolved.origin === 'selection' && 'catalogEntryId' in previous) {
      for (const grant of resolveCharacterSheetGrants({
        entries: sheet.entries,
        catalogEntries: sheet.catalogEntries,
        characterKind: sheet.character.kind,
      }).allEntries) {
        if (
          grant.origin !== 'grant' ||
          !hasGrantAncestor(grant.entry._id, resolved.entry._id)
        )
          continue;
        discardedIds.add(grant.entry._id);
        if (grant.storedEntryId) {
          discardedIds.add(grant.storedEntryId);
          const stored = sheet.entries.find(
            (entry) => entry._id === grant.storedEntryId,
          );
          if (stored) await ctx.db.delete('characterSheetEntry', stored._id);
        }
      }
      sheet.entries = sheet.entries.filter(
        (entry) => !discardedIds.has(entry._id) || entry._id === previous._id,
      );
      await removeCatalogSelection(ctx, sheet, previous);
    } else {
      await ctx.db.delete('characterSheetEntry', previous._id);
      sheet.entries = sheet.entries.filter(
        (entry) => entry._id !== previous._id,
      );
    }
    const belongsToDiscardedEntry = (subject: string) =>
      [...discardedIds].some(
        (id) => subject === id || subject.startsWith(`${id}:`),
      ) ||
      (resolved.origin === 'selection' &&
        hasGrantAncestor(subject, resolved.entry._id));
    for (const accepted of sheet.acceptedWarnings.filter((accepted) =>
      belongsToDiscardedEntry(accepted.subject),
    ))
      await ctx.db.delete('acceptedWarning', accepted._id);
    sheet.acceptedWarnings = sheet.acceptedWarnings.filter(
      (accepted) => !belongsToDiscardedEntry(accepted.subject),
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

const selectionFields = {
  choiceOrder: v.optional(v.union(v.number(), v.null())),
  active: v.optional(v.boolean()),
  choice: v.optional(v.union(v.string(), v.null())),
  notes: v.optional(v.string()),
  selectionSource: v.optional(v.union(selectionSourceValidator, v.null())),
  gainedAtClassLevel: v.optional(
    v.union(v.id('characterSheetEntry'), v.null()),
  ),
};
async function requireSelectionReferences(
  ctx: MutationCtx,
  sheet: WritableSheet,
  source: Infer<typeof selectionSourceValidator> | null | undefined,
  gainedAtClassLevel?: Id<'characterSheetEntry'> | null,
) {
  if (gainedAtClassLevel) getClassLevel(sheet, gainedAtClassLevel);
  if (!source) return source;
  if (source.kind === 'classPrompt') {
    if (!Number.isSafeInteger(source.classLevel) || source.classLevel < 1)
      throw new ConvexError('Enter a positive whole prompt level');
    // A prompt may name a class the sheet has not loaded: its browse-only seed.
    const browseOnlyClasses = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly_and_detail_kind', (q) =>
        q
          .eq('characterId', sheet.character._id)
          .eq('browseOnly', true)
          .eq('detail.kind', 'class'),
      )
      .take(maxCharacterChildRows + 1);
    if (browseOnlyClasses.length > maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const loadedIds = new Set(sheet.catalogEntries.map((row) => row._id));
    const classDefinitions: Doc<'catalogEntry'>[] = [
      ...sheet.catalogEntries,
      ...browseOnlyClasses.filter((row) => !loadedIds.has(row._id)),
    ];
    const sourceDefinition = classDefinitions.find(
      (row) =>
        row.ruleIdentity === source.source && row.detail.kind === 'class',
    );
    if (!sourceDefinition)
      throw new ConvexError(
        'Class prompt source does not belong to this Character',
      );
    const family = characterSheetClassFamily(
      sourceDefinition,
      classDefinitions,
    );
    const selectedIds = new Set(
      sheet.entries.flatMap((row) =>
        row.kind === 'classLevel' && row.state.classEntryId
          ? [row.state.classEntryId]
          : [],
      ),
    );
    const familyDefinitions = classDefinitions.filter(
      (row) =>
        row.detail.kind === 'class' &&
        characterSheetClassFamily(row, classDefinitions) === family,
    );
    const selectedDefinitions = familyDefinitions.filter((row) =>
      selectedIds.has(row._id),
    );
    const definitions = selectedDefinitions.length
      ? selectedDefinitions
      : familyDefinitions;
    const list = normalizeCharacterSheetChoiceName(source.list);
    if (
      !definitions.some(
        (row) =>
          row.detail.kind === 'class' &&
          'picksByLevel' in row.detail &&
          row.detail.picksByLevel.some(
            (prompt) =>
              prompt.classLevel === source.classLevel &&
              normalizeCharacterSheetChoiceName(prompt.list) === list,
          ),
      )
    )
      throw new ConvexError('Choose a prompt defined by this class');
    return { ...source, source: family, list };
  }
  const reference = source.kind === 'slot' ? source.grantedBy : source.source;
  const resolvedEntry = sheet.calculated.resolvedEntries.find((row) =>
    reference.kind === 'entry'
      ? row.entry._id === reference.entryId ||
        row.storedEntryId === reference.entryId
      : 'grantKey' in row.entry &&
        compareValues(row.entry.grantKey, reference.grantKey) === 0,
  );
  const sourceEntry =
    reference.kind === 'entry'
      ? sheet.entries.find((row) => row._id === reference.entryId)
      : undefined;
  const resolved =
    resolvedEntry ??
    (sourceEntry
      ? { origin: 'selection' as const, entry: sourceEntry }
      : undefined);
  if (!resolved)
    throw new ConvexError('Selection source does not belong to this Character');
  if (source.kind === 'slot' && source.slotIndex !== undefined)
    requireSafeWholeNumber(source.slotIndex, 'Slot index');
  if (source.kind === 'prompt') {
    if (!source.list.trim()) throw new ConvexError('Choose a prompt list');
    if (source.classLevel !== undefined)
      requireNonnegativeInteger(source.classLevel, 'Prompt level');
  }
  const normalizedReference =
    resolved.origin === 'grant' &&
    'grantKey' in resolved.entry &&
    resolved.entry.grantKey
      ? { kind: 'grant' as const, grantKey: resolved.entry.grantKey }
      : reference;
  return source.kind === 'slot'
    ? { ...source, grantedBy: normalizedReference }
    : { ...source, source: normalizedReference };
}
/** A domain, school or bloodline prompt accepts only options of its kind. */
function requireSpellcastingOption(
  sheet: WritableSheet,
  source: Awaited<ReturnType<typeof requireSelectionReferences>>,
  definition: Doc<'catalogEntry'>,
) {
  if (source?.kind !== 'prompt') return;
  const reference = source.source;
  const owner = sheet.calculated.resolvedEntries.find((row) =>
    reference.kind === 'entry'
      ? row.storedEntryId === reference.entryId
      : 'grantKey' in row.entry &&
        compareValues(row.entry.grantKey, reference.grantKey) === 0,
  )?.entry;
  const ownerDefinition =
    owner && 'catalogEntryId' in owner
      ? sheet.catalogEntries.find((row) => row._id === owner.catalogEntryId)
      : undefined;
  const chooses =
    ownerDefinition?.detail.kind === 'classFeature'
      ? ownerDefinition.detail.spellcasting?.chooses
      : undefined;
  if (!chooses) return;
  if (
    definition.detail.kind !== 'classFeature' ||
    definition.detail.spellcasting?.optionKind !== chooses
  )
    throw new ConvexError(
      {
        domain: 'Choose a domain for this prompt',
        subdomain: 'Choose a subdomain for this prompt',
        school: 'Choose an arcane school for this prompt',
        bloodline: 'Choose a bloodline for this prompt',
      }[chooses],
    );
}
async function selectionSlotSource(
  ctx: MutationCtx,
  sheet: WritableSheet,
  slot: SelectionSlot,
) {
  const reference = slot.grantedBy;
  if (!reference) return undefined;
  if (reference.kind === 'grant') {
    return await requireSelectionReferences(ctx, sheet, {
      kind: 'slot',
      grantedBy: reference,
      slotIndex: slot.slotIndex,
    });
  }
  const entryId = ctx.db.normalizeId('characterSheetEntry', reference.entryId);
  if (!entryId)
    throw new ConvexError('Selection source does not belong to this Character');
  return await requireSelectionReferences(ctx, sheet, {
    kind: 'slot',
    grantedBy: { kind: 'entry', entryId },
    slotIndex: slot.slotIndex,
  });
}

function selectionSlotFor(sheet: WritableSheet, slotId: string) {
  const slot = sheet.calculated.selectionRules.slots.find(
    (candidate) => candidate.id === slotId,
  );
  if (!slot)
    throw new ConvexError('Selection slot does not belong to this Character');
  return slot;
}

export const fillSelectionSlot = campaignMutation({
  args: {
    ...writeScope,
    slotId: v.string(),
    position: v.number(),
    catalogEntryId: v.id('catalogEntry'),
    choice: v.optional(v.union(v.string(), v.null())),
    notes: v.optional(v.string()),
    gainedAtClassLevel: v.optional(
      v.union(v.id('characterSheetEntry'), v.null()),
    ),
    choiceOrder: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadProjectedWritableSheet(ctx, args);
    requireSafeWholeNumber(args.position, 'Slot position');
    const slot = selectionSlotFor(sheet, args.slotId);
    const definition = requireCatalogSheetDefinition(
      sheet,
      await resolvePreferredCatalogEntryId(
        ctx,
        sheet,
        args.catalogEntryId,
        null,
      ),
    );
    if (definition.kind !== slot.kind)
      throw new ConvexError(`Choose a ${slot.kind} for this slot`);
    if (args.gainedAtClassLevel) getClassLevel(sheet, args.gainedAtClassLevel);
    const previous = sheet.entries.find(
      (
        row,
      ): row is Extract<
        Doc<'characterSheetEntry'>,
        { kind: 'feat' | 'trait' }
      > =>
        (row.kind === 'feat' || row.kind === 'trait') &&
        !row.grantKey &&
        row.selectionSlot?.id === slot.id &&
        row.selectionSlot?.position === args.position,
    );
    const metadata = selectionMetadata({
      entries: sheet.entries,
      previous,
      input: args,
    });
    if (metadata.choiceOrder !== undefined)
      requireSafeWholeNumber(metadata.choiceOrder, 'Choice order');
    const selectionSource = await selectionSlotSource(ctx, sheet, slot);
    const id = await persistRecordedEntry(
      ctx,
      sheet,
      {
        ...buildSelectionEntry({
          kind: slot.kind,
          catalogEntryId: definition._id,
          slotId: slot.id,
          position: args.position,
          choice: args.choice,
          source:
            selectionSource?.kind === 'slot' ? selectionSource : undefined,
        }),
        ...metadata,
        characterId: sheet.character._id,
      },
      previous?._id,
    );
    if (previous && previous.catalogEntryId !== definition._id)
      await removeCatalogSelection(ctx, sheet, previous, {
        preserveEntry: true,
      });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return id;
  },
});

export const clearSelectionSlot = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((row) => row._id === args.entryId);
    if (
      !previous ||
      (previous.kind !== 'feat' && previous.kind !== 'trait') ||
      previous.grantKey
    )
      throw new ConvexError(
        'Feat or trait Selection does not belong to this Character',
      );
    await removeCatalogSelection(ctx, sheet, previous);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const selectEntry = campaignMutation({
  args: {
    ...writeScope,
    ...selectionFields,
    catalogEntryId: v.id('catalogEntry'),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const definition = requireCatalogSheetDefinition(
      sheet,
      await resolvePreferredCatalogEntryId(
        ctx,
        sheet,
        args.catalogEntryId,
        null,
      ),
    );
    requireEntryChoice(definition.detail.kind, args.choice);
    await requireAlternateRacialTrait(ctx, sheet, definition);
    requireRacialAbilityScoreChoice(definition, args.choice);
    if (definition.kind === 'race' && args.active !== false)
      requireSingleActiveRace(sheet);
    const selectionSource = await requireSelectionReferences(
      ctx,
      sheet,
      args.selectionSource,
      args.gainedAtClassLevel,
    );
    requireSpellcastingOption(sheet, selectionSource, definition);
    const metadata = selectionMetadata({ entries: sheet.entries, input: args });
    if (metadata.choiceOrder !== undefined)
      requireSafeWholeNumber(metadata.choiceOrder, 'Choice order');
    const id = await persistRecordedEntry(ctx, sheet, {
      ...(definition.kind === 'feat' || definition.kind === 'trait'
        ? buildSelectionEntry({
            kind: definition.kind,
            catalogEntryId: definition._id,
            choice: args.choice,
            source:
              selectionSource?.kind === 'slot' ? selectionSource : undefined,
          })
        : createCatalogSheetEntryState({
            kind: definition.kind,
            choice: args.choice,
            casterLevel:
              definition.detail.kind === 'spellEffect'
                ? defaultSpellEffectCasterLevel(sheet, definition.detail)
                : undefined,
            // Copied once: later definition edits never reach this state.
            itemMagic:
              definition.detail.kind === 'item'
                ? definition.detail.magic
                : undefined,
          })),
      characterId: sheet.character._id,
      catalogEntryId: definition._id,
      active: args.active ?? true,
      ...metadata,
      ...(selectionSource ? { selectionSource } : {}),
    });
    const resolvedItem = resolveItemDefinition(
      definition,
      sheet.catalogEntries,
    ).detail;
    // A specific weapon's default routine uses its Base Item's statistics.
    if (
      resolvedItem?.kind === 'item' &&
      resolvedItem.weapon &&
      !resolvedItem.weapon.naturalAttack &&
      !resolvedItem.armor
    )
      await insertAttackRoutine(ctx, sheet, {
        weaponEntryId: id,
        name: requireRoutineName(
          definition.name ?? resolvedItem.weapon.baseType,
        ),
        ...defaultAttackRoutineConfiguration(resolvedItem.weapon),
      });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return id;
  },
});
type ItemPartStateDoc = Infer<typeof itemPartStateValidator>;
function normalizeItemAbilities(
  ctx: MutationCtx,
  abilities: readonly { catalogEntryId: string; choice?: string | null }[],
) {
  return abilities.map((ability) => {
    const catalogEntryId = ctx.db.normalizeId(
      'catalogEntry',
      ability.catalogEntryId,
    );
    // A malformed ID; a well-formed foreign one fails the sheet's reference checks.
    if (!catalogEntryId) throw new ConvexError('Choose a valid Item Ability');
    return { ...ability, catalogEntryId };
  });
}
function normalizeItemPartState(
  ctx: MutationCtx,
  state: Omit<ItemPartStateDoc, 'abilities'> & {
    abilities?: readonly { catalogEntryId: string; choice?: string | null }[];
  },
): ItemPartStateDoc {
  const { abilities, ...rest } = state;
  return {
    ...rest,
    ...(abilities ? { abilities: normalizeItemAbilities(ctx, abilities) } : {}),
  };
}
/** A resolved item state with its Item Ability references as stored IDs. */
export function normalizeItemState(
  ctx: MutationCtx,
  state: Extract<SheetEntry, { kind: 'item' }>['state'],
): Extract<Doc<'characterSheetEntry'>, { kind: 'item' }>['state'] {
  const { otherEnd, bash, kind, ...primary } = state;
  return {
    ...normalizeItemPartState(ctx, primary),
    kind,
    ...(otherEnd ? { otherEnd: normalizeItemPartState(ctx, otherEnd) } : {}),
    ...(bash ? { bash: normalizeItemPartState(ctx, bash) } : {}),
  };
}
export function requireEntryChoice(
  kind: string,
  choice: string | null | undefined,
) {
  if (
    choice !== undefined &&
    ['condition', 'item', 'spell', 'spellEffect'].includes(kind)
  )
    throw new ConvexError('This entry does not have a recorded choice');
}
type RecordedCatalogEntry = Extract<
  Doc<'characterSheetEntry'>,
  { kind: SelectableCatalogSheetEntryKind }
>;
type RecordedCatalogState<Entry = RecordedCatalogEntry> =
  Entry extends Doc<'characterSheetEntry'>
    ? Pick<Entry, 'kind' | 'state'>
    : never;
export function buildRecordedCatalogState(
  ctx: MutationCtx,
  entry: SheetEntry,
  choice?: string | null,
): RecordedCatalogState {
  requireEntryChoice(entry.kind, choice);
  if (!isSelectableCatalogSheetEntryKind(entry.kind))
    throw new ConvexError('Choose a feature or Selection');
  if (entry.kind === 'feat') {
    const slot = entry.state.slot;
    const reference = typeof slot === 'object' ? slot.grantedBy : undefined;
    if (reference?.kind === 'entry') {
      const entryId = ctx.db.normalizeId(
        'characterSheetEntry',
        reference.entryId,
      );
      if (!entryId)
        throw new ConvexError(
          'Selection source does not belong to this Character',
        );
      return {
        kind: 'feat',
        state: {
          ...entry.state,
          ...(choice === undefined ? {} : { choice }),
          slot: {
            grantedBy: { kind: 'entry', entryId },
            slotIndex: typeof slot === 'object' ? slot.slotIndex : undefined,
          },
        },
      };
    }
  }
  const chosen = choice === undefined ? {} : { choice };
  switch (entry.kind) {
    case 'feat': {
      const slot = entry.state.slot;
      if (slot && typeof slot === 'object' && slot.grantedBy.kind === 'grant')
        return {
          kind: 'feat',
          state: {
            ...entry.state,
            ...chosen,
            slot: { grantedBy: slot.grantedBy, slotIndex: slot.slotIndex },
          },
        };
      return {
        kind: 'feat',
        state: {
          ...entry.state,
          ...chosen,
          slot: slot === 'general' ? slot : undefined,
        },
      };
    }
    case 'race':
      return { kind: entry.kind, state: { ...entry.state, ...chosen } };
    case 'racialTrait': {
      const replaces = entry.state.replaces?.map((reference) => {
        const id = ctx.db.normalizeId('catalogEntry', reference);
        if (!id)
          throw new ConvexError(
            'Replacement does not belong to this Character',
          );
        return id;
      });
      return {
        kind: entry.kind,
        state: { ...entry.state, ...chosen, replaces },
      };
    }
    case 'archetype': {
      const classEntryId = entry.state.classEntryId
        ? ctx.db.normalizeId('catalogEntry', entry.state.classEntryId)
        : undefined;
      if (classEntryId === null)
        throw new ConvexError('Class does not belong to this Character');
      const replaces = entry.state.replaces?.map((replacement) => {
        const catalogEntryId = ctx.db.normalizeId(
          'catalogEntry',
          replacement.catalogEntryId,
        );
        if (!catalogEntryId)
          throw new ConvexError(
            'Replacement does not belong to this Character',
          );
        return { ...replacement, catalogEntryId };
      });
      return {
        kind: entry.kind,
        state: { ...entry.state, ...chosen, classEntryId, replaces },
      };
    }
    case 'classFeature':
      return { kind: entry.kind, state: { ...entry.state, ...chosen } };
    case 'trait':
      return { kind: entry.kind, state: { ...entry.state, ...chosen } };
    case 'manual':
      return { kind: entry.kind, state: { ...entry.state, ...chosen } };
    case 'condition':
      return { kind: entry.kind, state: entry.state };
    case 'spell': {
      const castingClassId = entry.state.castingClassId
        ? ctx.db.normalizeId('catalogEntry', entry.state.castingClassId)
        : undefined;
      if (castingClassId === null)
        throw new ConvexError(
          'Casting Class does not belong to this Character',
        );
      return { kind: entry.kind, state: { ...entry.state, castingClassId } };
    }
    case 'item':
      return { kind: entry.kind, state: normalizeItemState(ctx, entry.state) };
    case 'spellEffect': {
      const { onItem, ...state } = entry.state;
      if (!onItem) return { kind: entry.kind, state };
      if (isUnarmedStrike(onItem.entry))
        return {
          kind: entry.kind,
          state: { ...state, onItem: { ...onItem, entry: UNARMED_STRIKE_ID } },
        };
      const target = ctx.db.normalizeId('characterSheetEntry', onItem.entry);
      if (!target) throw new ConvexError('Choose an item on this sheet');
      return {
        kind: entry.kind,
        state: { ...state, onItem: { ...onItem, entry: target } },
      };
    }
    default:
      throw new ConvexError('Choose a feature or Selection');
  }
}
export const editSelection = campaignMutation({
  args: {
    ...rowScope,
    ...selectionFields,
    catalogEntryId: v.optional(v.id('catalogEntry')),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((row) => row._id === args.entryId);
    if (
      !previous ||
      !('catalogEntryId' in previous) ||
      previous.kind === 'base' ||
      previous.grantKey
    )
      throw new ConvexError('Selection does not belong to this Character');
    const definition = sheet.catalogEntries.find(
      (row) => row._id === (args.catalogEntryId ?? previous.catalogEntryId),
    );
    if (!definition)
      throw new ConvexError('Catalog Entry does not belong to this Character');
    if (definition.detail.kind !== previous.kind)
      throw new ConvexError('A Selection must retain its kind');
    await requireAlternateRacialTrait(ctx, sheet, definition);
    requireRacialAbilityScoreChoice(definition, args.choice);
    if (previous.kind === 'race' && (args.active ?? previous.active))
      requireSingleActiveRace(sheet, previous._id);
    // An unchanged broken Class Level link remains unplaced rather than guessed.
    const unchangedSource =
      args.selectionSource === undefined ||
      compareValues(args.selectionSource, previous.selectionSource) === 0;
    const selectionSource = unchangedSource
      ? previous.selectionSource
      : await requireSelectionReferences(ctx, sheet, args.selectionSource);
    if (
      args.gainedAtClassLevel &&
      args.gainedAtClassLevel !== previous.gainedAtClassLevel
    )
      getClassLevel(sheet, args.gainedAtClassLevel);
    const choice =
      args.choice !== undefined
        ? args.choice
        : 'choice' in previous.state
          ? previous.state.choice
          : undefined;
    const metadata = selectionMetadata({
      entries: sheet.entries,
      previous,
      input: args,
    });
    if (metadata.choiceOrder !== undefined)
      requireSafeWholeNumber(metadata.choiceOrder, 'Choice order');
    const row = {
      ...buildRecordedCatalogState(ctx, previous, choice),
      characterId: sheet.character._id,
      catalogEntryId: definition._id,
      active: args.active ?? previous.active,
      ...(previous.kept ? { kept: previous.kept } : {}),
      selectionSource: selectionSource ?? undefined,
      selectionSlot: previous.selectionSlot,
      ...metadata,
    };
    await persistRecordedEntry(ctx, sheet, row, previous._id);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

type CatalogBackedSelection = Exclude<
  Extract<Doc<'characterSheetEntry'>, { catalogEntryId: Id<'catalogEntry'> }>,
  { kind: 'base' }
>;
function isCatalogBackedSelection(
  entry: Doc<'characterSheetEntry'> | undefined,
): entry is CatalogBackedSelection {
  return (
    entry !== undefined && 'catalogEntryId' in entry && entry.kind !== 'base'
  );
}

export const moveSelection = campaignMutation({
  args: {
    ...rowScope,
    direction: v.union(v.literal('earlier'), v.literal('later')),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const selection = sheet.entries.find((row) => row._id === args.entryId);
    if (!isCatalogBackedSelection(selection))
      throw new ConvexError('Selection does not belong to this Character');
    if (selection.grantKey) throw new ConvexError('Grants cannot be reordered');
    const levelId = selection.gainedAtClassLevel;
    if (
      !levelId ||
      !sheet.entries.some(
        (row) => row._id === levelId && row.kind === 'classLevel' && row.active,
      )
    )
      throw new ConvexError(
        'Record a Class Level before moving this Selection',
      );
    const ordered = orderedSelectionIdsAtLevel(sheet.entries, levelId);
    const index = ordered.indexOf(selection._id);
    if (index === -1) return null;
    const next = index + (args.direction === 'earlier' ? -1 : 1);
    const source = ordered[index];
    const destination = ordered[next];
    if (source === undefined || destination === undefined) return null;
    ordered[index] = destination;
    ordered[next] = source;
    for (const [choiceOrder, entryId] of ordered.entries()) {
      const entry = sheet.entries.find((row) => row._id === entryId);
      if (!isCatalogBackedSelection(entry)) continue;
      if (entry.choiceOrder === choiceOrder) continue;
      await ctx.db.patch('characterSheetEntry', entry._id, { choiceOrder });
      sheet.entries = replaceRecordedSelection(sheet.entries, {
        ...entry,
        choiceOrder,
      });
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

/** Race switches leave each source row and its recorded Grants available to restore. */
export const selectRace = campaignMutation({
  args: {
    ...writeScope,
    catalogEntryId: v.union(v.id('catalogEntry'), v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const definition =
      args.catalogEntryId === null
        ? null
        : requireCatalogSheetDefinition(
            sheet,
            await resolvePreferredCatalogEntryId(
              ctx,
              sheet,
              args.catalogEntryId,
              'race',
            ),
          );
    if (definition && definition.kind !== 'race')
      throw new ConvexError('Choose a race');
    const selected = sheet.entries.find(
      (entry) =>
        entry.kind === 'race' &&
        !entry.grantKey &&
        definition !== null &&
        sheet.catalogEntries.some(
          (catalog) =>
            catalog._id === entry.catalogEntryId &&
            catalog.ruleIdentity === definition.ruleIdentity,
        ),
    );
    let changed = false;
    for (const entry of sheet.entries) {
      if (entry.kind !== 'race' || entry.grantKey) continue;
      const active = entry._id === selected?._id;
      if (entry.active === active) continue;
      await ctx.db.patch('characterSheetEntry', entry._id, { active });
      sheet.entries = sheet.entries.map((row) =>
        row._id === entry._id ? { ...entry, active } : row,
      );
      changed = true;
    }
    // A statistics copy stays until the player discards it, so choosing its
    // race again restores the custom racial Hit Dice.
    if (
      definition &&
      selected?.kind === 'race' &&
      selected.catalogEntryId !== definition._id &&
      !isOwnRaceStatisticsCopy({
        sheet,
        catalogEntryId: selected.catalogEntryId,
      })
    ) {
      await repointRaceEntry(ctx, {
        sheet,
        entryId: selected._id,
        catalogEntryId: definition._id,
      });
      changed = true;
    }
    if (definition && !selected) {
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId: definition._id,
        kind: 'race',
        active: true,
        state: { kind: 'race' },
      });
      changed = true;
    }
    if (changed) {
      await deleteUnusedRaceStatisticsCopies(ctx, sheet);
      await pruneWarningAcceptancesAndRecordChange(ctx, {
        sheet,
        operationId: args.operationId,
      });
    }
    return null;
  },
});

export const setRacialTraitSelected = campaignMutation({
  args: {
    ...writeScope,
    catalogEntryId: v.id('catalogEntry'),
    selected: v.boolean(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const definition = requireCatalogSheetDefinition(
      sheet,
      await resolvePreferredCatalogEntryId(
        ctx,
        sheet,
        args.catalogEntryId,
        'racialTrait',
      ),
    );
    if (definition.kind !== 'racialTrait')
      throw new ConvexError('Choose a Racial Trait');
    await requireAlternateRacialTrait(ctx, sheet, definition);
    const previous = sheet.entries.find(
      (entry) =>
        entry.kind === 'racialTrait' &&
        !entry.grantKey &&
        entry.catalogEntryId === definition._id,
    );
    if (previous && previous.kind !== 'racialTrait')
      throw new ConvexError('Choose a Racial Trait');
    if (previous) {
      if (previous.active === args.selected) return null;
      await ctx.db.patch('characterSheetEntry', previous._id, {
        active: args.selected,
      });
      sheet.entries = sheet.entries.map((entry) =>
        entry._id === previous._id
          ? { ...previous, active: args.selected }
          : entry,
      );
    } else {
      if (!args.selected) return null;
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId: definition._id,
        kind: 'racialTrait',
        active: true,
        state: { kind: 'racialTrait' },
      });
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const chooseRacialAbilityScore = campaignMutation({
  args: {
    ...writeScope,
    target: dormantTargetValidator,
    ability: v.union(abilityValidator, v.null()),
    choiceIndex: v.optional(v.union(v.literal(0), v.literal(1))),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, args.target);
    const entry = resolved.entry;
    if (entry.kind !== 'racialTrait')
      throw new ConvexError('Choose an ability score for a Racial Trait');
    const definition = sheet.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    if (
      !definition?.modifiers.some(
        (modifier) => modifier.target === 'ability.$choice',
      )
    )
      throw new ConvexError('This Racial Trait has no ability score choice');
    const catalogEntryId = ctx.db.normalizeId(
      'catalogEntry',
      entry.catalogEntryId,
    );
    if (!catalogEntryId) throw new ConvexError('Racial Trait is unavailable');
    const isSecondChoice = args.choiceIndex === 1;
    if (
      isSecondChoice &&
      (definition.detail.kind !== 'racialTrait' ||
        definition.detail.abilityChoiceCount !== 2)
    )
      throw new ConvexError(
        'This Racial Trait has no second ability score choice',
      );
    const previous = sheet.entries.find(
      (row) => row._id === resolved.storedEntryId,
    );
    if (previous && previous.kind !== 'racialTrait')
      throw new ConvexError('Racial Trait is unavailable');
    if (
      ((isSecondChoice ? entry.state.secondChoice : entry.state.choice) ??
        null) === args.ability
    )
      return null;
    const recorded = buildRecordedCatalogState(
      ctx,
      previous ?? entry,
      isSecondChoice ? undefined : args.ability,
    );
    if (recorded.kind !== 'racialTrait')
      throw new ConvexError('Racial Trait is unavailable');
    await persistRecordedEntry(
      ctx,
      sheet,
      {
        characterId: sheet.character._id,
        catalogEntryId,
        active: entry.active,
        ...recorded,
        state: {
          ...recorded.state,
          ...(isSecondChoice ? { secondChoice: args.ability } : {}),
        },
        ...(entry.grantKey ? { grantKey: entry.grantKey } : {}),
        ...(previous?.notes !== undefined ? { notes: previous.notes } : {}),
        ...(previous?.kept ? { kept: previous.kept } : {}),
        ...(previous?.catalogOverride ? { catalogOverride: true } : {}),
        ...(previous?.selectionSource
          ? { selectionSource: previous.selectionSource }
          : {}),
        ...(previous?.gainedAtClassLevel
          ? { gainedAtClassLevel: previous.gainedAtClassLevel }
          : {}),
        ...(previous?.choiceOrder !== undefined
          ? { choiceOrder: previous.choiceOrder }
          : {}),
      },
      previous?._id,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setRacialTraitReplacements = campaignMutation({
  args: {
    ...rowScope,
    replaces: v.union(v.array(v.id('catalogEntry')), v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((entry) => entry._id === args.entryId);
    if (previous?.kind !== 'racialTrait' || previous.grantKey)
      throw new ConvexError(
        'Alternate Racial Trait does not belong to this Character',
      );
    if (args.replaces && args.replaces.length > 256)
      throw new ConvexError('Choose at most 256 replacements');
    for (const id of args.replaces ?? []) {
      const definition = requireCatalogSheetDefinition(sheet, id);
      if (definition.kind !== 'racialTrait')
        throw new ConvexError('Choose a Racial Trait to replace');
    }
    const state = {
      ...previous.state,
      replaces:
        args.replaces === null ? undefined : [...new Set(args.replaces)],
    };
    if (compareValues(state, previous.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', previous._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === previous._id ? { ...previous, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

function requireSingleActiveRace(sheet: WritableSheet, exceptEntryId?: string) {
  if (
    sheet.entries.some(
      (entry) =>
        entry.kind === 'race' && entry.active && entry._id !== exceptEntryId,
    )
  )
    throw new ConvexError('Change your race with the race picker');
}
async function requireAlternateRacialTrait(
  ctx: MutationCtx,
  sheet: WritableSheet,
  definition: Doc<'catalogEntry'>,
) {
  if (definition.detail.kind !== 'racialTrait') return;
  // The sheet loads browse-only races and traits only when it refers to them.
  const [browseOnlyRaces, sameTraits] = await Promise.all([
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly_and_detail_kind', (q) =>
        q
          .eq('characterId', sheet.character._id)
          .eq('browseOnly', true)
          .eq('detail.kind', 'race'),
      )
      .take(maxCharacterChildRows + 1),
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q
          .eq('characterId', sheet.character._id)
          .eq('ruleIdentity', definition.ruleIdentity),
      )
      .take(maxCharacterChildRows + 1),
  ]);
  if (
    browseOnlyRaces.length > maxCharacterChildRows ||
    sameTraits.length > maxCharacterChildRows
  )
    throw new ConvexError('Character sheet is too large');
  const traitIds = new Set<string>([
    definition._id,
    ...[...sheet.catalogEntries, ...sameTraits]
      .filter((trait) => trait.ruleIdentity === definition.ruleIdentity)
      .map((trait) => trait._id),
  ]);
  const isStandard = [...sheet.catalogEntries, ...browseOnlyRaces].some(
    (race) =>
      race.detail.kind === 'race' &&
      race.detail.racialTraits.some((id) => traitIds.has(id)),
  );
  if (isStandard)
    throw new ConvexError('Standard Racial Traits are granted by their race');
}
function requireRacialAbilityScoreChoice(
  definition: Doc<'catalogEntry'>,
  choice: string | null | undefined,
) {
  if (
    definition.countsAsRaces &&
    !Array.isArray(definition.countsAsRaces) &&
    'oneOf' in definition.countsAsRaces &&
    choice != null &&
    !definition.countsAsRaces.oneOf.includes(choice)
  )
    throw new ConvexError('Choose one of the available races');
  if (
    definition.detail.kind === 'racialTrait' &&
    definition.modifiers.some(
      (modifier) => modifier.target === 'ability.$choice',
    ) &&
    choice != null &&
    !abilityKeys.some((ability) => ability === choice)
  )
    throw new ConvexError('Choose a valid ability score');
}

function requireRacialProgression(
  progression: Infer<typeof racialProgressionValidator> | null | undefined,
) {
  if (progression == null) return;
  if (!progression.creatureType.trim())
    throw new ConvexError('Creature type is required');
  requireSafeWholeNumber(progression.hitDie, 'Hit Die');
  if (progression.hitDie === 0)
    throw new ConvexError('Hit Die must be a whole number of 1 or more');
  requireNonnegativeInteger(
    progression.skillRanksPerHitDie,
    'Skill ranks per Hit Die',
  );
  if (progression.classSkills.length > 256)
    throw new ConvexError('Choose at most 256 class skills');
  if (progression.classSkills.some((skill) => !skill.trim()))
    throw new ConvexError('Choose a named class skill');
}
function requireRacialSkillRanks(ranks: Record<string, number> | undefined) {
  if (ranks === undefined) return;
  if (Object.keys(ranks).length > 256)
    throw new ConvexError('Choose at most 256 skills');
  const skills = new Set<string>();
  for (const [skill, count] of Object.entries(ranks)) {
    if (!skill.trim()) throw new ConvexError('Choose a skill');
    const key = canonicalSkillKey(skill);
    if (!key) throw new ConvexError('Choose a valid skill');
    if (skills.has(key)) throw new ConvexError('Choose each skill once');
    skills.add(key);
    requireNonnegativeInteger(count, 'Racial skill ranks');
  }
}
const raceStatisticsValidator = v.object({
  racialHitDice: v.optional(v.number()),
  racialProgression: v.optional(v.union(racialProgressionValidator, v.null())),
  racialHpGained: v.optional(v.union(v.number(), v.null())),
  racialSkillRanks: v.optional(v.record(v.string(), v.number())),
});
type RaceStatistics = Infer<typeof raceStatisticsValidator>;
type RaceDetail = Extract<Doc<'catalogEntry'>['detail'], { kind: 'race' }>;
function updatedRaceDetail(detail: RaceDetail, changes: RaceStatistics) {
  const { racialProgression: previousProgression, ...previousDetail } = detail;
  const progression =
    changes.racialProgression === undefined
      ? previousProgression
      : changes.racialProgression;
  return {
    ...previousDetail,
    ...(changes.racialHitDice !== undefined &&
    changes.racialHitDice !== (detail.racialHitDice ?? 0)
      ? { racialHitDice: changes.racialHitDice }
      : {}),
    ...(progression != null ? { racialProgression: progression } : {}),
  };
}
async function createRaceStatisticsCopy(
  ctx: MutationCtx,
  sheet: WritableSheet,
  definition: ReturnType<typeof requireCatalogSheetDefinition>,
  detail: RaceDetail,
) {
  await deleteUnusedRaceStatisticsCopies(ctx, sheet);
  if (
    sheet.catalogEntries.filter(
      (entry) =>
        entry.scope === 'character' &&
        entry.characterId === sheet.character._id,
    ).length >= maxCharacterChildRows
  )
    throw new ConvexError('Character sheet is too large');
  return copyCatalogDefinition(
    ctx,
    definition,
    { scope: 'character', characterId: sheet.character._id },
    { racialStatisticsCopy: true, detail },
  );
}
async function writeRaceStatisticsDefinition(
  ctx: MutationCtx,
  sheet: WritableSheet,
  {
    definition,
    detail,
    hasOverride,
  }: {
    definition: ReturnType<typeof requireCatalogSheetDefinition>;
    detail: RaceDetail;
    hasOverride: boolean;
  },
) {
  const catalogEntryId = hasOverride
    ? definition._id
    : await createRaceStatisticsCopy(ctx, sheet, definition, detail);
  if (hasOverride)
    await ctx.db.patch('catalogEntry', catalogEntryId, { detail });
  const updatedDefinition = await ctx.db.get('catalogEntry', catalogEntryId);
  if (!updatedDefinition)
    throw new ConvexError('Race definition is unavailable');
  sheet.catalogEntries = projectCampaignCopies([
    ...sheet.catalogEntries.filter((entry) => entry._id !== catalogEntryId),
    updatedDefinition,
  ]);
  return catalogEntryId;
}

export const editRaceStatistics = campaignMutation({
  args: { ...rowScope, ...raceStatisticsValidator.fields },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((entry) => entry._id === args.entryId);
    if (previous?.kind !== 'race' || previous.grantKey)
      throw new ConvexError('Race does not belong to this Character');
    const definition = requireCatalogSheetDefinition(
      sheet,
      previous.catalogEntryId,
    );
    if (definition.detail.kind !== 'race')
      throw new ConvexError('Race definition is unavailable');
    if (args.racialHitDice !== undefined)
      requireSafeWholeNumber(args.racialHitDice, 'Racial Hit Dice');
    requireRacialProgression(args.racialProgression);
    if (args.racialHpGained != null)
      requireNonnegativeInteger(args.racialHpGained, 'Racial hit points');
    requireRacialSkillRanks(args.racialSkillRanks);
    const state = {
      ...previous.state,
      ...(args.racialHpGained !== undefined
        ? { racialHpGained: args.racialHpGained }
        : {}),
      ...(args.racialSkillRanks !== undefined
        ? { racialSkillRanks: args.racialSkillRanks }
        : {}),
    };
    const persistedDefinition = await ctx.db.get(
      'catalogEntry',
      definition._id,
    );
    if (persistedDefinition?.detail.kind !== 'race')
      throw new ConvexError('Race definition is unavailable');
    const detail = updatedRaceDetail(persistedDefinition.detail, args);
    const definitionChanged =
      compareValues(detail, persistedDefinition.detail) !== 0;
    if (compareValues(state, previous.state) === 0 && !definitionChanged)
      return null;
    const catalogEntryId = definitionChanged
      ? await writeRaceStatisticsDefinition(ctx, sheet, {
          definition,
          detail,
          hasOverride:
            definition.scope === 'character' &&
            definition.characterId === sheet.character._id &&
            (definition.racialStatisticsCopy === true ||
              definition.copiedFrom !== undefined ||
              // The Character's own homebrew race, made with "New one-off".
              definition.ruleIdentity === `one-off:${definition._id}` ||
              previous.catalogOverride === true),
        })
      : definition._id;
    const patch = {
      state,
      catalogEntryId,
      ...(definitionChanged ? { catalogOverride: true as const } : {}),
    };
    await ctx.db.patch('characterSheetEntry', previous._id, patch);
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === previous._id ? { ...previous, ...patch } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

/**
 * The player's explicit discard of custom racial statistics. The race returns
 * to the definition its statistics copy was made from, or to another version
 * of that race the Character can use; with none, the race is left unset. The
 * copy is deleted once nothing else on the sheet refers to it.
 */
export const discardRaceStatistics = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    // That race is usually unreferenced, so the sheet loads it on request.
    const restoredId = await findRaceForDiscardedStatistics(ctx, args);
    const sheet = await loadWritableSheet(ctx, {
      ...args,
      ...(restoredId ? { catalogEntryId: restoredId } : {}),
    });
    const previous = sheet.entries.find((entry) => entry._id === args.entryId);
    if (previous?.kind !== 'race' || previous.grantKey)
      throw new ConvexError('Race does not belong to this Character');
    if (
      !isOwnRaceStatisticsCopy({
        sheet,
        catalogEntryId: previous.catalogEntryId,
      })
    )
      return null;
    if (restoredId) {
      const restored = requireCatalogSheetDefinition(
        sheet,
        await resolvePreferredCatalogEntryId(ctx, sheet, restoredId, 'race'),
      );
      await repointRaceEntry(ctx, {
        sheet,
        entryId: previous._id,
        catalogEntryId: restored._id,
      });
    } else {
      await ctx.db.delete('characterSheetEntry', previous._id);
      sheet.entries = sheet.entries.filter(
        (entry) => entry._id !== previous._id,
      );
    }
    await deleteUnusedRaceStatisticsCopies(ctx, sheet);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const editEquipment = campaignMutation({
  args: {
    ...writeScope,
    entryId: v.optional(v.id('characterSheetEntry')),
    grantKey: v.optional(grantKeyValidator),
    active: v.optional(v.boolean()),
    masterwork: v.optional(v.boolean()),
    enhancement: v.optional(v.number()),
    material: v.optional(v.union(v.string(), v.null())),
    // The whole list of the part's Item Abilities; [] clears them.
    abilities: v.optional(v.array(itemAbilityRefValidator)),
    // The item itself, a double weapon's other end or a shield's bash.
    end: v.optional(itemPartValidator),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (Boolean(args.entryId) === Boolean(args.grantKey))
      throw new ConvexError('Choose one equipment entry');
    const resolved = args.grantKey
      ? findResolvedEntry(sheet, { grantKey: args.grantKey })
      : null;
    const entry =
      resolved?.entry ?? sheet.entries.find((row) => row._id === args.entryId);
    if (entry?.kind !== 'item')
      throw new ConvexError('Item does not belong to this Character');
    const catalogEntryId = ctx.db.normalizeId(
      'catalogEntry',
      entry.catalogEntryId,
    );
    if (!catalogEntryId)
      throw new ConvexError('Item definition is unavailable');
    const stored = sheet.catalogEntries.find(
      (row) => row._id === catalogEntryId,
    );
    const definition = stored
      ? resolveItemDefinition(stored, sheet.catalogEntries)
      : undefined;
    if (
      definition?.detail?.kind !== 'item' ||
      (!definition.detail.armor &&
        !definition.detail.weapon &&
        !definition.detail.ammunition)
    )
      throw new ConvexError('Choose a weapon, ammunition, armor or a shield');
    const part = args.end ?? 'primary';
    if (part === 'otherEnd' && !definition.detail.weapon?.otherEnd)
      throw new ConvexError(
        'Choose a double weapon with an available other end',
      );
    if (
      part === 'bash' &&
      !(definition.detail.armor?.slot === 'shield' && definition.detail.weapon)
    )
      throw new ConvexError('Choose a shield that can bash');
    const abilities = requireItemPartState({
      state: args,
      catalogEntries: sheet.catalogEntries,
      retained: itemPartState(entry.state, part).abilities,
    });
    const previous = sheet.entries.find(
      (row) => row._id === (resolved?.storedEntryId ?? args.entryId),
    );
    const normalizedMaterial = args.material?.trim();
    const partState = {
      ...(abilities !== undefined ? { abilities } : {}),
      ...(args.masterwork !== undefined ? { masterwork: args.masterwork } : {}),
      ...(args.enhancement !== undefined
        ? { enhancement: args.enhancement }
        : {}),
      ...(args.material !== undefined
        ? {
            material:
              normalizedMaterial === '' ? null : (normalizedMaterial ?? null),
          }
        : {}),
    };
    const state = normalizeItemState(
      ctx,
      part === 'primary'
        ? { ...entry.state, ...partState }
        : { ...entry.state, [part]: { ...entry.state[part], ...partState } },
    );
    const active = args.active ?? entry.active;
    if (active === entry.active && compareValues(state, entry.state) === 0)
      return null;
    await persistRecordedEntry(
      ctx,
      sheet,
      {
        characterId: sheet.character._id,
        catalogEntryId,
        kind: 'item',
        active,
        state,
        ...('grantKey' in entry && entry.grantKey
          ? { grantKey: entry.grantKey }
          : {}),
        ...('choiceOrder' in entry && entry.choiceOrder !== undefined
          ? { choiceOrder: entry.choiceOrder }
          : {}),
        ...('kept' in entry && entry.kept ? { kept: entry.kept } : {}),
        ...('catalogOverride' in entry && entry.catalogOverride
          ? { catalogOverride: entry.catalogOverride }
          : {}),
        ...('notes' in entry && entry.notes !== undefined
          ? { notes: entry.notes }
          : {}),
        ...('gainedAtClassLevel' in entry && entry.gainedAtClassLevel
          ? {
              gainedAtClassLevel:
                ctx.db.normalizeId(
                  'characterSheetEntry',
                  entry.gainedAtClassLevel,
                ) ?? undefined,
            }
          : {}),
        ...(previous &&
        'selectionSource' in previous &&
        previous.selectionSource
          ? { selectionSource: previous.selectionSource }
          : {}),
      },
      previous?._id,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setManualProficiency = campaignMutation({
  args: {
    ...writeScope,
    proficiency: manualProficiencyValidator,
    disposition: v.union(
      v.literal('added'),
      v.literal('removed'),
      v.literal('none'),
    ),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const parsed = manualProficiencySchema.safeParse(args.proficiency);
    if (!parsed.success)
      throw new ConvexError(
        'Enter a proficiency category, weapon name or group',
      );
    const proficiency = parsed.data;
    const base = sheet.entries.find((row) => row.kind === 'base');
    if (!base) throw new ConvexError('Base scores are unavailable');
    const previous = base.state.proficiencies ?? { added: [], removed: [] };
    const proficiencies = {
      added: previous.added.filter(
        (value) => proficiencyKey(value) !== proficiencyKey(proficiency),
      ),
      removed: previous.removed.filter(
        (value) => proficiencyKey(value) !== proficiencyKey(proficiency),
      ),
    };
    if (args.disposition !== 'none')
      proficiencies[args.disposition].push(proficiency);
    if (
      proficiencies.added.length + proficiencies.removed.length >
      maxCharacterChildRows
    )
      throw new ConvexError('Too many manual proficiencies');
    const state = { ...base.state, proficiencies };
    if (compareValues(state, base.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', base._id, { state });
    sheet.entries = sheet.entries.map((row) =>
      row._id === base._id ? { ...base, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setProficiencyChoice = campaignMutation({
  args: { ...rowScope, choice: v.union(v.string(), v.null()) },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = sheet.entries.find((row) => row._id === args.entryId);
    if (
      !entry ||
      (entry.kind !== 'race' &&
        entry.kind !== 'racialTrait' &&
        entry.kind !== 'archetype' &&
        entry.kind !== 'classFeature' &&
        entry.kind !== 'feat' &&
        entry.kind !== 'trait')
    )
      throw new ConvexError(
        'Proficiency choice does not belong to this Character',
      );
    const catalog = sheet.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    if (!catalog?.proficiencies?.some((grant) => 'choice' in grant))
      throw new ConvexError('Entry has no proficiency choice');
    const normalizedChoice = args.choice?.trim();
    const choice = normalizedChoice === '' ? null : (normalizedChoice ?? null);
    const state = { ...entry.state, choice };
    if (compareValues(state, entry.state) === 0) return null;
    const patch = buildRecordedCatalogState(ctx, entry, choice);
    await ctx.db.patch('characterSheetEntry', entry._id, patch);
    const updated = await ctx.db.get('characterSheetEntry', entry._id);
    if (!updated) throw new ConvexError('Entry is unavailable');
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? updated : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setArchetypeSelected = campaignMutation({
  args: {
    ...writeScope,
    classEntryId: v.id('catalogEntry'),
    catalogEntryId: v.id('catalogEntry'),
    selected: v.boolean(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const classEntryId = await resolvePreferredCatalogEntryId(
      ctx,
      sheet,
      args.classEntryId,
      'classLevel',
    );
    const catalogEntryId = await resolvePreferredCatalogEntryId(
      ctx,
      sheet,
      args.catalogEntryId,
      'archetype',
    );
    const baseClass = sheet.catalogEntries.find(
      (definition) => definition._id === classEntryId,
    );
    if (baseClass?.detail.kind !== 'class')
      throw new ConvexError('Class does not belong to this Character');
    const definition = requireCatalogSheetDefinition(sheet, catalogEntryId);
    if (definition.detail.kind !== 'archetype')
      throw new ConvexError('Choose an Archetype');
    const previous = findArchetypeSelection({
      entries: sheet.entries,
      catalogEntries: sheet.catalogEntries,
      ruleIdentity: definition.ruleIdentity,
    });
    if (previous?.kind === 'archetype') {
      const catalogEntryId = args.selected
        ? definition._id
        : previous.catalogEntryId;
      if (
        previous.active === args.selected &&
        previous.catalogEntryId === catalogEntryId &&
        previous.state.classEntryId === classEntryId
      )
        return null;
      await ctx.db.patch('characterSheetEntry', previous._id, {
        active: args.selected,
        catalogEntryId,
        state: { ...previous.state, classEntryId },
      });
      sheet.entries = sheet.entries.map((entry) =>
        entry._id === previous._id
          ? {
              ...previous,
              active: args.selected,
              catalogEntryId,
              state: { ...previous.state, classEntryId },
            }
          : entry,
      );
    } else {
      if (!args.selected) return null;
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId: definition._id,
        kind: 'archetype',
        active: true,
        state: { kind: 'archetype', classEntryId },
      });
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setArchetypePartChoices = campaignMutation({
  args: {
    ...rowScope,
    replacementChoices: v.union(
      v.null(),
      v.array(archetypeReplacementValidator),
    ),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((entry) => entry._id === args.entryId);
    if (previous?.kind !== 'archetype' || previous.grantKey)
      throw new ConvexError('Archetype does not belong to this Character');
    if (args.replacementChoices && args.replacementChoices.length > 256)
      throw new ConvexError('Choose at most 256 feature replacements');
    for (const replacement of args.replacementChoices ?? []) {
      if (
        !Number.isSafeInteger(replacement.classLevel) ||
        replacement.classLevel < 1
      )
        throw new ConvexError('Choose a positive whole class level');
      const definition = requireCatalogSheetDefinition(
        sheet,
        replacement.catalogEntryId,
      );
      if (definition.kind !== 'classFeature')
        throw new ConvexError('Choose a class feature to replace');
    }
    const state = {
      ...previous.state,
      replaces: args.replacementChoices ?? undefined,
    };
    if (compareValues(state, previous.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', previous._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === previous._id ? { ...previous, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

/**
 * #422: records which Archetype's change applies to one conflicting casting
 * property. The choice lives on the chosen Archetype Selection; the other
 * candidates for that property lose theirs. Accepting a warning never
 * records one.
 */
export const chooseArchetypeCasting = campaignMutation({
  args: { ...rowScope, property: v.string() },
  returns: v.null(),
  async handler(ctx, args) {
    if (args.property.length === 0 || args.property.length > 256)
      throw new ConvexError('Choose a casting property');
    const sheet = await loadWritableSheet(ctx, args);
    const chosen = sheet.entries.find((entry) => entry._id === args.entryId);
    if (chosen?.kind !== 'archetype' || chosen.grantKey)
      throw new ConvexError('Archetype does not belong to this Character');
    const property = sheet.calculated.archetypeCastings
      .flatMap((casting) => casting.properties)
      .find(
        (row) =>
          row.key === args.property &&
          row.status !== 'changed' &&
          row.status !== 'automatic' &&
          row.candidates.some((candidate) => candidate.entryId === chosen._id),
      );
    if (!property)
      throw new ConvexError(
        'This archetype has no conflicting change to that casting property',
      );
    const competitors = new Set(
      property.candidates.map((candidate) => candidate.entryId),
    );
    // Determine every candidate's next choices, then write the changed ones.
    const chosenCompetitors = sheet.entries.flatMap((entry) => {
      if (entry.kind !== 'archetype' || !competitors.has(entry._id)) return [];
      const choices = entry.state.castingChoices ?? [];
      const next =
        entry._id === chosen._id
          ? [...new Set([...choices, args.property])].sort()
          : choices.filter((choice) => choice !== args.property);
      if (compareValues(next, choices) === 0) return [];
      const state = {
        ...entry.state,
        castingChoices: next.length ? next : undefined,
      };
      return [{ ...entry, state }];
    });
    if (chosenCompetitors.length === 0) return null;
    for (const entry of chosenCompetitors)
      await ctx.db.patch('characterSheetEntry', entry._id, {
        state: entry.state,
      });
    sheet.entries = sheet.entries.map(
      (row) => chosenCompetitors.find((entry) => entry._id === row._id) ?? row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
