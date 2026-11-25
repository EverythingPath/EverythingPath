'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { ActivityText } from './activity-text';
import type { EventEditResult, EventEdits } from './event-family-inputs';
import { PERMITTED_REWARD } from './event-resource-facts';
import { EventRewardForm } from './event-reward-form';
import type { EventReward, EventRewardFacts } from './types';

// Found Fire's rewards: one section per active PC with the reward recorded
// for them, an "Add reward" form while they have none, and the rewards
// recorded for anyone else. A reward outside the rules carries its Rules
// Exception beside it. One form is open at a time. `subject` is the block
// label, which names every control for assistive technology.

type Open =
  | { kind: 'add'; characterId: string }
  | { kind: 'edit'; itemId: string };

export function EventRewardList({
  rewards,
  id,
  subject,
  disabled,
  edits,
  showRefusal,
}: {
  rewards: EventRewardFacts;
  id: string;
  subject: string;
  disabled: boolean;
  edits: EventEdits;
  showRefusal: (result: EventEditResult) => void;
}) {
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => setOpen(null);
  const row = (reward: EventReward) =>
    open?.kind === 'edit' && open.itemId === reward.itemId ? (
      <li key={reward.itemId}>
        <EventRewardForm
          reward={reward}
          recipient={{
            characterId: reward.characterId,
            name: reward.recipient,
          }}
          choices={rewards.choices}
          subject={subject}
          disabled={disabled}
          onSave={(next) => edits.saveReward(id, next)}
          onClose={close}
        />
      </li>
    ) : (
      <EventRewardRow
        key={reward.itemId}
        reward={reward}
        id={id}
        subject={subject}
        disabled={disabled}
        edits={edits}
        showRefusal={showRefusal}
        onEdit={() => setOpen({ kind: 'edit', itemId: reward.itemId })}
      />
    );
  return (
    <>
      {rewards.recipients.map((recipient) => (
        <section
          key={recipient.characterId}
          role="group"
          aria-label={`Rewards for ${recipient.name} · ${subject}`}
          className="min-w-0 space-y-2 rounded-md border p-3"
        >
          <h5 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
            Reward for {recipient.name}
            {recipient.required && (
              <span className="text-muted-foreground text-xs font-normal">
                {' '}
                required
              </span>
            )}
          </h5>
          {recipient.issue && (
            <p role="note" className="text-sm text-amber-300">
              {recipient.issue}
            </p>
          )}
          {recipient.rewards.length > 0 && (
            <ul className="space-y-2">{recipient.rewards.map(row)}</ul>
          )}
          {recipient.rewards.length === 0 &&
            (open?.kind === 'add' &&
            open.characterId === recipient.characterId ? (
              <EventRewardForm
                reward={null}
                recipient={recipient}
                choices={rewards.choices}
                subject={subject}
                disabled={disabled}
                onSave={(next) => edits.saveReward(id, next)}
                onClose={close}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-8"
                disabled={disabled}
                aria-label={`Add reward for ${recipient.name} · ${subject}`}
                onClick={() =>
                  setOpen({ kind: 'add', characterId: recipient.characterId })
                }
              >
                <Plus aria-hidden />
                Add reward
              </Button>
            ))}
        </section>
      ))}
      {rewards.others.length > 0 && (
        <section
          role="group"
          aria-label={`Other recorded rewards · ${subject}`}
          className="min-w-0 space-y-2 rounded-md border p-3"
        >
          <h5 className="font-semibold">Other recorded rewards</h5>
          <ul className="space-y-2">{rewards.others.map(row)}</ul>
        </section>
      )}
    </>
  );
}

// One recorded reward: its name, description and recipient, what the rules
// ask of it, Edit and Remove, and its Rules Exception when it needs one.
function EventRewardRow({
  reward,
  id,
  subject,
  disabled,
  edits,
  showRefusal,
  onEdit,
}: {
  reward: EventReward;
  id: string;
  subject: string;
  disabled: boolean;
  edits: EventEdits;
  showRefusal: (result: EventEditResult) => void;
  onEdit: () => void;
}) {
  const name = `${reward.name} for ${reward.recipient} · ${subject}`;
  const exception = reward.exception;
  return (
    <li className="min-w-0 space-y-2">
      <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-48 space-y-0.5 text-sm [overflow-wrap:anywhere]">
          <p className="font-semibold">{reward.name}</p>
          <p className="text-muted-foreground">{reward.description}</p>
          <p className="text-muted-foreground">{reward.recipient}</p>
          {reward.issues.map((issue) => (
            <p key={issue} role="note" className="text-amber-300">
              {issue}
            </p>
          ))}
        </div>
        <span className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={disabled}
            aria-label={`Edit ${name}`}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={disabled}
            aria-label={`Remove ${name}`}
            onClick={() => showRefusal(edits.removeReward(id, reward.itemId))}
          >
            Remove
          </Button>
        </span>
      </div>
      {exception && (
        <div
          role="group"
          aria-label={`Rules Exception for ${reward.name} · ${subject}`}
          className="min-w-0 space-y-2 rounded-md border border-amber-500/60 p-3"
        >
          <p
            role="note"
            className="min-w-0 text-sm [overflow-wrap:anywhere] text-amber-300"
          >
            {reward.permitted
              ? 'Rules Exception recorded for this reward.'
              : `Rules Exception: this reward is not ${PERMITTED_REWARD}.`}
            {reward.exceptionRequired && (
              <span className="text-muted-foreground text-xs"> · required</span>
            )}
          </p>
          {/* The reason is saved on submit; a blank one is refused. */}
          <ActivityText
            name={`Rules Exception reason for ${reward.name} · ${subject}`}
            value={exception.reason}
            required
            disabled={disabled}
            onValue={(reason) =>
              showRefusal(edits.saveException({ ...exception, reason }))
            }
          />
          {exception.reason.trim() !== '' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              disabled={disabled}
              aria-label={`Remove the Rules Exception for ${reward.name} · ${subject}`}
              onClick={() => edits.clearException(exception.exceptionId)}
            >
              Remove exception
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
