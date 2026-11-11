'use client';
import { z } from 'zod';
import { ActivityReceipt } from './activity-receipt';
import {
  activityReferenceOptions,
  actionReferenceOptions,
} from './activity-input-options';
import { useState } from 'react';
import {
  stagedActionChoiceSchema,
  rawRollModifiersSchema,
  actionChoiceRolls,
  type ActivityRollField,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import { activityRollSpec } from '~/lib/rules-roll-spec';
import { RollTotalField } from './roll-total-field';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { Button } from '~/components/ui/button';
import { WholeNumberField } from './whole-number-field';
import { ActivityText } from './activity-text';
import { actionDetail, isPeopleTeamChoice } from './activity-action-detail';
import { actionFieldEdits } from './activity-action-edits';
import { ActivityActionFields } from './activity-action-fields';
import {
  economyAcknowledgementSubjects,
  economyDetail,
  isEconomyChoice,
} from './activity-economy-detail';
import { economyFieldEdits } from './activity-economy-edits';
import { ActivityEconomyFields } from './activity-economy-fields';
import {
  missionAcknowledgementSubjects,
  missionDetail,
} from './activity-mission-detail';
import { isMissionChoice } from './activity-mission-actions';
import { missionFieldEdits } from './activity-mission-edits';
import { ActivityMissionFields } from './activity-mission-fields';
import { ChoiceCards } from './choice-cards';
import {
  choiceFieldLabel as label,
  StructuredChoiceField,
} from './structured-choice-field';
import { activityLabel } from './activity-labels';
import type { ActivityView } from './types';
function ChoiceFields({
  choice,
  view,
  disabled,
  change,
  calculatedCostCopper,
  detailError,
  hosted,
}: {
  choice: StagedActionChoice;
  view: ActivityView;
  disabled: boolean;
  change: (field: string, value: unknown) => boolean;
  calculatedCostCopper: number | null;
  detailError: { field: string; message: string } | null;
  hosted: boolean;
}) {
  // Safe cast: StagedActionChoice is inferred from this discriminated union,
  // so choice.actionId matches exactly one of its options.
  const shape = stagedActionChoiceSchema.options.find(
    (option) => option.shape.actionId.value === choice.actionId,
  )!.shape;
  const values: Record<string, unknown> = choice;
  const references = actionReferenceOptions(choice, view);
  const hidden = new Set([
    'choiceId',
    'actionId',
    'rolls',
    'acknowledgements',
    'orderId',
    'receipt',
    // Event builds, rolls and chooses a choice's event candidates.
    'candidates',
    'selectedEventId',
    // The Activity board's own team dropdown edits the acting team.
    ...(hosted ? ['teamId'] : []),
  ]);
  return Object.entries(shape)
    .flatMap(([field, wrapped]) => {
      if (hidden.has(field)) return [];
      // Safe cast: every field of an action details schema is a Zod schema.
      const fieldSchema = wrapped as z.ZodType;
      // Safe cast: an optional Zod schema wraps a Zod schema.
      const schema =
        fieldSchema instanceof z.ZodOptional
          ? (fieldSchema.unwrap() as z.ZodType)
          : fieldSchema;
      const value =
        values[field] ??
        (field === 'costCopper'
          ? (calculatedCostCopper ?? undefined)
          : undefined);
      const fieldLabel = label(field);
      let options =
        schema instanceof z.ZodArray ? null : (references[field] ?? null);
      if (!options && schema instanceof z.ZodEnum)
        options = schema.options.map((option) => ({
          value: String(option),
          label: activityLabel(String(option)),
        }));
      else if (!options && schema instanceof z.ZodBoolean)
        options = [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ];
      if (options)
        return [
          <ChoiceCards
            key={field}
            label={fieldLabel}
            value={
              typeof value === 'string' || typeof value === 'boolean'
                ? String(value)
                : ''
            }
            choices={[{ value: '', label: 'Not selected' }, ...options]}
            disabled={disabled}
            onChange={(selected) =>
              change(
                field,
                selected === ''
                  ? undefined
                  : schema instanceof z.ZodBoolean
                    ? selected === 'true'
                    : selected,
              )
            }
          />,
        ];
      if (schema instanceof z.ZodNumber && schema.isInt)
        return [
          <WholeNumberField
            key={field}
            label={fieldLabel}
            value={typeof value === 'number' ? value : null}
            disabled={disabled}
            onValue={(number) => change(field, number ?? undefined)}
          />,
        ];
      if (schema instanceof z.ZodString)
        return [
          <ActivityText
            key={field}
            name={fieldLabel}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onValue={(text) => change(field, text.trim() || undefined)}
          />,
        ];
      return [
        <StructuredChoiceField
          key={field}
          schema={fieldSchema}
          name={field}
          value={value}
          disabled={disabled}
          onValue={(value) => change(field, value)}
          options={activityReferenceOptions(choice, view)}
        />,
      ];
    })
    .map((element) => (
      <div key={element.key} className="space-y-1">
        {element}
        {detailError?.field === element.key && (
          <p role="alert" className="text-destructive text-sm">
            {detailError.message}
          </p>
        )}
      </div>
    ));
}
function ChoiceRolls({
  choice,
  requirements,
  view,
  disabled,
  change,
  hosted,
}: {
  choice: StagedActionChoice;
  requirements: string[];
  view: ActivityView;
  disabled: boolean;
  change: (field: string, value: unknown) => void;
  hosted: boolean;
}) {
  // Supported fields for this action come from the rules; a field shows when
  // it is recorded or currently required. Known-but-inactive rolls stay
  // editable against their rule specification.
  const rolls = actionChoiceRolls(choice);
  const required = new Set<string>();
  for (const requirement of requirements) {
    const match = /^(\w+):\d+d\d+$/.exec(
      requirement.slice(choice.choiceId.length + 1),
    );
    // Safe cast: the regex's one capture group, (\w+), always takes part when
    // exec matches.
    if (match) required.add(match[1]!);
  }
  const fields = [...new Set<string>([...Object.keys(rolls), ...required])]
    // The Activity board's check row edits the check with its modifiers.
    .filter((field) => !(hosted && field === 'check'))
    .flatMap((field) => {
      const spec = activityRollSpec(
        choice.actionId,
        // Safe cast: activityRollSpec returns null for a field that is not one
        // of the action's rolls.
        field as ActivityRollField,
      );
      // Safe cast: activityRollSpec found a spec, so field is one of the
      // action's rolls.
      return spec ? [{ field: field as ActivityRollField, spec }] : [];
    });
  return fields.map(({ field, spec }) => {
    const roll = rolls[field];
    return (
      <fieldset key={field} className="space-y-2">
        <legend className="text-sm font-semibold">
          {activityLabel(field)}
        </legend>
        <RollTotalField
          label={`${activityLabel(field)} roll`}
          spec={spec}
          recorded={roll}
          required={required.has(field)}
          disabled={disabled}
          onRoll={(next) => {
            const map: Partial<Record<ActivityRollField, typeof next>> = {
              ...rolls,
            };
            if (next) map[field] = next;
            else delete map[field];
            change('rolls', map);
          }}
        />
        {roll && (
          <details className="space-y-2">
            <summary className="cursor-pointer text-sm">
              {activityLabel(field)} sources and modifiers
            </summary>
            <p className="text-muted-foreground text-xs">
              Rules bonuses are calculated automatically. Choose settlement
              support, an available bonus, or record a custom table modifier
              with a reason.
            </p>
            <StructuredChoiceField
              schema={rawRollModifiersSchema.optional()}
              value={roll.modifiers}
              name="modifiers"
              disabled={disabled}
              options={activityReferenceOptions(choice, view)}
              onValue={(modifiers) =>
                change('rolls', {
                  ...rolls,
                  [field]: { ...roll, modifiers: modifiers ?? [] },
                })
              }
            />
          </details>
        )}
      </fieldset>
    );
  });
}
// `hosted`: shown inside the Activity board's selected-slot details, which
// render the team, the check with its bonus and modifiers, and Clear. Every
// other field, roll, receipt, acknowledgement and exception stays here.
export function ActivityDetails({
  slot,
  view,
  edit,
  disabled,
  hosted = false,
  correctionsHref,
  openEvent,
}: {
  slot: ActivityView['slots'][number];
  view: ActivityView;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
  hosted?: boolean;
  // Where missing items, caches and settlements are repaired.
  correctionsHref?: string;
  // Shows the Event phase, where a choice's event candidates are rolled.
  openEvent?: () => void;
}) {
  // Safe cast: ActivitySlotDetails, the only caller, returns null before
  // rendering this when slot.choice is null.
  const choice = slot.choice!;
  const [detailError, setDetailError] = useState<{
    field: string;
    message: string;
  } | null>(null);
  // Writes several fields as one detail edit; `undefined` omits a field.
  function changeFields(fields: Record<string, unknown>, field: string) {
    return saveChoice(
      field,
      Object.fromEntries(
        Object.entries({ ...choice, ...fields }).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    );
  }
  function change(field: string, value: unknown) {
    return changeFields({ [field]: value }, field);
  }
  function saveChoice(field: string, next: unknown) {
    const parsed = stagedActionChoiceSchema.safeParse(next);
    if (!parsed.success) {
      setDetailError({
        field,
        // Safe cast: a failed safeParse always reports at least one issue.
        message: `${label(field)}: ${parsed.error.issues[0]!.message}`,
      });
      return false;
    }
    setDetailError(null);
    edit({
      kind: 'detail',
      slotId: slot.slotId,
      choiceId: choice.choiceId,
      choice: parsed.data,
    });
    return true;
  }
  const check = view.checks.find((check) => check.checkId === choice.choiceId);
  // People and team, market, cache and Special Order, and information,
  // mission and event-influence actions have their own detail editors in
  // the board.
  const people = hosted ? actionDetail(view, slot) : null;
  const economy = hosted ? economyDetail(view, slot) : null;
  const mission = hosted ? missionDetail(view, slot) : null;
  const detail = people ?? economy ?? mission;
  // Acknowledgements the economy editor shows beside their purchase or
  // order, and the one a mission editor shows as its What happened.
  const shown =
    economy && isEconomyChoice(choice)
      ? economyAcknowledgementSubjects(choice)
      : missionAcknowledgementSubjects(mission);
  return (
    <div className="space-y-3">
      {people && isPeopleTeamChoice(choice) ? (
        <ActivityActionFields
          choice={choice}
          detail={people}
          calculatedCostCopper={slot.calculatedCostCopper}
          disabled={disabled}
          edits={actionFieldEdits(choice, change)}
          fieldError={detailError}
        />
      ) : economy && isEconomyChoice(choice) ? (
        <ActivityEconomyFields
          choice={choice}
          detail={economy}
          calculatedCostCopper={slot.calculatedCostCopper}
          disabled={disabled}
          edits={economyFieldEdits(choice, changeFields)}
          fieldError={detailError}
          correctionsHref={correctionsHref}
        />
      ) : mission && isMissionChoice(choice) ? (
        <ActivityMissionFields
          choice={choice}
          detail={mission}
          calculatedCostCopper={slot.calculatedCostCopper}
          disabled={disabled}
          edits={missionFieldEdits(choice, change)}
          fieldError={detailError}
          correctionsHref={correctionsHref}
          openEvent={openEvent}
        />
      ) : (
        <ChoiceFields
          choice={choice}
          calculatedCostCopper={slot.calculatedCostCopper}
          detailError={detailError}
          view={view}
          change={change}
          disabled={disabled}
          hosted={hosted}
        />
      )}
      {!detail && slot.calculatedCostCopper !== null && (
        <p className="text-sm">
          Calculated cost: {slot.calculatedCostCopper} cp
        </p>
      )}
      {choice.actionId === 'special_order' && (
        <ActivityReceipt
          choice={choice}
          startDay={view.startDay}
          disabled={disabled}
          save={(next) => saveChoice('receipt', next)}
        />
      )}
      {!detail && (
        <ChoiceRolls
          view={view}
          choice={choice}
          requirements={slot.requirements}
          change={change}
          disabled={disabled}
          hosted={hosted}
        />
      )}
      {check && !hosted && (
        <p className="text-sm">
          Calculated bonus: {check.modifier >= 0 ? '+' : ''}
          {check.modifier} · Total: {check.total ?? 'Awaiting roll'}
        </p>
      )}
      {check && !hosted && (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {check.modifiers.map((modifier) => (
            <li key={modifier.source}>
              {actionChoiceRolls(choice).check?.modifiers.find(
                (entry) => entry.sourceId === modifier.source,
              )?.reason ??
                view.modifierSources.find(
                  (entry) => entry.value === modifier.source,
                )?.label ??
                {
                  'rank-focus': 'Rank and focus',
                  officers: 'Officers',
                  strategist: 'Strategist',
                  'gather-tier': 'Information gathering',
                  'knowledge-rank': 'Militia knowledge',
                }[modifier.source] ??
                'Calculated modifier'}
              : {modifier.value >= 0 ? '+' : ''}
              {modifier.value}
            </li>
          ))}
        </ul>
      )}
      {[
        ...new Set([
          ...slot.requirements
            .filter((requirement) => requirement.includes(':acknowledgement'))
            .map((requirement) => {
              const subject = requirement.split(':acknowledgement:')[1];
              return subject ?? `${choice.actionId}:${choice.choiceId}`;
            }),
          ...(choice.acknowledgements ?? []).map((item) => item.subjectId),
        ]),
      ]
        .filter((subjectId) => !shown.has(subjectId))
        .map((subjectId, index) => {
          const existing = choice.acknowledgements?.find(
            (item) => item.subjectId === subjectId,
          );
          return (
            <ActivityText
              key={subjectId}
              name={`Outcome acknowledgement ${index + 1}`}
              value={existing?.outcome ?? ''}
              required
              disabled={disabled}
              onValue={(outcome) =>
                change('acknowledgements', [
                  ...(choice.acknowledgements ?? []).filter(
                    (item) => item.subjectId !== subjectId,
                  ),
                  {
                    acknowledgementId:
                      existing?.acknowledgementId ?? crypto.randomUUID(),
                    subjectId,
                    outcome,
                  },
                ])
              }
            />
          );
        })}
      {slot.exceptions.map((exception) => (
        <div
          key={exception.exceptionId}
          role="group"
          aria-label={`${activityLabel(exception.ruleId.replaceAll('-', '_'))} exception`}
          className="space-y-2 rounded-md border border-amber-500 p-3"
        >
          <p className="text-sm">
            Table exception:{' '}
            {activityLabel(exception.ruleId.replaceAll('-', '_'))}. A reason
            allows this choice without changing its calculated outcome.
          </p>
          <ActivityText
            name="Exception reason"
            value={exception.reason}
            required
            disabled={disabled}
            onValue={(reason) =>
              edit({
                kind: 'rules_exception',
                exception: { ...exception, subjectId: choice.choiceId, reason },
              })
            }
          />
          {exception.reason && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() =>
                edit({
                  kind: 'clear_rules_exception',
                  exceptionId: exception.exceptionId,
                })
              }
            >
              Remove exception
            </Button>
          )}
        </div>
      ))}
      {slot.requirements.length > 0 && !hosted && (
        <p className="text-muted-foreground text-sm">
          This choice needs more preparation. Complete its selections, rolls and
          table decisions.
        </p>
      )}
      {!hosted && (
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() =>
            edit({
              kind: 'clear',
              slotId: slot.slotId,
              choiceId: choice.choiceId,
            })
          }
        >
          Clear {activityLabel(choice.actionId)}
        </Button>
      )}
    </div>
  );
}
