'use client';
import { useId, useState } from 'react';
import type {
  ConditionDefinition,
  ConditionKey,
} from '~/lib/character-sheet-conditions';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { ConditionRules, rulesOnlyText } from './condition-rules';
import { describeModifier } from './modifier-labels';
import { action, fieldLabel } from './sheet-parts';
import type { ConditionSelection } from './use-sheet-entry-form';

/** The radio value for a condition of the player's own: no CRB key. */
const customCondition = 'custom';

function matchesQuery(condition: ConditionDefinition, query: string) {
  return condition.name.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * Which condition this is: the player's own, or one of the Core Rulebook's
 * by name, as playing cards. Thirty-four names are a lot of cards, so a
 * filter narrows them; the Custom card always stays. Choosing a card fills
 * the entry's canonical name and Modifiers.
 */
export function ConditionPicker({
  options,
  value,
  isDisabled,
  onSelect,
  onCustom,
}: {
  options: ConditionDefinition[];
  value: ConditionSelection;
  isDisabled: boolean;
  onSelect: (key: ConditionKey) => void;
  onCustom: () => void;
}) {
  const labelId = useId();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const matches = options.filter((option) => matchesQuery(option, query));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <span id={labelId} className={fieldLabel}>
          CRB condition
        </span>
        <div className="flex flex-col gap-0.5">
          <label htmlFor={searchId} className={fieldLabel}>
            Find a condition
          </label>
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-48 md:h-8"
          />
        </div>
      </div>
      <RadioGroup
        aria-labelledby={labelId}
        name="conditionKey"
        value={value.kind === 'crb' ? value.key : customCondition}
        disabled={isDisabled}
        onValueChange={(next) => {
          if (next === customCondition) {
            onCustom();
            return;
          }
          const option = options.find((condition) => condition.key === next);
          if (option) onSelect(option.key);
        }}
        className="grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4"
      >
        <RadioGroupItem
          value={customCondition}
          className="justify-start px-3 py-2 text-left"
        >
          Custom condition
        </RadioGroupItem>
        {options
          .filter(
            (option) =>
              matchesQuery(option, query) ||
              (value.kind === 'crb' && option.key === value.key),
          )
          .map((option) => (
            <RadioGroupItem
              key={option.key}
              value={option.key}
              className="justify-start px-3 py-2 text-left"
            >
              {option.name}
            </RadioGroupItem>
          ))}
      </RadioGroup>
      <p role="status" className="text-muted-foreground text-xs">
        {matches.length === 0 ? 'No matching conditions.' : ''}
      </p>
    </div>
  );
}

function describeSources(condition: ConditionDefinition) {
  const labels = condition.sources.map((source) =>
    source.pages ? `${source.book} ${source.pages}` : source.book,
  );
  return labels.length > 0 ? labels.join(', ') : undefined;
}

/**
 * A chosen CRB condition's name and Modifiers as the rules state them,
 * readable but not editable, with the one way to edit them anyway; then its
 * rules and what the sheet leaves uncalculated, previewed before saving.
 */
export function FixedConditionFacts({
  condition,
  isDisabled,
  onCustomize,
}: {
  condition: ConditionDefinition;
  isDisabled: boolean;
  onCustomize: () => void;
}) {
  const consequenceId = useId();
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-1 gap-x-3 gap-y-1 md:grid-cols-[auto_minmax(0,1fr)] md:items-baseline">
        <dt className={fieldLabel}>Name</dt>
        <dd className="font-sans text-base">{condition.name}</dd>
        <dt className={fieldLabel}>Modifiers</dt>
        <dd className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
          {condition.modifiers.length === 0
            ? rulesOnlyText
            : condition.modifiers.map(describeModifier).join(' · ')}
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={action}
          disabled={isDisabled}
          aria-describedby={consequenceId}
          onClick={onCustomize}
        >
          Customize condition
        </Button>
        <p id={consequenceId} className="text-muted-foreground text-xs">
          Edit this condition&apos;s name and Modifiers. CRB condition notes no
          longer apply.
        </p>
      </div>
      <ConditionRules
        notes={condition.situationalNotes.map((note) => note.text)}
        unmodeled={condition.unmodeled}
        source={describeSources(condition)}
      />
    </div>
  );
}
