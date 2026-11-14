'use client';
import { useId, useState } from 'react';
import { saveNames } from '~/lib/catalog/representative-eidolons';
import { abilityKeys, type Ability } from '~/lib/character-sheet';
import type { EidolonVersion } from '~/lib/character-sheet-eidolon-progression';
import { cn } from '~/lib/utils';
import {
  EidolonVersionCards,
  type EidolonVersionChoice,
} from './eidolon-version-cards';
import type { useCharacterCompanionProgression } from './use-character-companion-progression';
import type { SaveStatus } from './save-status';
import { fieldLabel, SaveFeedback } from './sheet-parts';

type BaseForm = ReturnType<
  typeof useCharacterCompanionProgression
>['eidolonBaseForms'][number];

const shortAbility: Record<Ability, string> = {
  strength: 'Str',
  dexterity: 'Dex',
  constitution: 'Con',
  intelligence: 'Int',
  wisdom: 'Wis',
  charisma: 'Cha',
};
const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
// A playing card: lifts on hover, stays put for reduced motion.
const card =
  'border-foreground/40 bg-card focus-visible:ring-ring/50 flex min-h-11 w-full flex-col items-start gap-1.5 border p-3 text-left font-sans transition-all outline-none hover:-translate-y-0.5 hover:border-foreground focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:min-h-9';

function BaseFormCard({
  form,
  isDisabled,
  reasonId,
  onChoose,
}: {
  form: BaseForm;
  isDisabled: boolean;
  reasonId: string | undefined;
  onChoose: () => void;
}) {
  const id = useId();
  const facts = [
    { label: 'Speed', value: form.speed },
    {
      label: 'Scores',
      value: abilityKeys
        .map((ability) => `${shortAbility[ability]} ${form.scores[ability]}`)
        .join(', '),
    },
    {
      label: 'Good saves',
      value: form.goodSaves.map((save) => saveNames[save]).join(', '),
    },
    { label: 'Free evolutions', value: form.freeEvolutions.join(', ') },
  ];
  return (
    <button
      type="button"
      aria-labelledby={`${id}-name`}
      aria-describedby={cn(`${id}-facts`, reasonId)}
      disabled={isDisabled}
      onClick={onChoose}
      className={card}
    >
      <span id={`${id}-name`} className="text-base leading-tight">
        {form.label}
      </span>
      <dl id={`${id}-facts`} className="flex flex-col gap-0.5">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-wrap items-baseline gap-x-1.5"
          >
            <dt className={fieldLabel}>{fact.label}</dt>
            <dd className={note}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </button>
  );
}

/**
 * The first choice for an eidolon without recorded progression: its rules
 * version as two cards, starting with the relationship's, then its base
 * form as three cards (the application's card picker), each naming the
 * speed, starting scores, good saves and free evolutions the form brings.
 * Choosing a form records a first eidolon of the chosen version at once; an
 * Unchained one is then asked for its subtype.
 */
export function EidolonBaseFormChoice({
  forms,
  versions,
  initialVersion,
  isDisabled,
  reasonId,
  status,
  onChoose,
}: {
  forms: readonly BaseForm[];
  versions: readonly EidolonVersionChoice[];
  /** The version the cards start on: the relationship's. */
  initialVersion: EidolonVersion;
  isDisabled: boolean;
  reasonId: string | undefined;
  status: SaveStatus;
  onChoose: (baseForm: BaseForm['value'], version: EidolonVersion) => void;
}) {
  const [version, setVersion] = useState(initialVersion);
  const versionLabelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span id={versionLabelId} className={fieldLabel}>
          Version
        </span>
        <EidolonVersionCards
          versions={versions}
          value={version}
          name="eidolon-version"
          labelledBy={versionLabelId}
          isDisabled={isDisabled}
          reasonId={reasonId}
          onValueChange={setVersion}
        />
      </div>
      <p className="text-sm">Choose an eidolon base form.</p>
      <ul
        aria-label="Base forms"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {forms.map((form) => (
          <li key={form.value} className="flex">
            <BaseFormCard
              form={form}
              isDisabled={isDisabled}
              reasonId={reasonId}
              onChoose={() => onChoose(form.value, version)}
            />
          </li>
        ))}
      </ul>
      <SaveFeedback
        status={status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
