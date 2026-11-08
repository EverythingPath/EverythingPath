// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  normalizePcgenBookTitle,
  pcgenBooks,
  pcgenBooksSchema,
  pcgenNoticeBooks,
} from '../../scripts/catalog/pcgen-books';
import registry from '../../src/lib/catalog/data/section15-registry.json';
import { readPinned } from './pinned-sources';

// The #716 book crosswalk (plan §1 "Books", Appendix C).
const books = pcgenBooks.books;
const byBook = new Map(books.map((row) => [row.book, row]));
const pcgenLines = async (file: string) =>
  (await readPinned('pcgen', `${pcgenPin.directory}/${file}`)).split(/\r?\n/);
const sourceLongOf = (lines: string[]) =>
  lines
    .find((line) => line.startsWith('SOURCELONG:'))
    ?.split('\t')[0]!
    .slice('SOURCELONG:'.length)
    .trim();

// The inventory's matching rule (716-inventory.py `norm`, `lookup`): an exact
// normalised match, or else the one entry that ends with the other.
const norm = (text: string) =>
  text
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll('’', "'")
    .replace(/[^a-z0-9]/g, '');
function lookup(table: Map<string, string>, book: string) {
  const key = norm(book);
  if (table.has(key)) return table.get(key)!;
  const hits = [...table].filter(
    ([name]) => key.length > 8 && (name.endsWith(key) || key.endsWith(name)),
  );
  return hits.length === 1 ? hits[0]![1] : '';
}
const registryPrefix =
  /^(Pathfinder )?(RPG |Roleplaying Game |Player Companion: |Companion: |Campaign Setting: |Chronicles: )*/;
const registryTitles = new Set(
  Object.values(registry).map(({ title }) => title),
);

