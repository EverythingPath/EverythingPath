import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { CharactersSection } from '~/components/campaign-sections/characters-section';
import type { CharacterKind } from '~/lib/character-kind';
import { convexNames } from '../../../tests/convex-names';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';

// Characters & officers (#182): the officer board over one alphabetical
// character table, and the shared Add/Edit record dialog.

type StoredCharacter = {
  _id: string;
  campaignId: string;
  name: string;
  description: string;
  kind: CharacterKind;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  owner?: { userId: string; name: string; isMine: boolean } | null;
  ownershipAvailable?: boolean;
  ownerLastOperationId?: string;
  isActive?: boolean;
  sheetMode?: 'militiaOnly' | 'full';
  sheetRevision?: number;
  classLevels?: { entryId: string; position: number; name: string }[];
};
type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let queries: Record<string, unknown> = {};
let readOnly = false;
const navigate = vi.fn();

const nameOf = convexNames({
  listByCampaign: api.character.listByCampaign,
  createCharacter: api.character.createCharacter,
  updateCharacter: api.character.updateCharacter,
  archiveCharacter: api.character.archiveCharacter,
  reassignOwner: api.character.reassignOwner,
  workspace: api.canonicalDraftPersistence.workspace,
  observe: api.canonicalDraftPersistence.observe,
  read: api.canonicalLedger.read,
  buildOut: api.characterSheet.buildOut,
  me: api.user.getMe,
});
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: readOnly ? 'maintenance' : 'ready',
    readOnly,
    message: readOnly ? 'Editing is paused for maintenance.' : '',
  }),
}));
vi.mock('convex/react', () => ({
  // The viewer's own account, read while nobody owns a Character (#708).
  useQuery: (query: FunctionReference<'query'>, args: unknown) => {
    if (args === 'skip') return undefined;
    if (nameOf(query) === 'me') return { _id: 'bryn' };
    throw new Error(`Unexpected subscription ${nameOf(query)}.`);
  },
  usePaginatedQuery: () => ({
    results: [
      { userId: 'ada', name: 'Ada', isMine: false },
      { userId: 'bryn', name: 'Bryn', isMine: true },
    ],
    status: 'Exhausted',
    loadMore: vi.fn(),
  }),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) => {
        calls.push({ name, args, resolve, reject });
      });
  },
}));
vi.mock('@tanstack/react-query', async () => {
  const { queryDataMock } = await import('../../../tests/query-data');
  return queryDataMock((name) => queries[nameOf(name)]);
});
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
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      aria-label="Kind"
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

const campaignId = 'campaign' as Id<'campaign'>;
function character(
  _id: string,
  name: string,
  values: Partial<StoredCharacter> = {},
): StoredCharacter {
  return {
    _id,
    campaignId,
    name,
    description: '',
    kind: 'pc',
    level: 3,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    isActive: true,
    ...values,
  };
}
const records = () => [
  character('sera', 'Sera of Phaendar', {
    kind: 'npc',
    level: 4,
    charisma: 17,
    description: 'Innkeeper',
  }),
  character('bren', 'Bren Ironhand', { level: 7, strength: 18 }),
  character('dalla', 'Dalla Rook', { level: 4, isActive: false }),
  character('aria', 'aria Vell', { level: 6 }),
];
const facts = (list: StoredCharacter[]) =>
  list.map((record) => ({
    characterId: record._id,
    level: record.level,
    strength: record.strength,
    dexterity: record.dexterity,
    constitution: record.constitution,
    intelligence: record.intelligence,
    wisdom: record.wisdom,
    charisma: record.charisma,
    isActive: record.isActive !== false,
  }));
function militia(list = records()) {
  const onRoster = list.filter((record) => record._id !== 'aria');
  return {
    key: { campaignId, militiaId: 'militia', draftId: 'draft' },
    week: 3,
    sourceRevision: 1,
    people: [],
    snapshot: {
      focus: 'Loyalty',
      characters: facts(onRoster),
      roster: {
        people: onRoster.map((record) => ({
          characterId: record._id,
          kind: record._id === 'sera' ? 'npc' : 'pc',
          hitDice: record._id === 'bren' ? 5 : null,
        })),
        officers: [
          { role: 'marshal', characterId: 'bren' },
          { role: 'commandant', characterId: 'bren' },
          { role: 'commandant', characterId: 'dalla' },
          { role: 'ambassador', characterId: 'sera' },
        ],
        teams: ['Smugglers', 'Town Watch'].map((name) => ({
          teamId: name,
          teamType: 'patrons',
          name,
          status: 'active',
          rewardCapExempt: false,
          managerCharacterId: 'sera',
          notes: '',
        })),
      },
    },
  };
}
const openDraft = {
  status: 'open',
  draft: {
    activity: {
      slots: [
        { slotId: 's1', choice: null },
        {
          slotId: 's2',
          choice: {
            choiceId: 'c2',
            actionId: 'change_officer_role',
            characterId: 'bren',
            fromRole: 'marshal',
            toRole: 'spymaster',
          },
        },
      ],
    },
  },
};
// The accepted militia as the corrections read it, from the same facts.
const weekContext = {
  firstMilitiaWeek: false,
  startDay: 14,
  uneventfulCarry: false,
  carriedEvents: [],
  queuedEffects: [],
  orders: [],
  lastBuyoffWeek: null,
};
function ledgerOf(workspace: unknown, revision = 1) {
  if (!workspace) return undefined;
  const { week, snapshot } = workspace as ReturnType<typeof militia>;
  return {
    revision,
    state: { week, context: weekContext, militiaSnapshot: snapshot },
  };
}
function setQueries(
  list: StoredCharacter[] | undefined = records(),
  workspace: unknown = militia(list),
  observe: unknown = openDraft,
) {
  queries = {
    listByCampaign: list,
    workspace,
    observe,
    read: ledgerOf(workspace),
  };
}
const page = () => (
  <CharactersSection campaignId={campaignId} organizationId="org" />
);
const board = () => screen.getByRole('region', { name: 'Officers' });
const roleCard = (name: string) =>
  within(board()).getByRole('region', { name });
