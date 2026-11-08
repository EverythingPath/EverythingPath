import { archetypeCastingChangeSchema } from '../src/lib/character-sheet-archetype-casting';
import {
  alignmentSchema,
  prerequisiteAtomSchema,
  prerequisiteSchema,
} from '../src/lib/character-sheet-prerequisite-schema';
import { armorCategories } from '../src/lib/character-sheet-armor-categories';
import { proficiencyCategories } from '../src/lib/character-sheet-proficiencies';
import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { defineSchema, defineTable } from 'convex/server';
import {
  draftStorageValidator,
  draftSourceReviewStorageValidator,
  operationStorageValidator,
  recordStorageValidator,
} from './lib/canonicalStorageValidators';
import { v } from 'convex/values';
import {
  weaponEnds,
  itemParts,
  itemAbilityTargets,
  naturalAttackTypes,
  naturalAttackRoles,
  UNARMED_STRIKE_ID,
  attackHands,
  spellEffectItemTargets,
} from '../src/lib/character-sheet-attack-types';
import {
  catalogReleaseManifestValidator,
  catalogReleaseRowValidator,
} from '../src/lib/catalog/release-validators';
import {
  abilityKeys,
  abilityTargets,
  bonusTypes,
  modifierConditionSchema,
  modifierTargets,
  catalogModifierTargets,
  creatureSizes,
} from '../src/lib/character-sheet';
import { conditionKeys } from '../src/lib/character-sheet-conditions';
import {
  classCastingAdvancesSchema,
  classCastingSchema,
  classFeatureSpellcastingSchema,
  spellSchoolKeys,
  spellSchools,
} from '../src/lib/character-sheet-casting-tables';
import { companionSourceRuleKindSchema } from '../src/lib/catalog/representative-companion-rules';
import { familiarBaseCreatureKeySchema } from '../src/lib/catalog/representative-familiars';
export const familiarBaseCreatureKeyValidator = zodOutputToConvex(
  familiarBaseCreatureKeySchema,
);
import { companionProgressionStateSchema } from '../src/lib/character-sheet-companion-progression';
import {
  companionAllocatedComponentsSchema,
  companionComponentRuleKinds,
  companionGroupPurchaseKeys,
} from '../src/lib/character-sheet-companion-components';
export const companionProgressionStateValidator = zodOutputToConvex(
  companionProgressionStateSchema,
);
import {
  cohortEquivalenceStateSchema,
  leadershipModifiersSchema,
} from '../src/lib/character-sheet-cohort';
// A cohort's recorded monster equivalence on its base entry (#417).
export const cohortEquivalenceStateValidator = zodOutputToConvex(
  cohortEquivalenceStateSchema,
);
// A cohort source's recorded Leadership Score modifiers (#417).
export const leadershipModifiersValidator = zodOutputToConvex(
  leadershipModifiersSchema,
);
import { companionLinkedInputSchema } from '../src/lib/character-sheet-linked-inputs';
export const companionLinkedInputValidator = zodOutputToConvex(
  companionLinkedInputSchema,
);
export const spellSchoolValidator = v.union(
  ...spellSchoolKeys.map((school) => v.literal(school)),
);
export const spellSchoolOrUniversalValidator = v.union(
  ...spellSchools.map((school) => v.literal(school)),
);
export const classCastingAdvancesValidator = zodOutputToConvex(
  classCastingAdvancesSchema,
);
// Granted Spells are catalog references, so they use document IDs.
const featureSpellcastingFields = zodOutputToConvex(
  classFeatureSpellcastingSchema,
).fields;
export const classFeatureSpellcastingValidator = v.object({
  ...featureSpellcastingFields,
  grantedSpells: v.optional(
    v.object({
      style: v.union(v.literal('slot'), v.literal('schedule')),
      schedule: v.optional(
        v.array(v.object({ spellLevel: v.number(), classLevel: v.number() })),
      ),
      spells: v.array(
        v.object({
          spellLevel: v.number(),
          catalogEntryId: v.id('catalogEntry'),
        }),
      ),
    }),
  ),
});
// #422: an Archetype's casting changes; Spell references use document IDs.
const spellReferenceValidator = v.object({
  catalogEntryId: v.id('catalogEntry'),
});
export const archetypeCastingChangeValidator = v.object({
  ...zodOutputToConvex(archetypeCastingChangeSchema).fields,
  spellList: v.optional(
    v.object({
      classTag: v.optional(v.string()),
      add: v.optional(
        v.array(
          v.object({
            catalogEntryId: v.id('catalogEntry'),
            spellLevel: v.number(),
          }),
        ),
      ),
      remove: v.optional(v.array(spellReferenceValidator)),
    }),
  ),
  grantedSpells: v.optional(
    v.object({
      replace: v.optional(v.boolean()),
      add: classFeatureSpellcastingValidator.fields.grantedSpells,
      remove: v.optional(v.array(spellReferenceValidator)),
    }),
  ),
});
// null marks an advance still unrecorded beside a recorded one; a recorded
// `classEntryId: null` is an explicit empty choice.
export const castingAdvanceAssignmentValidator = v.union(
  v.object({ classEntryId: v.union(v.id('catalogEntry'), v.null()) }),
  v.null(),
);
export const archetypeReplacementValidator = v.object({
  classLevel: v.number(),
  catalogEntryId: v.id('catalogEntry'),
  scope: v.optional(v.union(v.literal('whole'), v.literal('part'))),
});
export const archetypeFeatureChangeValidator = v.union(
  v.object({ featureIdentity: v.string(), scope: v.literal('whole') }),
  v.object({
    featureIdentity: v.string(),
    scope: v.literal('part'),
    part: v.string(),
  }),
);

export const spellValidator = v.object({
  name: v.string(),
  spellLevel: v.string(),
  school: v.string(),
  subschool: v.string(),
  descriptor: v.string(),
  castingTime: v.string(),
  components: v.string(),
  hasCostlyComponents: v.boolean(),
  range: v.string(),
  area: v.string(),
  effect: v.string(),
  targets: v.string(),
  duration: v.string(),
  dismissible: v.boolean(),
  shapeable: v.boolean(),
  savingThrow: v.string(),
  spellResistance: v.string(),
  description: v.string(),
  descriptionFormatted: v.string(),
  source: v.string(),
  fullText: v.string(),
  verbal: v.boolean(),
  somatic: v.boolean(),
  material: v.boolean(),
  requiresFocus: v.boolean(),
  requiresDivineFocus: v.boolean(),
  sorcerer: v.nullable(v.number()),
  wizard: v.nullable(v.number()),
  cleric: v.nullable(v.number()),
  druid: v.nullable(v.number()),
  ranger: v.nullable(v.number()),
  bard: v.nullable(v.number()),
  paladin: v.nullable(v.number()),
  alchemist: v.nullable(v.number()),
  summoner: v.nullable(v.number()),
  witch: v.nullable(v.number()),
  inquisitor: v.nullable(v.number()),
  oracle: v.nullable(v.number()),
  antipaladin: v.nullable(v.number()),
  magus: v.nullable(v.number()),
  adept: v.nullable(v.number()),
  deity: v.string(),
  SLALevel: v.nullable(v.number()),
  domain: v.string(),
  shortDescription: v.string(),
  acid: v.boolean(),
  air: v.boolean(),
  chaotic: v.boolean(),
  cold: v.boolean(),
  curse: v.boolean(),
  darkness: v.boolean(),
  death: v.boolean(),
  disease: v.boolean(),
  earth: v.boolean(),
  electricity: v.boolean(),
  emotion: v.boolean(),
  evil: v.boolean(),
  fear: v.boolean(),
  fire: v.boolean(),
  force: v.boolean(),
  good: v.boolean(),
  languageDependent: v.boolean(),
  lawful: v.boolean(),
  light: v.boolean(),
  mindAffecting: v.boolean(),
  pain: v.boolean(),
  poison: v.boolean(),
  shadow: v.boolean(),
  sonic: v.boolean(),
  water: v.boolean(),
  linkText: v.nullable(v.string()),
  id: v.number(),
  materialCosts: v.nullable(v.number()),
  bloodline: v.string(),
  patron: v.string(),
  mythicText: v.string(),
  augmented: v.string(),
  mythic: v.boolean(),
  bloodrager: v.nullable(v.number()),
  shaman: v.nullable(v.number()),
  psychic: v.nullable(v.number()),
  medium: v.nullable(v.number()),
  mesmerist: v.nullable(v.number()),
  occultist: v.nullable(v.number()),
  spiritualist: v.nullable(v.number()),
  skald: v.nullable(v.number()),
  investigator: v.nullable(v.number()),
  hunter: v.nullable(v.number()),
  ruse: v.boolean(),
  draconic: v.boolean(),
  meditative: v.boolean(),
  summonerUnchained: v.nullable(v.number()),
});

