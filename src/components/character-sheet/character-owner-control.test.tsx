import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { FunctionReference } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexNames } from '../../../tests/convex-names';
import { useCharacterOwnership } from './use-character-ownership';
import { CharacterOwnerControl } from './character-owner-control';

// A campaign Character's owner control (#300): the owner named beside
// Assign owner, whose picker offers the campaign's current members. One
// nobody owns (#708) also offers Take ownership to the viewer themself.

type Member = { userId: Id<'user'>; name: string; isMine: boolean };
const transport = vi.hoisted(() => ({
  owner: undefined as undefined | null | Member,
  ownerLastOperationId: undefined as string | undefined,
  me: undefined as undefined | null | { _id: Id<'user'> },
  members: [] as Member[],
  membersStatus: 'Exhausted',
  readOnly: false,
  ownershipAvailable: true,
  mutate: vi.fn(),
  loadMore: vi.fn(),
}));
const nameOf = convexNames({ me: api.user.getMe });
vi.mock('convex/react', () => ({
  // Only the viewer's own account is read here, for Take ownership.
  useQuery: (query: FunctionReference<'query'>, args: unknown) => {
    if (args === 'skip') return undefined;
    if (nameOf(query) === 'me') return transport.me;
    throw new Error('Owner controls receive the owner from their parent read.');
  },
  useMutation: () => transport.mutate,
  usePaginatedQuery: () => ({
    results: transport.members,
    status: transport.membersStatus,
    loadMore: transport.loadMore,
  }),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: transport.readOnly ? 'maintenance' : 'ready',
    readOnly: transport.readOnly,
    message: transport.readOnly ? 'Editing is paused for maintenance.' : '',
  }),
}));

const characterId = 'character' as Id<'character'>;
const campaignId = 'campaign' as Id<'campaign'>;
const ada = { userId: 'ada' as Id<'user'>, name: 'Ada', isMine: false };
const bryn = { userId: 'bryn' as Id<'user'>, name: 'Bryn', isMine: true };

// A fresh element each time: React skips re-rendering an identical one.
function OwnershipHost({ campaignId }: { campaignId?: Id<'campaign'> }) {
  const ownership = useCharacterOwnership(
    { characterId, campaignId, organizationId: 'org' },
    transport.owner,
    transport.ownerLastOperationId,
    transport.ownershipAvailable,
  );
  return <CharacterOwnerControl characterName="Vessa" ownership={ownership} />;
}
const control = (scope: { campaignId?: Id<'campaign'> } = { campaignId }) => (
  <OwnershipHost {...scope} />
);
const assignButton = () =>
  screen.getByRole('button', { name: 'Assign owner for Vessa' });
const takeButton = () =>
  screen.getByRole('button', { name: 'Take ownership of Vessa' });
function openPicker() {
  fireEvent.click(assignButton());
  return within(screen.getByRole('dialog', { name: 'Choose owner' }));
}
async function assign(name: RegExp) {
  const picker = openPicker();
  fireEvent.click(picker.getByRole('radio', { name }));
  await act(async () => {
    fireEvent.click(picker.getByRole('button', { name: 'Assign owner' }));
  });
  return picker;
}
/** What the status regions in scope currently announce (idle ones are empty). */
const announcements = (scope: Pick<typeof screen, 'getAllByRole'>) =>
  scope
    .getAllByRole('status')
    .map((region) => region.textContent)
    .filter(Boolean);

beforeEach(() => {
  transport.ownershipAvailable = true;
  transport.owner = ada;
  transport.ownerLastOperationId = undefined;
  transport.me = { _id: bryn.userId };
  transport.members = [ada, bryn];
  transport.membersStatus = 'Exhausted';
  transport.readOnly = false;
  transport.mutate.mockResolvedValue(null);
});

