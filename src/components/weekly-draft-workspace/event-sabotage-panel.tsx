'use client';
import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { OrganizationCheck } from '~/lib/rules-officers';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import { cn } from '~/lib/utils';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { checkNames } from './event-check-facts';
import { EventCheckRow } from './event-check-row';
import type {
  EventSabotageFacts,
  EventSabotageResult,
} from './event-sabotage-facts';
import { EventTargetCards } from './event-target-cards';
import { EventWhatHappenedLine } from './event-what-happened';
import { RollTotalField } from './roll-total-field';

export type EventSabotagePanelProps = {
  facts: EventSabotageFacts;
  // "Event 2 · Sickness"
  eventLabel: string;
  // The reaction editor is showing (opened here, or already recorded).
  open: boolean;
  disabled: boolean;
  // The last refused edit's message.
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
  onTeam: (teamId: string) => void;
  onClearTeam: () => void;
  // null clears the recorded check kind.
  onCheck: (check: OrganizationCheck | null) => void;
  onCheckRoll: (roll: RawRoll | null) => void;
  onNotorietyRoll: (roll: RawRoll | null) => void;
  // Returns a refusal message to show at the field, or null.
  onSaveNote: (outcome: string) => string | null;
  onClearNote: () => void;
  // The Overseer support toggle, placed under the check row.
  support: ReactNode;
};

const CHECKS = (['loyalty', 'secrecy', 'security'] as const).map((kind) => ({
  kind,
  label: checkNames[kind],
}));

// The words say whether the Sabotage worked; colour only echoes them.
const RESULT_TONE: Record<EventSabotageResult['kind'], string> = {
  success: 'text-emerald-300',
  failure: 'text-amber-300',
  unavailable: 'text-amber-300',
  incomplete: 'text-muted-foreground',
  'no-event': 'text-muted-foreground',
  inactive: 'text-muted-foreground',
};

// Sabotage of one exact event: closed, a quiet "+ Sabotage this event";
// open, a dashed region with the team, the check, its roll, the notoriety
// die and the outcome. It renders the facts as given and reports every
// input to the owner; nothing is decided here.
export function EventSabotagePanel({
  facts,
  eventLabel,
  open,
  disabled,
  error,
  onStart,
  onCancel,
  onTeam,
  onClearTeam,
  onCheck,
  onCheckRoll,
  onNotorietyRoll,
  onSaveNote,
  onClearNote,
  support,
}: EventSabotagePanelProps) {
  if (!open) {
    if (!facts.offer) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Sabotage this event · ${eventLabel}`}
        disabled={disabled}
        onClick={onStart}
        className="text-muted-foreground hover:text-foreground h-auto min-h-11 sm:min-h-8"
      >
        <Plus aria-hidden />
        Sabotage this event
      </Button>
    );
  }
  const dc = facts.dc === null ? 'DC after Upkeep' : `DC ${facts.dc}`;
  const noTeam =
    facts.team.choices.length === 0 &&
    facts.team.selected === null &&
    facts.team.retained.length === 0;
  return (
    <div
      role="group"
      aria-label={`Sabotage of ${eventLabel}`}
      className="border-foreground/15 bg-background/40 min-w-0 space-y-3 rounded-md border border-dashed p-3 [overflow-wrap:anywhere]"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 text-sm">
          <span className="font-semibold">Sabotage</span>
          <span className="text-muted-foreground">
            {' '}
            · reactive action · {dc} · adds notoriety
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Cancel Sabotage of ${eventLabel}`}
          disabled={disabled}
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground h-auto min-h-11 sm:min-h-8"
        >
          <X aria-hidden />
          Cancel Sabotage
        </Button>
      </div>

      <EventTargetCards
        choice={facts.team}
        disabled={disabled}
        onSelect={onTeam}
        onClear={onClearTeam}
        onClearRetained={() => onClearTeam()}
      />
      {noTeam && (
        <p className="text-muted-foreground min-w-0 text-sm">
          No Saboteurs team is on the roster.
        </p>
      )}

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-semibold">
          Check
          {facts.checkTypeRequired && (
            <span className="text-muted-foreground text-xs font-normal">
              {' '}
              required
            </span>
          )}
        </legend>
        <div className="flex min-w-0 flex-wrap gap-2">
          {CHECKS.map((check) => (
            <Button
              key={check.kind}
              type="button"
              variant="outline"
              aria-label={`${check.label} check for the Sabotage`}
              aria-pressed={facts.check === check.kind}
              disabled={disabled}
              onClick={() => {
                // Pressing the chosen check again clears it.
                onCheck(facts.check === check.kind ? null : check.kind);
              }}
              className="aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:hover:border-primary aria-pressed:hover:bg-primary/15 hover:border-primary/60 hover:bg-background hover:text-foreground h-auto min-h-11 border-2 sm:min-h-9"
            >
              {check.label}
            </Button>
          ))}
        </div>
      </fieldset>

      {facts.checkRow ? (
        <EventCheckRow
          facts={facts.checkRow}
          recorded={facts.checkRoll}
          disabled={disabled}
          onRoll={onCheckRoll}
          support={support}
        />
      ) : facts.check === null ? (
        <p className="text-muted-foreground min-w-0 text-sm">
          Choose the check to see its bonus against{' '}
          {facts.dc === null ? 'the DC' : `DC ${facts.dc}`}.
        </p>
      ) : (
        <p className="text-muted-foreground min-w-0 text-sm">
          The DC is known once Upkeep sets the rank.
        </p>
      )}

      <div className="grid min-w-0 items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <RollTotalField
          label={`Sabotage notoriety roll for ${eventLabel}`}
          spec={RULE_ROLL_SPECS.singleD6}
          recorded={facts.notoriety.recorded}
          required={facts.notoriety.required}
          disabled={disabled}
          onRoll={onNotorietyRoll}
        />
        <p className="text-muted-foreground min-w-0 text-sm sm:pt-6">
          Added whether the Sabotage succeeds or fails.
        </p>
      </div>

      {facts.result && (
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-sm">
          <p
            role="status"
            className={cn('min-w-0', RESULT_TONE[facts.result.kind])}
          >
            {facts.result.text}
          </p>
          {facts.notorietyGain !== null && (
            <p className="text-muted-foreground min-w-0">
              Notoriety{' '}
              <strong className="text-foreground font-mono">
                +{facts.notorietyGain}
              </strong>{' '}
              from this attempt.
            </p>
          )}
        </div>
      )}

      {facts.recorded && (
        <EventWhatHappenedLine
          facts={facts.whatHappened}
          disabled={disabled}
          onSave={onSaveNote}
          onClear={onClearNote}
          subject={`Sabotage of ${eventLabel}`}
        />
      )}

      {error && (
        <p role="alert" className="text-destructive min-w-0 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
