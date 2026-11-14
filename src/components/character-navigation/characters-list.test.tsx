import type { Id } from '@convex/_generated/dataModel';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { CompanionRelationship } from '~/components/character-sheet/character-companions-view-model';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { OrganizationSwitchNotice } from './organization-switch-notice';
import type { FunctionReference } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import { convexNames } from '../../../tests/convex-names';
import { CampaignCharactersView } from './campaign-characters-view';
import { CharactersListLoading } from './characters-list-loading';
import { OwnedCharactersView } from './owned-characters-view';

const transport = vi.hoisted(() => ({
  isWide: true,
  readOnly: false,
  mutate: vi.fn(),
  relationships: undefined as CompanionRelationship[] | undefined,
  relationshipReads: [] as unknown[],
}));
const nameOf = convexNames({ me: api.user.getMe });
vi.mock('convex/react', () => ({
  useQuery: (reference: FunctionReference<'query'>, args: unknown) => {
    if (args === 'skip') return undefined;
    // The viewer's own account, read while a Character needs an owner (#708).
    if (nameOf(reference) === 'me') return { _id: 'member' };
    transport.relationshipReads.push(args);
    return transport.relationships;
  },
  useMutation: () => transport.mutate,
  usePaginatedQuery: () => ({
    results: [{ userId: 'member', name: 'Bryn', isMine: true }],
    status: 'Exhausted',
    loadMore: vi.fn(),
  }),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: transport.readOnly ? 'maintenance' : 'ready',
    readOnly: transport.readOnly,
    message: transport.readOnly ? 'Editing is paused for maintenance.' : '',
  }),
}));
vi.mock('~/components/use-breakpoint', () => ({
  useBreakpoint: () => transport.isWide,
}));
// The campaign's deletion (#710), as the Characters page shows it.
const campaignDeletion = vi.hoisted(() => ({
  deletion: null as unknown,
  status: { kind: 'idle' } as { kind: string },
  submit: vi.fn(),
}));
vi.mock('~/components/campaign-home/use-campaign-deletion', () => ({
  useCampaignDeletion: () => ({
    deletion: campaignDeletion.deletion,
    status: campaignDeletion.status,
    submit: campaignDeletion.submit,
    isUnderWay: false,
    isDeleted: false,
  }),
}));
const campaignScope = {
  campaignId: 'campaign' as Id<'campaign'>,
  organizationId: 'org',
};
beforeEach(() => {
  transport.isWide = true;
  transport.readOnly = false;
  transport.mutate.mockReset().mockResolvedValue(null);
  transport.relationships = undefined;
  transport.relationshipReads = [];
  campaignDeletion.deletion = null;
  campaignDeletion.status = { kind: 'idle' };
  campaignDeletion.submit.mockReset().mockResolvedValue(true);
});

vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

test('owned characters show No campaign before campaign and organization with accessible sheet links', () => {
  render(
    <OwnedCharactersView
      groups={[
        {
          key: 'none',
          title: 'No campaign',
          characters: [
            {
              id: 'private',
              name: 'Mira',
              level: 1,
              kind: 'PC',
              active: true,
              href: '/characters/private?from=%2Fcharacters',
            },
          ],
        },
        {
          key: 'kingmaker',
          title: 'Kingmaker',
          organizationName: 'Thursday table',
          characters: [
            {
              id: 'shared',
              name: 'Oren',
              level: 3,
              kind: 'NPC',
              active: false,
              href: '/characters/shared?from=%2Fcharacters',
            },
          ],
        },
      ]}
      newHref="/characters/new"
    />,
  );
  expect(
    screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(['No campaign', 'Kingmaker']);
  const group = screen.getByRole('region', { name: 'Kingmaker' });
  expect(group).toHaveTextContent('Thursday table');
  expect(group).toHaveTextContent('Archived');
  expect(within(group).getByRole('link', { name: /Oren/ })).toHaveAttribute(
    'href',
    '/characters/shared?from=%2Fcharacters',
  );
  expect(screen.getByRole('link', { name: 'New character' })).toHaveAttribute(
    'href',
    '/characters/new',
  );
});

test('Characters on their way back from a left organization are said once per organization, above No campaign, without names, counts or controls', () => {
  render(
    <OwnedCharactersView
      groups={[
        {
          key: 'none',
          title: 'No campaign',
          characters: [
            {
              id: 'private',
              name: 'Mira',
              level: 1,
              kind: 'PC',
              active: true,
              href: '/characters/private?from=%2Fcharacters',
            },
          ],
        },
      ]}
      returning={[
        {
          organizationId: 'thursday',
          organizationName: 'Thursday table',
          setAside: 0,
        },
        { organizationId: 'gone', setAside: 0 },
      ]}
    />,
  );
  const notices = screen.getAllByRole('status');
  expect(notices.map((notice) => notice.textContent)).toEqual([
    'Your characters from Thursday table are on their way back. They’ll appear under No campaign.',
    'Your characters from an organization you left are on their way back. They’ll appear under No campaign.',
  ]);
  expect(
    notices[1]!.compareDocumentPosition(
      screen.getByRole('region', { name: 'No campaign' }),
    ),
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Mira/ })).toBeVisible();
});

