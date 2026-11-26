import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { pcgenPin, pins } from './inventory.ts';
import { legalRecordLabel, readLegalRecordsIn } from './legal-records.ts';
import { readArray, readObject, readStrings } from './values.ts';
import type { PreviewEntry } from './map.ts';
import { pcgenBookFolders, pcgenBookOfFile } from './pcgen-books.ts';
import { declaredBookCode, isNonEmpty } from './legal/attribution-227.ts';
import {
  attribution227MatchSchema,
  attribution227MatchesSchema,
  compactAttribution227Matches,
  matchesSha256,
  type Attribution227Match,
  type Attribution227Matches,
  type ReviewedRecordLine,
} from './legal/attribution-227-matches.ts';
import {
  classGrantsOf,
  grantingClassOf,
  pcgenListObject,
  pcgenRecordLocator,
  refuseRepeatedClaims,
  reviewedPcgenRecordIdentity,
  type ClassGrants,
  type ReviewedPcgenRecord,
} from './reviewed-pcgen-records.ts';

/**
 * The #227 scripted match's generator (design `admission-227-design.md` §B,
 * §F slice 3; `legal/attribution-227-matches.ts` describes the file). Pure
 * functions over the records and pinned lists, so tests run them on published
 * records; `readMatcherInputs` reads the checkouts for the command.
 */

/** The repository files the matcher reads or runs; their hashes bind the file. */
export const matcherInputPaths = [
  'scripts/catalog/attribution-227-matcher.ts',
  'scripts/catalog/pcgen-books.json',
  // A file's book (`pcgenBookOfFile`), which the gate reads too.
  'scripts/catalog/pcgen-books.ts',
  'scripts/catalog/pcgen-notice-books.json',
  'scripts/catalog/reviewed-pcgen-records.json',
  // A list line's object and a PCGen record's locator, which the gate reads too.
  'scripts/catalog/reviewed-pcgen-records.ts',
] as const;
export const matchesPath = 'scripts/catalog/legal/attribution-227-matches.json';

/** A PCGen object family: the lists a Foundry kind is compared against. */
type PcgenFamily = 'feat' | 'class-ability' | 'equipment' | 'spell' | 'race';

/**
 * The family a Foundry kind matches in. A kind without one (eidolon
 * evolutions and forms, creature types, companion features, traits, buffs)
 * has no PCGen list of the same objects, so it takes no PCGen match.
 */
const familyOfKind: Readonly<Record<string, PcgenFamily>> = {
  feat: 'feat',
  classFeature: 'class-ability',
  item: 'equipment',
  spell: 'spell',
  race: 'race',
  // PCGen lists familiars and animal companions as races.
  familiar: 'race',
  companion: 'race',
};

/** ABILITY categories that hold no class ability. */
const nonClassCategories = new Set([
  'FEAT',
  'Mythic Feat',
  'Internal',
  'Background',
  'Racial Traits',
  'Archetype',
]);
/**
 * Ability lists that hold race and monster abilities, companions' abilities
 * or the Advanced Race Guide's race builder, by PCGen's file naming
 * (`b2_abilities_race.lst`, `apg_abilities_companion.lst`,
 * `arg_abilities_builder.lst`).
 */
const nonClassAbilityFile =
  /_abilities_(?:race|races|companion|builder)(?:_|\.)/;

/** A PCGen list line's family, from its `.pcc` list type, category and file. */
function lineFamily(
  type: string,
  category: string | undefined,
  file: string,
): PcgenFamily | undefined {
  switch (type) {
    case 'ABILITY':
      if (category === 'FEAT') return 'feat';
      if (
        category === undefined ||
        nonClassCategories.has(category) ||
        nonClassAbilityFile.test(posix.basename(file))
      )
        return undefined;
      return 'class-ability';
    case 'EQUIPMENT':
      return 'equipment';
    case 'SPELL':
      return 'spell';
    case 'RACE':
      return 'race';
    default:
      return undefined;
  }
}

/** A name as the match compares it: case, accents, spacing and punctuation dropped. */
export const matchName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * A name's words in sorted order, compared as `matchName` compares them: the
 * same words in another order ("Abyssal Bloodrager Bloodline", `KEY:Bloodrager
 * Bloodline ~ Abyssal`) give the same text.
 */
export const wordOrderName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ');

/** A PCGen name's trailing parenthetical: "Hubris Subdomain (Glory)". */
const trailingParenthetical = /\s*\([^()]*\)\s*$/;

