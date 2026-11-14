import type { Section15Registry } from '../../../src/lib/catalog/admission-schema.ts';

/**
 * Reviewed Registry aliases (design `admission-227-design.md` §F slice 2): a
 * Registry record that also answers to a book's product code
 * (`resolveNotice`), so the gate reads the code as that record. An alias is
 * a reviewed identity, never new text. Each product-code alias names its
 * record's book exactly: the record's title is Foundry's name for the code
 * (`pf1/module/registry/sources.mjs`), alone or after its product line, and
 * its notice's first year is the book's. `registry-aliases.test.ts` checks
 * the committed Registry with `findRegistryAliasProblems`.
 */

/** A Foundry book: its name, its `type` and the year of its `date`. */
export type FoundryBook = {
  name: string;
  type: string | null;
  year: string | null;
};

/** The books of Foundry's `sources.mjs`, by code. */
export function foundryBooksOf(
  sourcesText: string,
): ReadonlyMap<string, FoundryBook> {
  return new Map(
    sourcesText.split(/\n\s*_id: /).flatMap((block) => {
      const id = /^"([^"]+)"/.exec(block)?.[1];
      const entry = block.split(/\n\s*\},?\n/)[0] ?? '';
      const field = (name: string) =>
        new RegExp(`\\n\\s*${name}: "([^"]*)"`).exec(entry)?.[1] ?? null;
      const name = field('name');
      return id && name
        ? [
            [
              id,
              {
                name,
                type: field('type'),
                year: /^\d{4}/.exec(field('date') ?? '')?.[0] ?? null,
              },
            ] as const,
          ]
        : [];
    }),
  );
}

/** The product lines a Registry title writes before Foundry's name, by Foundry type. */
const productLines: Readonly<Record<string, readonly string[]>> = {
  core: ['Pathfinder RPG ', 'Pathfinder Roleplaying Game: '],
  companion: ['Pathfinder Player Companion: ', 'Pathfinder Companion: '],
  setting: ['Pathfinder Campaign Setting: '],
};

/** Whether an identifier is a book's product code, which an alias names only after `findRegistryAliasProblems` checks it. */
export const isProductCode = (identifier: string) =>
  /^PZO[0-9A-Z-]+$/.test(identifier);
/** Titles compare exactly, apart from the apostrophe's typography. */
const plain = (title: string) => title.replaceAll('’', "'");

type RegistryRecord = Section15Registry[string];

/** Why one product-code alias doesn't name its record's book exactly. */
function aliasProblems({
  key,
  record,
  alias,
  book,
}: {
  key: string;
  record: RegistryRecord;
  alias: string;
  book: FoundryBook | undefined;
}) {
  if (!book) return [`${key}: alias ${alias} is not a Foundry book.`];
  const titles = [
    book.name,
    ...(productLines[book.type ?? ''] ?? []).map(
      (line) => `${line}${book.name}`,
    ),
  ].map(plain);
  const year = /(?:©|Copyright)\s*(\d{4})/.exec(record.notice)?.[1];
  return [
    ...(titles.includes(plain(record.title))
      ? []
      : [
          `${key}: alias ${alias} is Foundry's "${book.name}" (${book.type ?? 'no type'}), but the record is titled "${record.title}".`,
        ]),
    ...(book.year && year !== book.year
      ? [
          `${key}: alias ${alias}'s notice is dated ${year ?? 'never'}, but Foundry dates the book ${book.year}.`,
        ]
      : []),
  ];
}

/**
 * Every product-code alias that doesn't name its record's book exactly, and
 * every one that names several records (which `resolveNotice` reads as none).
 */
export function findRegistryAliasProblems({
  registry,
  books,
}: {
  registry: Section15Registry;
  books: ReadonlyMap<string, FoundryBook>;
}) {
  const records = Object.entries(registry);
  const named = new Map<string, string[]>();
  for (const [key, record] of records)
    for (const identifier of new Set([key, ...record.aliases]))
      named.set(identifier, [...(named.get(identifier) ?? []), key]);
  return [
    ...records.flatMap(([key, record]) =>
      record.aliases
        .filter(isProductCode)
        .flatMap((alias) =>
          aliasProblems({ key, record, alias, book: books.get(alias) }),
        ),
    ),
    ...[...named]
      .filter(
        ([identifier, keys]) => keys.length > 1 && isProductCode(identifier),
      )
      .map(
        ([identifier, keys]) =>
          `${identifier} names several records: ${keys.join(', ')}.`,
      ),
  ];
}

/**
 * A record as it was before its later product-code aliases: without each
 * alias that a "Product-code alias <code>" provenance line records, and
 * without that line. A batch's frozen Registry fingerprint compares this, so
 * a checked later alias is the one change it allows.
 */
export function withoutProductAliases(record: RegistryRecord): RegistryRecord {
  const added = (line: string) =>
    /^Product-code alias (PZO[0-9A-Z-]+) /.exec(line)?.[1];
  const later = new Set(record.provenance.map(added).filter(Boolean));
  return {
    ...record,
    aliases: record.aliases.filter((alias) => !later.has(alias)),
    provenance: record.provenance.filter((line) => added(line) === undefined),
  };
}
