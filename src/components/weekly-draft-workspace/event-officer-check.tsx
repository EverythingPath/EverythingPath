'use client';
import { useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { EventChoiceCard, eventChoiceGridClass } from './event-choice-card';
import type { EventEditResult } from './event-family-inputs';
import { rivalrySkillLabels } from './persistent-check-facts';
import { RollTotalField } from './roll-total-field';
import type { EventOfficerCheckFacts, RivalrySkill } from './types';
import { signed } from './upkeep-parts';
import type { OfficerCheckPatch } from './use-event-edits';
import { WholeNumberField } from './whole-number-field';

// Safe cast: rivalrySkillLabels is keyed by RivalrySkill.
const skills = Object.entries(rivalrySkillLabels) as [RivalrySkill, string][];

// An officer's own skill check made during the Event: the officer chosen on
// cards, then the skill, skill bonus and 1d20 roll on one wrapping row with
// the result beside them, as in the Persistent Rivalry check. The stored
// check names both the character and the skill, so a character or skill
// chosen before the other is known waits here until both are; the bonus and
// roll wait until the check is stored. `subject` is the block label, which
// names the controls for assistive technology.
export function EventOfficerCheck({
  facts,
  subject,
  disabled,
  onPatch,
  onClear,
}: {
  facts: EventOfficerCheckFacts;
  subject: string;
  disabled: boolean;
  onPatch: (patch: OfficerCheckPatch) => EventEditResult;
  onClear?: () => void;
}) {
  const skillId = useId();
  const [pendingCharacter, setPendingCharacter] = useState<string | null>(null);
  const [pendingSkill, setPendingSkill] = useState<RivalrySkill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stored = facts.characterId !== null && facts.skill !== null;
  const characterId = facts.characterId ?? pendingCharacter;
  // The rules' own skill (Turncoat's Diplomacy) shows until another is chosen.
  const skill = facts.skill ?? pendingSkill ?? facts.expectedSkill;

  // A refused edit stays visible until an accepted edit replaces it.
  function write(patch: OfficerCheckPatch) {
    const result = onPatch(patch);
    if (result) {
      setError(result);
      return;
    }
    setError(null);
    setPendingCharacter(null);
    setPendingSkill(null);
  }
  function chooseCharacter(value: string) {
    if (value === characterId) return;
    const known = facts.skill ?? pendingSkill ?? facts.expectedSkill;
    if (known) write({ characterId: value, skill: known });
    else setPendingCharacter(value);
  }
  function chooseSkill(value: RivalrySkill) {
    if (value === skill) return;
    const known = facts.characterId ?? pendingCharacter;
    if (known) write({ characterId: known, skill: value });
    else setPendingSkill(value);
  }

  return (
    <fieldset
      aria-label={`${facts.label} for ${subject}`}
      className="min-w-0 space-y-3"
    >
      <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs [overflow-wrap:anywhere]">
        <span className="min-w-0">{facts.legend}</span>
        {facts.mandatory && (
          <span className="text-foreground rounded-full border px-2 py-0.5 font-medium">
            Mandatory
          </span>
        )}
      </p>
      <div
        role="group"
        aria-label={`Officer for ${subject}`}
        className="min-w-0 space-y-2"
      >
        <p className="text-sm font-semibold">
          Officer
          {facts.required.character && (
            <span className="text-muted-foreground text-xs font-normal">
              {' '}
              required
            </span>
          )}
        </p>
        {facts.characters.length > 0 ? (
          <div className={eventChoiceGridClass}>
            {facts.characters.map((card) => (
              <EventChoiceCard
                key={card.value}
                label={card.label}
                description={card.description}
                ariaLabel={`${card.label} · ${subject}`}
                pressed={card.value === characterId}
                disabled={disabled}
                onPress={() => chooseCharacter(card.value)}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
            No officer can make this check yet. Assign an officer in Characters
            &amp; officers.
          </p>
        )}
        {facts.retainedCharacter && (
          <p role="note" className="text-sm text-amber-300">
            {facts.retainedCharacter.label}: {facts.retainedCharacter.reason}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
        <div className="w-full min-w-0 space-y-1 sm:w-40">
          <Label htmlFor={skillId} className="text-xs">
            Skill
          </Label>
          <Select
            value={skill ?? ''}
            disabled={disabled}
            // Safe cast: the options are the RivalrySkill keys of skills.
            onValueChange={(value) => chooseSkill(value as RivalrySkill)}
          >
            <SelectTrigger
              id={skillId}
              aria-label={`Skill for ${subject}`}
              className="min-h-11 w-full sm:min-h-9"
            >
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
            value={facts.skillBonus}
            required={facts.required.skillBonus}
            disabled={disabled || !stored}
            onValue={(skillBonus) => write({ skillBonus })}
          />
        </div>
        <div className="w-full min-w-0 sm:w-56">
          <RollTotalField
            label={`${facts.label} roll`}
            spec={facts.spec}
            recorded={facts.recorded}
            required={facts.required.roll}
            disabled={disabled || !stored}
            onRoll={(roll) => write({ roll })}
          />
        </div>
      </div>
      {!stored && (
        <p className="text-muted-foreground text-xs">
          Choose the officer and skill first.
        </p>
      )}
      <div className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere]">
        {facts.modifier === null ? (
          <p className="text-muted-foreground">
            The bonus is shown once the skill bonus is in.
          </p>
        ) : (
          <p className="flex flex-wrap gap-x-3">
            <span>
              Bonus{' '}
              <strong className="font-mono">{signed(facts.modifier)}</strong>
            </span>
            {facts.total !== null ? (
              <span>
                = <strong className="font-mono">{facts.total}</strong> vs DC{' '}
                {facts.dc}
              </span>
            ) : (
              <span className="text-muted-foreground">
                vs DC {facts.dc} · total after the roll
              </span>
            )}
          </p>
        )}
        {facts.breakdown.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {facts.breakdown
              .map((entry) => `${entry.label} ${signed(entry.value)}`)
              .join(' · ')}
          </p>
        )}
        {facts.resultText !== null && (
          <p>
            {facts.succeeded ? 'Success' : 'Failure'} · {facts.resultText}
          </p>
        )}
        {facts.waiting && (
          <p className="text-muted-foreground">{facts.waiting}</p>
        )}
        <p className="text-muted-foreground text-xs">
          The officer’s own skill check: no organization or Overseer bonus
          applies.
        </p>
      </div>
      {facts.notes.map((note) => (
        <p key={note} role="note" className="text-sm text-amber-300">
          {note}
        </p>
      ))}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {onClear && facts.characterId !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={`Clear ${facts.label.toLowerCase()} for ${subject}`}
          onClick={() => {
            setError(null);
            onClear();
          }}
        >
          Clear officer check
        </Button>
      )}
    </fieldset>
  );
}