/**
 * Foundry's trailing tags: an upper-case abbreviation of two to four letters
 * naming a book or class ("(UC)", "(BLO)") or an ability type ("(Su)").
 */
const trailingTag = /\s*\((?:[A-Z]{2,4}|Ex|Su|Sp)\)\s*$/;
/** A record's name, then without its trailing tags. */
export function nameVariants(name: string) {
  const variants = [name];
  let current = name;
  while (trailingTag.test(current)) {
    current = current.replace(trailingTag, '');
    if (current) variants.push(current);
  }
  return [...new Set(variants)];
}

/** A file under the PCGen pin's data directory, by its path there. */
export type PcgenFile = { path: string; text: string };
type PcgenHit = {
  family: PcgenFamily;
  book: string;
  file: string;
  line: number;
  /** The line's column-1 name as `matchName` gives it: the object it names. */
  object: string;
};
type PcgenHits = ReadonlyMap<string, readonly PcgenHit[]>;
/**
 * A list line that names an object, by its file and KEY
 * (`pcgenRecordLocator`), with the families its list types give it (none when
 * its category is excluded): every such line, so a KEY that names two records
 * is seen before any family.
 */
type KeyedLine = {
  book: string;
  file: string;
  line: number;
  families: readonly PcgenFamily[];
  /** Its `TYPE:`s, such as `CavalierClassFeatures`. */
  types: readonly string[];
  /** The SHA-256 of the line's text. */
  lineSha256: string;
};
/**
 * The lists' lines by each way the match looks a name up: `exact` by the
 * name and `KEY:` (`matchName`), `wordOrder` by the `KEY:`'s words in any
 * order (`wordOrderName`), `withoutParenthetical` by the name with its
 * trailing parenthetical dropped (`matchName`), and `keys` by list file and
 * KEY exactly as PCGen states it (`pcgenRecordLocator`; a line with no `KEY:`
 * by its column-1 name), every line of any category, for a reviewed PCGen
 * record. A name's own words in another order are not read: at the pin they often name another object ("Hex Scar",
 * the Scarred Witch Doctor's, is not Ultimate Magic's Scar hex; "Weapon
 * Focus" is not the warpriest's Focus Weapon), while a KEY's words carry its
 * category ("Bloodrager Bloodline ~ Abyssal").
 */
export type PcgenNameIndex = {
  exact: PcgenHits;
  wordOrder: PcgenHits;
  withoutParenthetical: PcgenHits;
  keys: ReadonlyMap<string, readonly KeyedLine[]>;
};

/** A `.pcc` line's list path, relative to the data directory (`pcc.ts`). */
function listPath(pcc: string, value: string) {
  const path = value.split('|')[0]?.trim() ?? '';
  if (!path.endsWith('.lst')) return undefined;
  if (!path.startsWith('@'))
    return posix.normalize(posix.join(posix.dirname(pcc), path));
  const fromData = path.slice(1).replaceAll('\\', '/').replace(/^\/+/, '');
  const prefix = 'pathfinder/paizo/';
  return fromData.startsWith(prefix)
    ? fromData.slice(prefix.length)
    : undefined;
}

/**
 * Every column-1 name and `KEY:` of the lists the `.pcc` files load, with its
 * family, its book and its line. `.MOD`, `.COPY` and `.FORGET` lines and tag
 * lines (`SOURCELONG:…`) name no object; a list in no crosswalk folder has no
 * book and is skipped.
 */
export function buildPcgenNameIndex({
  files,
  folders = pcgenBookFolders(),
}: {
  files: readonly PcgenFile[];
  folders?: ReadonlyMap<string, string>;
}): PcgenNameIndex {
  const types = listTypesOf(files);
  const exact = new Map<string, PcgenHit[]>();
  const wordOrder = new Map<string, PcgenHit[]>();
  const withoutParenthetical = new Map<string, PcgenHit[]>();
  const keys = new Map<string, KeyedLine[]>();
  const add = (index: Map<string, PcgenHit[]>, key: string, hit: PcgenHit) => {
    if (!key) return;
    const hits = index.get(key) ?? [];
    if (!hits.some((other) => sameHit(other, hit))) hits.push(hit);
    index.set(key, hits);
  };
  const lists = files
    .filter(({ path }) => path.endsWith('.lst'))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const { path, text } of lists) {
    const book = pcgenBookOfFile(folders, path);
    const listTypes = types.get(path);
    if (!book || !listTypes) continue;
    text.split(/\r\n|\r|\n/).forEach((line, offset) => {
      const object = pcgenListObject(line);
      if (!object) return;
      const families = new Set<PcgenFamily>();
      for (const type of listTypes) {
        const family = lineFamily(type, object.category, path);
        if (!family) continue;
        families.add(family);
        const hit = {
          family,
          book,
          file: path,
          line: offset + 1,
          object: matchName(object.name),
        };
        add(exact, matchName(object.name), hit);
        if (object.key) {
          add(exact, matchName(object.key), hit);
          add(wordOrder, wordOrderName(object.key), hit);
        }
        const bare = object.name.replace(trailingParenthetical, '');
        if (bare && bare !== object.name)
          add(withoutParenthetical, matchName(bare), hit);
      }
      const locator = pcgenRecordLocator({
        file: path,
        key: object.key ?? object.name,
      });
      keys.set(locator, [
        ...(keys.get(locator) ?? []),
        {
          book,
          file: path,
          line: offset + 1,
          families: [...families],
          types: object.types,
          lineSha256: sha256(line),
        },
      ]);
    });
  }
  return { exact, wordOrder, withoutParenthetical, keys };
}

