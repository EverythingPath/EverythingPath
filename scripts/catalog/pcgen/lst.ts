import { readdir, readFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { normalizePcgenBookTitle } from '../pcgen-books';
import {
  appendTo,
  toPcgenKey,
  type PcgenKey,
  type PcgenKeyIndex,
} from './keys';
import { planLoadOrder, type PcgenFileLoad } from './pcc';
import {
  type PcgenPrerequisite,
  isPrerequisiteToken,
  parsePrerequisite,
} from './pre';
import {
  keyOf,
  lineGrants,
  lineTokens,
  parseLevelToken,
  splitLines,
  tagValue,
  type PcgenGrant,
  type PcgenLevelLine,
  type PcgenLine,
} from './tokens';

/**
 * The PCGen LST reader's raw source inventory (#716 plan §2, §5): every
 * ability record (archetypes, Special Abilities, `CATEGORY:Class` records and
 * the rest), every prestige class, and every `.MOD`, `.COPY` and `.FORGET`
 * line, each with its locator, pack, book, page, Product Identity flags and
 * `.pcc` load. `effective.ts` merges these into PCGen's effective records.
 *
 * - A line is tab-separated `TAG:value` tokens; its first token is the
 *   record's name. Files are read in path order, as the inventory script
 *   (`716-inventory.py`) walks them.
 * - A record's locator is `{file, line, key}`, the PCGen locator of the import
 *   schema: KEY is stable, and the line is only reported.
 * - A pack is the folder whose `.pcc` loads the file: a `support/` folder
 *   without its own `.pcc` belongs to its parent, and a `_pfs/` folder with
 *   one is its own pack. The book is the file's SOURCELONG, else its pack's
 *   `.pcc` SOURCELONG, without the Companion line prefix.
 * - Keys ignore case, as in PCGen. Records with the same key are source
 *   variants and stay apart: nothing is overwritten or merged by name.
 * - A class block's level lines are `<level>` or `<level>:REPEATLEVEL:<every>`
 *   lines; a repeating line keeps its interval (`levelsOf` expands it).
 *   Prestige blocks (`TYPE:…Prestige…`) and base class blocks (`TYPE:Base…`)
 *   are both retained (#716 P7-0): a base class grants many of its features
 *   only on its level lines (`2	ABILITY:…|Brawler ~ Bonus Feats|…`). An
 *   `Ex-<Class>` block, the class a character falls back to, is skipped.
 * - A `.MOD` (ability or `CLASS:<name>.MOD` with its level lines) binds to the
 *   same-key record in its own pack; from a pack with no record of that key
 *   it binds to every record of the key, as a potential target.
 * - A `.COPY=<new>` line is a record of its own, its key the new name (or its
 *   KEY), inheriting its source's Product Identity flags; `copyOf` names it.
 * - A `.FORGET` line binds to every same-key record, copies included, in any
 *   source: PCGen applies forgets after all records, copies and
 *   modifications, to the object loaded under the key
 *   (`LstObjectFileLoader.java:96-103`, `:629`).
 * - A record's raw `grants` are its own lines' and its bound `.MOD` lines',
 *   the potential grants the owned-feature inventory follows.
 */
export type PcgenLocator = { file: string; line: number; key: string };
export type PcgenDirective = PcgenLine & {
  kind: 'mod' | 'copy' | 'forget';
  /** The target's ability category, or `CLASS` for a `CLASS:` directive. */
  category: string;
  key: string;
  /** For `.COPY=<new>`, the new name. */
  copyName: string | null;
  pack: string;
  load: PcgenFileLoad;
  /** A `CLASS:<name>.MOD` block's level lines. */
  levelLines: PcgenLevelLine[];
};
/** `same-pack`: from the record's own pack; `other-pack`: from a pack with no record of the key. */
export type PcgenBoundMod = PcgenDirective & {
  binding: 'same-pack' | 'other-pack';
};
export type PcgenRecord = {
  locator: PcgenLocator;
  /** The ability category (`Special Ability`), or `CLASS` for a prestige class. */
  category: string;
  /** The display name: the line's first token. */
  name: string;
  /** All of the line's tokens, the name first. */
  tokens: string[];
  /** The record line's raw text, which structure records hash (plan §6). */
  text: string;
  pack: string;
  book: string;
  /** The book's SOURCESHORT, such as `AG`, read like its SOURCELONG; null without one. */
  bookShort: string | null;
  /** In a `_pfs` (Pathfinder Society) folder. */
  isPfs: boolean;
  page: string | null;
  isNamePI: boolean;
  isDescPI: boolean;
  load: PcgenFileLoad;
  /** Grants on the record's own lines, then on its bound `.MOD` lines. */
  grants: PcgenGrant[];
  mods: PcgenBoundMod[];
  forgottenBy: PcgenDirective[];
  /** For a `.COPY` record, its `.COPY` line. */
  copyOf: PcgenDirective | null;
};
/** A `CLASS:` block: its record line, its other `CLASS:<name>` lines and its level lines. */
export type PcgenClassBlock = PcgenRecord & {
  /** Every `CLASS:<name>` line of the block, the record line first. */
  classLines: PcgenLine[];
  /** The block's own level lines. */
  levelLines: PcgenLevelLine[];
  /** The PRExxx tokens of the block's `CLASS:<name>` lines. */
  prerequisites: PcgenPrerequisite[];
};
export type PcgenPrestigeClass = PcgenClassBlock;
/** Records by folded key; same-key variants in path order. */
export type PcgenIndex = PcgenKeyIndex<PcgenRecord>;
export type PcgenTree = {
  /** Every `CATEGORY:Archetype` record line, in path order. */
  archetypes: PcgenRecord[];
  prestigeClasses: PcgenPrestigeClass[];
  /** Base class blocks (`TYPE:Base…`), `Ex-<Class>` blocks skipped. */
  baseClasses: PcgenClassBlock[];
  /** `CATEGORY:Special Ability` records. */
  features: PcgenIndex;
  /** `CATEGORY:Class` records (a prestige class's class features). */
  classRecords: PcgenIndex;
  /** Every ability record, by folded category. */
  abilities: ReadonlyMap<PcgenKey, PcgenIndex>;
  /** ABILITYCATEGORY name → its parent CATEGORY, the first definition winning. */
  abilityCategories: ReadonlyMap<string, string>;
  /** Every `.MOD`, `.COPY` and `.FORGET` line, in path order. */
  directives: PcgenDirective[];
};

/** Looks a key up in an index, folding its case. */
export function recordsByKey(index: PcgenIndex, key: string) {
  return index.get(toPcgenKey(key)) ?? [];
}

/** Path order of the inventory script: by folder, then by file name. */
function comparePaths(a: string, b: string) {
  const [folderA, folderB] = [posix.dirname(a), posix.dirname(b)];
  if (folderA !== folderB) return folderA < folderB ? -1 : 1;
  const [nameA, nameB] = [posix.basename(a), posix.basename(b)];
  return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
}

async function listTreeFiles(root: string) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      posix.join(
        relative(root, entry.parentPath).split(sep).join('/'),
        entry.name,
      ),
    )
    .sort(comparePaths);
}

