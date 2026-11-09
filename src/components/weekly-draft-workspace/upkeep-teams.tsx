'use client';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '~/components/ui/form';
import { ChoiceCards } from './choice-cards';
import { RollTotalField } from './roll-total-field';
import type {
  UpkeepDisabledTeam,
  UpkeepMissingTeam,
  UpkeepSections,
} from './types';
import { upkeepStepAnchor } from './source-anchors';
import {
  clearRulesException,
  clearTeamDecision,
  leaveTeamDisabled,
  recordReturnRoll,
  recoverTeam,
  recordRecoveryFundsException,
  type UpkeepEdit,
} from './upkeep-edits';
import {
  CheckSummary,
  IssueNotes,
  ReasonedDecision,
  RollRow,
  signedGold,
  Step,
} from './upkeep-parts';
import { omitRollRangeIssues } from './upkeep-warnings';
import { useRecoveryCost } from './use-recovery-cost';
import { formatGold } from './week-frame/reference-copy';

// Step 0: each disabled team's Recover / Leave choice and each missing team's
// return check, in the order the rules resolve them at the start of Upkeep.

const returnResults = {
  returns: 'Returns at the end of the week — can’t act in this week’s Activity',
  'stays-missing': 'Stays missing',
  lost: 'Natural 1: the team is lost for good',
};

// What the step still needs comes first; recoveries already paid are shown
// as the change so far.
function teamsEffect(teams: UpkeepSections['teams']) {
  const paid = teams.treasuryAfterRecoveryCopper - teams.treasuryBeforeCopper;
  const change = paid === 0 ? 'No cost' : `Treasury ${signedGold(paid)}`;
  if (!teams.need) return change;
  const need = teams.need === 'roll' ? 'Roll needed' : 'Decision needed';
  return paid === 0 ? need : `${need} · ${change} so far`;
}

function TeamHeading({
  team,
  condition,
}: {
  team: Pick<UpkeepDisabledTeam, 'name' | 'typeName' | 'tier'>;
  condition: 'Disabled' | 'Missing';
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <h4 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
        {team.name}
      </h4>
      <span className="text-muted-foreground text-sm">
        {team.typeName}
        {team.tier !== null && ` · tier ${team.tier}`}
      </span>
      <Badge variant="secondary">{condition}</Badge>
    </div>
  );
}

