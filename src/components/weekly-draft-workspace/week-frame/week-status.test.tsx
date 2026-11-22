import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import {
  ConfirmedWeekNotice,
  RemoteChangeNote,
  SaveFailureAlert,
  remoteChangeText,
} from './week-status';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function failure() {
  return document.querySelector('[data-week-save-failure]');
}

test.each(['idle', 'pending', 'saved', 'confirming'] as const)(
  '[status.%s] the failure alert is mounted but empty while a save has not failed',
  (feedback) => {
    render(
      <SaveFailureAlert feedback={feedback} failureReason="stale reason" />,
    );
    expect(screen.getByRole('alert')).toBe(failure());
    expect(failure()).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  },
);

test('[status.failed] a failed save fills the already-mounted alert with the exact visible text; recovery empties the same element', () => {
  const view = render(
    <SaveFailureAlert feedback="saved" failureReason={null} />,
  );
  const alert = failure();
  expect(alert).toBeEmptyDOMElement();
  view.rerender(<SaveFailureAlert feedback="failed" failureReason={null} />);
  // The same node: a live region announces text added after it exists.
  expect(failure()).toBe(alert);
  expect(screen.getByRole('alert')).toBe(alert);
  expect(alert!.textContent).toBe(
    'Changes could not be saved. The latest saved values are shown.',
  );
  expect(alert).toHaveClass('text-destructive');
  expect(alert).not.toHaveClass('sr-only');
  view.rerender(<SaveFailureAlert feedback="pending" failureReason={null} />);
  expect(failure()).toBe(alert);
  expect(alert).toBeEmptyDOMElement();
});

test('[status.reason] a safe server reason follows the failure text inside the same alert', () => {
  render(
    <SaveFailureAlert
      feedback="failed"
      failureReason="Editing is paused for maintenance. Saved information remains available."
    />,
  );
  expect(failure()!.textContent).toBe(
    'Changes could not be saved. The latest saved values are shown. Editing is paused for maintenance. Saved information remains available.',
  );
});

test('[remote.text] the note names every changed phase in order, never one arbitrary phase', () => {
  expect(remoteChangeText(['upkeep'])).toBe('Another player changed Upkeep.');
  expect(remoteChangeText(['upkeep', 'event'])).toBe(
    'Another player changed Upkeep and Event.',
  );
  expect(remoteChangeText(['activity', 'persistent', 'summary'])).toBe(
    'Another player changed Activity, Persistent and Review & confirm.',
  );
});

test('[remote.note] the note is its own polite status and stays mounted (empty) without evidence', () => {
  const view = render(<RemoteChangeNote change={null} />);
  const note = document.querySelector('[data-week-remote-note]')!;
  expect(note).toHaveAttribute('role', 'status');
  expect(note).toBeEmptyDOMElement();
  view.rerender(
    <RemoteChangeNote change={{ sequence: 1, phases: ['upkeep', 'event'] }} />,
  );
  expect(note).toHaveTextContent('Another player changed Upkeep and Event.');
  // Visible text at every size: nothing in the note is screen-reader-only.
  expect(note.querySelector('.sr-only, [class*="sr-only"]')).toBeNull();
  view.rerender(<RemoteChangeNote change={null} />);
  expect(note).toBeEmptyDOMElement();
});

test('[remote.reannounce] a new batch in the same phase replaces the text node so it is announced again; a rerender of the same batch does not', () => {
  const view = render(
    <RemoteChangeNote change={{ sequence: 1, phases: ['upkeep'] }} />,
  );
  const note = document.querySelector('[data-week-remote-note]')!;
  const first = note.firstElementChild;
  view.rerender(
    <RemoteChangeNote change={{ sequence: 1, phases: ['upkeep'] }} />,
  );
  expect(note.firstElementChild).toBe(first);
  view.rerender(
    <RemoteChangeNote change={{ sequence: 2, phases: ['upkeep'] }} />,
  );
  expect(note).toHaveTextContent('Another player changed Upkeep.');
  expect(note.firstElementChild).not.toBe(first);
});

test('[notice] the confirmed-week notice announces once with the exact history link and can be dismissed', () => {
  const dismiss = vi.fn();
  const view = render(
    <ConfirmedWeekNotice notice={null} campaignId="alpha" dismiss={dismiss} />,
  );
  const notice = document.querySelector('[data-week-confirmed]')!;
  expect(notice).toHaveAttribute('role', 'status');
  expect(notice).toBeEmptyDOMElement();
  view.rerender(
    <ConfirmedWeekNotice
      notice={{ transitionId: 'a:b', week: 4 }}
      campaignId="alpha"
      dismiss={dismiss}
    />,
  );
  expect(notice).toHaveTextContent('Week 4 confirmed.');
  expect(
    screen.getByRole('link', { name: 'Open in Finished weeks' }),
  ).toHaveAttribute('href', '/campaigns/alpha/history?week=4');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test('[notice.no-campaign] without a campaign the notice keeps its text and offers no link', () => {
  render(
    <ConfirmedWeekNotice
      notice={{ transitionId: 'a:b', week: 4 }}
      campaignId={null}
      dismiss={() => undefined}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Week 4 confirmed.');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
