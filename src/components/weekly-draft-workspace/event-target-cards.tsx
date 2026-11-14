'use client';
import { Button } from '~/components/ui/button';
import { EventChoiceCard, eventChoiceGridClass } from './event-choice-card';
import { EventNote } from './event-note';
import type { EventTargetChoice } from './types';

// The team, settlement or person an event targets, chosen from cards. A
// recorded target the current choices no longer include stays as a note
// until it is cleared on purpose. `subject`, when given, adds the event block
// label to every button name so two blocks never share one.
export function EventTargetCards({
  choice,
  disabled,
  onSelect,
  onClear,
  onClearRetained,
  subject,
}: {
  choice: EventTargetChoice;
  disabled: boolean;
  subject?: string;
  onSelect: (value: string) => void;
  onClear: () => void;
  onClearRetained: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold [overflow-wrap:anywhere]">
        {choice.label}
        {choice.required && (
          <span className="text-muted-foreground text-xs font-normal">
            {' '}
            required
          </span>
        )}
      </legend>
      {choice.hint && (
        <p className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
          {choice.hint}
        </p>
      )}
      {choice.choices.length > 0 && (
        <div className={eventChoiceGridClass}>
          {choice.choices.map((card) => (
            <EventChoiceCard
              key={card.value}
              label={card.label}
              ariaLabel={subject ? `${card.label} · ${subject}` : card.label}
              description={card.description}
              pressed={card.value === choice.selected}
              disabled={disabled}
              onPress={() => {
                if (card.value !== choice.selected) onSelect(card.value);
              }}
            />
          ))}
        </div>
      )}
      {choice.selected !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={
            subject
              ? `Clear ${choice.label.toLowerCase()} for ${subject}`
              : undefined
          }
          onClick={onClear}
        >
          Clear {choice.label.toLowerCase()}
        </Button>
      )}
      {choice.retained.map((entry) => (
        <EventNote
          key={entry.value}
          action="Clear"
          actionLabel={`Clear ${entry.label} from ${choice.label}${subject ? ` for ${subject}` : ''}`}
          disabled={disabled}
          onAction={() => onClearRetained(entry.value)}
        >
          {entry.label}: {entry.reason}
        </EventNote>
      ))}
    </fieldset>
  );
}
