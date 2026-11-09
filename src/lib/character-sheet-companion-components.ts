import { z } from 'zod';
import {
  eidolonBaseStatistics,
  type EidolonBaseStatisticsRow,
} from './catalog/representative-eidolons';
import { representativeCompanionRules } from './catalog/representative-companion-rules';
import {
  creatureSizes,
  type CreatureSize,
} from './character-sheet-creature-sizes';

// Component allocation (#419): one undivided table row whose separate
// components are divided among the associated Character's companions after
// the lookup. Unlike effective-level allocation (#410), a companion's share
// is not a level: its Hit Dice, feats, ranks and pool are recorded outputs,
// and the undivided statistics still come from the whole row.

export const companionComponentKeys = [
  'hitDice',
  'skillRanks',
  'feats',
  'armorBonus',
  'strengthBonus',
  'dexterityBonus',
  'evolutionPoints',
  'maxAttacks',
] as const;
export type CompanionComponentKey = (typeof companionComponentKeys)[number];
export const companionComponentLabels: Record<CompanionComponentKey, string> = {
  hitDice: 'Hit Dice',
  skillRanks: 'skill ranks',
  feats: 'feats',
  armorBonus: 'armor bonus',
  strengthBonus: 'Strength bonus',
  dexterityBonus: 'Dexterity bonus',
  evolutionPoints: 'evolution points',
  maxAttacks: 'maximum natural attacks',
};
/** Whole recorded values; a 20th-level table row's largest is 80 ranks. */
export const maxCompanionComponentValue = 99;
const componentValue = z.number().int().min(0).max(maxCompanionComponentValue);
export const companionComponentsSchema = z.object({
  hitDice: componentValue,
  skillRanks: componentValue,
  feats: componentValue,
  armorBonus: componentValue,
  strengthBonus: componentValue,
  dexterityBonus: componentValue,
  evolutionPoints: componentValue,
  maxAttacks: componentValue,
});
export type CompanionComponents = z.infer<typeof companionComponentsSchema>;
/** One companion's recorded shares; a missing one is unresolved, never 0. */
export const companionAllocatedComponentsSchema =
  companionComponentsSchema.partial();
export type CompanionAllocatedComponents = z.infer<
  typeof companionAllocatedComponentsSchema
>;

export const companionComponentRuleKinds = ['broodmasterEidolon'] as const;
export type CompanionComponentRuleKind =
  (typeof companionComponentRuleKinds)[number];
export function isCompanionComponentRuleKind(
  value: unknown,
): value is CompanionComponentRuleKind {
  return companionComponentRuleKinds.some((kind) => kind === value);
}
export function getCompanionComponentRule(
  ruleKind: CompanionComponentRuleKind,
) {
  const rule = representativeCompanionRules[ruleKind].componentAllocation;
  if (!rule) throw new Error(`Missing component rule for ${ruleKind}`);
  return rule;
}

export const companionGroupPurchaseKeys = ['large', 'huge'] as const;
export type CompanionGroupPurchaseKey =
  (typeof companionGroupPurchaseKeys)[number];
export const companionGroupPurchasesSchema = z
  .array(z.enum(companionGroupPurchaseKeys))
  .max(companionGroupPurchaseKeys.length)
  .refine((purchases) => new Set(purchases).size === purchases.length, {
    message: 'Record each group purchase once.',
  });
/** The group purchases recorded on the budget owner's sheet, by budget. */
export const companionGroupPurchaseRecordsSchema = z
  .array(
    z.object({
      ruleKind: z.enum(companionComponentRuleKinds),
      purchases: companionGroupPurchasesSchema,
    }),
  )
  .max(companionComponentRuleKinds.length)
  .refine(
    (records) =>
      new Set(records.map(({ ruleKind }) => ruleKind)).size === records.length,
    { message: 'Record each budget’s group purchases once.' },
  );
export type CompanionGroupPurchaseRecords = z.infer<
  typeof companionGroupPurchaseRecordsSchema
>;
export function readGroupPurchases(
  records: CompanionGroupPurchaseRecords | undefined,
  ruleKind: CompanionComponentRuleKind,
) {
  return records?.find((record) => record.ruleKind === ruleKind)?.purchases;
}

/** Sibling totals and group purchases, disclosed only with access. */
export const companionComponentPoolSchema = z.object({
  allocated: companionComponentsSchema,
  companions: z.number(),
  groupPurchases: companionGroupPurchasesSchema,
});

export const companionGroupPurchaseSchema = z.object({
  key: z.enum(companionGroupPurchaseKeys),
  label: z.string(),
  cost: z.number(),
  minimumLevel: z.number(),
  issues: z.array(z.string()),
});
export type CompanionGroupPurchase = z.infer<
  typeof companionGroupPurchaseSchema
>;

