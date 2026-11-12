import {
  armorCategory,
  armorCategoryLabels,
} from '~/lib/character-sheet-armor-categories';
import { builtIn, type ResolvedStatistic } from '~/lib/character-sheet';
import type { ItemPart } from '~/lib/character-sheet-attack-types';
import { itemPartSubject } from '~/lib/character-sheet-items';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Equipment = ReturnType<typeof useCharacterSheet>['equipment'];
type Totals = NonNullable<Equipment['totals']>;
type Item = Totals['items'][number];

/** "Heavy armor", "Light shield": the item's category, or its slot. */
export function describeArmorCategory({
  slot,
  category,
}: {
  slot: 'armor' | 'shield';
  category?: string | null;
}) {
  const normalized = armorCategory(category);
  const label = normalized ? armorCategoryLabels[normalized] : undefined;
  return label ?? (slot === 'shield' ? 'Shield' : 'Armor');
}

/** A signed number with a true minus sign: "−6", "+2". */
export function formatSigned(value: number) {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

export function formatPercent(value: number) {
  return `${value}%`;
}

function explanationLine(item: Item, kind: string, value: number) {
  return builtIn({
    target: 'ac',
    id: `${item.entryId}:${kind}`,
    sheetEntryId: item.entryId,
    name: item.name,
    value,
  });
}

// The resolver's totals with each equipped item's own figure as a line, so
// the summary's numbers explain themselves like every other sheet number.
function listContributions(
  totals: Totals,
  kind: 'armorCheckPenalty' | 'spellFailure',
): ResolvedStatistic {
  return {
    total: totals[kind],
    applied: totals.items
      .filter((item) => item[kind] !== 0)
      .map((item) => explanationLine(item, kind, item[kind])),
    suppressed: [],
    conditional: [],
  };
}

export function describeArmorCheckPenalty(totals: Totals) {
  return listContributions(totals, 'armorCheckPenalty');
}

export function describeSpellFailure(totals: Totals) {
  return listContributions(totals, 'spellFailure');
}

/**
 * The lowest maximum applies; any higher one is listed as set aside by it.
 * Null when nothing equipped limits Dexterity.
 */
export function describeMaxDexterity(totals: Totals): ResolvedStatistic | null {
  const limit = totals.maxDexterityBonus;
  if (limit === null) return null;
  const capped = totals.items.filter((item) => item.maxDexterityBonus !== null);
  const winner = capped.find((item) => item.maxDexterityBonus === limit);
  return {
    total: limit,
    applied: winner ? [explanationLine(winner, 'maxDex', limit)] : [],
    suppressed: capped
      .filter((item) => item !== winner)
      .map((item) => ({
        ...explanationLine(item, 'maxDex', item.maxDexterityBonus ?? 0),
        reason: 'A lower maximum applies',
        suppressedBy: winner?.entryId ?? item.entryId,
      })),
    conditional: [],
  };
}

/**
 * "Not proficient: Full plate −6 to attacks" for an equipped item worn
 * without its Proficiency; null when it is proficient or carries no penalty.
 */
export function describeNonproficiency(item: Item | null) {
  if (!item || item.proficient || item.category === null) return null;
  if (item.armorCheckPenalty === 0) return null;
  return `Not proficient: ${item.name} ${formatSigned(item.armorCheckPenalty)} to attacks`;
}

type Row = Equipment['rows'][number];

/**
 * "Armor +9 · Enhancement +2 · Max Dex +1 · ACP −6 · Spell failure 35%":
 * the resolver's figures while the item counts, its recorded ones otherwise.
 */
export function listEquipmentFacts(row: Row) {
  const item = row.calculated;
  const slot = row.armor.slot === 'shield' ? 'Shield' : 'Armor';
  const bonus = item?.armorBonus ?? row.armor.bonus ?? 0;
  const enhancement = item?.enhancement ?? row.enhancement;
  const maxDexterity = item
    ? item.maxDexterityBonus
    : (row.armor.maxDex ?? null);
  const penalty = item?.armorCheckPenalty ?? -row.armor.armorCheckPenalty;
  const spellFailure = item?.spellFailure ?? row.armor.asf ?? 0;
  const isMasterwork = item?.masterwork ?? row.masterwork;
  const material = row.catalogMaterial ?? row.material;
  return [
    `${slot} ${formatSigned(bonus)}`,
    enhancement !== 0 ? `Enhancement ${formatSigned(enhancement)}` : null,
    maxDexterity !== null ? `Max Dex ${formatSigned(maxDexterity)}` : null,
    penalty !== 0 ? `ACP ${formatSigned(penalty)}` : null,
    spellFailure !== 0 ? `Spell failure ${formatPercent(spellFailure)}` : null,
    isMasterwork ? 'Masterwork' : null,
    material,
  ].filter((fact): fact is string => Boolean(fact));
}

/** The checks about an equipped item's own figures, shown on its row. */
const equipmentWarningChecks: readonly SheetWarningView['check'][] = [
  'armorCheckPenaltyUnresolved',
  'equipmentEnhancement',
  'itemBaseItemUnresolved',
  'itemAbilityUnavailable',
  'itemAbilityWithoutEnhancement',
  'itemBonusEquivalent',
  'itemDuplicateAbility',
  'itemAbilityAppliesTo',
];

export function listEquipmentWarnings(
  warnings: SheetWarningView[],
  entryId: string,
) {
  return warnings.filter(
    ({ check, target }) =>
      equipmentWarningChecks.includes(check) &&
      target.kind === 'entry' &&
      target.entryId === entryId,
  );
}

/**
 * The construction warnings about one part of an item (#408): the item
 * itself, a double weapon's other end or a shield's bash, each with its own
 * subject so an acceptance stays per end.
 */
export function listItemPartWarnings(
  warnings: SheetWarningView[],
  entryId: string,
  part: ItemPart,
) {
  const subject = itemPartSubject(entryId, part);
  return listEquipmentWarnings(warnings, entryId).filter(
    (warning) => warning.subject === subject,
  );
}
