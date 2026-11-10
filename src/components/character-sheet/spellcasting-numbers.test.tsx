import { cleanup, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { buildCastingSheet } from './casting-features-test-fixture';
import { buildSpellcastingFeaturesView } from './spellcasting-features-view-model';
import { SpellcastingNumbers } from './spellcasting-numbers';
import type { Spellcasting } from './spellcasting-parts';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The Spells page numbers (#415): how Casting advances make the casting
// level, the specialist school with its opposition schools as a read-only
// summary pointing at the Arcane School class feature, and the extra slot a
// domain or school adds.

const repeat = (identity: string, count: number) =>
  Array.from({ length: count }, () => identity);
const fire = {
  id: 'fire',
  catalogEntryId: 'domain-fire',
  classIdentity: 'cleric',
  feature: 'cleric-domains',
  list: 'Domains',
};
const evocation = (oppositionSchools?: string[]) => ({
  id: 'evocation',
  catalogEntryId: 'school-evocation',
  classIdentity: 'wizard',
  feature: 'wizard-arcane-school',
  list: 'Arcane schools',
  ...(oppositionSchools ? { oppositionSchools } : {}),
});

function renderNumbers(snapshot: CharacterSheetSnapshot, classEntryId: string) {
  const casting = snapshot.calculated.spellcastings.find(
    (candidate) => candidate.classEntryId === classEntryId,
  );
  if (!casting) throw new Error(`Expected a ${classEntryId} Spellcasting`);
  render(
    <BreakdownResolverProvider
      previewSituation={() => null}
      adjustments={[]}
      spellcastings={snapshot.calculated.spellcastings}
    >
      <SpellcastingNumbers
        casting={casting}
        features={buildSpellcastingFeaturesView(snapshot, classEntryId)}
      />
    </BreakdownResolverProvider>,
  );
  return within(
    screen.getByRole('region', { name: `${casting.name} spellcasting` }),
  );
}
const figure = (label: string) =>
  screen.getByText(label).nextElementSibling as HTMLElement;

/** One Spellcasting's numbers alone, for a calculated state a choice leaves. */
function renderCasting(casting: Spellcasting) {
  render(
    <BreakdownResolverProvider
      previewSituation={() => null}
      adjustments={[]}
      spellcastings={[casting]}
    >
      <SpellcastingNumbers casting={casting} />
    </BreakdownResolverProvider>,
  );
  return within(
    screen.getByRole('region', { name: `${casting.name} spellcasting` }),
  );
}
const figureTextOf = (casting: Spellcasting, label: string) => {
  renderCasting(casting);
  return figure(label).textContent;
};

test('a cleric advanced by Mystic Theurge states how its casting level adds up and the domain’s extra slot, with no School row', () => {
  const numbers = renderNumbers(
    buildCastingSheet({
      levels: [
        ...repeat('wizard', 3),
        ...repeat('cleric', 3),
        ...repeat('mystic-theurge', 2),
      ],
      selections: [fire],
    }),
    'cleric',
  );
  expect(figure('Casting level')).toHaveTextContent('5');
  expect(figure('Caster level')).toHaveTextContent(
    'casting level 5 = Cleric 3 +2 from Mystic Theurge',
  );
  expect(figure('Extra slot')).toHaveTextContent('+1 domainper level from 1st');
  expect(numbers.queryByText('School')).not.toBeInTheDocument();
  expect(numbers.queryByText(/advances? waits? until/)).not.toBeInTheDocument();
  // The per-day column shows the domain slot in each level's composition.
  const first = numbers.getByRole('rowheader', { name: '1st' }).closest('tr')!;
  expect(within(first).getByText('3 base + 1 extra')).toBeVisible();
});

test('a specialist’s School row names its opposition schools without an editor and says they are set on the Arcane School class feature; a plain wizard has no casting sum', () => {
  const numbers = renderNumbers(
    buildCastingSheet({
      levels: ['wizard'],
      selections: [evocation(['enc', 'nec'])],
    }),
    'wizard',
  );
  expect(figure('Caster level')).not.toHaveTextContent('casting level');
  expect(figure('School')).toHaveTextContent('Evocation');
  const summary = numbers.getByText('opposition Enchantment and Necromancy');
  expect(summary).not.toHaveClass('ring-sky-400/80');
  const school = within(figure('School'));
  expect(
    school.getByText('Set on the Arcane School class feature.'),
  ).toBeVisible();
  expect(school.queryByRole('button')).toBeNull();
  expect(numbers.queryByRole('group')).toBeNull();
  expect(figure('Extra slot')).toHaveTextContent('+1 school (evocation)');
});

test('a specialist without opposition schools shows the outlined prompt in place of them and points at the class feature, with nothing to open', () => {
  const numbers = renderNumbers(
    buildCastingSheet({ levels: ['wizard'], selections: [evocation()] }),
    'wizard',
  );
  const prompt = numbers.getByText('choose two opposition schools');
  expect(prompt).toHaveClass('ring-sky-400/80');
  expect(prompt).toHaveClass('text-sky-300');
  const school = within(figure('School'));
  expect(
    school.getByText('Choose them on the Arcane School class feature.'),
  ).toBeVisible();
  expect(school.queryByRole('button')).toBeNull();
  expect(numbers.queryByRole('group')).toBeNull();
  expect(
    numbers.queryByText('Choose two opposition schools for Evocation.'),
  ).toBeNull();
});

// #422: the numbers say where an Archetype's change comes from, and what an
// open choice leaves waiting. Seducer (LotFW) on a witch, Eldritch Scion (ACG
// p. 104) against Mindblade (OA p. 121) on a magus, Questioner (MTT p. 26)
// against Psychic Detective (OA p. 119) on an investigator.
const figureText = (label: string) => figure(label).textContent;

test('a Seducer witch names Charisma from Seducer; an Eldritch Scion magus names its sole Charisma; a restated ability names no source; a chosen list says so', () => {
  renderNumbers(
    buildCastingSheet({
      levels: repeat('witch', 3),
      archetypes: [{ key: 'witch-seducer' }],
    }),
    'witch',
  );
  expect(figureText('Casting ability')).toBe(
    'Charismafrom SeducerBonus spells use permanent Charisma.',
  );
  expect(figureText('Preparation')).toBe('Prepared, familiar');
  expect(screen.queryByText('Spell list')).toBeNull();
  cleanup();

  renderNumbers(
    buildCastingSheet({
      levels: repeat('magus', 4),
      scores: { intelligence: 12, charisma: 16 },
      archetypes: [{ key: 'magus-eldritch-scion' }, { key: 'magus-mindblade' }],
    }),
    'magus',
  );
  expect(figureText('Casting ability')).toBe(
    'Charismafrom Eldritch ScionBonus spells use permanent Charisma.',
  );
  expect(figureText('Preparation')).toBe(
    'Spontaneous, spells knownfrom Eldritch Scion and Mindblade',
  );
  cleanup();

  renderNumbers(
    buildCastingSheet({
      levels: repeat('investigator', 7),
      scores: { intelligence: 16 },
      archetypes: [
        { key: 'investigator-questioner', choices: ['spellList'] },
        { key: 'investigator-psychic-detective' },
      ],
    }),
    'investigator',
  );
  expect(figureText('Casting ability')).toBe(
    'IntelligenceBonus spells use permanent Intelligence.',
  );
  expect(figureText('Spell list')).toBe(
    'Bard listfrom Questioner (your choice)',
  );
});

test('a list that waits for a choice says so, and a spellcasting choice leaves the ability, preparation and numbers waiting without a base value or a bonus-spell note', () => {
  const snapshot = buildCastingSheet({
    levels: repeat('investigator', 7),
    scores: { intelligence: 16 },
    archetypes: [
      { key: 'investigator-questioner' },
      { key: 'investigator-psychic-detective' },
    ],
  });
  const casting = snapshot.calculated.spellcastings.find(
    (row) => row.classEntryId === 'investigator',
  );
  if (!casting) throw new Error('Expected the Investigator Spellcasting');
  expect(figureTextOf(casting, 'Spell list')).toBe('Waiting for a choice');
  cleanup();

  // Skirmisher (APG p. 128) against Dandy (UI p. 41): spellcasting itself
  // waits, so the ability, preparation and numbers wait with it.
  const ranger = buildCastingSheet({
    levels: repeat('ranger', 8),
    scores: { wisdom: 12, charisma: 14 },
    archetypes: [{ key: 'ranger-skirmisher' }, { key: 'ranger-dandy' }],
  }).calculated.spellcastings.find((row) => row.classEntryId === 'ranger');
  if (!ranger) throw new Error('Expected the Ranger Spellcasting');
  const numbers = renderCasting(ranger);
  expect(figureText('Casting ability')).toBe('Waiting for a choice');
  expect(figureText('Preparation')).toBe('Waiting for a choice');
  expect(figureText('Caster level')).toBe('Waiting for a spellcasting choice');
  expect(numbers.queryByRole('table')).toBeNull();
  expect(numbers.queryByText(/Bonus spells/)).toBeNull();
  expect(numbers.queryByText(/—/)).toBeNull();
});