/** Each list a `.pcc` loads, with the list types it is loaded as. */
function listTypesOf(files: readonly PcgenFile[]) {
  const types = new Map<string, Set<string>>();
  for (const { path, text } of files) {
    if (!path.endsWith('.pcc')) continue;
    for (const line of text.split(/\r\n|\r|\n/)) {
      const [, type, value] = /^([A-Z]+):(.+)$/.exec(line) ?? [];
      const list = type && value ? listPath(path, value) : undefined;
      if (type && list)
        types.set(list, new Set([...(types.get(list) ?? []), type]));
    }
  }
  return types;
}

const sameHit = (a: PcgenHit, b: PcgenHit) =>
  a.family === b.family && a.file === b.file && a.line === b.line;

/** A record as the matcher reads it: the import's entry, without its own books. */
export type MatcherRecord = Pick<
  PreviewEntry,
  'externalKey' | 'name' | 'detail' | 'unsupported'
>;
/** A class's declared books, by its Foundry name. */
export type ClassBooks = ReadonlyMap<
  string,
  readonly { externalKey: string; name: string; books: readonly string[] }[]
>;
/** A record's stored books: its assessment's notices and the PCGen line its legal record names. */
export type StoredBooks = ReadonlyMap<
  string,
  {
    notices: readonly [string, ...string[]];
    batch: string;
    comparison: { file: string; line: number };
  }
>;

/** The classes a Foundry class feature is associated with (`system.associations.classes`). */
function associatedClasses(record: MatcherRecord) {
  return record.unsupported.flatMap(({ field, value }) =>
    field === 'gameContent'
      ? readStrings(readObject(readObject(value).associations).classes)
      : [],
  );
}

/**
 * A record's match, or `undefined` when nothing names a book for it. A class
 * feature also takes its classes' declared books, so a match whose books all
 * differ from its class's lists the class book too and the gate requires
 * every one reviewed (root decision of 2026-11-12, item 3); one whose only
 * book is its class's is held.
 */
export function matchRecord(
  record: MatcherRecord,
  {
    index,
    classBooks,
    stored,
    reviewedLine,
  }: {
    index: PcgenNameIndex;
    classBooks: ClassBooks;
    stored: StoredBooks;
    /** The line of the record's checked reviewed PCGen record (`reviewed-pcgen-records.json`) with its binding, if any. */
    reviewedLine?: ReviewedLine;
  },
): Attribution227Match | undefined {
  const ordinary = pcgenLookup(record, index);
  const storedBooks = stored.get(record.externalKey);
  // A reviewed line applies only to a record nothing else matches.
  const pcgen: PcgenLookup =
    ordinary.kind === 'none' && !storedBooks && reviewedLine
      ? {
          kind: 'found',
          evidence: [
            {
              kind: 'pcgen-fallback',
              rule: 'reviewed-record',
              ...reviewedLine,
            },
          ],
        }
      : ordinary;
  const evidence = [
    ...(pcgen.kind === 'found' ? pcgen.evidence : []),
    ...(storedBooks
      ? [{ kind: 'stored-assessment' as const, ...storedBooks }]
      : []),
  ];
  const classes = classBooksFor(record, classBooks);
  const base = {
    externalKey: record.externalKey,
    name: record.name,
    kind: record.detail.kind,
  };
  if (isNonEmpty(evidence))
    return { ...base, status: 'matched', evidence, classes };
  if (pcgen.kind === 'ambiguous')
    return {
      ...base,
      status: 'held',
      hold: { kind: 'ambiguous-word-order', candidates: pcgen.candidates },
    };
  return isNonEmpty(classes)
    ? { ...base, status: 'held', hold: { kind: 'association-only', classes } }
    : undefined;
}

