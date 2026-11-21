import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import {
  ShellSlotHost,
  ShellSlotProvider,
} from '~/components/campaign-shell/shell-slots';
import type { ConfirmControl } from '../confirm-control';
import type { Phase, PhaseReadiness } from '../types';
import { confirmControlFixture } from '../confirm-control-test-helpers';
import {
  referenceFactsFixture,
  referencePanelFixture,
} from './reference-test-fixture';
import { WeekFrame, WeekSkeleton } from './week-frame';

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

const item = (id: string) => ({ id, message: id });
const summaryWarnings = [item('w'), item('x')];
function phases(
  eligible: boolean,
  warnings = summaryWarnings,
): PhaseReadiness[] {
  return [
    {
      phase: 'upkeep',
      available: true,
      ready: true,
      requirements: [],
      warnings: [],
    },
    {
      phase: 'activity',
      available: true,
      ready: false,
      requirements: [item('a'), item('b')],
      warnings: [item('w')],
    },
    {
      phase: 'event',
      available: true,
      ready: true,
      requirements: [],
      warnings: [item('x')],
    },
    {
      phase: 'persistent',
      available: eligible,
      ready: false,
      requirements: [item('p')],
      warnings: [],
    },
    {
      phase: 'summary',
      available: true,
      ready: false,
      requirements: [item('a'), item('b'), item('p')],
      warnings,
    },
  ];
}
function navigationFor(phase: Phase, eligible: boolean) {
  const order = phases(eligible)
    .filter((step) => step.available)
    .map((step) => step.phase);
  const index = order.indexOf(phase);
  return { previous: order[index - 1] ?? null, next: order[index + 1] ?? null };
}
function frame(
  phase: Phase,
  options: {
    eligible?: boolean;
    reason?: string | null;
    choose?: (phase: Phase) => void;
    open?: boolean;
    confirmation?: Partial<ConfirmControl>;
    /** Review & confirm's warning count; the fixture's two by default. */
    warnings?: number;
  } = {},
) {
  const eligible = options.eligible ?? false;
  return (
    <WeekFrame
      week={4}
      phase={phase}
      phases={phases(eligible, summaryWarnings.slice(0, options.warnings))}
      navigation={navigationFor(phase, eligible)}
      confirmation={confirmControlFixture({
        disabled: Boolean(options.reason),
        reason: options.reason ?? null,
        ...options.confirmation,
      })}
      choose={options.choose ?? (() => undefined)}
      reference={{
        facts: referenceFactsFixture(),
        panel: referencePanelFixture({ open: options.open ?? true }),
      }}
      status={<p role="status" aria-live="polite" data-week-remote-note />}
    >
      <button type="button">Editor control</button>
    </WeekFrame>
  );
}
function stepper() {
  return within(screen.getByRole('navigation', { name: 'Week phases' }));
}
function actions() {
  return within(screen.getByRole('region', { name: 'Week actions' }));
}

test('five positions stay in rules order with exact names, readiness descriptions and a locked Persistent', () => {
  render(frame('activity'));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Week 4 · Activity',
  );
  const buttons = stepper().getAllByRole('button');
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
    'Upkeep',
    'Activity',
    'Event',
    'Persistent',
    'Review & confirm',
  ]);
  expect(
    stepper().getByRole('button', { name: 'Upkeep' }),
  ).toHaveAccessibleDescription('Ready');
  const activity = stepper().getByRole('button', { name: 'Activity' });
  expect(activity).toHaveAttribute('aria-current', 'step');
  expect(activity).toHaveAccessibleDescription('2 to decide · 1 warning');
  expect(
    stepper().getByRole('button', { name: 'Event' }),
  ).toHaveAccessibleDescription('Ready · 1 warning');
  const persistent = stepper().getByRole('button', { name: 'Persistent' });
  expect(persistent).toBeDisabled();
  expect(persistent).toHaveAccessibleDescription('No carried events');
  const review = stepper().getByRole('button', { name: 'Review & confirm' });
  expect(review).toBeEnabled();
  expect(review).not.toHaveAttribute('aria-describedby');
  expect(review).toHaveTextContent(/^Review & confirm$/);
  // The old visible duplicate heading is gone; only the accessible one
  // names the page. The reference panel's section headings are level 2.
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('sr-only');
});

