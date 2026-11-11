import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { pcgenPin, pins } from './inventory.ts';
import { readArray, readObject, readStrings } from './values.ts';
import type { PreviewEntry } from './map.ts';
import {
  pcgenBooks,
  pcgenNoticeBooks,
  type pcgenBooksSchema,
} from './pcgen-books.ts';
import { declaredBookCode, isNonEmpty } from './legal/attribution-227.ts';
import {
  attribution227MatchesSchema,
  matchesSha256,
  type Attribution227Match,
  type Attribution227Matches,
} from './legal/attribution-227-matches.ts';
import type { z } from 'zod';

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
  'scripts/catalog/pcgen-notice-books.json',
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

type PcgenBooks = z.infer<typeof pcgenBooksSchema>;
/**
 * The crosswalk's folders with the code that applies to them: an automatic
 * code, or a reviewed one whose review is checked (a drafted review applies
 * nothing).
 */
export function pcgenBookFolders(
  crosswalks: readonly PcgenBooks[] = [pcgenBooks, pcgenNoticeBooks],
) {
  const folders = new Map<string, string>();
  for (const { books } of crosswalks)
    for (const { code, packs } of books)
      if (code.match === 'automatic' || code.review.status === 'checked')
        for (const { folder } of packs) folders.set(folder, code.id);
  return folders;
}

/** A file's book: the code of the longest crosswalk folder it sits in. */
function bookOfFile(folders: ReadonlyMap<string, string>, file: string) {
  const parts = file.split('/');
  for (let length = parts.length - 1; length > 0; length--) {
    const code = folders.get(parts.slice(0, length).join('/'));
    if (code) return code;
  }
  return undefined;
}

/** A file under the PCGen pin's data directory, by its path there. */
export type PcgenFile = { path: string; text: string };
type PcgenHit = {
  family: PcgenFamily;
  book: string;
  file: string;
  line: number;
};
export type PcgenNameIndex = ReadonlyMap<string, readonly PcgenHit[]>;

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
  const index = new Map<string, PcgenHit[]>();
  const add = (name: string, hit: PcgenHit) => {
    const key = matchName(name);
    if (!key) return;
    const hits = index.get(key) ?? [];
    if (!hits.some((other) => sameHit(other, hit))) hits.push(hit);
    index.set(key, hits);
  };
  const lists = files
    .filter(({ path }) => path.endsWith('.lst'))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const { path, text } of lists) {
    const book = bookOfFile(folders, path);
    const listTypes = types.get(path);
    if (!book || !listTypes) continue;
    text.split(/\r\n|\r|\n/).forEach((line, offset) => {
      const object = listObject(line);
      if (!object) return;
      for (const type of listTypes) {
        const family = lineFamily(type, object.category, path);
        if (!family) continue;
        const hit = { family, book, file: path, line: offset + 1 };
        add(object.name, hit);
        if (object.key) add(object.key, hit);
      }
    });
  }
  return index;
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

