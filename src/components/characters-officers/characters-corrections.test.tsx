import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { CharactersSection } from '~/components/campaign-sections/characters-section';
import {
  ShellSlotHost,
  ShellSlotProvider,
} from '~/components/campaign-shell/shell-slots';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type { CharacterKind } from '~/lib/character-kind';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { convexNames } from '../../../tests/convex-names';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';

// Characters & officers' two reasoned corrections (#183): Correct officers
// (assign, move, remove across the six roles) and Correct roster
// (membership and Hit Dice overrides, with named cascades), on the Militia
// corrections' lifecycle.

type Snapshot = CanonicalWeekState['militiaSnapshot'];
type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let queries: Record<string, unknown> = {};

const nameOf = convexNames({
  listByCampaign: api.character.listByCampaign,
  workspace: api.canonicalDraftPersistence.workspace,
  observe: api.canonicalDraftPersistence.observe,
  read: api.canonicalLedger.read,
  save: api.canonicalLedger.save,
  me: api.user.getMe,
});
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock('convex/react', () => ({
  // The viewer's own account, read while nobody owns a Character (#708).
  useQuery: (query: FunctionReference<'query'>, args: unknown) => {
    if (args === 'skip') return undefined;
    if (nameOf(query) === 'me') return { _id: 'viewer' };
    throw new Error(`Unexpected subscription ${nameOf(query)}.`);
  },
  usePaginatedQuery: () => ({
    results: [],
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
}));

const campaignId = 'campaign' as Id<'campaign'>;
type Stored = {
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
  isActive?: boolean;
};
function record(_id: string, name: string, values: Partial<Stored> = {}) {
  return {
    _id,
    campaignId,
    name,
    description: '',
    kind: 'pc' as const,
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
const records: Stored[] = [
  record('bren', 'Bren Ironhand', { level: 7, strength: 18 }),
  record('sera', 'Sera of Phaendar', {
    kind: 'npc',
    level: 4,
    charisma: 14,
  }),
  record('kess', 'Kess', { level: 5, dexterity: 17 }),
  record('nara', 'Nara', { kind: 'npc', level: 4, intelligence: 16 }),
  // Created before Setup and never on the roster: the militia lacks her
  // rules facts.
  record('wren', 'Wren', { kind: 'npc' }),
];
const facts = (stored: Stored) => ({
  characterId: stored._id,
  level: stored.level,
  strength: stored.strength,
  dexterity: stored.dexterity,
  constitution: stored.constitution,
  intelligence: stored.intelligence,
  wisdom: stored.wisdom,
  charisma: stored.charisma,
  isActive: stored.isActive !== false,
});
const team = (teamId: string, name: string) => ({
  teamId,
  teamType: 'patrons' as const,
  name,
  status: 'active' as const,
  rewardCapExempt: false,
  managerCharacterId: 'sera',
  notes: '',
});
function snapshot(): Snapshot {
  return {
    rank: 3,
    training: 30,
    treasuryCopper: 3000,
    notoriety: 0,
    focus: 'Loyalty',
    roster: {
      people: [
        { characterId: 'bren', kind: 'pc', hitDice: 5 },
        { characterId: 'sera', kind: 'npc', hitDice: null },
        { characterId: 'kess', kind: 'pc', hitDice: null },
      ],
      officers: [
        { role: 'marshal', characterId: 'bren' },
        { role: 'ambassador', characterId: 'sera' },
        { role: 'strategist', characterId: 'kess' },
      ],
      teams: [team('smugglers', 'Smugglers'), team('watch', 'Town Watch')],
    },
    characters: records.filter((r) => r._id !== 'wren').map(facts),
    settlements: [],
    bonuses: [],
  };
}
const context = {
  firstMilitiaWeek: false,
  startDay: 14,
  uneventfulCarry: false,
  carriedEvents: [],
  queuedEffects: [],
  orders: [],
  lastBuyoffWeek: null,
};
// The open week: Activity slot 2 moves Bren from Marshal to Spymaster.
function openWeek(draftId = 'draft') {
  const draft = structuredClone(
    createWeeklyDraft({
      draftId,
      week: 3,
      context,
      slotIds: ['s1', 's2', 's3'],
    }),
  );
  draft.activity.slots[1]!.choice = {
    choiceId: 'c2',
    actionId: 'change_officer_role',
    characterId: 'bren',
    fromRole: 'marshal',
    toRole: 'spymaster',
  };
  return { status: 'open', draft };
}
function setMilitia(
  revision: number,
  militia: Snapshot,
  { draftId = 'draft', week = 3 } = {},
) {
  queries = {
    listByCampaign: records,
    workspace: {
      key: { campaignId, militiaId: 'militia', draftId },
      week,
      sourceRevision: revision,
      people: [],
      snapshot: militia,
    },
    observe: openWeek(draftId),
    read: {
      revision,
      state: { week, context, militiaSnapshot: militia },
    },
  };
}
const page = () => (
  <CharactersSection campaignId={campaignId} organizationId="org" />
);
const officersRegion = () => screen.getByRole('region', { name: 'Officers' });
const charactersRegion = () =>
  screen.getByRole('region', { name: 'Characters' });
const roleCard = (name: string) =>
  within(officersRegion()).getByRole('region', { name });
const rowOf = (name: string) =>
  within(charactersRegion())
    .getAllByRole('row')
    .find((row) =>
      within(row).queryByRole('rowheader', { name: new RegExp(`^${name}`) }),
    )!;
const bar = (name: string) => screen.getByRole('region', { name });
const reason = () =>
  screen.getByRole('textbox', { name: 'Reason for correction' });
async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}
const button = (
  name: string | RegExp,
  container: HTMLElement = document.body,
) => within(container).getByRole('button', { name });
const sent = (at = 0) => calls[at]!.args.snapshot as Snapshot;

function openOfficers() {
  fireEvent.click(button('Correct officers'));
  return bar('Correct officers');
}
function openRoster() {
  fireEvent.click(button('Correct roster'));
  return bar('Correct roster');
}
async function holderAction(role: string, holder: string, name: string) {
  fireEvent.click(button(`Options for ${holder}`, roleCard(role)));
  if (name.startsWith('Move to '))
    fireEvent.click(button('Move to…', roleCard(role)));
  await click(button(name, roleCard(role)));
}

beforeEach(() => {
  calls = [];
  setMilitia(3, snapshot());
});

describe('one correction at a time', () => {
  test('opening one dims the other section and hides both Correct buttons; Cancel writes nothing', () => {
    render(page());
    openOfficers();
    expect(charactersRegion()).toHaveAttribute('inert');
    expect(officersRegion()).not.toHaveAttribute('inert');
    expect(screen.queryByRole('button', { name: 'Correct roster' })).toBeNull();
    fireEvent.click(button('Cancel', bar('Correct officers')));
    expect(calls).toHaveLength(0);
    openRoster();
    expect(officersRegion()).toHaveAttribute('inert');
    expect(
      screen.queryByRole('button', { name: 'Correct officers' }),
    ).toBeNull();
    // Roster mode edits only membership and overrides: no Assign.
    expect(
      within(officersRegion()).queryByRole('button', { name: /^Assign / }),
    ).toBeNull();
  });

  test('before Setup there is nothing to correct', () => {
    queries = { listByCampaign: records, workspace: null };
    render(page());
    expect(
      screen.queryByRole('button', { name: 'Correct officers' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Correct roster' })).toBeNull();
  });
});

describe('Correct officers', () => {
  test('Assign groups PCs and NPCs with each one’s contribution against the current effect', () => {
    render(page());
    openOfficers();
    fireEvent.click(button('Assign Spymaster', roleCard('Spymaster')));
    const picker = screen.getByRole('dialog', { name: 'Assign Spymaster' });
    const pcs = within(picker).getByRole('region', {
      name: 'Player characters',
    });
    const npcs = within(picker).getByRole('region', { name: 'NPCs' });
    expect(button(/^Kess/, pcs)).toHaveTextContent(
      'Dex +3 → Secrecy +3 (currently no Secrecy bonus)',
    );
    expect(button(/^Kess/, pcs)).toHaveTextContent('already Strategist');
    expect(button(/^Bren Ironhand/, pcs)).toBeVisible();
    expect(
      within(npcs)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([expect.stringMatching(/^Sera of Phaendar/)]);
    // No explanatory caption under the title.
    expect(
      within(picker).queryByText(/Adding a role keeps their current one/),
    ).toBeNull();
  });

  test('assigns a second role, moves without duplicating and removes, then saves only the assignments with a reason', async () => {
    const view = render(page());
    const correction = openOfficers();
    fireEvent.click(button('Assign Commandant', roleCard('Commandant')));
    await click(
      button(
        /^Bren Ironhand/,
        screen.getByRole('dialog', { name: 'Assign Commandant' }),
      ),
    );
    expect(roleCard('Commandant')).toHaveTextContent('Bren Ironhand');
    expect(roleCard('Marshal')).toHaveTextContent('Bren Ironhand');
    // Bren already Commandant: Move to… offers only roles he lacks.
    fireEvent.click(button('Options for Bren Ironhand', roleCard('Marshal')));
    fireEvent.click(button('Move to…', roleCard('Marshal')));
    expect(
      within(roleCard('Marshal')).queryByRole('button', {
        name: 'Move to Commandant',
      }),
    ).toBeNull();
    await click(button('Move to Spymaster', roleCard('Marshal')));
    expect(roleCard('Marshal')).toHaveTextContent('Vacant');
    expect(roleCard('Spymaster')).toHaveTextContent('Bren Ironhand');
    await holderAction(
      'Ambassador',
      'Sera of Phaendar',
      'Remove Sera of Phaendar as Ambassador',
    );
    // Save-point warnings: Sera's lowered limit, the pending Change Officer
    // Role that no longer matches Bren's roles, the PC hint.
    expect(correction).toHaveTextContent(
      "Removing Sera of Phaendar's last officer role lowers their team limit to 1; they manage 2 teams.",
    );
    expect(correction).toHaveTextContent(
      'Assigning Bren Ironhand as Commandant is normally a Change Officer Role action.',
    );
    const affected = within(correction).getByRole('complementary', {
      name: 'This affects the open week',
    });
    expect(affected).toHaveTextContent(
      'Activity slot 2 (Change Officer Role) would change a role its character no longer holds.',
    );
    expect(
      within(affected).getByRole('link', { name: 'Activity slot 2' }),
    ).toHaveAttribute('href', '/campaigns/campaign/week?phase=activity');

    // A reason is required; a quick pick fills it and stays editable.
    await click(button('Save correction', correction));
    expect(calls).toHaveLength(0);
    expect(reason()).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(button('Story change', correction));
    expect(reason()).toHaveValue('Story change');
    fireEvent.change(reason(), {
      target: { value: 'Story change: Bren moves' },
    });

    // Another player corrected an unrelated fact meanwhile: merged.
    const latest = snapshot();
    latest.treasuryCopper = 9000;
    setMilitia(4, latest);
    view.rerender(page());
    const save = button('Save correction', bar('Correct officers'));
    await click(save);
    await click(save);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: 'save',
      args: {
        campaignId,
        militiaId: 'militia',
        expectedRevision: 4,
        reason: 'Story change: Bren moves',
      },
    });
    expect(sent()).toEqual({
      ...latest,
      roster: {
        ...latest.roster,
        officers: [
          { role: 'strategist', characterId: 'kess' },
          { role: 'commandant', characterId: 'bren' },
          { role: 'spymaster', characterId: 'bren' },
        ],
      },
    });
    expect(button(/Saving correction/, bar('Correct officers'))).toBeDisabled();

    const saved = sent();
    await act(async () => calls[0]!.resolve(5));
    setMilitia(5, saved);
    view.rerender(page());
    expect(
      screen.queryByRole('region', { name: 'Correct officers' }),
    ).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Officers corrected.');
  });

  test('previews the Strategist’s Activity action and the slot it no longer covers', async () => {
    const week = openWeek();
    week.draft.activity.slots[2]!.choice = {
      choiceId: 'c3',
      actionId: 'lie_low',
    };
    setMilitia(3, snapshot());
    queries.observe = week;
    render(page());
    const correction = openOfficers();
    await holderAction('Strategist', 'Kess', 'Remove Kess as Strategist');
    expect(correction).toHaveTextContent('Activity actions this week: 3 → 2');
    expect(correction).toHaveTextContent(
      'Activity slot 3 (Lie Low) would be beyond this week’s actions.',
    );
  });

  test('another player’s officer change is a conflict: theirs and yours, and starting again clears the reason', async () => {
    const view = render(page());
    const correction = openOfficers();
    await holderAction(
      'Marshal',
      'Bren Ironhand',
      'Remove Bren Ironhand as Marshal',
    );
    fireEvent.change(reason(), { target: { value: 'Bren steps down' } });
    const theirs = snapshot();
    theirs.roster.officers.push({ role: 'spymaster', characterId: 'kess' });
    setMilitia(4, theirs);
    view.rerender(page());
    await click(button('Save correction', correction));
    expect(calls).toHaveLength(0);
    const alert = within(bar('Correct officers')).getByRole('alert');
    expect(alert).toHaveTextContent('Another player changed this section');
    const their = within(bar('Correct officers')).getByRole('region', {
      name: 'Their values',
    });
    const yours = within(bar('Correct officers')).getByRole('region', {
      name: 'Your values',
    });
    expect(their).toHaveTextContent('MarshalBren Ironhand');
    expect(yours).toHaveTextContent('MarshalVacant');
    expect(their).toHaveTextContent('SpymasterKess');
    fireEvent.click(button('Start again from their values'));
    expect(reason()).toHaveValue('');
    expect(roleCard('Spymaster')).toHaveTextContent('Kess');
    expect(roleCard('Marshal')).toHaveTextContent('Bren Ironhand');
  });

  test('a refused Save keeps the assignments and reason; an unconfirmed one says so', async () => {
    render(page());
    const correction = openOfficers();
    await holderAction(
      'Marshal',
      'Bren Ironhand',
      'Remove Bren Ironhand as Marshal',
    );
    fireEvent.change(reason(), { target: { value: 'Bren steps down' } });
    await click(button('Save correction', correction));
    await act(async () =>
      calls[0]!.reject(new ConvexError('Campaign is paused for maintenance')),
    );
    expect(bar('Correct officers')).toHaveTextContent(
      "The correction wasn't saved: Campaign is paused for maintenance. Your entries are kept.",
    );
    expect(reason()).toHaveValue('Bren steps down');
    expect(roleCard('Marshal')).toHaveTextContent('Vacant');
    await click(button('Save correction', bar('Correct officers')));
    await act(async () => calls[1]!.reject(new Error('connection lost')));
    expect(bar('Correct officers')).toHaveTextContent(
      "The correction couldn't be confirmed",
    );
  });

  test('a new week restarts the correction from the new week’s facts', () => {
    const view = render(page());
    openOfficers();
    setMilitia(4, snapshot(), { draftId: 'draft-4', week: 4 });
    view.rerender(page());
    expect(
      within(bar('Correct officers')).getByRole('alert'),
    ).toHaveTextContent('The week changed while you were correcting.');
  });

  test('a new week still restarts the correction while its draft is briefly unobserved', () => {
    const view = render(page());
    openOfficers();
    fireEvent.change(reason(), { target: { value: 'Bren steps down' } });
    setMilitia(4, snapshot(), { draftId: 'draft-4', week: 4 });
    queries.observe = undefined;
    view.rerender(page());
    expect(
      within(bar('Correct officers')).getByRole('alert'),
    ).toHaveTextContent('The week changed while you were correcting.');
    setMilitia(4, snapshot(), { draftId: 'draft-4', week: 4 });
    view.rerender(page());
    expect(
      within(bar('Correct officers')).getByRole('alert'),
    ).toHaveTextContent('The week changed while you were correcting.');
  });
});

describe('Correct roster', () => {
  test('joining takes the record’s kind; leaving names and clears roles and managers in the same save', async () => {
    render(page());
    const correction = openRoster();
    fireEvent.click(
      within(rowOf('Nara')).getByRole('switch', { name: 'Nara on roster' }),
    );
    fireEvent.click(
      within(rowOf('Sera of Phaendar')).getByRole('switch', {
        name: 'Sera of Phaendar on roster',
      }),
    );
    expect(correction).toHaveTextContent(
      'Removing Sera of Phaendar removes them as Ambassador and clears the manager of Smugglers and Town Watch.',
    );
    // Shown on the board and rows before Save.
    expect(roleCard('Ambassador')).toHaveTextContent('Vacant');
    expect(rowOf('Nara')).toHaveTextContent('On roster');
    fireEvent.click(button('Character left', correction));
    await click(button('Save correction', correction));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toMatchObject({
      expectedRevision: 3,
      reason: 'Character left',
    });
    const latest = snapshot();
    expect(sent()).toEqual({
      ...latest,
      roster: {
        people: [
          { characterId: 'bren', kind: 'pc', hitDice: 5 },
          { characterId: 'kess', kind: 'pc', hitDice: null },
          { characterId: 'nara', kind: 'npc', hitDice: null },
        ],
        officers: [
          { role: 'marshal', characterId: 'bren' },
          { role: 'strategist', characterId: 'kess' },
        ],
        teams: latest.roster.teams.map((t) => ({
          ...t,
          managerCharacterId: null,
        })),
      },
    });
    // The record and its facts remain.
    expect(sent().characters).toEqual(latest.characters);
  });

  test('Hit Dice overrides keep blank, zero and explicit values apart and refuse malformed input in place', async () => {
    render(page());
    const correction = openRoster();
    const hitDice = (name: string) =>
      within(rowOf(name)).getByRole('textbox', { name: `${name}'s Hit Dice` });
    expect(hitDice('Bren Ironhand')).toHaveValue('5');
    expect(hitDice('Kess')).toHaveAttribute('placeholder', '5');
    fireEvent.change(hitDice('Bren Ironhand'), { target: { value: '' } });
    fireEvent.change(hitDice('Kess'), { target: { value: '0' } });
    fireEvent.change(hitDice('Sera of Phaendar'), {
      target: { value: 'four' },
    });
    fireEvent.change(reason(), { target: { value: 'Fixing a mistake' } });
    await click(button('Save correction', correction));
    expect(calls).toHaveLength(0);
    expect(hitDice('Sera of Phaendar')).toHaveAttribute('aria-invalid', 'true');
    expect(rowOf('Sera of Phaendar')).toHaveTextContent(
      'Enter a whole number of 0 or more.',
    );
    const summary = within(bar('Correct roster')).getByRole('alert');
    fireEvent.click(
      within(summary).getByRole('button', {
        name: "Enter a whole number of 0 or more for Sera of Phaendar's Hit Dice.",
      }),
    );
    expect(hitDice('Sera of Phaendar')).toHaveFocus();
    expect(hitDice('Sera of Phaendar')).toHaveValue('four');
    fireEvent.change(hitDice('Sera of Phaendar'), { target: { value: '6' } });
    await click(button('Save correction', bar('Correct roster')));
    expect(sent().roster.people.map((p) => [p.characterId, p.hitDice])).toEqual(
      [
        ['bren', null],
        ['sera', 6],
        ['kess', 0],
      ],
    );
  });

  // A Companion whose sheet cannot calculate some scores yet (#423) is
  // corrected like anyone else: nothing is disabled or hidden.
  test('a Companion with unresolved scores keeps its roster switch and Hit Dice override', () => {
    const ixa = record('ixa', 'Ixa', { kind: 'npc', level: 4, strength: 7 });
    const militia = snapshot();
    militia.roster.people.push({
      characterId: 'ixa',
      kind: 'npc',
      hitDice: null,
    });
    militia.characters.push({
      ...facts(ixa),
      unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
    });
    setMilitia(3, militia);
    queries.listByCampaign = [...records, ixa];
    render(page());
    openRoster();
    const toggle = within(rowOf('Ixa')).getByRole('switch', {
      name: 'Ixa on roster',
    });
    expect(toggle).toBeEnabled();
    expect(toggle).toBeChecked();
    const hitDice = within(rowOf('Ixa')).getByRole('textbox', {
      name: "Ixa's Hit Dice",
    });
    expect(hitDice).toBeEnabled();
    expect(hitDice).toHaveAttribute('placeholder', '4');
    expect(
      within(rowOf('Ixa')).getByLabelText('Strength unresolved'),
    ).toBeVisible();
    expect(rowOf('Ixa')).toHaveTextContent(
      'Some values can’t be calculated from this sheet yet.',
    );
  });

  test('a Companion with unresolved scores is offered by Assign', () => {
    const ixa = record('ixa', 'Ixa', { kind: 'npc', level: 4, strength: 7 });
    const militia = snapshot();
    militia.roster.people.push({
      characterId: 'ixa',
      kind: 'npc',
      hitDice: null,
    });
    militia.characters.push({
      ...facts(ixa),
      unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
    });
    setMilitia(3, militia);
    queries.listByCampaign = [...records, ixa];
    render(page());
    openOfficers();
    fireEvent.click(button('Assign Overseer', roleCard('Overseer')));
    const picker = screen.getByRole('dialog', { name: 'Assign Overseer' });
    const npcs = within(picker).getByRole('region', { name: 'NPCs' });
    expect(button(/^Ixa/, npcs)).toBeEnabled();
  });

  test('Assign previews a Companion’s unresolved role ability as unknown, never as a partial bonus', () => {
    const ixa = record('ixa', 'Ixa', { kind: 'npc', level: 4, dexterity: 20 });
    const militia = snapshot();
    militia.roster.people.push({
      characterId: 'ixa',
      kind: 'npc',
      hitDice: null,
    });
    militia.characters.push({
      ...facts(ixa),
      unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
    });
    setMilitia(3, militia);
    queries.listByCampaign = [...records, ixa];
    render(page());
    openOfficers();
    fireEvent.click(button('Assign Spymaster', roleCard('Spymaster')));
    const picker = screen.getByRole('dialog', { name: 'Assign Spymaster' });
    const npcs = within(picker).getByRole('region', { name: 'NPCs' });
    expect(button(/^Ixa/, npcs)).toHaveTextContent(
      'Dex unresolved → Secrecy bonus needs Dexterity',
    );
    expect(button(/^Ixa/, npcs)).not.toHaveTextContent('Dex +5');
  });

  test('a record the militia has no facts for cannot join yet, and says why', () => {
    render(page());
    openRoster();
    const toggle = within(rowOf('Wren')).getByRole('switch', {
      name: 'Wren on roster',
    });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleDescription(
      "Open Wren's record and save it before adding them to the roster.",
    );
  });

  test('a kind change by another player invalidates the roster baseline', async () => {
    const view = render(page());
    const correction = openRoster();
    fireEvent.click(
      within(rowOf('Kess')).getByRole('switch', { name: 'Kess on roster' }),
    );
    fireEvent.change(reason(), { target: { value: 'Kess left' } });
    const theirs = snapshot();
    theirs.roster.people[2]!.kind = 'npc';
    setMilitia(4, theirs);
    view.rerender(page());
    await click(button('Save correction', correction));
    expect(calls).toHaveLength(0);
    expect(within(bar('Correct roster')).getByRole('alert')).toHaveTextContent(
      'Another player changed this section',
    );
  });

  test('re-including a removed person restores them under the same identity', async () => {
    const removed = snapshot();
    removed.roster.people = removed.roster.people.filter(
      (person) => person.characterId !== 'bren',
    );
    removed.roster.officers = removed.roster.officers.filter(
      (officer) => officer.characterId !== 'bren',
    );
    setMilitia(4, removed);
    render(page());
    const correction = openRoster();
    // The pending Change Officer Role already names Bren off the roster.
    expect(correction).toHaveTextContent(
      'Activity slot 2 (Change Officer Role) names a character who is not on the roster.',
    );
    fireEvent.click(
      within(rowOf('Bren Ironhand')).getByRole('switch', {
        name: 'Bren Ironhand on roster',
      }),
    );
    // Back on the roster, the slot still needs his Marshal role: an officer
    // correction restores it next.
    expect(correction).toHaveTextContent(
      'Activity slot 2 (Change Officer Role) would change a role its character no longer holds.',
    );
    fireEvent.click(button('Story change', correction));
    await click(button('Save correction', correction));
    expect(sent().roster.people.at(-1)).toEqual({
      characterId: 'bren',
      kind: 'pc',
      hitDice: null,
    });
  });
});

// The accepted militia can briefly have no result while its subscription is
// re-established (#141). The open correction must not unmount and remount
// then: that closed a holder's ⋯ menu that had focus, and the save point's
// heading took focus, so Escape no longer reached ⋯.
describe('an open correction keeps its controls and focus while the accepted militia is briefly missing', () => {
  function blink(view: ReturnType<typeof render>) {
    const loaded = queries;
    queries = { ...loaded, read: undefined };
    view.rerender(page());
    queries = loaded;
    view.rerender(page());
  }
  const escape = () =>
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  const moveTargets = (card: HTMLElement) =>
    within(card).getAllByRole('button', { name: /^Move to [^…]/ });

  test('a holder’s Move to list stays open with focus, and Escape returns focus to ⋯', () => {
    const view = render(page());
    openOfficers();
    const card = roleCard('Marshal');
    fireEvent.click(button('Options for Bren Ironhand', card));
    fireEvent.click(button('Move to…', card));
    expect(moveTargets(card)[0]).toHaveFocus();
    blink(view);
    const options = button('Options for Bren Ironhand', roleCard('Marshal'));
    expect(options).toHaveAttribute('aria-expanded', 'true');
    expect(moveTargets(roleCard('Marshal'))[0]).toHaveFocus();
    escape();
    expect(options).toHaveAttribute('aria-expanded', 'false');
    expect(options).toHaveFocus();
  });

  test('the Assign picker stays open with focus, and Escape returns focus to Assign', () => {
    const view = render(page());
    openOfficers();
    fireEvent.click(button('Assign Spymaster', roleCard('Spymaster')));
    const picker = () =>
      screen.queryByRole('dialog', { name: 'Assign Spymaster' });
    // The tablet sheet (jsdom has no media queries) focuses its first
    // candidate.
    const focused = document.activeElement;
    expect(picker()).toContainElement(focused as HTMLElement);
    blink(view);
    expect(focused).toHaveFocus();
    escape();
    expect(picker()).toBeNull();
    expect(button('Assign Spymaster', roleCard('Spymaster'))).toHaveFocus();
  });

  test('Correct roster: the On-roster switch keeps focus', () => {
    const view = render(page());
    openRoster();
    const toggle = () =>
      within(rowOf('Kess')).getByRole('switch', { name: 'Kess on roster' });
    toggle().focus();
    fireEvent.click(toggle());
    blink(view);
    expect(toggle()).toHaveFocus();
    expect(toggle()).not.toBeChecked();
  });
});

// A resize across the layouts moves the save point (under the edited section
// on the phone, at the end of the page from 768px) and mounts it again, as
// when a tablet rotates or a window is resized. Only opening a correction
// takes focus to its heading: a resize must not take it from a holder's ⋯
// menu or the Assign picker, which Escape then no longer reached (#141).
describe('an open correction keeps its controls and focus through a resize across the layouts', () => {
  let width = 1440;
  const listeners = new Set<() => void>();
  beforeEach(() => {
    width = 1440;
    listeners.clear();
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return width >= Number(/min-width: (\d+)px/.exec(query)![1]);
      },
      addEventListener: (_: 'change', listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: 'change', listener: () => void) =>
        listeners.delete(listener),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());
  function resizeTo(next: number) {
    act(() => {
      width = next;
      for (const listener of [...listeners]) listener();
    });
  }
  // To a phone and back, as a full-page capture briefly does.
  function resizeThroughPhone() {
    resizeTo(390);
    resizeTo(1440);
  }
  const escape = () =>
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

  test('opening a correction takes focus to its heading', () => {
    render(page());
    openOfficers();
    expect(
      screen.getByRole('heading', { name: 'Correct officers' }),
    ).toHaveFocus();
  });

  test('a holder’s Move to list stays open with focus, and Escape returns focus to ⋯', () => {
    render(page());
    openOfficers();
    fireEvent.click(button('Options for Bren Ironhand', roleCard('Marshal')));
    fireEvent.click(button('Move to…', roleCard('Marshal')));
    const target = within(roleCard('Marshal')).getAllByRole('button', {
      name: /^Move to [^…]/,
    })[0]!;
    expect(target).toHaveFocus();
    resizeThroughPhone();
    const options = button('Options for Bren Ironhand', roleCard('Marshal'));
    expect(options).toHaveAttribute('aria-expanded', 'true');
    expect(target).toHaveFocus();
    escape();
    expect(options).toHaveAttribute('aria-expanded', 'false');
    expect(options).toHaveFocus();
  });

  test('the floating Assign picker keeps focus, and Escape closes it and returns focus to Assign', () => {
    render(page());
    openOfficers();
    fireEvent.click(button('Assign Spymaster', roleCard('Spymaster')));
    const picker = () =>
      screen.queryByRole('dialog', { name: 'Assign Spymaster' });
    expect(picker()).not.toBeNull();
    resizeThroughPhone();
    expect(picker()).toContainElement(document.activeElement as HTMLElement);
    escape();
    expect(picker()).toBeNull();
    expect(button('Assign Spymaster', roleCard('Spymaster'))).toHaveFocus();
  });

  test('the Assign picker keeps focus as it moves between floating, sheet and inline', async () => {
    render(page());
    openOfficers();
    fireEvent.click(button('Assign Spymaster', roleCard('Spymaster')));
    const picker = () =>
      screen.queryByRole('dialog', { name: 'Assign Spymaster' }) ??
      screen.queryByRole('region', { name: 'Assign Spymaster' });
    // The sheet, once gone, hands focus back only after a task.
    const settle = () =>
      act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    for (const next of [1000, 1440, 1000, 390, 1000]) {
      resizeTo(next);
      await settle();
      expect(picker()).toContainElement(document.activeElement as HTMLElement);
    }
    escape();
    await settle();
    expect(picker()).toBeNull();
    expect(button('Assign Spymaster', roleCard('Spymaster'))).toHaveFocus();
  });

  // The phone strip holds the compact reason bar (#198); the reason stays
  // required with its message, the quick picks fill it, and the entry moves
  // with the bar into the save point and back.
  test('in the phone strip the reason stays required, quick picks fill it and it survives a resize', async () => {
    width = 390;
    render(
      <ShellSlotProvider>
        {page()}
        <ShellSlotHost name="phone-status-strip" />
      </ShellSlotProvider>,
    );
    const strip = () =>
      document.querySelector<HTMLElement>(
        '[data-shell-slot="phone-status-strip"]',
      )!;
    const correction = openRoster();
    expect(within(correction).queryByRole('textbox')).toBeNull();
    const inStrip = () =>
      within(strip()).getByRole('textbox', { name: 'Reason for correction' });
    // Reading and tab order as from 768px: reason, quick picks, Save, Cancel.
    expect(
      [...strip().querySelectorAll('input, button')].map((control) =>
        control instanceof HTMLInputElement
          ? control.labels?.[0]?.textContent
          : control.textContent,
      ),
    ).toEqual([
      'Reason for correction',
      'Story change',
      'Fixing a mistake',
      'New officer joined',
      'Character left',
      'Save correction',
      'Cancel',
    ]);

    await click(button('Save correction', strip()));
    expect(calls).toHaveLength(0);
    expect(inStrip()).toHaveAttribute('aria-invalid', 'true');
    expect(inStrip()).toHaveAccessibleDescription(
      'Reason for correction is required.',
    );

    fireEvent.click(
      within(
        within(strip()).getByRole('group', { name: 'Quick reasons' }),
      ).getByRole('button', { name: 'Character left' }),
    );
    expect(inStrip()).toHaveValue('Character left');
    fireEvent.change(inStrip(), {
      target: { value: 'Character left: Bren retires' },
    });

    resizeTo(1440);
    expect(strip()).toBeEmptyDOMElement();
    expect(within(bar('Correct roster')).getByRole('textbox')).toHaveValue(
      'Character left: Bren retires',
    );
    resizeTo(390);
    expect(inStrip()).toHaveValue('Character left: Bren retires');

    fireEvent.click(button('Cancel', strip()));
    expect(screen.queryByRole('region', { name: 'Correct roster' })).toBeNull();
    expect(strip()).toBeEmptyDOMElement();
    expect(calls).toHaveLength(0);
  });
});