const table = () =>
  within(screen.getByRole('region', { name: 'Characters' })).getByRole('table');
const rowOf = (name: string) =>
  within(table())
    .getAllByRole('row')
    .find((row) =>
      within(row).queryByRole('rowheader', { name: new RegExp(`^${name}`) }),
    )!;
const dialog = () => screen.getByRole('dialog');
const field = (name: string) => within(dialog()).getByRole('textbox', { name });
const type = (name: string, value: string) =>
  fireEvent.change(field(name), { target: { value } });
async function press(name: string, container = dialog()) {
  await act(async () => {
    fireEvent.click(within(container).getByRole('button', { name }));
  });
}

beforeEach(() => {
  calls = [];
  readOnly = false;
  navigate.mockReset();
  setQueries();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('page states', () => {
  test('shows an accessible skeleton while records or the militia load', () => {
    queries = { workspace: null };
    const { rerender } = render(page());
    expect(
      screen.getByRole('status', { name: 'Loading characters…' }),
    ).toBeVisible();
    queries = { listByCampaign: records() };
    rerender(page());
    expect(
      screen.getByRole('status', { name: 'Loading characters…' }),
    ).toBeVisible();
  });

  test('before Setup, all six roles ask for a militia and records still work', async () => {
    setQueries(records(), null, undefined);
    render(page());
    for (const role of [
      'Marshal',
      'Ambassador',
      'Spymaster',
      'Strategist',
      'Commandant',
      'Overseer',
    ])
      expect(roleCard(role)).toHaveTextContent(
        'Set up militia to assign officers.',
      );
    expect(
      within(board()).getByRole('link', { name: 'Set up militia' }),
    ).toHaveAttribute('href', '/campaigns/campaign/setup');
    // No roster yet: no roster column, and records keep their own number.
    expect(
      within(table()).queryByRole('columnheader', { name: 'On roster' }),
    ).toBeNull();
    expect(rowOf('Bren Ironhand')).toHaveTextContent('7 HD');
    await press(
      'Add character',
      screen.getByRole('region', { name: 'Characters' }),
    );
    type('Name', 'Mira');
    await press('Save');
    expect(calls[0]).toMatchObject({
      name: 'createCharacter',
      args: {
        organizationId: 'org',
        character: { campaignId, name: 'Mira', kind: 'pc', level: 1 },
      },
    });
  });

  test('keeps the empty active and archived states', () => {
    setQueries([], null, undefined);
    render(page());
    expect(screen.getByText('No active characters.')).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(screen.getByText('No archived characters.')).toBeVisible();
  });
});

describe('officer board', () => {
  test('shows every role with its effect and source, vacancies, archived holders and pending changes', () => {
    render(page());
    expect(board()).toHaveTextContent('Focus: Loyalty');
    expect(roleCard('Marshal')).toHaveTextContent(
      'Security +4 (Bren Ironhand, Str)',
    );
    expect(roleCard('Ambassador')).toHaveTextContent(
      'Loyalty +3 (Sera of Phaendar, Cha)',
    );
    // Bren's override 5 and archived Dalla's level 4 both count.
    const commandant = roleCard('Commandant');
    expect(commandant).toHaveTextContent(
      '+9 training on a successful Drill (Bren Ironhand 5 HD + Dalla Rook 4 HD)',
    );
    expect(within(commandant).getByText('archived')).toBeVisible();
    // Dalla's row is hidden, but her card keeps the warning.
    expect(commandant).toHaveTextContent(
      'Dalla Rook is archived but still assigned.',
    );
    expect(roleCard('Strategist')).toHaveTextContent('Vacant: no extra action');
    // A pending change shows on both roles, and is not applied.
    const spymaster = roleCard('Spymaster');
    expect(spymaster).toHaveTextContent('Vacant: no Secrecy bonus');
    expect(spymaster).toHaveTextContent(
      'Pending this week: Bren Ironhand: Marshal → Spymaster (Activity, slot 2)',
    );
    expect(roleCard('Marshal')).toHaveTextContent('Pending this week');
  });

  test('pending changes above the table link to this campaign’s Activity', () => {
    render(page());
    const characters = screen.getByRole('region', { name: 'Characters' });
    expect(characters).toHaveTextContent(
      'Pending this week' +
        'Bren Ironhand: Marshal → Spymaster (Activity, slot 2)',
    );
    expect(
      within(characters).getByRole('link', { name: 'Go to Activity' }),
    ).toHaveAttribute('href', '/campaigns/campaign/week?phase=activity');
  });

  test('a closed or missing draft shows no pending changes', () => {
    setQueries(records(), militia(), { status: 'closed', draft: null });
    render(page());
    expect(screen.queryByText(/Pending this week/)).toBeNull();
  });

  test('a role chip moves focus to its card', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(page());
    fireEvent.click(
      within(rowOf('Bren Ironhand')).getByRole('button', {
        name: 'Commandant',
      }),
    );
    expect(roleCard('Commandant')).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
  });
});

describe('character table', () => {
  test('lists active records alphabetically; Show archived reveals archived rows', () => {
    render(page());
    const names = () =>
      within(table())
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent);
    expect(names()).toEqual([
      'aria Vell',
      'Bren Ironhand' + 'Bren Ironhand holds more than one officer role.',
      'Sera of Phaendar',
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Characters' })).getByText(
        '3 on the roster · 1 not',
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(names()).toContain(
      'Dalla Rook' + 'archived' + 'Dalla Rook is archived but still assigned.',
    );
    expect(names()[2]).toMatch(/^Dalla Rook/);
  });

  test('shows kind, effective Hit Dice, roles and read-only managed teams', () => {
    render(page());
    const sera = rowOf('Sera of Phaendar');
    // Sera's blank override follows her level.
    expect(sera).toHaveTextContent('NPC');
    expect(sera).toHaveTextContent('4 HD');
    const teams = within(sera).getByRole('link', {
      name: 'Manages 2 of 3 teams',
    });
    expect(teams).toHaveAttribute(
      'href',
      '/campaigns/campaign/militia?section=teams',
    );
    expect(rowOf('Bren Ironhand')).toHaveTextContent('5 HD');
    expect(rowOf('aria Vell')).toHaveTextContent('Not on roster');
    // Roster and officers are corrected here: the retired Militia fallback
    // is no longer linked.
    expect(
      screen.queryByRole('link', { name: 'People & officers' }),
    ).toBeNull();
  });

  test('phones get one card per character with the same facts and operations', () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    render(page());
    expect(screen.queryByRole('table')).toBeNull();
    const card = screen
      .getByRole('heading', { name: 'Sera of Phaendar' })
      .closest('li')!;
    expect(card).toHaveTextContent('NPC');
    expect(within(card).getByRole('link', { name: 'Manages 2 of 3 teams' }));
    expect(
      within(card).getByRole('button', { name: 'Edit Sera of Phaendar' }),
    ).toBeVisible();
    // @ts-expect-error jsdom has no matchMedia by default
    delete window.matchMedia;
  });

  test('the officers ledger keeps archived rows marked with an Owner column', () => {
    render(page());
    expect(screen.getByRole('columnheader', { name: 'Owner' })).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(within(rowOf('Dalla Rook')).getByText('archived')).toBeVisible();
  });

  test('another player’s record change reaches the table', () => {
    const { rerender } = render(page());
    const list = records();
    list[1]!.level = 9;
    list.push(character('cara', 'Cara', { level: 2 }));
    setQueries(list, militia(list));
    rerender(page());
    expect(rowOf('Cara')).toHaveTextContent('2 HD');
    expect(roleCard('Commandant')).toHaveTextContent('Bren Ironhand 5 HD');
  });
});

describe('record dialog', () => {
  async function openEdit(name: string) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
    });
    return screen.getByRole('dialog', { name: 'Edit character' });
  }

  test('validates a cleared or malformed Hit Dice field without writing', async () => {
    render(page());
    await openEdit('Bren Ironhand');
    expect(field('Hit Dice')).toHaveValue('7');
    type('Hit Dice', '');
    await press('Save');
    expect(within(dialog()).getByText('Hit Dice is required')).toBeVisible();
    type('Hit Dice', 'two');
    await press('Save');
    expect(
      within(dialog()).getByText('Hit Dice must be a whole number'),
    ).toBeVisible();
    type('Hit Dice', '0');
    await press('Save');
    expect(
      within(dialog()).getByText('Hit Dice must be at least 1'),
    ).toBeVisible();
    type('Name', ' ');
    type('CHA', '');
    await press('Save');
    expect(
      within(dialog()).getByText('Character name is required'),
    ).toBeVisible();
    expect(within(dialog()).getByText('CHA is required')).toBeVisible();
    // The save summary links each invalid field to its control.
    const summary = within(dialog()).getByRole('alert');
    expect(summary).toHaveTextContent('Fix these before saving');
    fireEvent.click(within(summary).getByRole('button', { name: 'CHA' }));
    await waitFor(() => expect(field('CHA')).toHaveFocus());
    expect(calls).toEqual([]);
  });

  test('edits a record, sending only changed fields and keeping its archive state', async () => {
    render(page());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await openEdit('Dalla Rook');
    type('Hit Dice', '5');
    type('Notes', 'Back from the war');
    fireEvent.change(within(dialog()).getByRole('combobox', { name: 'Kind' }), {
      target: { value: 'npc' },
    });
    await press('Save');
    expect(calls[0]!.name).toBe('updateCharacter');
    expect(calls[0]!.args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'dalla',
      patch: { description: 'Back from the war', kind: 'npc', level: 5 },
    });
    expect(
      within(dialog()).getByRole('button', { name: 'Saving…' }),
    ).toBeDisabled();
    await act(async () => calls[0]!.resolve(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('saved statistics refresh the ledger and officer effects without replacing assignments or Hit Dice overrides', async () => {
    const { rerender } = render(page());
    await openEdit('Bren Ironhand');
    type('Name', 'Bren the Marshal');
    type('Hit Dice', '9');
    type('STR', '20');
    type('DEX', '12');
    type('CON', '14');
    type('INT', '16');
    type('WIS', '13');
    type('CHA', '15');
    type('Notes', 'Leads the weekly drill');
    fireEvent.change(within(dialog()).getByRole('combobox', { name: 'Kind' }), {
      target: { value: 'npc' },
    });
    await press('Save');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: 'updateCharacter',
      args: {
        organizationId: 'org',
        characterId: 'bren',
        patch: {
          name: 'Bren the Marshal',
          level: 9,
          strength: 20,
          dexterity: 12,
          constitution: 14,
          intelligence: 16,
          wisdom: 13,
          charisma: 15,
          description: 'Leads the weekly drill',
          kind: 'npc',
        },
      },
    });
    await act(async () => calls[0]!.resolve(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // The subscription publishes the accepted record and militia facts.
    const list = records();
    list[1] = character('bren', 'Bren the Marshal', {
      kind: 'npc',
      level: 9,
      strength: 20,
      dexterity: 12,
      constitution: 14,
      intelligence: 16,
      wisdom: 13,
      charisma: 15,
      description: 'Leads the weekly drill',
    });
    setQueries(list, militia(list));
    rerender(page());
    expect(rowOf('Bren the Marshal')).toHaveTextContent('NPC');
    expect(rowOf('Bren the Marshal')).toHaveTextContent('5 HD');
    expect(roleCard('Marshal')).toHaveTextContent(
      'Security +5 (Bren the Marshal, Str)',
    );
    expect(roleCard('Commandant')).toHaveTextContent(
      'Bren the Marshal 5 HD + Dalla Rook 4 HD',
    );
    await openEdit('Bren the Marshal');
    expect(field('Hit Dice')).toHaveValue('9');
    expect(field('STR')).toHaveValue('20');
    expect(field('DEX')).toHaveValue('12');
    expect(field('CON')).toHaveValue('14');
    expect(field('INT')).toHaveValue('16');
    expect(field('WIS')).toHaveValue('13');
    expect(field('CHA')).toHaveValue('15');
    expect(field('Notes')).toHaveValue('Leads the weekly drill');
  });

  test('Archive keeps unsaved edits, warns what stays assigned and never unassigns', async () => {
    render(page());
    await openEdit('Sera of Phaendar');
    expect(dialog()).toHaveTextContent(
      'Archiving keeps Sera of Phaendar as Ambassador and manager of Smugglers and Town Watch.',
    );
    type('Notes', 'Left for Phaendar');
    await press('Archive');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'sera',
      patch: { description: 'Left for Phaendar', isActive: false },
    });
    // A refused archive keeps the dialog, its values and says why.
    await act(async () =>
      calls[0]!.reject(new ConvexError('You do not have access to this org')),
    );
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'You do not have access to this org',
    );
    expect(field('Notes')).toHaveValue('Left for Phaendar');
    await press('Archive');
    await act(async () => calls[1]!.resolve(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Only the record changes: no roster or officer write exists here.
    expect(calls.map((call) => call.name)).toEqual([
      'updateCharacter',
      'updateCharacter',
    ]);
  });

  test('Archive with invalid edits shows the field errors and archives nothing', async () => {
    render(page());
    await openEdit('Bren Ironhand');
    type('Hit Dice', '');
    await press('Archive');
    expect(within(dialog()).getByText('Hit Dice is required')).toBeVisible();
    expect(calls).toEqual([]);
  });

  test('an archived record offers Un-archive', async () => {
    render(page());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await openEdit('Dalla Rook');
    expect(
      within(dialog()).queryByRole('button', { name: 'Archive' }),
    ).toBeNull();
    // Without edits, only the archive state changes.
    await press('Un-archive');
    expect(calls[0]).toMatchObject({
      name: 'archiveCharacter',
      args: { organizationId: 'org', characterId: 'dalla', isActive: true },
    });
    await act(async () => calls[0]!.reject(new Error('')));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'Failed to un-archive character.',
    );
  });

  test("an edit keeps another player's change to a field this player left alone", async () => {
    const { rerender } = render(page());
    await openEdit('Bren Ironhand');
    // Another player raises Bren's Charisma while the dialog is open.
    const list = records();
    list[1]!.charisma = 14;
    setQueries(list, militia(list));
    rerender(page());
    type('Notes', 'Drillmaster');
    await press('Save');
    expect(calls[0]!.args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'bren',
      patch: { description: 'Drillmaster' },
    });
  });

  test('another player confirming the week keeps the unsaved edit', async () => {
    const view = render(page());
    await openEdit('Bren Ironhand');
    type('Name', 'Unsaved new name');
    type('STR', '12');
    type('Notes', 'Drillmaster');
    // Confirmation opens week 4: its draft is briefly unobserved.
    const next = { ...militia(), week: 4 };
    next.key = { ...next.key, draftId: 'draft-4' };
    setQueries(records(), next);
    queries.observe = undefined;
    view.rerender(page());
    // The page stays behind the modal dialog, without last week's pending
    // change on the table or the Marshal card.
    const hidden = { hidden: true };
    expect(
      screen.queryByRole('status', { name: 'Loading characters…', ...hidden }),
    ).toBeNull();
    expect(
      screen.getByRole('region', { name: 'Officers', ...hidden }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Pending this week|→ Spymaster/)).toBeNull();
    expect(field('Name')).toHaveValue('Unsaved new name');
    setQueries(records(), next, {
      status: 'open',
      draft: {
        activity: {
          slots: [
            {
              slotId: 's1',
              choice: {
                choiceId: 'c1',
                actionId: 'change_officer_role',
                characterId: 'bren',
                fromRole: 'marshal',
                toRole: 'strategist',
              },
            },
          ],
        },
      },
    });
    view.rerender(page());
    // Only the new week's pending change shows.
    expect(screen.queryByText(/→ Spymaster/)).toBeNull();
    expect(screen.getAllByText(/Marshal → Strategist/).length).toBeGreaterThan(
      0,
    );
    expect(field('Name')).toHaveValue('Unsaved new name');
    expect(field('STR')).toHaveValue('12');
    expect(field('Notes')).toHaveValue('Drillmaster');
    await press('Save');
    expect(calls[0]!.args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'bren',
      patch: {
        name: 'Unsaved new name',
        strength: 12,
        description: 'Drillmaster',
      },
    });
  });

  test('a campaign or organization change closes the dialog and loads again', async () => {
    const view = render(page());
    for (const [nextCampaign, nextOrganization] of [
      ['campaign-2', 'org'],
      ['campaign-2', 'org-2'],
    ] as const) {
      await openEdit('Bren Ironhand');
      type('Name', 'Unsaved new name');
      const next = () => (
        <CharactersSection
          campaignId={nextCampaign as Id<'campaign'>}
          organizationId={nextOrganization}
        />
      );
      queries = { workspace: undefined };
      view.rerender(next());
      expect(
        screen.getByRole('status', { name: 'Loading characters…' }),
      ).toBeVisible();
      setQueries();
      view.rerender(next());
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  test('a refused add keeps the values and a second press never writes twice', async () => {
    render(page());
    await press(
      'Add character',
      screen.getByRole('region', { name: 'Characters' }),
    );
    expect(screen.getByRole('dialog', { name: 'Add character' })).toBeVisible();
    expect(
      within(dialog()).queryByRole('button', { name: 'Archive' }),
    ).toBeNull();
    type('Name', 'Mira');
    type('Hit Dice', '4');
    await press('Save');
    await press('Saving…');
    expect(calls).toHaveLength(1);
    await act(async () =>
      calls[0]!.reject(new ConvexError('Character name cannot be empty')),
    );
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'Character name cannot be empty',
    );
    expect(field('Name')).toHaveValue('Mira');
    expect(field('Hit Dice')).toHaveValue('4');
  });
});

