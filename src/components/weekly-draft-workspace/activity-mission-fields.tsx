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
import type { DetailOption } from './activity-action-detail';
import {
  CommonFields,
  Field,
  Muted,
  Note,
  OptionField,
  type FieldContext as SharedContext,
  type FieldError,
} from './activity-detail-parts';
import type {
  MissionAcknowledgement,
  MissionDetail,
} from './activity-mission-detail';
import {
  missionNoteFormSchema,
  type MissionFieldEdits,
} from './activity-mission-edits';
import type {
  MissionActionId,
  MissionChoice,
} from './activity-mission-actions';
import { CorrectionsLink } from './activity-economy-parts';
import { ActivityText } from './activity-text';

// The detail editor for the information, mission and event-influence
// actions: the action's own choices (a subject, a mode, a settlement, a
// location), the "What happened" note the rules ask for, then the cost, dice
// rolls and consumables every action shares. Each control writes one named
// field edit; event candidates are Event's to roll and choose, so they are
// shown here and never written.

type Choice<Id extends MissionActionId = MissionActionId> = Extract<
  MissionChoice,
  { actionId: Id }
>;
// Some detail members serve two actions (their `actionId` is a pair), so the
// member is picked by whether it admits `Id` rather than by plain Extract.
type DetailFor<D, Id> = D extends { actionId: infer A }
  ? Id extends A
    ? D & { actionId: Id }
    : never
  : never;
type Detail<Id extends MissionActionId> = DetailFor<MissionDetail, Id>;
type FieldContext = SharedContext<MissionFieldEdits>;
// A choice paired with the detail facts of the same action, so one
// discriminant narrows both.
type MissionFields<Id extends MissionActionId = MissionActionId> =
  Id extends unknown
    ? { actionId: Id; choice: Choice<Id>; detail: Detail<Id> }
    : never;
type Fields<Id extends MissionActionId> = MissionFields<Id> & {
  context: FieldContext;
};

function isMatchedAction(fields: {
  actionId: MissionActionId;
  choice: Choice;
  detail: MissionDetail;
}): fields is MissionFields {
  return fields.choice.actionId === fields.detail.actionId;
}

const SPECIAL_COST =
  'Required: the GM sets this action’s cost. Enter 0 when it costs nothing.';

function isMissingSelection(
  options: DetailOption[],
  value: string | undefined,
) {
  return (
    value !== undefined &&
    options.some((option) => option.value === value && option.missing)
  );
}

// The recorded settlement is no longer one of the campaign's.
function MissingSettlementNote({
  correctionsHref,
}: {
  correctionsHref?: string;
}) {
  return (
    <Note>
      The recorded settlement is no longer one of the campaign’s. Choose another
      or restore it in Militia corrections.
      <CorrectionsLink correctionsHref={correctionsHref} />
    </Note>
  );
}

function SubjectField({
  subject,
  context,
}: {
  subject: string | undefined;
  context: FieldContext;
}) {
  return (
    <Field name="subject" context={context}>
      <ActivityText
        name="Subject"
        value={subject ?? ''}
        disabled={context.disabled}
        onValue={(text) => context.edits.setText('subject', text)}
      />
    </Field>
  );
}

function GatherInformationFields({
  choice,
  context,
}: Fields<'gather_information'>) {
  return (
    <>
      <SubjectField subject={choice.subject} context={context} />
      <Muted>On a success the GM shares intelligence about the subject.</Muted>
    </>
  );
}

function KnowledgeCheckFields({
  choice,
  detail,
  context,
}: Fields<'knowledge_check'>) {
  return (
    <>
      <SubjectField subject={choice.subject} context={context} />
      {detail.achievedDc !== null ? (
        <p className="text-sm">Knowledge DC achieved: {detail.achievedDc}</p>
      ) : (
        <Muted>
          Enter the check roll: its total is the Knowledge DC achieved.
        </Muted>
      )}
    </>
  );
}

function SpecialFields({ choice, context }: Fields<'special'>) {
  return (
    <>
      <Field name="instruction" context={context}>
        <ActivityText
          name="Instruction"
          value={choice.instruction ?? ''}
          disabled={context.disabled}
          onValue={(text) => context.edits.setText('instruction', text)}
        />
      </Field>
      <Muted>The GM defines this action and sets its cost.</Muted>
    </>
  );
}

// A recorded value the chosen mode does not use stays until it is cleared.
function RetainedClear({
  field,
  label,
  context,
}: {
  field: 'followingChoiceId' | 'location';
  label: string;
  context: FieldContext;
}) {
  return (
    <div className="space-y-2">
      <Note>Not used by this mode; kept until you clear or replace it.</Note>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={context.disabled}
        onClick={() => context.edits.clear(field)}
      >
        {label}
      </Button>
    </div>
  );
}

