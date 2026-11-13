import type { DefaultTreeAdapterMap } from 'parse5';
import { describe, expect, it } from 'vitest';
import {
  findCastingTableRow,
  findReviewedClassCasting,
} from './character-sheet-casting-tables';

describe('reviewed casting tables', () => {
  it('reads wizard base slots without school slots at first and twentieth casting level', () => {
    // CRB Table 3–16, p. 80; OGL Spell Tables journal, Wizard.
    expect(findCastingTableRow('prepared-full', 1)?.spellsPerDay).toEqual([
      3,
      1,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(findCastingTableRow('prepared-full', 20)?.spellsPerDay).toEqual([
      4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    ]);
  });
  it('supplies prepared-medium through twentieth level from Magus', () => {
    // Pathfinder RPG Ultimate Magic, p. 13; OGL Spell Tables journal, Magus.
    expect(findCastingTableRow('prepared-medium', 20)?.spellsPerDay).toEqual([
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      null,
      null,
      null,
    ]);
  });
  it('supplies prepared-low through twentieth level from Paladin', () => {
    // Pathfinder RPG Core Rulebook, p. 63; OGL Spell Tables journal, Paladin.
    expect(findCastingTableRow('prepared-low', 20)?.spellsPerDay).toEqual([
      null,
      4,
      4,
      3,
      3,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
  it('supplies spontaneous-full through twentieth level from Sorcerer', () => {
    // Pathfinder RPG Core Rulebook, p. 73; OGL Spell Tables journal, Sorcerer.
    expect(findCastingTableRow('spontaneous-full', 20)?.spellsPerDay).toEqual([
      null,
      6,
      6,
      6,
      6,
      6,
      6,
      6,
      6,
      6,
    ]);
  });
  it('supplies spontaneous-medium through twentieth level from Hunter', () => {
    // Pathfinder RPG Advanced Class Guide, p. 27; OGL Spell Tables journal, Hunter.
    expect(findCastingTableRow('spontaneous-medium', 20)?.spellsPerDay).toEqual([
      null,
      5,
      5,
      5,
      5,
      5,
      5,
      null,
      null,
      null,
    ]);
  });
  it('supplies spontaneous-low through twentieth level from Medium', () => {
    // Pathfinder RPG Occult Adventures, p. 31; OGL Spell Tables journal, Medium (source heading misspelled "Mediuum").
    expect(findCastingTableRow('spontaneous-low', 20)?.spellsPerDay).toEqual([
      null,
      4,
      4,
      3,
      2,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
  it('supplies hybrid-full through twentieth level from Arcanist', () => {
    // Pathfinder RPG Advanced Class Guide, p. 9; OGL Spell Tables journal, Arcanist.
    expect(findCastingTableRow('hybrid-full', 20)?.spellsPerDay).toEqual([
      null,
      4,
      4,
      4,
      4,
      4,
      4,
      4,
      4,
      4,
    ]);
  });
  it('uses the adept class table instead of an inappropriate shared table', () => {
    // Pathfinder RPG Core Rulebook p. 448.
    expect(findCastingTableRow('adept', 4)?.spellsPerDay).toEqual([
      3,
      2,
      0,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
  it('uses the extracts class table instead of an inappropriate shared table', () => {
    // Pathfinder RPG Advanced Player’s Guide p. 26; Pathfinder RPG Advanced Class Guide p. 30.
    expect(findCastingTableRow('extracts', 20)?.spellsPerDay).toEqual([
      null,
      5,
      5,
      5,
      5,
      5,
      5,
      null,
      null,
      null,
    ]);
  });
  it('uses the unchained-summoner class table instead of an inappropriate shared table', () => {
    // Pathfinder RPG Pathfinder Unchained p. 25.
    expect(findCastingTableRow('unchained-summoner', 20)?.spellsPerDay).toEqual([
      null,
      5,
      5,
      5,
      5,
      5,
      5,
      null,
      null,
      null,
    ]);
  });
  it('uses the occultist class table instead of an inappropriate shared table', () => {
    // Pathfinder RPG Occult Adventures p. 47.
    expect(findCastingTableRow('occultist', 20)?.spellsPerDay).toEqual([
      null,
      5,
      5,
      5,
      5,
      5,
      5,
      null,
      null,
      null,
    ]);
  });
  it('completes class records and offsets from the reviewed class rules', () => {
    // CRB pp. 38, 60, 77; ACG pp. 8, 15; PU p. 25.
    expect(findReviewedClassCasting('wizard')).toMatchObject({
      classTag: 'wizard',
      ability: 'intelligence',
      record: 'book',
      table: 'prepared-full',
    });
    expect(findReviewedClassCasting('cleric')).toMatchObject({
      ability: 'wisdom',
      record: 'none',
    });
    expect(findReviewedClassCasting('paladin')?.casterLevelOffset).toBe(-3);
    expect(findReviewedClassCasting('bloodrager')?.casterLevelOffset).toBe(0);
    expect(findReviewedClassCasting('arcanist')?.record).toBe('book');
    expect(findReviewedClassCasting('summonerUnchained')?.table).toBe(
      'unchained-summoner',
    );
    expect(findReviewedClassCasting('alchemist')?.cantrips).toBe(false);
    expect(findReviewedClassCasting('constructor')).toBeUndefined();
    expect(findReviewedClassCasting('fighter')).toBeUndefined();
  });
});

// These fixtures retain source cells rather than calculator output. Their
// provenance names the OGL journal and the independently reviewed book tables.
describe('casting table source cross-check', () => {
  it('matches every casting cell through level twenty in the OGL journal', async () => {
    const { parseFragment } = await import('parse5');
    const { default: evidence } =
      await import('../../tests/fixtures/catalog/spellcasting/ogl-journal-tables.json');
    type Node = DefaultTreeAdapterMap['node'];
    const nodeText = (node: Node): string =>
      'value' in node
        ? node.value
        : 'childNodes' in node
          ? node.childNodes.map(nodeText).join('')
          : '';
    const descendants = (node: Node, tag: string): Node[] => [
      ...('tagName' in node && node.tagName === tag ? [node] : []),
      ...('childNodes' in node
        ? node.childNodes.flatMap((child) => descendants(child, tag))
        : []),
    ];
    for (const source of evidence.tables) {
      // The journal accidentally repeats Bard's per-day table. Hunter and
      // Summoner independently cover all cells of its shared known table.
      if (source.className === 'Bard' && source.tableIndex === 1) continue;
      const classTag =
        source.className === 'Mediuum'
          ? 'medium'
          : source.className.toLowerCase();
      const casting = findReviewedClassCasting(classTag);
      expect(casting, source.className).toBeDefined();
      if (!casting) throw new Error(`Missing casting metadata: ${classTag}`);
      const rows = parseFragment(source.html).childNodes.flatMap((node) =>
        descendants(node, 'tr'),
      );
      const header = rows[0];
      if (!header) throw new Error('Missing source headers');
      const columns = descendants(header, 'th')
        .slice(1)
        .map((node) => Number.parseInt(nodeText(node)));
      expect(rows.slice(1), source.className).toHaveLength(20);
      for (const [index, sourceRow] of rows.slice(1).entries()) {
        const row = findCastingTableRow(casting.table, index + 1);
        const field =
          source.tableIndex === 0
            ? 'spellsPerDay'
            : classTag === 'arcanist'
              ? 'preparedPerDay'
              : 'spellsKnown';
        const actual = row?.[field];
        const cells = descendants(sourceRow, 'td').slice(1);
        for (const [cellIndex, cell] of cells.entries()) {
          const level = columns[cellIndex];
          if (level === undefined) throw new Error('Missing spell level');
          const printed = nodeText(cell);
          // Domain +1 is a class-feature slot, separate from the base table.
          const expected = /^\d/.test(printed)
            ? Number.parseInt(printed.split('+')[0] ?? '')
            : null;
          expect(
            actual?.[level],
            `${classTag} ${index + 1} ${field} ${level}`,
          ).toBe(expected);
        }
      }
    }
  });

  it('matches all independently reviewed adept, extract and unchained summoner book cells', async () => {
    const { readFile } = await import('node:fs/promises');
    const corpus = await readFile(
      'tests/fixtures/catalog/spellcasting/reviewed-book-tables.md',
      'utf8',
    );
    const tables = [
      ['Adept Spells per Day', 'adept', 'spellsPerDay'],
      ['Alchemist Extracts per Day', 'extracts', 'spellsPerDay'],
      ['Investigator Extracts per Day', 'extracts', 'spellsPerDay'],
      [
        'Unchained Summoner Spells per Day',
        'unchained-summoner',
        'spellsPerDay',
      ],
      ['Unchained Summoner Spells Known', 'unchained-summoner', 'spellsKnown'],
    ] as const;
    for (const [title, table, field] of tables) {
      const section = corpus
        .split(`## Table: ${title}\n`)[1]
        ?.split('\n## ')[0];
      if (!section) throw new Error(`Missing source table: ${title}`);
      const lines = section
        .split('\n')
        .filter((line) => /^\| \d+(st|nd|rd|th) \|/.test(line));
      expect(lines).toHaveLength(20);
      const hasZero = title.startsWith('Adept') || field === 'spellsKnown';
      for (const [index, line] of lines.entries()) {
        const cells = line
          .split('|')
          .slice(2, -1)
          .map((cell) => cell.trim());
        const sourceSlots: (number | null)[] = Array(10).fill(null);
        cells.forEach((cell, column) => {
          sourceSlots[column + (hasZero ? 0 : 1)] =
            cell === '—' ? null : Number(cell);
        });
        expect(
          findCastingTableRow(table, index + 1)?.[field],
          `${title} ${index + 1}`,
        ).toEqual(sourceSlots);
      }
    }
  });
});

it('representative Wizard and Cleric seeds provide independent reviewed spellcasting definitions', async () => {
  const { representativeClassCatalog } =
    await import('../../convex/lib/representativeClassCatalog');
  expect(
    representativeClassCatalog.find((entry) => entry.name === 'Wizard')?.detail,
  ).toMatchObject({
    casting: {
      classTag: 'wizard',
      ability: 'intelligence',
      table: 'prepared-full',
      record: 'book',
    },
  });
  expect(
    representativeClassCatalog.find((entry) => entry.name === 'Cleric')?.detail,
  ).toMatchObject({
    casting: {
      classTag: 'cleric',
      ability: 'wisdom',
      table: 'prepared-full',
      record: 'none',
    },
  });
});

it('preserves occultist knack availability without inventing a fixed known count', () => {
  // Occult Adventures pp. 46–47: knacks and one spell per implement school.
  expect(findCastingTableRow('occultist', 1)).toMatchObject({
    castableSpellLevels: [0, 1],
  });
  expect(findCastingTableRow('occultist', 20)).toMatchObject({
    castableSpellLevels: [0, 1, 2, 3, 4, 5, 6],
  });
  expect(findCastingTableRow('occultist', 20)?.spellsKnown).toBeUndefined();
});

it('caps valid casting advancement at the final reviewed row and leaves invalid levels without a row', () => {
  // Data model S11: casting advancement reads a table capped at class level20.
  expect(findCastingTableRow('prepared-full', 21)?.spellsPerDay).toEqual([
    4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  ]);
  for (const level of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(findCastingTableRow('prepared-full', level)).toBeUndefined();
  }
});

it('marks the adept zero-level allotment as finite spells rather than unlimited cantrips', () => {
  // CRB pp. 448–449, Table 14–1: three zero-level spells per day;
  // the adept has no Cantrips or Orisons class feature.
  expect(findReviewedClassCasting('adept')?.cantrips).toBe(false);
  expect(findCastingTableRow('adept', 1)?.spellsPerDay[0]).toBe(3);
});
