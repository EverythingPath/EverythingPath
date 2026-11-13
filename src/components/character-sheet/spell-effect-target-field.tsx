'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId, useState } from 'react';
import { useBreakpoint } from '~/components/use-breakpoint';
import { cn } from '~/lib/utils';
import { InlineWarnings } from './inline-warning';
import type { SaveStatus } from './save-status';
import { fieldLabel } from './sheet-parts';
import {
  isSameTargetChoice,
  toTargetChoice,
  type TargetChoice,
} from './spell-effect-target-choice';
import { SpellEffectTargetSelect } from './spell-effect-target-select';
import { SpellEffectTargetSheet } from './spell-effect-target-sheet';
import {
  describeTarget,
  missingText,
  unavailableText,
  type SpellEffectTargetView,
} from './spell-effect-target-text';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * A Spell Effect's Target (#416): the item part or unarmed strike it
 * enhances, chosen from every part on the sheet with the ones the rules
 * expect first and the rest under "Other items", all selectable since the
 * rules check is advisory. Saves at once. Empty, the field wears the blue
 * missing-choice outline and says what it waits for; a target that left the
 * sheet reads "No longer on the sheet", and the sheet's advisories about the
 * target, with Accept, sit beneath the field. A refusal reads beside it.
 * A select from 768px, a bottom sheet on the phone.
 */
export function SpellEffectTargetField({
  entryId,
  name,
  target,
  isDisabled,
  status,
  warnings,
  warningController,
  setTarget,
}: {
  entryId: Id<'characterSheetEntry'>;
  name: string;
  target: SpellEffectTargetView;
  isDisabled: boolean;
  /** The Sheet entries' save status; a refusal of this field reads beside it. */
  status: SaveStatus;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  setTarget: Controller['sheetEntries']['setTarget'];
}) {
  const isWide = useBreakpoint('wide');
  const id = useId();
  const missingId = `${id}-missing`;
  const errorId = `${id}-error`;
  const warningsId = `${id}-warnings`;
  // Only this field's own refusal reads beside it: another write of the
  // block starts a new save and takes the outcome with it.
  const [ownWrite, setOwnWrite] = useState<'none' | 'pending' | 'done'>('none');
  if (ownWrite === 'done' && status.kind === 'saving') setOwnWrite('none');
  const error =
    ownWrite === 'done' && status.kind === 'error' ? status.message : null;

  const isMissing = target.status === 'missing' && !isDisabled;
  const suitable = target.options.filter((option) => option.suitable);
  const unsuitable = target.options.filter((option) => !option.suitable);
  const value = toTargetChoice(target.onItem);
  const describedBy =
    cn(
      isMissing && missingId,
      error && errorId,
      warnings.length > 0 && warningsId,
    ) || undefined;

  async function choose(next: TargetChoice) {
    if (isDisabled || isSameTargetChoice(next, value)) return;
    setOwnWrite('pending');
    await setTarget(
      entryId,
      next.kind === 'part' ? { entry: next.entry, end: next.end } : null,
    );
    setOwnWrite('done');
  }

  return (
    <div className="mt-2 flex max-w-72 flex-col gap-1">
      <span aria-hidden className={fieldLabel}>
        Target
      </span>
      {isWide ? (
        <SpellEffectTargetSelect
          value={value}
          isMissing={isMissing}
          isPlaceholder={target.status === 'missing'}
          isDisabled={isDisabled}
          describedBy={describedBy}
          suitable={suitable}
          unsuitable={unsuitable}
          unavailableText={
            target.status === 'unavailable' ? unavailableText : null
          }
          onChoose={(next) => void choose(next)}
        />
      ) : (
        <SpellEffectTargetSheet
          name={name}
          display={describeTarget(target)}
          value={value}
          isMissing={isMissing}
          isDisabled={isDisabled}
          describedBy={describedBy}
          suitable={suitable}
          unsuitable={unsuitable}
          onChoose={(next) => void choose(next)}
        />
      )}
      {isMissing ? (
        <p id={missingId} className="text-xs text-sky-300">
          {missingText[target.itemTarget]}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-destructive text-xs [overflow-wrap:anywhere]"
        >
          {error}
        </p>
      ) : null}
      <InlineWarnings
        id={warningsId}
        warnings={warnings}
        controller={warningController}
      />
    </div>
  );
}