test('a Character that couldn’t be returned yet is said in one line for its organization, without its name', () => {
  render(
    <OwnedCharactersView
      groups={[{ key: 'none', title: 'No campaign', characters: [] }]}
      returning={[
        {
          organizationId: 'thursday',
          organizationName: 'Thursday table',
          setAside: 1,
        },
        { organizationId: 'gone', setAside: 2 },
      ]}
    />,
  );
  expect(
    screen.getAllByRole('status').map((notice) => notice.textContent),
  ).toEqual([
    'One character from Thursday table couldn’t be returned yet. It’ll appear under No campaign once it’s back.',
    '2 characters from an organization you left couldn’t be returned yet. They’ll appear under No campaign once they’re back.',
  ]);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('without a return under way, the Characters area has no status line', () => {
  render(
    <OwnedCharactersView
      groups={[{ key: 'none', title: 'No campaign', characters: [] }]}
      returning={[]}
    />,
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test.each([true, false])(
  'a campaign Character whose owner left the organization says so beside the owner and still offers ownership, at tablet or phone width (%s)',
  (isWide) => {
    transport.isWide = isWide;
    render(
      <CampaignCharactersView
        scope={campaignScope}
        campaignName="Ironfang"
        characters={[
          {
            id: 'hero' as Id<'character'>,
            name: 'Hero',
            level: 3,
            kind: 'PC',
            active: true,
            href: '/characters/hero',
            ownershipAvailable: true,
            ownerName: 'Alice',
            owner: {
              userId: 'alice' as Id<'user'>,
              name: 'Alice',
              isMine: false,
            },
            ownerDeparted: true,
            isOnRoster: true,
            needsOwner: false,
          },
          {
            id: 'stayer' as Id<'character'>,
            name: 'Stayer',
            level: 2,
            kind: 'NPC',
            active: true,
            href: '/characters/stayer',
            ownershipAvailable: true,
            ownerName: 'Bryn',
            owner: {
              userId: 'member' as Id<'user'>,
              name: 'Bryn',
              isMine: true,
            },
            isOnRoster: false,
            needsOwner: false,
          },
        ]}
      />,
    );
    const hero = screen.getByRole('link', { name: 'Hero' }).closest('tr')!;
    const badge = within(hero).getByText('Alice left the organization');
    expect(badge).toBeVisible();
    expect(badge.compareDocumentPosition(within(hero).getByText('Alice'))).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(hero).not.toHaveTextContent(/returning|remov/i);
    expect(
      within(hero).getByRole('button', { name: 'Assign owner for Hero' }),
    ).toBeEnabled();
    expect(within(hero).getByRole('link', { name: 'Hero' })).toHaveAttribute(
      'href',
      '/characters/hero',
    );
    const stayer = screen.getByRole('link', { name: 'Stayer' }).closest('tr')!;
    expect(stayer).not.toHaveTextContent(/left the organization/);
  },
);

test.each([true, false])(
  'a Character nobody owns is badged Needs an owner once, keeps Assign owner and is taken in one click, while a departed owner and a production row keep their own states, at tablet or phone width (%s)',
  async (isWide) => {
    transport.isWide = isWide;
    render(
      <CampaignCharactersView
        scope={campaignScope}
        campaignName="Ironfang"
        characters={[
          {
            id: 'hero' as Id<'character'>,
            name: 'Hero',
            level: 3,
            kind: 'PC',
            active: true,
            href: '/characters/hero',
            ownershipAvailable: true,
            ownerName: null,
            owner: null,
            ownerDeparted: false,
            needsOwner: true,
            isOnRoster: true,
          },
          {
            id: 'vessa' as Id<'character'>,
            name: 'Vessa',
            level: 2,
            kind: 'NPC',
            active: true,
            href: '/characters/vessa',
            ownershipAvailable: true,
            ownerName: 'Alice',
            owner: {
              userId: 'alice' as Id<'user'>,
              name: 'Alice',
              isMine: false,
            },
            ownerDeparted: true,
            needsOwner: false,
            isOnRoster: false,
          },
          {
            id: 'legacy' as Id<'character'>,
            name: 'Legacy',
            level: 1,
            kind: 'PC',
            active: true,
            href: '/campaigns/campaign/officers',
            ownershipAvailable: false,
            ownerName: null,
            owner: null,
            needsOwner: false,
            isOnRoster: false,
          },
        ]}
      />,
    );
    expect(screen.getByText('One Character needs an owner.')).toBeVisible();
    const hero = screen.getByRole('link', { name: 'Hero' }).closest('tr')!;
    expect(within(hero).getAllByText('Needs an owner')).toHaveLength(1);
    expect(within(hero).getByText('Needs an owner')).toBeVisible();
    expect(hero).not.toHaveTextContent(
      /left the organization|deleted|account/i,
    );
    expect(
      within(hero).getByRole('button', { name: 'Assign owner for Hero' }),
    ).toBeEnabled();
    const take = within(hero).getByRole('button', {
      name: 'Take ownership of Hero',
    });
    expect(take).toBeEnabled();

    const vessa = screen.getByRole('link', { name: 'Vessa' }).closest('tr')!;
    expect(
      within(vessa).getByText('Alice left the organization'),
    ).toBeVisible();
    expect(vessa).not.toHaveTextContent('Needs an owner');
    expect(
      within(vessa).queryByRole('button', { name: /Take ownership/ }),
    ).not.toBeInTheDocument();

    const legacy = screen.getByRole('link', { name: 'Legacy' }).closest('tr')!;
    expect(legacy).not.toHaveTextContent('Needs an owner');
    expect(within(legacy).queryByRole('button')).not.toBeInTheDocument();

    await act(async () => fireEvent.click(take));
    expect(transport.mutate).toHaveBeenCalledTimes(1);
    expect(transport.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...campaignScope,
        characterId: 'hero',
        ownerUserId: 'member',
        operationId: expect.any(String),
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(hero).getByRole('status')).toHaveTextContent(
      'Owner assigned.',
    );
  },
);

test('the campaign list counts the Characters nobody owns above the table, and says nothing when every one is owned', () => {
  const ownerless = (id: string, name: string) => ({
    id: id as Id<'character'>,
    name,
    level: 1,
    kind: 'PC',
    active: true,
    href: `/characters/${id}`,
    ownershipAvailable: true,
    ownerName: null,
    owner: null,
    needsOwner: true,
    isOnRoster: false,
  });
  const view = render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[ownerless('a', 'Ash'), ownerless('b', 'Bramble')]}
    />,
  );
  expect(screen.getByText('2 Characters need an owner.')).toBeVisible();
  view.rerender(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[
        {
          ...ownerless('c', 'Cole'),
          ownerName: 'Bryn',
          owner: { userId: 'member' as Id<'user'>, name: 'Bryn', isMine: true },
          needsOwner: false,
        },
      ]}
    />,
  );
  expect(screen.queryByText(/needs? an owner\./i)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Take ownership/ }),
  ).not.toBeInTheDocument();
});

