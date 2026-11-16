import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { BreakdownResolverProvider } from './breakdown-resolver';
import type { CombinedFormRead } from './character-combined-form-view-model';
import { brynRelationship } from './character-cohort-test-fixture';
import { CharacterCompanions } from './character-companions';
import { buildSheet } from './character-sheet-test-fixture';
import { buildCharacterSheetView } from './character-sheet-view-model';
import { buildSpellSheet, spells } from './character-spells-test-fixture';
import { SpellcastingBlock } from './spellcasting-block';
import {
  useCharacterCompanions,
  type CompanionRelationship,
} from './use-character-companions';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The Companions section (#309): both directions of a relationship with
// their history, link/create/replace/source editors in place, interruption
// asked first, and inaccessible endpoints that disclose nothing.

const server = vi.hoisted(() => ({
  relationships: undefined as unknown[] | undefined,
  candidates: [] as unknown[],
  linkedInput: undefined as unknown,
  combinedForm: null as unknown,
  write: vi.fn(),
  maintenance: { kind: 'ready', readOnly: false, message: '' },
}));
vi.mock('convex/react', () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(reference);
    if (name === 'companionRelationships:list') return server.relationships;
    if (name === 'characterSheetCombinedForm:read') return server.combinedForm;
    if (name === 'character:listCampaignCharacters') return server.candidates;
    if (name === 'characterSheetLinkedInputs:list')
      return server.linkedInput ? [server.linkedInput] : undefined;
    throw new Error(`Unexpected query: ${name}`);
  },
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => server.maintenance,
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

const whisper = {
  relationshipId: 'rel-whisper' as Id<'companionRelationship'>,
  role: 'companion',
  kind: 'familiar',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'owl' as Id<'character'>, name: 'Whisper' },
  sources: [
    { key: 'bond', label: 'Arcane Bond', enabled: true, available: true },
  ],
  linkedInputs: [],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;
const lord = {
  ...whisper,
  relationshipId: 'rel-lord' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'cohort',
  endpoint: { characterId: 'lord' as Id<'character'>, name: 'Lord Varn' },
  sources: [
    { key: 'leadership', label: 'Leadership', enabled: true, available: true },
  ],
} satisfies CompanionRelationship;
const ash = {
  ...whisper,
  relationshipId: 'rel-ash' as Id<'companionRelationship'>,
  kind: 'animalCompanion',
  status: 'replaced',
  endpoint: { characterId: 'wolf' as Id<'character'>, name: 'Ash' },
} satisfies CompanionRelationship;
const pip = {
  ...whisper,
  relationshipId: 'rel-pip' as Id<'companionRelationship'>,
  status: 'interrupted',
  interruption: 'support',
  endpoint: { characterId: 'cat' as Id<'character'>, name: 'Pip' },
  sources: [
    { key: 'bond', label: 'Arcane Bond', enabled: true, available: false },
  ],
} satisfies CompanionRelationship;

beforeEach(() => {
  server.relationships = [];
  server.candidates = [];
  server.linkedInput = undefined;
  server.combinedForm = null;
  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  server.write.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const warningControls = {
  accept: vi.fn(),
  reopen: vi.fn(),
  statusFor: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
function Host({
  snapshot,
  origin,
}: {
  snapshot: CharacterSheetSnapshot;
  origin?: CharacterSheetOrigin;
}) {
  const controller = useCharacterCompanions(
    { characterId: snapshot.character._id },
    snapshot,
    origin,
  );
  return (
    <main>
      <CharacterCompanions
        controller={controller}
        warningController={warningControls}
        characterId={snapshot.character._id}
      />
    </main>
  );
}
function renderCompanions({
  snapshot = buildSheet(),
  origin,
}: { snapshot?: CharacterSheetSnapshot; origin?: CharacterSheetOrigin } = {}) {
  const view = render(<Host snapshot={snapshot} origin={origin} />);
  return {
    rerender: () => view.rerender(<Host snapshot={snapshot} origin={origin} />),
  };
}
const item = (name: string) => screen.getByRole('listitem', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const toggle = (name: string) => screen.getByRole('switch', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const form = (name: string) => screen.getByRole('form', { name });
const namedItems = () =>
  screen
    .getAllByRole('listitem')
    .map((element) => element.getAttribute('aria-label'))
    .filter((label) => label !== null);
const lastCall = () => server.write.mock.calls.at(-1);

test('loading disables edits, an empty section keeps its actions, and both directions with their history stay discoverable once', () => {
  server.relationships = undefined;
  const view = renderCompanions();
  expect(screen.getByRole('region', { name: 'Companions' })).toBeVisible();
  expect(screen.getByText('Loading companions…')).toBeVisible();
  expect(button('Link existing Character')).toBeDisabled();
  expect(button('Create Companion')).toBeDisabled();

  server.relationships = [];
  view.rerender();
  expect(screen.getByText('No Companion Relationships.')).toBeVisible();
  expect(button('Link existing Character')).toBeEnabled();
  expect(button('Create Companion')).toBeEnabled();

  server.relationships = [ash, whisper, pip, lord];
  view.rerender();
  expect(namedItems()).toEqual([
    'Companion Whisper',
    'Associated Character Lord Varn',
    'Companion Ash',
    'Companion Pip',
  ]);
  expect(
    screen.getByRole('heading', { name: 'Former and interrupted' }),
  ).toBeVisible();
  const inWhisper = within(item('Companion Whisper'));
  expect(inWhisper.getByText('Familiar')).toBeVisible();
  expect(inWhisper.getByText('Active')).toBeVisible();
  expect(inWhisper.getByText('Companion')).toBeVisible();
  const inLord = within(item('Associated Character Lord Varn'));
  expect(inLord.getByText('Associated Character')).toBeVisible();
  expect(inLord.getByText('Cohort')).toBeVisible();
  const inAsh = within(item('Companion Ash'));
  expect(inAsh.getByText('Replaced')).toBeVisible();
  expect(
    inAsh.getByText(
      'The former relationship and Character Sheet are retained.',
    ),
  ).toBeVisible();
  const inPip = within(item('Companion Pip'));
  expect(inPip.getByText('Interrupted')).toBeVisible();
  expect(
    inPip.getByText(
      'No supporting source currently supports this relationship.',
    ),
  ).toBeVisible();
  expect(inPip.getByRole('switch', { name: 'Arcane Bond' })).toBeChecked();
  expect(inPip.getByText('Not counting now')).toBeVisible();
  expect(server.write).not.toHaveBeenCalled();
});

test('an inaccessible endpoint reads only as unavailable: no link, name or details; a forward row can still be replaced, a reverse row edits nothing', () => {
  server.relationships = [
    { ...whisper, endpoint: null },
    { ...lord, endpoint: null, sources: [] },
  ];
  renderCompanions();
  const forward = item('Companion Character unavailable');
  expect(within(forward).queryByRole('link')).toBeNull();
  expect(forward).toHaveTextContent('This Character is not available to you.');
  expect(
    within(forward).getByRole('button', {
      name: 'Replace Companion Character unavailable',
    }),
  ).toBeEnabled();
  expect(
    within(forward).queryByRole('button', { name: /Restore|Reselect/ }),
  ).toBeNull();
  const reverse = item('Associated Character Character unavailable');
  expect(within(reverse).queryAllByRole('button')).toHaveLength(0);
  expect(within(reverse).queryAllByRole('switch')).toHaveLength(0);
  expect(within(reverse).queryByRole('link')).toBeNull();
  const text = document.body.textContent ?? '';
  expect(text).not.toContain('Whisper');
  expect(text).not.toContain('Lord Varn');
  expect(document.body.innerHTML).not.toMatch(/owl|rel-lord|rel-whisper/);
});

test('an accessible sheet link uses the guarded href and keeps the navigation origin', () => {
  const origin: CharacterSheetOrigin = {
    href: '/campaigns/campaign-1/characters',
    organization: { kind: 'organization', id: 'org' },
  };
  server.relationships = [whisper];
  renderCompanions({ origin });
  expect(screen.getByRole('link', { name: 'Whisper' })).toHaveAttribute(
    'href',
    characterSheetPath('owl', origin),
  );
});

test('Create validates in place, keeps a refused draft with its reason, writes the kind once and then offers the new sheet', async () => {
  renderCompanions();
  fireEvent.click(button('Create Companion'));
  const editor = form('Create Companion');
  expect(editor).toHaveAttribute('novalidate');
  expect(field('Name')).toHaveFocus();
  expect(radio('Animal companion')).toBeChecked();
  const submit = () =>
    fireEvent.click(
      within(editor).getByRole('button', { name: 'Create Companion' }),
    );
  submit();
  await waitFor(() => expect(screen.getByText('Enter a name.')).toBeVisible());
  expect(screen.getByText('Enter a supporting source.')).toBeVisible();
  expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
  expect(server.write).not.toHaveBeenCalled();

  fireEvent.change(field('Name'), { target: { value: 'Whisper' } });
  fireEvent.click(radio('Familiar'));
  fireEvent.change(field('Supporting source name'), {
    target: { value: 'Arcane Bond' },
  });
  server.write.mockRejectedValueOnce(new ConvexError('Not allowed'));
  submit();
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Companion wasn't saved: Not allowed. Try again.",
    ),
  );
  expect(form('Create Companion')).toBeVisible();
  expect(field('Name')).toHaveValue('Whisper');
  expect(radio('Familiar')).toBeChecked();

  server.write.mockResolvedValueOnce({
    relationshipId: 'new',
    companionCharacterId: 'owl',
  });
  submit();
  await waitFor(() =>
    expect(screen.queryByRole('form', { name: 'Create Companion' })).toBeNull(),
  );
  expect(server.write).toHaveBeenCalledTimes(2);
  expect(lastCall()).toEqual([
    'companionRelationships:create',
    expect.objectContaining({ name: 'Whisper', kind: 'familiar' }),
  ]);
  expect(screen.getByText('Companion created.')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Open Companion Sheet' }),
  ).toHaveAttribute('href', '/characters/owl');
  await waitFor(() => expect(button('Create Companion')).toHaveFocus());
  fireEvent.click(button('Dismiss created Companion notice'));
  expect(screen.queryByText('Companion created.')).toBeNull();
});

test('Link and Replace choose a Character from cards, never a typed ID; a vanished choice is refused by the hook and replacement adds no kind or source', async () => {
  const snapshot = buildSheet();
  const ashCharacter = { ...snapshot.character, _id: 'wolf', name: 'Ash' };
  server.relationships = [whisper];
  server.candidates = [{ character: ashCharacter }];
  const view = renderCompanions({ snapshot });
  fireEvent.click(button('Link existing Character'));
  const linkForm = form('Link existing Character');
  expect(within(linkForm).getAllByRole('textbox')).toHaveLength(1);
  expect(field('Supporting source name')).toBeVisible();
  fireEvent.click(radio('Ash'));
  fireEvent.change(field('Supporting source name'), {
    target: { value: 'Animal Companion' },
  });

  server.candidates = [];
  view.rerender();
  expect(screen.getByText('No compatible Characters to link.')).toBeVisible();
  fireEvent.click(button('Link Character'));
  await waitFor(() =>
    expect(screen.getByText('Choose an available Character.')).toBeVisible(),
  );
  expect(server.write).not.toHaveBeenCalled();

  server.candidates = [{ character: ashCharacter }];
  view.rerender();
  expect(radio('Ash')).toBeChecked();
  fireEvent.click(button('Link Character'));
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'Link existing Character' }),
    ).toBeNull(),
  );
  expect(lastCall()).toEqual([
    'companionRelationships:link',
    expect.objectContaining({ companionCharacterId: 'wolf' }),
  ]);

  fireEvent.click(button('Replace Companion Whisper'));
  const replaceForm = within(item('Companion Whisper')).getByRole('form', {
    name: 'Replace Companion',
  });
  expect(within(replaceForm).queryAllByRole('textbox')).toHaveLength(0);
  expect(
    within(replaceForm).queryByRole('radio', { name: 'Familiar' }),
  ).toBeNull();
  expect(
    within(replaceForm).getByText(
      'The former relationship and Character Sheet are retained.',
    ),
  ).toBeVisible();
  fireEvent.click(within(replaceForm).getByRole('radio', { name: 'Ash' }));
  fireEvent.click(
    within(replaceForm).getByRole('button', { name: 'Replace Companion' }),
  );
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()).toEqual([
    'companionRelationships:replace',
    expect.objectContaining({
      relationshipId: 'rel-whisper',
      companionCharacterId: 'wolf',
    }),
  ]);
  expect(item('Companion Whisper')).toBeVisible();
});

