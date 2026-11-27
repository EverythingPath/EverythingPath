import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { buildCastingSheet } from './casting-features-test-fixture';
import { GrantedSpells } from './granted-spells';
import { buildSpellcastingFeaturesView } from './spellcasting-features-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useSpellDescriptionExpansion } from './use-spell-description-expansion';

// Granted Spells (#415): domain and bloodline Spells by level, each with a
// granted chip naming every source, never recorded and never removable; a
// domain Spell off the class list fits the domain slot only.

const repeat = (identity: string, count: number) =>
  Array.from({ length: count }, () => identity);
const domain = (id: string) => ({
  id,
  catalogEntryId: `domain-${id}`,
  classIdentity: 'cleric',
  feature: 'cleric-domains',
  list: 'Domains',
});
const draconic = {
  id: 'draconic',
  catalogEntryId: 'bloodline-draconic',
  classIdentity: 'sorcerer',
  feature: 'sorcerer-bloodline',
  list: 'Bloodlines',
};

function Harness({
  snapshot,
  classEntryId,
}: {
  snapshot: CharacterSheetSnapshot;
  classEntryId: string;
}) {
  const descriptions = useSpellDescriptionExpansion(classEntryId);
  const features = buildSpellcastingFeaturesView(snapshot, classEntryId);
  return (
    <GrantedSpells
      groups={features?.grantedSpellsByLevel ?? []}
      descriptions={descriptions}
    />
  );
}
const renderGranted = (
  snapshot: CharacterSheetSnapshot,
  classEntryId: string,
) => render(<Harness snapshot={snapshot} classEntryId={classEntryId} />);
const group = () => screen.getByRole('region', { name: 'Granted Spells' });
const rowOf = (name: string) =>
  within(within(group()).getByRole('button', { name }).closest('li')!);

test('a cleric with Fire and Sun lists their Spells by level with their domain; only the Spell off the cleric list says domain slot only, and nothing can be recorded or removed', () => {
  renderGranted(
    buildCastingSheet({
      levels: repeat('cleric', 3),
      selections: [domain('fire'), domain('sun')],
    }),
    'cleric',
  );
  expect(group()).toHaveTextContent('4 granted');
  expect(
    within(group())
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(['1st-level2 granted', '2nd-level2 granted']);
  const burningHands = rowOf('Burning Hands');
  expect(burningHands.getByText('granted · Fire Domain')).toHaveAttribute(
    'title',
    'Granted by Fire Domain: always available, never recorded.',
  );
  expect(burningHands.getByText('domain slot only')).toHaveAttribute(
    'title',
    'Not on the class list: prepared only in the domain slot.',
  );
  const endureElements = rowOf('Endure Elements');
  expect(endureElements.getByText('granted · Sun Domain')).toBeVisible();
  expect(endureElements.queryByText('domain slot only')).toBeNull();
  expect(within(group()).queryByRole('checkbox')).toBeNull();
  expect(within(group()).queryByRole('button', { name: /Remove/ })).toBeNull();
  expect(within(group()).queryByText(/Fireball/)).toBeNull();
});

test('on the phone a tap on the name opens the Spell’s description beneath it and another tap closes it', () => {
  renderGranted(
    buildCastingSheet({
      levels: repeat('cleric', 3),
      selections: [domain('fire')],
    }),
    'cleric',
  );
  const name = within(group()).getByRole('button', { name: 'Burning Hands' });
  expect(name).toHaveAttribute('aria-expanded', 'false');
  expect(within(group()).queryByText('Evocation')).toBeNull();
  fireEvent.click(name);
  expect(name).toHaveAttribute('aria-expanded', 'true');
  const panel = document.getElementById(name.getAttribute('aria-controls')!);
  expect(panel).toHaveTextContent('Evocation');
  expect(
    within(group()).getByRole('button', { name: 'Produce Flame' }),
  ).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(name);
  expect(name).toHaveAttribute('aria-expanded', 'false');
});

test('a bloodline’s Spells arrive at their sorcerer level, never before', () => {
  const view = renderGranted(
    buildCastingSheet({
      levels: repeat('sorcerer', 2),
      selections: [draconic],
    }),
    'sorcerer',
  );
  expect(
    screen.queryByRole('region', { name: 'Granted Spells' }),
  ).not.toBeInTheDocument();
  view.rerender(
    <Harness
      snapshot={buildCastingSheet({
        levels: repeat('sorcerer', 3),
        selections: [draconic],
      })}
      classEntryId="sorcerer"
    />,
  );
  expect(group()).toHaveTextContent('1 granted');
  expect(
    rowOf('Mage Armor').getByText('granted · Draconic Bloodline'),
  ).toBeVisible();
  expect(rowOf('Mage Armor').queryByText('domain slot only')).toBeNull();
});

test('a Spell two domains grant at one level names both on its chip', () => {
  renderGranted(
    buildCastingSheet({
      levels: repeat('cleric', 11),
      selections: [domain('fire'), domain('sun')],
    }),
    'cleric',
  );
  const fireSeeds = rowOf('Fire Seeds');
  expect(
    fireSeeds.getByText('granted · Fire Domain, Sun Domain'),
  ).toHaveAttribute(
    'title',
    'Granted by Fire Domain and Sun Domain: always available, never recorded.',
  );
  expect(fireSeeds.queryByText('granted · Fire Domain')).toBeNull();
  expect(rowOf('Flame Strike').getByText('granted · Sun Domain')).toBeVisible();
});