test('the footer skips a locked Persistent, never wraps and shows the current readiness line', () => {
  const choose = vi.fn();
  const view = render(frame('event', { choose }));
  expect(
    screen.getByRole('button', { name: 'Previous: Activity' }),
  ).toBeEnabled();
  const next = screen.getByRole('button', { name: 'Next: Review & confirm' });
  fireEvent.click(next);
  expect(choose).toHaveBeenLastCalledWith('summary');
  expect(screen.getByText('Event is ready. 1 warning.')).toBeInTheDocument();
  view.rerender(frame('upkeep', { choose }));
  // An endpoint has no control, only an invisible, hidden placeholder.
  expect(screen.queryByRole('button', { name: /^Previous\b/ })).toBeNull();
  const starts = document.querySelectorAll('[data-week-endpoint="previous"]');
  expect(starts.length).toBeGreaterThan(0);
  for (const endpoint of starts) {
    expect(endpoint).toHaveAttribute('aria-hidden', 'true');
    expect(endpoint).toHaveClass('invisible');
  }
  expect(screen.getByRole('button', { name: 'Next: Activity' })).toBeEnabled();
  expect(screen.getByText('Upkeep is ready.')).toBeInTheDocument();
  view.rerender(frame('event', { choose, eligible: true }));
  expect(
    screen.getByRole('button', { name: 'Next: Persistent' }),
  ).toBeEnabled();
  expect(stepper().getByRole('button', { name: 'Persistent' })).toBeEnabled();
  expect(
    stepper().getByRole('button', { name: 'Persistent' }),
  ).toHaveAccessibleDescription('1 to decide');
});

