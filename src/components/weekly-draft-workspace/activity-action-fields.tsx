'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import {
  destinationValue,
  type ActionDetail,
  type DetailOption,
  type PeopleTeamActionId,
} from './activity-action-detail';
import {
  recruitmentCheckFormSchema,
  recruitmentCheckFromForm,
  type ActionFieldEdits,
  type RecruitmentCheckForm,
} from './activity-action-edits';
import {
  CommonFields,
  Field,
  Muted,
  Note,
  OptionField,
  type FieldContext as SharedContext,
  type FieldError,
} from './activity-detail-parts';
import { activityLabel } from './activity-labels';
import { ActivityText } from './activity-text';
import { WholeNumberField } from './whole-number-field';

// The detail editor for the people and team actions: the action's own
// choices as option cards, then the cost, the dice rolls with their table
// modifiers, and the consumables every action shares. Each control writes
// one named field edit; the host renders the acknowledgements and exceptions.

type Choice<Id extends PeopleTeamActionId = PeopleTeamActionId> = Extract<
  StagedActionChoice,
  { actionId: Id }
>;
type Detail<Id extends PeopleTeamActionId> = Extract<
  ActionDetail,
  { actionId: Id }
>;
type FieldContext = SharedContext<ActionFieldEdits>;
// A choice paired with the detail facts of the same action, so one
// discriminant narrows both.
type ActionFields<Id extends PeopleTeamActionId = PeopleTeamActionId> =
  Id extends unknown
    ? { actionId: Id; choice: Choice<Id>; detail: Detail<Id> }
    : never;
type Fields<Id extends PeopleTeamActionId> = ActionFields<Id> & {
  context: FieldContext;
};

function isMatchedAction(fields: {
  actionId: PeopleTeamActionId;
  choice: Choice;
  detail: ActionDetail;
}): fields is ActionFields {
  return fields.choice.actionId === fields.detail.actionId;
}

const CHECK_KINDS = ['loyalty', 'secrecy', 'security'] as const;

function levelDescription(level: number | undefined, ruleLevel: number | null) {
  if (ruleLevel === null) return 'Level not recorded for this character.';
  if (level === undefined) return 'From the character’s record.';
  return `Record: level ${ruleLevel}. The rules use the recorded level.`;
}

function LevelField({
  context,
  level,
  ruleLevel,
}: {
  context: FieldContext;
  level: number | undefined;
  ruleLevel: number | null;
}) {
  return (
    <Field name="characterLevel" context={context}>
      <WholeNumberField
        label="Character level"
        value={level ?? ruleLevel}
        disabled={context.disabled}
        onValue={(next) =>
          context.edits.set('characterLevel', next ?? undefined)
        }
        description={levelDescription(level, ruleLevel)}
      />
    </Field>
  );
}

function OfficerRoleFields({
  choice,
  detail,
  context,
}: Fields<'change_officer_role'>) {
  return (
    <>
      <OptionField
        context={context}
        field="characterId"
        label="Character"
        options={detail.characters}
        value={choice.characterId ?? null}
        otherLabel="Other characters"
      />
      {detail.heldRoles !== null && (
        <p className="text-sm">
          {detail.heldRoles.length > 0
            ? `Roles at this slot: ${detail.heldRoles.map(activityLabel).join(', ')}`
            : 'Holds no officer role at this slot.'}
        </p>
      )}
      <OptionField
        context={context}
        field="fromRole"
        label="From role"
        options={detail.fromRoles}
        value={choice.fromRole ?? null}
        otherLabel="Not held at this slot"
      />
      <OptionField
        context={context}
        field="toRole"
        label="To role"
        options={detail.toRoles}
        value={choice.toRole ?? null}
        otherLabel="Already held, or a second role (needs a Rules Exception)"
      />
      <Muted>
        Leave From role empty to take a new role; leave To role empty to only
        give one up.
      </Muted>
      <Muted>
        This is a staged weekly action: the officer change happens in slot order
        when the week is confirmed, and later slots already count it.
      </Muted>
    </>
  );
}

