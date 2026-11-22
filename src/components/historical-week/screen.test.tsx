import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CanonicalHistoryScreen } from './screen';
import { queryCacheFixture } from '../../../tests/convex-query-cache';
import type * as ConvexReact from 'convex/react';
import type { CampaignWeek } from '~/components/campaign-home/use-campaign-week';
import { canonicalResolutionRecordSchema } from '~/lib/canonical-resolution-record';
import {
  historyPath,
  parseHistorySelection,
  type HistorySelection,
} from '~/lib/campaign-routes';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import {
  emptyPlanArtifacts,
  recordSnapshot,
} from '../../../tests/history/resolution-record-fixtures';

// ---------- A small in-memory history backend behind the Convex client ----------

type Provenance =
  | 'confirmation'
  | 'historical_correction'
  | 'historical_reconstruction';
type Entry = {
  recordId: string;
  provenance: Provenance;
  rulesetVersion: number;
  createdAt: number;
};
type Failure = (name: string, args: Record<string, unknown>) => boolean;

const backend = {
  campaigns: new Map<string, Map<number, Entry[]>>(),
  failing: (() => false) as Failure,
  pending: (() => false) as Failure,
};
let cache: ReturnType<typeof queryCacheFixture>;
function context(startDay: number) {
  return {
    firstMilitiaWeek: false,
    startDay,
    uneventfulCarry: false,
    carriedEvents: [],
    queuedEffects: [],
    orders: [],
    lastBuyoffWeek: null,
  };
}

// Each record's Final outcome carries a distinct training value and its own
// Table Adjustment reason, so a test can tell exactly which immutable record
// the detail shows.
function recordFor(week: number, entry: Entry, sequence: number) {
  const ruling = {
    adjustmentId: `ruling-${entry.recordId}`,
    kind: 'militia_value',
    field: 'training',
    operation: 'add',
    value: 1,
    reason: `Ruling of week ${week}, entry ${sequence + 1}`,
  } as const;
  const militiaSnapshot = recordSnapshot();
  const state = (training: number, startDay: number) => ({
    week,
    militiaSnapshot: { ...militiaSnapshot, training },
    context: context(startDay),
  });
  return canonicalResolutionRecordSchema.parse({
    recordId: entry.recordId,
    source: {
      ...createWeeklyDraft({
        draftId: `draft-${week}`,
        week,
        slotIds: [],
        context: context(week * 7),
      }),
      tableAdjustments: [ruling],
    },
    sourceMilitiaSnapshot: militiaSnapshot,
    provenance: entry.provenance,
    rulesetVersion: entry.rulesetVersion,
    ...emptyPlanArtifacts({
      before: state(militiaSnapshot.training, week * 7),
      baseline: state(1000, week * 7 + 7),
      final: state(1000 + week * 100 + sequence, week * 7 + 7),
    }),
    adjudication: {
      acknowledgements: [],
      rulesExceptions: [],
      tableAdjustments: [ruling],
    },
    warnings: [],
    successorContext: context(week * 7 + 7),
    supersedesRecordId: sequence === 0 ? null : `w${week}-e${sequence - 1}`,
  });
}

function weeksOf(campaignId: unknown) {
  const weeks = backend.campaigns.get(String(campaignId));
  if (!weeks) throw new Error('Campaign access');
  return weeks;
}

function row(week: number, chain: Entry[]) {
  const effective = chain[chain.length - 1]!;
  return {
    week,
    effectiveRecordId: effective.recordId,
    effectiveSequence: chain.length - 1,
    entryCount: chain.length,
    provenance: effective.provenance,
    rulesetVersion: effective.rulesetVersion,
    createdAt: effective.createdAt,
    headlineFacts: [],
  };
}

