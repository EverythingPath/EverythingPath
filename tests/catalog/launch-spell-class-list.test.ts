// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  classListCollectionPath,
  launchMechanismProofs,
  type NamedMechanismProof,
  type SpellCollectionPath,
} from '../../scripts/catalog/launch-mechanism-proofs';
import {
  defaultCastingTables,
  findCastingTableRow,
  MAX_LEVEL,
} from '../../src/lib/character-sheet-casting-tables';
import { castableLevels } from '../../src/lib/character-sheet-spellcasting';
import {
  classListProofCastings,
  classListProofSpells,
  type ClassListProofCasting,
  type ClassListProofHeading,
} from '../spell-class-list-proof';

// The coverage tie: everything the spell class-list scope certifies is a
// shape its public proof exercises. The proof
// (`convex/characterSheetSpellClassList.integration.test.ts`) browses,
// records and counts its fixture's Spells (`tests/spell-class-list-proof.ts`,
// bound by bytes in the registry entry beside the test) for each casting the
// fixture lists, at each spell level the casting casts, so the certified set
// must be a subset of what that fixture holds.
//
// The scope certifies (collection path, spell level) pairs, and reads a
// Spell's path from the class on its list (`classListCollectionPath`), so it
// also certifies each class with a reviewed casting at each level of its
// path that its reviewed table casts at 20th level. A level the class never
// casts is no shape a saved sheet can reach, and no real list names one.

type Collections = NonNullable<
  NonNullable<NamedMechanismProof['scope']>['collections']
>;
const family = launchMechanismProofs.find(
  (proof): proof is NamedMechanismProof =>
    'mechanism' in proof && proof.family === 'spell-class-list',
);
const collections = (): Collections => {
  const found = family?.scope?.collections;
  if (!found) throw new Error('Missing the spell class-list scope');
  return found;
};

const headingPaths: Record<
  NonNullable<ClassListProofHeading>,
  SpellCollectionPath
> = {
  Spellbook: 'book',
  'Spells known': 'known',
  Familiar: 'familiar',
  'Formula book': 'formula',
};
const pathOf = (heading: ClassListProofHeading) =>
  heading === null ? 'whole-list' : headingPaths[heading];

type Spell = (typeof classListProofSpells)[number];

/**
 * What the public fixture exercises, in the tie's words: each casting's
 * path (read from the heading the proof records under) at each level it
 * casts, and the class at that level, where the level's Spell lists the
 * class at that level.
 */
function exercised(
  castings: readonly ClassListProofCasting[],
  spells: readonly Spell[],
) {
  const words = new Set<string>();
  for (const { classTag, heading, spellLevels } of castings)
    for (const level of spellLevels) {
      const listed = spells.some(
        ({ detail }) =>
          Object.hasOwn(detail.levels, classTag) &&
          detail.levels[classTag] === level,
      );
      if (!listed) continue;
      words.add(`pair ${pathOf(heading)} ${level}`);
      words.add(`class ${classTag} ${level}`);
    }
  return words;
}

/** A reviewed casting's castable spell levels at 20th level. */
function castableAtTwenty(classTag: string) {
  const casting = defaultCastingTables.classes[classTag];
  if (!casting) return [];
  return castableLevels(
    casting,
    findCastingTableRow(casting.table, MAX_LEVEL, defaultCastingTables),
    defaultCastingTables,
  );
}

/** What the scope certifies, in the same words. */
function certified(scope: Collections) {
  const words = new Set<string>();
  for (const { path, levels } of scope)
    for (const level of levels) words.add(`pair ${path} ${level}`);
  for (const classTag of Object.keys(defaultCastingTables.classes)) {
    const path = classListCollectionPath(classTag);
    const levels = scope.find((pair) => pair.path === path)?.levels ?? [];
    for (const level of castableAtTwenty(classTag))
      if (levels.includes(level)) words.add(`class ${classTag} ${level}`);
  }
  return words;
}

/** What the scope certifies that the public fixture does not exercise. */
function uncovered(
  scope: Collections = collections(),
  castings: readonly ClassListProofCasting[] = classListProofCastings,
  spells: readonly Spell[] = classListProofSpells,
) {
  const released = exercised(castings, spells);
  return [...certified(scope)].filter((word) => !released.has(word)).sort();
}

const withLevels = (path: SpellCollectionPath, levels: number[]) =>
  collections().map((pair) => (pair.path === path ? { path, levels } : pair));
const castingsWith = (
  classTag: string,
  change: (casting: ClassListProofCasting) => ClassListProofCasting | null,
) =>
  classListProofCastings.flatMap((casting) => {
    if (casting.classTag !== classTag) return [casting];
    const changed = change(casting);
    return changed ? [changed] : [];
  });

describe('the spell class-list scope’s coverage tie to its public proof', () => {
  it('certifies only (path, level) pairs and (class, level) shapes the public fixture exercises', () => {
    expect(uncovered()).toEqual([]);
    // The fixture names the public proof's test, and the entry binds both.
    expect(family?.tests.map(({ path }) => path)).toEqual([
      'convex/characterSheetSpellClassList.integration.test.ts',
      'tests/spell-class-list-proof.ts',
    ]);
  });

  it('reports a scratch scope’s pair no fixture casting exercises', () => {
    // Extracts stop at 6th level, so no formula casting reaches 7th to 9th.
    expect(
      uncovered(withLevels('formula', [1, 2, 3, 4, 5, 6, 7, 8, 9])),
    ).toEqual(['pair formula 7', 'pair formula 8', 'pair formula 9']);
    // Level 0 on the formula path: no class casts it, so only the pair.
    expect(uncovered(withLevels('formula', [0, 1, 2, 3, 4, 5, 6]))).toEqual([
      'pair formula 0',
    ]);
  });

  it('reports a class or level the fixture drops', () => {
    // Without the Bard, every Bard level is uncovered; its pairs stay
    // covered by the other spontaneous casters.
    expect(
      uncovered(
        collections(),
        castingsWith('bard', () => null),
      ),
    ).toEqual([0, 1, 2, 3, 4, 5, 6].map((level) => `class bard ${level}`));
    // A Witch that stops short of 9th level leaves the familiar path's 9th.
    expect(
      uncovered(
        collections(),
        castingsWith('witch', (casting) => ({
          ...casting,
          spellLevels: casting.spellLevels.filter((level) => level < 9),
        })),
      ),
    ).toEqual(['class witch 9', 'pair familiar 9']);
    // A level's Spell that leaves a class off its list exercises nothing for it.
    expect(
      uncovered(
        collections(),
        classListProofCastings,
        classListProofSpells.map((spell) => {
          if (spell.externalKey !== 'pf1/classListProofLevel5') return spell;
          const { bard: _bard, ...levels } = spell.detail.levels;
          return { ...spell, detail: { ...spell.detail, levels } };
        }),
      ),
    ).toEqual(['class bard 5']);
  });

  it('lists every reviewed casting class once, at the levels its reviewed table casts at 20th level', () => {
    expect(
      classListProofCastings.map(({ classTag }) => classTag).sort(),
    ).toEqual(Object.keys(defaultCastingTables.classes).sort());
    for (const { classTag, heading, spellLevels } of classListProofCastings) {
      expect(spellLevels, classTag).toEqual(castableAtTwenty(classTag));
      expect(pathOf(heading), classTag).toBe(classListCollectionPath(classTag));
    }
  });
});