test('names the owner, offers every current member with me and the current owner noted, and saves a choice at once', async () => {
  render(control());
  expect(screen.getByText('Owner')).toBeVisible();
  expect(screen.getByText('Ada')).toBeVisible();
  expect(screen.queryByText('(me)')).not.toBeInTheDocument();
  // The live region waits, empty and out of the layout, so its later text is
  // a change screen readers announce rather than a region inserted with text.
  const idleStatus = screen.getByRole('status');
  expect(idleStatus).toBeEmptyDOMElement();
  expect(idleStatus).toHaveClass('sr-only');

  const picker = openPicker();
  expect(picker.getByRole('radiogroup', { name: 'Members' })).toBeVisible();
  const adaChoice = picker.getByRole('radio', { name: /^Ada/ });
  expect(adaChoice).toBeVisible();
  expect(adaChoice.closest('label')).toHaveTextContent('current owner');
  const brynChoice = picker.getByRole('radio', { name: /^Bryn/ });
  expect(brynChoice.closest('label')).toHaveTextContent('me');
  expect(brynChoice.closest('label')).not.toHaveTextContent('current owner');
  expect(picker.getByRole('button', { name: 'Assign owner' })).toBeDisabled();
  expect(picker.queryByText(/approv|accept|GM/i)).not.toBeInTheDocument();

  fireEvent.click(brynChoice);
  await act(async () => {
    fireEvent.click(picker.getByRole('button', { name: 'Assign owner' }));
  });
  expect(transport.mutate).toHaveBeenCalledWith({
    characterId,
    campaignId,
    organizationId: 'org',
    ownerUserId: 'bryn',
    operationId: expect.any(String),
  });
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('status')).toHaveTextContent('Owner assigned.');
  expect(screen.getByRole('status')).not.toHaveClass('sr-only');
  await waitFor(() => expect(assignButton()).toHaveFocus());
});

test('a Character that needs an owner can be taken by the player themself, who then reads as me', async () => {
  transport.owner = null;
  const view = render(control());
  expect(screen.getByText('Needs an owner')).toBeVisible();
  await assign(/^Bryn/);
  expect(transport.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ ownerUserId: 'bryn' }),
  );
  transport.owner = bryn;
  view.rerender(control());
  expect(screen.getByText('Bryn')).toBeVisible();
  expect(screen.getByText('(me)')).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a Character nobody owns is taken in one click, without the picker, and then reads as me', async () => {
  transport.owner = null;
  const view = render(control());
  expect(screen.getByText('Needs an owner')).toBeVisible();
  expect(takeButton()).toBeEnabled();
  expect(assignButton()).toBeEnabled();
  await act(async () => {
    fireEvent.click(takeButton());
  });
  expect(transport.mutate).toHaveBeenCalledTimes(1);
  expect(transport.mutate).toHaveBeenCalledWith({
    characterId,
    campaignId,
    organizationId: 'org',
    ownerUserId: 'bryn',
    operationId: expect.any(String),
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Owner assigned.');
  transport.owner = bryn;
  view.rerender(control());
  expect(screen.getByText('Bryn')).toBeVisible();
  expect(screen.getByText('(me)')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /Take ownership/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/deleted|account|departed/i)).toBeNull();
});

test('Take ownership waits for the viewer’s own account and pauses with Assign owner for maintenance', () => {
  transport.owner = null;
  transport.me = undefined;
  const view = render(control());
  expect(takeButton()).toBeDisabled();
  expect(assignButton()).toBeEnabled();

  transport.me = { _id: bryn.userId };
  view.rerender(control());
  expect(takeButton()).toBeEnabled();

  transport.readOnly = true;
  view.rerender(control());
  expect(takeButton()).toBeDisabled();
  expect(assignButton()).toBeDisabled();
});

test('an owned Character offers Assign owner only', () => {
  render(control());
  expect(assignButton()).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: /Take ownership/ }),
  ).not.toBeInTheDocument();
});

test('losing its owner is announced as no longer having one, and a new member as another player’s change', () => {
  const view = render(control());
  transport.owner = null;
  view.rerender(control());
  expect(announcements(screen)).toEqual([
    expect.stringContaining('This Character no longer has an owner.'),
  ]);
  expect(announcements(screen).join(' ')).not.toMatch(/another player/);
  expect(screen.getByText('Needs an owner')).toBeVisible();
  expect(takeButton()).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss owner update' }));
  expect(announcements(screen)).toEqual([]);

  transport.owner = bryn;
  view.rerender(control());
  expect(announcements(screen)).toEqual([
    expect.stringContaining('Owner changed by another player.'),
  ]);
});

