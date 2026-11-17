'use client';
import { useId, type ReactNode } from 'react';
import { Form } from '~/components/ui/form';
import { AttackFieldFeedback } from './attack-field-feedback';
import type { EquipmentValues } from './equipment-form-schema';
import { ItemPartEnhancementField } from './item-part-enhancement-field';
import {
  ItemPartMaterialField,
  type MaterialMode,
} from './item-part-material-field';
import { ItemPartMasterworkField } from './item-part-masterwork-field';
import { RemoteNotice } from './sheet-parts';
import { useAttackWeaponEndForm } from './use-attack-routine-form';

type Field = 'masterwork' | 'enhancement' | 'material';

const hint = 'text-muted-foreground text-xs';

/**
 * One part of a Gear item (#306, #408): its enhancement, masterwork and
 * material, each saved at once with its acknowledgement beside it, with the
 * part's Item Abilities and warnings beneath them. The same editor serves a
 * weapon end or ammunition in the routine panel and a part section in the
 * Gear panel.
 */
export function ItemPartEditor({
  subject,
  legend,
  hint: hintText,
  value,
  save,
  operationId,
  isReadOnly,
  describedBy,
  isMasterworkImplied,
  material,
  hasStepper = false,
  children,
}: {
  /** Names the group and completes "Try again saving … for <subject>". */
  subject: string;
  legend: ReactNode;
  /** Words under the legend, such as what a shield bash's details are. */
  hint?: string;
  value: EquipmentValues;
  save: (patch: EquipmentValues) => Promise<unknown>;
  operationId?: string | null;
  isReadOnly: boolean;
  describedBy?: string;
  isMasterworkImplied: boolean;
  material: MaterialMode;
  /** Decrease and Increase beside the enhancement. */
  hasStepper?: boolean;
  children?: ReactNode;
}) {
  const fieldId = useId();
  const editor = useAttackWeaponEndForm({ value, save, operationId });
  const { form } = editor;
  const isDirty = form.formState.isDirty;

  function feedback(field: Field) {
    return (
      <AttackFieldFeedback
        status={editor.statusFor(field)}
        label={`${field} for ${subject}`}
        isDisabled={isReadOnly}
        onRetry={() => void editor.retry(field)}
      />
    );
  }
  return (
    <Form {...form}>
      <fieldset aria-label={subject} className="min-w-0 space-y-1.5">
        <legend
          aria-hidden
          className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 pb-1"
        >
          {legend}
        </legend>
        {hintText ? <p className={hint}>{hintText}</p> : null}
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            isDirty
              ? 'Changed by another player. Your edits are kept.'
              : 'Changed by another player.'
          }
          subject={subject}
          onDismiss={editor.dismissRemoteChange}
        />
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <ItemPartEnhancementField
            editor={editor}
            fieldId={fieldId}
            isReadOnly={isReadOnly}
            describedBy={describedBy}
            hasStepper={hasStepper}
            feedback={feedback('enhancement')}
          />
          <ItemPartMasterworkField
            editor={editor}
            isReadOnly={isReadOnly}
            describedBy={describedBy}
            isImplied={isMasterworkImplied}
            feedback={feedback('masterwork')}
          />
          <ItemPartMaterialField
            editor={editor}
            fieldId={fieldId}
            isReadOnly={isReadOnly}
            describedBy={describedBy}
            material={material}
            feedback={feedback('material')}
          />
        </div>
        {children}
      </fieldset>
    </Form>
  );
}
