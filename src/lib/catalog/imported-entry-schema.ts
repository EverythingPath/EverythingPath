import {
  importedWeaponSchema,
  legacyImportedWeaponSchema,
} from './imported-item.ts';
import {
  alignmentSchema,
  prerequisiteSchema,
} from '../character-sheet-prerequisite-schema.ts';
import { z } from 'zod';
import { abilitySchema, outputSchema } from './curation-output-schema.ts';
import { manualProficiencySchema } from '../character-sheet-proficiency-schema.ts';
import { creatureSizes } from '../character-sheet-creature-sizes.ts';
import {
  classCastingAdvancesSchema,
  classFeatureSpellcastingSchema,
} from '../character-sheet-casting-tables.ts';
import { archetypeCastingChangeSchema } from '../character-sheet-archetype-casting.ts';

/**
 * A stable catalog key: a Foundry record (`pf1/<id>`, `pf1-content/<id>`) or a
 * #716 identity, `everythingpath/<id>` with a lowercase hyphenated id such as
 * `everythingpath/ranger-beast-master`. Never a source path or URL.
 */
export const catalogKeySchema = z
  .string()
  .regex(
    /^(?:(?:pf1|pf1-content)\/[A-Za-z0-9]+|everythingpath\/[a-z0-9]+(?:-[a-z0-9]+)*)$/,
  );

const progression = {
  hitDie: z.number(),
  bab: z.enum(['full', 'threeQuarters', 'half']),
  saves: z.object({
    fort: z.enum(['good', 'poor']),
    ref: z.enum(['good', 'poor']),
    will: z.enum(['good', 'poor']),
  }),
  classSkills: z.array(z.string()),
};
const companion = {
  abilities: z.record(z.string(), z.number()),
  size: z.string().optional(),
  creatureTypes: z.array(z.string()),
};
const companionFeature = { tag: z.string(), associations: z.array(z.string()) };
// #305/#716 P5: a class's choices per level, such as bonus feats or talents.
const picksByLevel = z.array(
  z.object({ classLevel: z.number(), list: z.string(), count: z.number() }),
);
/** A class feature row by class level and stable key. */
const featureRow = z.object({
  classLevel: z.number().int().min(1).max(20),
  externalKey: z.string(),
});
/**
 * #716 P5: an archetype's #305 structure by stable keys. Rows name the base
 * class's `featuresByLevel` rows; a `part` change names its row's class level.
 * Casting follows #422 without spell references, which need their own review.
 */
export const importedArchetypeDetailSchema = z.object({
  kind: z.literal('archetype'),
  classKeys: z.array(z.string()).min(1),
  replaces: z.array(featureRow.extend({ scope: z.enum(['whole', 'part']) })),
  adds: z.array(featureRow),
  featureChanges: z
    .array(
      z.discriminatedUnion('scope', [
        z.object({ externalKey: z.string(), scope: z.literal('whole') }),
        featureRow.extend({ scope: z.literal('part') }),
      ]),
    )
    .optional(),
  classSkillsAdded: z.array(z.string()).optional(),
  classSkillsRemoved: z.array(z.string()).optional(),
  skillRanksPerLevel: z.number().optional(),
  casting: archetypeCastingChangeSchema
    .omit({ spellList: true, grantedSpells: true })
    .extend({
      spellList: z.object({ classTag: z.string() }).optional(),
    })
    .optional(),
});

const importedGrantedSpellsSchema = z
  .array(
    z.strictObject({
      spellLevel: z.number().int().min(1).max(9),
      spellKey: catalogKeySchema,
    }),
  )
  .min(1);
/**
 * Granted-levels S1: an imported class feature's casting facts, one of three
 * routes the reviewed map writes (`scripts/catalog/granted-spells.ts`). Granted
 * Spells name Spells by spell key (a stable catalog key), which the Catalog
 * Release resolves to Spell Catalog Entry IDs (`candidateDefinition`).
 * - A domain grants its Spells slot-style with the domain slot.
 * - A bloodline grants them schedule-style, by its class levels.
 * - A prompt-owning feature whose text grants its options' powers only names
 *   the kind it chooses with `optionGrantsSpells: false` (PRD #251 D10).
 */
export const importedClassFeatureSpellcastingSchema = z.union([
  z.strictObject({
    optionKind: z.literal('domain'),
    extraSlot: z.literal('domain'),
    grantedSpells: z.strictObject({
      style: z.literal('slot'),
      spells: importedGrantedSpellsSchema,
    }),
  }),
  z.strictObject({
    optionKind: z.literal('bloodline'),
    grantedSpells: z.strictObject({
      style: z.literal('schedule'),
      schedule: classFeatureSpellcastingSchema.shape.grantedSpells
        .unwrap()
        .shape.schedule.unwrap()
        .min(1),
      spells: importedGrantedSpellsSchema,
    }),
  }),
  z.strictObject({
    chooses: z.literal('domain'),
    optionGrantsSpells: z.literal(false),
  }),
]);
export type ImportedClassFeatureSpellcasting = z.infer<
  typeof importedClassFeatureSpellcastingSchema
