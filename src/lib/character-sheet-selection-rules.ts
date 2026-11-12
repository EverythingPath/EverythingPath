import { resolveCharacterSheetGrants } from './character-sheet-grants';
import type {
  CharacterSheetInput,
  SheetEntry,
  SheetWarning,
} from './character-sheet';
import { definitionFor } from './character-sheet-proficiency-prerequisites';
import { normalize } from './character-sheet-prerequisite-schema';
import {
  resolveSelectionSlots,
  selectionSourceFor,
  remainingSlotMessage,
  selectionReferenceId,
} from './character-sheet-selection-slots';
export type { SelectionSlot } from './character-sheet-selection-slots';

type WarningInput = {
  check: SheetWarning['check'];
  entry: SheetEntry;
  subject: string;
  facts: unknown;
  message: string;
  kind?: SheetWarning['kind'];
};
type Warn = (warning: WarningInput) => void;
type SelectionContext = ReturnType<typeof resolveSelectionSlots> & {
  input: CharacterSheetInput;
  warn: Warn;
};
function warningCollector(warnings: SheetWarning[]) {
  return function warn({
    check,
    entry,
    subject,
    facts,
    message,
    kind = 'rules',
  }: WarningInput) {
    warnings.push({
      kind,
      check,
      target: { kind: 'entry', entryId: entry._id },
      subject,
      fingerprint: JSON.stringify(facts),
      message,
    });
  };
}
function applySlotSelections({
  input,
  slots,
  feats,
  traits,
  drawbacks,
  warn,
}: SelectionContext) {
  for (const entry of [...feats, ...traits]) {
    const source = selectionSourceFor(entry);
    const recordedSlot =
      'selectionSlot' in entry ? entry.selectionSlot : undefined;
    const chosenSlot = recordedSlot
      ? slots.find((slot) => slot.id === recordedSlot.id)
      : undefined;
    const slot =
      chosenSlot ??
      (source
        ? slots.find(
            (slot) =>
              slot.kind === entry.kind &&
              slot.grantedBy &&
              selectionReferenceId(slot.grantedBy) ===
                selectionReferenceId(source.grantedBy) &&
              slot.slotIndex === (source.slotIndex ?? 0),
          )
        : slots.find(
            (slot) =>
              slot.id ===
              (drawbacks.includes(entry)
                ? 'trait:drawback'
                : `${entry.kind}:general`),
          ));
    if (!slot) continue;
    slot.used += 1;
    if (recordedSlot && recordedSlot.position >= slot.count)
      warn({
        check: entry.kind === 'feat' ? 'featSlotBudget' : 'traitCount',
        entry,
        subject: entry._id,
        facts: [slot.count, recordedSlot.position],
        message: 'This selection occupies a slot beyond the current allowance.',
      });
    if (
      entry.kind === 'trait' &&
      drawbacks.includes(entry) !== (slot.id === 'trait:drawback')
    )
      warn({
        check: 'traitSlotType',
        entry,
        subject: entry._id,
        facts: [drawbacks.includes(entry), slot.id === 'trait:drawback'],
        message: drawbacks.includes(entry)
          ? 'A drawback normally fills the drawback slot.'
          : 'This slot normally holds a drawback.',
      });
    const definition = definitionFor(entry, input);
    if (!definition || entry.kind !== 'feat') continue;
    const types =
      definition.detail?.kind === 'feat'
        ? (definition.detail.featTypes ?? [])
        : [];
    const allowedIdentities = slot.feats?.map(
      (id) =>
        input.catalogEntries.find((row) => row._id === id)?.ruleIdentity ?? id,
    );
    const matchesType =
      !slot.featTypes?.length ||
      slot.featTypes.some((type) =>
        types.map(normalize).includes(normalize(type)),
      );
    const matchesIdentity =
      !allowedIdentities?.length ||
      allowedIdentities.includes(definition.ruleIdentity);
    if (!matchesType || !matchesIdentity)
      warn({
        check: 'featSlotType',
        entry,
        subject: entry._id,
        facts: [
          slot.featTypes?.map(normalize).sort(),
          allowedIdentities?.sort(),
          types.map(normalize).sort(),
          definition.ruleIdentity,
        ],
        message: `${definition.name ?? 'Feat'} does not match this bonus feat slot.`,
      });
  }
}
function applySlotBudgets({ slots, base, warn }: SelectionContext) {
  for (const slot of slots) {
    slot.remaining = slot.count - slot.used;
    if (slot.kind === 'feat' && slot.remaining !== 0)
      warn({
        check: 'featSlotBudget',
        entry: base,
        subject: slot.id,
        facts: [slot.count, slot.used],
        message:
          slot.remaining > 0
            ? remainingSlotMessage(slot)
            : `${slot.label} exceed the ${slot.count}-feat allowance.`,
        kind: slot.remaining > 0 ? 'incomplete' : 'rules',
      });
  }
}
function applyTraitRestrictions({
  input,
  traits,
  ordinaryTraits,
  drawbacks,
  settings,
  base,
  warn,
  traitBudget,
}: SelectionContext & { traitBudget: number }) {
  if (ordinaryTraits.length > traitBudget)
    warn({
      check: 'traitCount',
      entry: base,
      subject: 'traits',
      facts: [traitBudget, ordinaryTraits.length],
      message: `Traits exceed the ${traitBudget}-trait allowance.`,
    });
  if (drawbacks.length > 1)
    warn({
      check: 'drawbackCount',
      entry: base,
      subject: 'drawbacks',
      facts: drawbacks.length,
      message: 'Only one drawback grants an additional trait.',
    });
  const lists = new Map<string, SheetEntry[]>();
  for (const entry of traits) {
    const detail = definitionFor(entry, input)?.detail;
    if (
      detail?.kind !== 'trait' ||
      !detail.traitType ||
      detail.traitType === 'drawback'
    )
      continue;
    const list = normalize(detail.traitType);
    lists.set(list, [...(lists.get(list) ?? []), entry]);
  }
  for (const [list, entries] of lists) {
    if (entries.length < 2) continue;
    for (const entry of entries)
      warn({
        check: 'traitType',
        entry,
        subject: entry._id,
        facts: [list, entries.length],
        message: `Only one trait is normally selected from the ${list} list.`,
      });
  }
  if (settings.campaignTraitRequired && !lists.has('campaign'))
    warn({
      check: 'campaignTraitRequired',
      entry: base,
      subject: 'campaignTrait',
      facts: true,
      message: 'Choose a campaign trait.',
    });
  const additionalTraits = input.entries.some((entry) => {
    if (!entry.active || entry.kind !== 'feat') return false;
    const detail = definitionFor(entry, input)?.detail;
    return detail?.kind === 'feat' && detail.additionalTraits === true;
  });
  if (
    input.characterKind === 'npc' &&
    ordinaryTraits.length > 0 &&
    !additionalTraits
  )
    warn({
      check: 'npcTraits',
      entry: base,
      subject: 'npcTraits',
      facts: [input.characterKind, ordinaryTraits.length, additionalTraits],
      message: 'NPC traits require Additional Traits.',
    });
}
function applyClassAlignmentRules({ input, base, warn }: SelectionContext) {
  for (const entry of input.entries) {
    if (!entry.active || entry.kind !== 'classLevel' || !base.state.alignment)
      continue;
    const definition = definitionFor(entry, input);
    const detail = definition?.detail;
    if (
      detail?.kind !== 'class' ||
      !('alignments' in detail) ||
      !detail.alignments?.length
    )
      continue;
    if (
      detail.alignments.some(
        (alignment) =>
          normalize(alignment) === normalize(base.state.alignment ?? ''),
      )
    )
      continue;
    warn({
      check: 'classAlignment',
      entry,
      subject: entry._id,
      facts: [
        normalize(base.state.alignment),
        detail.alignments.map(normalize).sort(),
      ],
      message: `${definition?.name ?? 'Class'} normally requires ${detail.alignments.join(' or ')} alignment.`,
    });
  }
}
function applyDuplicateRules({ input, warn }: SelectionContext) {
  for (const kind of ['feat', 'trait'] as const) {
    const groups = new Map<string, SheetEntry[]>();
    for (const entry of input.entries.filter(
      (entry) => entry.active && entry.kind === kind,
    )) {
      const definition = definitionFor(entry, input);
      if (!definition) continue;
      const repeatable =
        definition.detail?.kind === 'feat'
          ? (definition.detail.repeatable ?? 'unreviewed')
          : 'no';
      if (repeatable === 'yes' || repeatable === 'unreviewed') continue;
      const choice =
        'choice' in entry.state ? normalize(entry.state.choice ?? '') : '';
      const key = JSON.stringify([
        definition.ruleIdentity,
        repeatable === 'newChoice' ? choice : '',
      ]);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    for (const [key, entries] of groups) {
      if (entries.length < 2) continue;
      for (const entry of entries.slice(1))
        warn({
          check: kind === 'feat' ? 'featDuplicate' : 'traitDuplicate',
          entry,
          subject: entry._id,
          facts: [key, entries.length],
          message: `${definitionFor(entry, input)?.name ?? 'Entry'} is selected more than once.`,
        });
    }
  }
}

export function resolveCharacterSheetSelectionRules(
  recordedInput: CharacterSheetInput,
  {
    grantsResolved = false,
    hitDice,
    generalFeats,
    isHitDiceUnresolved = false,
  }: {
    grantsResolved?: boolean;
    hitDice?: number;
    generalFeats?: number;
    isHitDiceUnresolved?: boolean;
  } = {},
) {
  const input = {
    ...recordedInput,
    entries: grantsResolved
      ? recordedInput.entries
      : resolveCharacterSheetGrants(recordedInput).countingEntries,
  };
  const slotsContext = resolveSelectionSlots(input, {
    hitDice,
    generalFeats,
    isHitDiceUnresolved,
  });
  const { slots } = slotsContext;
  const warnings: SheetWarning[] = [];
  const context = { ...slotsContext, input, warn: warningCollector(warnings) };
  applySlotSelections(context);
  applySlotBudgets(context);
  const traitBudget = slots
    .filter((slot) => slot.kind === 'trait' && slot.id !== 'trait:drawback')
    .reduce((sum, slot) => sum + slot.count, 0);
  applyTraitRestrictions({ ...context, traitBudget });
  applyClassAlignmentRules(context);
  applyDuplicateRules(context);
  return {
    slots,
    budgets: {
      generalFeats: isHitDiceUnresolved
        ? null
        : (slots.find((slot) => slot.id === 'feat:general')?.count ?? 0),
      bonusFeats: slots
        .filter((slot) => slot.kind === 'feat' && slot.grantedBy)
        .reduce((sum, slot) => sum + slot.count, 0),
      traits: traitBudget,
      drawbacks: 1,
    },
    warnings,
  };
}