test('taking ownership after it was lost is reported as the viewer’s own save, not another player’s change', async () => {
  const view = render(control());
  transport.owner = null;
  view.rerender(control());
  expect(announcements(screen)).toEqual([
    expect.stringContaining('This Character no longer has an owner.'),
  ]);
  await act(async () => {
    fireEvent.click(takeButton());
  });
  const [{ operationId }] = transport.mutate.mock.lastCall as [
    { operationId: string },
  ];
  transport.owner = bryn;
  transport.ownerLastOperationId = operationId;
  view.rerender(control());
  expect(screen.getByText('(me)')).toBeVisible();
  expect(announcements(screen)).toEqual(['Owner assigned.']);
});

test('loading, maintenance and a pending save disable assignment', async () => {
  transport.owner = undefined;
  const view = render(control());
  expect(screen.getByText('Loading owner…')).toBeVisible();
  expect(assignButton()).toBeDisabled();

  transport.owner = ada;
  transport.readOnly = true;
  view.rerender(control());
  expect(screen.getByText('Ada')).toBeVisible();
  expect(assignButton()).toBeDisabled();

  transport.readOnly = false;
  view.rerender(control());
  let resolve: ((value: null) => void) | undefined;
  transport.mutate.mockReturnValue(
    new Promise<null>((reply) => {
      resolve = reply;
    }),
  );
  const picker = await assign(/^Bryn/);
  expect(picker.getByRole('button', { name: 'Assign owner' })).toBeDisabled();
  expect(picker.getByRole('radio', { name: /^Ada/ })).toBeDisabled();
  expect(picker.getByRole('status')).toHaveTextContent('Assigning owner…');
  await act(async () => resolve?.(null));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(assignButton()).toBeEnabled();
});

test.each([
  [
    new ConvexError('Choose a current campaign member'),
    "Owner wasn't changed: Choose a current campaign member. Try again.",
  ],
  [
    new Error('Disconnected'),
    'Owner may have changed. Check the current owner before trying again.',
  ],
])(
  'a failed save keeps the picker open with its reason: %s',
  async (error, message) => {
    transport.mutate.mockRejectedValue(error);
    render(control());
    const picker = await assign(/^Bryn/);
    expect(await picker.findByRole('alert')).toHaveTextContent(message);
    expect(picker.getByRole('radio', { name: /^Bryn/ })).toBeChecked();
    expect(picker.getByRole('button', { name: 'Assign owner' })).toBeEnabled();
    expect(picker.getByRole('alert')).not.toHaveTextContent(
      /demo|fixture|sync/i,
    );
  },
);

test('members load page by page, and an empty filtered page still offers more', () => {
  transport.members = [];
  transport.membersStatus = 'LoadingFirstPage';
  const view = render(control());
  const picker = openPicker();
  expect(announcements(picker)).toEqual(['Loading members…']);
  expect(picker.queryAllByRole('radio')).toHaveLength(0);

  transport.membersStatus = 'CanLoadMore';
  view.rerender(control());
  expect(announcements(picker)).toEqual([]);
  fireEvent.click(picker.getByRole('button', { name: 'Load more members' }));
  expect(transport.loadMore).toHaveBeenCalledWith(25);

  transport.membersStatus = 'LoadingMore';
  view.rerender(control());
  expect(announcements(picker)).toEqual(['Loading members…']);
  expect(
    picker.queryByRole('button', { name: 'Load more members' }),
  ).not.toBeInTheDocument();

  transport.membersStatus = 'Exhausted';
  view.rerender(control());
  expect(announcements(picker)).toEqual(['No current members.']);
  expect(picker.getByRole('button', { name: 'Assign owner' })).toBeDisabled();
});

test("another player's change is announced beside the owner until dismissed", () => {
  const view = render(control());
  transport.owner = bryn;
  view.rerender(control());
  expect(announcements(screen)).toEqual([
    expect.stringContaining('Owner changed by another player.'),
  ]);
  expect(screen.getByText('Bryn')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss owner update' }));
  expect(announcements(screen)).toEqual([]);
});

test('a private Character has no owner control', () => {
  const { container } = render(control({}));
  expect(container).toBeEmptyDOMElement();
  expect(
    screen.queryByRole('button', { name: /Assign owner/ }),
  ).not.toBeInTheDocument();
});

test('an unprepared campaign has no Assign owner control', () => {
  transport.ownershipAvailable = false;
  const { container } = render(control());
  expect(container).toBeEmptyDOMElement();
  expect(
    screen.queryByRole('button', { name: /Assign owner/ }),
  ).not.toBeInTheDocument();
});