test('a production campaign row whose owner left names them without the owner control', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          ownerName: null,
          owner: { userId: 'ada' as Id<'user'>, name: 'Ada', isMine: false },
          ownerDeparted: true,
          ownershipAvailable: false,
          isOnRoster: false,
          needsOwner: false,
          href: '/campaigns/campaign/officers',
        },
      ]}
    />,
  );
  const row = screen.getByRole('link', { name: 'Hero' }).closest('tr')!;
  expect(within(row).getByText('Owner left the organization')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /Assign owner/ }),
  ).not.toBeInTheDocument();
});

test('empty and loading states announce what the player is waiting for', () => {
  const { rerender } = render(
    <OwnedCharactersView
      groups={[{ key: 'none', title: 'No campaign', characters: [] }]}
      newHref="/characters/new"
    />,
  );
  expect(screen.getByText('No characters yet.')).toBeVisible();
  rerender(<CharactersListLoading />);
  expect(
    screen.getByRole('status', { name: 'Loading characters' }),
  ).toBeInTheDocument();
});

test('campaign characters table every owner, active state and roster membership', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[
        {
          id: '1' as Id<'character'>,
          name: 'Alia',
          level: 3,
          kind: 'PC',
          active: true,
          href: '/characters/1',
          ownershipAvailable: true,
          ownerName: 'Andreas',
          owner: {
            userId: 'andreas' as Id<'user'>,
            name: 'Andreas',
            isMine: false,
          },
          isOnRoster: true,
          needsOwner: false,
        },
        {
          id: '2' as Id<'character'>,
          name: 'Borin',
          level: 2,
          kind: 'NPC',
          active: false,
          href: '/characters/2',
          ownershipAvailable: true,
          ownerName: null,
          owner: null,
          isOnRoster: false,
          needsOwner: true,
        },
      ]}
      newHref="/characters/new"
    />,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Characters',
  );
  expect(
    screen.getByText('Everyone in Kingmaker can edit these.'),
  ).toBeVisible();
  expect(
    screen.getAllByRole('columnheader').map((header) => header.textContent),
  ).toEqual(['Name', 'Owner', 'Level', 'Status', 'Roster']);
  const alia = screen.getByRole('link', { name: 'Alia' }).closest('tr')!;
  expect(screen.getByRole('link', { name: 'Alia' })).toHaveAttribute(
    'href',
    '/characters/1',
  );
  expect(alia).toHaveTextContent('Andreas');
  expect(alia).toHaveTextContent('On roster');
  expect(alia).toHaveTextContent('Active');
  const borin = screen.getByRole('link', { name: 'Borin' }).closest('tr')!;
  expect(borin).toHaveTextContent('Needs an owner');
  expect(borin).toHaveTextContent('Archived');
  expect(borin).toHaveTextContent('Not on roster');
});