function CovertActionFields({
  choice,
  detail,
  context,
}: Fields<'covert_action'>) {
  const hasFollowing = choice.followingChoiceId !== undefined;
  const hasLocation = choice.location !== undefined;
  // Retained values stay visible while the chosen mode does not use them.
  const showsFollowing = detail.uses.following || hasFollowing;
  const showsLocation = detail.uses.location || hasLocation;
  const followingMissing = isMissingSelection(
    detail.following,
    choice.followingChoiceId,
  );
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
      {showsFollowing && (
        <div className="space-y-2">
          <OptionField
            context={context}
            field="followingChoiceId"
            label="Choice to augment"
            options={detail.following}
            value={choice.followingChoiceId ?? null}
            otherLabel="Not the next choice (the rules need the next one)"
            description={
              detail.following.length === 0
                ? 'Stage the next action first.'
                : undefined
            }
          />
          {followingMissing && (
            <Note>
              The recorded choice is no longer staged this Activity; choose
              another or clear it.
            </Note>
          )}
          {!detail.uses.following && hasFollowing && (
            <RetainedClear
              field="followingChoiceId"
              label="Clear choice to augment"
              context={context}
            />
          )}
        </div>
      )}
      {showsLocation && (
        <div className="space-y-2">
          <Field name="location" context={context}>
            <ActivityText
              name="Adventure site"
              value={choice.location ?? ''}
              disabled={context.disabled}
              onValue={(text) => context.edits.setText('location', text)}
            />
          </Field>
          {!detail.uses.location && hasLocation && (
            <RetainedClear
              field="location"
              label="Clear adventure site"
              context={context}
            />
          )}
        </div>
      )}
    </>
  );
}

function StrikeTeamFields({ choice, detail, context }: Fields<'strike_team'>) {
  return (
    <>
      <OptionField
        context={context}
        field="mode"
        label="Use"
        options={detail.modes}
        value={choice.mode ?? null}
        otherLabel="Other uses"
      />
      <Field name="location" context={context}>
        <ActivityText
          name="Target location"
          value={choice.location ?? ''}
          disabled={context.disabled}
          onValue={(text) => context.edits.setText('location', text)}
        />
      </Field>
    </>
  );
}

// The settlement an action targets, with the note for a recorded one the
// campaign no longer has.
function SettlementField({
  choice,
  settlements,
  label,
  otherLabel,
  context,
  correctionsHref,
}: {
  choice: Choice<'activate_refuge' | 'reduce_danger' | 'spread_propaganda'>;
  settlements: DetailOption[];
  label: string;
  otherLabel: string;
  context: FieldContext;
  correctionsHref?: string;
}) {
  return (
    <>
      <OptionField
        context={context}
        field="settlementId"
        label={label}
        options={settlements}
        value={choice.settlementId ?? null}
        otherLabel={otherLabel}
      />
      {isMissingSelection(settlements, choice.settlementId) && (
        <MissingSettlementNote correctionsHref={correctionsHref} />
      )}
    </>
  );
}

function booleanValue(value: boolean | undefined) {
  return value === undefined ? null : String(value);
}

function PropagandaFields({
  choice,
  detail,
  context,
  correctionsHref,
}: Fields<'spread_propaganda'> & { correctionsHref?: string }) {
  return (
    <>
      <SettlementField
        choice={choice}
        settlements={detail.settlements}
        label="Settlement"
        otherLabel="Reputation or occupation not recorded, or already swayed this Activity"
        context={context}
        correctionsHref={correctionsHref}
      />
      <OptionField
        context={context}
        field="occupied"
        label="Occupied by enemy forces"
        options={detail.occupied}
        value={booleanValue(choice.occupied)}
        otherLabel="Differs from the record"
        description={
          detail.occupiedRecord === null
            ? 'Choose a settlement whose occupation is recorded; the rules use its record.'
            : `The settlement’s record says ${detail.occupiedRecord ? 'occupied' : 'not occupied'}; the rules use the record.`
        }
        onSelect={(next) =>
          context.edits.setBoolean('occupied', next === 'true')
        }
        onClear={() => context.edits.setBoolean('occupied', null)}
      />
    </>
  );
}

function nestedText(count: number) {
  return `${count} nested event${count === 1 ? '' : 's'} on record`;
}

