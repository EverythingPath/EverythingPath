'use client';
import { useEffect, useId, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import type { EidolonProgressionState } from '~/lib/character-sheet-eidolon-progression';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import { CompanionProgressionAbilityFields } from './companion-progression-ability-fields';
import { CompanionProgressionHpField } from './companion-progression-hp-field';
import { CompanionProgressionRankFields } from './companion-progression-rank-fields';
import { EidolonArmorSplitField } from './eidolon-armor-split-field';
import { EidolonBaseFormField } from './eidolon-base-form-field';
import { EidolonClassSkillFields } from './eidolon-class-skill-fields';
import { EidolonSizeField } from './eidolon-size-field';
import { EidolonSubtypeChoiceFields } from './eidolon-subtype-choice-fields';
import { EidolonSubtypeField } from './eidolon-subtype-field';
import { EidolonVersionField } from './eidolon-version-field';
import type { SaveStatus } from './save-status';
import { action, SaveFeedback } from './sheet-parts';
import type { useCharacterCompanionProgression } from './use-character-companion-progression';
import {
  eidolonBaseSkills,
  eidolonProgressionInput,
  useEidolonProgressionForm,
} from './use-eidolon-progression-form';

type Catalogs = Pick<
  ReturnType<typeof useCharacterCompanionProgression>,
  'eidolonVersions' | 'eidolonBaseForms' | 'unchainedSubtypes'
>;

/**
 * The eidolon's recorded choices as one local form beneath the summary:
 * version, base form, the Unchained subtype with its choices, base size,
 * hit points (or explicitly none yet), skill ranks, ability increases,
 * additional class skills and the armor bonus split. Evolutions and Keep
 * are edited in place and written back unchanged, and a version or subtype
 * change keeps every other choice. Structural mistakes stop the save beside
 * their field; going over a budget does not. A failed save keeps the draft
 * and its reason here; Escape and Cancel close it without writing.
 */
export function EidolonProgressionEditor({
  choices,
  subtype,
  catalogs,
  isDisabled,
  status,
  reasonId,
  onSave,
  onClose,
}: {
  choices: EidolonProgressionState;
  /** The counting subtype, whose allowed base forms the cards mark. */
  subtype: EidolonProgressionView['ordinary']['subtype'];
  catalogs: Catalogs;
  isDisabled: boolean;
  status: SaveStatus;
  reasonId: string | undefined;
  onSave: (progression: EidolonProgressionState) => Promise<boolean>;
  onClose: () => void;
}) {
  const form = useEidolonProgressionForm(choices);
  const version = useWatch({ control: form.control, name: 'version' });
  const draftedSubtype = useWatch({ control: form.control, name: 'subtype' });
  const subtypeChoice =
    catalogs.unchainedSubtypes.find(({ value }) => value === draftedSubtype) ??
    null;
  const headingId = useId();
  const element = useRef<HTMLFormElement>(null);
  const isSaving = status.kind === 'saving';
  const isLocked = isDisabled || isSaving;
  const heading = 'Edit eidolon choices';

  // Opening moves focus into the form, to its first choice.
  useEffect(() => {
    element.current
      ?.querySelector<HTMLElement>('input:not([disabled]), button')
      ?.focus();
  }, []);

  return (
    <Form {...form}>
      <form
        ref={element}
        noValidate
        aria-labelledby={headingId}
        className="border-foreground/20 flex w-full flex-col gap-3 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isLocked) return;
          void form.handleSubmit((values) =>
            onSave(eidolonProgressionInput(values, choices)),
          )();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <h4 id={headingId} className="font-sans text-base">
          {heading}
        </h4>
        <EidolonVersionField
          form={form}
          versions={catalogs.eidolonVersions}
          disabled={isLocked}
          reasonId={reasonId}
        />
        <EidolonBaseFormField
          form={form}
          forms={catalogs.eidolonBaseForms}
          allowedForms={subtype?.baseFormNames ?? null}
          subtypeName={subtype?.name ?? null}
          disabled={isLocked}
          reasonId={reasonId}
        />
        {version === 'unchained' ? (
          <EidolonSubtypeField
            form={form}
            subtypes={catalogs.unchainedSubtypes}
            disabled={isLocked}
            reasonId={reasonId}
          />
        ) : null}
        {version === 'unchained' && subtypeChoice ? (
          <EidolonSubtypeChoiceFields
            form={form}
            subtype={subtypeChoice}
            disabled={isLocked}
            reasonId={reasonId}
          />
        ) : null}
        <EidolonSizeField form={form} disabled={isLocked} />
        <CompanionProgressionHpField disabled={isLocked} />
        <CompanionProgressionRankFields
          disabled={isLocked}
          baseSkills={eidolonBaseSkills}
        />
        <CompanionProgressionAbilityFields disabled={isLocked} />
        <EidolonClassSkillFields form={form} disabled={isLocked} />
        <EidolonArmorSplitField form={form} disabled={isLocked} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isLocked}
          >
            {isSaving ? 'Saving…' : 'Save eidolon choices'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Cancel <span className="sr-only">{heading}</span>
          </Button>
          <SaveFeedback status={status} savedText="Saved" shouldHideWhenIdle />
        </div>
      </form>
    </Form>
  );
}
