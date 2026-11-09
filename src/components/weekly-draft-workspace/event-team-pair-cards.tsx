'use client';
import { Button } from '~/components/ui/button';
import { EventChoiceCard, eventChoiceGridClass } from './event-choice-card';
import { EventNote } from './event-note';
import { pressTeamPair, teamPairWithout } from './event-recurring-facts';
import type { EventTeamPairChoice } from './types';

// Rivalry's two rival teams, chosen on cards: a press adds or removes a team
// and a third pick drops the earliest. A recorded team the choices no longer
// include stays as a note until it is cleared on purpose. `subject` is the
// block label, which names the buttons for assistive technology.
export function EventTeamPairCards({
  pair,
  subject,
  disabled,
  onChange,
}: {
  pair: EventTeamPairChoice;
  subject: string;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold [overflow-wrap:anywhere]">
        {pair.label}
        <span className="text-muted-foreground text-xs font-normal">
          {' '}
          · choose 2
        </span>
        {pair.required && (
          <span className="text-muted-foreground text-xs font-normal">
            {' '}
            required
          </span>
        )}
      </legend>
      {pair.hint && (
        <p className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
          {pair.hint}
        </p>
      )}
      {pair.choices.length > 0 && (
        <div className={eventChoiceGridClass}>
          {pair.choices.map((card) => (
            <EventChoiceCard
              key={card.value}
              label={card.label}
              ariaLabel={`${card.label} · ${subject}`}
              description={card.description}
              pressed={pair.selected.includes(card.value)}
              disabled={disabled}
              onPress={() => onChange(pressTeamPair(pair, card.value))}
            />
          ))}
        </div>
      )}
      {pair.selected.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={`Clear rival teams from ${subject}`}
          onClick={() => onChange([])}
        >
          Clear rival teams
        </Button>
      )}
      {pair.retained.map((entry) => (
        <EventNote
          key={entry.value}
          action="Clear"
          actionLabel={`Clear ${entry.label} from ${pair.label} for ${subject}`}
          disabled={disabled}
          onAction={() => onChange(teamPairWithout(pair, entry.value))}
        >
          {entry.label}: {entry.reason}
        </EventNote>
      ))}
    </fieldset>
  );
}
