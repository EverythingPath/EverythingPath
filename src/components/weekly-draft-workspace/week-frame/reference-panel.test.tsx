import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { PhaseReadiness } from '../types';
import {
  DockedReferencePanel,
  PhoneReferenceSheet,
  ReferencePanelToggle,
} from './reference-panel';
import {
  referenceFactsFixture,
  referencePanelFixture,
} from './reference-test-fixture';

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

const item = (id: string, message = id) => ({ id, message });
function step(over: Partial<PhaseReadiness> = {}): PhaseReadiness {
  return {
    phase: 'activity',
    available: true,
    ready: false,
    requirements: [
      item('slot:left', 'Choose a team.'),
      item('slot:right', 'Choose a team.'),
    ],
    warnings: [item('over', 'Over the action allowance.')],
    ...over,
  };
}

test('This phase lists every open decision and warning by identity, including equal wording', () => {
  render(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step()}
      panel={referencePanelFixture()}
    />,
  );
  const section = within(screen.getByRole('region', { name: 'This phase' }));
  const items = section.getAllByRole('listitem');
  expect(items.map((li) => li.textContent)).toEqual([
    'To decide: Choose a team.',
    'To decide: Choose a team.',
    'Warning: Over the action allowance.',
  ]);
});

test('a ready phase and a locked Persistent read plainly', () => {
  const view = render(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step({ ready: true, requirements: [], warnings: [] })}
      panel={referencePanelFixture()}
    />,
  );
  expect(screen.getByRole('region', { name: 'This phase' })).toHaveTextContent(
    'Nothing left to decide.',
  );
  view.rerender(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step({
        phase: 'persistent',
        available: false,
        requirements: [],
        warnings: [],
      })}
      panel={referencePanelFixture()}
    />,
  );
  expect(screen.getByRole('region', { name: 'This phase' })).toHaveTextContent(
    'No carried events.',
  );
});

test('the Militia tab shows Now from the source and an awaiting After, this-week context and same-campaign links', () => {
  render(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step()}
      panel={referencePanelFixture()}
    />,
  );
  const panel = screen.getByRole('complementary', { name: 'Reference panel' });
  const values = within(
    within(panel).getByRole('table', { name: 'Militia values' }),
  );
  const row = (name: string) =>
    values.getByRole('row', { name: new RegExp(`^${name}`) });
  expect(row('Training')).toHaveTextContent('14Awaiting decisions');
  expect(row('Treasury')).toHaveTextContent(
    '50 gp · minimum 20 gpAwaiting decisions',
  );
  expect(row('Focus')).toHaveTextContent('LoyaltyAwaiting decisions');
  const teams = within(
    within(panel).getByRole('table', { name: 'Team conditions' }),
  );
  expect(teams.getByRole('row', { name: /^Ashen Scouts/ })).toHaveTextContent(
    'Blocked',
  );
  const week = within(panel).getByRole('region', { name: 'This week' });
  expect(week).toHaveTextContent(
    'Actions1 of 2 used · provisional until Upkeep is ready',
  );
  expect(week).toHaveTextContent('Event chance35% · provisional');
  const carried = within(panel).getByRole('region', { name: 'Carried events' });
  expect(carried).toHaveTextContent('NowTheft · 3 weeks · Militia');
  expect(carried).toHaveTextContent('After the weekAwaiting decisions');
  expect(
    within(panel).getByRole('link', { name: 'Open militia' }),
  ).toHaveAttribute('href', '/campaigns/campaign/militia');
  expect(within(panel).queryByText(/^0$/)).not.toBeInTheDocument();
});

test('a final outcome fills After including its carried events', () => {
  const facts = referenceFactsFixture();
  render(
    <DockedReferencePanel
      facts={{
        ...facts,
        after: { ...facts.now, training: 17, treasuryCopper: 6100 },
        afterCarriedEvents: [],
      }}
      step={step()}
      panel={referencePanelFixture()}
    />,
  );
  const values = within(screen.getByRole('table', { name: 'Militia values' }));
  expect(values.getByRole('row', { name: /^Training/ })).toHaveTextContent(
    '1417',
  );
  expect(values.getByRole('row', { name: /^Treasury/ })).toHaveTextContent(
    '61 gp · minimum 20 gp',
  );
  expect(
    screen.getByRole('region', { name: 'Carried events' }),
  ).toHaveTextContent('After the weekNone');
  expect(screen.queryByText('Awaiting decisions')).not.toBeInTheDocument();
});

test('the Officers tab keeps every roster member and links to Characters & officers', () => {
  render(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step()}
      panel={referencePanelFixture({ tab: 'officers' })}
    />,
  );
  const roster = within(screen.getByRole('list', { name: 'Roster' }));
  expect(roster.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'Aldric · Commandant, Marshal',
    'Unnamed character · No officer role',
  ]);
  expect(
    screen.getByRole('link', { name: 'Characters & officers' }),
  ).toHaveAttribute('href', '/campaigns/campaign/officers');
});