// Where the choice's event candidates stand. Read-only: Event rolls and
// chooses them.
function EventCandidates({
  detail,
  openEvent,
}: {
  detail: Detail<'guarantee_event' | 'manipulate_events'>;
  openEvent?: () => void;
}) {
  const set = detail.candidates;
  return (
    <section aria-label="Event candidates" className="space-y-2">
      <h3 className="text-sm font-semibold">Event candidates</h3>
      <Muted>
        The GM rolls the candidate events and the players choose which one
        happens, in the Event phase.
      </Muted>
      {set && !set.active ? (
        <Note>
          This choice guarantees no event this week; any recorded candidates
          stay on record.
        </Note>
      ) : null}
      {!set || set.candidates.length === 0 ? (
        set?.active === false ? null : (
          <Muted>Event is preparing the candidates.</Muted>
        )
      ) : (
        <ul
          aria-label="Event candidates for this choice"
          className="max-w-xl divide-y rounded-md border text-sm"
        >
          {set.candidates.map((candidate) => (
            <li
              key={candidate.eventId}
              className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5"
            >
              <span className="font-medium">{candidate.label}</span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {candidate.name ?? 'Not rolled yet'}
              </span>
              <span className="text-muted-foreground text-xs">
                {candidate.chosen
                  ? `Chosen · ${candidate.status}`
                  : candidate.status}
              </span>
              {candidate.nested > 0 && (
                <span className="text-muted-foreground text-xs">
                  · {nestedText(candidate.nested)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {set && set.issues.length > 0 && (
        <ul aria-label="Event candidate issues" className="space-y-1 text-sm">
          {set.issues.map((issue) => (
            <li key={issue.code} className="[overflow-wrap:anywhere]">
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      {openEvent && (
        // Only changes the local view, so a locked draft still opens Event.
        <Button type="button" variant="outline" onClick={openEvent}>
          Roll and choose in Event
        </Button>
      )}
    </section>
  );
}

// The table's note of what happened, saved with its button.
function MissionNote({
  acknowledgement,
  context,
}: {
  acknowledgement: MissionAcknowledgement;
  context: FieldContext;
}) {
  const { subjectId, recorded } = acknowledgement;
  const { edits, disabled } = context;
  const form = useForm({
    values: { text: recorded?.outcome ?? '' },
    mode: 'onBlur',
    resolver: zodResolver(missionNoteFormSchema),
  });
  return (
    <Field name="acknowledgements" context={context}>
      <Form {...form}>
        <form
          noValidate
          aria-label="What happened"
          onSubmit={form.handleSubmit(({ text }) =>
            edits.saveAcknowledgement(subjectId, text),
          )}
          className="space-y-2"
        >
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel>What happened</FormLabel>
                <Muted>{acknowledgement.description}</Muted>
                {acknowledgement.required && !recorded ? (
                  <Muted>Required: the rules wait for this note.</Muted>
                ) : null}
                <FormControl>
                  <Input {...field} disabled={disabled} />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" disabled={disabled}>
              Save what happened
            </Button>
            {recorded && (
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => edits.clearAcknowledgement(subjectId)}
              >
                Clear what happened
              </Button>
            )}
          </div>
        </form>
      </Form>
    </Field>
  );
}

function Specific({
  choice,
  detail,
  context,
  correctionsHref,
  openEvent,
}: {
  choice: Choice;
  detail: MissionDetail;
  context: FieldContext;
  correctionsHref?: string;
  openEvent?: () => void;
}) {
  const fields = { actionId: detail.actionId, choice, detail };
  if (!isMatchedAction(fields)) return null;
  switch (fields.actionId) {
    case 'gather_information':
      return <GatherInformationFields {...fields} context={context} />;
    case 'knowledge_check':
      return <KnowledgeCheckFields {...fields} context={context} />;
    case 'special':
      return <SpecialFields {...fields} context={context} />;
    case 'covert_action':
      return <CovertActionFields {...fields} context={context} />;
    case 'strike_team':
      return <StrikeTeamFields {...fields} context={context} />;
    case 'activate_refuge':
      return (
        <SettlementField
          choice={fields.choice}
          settlements={fields.detail.settlements}
          label="Settlement"
          otherLabel="Not Hostile or Unfriendly (needs a Rules Exception)"
          context={context}
          correctionsHref={correctionsHref}
        />
      );
    case 'reduce_danger':
      return (
        <SettlementField
          choice={fields.choice}
          settlements={fields.detail.settlements}
          label="Target settlement"
          otherLabel="Not secured (needs a Rules Exception)"
          context={context}
          correctionsHref={correctionsHref}
        />
      );
    case 'spread_propaganda':
      return (
        <PropagandaFields
          {...fields}
          context={context}
          correctionsHref={correctionsHref}
        />
      );
    case 'guarantee_event':
    case 'manipulate_events':
      return <EventCandidates detail={fields.detail} openEvent={openEvent} />;
  }
}

export function ActivityMissionFields({
  choice,
  detail,
  calculatedCostCopper,
  disabled,
  edits,
  fieldError,
  correctionsHref,
  openEvent,
}: {
  choice: Choice;
  detail: MissionDetail;
  calculatedCostCopper: number | null;
  disabled: boolean;
  edits: MissionFieldEdits;
  // A structural save failure for one choice field, shown under its control.
  fieldError: FieldError;
  correctionsHref?: string;
  // Switches the local view to Event, where candidates are rolled and chosen.
  openEvent?: () => void;
}) {
  const context: FieldContext = { edits, disabled, fieldError };
  return (
    <div className="min-w-0 space-y-4">
      <Specific
        choice={choice}
        detail={detail}
        context={context}
        correctionsHref={correctionsHref}
        openEvent={openEvent}
      />
      {detail.acknowledgement && (
        <MissionNote
          acknowledgement={detail.acknowledgement}
          context={context}
        />
      )}
      <CommonFields
        choice={choice}
        detail={detail}
        calculatedCostCopper={calculatedCostCopper}
        context={context}
        costDescription={
          choice.actionId === 'special' ? SPECIAL_COST : undefined
        }
      />
    </div>
  );
}
