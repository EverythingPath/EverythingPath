import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { MilitiaSection } from '~/components/campaign-sections/militia-section';
import { stableControl } from '../../../tests/stable-control';
import { convexNames } from '../../../tests/convex-names';
import { api } from '@convex/_generated/api';

// Character conditions and Carried benefits corrections (#178): each saves
// only its own lists onto the latest militia, keeping sibling facts,
// character records and source identities, with every supported field.

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
type Benefits = NonNullable<Snapshot['eventBenefits']>;

const campaignId = 'campaign' as Id<'campaign'>;
const drill: Benefits['skills'][number] = {
  benefitId: 'drill-benefit',
  sourceEventIds: ['festival'],
  characterIds: ['officer'],
  skills: ['diplomacy'],
  bonusType: 'morale',
  value: 2,
  settlementId: 'town',
  afterDark: true,
  startsWeek: 8,
  endsWeek: 10,
};
const marketDay: Benefits['markets'][number] = {
  benefitId: 'market-benefit',
  sourceEventIds: ['market'],
  settlementIds: ['town'],
  discountPercent: 5,
  startsWeek: 9,
  endsWeek: 9,
};

// The accepted militia (Ada, Town and the Old Mill), optionally with Ada
// captured and carried skill and Market Day benefits.
function state({ condition = false, benefits = false } = {}) {
  const value = structuredClone(acceptedCampaignSetup('officer').state);
  const snapshot = value.militiaSnapshot;
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'mill',
    name: 'Old Mill',
  });
  if (condition)
    snapshot.characterActions = {
      people: [
        {
          characterId: 'officer',
          status: 'captured',
          location: { kind: 'elsewhere', location: 'Goblin camp' },
          directRescueRequired: true,
          capture: { source: 'raid', week: 8 },
        },
      ],
    };
  if (benefits)
    snapshot.eventBenefits = {
      skills: [structuredClone(drill)],
      markets: [structuredClone(marketDay)],
    };
  return value;
}
function setMilitia(revision: number, week: CanonicalWeekState) {
  queries = {
    workspace: {
      key: { campaignId, militiaId: 'militia', draftId: 'draft-9' },
      week: week.week,
    },
    read: { revision, state: week },
    observe: undefined,
  };
}
const page = () => (
  <MilitiaSection campaignId={campaignId} organizationId="org" />
);
const index = () =>
  screen.getByRole('navigation', { name: 'Militia sections' });
const entry = (name: RegExp) => within(index()).getByRole('button', { name });
const summary = () =>
  screen
    .getByText('Fix these before saving')
    .closest<HTMLElement>('[role="alert"]')!;
async function press(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}
function openSection(label: 'Character conditions' | 'Carried benefits') {
  fireEvent.click(entry(new RegExp(`^${label}`)));
  fireEvent.click(
    screen.getByRole('button', { name: `Correct ${label.toLowerCase()}` }),
  );
  const editor = within(
    screen
      .getByRole('heading', { name: `Correct ${label.toLowerCase()}` })
      .closest<HTMLElement>('section')!,
  );
  return {
    editor,
    reason: stableControl('textbox', 'Reason for correction', editor),
    save: stableControl('button', 'Save correction', editor),
  };
}
const sent = (at = 0) => calls[at]!.args.snapshot as Snapshot;
const choose = (
  container: Pick<typeof screen, 'getByRole'>,
  group: string,
  choice: string,
) =>
  fireEvent.click(
    within(container.getByRole('group', { name: group })).getByRole('button', {
      name: choice,
    }),
  );
const fill = (
  container: Pick<typeof screen, 'getByRole'>,
  name: string,
  value: string,
) =>
  fireEvent.change(container.getByRole('textbox', { name }), {
    target: { value },
  });

beforeEach(() => {
  calls = [];
  setMilitia(3, state());
});

