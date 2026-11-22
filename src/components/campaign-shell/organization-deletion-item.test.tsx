import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { OrganizationDeletionItem } from './organization-deletion-item';
import type { useOrganizationDeletion } from './use-organization-deletion';

// Delete organization (#710) at its two seams: who administers the
// organization, and the deletion request's outcome.

type OrganizationDeletion = ReturnType<typeof useOrganizationDeletion>;
const isAdmin = vi.fn(() => false);
const organizationDeletion = vi.fn<() => OrganizationDeletion>();
const submit = vi.fn<() => Promise<boolean>>();
vi.mock('./use-organization-role', () => ({
  useIsOrganizationAdmin: () => isAdmin(),
}));
vi.mock('./use-organization-deletion', () => ({
  useOrganizationDeletion: () => organizationDeletion(),
}));
vi.mock('./navigation-guard', () => ({
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

const thursday = { id: 'org', name: 'Thursday table' };
function given({
  deletion = null,
  status = { kind: 'idle' },
}: {
  deletion?: OrganizationDeletion['deletion'];
  status?: OrganizationDeletion['status'];
} = {}) {
  organizationDeletion.mockReturnValue({
    deletion,
    status,
    submit,
    canFinish: false,
    finish: () => Promise.resolve(false),
  });
}
const item = () =>
  screen.queryByRole('button', { name: 'Delete organization' });
function openDialog() {
  const view = render(
    <OrganizationDeletionItem organization={thursday} disabled={false} />,
  );
  fireEvent.click(item()!);
  return { view, dialog: within(screen.getByRole('dialog')) };
}

beforeEach(() => {
  submit.mockReset().mockResolvedValue(true);
  isAdmin.mockReturnValue(true);
  given();
});

test('only an admin of the organization is offered to delete it', () => {
  isAdmin.mockReturnValue(false);
  const view = render(
    <OrganizationDeletionItem organization={thursday} disabled={false} />,
  );
  expect(item()).toBeNull();
  isAdmin.mockReturnValue(true);
  view.rerender(
    <OrganizationDeletionItem organization={thursday} disabled={false} />,
  );
  expect(item()).toBeVisible();
  view.rerender(<OrganizationDeletionItem organization={thursday} disabled />);
  expect(item()).toBeDisabled();
});

test('the item leaves while a deletion is under way: the campaign list shows it', () => {
  given({
    deletion: {
      state: 'preparing',
      campaignsRemaining: 1,
      blockedCampaigns: 0,
    },
  });
  render(<OrganizationDeletionItem organization={thursday} disabled={false} />);
  expect(item()).toBeNull();
});

test('starting is confirmed with what it means, then the request goes out and the dialog closes', async () => {
  const { dialog } = openDialog();
  expect(
    dialog.getByRole('heading', { name: 'Delete Thursday table?' }),
  ).toBeVisible();
  expect(dialog.getAllByRole('listitem').map((row) => row.textContent)).toEqual(
    [
      'Every campaign is deleted first.',
      'Characters go back to their owners, outside any campaign.',
      'Finished weeks become unreadable once the organization is gone.',
    ],
  );
  fireEvent.click(dialog.getByRole('button', { name: 'Start deleting' }));
  expect(submit).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('a blocked refusal sums the counts across campaigns and leads to the campaign list', () => {
  given({
    status: { kind: 'blocked', message: '', ownerless: 4, unreturnable: 1 },
  });
  const { dialog } = openDialog();
  expect(dialog.getByRole('alert')).toHaveTextContent(
    '4 Characters need an owner before this organization can be deleted.',
  );
  expect(dialog.getByRole('alert')).toHaveTextContent(
    "1 Character can't go back to its owner yet, so this organization can't be deleted.",
  );
  expect(dialog.getByRole('link', { name: 'Assign owners' })).toHaveAttribute(
    'href',
    '/campaigns',
  );
  expect(dialog.getByRole('button', { name: 'Start deleting' })).toBeEnabled();
});

test('a pending start waits, and an unconfirmed one offers to check again', () => {
  given({ status: { kind: 'pending' } });
  const { view, dialog } = openDialog();
  expect(dialog.getByRole('button', { name: 'Starting…' })).toBeDisabled();
  expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  given({ status: { kind: 'unknown' } });
  view.rerender(
    <OrganizationDeletionItem organization={thursday} disabled={false} />,
  );
  expect(dialog.getByRole('alert')).toHaveTextContent(
    "We couldn't confirm whether deleting started. Check the campaign list before trying again.",
  );
  fireEvent.click(dialog.getByRole('button', { name: 'Check again' }));
  expect(submit).toHaveBeenCalledTimes(1);
});
