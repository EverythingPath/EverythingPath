import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { MilitiaSection } from '~/components/campaign-sections/militia-section';
import { stableControl } from '../../../tests/stable-control';
import { REASON_LABEL } from './correction-copy';
import { convexNames } from '../../../tests/convex-names';
import { api } from '@convex/_generated/api';

type Call = {
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let queries: Record<string, unknown> = {};

const nameOf = convexNames({
  workspace: api.canonicalDraftPersistence.workspace,
  observe: api.canonicalDraftPersistence.observe,
  read: api.canonicalLedger.read,
  save: api.canonicalLedger.save,
});
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock('convex/react', () => ({
  useMutation: () => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ args, resolve, reject });
    }),
}));
vi.mock('@tanstack/react-query', async () => {
  const { queryDataMock } = await import('../../../tests/query-data');
  return queryDataMock((name) => queries[nameOf(name)]);
});
vi.mock('~/lib/sharedQueries', () => ({
  useCharacterLedgerQuery: () => ({
    data: [
      {
        _id: 'officer',
        name: 'Ada',
        level: 12,
        strength: 10,
        dexterity: 11,
        constitution: 12,
        intelligence: 13,
        wisdom: 14,
        charisma: 15,
      },
    ],
  }),
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const campaignId = 'campaign' as Id<'campaign'>;
const state = (): CanonicalWeekState =>
  structuredClone(acceptedCampaignSetup('officer').state);
function setMilitia(
  ledger: { revision: number; state: CanonicalWeekState },
  draftId = 'draft-9',
) {
  queries = {
    workspace: {
      key: { campaignId, militiaId: 'militia', draftId },
      week: ledger.state.week,
    },
    read: ledger,
    observe: undefined,
  };
}
function mount() {
  return render(
    <MilitiaSection campaignId={campaignId} organizationId="org" />,
  );
}
function rerender(view: ReturnType<typeof mount>) {
  view.rerender(
    <MilitiaSection campaignId={campaignId} organizationId="org" />,
  );
}
const index = () =>
  screen.getByRole('navigation', { name: 'Militia sections' });
const entry = (name: RegExp) => within(index()).getByRole('button', { name });
const summary = () =>
  screen
    .getByText('Fix these before saving')
    .closest<HTMLElement>('[role="alert"]')!;

// The open Values editor's controls, looked up once inside the editor and
// re-checked on each use (see tests/stable-control.ts). Look them up again
// after the editor remounts (Start again, a new correction).
function valuesEditor() {
  const editor = within(
    screen
      .getByRole('heading', { name: 'Correct values' })
      .closest<HTMLElement>('section')!,
  );
  return {
    treasury: stableControl('textbox', 'Treasury (copper)', editor),
    training: stableControl('textbox', 'Training', editor),
    notoriety: stableControl('textbox', 'Notoriety', editor),
    reason: stableControl('textbox', 'Reason for correction', editor),
    save: stableControl('button', 'Save correction', editor),
    cancel: stableControl('button', 'Cancel', editor),
  };
}
type ValuesEditor = ReturnType<typeof valuesEditor>;

function openValues(view = mount()) {
  fireEvent.click(screen.getByRole('button', { name: 'Correct values' }));
  return { view, ...valuesEditor() };
}
function correctTreasury(
  editor: ValuesEditor,
  value: string,
  why = 'Found a purse at the table',
) {
  fireEvent.change(editor.treasury(), { target: { value } });
  fireEvent.change(editor.reason(), { target: { value: why } });
}
async function save(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}
const noReasonField = () =>
  expect(screen.queryByLabelText('Reason for correction')).toBeNull();

beforeEach(() => {
  calls = [];
  setMilitia({ revision: 3, state: state() });
});

describe('read view', () => {
  test('lists the nine sections and the read-only week view with counts and warnings', () => {
    mount();
    const names = within(index())
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names).toEqual([
      'ValuesFocus Security · Rank 4 · Training 42',
      expect.stringMatching(/^Teams.*1 entry/),
      expect.stringMatching(/^Settlements.*1/),
      expect.stringMatching(/^Character conditions.*0/),
      expect.stringMatching(/^Items.*1/),
      expect.stringMatching(/^Caches.*1/),
      expect.stringMatching(/^Orders.*1/),
      expect.stringMatching(/^Marketplaces.*0/),
      expect.stringMatching(/^Carried benefits.*0/),
      expect.stringMatching(/^Week & carried effects.*3 entries/),
    ]);
    expect(entry(/^Values/)).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('123.45 gp (12,345 cp)')).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  test('Week & carried effects is read-only: week facts, carried events, queued effects and bonuses without controls', () => {
    mount();
    fireEvent.click(entry(/^Week & carried effects/));
    const pane = screen.getByRole('region', { name: 'Week & carried effects' });
    expect(within(pane).getByText('Sickness · Event 1')).toBeVisible();
    expect(within(pane).getByText('Patrol')).toBeVisible();
    expect(within(pane).getByText('Week 6')).toBeVisible();
    expect(within(pane).getByText('+2 Loyalty check')).toBeVisible();
    expect(within(pane).queryByRole('button')).toBeNull();
    expect(within(pane).queryByRole('textbox')).toBeNull();
  });

  test('shows the loading status and the no-militia page', () => {
    queries = { workspace: undefined };
    const view = mount();
    expect(
      screen.getByRole('status', { name: 'Loading militia ledger…' }),
    ).toBeVisible();
    queries = { workspace: null };
    rerender(view);
    expect(screen.getByText('No militia yet.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Set up militia' }),
    ).toHaveAttribute('href', '/campaigns/campaign/setup');
  });
});

describe('Values correction', () => {
  test('only one correction is open: every other entry is disabled until Save or Cancel, and Cancel writes nothing', () => {
    const editor = openValues();
    for (const button of within(index()).getAllByRole('button'))
      if (!(button.textContent ?? '').startsWith('Values'))
        expect(button).toBeDisabled();
    expect(editor.treasury()).toHaveValue('12345');
    fireEvent.change(editor.treasury(), { target: { value: '1' } });
    fireEvent.click(editor.cancel());
    expect(calls).toHaveLength(0);
    expect(entry(/^Teams/)).toBeEnabled();
    expect(screen.getByText('123.45 gp (12,345 cp)')).toBeVisible();
  });

  test.each([
    ['', 'Reason for correction is required.'],
    ['   ', 'Reason for correction is required.'],
    [
      'x'.repeat(2001),
      'Reason for correction must be 2,000 characters or fewer.',
    ],
  ])(
    'a reason of %j is refused inline and in the save summary without a write',
    async (text, message) => {
      const editor = openValues();
      correctTreasury(editor, '50000', text);
      await save(editor.save());
      expect(calls).toHaveLength(0);
      expect(editor.reason()).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getAllByText(message).length).toBeGreaterThanOrEqual(1);
      expect(summary()).toHaveTextContent(message);
    },
  );

  test('empty and malformed values are distinguished in a summary linked to their fields', async () => {
    const editor = openValues();
    fireEvent.change(editor.treasury(), { target: { value: '' } });
    fireEvent.change(editor.training(), { target: { value: '4x' } });
    fireEvent.change(editor.reason(), { target: { value: 'Recount' } });
    await save(editor.save());
    expect(calls).toHaveLength(0);
    const links = within(summary());
    const required = links.getByRole('button', {
      name: 'Treasury (copper) is required.',
    });
    links.getByRole('button', {
      name: 'Enter a valid whole number for Training.',
    });
    fireEvent.click(required);
    await waitFor(() => expect(editor.treasury()).toHaveFocus());
    fireEvent.change(editor.treasury(), { target: { value: '50000' } });
    fireEvent.change(editor.training(), { target: { value: '42' } });
    await save(editor.save());
    expect(calls).toHaveLength(1);
  });

  test('the error link for a choice field focuses its first choice', async () => {
    const missing = state();
    delete (missing.militiaSnapshot as { focus?: unknown }).focus;
    setMilitia({ revision: 3, state: missing });
    const editor = openValues();
    fireEvent.change(editor.reason(), { target: { value: 'Recount' } });
    await save(editor.save());
    expect(calls).toHaveLength(0);
    const link = within(summary()).getByRole('button', { name: /Focus/ });
    fireEvent.click(link);
    const focus = screen.getByRole('group', { name: 'Focus' });
    await waitFor(() =>
      expect(
        within(focus).getByRole('button', { name: 'Loyalty' }),
      ).toHaveFocus(),
    );
  });

  test('rules warnings stay advisory: a below-minimum treasury still saves', async () => {
    const editor = openValues();
    fireEvent.change(editor.treasury(), { target: { value: '1' } });
    fireEvent.change(editor.reason(), { target: { value: 'Recount' } });
    expect(
      screen.getByRole('complementary', { name: 'Rules warnings' }),
    ).toHaveTextContent('Treasury is below the normal minimum');
    await save(editor.save());
    expect(calls).toHaveLength(1);
  });

  test('an unchanged section is not saved', async () => {
    const editor = openValues();
    fireEvent.change(editor.reason(), { target: { value: 'Nothing really' } });
    await save(editor.save());
    expect(calls).toHaveLength(0);
    expect(
      screen.getByText('Nothing to save: these values match the militia.'),
    ).toBeVisible();
  });

  test('Save merges Values onto the latest militia, prevents duplicates while pending and reports success', async () => {
    const editor = openValues();
    correctTreasury(editor, '50000', '  Found a purse  ');
    // Another player corrected Teams meanwhile.
    const latest = state();
    latest.militiaSnapshot.roster.teams[0]!.notes = 'Found by scouts';
    setMilitia({ revision: 4, state: latest });
    rerender(editor.view);
    const button = editor.save();
    await save(button);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.args).toMatchObject({
      campaignId,
      militiaId: 'militia',
      expectedRevision: 4,
      reason: 'Found a purse',
    });
    const snapshot = call!.args
      .snapshot as CanonicalWeekState['militiaSnapshot'];
    expect(snapshot.treasuryCopper).toBe(50000);
    expect(snapshot.roster.teams[0]?.notes).toBe('Found by scouts');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAccessibleName('Saving correction…');
    expect(button).toBeDisabled();
    await save(button);
    expect(calls).toHaveLength(1);

    const saved = state();
    saved.militiaSnapshot = snapshot;
    await act(async () => call!.resolve(5));
    setMilitia({ revision: 5, state: saved });
    rerender(editor.view);
    noReasonField();
    expect(screen.getAllByText('Values corrected.').length).toBeGreaterThan(0);
    expect(screen.getByText('500 gp (50,000 cp)')).toBeVisible();
  });
});