async function readTexts(root: string, files: readonly string[]) {
  const texts = new Map<string, string>();
  for (const file of files)
    if (file.endsWith('.lst') || file.endsWith('.pcc'))
      texts.set(file, (await readFile(join(root, file))).toString('utf8'));
  return texts;
}

type FileContext = {
  file: string;
  pack: string;
  book: string;
  bookShort: string | null;
  isPfs: boolean;
  load: PcgenFileLoad;
};

/**
 * A file's book and SOURCESHORT: from its own SOURCELONG header line, else
 * from the first `.pcc` of its folder (or parent) with a SOURCELONG, both
 * taken from the same source.
 */
function publicationOf(
  file: string,
  texts: ReadonlyMap<string, string>,
  pccs: ReadonlyMap<string, string[]>,
) {
  const lineOf = (text: string, tag: string) =>
    splitLines(text).find((line) => line.startsWith(`${tag}:`));
  const shortOf = (line: string | undefined) => {
    const short = line
      ?.split('\t')
      .find((token) => token.startsWith('SOURCESHORT:'))
      ?.slice('SOURCESHORT:'.length)
      .trim();
    return short === undefined || short === '' ? null : short;
  };
  const own = lineOf(texts.get(file) ?? '', 'SOURCELONG');
  if (own !== undefined)
    return {
      book: normalizePcgenBookTitle(
        (own.split('\t')[0] ?? '').slice('SOURCELONG:'.length).trim(),
      ),
      bookShort: shortOf(own),
    };
  const folder = posix.dirname(file);
  for (const candidate of [folder, posix.dirname(folder)])
    for (const pcc of pccs.get(candidate) ?? []) {
      const text = texts.get(pcc) ?? '';
      const line = lineOf(text, 'SOURCELONG');
      if (line !== undefined)
        return {
          book: normalizePcgenBookTitle(
            line.trim().slice('SOURCELONG:'.length),
          ),
          bookShort: shortOf(lineOf(text, 'SOURCESHORT')),
        };
    }
  return { book: '?', bookShort: null };
}

