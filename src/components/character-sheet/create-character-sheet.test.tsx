import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import NewPrivateCharacterRoute from '~/app/characters/new/page';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CreateCharacterSheet } from './create-character-sheet';
import { convexNames } from '../../../tests/convex-names';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';

// Creating a Character for the living sheet (#256), from a prepared
// campaign's Characters page.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let campaignCreation = false;
const navigate = vi.fn();
const maintenance = vi.fn<() => MigrationMaintenance>();
let me: { characterSheetDemo?: true } | null | undefined = {
  characterSheetDemo: true,
};

vi.mock('./use-character-creation-route', () => ({
  useCharacterCreationRoute: () => ({
    back: { href: '/characters', label: 'Characters' },
    loading: me === undefined,
    available: Boolean(me?.characterSheetDemo),
    ...(campaignCreation
      ? {
          campaign: { _id: 'campaign-1' },
          organizationId: 'org',
          origin: {
            href: '/campaigns/campaign-1/characters',
            organization: { kind: 'organization', id: 'org' },
          },
        }
      : {}),
  }),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));

const nameOf = convexNames({ create: api.characterSheet.create });
vi.mock('convex/react', () => ({
  useQuery: () => me,
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) => {
        calls.push({ name, args, resolve, reject });
      });
  },
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useNavigationGuard: () => ({
    navigate,
    requestDeparture: vi.fn(),
    hasPendingWork: () => false,
  }),
}));
// Radix Select needs layout APIs jsdom lacks; a native select keeps the
// labelled control and its PC/NPC options.
vi.mock('~/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select
      aria-label="Kind"
      disabled={disabled}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

beforeEach(() => {
  calls = [];
  campaignCreation = false;
  me = { characterSheetDemo: true };
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

test('a prepared private creation opens an independent sheet without selecting an organization', async () => {
  render(<NewPrivateCharacterRoute />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Private hero' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create character' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]?.args).toMatchObject({ name: 'Private hero', kind: 'pc' });
  expect(calls[0]?.args.organizationId).toBeUndefined();
  expect(calls[0]?.args.campaignId).toBeUndefined();
  await act(async () => calls[0]?.resolve('private-hero'));
  expect(navigate).toHaveBeenCalledWith('/characters/private-hero');
});

test.each([{ me: {} }, { me: null }])(
  'the private creation route does not offer sheet creation before preparation ($me)',
  (identity) => {
    me = identity.me;
    render(<NewPrivateCharacterRoute />);
    expect(
      screen.queryByRole('form', { name: 'New character' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Creating characters here is not available yet.'),
    ).toBeVisible();
    expect(
      screen.queryByText(/demo|fixture|approval/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Characters' })).toHaveAttribute(
      'href',
      '/characters',
    );
  },
);

test('while the identity loads, the creation route keeps the frame and shows no form', () => {
  me = undefined;
  render(<NewPrivateCharacterRoute />);
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('form', { name: 'New character' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Characters' })).toBeVisible();
});

test('maintenance disables character creation and its fields with the reason beside the form', async () => {
  const form = renderForm();
  fireEvent.change(form.name, { target: { value: 'Nara' } });
  fireEvent.change(form.notes, { target: { value: 'Scout' } });
  fireEvent.change(form.kind, { target: { value: 'npc' } });
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  form.rerender(
    <CreateCharacterSheet
      organizationId="org"
      campaignId={'campaign-1' as Id<'campaign'>}
    />,
  );
  expect(form.name).toBeDisabled();
  expect(form.name).toHaveValue('Nara');
  expect(form.notes).toBeDisabled();
  expect(form.notes).toHaveValue('Scout');
  expect(form.kind).toBeDisabled();
  expect(form.kind).toHaveValue('npc');
  expect(
    screen.getByRole('button', { name: 'Create character' }),
  ).toBeDisabled();
  expect(screen.getByText(message)).toBeVisible();
  form.create();
  await act(async () => {
    fireEvent.submit(screen.getByRole('form', { name: 'New character' }));
  });
  expect(calls).toEqual([]);
  expect(navigate).not.toHaveBeenCalled();
});

function renderForm() {
  const view = render(
    <CreateCharacterSheet
      organizationId="org"
      campaignId={'campaign-1' as Id<'campaign'>}
    />,
  );
  return {
    rerender: view.rerender,
    name: screen.getByRole('textbox', { name: 'Name' }),
    notes: screen.getByRole('textbox', { name: 'Notes' }),
    kind: screen.getByRole('combobox', { name: 'Kind' }),
    create: () =>
      fireEvent.click(screen.getByRole('button', { name: 'Create character' })),
  };
}

test('a missing name is refused in place and nothing is created', async () => {
  const form = renderForm();
  expect(form.kind).toHaveValue('pc');
  form.create();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Character name is required',
  );
  expect(form.name).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toEqual([]);
  expect(navigate).not.toHaveBeenCalled();
});

test('double activation sends one request, a refusal keeps the entries, and a confirmed creation opens the new sheet', async () => {
  const form = renderForm();
  fireEvent.change(form.name, { target: { value: 'Nara' } });
  fireEvent.change(form.notes, { target: { value: 'Scout' } });
  fireEvent.change(form.kind, { target: { value: 'npc' } });
  form.create();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Creating…' }));
  expect(calls).toHaveLength(1);
  expect(calls[0]!.name).toBe('create');
  expect(calls[0]!.args).toMatchObject({
    organizationId: 'org',
    campaignId: 'campaign-1',
    name: 'Nara',
    kind: 'npc',
    description: 'Scout',
  });
  expect(typeof calls[0]!.args.operationId).toBe('string');
  await act(async () => {
    calls[0]!.reject(
      new ConvexError(
        'Character sheets are available only in fixture campaigns.',
      ),
    );
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Character wasn't created: Character sheets are available only in fixture campaigns. Your entries are kept. Try again.",
  );
  expect(form.name).toHaveValue('Nara');
  expect(form.notes).toHaveValue('Scout');
  expect(form.kind).toHaveValue('npc');
  expect(navigate).not.toHaveBeenCalled();
  form.create();
  await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => {
    calls[1]!.resolve('character-9');
  });
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(
      '/characters/character-9?from=%2Fcampaigns%2Fcampaign-1%2Fcharacters',
    ),
  );
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Opening sheet…' })).toBeDisabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('an unknown outcome says the character may exist rather than claiming failure', async () => {
  const form = renderForm();
  fireEvent.change(form.name, { target: { value: 'Nara' } });
  form.create();
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    calls[0]!.reject(new Error('Connection closed'));
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Character may have been created. Check the character list before trying again.',
  );
  expect(form.name).toHaveValue('Nara');
  expect(
    screen.getByRole('button', { name: 'Create character' }),
  ).toBeEnabled();
});

test('campaign creation opens the independent sheet and retains its campaign Characters origin', async () => {
  campaignCreation = true;
  render(<NewPrivateCharacterRoute />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Campaign hero' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create character' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]?.args).toMatchObject({
    campaignId: 'campaign-1',
    organizationId: 'org',
    name: 'Campaign hero',
  });
  await act(async () => calls[0]?.resolve('hero'));
  expect(navigate).toHaveBeenCalledWith(
    '/characters/hero?from=%2Fcampaigns%2Fcampaign-1%2Fcharacters&organizationId=org',
  );
});
