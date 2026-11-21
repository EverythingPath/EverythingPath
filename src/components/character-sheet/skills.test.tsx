import {
  calculateFixtureSheetProjections as calculateCharacterSheetProjections,
  buildSheet,
  emptyOwnerCandidates,
  isClassCatalogEntry,
  type CatalogSheetEntry,
  type Level,
} from './character-sheet-test-fixture';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';

import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import { SkillRankCell } from './skill-rank-cell';
import { ProficiencyChoice } from './proficiency-choice';

import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';
import { heldRaceDefinition } from '../../../tests/fixtures/races-328/sheet';

// Allocating skills and favored-class benefits (#302): ranks spent per Class
// Level from the Skills block, totals with their breakdowns, budgets and caps
// as advisory warnings. Weapon proficiency choices live in Proficiencies.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const nameOf = characterSheetNames({
  editLevel: api.characterSheet.editClassLevel,
});
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>) => {
    const name = nameOf(query);
    return name === 'read' ? snapshot : undefined;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) => {
        calls.push({ name, args, resolve, reject });
      });
  },
}));
vi.mock(
  '~/components/campaign-shell/navigation-guard',
  async (importOriginal) => {
    const actual = await importOriginal<typeof NavigationGuard>();
    return {
      ...actual,
      GuardedLink: ({
        href,
        children,
        ...props
      }: ComponentProps<'a'> & { href: string }) => (
        <a href={href} {...props}>
          {children}
        </a>
      ),
    };
  },
);
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

// The representative classes with class skills: Climb for the Fighter,
// Climb and Perception for the Rogue.
const classSkills: Record<string, string[]> = {
  fighter: ['skill.clm'],
  rogue: ['skill.clm', 'skill.per'],
};
const chainShirt: CatalogSheetEntry = {
  id: 'chain-shirt',
  name: 'Chain shirt',
  detail: {
    kind: 'item',
    consumable: false,
    armor: { slot: 'armor', armorCheckPenalty: 2 },
  },
  modifiers: [],
};
function build(input: Parameters<typeof buildSheet>[0]) {
  const sheet = buildSheet(input);
  const catalogEntries = sheet.catalogEntries.map((entry) =>
    isClassCatalogEntry(entry) && classSkills[entry._id]
      ? {
          ...entry,
          detail: { ...entry.detail, classSkills: classSkills[entry._id] },
        }
      : entry,
  );
  const calculated = calculateCharacterSheetProjections({
    characterKind: 'pc',
    entries: sheet.entries,
    catalogEntries,
  });
  return {
    ...sheet,
    catalogEntries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

const page = () => (
  <CharacterSheetBlocks blocks={['levels', 'skills', 'summary']} />
);
function renderSheet(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(page());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page());
    },
  };
}
// The sheet has some fifty labelled controls and a few thousand nodes, and a
// query that walks them all costs about half a second in jsdom. Queries start
// from the block, the row or the skill's table row instead.
const skillKeys = {
  Climb: 'skill.clm',
  Fly: 'skill.fly',
  Perception: 'skill.per',
  Stealth: 'skill.ste',
  Swim: 'skill.swm',
} as const;
type SkillName = keyof typeof skillKeys;
function skillsRegion() {
  const region = screen
    .getByText('Skills', { selector: 'h2' })
    .closest<HTMLElement>('section');
  if (!region) throw new Error('Expected the Skills block');
  return region;
}
const skills = () => within(skillsRegion());
const levelPicker = () =>
  skills().getByRole('combobox', { name: 'Allocate ranks at level' });
function skillRow(skill: SkillName) {
  const row = skillsRegion().querySelector<HTMLElement>(
    `[data-skill="${skillKeys[skill]}"]`,
  );
  if (!row) throw new Error(`Expected a ${skill} row`);
  return within(row);
}
const rankInput = (skill: SkillName, level: number) =>
  skillRow(skill).getByLabelText(`${skill} ranks at level ${level}`);
const queryRankInput = (skill: SkillName, level: number) =>
  skillRow(skill).queryByLabelText(`${skill} ranks at level ${level}`);
const row = (level: number) =>
  screen.getByRole('listitem', { name: `Level ${level}` });
const clericChoice = (choice: string | null) => ({
  entryId: 'a',
  name: 'Cleric',
  choice,
});
const choiceLabel = 'Weapon proficiency choice for Cleric';
const pick = (select: HTMLElement, value: string) =>
  fireEvent.change(select, { target: { value } });