test('Supporting sources: a switch per contribution, real sheet entries as cards with a Not counting now advisory, or a named source', async () => {
  const sheet = buildSheet({
    adjustments: [{ id: 'armor', name: 'Armor Training', modifiers: [] }],
  });
  const snapshot = {
    ...sheet,
    calculated: {
      ...sheet.calculated,
      resolvedEntries: sheet.calculated.resolvedEntries.map((resolved) =>
        resolved.entry._id === 'armor'
          ? { ...resolved, counting: false }
          : resolved,
      ),
    },
  };
  server.relationships = [whisper];
  const view = renderCompanions({ snapshot });
  fireEvent.click(toggle('Arcane Bond'));
  expect(lastCall()).toEqual([
    'companionRelationships:setSourceEnabled',
    expect.objectContaining({
      relationshipId: 'rel-whisper',
      sourceKey: 'bond',
      enabled: false,
    }),
  ]);
  await waitFor(() =>
    expect(
      within(item('Companion Whisper')).getByRole('status'),
    ).toHaveTextContent('Saved'),
  );

  fireEvent.click(button('Add supporting source for Whisper'));
  const editor = form('Add supporting source');
  expect(field('Supporting source name')).toBeVisible();
  const level = within(editor).getByRole('radio', {
    name: /^Armor Training/,
  });
  expect(level).toHaveAccessibleName(/Not counting now/);
  fireEvent.click(level);
  expect(
    screen.getByText(
      'This supporting source is not counting now. The relationship can be retained without its support.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: 'Supporting source name' }),
  ).toBeNull();

  fireEvent.click(radio('Other supporting source'));
  expect(
    screen.queryByText(/This supporting source is not counting now/),
  ).toBeNull();
  fireEvent.change(field('Supporting source name'), {
    target: { value: 'Witch Familiar' },
  });
  fireEvent.click(button('Add supporting source'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()).toEqual([
    'companionRelationships:addSource',
    expect.objectContaining({
      relationshipId: 'rel-whisper',
      source: expect.objectContaining({
        label: 'Witch Familiar',
        enabled: true,
      }),
    }),
  ]);

  server.relationships = [
    { ...whisper, sources: [{ ...whisper.sources[0], available: false }] },
  ];
  view.rerender();
  expect(toggle('Arcane Bond')).toBeChecked();
  expect(
    within(item('Companion Whisper')).getByText('Not counting now'),
  ).toBeVisible();
});

test('interruption asks first and differs from replacement; replaced history offers no Replace; Restore and Reselect follow the supplied permissions, never write on view, and show a refusal', async () => {
  server.relationships = [whisper, ash, pip];
  renderCompanions();
  expect(server.write).not.toHaveBeenCalled();
  fireEvent.click(button('Interrupt relationship with Whisper'));
  const question = screen.getByRole('group', {
    name: 'Interrupt the relationship with Whisper?',
  });
  expect(question).toHaveAccessibleDescription(
    'The Character Sheet and supporting source choices are retained.',
  );
  expect(button('Cancel Whisper')).toHaveFocus();
  expect(server.write).not.toHaveBeenCalled();
  fireEvent.click(button('Interrupt relationship Whisper'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual([
    'companionRelationships:interrupt',
    expect.objectContaining({ relationshipId: 'rel-whisper' }),
  ]);
  await waitFor(() =>
    expect(
      screen.queryByRole('group', {
        name: 'Interrupt the relationship with Whisper?',
      }),
    ).toBeNull(),
  );

  const inAsh = within(item('Companion Ash'));
  expect(inAsh.queryByRole('button', { name: /Replace/ })).toBeNull();
  expect(inAsh.getByRole('link', { name: 'Ash' })).toBeVisible();
  fireEvent.click(button('Reselect Companion Ash'));
  expect(lastCall()).toEqual([
    'companionRelationships:restore',
    expect.objectContaining({ relationshipId: 'rel-ash' }),
  ]);
  server.write.mockRejectedValueOnce(
    new ConvexError('Restoring this relationship would create a cycle.'),
  );
  fireEvent.click(button('Restore relationship Pip'));
  await waitFor(() =>
    expect(within(item('Companion Pip')).getByRole('alert')).toHaveTextContent(
      "Companion wasn't saved: Restoring this relationship would create a cycle. Try again.",
    ),
  );
  expect(
    screen.queryByRole('button', { name: /Restore relationship Ash/ }),
  ).toBeNull();
});

test('Saving appears only on the edited row, a repeated press is ignored, and another row keeps its draft', async () => {
  server.relationships = [whisper, lord];
  let finish: ((value: null) => void) | undefined;
  server.write.mockReturnValueOnce(
    new Promise<null>((resolve) => {
      finish = resolve;
    }),
  );
  renderCompanions();
  fireEvent.click(button('Add supporting source for Lord Varn'));
  fireEvent.change(field('Supporting source name'), {
    target: { value: 'Leadership feat' },
  });
  fireEvent.click(toggle('Arcane Bond'));
  const inWhisper = within(item('Companion Whisper'));
  expect(inWhisper.getByRole('status')).toHaveTextContent('Saving…');
  expect(toggle('Arcane Bond')).toBeDisabled();
  expect(button('Replace Companion Whisper')).toBeDisabled();
  const inLord = within(item('Associated Character Lord Varn'));
  expect(inLord.getByRole('switch', { name: 'Leadership' })).toBeEnabled();
  expect(inLord.getByRole('status')).toHaveTextContent('');
  expect(field('Supporting source name')).toHaveValue('Leadership feat');
  fireEvent.click(toggle('Arcane Bond'));
  expect(server.write).toHaveBeenCalledTimes(1);

  await act(async () => finish?.(null));
  expect(inWhisper.getByRole('status')).toHaveTextContent('Saved');
  expect(toggle('Arcane Bond')).toBeEnabled();
  expect(field('Supporting source name')).toHaveValue('Leadership feat');
});

test("another player's change is announced once and dismissed without resetting an open draft", () => {
  server.relationships = [whisper];
  const view = renderCompanions();
  fireEvent.click(button('Create Companion'));
  fireEvent.change(field('Name'), { target: { value: 'Pip' } });
  server.relationships = [
    {
      ...whisper,
      lastOperationId: 'other-player',
      status: 'interrupted',
      interruption: 'manual',
    },
  ];
  view.rerender();
  expect(
    screen.getAllByText('Companion Relationships updated by another player.'),
  ).toHaveLength(1);
  expect(field('Name')).toHaveValue('Pip');
  expect(
    screen.getByText(
      'This relationship was interrupted. Restore it when ready.',
    ),
  ).toBeVisible();
  fireEvent.click(button('Dismiss companions update'));
  expect(
    screen.queryByText('Companion Relationships updated by another player.'),
  ).toBeNull();
  expect(field('Name')).toHaveValue('Pip');
});

test('maintenance disables every writer with one reason while the sheet link stays; Escape and Cancel close without writing and return focus', () => {
  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  server.relationships = [whisper];
  const view = renderCompanions();
  for (const name of [
    'Link existing Character',
    'Create Companion',
    'Add supporting source for Whisper',
    'Replace Companion Whisper',
    'Interrupt relationship with Whisper',
  ]) {
    expect(button(name)).toBeDisabled();
    expect(button(name)).toHaveAccessibleDescription(message);
  }
  expect(toggle('Arcane Bond')).toBeDisabled();
  expect(screen.getAllByText(message)).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Whisper' })).toHaveAttribute(
    'href',
    '/characters/owl',
  );

  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  view.rerender();
  expect(screen.queryByText(message)).toBeNull();
  fireEvent.click(button('Create Companion'));
  fireEvent.keyDown(field('Name'), { key: 'Escape' });
  expect(screen.queryByRole('form')).toBeNull();
  expect(button('Create Companion')).toHaveFocus();
  fireEvent.click(button('Link existing Character'));
  fireEvent.click(button('Cancel Link existing Character'));
  expect(screen.queryByRole('form')).toBeNull();
  expect(button('Link existing Character')).toHaveFocus();
  expect(server.write).not.toHaveBeenCalled();
});

test('a relationship names the values it borrows beneath its row, sharing the one maintenance reason', () => {
  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  const level = { kind: 'characterLevel' } as const;
  server.relationships = [
    {
      ...whisper,
      linkedInputs: [{ input: level }],
    },
    lord,
  ];
  server.linkedInput = {
    input: level,
    status: 'unavailable',
    resolution: 'unresolved',
    value: null,
    fallback: null,
    fallbackState: 'none',
    candidates: [],
    contributions: [],
    prerequisiteStatus: 'unresolved',
    interpretation: null,
    revision: 1,
    lastOperationId: 'seed',
    updatedBy: null,
    sources: [],
    unavailableReason: 'interrupted',
  };
  renderCompanions();
  const linked = within(item('Companion Whisper')).getByRole('list', {
    name: 'Linked values',
  });
  expect(
    within(linked).getByRole('group', { name: 'Character level' }),
  ).toHaveTextContent('Unresolved');
  expect(
    within(item('Associated Character Lord Varn')).queryByRole('list', {
      name: 'Linked values',
    }),
  ).toBeNull();
  expect(button('Set fallback for Character level')).toBeDisabled();
  expect(
    button('Set fallback for Character level'),
  ).toHaveAccessibleDescription(message);
  expect(screen.getAllByText(message)).toHaveLength(1);
});

test("an animal Companion's progression follows the relationship it comes from; a cohort, a familiar or an outgoing animal companion shows none", () => {
  server.relationships = [{ ...lord, kind: 'animalCompanion' }];
  const view = renderCompanions();
  const progression = screen.getByRole('region', {
    name: 'Animal companion progression',
  });
  expect(
    within(progression).getByText('Choose an animal companion species.'),
  ).toBeVisible();
  expect(
    within(progression).getByRole('button', {
      name: 'Set up companion progression',
    }),
  ).toBeEnabled();
  const row = item('Associated Character Lord Varn');
  expect(within(row).queryByText('Animal companion progression')).toBeNull();
  expect(row.compareDocumentPosition(progression)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );

  server.relationships = [lord, whisper, ash];
  view.rerender();
  expect(
    screen.queryByRole('region', { name: 'Animal companion progression' }),
  ).toBeNull();
  expect(server.write).not.toHaveBeenCalled();
});

test('a cohort relationship shows its Leadership modifiers on the leader’s sheet; a familiar or an animal companion shows none', () => {
  server.relationships = [brynRelationship];
  const view = renderCompanions();
  const leadership = screen.getByRole('region', { name: 'Leadership' });
  const bryn = within(leadership).getByRole('listitem', { name: 'Bryn' });
  expect(within(bryn).getByText('None recorded')).toBeVisible();
  expect(
    within(bryn).getByRole('button', {
      name: 'Edit Leadership modifiers for Bryn',
    }),
  ).toBeEnabled();
  expect(item('Companion Bryn').compareDocumentPosition(leadership)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(screen.queryByRole('region', { name: 'Cohort' })).toBeNull();

  server.relationships = [whisper, ash, lord];
  view.rerender();
  expect(screen.queryByRole('region', { name: 'Leadership' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Cohort' })).toBeNull();
  expect(server.write).not.toHaveBeenCalled();
});

test('curated linked values remain editable when the associated Character and its sources are hidden', async () => {
  const input = {
    kind: 'classLevels',
    classRuleIdentity: 'class:wizard',
  } as const;
  server.relationships = [
    {
      ...lord,
      endpoint: null,
      sources: [],
      linkedInputs: [{ input, classLabel: 'Wizard' }],
    },
  ];
  server.linkedInput = {
    input,
    status: 'unavailable',
    resolution: 'unresolved',
    value: null,
    fallback: null,
    fallbackState: 'none',
    candidates: [],
    contributions: [],
    prerequisiteStatus: 'unresolved',
    interpretation: null,
    revision: 1,
    lastOperationId: null,
    updatedBy: null,
    sources: [],
    unavailableReason: 'inaccessible',
  };
  renderCompanions();
  const linked = screen.getByRole('group', { name: 'Wizard class levels' });
  expect(linked).toHaveTextContent('Unresolved');
  expect(linked).toHaveTextContent(
    'Wizard class levels is unavailable because the linked Character cannot be accessed.',
  );
  expect(screen.queryByText('Lord Varn')).toBeNull();
  expect(screen.queryByText('Leadership')).toBeNull();
  fireEvent.click(button('Set fallback for Wizard class levels'));
  fireEvent.change(field('Fallback for Wizard class levels'), {
    target: { value: '-3' },
  });
  await act(async () => fireEvent.click(button('Save fallback')));
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheetLinkedInputs:saveFallback',
    expect.objectContaining({ input, value: -3 }),
  );
});

// Phone below 768px, tablet above; reduced motion asked for at both.
function stubViewport(isWide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') || isWide,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

test.each([
  { isWide: false, label: 'phone' },
  { isWide: true, label: 'tablet' },
])(
  'on the $label every control is named once and touch-sized, and the cards hold still for reduced motion',
  ({ isWide }) => {
    stubViewport(isWide);
    server.relationships = [whisper, lord, ash];
    renderCompanions();
    for (const name of [
      'Link existing Character',
      'Create Companion',
      'Add supporting source for Whisper',
      'Replace Companion Whisper',
      'Interrupt relationship with Whisper',
      'Add supporting source for Lord Varn',
      'Reselect Companion Ash',
    ]) {
      const [control, ...duplicates] = screen.getAllByRole('button', { name });
      expect(duplicates).toHaveLength(0);
      expect(control).toBeEnabled();
      expect(control).toHaveClass('min-h-11');
    }
    expect(
      within(item('Companion Whisper')).getByRole('switch', {
        name: 'Arcane Bond',
      }),
    ).toHaveClass('min-h-11', 'md:min-h-7');
    expect(screen.getAllByRole('link', { name: 'Whisper' })).toHaveLength(1);

    fireEvent.click(button('Create Companion'));
    expect(field('Name')).toHaveClass('h-11', 'md:h-8');
    const card = radio('Familiar').closest('label');
    expect(card).toHaveClass(
      'min-h-11',
      'hover:-translate-y-0.5',
      'motion-reduce:transition-none',
      'motion-reduce:hover:translate-y-0',
    );
  },
);

// #326: the witch's Familiar collection belongs to the witch. Replacing or
// restoring its familiar writes only the relationship and leaves the
// collection, its count and its note exactly as they were.
const spellWrites = {
  record: vi.fn(),
  editLevel: vi.fn(),
  remove: vi.fn(),
  statusForSpell: () => ({ kind: 'idle' as const }),
  statusForEntry: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
function WitchHost({ snapshot }: { snapshot: CharacterSheetSnapshot }) {
  const controller = useCharacterCompanions(
    { characterId: snapshot.character._id },
    snapshot,
  );
  const view = buildCharacterSheetView(snapshot);
  return (
    <main>
      <CharacterCompanions
        controller={controller}
        warningController={warningControls}
        characterId={snapshot.character._id}
      />
      <BreakdownResolverProvider
        previewSituation={() => null}
        adjustments={[]}
        spellcastings={view.calculated.spellcastings}
      >
        <SpellcastingBlock
          characterName={snapshot.character.name}
          spellcastings={view.calculated.spellcastings}
          unresolved={view.calculated.spellcastingUnresolved}
          spells={{
            characterId: snapshot.character._id,
            collections: view.calculated.spellCollections,
            warnings: view.warnings,
            warningController: warningControls,
            writes: spellWrites,
          }}
        />
      </BreakdownResolverProvider>
    </main>
  );
}

test('replacing and restoring the witch’s familiar writes only the relationship; the witch keeps the same Familiar Spells, count and note, and an inaccessible familiar stays unlinked', async () => {
  const witch = buildSpellSheet({
    classes: ['witch'],
    recorded: [
      { id: 'row-detect', spell: spells.detectMagic, castingClassId: 'witch' },
      {
        id: 'row-cure',
        spell: spells.cureLightWounds,
        castingClassId: 'witch',
      },
    ],
  });
  const hidden = {
    ...whisper,
    relationshipId: 'rel-hidden' as Id<'companionRelationship'>,
    status: 'replaced',
    endpoint: null,
  } satisfies CompanionRelationship;
  server.relationships = [whisper, hidden];
  server.candidates = [
    { character: { ...witch.character, _id: 'cat', name: 'Pip' } },
  ];
  const view = render(<WitchHost snapshot={witch} />);
  const spellcasting = () =>
    within(screen.getByRole('region', { name: 'Spellcasting' }));
  const witchLine = () =>
    within(
      spellcasting()
        .getByRole('button', {
          name: 'View Witch spellcasting',
        })
        .closest('li') as HTMLElement,
    );
  const note =
    'Witch Spells stay with the witch through familiar replacement and restoration.';
  const expectCollectionKept = () => {
    expect(witchLine().getByText('Familiar')).toBeVisible();
    expect(witchLine().getByText('2 in familiar')).toBeVisible();
    expect(witchLine().getByText(note)).toBeVisible();
    expect(screen.getAllByText(note)).toHaveLength(1);
  };
  expectCollectionKept();
  expect(
    within(item('Companion Character unavailable')).queryByRole('link'),
  ).toBeNull();

  fireEvent.click(button('Replace Companion Whisper'));
  const replaceForm = within(item('Companion Whisper')).getByRole('form', {
    name: 'Replace Companion',
  });
  fireEvent.click(within(replaceForm).getByRole('radio', { name: 'Pip' }));
  fireEvent.click(
    within(replaceForm).getByRole('button', { name: 'Replace Companion' }),
  );
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()?.[0]).toBe('companionRelationships:replace');

  server.relationships = [
    { ...whisper, status: 'replaced' },
    {
      ...whisper,
      relationshipId: 'rel-pip' as Id<'companionRelationship'>,
      endpoint: { characterId: 'cat' as Id<'character'>, name: 'Pip' },
    },
    hidden,
  ];
  view.rerender(<WitchHost snapshot={witch} />);
  expectCollectionKept();
  fireEvent.click(button('Reselect Companion Whisper'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()?.[0]).toBe('companionRelationships:restore');
  expectCollectionKept();
  expect(
    server.write.mock.calls.every(([name]) =>
      String(name).startsWith('companionRelationships:'),
    ),
  ).toBe(true);
  expect(spellWrites.record).not.toHaveBeenCalled();
  expect(spellWrites.remove).not.toHaveBeenCalled();
  expect(
    within(screen.getByRole('region', { name: 'Companions' }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .sort(),
  ).toEqual(['/characters/cat', '/characters/owl']);
});

test('a familiar’s own sheet has no Familiar Spells collection of its own', () => {
  const owl = buildSheet({ name: 'Whisper', levels: [] });
  server.relationships = [{ ...lord, kind: 'familiar' }];
  render(<WitchHost snapshot={owl} />);
  expect(screen.getByText('Whisper has no Spellcasting.')).toBeVisible();
  expect(
    screen.queryByText(
      'Witch Spells stay with the witch through familiar replacement and restoration.',
    ),
  ).toBeNull();
  expect(screen.queryByRole('region', { name: 'Familiar' })).toBeNull();
});

// #421: the summoner's sheet offers its Synthesist Combined Form as a
// read-only view of both builds fused, linked to the separately built
// eidolon: a glance, one disclosure to the whole, each value naming its
// build, and nothing to edit or save.
const eidolonId = 'eidolon-id' as Id<'character'>;
type FusedContribution =
  CombinedFormRead['baseAttackBonus']['contributions'][number];
const fusedAbility = (
  name: CombinedFormRead['abilities'][number]['ability'],
  score: number | null,
  from: 'summoner' | 'eidolon',
  excluded: { label: string; value: number }[] = [],
): CombinedFormRead['abilities'][number] => ({
  ability: name,
  score,
  modifier: score === null ? null : Math.floor((score - 10) / 2),
  from,
  excluded,
});
const fusedStatistic = (
  total: number | null,
  contributions: FusedContribution[] = [],
) => ({ total, contributions });
const synthesistForm: CombinedFormRead = {
  status: 'calculated',
  summonerLevel: 1,
  unresolved: [],
  advisories: [],
  size: 'medium',
  eidolon: { characterId: eidolonId, name: 'Brightwing' },
  abilities: [
    fusedAbility('strength', 16, 'eidolon'),
    fusedAbility('dexterity', 12, 'eidolon'),
    fusedAbility('constitution', 13, 'eidolon'),
    fusedAbility('intelligence', 10, 'summoner'),
    fusedAbility('wisdom', 12, 'summoner'),
    fusedAbility('charisma', 16, 'summoner', [
      { label: 'Ability Increase evolution', value: 2 },
    ]),
  ],
  baseAttackBonus: {
    ...fusedStatistic(20, [
      { label: 'Fighter 19', value: 19, from: 'summoner' },
      { label: 'Eidolon BAB', value: 1, from: 'eidolon' },
    ]),
    replaced: [{ label: 'Summoner 1', value: 0 }],
  },
  hitPoints: { total: 180, temporary: 11 },
  armorClass: {
    ...fusedStatistic(14, [
      { label: 'Eidolon natural armor', value: 2, from: 'eidolon' },
    ]),
    touch: 11,
    flatFooted: 13,
  },
  saves: {
    fortitude: fusedStatistic(12),
    reflex: fusedStatistic(7),
    will: fusedStatistic(9),
  },
  combatManeuverBonus: 23,
  combatManeuverDefense: 34,
  initiative: 1,
  skills: [
    { skill: 'skill.per', name: 'Perception', total: 10, skilled: 8 },
    { skill: 'skill.ste', name: 'Stealth', total: 1, skilled: null },
  ],
  evolutions: {
    hitDice: 1,
    characterHitDice: 20,
    maxAttacks: 3,
    attackCount: 2,
    list: [
      { key: 'claws', name: 'Claws', choice: null },
      { key: 'skilled', name: 'Skilled', choice: 'skill.per' },
    ],
  },
  inputs: [
    {
      label: 'Summoner level',
      value: 1,
      resolution: 'calculated',
      fallbackState: 'none',
    },
  ],
  features: [],
  sources: [
    {
      title: 'Pathfinder RPG Ultimate Magic pp. 80–81, Synthesist',
      url: 'https://legacy.aonprd.com/ultimateMagic/spellcastingClassOptions/summoner.html#synthesist-(archetype)',
    },
    {
      title: 'Ultimate Magic FAQ: synthesist Hit Dice and BAB',
      url: 'https://paizo.com/paizo/faq/v5748nruor1fz#v5748eaic9obc',
    },
  ],
};
const unresolvedForm = (
  reason: CombinedFormRead['unresolved'][number]['reason'],
  message: string,
): CombinedFormRead => ({
  ...synthesistForm,
  status: 'unresolved',
  eidolon: null,
  unresolved: [{ reason, message }],
  size: null,
  abilities: [
    fusedAbility('strength', null, 'eidolon'),
    fusedAbility('dexterity', null, 'eidolon'),
    fusedAbility('constitution', null, 'eidolon'),
    fusedAbility('intelligence', 10, 'summoner'),
    fusedAbility('wisdom', 12, 'summoner'),
    fusedAbility('charisma', 16, 'summoner'),
  ],
  baseAttackBonus: { ...fusedStatistic(null), replaced: [] },
  hitPoints: { total: null, temporary: null },
  armorClass: { ...fusedStatistic(null), touch: null, flatFooted: null },
  saves: {
    fortitude: fusedStatistic(null),
    reflex: fusedStatistic(null),
    will: fusedStatistic(null),
  },
  combatManeuverBonus: null,
  combatManeuverDefense: null,
  initiative: null,
  skills: [],
  evolutions: {
    hitDice: null,
    characterHitDice: 20,
    maxAttacks: null,
    attackCount: 0,
    list: [],
  },
  inputs: [],
});
const eidolonUnavailable =
  'The eidolon is unavailable, so its fused statistics cannot be calculated.';
const combinedForm = () =>
  screen.getByRole('region', { name: 'Combined Form' });
const openCombinedForm = () => {
  const region = combinedForm();
  fireEvent.click(
    within(region).getByRole('button', { name: 'All combined statistics' }),
  );
  return region;
};
const statistic = (region: HTMLElement, name: string) =>
  within(region).getByRole('group', { name });
/** A view: its only controls are disclosures; nothing is a field or an action. */
function expectReadOnly(region: HTMLElement) {
  for (const control of within(region).getAllByRole('button'))
    expect(control).toHaveAttribute('aria-expanded');
  for (const role of ['textbox', 'switch', 'checkbox', 'radio', 'combobox'])
    expect(within(region).queryByRole(role)).toBeNull();
  expect(region).not.toHaveTextContent(/\b(Accept|Edit|Remove|Add)\b/);
  expect(region).not.toHaveTextContent(
    /synthesistEidolon|combinedForm|eidolonUnavailable|calculated on read|sync|stored/i,
  );
}

test('a Synthesist’s sheet shows its read-only Combined Form at a glance and in full, each value naming its build; other sheets show none', () => {
  const view = renderCompanions();
  expect(screen.queryByRole('region', { name: 'Combined Form' })).toBeNull();
  server.combinedForm = undefined;
  view.rerender();
  expect(screen.queryByRole('region', { name: 'Combined Form' })).toBeNull();

  server.combinedForm = synthesistForm;
  view.rerender();
  const region = combinedForm();
  expect(
    within(region).getByText(
      'A static view of the synthesist fused with the eidolon. Viewing it does not fuse them, track combat or change either sheet.',
    ),
  ).toBeVisible();
  expect(
    within(region).getByRole('link', { name: 'Brightwing' }),
  ).toHaveAttribute('href', '/characters/eidolon-id');
  expect(within(region).getByText('Size Medium')).toBeVisible();
  const glance = within(region).getByLabelText('Combined Form at a glance');
  expect(
    within(glance).getByRole('definition', { name: 'Base attack bonus' }),
  ).toHaveTextContent('+20');
  expect(
    within(glance).getByRole('definition', { name: 'Armor Class' }),
  ).toHaveTextContent('14');
  expect(
    within(glance).getByRole('definition', { name: 'Hit points' }),
  ).toHaveTextContent('180');
  expect(
    within(glance).getByRole('definition', { name: 'Temporary hit points' }),
  ).toHaveTextContent('11');
  expectReadOnly(region);

  const disclosure = within(region).getByRole('button', {
    name: 'All combined statistics',
  });
  expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  expect(
    within(region).queryByRole('group', { name: 'Base attack bonus' }),
  ).toBeNull();
  fireEvent.click(disclosure);
  expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  expect(
    within(region).queryByLabelText('Combined Form at a glance'),
  ).toBeNull();

  const bab = statistic(region, 'Base attack bonus');
  expect(within(bab).getByText('Replaces Summoner 1 (+0).')).toBeVisible();
  const breakdown = within(bab).getByRole('button', {
    name: 'Base attack bonus +20, breakdown',
  });
  expect(breakdown).toHaveAttribute('aria-expanded', 'false');
  expect(
    within(bab).queryByRole('list', { name: 'Base attack bonus breakdown' }),
  ).toBeNull();
  fireEvent.click(breakdown);
  expect(breakdown).toHaveAttribute('aria-expanded', 'true');
  const lines = within(
    within(bab).getByRole('list', { name: 'Base attack bonus breakdown' }),
  ).getAllByRole('listitem');
  expect(lines.map((line) => line.textContent)).toEqual([
    'Fighter 19Summoner+19',
    'Eidolon BABEidolon+1',
  ]);
  expect(
    within(statistic(region, 'Armor Class')).getByText(
      'Touch 11, flat-footed 13.',
    ),
  ).toBeVisible();
  expect(statistic(region, 'Hit points')).toHaveTextContent('180');
  expect(statistic(region, 'Temporary hit points')).toHaveTextContent('11');
  expect(statistic(region, 'Initiative')).toHaveTextContent('+1');
  expect(statistic(region, 'CMD')).toHaveTextContent('34');
  expect(
    within(region).getByText(
      'Evolution effects use the eidolon’s 1 Hit Die, not the summoner’s 20.',
    ),
  ).toBeVisible();
  expect(
    within(within(region).getByRole('list', { name: 'Evolutions' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Claws', 'Skilled (Perception)']);
  expect(
    within(region).getByRole('definition', { name: 'Natural attacks' }),
  ).toHaveTextContent('2 of 3');
  expect(
    within(region).getByText('Attacks while fused are not calculated.'),
  ).toBeVisible();
  const rules = within(
    within(region).getByRole('list', { name: 'Rules' }),
  ).getAllByRole('link');
  expect(rules.map((link) => link.getAttribute('href'))).toEqual(
    synthesistForm.sources.map((source) => source.url),
  );
  for (const link of rules) expect(link).toHaveAttribute('target', '_blank');
  expectReadOnly(region);
});

test('the Combined Form applies Skilled to the skill and leaves the eidolon’s mental increase out of the summoner’s score, saying so', () => {
  server.combinedForm = synthesistForm;
  renderCompanions();
  const region = openCombinedForm();
  const skills = within(within(region).getByRole('list', { name: 'Skills' }));
  const perception = skills.getByRole('listitem', { name: 'Perception' });
  expect(perception).toHaveTextContent('Skilled +8');
  expect(perception).toHaveTextContent('+10');
  expect(
    skills.getByRole('listitem', { name: 'Stealth' }),
  ).not.toHaveTextContent('Skilled');
  const abilities = within(
    within(region).getByRole('table', { name: 'Abilities' }),
  );
  expect(
    abilities.getByRole('columnheader', { name: 'Ability' }),
  ).toBeInTheDocument();
  const charisma = abilities.getByRole('row', { name: /Charisma/ });
  expect(charisma).toHaveTextContent(
    'Ability Increase evolution +2 (the eidolon’s, not applied)',
  );
  expect(charisma).toHaveTextContent('Score16');
  expect(charisma).toHaveTextContent('FromSummoner');
  expect(abilities.getByRole('row', { name: /Strength/ })).toHaveTextContent(
    'FromEidolon',
  );
  expect(
    abilities.getByRole('row', { name: /Strength/ }),
  ).not.toHaveTextContent('not applied');
});

test('a level 4 synthesist’s Armor Class shows the eidolon’s natural armor and Shielded Meld, never worn armor, and Shielded Meld among the features', () => {
  server.combinedForm = {
    ...synthesistForm,
    summonerLevel: 4,
    armorClass: {
      ...fusedStatistic(18, [
        { label: 'Eidolon natural armor', value: 4, from: 'eidolon' },
        { label: 'Shielded Meld', value: 2, from: 'eidolon' },
      ]),
      touch: 11,
      flatFooted: 16,
    },
    features: [
      {
        name: 'Shielded Meld',
        summary:
          'While fused, the synthesist gains a +2 shield bonus to Armor Class and a +2 circumstance bonus on saves.',
      },
    ],
  } satisfies CombinedFormRead;
  renderCompanions();
  const region = openCombinedForm();
  const ac = statistic(region, 'Armor Class');
  fireEvent.click(
    within(ac).getByRole('button', { name: 'Armor Class 18, breakdown' }),
  );
  expect(
    within(within(ac).getByRole('list', { name: 'Armor Class breakdown' }))
      .getAllByRole('listitem')
      .map((line) => line.textContent),
  ).toEqual(['Eidolon natural armorEidolon+4', 'Shielded MeldEidolon+2']);
  expect(within(ac).getByText('Touch 11, flat-footed 16.')).toBeVisible();
  const features = within(region).getByRole('list', { name: 'Features' });
  expect(
    within(features).getByRole('listitem', { name: 'Shielded Meld' }),
  ).toHaveTextContent('+2 shield bonus to Armor Class');
  expectReadOnly(region);
});

test('an eidolon smaller than the synthesist is an amber advisory beside a calculated form', () => {
  const advisory =
    'Fused Eidolon requires the eidolon to be at least the synthesist’s size; this eidolon is small and the synthesist medium.';
  server.combinedForm = {
    ...synthesistForm,
    size: 'small',
    advisories: [{ kind: 'eidolonSmallerThanSynthesist', message: advisory }],
  } satisfies CombinedFormRead;
  renderCompanions();
  const region = combinedForm();
  const line = within(region).getByText(advisory);
  expect(line).toBeVisible();
  expect(line.closest('li')).toHaveClass('text-amber-300');
  expect(within(region).getByText('Size Small')).toBeVisible();
  expect(
    within(
      within(region).getByLabelText('Combined Form at a glance'),
    ).getByRole('definition', { name: 'Base attack bonus' }),
  ).toHaveTextContent('+20');
  expectReadOnly(region);
});

test('an unresolved Combined Form says why, reads Unresolved rather than a number, keeps the summoner’s mental scores and names no inaccessible eidolon', () => {
  server.combinedForm = unresolvedForm(
    'eidolonUnavailable',
    eidolonUnavailable,
  );
  renderCompanions();
  const region = combinedForm();
  const reason = within(region).getByText(eidolonUnavailable);
  expect(reason).toBeVisible();
  expect(reason.closest('li')).toHaveClass('text-muted-foreground');
  expect(reason.closest('li')).not.toHaveClass('text-amber-300');
  expect(within(region).queryByRole('link')).toBeNull();
  expect(region).not.toHaveTextContent('Brightwing');
  expect(within(region).getByText('Size Unresolved')).toBeVisible();
  const glance = within(region).getByLabelText('Combined Form at a glance');
  expect(
    within(glance).getByRole('definition', { name: 'Base attack bonus' }),
  ).toHaveTextContent('Unresolved');
  expect(
    within(glance).getByRole('definition', { name: 'Temporary hit points' }),
  ).toHaveTextContent('Unresolved');

  openCombinedForm();
  const bab = statistic(region, 'Base attack bonus');
  expect(bab).toHaveTextContent('Unresolved');
  expect(within(bab).queryByRole('button')).toBeNull();
  expect(within(bab).getByText('Unresolved')).toHaveClass(
    'text-muted-foreground',
    'text-sm',
  );
  const statistics = within(region).getByRole('list', { name: 'Statistics' });
  expect(statistics).not.toHaveTextContent(/\b0\b/);
  const abilities = within(
    within(region).getByRole('table', { name: 'Abilities' }),
  );
  expect(abilities.getByRole('row', { name: /Strength/ })).toHaveTextContent(
    'ScoreUnresolved',
  );
  expect(
    abilities.getByRole('row', { name: /Intelligence/ }),
  ).toHaveTextContent('Score10');
  expect(abilities.getByRole('row', { name: /Charisma/ })).toHaveTextContent(
    'Modifier+3',
  );
  expect(
    within(region).getByText(
      'Evolution effects use the eidolon’s Hit Dice, which are unresolved.',
    ),
  ).toBeVisible();
  expectReadOnly(region);
});

test.each([
  {
    reason: 'eidolonProgressionUnresolved' as const,
    message:
      'Master Summoner and Synthesist each replace the eidolon with no published precedence, so its fused statistics cannot be calculated.',
  },
  {
    reason: 'unchainedSummoner' as const,
    message:
      'Synthesist is written for the original summoner; its Combined Form is not assumed for the Unchained summoner.',
  },
])(
  'the Combined Form states the rule that leaves it unresolved: $reason',
  ({ reason, message }) => {
    server.combinedForm = unresolvedForm(reason, message);
    renderCompanions();
    const region = combinedForm();
    expect(within(region).getByText(message)).toBeVisible();
    expect(region).not.toHaveTextContent(reason);
    expect(within(region).queryByRole('link')).toBeNull();
    expectReadOnly(region);
  },
);

test('a saved fallback shows beside the linked value it stands in for, with nothing to edit here', () => {
  server.combinedForm = {
    ...synthesistForm,
    summonerLevel: 4,
    inputs: [
      {
        label: 'Summoner level',
        value: 4,
        resolution: 'fallback',
        fallbackState: 'applied',
      },
    ],
  } satisfies CombinedFormRead;
  renderCompanions();
  const region = openCombinedForm();
  const linked = within(within(region).getByLabelText('Linked values'));
  expect(
    linked.getByRole('definition', { name: 'Summoner level' }),
  ).toHaveTextContent('4');
  expect(linked.getByText('Saved fallback in use')).toHaveClass('text-sky-300');
  expectReadOnly(region);
});

test('unrecorded eidolon hit points leave only the temporary hit points unresolved, explained beside them', () => {
  const message =
    'The eidolon’s hit points are not recorded, so its temporary hit points are unresolved.';
  server.combinedForm = {
    ...synthesistForm,
    unresolved: [{ reason: 'eidolonHitPoints', message }],
    hitPoints: { total: 180, temporary: null },
  } satisfies CombinedFormRead;
  renderCompanions();
  const region = combinedForm();
  const glance = within(region).getByLabelText('Combined Form at a glance');
  expect(within(glance).getByText(message)).toBeVisible();
  expect(
    within(glance).getByRole('definition', { name: 'Temporary hit points' }),
  ).toHaveTextContent('Unresolved');
  openCombinedForm();
  const temporary = statistic(region, 'Temporary hit points');
  expect(within(temporary).getByText(message)).toBeVisible();
  expect(within(temporary).getByText('Unresolved')).toBeVisible();
  expect(within(temporary).queryByRole('button')).toBeNull();
  expect(statistic(region, 'Base attack bonus')).toHaveTextContent('+20');
  expect(statistic(region, 'Hit points')).toHaveTextContent('180');
  expect(within(region).getAllByText(message)).toHaveLength(1);
});

// Phone below 768px; tablet landscape and desktop above.
function stubCombinedFormViewport(widthPx: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: widthPx,
    configurable: true,
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') || widthPx >= 768,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

test.each([
  { widthPx: 390, label: 'phone' },
  { widthPx: 1180, label: 'tablet' },
  { widthPx: 1440, label: 'desktop' },
])(
  'on the $label the Combined Form’s disclosures are keyboard-operable buttons, touch-sized, and its abilities stack as cards below 768px',
  ({ widthPx }) => {
    stubCombinedFormViewport(widthPx);
    server.combinedForm = synthesistForm;
    renderCompanions();
    const region = combinedForm();
    const disclosure = within(region).getByRole('button', {
      name: 'All combined statistics',
    });
    expect(disclosure).toHaveAttribute('type', 'button');
    expect(disclosure).toHaveClass('min-h-11', 'md:min-h-9');
    disclosure.focus();
    expect(disclosure).toHaveFocus();
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(
      disclosure.getAttribute('aria-controls') ?? '',
    );
    expect(panel).toContainElement(
      within(region).getByRole('list', { name: 'Statistics' }),
    );

    const table = within(region).getByRole('table', { name: 'Abilities' });
    expect(table).toHaveClass('max-md:block');
    expect(within(table).getByRole('row', { name: /Strength/ })).toHaveClass(
      'max-md:flex',
      'max-md:border',
    );

    const bab = statistic(region, 'Base attack bonus');
    const breakdown = within(bab).getByRole('button', {
      name: 'Base attack bonus +20, breakdown',
    });
    expect(breakdown).toHaveAttribute('type', 'button');
    expect(breakdown).toHaveClass('min-h-11', 'md:min-h-9');
    breakdown.focus();
    expect(breakdown).toHaveFocus();
    fireEvent.click(breakdown);
    expect(
      within(bab).getByRole('list', { name: 'Base attack bonus breakdown' }),
    ).toBeVisible();
    fireEvent.click(breakdown);
    expect(breakdown).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(bab).queryByRole('list', { name: 'Base attack bonus breakdown' }),
    ).toBeNull();

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(region).queryByRole('group', { name: 'Base attack bonus' }),
    ).toBeNull();
    expect(
      within(region).getByLabelText('Combined Form at a glance'),
    ).toBeVisible();
    expectReadOnly(region);
  },
);

test('a relationship a move separated (#711) moves under Former and interrupted with the access explanation, discloses nothing once unreachable, and returns to the current list when restored, all without losing an open draft', () => {
  server.relationships = [whisper];
  const view = renderCompanions();
  fireEvent.click(button('Create Companion'));
  fireEvent.change(field('Name'), { target: { value: 'Pip' } });

  server.relationships = [
    {
      ...whisper,
      status: 'interrupted',
      interruption: 'access',
      lastOperationId: 'group-move',
    },
  ];
  view.rerender();
  expect(
    screen.getByRole('heading', { name: 'Former and interrupted' }),
  ).toBeVisible();
  const separated = within(item('Companion Whisper'));
  expect(separated.getByText('Interrupted')).toBeVisible();
  expect(
    separated.getByText(
      'The Characters need a shared campaign or the same owner in private.',
    ),
  ).toBeVisible();
  expect(separated.getByRole('link', { name: 'Whisper' })).toHaveAttribute(
    'href',
    characterSheetPath('owl' as Id<'character'>),
  );
  expect(
    separated.getByRole('button', { name: 'Restore relationship Whisper' }),
  ).toBeEnabled();
  expect(
    screen.getAllByText('Companion Relationships updated by another player.'),
  ).toHaveLength(1);
  expect(field('Name')).toHaveValue('Pip');
  expect(document.body.textContent).not.toMatch(/group-move|generation/);

  // Its endpoint out of reach: unavailable, with no status, link or name.
  server.relationships = [
    {
      ...whisper,
      status: undefined,
      endpoint: null,
      lastOperationId: undefined,
    },
  ];
  view.rerender();
  const unreachable = item('Companion Character unavailable');
  expect(unreachable).toHaveTextContent('Unavailable');
  expect(unreachable).toHaveTextContent(
    'This Character is not available to you.',
  );
  expect(within(unreachable).queryByRole('link')).toBeNull();
  expect(
    within(unreachable).queryByRole('button', { name: /Restore/ }),
  ).toBeNull();
  expect(document.body.textContent).not.toContain('Whisper');
  expect(document.body.innerHTML).not.toMatch(/owl|Interrupted/);
  expect(field('Name')).toHaveValue('Pip');

  // Compatible placement again: the same Companion is active once more.
  server.relationships = [{ ...whisper, lastOperationId: 'group-restore' }];
  view.rerender();
  expect(
    screen.queryByRole('heading', { name: 'Former and interrupted' }),
  ).toBeNull();
  const restored = within(item('Companion Whisper'));
  expect(restored.getByText('Active')).toBeVisible();
  expect(restored.getByRole('link', { name: 'Whisper' })).toBeVisible();
  expect(field('Name')).toHaveValue('Pip');
  expect(server.write).not.toHaveBeenCalled();
});
