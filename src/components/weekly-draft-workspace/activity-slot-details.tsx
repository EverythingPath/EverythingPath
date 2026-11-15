'use client';
import { CircleDot, Plus, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { actionTeamTypes } from '~/lib/rules-action-teams';
import { actionChoiceRolls } from '~/lib/weekly-draft-facts';
import { activityReviewRequirement } from '~/lib/weekly-draft-review';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import {
  ActivityCheckRow,
  ActivityHelpful,
  ActivityModifierList,
} from './activity-check-row';
import { ActivityChoiceReview } from './activity-choice-review';
import { ActivityDetails } from './activity-details';
import { ActivityModifierForm } from './activity-modifier-form';
import type { TeamOption } from './activity-board';
import type { ActivityView } from './types';
import type { ActivityBoard } from './use-activity-board';

// The selected slot's details under the board: a departed Character's review
// flag, its issues, the acting team, the check with Helpful and recorded
// modifiers, then every remaining action-specific field through the retained
// editor, and Clear.

type Slot = ActivityView['slots'][number];
const NONE = '__none__';

function TeamItem({ option }: { option: TeamOption }) {
  return (
    <SelectItem value={option.teamId} className="min-h-10">
      {option.name}
      <span className="text-muted-foreground"> · {option.detail}</span>
    </SelectItem>
  );
}

function TeamField({
  slot,
  recordedTeamId,
  board,
  disabled,
  correctionsHref,
  optional,
}: {
  slot: Slot;
  recordedTeamId: string | undefined;
  board: ActivityBoard;
  disabled: boolean;
  correctionsHref?: string;
  // The action needs no team; one may still be recorded for the table.
  optional: boolean;
}) {
  const id = useId();
  const options = board.teamOptions(slot.slotId);
  const missing = slot.team !== null && slot.team.name === null;
  return (
    <div className="max-w-md space-y-1">
      <Label htmlFor={id}>Team</Label>
      <Select
        value={recordedTeamId ?? ''}
        disabled={disabled}
        onValueChange={(value) =>
          board.setTeam(slot.slotId, value === NONE ? null : value)
        }
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Choose a team" />
        </SelectTrigger>
        <SelectContent>
          {missing && slot.team && (
            <SelectItem value={slot.team.teamId} className="min-h-10">
              Missing team
            </SelectItem>
          )}
          {options.eligible.map((option) => (
            <TeamItem key={option.teamId} option={option} />
          ))}
          {options.other.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Other teams</SelectLabel>
                {options.other.map((option) => (
                  <TeamItem key={option.teamId} option={option} />
                ))}
              </SelectGroup>
            </>
          )}
          <SelectSeparator />
          <SelectItem value={NONE} className="min-h-10">
            No team
          </SelectItem>
        </SelectContent>
      </Select>
      {optional && !missing && (
        <p className="text-muted-foreground text-sm">
          Optional: this action needs no team.
        </p>
      )}
      {missing && (
        <p role="note" className="text-sm text-amber-300">
          The recorded team is no longer on the roster. Choose another team or
          repair it in Militia corrections.
          {correctionsHref && (
            <>
              {' '}
              <GuardedLink
                href={correctionsHref}
                className="text-primary underline-offset-4 hover:underline"
              >
                Open Militia corrections
              </GuardedLink>
            </>
          )}
        </p>
      )}
    </div>
  );
}

// The review flag has its own notice with Review choice, so it isn't listed
// again here.
function Issues({ slot }: { slot: Slot }) {
  const issues = slot.issues.filter(
    (issue) =>
      !slot.choice ||
      issue.code !== activityReviewRequirement(slot.choice.choiceId),
  );
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1">
      {issues.map((issue) => {
        const warning = slot.warnings.includes(issue.code);
        return (
          <li
            key={issue.code}
            role={warning ? 'note' : undefined}
            className={
              warning
                ? 'flex gap-1.5 text-sm text-amber-300'
                : 'flex gap-1.5 text-sm'
            }
          >
            {warning ? (
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleDot aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {warning ? 'Warning: ' : ''}
              {issue.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivitySlotDetails({
  slot,
  view,
  board,
  edit,
  disabled,
  correctionsHref,
  openEvent,
}: {
  slot: Slot;
  view: ActivityView;
  board: ActivityBoard;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
  correctionsHref?: string;
  openEvent?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const choice = slot.choice;
  if (!choice) return null;
  const recordedTeamId = 'teamId' in choice ? choice.teamId : undefined;
  const takesTeam = actionTeamTypes(choice.actionId) !== null;
  const recorded = actionChoiceRolls(choice).check;
  const helpfulShown = view.helpful !== null && slot.check !== null;
  const firstHelpful = helpfulShown
    ? slot.modifiers.find((modifier) => modifier.kind === 'helpful')?.index
    : undefined;
  const listed = slot.modifiers.filter(
    (modifier) => modifier.index !== firstHelpful,
  );
  const moveTargets = board.moveTargets(slot.slotId);
  return (
    <section
      aria-label={`Action Slot ${slot.number} details`}
      className="bg-card space-y-4 rounded-lg border p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto min-w-0 text-lg font-semibold [overflow-wrap:anywhere]">
          Action Slot {slot.number}
          <span className="text-muted-foreground"> · {slot.actionName}</span>
        </h2>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => board.changeAction(slot.slotId)}
        >
          Change action
        </Button>
        <Select
          value=""
          disabled={disabled || moveTargets.length === 0}
          onValueChange={(target) => board.moveTo(slot.slotId, target)}
        >
          <SelectTrigger aria-label={`Move Action Slot ${slot.number} to`}>
            <SelectValue placeholder="Move to…" />
          </SelectTrigger>
          <SelectContent align="end">
            {moveTargets.map((target) => (
              <SelectItem
                key={target.slotId}
                value={target.slotId}
                className="min-h-10"
              >
                {target.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>
      <ActivityChoiceReview
        slot={slot}
        view={view}
        reviewChoice={board.reviewChoice}
        disabled={disabled}
      />
      <Issues slot={slot} />
      <TeamField
        slot={slot}
        recordedTeamId={recordedTeamId}
        board={board}
        disabled={disabled}
        correctionsHref={correctionsHref}
        optional={!takesTeam}
      />
      {slot.check && (
        <div className="space-y-3">
          <ActivityCheckRow
            slot={slot}
            check={slot.check}
            recorded={recorded}
            board={board}
            disabled={disabled}
          />
          {!recorded && (
            <p className="text-muted-foreground text-sm">
              Enter the check roll first.
            </p>
          )}
          {view.helpful && (
            <ActivityHelpful
              slot={slot}
              helpful={view.helpful}
              recorded={recorded}
              board={board}
              disabled={disabled}
            />
          )}
          <ActivityModifierList
            slot={slot}
            modifiers={listed}
            board={board}
            disabled={disabled}
          />
          {adding ? (
            <ActivityModifierForm
              bonusChoices={slot.bonusChoices}
              disabled={disabled}
              onAdd={(modifier) => {
                void board.addModifier(slot.slotId, modifier);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2"
              disabled={disabled || !recorded}
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden />
              Add modifier
            </Button>
          )}
        </div>
      )}
      <ActivityDetails
        // A replaced or moved choice never inherits another choice's
        // unsaved local entries.
        key={choice.choiceId}
        slot={slot}
        view={view}
        edit={edit}
        disabled={disabled}
        hosted
        correctionsHref={correctionsHref}
        openEvent={openEvent}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => board.clear(slot.slotId)}
      >
        Clear {slot.actionName}
      </Button>
    </section>
  );
}