type PcgenLine = { book: string; file: string; line: number };
/** A reviewed PCGen record's line with what it is bound to (`ReviewedRecordLine`). */
type ReviewedLine = Omit<ReviewedRecordLine, 'kind' | 'rule'>;
/** What a record's PCGen lookup found. */
type PcgenLookup =
  | { kind: 'none' }
  | {
      kind: 'found';
      evidence: readonly (
        | ({ kind: 'pcgen' } & PcgenLine)
        | ({
            kind: 'pcgen-fallback';
            rule: Exclude<PcgenFallbackRule, 'reviewed-record'>;
          } & PcgenLine)
        | ReviewedRecordLine
      )[];
    }
  /** Its words in another order name two or more objects: none is chosen. */
  | {
      kind: 'ambiguous';
      candidates: readonly [PcgenLine, PcgenLine, ...PcgenLine[]];
    };
type PcgenFallbackRule =
  | 'reviewed-record'
  | 'word-order'
  | 'without-parenthetical';

/**
 * A record's PCGen lines of its family. The exact name or `KEY:` comes first,
 * from the first name variant that has any. Only for a class feature, and
 * only when no variant has one, does the match try a `KEY:` with the same
 * words in another order, and only when no variant has one a PCGen name with
 * its trailing parenthetical dropped (root decision of 2026-11-13, item 1).
 * The exact lookup gives one line per book (the first in path order), sorted
 * by book; a fallback gives every line it found, sorted by book, file and
 * line. KEYs with the same words can belong to lines naming different
 * objects, so lines naming two or more objects are ambiguous and none is
 * chosen; a dropped parenthetical joins one object's variants ("Hubris
 * Subdomain (Glory)", "(Nobility)").
 */
function pcgenLookup(
  record: MatcherRecord,
  index: PcgenNameIndex,
): PcgenLookup {
  const family = familyOfKind[record.detail.kind];
  if (!family) return { kind: 'none' };
  const variants = nameVariants(record.name);
  const lookup = (hits: PcgenHits, key: (name: string) => string) =>
    variants
      .map((name) =>
        (hits.get(key(name)) ?? []).filter((hit) => hit.family === family),
      )
      .find((found) => found.length) ?? [];
  const exact = lookup(index.exact, matchName);
  if (exact.length)
    return {
      kind: 'found',
      evidence: oneLinePerBook(exact).map((hit) => ({
        kind: 'pcgen',
        ...hit,
      })),
    };
  if (record.detail.kind !== 'classFeature') return { kind: 'none' };
  const reordered = lookup(index.wordOrder, wordOrderName);
  if (new Set(reordered.map(({ object }) => object)).size > 1) {
    const [first, second, ...rest] = sortedLines(reordered);
    if (first && second)
      return { kind: 'ambiguous', candidates: [first, second, ...rest] };
  }
  const [rule, hits]: [PcgenFallbackRule, readonly PcgenHit[]] =
    reordered.length
      ? ['word-order', reordered]
      : [
          'without-parenthetical',
          lookup(index.withoutParenthetical, matchName),
        ];
  return hits.length
    ? {
        kind: 'found',
        evidence: sortedLines(hits).map((hit) => ({
          kind: 'pcgen-fallback',
          rule,
          ...hit,
        })),
      }
    : { kind: 'none' };
}

/** One line per book, the first in path order, sorted by book. */
function oneLinePerBook(hits: readonly PcgenHit[]): PcgenLine[] {
  return [...new Set(hits.map(({ book }) => book))].sort().flatMap((book) => {
    const hit = hits.find((item) => item.book === book);
    return hit ? [{ book, file: hit.file, line: hit.line }] : [];
  });
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Every line, sorted by book, file and line. */
function sortedLines(hits: readonly PcgenHit[]): PcgenLine[] {
  return hits
    .map(({ book, file, line }) => ({ book, file, line }))
    .sort(
      (a, b) =>
        byText(a.book, b.book) || byText(a.file, b.file) || a.line - b.line,
    );
}

/** A class feature's classes that declare books; any other record has none. */
function classBooksFor(record: MatcherRecord, classBooks: ClassBooks) {
  if (record.detail.kind !== 'classFeature') return [];
  return [...new Set(associatedClasses(record))]
    .sort()
    .flatMap((name) => classBooks.get(name) ?? [])
    .flatMap(({ books, ...rest }) =>
      isNonEmpty(books) ? [{ ...rest, books }] : [],
    );
}

/** The class books the records declare: each class entry's books, by its name. */
export function classBooksOf(entries: readonly PreviewEntry[]): ClassBooks {
  const byName = new Map<
    string,
    { externalKey: string; name: string; books: string[] }[]
  >();
  for (const entry of entries) {
    if (entry.detail.kind !== 'class') continue;
    const books = [
      ...new Set(entry.sources.map(({ book }) => declaredBookCode(book))),
    ].sort();
    byName.set(entry.name, [
      ...(byName.get(entry.name) ?? []),
      { externalKey: entry.externalKey, name: entry.name, books },
    ]);
  }
  for (const classes of byName.values())
    classes.sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));
  return byName;
}

