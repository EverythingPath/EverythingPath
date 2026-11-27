import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { MilitiaSection } from '~/components/campaign-sections/militia-section';
import { stableControl } from '../../../tests/stable-control';
import { convexNames } from '../../../tests/convex-names';
import { api } from '@convex/_generated/api';

// Teams and Settlements corrections (#176): named open-week impact, carried
// integrity, and same-identity restoration of what the week still uses.

type Call = {
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let queries: Record<string, unknown> = {};

const nameOf = convexNames({
  workspace: api.canonicalDraftPersistence.workspace,
  observe: api.canonicalDraftPersistence.observe,
  read: api.canonicalLedger.read,
  save: api.canonicalLedger.save,
});
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock('convex/react', () => ({
  useMutation: () => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ args, resolve, reject });
    }),
}));
vi.mock('@tanstack/react-query', async () => {
  const { queryDataMock } = await import('../../../tests/query-data');
  return queryDataMock((name) => queries[nameOf(name)]);
});
vi.mock('~/lib/sharedQueries', () => ({
  useCharacterLedgerQuery: () => ({
    data: [
      {
        _id: 'officer',
        name: 'Ada',
        level: 12,
        strength: 10,
        dexterity: 11,
        constitution: 12,
        intelligence: 13,
        wisdom: 14,
        charisma: 15,
      },
    ],
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

type Snapshot = CanonicalWeekState['militiaSnapshot'];
type Team = Snapshot['roster']['teams'][number];
type Town = Snapshot['settlements'][number];

const campaignId = 'campaign' as Id<'campaign'>;
const scouts: Team = {
  teamId: 'scouts',
  name: 'Scouts',
  teamType: 'defenders',
  status: 'active',
  rewardCapExempt: false,
  managerCharacterId: null,
  notes: 'Watch the ford',
};
const teilwood: Town = {
  settlementId: 'teilwood',
  name: 'Teilwood',
  reputation: 'Friendly',
  secured: true,
  occupied: false,
  temporaryReputationShift: 0,
  refugeActivatedWeek: null,
  refugeActiveUntilWeek: null,
};

// The accepted militia with Scouts and Teilwood, which nothing carried
// needs, unless left out.
function state({ withScouts = true, withTeilwood = true } = {}) {
  const value = structuredClone(acceptedCampaignSetup('officer').state);
  if (withScouts) value.militiaSnapshot.roster.teams.push({ ...scouts });
  if (withTeilwood) value.militiaSnapshot.settlements.push({ ...teilwood });
  return value;
}
// The open week: Activity slot 2 drills with Scouts, and Activity operates
// from Teilwood.
function openDraft(week: CanonicalWeekState) {
  const draft = createWeeklyDraft({
    draftId: 'draft-9',
    week: week.week,
    context: week.context,
    slotIds: ['one', 'two'],
  });
  draft.activity.slots[1]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    teamId: 'scouts',
  };
  draft.activity.operatingSettlementId = 'teilwood';
  return draft;
}
function setMilitia(revision: number, week: CanonicalWeekState) {
  queries = {
    workspace: {
      key: { campaignId, militiaId: 'militia', draftId: 'draft-9' },
      week: week.week,
    },
    read: { revision, state: week },
    observe: { status: 'open', revision: 1, draft: openDraft(week) },
  };
}
const page = () => (
  <MilitiaSection campaignId={campaignId} organizationId="org" />
);
const index = () =>
  screen.getByRole('navigation', { name: 'Militia sections' });
const entry = (name: RegExp) => within(index()).getByRole('button', { name });
const pane = (heading: string) =>
  within(
    screen
      .getByRole('heading', { name: heading })
      .closest<HTMLElement>('section')!,
  );
const summary = () =>
  screen
    .getByText('Fix these before saving')
    .closest<HTMLElement>('[role="alert"]')!;
async function press(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}
function openSection(label: 'Teams' | 'Settlements') {
  fireEvent.click(entry(new RegExp(`^${label}`)));
  fireEvent.click(
    screen.getByRole('button', { name: `Correct ${label.toLowerCase()}` }),
  );
  const editor = pane(`Correct ${label.toLowerCase()}`);
  return {
    editor,
    reason: stableControl('textbox', 'Reason for correction', editor),
    save: stableControl('button', 'Save correction', editor),
  };
}
const sent = () => calls[0]!.args.snapshot as Snapshot;

beforeEach(() => {
  calls = [];
  setMilitia(3, state());
});

describe('Teams correction', () => {
  test('removing a team a staged slot uses names the slot, links its phase and still saves only the teams', async () => {
    render(page());
    const { editor, reason, save } = openSection('Teams');
    fireEvent.click(editor.getByRole('button', { name: 'Remove Team 2' }));
    const affects = screen.getByRole('complementary', {
      name: 'This affects the open week',
    });
    expect(affects).toHaveTextContent(
      'Removing Scouts leaves Activity slot 2 (Drill Militia) without a team.',
    );
    expect(
      within(affects).getByRole('link', { name: 'Activity slot 2' }),
    ).toHaveAttribute('href', '/campaigns/campaign/week?phase=activity');
    // The warning is advisory: a structurally valid removal saves.
    fireEvent.change(reason(), { target: { value: 'Scouts disbanded' } });
    await press(save());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toMatchObject({
      expectedRevision: 3,
      reason: 'Scouts disbanded',
    });
    const before = state().militiaSnapshot;
    expect(sent().roster).toEqual({
      ...before.roster,
      teams: before.roster.teams.filter((team) => team.teamId !== 'scouts'),
    });
    expect(sent().settlements).toEqual(before.settlements);
  });

  test('removing a team carried effects need is refused, naming the team and what needs it', async () => {
    render(page());
    const { editor, reason, save } = openSection('Teams');
    fireEvent.click(editor.getByRole('button', { name: 'Remove Team 1' }));
    fireEvent.change(reason(), { target: { value: 'Patrol is gone' } });
    await press(save());
    expect(calls).toHaveLength(0);
    expect(summary()).toHaveTextContent(
      'Keep Patrol: the carried Sickness event still needs it.',
    );
  });

  test('an unfinished new team does not hide what a removal affects', () => {
    render(page());
    const { editor } = openSection('Teams');
    fireEvent.click(editor.getByRole('button', { name: 'Add team' }));
    fireEvent.click(editor.getByRole('button', { name: 'Remove Team 2' }));
    expect(
      screen.getByRole('complementary', {
        name: 'This affects the open week',
      }),
    ).toHaveTextContent('Removing Scouts leaves Activity slot 2');
  });

  test('manager limit warnings name the manager', () => {
    const managed = state();
    managed.militiaSnapshot.roster.teams.push({
      ...scouts,
      teamId: 'guards',
      name: 'Guards',
    });
    for (const team of managed.militiaSnapshot.roster.teams)
      team.managerCharacterId = 'officer';
    setMilitia(3, managed);
    render(page());
    fireEvent.click(entry(/^Teams/));
    expect(
      screen.getByRole('complementary', { name: 'Rules warnings' }),
    ).toHaveTextContent('Ada manages 3 teams; the normal limit is 2.');
  });
});

describe('restoring what the open week still uses', () => {
  test('after a reload, a missing team is restored under its identity from entered facts', async () => {
    setMilitia(4, state({ withScouts: false }));
    render(page());
    expect(entry(/^Teams/)).toHaveAccessibleName(/1 warning/);
    fireEvent.click(entry(/^Teams/));
    const missing = within(
      screen.getByRole('region', { name: 'Missing from the militia' }),
    );
    expect(missing.getByText('A missing team')).toBeVisible();
    expect(
      missing.getByRole('link', { name: 'Activity slot 2' }),
    ).toHaveAttribute('href', '/campaigns/campaign/week?phase=activity');
    fireEvent.click(
      missing.getByRole('button', {
        name: 'Restore missing team for Activity slot 2',
      }),
    );
    const editor = pane('Correct teams');
    const restored = within(editor.getByRole('group', { name: 'Team 2' }));
    expect(restored.getByText('Needed by Activity slot 2')).toBeVisible();
    // Nothing is invented: name, type and condition are entered again.
    expect(restored.getByRole('textbox', { name: 'Team name' })).toHaveValue(
      '',
    );
    expect(
      editor.queryByRole('region', { name: 'Missing from the militia' }),
    ).toBeNull();
    const reason = stableControl('textbox', 'Reason for correction', editor);
    const save = stableControl('button', 'Save correction', editor);
    fireEvent.change(reason(), { target: { value: 'Scouts are back' } });
    await press(save());
    expect(calls).toHaveLength(0);
    for (const message of [
      'Team 2 name is required.',
      'Team 2 type is required.',
      'Team 2 condition is required.',
    ])
      expect(summary()).toHaveTextContent(message);

    fireEvent.change(restored.getByRole('textbox', { name: 'Team name' }), {
      target: { value: 'Scouts' },
    });
    for (const [group, choice] of [
      ['Team type', 'defenders'],
      ['Team condition', 'active'],
    ] as const)
      fireEvent.click(
        within(restored.getByRole('group', { name: group })).getByRole(
          'button',
          { name: choice },
        ),
      );
    await press(save());
    expect(calls).toHaveLength(1);
    expect(sent().roster.teams.at(-1)).toEqual({
      ...scouts,
      notes: '',
    });
  });

  test('a team this device saw before another player removed it is restored with those facts', async () => {
    const view = render(page());
    setMilitia(4, state({ withScouts: false }));
    view.rerender(page());
    fireEvent.click(entry(/^Teams/));
    const missing = within(
      screen.getByRole('region', { name: 'Missing from the militia' }),
    );
    expect(missing.getByText('Scouts')).toBeVisible();
    fireEvent.click(missing.getByRole('button', { name: 'Restore Scouts' }));
    const editor = pane('Correct teams');
    const restored = within(editor.getByRole('group', { name: 'Team 2' }));
    expect(restored.getByRole('textbox', { name: 'Team name' })).toHaveValue(
      'Scouts',
    );
    fireEvent.change(
      stableControl('textbox', 'Reason for correction', editor)(),
      { target: { value: 'Removed by mistake' } },
    );
    await press(stableControl('button', 'Save correction', editor)());
    expect(calls).toHaveLength(1);
    expect(sent().roster.teams.at(-1)).toEqual(scouts);
  });

  test('a missing settlement is restored with its identity and unrecorded facts', async () => {
    setMilitia(4, state({ withTeilwood: false }));
    render(page());
    fireEvent.click(entry(/^Settlements/));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Restore missing settlement for Activity operating settlement',
      }),
    );
    const editor = pane('Correct settlements');
    const restored = within(
      editor.getByRole('group', { name: 'Settlement 2' }),
    );
    expect(
      restored.getByText('Needed by Activity operating settlement'),
    ).toBeVisible();
    fireEvent.change(
      restored.getByRole('textbox', { name: 'Settlement name' }),
      { target: { value: 'Teilwood' } },
    );
    fireEvent.change(
      stableControl('textbox', 'Reason for correction', editor)(),
      { target: { value: 'Operating base restored' } },
    );
    await press(stableControl('button', 'Save correction', editor)());
    expect(calls).toHaveLength(1);
    expect(sent().settlements.at(-1)).toEqual({
      settlementId: 'teilwood',
      name: 'Teilwood',
      reputation: null,
      secured: null,
      occupied: null,
      temporaryReputationShift: null,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    });
    expect(sent().roster).toEqual(
      state({ withTeilwood: false }).militiaSnapshot.roster,
    );
  });
});