>;

export const importedSpellDetailSchema = z.object({
  kind: z.literal('spell'),
  levels: z.record(z.string(), z.number()),
  grantedLevels: z.record(z.string(), z.record(z.string(), z.number())),
  school: z.string(),
  subschools: z.array(z.string()),
  descriptors: z.array(z.string()),
});

// These are the importer's release bodies. Prepared, character-scoped catalog
// entries use database IDs and a narrower detail contract instead.
export const importedDetailSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('race'),
    racialHitDice: z.number(),
    creatureTypes: z.array(z.string()),
    creatureSubtypes: z.array(z.string()),
    // #719: stable keys of the standard Racial Traits the race grants.
    racialTraits: z.array(z.string()).optional(),
    // #720: the race's size; the resolver derives the size modifiers.
    size: z.enum(creatureSizes).optional(),
  }),
  z.object({
    kind: z.literal('class'),
    ...progression,
    tag: z.string(),
    classKind: z.enum(['base', 'prestige', 'npc']),
    alignments: z.array(alignmentSchema).optional(),
    skillRanksPerLevel: z.number(),
    featuresByLevel: z.array(
      z.object({ classLevel: z.number(), externalKey: z.string() }),
    ),
    // #415/#716: a prestige class's "+1 level of existing class" per level.
    castingAdvances: classCastingAdvancesSchema.optional(),
    picksByLevel: picksByLevel.optional(),
    casting: z
      .object({
        ability: z.string().optional(),
        spellKind: z.string().optional(),
        casterLevelOffset: z.number().optional(),
        type: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('creatureType'),
    ...progression,
    tag: z.string(),
    skillRanksPerHitDie: z.number(),
  }),
  // #305/#716 P5: an increment's durable parent and part, the stable key of
  // the feature it upgrades, and its choices.
  z.object({
    kind: z.literal('classFeature'),
    parentFeature: z.string().optional(),
    part: z.string().optional(),
    duplicateUpgrade: z.string().optional(),
    picksByLevel: picksByLevel.optional(),
    // Granted-levels S1: Granted Spells by spell key, option kind and slot.
    spellcasting: importedClassFeatureSpellcastingSchema.optional(),
  }),
  importedArchetypeDetailSchema,
  z.object({ kind: z.literal('manual') }),
  z.object({
    kind: z.literal('feat'),
    featTypes: z.array(z.string()),
    repeatable: z.enum(['no', 'newChoice', 'yes', 'unreviewed']),
    additionalTraits: z.literal(true).optional(),
  }),
  z.object({ kind: z.literal('trait'), traitType: z.string() }),
  z.object({
    kind: z.literal('racialTrait'),
    abilityChoiceCount: z.literal(2).optional(),
    size: z.enum(creatureSizes).optional(),
    bonusSkillRanksPerLevel: z.number(),
    // #719: owning races from the trait's folder, standard or alternate, and
    // the same race's standard traits an alternate replaces (stable keys).
    raceKeys: z.array(z.string()).optional(),
    standard: z.boolean().optional(),
    replaces: z.array(z.string()).optional(),
    unresolvedReplacements: z.array(z.string()).optional(),
    favoredClassCount: z.literal(2).optional(),
  }),
  importedSpellDetailSchema,
  z.object({
    kind: z.literal('spellEffect'),
    defaultCasterLevel: z.number(),
    lastsOverOneDay: z.boolean(),
    spellKey: z.string().optional(),
  }),
  z.strictObject({
    kind: z.literal('item'),
    consumable: z.boolean(),
    price: z.number(),
    weight: z.number(),
    ammunition: z.boolean().optional(),
    baseItemKey: catalogKeySchema.optional(),
    weapon: z
      .union([importedWeaponSchema, legacyImportedWeaponSchema])
      .optional(),
    armor: z
      .strictObject({
        slot: z.enum(['armor', 'shield']),
        category: z.string(),
        bonus: z.number(),
        maxDex: z.number().nullable(),
        armorCheckPenalty: z.number().nonnegative(),
        asf: z.number(),
      })
      .optional(),
    magic: z
      .strictObject({
        enhancement: z.number().int().nonnegative(),
        masterwork: z.boolean(),
      })
      .optional(),
  }),
  abilitySchema.omit({ sourceKey: true }).extend({
    kind: z.literal('itemAbility'),
    appliesTo: z.string().nullable(),
  }),
  z.object({ kind: z.literal('companionFeature'), ...companionFeature }),
  z.object({ kind: z.literal('companion'), ...companion }),
  z.object({ kind: z.literal('familiar'), ...companion }),
  z.object({ kind: z.literal('eidolonForm'), ...companion }),
  z.object({ kind: z.literal('eidolonEvolution'), ...companionFeature }),
]);

