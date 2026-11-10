import {
  creationSettingsFor,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import {
  characterSheetClassFamily,
  formatGrantKeyId,
  type SelectionReference,
} from './character-sheet-grants';
import { definitionFor } from './character-sheet-proficiency-prerequisites';
import { generalFeatBudget } from './character-sheet-advancement';

export type SelectionSlot = {
  id: string;
  kind: 'feat' | 'trait';
  label: string;
  count: number;
  used: number;
  remaining: number;
  grantedBy?: SelectionReference;
  slotIndex?: number;
  featTypes?: string[];
  feats?: string[];
  ignoresPrerequisites?: boolean;
};
import { normalize } from './character-sheet-prerequisite-schema';

function grantedSlotLabel({
  name,
  kind,
  source,
}: {
  name: string | undefined;
  kind: SelectionSlot['kind'];
  source: SheetEntry;
}) {
  const noun = kind === 'feat' ? 'feats' : 'traits';
  const label = name
    ? new RegExp(`\\b${kind}s?\\b`, 'i').test(name)
      ? name
      : `${name} ${noun}`
    : `Bonus ${noun}`;
  const level = 'grantKey' in source ? source.grantKey?.classLevel : undefined;
  return level === undefined ? label : `${label} (level ${level})`;
}

export function remainingSlotMessage(slot: SelectionSlot) {
  const label = normalize(slot.label);
  const singular = label
    .replace(/\bfeats\b/g, 'feat')
    .replace(/\btraits\b/g, 'trait');
  const plural = /\bfeats\b/.test(label)
    ? label
    : label.replace(/\bfeat\b/, 'feats');
  return `${slot.remaining} ${slot.remaining === 1 ? singular : plural} ${slot.remaining === 1 ? 'remains' : 'remain'} to select.`;
}
export function selectionReferenceId(reference: SelectionReference) {
  return reference.kind === 'entry'
    ? reference.entryId
    : formatGrantKeyId(reference.grantKey);
}
export function selectionSourceFor(entry: SheetEntry) {
  return 'selectionSource' in entry && entry.selectionSource?.kind === 'slot'
    ? entry.selectionSource
    : entry.kind === 'feat' &&
        entry.state.slot &&
        entry.state.slot !== 'general'
      ? entry.state.slot
      : undefined;
}

export function resolveSelectionSlots(
  input: CharacterSheetInput,
  {
    hitDice: suppliedHitDice,
    generalFeats,
    isHitDiceUnresolved = false,
  }: {
    hitDice?: number;
    /** An explicit general feat budget overriding the HD formula. */
    generalFeats?: number;
    isHitDiceUnresolved?: boolean;
  } = {},
) {
  const base = input.entries.find((entry) => entry.kind === 'base');
  if (base?.kind !== 'base')
    throw new Error('A sheet requires one base-scores entry');
  const settings = creationSettingsFor(base);
  const race = input.entries.find(
    (entry) => entry.active && entry.kind === 'race',
  );
  const raceDefinition = race && definitionFor(race, input);
  const racialHitDice =
    raceDefinition?.detail?.kind === 'race'
      ? (raceDefinition.detail.racialHitDice ?? 0)
      : (input.racialHitDice?.count ?? 0);
  const hitDice =
    suppliedHitDice ??
    input.entries.filter((entry) => entry.active && entry.kind === 'classLevel')
      .length + racialHitDice;
  const feats = input.entries.filter(
    (entry) => entry.active && entry.kind === 'feat' && !entry.grantKey,
  );
  const traits = input.entries.filter(
    (entry) => entry.active && entry.kind === 'trait' && !entry.grantKey,
  );
  const drawbacks = traits.filter((entry) => {
    const detail = definitionFor(entry, input)?.detail;
    return detail?.kind === 'trait' && detail.traitType === 'drawback';
  });
  const ordinaryTraits = traits.filter((entry) => !drawbacks.includes(entry));
  const slots: SelectionSlot[] = [
    {
      id: 'feat:general',
      kind: 'feat',
      label: 'General feats',
      count: generalFeats ?? generalFeatBudget(hitDice),
      used: 0,
      remaining: 0,
    },
    {
      id: 'trait:general',
      kind: 'trait',
      label: 'Traits',
      count: settings.traitCount + Math.min(1, drawbacks.length),
      used: 0,
      remaining: 0,
    },
    {
      id: 'trait:drawback',
      kind: 'trait',
      label: 'Drawback',
      count: 1,
      used: 0,
      remaining: 1,
    },
  ];
  if (isHitDiceUnresolved) {
    const generalFeatIndex = slots.findIndex(
      (slot) => slot.id === 'feat:general',
    );
    if (generalFeatIndex >= 0) slots.splice(generalFeatIndex, 1);
  }
  const classes = new Set<string>();
  for (const source of input.entries) {
    if (!source.active) continue;
    const definition = definitionFor(source, input);
    if (!definition) continue;
    if (source.kind === 'classLevel') {
      const family = characterSheetClassFamily(
        definition,
        input.catalogEntries,
      );
      if (classes.has(family)) continue;
      classes.add(family);
    }
    for (const [slotIndex, slot] of (definition.grantsSlots ?? []).entries()) {
      if (slot.count <= 0) continue;
      slots.push({
        ...slot,
        featTypes: slot.featTypes ? [...slot.featTypes] : undefined,
        feats: slot.feats ? [...slot.feats] : undefined,
        id: `${slot.kind}:${source._id}:${slotIndex}`,
        label: grantedSlotLabel({
          name: definition.name,
          kind: slot.kind,
          source,
        }),
        used: 0,
        remaining: 0,
        grantedBy:
          'grantKey' in source && source.grantKey
            ? { kind: 'grant', grantKey: source.grantKey }
            : { kind: 'entry', entryId: source._id },
        slotIndex,
      });
    }
  }
  return {
    base,
    settings,
    hitDice,
    feats,
    traits,
    drawbacks,
    ordinaryTraits,
    slots,
  };
}