/** A list line's object: its column-1 name, `CATEGORY:` and `KEY:`, if it names one. */
function listObject(line: string) {
  const tokens = line.split('\t');
  const name = tokens[0]?.trim() ?? '';
  if (
    !name ||
    name.startsWith('#') ||
    /^[A-Z]+:/.test(name) ||
    /\.(?:MOD|COPY|FORGET)\b/.test(name)
  )
    return undefined;
  const tag = (prefix: string) =>
    tokens.find((token) => token.startsWith(prefix))?.slice(prefix.length);
  return { name, category: tag('CATEGORY:'), key: tag('KEY:') };
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
 * feature also takes its classes' declared books; one whose only book is its
 * class's, or whose PCGen match names several books and none of them its
 * class's, is held.
 */
export function matchRecord(
  record: MatcherRecord,
  {
    index,
    classBooks,
    stored,
  }: { index: PcgenNameIndex; classBooks: ClassBooks; stored: StoredBooks },
): Attribution227Match | undefined {
  const pcgen = pcgenEvidenceOf(record, index);
  const storedBooks = stored.get(record.externalKey);
  const evidence = [
    ...pcgen,
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
  if (!isNonEmpty(evidence))
    return isNonEmpty(classes)
      ? { ...base, status: 'held', hold: { kind: 'association-only', classes } }
      : undefined;
  const classCodes = new Set(classes.flatMap(({ books }) => books));
  if (
    isNonEmpty(classes) &&
    isNonEmpty(pcgen) &&
    pcgen.length > 1 &&
    !pcgen.some(({ book }) => classCodes.has(book))
  )
    return {
      ...base,
      status: 'held',
      hold: { kind: 'class-book-disagrees', evidence: pcgen, classes },
    };
  return { ...base, status: 'matched', evidence, classes };
}

/**
 * A record's PCGen lines of its family: the first name variant that has any,
 * one line per book (the first in path order), sorted by book.
 */
function pcgenEvidenceOf(record: MatcherRecord, index: PcgenNameIndex) {
  const family = familyOfKind[record.detail.kind];
  if (!family) return [];
  const hits =
    nameVariants(record.name)
      .map((name) =>
        (index.get(matchName(name)) ?? []).filter(
          (hit) => hit.family === family,
        ),
      )
      .find((found) => found.length) ?? [];
  return [...new Set(hits.map(({ book }) => book))].sort().flatMap((book) => {
    const hit = hits.find((item) => item.book === book);
    return hit
      ? [{ kind: 'pcgen' as const, book, file: hit.file, line: hit.line }]
      : [];
  });
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
 * The matches of the records that declare no book (an entry with an
 * attribution owner is matched as its owner), sorted by key, with their
 * binding.
 */
export function buildAttribution227Matches({
  entries,
  index,
  stored,
  inputs,
}: {
  entries: readonly PreviewEntry[];
  index: PcgenNameIndex;
  stored: StoredBooks;
  inputs: Readonly<Record<string, string>>;
}): Attribution227Matches {
  const classBooks = classBooksOf(entries);
  const matches = entries
    .filter(
      ({ sources, attributionFrom }) => !sources.length && !attributionFrom,
    )
    .flatMap((entry) => matchRecord(entry, { index, classBooks, stored }) ?? [])
    .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));
  return attribution227MatchesSchema.parse({
    version: 1,
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

/** The file's text: its header indented, each match on one line. */
export function serializeAttribution227Matches(
  document: Attribution227Matches,
) {
  const { matches, ...header } = document;
  const head = JSON.stringify({ ...header, matches: [] }, null, 2);
  if (!matches.length) return `${head}\n`;
  const lines = matches.map((match) => `    ${JSON.stringify(match)}`);
  return `${head.replace(/"matches": \[\]\n}$/, `"matches": [\n${lines.join(',\n')}\n  ]\n}`)}\n`;
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

/** Whether a PCGen checkout is clean at `pcgenPin`. */
export function verifyPcgenCheckout(checkout: string) {
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', checkout, ...args], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  if (git('rev-parse', 'HEAD') !== pcgenPin.commit)
    throw new Error(`PCGen checkout ${checkout} is not at ${pcgenPin.commit}.`);
  if (git('status', '--porcelain', '--', pcgenPin.directory))
    throw new Error(`PCGen checkout ${checkout} has local changes.`);
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
  const directory = 'scripts/catalog/legal';
  for (const file of (await readdir(join(root, directory))).sort()) {
    const batch = `${directory}/${file}`;
    if (!file.endsWith('.json') || (batches && !batches.has(batch))) continue;
    const data: unknown = JSON.parse(await readFile(join(root, batch), 'utf8'));
    for (const candidate of readArray(readObject(data).candidates)) {
      const { externalKey, comparison } = readObject(candidate);
      if (typeof externalKey === 'string')
        legalRecords.push({ batch, externalKey, comparison });
    }
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
