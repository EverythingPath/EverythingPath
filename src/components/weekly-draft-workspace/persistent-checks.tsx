'use client';
import { useId } from 'react';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { EventCheckRow } from './event-check-row';
import { OverseerSupportControl } from './overseer-support-control';
import { rivalrySkillLabels } from './persistent-check-facts';
import { CheckModifiers } from './persistent-check-modifiers';
import { RetainedDetails } from './persistent-retained-details';
import { RollTotalField } from './roll-total-field';
import type {
  PersistentRivalryCheck,
  PersistentTheftCheck,
  PersistentView,
  RivalrySkill,
} from './types';
import { signed } from './upkeep-parts';
import type { PersistentCheck } from './use-persistent-check';
import { WholeNumberField } from './whole-number-field';

// The inputs of a carried event's saved check: Theft's Loyalty check row
// with its Overseer toggle, or Rivalry's officer check fields, each with the
// modifiers recorded on its roll and any recorded fields the check does not
// use. Everything here renders the view's facts; the hook builds each edit.

type Event = PersistentView['events'][number];

// Safe cast: rivalrySkillLabels is keyed by RivalrySkill.
const skills = Object.entries(rivalrySkillLabels) as [RivalrySkill, string][];

// A refused field edit, until the next accepted one.
function SaveFailure({ failed }: { failed: boolean }) {
  return failed ? (
    <p role="alert" className="text-destructive text-sm">
      This change wasn’t saved. Try again.
    </p>
  ) : null;
}

export function TheftCheckInputs({
  event,
  check,
  actions,
  disabled,
}: {
  event: Event;
  check: PersistentTheftCheck;
  actions: PersistentCheck;
  disabled: boolean;
}) {
  const subject = `${event.name} Loyalty check`;
  // The engine's own composition of this check carries the Overseer's
  // actual contribution for the toggle.
  const mitigation = event.checks.find(
    (entry) => entry.checkId === `${event.eventId}:mitigation`,
  );
  return (
    <div className="min-w-0 space-y-3">
      <EventCheckRow
        facts={check.row}
        recorded={check.recorded}
        disabled={disabled}
        onRoll={(roll) => void actions.setTheftRoll(roll)}
        support={
          <OverseerSupportControl
            eventId={event.eventId}
            check="loyalty"
            subject={subject}
            breakdown={mitigation?.modifiers}
          />
        }
      />
      <CheckModifiers
        subject={subject}
        modifiers={check.modifiers}
        bonusChoices={check.bonusChoices}
        hasRoll={Boolean(check.recorded)}
        disabled={disabled}
        onChange={(change) => actions.changeModifier('theft', change)}
      />
      <SaveFailure failed={actions.failed} />
      {event.retained.length > 0 && (
        <RetainedDetails
          retained={event.retained}
          actions={actions}
          disabled={disabled}
        />
      )}
    </div>
  );
}

// The officer check that ends a Rivalry: the character, skill, skill bonus
// and roll on one wrapping row, the result beside them as in the Event check
// rows. The bonus and roll wait until the stored check can name both the
// character and the skill.
export function RivalryCheckInputs({
  event,
  check,
  actions,
  disabled,
}: {
  event: Event;
  check: PersistentRivalryCheck;
  actions: PersistentCheck;
  disabled: boolean;
}) {
  const subject = `${event.name} officer check`;
  const characterId = useId();
  const skillId = useId();
  const stored = check.characterId !== null && check.skill !== null;
  return (
    <fieldset aria-label={subject} className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
        <div className="w-full min-w-0 space-y-1 sm:w-60">
          <Label htmlFor={characterId} className="text-xs">
            Character
          </Label>
          <Select
            value={actions.characterId ?? ''}
            disabled={disabled}
            onValueChange={(id) => void actions.setCharacter(id)}
          >
            <SelectTrigger
              id={characterId}
              className="min-h-11 w-full sm:min-h-9"
            >
              <SelectValue placeholder="Choose a character" />
            </SelectTrigger>
            <SelectContent>
              {check.characters.map((character) => (
                <SelectItem
                  key={character.value}
                  value={character.value}
                  disabled={!character.available}
                >
                  {character.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-0 space-y-1 sm:w-40">
          <Label htmlFor={skillId} className="text-xs">
            Skill
          </Label>
          <Select
            value={actions.skill ?? ''}
            disabled={disabled}
            onValueChange={(skill) =>
              // Safe cast: the options are the RivalrySkill keys of skills.
              void actions.setSkill(skill as RivalrySkill)
            }
          >
            <SelectTrigger id={skillId} className="min-h-11 w-full sm:min-h-9">
              <SelectValue placeholder="Choose a skill" />
            </SelectTrigger>
            <SelectContent>
              {skills.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-0 sm:w-28">
          <WholeNumberField
            signed
            label="Skill bonus"
            value={check.skillBonus}
            required={check.required.skillBonus}
            disabled={disabled || !stored}
            onValue={(value) => void actions.setSkillBonus(value)}
          />
        </div>
        <div className="w-full min-w-0 sm:w-56">
          <RollTotalField
            label="Officer check roll"
            spec={check.spec}
            recorded={check.recorded}
            required={check.required.roll}
            disabled={disabled || !stored}
            onRoll={(roll) => void actions.setOfficerRoll(roll)}
          />
        </div>
      </div>
      {!stored && (
        <p className="text-muted-foreground text-xs">
          Choose the character and skill first.
        </p>
      )}
      <div className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere]">
        {check.modifier === null ? (
          <p className="text-muted-foreground">
            The bonus is shown once the skill bonus is in.
          </p>
        ) : (
          <p className="flex flex-wrap gap-x-3">
            <span>
              Bonus{' '}
              <strong className="font-mono">{signed(check.modifier)}</strong>
            </span>
            {check.total !== null ? (
              <span>
                = <strong className="font-mono">{check.total}</strong> vs DC 20
              </span>
            ) : (
              <span className="text-muted-foreground">
                {check.recorded && check.notOfficer
                  ? 'vs DC 20 · total once the Rules Exception is recorded'
                  : 'vs DC 20 · total after the roll'}
              </span>
            )}
          </p>
        )}
        {check.breakdown.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {check.breakdown
              .map((entry) => `${entry.label} ${signed(entry.value)}`)
              .join(' · ')}
          </p>
        )}
        {check.resultText !== null && (
          <p>
            {check.succeeded ? 'Success' : 'Failure'} · {check.resultText}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          The character’s own skill check: no officer or Overseer bonus applies.
        </p>
      </div>
      {check.unavailable && (
        <p role="note" className="text-sm text-amber-300">
          This character is no longer in the militia. Choose another character.
        </p>
      )}
      {check.notOfficer && (
        <p role="note" className="text-sm text-amber-300">
          Not an officer: this check needs a Rules Exception, recorded below.
        </p>
      )}
      <CheckModifiers
        subject={subject}
        modifiers={check.modifiers}
        bonusChoices={[]}
        hasRoll={Boolean(check.recorded)}
        disabled={disabled}
        onChange={(change) => actions.changeModifier('rivalry', change)}
      />
      <SaveFailure failed={actions.failed} />
      {event.retained.length > 0 && (
        <RetainedDetails
          retained={event.retained}
          actions={actions}
          disabled={disabled}
        />
      )}
    </fieldset>
  );
}