test('an empty campaign says so under its title', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[]}
      addFromMine={<button type="button">Add from my characters</button>}
      newHref="/characters/new"
    />,
  );
  // Add from my characters sits with New character in the page title.
  const add = screen.getByRole('button', { name: 'Add from my characters' });
  const create = screen.getByRole('link', { name: 'New character' });
  expect(add.parentElement).toBe(create.parentElement);
  expect(add.compareDocumentPosition(create)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(screen.getByText('No characters in this campaign yet.')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('a campaign Character without a destination keeps its plain name and row information', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[
        {
          id: 'legacy' as Id<'character'>,
          name: 'Legacy hero',
          level: 3,
          kind: 'PC',
          active: false,
          ownershipAvailable: true,
          ownerName: 'Alice',
          owner: {
            userId: 'alice' as Id<'user'>,
            name: 'Alice',
            isMine: false,
          },
          isOnRoster: false,
          needsOwner: false,
        },
      ]}
    />,
  );
  const name = screen.getByText('Legacy hero');
  expect(name).toBeVisible();
  expect(name.closest('a')).toBeNull();
  const row = name.closest('tr')!;
  expect(row).toHaveTextContent('Alice');
  expect(row).toHaveTextContent('Archived');
  expect(row).toHaveTextContent('Not on roster');
  expect(
    screen.queryByRole('link', { name: 'New character' }),
  ).not.toBeInTheDocument();
});

test('owned Characters omit creation when no creation destination is available', () => {
  render(
    <OwnedCharactersView
      groups={[{ key: 'none', title: 'No campaign', characters: [] }]}
    />,
  );
  expect(
    screen.getByRole('heading', { name: 'Characters', level: 1 }),
  ).toBeVisible();
  expect(
    screen.queryByRole('link', { name: 'New character' }),
  ).not.toBeInTheDocument();
});

test.each([
  '/campaigns/kingmaker/officers',
  '/characters/prepared?from=%2Fcampaigns%2Fkingmaker%2Fcharacters',
])('campaign Characters retain their supplied destination %s', (href) => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          href,
          ownershipAvailable: true,
          ownerName: 'Alice',
          owner: {
            userId: 'alice' as Id<'user'>,
            name: 'Alice',
            isMine: false,
          },
          isOnRoster: true,
          needsOwner: false,
        },
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: 'Hero' })).toHaveAttribute(
    'href',
    href,
  );
});

