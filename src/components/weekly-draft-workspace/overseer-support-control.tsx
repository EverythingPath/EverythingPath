'use client';
import type { OrganizationCheck } from '~/lib/rules-officers';
import { overseerToggle } from './overseer-support-facts';
import { OverseerSupportToggle } from './overseer-support-toggle';
import { useOverseerSupportContext } from './use-overseer-support';

// The Overseer support toggle for one organization check of one event, in
// Event or Persistent. Renders nothing outside an Overseer support provider.
export function OverseerSupportControl({
  eventId,
  check,
  subject,
  breakdown,
}: {
  eventId: string;
  check: OrganizationCheck;
  // Names the check for assistive technology, e.g. "Event 2 Loyalty check".
  subject: string;
  // The check's calculated modifiers, for the actual contribution.
  breakdown?: readonly { source: string; value: number }[];
}) {
  const support = useOverseerSupportContext();
  if (!support) return null;
  const moving = support.status.state === 'moving';
  return (
    <OverseerSupportToggle
      toggle={overseerToggle(support.facts, eventId, check, breakdown)}
      subject={subject}
      disabled={support.disabled || moving}
      moving={
        support.status.state === 'moving' && support.status.eventId === eventId
      }
      failure={support.failure(eventId)}
      onToggle={() => support.toggle(eventId)}
      onRetry={support.retry}
    />
  );
}