// Why a move stopped without the player cancelling it (#703).
export const characterMoveCancelReasonValidator = v.union(
  v.literal('ownershipChanged'),
  v.literal('campaignChanged'),
  v.literal('replaced'),
  v.literal('groupChanged'),
);

// How a trusted return after leaving an organization ended (#706).
export const organizationDepartureOutcomeValidator = v.union(
  v.literal('returned'),
  v.literal('membershipRestored'),
  v.literal('accountDeleted'),
);

// #710: a campaign deletion returns Characters, then deletes the campaign and
// its live militia and catalog data, keeping its Resolution Records.
export const campaignDeletionStateValidator = v.union(
  v.literal('returning'),
  // Characters need an owner, or can't return, before deletion can go on.
  v.literal('blocked'),
  v.literal('purging'),
  v.literal('deleted'),
);

/** Characters that keep a campaign deletion from going on. */
export const deletionBlockersValidator = v.object({
  ownerless: v.number(),
  unreturnable: v.number(),
});

export const organizationDeletionStateValidator = v.union(
  // An app-requested deletion, before the provider deletes the organization.
  v.literal('preparing'),
  v.literal('blocked'),
  v.literal('ready'),
  // Once the provider has deleted the organization.
  v.literal('revoking'),
  v.literal('awaitingReturns'),
  v.literal('purging'),
  v.literal('completed'),
);

// Stored record kinds (see src/lib/character-kind.ts).
export const characterKindValidator = v.union(
  v.literal('pc'),
  v.literal('npc'),
);

export const characterSheetModeValidator = v.union(
  v.literal('militiaOnly'),
  v.literal('full'),
);
export const abilityValidator = v.union(
  ...abilityKeys.map((ability) => v.literal(ability)),
);
export const characterValidator = v.object({
  name: v.string(),
  ownerId: v.optional(v.string()),
  ownerLastOperationId: v.optional(v.string()),
  carriedCatalogReferences: v.optional(
    v.record(v.string(), v.id('catalogEntry')),
  ),
  campaignId: v.optional(v.id('campaign')),
  catalogFixtureCampaignId: v.optional(v.id('campaign')),
  sheetDemo: v.optional(v.literal(true)),
  description: v.string(),
  kind: characterKindValidator,
  isActive: v.boolean(),
  sheetMode: v.optional(characterSheetModeValidator),
  familiarBaseCreatureKey: v.optional(familiarBaseCreatureKeyValidator),
  familiarBaseScoresPending: v.optional(v.literal(true)),
  sheetPermanentFacts: v.optional(
    v.object({
      level: v.number(),
      racialHitDice: v.number(),
      actualHitDice: v.optional(v.union(v.number(), v.null())),
      strength: v.number(),
      dexterity: v.number(),
      constitution: v.number(),
      intelligence: v.number(),
      wisdom: v.number(),
      charisma: v.number(),
      // Omitted when every score is known; an empty list reads the same, as
      // in militiaSnapshotSchema.
      unresolvedAbilities: v.optional(v.array(abilityValidator)),
    }),
  ),
  sheetRevision: v.optional(v.number()),
  sheetLastOperationId: v.optional(v.string()),
  sheetUpdatedBy: v.optional(v.string()),
  level: v.number(),
  strength: v.number(),
  dexterity: v.number(),
  constitution: v.number(),
  wisdom: v.number(),
  charisma: v.number(),
  intelligence: v.number(),
});

const modifierConditionValidator = zodOutputToConvex(
  modifierConditionSchema,
).extend({
  situation: v.optional(
    v.union(
      v.string(),
      v.object({ local: v.string() }),
      v.object({ option: v.id('catalogEntry') }),
    ),
  ),
  whileActive: v.optional(v.id('catalogEntry')),
});
export const modifierValidator = v.object({
  target: v.union(...modifierTargets.map((target) => v.literal(target))),
  bonusType: v.union(...bonusTypes.map((type) => v.literal(type))),
  value: v.union(v.number(), v.object({ formula: v.string() })),
  condition: v.optional(modifierConditionValidator),
  stacksWithinEntry: v.optional(v.literal(true)),
});
export const catalogModifierValidator = modifierValidator
  .omit('target')
  .extend({
    target: v.union(
      ...catalogModifierTargets.map((target) => v.literal(target)),
    ),
  });
export const situationalNoteValidator = v.object({
  target: v.optional(
    v.union(...catalogModifierTargets.map((target) => v.literal(target))),
  ),
  text: v.string(),
  situation: modifierConditionValidator.fields.situation,
  condition: v.optional(modifierConditionValidator),
});
const baseModifierValidator = modifierValidator
  .pick('target', 'bonusType', 'value')
  .extend({
    target: v.union(
      ...Object.values(abilityTargets).map((target) => v.literal(target)),
    ),
    bonusType: v.literal('base'),
    value: v.number(),
  });