test('an organization change announces progress and lets the player retry a failure', () => {
  const retry = vi.fn();
  const { rerender } = render(
    <OrganizationSwitchNotice status={{ kind: 'switching', retry }} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Changing organization…',
  );
  rerender(<OrganizationSwitchNotice status={{ kind: 'failed', retry }} />);
  const failure = screen.getByRole('alert');
  expect(failure).toHaveTextContent('The organization could not be changed.');
  fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<OrganizationSwitchNotice status={{ kind: 'idle', retry }} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([true, false])(
  'a campaign Character can receive an owner from its row at tablet or phone width (%s)',
  async (isWide) => {
    transport.isWide = isWide;
    render(
      <CampaignCharactersView
        scope={campaignScope}
        campaignName="Ironfang"
        characters={[
          {
            id: 'hero' as Id<'character'>,
            name: 'Hero',
            level: 3,
            kind: 'PC',
            active: false,
            ownershipAvailable: true,
            ownerName: null,
            owner: null,
            isOnRoster: false,
            needsOwner: true,
          },
        ]}
      />,
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    fireEvent.click(
      screen.getByRole('button', { name: 'Assign owner for Hero' }),
    );
    const picker = within(screen.getByRole('dialog', { name: 'Choose owner' }));
    fireEvent.click(picker.getByRole('radio', { name: /^Bryn/ }));
    await act(async () =>
      fireEvent.click(picker.getByRole('button', { name: 'Assign owner' })),
    );
    expect(transport.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...campaignScope,
        characterId: 'hero',
        ownerUserId: 'member',
        operationId: expect.any(String),
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Owner assigned.');
  },
);

test('a legacy production campaign row keeps its ledger link and offers no owner assignment', () => {
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          ownerName: 'Ada',
          owner: { userId: 'ada' as Id<'user'>, name: 'Ada', isMine: false },
          ownershipAvailable: false,
          isOnRoster: false,
          needsOwner: false,
          href: '/campaigns/campaign/officers',
        },
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: 'Hero' })).toHaveAttribute(
    'href',
    '/campaigns/campaign/officers',
  );
  expect(
    screen.queryByRole('button', { name: /Assign owner/ }),
  ).not.toBeInTheDocument();
  expect(transport.mutate).not.toHaveBeenCalled();
});

test('rotating the campaign list preserves a pending owner assignment and its late failure', async () => {
  let rejectAssignment: ((error: Error) => void) | undefined;
  transport.mutate.mockReturnValue(
    new Promise<void>((_resolve, reject) => {
      rejectAssignment = reject;
    }),
  );
  const list = () => (
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          ownershipAvailable: true,
          ownerName: null,
          owner: null,
          isOnRoster: false,
          needsOwner: true,
        },
      ]}
    />
  );
  const view = render(list());
  fireEvent.click(
    screen.getByRole('button', { name: 'Assign owner for Hero' }),
  );
  const picker = () =>
    within(screen.getByRole('dialog', { name: 'Choose owner' }));
  fireEvent.click(picker().getByRole('radio', { name: /^Bryn/ }));
  fireEvent.click(picker().getByRole('button', { name: 'Assign owner' }));
  expect(picker().getByRole('status')).toHaveTextContent('Assigning owner…');
  transport.isWide = false;
  view.rerender(list());
  expect(picker().getByRole('status')).toHaveTextContent('Assigning owner…');
  expect(picker().getByRole('radio', { name: /^Bryn/ })).toBeChecked();
  expect(picker().getByRole('button', { name: 'Assign owner' })).toBeDisabled();
  await act(async () => rejectAssignment?.(new Error('Disconnected')));
  expect(picker().getByRole('alert')).toHaveTextContent(
    'Owner may have changed. Check the current owner before trying again.',
  );
  expect(transport.mutate).toHaveBeenCalledTimes(1);
  expect(picker().getByRole('button', { name: 'Assign owner' })).toBeEnabled();
  transport.isWide = true;
  view.rerender(list());
  expect(picker().getByRole('radio', { name: /^Bryn/ })).toBeChecked();
  expect(picker().getByRole('alert')).toHaveTextContent(
    'Owner may have changed. Check the current owner before trying again.',
  );
});