function list(args: Record<string, unknown>) {
  const weeks = weeksOf(args.campaignId);
  const limit = (args.limit as number | undefined) ?? 25;
  const before = args.beforeWeek as number | undefined;
  const numbers = [...weeks.keys()]
    .filter((week) => before === undefined || week < before)
    .sort((a, b) => b - a)
    .slice(0, limit + 1);
  const page = numbers.slice(0, limit);
  const selectedWeek = args.selectedWeek as number | undefined;
  return {
    weeks: page.map((week) => row(week, weeks.get(week)!)),
    earlierWeek: numbers.length > limit ? page[page.length - 1]! : null,
    selected:
      selectedWeek !== undefined && weeks.has(selectedWeek)
        ? row(selectedWeek, weeks.get(selectedWeek)!)
        : null,
  };
}

function read(args: Record<string, unknown>) {
  const weeks = weeksOf(args.campaignId);
  const numbers = [...weeks.keys()].sort((a, b) => a - b);
  const week = (args.week as number | undefined) ?? numbers[numbers.length - 1];
  const chain = week === undefined ? undefined : weeks.get(week);
  if (week === undefined || !chain) return null;
  const effectiveSequence = chain.length - 1;
  const sequence =
    args.recordId === undefined
      ? effectiveSequence
      : chain.findIndex((entry) => entry.recordId === args.recordId);
  if (sequence < 0) throw new ConvexError('Invalid historical week reference');
  const before = args.beforeSequence as number | undefined;
  const audit = chain
    .map((entry, index) => ({ entry, sequence: index }))
    .filter(({ sequence }) => before === undefined || sequence < before)
    .reverse()
    .slice(0, 6);
  return {
    week,
    effectiveRecordId: chain[effectiveSequence]!.recordId,
    record: recordFor(week, chain[sequence]!, sequence),
    createdAt: chain[sequence]!.createdAt,
    previousWeek: numbers.filter((value) => value < week).pop() ?? null,
    nextWeek: numbers.find((value) => value > week) ?? null,
    audit: audit.slice(0, 5).map(({ entry, sequence }) => ({
      recordId: entry.recordId,
      sequence,
      provenance: entry.provenance,
      createdAt: entry.createdAt,
    })),
    earlierSequence: audit.length > 5 ? audit[4]!.sequence : null,
  };
}

function resolve(name: string, args: Record<string, unknown>) {
  if (backend.failing(name, args)) throw new Error('offline');
  if (backend.pending(name, args)) return undefined;
  return name === 'canonicalHistory:list' ? list(args) : read(args);
}

/** Tell every live subscription that the backend changed. */
function push() {
  act(() => cache.push());
}
const reads = (predicate: (args: Record<string, unknown>) => boolean) =>
  cache
    .observed()
    .filter(
      (read) => read.name === 'canonicalHistory:read' && predicate(read.args),
    );
const lists = () =>
  cache
    .observed()
    .filter((read) => read.name === 'canonicalHistory:list')
    .map((read) => read.args);
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof ConvexReact>()),
  useConvex: () => cache.convex,
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));

// Links navigate through the harness's address, like the app router.
let navigate: (href: string) => void = () => undefined;
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: React.ComponentProps<'a'> & { href: string }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  ),
}));

// ---------- Fixtures ----------

const day = 86_400_000;
const march = Date.UTC(2026, 2, 1);
function chain(week: number, count: number, rulesets: number[] = []): Entry[] {
  return Array.from({ length: count }, (_, sequence) => ({
    recordId: `w${week}-e${sequence}`,
    provenance: sequence === 0 ? 'confirmation' : 'historical_correction',
    rulesetVersion: rulesets[sequence] ?? 1,
    createdAt: march + week * day + sequence * 3_600_000,
  }));
}
function seed(campaign: string, weeks: Record<number, Entry[]>) {
  backend.campaigns.set(
    campaign,
    new Map(Object.entries(weeks).map(([week, entries]) => [+week, entries])),
  );
}

beforeEach(() => {
  backend.campaigns.clear();
  backend.failing = () => false;
  backend.pending = () => false;
  cache = queryCacheFixture(resolve);
});