// The table-chosen check for a team type without recruitment rules.
function RecruitmentCheckFields({
  recorded,
  context,
}: {
  recorded: Choice<'recruit_team'>['recruitmentCheck'];
  context: FieldContext;
}) {
  // Safe cast: no check is chosen until the table picks one; the schema
  // requires it before submit.
  const form = useForm({
    values: recorded
      ? { check: recorded.check, dc: String(recorded.dc) }
      : ({ dc: '' } as RecruitmentCheckForm),
    mode: 'onBlur',
    resolver: zodResolver(recruitmentCheckFormSchema),
  });
  return (
    <Form {...form}>
      <form
        noValidate
        aria-label="Recruitment check"
        onSubmit={form.handleSubmit((values) =>
          context.edits.setRecruitmentCheck(recruitmentCheckFromForm(values)),
        )}
        className="space-y-2"
      >
        <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,8rem)]">
          <FormField
            control={form.control}
            name="check"
            render={({ field }) => (
              <FormItem className="min-w-0 space-y-1">
                <FormLabel className="text-xs">Recruitment check</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  disabled={context.disabled}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a check" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CHECK_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind} className="min-h-10">
                        {activityLabel(kind)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="min-h-5">
                  <FormMessage role="alert" />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dc"
            render={({ field }) => (
              <FormItem className="min-w-0 space-y-1">
                <FormLabel className="text-xs">Recruitment DC</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="font-mono"
                    disabled={context.disabled}
                  />
                </FormControl>
                <div className="min-h-5">
                  <FormMessage role="alert" />
                </div>
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={context.disabled}>
            Save recruitment check
          </Button>
          {recorded && <ClearRecruitmentCheck context={context} />}
        </div>
      </form>
    </Form>
  );
}

function ClearRecruitmentCheck({ context }: { context: FieldContext }) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={context.disabled}
      onClick={() => context.edits.setRecruitmentCheck(null)}
    >
      Clear recruitment check
    </Button>
  );
}

function RecruitTeamFields({
  choice,
  detail,
  context,
}: Fields<'recruit_team'>) {
  const recruitment = detail.recruitment;
  const typeName =
    detail.teamTypes.find((option) => option.value === choice.teamType)
      ?.label ?? 'This team type';
  return (
    <>
      <OptionField
        context={context}
        field="teamType"
        label="Team type"
        options={detail.teamTypes}
        value={choice.teamType ?? null}
        otherLabel="No recruitment rules (needs a Rules Exception)"
      />
      {recruitment.kind !== 'none' && (
        <Field name="recruitmentCheck" context={context}>
          {recruitment.kind === 'rules' && (
            <p className="text-sm">
              Recruitment check: {activityLabel(recruitment.check)} DC{' '}
              {recruitment.dc}, from the team table.
            </p>
          )}
          {recruitment.kind === 'table' && (
            <div className="space-y-2">
              <Muted>
                This team type has no recruitment rules. With a Rules Exception,
                the table chooses the check and DC.
              </Muted>
              <RecruitmentCheckFields
                recorded={choice.recruitmentCheck}
                context={context}
              />
            </div>
          )}
          {recruitment.kind === 'retained' && choice.recruitmentCheck && (
            <div className="space-y-2">
              <Note>
                The recorded table check (
                {activityLabel(choice.recruitmentCheck.check)} DC{' '}
                {choice.recruitmentCheck.dc}) is not used: {typeName} recruit
                with {activityLabel(recruitment.rules.check)} DC{' '}
                {recruitment.rules.dc}.
              </Note>
              <ClearRecruitmentCheck context={context} />
            </div>
          )}
        </Field>
      )}
    </>
  );
}

function UpgradeTeamFields({
  choice,
  detail,
  context,
}: Fields<'upgrade_team'>) {
  return (
    <>
      <OptionField
        context={context}
        field="targetTeamId"
        label="Team to upgrade"
        options={detail.targets}
        value={choice.targetTeamId ?? null}
        otherLabel="Other teams"
      />
      <OptionField
        context={context}
        field="toTeamType"
        label="Upgrade to"
        options={detail.destinations}
        value={choice.toTeamType ?? null}
        otherLabel="Not on this team’s upgrade path (needs a Rules Exception)"
        description={
          choice.targetTeamId
            ? undefined
            : 'Choose the team first to see its upgrade path.'
        }
      />
    </>
  );
}

function RescueFields({ choice, detail, context }: Fields<'rescue_character'>) {
  return (
    <>
      <OptionField
        context={context}
        field="characterId"
        label="Character"
        options={detail.characters}
        value={choice.characterId ?? null}
        otherLabel="Not captured"
      />
      <LevelField
        context={context}
        level={choice.characterLevel}
        ruleLevel={detail.ruleLevel}
      />
      <OptionField
        context={context}
        field="destination"
        label="Destination"
        options={detail.destinations}
        value={destinationValue(choice)}
        otherLabel="No active refuge (needs a Rules Exception)"
        onSelect={(next) => context.edits.setDestination(next)}
        onClear={() => context.edits.setDestination(null)}
      />
    </>
  );
}

const TARGET_PRESENT: DetailOption[] = [
  {
    value: 'true',
    label: 'Present',
    description: null,
    eligible: true,
    missing: false,
  },
  {
    value: 'false',
    label: 'Not present',
    description: 'Needs a Rules Exception',
    eligible: false,
    missing: false,
  },
];

// The party note names whichever of the recorded character and level a party
// mode leaves unused.
function partyRestorationNote({
  hasCharacter,
  hasLevel,
}: {
  hasCharacter: boolean;
  hasLevel: boolean;
}) {
  if (hasCharacter && hasLevel)
    return 'Party restoration covers every player character; the recorded character and level are not used. Clear them or choose an individual mode.';
  if (hasCharacter)
    return 'Party restoration covers every player character; the recorded character is not used. Clear it or choose an individual mode.';
  return 'Party restoration covers every player character; the recorded character level is not used. Clear it or choose an individual mode.';
}

function RestoreFields({
  choice,
  detail,
  context,
}: Fields<'restore_character'>) {
  const isRestorative = choice.mode === 'restorative_effect';
  const hasRecordedEffect =
    choice.effect !== undefined || choice.effectLevel !== undefined;
  const isIndividual = detail.scope === 'individual';
  const isParty = detail.scope === 'party';
  const hasCharacter = choice.characterId !== undefined;
  const hasLevel = choice.characterLevel !== undefined;
  // Retained values stay visible while a party or unset mode does not use them.
  const showsCharacter = isIndividual || hasCharacter;
  const showsLevel = showsCharacter || hasLevel;
  return (
    <>
      <OptionField
        context={context}
        field="mode"
        label="Mode"
        options={detail.modes}
        value={choice.mode ?? null}
        otherLabel="Other modes"
      />
      {isParty && !hasCharacter && (
        <Muted>Restores every player character on the roster.</Muted>
      )}
      {isParty && (hasCharacter || hasLevel) && (
        <Note>{partyRestorationNote({ hasCharacter, hasLevel })}</Note>
      )}
      {showsCharacter && (
        <OptionField
          context={context}
          field="characterId"
          label="Character"
          options={detail.characters}
          value={choice.characterId ?? null}
          otherLabel="Captured (needs a Rules Exception)"
        />
      )}
      {showsLevel && (
        <LevelField
          context={context}
          level={choice.characterLevel}
          ruleLevel={detail.ruleLevel}
        />
      )}
      {!isIndividual && hasLevel && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={context.disabled}
          onClick={() => context.edits.clear('characterLevel')}
        >
          Clear character level
        </Button>
      )}
      {(isRestorative || hasRecordedEffect) && (
        <div className="space-y-3">
          {!isRestorative && (
            <Note>
              Not used by this mode; kept until you clear or replace it.
            </Note>
          )}
          <Field name="effect" context={context}>
            <ActivityText
              name="Effect"
              value={choice.effect ?? ''}
              disabled={context.disabled}
              onValue={(text) =>
                context.edits.set('effect', text.trim() || undefined)
              }
            />
          </Field>
          <Field name="effectLevel" context={context}>
            <WholeNumberField
              label="Effect level"
              value={choice.effectLevel ?? null}
              disabled={context.disabled}
              onValue={(next) =>
                context.edits.set('effectLevel', next ?? undefined)
              }
            />
          </Field>
          {!isRestorative && (
            <div className="flex flex-wrap gap-2">
              {choice.effect !== undefined && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={context.disabled}
                  onClick={() => context.edits.clear('effect')}
                >
                  Clear effect
                </Button>
              )}
              {choice.effectLevel !== undefined && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={context.disabled}
                  onClick={() => context.edits.clear('effectLevel')}
                >
                  Clear effect level
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <OptionField
        context={context}
        field="targetPresent"
        label="Target present"
        options={TARGET_PRESENT}
        value={
          choice.targetPresent === undefined
            ? null
            : String(choice.targetPresent)
        }
        otherLabel="Other"
        onSelect={(next) => context.edits.set('targetPresent', next === 'true')}
        onClear={() => context.edits.clear('targetPresent')}
      />
    </>
  );
}

function Specific({
  choice,
  detail,
  context,
}: {
  choice: Choice;
  detail: ActionDetail;
  context: FieldContext;
}) {
  const fields = { actionId: detail.actionId, choice, detail };
  if (!isMatchedAction(fields)) return null;
  switch (fields.actionId) {
    case 'change_officer_role':
      return <OfficerRoleFields {...fields} context={context} />;
    case 'recruit_team':
      return <RecruitTeamFields {...fields} context={context} />;
    case 'upgrade_team':
      return <UpgradeTeamFields {...fields} context={context} />;
    case 'dismiss_team':
      return (
        <OptionField
          context={context}
          field="targetTeamId"
          label="Team to dismiss"
          options={fields.detail.targets}
          value={fields.choice.targetTeamId ?? null}
          otherLabel="Other teams"
        />
      );
    case 'rescue_character':
      return <RescueFields {...fields} context={context} />;
    case 'restore_character':
      return <RestoreFields {...fields} context={context} />;
    case 'lie_low':
      return (
        <Muted>
          Lie Low has no other choices. When the week is confirmed, Notoriety
          falls by one for each team.
        </Muted>
      );
    default:
      return null;
  }
}

export function ActivityActionFields({
  choice,
  detail,
  calculatedCostCopper,
  disabled,
  edits,
  fieldError,
}: {
  choice: Choice;
  detail: ActionDetail;
  calculatedCostCopper: number | null;
  disabled: boolean;
  edits: ActionFieldEdits;
  // A structural save failure for one choice field, shown under its control.
  fieldError: FieldError;
}) {
  const context: FieldContext = { edits, disabled, fieldError };
  return (
    <div className="min-w-0 space-y-4">
      <Specific choice={choice} detail={detail} context={context} />
      <CommonFields
        choice={choice}
        detail={detail}
        calculatedCostCopper={calculatedCostCopper}
        context={context}
      />
    </div>
  );
}