// A relative path whose segments are plain names, so it can't leave its root.
const relativePath = (extension: string) =>
  z
    .string()
    .regex(
      new RegExp(
        `^(?:[A-Za-z0-9_-]+\\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\\.${extension}$`,
      ),
    );

/** A PCGen record: its list file under `pcgenPin.directory` and its KEY. KEY is stable; the line is only reported. */
const pcgenLocatorSchema = z.strictObject({
  file: relativePath('lst'),
  line: z.number().int().positive(),
  key: z.string().min(1),
});
/** A section of a captured PRD page, by its path in the capture and its element id. */
const prdLocatorSchema = z.strictObject({
  path: relativePath('html'),
  id: z.string().min(1),
});
/** A Curation Overlay record, by the identity of its binding. */
const overlayLocatorSchema = z.strictObject({
  externalKey: catalogKeySchema,
  kind: z.string().min(1),
  target: z.string().min(1),
});
const pcgenSourceSchema = z.strictObject({
  source: z.literal('pcgen'),
  locator: pcgenLocatorSchema,
});
const prdSourceSchema = z.strictObject({
  source: z.literal('prd'),
  locator: prdLocatorSchema,
});
/** Where an upstream record of a #716 entry comes from. */
export const upstreamSourceSchema = z.discriminatedUnion('source', [
  pcgenSourceSchema,
  prdSourceSchema,
]);
/** The upstream key of a #716 record: `pcgen:<file>#<KEY>` or `prd:<path>#<id>`. */
export function upstreamKeyOf(
  source: z.infer<typeof upstreamSourceSchema>,
): string {
  return source.source === 'pcgen'
    ? `pcgen:${source.locator.file}#${source.locator.key}`
    : `prd:${source.locator.path}#${source.locator.id}`;
}
/** Where one field of a #716 entry comes from (plan §2, §5). */
export const fieldProvenanceSchema = z.discriminatedUnion('source', [
  pcgenSourceSchema,
  prdSourceSchema,
  z.strictObject({
    source: z.literal('overlay'),
    locator: overlayLocatorSchema,
  }),
]);

export const importedCatalogEntrySchema = z.object({
  externalKey: z.string().min(1),
  upstreamKey: z.string().min(1),
  pack: z.string().min(1),
  name: z.string().min(1),
  detail: importedDetailSchema,
  description: z.string(),
  guidanceText: z.string().optional(),
  prerequisiteText: z.string().optional(),
  prerequisites: z.array(prerequisiteSchema).optional(),
  grantsSlots: z
    .array(
      z.object({
        kind: z.enum(['feat', 'trait']),
        count: z.number(),
        // Stable keys of the only feats the slot accepts.
        feats: z.array(z.string()).optional(),
        // S3: the feat types (Foundry tags) a reviewed schedule's slot names.
        featTypes: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  // #719: race identities (stable keys) this entry counts as.
  countsAsRaces: z.array(z.string()).optional(),
  proficiencies: z.array(manualProficiencySchema).optional(),
  sources: z.array(
    z.object({ book: z.string(), pages: z.string().optional() }),
  ),
  // Release bodies, before the character-scoped resolver assigns leaf targets.
  // Imported targets are runtime targets (#720); this schema stays open.
  modifiers: z.array(
    outputSchema.options[0].omit({ kind: true }).extend({
      target: z.string().min(1),
      bonusType: z.string().min(1),
    }),
  ),
  situationalNotes: z
    .array(outputSchema.options[1].omit({ kind: true }))
    .optional(),
  sourceKey: z.string().optional(),
  // #721: the entry whose Attribution Assessment this one takes.
  attributionFrom: z.string().optional(),
  unsupported: z.array(
    z.object({
      field: z.string(),
      reason: z.string(),
      value: z.any().optional(),
    }),
  ),
  // #716: the source of each field of an `everythingpath/` entry.
  // Keys are field paths such as `description` or `detail.parentFeature`.
  provenance: z
    .record(
      z.string().regex(/^[a-z][A-Za-z]*(?:\.[a-z][A-Za-z]*)*$/),
      fieldProvenanceSchema,
    )
    .optional(),
});

export const reviewedRemapSchema = z.object({
  from: catalogKeySchema,
  to: catalogKeySchema,
  kind: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.string().min(1),
  reviewedBy: z.string().min(1),
  reviewedOn: z.iso.date(),
});
export const appliedRemapSchema = reviewedRemapSchema.extend({
  applied: z.literal(true),
});