afterEach(() => cache.client.clear());

const openWeek: CampaignWeek = { kind: 'week', week: 70 };

// The route: the address holds the selection; Back and Forward walk it.
function Harness({
  campaign = 'campaign',
  initial = {},
  campaignWeek = openWeek,
}: {
  campaign?: string;
  initial?: HistorySelection;
  campaignWeek?: CampaignWeek;
}) {
  const [history, setHistory] = useState({ entries: [initial], at: 0 });
  const selection = history.entries[history.at]!;
  const go = (next: HistorySelection) =>
    setHistory(({ entries, at }) => ({
      entries: [...entries.slice(0, at + 1), next],
      at: at + 1,
    }));
  navigate = (href) =>
    go(parseHistorySelection(new URL(href, 'http://app').searchParams));
  return (
    <>
      <p data-testid="address">{historyPath(campaign, selection)}</p>
      <button
        type="button"
        onClick={() => setHistory((state) => ({ ...state, at: state.at - 1 }))}
      >
        Browser back
      </button>
      <button
        type="button"
        onClick={() => setHistory((state) => ({ ...state, at: state.at + 1 }))}
      >
        Browser forward
      </button>
      <CanonicalHistoryScreen
        campaign={campaign}
        selection={selection}
        select={go}
        campaignWeek={campaignWeek}
      />
    </>
  );
}
const show = (props: ComponentProps<typeof Harness> = {}) =>
  render(<Harness {...props} />, { wrapper: cache.wrapper });
const address = () => screen.getByTestId('address').textContent;
const weekRows = () =>
  within(screen.getByRole('navigation', { name: 'Finished weeks' }))
    .getAllByRole('link')
    .map((link) => /^Week (\d+)/.exec(link.textContent ?? '')?.[1]);
const finalOutcome = () =>
  screen.getByRole('region', { name: 'Result' }).textContent;
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const entries = (week: number) =>
  within(screen.getByRole('list', { name: `Entries for week ${week}` }))
    .getAllByRole('button', { name: /^Entry/ })
    .map((button) => /^Entry (\d+)/.exec(button.textContent ?? '')?.[1]);

// ---------- Tests ----------

test('a Ruleset Version 6 record shows its recorded Ruleset Version in the pane header', async () => {
  seed('campaign', { 3: chain(3, 1), 4: chain(4, 1, [6]) });
  show();
  const header = within(await screen.findByRole('article', { name: 'Week 4' }));
  expect(header.getByText('Ruleset 6')).toBeInTheDocument();
  expect(header.queryByText('Ruleset 1')).not.toBeInTheDocument();
});

test('[shell.history] opens the latest finished week, selected at the bottom of an oldest-first index', async () => {
  seed('campaign', { 2: chain(2, 1), 5: chain(5, 1), 9: chain(9, 1) });
  show();
  await screen.findByRole('heading', { level: 1, name: 'Week 9' });
  expect(weekRows()).toEqual(['2', '5', '9']);
  const latest = screen.getByRole('link', { current: 'page' });
  expect(latest).toHaveTextContent(/^Week 9/);
  expect(latest).toHaveTextContent('Recorded outcome available');
  expect(screen.getByText('Week 70 is in progress.')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Return to current week' }),
  ).toHaveAttribute('href', '/campaigns/campaign/week');
  // The header's date is this record's own creation date.
  const time = within(
    screen.getByRole('article', { name: 'Week 9' }),
  ).getAllByText((_, element) => element?.tagName === 'TIME')[0]!;
  expect(time).toHaveAttribute(
    'dateTime',
    new Date(march + 9 * day).toISOString(),
  );
  expect(screen.getByText('Ruleset 1')).toBeInTheDocument();
  expect(screen.getByText('Confirmed week')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /entries/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/^Read-only\. Recorded when the week was confirmed\./),
  ).toBeInTheDocument();
  // Nothing follows the latest week; the previous one skips the gap.
  expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Previous week' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/history?week=5',
  );
  expect(
    screen.queryByRole('heading', { name: 'History correction' }),
  ).not.toBeInTheDocument();
  expect(address()).toBe('/campaigns/campaign/history');
});