const typeInto = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
/** Shows the snapshot as the own write's echo, then settles the write. */
async function settle(
  view: ReturnType<typeof renderSheet>,
  next: Parameters<typeof buildSheet>[0],
) {
  view.show(
    build({ ...next, lastOperationId: String(lastCall().args.operationId) }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
}

const fighter: Level = {
  id: 'a',
  hp: 10,
  classId: 'fighter',
  skillRanks: { 'skill.clm': 1 },
};
const rogue: Level = { id: 'b', hp: 6, classId: 'rogue' };

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

test('the skills table names each rank input for the chosen level, reads the level’s spent, budget and cap, marks class skills and armor check penalties, and explains a total with its ranks, one +3 and the penalty', () => {
  renderSheet(build({ levels: [fighter], sheetEntries: [chainShirt] }));
  expect(levelPicker()).toHaveValue('a');
  expect(
    within(levelPicker()).getByRole('option', {
      name: 'Level 1 · Fighter 1 · 1/2',
    }),
  ).toBeInTheDocument();
  expect(rankInput('Climb', 1)).toHaveValue(1);
  expect(rankInput('Perception', 1)).toHaveValue(0);
  expect(skills().getByText('1/2 spent')).toBeVisible();
  expect(skills().getByText('· 1 left')).toHaveClass('text-sky-300');
  expect(skills().getByText('· up to 1 per skill')).toBeVisible();
  expect(skills().getByText('1 skill rank remains to allocate.')).toHaveClass(
    'text-sky-300',
  );
  expect(
    skills().getByText('Ranks use permanent Intelligence at every level.'),
  ).toBeVisible();

  const climb = skillRow('Climb');
  expect(climb.getByText('Class skill')).toBeVisible();
  expect(climb.getByText('ACP -2')).toBeVisible();
  expect(climb.getByTitle('Strength')).toHaveTextContent('Str');
  const swim = skillRow('Swim');
  expect(swim.queryByText('Class skill')).not.toBeInTheDocument();
  expect(swim.getByTitle('Armor check penalty')).toBeVisible();
  expect(
    skillRow('Perception').queryByTitle('Armor check penalty'),
  ).not.toBeInTheDocument();

  // 1 rank + Str 0 + class skill 3 − chain shirt 2.
  fireEvent.click(climb.getByRole('button', { name: 'Climb +2, breakdown' }));
  const panel = screen.getByRole('group', { name: 'Climb breakdown' });
  expect(within(panel).getByText('Class Level 1 ranks')).toBeVisible();
  expect(within(panel).getAllByText('Class skill')).toHaveLength(1);
  expect(
    within(panel).getByText('Chain shirt armor check penalty'),
  ).toBeVisible();
  fireEvent.keyDown(panel, { key: 'Escape' });
  // No rank, no class skill bonus: Str 0 − chain shirt 2.
  fireEvent.click(swim.getByRole('button', { name: 'Swim -2, breakdown' }));
  const swimPanel = screen.getByRole('group', { name: 'Swim breakdown' });
  expect(within(swimPanel).queryByText('Class skill')).not.toBeInTheDocument();
  expect(
    skillRow('Perception').getByRole('button', {
      name: 'Perception +0, breakdown',
    }),
  ).toBeVisible();
});

// #720: a Character's own size gives its Stealth and Fly size modifiers. Ogre
// (ARG p. 229): "a −4 size penalty on Stealth checks"; Fly (CRB p. 96):
// "Large –2".
test('a Large race’s Stealth and Fly breakdowns each show one Size line', () => {
  const ogre = 'pf1/gZxiUYLYsGqQYwGZ';
  renderSheet(
    build({
      levels: [fighter],
      race: { key: ogre },
      extraCatalog: [{ _id: ogre, ...heldRaceDefinition(ogre) }],
    }),
  );
  // Dex 10: the size modifier is the whole total.
  for (const [skill, value] of [
    ['Stealth', '-4'],
    ['Fly', '-2'],
  ] as const) {
    fireEvent.click(
      skillRow(skill).getByRole('button', {
        name: `${skill} ${value}, breakdown`,
      }),
    );
    const panel = screen.getByRole('group', { name: `${skill} breakdown` });
    const [line, ...others] = within(panel).getAllByText('Size');
    expect(others).toEqual([]);
    const row = line?.closest('li');
    if (!row) throw new Error(`Expected a ${skill} Size line`);
    expect(within(row).getByText('size')).toBeVisible();
    expect(within(row).getByText(value)).toBeVisible();
    fireEvent.keyDown(panel, { key: 'Escape' });
  }
});

test('leaving or entering a rank saves that one skill for the chosen row, and a rank above the cap saves and warns beside the allocation with Accept', async () => {
  const view = renderSheet(build({ levels: [fighter, rogue] }));
  expect(levelPicker()).toHaveValue('b');
  expect(skills().getByText('0/8 spent')).toBeVisible();
  typeInto(rankInput('Climb', 2), '5');
  fireEvent.blur(rankInput('Climb', 2));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editLevel');
  expect(lastCall().args).toMatchObject({
    entryId: 'b',
    skillRank: { skill: 'skill.clm', ranks: 5 },
  });
  expect(lastCall().args).not.toHaveProperty('skillRanks');
  const climbing: Level = { ...rogue, skillRanks: { 'skill.clm': 5 } };
  await settle(view, { levels: [fighter, climbing] });
  expect(skillRow('Climb').getByText('Ranks saved.')).toBeVisible();
  expect(skills().getByText('5/8 spent')).toBeVisible();
  const cap = 'Recorded ranks exceed the 2-rank limit at this level.';
  expect(skills().getByText(cap).parentElement).toHaveClass('text-amber-300');
  expect(
    skills().getByRole('button', { name: 'Accept', description: cap }),
  ).toBeEnabled();
  expect(rankInput('Climb', 2)).toBeEnabled();
  expect(rankInput('Climb', 2)).toHaveValue(5);
  expect(
    skillRow('Climb').getByRole('button', { name: 'Climb +9, breakdown' }),
  ).toBeVisible();

  typeInto(rankInput('Perception', 2), '2');
  fireEvent.keyDown(rankInput('Perception', 2), { key: 'Enter' });
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'b',
    skillRank: { skill: 'skill.per', ranks: 2 },
  });
});

