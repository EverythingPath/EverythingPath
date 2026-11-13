import type { Id } from '@convex/_generated/dataModel';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { SaveStatus } from './save-status';
import { SelectionPicker } from './selection-picker';
import { retiredChoiceReason } from './retired-catalog-choices';
import type {
  SelectionCandidateView,
  SelectionControls,
  SelectionPreview,
  SelectionSlotView,
} from './selection-view-types';

// The feat and trait picker on its own: search, empty catalogs, a slot or
// candidate the sheet no longer offers, a preview that cannot be worked out,
// and a failed save that keeps the player's input.

const maintenance = vi.fn<() => MigrationMaintenance>();
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

beforeEach(() => {
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const generalFeats: SelectionSlotView = {
  id: 'feat:general',
  kind: 'feat',
  label: 'General feats',
  count: 1,
  used: 0,
  remaining: 1,
  rows: [],
};
function choice(name: string, kind: 'feat' | 'trait' = 'feat') {
  return {
    catalogEntryId: name
      .toLowerCase()
      .replaceAll(' ', '-') as Id<'catalogEntry'>,
    name,
    kind,
    prerequisiteText: '',
    description: '',
    guidanceText: '',
    unavailableReason: null,
    label: undefined,
  } satisfies SelectionCandidateView;
}
const preview: SelectionPreview = {
  catalogEntryId: 'dodge' as Id<'catalogEntry'>,
  name: 'Dodge',
  currentStatus: 'met',
  recordedStatus: null,
  recordedLevelLabel: null,
  currentChecks: [],
  recordedChecks: [],
  currentWarnings: [],
  recordedWarnings: [],
  otherWarnings: [],
  checks: [],
  prerequisiteText: 'Dex 13.',
  description: '',
  guidanceText: '',
  warnings: [],
  isSelectable: true,
};

function renderPicker({
  candidates = [
    choice('Dodge'),
    choice('Toughness'),
    choice('Reactionary', 'trait'),
  ],
  previewResult = () => preview,
  fill = vi.fn(() => Promise.resolve(true)),
  status = { kind: 'idle' },
}: {
  candidates?: SelectionCandidateView[];
  previewResult?: SelectionControls['preview'];
  fill?: SelectionControls['fill'];
  status?: SaveStatus;
} = {}) {
  const controls = {
    preview: previewResult,
    fill,
    statusForSlot: () => status,
  } as unknown as SelectionControls;
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <SelectionPicker
      slot={generalFeats}
      position={0}
      replacing={null}
      candidates={candidates}
      levels={[]}
      controls={controls}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return { fill, onClose, onSaved };
}

test('only the slot’s kind is offered, the search narrows it, and an empty catalog says so', () => {
  renderPicker();
  expect(screen.getByRole('button', { name: 'Dodge' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Reactionary' })).toBeNull();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search feats' }), {
    target: { value: 'tough' },
  });
  expect(screen.queryByRole('button', { name: 'Dodge' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Toughness' })).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search feats' }), {
    target: { value: 'zzz' },
  });
  expect(screen.getByText('No feats match “zzz”.')).toBeVisible();
});

test('a feat slot with no feats in the catalog shows No feats available', () => {
  renderPicker({ candidates: [choice('Reactionary', 'trait')] });
  expect(screen.getByText('No feats available')).toBeVisible();
  expect(screen.queryByRole('searchbox')).toBeNull();
});

test('a slot the sheet no longer offers refuses the card with a reason and stages nothing', () => {
  const { fill } = renderPicker({ previewResult: () => null });
  const card = screen.getByRole('button', { name: 'Dodge' });
  fireEvent.click(card);
  expect(card).toHaveAttribute('aria-pressed', 'false');
  expect(
    screen.getByText('This slot is no longer on the sheet. Nothing changed.'),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Add Dodge' })).toBeNull();
  expect(fill).not.toHaveBeenCalled();
});

test('a preview that cannot be worked out never blocks the choice', async () => {
  const { fill, onSaved } = renderPicker({
    previewResult: () => {
      throw new Error('calculation failed');
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Dodge' }));
  expect(
    screen.getByText(
      'Prerequisites can’t be shown right now. You can still add it.',
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Add Dodge' }));
  await act(async () => undefined);
  expect(fill).toHaveBeenCalledWith({
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: 'dodge',
    choice: null,
    gainedAtClassLevel: null,
  });
  expect(onSaved).toHaveBeenCalledOnce();
});

test('a failed save keeps the staged card and choice, and Escape leaves without an edit', async () => {
  const { fill, onClose, onSaved } = renderPicker({
    fill: vi.fn(() => Promise.resolve(false)),
    status: { kind: 'error', message: "Selection wasn't saved. Try again." },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Dodge' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Choice' }), {
    target: { value: 'Shield' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add Dodge' }));
  await act(async () => undefined);
  expect(fill).toHaveBeenCalledOnce();
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    "Selection wasn't saved. Try again.",
  );
  expect(screen.getByRole('textbox', { name: 'Choice' })).toHaveValue('Shield');
  expect(screen.getByRole('button', { name: 'Dodge' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Choice' }), {
    key: 'Escape',
  });
  expect(onClose).toHaveBeenCalledOnce();
});

test('a long catalog shows the first cards and asks for a search', () => {
  renderPicker({
    candidates: Array.from({ length: 35 }, (_, index) =>
      choice(`Feat ${String(index).padStart(2, '0')}`),
    ),
  });
  expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(30);
  expect(
    screen.getByText('Showing 30 of 35. Search to narrow the list.'),
  ).toBeVisible();
});

// #411: CRB p. 119 Cleave, retired by a release; the Character's pickers show
// it with the reason and never stage it.
test('a retired feat shows its reason and cannot be staged', () => {
  const { fill } = renderPicker({
    candidates: [
      choice('Dodge'),
      { ...choice('Cleave'), unavailableReason: retiredChoiceReason },
    ],
  });
  const card = screen.getByRole('button', { name: 'Cleave' });
  expect(card).toBeDisabled();
  expect(card).toHaveAccessibleDescription(
    expect.stringContaining(retiredChoiceReason),
  );
  fireEvent.click(card);
  expect(card).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('button', { name: 'Add Cleave' })).toBeNull();
  expect(fill).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Dodge' })).toBeEnabled();
});

// jsdom performs neither Tab navigation nor a native button's Enter or Space
// activation, and the project has no user-event, so this is the jsdom
// equivalent of Tab then Enter: the control must be a native, enabled button
// in the tab order (tabIndex 0) that no ancestor makes inert or hidden; it is
// focused, its Enter keydown must not be cancelled, and it then gets the click
// a real Enter produces on a native button (detail 0). A tabIndex of -1, a
// non-button control or a cancelled Enter fails here.
function pressWithKeyboard(control: HTMLElement) {
  expect(control).toBeInstanceOf(HTMLButtonElement);
  expect(control).toBeEnabled();
  expect(control.tabIndex).toBe(0);
  expect(control).toBeVisible();
  for (
    let node: HTMLElement | null = control;
    node;
    node = node.parentElement
  ) {
    expect(node).not.toHaveAttribute('inert');
    expect(node).not.toHaveAttribute('aria-hidden', 'true');
  }
  control.focus();
  expect(control).toHaveFocus();
  expect(fireEvent.keyDown(control, { key: 'Enter', code: 'Enter' })).toBe(
    true,
  );
  fireEvent.click(control, { detail: 0 });
}

test('an unverified card says so and is described by its reasons in plain words, which its staged detail shows as text when staged by keyboard; a verified or unlabelled card shows no label, and an unverified card still stages and saves', async () => {
  const { fill } = renderPicker({
    previewResult: () => ({
      ...preview,
      catalogEntryId: 'power-attack' as Id<'catalogEntry'>,
      name: 'Power Attack',
    }),
    candidates: [
      {
        ...choice('Power Attack'),
        description: 'Trade attack for damage.',
        label: {
          state: 'unverified',
          reasons: ['no curation record', 'unproven mechanism', 'a new reason'],
        },
      },
      { ...choice('Dodge'), label: { state: 'verified' } },
      choice('Toughness'),
    ],
  });
  const card = screen.getByRole('button', { name: 'Power Attack' });
  expect(within(card).getByText('Unverified')).toBeVisible();
  expect(within(card).getByText('Unverified')).not.toHaveAttribute('title');
  expect(card).toHaveAccessibleDescription(
    'No curation record. Mechanics not yet proven. Not yet verified. Trade attack for damage.',
  );
  expect(screen.queryByText('a new reason')).toBeNull();
  for (const name of ['Dodge', 'Toughness']) {
    const plain = screen.getByRole('button', { name });
    expect(within(plain).queryByText(/verified/i)).toBeNull();
    expect(plain).not.toHaveAccessibleDescription();
  }

  // Before staging, the card's reasons are for a screen reader only.
  expect(
    within(card).getByText(
      'No curation record. Mechanics not yet proven. Not yet verified.',
    ),
  ).toHaveClass('sr-only');

  // Tab to the card and stage it with Enter: the staged detail shows the
  // reasons as text.
  pressWithKeyboard(card);
  expect(card).toHaveAttribute('aria-pressed', 'true');
  const staged = screen.getByRole('group', { name: 'General feats selection' });
  const reasons = within(staged).getByText(
    'No curation record. Mechanics not yet proven. Not yet verified.',
  );
  expect(reasons).toBeVisible();
  expect(reasons).not.toHaveClass('sr-only');
  expect(within(staged).getByText('Unverified')).toBeVisible();

  pressWithKeyboard(screen.getByRole('button', { name: 'Dodge' }));
  expect(within(staged).queryByText(/verified/i)).toBeNull();

  fireEvent.click(card, { detail: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Add Power Attack' }));
  await act(async () => undefined);
  expect(fill).toHaveBeenCalledWith(
    expect.objectContaining({ catalogEntryId: 'power-attack' }),
  );
});

// A card that cannot be staged never reaches the staged detail, so it shows
// its Unverified reasons as text itself.
test('a retired unverified card shows Unverified and its reasons as text and still cannot be staged', () => {
  const { fill } = renderPicker({
    candidates: [
      choice('Dodge'),
      {
        ...choice('Cleave'),
        unavailableReason: retiredChoiceReason,
        label: { state: 'unverified', reasons: ['no curation record'] },
      },
    ],
  });
  const card = screen.getByRole('button', { name: 'Cleave' });
  expect(card).toBeDisabled();
  expect(within(card).getByText('Unverified')).toBeVisible();
  const reasons = within(card).getByText('No curation record.');
  expect(reasons).toBeVisible();
  expect(reasons).not.toHaveClass('sr-only');
  expect(card).toHaveAccessibleDescription(
    `${retiredChoiceReason} No curation record.`,
  );
  fireEvent.click(card);
  expect(card).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('button', { name: 'Add Cleave' })).toBeNull();
  expect(fill).not.toHaveBeenCalled();
});

test.each([
  ['read-only', { kind: 'idle' }, true],
  ['saving', { kind: 'saving' }, false],
] as const)(
  'while the picker is %s, an unverified card shows its reasons as text and cannot be staged',
  (_, status, readOnly) => {
    if (readOnly)
      maintenance.mockReturnValue({
        kind: 'maintenance',
        readOnly: true,
        message: 'Read-only during maintenance.',
      });
    renderPicker({
      status,
      candidates: [
        {
          ...choice('Power Attack'),
          label: { state: 'unverified', reasons: ['unproven mechanism'] },
        },
      ],
    });
    const card = screen.getByRole('button', { name: 'Power Attack' });
    const reasons = within(card).getByText('Mechanics not yet proven.');
    expect(reasons).toBeVisible();
    expect(reasons).not.toHaveClass('sr-only');
    fireEvent.click(card, { detail: 0 });
    expect(card).toHaveAttribute('aria-pressed', 'false');
  },
);