describe('Character conditions correction', () => {
  test('every condition fact is recorded and only the conditions are saved onto the latest militia', async () => {
    const view = render(page());
    const { editor, reason, save } = openSection('Character conditions');
    fireEvent.click(
      editor.getByRole('button', { name: 'Add character condition' }),
    );
    const row = within(
      editor.getByRole('group', { name: 'Character condition 1' }),
    );
    choose(row, 'Character', 'Ada');
    choose(row, 'Condition', 'hidden');
    fireEvent.click(row.getByRole('button', { name: 'refuge' }));
    choose(row, 'Refuge settlement', 'Old Mill');
    choose(row, 'PCs must perform rescue', 'Yes');
    fireEvent.click(row.getByRole('button', { name: 'Record capture' }));
    choose(row, 'Capture source', 'raid');
    fill(row, 'Captured week', '8');
    fill(row, 'Rescued week (optional)', '9');
    fill(row, 'Restored week (optional)', '9');
    fireEvent.change(reason(), { target: { value: 'Ada hid after a raid' } });
    // Another player corrected Teams and a character record meanwhile.
    const latest = state();
    latest.militiaSnapshot.roster.teams[0]!.notes = 'Found by scouts';
    latest.militiaSnapshot.characters[0]!.charisma = 20;
    setMilitia(4, latest);
    view.rerender(page());
    await press(save());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toMatchObject({
      expectedRevision: 4,
      reason: 'Ada hid after a raid',
    });
    expect(sent().characterActions).toEqual({
      people: [
        {
          characterId: 'officer',
          status: 'hidden',
          location: { kind: 'refuge', settlementId: 'mill' },
          directRescueRequired: true,
          capture: { source: 'raid', week: 8 },
          rescuedWeek: 9,
          restoredWeek: 9,
        },
      ],
    });
    expect(sent()).toEqual({
      ...latest.militiaSnapshot,
      characterActions: sent().characterActions,
    });
  });

  test('a condition can move elsewhere, drop its capture record and be removed', async () => {
    setMilitia(3, state({ condition: true }));
    render(page());
    expect(entry(/^Character conditions/).textContent).toMatch(/1 entry$/);
    const { editor, reason, save } = openSection('Character conditions');
    const row = within(
      editor.getByRole('group', { name: 'Character condition 1' }),
    );
    expect(
      row.getByRole('textbox', { name: 'Location description' }),
    ).toHaveValue('Goblin camp');
    fill(row, 'Location description', 'Goblin fort');
    fireEvent.click(row.getByRole('button', { name: 'Remove capture record' }));
    fireEvent.change(reason(), { target: { value: 'Moved to the fort' } });
    await press(save());
    expect(sent().characterActions?.people[0]).toMatchObject({
      location: { kind: 'elsewhere', location: 'Goblin fort' },
      capture: null,
    });
    cleanup();
    calls = [];
    render(page());
    const second = openSection('Character conditions');
    fireEvent.click(
      second.editor.getByRole('button', {
        name: 'Remove Character condition 1',
      }),
    );
    fireEvent.change(second.reason(), { target: { value: 'Ada is free' } });
    await press(second.save());
    expect(sent().characterActions).toEqual({ people: [] });
  });

  test('a condition without its character is required, and one character recorded twice is named', async () => {
    setMilitia(3, state({ condition: true }));
    render(page());
    const { editor, reason, save } = openSection('Character conditions');
    fireEvent.click(
      editor.getByRole('button', { name: 'Add character condition' }),
    );
    fireEvent.change(reason(), { target: { value: 'Recount' } });
    await press(save());
    expect(calls).toHaveLength(0);
    expect(
      within(summary()).getByRole('button', {
        name: 'Character condition 2 character is required.',
      }),
    ).toBeVisible();
    choose(
      within(editor.getByRole('group', { name: 'Character condition 2' })),
      'Character',
      'Ada',
    );
    await press(save());
    expect(calls).toHaveLength(0);
    expect(summary()).toHaveTextContent(
      'Ada has more than one character condition.',
    );
  });

  test('another player correcting conditions meanwhile is a conflict, not a write', async () => {
    setMilitia(3, state({ condition: true }));
    const view = render(page());
    const { editor, reason, save } = openSection('Character conditions');
    choose(
      within(editor.getByRole('group', { name: 'Character condition 1' })),
      'Condition',
      'dead',
    );
    fireEvent.change(reason(), { target: { value: 'Fell at the table' } });
    const theirs = state({ condition: true });
    theirs.militiaSnapshot.characterActions!.people[0]!.status = 'recovering';
    setMilitia(4, theirs);
    view.rerender(page());
    await press(save());
    expect(calls).toHaveLength(0);
    expect(
      screen.getByText('Another player changed this section'),
    ).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Their values' })).getByText(
        'Recovering',
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Your values' })).getByText(
        'Dead',
      ),
    ).toBeVisible();
  });
});