test('the History tab shows recent weeks, its own loading, failure and retry, and All finished weeks', () => {
  const retry = vi.fn();
  const weeks = [12, 8, 3].map((week) => ({ week })) as never;
  const view = render(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step()}
      panel={referencePanelFixture({
        tab: 'history',
        history: { status: 'loading', weeks: [], retry },
      })}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading recent weeks…');
  view.rerender(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step()}
      panel={referencePanelFixture({
        tab: 'history',
        history: { status: 'failed', weeks: [], retry },
      })}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Recent weeks could not be loaded.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledOnce();
  view.rerender(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step()}
      panel={referencePanelFixture({
        tab: 'history',
        history: { status: 'ready', weeks, retry },
      })}
    />,
  );
  const links = within(
    screen.getByRole('list', { name: 'Recent weeks' }),
  ).getAllByRole('link');
  expect(
    links.map((link) => [link.textContent, link.getAttribute('href')]),
  ).toEqual([
    ['Week 12', '/campaigns/campaign/history?week=12'],
    ['Week 8', '/campaigns/campaign/history?week=8'],
    ['Week 3', '/campaigns/campaign/history?week=3'],
  ]);
  expect(
    screen.getByRole('link', { name: 'All finished weeks' }),
  ).toHaveAttribute('href', '/campaigns/campaign/history');
  view.rerender(
    <DockedReferencePanel
      facts={referenceFactsFixture()}
      step={step()}
      panel={referencePanelFixture({
        tab: 'history',
        history: { status: 'ready', weeks: [], retry },
      })}
    />,
  );
  expect(screen.getByText('No finished weeks yet.')).toBeInTheDocument();
});

test('the tabs change through the shared state and the toggle hides the docked panel', () => {
  const setTab = vi.fn();
  const setOpen = vi.fn();
  const panel = referencePanelFixture({ setTab, setOpen });
  const view = render(
    <>
      <ReferencePanelToggle panel={panel} />
      <DockedReferencePanel
        facts={referenceFactsFixture()}
        step={step()}
        panel={panel}
      />
    </>,
  );
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'History' }));
  expect(setTab).toHaveBeenLastCalledWith('history');
  const toggle = screen.getByRole('button', { name: 'Hide reference panel' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(toggle);
  expect(setOpen).toHaveBeenLastCalledWith(false);
  view.rerender(
    <>
      <ReferencePanelToggle panel={{ ...panel, open: false }} />
      <DockedReferencePanel
        facts={referenceFactsFixture()}
        step={step()}
        panel={{ ...panel, open: false }}
      />
    </>,
  );
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Show reference panel' }),
  ).toHaveAttribute('aria-expanded', 'false');
});

test('the phone strip button shows the values and readiness and opens the sheet with focus return', async () => {
  let open = false;
  const setSheetOpen = vi.fn((next: boolean) => {
    open = next;
  });
  const facts = referenceFactsFixture();
  const render_ = () => (
    <PhoneReferenceSheet
      phase="activity"
      confirmationDisabledReason={null}
      facts={facts}
      step={step()}
      panel={referencePanelFixture({ sheetOpen: open, setSheetOpen })}
    />
  );
  const view = render(render_());
  const trigger = screen.getByRole('button', { name: /^Reference:/ });
  expect(trigger).toHaveAccessibleName(
    /^Reference:\s*Training\s*14 → …\s*Treasury\s*50 gp → …\s*2 to decide$/,
  );
  expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  trigger.focus();
  fireEvent.click(trigger);
  expect(setSheetOpen).toHaveBeenLastCalledWith(true);
  view.rerender(render_());
  const sheet = await screen.findByRole('dialog', { name: 'Reference' });
  expect(
    within(sheet).getByRole('region', { name: 'This phase' }),
  ).toBeInTheDocument();
  expect(
    within(sheet).getByRole('table', { name: 'Militia values' }),
  ).toBeInTheDocument();
  expect(
    within(sheet).getByRole('tab', { name: 'History' }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(sheet.contains(document.activeElement)).toBe(true),
  );
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  expect(setSheetOpen).toHaveBeenLastCalledWith(false);
  view.rerender(render_());
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Reference' }),
    ).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(trigger).toHaveFocus());
});

test('the phone strip on Review & confirm shows only the disabled-Confirmation reason', () => {
  render(
    <PhoneReferenceSheet
      phase="summary"
      confirmationDisabledReason="2 decisions left"
      facts={referenceFactsFixture()}
      step={step({ phase: 'summary', requirements: [item('a'), item('b')] })}
      panel={referencePanelFixture()}
    />,
  );
  expect(document.querySelector('[data-week-readiness]')).toHaveTextContent(
    '2 decisions left',
  );
  expect(screen.queryByText(/to decide/)).not.toBeInTheDocument();
});

test('team rows keep identity: two teams with one name both render, and a recruit shows its honest Now', () => {
  const facts = referenceFactsFixture();
  render(
    <DockedReferencePanel
      facts={{
        ...facts,
        now: {
          ...facts.now,
          teams: [
            { teamId: 'a', name: 'Iron Wardens', status: 'active' },
            { teamId: 'b', name: 'Iron Wardens', status: 'disabled' },
          ],
        },
        after: {
          ...facts.now,
          teams: [
            { teamId: 'a', name: 'Iron Wardens', status: 'active' },
            { teamId: 'b', name: 'Iron Wardens', status: 'active' },
            { teamId: 'c', name: 'Night Runners', status: 'active' },
          ],
        },
      }}
      step={step()}
      panel={referencePanelFixture()}
    />,
  );
  const teams = within(screen.getByRole('table', { name: 'Team conditions' }));
  const rows = teams.getAllByRole('row').slice(1);
  expect(rows.map((row) => row.textContent)).toEqual([
    'Iron WardensActiveActive',
    'Iron WardensDisabledActive',
    'Night RunnersNot yet recruitedActive',
  ]);
});
