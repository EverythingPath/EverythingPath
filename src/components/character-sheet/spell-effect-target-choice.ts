import type { SpellEffectTargetChoice } from './use-character-sheet-entries';

/** The Target field's choice: no target, or an item part or the unarmed strike. */
export type TargetChoice =
  | { kind: 'none' }
  | ({ kind: 'part' } & SpellEffectTargetChoice);

/** One offered target, as the calculation lists it. */
export type TargetOption = SpellEffectTargetChoice & {
  name: string;
  active: boolean;
};

export const noTarget: TargetChoice = { kind: 'none' };

/** The choice a recorded target, or none, stands for. */
export function toTargetChoice(
  target: SpellEffectTargetChoice | null,
): TargetChoice {
  return target
    ? { kind: 'part', entry: target.entry, end: target.end }
    : noTarget;
}

export function isSameTargetChoice(a: TargetChoice, b: TargetChoice) {
  if (a.kind === 'none' || b.kind === 'none') return a.kind === b.kind;
  return a.entry === b.entry && a.end === b.end;
}

// A select or radio group takes string values: "none", or the part's entry
// and end joined by "|". Sheet entry ids and the unarmed strike never hold
// "|", so a part's value is never "none".
const noneValue = 'none';
const separator = '|';

/** The select's or radio group's value for a choice. */
export function encodeTargetChoice(choice: TargetChoice) {
  return choice.kind === 'none'
    ? noneValue
    : `${choice.entry}${separator}${choice.end ?? ''}`;
}

/** The choice a select or radio group value names, or null for no choice. */
export function decodeTargetChoice(value: string): TargetChoice | null {
  if (value === noneValue) return noTarget;
  const index = value.lastIndexOf(separator);
  if (index <= 0) return null;
  const entry = value.slice(0, index);
  const end = value.slice(index + 1);
  if (end === '') return { kind: 'part', entry, end: null };
  return end === 'otherEnd' || end === 'bash'
    ? { kind: 'part', entry, end }
    : null;
}