export const grantKeyValidator = v.object({
  source: v.string(),
  classLevel: v.optional(v.number()),
  entry: v.string(),
});
export const companionKindValidator = v.union(
  v.literal('animalCompanion'),
  v.literal('familiar'),
  v.literal('cohort'),
  v.literal('eidolon'),
  v.literal('unchainedEidolon'),
);
// One companion's recorded shares of a divided component budget (#419).
export const companionAllocatedComponentsValidator = zodOutputToConvex(
  companionAllocatedComponentsSchema,
);
export const companionGroupPurchasesValidator = v.array(
  v.union(...companionGroupPurchaseKeys.map((key) => v.literal(key))),
);
export const companionComponentRuleKindValidator = v.union(
  ...companionComponentRuleKinds.map((kind) => v.literal(kind)),
);
export const companionSourceValidator = v.object({
  key: v.string(),
  label: v.string(),
  enabled: v.boolean(),
  sheetEntryId: v.optional(v.id('characterSheetEntry')),
  grantKey: v.optional(grantKeyValidator),
  ruleKind: v.optional(zodOutputToConvex(companionSourceRuleKindSchema)),
  // Rules competing for this source's progression without published
  // precedence (#420), captured with the rule kind.
  ruleConflicts: v.optional(
    v.array(zodOutputToConvex(companionSourceRuleKindSchema)),
  ),
  // This companion's share of a divided effective-level budget (#410).
  allocatedLevels: v.optional(v.number()),
  // This companion's shares of a divided component budget (#419).
  allocatedComponents: v.optional(companionAllocatedComponentsValidator),
  // A cohort source's Leadership Score modifiers (#417).
  leadershipModifiers: v.optional(leadershipModifiersValidator),
});
export const companionSourceWriteValidator = companionSourceValidator.omit(
  'ruleKind',
  'ruleConflicts',
  'allocatedLevels',
  'allocatedComponents',
  'leadershipModifiers',
);
export const companionStatusValidator = v.union(
  v.literal('active'),
  v.literal('interrupted'),
  v.literal('replaced'),
);
export const selectionReferenceValidator = v.union(
  v.object({ kind: v.literal('grant'), grantKey: grantKeyValidator }),
  v.object({ kind: v.literal('entry'), entryId: v.id('characterSheetEntry') }),
);
export const selectionSourceValidator = v.union(
  v.object({
    kind: v.literal('classPrompt'),
    source: v.string(),
    classLevel: v.number(),
    list: v.string(),
  }),
  v.object({
    kind: v.literal('slot'),
    grantedBy: selectionReferenceValidator,
    slotIndex: v.optional(v.number()),
  }),
  v.object({
    kind: v.literal('prompt'),
    source: selectionReferenceValidator,
    list: v.string(),
    classLevel: v.optional(v.number()),
  }),
);
const recordedCatalogEntryFields = {
  grantKey: v.optional(grantKeyValidator),
  kept: v.optional(v.literal(true)),
  catalogOverride: v.optional(v.literal(true)),
  notes: v.optional(v.string()),
  gainedAtClassLevel: v.optional(v.id('characterSheetEntry')),
  choiceOrder: v.optional(v.number()),
  selectionSource: v.optional(selectionSourceValidator),
  selectionSlot: v.optional(v.object({ id: v.string(), position: v.number() })),
};
const picksByLevelValidator = v.array(
  v.object({
    classLevel: v.number(),
    list: v.string(),
    count: v.number(),
  }),
);
export const selectionKindValidator = v.union(
  v.literal('race'),
  v.literal('racialTrait'),
  v.literal('archetype'),
  v.literal('classFeature'),
  v.literal('feat'),
  v.literal('trait'),
);
export const manualProficiencyValidator = v.union(
  v.object({
    category: v.union(
      ...proficiencyCategories.map((category) => v.literal(category)),
    ),
  }),
  v.object({ baseType: v.string(), asMartial: v.optional(v.literal(true)) }),
  v.object({ group: v.string() }),
);
export const proficiencyGrantValidator = v.union(
  ...manualProficiencyValidator.members,
  v.object({ choice: v.literal(true) }),
);
export const proficiencyPrerequisiteValidator = v.object({
  kind: v.literal('proficiency'),
  proficiency: proficiencyGrantValidator,
});
export const alignmentValidator = zodOutputToConvex(alignmentSchema);
export const prerequisiteAtomValidator = zodOutputToConvex(
  prerequisiteAtomSchema,
);
export const prerequisiteValidator = zodOutputToConvex(prerequisiteSchema);
const catalogEntryFields = v.object({
  situationalNotes: v.optional(v.array(situationalNoteValidator)),
  scope: v.union(
    v.literal('global'),
    v.literal('campaign'),
    v.literal('character'),
  ),
  characterId: v.optional(v.id('character')),
  campaignId: v.optional(v.id('campaign')),
  copiedFrom: v.optional(v.id('catalogEntry')),
  copiedFromFingerprint: v.optional(v.string()),
  campaignPreference: v.optional(v.literal(true)),
  racialStatisticsCopy: v.optional(v.literal(true)),
  countsAsRaces: v.optional(
    v.union(v.array(v.string()), v.object({ oneOf: v.array(v.string()) })),
  ),
  proficiencies: v.optional(v.array(proficiencyGrantValidator)),
  proficiencyPrerequisites: v.optional(
    v.array(proficiencyPrerequisiteValidator),
  ),
  browseOnly: v.optional(v.literal(true)),
  importedSpell: v.optional(v.literal(true)),
  prerequisites: v.optional(v.array(prerequisiteValidator)),
  description: v.optional(v.string()),
  guidanceText: v.optional(v.string()),
  prerequisiteText: v.optional(v.string()),
  grants: v.optional(
    v.array(v.object({ catalogEntryId: v.id('catalogEntry') })),
  ),
  grantsSlots: v.optional(
    v.array(
      v.object({
        kind: v.union(v.literal('feat'), v.literal('trait')),
        count: v.number(),
        featTypes: v.optional(v.array(v.string())),
        feats: v.optional(v.array(v.id('catalogEntry'))),
        ignoresPrerequisites: v.optional(v.boolean()),
      }),
    ),
  ),
  name: v.string(),
  ruleIdentity: v.string(),
  sourceKey: v.optional(v.string()),
  dependencyKeys: v.optional(v.array(v.string())),
  requiredDependencyKeys: v.optional(v.array(v.string())),
  stacksWithItself: v.boolean(),
  sources: v.array(
    v.object({ book: v.string(), pages: v.optional(v.string()) }),
  ),
});
export const conditionKeyValidator = v.union(
  ...conditionKeys.map((key) => v.literal(key)),
);
export const naturalAttackRoleValidator = v.union(
  ...naturalAttackRoles.map((role) => v.literal(role)),
);
export const itemAbilityRefValidator = v.object({
  catalogEntryId: v.id('catalogEntry'),
  // Bane's designated foe; null or absent until chosen.
  choice: v.optional(v.union(v.string(), v.null())),
});
const itemPartStateFields = {
  masterwork: v.optional(v.boolean()),
  enhancement: v.optional(v.number()),
  material: v.optional(v.union(v.string(), v.null())),
  abilities: v.optional(v.array(itemAbilityRefValidator)),
};
export const itemPartStateValidator = v.object(itemPartStateFields);
export const itemPartValidator = v.union(
  ...itemParts.map((part) => v.literal(part)),
);
/** A specific magic item's defaults, copied into the sheet entry once on addition. */
export const itemMagicValidator = v.object({
  ...itemPartStateFields,
  otherEnd: v.optional(itemPartStateValidator),
  bash: v.optional(itemPartStateValidator),
});
export const itemAbilityDetailValidator = v.object({
  kind: v.literal('itemAbility'),
  appliesTo: v.union(...itemAbilityTargets.map((target) => v.literal(target))),
  // +0 for flat-priced abilities.
  bonusEquivalent: v.number(),
  damageDice: v.optional(
    v.array(
      v.object({
        dice: v.string(),
        damageType: v.optional(v.string()),
        on: v.union(v.literal('hit'), v.literal('crit')),
        // A shared Situation key, CHOSEN_FOE_SITUATION for the chosen foe,
        // or a local or option Situation (#764), as on a Modifier.
        situation: v.optional(
          v.union(
            v.string(),
            v.object({ local: v.string() }),
            v.object({ option: v.id('catalogEntry') }),
          ),
        ),
      }),
    ),
  ),
  doublesThreat: v.optional(v.literal(true)),
  weaponDamageTypes: v.optional(v.array(v.string())),
  choice: v.optional(v.literal('creatureType')),
  // Bane: the weapon's enhancement is this much better against the foe.
  foeEnhancement: v.optional(v.number()),
});
// What a Spell Effect on one item can target; it filters the target picker.
export const spellEffectItemTargetValidator = v.union(
  ...spellEffectItemTargets.map((target) => v.literal(target)),
);
export const sheetEntryDetailValidator = v.union(
  v.object({
    kind: v.literal('spellEffect'),
    lastsOverOneDay: v.boolean(),
    defaultCasterLevel: v.number(),
    // The Spell's rule identity; its class levels set the caster level default.
    spellKey: v.optional(v.string()),
    // Keen edge: doubles the threat range of its target weapon.
    doublesThreat: v.optional(v.literal(true)),
    itemTarget: v.optional(spellEffectItemTargetValidator),
  }),
  v.object({
    kind: v.literal('condition'),
    conditionKey: v.optional(conditionKeyValidator),
  }),
  v.object({
    kind: v.literal('item'),
    consumable: v.boolean(),
    // #762: an imported item's price (gp) and weight (lb.), as its release
    // body states them; no calculation reads them.
    price: v.optional(v.number()),
    weight: v.optional(v.number()),
    ammunition: v.optional(v.boolean()),
    material: v.optional(v.string()),
    // A specific magic item's Base Item supplies its weapon, and its armor
    // unless the item has its own numbers.
    baseItem: v.optional(v.id('catalogEntry')),
    magic: v.optional(itemMagicValidator),
    weapon: v.optional(
      v.object({
        baseType: v.string(),
        naturalAttack: v.optional(
          v.object({
            type: v.union(...naturalAttackTypes.map((type) => v.literal(type))),
            role: v.optional(naturalAttackRoleValidator),
          }),
        ),
        proficiency: v.union(
          v.literal('simple'),
          v.literal('martial'),
          v.literal('exotic'),
          v.literal('always'),
        ),
        groups: v.optional(v.array(v.string())),
        handedness: v.optional(
          v.union(
            v.literal('light'),
            v.literal('oneHanded'),
            v.literal('twoHanded'),
          ),
        ),
        attackType: v.optional(
          v.union(v.literal('melee'), v.literal('ranged')),
        ),
        dice: v.optional(v.string()),
        damageTypes: v.optional(v.array(v.string())),
        threat: v.optional(v.number()),
        mult: v.optional(v.number()),
        thrown: v.optional(v.boolean()),
        finesse: v.optional(v.boolean()),
        // CRB p. 144: the monk special weapon quality, curated (#414).
        monk: v.optional(v.boolean()),
        rangeIncrement: v.optional(v.number()),
        thrownRangeIncrement: v.optional(v.number()),
        strengthDamage: v.optional(
          v.union(
            v.literal('melee'),
            v.literal('thrown'),
            v.literal('bow'),
            v.literal('compositeBow'),
            v.literal('crossbow'),
            v.literal('sling'),
          ),
        ),
        strengthRating: v.optional(v.number()),
        reload: v.optional(
          v.union(v.literal('free'), v.literal('move'), v.literal('fullRound')),
        ),
        otherEnd: v.optional(
          v.object({
            dice: v.string(),
            threat: v.number(),
            mult: v.number(),
            damageTypes: v.optional(v.array(v.string())),
          }),
        ),
      }),
    ),
    armor: v.optional(
      v.object({
        slot: v.union(v.literal('armor'), v.literal('shield')),
        armorCheckPenalty: v.number(),
        category: v.optional(
          v.union(...armorCategories.map((category) => v.literal(category))),
        ),
        bonus: v.optional(v.number()),
        maxDex: v.optional(v.union(v.number(), v.null())),
        asf: v.optional(v.number()),
      }),
    ),
  }),
  v.object({
    kind: v.literal('spell'),
    levels: v.optional(v.record(v.string(), v.number())),
    school: v.optional(v.string()),
    description: v.optional(v.string()),
  }),
);
export const castingValidator = zodOutputToConvex(classCastingSchema);
export const abilityChangeKindValidator = v.union(
  v.literal('abilityDamage'),
  v.literal('abilityDrain'),
);
export const racialProgressionValidator = v.object({
  creatureType: v.string(),
  hitDie: v.number(),
  bab: v.union(
    v.literal('full'),
    v.literal('threeQuarters'),
    v.literal('half'),
  ),
  saves: v.object({
    fort: v.union(v.literal('good'), v.literal('poor')),
    ref: v.union(v.literal('good'), v.literal('poor')),
    will: v.union(v.literal('good'), v.literal('poor')),
  }),
  skillRanksPerHitDie: v.number(),
  classSkills: v.array(v.string()),
});
export const catalogEntryValidator = v.union(
  catalogEntryFields.extend({
    modifiers: v.array(catalogModifierValidator),
    detail: v.union(
      v.object({
        kind: v.literal('race'),
        racialTraits: v.array(v.id('catalogEntry')),
        allowedAlternateRaces: v.optional(v.array(v.string())),
        size: v.optional(
          v.union(...creatureSizes.map((size) => v.literal(size))),
        ),
        creatureTypes: v.optional(v.array(v.string())),
        creatureSubtypes: v.optional(v.array(v.string())),
        racialHitDice: v.optional(v.number()),
        racialProgression: v.optional(racialProgressionValidator),
      }),
      v.object({
        kind: v.literal('racialTrait'),
        abilityChoiceCount: v.optional(v.literal(2)),
        size: v.optional(
          v.union(...creatureSizes.map((size) => v.literal(size))),
        ),
        raceEntryIds: v.array(v.id('catalogEntry')),
        replaces: v.array(v.id('catalogEntry')),
        favoredClassCount: v.optional(v.literal(2)),
        bonusSkillRanksPerLevel: v.optional(v.number()),
        unresolvedReplacements: v.optional(v.array(v.string())),
        subrace: v.optional(v.string()),
      }),
      v.object({
        kind: v.literal('archetype'),
        classSkillsAdded: v.optional(v.array(v.string())),
        classSkillsRemoved: v.optional(v.array(v.string())),
        skillRanksPerLevel: v.optional(v.number()),
        featureChanges: v.optional(v.array(archetypeFeatureChangeValidator)),
        casting: v.optional(archetypeCastingChangeValidator),
        classEntryIds: v.array(v.id('catalogEntry')),
        replaces: v.array(archetypeReplacementValidator),
        adds: v.array(
          v.object({
            classLevel: v.number(),
            catalogEntryId: v.id('catalogEntry'),
          }),
        ),
        picksByLevel: v.optional(picksByLevelValidator),
      }),
      v.object({
        kind: v.literal('classFeature'),
        parentFeature: v.optional(v.string()),
        part: v.optional(v.string()),
        duplicateUpgrade: v.optional(v.id('catalogEntry')),
        spellcasting: v.optional(classFeatureSpellcastingValidator),
        picksByLevel: v.optional(picksByLevelValidator),
      }),
      v.object({
        kind: v.literal('feat'),
        additionalTraits: v.optional(v.literal(true)),
        featTypes: v.optional(v.array(v.string())),
        repeatable: v.optional(
          v.union(
            v.literal('no'),
            v.literal('newChoice'),
            v.literal('yes'),
            v.literal('unreviewed'),
          ),
        ),
      }),
      v.object({ kind: v.literal('trait'), traitType: v.optional(v.string()) }),
    ),
  }),
  // Prepared sheets created before advancement held class names only.
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: v.object({ kind: v.literal('class') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: v.object({
      kind: v.literal('class'),
      counterpartOf: v.optional(v.id('catalogEntry')),
      classKind: v.union(
        v.literal('base'),
        v.literal('prestige'),
        v.literal('npc'),
      ),
      alignments: v.optional(v.array(alignmentValidator)),
      hitDie: v.number(),
      bab: v.union(
        v.literal('full'),
        v.literal('threeQuarters'),
        v.literal('half'),
      ),
      saves: v.object({
        fort: v.union(v.literal('good'), v.literal('poor')),
        ref: v.union(v.literal('good'), v.literal('poor')),
        will: v.union(v.literal('good'), v.literal('poor')),
      }),
      skillRanksPerLevel: v.number(),
      casting: v.optional(castingValidator),
      castingAdvances: v.optional(classCastingAdvancesValidator),
      classSkills: v.array(v.string()),
      featuresByLevel: v.array(
        v.object({
          classLevel: v.number(),
          catalogEntryId: v.id('catalogEntry'),
        }),
      ),
      picksByLevel: v.array(
        v.object({
          classLevel: v.number(),
          list: v.string(),
          count: v.number(),
        }),
      ),
    }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(baseModifierValidator),
    detail: v.object({ kind: v.literal('base') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: v.object({ kind: v.literal('manual') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: sheetEntryDetailValidator,
  }),
  // Reached only through the items listing it; its Modifiers bind to them.
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: itemAbilityDetailValidator,
  }),
);
export const creationSettingsValidator = v.object({
  abilityMethod: v.union(
    v.object({ kind: v.literal('pointBuy'), budget: v.number() }),
    v.object({ kind: v.literal('rolled'), budget: v.optional(v.number()) }),
  ),
  traitCount: v.number(),
  campaignTraitRequired: v.boolean(),
});
export const favoredClassBonusValidator = v.union(
  v.null(),
  v.object({ choice: v.literal('hp') }),
  v.object({ choice: v.literal('skill') }),
  v.object({ choice: v.literal('alt'), note: v.string() }),
);
export const attackRoutineHandsValidator = v.union(
  v.literal('one'),
  v.literal('two'),
);
export const attackRoutineModeValidator = v.union(
  v.literal('melee'),
  v.literal('ranged'),
  v.literal('thrown'),
);
export const weaponEndValidator = v.union(
  ...weaponEnds.map((end) => v.literal(end)),
);
export const attackHandValidator = v.union(
  ...attackHands.map((hand) => v.literal(hand)),
);
// An item sheet entry or the unarmed strike: what an Attack Routine attacks
// with and what a Spell Effect targets.
export const itemEntryReferenceValidator = v.union(
  v.id('characterSheetEntry'),
  v.literal(UNARMED_STRIKE_ID),
);
export const attackRoutineWeaponValidator = itemEntryReferenceValidator;
export const attackRoutineOffHandValidator = v.union(
  v.object({
    kind: v.literal('weapon'),
    weaponEntryId: attackRoutineWeaponValidator,
    mode: attackRoutineModeValidator,
  }),
  v.object({
    kind: v.literal('otherEnd'),
    mode: attackRoutineModeValidator,
  }),
);
// A Spell Effect's target: an item and optionally its other end or bash.
export const spellEffectTargetValidator = v.object({
  entry: itemEntryReferenceValidator,
  end: v.optional(v.union(v.literal('otherEnd'), v.literal('bash'))),
});
export const characterSheetEntryValidator = v.union(
  v.object({
    characterId: v.id('character'),
    kind: v.literal('attackRoutine'),
    active: v.boolean(),
    state: v.object({
      kind: v.literal('attackRoutine'),
      name: v.string(),
      weaponEntryId: attackRoutineWeaponValidator,
      hands: attackRoutineHandsValidator,
      mode: attackRoutineModeValidator,
      offHand: v.optional(attackRoutineOffHandValidator),
      ammunitionEntryId: v.optional(v.id('characterSheetEntry')),
      rangeIncrements: v.optional(v.number()),
      naturalAttackEntryIds: v.optional(v.array(v.id('characterSheetEntry'))),
      availableLimbs: v.optional(v.number()),
      // Switched-on Routine Options: feat Catalog Entries, kept when the feat leaves.
      options: v.optional(v.array(v.id('catalogEntry'))),
      revision: v.optional(v.number()),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('race'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('race'),
      choice: v.optional(v.union(v.string(), v.null())),
      racialHpGained: v.optional(v.union(v.number(), v.null())),
      racialSkillRanks: v.optional(v.record(v.string(), v.number())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('racialTrait'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('racialTrait'),
      choice: v.optional(v.union(v.string(), v.null())),
      secondChoice: v.optional(
        v.union(...abilityKeys.map((ability) => v.literal(ability)), v.null()),
      ),
      replaces: v.optional(v.array(v.id('catalogEntry'))),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('archetype'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('archetype'),
      classEntryId: v.optional(v.id('catalogEntry')),
      replaces: v.optional(v.array(archetypeReplacementValidator)),
      choice: v.optional(v.union(v.string(), v.null())),
      // #422: the casting properties for which the player chose this archetype's change.
      castingChoices: v.optional(v.array(v.string())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('classFeature'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('classFeature'),
      choice: v.optional(v.union(v.string(), v.null())),
      oppositionSchools: v.optional(v.array(spellSchoolValidator)),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('feat'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('feat'),
      choice: v.optional(v.union(v.string(), v.null())),
      slot: v.optional(
        v.union(
          v.literal('general'),
          v.object({
            grantedBy: selectionReferenceValidator,
            slotIndex: v.optional(v.number()),
          }),
        ),
      ),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('trait'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('trait'),
      choice: v.optional(v.union(v.string(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('abilityDamage'),
    active: v.boolean(),
    state: v.object({
      kind: v.literal('abilityDamage'),
      ability: abilityValidator,
      points: v.number(),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('abilityDrain'),
    active: v.boolean(),
    state: v.object({
      kind: v.literal('abilityDrain'),
      ability: abilityValidator,
      points: v.number(),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('spellEffect'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('spellEffect'),
      casterLevel: v.number(),
      // The weapon, armor, shield, ammunition or unarmed strike it enhances.
      onItem: v.optional(spellEffectTargetValidator),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('condition'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({ kind: v.literal('condition') }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('item'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('item'),
      ...itemPartStateFields,
      otherEnd: v.optional(itemPartStateValidator),
      // A shield's bash, with its own enhancement apart from its AC bonus.
      bash: v.optional(itemPartStateValidator),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('spell'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('spell'),
      castingClassId: v.optional(v.id('catalogEntry')),
      level: v.optional(v.union(v.number(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('manual'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    ...recordedCatalogEntryFields,
    state: v.object({
      kind: v.literal('manual'),
      choice: v.optional(v.union(v.string(), v.null())),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('base'),
    active: v.literal(true),
    catalogEntryId: v.id('catalogEntry'),
    state: v.object({
      kind: v.literal('base'),
      companionProgression: v.optional(companionProgressionStateValidator),
      cohortEquivalence: v.optional(cohortEquivalenceStateValidator),
      // Purchases made once for a whole divided budget, such as a
      // Broodmaster's Larger Brood (#419), owned by the budget's Character.
      companionGroupPurchases: v.optional(
        v.array(
          v.object({
            ruleKind: companionComponentRuleKindValidator,
            purchases: companionGroupPurchasesValidator,
          }),
        ),
      ),
      ...creationSettingsValidator.partial().fields,
      alignment: v.optional(alignmentValidator),
      deity: v.optional(v.string()),
      favoredClassIds: v.optional(v.array(v.id('catalogEntry'))),
      proficiencies: v.optional(
        v.object({
          added: v.array(manualProficiencyValidator),
          removed: v.array(manualProficiencyValidator),
        }),
      ),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('classLevel'),
    active: v.literal(true),
    state: v.object({
      kind: v.literal('classLevel'),
      classEntryId: v.union(v.id('catalogEntry'), v.null()),
      favoredClassBonus: v.optional(favoredClassBonusValidator),
      skillRanks: v.optional(v.record(v.string(), v.number())),
      proficiencyChoice: v.optional(v.union(v.string(), v.null())),
      abilityIncrease: v.optional(
        v.union(v.null(), ...abilityKeys.map((ability) => v.literal(ability))),
      ),
      position: v.number(),
      hpGained: v.union(v.number(), v.null()),
      castingAdvances: v.optional(v.array(castingAdvanceAssignmentValidator)),
    }),
  }),
);

export const campaignValidator = v.object({
  catalogRevision: v.optional(v.number()),
  name: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  description: v.string(),
  inGameDate: v.optional(v.string()),
  e2eFixture: v.optional(
    v.object({
      namespace: v.string(),
      version: v.number(),
      workerKey: v.string(),
      caseKey: v.string(),
      campaignKey: v.string(),
    }),
  ),
});

export const militiaValidator = v.object({
  campaignId: v.id('campaign'),
  name: v.string(),
});

export const roles = v.union(v.literal('admin'), v.literal('member'));

export const backfillPhaseValidator = v.union(
  v.literal('characters'),
  v.literal('candidates'),
  v.literal('sources'),
  v.literal('relationships'),
  v.literal('sheetEntries'),
  v.literal('catalogEntries'),
  v.literal('warnings'),
  v.literal('spells'),
  v.literal('drafts'),
  v.literal('done'),
);
export const backfillCompletionValidator = v.object({
  runId: v.id('initialMigrationRun'),
  epoch: v.number(),
  captureId: v.string(),
  validationId: v.string(),
  schemaIdentity: v.string(),
  calculationIdentity: v.string(),
  catalogManifest: v.string(),
});
const backfillProgressFields = {
  captureId: v.string(),
  schemaIdentity: v.string(),
  calculationIdentity: v.string(),
  catalogManifest: v.string(),
  frontendBuild: v.string(),
  validatedCharacters: v.number(),
  validatedCandidates: v.number(),
  cursor: v.union(v.string(), v.null()),
  isInventoryDone: v.boolean(),
  captured: v.number(),
  nextBatch: v.number(),
  nextValidationBatch: v.number(),
  validationPhase: backfillPhaseValidator,
  validationCursor: v.union(v.string(), v.null()),
  errors: v.number(),
  validationRows: v.record(v.string(), v.number()),
  censusPhase: backfillPhaseValidator,
  censusCursor: v.union(v.string(), v.null()),
  censusRows: v.record(v.string(), v.number()),
  isCensusDone: v.boolean(),
  driverGeneration: v.number(),
  driver: v.union(
    v.null(),
    v.object({
      id: v.string(),
      validationId: v.string(),
      generation: v.number(),
      nextTick: v.number(),
      isRunning: v.boolean(),
      startedAt: v.number(),
      batches: v.number(),
      workDurationMs: v.number(),
      workSampleCount: v.number(),
      lastBatchStartedAt: v.union(v.number(), v.null()),
      stoppedBecause: v.union(
        v.null(),
        v.literal('operator'),
        v.literal('budget'),
        v.literal('finished'),
      ),
    }),
  ),
};
// Initial preparation tables have never been deployed; no stored-state migration.
export const backfillStateValidator = v.union(
  v.object({
    ...backfillProgressFields,
    stage: v.literal('building'),
    validationId: v.null(),
    completion: v.null(),
  }),
  v.object({
    ...backfillProgressFields,
    stage: v.literal('validating'),
    validationId: v.string(),
    completion: v.null(),
  }),
  v.object({
    ...backfillProgressFields,
    stage: v.literal('failed'),
    validationId: v.string(),
    completion: v.null(),
  }),
  v.object({
    ...backfillProgressFields,
    stage: v.literal('complete'),
    validationId: v.string(),
    completion: backfillCompletionValidator,
  }),
);

export const catalogImpactFactsValidator = v.object({
  characterId: v.id('character'),
  level: v.number(),
  racialHitDice: v.optional(v.number()),
  // Companion facts keep actual HD; null preserves unavailable advancement.
  actualHitDice: v.optional(v.union(v.number(), v.null())),
  strength: v.number(),
  dexterity: v.number(),
  constitution: v.number(),
  intelligence: v.number(),
  wisdom: v.number(),
  charisma: v.number(),
  // Scores the sheet can't calculate yet. Omitted when every score is known;
  // an empty list reads the same, as in militiaSnapshotSchema.
  unresolvedAbilities: v.optional(v.array(abilityValidator)),
  isActive: v.boolean(),
});

// Worker evidence is returned for inspection, never stored as sheet totals.
export const catalogImpactEvaluationValidator = v.object({
  revision: v.number(),
  inputFingerprint: v.string(),
  result: v.union(
    v.object({
      kind: v.literal('ready'),
      facts: catalogImpactFactsValidator,
      hasFactsChanged: v.boolean(),
      reasons: v.array(v.string()),
      // #411: Grant ids of retired targets this Character already had.
      retainedGrantIds: v.optional(v.array(v.string())),
      castingEvidence: v.optional(
        v.array(
          v.object({
            classTag: v.string(),
            spellLevel: v.number(),
            base: v.union(v.number(), v.null()),
            total: v.union(v.number(), v.null()),
          }),
        ),
      ),
    }),
    v.object({ kind: v.literal('unaffected') }),
    v.object({ kind: v.literal('deleted') }),
    v.object({ kind: v.literal('notPrepared') }),
    v.object({ kind: v.literal('failed'), error: v.string() }),
  ),
});

export default defineSchema({
  catalogImpactControl: defineTable({
    key: v.literal('global'),
    runId: v.id('catalogImpactRun'),
  }).index('by_key', ['key']),
  catalogImpactRun: defineTable({
    releaseId: v.id('catalogRelease'),
    cursor: v.union(v.string(), v.null()),
    discoveryStage: v.union(
      v.literal('next'),
      v.literal('base'),
      v.literal('retained'),
      // Retired by #411; runs recorded at this stage continue to 'reverse'.
      v.literal('grantSources'),
      v.literal('reverse'),
      v.literal('sheets'),
      v.literal('campaigns'),
    ),
    isDiscoveryComplete: v.boolean(),
    discoveryError: v.optional(v.string()),
    missingIdentityCount: v.optional(v.number()),
    identityCoverageComplete: v.optional(v.boolean()),
    resourceCoverageComplete: v.optional(v.boolean()),
    reverseKey: v.optional(v.string()),
    reverseCursor: v.optional(v.union(v.string(), v.null())),
    reverseDefinitionIds: v.optional(v.array(v.id('catalogEntry'))),
    reverseDefinitionCursor: v.optional(v.union(v.string(), v.null())),
    isReverseDefinitionsComplete: v.optional(v.boolean()),
    reverseLookup: v.optional(
      v.union(
        v.literal('identity'),
        v.literal('definitions'),
        v.literal('catalogEntry'),
      ),
    ),
    isReverseDiscoveryComplete: v.optional(v.boolean()),
    baseReleaseNumber: v.optional(v.union(v.number(), v.null())),
    lifecycle: v.optional(
      v.union(
        v.literal('active'),
        v.literal('ready'),
        v.literal('superseded'),
        v.literal('abandoned'),
      ),
    ),
  })
    .index('by_releaseId', ['releaseId'])
    .index('by_releaseId_and_lifecycle', ['releaseId', 'lifecycle']),
  catalogImpactChange: defineTable({
    runId: v.id('catalogImpactRun'),
    key: v.string(),
    hasChanged: v.boolean(),
    hasSpellDependencies: v.optional(v.boolean()),
  })
    .index('by_runId_and_key', ['runId', 'key'])
    .index('by_runId_and_hasSpellDependencies', [
      'runId',
      'hasSpellDependencies',
    ]),
  catalogImpactEdge: defineTable({
    runId: v.id('catalogImpactRun'),
    from: v.string(),
    to: v.string(),
  })
    .index('by_runId_and_from', ['runId', 'from'])
    .index('by_runId_and_from_and_to', ['runId', 'from', 'to']),
  catalogImpactWork: defineTable({
    runId: v.id('catalogImpactRun'),
    characterId: v.id('character'),
    revision: v.number(),
    state: v.union(
      v.literal('dirty'),
      v.literal('ready'),
      v.literal('failed'),
      v.literal('unaffected'),
      v.literal('deleted'),
      v.literal('notPrepared'),
    ),
    facts: v.optional(catalogImpactFactsValidator),
    hasFactsChanged: v.optional(v.boolean()),
    factGeneration: v.optional(v.number()),
    factCampaignId: v.optional(v.id('campaign')),
    reasons: v.optional(v.array(v.string())),
    // #411: existing Grants of retired targets, kept once this run activates.
    retainedGrantIds: v.optional(v.array(v.string())),
    inputFingerprint: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index('by_runId_and_characterId', ['runId', 'characterId'])
    .index('by_runId_and_state', ['runId', 'state']),
  catalogRelease: defineTable({
    releaseNumber: v.number(),
    state: v.union(v.literal('preparing'), v.literal('prepared')),
    baseReleaseNumber: v.union(v.number(), v.null()),
    manifest: catalogReleaseManifestValidator,
    nextBatchIndex: v.number(),
    batchCount: v.number(),
    stagedRows: v.number(),
    reportCategories: v.array(v.string()),
    legalKeys: v.array(v.string()),
  }).index('by_releaseNumber', ['releaseNumber']),
  catalogReleaseRow: defineTable(
    v.union(
      ...catalogReleaseRowValidator.members.map((row) =>
        row.extend({
          releaseId: v.id('catalogRelease'),
          batchIndex: v.number(),
        }),
      ),
    ),
  ).index('by_releaseId_and_kind_and_key', ['releaseId', 'kind', 'key']),
  catalogCampaignFacts: defineTable({
    runId: v.id('catalogImpactRun'),
    campaignId: v.id('campaign'),
    baseGeneration: v.number(),
    generation: v.number(),
    changedCount: v.number(),
  }).index('by_runId_and_campaignId', ['runId', 'campaignId']),
  catalogReleaseSpellIndex: defineTable({
    releaseId: v.id('catalogRelease'),
    ruleIdentity: v.string(),
    classTag: v.string(),
    level: v.union(v.number(), v.null()),
    name: v.string(),
    school: v.string(),
    levels: v.record(v.string(), v.number()),
    isSelectable: v.boolean(),
  })
    .index('by_releaseId_and_classTag_and_name', [
      'releaseId',
      'classTag',
      'name',
    ])
    .index('by_releaseId_and_classTag_and_level_and_name', [
      'releaseId',
      'classTag',
      'level',
      'name',
    ])
    .index('by_releaseId_and_classTag_and_school_and_name', [
      'releaseId',
      'classTag',
      'school',
      'name',
    ])
    .index('by_releaseId_and_classTag_and_level_and_school_and_name', [
      'releaseId',
      'classTag',
      'level',
      'school',
      'name',
    ])
    .index('by_releaseId_and_ruleIdentity', ['releaseId', 'ruleIdentity'])
    .searchIndex('search_name', {
      searchField: 'name',
      filterFields: ['releaseId', 'classTag', 'level', 'school'],
    }),
  catalogCharacterFacts: defineTable({
    characterId: v.id('character'),
    releaseNumber: v.union(v.number(), v.null()),
    facts: catalogImpactFactsValidator,
    generation: v.number(),
  }).index('by_characterId', ['characterId']),
  // One selection binds definitions, resources, legal content, calculation and facts.
  catalogReleaseControl: defineTable({
    key: v.literal('global'),
    releaseNumber: v.number(),
    schemaIdentity: v.string(),
    calculationIdentity: v.string(),
    releaseId: v.optional(v.id('catalogRelease')),
    impactRunId: v.optional(v.id('catalogImpactRun')),
    activationId: v.optional(v.string()),
    isFixtureOnly: v.optional(v.boolean()),
  }).index('by_key', ['key']),
  campaignSpellMembership: defineTable({
    campaignId: v.id('campaign'),
    revision: v.number(),
  }).index('by_campaignId', ['campaignId']),
  characterMove: defineTable({
    characterId: v.id('character'),
    operationId: v.string(),
    actor: v.string(),
    sourceCampaignId: v.optional(v.id('campaign')),
    destinationCampaignId: v.optional(v.id('campaign')),
    destinationCampaignName: v.optional(v.string()),
    state: v.union(
      v.literal('preparing'),
      v.literal('ready'),
      v.literal('completed'),
      v.literal('cancelled'),
    ),
    fingerprint: v.string(),
    // #711: bounded downward group, children use the same move machinery.
    groupRootId: v.optional(v.id('characterMove')),
    groupCharacterIds: v.optional(v.array(v.id('character'))),
    groupFingerprint: v.optional(v.string()),
    groupMoveClaims: v.optional(
      v.array(
        v.object({
          characterId: v.id('character'),
          moveId: v.optional(v.id('characterMove')),
          ownerOperationId: v.optional(v.string()),
        }),
      ),
    ),
    // #703: the ownership assignment the move was requested under.
    ownerOperationId: v.optional(v.string()),
    cancelReason: v.optional(characterMoveCancelReasonValidator),
    // #706: the trusted return to no campaign after the owner left its organization.
    departureId: v.optional(v.id('organizationDeparture')),
    // #710: the trusted return to no campaign before its campaign is deleted.
    campaignDeletionId: v.optional(v.id('campaignDeletion')),
    sourceRevision: v.number(),
    sourceSpellMembershipStamp: v.optional(v.number()),
    destinationSpellMembershipStamp: v.optional(v.number()),
    scanPhase: v.union(
      v.literal('campaignSpells'),
      v.literal('campaignKeys'),
      v.literal('globalKeys'),
      v.literal('destinationSpells'),
      v.literal('done'),
    ),
    scanCursor: v.union(v.string(), v.null()),
    generation: v.number(),
    prepared: v.number(),
    total: v.number(),
  })
    .index('by_characterId_and_operationId', ['characterId', 'operationId'])
    .index('by_characterId', ['characterId']),
  characterMoveReference: defineTable({
    moveId: v.id('characterMove'),
    characterId: v.id('character'),
    generation: v.number(),
    reference: v.union(
      v.object({ kind: v.literal('key'), key: v.string() }),
      v.object({
        kind: v.union(
          v.literal('candidate'),
          v.literal('destination'),
          v.literal('definition'),
        ),
        catalogEntryId: v.id('catalogEntry'),
      }),
    ),
  })
    .index('by_moveId_and_generation', ['moveId', 'generation'])
    .index('by_characterId', ['characterId']),
  characterMoveDefinition: defineTable({
    moveId: v.id('characterMove'),
    characterId: v.id('character'),
    generation: v.number(),
    sourceId: v.id('catalogEntry'),
    sourceCreatedAt: v.number(),
    definition: catalogEntryValidator,
  })
    .index('by_moveId_and_generation', ['moveId', 'generation'])
    .index('by_characterId', ['characterId']),
  initialMigrationControl: defineTable({
    key: v.literal('character-sheet'),
    epoch: v.number(),
    closed: v.boolean(),
    authority: v.union(v.literal('legacy'), v.literal('sheet')),
    runId: v.id('initialMigrationRun'),
    acceptWebhooksAfter: v.optional(v.number()),
  }).index('by_key', ['key']),
  initialMigrationRun: defineTable({
    operationId: v.string(),
    epoch: v.number(),
    state: v.union(
      v.literal('maintenance'),
      v.literal('aborted'),
      v.literal('activated'),
    ),
    frontendBuild: v.string(),
    catalogManifest: v.string(),
    startedAt: v.number(),
    deadline: v.number(),
    abortedAt: v.optional(v.number()),
    backfill: v.optional(backfillStateValidator),
  }).index('by_operationId', ['operationId']),
  // Private preparation rows never participate in active sheet or facts reads.
  initialMigrationCandidate: defineTable({
    runId: v.id('initialMigrationRun'),
    epoch: v.number(),
    captureId: v.string(),
    characterId: v.id('character'),
    characterHash: v.string(),
    input: v.union(v.string(), v.null()),
    sheetMode: characterSheetModeValidator,
    isInitialized: v.boolean(),
    error: v.union(v.string(), v.null()),
  }).index('by_runId_and_characterId', ['runId', 'characterId']),
  initialMigrationReport: defineTable({
    runId: v.id('initialMigrationRun'),
    captureId: v.string(),
    validationId: v.string(),
    scope: v.string(),
    message: v.string(),
  }).index('by_runId_and_validationId', ['runId', 'validationId']),
  canonicalSourceCorrection: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    expectedRevision: v.number(),
    revision: v.number(),
    reason: v.string(),
    actor: v.string(),
    createdAt: v.number(),
  }).index('by_militiaId', ['militiaId']),
  campaignCutover: defineTable({
    key: v.literal('weekly-draft'),
    status: v.union(v.literal('paused'), v.literal('canonical')),
    operationId: v.string(),
    oldRelease: v.string(),
    newRelease: v.string(),
    campaignIds: v.array(v.id('campaign')),
    pausedAt: v.number(),
    reopenedAt: v.optional(v.number()),
    backup: v.optional(
      v.object({
        sha256: v.string(),
        location: v.string(),
        verifiedRestoreDeployment: v.string(),
        retainUntil: v.number(),
      }),
    ),
  }).index('by_key', ['key']),
  canonicalMilitiaState: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    revision: v.number(),
    snapshot: zodOutputToConvex(militiaSnapshotSchema),
  }).index('by_militiaId', ['militiaId']),
  canonicalCampaignInitialization: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    initializationId: v.string(),
    setupNotes: v.optional(v.string()),
    draftId: v.string(),
    sourceToken: v.string(),
  }).index('by_militiaId', ['militiaId']),
  canonicalResolutionRecord: defineTable(recordStorageValidator)
    .index('by_recordId', ['recordId'])
    .index('by_sourceDraftId', ['record.source.draftId'])
    .index('by_campaignId_and_week_and_sequence', [
      'campaignId',
      'week',
      'sequence',
    ])
    .index('by_militiaId', ['militiaId']),
  canonicalDraftTarget: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    draftId: v.string(),
    target: v.string(),
    revision: v.number(),
    subtreeRevision: v.number(),
  })
    .index('by_draftId_and_target', ['draftId', 'target'])
    .index('by_draftId_and_revision', ['draftId', 'revision'])
    .index('by_militiaId', ['militiaId']),
  canonicalDraftSourceReview: defineTable(draftSourceReviewStorageValidator)
    .index('by_draftId_and_revision', ['draftId', 'revision'])
    .index('by_militiaId', ['militiaId']),
  canonicalDraftOperation: defineTable(operationStorageValidator)
    .index('by_draftId_and_operationId', ['draftId', 'operationId'])
    .index('by_draftId_and_acceptedRevision', ['draftId', 'acceptedRevision'])
    .index('by_militiaId', ['militiaId']),
  canonicalWeeklyDraft: defineTable(draftStorageValidator)
    .index('by_draftId', ['draftId'])
    .index('by_campaignId_and_status', ['campaignId', 'status'])
    .index('by_militiaId', ['militiaId']),
  e2eFixtureIdentity: defineTable({
    namespace: v.string(),
    workerKey: v.string(),
    userId: v.id('user'),
  })
    .index('by_namespace_and_workerKey', ['namespace', 'workerKey'])
    .index('by_userId', ['userId']),
  catalogEntry: defineTable(catalogEntryValidator)
    .index('by_scope_and_detail_kind', ['scope', 'detail.kind'])
    .index('by_scope_and_ruleIdentity', ['scope', 'ruleIdentity'])
    .index('by_characterId', ['characterId'])
    .index('by_scope', ['scope'])
    .index('by_campaignId_and_scope', ['campaignId', 'scope'])
    .index('by_campaignId_and_scope_and_detail_kind', [
      'campaignId',
      'scope',
      'detail.kind',
    ])
    .index('by_campaignId_and_scope_and_dependencyKeys', [
      'campaignId',
      'scope',
      'dependencyKeys',
    ])
    .index('by_campaignId_and_scope_and_ruleIdentity', [
      'campaignId',
      'scope',
      'ruleIdentity',
    ])
    .index('by_campaignId_and_scope_and_copiedFrom_and_campaignPreference', [
      'campaignId',
      'scope',
      'copiedFrom',
      'campaignPreference',
    ])
    .index('by_characterId_and_browseOnly', ['characterId', 'browseOnly'])
    .index('by_characterId_and_browseOnly_and_detail_kind', [
      'characterId',
      'browseOnly',
      'detail.kind',
    ])
    .index('by_ruleIdentity', ['ruleIdentity'])
    .index('by_characterId_and_ruleIdentity', ['characterId', 'ruleIdentity']),
  spellCatalogIndex: defineTable({
    characterId: v.id('character'),
    ruleIdentity: v.optional(v.string()),
    levels: v.optional(v.record(v.string(), v.number())),
    catalogEntryId: v.id('catalogEntry'),
    castingClassId: v.id('catalogEntry'),
    level: v.union(v.number(), v.null()),
    school: v.string(),
    name: v.string(),
    available: v.boolean(),
    recorded: v.optional(v.boolean()),
  })
    .index('by_catalogEntryId', ['catalogEntryId'])
    .index('by_ruleIdentity', ['ruleIdentity'])
    .index('by_characterId_and_castingClassId_and_ruleIdentity', [
      'characterId',
      'castingClassId',
      'ruleIdentity',
    ])
    .index('by_characterId_and_catalogEntryId', [
      'characterId',
      'catalogEntryId',
    ])
    .index('by_characterId_and_ruleIdentity', ['characterId', 'ruleIdentity'])
    .index('by_characterId_and_castingClassId_and_available_and_name', [
      'characterId',
      'castingClassId',
      'available',
      'name',
    ])
    // Convex caps index names at 64 characters, so these drop the `_and_` joiners.
    .index('by_characterId_castingClassId_available_level_name', [
      'characterId',
      'castingClassId',
      'available',
      'level',
      'name',
    ])
    .index('by_characterId_castingClassId_available_school_name', [
      'characterId',
      'castingClassId',
      'available',
      'school',
      'name',
    ])
    .index('by_characterId_castingClassId_available_level_school_name', [
      'characterId',
      'castingClassId',
      'available',
      'level',
      'school',
      'name',
    ])
    .index('by_characterId_and_castingClassId_and_name', [
      'characterId',
      'castingClassId',
      'name',
    ])
    .index('by_characterId_and_castingClassId_and_level_and_name', [
      'characterId',
      'castingClassId',
      'level',
      'name',
    ])
    .index('by_characterId_and_castingClassId_and_school_and_name', [
      'characterId',
      'castingClassId',
      'school',
      'name',
    ])
    .index('by_characterId_and_castingClassId_and_level_and_school_and_name', [
      'characterId',
      'castingClassId',
      'level',
      'school',
      'name',
    ])
    .searchIndex('search_name', {
      searchField: 'name',
      filterFields: [
        'characterId',
        'castingClassId',
        'available',
        'level',
        'school',
      ],
    }),
  spellCatalogSummary: defineTable(
    v.union(
      v.object({
        characterId: v.id('character'),
        castingClassId: v.id('catalogEntry'),
        kind: v.literal('level'),
        value: v.union(v.number(), v.null()),
        count: v.number(),
        availableCount: v.number(),
        unrecordedCount: v.number(),
      }),
      v.object({
        characterId: v.id('character'),
        castingClassId: v.id('catalogEntry'),
        kind: v.literal('school'),
        value: v.string(),
        count: v.number(),
        availableCount: v.number(),
        unrecordedCount: v.number(),
      }),
    ),
  ).index('by_characterId_and_castingClassId_and_kind_and_value', [
    'characterId',
    'castingClassId',
    'kind',
    'value',
  ]),
  acceptedWarning: defineTable({
    characterId: v.id('character'),
    check: v.string(),
    subject: v.string(),
    fingerprint: v.string(),
    acceptedBy: v.string(),
    acceptedAt: v.number(),
  }).index('by_characterId', ['characterId']),
  characterSheetEntry: defineTable(characterSheetEntryValidator)
    .index('by_characterId', ['characterId'])
    .index('by_characterId_and_kind_and_active', [
      'characterId',
      'kind',
      'active',
    ]),
  character: defineTable(characterValidator)
    .index('by_campaignId_and_catalogFixtureCampaignId', [
      'campaignId',
      'catalogFixtureCampaignId',
    ])
    .index('by_campaignId', ['campaignId'])
    .index('by_ownerId_and_campaignId', ['ownerId', 'campaignId'])
    .index('by_sheetMode', ['sheetMode']),
  characterLinkedInput: defineTable({
    characterId: v.id('character'),
    relationshipId: v.id('companionRelationship'),
    inputKey: v.string(),
    input: companionLinkedInputValidator,
    fallback: v.optional(v.number()),
    interpretation: v.optional(v.object({ sourceKey: v.string() })),
  })
    .index('by_characterId', ['characterId'])
    .index('by_characterId_and_relationshipId', [
      'characterId',
      'relationshipId',
    ])
    .index('by_characterId_and_relationshipId_and_inputKey', [
      'characterId',
      'relationshipId',
      'inputKey',
    ]),
  companionRelationship: defineTable({
    associatedCharacterId: v.id('character'),
    companionCharacterId: v.id('character'),
    kind: companionKindValidator,
    sources: v.array(companionSourceValidator),
    status: companionStatusValidator,
    manuallyInterrupted: v.boolean(),
    activatedAt: v.number(),
    lastOperationId: v.string(),
  })
    .index('by_associatedCharacterId', ['associatedCharacterId'])
    .index('by_companionCharacterId', ['companionCharacterId'])
    .index('by_associatedCharacterId_and_kind', [
      'associatedCharacterId',
      'kind',
    ])
    .index('by_companionCharacterId_and_kind', [
      'companionCharacterId',
      'kind',
    ]),
  campaign: defineTable(campaignValidator)
    .index('by_organization', ['organizationId'])
    .index('by_e2eFixture_namespace_and_workerKey_and_caseKey', [
      'e2eFixture.namespace',
      'e2eFixture.workerKey',
      'e2eFixture.caseKey',
    ]),
  militia: defineTable(militiaValidator).index('by_campaign', ['campaignId']),
  spell: defineTable(spellValidator).index('by_name', ['name']),
  characterSpell: defineTable(
    v.object({
      characterId: v.id('character'),
      spellId: v.id('spell'),
    }),
  )
    .index('characterId', ['characterId'])
    .index('spellId_characterId', ['spellId', 'characterId']),
  user: defineTable({
    tokenIdentifier: v.string(),
    characterSheetDemo: v.optional(v.literal(true)),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    webhookUpdatedAt: v.optional(v.number()),
    orgIds: v.array(
      v.object({
        orgId: v.string(),
        role: roles,
        webhookUpdatedAt: v.optional(v.number()),
      }),
    ),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),
  organizationMembership: defineTable({
    userId: v.id('user'),
    organizationId: v.string(),
  })
    .index('by_organizationId_and_userId', ['organizationId', 'userId'])
    .index('by_userId_and_organizationId', ['userId', 'organizationId']),
  // #706: a user's loss of one organization's membership. The newest removal's
  // provider time also fences older membership events for that organization.
  organizationDeparture: defineTable({
    userId: v.id('user'),
    organizationId: v.string(),
    webhookUpdatedAt: v.optional(v.number()),
    // Each removal after a rejoin starts a new round of trusted returns.
    round: v.number(),
    state: v.union(v.literal('returning'), v.literal('completed')),
    outcome: v.optional(organizationDepartureOutcomeValidator),
    // Characters left in place because their campaign keeps legacy authority.
    legacyRetained: v.optional(v.number()),
  })
    .index('by_userId_and_organizationId', ['userId', 'organizationId'])
    .index('by_userId_and_state', ['userId', 'state'])
    .index('by_organizationId_and_state', ['organizationId', 'state']),
  // #706: failed return steps of one Character in a departure's current round.
  // `failures` stops at the set-aside limit; a set-aside Character retries on
  // a slower schedule while the owner's others return.
  organizationDepartureCharacter: defineTable({
    departureId: v.id('organizationDeparture'),
    userId: v.id('user'),
    organizationId: v.string(),
    characterId: v.id('character'),
    failures: v.number(),
    lastFailure: v.string(),
    setAside: v.boolean(),
  })
    .index('by_departureId_and_characterId', ['departureId', 'characterId'])
    .index('by_userId_and_setAside', ['userId', 'setAside']),
  // #708: a deleted account, kept by its token so that no later provider
  // event can restore it. Its campaign Characters stay ownerless for
  // reassignment and its private Characters are deleted.
  accountDeletion: defineTable({
    tokenIdentifier: v.string(),
    state: v.union(v.literal('deleting'), v.literal('completed')),
    // Characters left with their owner because their campaign keeps legacy
    // authority (#413).
    legacyRetained: v.optional(v.number()),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),
  // #708: failed steps for one of a deleted account's Characters. `failures`
  // stops at the set-aside limit; a set-aside Character retries on a slower
  // schedule while the others go on.
  accountDeletionCharacter: defineTable({
    deletionId: v.id('accountDeletion'),
    characterId: v.id('character'),
    failures: v.number(),
    lastFailure: v.string(),
    setAside: v.boolean(),
  }).index('by_deletionId_and_characterId', ['deletionId', 'characterId']),
  // #710: a campaign's deletion. Once the campaign is deleted this row is its
  // tombstone: it keeps what read-only access to the campaign's history needs.
  campaignDeletion: defineTable({
    campaignId: v.id('campaign'),
    organizationId: v.string(),
    campaignName: v.string(),
    // Returned Characters keep naming their fixture campaign (#703).
    e2eFixture: campaignValidator.fields.e2eFixture,
    militiaId: v.optional(v.id('militia')),
    // Set when an organization's deletion deletes the campaign.
    organizationDeletionId: v.optional(v.id('organizationDeletion')),
    requestedBy: v.optional(v.string()),
    // Each request after a block starts a new round of returns.
    round: v.number(),
    state: campaignDeletionStateValidator,
    blockers: v.optional(deletionBlockersValidator),
    // The next live data table the purge clears.
    purgeStage: v.optional(v.number()),
    lastFailure: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index('by_campaignId', ['campaignId'])
    .index('by_organizationId_and_state', ['organizationId', 'state']),
  // #710: failed return steps of one Character in a campaign deletion's
  // current round, as for a departure.
  campaignDeletionCharacter: defineTable({
    deletionId: v.id('campaignDeletion'),
    characterId: v.id('character'),
    failures: v.number(),
    lastFailure: v.string(),
    setAside: v.boolean(),
  })
    .index('by_deletionId_and_characterId', ['deletionId', 'characterId'])
    .index('by_deletionId_and_setAside', ['deletionId', 'setAside']),
  // #710: an organization's deletion, requested in the app or made by the
  // provider. `deletedAt` records the provider's deletion, which revokes every
  // member's access at once and is final.
  organizationDeletion: defineTable({
    organizationId: v.string(),
    state: organizationDeletionStateValidator,
    requestedBy: v.optional(v.string()),
    round: v.number(),
    deletedAt: v.optional(v.number()),
    // The next page of memberships or campaigns a stage reads.
    cursor: v.optional(v.union(v.string(), v.null())),
    blockedCampaigns: v.optional(v.number()),
    // Campaigns kept intact for operator recovery, and those kept because
    // their campaign keeps legacy authority (#413).
    recoveryRetained: v.optional(v.number()),
    legacyRetained: v.optional(v.number()),
    lastFailure: v.optional(v.string()),
  }).index('by_organizationId', ['organizationId']),
});
