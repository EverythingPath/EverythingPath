import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Doc } from '@convex/_generated/dataModel';
import { CampaignHomeContent } from './campaign-home-content';
import type { CampaignDeletion } from './delete-campaign-control';
import type { CampaignHomeContentState } from './use-campaign-home-content';

// Delete campaign and the progress banner (#710) at the hook seam: the
// request's outcome and the deletion's live state are given, the home
// renders what each means.

const campaignDeletion = vi.fn<() => CampaignDeletion>();
vi.mock('./use-campaign-deletion', () => ({
  useCampaignDeletion: () => campaignDeletion(),
}));
vi.mock('./use-campaign-home-content', () => ({
  useCampaignHomeContent: (): CampaignHomeContentState => ({
    kind: 'no_militia',
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

const prepared = {
  _id: 'ironfang',
  _creationTime: 0,
  name: 'Ironfang Invasion',
  ownerId: 'gm',
  organizationId: 'org',
  description: '',
  e2eFixture: {
    namespace: 'test',
    version: 1,
    workerKey: '0',
    caseKey: 'home',
    campaignKey: 'ironfang',
  },
} as Doc<'campaign'>;
const production = { ...prepared, e2eFixture: undefined } as Doc<'campaign'>;

const submit = vi.fn<() => Promise<boolean>>();
type Deletion = NonNullable<CampaignDeletion['deletion']>;
const underWay = (patch: Partial<Deletion> = {}): Deletion => ({
  campaignId: prepared._id,
  campaignName: prepared.name,
  state: 'returning',
  remaining: 3,
  setAside: 0,
  blockers: null,
  deletedAt: null,
  hasHistory: true,
  ...patch,
});
function given({
  deletion = null,
  status = { kind: 'idle' },
}: {
  deletion?: CampaignDeletion['deletion'];
  status?: CampaignDeletion['status'];
} = {}) {
  campaignDeletion.mockReturnValue({
    deletion,
    status,
    submit,
    isUnderWay:
      deletion?.state === 'returning' || deletion?.state === 'blocked',
    isDeleted: deletion?.state === 'purging' || deletion?.state === 'deleted',
  });
}
const opener = () => screen.getByRole('button', { name: 'Delete campaign' });
function openDialog(campaign = prepared) {
  const view = render(<CampaignHomeContent campaign={campaign} />);
  fireEvent.click(opener());
  return { view, dialog: within(screen.getByRole('dialog')) };
}

beforeEach(() => {
  submit.mockReset().mockResolvedValue(true);
  given();
});

test('only a prepared campaign with no deletion under way offers Delete campaign', () => {
  const view = render(<CampaignHomeContent campaign={production} />);
  expect(screen.queryByRole('button', { name: 'Delete campaign' })).toBeNull();
  view.rerender(<CampaignHomeContent campaign={prepared} />);
  expect(opener()).toBeVisible();
  // Still loading: not yet known whether a deletion is under way.
  campaignDeletion.mockReturnValue({
    deletion: undefined,
    status: { kind: 'idle' },
    submit,
    isUnderWay: false,
    isDeleted: false,
  });
  view.rerender(<CampaignHomeContent campaign={prepared} />);
  expect(screen.queryByRole('button', { name: 'Delete campaign' })).toBeNull();
});

test('deleting is confirmed with what it means, then the request goes out and the dialog closes', async () => {
  const { dialog } = openDialog();
  expect(
    dialog.getByRole('heading', { name: 'Delete Ironfang Invasion?' }),
  ).toBeVisible();
  expect(
    dialog.getAllByRole('listitem').map((item) => item.textContent),
  ).toEqual([
    'Every Character with an owner goes back to that owner, outside any campaign, and leaves the militia roster, officer roles and team management.',
    'Campaign homebrew stays with each Character as its own copy.',
    'The campaign, its militia and its campaign catalog are deleted.',
    "Finished weeks stay readable to the organization's members.",
  ]);
  fireEvent.click(dialog.getByRole('button', { name: 'Delete campaign' }));
  expect(submit).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('Cancel closes without a request', () => {
  const { dialog } = openDialog();
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

test('while the request is pending both buttons wait', () => {
  given({ status: { kind: 'pending' } });
  const { dialog } = openDialog();
  expect(dialog.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
});

test('a blocked refusal keeps the dialog open with the counts and the way to assign owners', () => {
  given({
    status: {
      kind: 'blocked',
      message: 'server wording',
      ownerless: 2,
      unreturnable: 1,
    },
  });
  const { dialog } = openDialog();
  expect(dialog.getByRole('alert')).toHaveTextContent(
    '2 Characters need an owner before this campaign can be deleted.',
  );
  expect(dialog.getByRole('alert')).toHaveTextContent(
    "1 Character can't go back to its owner yet, so this campaign can't be deleted.",
  );
  expect(dialog.queryByText('server wording')).toBeNull();
  expect(dialog.getByRole('link', { name: 'Assign owners' })).toHaveAttribute(
    'href',
    '/campaigns/ironfang/characters',
  );
  expect(dialog.queryByRole('listitem')).toBeNull();
  // Asking again after assigning owners needs no new dialog.
  fireEvent.click(dialog.getByRole('button', { name: 'Delete campaign' }));
  expect(submit).toHaveBeenCalledTimes(1);
});

test('unreturnable Characters alone offer no action', () => {
  given({
    status: { kind: 'blocked', message: '', ownerless: 0, unreturnable: 2 },
  });
  const { dialog } = openDialog();
  expect(dialog.getByRole('alert')).toHaveTextContent(
    "2 Characters can't go back to their owners yet, so this campaign can't be deleted.",
  );
  expect(dialog.queryByRole('link', { name: 'Assign owners' })).toBeNull();
});

test('another refusal and an unconfirmed outcome read inline', () => {
  given({ status: { kind: 'rejected', message: 'Production campaign' } });
  const { view, dialog } = openDialog();
  expect(dialog.getByRole('alert')).toHaveTextContent(
    "Campaign wasn't deleted: Production campaign.",
  );
  given({ status: { kind: 'unknown' } });
  view.rerender(<CampaignHomeContent campaign={prepared} />);
  expect(dialog.getByRole('alert')).toHaveTextContent(
    "We couldn't confirm whether the campaign is being deleted.",
  );
  fireEvent.click(dialog.getByRole('button', { name: 'Check again' }));
  expect(submit).toHaveBeenCalledTimes(1);
});

test('while Characters return, every member sees the count and the home stays usable', () => {
  given({ deletion: underWay({ remaining: 3, setAside: 1 }) });
  render(<CampaignHomeContent campaign={prepared} />);
  expect(screen.getByRole('status')).toHaveTextContent(
    "Deleting this campaign. 3 Characters are going back to their owners. 1 couldn't be moved yet and will be tried again.",
  );
  expect(screen.queryByText(/%/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Set up militia' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Delete campaign' })).toBeNull();
});

test('one remaining Character reads in the singular', () => {
  given({ deletion: underWay({ remaining: 1 }) });
  render(<CampaignHomeContent campaign={prepared} />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Deleting this campaign. 1 Character is going back to its owner.',
  );
});

test('a paused deletion offers Assign owners and Continue deleting', () => {
  given({
    deletion: underWay({
      state: 'blocked',
      blockers: { ownerless: 2, unreturnable: 0 },
    }),
  });
  render(<CampaignHomeContent campaign={prepared} />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Deleting this campaign is paused: 2 Characters need an owner.',
  );
  expect(screen.getByRole('link', { name: 'Assign owners' })).toHaveAttribute(
    'href',
    '/campaigns/ironfang/characters',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Continue deleting' }));
  expect(submit).toHaveBeenCalledTimes(1);
});

test('continuing into a new refusal shows the refusal inline', () => {
  given({
    deletion: underWay({
      state: 'blocked',
      blockers: { ownerless: 1, unreturnable: 0 },
    }),
    status: { kind: 'blocked', message: '', ownerless: 1, unreturnable: 0 },
  });
  render(<CampaignHomeContent campaign={prepared} />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    '1 Character needs an owner before this campaign can be deleted.',
  );
});

test('once the campaign is deleted the home shows neither banner nor control', () => {
  given({ deletion: underWay({ state: 'deleted', deletedAt: 1 }) });
  render(<CampaignHomeContent campaign={prepared} />);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete campaign' })).toBeNull();
});