const pcgenLineUrl = new RegExp(
  `^https://github\\.com/PCGen/pcgen/blob/${pcgenPin.commit}/${pcgenPin.directory}/(.+\\.lst)#L(\\d+)$`,
);
/** A legal record's compared PCGen line, from its `comparisonLocation`. */
export function comparedPcgenLine(comparison: unknown) {
  for (const item of Array.isArray(comparison) ? comparison : [comparison]) {
    const location = readObject(item).comparisonLocation;
    const match =
      typeof location === 'string' ? pcgenLineUrl.exec(location) : null;
    if (match?.[1] && match[2])
      return { file: match[1], line: Number(match[2]) };
  }
  return undefined;
}

/**
 * The stored books of the keys whose legal record names a compared PCGen
 * line: their assessment's `requiredNotices`, sorted.
 */
export function storedBooksOf({
  legalRecords,
  assessments,
}: {
  legalRecords: readonly {
    batch: string;
    externalKey: string;
    comparison: unknown;
  }[];
  assessments: readonly {
    externalKey: string;
    requiredNotices: readonly string[];
  }[];
}): StoredBooks {
  const notices = new Map(
    assessments.map(({ externalKey, requiredNotices }) => [
      externalKey,
      [...new Set(requiredNotices)].sort(),
    ]),
  );
  const stored = new Map<
    string,
    {
      notices: readonly [string, ...string[]];
      batch: string;
      comparison: { file: string; line: number };
    }
  >();
  for (const { batch, externalKey, comparison } of legalRecords) {
    if (stored.has(externalKey)) continue;
    const line = comparedPcgenLine(comparison);
    const books = notices.get(externalKey) ?? [];
    if (line && isNonEmpty(books))
      stored.set(externalKey, { notices: books, batch, comparison: line });
  }
  return stored;
}

const sha256 = (text: string | Buffer) =>
  createHash('sha256').update(text).digest('hex');

/**
 * The lines of the checked reviewed PCGen records, by key. Every record,
 * drafted or checked, must still fit its Foundry record, or the generation is
 * refused naming each misfit: a record that declares no book has the key, its
 * name is exactly the record's upstream name, its imported description has
 * the reviewed hash, nothing else matches it (no
 * exact line, word-order or parenthetical fallback, ambiguous word order or
 * stored assessment: else the record is stale, and it can never replace or
 * join a matched entry's books), its file has exactly one line keyed
 * exactly as the record states the key, in any category (no name, tag or
 * word-order reading), that line is of the record's family, and for a class
 * feature that KEY names one of the record's classes (`<class> ~ …`).
 */
function reviewedPcgenLines({
  records,
  reviewedRecords,
  index,
  stored,
  grants,
}: {
  records: readonly (MatcherRecord & Pick<PreviewEntry, 'description'>)[];
  reviewedRecords: readonly ReviewedPcgenRecord[];
  index: PcgenNameIndex;
  stored: StoredBooks;
  grants: ClassGrants;
}): ReadonlyMap<string, ReviewedLine> {
  refuseRepeatedClaims(reviewedRecords);
  const byKey = new Map(records.map((record) => [record.externalKey, record]));
  const lines = new Map<string, ReviewedLine>();
  const problems = reviewedRecords.flatMap((reviewed) => {
    const record = byKey.get(reviewed.externalKey);
    const fit = record
      ? reviewedRecordFit(reviewed, record, { index, stored, grants })
      : refused('no record that declares no book has this key.');
    if (fit.kind === 'refused')
      return [`${reviewed.externalKey}: ${fit.problem}`];
    if (reviewed.status === 'checked')
      lines.set(reviewed.externalKey, {
        ...fit.line,
        key: reviewed.pcgen.key,
        record: reviewedPcgenRecordIdentity(reviewed),
      });
    return [];
  });
  if (problems.length)
    throw new Error(
      `Reviewed PCGen records (reviewed-pcgen-records.json) refused:\n${problems.map((problem) => `- ${problem}`).join('\n')}`,
    );
  return lines;
}

