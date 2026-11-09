'use client';
import { createContext, use, useState, type ReactNode } from 'react';
import {
  clearOverseerSupportEdit,
  moveOverseerSupport,
} from '~/lib/overseer-support';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type {
  LatestOverseerSupport,
  OverseerSupportFacts,
} from './overseer-support-facts';

// The week's one Overseer support as seen by one phase's toggles. Tapping a
// toggle that is off moves support to that event through the ordered
// support-move service; tapping one that is on removes it from that event
// only. The move is several ordinary edits, not one: while it runs the
// toggles say so, and if an edit is refused the toggle that started it says
// where support is now (read from the newest facts, not assumed) and offers
// to try again. Nothing here is shared; the draft is.

type Intent = { eventId: string; label: string; to: string | null };
export type OverseerSupportStatus =
  | { state: 'idle' }
  | { state: 'moving'; eventId: string }
  | { state: 'failed'; intent: Intent; stage: 'clear' | 'assign' };

export type OverseerSupport = {
  facts: OverseerSupportFacts;
  disabled: boolean;
  status: OverseerSupportStatus;
  toggle: (eventId: string) => void;
  retry: () => void;
  // Words for a failed move started from `eventId`, or null.
  failure: (eventId: string) => string | null;
};

const OverseerSupportContext = createContext<OverseerSupport | null>(null);

export function useOverseerSupportContext() {
  return use(OverseerSupportContext);
}

type SupportInputs = {
  facts: OverseerSupportFacts | undefined;
  edit: (edit: WeeklyDraftEdit) => unknown;
  // The newest accepted-and-pending facts, read after each awaited edit.
  latest?: LatestOverseerSupport;
  disabled: boolean;
};

export function OverseerSupportProvider({
  children,
  ...inputs
}: SupportInputs & { children: ReactNode }) {
  const support = useOverseerSupport(inputs);
  return (
    <OverseerSupportContext value={support}>{children}</OverseerSupportContext>
  );
}

function useOverseerSupport({
  facts,
  edit,
  latest,
  disabled,
}: SupportInputs): OverseerSupport | null {
  const [status, setStatus] = useState<OverseerSupportStatus>({
    state: 'idle',
  });
  if (!facts) return null;
  // The rendered facts stand in when the Workspace offers no newer ones.
  const current = () => latest?.() ?? facts;
  const send = async (next: WeeklyDraftEdit) =>
    (await edit(next)) === 'accepted'
      ? ('accepted' as const)
      : ('failed' as const);

  async function run(intent: Intent) {
    const start = current();
    if (disabled || status.state === 'moving' || !start) return;
    if (intent.to === null) {
      setStatus({ state: 'moving', eventId: intent.eventId });
      // Off: remove it from this event only; others keep what they record.
      const clear = clearOverseerSupportEdit(start.source, intent.eventId);
      const result = clear ? await send(clear) : 'accepted';
      setStatus(
        result === 'accepted'
          ? { state: 'idle' }
          : { state: 'failed', intent, stage: 'clear' },
      );
      return;
    }
    if (!start.characterId) return;
    setStatus({ state: 'moving', eventId: intent.eventId });
    const result = await moveOverseerSupport({
      to: intent.to,
      characterId: start.characterId,
      latest: () => current()?.source ?? null,
      send,
    });
    setStatus(
      result.status === 'done'
        ? { state: 'idle' }
        : { state: 'failed', intent, stage: result.stage },
    );
  }

  return {
    facts,
    disabled,
    status,
    toggle(eventId) {
      const on = facts.holders.some((holder) => holder.eventId === eventId);
      void run({
        eventId,
        label: facts.labels[eventId] ?? 'this event',
        to: on ? null : eventId,
      });
    },
    retry() {
      if (status.state === 'failed') void run(status.intent);
    },
    failure(eventId) {
      if (status.state !== 'failed' || status.intent.eventId !== eventId)
        return null;
      const { intent } = status;
      const where = facts.holders.length
        ? `It is now on ${facts.holders.map((holder) => holder.label).join(' and ')}.`
        : 'It is on no event now.';
      if (intent.to === null)
        return `Overseer support could not be removed from ${intent.label}. ${where}`;
      return status.stage === 'clear'
        ? `Overseer support could not be moved to ${intent.label}. ${where}`
        : `Overseer support was removed elsewhere but could not be added to ${intent.label}. ${where}`;
    },
  };
}