describe('the PCGen book crosswalk', () => {
  it('is drawn from the pinned PCGen data and Foundry book list', () => {
    expect(pcgenBooks.pcgen).toEqual({
      commit: pcgenPin.commit,
      directory: pcgenPin.directory,
    });
    expect(pcgenBooks.foundrySources).toEqual({
      repo: 'pf1',
      path: 'module/registry/sources.mjs',
    });
  });

  it('covers the 92 books with 85 automatic and 7 reviewed codes', () => {
    expect(books).toHaveLength(92);
    expect(books.filter((row) => row.code.match === 'automatic')).toHaveLength(
      85,
    );
    expect(
      books
        .filter((row) => row.code.match === 'reviewed')
        .map((row) => [row.book, row.code.id]),
    ).toEqual([
      ['Ironfang Invasion, Chapter 2 - Fangs of War', 'PZO90116'],
      ['Lords of Chaos, Book of the Damned, Volume 2', 'PZO9225'],
      ['Princes of Darkness, Book of the Damned, Volume 1', 'PZO9213'],
      ["Reign of Winter Player's Guide", 'PZO9000-12E'],
      ['Second Darkness, Chapter 2 - Children of the Void', 'PZO9014'],
      ['Second Darkness, Chapter 3 - The Armageddon Echo', 'PZO9015'],
      ['Seekers of Secrets - A Guide to the Pathfinder Society', 'PZO9211'],
    ]);
    expect(byBook.get('Ultimate Wilderness')?.code.id).toBe('PZO1140');
    expect(byBook.get('Advanced Class Origins')?.code.id).toBe('PZO9451');
    expect(byBook.get('Core Rulebook')?.code.id).toBe('PZO1110');
  });

  it('takes each title from the pinned SOURCELONG of its pack', async () => {
    for (const { book, packs, title } of books) {
      const lines = await pcgenLines(title.file);
      expect(lines[title.line - 1]?.split('\t')[0]?.trimEnd(), book).toBe(
        `SOURCELONG:${title.sourceLong}`,
      );
      expect(normalizePcgenBookTitle(title.sourceLong), book).toBe(book);
      for (const { folder, pcc } of packs) {
        expect(pcc.startsWith(`${folder}/`), pcc).toBe(true);
        const sourceLong = sourceLongOf(await pcgenLines(pcc));
        // Healer's Handbook's .pcc has no SOURCELONG, so its list files name it.
        if (sourceLong === undefined) expect(title.file).not.toBe(pcc);
        else expect(normalizePcgenBookTitle(sourceLong), pcc).toBe(book);
      }
    }
    expect(byBook.get("Healer's Handbook")?.title).toEqual({
      file: 'player_companion/healers_handbook/hhb_abilities_class.lst',
      line: 1,
      sourceLong: "Healer's Handbook",
    });
    expect(
      byBook
        .get("Elemental Master's Handbook")
        ?.packs.map(({ folder }) => folder),
    ).toEqual([
      'player_companion/elemental_masters_handbook',
      'player_companion/elemental_masters_handbook/support',
    ]);
  });

  it('matches automatic codes by name in the pinned Foundry book list', async () => {
    const text = await readPinned('pf1', pcgenBooks.foundrySources.path);
    const lines = text.split('\n');
    const automatic = new Map(
      [
        ...text.matchAll(/_id:\s*"(PZO[0-9A-Z]+)"[^}]*?name:\s*"([^"]+)"/gs),
      ].map(([, id, name]) => [norm(name!), id!]),
    );
    for (const { book, code } of books) {
      expect(lines[code.foundryLine - 1]?.trim(), book).toBe(
        `_id: "${code.id}",`,
      );
      expect(lines[code.foundryLine]?.trim(), book).toBe(
        `name: ${JSON.stringify(code.foundryName)},`,
      );
      expect(lookup(automatic, book), book).toBe(
        code.match === 'automatic' ? code.id : '',
      );
    }
  });

  it('marks every reviewed code and proposed alias for review', () => {
    expect(
      books.flatMap(({ code, registry: title }) => [
        ...(code.match === 'reviewed' ? [code.review.status] : []),
        ...(title?.match === 'proposed-alias' ? [title.review.status] : []),
      ]),
    ).toEqual(Array(12).fill('drafted'));
  });

  it('rejects a hand match without its review and an automatic match with one', () => {
    const withCode = (code: unknown) => ({
      ...pcgenBooks,
      books: pcgenBooks.books.map((row, index) =>
        index === reviewedIndex ? { ...row, code } : row,
      ),
    });
    const reviewedIndex = books.findIndex(
      (row) => row.code.match === 'reviewed',
    );
    const reviewed = books[reviewedIndex]!.code;
    if (reviewed.match !== 'reviewed') throw new Error('No reviewed code.');
    const { review, ...unreviewed } = reviewed;
    expect(pcgenBooksSchema.safeParse(withCode(reviewed)).success).toBe(true);
    for (const code of [
      unreviewed,
      { ...unreviewed, match: 'automatic', review },
      { ...unreviewed, review: { status: 'checked', rationale: 'Same URL.' } },
    ])
      expect(pcgenBooksSchema.safeParse(withCode(code)).success).toBe(false);
  });

  it('names a current Registry title for 60 books, 5 of them by proposed alias', () => {
    const titled = books.filter((row) => row.registry !== null);
    expect(titled).toHaveLength(60);
    expect(books.length - titled.length).toBe(32);
    expect(
      titled
        .filter((row) => row.registry!.match === 'proposed-alias')
        .map((row) => [row.book, row.registry!.title]),
    ).toEqual([
      [
        'Lords of Chaos, Book of the Damned, Volume 2',
        'Pathfinder Campaign Setting: Lords of Chaos: Book of the Damned, Vol. 2.',
      ],
      [
        'Princes of Darkness, Book of the Damned, Volume 1',
        'Pathfinder Chronicles: Princes of Darkness, Book of the Damned, Vol. I',
      ],
      [
        'Second Darkness, Chapter 2 - Children of the Void',
        'Pathfinder 14: Children of the Void',
      ],
      [
        'Second Darkness, Chapter 3 - The Armageddon Echo',
        'Pathfinder 15: The Armageddon Echo',
      ],
      [
        'Seekers of Secrets - A Guide to the Pathfinder Society',
        'Pathfinder Chronicles: Seekers of Secrets',
      ],
    ]);
    for (const { book, registry: title } of titled) {
      expect(registryTitles.has(title!.title), book).toBe(true);
      const table = new Map([
        [norm(title!.title.replace(registryPrefix, '')), title!.title],
      ]);
      expect(lookup(table, book) === title!.title, book).toBe(
        title!.match === 'automatic',
      );
    }
    expect(byBook.get('Ultimate Wilderness')?.registry).toEqual({
      match: 'automatic',
      title: 'Ultimate Wilderness',
    });
  });

  it('keeps the Armageddon Echo notice year for the notice reviewer', async () => {
    const title = byBook.get(
      'Second Darkness, Chapter 3 - The Armageddon Echo',
    )?.registry;
    expect(title?.match).toBe('proposed-alias');
    if (title?.match !== 'proposed-alias') return;
    expect(title.laterReview).toHaveLength(1);
    expect(title.laterReview[0]).toContain('ap15.pcc:31');
    // PCGen's copyright line says 2008, the Registry notice 2009.
    expect(
      (await pcgenLines('adventure_path/second_darkness/ap15/ap15.pcc'))[30],
    ).toBe(
      'COPYRIGHT:Pathfinder 15: The Armageddon Echo. Copyright 2008, Paizo Inc.; Author: Jason Bulmahn.',
    );
    expect(
      Object.values(registry).find(
        (record) => record.title === 'Pathfinder 15: The Armageddon Echo',
      )?.notice,
    ).toBe(
      'Pathfinder 15: The Armageddon Echo. Copyright 2009, Paizo Publishing, LLC; Author: Jason Bulmahn',
    );
    expect(
      books.filter(
        (row) =>
          row.registry?.match === 'proposed-alias' &&
          row.registry.laterReview.length > 0,
      ),
    ).toHaveLength(1);
  });
});

