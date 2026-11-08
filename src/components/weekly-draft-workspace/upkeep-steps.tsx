'use client';
import { upkeepStepAnchor } from './source-anchors';
import type { UpkeepEdit } from './upkeep-edits';
import { ChoiceCards } from './choice-cards';
import { RollTotalField } from './roll-total-field';
import type { UpkeepCheck, UpkeepLoss, UpkeepSections } from './types';
import {
  CheckSummary,
  IssueNotes,
  RollRow,
  signed,
  Step,
} from './upkeep-parts';
import { omitRollRangeIssues } from './upkeep-warnings';
import { formatGold } from './week-frame/reference-copy';

// Steps 1–3: the training checks and losses, one roll row each. The field
// takes only the dice total; the rules add the bonus and rank. Each roll's
// dice are stated once, in its own field; the copy around it names the roll.

const attritionResults = (rank: number) => ({
  'natural-20': 'Natural 20: training rises by the training roll',
  success: 'Success: training drops by the training roll',
  failure: `Failure: training drops by the training roll + rank ${rank}`,
});

const notorietyResults = {
  success: 'Success: no reputation change',
  failure: 'Failure: the nearest settlement’s reputation drops one step',
};

export function trainingEffect(delta: number | null) {
  return delta === null ? 'Roll needed' : `Training ${signed(delta)}`;
}

function CheckRow<Result extends string>({
  label,
  dc,
  check,
  results,
  edit,
  disabled,
}: {
  label: string;
  dc: string;
  check: UpkeepCheck<Result>;
  results: Record<Result, string>;
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <RollRow
        field={
          <RollTotalField
            label={label}
            spec={check}
            recorded={check.recorded}
            required
            disabled={disabled}
            onRoll={(roll) =>
              edit({ kind: 'upkeep_roll', field: check.field, roll })
            }
          />
        }
        summary={
          <CheckSummary
            dc={dc}
            fact={check}
            result={check.result ? results[check.result] : null}
          />
        }
      />
      <IssueNotes issues={omitRollRangeIssues(check.issues)} />
    </div>
  );
}

// A training loss (or the natural-20 gain): the rank the rules add to the
// field's dice, and this step's training change once the total is in.
function LossRow({
  label,
  loss,
  edit,
  disabled,
}: {
  label: string;
  loss: UpkeepLoss;
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <RollRow
        field={
          <RollTotalField
            label={label}
            spec={loss}
            recorded={loss.recorded}
            required
            disabled={disabled}
            onRoll={(roll) =>
              edit({ kind: 'upkeep_roll', field: loss.field, roll })
            }
          />
        }
        summary={
          <div className="space-y-1 text-sm">
            {loss.rank !== null && (
              <p className="text-muted-foreground">
                Rank {loss.rank} is added by the rules
              </p>
            )}
            <p>{trainingEffect(loss.trainingDelta)}</p>
            {loss.multiplier > 1 && (
              <p className="text-muted-foreground">
                Training losses are multiplied ×{loss.multiplier} this week.
              </p>
            )}
          </div>
        }
      />
      <IssueNotes issues={omitRollRangeIssues(loss.issues)} />
    </div>
  );
}

export function Attrition({
  attrition,
  rank,
  edit,
  disabled,
}: {
  attrition: UpkeepSections['attrition'];
  rank: number;
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  return (
    <Step
      number={1}
      title="Training attrition"
      anchor={upkeepStepAnchor('attrition')}
      status={attrition.status}
      effect={trainingEffect(attrition.trainingDelta)}
    >
      <CheckRow
        label="Attrition Loyalty roll"
        dc={`Loyalty DC ${attrition.check.dc}`}
        check={attrition.check}
        results={attritionResults(rank)}
        edit={edit}
        disabled={disabled}
      />
      {attrition.training ? (
        <LossRow
          label="Attrition training roll"
          loss={attrition.training}
          edit={edit}
          disabled={disabled}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          The training roll appears once the check is in: 1d6 on a success, 2d4
          + rank {rank} on a failure.
        </p>
      )}
    </Step>
  );
}

export function Notoriety({
  notoriety,
  edit,
  disabled,
}: {
  notoriety: UpkeepSections['notoriety'];
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const settlement = notoriety.settlement;
  return (
    <Step
      number={2}
      title="Maximum notoriety"
      anchor={upkeepStepAnchor('notoriety')}
      status={notoriety.status}
      effect={
        notoriety.status === 'inapplicable'
          ? `Not this week · notoriety is ${notoriety.notoriety} of ${notoriety.threshold}`
          : trainingEffect(notoriety.trainingDelta)
      }
    >
      {notoriety.loss && (
        <LossRow
          label="Maximum-notoriety training roll"
          loss={notoriety.loss}
          edit={edit}
          disabled={disabled}
        />
      )}
      {notoriety.check && (
        <CheckRow
          label="Notoriety Loyalty roll"
          dc={`Loyalty DC ${notoriety.check.dc}`}
          check={notoriety.check}
          results={notorietyResults}
          edit={edit}
          disabled={disabled}
        />
      )}
      {settlement && (
        <div className="space-y-2">
          <ChoiceCards
            label="Nearest settlement"
            value={settlement.selected}
            disabled={disabled}
            choices={settlement.choices.map((choice) => ({
              value: choice.settlementId,
              label: choice.name,
              description: choice.reputation ?? 'No recorded reputation',
            }))}
            onChange={(value) =>
              edit({
                kind: 'upkeep_settlement',
                settlementId: value === settlement.selected ? null : value,
              })
            }
          />
          <p className="text-muted-foreground text-sm">
            {settlement.required
              ? 'required: its reputation drops one step'
              : 'needed only if the Loyalty check fails'}
          </p>
          {settlement.change && (
            <p className="text-sm">
              {settlement.change.name}: {settlement.change.before} →{' '}
              {settlement.change.after}
            </p>
          )}
          <IssueNotes issues={settlement.issues} />
        </div>
      )}
    </Step>
  );
}

export function Shortage({
  shortage,
  edit,
  disabled,
}: {
  shortage: UpkeepSections['shortage'];
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const after = formatGold(shortage.treasuryAfterRecoveryCopper);
  const minimum = formatGold(shortage.minimumCopper);
  return (
    <Step
      number={3}
      title="Treasury shortage"
      anchor={upkeepStepAnchor('shortage')}
      status={shortage.status}
      effect={
        shortage.status === 'inapplicable'
          ? `Not this week · ${after} after recovery, minimum ${minimum}`
          : shortage.status === 'waiting'
            ? 'Waiting for team recovery decisions'
            : trainingEffect(shortage.trainingDelta)
      }
    >
      {shortage.status === 'waiting' ? (
        <p className="text-muted-foreground text-sm">
          Whether the treasury falls below the {minimum} minimum depends on the
          recovery decisions above.
        </p>
      ) : (
        <p className="text-sm">
          The treasury is {after} after recovery, below the {minimum} minimum.
        </p>
      )}
      {shortage.loss && (
        <LossRow
          label="Treasury-shortage training roll"
          loss={shortage.loss}
          edit={edit}
          disabled={disabled}
        />
      )}
    </Step>
  );
}
