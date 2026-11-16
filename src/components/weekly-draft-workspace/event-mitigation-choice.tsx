'use client';
import { EventChoiceCard, eventChoicePairGridClass } from './event-choice-card';

type Mitigation = 'attempted' | 'unattempted';

const labels: Record<Mitigation, string> = {
  attempted: 'Attempt it',
  unattempted: 'Let it happen',
};
const cards = (['attempted', 'unattempted'] as const).map((value) => ({
  value,
  label: labels[value],
}));

// Attempt it / Let it happen for one person or target. The pressed card
// always shows which choice applies; until the choice is recorded here a
// worded line says so, and pressing either card records it.
export function EventMitigationChoice({
  subject,
  value,
  explicit,
  attemptDescription,
  letDescription,
  disabled,
  onChange,
}: {
  subject: string;
  value: Mitigation;
  explicit: boolean;
  attemptDescription: string;
  letDescription: string;
  disabled: boolean;
  onChange: (value: Mitigation) => void;
}) {
  const applies = labels[value];
  return (
    <div
      role="group"
      aria-label={`Mitigation for ${subject}`}
      className="min-w-0 space-y-2"
    >
      <p className="text-sm font-semibold">
        Mitigation{' '}
        <span className="text-muted-foreground text-xs font-normal">
          · optional
        </span>
      </p>
      <div className={eventChoicePairGridClass}>
        {cards.map((card) => (
          <EventChoiceCard
            key={card.value}
            label={card.label}
            ariaLabel={`${card.label} for ${subject}`}
            description={
              card.value === 'attempted' ? attemptDescription : letDescription
            }
            pressed={card.value === value}
            disabled={disabled}
            onPress={() => {
              if (!explicit || card.value !== value) onChange(card.value);
            }}
          />
        ))}
      </div>
      {!explicit && (
        <p className="text-muted-foreground text-xs">
          Not chosen yet: {applies} applies.
        </p>
      )}
    </div>
  );
}