/** A reviewed PCGen record's fit: its one line, or why it is refused. */
type ReviewedRecordFit =
  | { kind: 'fits'; line: PcgenLine & { lineSha256: string } }
  | { kind: 'refused'; problem: string };
const refused = (problem: string): ReviewedRecordFit => ({
  kind: 'refused',
  problem,
});

/**
 * Why a reviewed PCGen record no longer fits its Foundry record (its name,
 * its body, or a match it now has by the ordinary rules), or else its line.
 */
function reviewedRecordFit(
  { upstreamName, descriptionSha256, pcgen }: ReviewedPcgenRecord,
  record: MatcherRecord & Pick<PreviewEntry, 'description'>,
  {
    index,
    stored,
    grants,
  }: { index: PcgenNameIndex; stored: StoredBooks; grants: ClassGrants },
): ReviewedRecordFit {
  if (record.name !== upstreamName)
    return refused(
      `the record is named "${record.name}", not "${upstreamName}".`,
    );
  const body = sha256(record.description);
  if (body !== descriptionSha256)
    return refused(
      `its description is sha256:${body}, not the reviewed sha256:${descriptionSha256}; the record is stale until it is reviewed again.`,
    );
  const matched = ordinaryMatch(record, index, stored);
  if (matched)
    return refused(
      `${matched}; a reviewed PCGen record applies only to a record with no match, so this one is stale.`,
    );
  return reviewedPcgenLine(pcgen, record, {
    index,
    granting: grants.get(record.externalKey) ?? [],
  });
}

/**
 * The one line a reviewed PCGen record names: its file's only line keyed
 * exactly as stated, counted over every category before its family is read,
 * which is of the record's family. For a class feature, a row of a class
 * grants the Foundry record (its class associations are not a grant), and
 * the line is that class's feature: its KEY is `<class> ~ …` and its `TYPE:`
 * is `<class>ClassFeatures`, as PCGen gives a class's features.
 */
function reviewedPcgenLine(
  pcgen: ReviewedPcgenRecord['pcgen'],
  record: MatcherRecord,
  { index, granting }: { index: PcgenNameIndex; granting: readonly string[] },
): ReviewedRecordFit {
  const family = familyOfKind[record.detail.kind];
  const lines = index.keys.get(pcgenRecordLocator(pcgen)) ?? [];
  const [hit, ...more] = lines;
  if (!hit) return refused(`${pcgen.file} has no line keyed "${pcgen.key}".`);
  if (more.length)
    return refused(
      `${pcgen.file} has ${lines.length} lines keyed "${pcgen.key}" (${lines.map(({ line }) => line).join(', ')}); a reviewed PCGen record names one.`,
    );
  const at = `${pcgen.file}:${hit.line} keyed "${pcgen.key}"`;
  if (!family || !hit.families.includes(family))
    return refused(`${at} is not a ${family ?? 'PCGen'} line.`);
  const line = {
    book: hit.book,
    file: hit.file,
    line: hit.line,
    lineSha256: hit.lineSha256,
  };
  return record.detail.kind === 'classFeature'
    ? classFeatureFit({ pcgen, record, granting, hit: { ...hit, at }, line })
    : { kind: 'fits', line };
}

/**
 * A class feature's reviewed line fits only as the feature of a class whose
 * row grants it: its KEY `<class> ~ …`, its `TYPE:` `<class>ClassFeatures`.
 */
function classFeatureFit({
  pcgen,
  record,
  granting,
  hit,
  line,
}: {
  pcgen: ReviewedPcgenRecord['pcgen'];
  record: MatcherRecord;
  granting: readonly string[];
  hit: KeyedLine & { at: string };
  line: PcgenLine & { lineSha256: string };
}): ReviewedRecordFit {
  const { at } = hit;
  if (!granting.length)
    return refused(
      `no class row grants it (its class associations, ${list([...new Set(associatedClasses(record))].sort())}, are not grants).`,
    );
  const owner = grantingClassOf(granting, pcgen.key);
  if (owner === undefined)
    return refused(
      `its PCGen key "${pcgen.key}" is not a feature of a class whose row grants it (${list(granting)}).`,
    );
  const type = `${owner.replaceAll(' ', '')}ClassFeatures`;
  if (!hit.types.includes(type)) return refused(`${at} is not typed ${type}.`);
  return { kind: 'fits', line };
}
const list = (items: readonly string[]) => items.join(', ') || 'none';