/** Each list file's pack, book and load. */
function fileContexts(texts: ReadonlyMap<string, string>, files: string[]) {
  const pccs = new Map<string, string[]>();
  for (const file of files)
    if (file.endsWith('.pcc')) appendTo(pccs, posix.dirname(file), file);
  const listFiles = files.filter((file) => file.endsWith('.lst'));
  const loads = planLoadOrder(
    new Map([...texts].filter(([file]) => file.endsWith('.pcc'))),
    listFiles,
  );
  return listFiles.map((file): FileContext => {
    const folder = posix.dirname(file);
    return {
      file,
      pack: pccs.has(folder) ? folder : posix.dirname(folder),
      ...publicationOf(file, texts, pccs),
      isPfs: file.split('/').includes('_pfs'),
      load: loads.get(file) ?? {
        position: Infinity,
        condition: null,
        isListed: false,
      },
    };
  });
}

type Parsed = {
  records: PcgenRecord[];
  prestigeClasses: PcgenPrestigeClass[];
  baseClasses: PcgenClassBlock[];
  directives: PcgenDirective[];
  abilityCategories: Map<string, string>;
};
type ClassBlock =
  | { kind: 'record'; record: PcgenClassBlock }
  | { kind: 'mod'; directive: PcgenDirective }
  | null;

function newRecord(
  context: FileContext,
  here: PcgenLine,
  category: string,
  key: string,
): PcgenRecord {
  const { tokens } = here;
  return {
    locator: { file: here.file, line: here.line, key },
    category,
    name: tokens[0] ?? '',
    tokens,
    text: here.text,
    pack: context.pack,
    book: context.book,
    bookShort: context.bookShort,
    isPfs: context.isPfs,
    page: tagValue(tokens, 'SOURCEPAGE'),
    isNamePI: tokens.includes('NAMEISPI:YES'),
    isDescPI: tokens.includes('DESCISPI:YES'),
    load: context.load,
    grants: lineGrants(here),
    mods: [],
    forgottenBy: [],
    copyOf: null,
  };
}

function newDirective(
  context: FileContext,
  here: PcgenLine,
  fields: Pick<PcgenDirective, 'kind' | 'category' | 'key' | 'copyName'>,
): PcgenDirective {
  return {
    ...here,
    ...fields,
    pack: context.pack,
    load: context.load,
    levelLines: [],
  };
}

const prerequisitesOf = (tokens: readonly string[]) =>
  tokens.slice(1).filter(isPrerequisiteToken).map(parsePrerequisite);

/** A `CLASS:` line's block kind, from its TYPE: a prestige or base class, or neither. */
function classKindOf(name: string, tokens: readonly string[]) {
  const types = (tagValue(tokens, 'TYPE') ?? '').split('.');
  if (types.some((type) => type.includes('Prestige'))) return 'prestige';
  return types.includes('Base') && !name.startsWith('Ex-') ? 'base' : null;
}

/** A `CLASS:` line: a prestige or base class record, its block's next line, or a class directive. */
function readClassLine(
  context: FileContext,
  here: PcgenLine,
  block: ClassBlock,
  parsed: Parsed,
): ClassBlock {
  const name = (here.tokens[0] ?? '').slice('CLASS:'.length);
  for (const kind of ['mod', 'forget'] as const) {
    const suffix = kind === 'mod' ? '.MOD' : '.FORGET';
    if (!name.endsWith(suffix)) continue;
    const key = name.slice(0, -suffix.length);
    const directive = newDirective(context, here, {
      kind,
      category: 'CLASS',
      key,
      copyName: null,
    });
    parsed.directives.push(directive);
    return kind === 'mod' ? { kind: 'mod', directive } : null;
  }
  const classKind = classKindOf(name, here.tokens);
  const isContinuation =
    block?.kind === 'record' && block.record.locator.key === name;
  if (classKind === 'prestige' || (classKind === 'base' && !isContinuation)) {
    const record: PcgenClassBlock = {
      ...newRecord(context, here, 'CLASS', name),
      classLines: [here],
      levelLines: [],
      prerequisites: prerequisitesOf(here.tokens),
    };
    (classKind === 'prestige'
      ? parsed.prestigeClasses
      : parsed.baseClasses
    ).push(record);
    return { kind: 'record', record };
  }
  if (block?.kind !== 'record' || !isContinuation) return null;
  block.record.classLines.push(here);
  block.record.grants.push(...lineGrants(here));
  block.record.prerequisites.push(...prerequisitesOf(here.tokens));
  return block;
}