test('rotating the campaign list preserves a pending assignment until its success is acknowledged', async () => {
  let resolveAssignment: (() => void) | undefined;
  transport.mutate.mockReturnValue(
    new Promise<void>((resolve) => {
      resolveAssignment = resolve;
    }),
  );
  const list = () => (
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Ironfang"
      characters={[
        {
          id: 'hero' as Id<'character'>,
          name: 'Hero',
          level: 3,
          kind: 'PC',
          active: true,
          ownershipAvailable: true,
          ownerName: null,
          owner: null,
          isOnRoster: false,
          needsOwner: true,
        },
      ]}
    />
  );
  const view = render(list());
  fireEvent.click(
    screen.getByRole('button', { name: 'Assign owner for Hero' }),
  );
  const picker = () =>
    within(screen.getByRole('dialog', { name: 'Choose owner' }));
  fireEvent.click(picker().getByRole('radio', { name: /^Bryn/ }));
  fireEvent.click(picker().getByRole('button', { name: 'Assign owner' }));
  transport.isWide = false;
  view.rerender(list());
  expect(picker().getByRole('status')).toHaveTextContent('Assigning owner…');
  expect(picker().getByRole('button', { name: 'Assign owner' })).toBeDisabled();
  await act(async () => resolveAssignment?.());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Owner assigned.');
  expect(
    screen.getByRole('button', { name: 'Assign owner for Hero' }),
  ).toBeEnabled();
  expect(transport.mutate).toHaveBeenCalledTimes(1);
});

test.each([true, false])(
  'maintenance explains itself once above the campaign list while every Assign owner is disabled (wide: %s)',
  (isWide) => {
    transport.isWide = isWide;
    transport.readOnly = true;
    const longName =
      'Bartholomew Fitzgerald-Montgomery of the Northern Reaches and Beyond';
    render(
      <CampaignCharactersView
        scope={campaignScope}
        campaignName="Ironfang"
        characters={[
          {
            id: 'hero' as Id<'character'>,
            name: 'Hero',
            level: 3,
            kind: 'PC',
            active: true,
            ownershipAvailable: true,
            ownerName: longName,
            owner: {
              userId: 'member' as Id<'user'>,
              name: longName,
              isMine: true,
            },
            isOnRoster: false,
            needsOwner: false,
          },
          {
            id: 'sidekick' as Id<'character'>,
            name: 'Sidekick',
            level: 1,
            kind: 'NPC',
            active: true,
            ownershipAvailable: true,
            ownerName: null,
            owner: null,
            isOnRoster: false,
            needsOwner: true,
          },
        ]}
      />,
    );
    expect(
      screen.getAllByText('Editing is paused for maintenance.'),
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Assign owner for Hero' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Assign owner for Sidekick' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Take ownership of Sidekick' }),
    ).toBeDisabled();
    const hero = screen.getByText('Hero').closest('tr')!;
    expect(within(hero).getByText(longName)).toBeVisible();
    expect(within(hero).getByText('(me)')).toBeVisible();
    for (const region of screen.getAllByRole('status')) {
      expect(region).toBeEmptyDOMElement();
    }
  },
);

const charactersOrigin: CharacterSheetOrigin = {
  href: '/characters',
  organization: { kind: 'personal' },
};
const whisper = {
  relationshipId: 'rel-whisper' as Id<'companionRelationship'>,
  role: 'companion',
  kind: 'familiar',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'owl' as Id<'character'>, name: 'Whisper' },
  sources: [],
  linkedInputs: [],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;
const hiddenLord = {
  ...whisper,
  relationshipId: 'rel-lord' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'cohort',
  status: 'replaced',
  endpoint: null,
} satisfies CompanionRelationship;

function companionsOwner(companions = true) {
  return (
    <OwnedCharactersView
      groups={[
        {
          key: 'none',
          title: 'No campaign',
          characters: [
            {
              id: 'mira',
              name: 'Mira',
              level: 1,
              kind: 'PC',
              active: true,
              href: '/characters/mira',
              companions: companions
                ? {
                    characterId: 'mira' as Id<'character'>,
                    origin: charactersOrigin,
                  }
                : undefined,
            },
          ],
        },
      ]}
    />
  );
}

