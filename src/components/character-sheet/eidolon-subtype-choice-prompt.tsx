'use client';
import { useId } from 'react';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type { UnchainedSubtypeChoiceKey } from '~/lib/catalog/representative-unchained-eidolons';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import type { SaveStatus } from './save-status';
import { SaveFeedback } from './sheet-parts';

type Subtype = NonNullable<EidolonProgressionView['ordinary']['subtype']>;
export type MissingSubtypeChoice = Subtype['missingChoices'][number];
type Evolution = EidolonProgressionView['ordinary']['evolutions'][number];

const optionCard =
  'justify-start px-2 py-1 text-left font-sans text-xs md:min-h-8';

/**
 * The missing choice a subtype evolution row asks for, if that row's own.
 * The others, such as an elemental's element, belong to the subtype as a
 * whole.
 */
export function missingChoiceForRow(
  subtype: Subtype,
  row: Evolution,
): MissingSubtypeChoice | null {
  if (!row.missingChoice || row.choiceKey === null) return null;
  return (
    subtype.missingChoices.find(({ key }) => key === row.choiceKey) ?? null
  );
}

/**
 * One subtype choice the rules still need, asked where it applies: the
 * prompt in the sheet's blue, then the options as small cards. Choosing
 * one saves the whole record with that choice at once.
 */
export function EidolonSubtypeChoicePrompt({
  subtypeName,
  choice,
  isDisabled,
  reasonId,
  status,
  onChoose,
}: {
  subtypeName: string;
  choice: MissingSubtypeChoice;
  isDisabled: boolean;
  reasonId: string | undefined;
  status: SaveStatus;
  onChoose: (key: UnchainedSubtypeChoiceKey, value: string) => void;
}) {
  const promptId = useId();
  return (
    <div className="flex flex-col gap-1">
      <p
        id={promptId}
        className="text-xs [overflow-wrap:anywhere] text-sky-300"
      >
        Choose the {subtypeName} subtype’s {choice.label}.
      </p>
      <RadioGroup
        aria-labelledby={promptId}
        name={`subtype-choice-${choice.key}`}
        value=""
        disabled={isDisabled}
        onValueChange={(value) => onChoose(choice.key, value)}
        className="grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4"
      >
        {choice.options.map((option) => (
          <RadioGroupItem
            key={option.value}
            value={option.value}
            className={optionCard}
            aria-describedby={reasonId}
          >
            {option.label}
          </RadioGroupItem>
        ))}
      </RadioGroup>
      <SaveFeedback
        status={status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