// Prepared records (#261): a minimal Character's Level and permanent scores
// are the ledger's to edit, with Build out one way; a full one reads them
// from its sheet. Neither is labelled as such.
describe('prepared records', () => {
  const fighter = { entryId: 'fighter-level', position: 2, name: 'Fighter' };
  const wizard = { entryId: 'wizard-level', position: 3, name: 'Wizard' };
  const prepared = () => [
    character('hessa', 'Hessa', {
      sheetMode: 'militiaOnly',
      sheetRevision: 3,
      level: 3,
      strength: 16,
      classLevels: [
        { entryId: 'first-level', position: 1, name: 'Unspecified' },
        fighter,
        wizard,
      ],
    }),
    character('kesh', 'Kesh', {
      sheetMode: 'full',
      sheetRevision: 8,
      level: 5,
      strength: 10.5,
      description: 'Rides with the militia.',
    }),
    character('tobin', 'Tobin', { sheetMode: 'militiaOnly', level: 0 }),
    ...records(),
  ];
  function withOverride(list: StoredCharacter[], hitDice: number) {
    const source = militia(list);
    const roster = source.snapshot.roster;
    roster.people = roster.people.map((person) =>
      person.characterId === 'hessa' ? { ...person, hitDice } : person,
    );
    return source;
  }
  async function openEdit(name: string) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
    });
    return screen.getByRole('dialog', { name: 'Edit character' });
  }
  const cellsOf = (row: HTMLElement) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
  const removalQuestion = () =>
    screen.getByRole('group', { name: 'Remove Class Levels?' });
  const buildOutButton = (name: string) =>
    screen.getByRole('button', { name: `Build out ${name}` });

  beforeEach(() => {
    setQueries(prepared(), withOverride(prepared(), 0));
  });

  test('rows show Level and the six scores beside the roster facts, with Build out or the sheet and no presentation label', () => {
    render(page());
    const headers = within(table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'On roster',
      'Character',
      'Owner',
      'Kind',
      'Level',
      'STR',
      'DEX',
      'CON',
      'INT',
      'WIS',
      'CHA',
      'Hit Dice',
      'Officer roles',
      'Teams',
      'Actions',
    ]);
    // Hessa's explicit zero override stands beside her level.
    expect(cellsOf(rowOf('Hessa')).slice(0, 11)).toEqual([
      'On roster',
      '',
      'PC',
      '3',
      '16',
      '10',
      '10',
      '10',
      '10',
      '10',
      '0 HD',
    ]);
    expect(
      within(rowOf('Hessa')).getByRole('button', {
        name: 'Build out Hessa',
      }),
    ).toBeEnabled();
    expect(
      within(rowOf('Hessa')).queryByRole('link', { name: /Sheet/ }),
    ).toBeNull();
    expect(cellsOf(rowOf('Kesh')).slice(3, 5)).toEqual(['5', '10.5']);
    expect(
      within(rowOf('Kesh')).getByRole('link', { name: 'Sheet for Kesh' }),
    ).toHaveAttribute(
      'href',
      '/characters/kesh?from=%2Fcampaigns%2Fcampaign%2Fofficers&organizationId=org',
    );
    expect(
      within(rowOf('Kesh')).queryByRole('button', { name: /Build out/ }),
    ).toBeNull();
    // An unprepared record keeps Edit alone; roster warnings stay.
    expect(within(rowOf('Bren Ironhand')).getAllByRole('button')).toHaveLength(
      3,
    );
    expect(rowOf('Bren Ironhand')).toHaveTextContent(
      'Bren Ironhand holds more than one officer role.',
    );
    expect(screen.queryByText(/Militia-only|^Full$|Status/)).toBeNull();
    expect(screen.queryByText(/\d+ warnings?/)).toBeNull();
  });

  test('phone cards stack Level, scores and the actions', () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    render(page());
    const card = required(
      screen.getByRole('heading', { name: 'Hessa' }).closest('li'),
    );
    const terms = within(card)
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(terms).toEqual(['Level', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
    expect(
      within(card).getByText('Level').nextElementSibling,
    ).toHaveTextContent('3');
    expect(
      within(card).getByRole('button', { name: 'Build out Hessa' }),
    ).toBeVisible();
    expect(
      within(card).getByRole('button', { name: 'Edit Hessa' }),
    ).toBeVisible();
    const kesh = required(
      screen.getByRole('heading', { name: 'Kesh' }).closest('li'),
    );
    expect(
      within(kesh).getByRole('link', { name: 'Sheet for Kesh' }),
    ).toBeVisible();
    // @ts-expect-error jsdom has no matchMedia by default
    delete window.matchMedia;
  });

  test('a prepared record is edited as Level; an increase saves at once and leaves the roster override alone', async () => {
    render(page());
    await openEdit('Hessa');
    expect(
      within(dialog()).queryByRole('textbox', { name: 'Hit Dice' }),
    ).toBeNull();
    expect(field('Level')).toHaveValue('3');
    type('Level', '5');
    type('STR', '17');
    await press('Save');
    expect(
      screen.queryByRole('group', { name: 'Remove Class Levels?' }),
    ).toBeNull();
    expect(calls).toHaveLength(1);
    expect(required(calls[0]).args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'hessa',
      patch: { level: 5, strength: 17 },
    });
    await act(async () => required(calls[0]).resolve(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.map((call) => call.name)).toEqual(['updateCharacter']);
  });

  test('a prepared level of zero is valid while empty, negative and fractional values are refused in place', async () => {
    render(page());
    await openEdit('Hessa');
    type('Level', '');
    await press('Save');
    expect(within(dialog()).getByText('Level is required')).toBeVisible();
    type('Level', '-1');
    await press('Save');
    expect(
      within(dialog()).getByText('Level must be at least 0'),
    ).toBeVisible();
    type('Level', '1.5');
    await press('Save');
    expect(
      within(dialog()).getByText('Level must be a whole number'),
    ).toBeVisible();
    type('STR', 'strong');
    await press('Save');
    expect(within(dialog()).getByText('STR must be a number')).toBeVisible();
    expect(calls).toEqual([]);
    expect(
      within(within(dialog()).getByRole('alert')).getByRole('button', {
        name: 'Level',
      }),
    ).toBeVisible();
  });

  test('lowering the level names every trailing row first; Keep writes nothing and keeps the input, Escape is Keep', async () => {
    render(page());
    await openEdit('Hessa');
    type('Level', '1');
    type('Notes', 'Scout');
    type('STR', '10');
    const save = within(dialog()).getByRole('button', { name: 'Save' });
    save.focus();
    await press('Save');
    const question = removalQuestion();
    expect(question).toHaveAccessibleDescription(
      /Lowering the level to 1 removes these Class Levels\./,
    );
    expect(
      within(question)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Level 2 · Fighter', 'Level 3 · Wizard']);
    expect(calls).toEqual([]);
    const keep = within(question).getByRole('button', {
      name: 'Keep Class Levels',
    });
    expect(keep).toHaveFocus();
    // The form waits underneath, visible but inert.
    expect(dialog().querySelector('form')).toHaveAttribute('inert');
    await act(async () => {
      fireEvent.click(keep);
    });
    expect(
      screen.queryByRole('group', { name: 'Remove Class Levels?' }),
    ).toBeNull();
    expect(dialog().querySelector('form')).not.toHaveAttribute('inert');
    expect(field('Level')).toHaveValue('1');
    expect(field('Level')).toHaveFocus();
    expect(field('Notes')).toHaveValue('Scout');
    expect(field('STR')).toHaveValue('10');
    expect(calls).toEqual([]);
    // Escape answers Keep too, and never closes the dialog.
    await press('Save');
    await act(async () => {
      fireEvent.keyDown(
        within(removalQuestion()).getByRole('button', {
          name: 'Keep Class Levels',
        }),
        { key: 'Escape' },
      );
    });
    expect(
      screen.queryByRole('group', { name: 'Remove Class Levels?' }),
    ).toBeNull();
    expect(dialog()).toBeVisible();
    expect(field('Notes')).toHaveValue('Scout');
    expect(calls).toEqual([]);
  });

  test('Remove sends the named rows and revision with the edits; a conflict keeps the input and the next question names the live rows', async () => {
    const view = render(page());
    await openEdit('Hessa');
    type('Level', '1');
    type('Notes', 'Scout');
    await press('Save');
    await press('Remove Class Levels', removalQuestion());
    expect(calls).toHaveLength(1);
    expect(required(calls[0]).args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'hessa',
      patch: { level: 1, description: 'Scout' },
      confirmedRemovedLevelIds: ['fighter-level', 'wizard-level'],
      expectedSheetRevision: 3,
    });
    expect(
      within(dialog()).getByRole('button', { name: 'Saving…' }),
    ).toBeDisabled();
    // Another player changed the sheet first: the write is refused, the
    // input stays, and a new Save asks about the rows as they are now.
    const list = prepared();
    list[0] = character('hessa', 'Hessa', {
      sheetMode: 'militiaOnly',
      sheetRevision: 4,
      level: 3,
      strength: 16,
      classLevels: [
        { entryId: 'first-level', position: 1, name: 'Unspecified' },
        { entryId: 'rogue-level', position: 2, name: 'Rogue' },
        wizard,
      ],
    });
    setQueries(list, withOverride(list, 0));
    view.rerender(page());
    await act(async () =>
      required(calls[0]).reject(
        new ConvexError('The sheet changed. Check it and try again.'),
      ),
    );
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'The sheet changed. Check it and try again.',
    );
    expect(
      screen.queryByRole('group', { name: 'Remove Class Levels?' }),
    ).toBeNull();
    expect(field('Level')).toHaveValue('1');
    expect(field('Notes')).toHaveValue('Scout');
    await press('Save');
    expect(
      within(removalQuestion())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Level 2 · Rogue', 'Level 3 · Wizard']);
    await press('Remove Class Levels', removalQuestion());
    expect(required(calls[1]).args).toMatchObject({
      confirmedRemovedLevelIds: ['rogue-level', 'wizard-level'],
      expectedSheetRevision: 4,
    });
    await act(async () => required(calls[1]).resolve(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('Archive resumes after Remove with the unsaved edits', async () => {
    render(page());
    await openEdit('Hessa');
    type('Level', '2');
    type('Name', 'Hessa Thorn');
    await press('Archive');
    expect(
      within(removalQuestion())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Level 3 · Wizard']);
    await press('Remove Class Levels', removalQuestion());
    expect(required(calls[0]).args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'hessa',
      patch: { name: 'Hessa Thorn', level: 2, isActive: false },
      confirmedRemovedLevelIds: ['wizard-level'],
      expectedSheetRevision: 3,
    });
    expect(
      within(dialog()).getByRole('button', { name: 'Archiving…' }),
    ).toBeDisabled();
  });

  test('a full record reads its level and scores from the sheet while name, Notes, kind and Archive stay editable', async () => {
    render(page());
    await openEdit('Kesh');
    expect(
      within(dialog()).queryByRole('textbox', { name: 'Level' }),
    ).toBeNull();
    expect(within(dialog()).queryByRole('textbox', { name: 'STR' })).toBeNull();
    const statistics = within(dialog()).getByRole('group', {
      name: 'Level and scores',
    });
    expect(
      within(statistics)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Level', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
    expect(
      within(statistics).getByText('Level').nextElementSibling,
    ).toHaveTextContent('5');
    expect(
      within(statistics).getByText('STR').nextElementSibling,
    ).toHaveTextContent('10.5');
    expect(
      within(statistics).getByRole('link', { name: 'Open sheet' }),
    ).toHaveAttribute(
      'href',
      '/characters/kesh?from=%2Fcampaigns%2Fcampaign%2Fofficers&organizationId=org',
    );
    expect(field('Name')).toBeEnabled();
    type('Name', 'Kesh of Phaendar');
    type('Notes', 'Rides ahead.');
    fireEvent.change(within(dialog()).getByRole('combobox', { name: 'Kind' }), {
      target: { value: 'npc' },
    });
    await press('Save');
    expect(required(calls[0]).args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'kesh',
      patch: {
        name: 'Kesh of Phaendar',
        description: 'Rides ahead.',
        kind: 'npc',
      },
    });
    await act(async () => required(calls[0]).resolve(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await openEdit('Kesh');
    type('Notes', 'Left the militia.');
    await press('Archive');
    expect(required(calls[1]).args).toEqual({
      operationId: expect.any(String),
      organizationId: 'org',
      characterId: 'kesh',
      patch: { description: 'Left the militia.', isActive: false },
    });
  });

  test('Build out from a row performs one request, opens that sheet and disappears with the full response', async () => {
    const view = render(page());
    expect(calls).toEqual([]);
    await act(async () => {
      fireEvent.click(buildOutButton('Hessa'));
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: 'buildOut',
      args: {
        organizationId: 'org',
        characterId: 'hessa',
        operationId: expect.any(String),
      },
    });
    const pending = within(rowOf('Hessa')).getByRole('button', {
      name: 'Building out… Hessa',
    });
    expect(pending).toBeDisabled();
    expect(buildOutButton('Tobin')).toBeDisabled();
    await act(async () => {
      fireEvent.click(pending);
    });
    expect(calls).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => required(calls[0]).resolve('hessa'));
    expect(navigate).toHaveBeenCalledWith(
      '/characters/hessa?from=%2Fcampaigns%2Fcampaign%2Fofficers&organizationId=org',
    );
    expect(within(rowOf('Hessa')).getByRole('status')).toHaveTextContent(
      'Character built out.',
    );
    expect(buildOutButton('Tobin')).toBeEnabled();
    const list = prepared();
    list[0] = { ...required(list[0]), sheetMode: 'full' };
    setQueries(list, withOverride(list, 0));
    view.rerender(page());
    expect(
      within(rowOf('Hessa')).queryByRole('button', { name: /Build out/ }),
    ).toBeNull();
    expect(
      within(rowOf('Hessa')).getByRole('link', { name: 'Sheet for Hessa' }),
    ).toHaveAttribute(
      'href',
      '/characters/hessa?from=%2Fcampaigns%2Fcampaign%2Fofficers&organizationId=org',
    );
    expect(calls).toHaveLength(1);
  });

  test('a refused Build out stays beside its row and the ledger stays put', async () => {
    render(page());
    await act(async () => {
      fireEvent.click(buildOutButton('Tobin'));
    });
    await act(async () =>
      required(calls[0]).reject(
        new ConvexError('This character was already built out'),
      ),
    );
    expect(within(rowOf('Tobin')).getByRole('alert')).toHaveTextContent(
      "Character wasn't built out: This character was already built out. Try again.",
    );
    expect(within(rowOf('Hessa')).queryByRole('alert')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(buildOutButton('Tobin')).toBeEnabled();
    expect(buildOutButton('Hessa')).toBeEnabled();
  });

  test('maintenance disables Build out and the record writes with the reason beside them, and Cancel still closes', async () => {
    readOnly = true;
    render(page());
    expect(buildOutButton('Hessa')).toBeDisabled();
    expect(rowOf('Hessa')).toHaveTextContent(
      'Editing is paused for maintenance.',
    );
    await act(async () => {
      fireEvent.click(buildOutButton('Hessa'));
    });
    expect(calls).toEqual([]);
    await openEdit('Hessa');
    expect(
      within(dialog()).getByRole('button', { name: 'Save' }),
    ).toBeDisabled();
    expect(
      within(dialog()).getByRole('button', { name: 'Archive' }),
    ).toBeDisabled();
    expect(
      within(dialog()).getByText('Editing is paused for maintenance.'),
    ).toBeVisible();
    await press('Cancel');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

// Companions on the roster (#423): a score the Companion's sheet cannot
// calculate yet reads Unresolved, never the partial number the row still
// carries, while the row keeps its roles and its way to the sheet.
describe('companions with unresolved values', () => {
  const ixa = () =>
    character('ixa', 'Ixa', {
      kind: 'npc',
      sheetMode: 'full',
      level: 4,
      strength: 7,
      dexterity: 11,
      constitution: 9,
      intelligence: 7,
    });
  const cellsOf = (row: HTMLElement) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
  const note = /Some values can’t be calculated from this sheet yet\./;

  const seed = (
    officers: { role: 'marshal' | 'spymaster'; characterId: string }[] = [],
  ) => {
    const list = [ixa(), ...records()];
    const source = militia(list);
    source.snapshot.characters = source.snapshot.characters.map((facts) =>
      facts.characterId === 'ixa'
        ? {
            ...facts,
            unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
          }
        : facts,
    );
    source.snapshot.roster.people = source.snapshot.roster.people.map(
      (person) =>
        person.characterId === 'ixa' ? { ...person, kind: 'npc' } : person,
    );
    source.snapshot.roster.officers.push(
      { role: 'overseer', characterId: 'ixa' },
      ...officers,
    );
    setQueries(list, source);
  };
  beforeEach(() => seed());

  test('an officer card reads an unresolved role ability as Unresolved, never as a partial bonus', () => {
    seed([
      { role: 'marshal', characterId: 'ixa' },
      { role: 'spymaster', characterId: 'ixa' },
    ]);
    render(page());
    // Bren's Strength still sets the Security bonus; Ixa's partial Strength
    // is compared with no one.
    const marshal = roleCard('Marshal');
    expect(marshal).toHaveTextContent('Security +4 (Bren Ironhand, Str)');
    const holder = required(within(marshal).getByText('Ixa').closest('li'));
    expect(holder).toHaveTextContent('Unresolved');
    expect(holder).not.toHaveTextContent("Doesn't stack");
    // With no resolved holder, the bonus says what it still needs.
    const spymaster = roleCard('Spymaster');
    expect(spymaster).toHaveTextContent('Secrecy bonus needs Dexterity');
    expect(spymaster).not.toHaveTextContent(/Secrecy [+−]/);
  });

  test('a roster row reads Unresolved for those scores, keeps its roles and links to the sheet', () => {
    render(page());
    const row = rowOf('Ixa');
    expect(cellsOf(row).slice(3, 11)).toEqual([
      '4',
      'Unresolved',
      'Unresolved',
      'Unresolved',
      '7',
      '10',
      '10',
      '4 HD',
    ]);
    expect(within(row).getByLabelText('Strength unresolved')).toHaveTextContent(
      'Unresolved',
    );
    expect(within(row).getByLabelText('Dexterity unresolved')).toBeVisible();
    expect(within(row).getByLabelText('Constitution unresolved')).toBeVisible();
    expect(within(row).queryByLabelText('Intelligence unresolved')).toBeNull();
    expect(within(row).getByRole('button', { name: 'Overseer' })).toBeEnabled();
    expect(row).toHaveTextContent('On roster');
    // The note is muted information, not an amber rules warning.
    const line = required(within(row).getByText(note).closest('p'));
    expect(line).not.toHaveClass('text-amber-300');
    expect(line).toHaveClass('text-muted-foreground');
    expect(
      within(row).getByRole('link', { name: 'Open sheet for Ixa' }),
    ).toHaveAttribute(
      'href',
      '/characters/ixa?from=%2Fcampaigns%2Fcampaign%2Fofficers&organizationId=org',
    );
    // An ordinary Character reads its numbers with no note.
    expect(cellsOf(rowOf('Bren Ironhand')).slice(4, 5)).toEqual(['18']);
    expect(within(rowOf('Bren Ironhand')).queryByText(note)).toBeNull();
  });

  test('the phone card reads Unresolved under the same labels, with the note under the scores', () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    render(page());
    const card = required(
      screen.getByRole('heading', { name: 'Ixa' }).closest('li'),
    );
    expect(
      within(card)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Level', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
    expect(within(card).getByText('STR').nextElementSibling).toHaveTextContent(
      'Unresolved',
    );
    expect(within(card).getByText('INT').nextElementSibling).toHaveTextContent(
      '7',
    );
    expect(card).toHaveTextContent('4 HD');
    expect(within(card).getByText(note)).toBeVisible();
    expect(
      within(card).getByRole('link', { name: 'Open sheet for Ixa' }),
    ).toBeVisible();
    expect(
      within(card).getByRole('button', { name: 'Overseer' }),
    ).toBeVisible();
    // @ts-expect-error jsdom has no matchMedia by default
    delete window.matchMedia;
  });
});

test('a prepared officers ledger row assigns an owner beside its Level, scores and Build out', async () => {
  const hero = character('hessa', 'Hessa', {
    sheetMode: 'militiaOnly',
    level: 3,
    strength: 16,
    owner: { userId: 'ada', name: 'Ada', isMine: false },
    ownershipAvailable: true,
  });
  setQueries([hero], militia([hero]));
  const view = render(page());
  expect(screen.getByRole('columnheader', { name: 'Owner' })).toBeVisible();
  expect(screen.getByRole('columnheader', { name: 'Level' })).toBeVisible();
  expect(within(rowOf('Hessa')).getByText('Ada')).toBeVisible();
  expect(within(rowOf('Hessa')).getByText('16')).toBeVisible();
  expect(
    within(rowOf('Hessa')).getByRole('button', { name: 'Build out Hessa' }),
  ).toBeEnabled();
  fireEvent.click(
    within(rowOf('Hessa')).getByRole('button', {
      name: 'Assign owner for Hessa',
    }),
  );
  const picker = within(screen.getByRole('dialog', { name: 'Choose owner' }));
  fireEvent.click(picker.getByRole('radio', { name: /Bryn/ }));
  await act(async () =>
    fireEvent.click(picker.getByRole('button', { name: 'Assign owner' })),
  );
  expect(calls[0]?.name).toBe('reassignOwner');
  expect(calls[0]?.args).toMatchObject({
    characterId: 'hessa',
    campaignId: 'campaign',
    organizationId: 'org',
    ownerUserId: 'bryn',
  });
  const changed = {
    ...hero,
    owner: { userId: 'bryn', name: 'Bryn', isMine: true },
    ownerLastOperationId: String(calls[0]?.args.operationId),
  };
  setQueries([changed], militia([changed]));
  view.rerender(page());
  await act(async () => calls[0]?.resolve(null));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(within(rowOf('Hessa')).getByText('Bryn')).toBeVisible();
  expect(within(rowOf('Hessa')).getByText('Owner assigned.')).toBeVisible();
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected fixture value');
  return value;
}