test('Enter on pristine rank and proficiency fields saves nothing', async () => {
  const saveRank = vi.fn().mockResolvedValue(null);
  const saveProficiency = vi.fn().mockResolvedValue(null);
  render(
    <>
      <SkillRankCell skill="Climb" level={1} ranks={1} save={saveRank} />
      <ProficiencyChoice
        row={clericChoice('longsword')}
        save={saveProficiency}
      />
    </>,
  );
  fireEvent.keyDown(screen.getByLabelText('Climb ranks at level 1'), {
    key: 'Enter',
  });
  fireEvent.keyDown(screen.getByLabelText(choiceLabel), { key: 'Enter' });
  await act(async () => {
    await Promise.resolve();
  });
  expect(saveRank).not.toHaveBeenCalled();
  expect(saveProficiency).not.toHaveBeenCalled();
});

test('clearing a saved proficiency with Enter writes the cleared choice', async () => {
  let complete: (() => void) | undefined;
  const save = vi.fn(
    (_choice: string | null) =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const view = render(
    <ProficiencyChoice row={clericChoice(null)} save={save} />,
  );
  const input = screen.getByLabelText(choiceLabel);
  typeInto(input, 'longsword');
  fireEvent.blur(input);
  await waitFor(() => expect(save).toHaveBeenCalledWith('longsword'));
  view.rerender(
    <ProficiencyChoice row={clericChoice('longsword')} save={save} />,
  );
  await act(async () => {
    complete?.();
  });
  expect(
    screen.queryByRole('button', { name: 'Save choice for Cleric' }),
  ).not.toBeInTheDocument();
  typeInto(input, '');
  expect(
    await screen.findByRole('button', { name: 'Save choice for Cleric' }),
  ).toBeEnabled();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(save).toHaveBeenLastCalledWith(null));
});