/** Each recorded group purchase with its cost and advisory issues. */
export function resolveGroupPurchases({
  ruleKind,
  purchases,
  level,
}: {
  ruleKind: CompanionComponentRuleKind;
  purchases: readonly CompanionGroupPurchaseKey[];
  level: number | null;
}): CompanionGroupPurchase[] {
  const rule = getCompanionComponentRule(ruleKind);
  return companionGroupPurchaseKeys.flatMap((key) => {
    const purchase = rule.groupPurchases[key];
    if (!purchase || !purchases.includes(key)) return [];
    const required = purchase.requires;
    return [
      {
        key,
        label: purchase.label,
        cost: purchase.cost,
        minimumLevel: purchase.minimumLevel,
        issues: [
          ...(level !== null && level < purchase.minimumLevel
            ? [`Requires summoner level ${purchase.minimumLevel}.`]
            : []),
          ...(required && !purchases.some((recorded) => recorded === required)
            ? [`Requires the ${required} evolution for the brood.`]
            : []),
        ],
      },
    ];
  });
}

/**
 * APG Table 2–9, Skills: "6 + its Intelligence modifier per HD", at least 1
 * per HD as an ordinary creature's ranks are.
 */
export function eidolonSkillRanksPerHitDie(intelligenceModifier: number) {
  return Math.max(1, 6 + intelligenceModifier);
}
/** The Int 7 modifier of every base form, which the Skills column assumes. */
export const eidolonBaseIntelligenceModifier = -2;
/** The table's Skills column per HD: 4 at the base forms' Int 7. */
export const eidolonTableSkillRanksPerHitDie = eidolonSkillRanksPerHitDie(
  eidolonBaseIntelligenceModifier,
);

function tableRow(level: number | null): EidolonBaseStatisticsRow | undefined {
  if (level === null || !Number.isInteger(level) || level <= 0)
    return undefined;
  return eidolonBaseStatistics[level - 1];
}

/**
 * The whole brood's components at this summoner level: APG Table 2–9's row,
 * with every recorded group purchase paid from the evolution pool first
 * (UM p. 78, Larger Brood). The divided rank budget is the Skills column
 * at the base forms' Int; each eidolon's own Int adjusts its share.
 */
export function resolveComponentBudget({
  ruleKind,
  level,
  purchases,
}: {
  ruleKind: CompanionComponentRuleKind;
  level: number | null;
  purchases: readonly CompanionGroupPurchaseKey[];
}): CompanionComponents | null {
  const row = tableRow(level);
  if (!row) return null;
  const spent = resolveGroupPurchases({ ruleKind, purchases, level }).reduce(
    (sum, purchase) => sum + purchase.cost,
    0,
  );
  return {
    hitDice: row.hitDice,
    skillRanks: row.hitDice * eidolonTableSkillRanksPerHitDie,
    feats: row.feats,
    armorBonus: row.armorBonus,
    strengthBonus: row.strengthDexterity,
    dexterityBonus: row.strengthDexterity,
    evolutionPoints: row.evolutionPool - spent,
    maxAttacks: row.maxAttacks,
  };
}

/** The recorded shares, complete or with the components still missing. */
export function completeComponents(
  recorded: CompanionAllocatedComponents | undefined,
) {
  const missing = companionComponentKeys.filter(
    (key) => recorded?.[key] === undefined,
  );
  const parsed = companionComponentsSchema.safeParse(recorded);
  return {
    components: missing.length === 0 && parsed.success ? parsed.data : null,
    missing,
  };
}

/** One value per component, in the components' order. */
export function mapComponents<T>(
  value: (key: CompanionComponentKey) => T,
): Record<CompanionComponentKey, T> {
  return {
    hitDice: value('hitDice'),
    skillRanks: value('skillRanks'),
    feats: value('feats'),
    armorBonus: value('armorBonus'),
    strengthBonus: value('strengthBonus'),
    dexterityBonus: value('dexterityBonus'),
    evolutionPoints: value('evolutionPoints'),
    maxAttacks: value('maxAttacks'),
  };
}

/** Whether two recorded shares hold the same components. */
export function sameComponents(
  before: CompanionAllocatedComponents | null | undefined,
  after: CompanionAllocatedComponents | null | undefined,
) {
  return companionComponentKeys.every((key) => before?.[key] === after?.[key]);
}

export function sumComponents(
  list: readonly CompanionAllocatedComponents[],
): CompanionComponents {
  return mapComponents((key) =>
    list.reduce((sum, item) => sum + (item[key] ?? 0), 0),
  );
}

export function overBudgetComponents(
  allocated: CompanionComponents,
  budget: CompanionComponents | null,
) {
  return budget
    ? companionComponentKeys.filter((key) => allocated[key] > budget[key])
    : [];
}

const smallIndex = creatureSizes.indexOf('small');
/**
 * UM p. 78, Eidolon Brood and Larger Brood: two Small eidolons; the brood's
 * large evolution allows two Medium (or four Small), its huge evolution two
 * Large, "in which two smaller eidolons count as one eidolon of one size
 * larger". Places are counted in Small eidolons.
 */
export function broodSizePlaces(size: CreatureSize) {
  return 2 ** (creatureSizes.indexOf(size) - smallIndex);
}
export function broodCapacity(purchases: readonly CompanionGroupPurchaseKey[]) {
  return 2 * broodSizePlaces(largestBroodSize(purchases));
}
export function largestBroodSize(
  purchases: readonly CompanionGroupPurchaseKey[],
): CreatureSize {
  if (!purchases.includes('large')) return 'small';
  return purchases.includes('huge') ? 'large' : 'medium';
}