function readLevelLine(
  here: PcgenLine,
  level: NonNullable<ReturnType<typeof parseLevelToken>>,
  block: NonNullable<ClassBlock>,
) {
  const levelLine = { ...here, ...level };
  if (block.kind === 'mod') {
    block.directive.levelLines.push(levelLine);
    return;
  }
  block.record.levelLines.push(levelLine);
  block.record.grants.push(...lineGrants(here));
}

const directivePatterns = [
  { kind: 'mod', pattern: /^CATEGORY=([^|]+)\|(.+)\.MOD$/ },
  { kind: 'copy', pattern: /^CATEGORY=([^|]+)\|(.+)\.COPY=(.+)$/ },
  { kind: 'forget', pattern: /^CATEGORY=([^|]+)\|(.+)\.FORGET$/ },
] as const;

/** An ability line: a directive, a record with a CATEGORY, or neither. */
function readAbilityLine(
  context: FileContext,
  here: PcgenLine,
  parsed: Parsed,
) {
  const first = here.tokens[0] ?? '';
  for (const { kind, pattern } of directivePatterns) {
    const match = pattern.exec(first);
    if (!match) continue;
    const [, category = '', key = '', copyName = null] = match;
    parsed.directives.push(
      newDirective(context, here, { kind, category, key, copyName }),
    );
    return;
  }
  if (/\.(MOD|COPY|FORGET)\b/.test(first)) return;
  const category = tagValue(here.tokens, 'CATEGORY');
  if (category === null) return;
  parsed.records.push(
    newRecord(context, here, category, keyOf(here.tokens, first)),
  );
}

function defineCategory(text: string, parsed: Parsed) {
  const tokens = lineTokens(text);
  const name = (tokens[0] ?? '').slice('ABILITYCATEGORY:'.length);
  if (!parsed.abilityCategories.has(name))
    parsed.abilityCategories.set(name, tagValue(tokens, 'CATEGORY') ?? '');
}

function parseListFile(context: FileContext, text: string, parsed: Parsed) {
  let block: ClassBlock = null;
  for (const [index, line] of splitLines(text).entries()) {
    if (line.startsWith('ABILITYCATEGORY:')) {
      defineCategory(line, parsed);
      continue;
    }
    if (line.startsWith('#') || line.trim() === '') continue;
    const here: PcgenLine = {
      file: context.file,
      line: index + 1,
      tokens: lineTokens(line),
      text: line,
    };
    const first = here.tokens[0] ?? '';
    const level = parseLevelToken(first);
    if (first.startsWith('CLASS:'))
      block = readClassLine(context, here, block, parsed);
    else if (level && block) readLevelLine(here, level, block);
    else readAbilityLine(context, here, parsed);
  }
}

function indexByCategory(records: readonly PcgenRecord[]) {
  const abilities = new Map<PcgenKey, Map<PcgenKey, PcgenRecord[]>>();
  for (const record of records) {
    const category = toPcgenKey(record.category);
    const index = abilities.get(category) ?? new Map<PcgenKey, PcgenRecord[]>();
    abilities.set(category, index);
    appendTo(index, toPcgenKey(record.locator.key), record);
  }
  return abilities;
}

/** `.COPY` records, each inheriting its source variants' PI flags. */
function copyRecords(
  directives: readonly PcgenDirective[],
  abilities: ReadonlyMap<PcgenKey, PcgenIndex>,
  contexts: ReadonlyMap<string, FileContext>,
) {
  return directives
    .filter((directive) => directive.kind === 'copy')
    .flatMap((directive) => {
      const context = contexts.get(directive.file);
      if (!context) return [];
      const name = directive.copyName ?? '';
      const record = newRecord(
        context,
        { ...directive, tokens: [name, ...directive.tokens.slice(1)] },
        directive.category,
        keyOf(directive.tokens, name),
      );
      const sources = recordsByKey(
        abilities.get(toPcgenKey(directive.category)) ?? new Map(),
        directive.key,
      );
      record.isNamePI ||= sources.some((source) => source.isNamePI);
      record.isDescPI ||= sources.some((source) => source.isDescPI);
      record.copyOf = directive;
      return [record];
    });
}