// Books outside the crosswalk whose PCGen `OGL.txt` carries their own
// Section 15 line (owner, 2026-10-31): the matcher reads them beside it.
describe('the PCGen notice books', () => {
  const noticeBooks = pcgenNoticeBooks.books;

  it('are drawn from the same pins, apart from the crosswalk', () => {
    expect(pcgenNoticeBooks.pcgen).toEqual(pcgenBooks.pcgen);
    expect(pcgenNoticeBooks.foundrySources).toEqual(pcgenBooks.foundrySources);
    const codes = new Set(books.map(({ code }) => code.id));
    const folders = new Set(
      books.flatMap(({ packs }) => packs.map(({ folder }) => folder)),
    );
    for (const { book, code, packs } of noticeBooks) {
      expect(byBook.has(book), book).toBe(false);
      expect(codes.has(code.id), book).toBe(false);
      for (const { folder } of packs)
        expect(folders.has(folder), book).toBe(false);
    }
  });

  it('are the 43 books with automatic codes, Inner Sea Races among them', () => {
    expect(noticeBooks).toHaveLength(43);
    expect(noticeBooks.every(({ code }) => code.match === 'automatic')).toBe(
      true,
    );
    expect(
      noticeBooks.find(({ code }) => code.id === 'PZO9280')?.packs,
    ).toEqual([
      {
        folder: 'campaign_setting/inner_sea_races',
        pcc: 'campaign_setting/inner_sea_races/_inner_sea_races.pcc',
      },
    ]);
  });

  it('take each title from the pinned SOURCELONG of its .pcc', async () => {
    for (const { book, packs, title } of noticeBooks) {
      expect(title.file, book).toBe(packs[0]?.pcc);
      const lines = await pcgenLines(title.file);
      expect(lines[title.line - 1]?.split('\t')[0]?.trimEnd(), book).toBe(
        `SOURCELONG:${title.sourceLong}`,
      );
      expect(normalizePcgenBookTitle(title.sourceLong), book).toBe(book);
    }
  });

  it('match their codes by name in the pinned Foundry book list', async () => {
    const text = await readPinned('pf1', pcgenBooks.foundrySources.path);
    const lines = text.split('\n');
    const automatic = new Map(
      [
        ...text.matchAll(/_id:\s*"(PZO[0-9A-Z-]+)"[^}]*?name:\s*"([^"]+)"/gs),
      ].map(([, id, name]) => [norm(name!), id!]),
    );
    for (const { book, code } of noticeBooks) {
      expect(lines[code.foundryLine - 1]?.trim(), book).toBe(
        `_id: "${code.id}",`,
      );
      expect(lines[code.foundryLine]?.trim(), book).toBe(
        `name: ${JSON.stringify(code.foundryName)},`,
      );
      expect(lookup(automatic, book), book).toBe(code.id);
    }
  });

  it('name a Registry title only where exactly one current notice carries it', () => {
    for (const { book, registry: title } of noticeBooks) {
      if (title === null) continue;
      expect(title.match, book).toBe('automatic');
      expect(
        Object.entries(registry).filter(
          ([key, record]) =>
            record.title === title.title && !key.startsWith('pcgen'),
        ),
        book,
      ).toHaveLength(1);
      const table = new Map([
        [norm(title.title.replace(registryPrefix, '')), title.title],
      ]);
      expect(lookup(table, book), book).toBe(title.title);
    }
    expect(noticeBooks.filter(({ registry: title }) => title)).toHaveLength(27);
  });

  it('keep each pack’s OGL.txt in the pinned store', async () => {
    for (const { book, packs } of noticeBooks) {
      const folder = packs[0]!.folder;
      const read = (name: string) => pcgenLines(`${folder}/${name}`);
      const lines = await read('OGL.txt').catch(() => read('ogl.txt'));
      expect(lines.length, book).toBeGreaterThan(1);
    }
  });
});

// Real SOURCELONG values from the pinned .pcc files.
describe('normalizePcgenBookTitle', () => {
  it.each([
    [
      'Pathfinder Player Companion: Advanced Class Origins',
      'Advanced Class Origins',
    ],
    ['Pathfinder Companion: Elves of Golarion', 'Elves of Golarion'],
    ['Advanced Class Guide', 'Advanced Class Guide'],
    // PCGen files this Campaign Setting book as a Player Companion.
    ['Pathfinder Player Companion: Inner Sea Intrigue', 'Inner Sea Intrigue'],
  ])('reads %j as %j', (sourceLong, book) => {
    expect(normalizePcgenBookTitle(sourceLong)).toBe(book);
  });
});