/** What matches a record without a reviewed PCGen record, if anything. */
function ordinaryMatch(
  record: MatcherRecord,
  index: PcgenNameIndex,
  stored: StoredBooks,
) {
  const lines = (found: readonly PcgenLine[]) =>
    list(found.map(({ file, line }) => `${file}:${line}`));
  const pcgen = pcgenLookup(record, index);
  if (pcgen.kind === 'found') {
    const [first] = pcgen.evidence;
    const rule = first?.kind === 'pcgen-fallback' ? first.rule : 'exact';
    return `its own name matches PCGen (${rule}: ${lines(pcgen.evidence)})`;
  }
  if (pcgen.kind === 'ambiguous')
    return `its own name matches PCGen (ambiguous word order: ${lines(pcgen.candidates)})`;
  const storedBooks = stored.get(record.externalKey);
  return storedBooks
    ? `its stored assessment names its books (${storedBooks.batch})`
    : undefined;
}

/**
 * The matches of the records that declare no book (an entry with an
 * attribution owner is matched as its owner), sorted by key, with their
 * binding. A checked reviewed PCGen record gives its one record its one line.
 */
export function buildAttribution227Matches({
  entries,
  index,
  stored,
  reviewedRecords,
  inputs,
}: {
  entries: readonly PreviewEntry[];
  index: PcgenNameIndex;
  stored: StoredBooks;
  /** The reviewed PCGen records (`reviewed-pcgen-records.json`). */
  reviewedRecords: readonly ReviewedPcgenRecord[];
  inputs: Readonly<Record<string, string>>;
}): Attribution227Matches {
  const classBooks = classBooksOf(entries);
  const records = entries.filter(
    ({ sources, attributionFrom }) => !sources.length && !attributionFrom,
  );
  const reviewedLines = reviewedPcgenLines({
    records,
    reviewedRecords,
    index,
    stored,
    grants: classGrantsOf(entries),
  });
  const found = records
    .flatMap(
      (entry) =>
        matchRecord(entry, {
          index,
          classBooks,
          stored,
          reviewedLine: reviewedLines.get(entry.externalKey),
        }) ?? [],
    )
    .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));
  // Hashed as the gate reads them: parsed, each field in its schema's order.
  const matches = attribution227MatchSchema.array().parse(found);
  return attribution227MatchesSchema.parse({
    version: 2,
    command: 'pnpm -s catalog:attribution-227-matches --write',
    binding: {
      upstream: Object.entries(pins).map(([repository, { commit }]) => ({
        repository,
        commit,
      })),
      pcgen: { commit: pcgenPin.commit, directory: pcgenPin.directory },
      inputs,
      matchesSha256: matchesSha256(matches),
    },
    matches,
  });
}

/**
 * The file's text: the stored form (`compactAttribution227Matches`), its
 * header and shared records indented, each match on one line.
 */
export function serializeAttribution227Matches(
  document: Attribution227Matches,
) {
  const { matches, ...header } = compactAttribution227Matches(document);
  const head = JSON.stringify({ ...header, matches: [] }, null, 2);
  if (!matches.length) return `${head}\n`;
  const lines = matches.map((match) => `    ${JSON.stringify(match)}`);
  return `${head.replace(/"matches": \[\]\n}$/, `"matches": [\n${lines.join(',\n')}\n  ]\n}`)}\n`;
}

/**
 * The keys whose committed (expanded) match differs from a fresh one, or that
 * only one of them lists: `--check` compares them record for record.
 */
export function matchesDifferences(
  committed: readonly Attribution227Match[],
  fresh: readonly Attribution227Match[],
) {
  const byKey = (matches: readonly Attribution227Match[]) =>
    new Map(matches.map((match) => [match.externalKey, JSON.stringify(match)]));
  const before = byKey(committed);
  const after = byKey(fresh);
  return [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .flatMap((key) => {
      const [old, current] = [before.get(key), after.get(key)];
      if (old === current) return [];
      if (old === undefined)
        return [`${key}: only a fresh generation lists it.`];
      if (current === undefined)
        return [`${key}: only the committed file lists it.`];
      return [`${key}: its committed match differs from a fresh one.`];
    });
}

/** sha256 of each matcher input under `root`. */
export async function readMatcherInputHashes(
  root: string,
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const path of matcherInputPaths)
    hashes[path] = sha256(await readFile(join(root, path)));
  return hashes;
}