test('a blank or non-integer rank is refused at the field without a write; a refused save keeps the draft with Save beside it, and Save retries', async () => {
  const view = renderSheet(build({ levels: [fighter] }));
  typeInto(rankInput('Climb', 1), '');
  fireEvent.blur(rankInput('Climb', 1));
  expect(await skillRow('Climb').findByRole('alert')).toHaveTextContent(
    'Ranks are required',
  );
  typeInto(rankInput('Climb', 1), '1.5');
  fireEvent.keyDown(rankInput('Climb', 1), { key: 'Enter' });
  await waitFor(() =>
    expect(skillRow('Climb').getByRole('alert')).toHaveTextContent(
      'Ranks must be a whole number of 0 or more',
    ),
  );
  expect(rankInput('Climb', 1)).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toEqual([]);

  typeInto(rankInput('Climb', 1), '3');
  fireEvent.blur(rankInput('Climb', 1));
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Editing is paused'));
  });
  const climb = skillRow('Climb');
  expect(await climb.findByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Editing is paused. Your edits are kept. Save to try again.",
  );
  expect(rankInput('Climb', 1)).toHaveValue(3);
  fireEvent.click(
    climb.getByRole('button', { name: 'Save Climb ranks at level 1' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    skillRank: { skill: 'skill.clm', ranks: 3 },
  });
  await settle(view, {
    levels: [{ ...fighter, skillRanks: { 'skill.clm': 3 } }],
  });
  expect(climb.getByText('Ranks saved.')).toBeVisible();
  expect(climb.queryByRole('alert')).not.toBeInTheDocument();
  expect(
    climb.queryByRole('button', { name: /^Save/ }),
  ).not.toBeInTheDocument();
});

test('changing the chosen level mounts that level’s own inputs: a draft typed for one level never saves for another', async () => {
  renderSheet(build({ levels: [fighter, rogue] }));
  pick(levelPicker(), 'a');
  expect(rankInput('Climb', 1)).toHaveValue(1);
  typeInto(rankInput('Climb', 1), '2');
  pick(levelPicker(), 'b');
  expect(rankInput('Climb', 2)).toHaveValue(0);
  expect(queryRankInput('Climb', 1)).not.toBeInTheDocument();
  typeInto(rankInput('Climb', 2), '4');
  fireEvent.blur(rankInput('Climb', 2));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    entryId: 'b',
    skillRank: { skill: 'skill.clm', ranks: 4 },
  });
  pick(levelPicker(), 'a');
  expect(rankInput('Climb', 1)).toHaveValue(1);
  expect(calls).toHaveLength(1);
});

test('another player’s rank replaces a pristine field and is announced; a dirty field keeps its draft with the notice; a moved row keeps its allocations and draft under its new level', () => {
  const view = renderSheet(build({ levels: [fighter, rogue] }));
  pick(levelPicker(), 'a');
  typeInto(rankInput('Perception', 1), '3');
  view.show(
    build({
      levels: [
        { ...fighter, skillRanks: { 'skill.clm': 2, 'skill.per': 1 } },
        rogue,
      ],
      lastOperationId: 'other-player',
    }),
  );
  expect(rankInput('Climb', 1)).toHaveValue(2);
  expect(
    skillRow('Climb').getByText('Updated by another player.'),
  ).toBeVisible();
  expect(rankInput('Perception', 1)).toHaveValue(3);
  expect(
    skillRow('Perception').getByText(
      'Updated by another player. Your edits are kept.',
    ),
  ).toBeVisible();
  fireEvent.click(
    skillRow('Climb').getByRole('button', {
      name: 'Dismiss Climb ranks at level 1 update',
    }),
  );
  expect(
    skillRow('Climb').queryByText('Updated by another player.'),
  ).not.toBeInTheDocument();

  view.show(
    build({
      levels: [
        rogue,
        { ...fighter, skillRanks: { 'skill.clm': 2, 'skill.per': 1 } },
      ],
      lastOperationId: 'other-player',
    }),
  );
  expect(levelPicker()).toHaveValue('a');
  expect(
    within(levelPicker()).getByRole('option', {
      name: 'Level 2 · Fighter 1 · 3/2',
    }),
  ).toBeInTheDocument();
  expect(rankInput('Climb', 2)).toHaveValue(2);
  expect(rankInput('Perception', 2)).toHaveValue(3);
  expect(
    skills().getByText('Recorded ranks exceed this level’s 2-rank budget.')
      .parentElement,
  ).toHaveClass('text-amber-300');
  expect(calls).toEqual([]);
});