describe('Carried benefits correction', () => {
  test('skill and Market Day benefits keep their source identities and only the benefits are saved', async () => {
    setMilitia(3, state({ benefits: true }));
    render(page());
    expect(entry(/^Carried benefits/).textContent).toMatch(/2 entries$/);
    const { editor, reason, save } = openSection('Carried benefits');
    expect(
      editor.getByRole('heading', { name: 'Carried skill benefits' }),
    ).toBeVisible();
    expect(
      editor.getByRole('heading', { name: 'Carried Market Day benefits' }),
    ).toBeVisible();
    const skill = within(
      editor.getByRole('group', { name: 'Skill benefit 1' }),
    );
    choose(skill, 'Affected skills', 'stealth');
    choose(skill, 'Bonus type', 'circumstance');
    fill(skill, 'Skill bonus', '3');
    choose(skill, 'Benefit settlement', 'All settlements');
    choose(skill, 'Only after dark', 'No');
    fill(skill, 'Skill benefit starts week', '9');
    fill(skill, 'Skill benefit ends week', '12');
    const market = within(
      editor.getByRole('group', { name: 'Market Day benefit 1' }),
    );
    choose(market, 'Discount settlements', 'Old Mill');
    fill(market, 'Market Day ends week', '11');
    fireEvent.change(reason(), { target: { value: 'Festival ran longer' } });
    await press(save());
    expect(calls).toHaveLength(1);
    const latest = state({ benefits: true }).militiaSnapshot;
    expect(sent()).toEqual({
      ...latest,
      eventBenefits: {
        skills: [
          {
            ...drill,
            skills: ['diplomacy', 'stealth'],
            bonusType: 'circumstance',
            value: 3,
            settlementId: null,
            afterDark: false,
            startsWeek: 9,
            endsWeek: 12,
          },
        ],
        markets: [
          { ...marketDay, settlementIds: ['town', 'mill'], endsWeek: 11 },
        ],
      },
    });
  });

  test('added benefits name their characters and settlements; a removed one is dropped', async () => {
    setMilitia(3, state({ benefits: true }));
    render(page());
    const { editor, reason, save } = openSection('Carried benefits');
    fireEvent.click(
      editor.getByRole('button', { name: 'Remove Market Day benefit 1' }),
    );
    fireEvent.click(editor.getByRole('button', { name: 'Add skill benefit' }));
    const added = within(
      editor.getByRole('group', { name: 'Skill benefit 2' }),
    );
    choose(added, 'Benefiting characters', 'Ada');
    choose(added, 'Affected skills', 'bluff');
    fill(added, 'Skill bonus', '1');
    choose(added, 'Benefit settlement', 'Town');
    fireEvent.click(
      editor.getByRole('button', { name: 'Add Market Day benefit' }),
    );
    choose(
      within(editor.getByRole('group', { name: 'Market Day benefit 1' })),
      'Discount settlements',
      'Town',
    );
    fireEvent.change(reason(), { target: { value: 'New week rewards' } });
    await press(save());
    const { skills, markets } = sent().eventBenefits!;
    expect(skills[0]).toEqual(drill);
    expect(skills[1]).toMatchObject({
      characterIds: ['officer'],
      skills: ['bluff'],
      bonusType: 'untyped',
      value: 1,
      settlementId: 'town',
      startsWeek: 9,
      endsWeek: 9,
    });
    expect(skills[1]!.benefitId).not.toBe(drill.benefitId);
    expect(markets).toEqual([
      expect.objectContaining({
        settlementIds: ['town'],
        discountPercent: 5,
        startsWeek: 9,
        endsWeek: 9,
      }),
    ]);
    expect(markets[0]!.benefitId).not.toBe(marketDay.benefitId);
  });

  test('a benefit naming a settlement another player removed meanwhile is refused, naming it', async () => {
    const view = render(page());
    const { editor, reason, save } = openSection('Carried benefits');
    fireEvent.click(
      editor.getByRole('button', { name: 'Add Market Day benefit' }),
    );
    choose(
      within(editor.getByRole('group', { name: 'Market Day benefit 1' })),
      'Discount settlements',
      'Old Mill',
    );
    fireEvent.change(reason(), { target: { value: 'Mill fair' } });
    const latest = state();
    latest.militiaSnapshot.settlements.pop();
    setMilitia(4, latest);
    view.rerender(page());
    await press(save());
    expect(calls).toHaveLength(0);
    const link = within(summary()).getByRole('button', {
      name: 'Market Day benefit 1 names Old Mill, which is no longer in the militia.',
    });
    fireEvent.click(link);
    expect(
      within(
        editor.getByRole('group', { name: 'Discount settlements' }),
      ).getAllByRole('button')[0],
    ).toHaveFocus();
  });

  test('a malformed bonus is invalid and an empty week is required, linked to their fields', async () => {
    setMilitia(3, state({ benefits: true }));
    render(page());
    const { editor, reason, save } = openSection('Carried benefits');
    const skill = within(
      editor.getByRole('group', { name: 'Skill benefit 1' }),
    );
    fill(skill, 'Skill bonus', '2.5');
    fill(skill, 'Skill benefit ends week', '');
    fireEvent.change(reason(), { target: { value: 'Recount' } });
    await press(save());
    expect(calls).toHaveLength(0);
    const links = within(summary());
    expect(
      links.getByRole('button', {
        name: 'Enter a valid whole number for Skill benefit 1 skill bonus.',
      }),
    ).toBeVisible();
    expect(
      links.getByRole('button', {
        name: 'Skill benefit 1 ends week is required.',
      }),
    ).toBeVisible();
  });
});