/**
 * Why a committed matches file no longer describes its pinned inputs: a hand
 * edit (its `matchesSha256`), a changed pin, a changed matcher input, or a
 * stored assessment or legal record that no longer names its books or line.
 * `--check` adds the comparison with a fresh generation.
 */
export function attribution227MatchesDrift({
  document,
  inputs,
  stored,
}: {
  document: Attribution227Matches;
  inputs: Readonly<Record<string, string>>;
  /** The stored books as the current assessments and legal batches give them (`storedBooksOf`). */
  stored: StoredBooks;
}) {
  return [
    ...(matchesSha256(document.matches) === document.binding.matchesSha256
      ? []
      : ['matches drifted from binding.matchesSha256 (edited by hand?).']),
    ...pinDrift(document),
    ...[
      ...new Set([
        ...Object.keys(document.binding.inputs),
        ...Object.keys(inputs),
      ]),
    ]
      .sort()
      .filter((path) => document.binding.inputs[path] !== inputs[path])
      .map((path) => `input ${path} changed.`),
    ...storedDrift(document, stored),
  ];
}

/** The pins the file binds that moved (`inventory.ts`). */
function pinDrift(document: Attribution227Matches) {
  const problems = Object.entries(pins).flatMap(([repository, pin]) => {
    const bound = document.binding.upstream.find(
      (item) => item.repository === repository,
    );
    return bound?.commit === pin.commit
      ? []
      : [
          `upstream ${repository} pin changed: ${bound?.commit ?? 'none'} → ${pin.commit}.`,
        ];
  });
  if (
    document.binding.pcgen.commit !== pcgenPin.commit ||
    document.binding.pcgen.directory !== pcgenPin.directory
  )
    problems.push('PCGen pin changed.');
  return problems;
}

/** The stored-assessment evidence the current assessments and batches no longer give. */
function storedDrift(document: Attribution227Matches, stored: StoredBooks) {
  return document.matches.flatMap((match) =>
    match.status === 'matched'
      ? match.evidence.flatMap((item) => {
          if (item.kind !== 'stored-assessment') return [];
          const { notices, batch, comparison } = item;
          return JSON.stringify(stored.get(match.externalKey)) ===
            JSON.stringify({ notices, batch, comparison })
            ? []
            : [
                `${match.externalKey}: its stored assessment or legal record no longer names these books and PCGen line.`,
              ];
        })
      : [],
  );
}

/** Every `.pcc` and `.lst` file under the PCGen pin's data directory. */
export async function readPcgenFiles(dataPath: string) {
  const files: PcgenFile[] = [];
  async function walk(directory: string) {
    for (const item of (
      await readdir(join(dataPath, directory), { withFileTypes: true })
    ).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const path = directory ? `${directory}/${item.name}` : item.name;
      if (item.isDirectory()) await walk(path);
      else if (/\.(?:pcc|lst)$/.test(item.name))
        files.push({
          path,
          text: await readFile(join(dataPath, path), 'utf8'),
        });
    }
  }
  await walk('');
  return files;
}

/**
 * The legal batches' records (batch, key, comparison) and the stored
 * assessments: every batch, or only the named ones (a drift check reads the
 * batches the file names).
 */
export async function readStoredInputs(
  root: string,
  batches?: ReadonlySet<string>,
) {
  const legalRecords: {
    batch: string;
    externalKey: string;
    comparison: unknown;
  }[] = [];
  // Through the loader, so an encoded record decodes; `batches` names each
  // record by its label.
  const named = (name: string) =>
    !batches || [...batches].some((batch) => batch === legalRecordLabel(name));
  for (const { name, record } of readLegalRecordsIn(root, named))
    for (const candidate of readArray(readObject(record).candidates)) {
      const { externalKey, comparison } = readObject(candidate);
      if (typeof externalKey === 'string')
        legalRecords.push({
          batch: legalRecordLabel(name),
          externalKey,
          comparison,
        });
    }
  const assessments = readArray(
    JSON.parse(
      await readFile(
        join(root, 'src/lib/catalog/data/attribution-assessments.json'),
        'utf8',
      ),
    ),
  ).flatMap((item) => {
    const { externalKey, requiredNotices } = readObject(item);
    return typeof externalKey === 'string'
      ? [{ externalKey, requiredNotices: readStrings(requiredNotices) }]
      : [];
  });
  return { legalRecords, assessments };
}