test('the favored class bonus stays a choice of +1 hp, +1 skill rank or a described alternative that adds nothing, and an ability increase off its milestone saves with an advisory', async () => {
  const view = renderSheet(build({ levels: [fighter] }));
  const favored = () =>
    within(row(1)).getByRole('combobox', {
      name: 'Favored class bonus at level 1',
    });
  pick(favored(), 'skill');
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    favoredClassBonus: { choice: 'skill' },
  });
  await settle(view, {
    levels: [{ ...fighter, favoredClassBonus: { choice: 'skill' } }],
  });
  expect(skills().getByText('1/3 spent')).toBeVisible();

  pick(favored(), 'hp');
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    favoredClassBonus: { choice: 'hp' },
  });
  await settle(view, {
    levels: [{ ...fighter, favoredClassBonus: { choice: 'hp' } }],
  });
  expect(skills().getByText('1/2 spent')).toBeVisible();

  pick(favored(), 'alt');
  const note = within(row(1)).getByRole('textbox', {
    name: 'Alternative favored class bonus at level 1',
  });
  typeInto(note, 'Extra rage round');
  fireEvent.blur(note);
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().args).toMatchObject({
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  });
  const withNote: Level = {
    ...fighter,
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  };
  await settle(view, { levels: [withNote] });
  expect(note).toHaveValue('Extra rage round');
  expect(skills().getByText('1/2 spent')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'HP 10, breakdown' }),
  ).toBeVisible();

  const ability = within(row(1)).getByRole('combobox', {
    name: 'Ability increase at level 1',
  });
  expect(ability).toHaveClass('text-muted-foreground');
  pick(ability, 'strength');
  await waitFor(() => expect(calls).toHaveLength(4));
  expect(lastCall().args).toMatchObject({ abilityIncrease: 'strength' });
  await settle(view, {
    levels: [{ ...withNote, abilityIncrease: 'strength' }],
  });
  const milestone = 'This level is outside the ability-increase milestones.';
  expect(
    within(row(1)).getByRole('button', {
      name: 'Accept',
      description: milestone,
    }),
  ).toBeEnabled();
  expect(ability).toBeEnabled();
});

test('without Class Levels the table still totals every skill and says what to add; an Unspecified level stays allocatable with its budget unresolved', () => {
  const view = renderSheet(build({ levels: [], hasClasses: true }));
  expect(
    skills().getByText('Add a Class Level to allocate skill ranks.'),
  ).toBeVisible();
  expect(skills().queryByRole('combobox')).not.toBeInTheDocument();
  expect(skills().queryByRole('textbox')).not.toBeInTheDocument();
  expect(
    skills().getByRole('button', { name: 'Climb +0, breakdown' }),
  ).toBeVisible();

  view.show(
    build({
      levels: [{ id: 'u', hp: 6, skillRanks: { 'skill.clm': 1 } }],
      hasClasses: true,
    }),
  );
  expect(
    within(levelPicker()).getByRole('option', {
      name: 'Level 1 · Unspecified · 1 spent',
    }),
  ).toBeInTheDocument();
  expect(skills().getByText('1 spent')).toBeVisible();
  expect(
    skills().getByText(
      'Choose a class to calculate this level’s skill rank budget.',
    ),
  ).toHaveClass('text-muted-foreground');
  expect(rankInput('Climb', 1)).toBeEnabled();
  expect(rankInput('Climb', 1)).toHaveValue(1);
  expect(skills().queryByText('Accept')).not.toBeInTheDocument();
});

test('maintenance disables every rank input with the reason stated once in the block and writes nothing; the table scrolls within the Skills block on a phone', () => {
  Object.defineProperty(window, 'innerWidth', {
    value: 390,
    configurable: true,
  });
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(
    build({
      levels: [{ ...fighter, skillRanks: { 'skill.clm': 3 } }],
      sheetEntries: [chainShirt],
    }),
  );
  const accepts = skills().getAllByRole('button', { name: 'Accept' });
  expect(accepts).toHaveLength(2);
  for (const control of [
    rankInput('Climb', 1),
    rankInput('Perception', 1),
    ...accepts,
  ])
    expect(control).toBeDisabled();
  expect(levelPicker()).toBeEnabled();
  expect(skills().getAllByText(message)).toHaveLength(1);
  typeInto(rankInput('Climb', 1), '4');
  fireEvent.blur(rankInput('Climb', 1));
  fireEvent.keyDown(rankInput('Climb', 1), { key: 'Enter' });
  expect(calls).toEqual([]);

  const table = skillsRegion().querySelector('[data-skills-table]');
  expect(table).toHaveClass('overflow-x-auto');
  expect(table).toContainElement(rankInput('Climb', 1));
  expect(skillsRegion()).not.toHaveClass('overflow-x-auto');
});