describe('concurrent changes', () => {
  test('the same section changed elsewhere shows theirs and yours without a write', async () => {
    const editor = openValues();
    correctTreasury(editor, '50000', 'Miscounted at the table');
    const theirs = state();
    theirs.militiaSnapshot.notoriety = 30;
    setMilitia({ revision: 4, state: theirs });
    rerender(editor.view);
    await save(editor.save());
    expect(calls).toHaveLength(0);
    expect(
      screen.getByText('Another player changed this section'),
    ).toBeVisible();
    const their = screen.getByRole('region', { name: 'Their values' });
    const your = screen.getByRole('region', { name: 'Your values' });
    expect(within(their).getByText('30')).toBeVisible();
    expect(within(their).getByText('123.45 gp (12,345 cp)')).toBeVisible();
    expect(within(your).getByText('500 gp (50,000 cp)')).toBeVisible();
    expect(within(your).getByText('17')).toBeVisible();
  });

  test('Start again from their values takes their section, clears the reason and saves at their revision', async () => {
    const editor = openValues();
    correctTreasury(editor, '50000', 'Miscounted at the table');
    const theirs = state();
    theirs.militiaSnapshot.notoriety = 30;
    setMilitia({ revision: 4, state: theirs });
    rerender(editor.view);
    await save(editor.save());
    fireEvent.click(
      screen.getByRole('button', { name: 'Start again from their values' }),
    );
    const restarted = valuesEditor();
    expect(restarted.reason()).toHaveValue('');
    expect(restarted.treasury()).toHaveValue('12345');
    expect(restarted.notoriety()).toHaveValue('30');
    correctTreasury(restarted, '40000', 'Recounted');
    await save(restarted.save());
    expect(calls[0]!.args).toMatchObject({ expectedRevision: 4 });
  });

  test('a refused Save after another write retries against the refreshed militia; the input and reason are kept', async () => {
    const editor = openValues();
    correctTreasury(editor, '50000');
    await save(editor.save());
    await act(async () =>
      calls[0]!.reject(
        new ConvexError(
          'Militia changed. Review the latest ledger before saving.',
        ),
      ),
    );
    const characterEdit = state();
    characterEdit.militiaSnapshot.characters[0]!.charisma = 20;
    setMilitia({ revision: 4, state: characterEdit });
    rerender(editor.view);
    expect(
      screen.getByText(
        /Another player changed the militia while you were saving/,
      ),
    ).toBeVisible();
    expect(editor.treasury()).toHaveValue('50000');
    expect(editor.reason()).toHaveValue('Found a purse at the table');
    await save(editor.save());
    expect(calls[1]!.args).toMatchObject({ expectedRevision: 4 });
    expect(
      (calls[1]!.args.snapshot as CanonicalWeekState['militiaSnapshot'])
        .characters[0]?.charisma,
    ).toBe(20);
  });

  test('an unknown acknowledgement is reconciled: matching values close without claiming the reason was stored', async () => {
    const editor = openValues();
    correctTreasury(editor, '50000');
    await save(editor.save());
    await act(async () => calls[0]!.reject(new Error('Connection lost')));
    expect(
      screen.getByText(/couldn't be confirmed and the militia doesn't show it/),
    ).toBeVisible();
    const applied = state();
    applied.militiaSnapshot.treasuryCopper = 50000;
    setMilitia({ revision: 4, state: applied });
    rerender(editor.view);
    noReasonField();
    expect(
      screen.getAllByText('Values now show your correction.').length,
    ).toBeGreaterThan(0);
    expect(calls).toHaveLength(1);
    // The page is free again for the next correction.
    const next = openValues(editor.view);
    expect(next.treasury()).toHaveValue('50000');
    expect(next.reason()).toHaveValue('');
  });

  test('a new week requires restarting from its facts', () => {
    const editor = openValues();
    correctTreasury(editor, '50000');
    const next = state();
    next.week = 10;
    setMilitia({ revision: 4, state: next }, 'draft-10');
    rerender(editor.view);
    expect(
      screen.getByText(/The week changed while you were correcting/),
    ).toBeVisible();
    expect(screen.queryByText('Save correction')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
    const restarted = valuesEditor();
    expect(restarted.treasury()).toHaveValue('12345');
    expect(restarted.reason()).toHaveValue('');
  });
});

describe('in-place corrections', () => {
  // The retired full editor's fields are all reachable: each section opens
  // its own editor here; roster people, Hit Dice and officer roles are
  // corrected on Characters & officers (characters-corrections.test.tsx).
  test.each([
    ['Values', 'Treasury (copper)'],
    ['Teams', 'Team name'],
    ['Settlements', 'Settlement name'],
    ['Character conditions', 'Add character condition'],
    ['Items', 'Add item'],
    ['Caches', 'Add cache'],
    ['Orders', 'Add order'],
    ['Marketplaces', 'Add marketplace'],
    ['Carried benefits', 'Add Market Day benefit'],
  ])('%s opens its own correction with its fields', (label, control) => {
    mount();
    fireEvent.click(entry(new RegExp(`^${label}`)));
    fireEvent.click(
      screen.getByRole('button', { name: `Correct ${label.toLowerCase()}` }),
    );
    const editor = within(
      screen
        .getByRole('heading', { name: `Correct ${label.toLowerCase()}` })
        .closest<HTMLElement>('section')!,
    );
    expect(editor.getAllByText(control).length).toBeGreaterThan(0);
    expect(editor.getByRole('textbox', { name: REASON_LABEL })).toBeVisible();
    fireEvent.click(editor.getByRole('button', { name: 'Cancel' }));
    expect(calls).toHaveLength(0);
  });
});

describe('phone layout', () => {
  test('rows expand one at a time and other rows are disabled while correcting', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    try {
      mount();
      const values = screen.getByRole('button', { name: /^Values/ });
      const teams = screen.getByRole('button', { name: /^Teams/ });
      expect(values).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(teams);
      expect(teams).toHaveAttribute('aria-expanded', 'true');
      expect(values).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(values);
      fireEvent.click(screen.getByRole('button', { name: 'Correct values' }));
      expect(teams).toBeDisabled();
      expect(teams).toHaveAccessibleName(/^Teams/);
      expect(
        screen.getByRole('textbox', { name: 'Reason for correction' }),
      ).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
