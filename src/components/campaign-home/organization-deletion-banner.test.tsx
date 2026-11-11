import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  OrganizationDeletionBanner,
  type OrganizationDeletion,
} from './organization-deletion-banner';

// The organization's deletion on the campaign list (#710), at the hook
// seam: the live state and the request's outcome are given.

const submit = vi.fn<() => Promise<boolean>>();
const finish = vi.fn<() => Promise<boolean>>();
type Deletion = NonNullable<OrganizationDeletion['deletion']>;
function show({
  state,
  campaignsRemaining = 0,
  blockedCampaigns = 0,
  status = { kind: 'idle' },
  canFinish = false,
  isAdmin = false,
}: {
  state: Deletion['state'];
  campaignsRemaining?: number;
  blockedCampaigns?: number;
  status?: OrganizationDeletion['status'];
  canFinish?: boolean;
  isAdmin?: boolean;
}) {
  return render(
    <OrganizationDeletionBanner
      organizationDeletion={{
        deletion: { state, campaignsRemaining, blockedCampaigns },
        status,
        submit,
        canFinish,
        finish,
      }}
      isAdmin={isAdmin}
    />,
  );
}

beforeEach(() => {
  submit.mockReset().mockResolvedValue(true);
  finish.mockReset().mockResolvedValue(true);
});

test('nothing shows without a deletion under way', () => {
  render(
    <OrganizationDeletionBanner
      organizationDeletion={{
        deletion: null,
        status: { kind: 'idle' },
        submit,
        canFinish: false,
        finish,
      }}
      isAdmin
    />,
  );
  expect(screen.queryByRole('status')).toBeNull();
});

test('preparing counts the campaigns left', () => {
  const view = show({ state: 'preparing', campaignsRemaining: 3 });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Deleting this organization: 3 campaigns left.',
  );
  expect(screen.queryByRole('button')).toBeNull();
  view.unmount();
  show({ state: 'preparing', campaignsRemaining: 1 });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Deleting this organization: 1 campaign left.',
  );
});

test('paused for owners offers Continue deleting, and a new refusal reads inline', () => {
  const view = show({ state: 'blocked', blockedCampaigns: 2 });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Deleting this organization is paused: 2 campaigns have Characters that need an owner.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Continue deleting' }));
  expect(submit).toHaveBeenCalledTimes(1);
  view.unmount();
  show({
    state: 'blocked',
    blockedCampaigns: 1,
    status: { kind: 'blocked', message: '', ownerless: 3, unreturnable: 0 },
  });
  expect(screen.getByRole('status')).toHaveTextContent(
    '1 campaign has Characters that need an owner.',
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    '3 Characters need an owner before this organization can be deleted.',
  );
});

test('ready lets an admin finish, and says so to everyone else', () => {
  const view = show({ state: 'ready', canFinish: true, isAdmin: true });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Every campaign is deleted. Delete the organization to finish.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete organization' }));
  expect(finish).toHaveBeenCalledTimes(1);
  view.unmount();
  show({ state: 'ready', canFinish: false, isAdmin: false });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Waiting for an admin to finish deleting this organization.',
  );
  expect(screen.queryByRole('button')).toBeNull();
});

test('an unconfirmed finish says to check the organizations first', () => {
  show({
    state: 'ready',
    canFinish: true,
    isAdmin: true,
    status: { kind: 'unknown' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    "We couldn't confirm the organization was deleted. Check your organizations before trying again.",
  );
});

test('a pending finish waits', () => {
  show({
    state: 'ready',
    canFinish: true,
    isAdmin: true,
    status: { kind: 'pending' },
  });
  expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
});