// The recovery price in gp. The hook saves every valid entry itself; the
// fields only forward text and show the errors it keeps. They read the form
// from the provider so the hook's transformed output type stays its own.
function RecoveryCost({
  team,
  edit,
  disabled,
}: {
  team: UpkeepDisabledTeam;
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const recovery = useRecoveryCost(team, edit);
  return (
    <Form {...recovery.form}>
      <form
        noValidate
        className="space-y-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <FormField
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <span className="sr-only">{team.name}: </span>Recovery cost
                  (gp)
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="font-mono"
                    disabled={disabled}
                    onChange={(event) =>
                      recovery.change('cost', event.target.value)
                    }
                  />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
          {recovery.changed && (
            <FormField
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <span className="sr-only">{team.name}: </span>Reason for the
                    changed cost
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={disabled}
                      onChange={(event) =>
                        recovery.change('reason', event.target.value)
                      }
                    />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Rules cost {formatGold(team.rulesCostCopper)} (minimum treasury)
        </p>
        {recovery.changed && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {recovery.pendingDeltaCopper !== null && (
              <p className="text-sm">
                Table Adjustment {signedGold(recovery.pendingDeltaCopper)} ·
                applied after the weekly rules outcome
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => recovery.applyRulesCost()}
            >
              Use rules cost
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}

function DisabledTeam({
  team,
  edit,
  disabled,
}: {
  team: UpkeepDisabledTeam;
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const fundsException = team.fundsException;
  return (
    <Card
      role="group"
      aria-label={`${team.name} team condition`}
      className="space-y-3 p-4"
    >
      <TeamHeading team={team} condition="Disabled" />
      <ChoiceCards
        label={`${team.name} decision`}
        value={team.decision}
        disabled={disabled}
        choices={[
          {
            value: 'recover',
            label: 'Recover',
            description: `Pay ${formatGold(team.rulesCostCopper)} now`,
          },
          {
            value: 'leave',
            label: 'Leave disabled',
            description: 'Can’t act this week',
          },
        ]}
        onChange={(value) => {
          if (value === team.decision) return;
          if (value === 'recover') edit(recoverTeam(team));
          else for (const item of leaveTeamDisabled(team)) edit(item);
        }}
      />
      {team.decision === 'recover' && (
        <RecoveryCost team={team} edit={edit} disabled={disabled} />
      )}
      {fundsException && (
        <div className="space-y-2 border-l-2 border-amber-500/60 pl-3">
          <p className="text-sm">
            This recovery exceeds the available treasury.
          </p>
          <ReasonedDecision
            label="Reason for the rules exception"
            current={fundsException.reason}
            disabled={disabled}
            onSave={(reason) => {
              const exception = recordRecoveryFundsException(team, reason);
              if (exception) edit(exception);
            }}
            onClear={() =>
              edit(clearRulesException(fundsException.exceptionId))
            }
          />
        </div>
      )}
      <IssueNotes issues={team.issues} />
    </Card>
  );
}

function MissingTeam({
  team,
  edit,
  disabled,
}: {
  team: UpkeepMissingTeam;
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const returning = team.return;
  return (
    <div
      role="group"
      aria-label={`${team.name} return check`}
      className="space-y-2 rounded-lg border px-4 py-3"
    >
      <TeamHeading team={team} condition="Missing" />
      {returning?.kind === 'scheduled' ? (
        <p className="text-sm">
          Returns at the end of week {returning.week}
          {returning.status === 'disabled' && ' as a disabled team'}
        </p>
      ) : returning?.kind === 'check' ? (
        <RollRow
          field={
            <RollTotalField
              label={`${team.name} return roll`}
              spec={{ count: 1, sides: 20 }}
              recorded={returning.check.recorded}
              required
              disabled={disabled}
              onRoll={(roll) => edit(recordReturnRoll(team.teamId, roll))}
            />
          }
          summary={
            <CheckSummary
              dc={`Return check · Security DC ${returning.check.dc}`}
              fact={returning.check}
              result={
                returning.check.result
                  ? returnResults[returning.check.result]
                  : null
              }
            />
          }
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          No return check this week.
        </p>
      )}
      <IssueNotes
        issues={
          returning?.kind === 'check'
            ? omitRollRangeIssues(team.issues)
            : team.issues
        }
      />
    </div>
  );
}

export function TeamConditions({
  teams,
  edit,
  disabled,
}: {
  teams: UpkeepSections['teams'];
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  return (
    <Step
      number={0}
      title="Team conditions"
      anchor={upkeepStepAnchor('teams')}
      status={teams.status}
      effect={
        teams.status === 'inapplicable'
          ? 'No disabled or missing teams'
          : teamsEffect(teams)
      }
    >
      {teams.disabled.map((team) => (
        <DisabledTeam
          key={team.teamId}
          team={team}
          edit={edit}
          disabled={disabled}
        />
      ))}
      {teams.missing.map((team) => (
        <MissingTeam
          key={team.teamId}
          team={team}
          edit={edit}
          disabled={disabled}
        />
      ))}
      {teams.orphans.map((orphan) => (
        <div
          key={orphan.teamId}
          role="group"
          aria-label="Staged decision for a removed team"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3"
        >
          <p role="note" className="min-w-0 flex-1 text-sm text-amber-300">
            A staged decision refers to a team that is no longer on the roster.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              for (const item of clearTeamDecision(orphan.teamId)) edit(item);
            }}
          >
            Clear staged decision
          </Button>
        </div>
      ))}
      <div className="space-y-1 text-sm">
        <p>
          Rules Baseline: treasury {formatGold(teams.treasuryBeforeCopper)} →{' '}
          {formatGold(teams.treasuryAfterRecoveryCopper)}
        </p>
        {teams.adjustments.length > 0 && (
          <p className="text-muted-foreground">
            Table Adjustments after the weekly rules:{' '}
            {teams.adjustments
              .map(
                (item) =>
                  `${item.name} recovery price ${signedGold(item.deltaCopper)}`,
              )
              .join(', ')}
          </p>
        )}
      </div>
    </Step>
  );
}