test('a Character row discloses its Companion Relationships on request, linking accessible sheets and never naming an unavailable one', () => {
  const view = render(companionsOwner());
  const toggle = screen.getByRole('button', { name: 'Companions of Mira' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(transport.relationshipReads).toEqual([]);

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Loading companions…');
  expect(transport.relationshipReads.at(-1)).toEqual({ characterId: 'mira' });

  transport.relationships = [];
  view.rerender(companionsOwner());
  expect(screen.getByText('No Companion Relationships.')).toBeVisible();

  transport.relationships = [whisper, hiddenLord];
  view.rerender(companionsOwner());
  const list = screen.getByRole('list', { name: 'Companions of Mira' });
  expect(
    within(list)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('aria-label')),
  ).toEqual([
    'Companion Whisper',
    'Associated Character Character unavailable',
  ]);
  const companion = within(list).getByRole('listitem', {
    name: 'Companion Whisper',
  });
  expect(within(companion).getByText('Familiar')).toBeVisible();
  expect(within(companion).getByText('Active')).toBeVisible();
  expect(
    within(companion).getByRole('link', { name: 'Whisper' }),
  ).toHaveAttribute('href', characterSheetPath('owl', charactersOrigin));
  const hidden = within(list).getByRole('listitem', {
    name: 'Associated Character Character unavailable',
  });
  expect(within(hidden).queryByRole('link')).toBeNull();
  expect(within(hidden).getByText('Replaced')).toBeVisible();
  expect(document.body.innerHTML).not.toMatch(/rel-lord|rel-whisper/);

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('list', { name: 'Companions of Mira' })).toBeNull();

  view.rerender(companionsOwner(false));
  expect(screen.queryByRole('button', { name: /Companions/ })).toBeNull();
});

test('a campaign row offers Companions only for a Character with a sheet', () => {
  const sheetless = {
    id: 'legacy' as Id<'character'>,
    name: 'Legacy hero',
    level: 3,
    kind: 'PC',
    active: true,
    ownershipAvailable: false,
    ownerName: null,
    owner: null,
    isOnRoster: true,
    needsOwner: false,
  };
  render(
    <CampaignCharactersView
      scope={campaignScope}
      campaignName="Kingmaker"
      characters={[
        sheetless,
        {
          ...sheetless,
          id: 'alia' as Id<'character'>,
          name: 'Alia',
          href: '/characters/alia',
          companions: {
            characterId: 'alia' as Id<'character'>,
            origin: charactersOrigin,
          },
        },
      ]}
    />,
  );
  expect(
    screen.queryByRole('button', { name: 'Companions of Legacy hero' }),
  ).toBeNull();
  transport.relationships = [whisper];
  fireEvent.click(screen.getByRole('button', { name: 'Companions of Alia' }));
  const alia = screen.getByRole('link', { name: 'Alia' }).closest('tr');
  expect(alia).not.toBeNull();
  expect(
    within(alia as HTMLElement).getByRole('link', { name: 'Whisper' }),
  ).toBeVisible();
});

// ---------- The campaign's deletion on its Characters page (#710) ----------

test('while the campaign is being deleted, the Characters page shows the progress and stays usable', () => {
  campaignDeletion.deletion = {
    campaignId: 'campaign',
    campaignName: 'Ironfang',
    state: 'returning',
    remaining: 3,
    setAside: 1,
    blockers: null,
    deletedAt: null,
    hasHistory: true,
  };
  render(
    <CampaignCharactersView
      campaignName="Ironfang"
      scope={campaignScope}
      characters={[]}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    "Deleting this campaign. 3 Characters are going back to their owners. 1 couldn't be moved yet and will be tried again.",
  );
  expect(screen.getByText('No characters in this campaign yet.')).toBeVisible();
});

test('a paused deletion on the Characters page offers Continue deleting without a link elsewhere', () => {
  campaignDeletion.deletion = {
    campaignId: 'campaign',
    campaignName: 'Ironfang',
    state: 'blocked',
    remaining: 2,
    setAside: 0,
    blockers: { ownerless: 2, unreturnable: 0 },
    deletedAt: null,
    hasHistory: true,
  };
  render(
    <CampaignCharactersView
      campaignName="Ironfang"
      scope={campaignScope}
      characters={[]}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Deleting this campaign is paused: 2 Characters need an owner.',
  );
  expect(screen.queryByRole('link', { name: 'Assign owners' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Continue deleting' }));
  expect(campaignDeletion.submit).toHaveBeenCalledTimes(1);
});