test('[rules.P86.controls] changing week resets the entries list, and the address carries each selection through Back and Forward', async () => {
  seed('campaign', { 3: chain(3, 1), 4: chain(4, 3, [1, 2, 3]) });
  show({ initial: { week: 4 } });
  await screen.findByRole('heading', { level: 1, name: 'Week 4' });
  const toggle = screen.getByRole('button', { name: /3 entries/ });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(entries(4)).toEqual(['3', '2', '1']);
  fireEvent.click(screen.getByRole('button', { name: /^Entry 1/ }));
  expect(address()).toBe('/campaigns/campaign/history?week=4&recordId=w4-e0');
  await waitFor(() => expect(finalOutcome()).toContain('1400'));
  expect(screen.getByText('Earlier entry 1 of 3')).toBeInTheDocument();
  // The disclosure stays open while choosing within the week.
  expect(screen.getByRole('button', { name: /^Entry 1/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  fireEvent.click(screen.getByRole('link', { name: 'Previous week' }));
  expect(address()).toBe('/campaigns/campaign/history?week=3');
  await screen.findByRole('heading', { level: 1, name: 'Week 3' });
  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  await waitFor(() => expect(finalOutcome()).toContain('1400'));
  expect(heading()).toBe('Week 4');
  // Returning to the week starts with its entries closed again.
  expect(screen.getByRole('button', { name: /3 entries/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(screen.getByText('Earlier entry 1 of 3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Browser forward' }));
  await screen.findByRole('heading', { level: 1, name: 'Week 3' });
  expect(finalOutcome()).toContain('1300');
  // Selecting the week's row returns to its effective record.
  fireEvent.click(screen.getByRole('link', { name: /^Week 4/ }));
  expect(address()).toBe('/campaigns/campaign/history?week=4');
  await waitFor(() => expect(finalOutcome()).toContain('1402'));
  expect(screen.queryByText(/Earlier entry/)).not.toBeInTheDocument();
});

test('[rules.HIST-04.selected-entry] an earlier entry shows only its own record in all six sections, and a different week starts without Show all', async () => {
  seed('campaign', { 3: chain(3, 1), 4: chain(4, 3) });
  show({ initial: { week: 4, recordId: 'w4-e0' } });
  const pane = within(await screen.findByRole('article', { name: 'Week 4' }));
  await pane.findByText('Earlier entry 1 of 3');
  const sections = pane
    .getAllByRole('region')
    .map((section) => section.getAttribute('aria-label'));
  expect(sections).toEqual([
    '1 Upkeep',
    '2 Activity',
    '3 Event',
    '4 Persistent',
    'Table Adjustments',
    'Result',
  ]);
  const adjustments = within(
    pane.getByRole('region', { name: 'Table Adjustments' }),
  );
  expect(adjustments.getByText('Ruling of week 4, entry 1')).toBeVisible();
  expect(adjustments.queryByText('Ruling of week 4, entry 3')).toBeNull();
  expect(finalOutcome()).toContain('1400');
  expect(finalOutcome()).not.toContain('1402');
  // Read-only: one merged footer line, and no control but Show all values.
  expect(
    pane.getByText(
      "Read-only. Recorded when the week was confirmed. Corrections to a finished week aren't available yet.",
    ),
  ).toBeInTheDocument();
  expect(
    pane.queryByRole('button', { name: /Confirm|Save|Remove|Add|Edit/ }),
  ).toBeNull();
  expect(pane.queryByRole('textbox')).toBeNull();
  const showAll = () => screen.getByRole('button', { name: 'Show all values' });
  fireEvent.click(showAll());
  expect(showAll()).toHaveAttribute('aria-pressed', 'true');
  expect(finalOutcome()).toContain('Skip first Upkeep');
  fireEvent.click(screen.getByRole('link', { name: 'Previous week' }));
  await screen.findByRole('heading', { level: 1, name: 'Week 3' });
  expect(showAll()).toHaveAttribute('aria-pressed', 'false');
  expect(finalOutcome()).not.toContain('Skip first Upkeep');
});

test('pages a chain of more than ten entries five at a time without reloading the selected record, reading Ruleset Versions only for the visible page', async () => {
  seed('campaign', {
    7: chain(
      7,
      13,
      Array.from({ length: 13 }, (_, i) => 10 + i),
    ),
  });
  show({ initial: { week: 7 } });
  await screen.findByRole('heading', { level: 1, name: 'Week 7' });
  fireEvent.click(screen.getByRole('button', { name: /13 entries/ }));
  expect(entries(7)).toEqual(['13', '12', '11', '10', '9']);
  // The effective entry's Ruleset comes from the shown record; four more reads.
  const metadata = () => reads((args) => args.recordId !== undefined);
  await waitFor(() => expect(metadata()).toHaveLength(4));
  // Header and effective entry both show the shown record's Ruleset.
  expect(screen.getAllByText('Ruleset 22')).toHaveLength(2);
  await waitFor(() =>
    expect(screen.getByText('Ruleset 18')).toBeInTheDocument(),
  );
  const readsOpened = cache.opened.length;

  fireEvent.click(screen.getByRole('button', { name: 'Earlier entries' }));
  expect(address()).toBe('/campaigns/campaign/history?week=7&beforeSequence=8');
  await waitFor(() => expect(entries(7)).toEqual(['8', '7', '6', '5', '4']));
  expect(finalOutcome()).toContain('1712');
  // Only the visible page is observed; prior pages stay warm in the cache.
  expect(
    metadata()
      .map((read) => read.args.recordId)
      .sort(),
  ).toEqual(['w7-e3', 'w7-e4', 'w7-e5', 'w7-e6', 'w7-e7']);
  // Paging opened the older page and its Ruleset reads, never the record again.
  expect(
    cache.opened
      .slice(readsOpened)
      .filter((read) => read.args.beforeSequence === undefined)
      .every((read) => read.args.recordId !== undefined),
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Earlier entries' }));
  await waitFor(() => expect(entries(7)).toEqual(['3', '2', '1']));
  expect(
    screen.queryByRole('button', { name: 'Earlier entries' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Entry 2/ }));
  await waitFor(() => expect(finalOutcome()).toContain('1701'));
  expect(screen.getByText('Earlier entry 2 of 13')).toBeInTheDocument();
  expect(entries(7)).toEqual(['3', '2', '1']);
  // Reopening starts from the newest page again and keeps the chosen entry.
  const toggle = screen.getByRole('button', { name: /13 entries/ });
  fireEvent.click(toggle);
  expect(
    screen.queryByRole('list', { name: 'Entries for week 7' }),
  ).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(address()).toBe('/campaigns/campaign/history?week=7&recordId=w7-e1');
  await waitFor(() =>
    expect(entries(7)).toEqual(['13', '12', '11', '10', '9']),
  );
  expect(finalOutcome()).toContain('1701');
  expect(screen.getByText('Earlier entry 2 of 13')).toBeInTheDocument();
});

test('a direct link to an early entry shows its own record at once and finds its ordinal through bounded page reads', async () => {
  seed('campaign', { 7: chain(7, 13, [3, 4]) });
  backend.pending = (name, args) =>
    name === 'canonicalHistory:read' && args.beforeSequence !== undefined;
  show({ initial: { week: 7, recordId: 'w7-e1' } });
  await screen.findByRole('heading', { level: 1, name: 'Week 7' });
  expect(finalOutcome()).toContain('1701');
  expect(screen.getByText('Ruleset 4')).toBeInTheDocument();
  expect(screen.getByText('Historical correction')).toBeInTheDocument();
  expect(screen.getByText('Earlier entry')).toBeInTheDocument();
  backend.pending = () => false;
  cleanup();
  cache.reads.length = 0;
  show({ initial: { week: 7, recordId: 'w7-e1' } });
  await screen.findByText('Earlier entry 2 of 13');
  expect(
    cache.reads
      .filter(({ args }) => args.beforeSequence !== undefined)
      .map(({ args }) => args.beforeSequence),
  ).toEqual([8, 3]);
});

test('a linked record that does not belong to the week is unavailable, never replaced by another entry', async () => {
  seed('campaign', { 7: chain(7, 2) });
  show({ initial: { week: 7, recordId: 'elsewhere' } });
  await screen.findByText("This entry isn't available.");
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect(
    screen.queryByRole('region', { name: 'Result' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('link', { name: 'Show the effective record' }),
  );
  await waitFor(() => expect(finalOutcome()).toContain('1701'));
});

test('a deep link outside the newest window loads only the window ending at that week and keeps the latest row at the bottom', async () => {
  seed(
    'campaign',
    Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [i + 1, chain(i + 1, 1)]),
    ),
  );
  show({ initial: { week: 5 } });
  await screen.findByRole('heading', { level: 1, name: 'Week 5' });
  await waitFor(() =>
    expect(lists()).toContainEqual({ campaignId: 'campaign', beforeWeek: 6 }),
  );
  await waitFor(() => expect(weekRows()).toHaveLength(30));
  expect(weekRows().slice(0, 6)).toEqual(['1', '2', '3', '4', '5', '36']);
  expect(weekRows().at(-1)).toBe('60');
  expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent(
    /^Week 5/,
  );
  // One control marks the omitted weeks 6–35; no invented rows fill them.
  const earlier = screen.getAllByRole('button', { name: 'Earlier weeks' });
  expect(earlier).toHaveLength(1);
  fireEvent.click(earlier[0]!);
  await waitFor(() => expect(weekRows()).toHaveLength(55));
  expect(lists()).toContainEqual({ campaignId: 'campaign', beforeWeek: 36 });
  // The latest row restores the newest window alone.
  fireEvent.click(screen.getByRole('link', { name: /^Week 60/ }));
  await screen.findByRole('heading', { level: 1, name: 'Week 60' });
  await waitFor(() => expect(lists()).toEqual([{ campaignId: 'campaign' }]));
  expect(weekRows()).toHaveLength(25);
  expect(
    screen.getByRole('button', { name: 'Earlier weeks' }),
  ).toBeInTheDocument();
});

test('a new correction updates the index and marker while a deliberately selected record stays pinned', async () => {
  seed('campaign', { 4: chain(4, 2) });
  show({ initial: { week: 4, recordId: 'w4-e1' } });
  await screen.findByRole('heading', { level: 1, name: 'Week 4' });
  expect(finalOutcome()).toContain('1401');
  expect(screen.queryByText(/Earlier entry/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent(
    'Corrected · 2 entries',
  );
  backend.campaigns.get('campaign')!.set(4, chain(4, 3));
  push();
  await screen.findByText('Earlier entry 2 of 3');
  expect(finalOutcome()).toContain('1401');
  expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent(
    'Corrected · 3 entries',
  );
});

test('without an explicit record the week follows its newly effective entry', async () => {
  seed('campaign', { 4: chain(4, 1) });
  show();
  await screen.findByRole('heading', { level: 1, name: 'Week 4' });
  expect(finalOutcome()).toContain('1400');
  backend.campaigns.get('campaign')!.set(4, chain(4, 2));
  backend.campaigns.get('campaign')!.set(5, chain(5, 1));
  push();
  await screen.findByRole('heading', { level: 1, name: 'Week 5' });
  expect(weekRows()).toEqual(['4', '5']);
});

test('a failed Ruleset read stays with its entry and retries alone', async () => {
  seed('campaign', { 7: chain(7, 4, [1, 2, 3, 4]) });
  backend.failing = (name, args) => args.recordId === 'w7-e1';
  show({ initial: { week: 7 } });
  await screen.findByRole('heading', { level: 1, name: 'Week 7' });
  fireEvent.click(screen.getByRole('button', { name: /4 entries/ }));
  await screen.findByText('Ruleset unavailable');
  expect(screen.getByText('Ruleset 1')).toBeInTheDocument();
  expect(screen.getByText('Ruleset 3')).toBeInTheDocument();
  expect(finalOutcome()).toContain('1703');
  const others = cache.opened.filter((read) => read.args.recordId === 'w7-e0');
  backend.failing = () => false;
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Try loading the Ruleset for Entry 2 again',
    }),
  );
  await screen.findByText('Ruleset 2');
  expect(cache.opened.filter((read) => read.args.recordId === 'w7-e0')).toEqual(
    others,
  );
});

test('a failed index keeps the selected record readable and retries on its own', async () => {
  seed('campaign', { 2: chain(2, 1), 3: chain(3, 1) });
  backend.failing = (name) => name === 'canonicalHistory:list';
  show({ initial: { week: 2 } });
  await screen.findByRole('heading', { level: 1, name: 'Week 2' });
  expect(finalOutcome()).toContain('1200');
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Finished weeks could not be loaded.',
  );
  backend.failing = () => false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(weekRows()).toEqual(['2', '3']));
});

test('a failed page offers Try again and recovers', async () => {
  seed('campaign', { 2: chain(2, 1) });
  backend.failing = () => true;
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Finished weeks could not be loaded.',
  );
  expect(screen.queryByText('Reload history')).not.toBeInTheDocument();
  backend.failing = () => false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('heading', { level: 1, name: 'Week 2' });
});

test('loading shows a history skeleton with a status', () => {
  seed('campaign', { 2: chain(2, 1) });
  backend.pending = () => true;
  show();
  expect(screen.getByRole('status')).toHaveTextContent('Loading history…');
});

test('no finished weeks offers the open week; without a militia nothing is read and setup is offered', async () => {
  seed('campaign', {});
  show();
  await screen.findByText('No finished weeks yet.');
  expect(screen.getByRole('link', { name: 'Open week 70' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/week',
  );
  cleanup();
  cache.opened.length = 0;
  show({ campaignWeek: { kind: 'not_set_up' } });
  expect(screen.getByText('No finished weeks yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Set up militia' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/setup',
  );
  expect(cache.opened).toEqual([]);
});

test('a week without a record is unavailable while the index stays reachable', async () => {
  seed('campaign', { 2: chain(2, 1) });
  show({ initial: { week: 9 } });
  await screen.findByText('Week 9 has no finished record.');
  expect(weekRows()).toEqual(['2']);
  fireEvent.click(
    screen.getByRole('link', { name: 'Show the latest finished week' }),
  );
  await screen.findByRole('heading', { level: 1, name: 'Week 2' });
});

test('switching campaign never shows the previous campaign’s weeks', async () => {
  seed('campaign', { 2: chain(2, 1) });
  seed('other', { 8: chain(8, 1) });
  const view = show();
  await screen.findByRole('heading', { level: 1, name: 'Week 2' });
  backend.pending = (name, args) => args.campaignId === 'other';
  view.rerender(<Harness campaign="other" />);
  expect(
    screen.queryByRole('heading', { level: 1, name: 'Week 2' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/^Week 2/)).not.toBeInTheDocument();
  expect(lists().every((args) => args.campaignId === 'other')).toBe(true);
  backend.pending = () => false;
  push();
  await screen.findByRole('heading', { level: 1, name: 'Week 8' });
});