/** A `.FORGET` names every same-key record (`LstObjectFileLoader.java:629`). */
function bindForget(
  directive: PcgenDirective,
  variants: readonly PcgenRecord[],
) {
  for (const record of variants) record.forgottenBy.push(directive);
}

/** A `.MOD` binds to its own pack's variants, else to every variant. */
function bindMod(directive: PcgenDirective, variants: readonly PcgenRecord[]) {
  const hasOwnPackVariant = variants.some(
    (record) => record.pack === directive.pack,
  );
  for (const record of variants) {
    if (hasOwnPackVariant && record.pack !== directive.pack) continue;
    record.mods.push({
      ...directive,
      binding: hasOwnPackVariant ? 'same-pack' : 'other-pack',
    });
    record.grants.push(
      ...lineGrants(directive),
      ...directive.levelLines.flatMap(lineGrants),
    );
  }
}

function bindDirectives(
  directives: readonly PcgenDirective[],
  targetsOf: (directive: PcgenDirective) => readonly PcgenRecord[],
) {
  for (const directive of directives) {
    if (directive.kind === 'forget')
      bindForget(directive, targetsOf(directive));
    if (directive.kind === 'mod') bindMod(directive, targetsOf(directive));
  }
}

function parseListFiles(
  contexts: readonly FileContext[],
  texts: ReadonlyMap<string, string>,
) {
  const parsed: Parsed = {
    records: [],
    prestigeClasses: [],
    baseClasses: [],
    directives: [],
    abilityCategories: new Map(),
  };
  for (const context of contexts)
    parseListFile(context, texts.get(context.file) ?? '', parsed);
  return parsed;
}

/** A `CLASS:<name>.MOD` or `.FORGET` line, as against a `CATEGORY=CLASS|…` ability directive. */
const isClassLineDirective = (directive: PcgenDirective) =>
  (directive.tokens[0] ?? '').startsWith('CLASS:');

/**
 * The records a directive names: class blocks for a `CLASS:` line, else
 * ability records of its category (`CATEGORY=CLASS|Kineticist.MOD` names the
 * `Kineticist	CATEGORY:CLASS` record).
 */
function directiveTargets(
  abilities: ReadonlyMap<PcgenKey, PcgenIndex>,
  classBlocks: readonly PcgenClassBlock[],
) {
  const classIndex =
    indexByCategory(classBlocks).get(toPcgenKey('CLASS')) ?? new Map();
  return (directive: PcgenDirective) =>
    recordsByKey(
      isClassLineDirective(directive)
        ? classIndex
        : (abilities.get(toPcgenKey(directive.category)) ?? new Map()),
      directive.key,
    );
}

/** Reads every list file under a PCGen data folder (`pcgenPin.directory`). */
export async function readPcgenTree(root: string): Promise<PcgenTree> {
  const files = await listTreeFiles(root);
  const texts = await readTexts(root, files);
  const contexts = fileContexts(texts, files);
  const parsed = parseListFiles(contexts, texts);
  const records = [
    ...parsed.records,
    ...copyRecords(
      parsed.directives,
      indexByCategory(parsed.records),
      new Map(contexts.map((context) => [context.file, context])),
    ),
  ];
  const abilities = indexByCategory(records);
  bindDirectives(
    parsed.directives,
    directiveTargets(abilities, [
      ...parsed.prestigeClasses,
      ...parsed.baseClasses,
    ]),
  );
  const empty: PcgenIndex = new Map();
  return {
    archetypes: records.filter(
      (record) => toPcgenKey(record.category) === toPcgenKey('Archetype'),
    ),
    prestigeClasses: parsed.prestigeClasses,
    baseClasses: parsed.baseClasses,
    features: abilities.get(toPcgenKey('Special Ability')) ?? empty,
    classRecords: abilities.get(toPcgenKey('Class')) ?? empty,
    abilities,
    abilityCategories: parsed.abilityCategories,
    directives: parsed.directives,
  };
}
