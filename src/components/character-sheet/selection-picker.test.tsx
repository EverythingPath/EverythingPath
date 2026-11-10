import type { Id } from '@convex/_generated/dataModel';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