test('Review & confirm shows only the disabled-Confirmation reason, nothing when ready', () => {
  const view = render(frame('summary', { reason: '3 decisions left' }));
  expect(screen.queryByRole('button', { name: /^Next\b/ })).toBeNull();
  // The next position holds the pinned Confirm, not a placeholder.
  expect(document.querySelector('[data-week-endpoint="next"]')).toBeNull();
  expect(
    actions().getByRole('button', { name: 'Confirm week' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous: Event' })).toBeEnabled();
  const lines = () =>
    Array.from(document.querySelectorAll('[data-week-readiness]'));
  expect(lines().length).toBeGreaterThan(0);
  for (const line of lines())
    expect(line).toHaveTextContent('3 decisions left');
  view.rerender(frame('summary', { reason: null }));
  for (const line of lines()) expect(line).toHaveTextContent(/^$/);
  expect(
    screen.queryByText(/ready for confirmation|need attention|decisions left/i),
  ).not.toBeInTheDocument();
  // The single announced status is the other-player note, not any readiness text.
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

test('the footer pins Confirm week at the next position with the same control as the review block', () => {
  const confirm = vi.fn();
  const view = render(frame('summary', { confirmation: { confirm } }));
  const button = actions().getByRole('button', { name: 'Confirm week' });
  expect(button).toBeEnabled();
  expect(button).not.toHaveAttribute('aria-busy');
  fireEvent.click(button);
  expect(confirm).toHaveBeenCalledTimes(1);
  view.rerender(frame('summary', { reason: '3 decisions left' }));
  const disabled = actions().getByRole('button', { name: 'Confirm week' });
  expect(disabled).toBeDisabled();
  expect(disabled).toHaveAccessibleDescription(/3 decisions left/);
  expect(actions().getByText('3 decisions left')).toBeVisible();
  // In flight the store disables every weekly write; the frame derives
  // nothing itself, it shows the control as given.
  view.rerender(
    frame('summary', { confirmation: { confirming: true, disabled: true } }),
  );
  const pending = actions().getByRole('button', { name: 'Confirming…' });
  expect(pending).toBeDisabled();
  expect(pending).toHaveAttribute('aria-busy', 'true');
  expect(pending).toHaveTextContent(/^Confirming…$/);
  expect(pending).not.toHaveAttribute('aria-describedby');
});

test('the pinned Confirm shows the warning count beside its label, described but never named', () => {
  const view = render(frame('summary', { warnings: 0 }));
  const none = actions().getByRole('button', { name: 'Confirm week' });
  expect(none).toHaveTextContent(/^Confirm week$/);
  expect(none).not.toHaveAttribute('aria-describedby');
  expect(none).toBeEnabled();
  view.rerender(frame('summary', { warnings: 1 }));
  const one = actions().getByRole('button', { name: 'Confirm week' });
  expect(one).toHaveTextContent(/^Confirm week · 1 warning$/);
  expect(one).toHaveAccessibleDescription('1 warning');
  expect(one).toBeEnabled();
  view.rerender(frame('summary', { warnings: 2, reason: '3 decisions left' }));
  const two = actions().getByRole('button', { name: 'Confirm week' });
  expect(two).toHaveTextContent(/^Confirm week · 2 warnings$/);
  expect(two).toHaveAccessibleDescription('2 warnings 3 decisions left');
  expect(two).toBeDisabled();
});

test('no pinned Confirm outside Review & confirm', () => {
  render(frame('activity'));
  expect(screen.queryByRole('button', { name: 'Confirm week' })).toBeNull();
  expect(
    actions().getByRole('button', { name: 'Next: Event' }),
  ).toBeInTheDocument();
});

test('the phone strip pins the compact Confirm at the next end on Review & confirm', () => {
  const confirm = vi.fn();
  const view = render(
    <ShellSlotProvider>
      {frame('summary', { confirmation: { confirm } })}
      <div data-testid="bottom">
        <ShellSlotHost name="phone-status-strip" />
      </div>
    </ShellSlotProvider>,
  );
  const bottom = screen.getByTestId('bottom');
  const strip = within(
    within(bottom).getByRole('region', { name: 'Week actions' }),
  );
  expect(bottom.querySelector('[data-week-endpoint="next"]')).toBeNull();
  const button = strip.getByRole('button', { name: 'Confirm week' });
  expect(button).toHaveTextContent('Confirm');
  expect(button).toHaveAccessibleDescription('2 warnings');
  fireEvent.click(button);
  expect(confirm).toHaveBeenCalledTimes(1);
  view.rerender(
    <ShellSlotProvider>
      {frame('summary', { reason: '3 decisions left' })}
      <div data-testid="bottom">
        <ShellSlotHost name="phone-status-strip" />
      </div>
    </ShellSlotProvider>,
  );
  const disabled = strip.getByRole('button', { name: 'Confirm week' });
  expect(disabled).toBeDisabled();
  expect(disabled).toHaveAccessibleDescription('2 warnings 3 decisions left');
  expect(strip.getByRole('button', { name: /^Reference:/ })).toHaveTextContent(
    '3 decisions left',
  );
});

test('the phone step button opens a sheet listing every position, chooses one and returns focus', async () => {
  const choose = vi.fn();
  render(frame('activity', { choose }));
  const trigger = screen.getByRole('button', {
    name: /Step 2 of 5 · Activity/,
  });
  expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  expect(trigger).toHaveTextContent('2 to decide · 1 warning');
  // The decorative glyph shows the open count but never leads the name.
  expect(trigger).toHaveAccessibleName(
    /^Step 2 of 5 · Activity\s?2 to decide · 1 warning$/,
  );
  trigger.focus();
  fireEvent.click(trigger);
  const sheet = await screen.findByRole('dialog', { name: 'Week 4' });
  const list = within(sheet).getAllByRole('button', {
    name: /^(Upkeep|Activity|Event|Persistent|Review & confirm)$/,
  });
  expect(list.map((button) => button.getAttribute('aria-label'))).toEqual([
    'Upkeep',
    'Activity',
    'Event',
    'Persistent',
    'Review & confirm',
  ]);
  expect(
    within(sheet).getByRole('button', { name: 'Persistent' }),
  ).toBeDisabled();
  expect(
    within(sheet).getByRole('button', { name: 'Review & confirm' }),
  ).not.toHaveAttribute('aria-describedby');
  expect(
    within(sheet).getByRole('button', { name: 'Activity' }),
  ).toHaveAttribute('aria-current', 'step');
  fireEvent.click(within(sheet).getByRole('button', { name: 'Event' }));
  expect(choose).toHaveBeenLastCalledWith('event');
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Week 4' }),
    ).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  await screen.findByRole('dialog', { name: 'Week 4' });
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Week 4' }),
    ).not.toBeInTheDocument(),
  );
});

test('Review & confirm on the phone button has no readiness caption', () => {
  render(frame('summary', { reason: '3 decisions left' }));
  const trigger = screen.getByRole('button', {
    name: /Step 5 of 5 · Review & confirm/,
  });
  expect(trigger).toHaveTextContent(/^Step 5 of 5 · Review & confirm$/);
});

test('the phone strip fills the shell host with previous/next around the reference values and short readiness', () => {
  const choose = vi.fn();
  render(
    <ShellSlotProvider>
      {frame('activity', { choose })}
      <div data-testid="bottom">
        <ShellSlotHost name="phone-status-strip" />
      </div>
    </ShellSlotProvider>,
  );
  const strip = within(screen.getByTestId('bottom'));
  fireEvent.click(strip.getByRole('button', { name: 'Previous: Upkeep' }));
  expect(choose).toHaveBeenLastCalledWith('upkeep');
  fireEvent.click(strip.getByRole('button', { name: 'Next: Event' }));
  expect(choose).toHaveBeenLastCalledWith('event');
  expect(
    strip.getByRole('button', { name: /^Reference:/ }),
  ).toHaveAccessibleName(
    /^Reference:\s*Training\s*14 → …\s*Treasury\s*50 gp → …\s*2 to decide$/,
  );
  // The footer keeps the full sentence; the strip carries the short form.
  expect(
    screen.getByText(
      'Complete the required rolls and decisions to finish Activity. 1 warning.',
    ),
  ).toBeInTheDocument();
});

test('the docked reference panel shows This phase for the current step and closes on preference', () => {
  const view = render(frame('activity'));
  const panel = screen.getByRole('complementary', { name: 'Reference panel' });
  expect(
    within(panel).getByRole('region', { name: 'This phase' }),
  ).toHaveTextContent('To decide: aTo decide: bWarning: w');
  expect(
    screen.getByRole('button', { name: 'Hide reference panel' }),
  ).toBeInTheDocument();
  view.rerender(frame('summary', { reason: '3 decisions left' }));
  // Review & confirm uses its aggregate facts; no readiness caption anywhere.
  expect(
    within(
      screen.getByRole('complementary', { name: 'Reference panel' }),
    ).getByRole('region', { name: 'This phase' }),
  ).toHaveTextContent(
    'To decide: aTo decide: bTo decide: pWarning: wWarning: x',
  );
  view.rerender(frame('activity', { open: false }));
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Show reference panel' }),
  ).toBeInTheDocument();
  // Readiness for the editor stays in the stepper and footer.
  expect(
    stepper().getByRole('button', { name: 'Activity' }),
  ).toHaveAccessibleDescription('2 to decide · 1 warning');
});

test('the loading skeleton keeps a readable status without a heading', () => {
  render(<WeekSkeleton />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading the week…');
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

// #143 §7, #144 §8 and #145 §8: Event, Persistent and Review & confirm load
// with placeholders shaped like their own editor, inside the same frame
// skeleton; Upkeep, Activity and an unknown phase keep the generic body.
test.each([
  ['event', 'event', { '[data-skeleton-step]': 3 }],
  [
    'persistent',
    'persistent',
    { '[data-skeleton-overview]': 1, '[data-skeleton-section]': 2 },
  ],
  [
    'summary',
    'summary',
    { '[data-skeleton-review-block]': 1, '[data-skeleton-section]': 6 },
  ],
  ['upkeep', 'week', {}],
  ['activity', 'week', {}],
  [undefined, 'week', {}],
] as const)(
  'the %s address loads with the %s-shaped skeleton',
  (phase, shape, parts: Record<string, number>) => {
    const { container } = render(<WeekSkeleton phase={phase} />);
    const skeleton = container.querySelector('[data-week-skeleton]');
    expect(skeleton).toHaveAttribute('data-week-skeleton', shape);
    // One announced status; the placeholders themselves are hidden from
    // assistive technology and offer nothing to press or read as a heading.
    expect(screen.getByRole('status')).toHaveTextContent('Loading the week…');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    const body = container.querySelector('[data-week-skeleton-body]');
    expect(body).toHaveAttribute('data-week-skeleton-body', shape);
    expect(body!.closest('[aria-hidden="true"]')).not.toBeNull();
    for (const [selector, count] of Object.entries(parts))
      expect(
        body!.querySelectorAll(selector).length,
        selector,
      ).toBeGreaterThanOrEqual(count);
    // The frame's own placeholders (phone steps, stepper, panel, footer)
    // stay the same for every phase.
    expect(
      container.querySelectorAll('[data-skeleton-frame]').length,
    ).toBeGreaterThan(0);
  },
);
