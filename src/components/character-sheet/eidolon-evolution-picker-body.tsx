'use client';
import { useWatch } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import type { EidolonEvolutionSelection } from '~/lib/character-sheet-eidolon-progression';
import { EidolonEvolutionCardsField } from './eidolon-evolution-cards-field';
import { EidolonEvolutionOptionField } from './eidolon-evolution-option-field';
import { EidolonEvolutionUpgradeField } from './eidolon-evolution-upgrade-field';
import type { SaveStatus } from './save-status';
import { action, SaveFeedback } from './sheet-parts';
import {
  evolutionSelectionFrom,
  useEidolonEvolutionPickerForm,
  type EvolutionCatalog,
} from './use-eidolon-evolution-picker-form';

/** The picker's form: cards by cost, then the chosen evolution's option and upgrade fields. */
export function EidolonEvolutionPickerBody({
  catalog,
  summonerLevel,
  reductionLabel,
  baseFormName,
  subtypeName,
  isDisabled,
  reasonId,
  status,
  title,
  onAdd,
  onClose,
}: {
  catalog: EvolutionCatalog;
  summonerLevel: number | null;
  /** The rule that reduced the summoner level, when one applies. */
  reductionLabel: string | null;
  baseFormName: string | null;
  subtypeName: string | null;
  isDisabled: boolean;
  reasonId: string | undefined;
  status: SaveStatus;
  title: string;
  onAdd: (selection: EidolonEvolutionSelection) => Promise<boolean>;
  onClose: () => void;
}) {
  const form = useEidolonEvolutionPickerForm(catalog);
  const key = useWatch({ control: form.control, name: 'key' });
  const chosen = catalog.find((item) => item.key === key) ?? null;
  const isSaving = status.kind === 'saving';
  const isLocked = isDisabled || isSaving;
  return (
    <Form {...form}>
      <form
        noValidate
        aria-label={title}
        className="flex min-h-0 flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isLocked) return;
          void form.handleSubmit(async (values) => {
            const evolution = catalog.find((item) => item.key === values.key);
            if (!evolution) return;
            if (await onAdd(evolutionSelectionFrom(values, evolution)))
              onClose();
          })();
        }}
      >
        <EidolonEvolutionCardsField
          form={form}
          catalog={catalog}
          summonerLevel={summonerLevel}
          reductionLabel={reductionLabel}
          baseFormName={baseFormName}
          subtypeName={subtypeName}
          isLocked={isLocked}
          reasonId={reasonId}
        />
        {chosen && chosen.choiceOptions.length > 0 ? (
          <EidolonEvolutionOptionField
            form={form}
            evolution={chosen}
            isLocked={isLocked}
          />
        ) : null}
        {chosen?.upgrade ? (
          <EidolonEvolutionUpgradeField
            form={form}
            upgrade={chosen.upgrade}
            isLocked={isLocked}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isLocked}
          >
            {isSaving ? 'Saving…' : 'Add evolution'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Cancel <span className="sr-only">adding an evolution</span>
          </Button>
          <SaveFeedback status={status} savedText="Saved" shouldHideWhenIdle />
        </div>
      </form>
    </Form>
  );
}
