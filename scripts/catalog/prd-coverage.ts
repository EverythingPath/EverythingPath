import { parse, type DefaultTreeAdapterMap } from 'parse5';
import {
  classExclusionNameSchema,
  exclusionNameSchema,
  type ChecklistItem,
  type ClassCoverageItem,
  type ClassExclusionName,
  type CoverageItem,
  type ExclusionName,
} from './prd-manifest.ts';

/**
 * The books whose archetype pages the capture holds (plan §1, "PRD capture"),
 * by the checklist's book codes (`pcgen-books.json`).
 */
export const prdArchetypeBooks = {
  PZO1115: 'APG',
  PZO1117: 'UM',
  PZO1118: 'UC',
  PZO1121: 'ARG',
  PZO1129: 'ACG',
  PZO1130: 'MC',
  PZO1132: 'OA',
  PZO9272: 'TG',
} as const;
const archetypeBooks = new Map(Object.entries(prdArchetypeBooks));
const bookOf = (id: string) => archetypeBooks.get(id) ?? null;

/**
 * Checklist archetypes the capture deliberately lacks, each with its reason
 * and every item it covers.
 */
export const prdExclusions = {
  'arg-uncommon-races': {
    reason:
      "The plan captures ARG's core and featured races only (plan §1); these archetypes are in its uncommon races (ARG pp.185–210).",
    items: [
      'Alchemist (Bogborn Alchemist)',
      'Alchemist (Deep Bomber)',
      'Bard (Shadow Puppeteer)',
      'Druid (Naga Aspirant)',
      'Fighter (Airborne Ambusher)',
      'Magus (Elemental Knight)',
      'Monk (Gray disciple)',
      'Monk (Treetop Monk)',
      'Oracle (Reincarnated Oracle)',
      'Ranger (Wave Warden)',
      'Rogue (Deadly Courtesan)',
      'Rogue (Eldritch Raider)',
      'Rogue (Kitsune Trickster)',
      'Witch (Dreamweaver)',
    ],
  },
} as const satisfies Record<
  ExclusionName,
  { reason: string; items: readonly string[] }
>;

/**
 * Checklist archetypes the PRD prints under another heading or in another
 * book than the checklist gives.
 */
const printedAs: Record<string, { book: string; heading: string }> = {
  // The checklist cites ARG p.43, which prints Bonded Witch (its own
  // checklist item); the PRD prints Beast-Bonded in Ultimate Magic's witch
  // options.
  'Witch (Beast-Bonded)': { book: 'UM', heading: 'Beast-Bonded' },
  // The PRD prints the Technology Guide's p.13 rogue archetype as Technic
  // Scavenger, with the same class features.
  'Rogue (Numerian Scavenger)': { book: 'TG', heading: 'Technic Scavenger' },
};

/** The checklist archetypes from a book the capture holds. */
export function archetypesInScope(items: readonly ChecklistItem[]) {
  return items.filter((item) =>
    item.sources.some((source) => bookOf(source.id)),
  );
}

const normalized = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type HtmlNode = DefaultTreeAdapterMap['childNode'];

const textOf = (node: HtmlNode): string =>
  node.nodeName === '#text' && 'value' in node
    ? node.value
    : 'childNodes' in node
      ? node.childNodes.map(textOf).join('')
      : '';

/** A page's headings (`h1`–`h6`), normalized. */
function headingsOf(html: string) {
  const headings: string[] = [];
  const visit = (node: HtmlNode) => {
    if (/^h[1-6]$/.test(node.nodeName)) headings.push(normalized(textOf(node)));
    else if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  parse(html).childNodes.forEach(visit);
  return headings;
}

/**
 * The heading the PRD prints an archetype under: its name without the
 * checklist's class and disambiguator (`Alchemist (Grenadier [MC])` is
 * printed as `Grenadier (Alchemist)`), in its book.
 */
function printedHeading(item: ChecklistItem, book: string) {
  const known = printedAs[item.name];
  if (known) return known;
  const name = /^[^(]+\((.*)\)$/.exec(item.name)?.[1] ?? item.name;
  return {
    book,
    heading: name.replace(/\s*(?:\[[^\]]*\]|\([^)]*\))$/, ''),
  };
}

const exclusionOf = (name: string) =>
  exclusionNameSchema.options.find((exclusion) =>
    prdExclusions[exclusion].items.some((item) => item === name),
  ) ?? null;

/**
 * Where the capture holds each checklist archetype from a book it covers: the
 * one page of the archetype's book with a heading that starts with its
 * printed name, or its named exclusion. Throws for an archetype on no page or
 * on several, and for an excluded one found on a page.
 */
export function coverageOf({
  items,
  pages,
}: {
  items: readonly ChecklistItem[];
  pages: readonly { path: string; book: string; html: string }[];
}): CoverageItem[] {
  const headed = pages.map((page) => ({
    ...page,
    headings: headingsOf(page.html),
  }));
  return archetypesInScope(items).map((item) => {
    const book =
      item.sources.map((source) => bookOf(source.id)).find(Boolean) ?? '';
    const { book: printedBook, heading } = printedHeading(item, book);
    const name = normalized(heading);
    const found = headed.filter(
      (page) =>
        page.book === printedBook &&
        page.headings.some(
          (text) => text === name || text.startsWith(`${name} `),
        ),
    );
    const exclusion = exclusionOf(item.name);
    if (exclusion && found.length === 0)
      return { kind: 'excluded', item: item.file, name: item.name, exclusion };
    const [page, ...others] = found;
    if (exclusion || !page || others.length > 0)
      throw new Error(
        `${item.name} (${book}) is on ${
          exclusion
            ? `${found.length} captured pages despite exclusion ${exclusion}`
            : page
              ? `several captured pages: ${found.map((p) => p.path).join(', ')}`
              : 'no captured page'
        }.`,
      );
    return { kind: 'page', item: item.file, name: item.name, page: page.path };
  });
}

// --- Base classes (#716 P8b) -------------------------------------------------

/**
 * A base-class schedule #716 owes: its seed identity, its name, the book that
 * prints the class (the capture's book codes; `UI` and `UW` are Ultimate
 * Intrigue and Ultimate Wilderness) and its class table's caption.
 */
export type ClassSchedule = {
  schedule: string;
  name: string;
  book: string;
  table: string;
};

const printedClass = (book: string, ...names: string[]) =>
  names.map((name) => ({
    schedule: name.toLowerCase(),
    name,
    book,
    table: name,
  }));
const unchainedClass = (name: string) => ({
  schedule: `unchained-${name.toLowerCase()}`,
  name: `${name} (Unchained)`,
  book: 'PU',
  table: `Unchained ${name}`,
});

/**
 * The 40 base-class schedules P7 owes: 36 base classes and 4 Unchained ones
 * (research/716-p7-rules.md §1; P5 and P6 built Fighter, Ranger, Rogue and
 * Wizard).
 */
export const prdClassSchedules: readonly ClassSchedule[] = [
  ...printedClass(
    'CRB',
    'Barbarian',
    'Bard',
    'Cleric',
    'Druid',
    'Monk',
    'Paladin',
    'Sorcerer',
  ),
  ...printedClass(
    'APG',
    'Alchemist',
    'Antipaladin',
    'Cavalier',
    'Inquisitor',
    'Oracle',
    'Summoner',
    'Witch',
  ),
  ...printedClass('UM', 'Magus'),
  ...printedClass('UC', 'Gunslinger', 'Ninja', 'Samurai'),
  ...printedClass(
    'ACG',
    'Arcanist',
    'Bloodrager',
    'Brawler',
    'Hunter',
    'Investigator',
    'Shaman',
    'Skald',
    'Slayer',
    'Swashbuckler',
    'Warpriest',
  ),
  ...printedClass(
    'OA',
    'Kineticist',
    'Medium',
    'Mesmerist',
    'Occultist',
    'Psychic',
    'Spiritualist',
  ),
  ...['Barbarian', 'Monk', 'Rogue', 'Summoner'].map(unchainedClass),
  ...printedClass('UI', 'Vigilante'),
  ...printedClass('UW', 'Shifter'),
];

/**
 * Schedules whose class table the capture can't hold, with the evidence; they
 * stay pending table review.
 */
export const prdClassExclusions = {
  'not-in-prd': {
    reason:
      "The PRD's book list, its root page (pages/index.html), has no Ultimate Intrigue or Ultimate Wilderness pages, the books that print the vigilante and the shifter; these schedules stay pending table review.",
    books: ['Ultimate Intrigue', 'Ultimate Wilderness'],
    schedules: ['vigilante', 'shifter'],
  },
} as const satisfies Record<
  ClassExclusionName,
  { reason: string; books: readonly string[]; schedules: readonly string[] }
>;

const classExclusionOf = (schedule: string) =>
  classExclusionNameSchema.options.find((exclusion) =>
    prdClassExclusions[exclusion].schedules.some((name) => name === schedule),
  ) ?? null;

/**
 * A page's class tables: the normalized captions, without a "Table:" prefix,
 * of its tables that print a level progression (a Base Attack Bonus column).
 */
function classTablesOf(html: string) {
  const captions: string[] = [];
  const visit = (node: HtmlNode) => {
    if (node.nodeName === 'table' && 'childNodes' in node) {
      const caption = node.childNodes.find(
        (child) => child.nodeName === 'caption',
      );
      if (caption && normalized(textOf(node)).includes('base attack bonus'))
        captions.push(normalized(textOf(caption).replace(/^\s*table:/i, '')));
    } else if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  parse(html).childNodes.forEach(visit);
  return captions;
}

/**
 * One level row of a class table: its Special column's entries, every
 * single-column cell by its header (`Unarmed Damage`, the monk's), and its
 * line on the page.
 */
export type ClassTableRow = {
  level: number;
  special: string[];
  columns: Readonly<Record<string, string>>;
  line: number;
};

const cellsOf = (row: HtmlNode, name: 'td' | 'th') =>
  'childNodes' in row
    ? row.childNodes.filter((child) => child.nodeName === name)
    : [];
const columnSpan = (cell: HtmlNode) =>
  Number(
    ('attrs' in cell ? cell.attrs : []).find(({ name }) => name === 'colspan')
      ?.value ?? 1,
  );

/**
 * The level rows of the page's class table captioned `caption` (#716 P7):
 * each row's level, the entries of its Special column (split at commas, an
 * empty cell none), its other cells by their headers and the row's line.
 * Throws unless exactly one progression table has the caption.
 */
export function classTableRows(html: string, caption: string): ClassTableRow[] {
  const tables: HtmlNode[] = [];
  const rows: HtmlNode[] = [];
  const collect = (node: HtmlNode, into: HtmlNode[], name: string) => {
    if (node.nodeName === name) into.push(node);
    else if ('childNodes' in node)
      node.childNodes.forEach((child) => collect(child, into, name));
  };
  parse(html, { sourceCodeLocationInfo: true }).childNodes.forEach((node) =>
    collect(node, tables, 'table'),
  );
  const found = tables.filter(
    (table) =>
      'childNodes' in table &&
      table.childNodes.some(
        (child) =>
          child.nodeName === 'caption' &&
          normalized(textOf(child).replace(/^\s*table:/i, '')) ===
            normalized(caption),
      ) &&
      normalized(textOf(table)).includes('base attack bonus'),
  );
  const [table, ...others] = found;
  if (!table || others.length)
    throw new Error(`${found.length} class tables are captioned ${caption}.`);
  collect(table, rows, 'tr');
  const isSpecial = (cell: HtmlNode) => normalized(textOf(cell)) === 'special';
  const header = rows
    .map((row) => cellsOf(row, 'th'))
    .find((cells) => cells.some(isSpecial));
  if (!header) throw new Error(`The ${caption} table has no Special column.`);
  const column = header
    .slice(0, header.findIndex(isSpecial))
    .reduce((sum, cell) => sum + columnSpan(cell), 0);
  // A header spanning several columns (Spells per Day) names none of them.
  const named = header.flatMap((cell, index) =>
    columnSpan(cell) === 1
      ? [
          {
            name: textOf(cell).replace(/\s+/g, ' ').trim(),
            at: header
              .slice(0, index)
              .reduce((sum, before) => sum + columnSpan(before), 0),
          },
        ]
      : [],
  );
  return rows.flatMap((row) => {
    const cells = cellsOf(row, 'td');
    const level = /^(\d+)(?:st|nd|rd|th)$/.exec(
      cells[0] ? textOf(cells[0]).trim() : '',
    )?.[1];
    const special = cells[column];
    if (!level || !special) return [];
    return [
      {
        level: Number(level),
        special: textOf(special)
          .split(',')
          .map((entry) => entry.replace(/\s+/g, ' ').trim())
          .filter((entry) => entry && entry !== '—'),
        columns: Object.fromEntries(
          named.flatMap(({ name, at }) => {
            const cell = cells[at];
            return cell
              ? [[name, textOf(cell).replace(/\s+/g, ' ').trim()]]
              : [];
          }),
        ),
        line:
          ('sourceCodeLocation' in row
            ? row.sourceCodeLocation?.startLine
            : undefined) ?? 0,
      },
    ];
  });
}

/**
 * Where the capture prints each schedule's class table: the one page of the
 * schedule's book with a progression table captioned with its name, or its
 * named exclusion. Throws for a schedule on no page or on several, and for an
 * excluded one whose table any captured page prints.
 */
export function classCoverageOf({
  schedules,
  pages,
}: {
  schedules: readonly ClassSchedule[];
  pages: readonly { path: string; book: string; html: string }[];
}): ClassCoverageItem[] {
  const tabled = pages.map((page) => ({
    ...page,
    tables: classTablesOf(page.html),
  }));
  return schedules.map(({ schedule, name, book, table }) => {
    const caption = normalized(table);
    const exclusion = classExclusionOf(schedule);
    const found = tabled.filter(
      (page) =>
        (exclusion !== null || page.book === book) &&
        page.tables.includes(caption),
    );
    if (exclusion && found.length === 0)
      return { kind: 'excluded', schedule, name, exclusion };
    const [page, ...others] = found;
    if (exclusion || !page || others.length > 0)
      throw new Error(
        `${name} (${book}) is on ${
          exclusion
            ? `${found.length} captured pages despite exclusion ${exclusion}`
            : page
              ? `several captured pages: ${found.map((p) => p.path).join(', ')}`
              : 'no captured page'
        }.`,
      );
    return { kind: 'page', schedule, name, page: page.path };
  });
}

export function printedSourceColumns({
  html,
  lines,
}: {
  html: string;
  lines: number[];
}) {
  const wanted = new Set(lines);
  const columns = new Map<number, Record<string, string>>();
  const visit = (node: DefaultTreeAdapterMap['node']) => {
    if (!('childNodes' in node)) return;
    if (
      node.nodeName === 'tr' &&
      node.sourceCodeLocation &&
      wanted.has(node.sourceCodeLocation.startLine)
    ) {
      columns.set(
        node.sourceCodeLocation.startLine,
        Object.fromEntries(
          node.childNodes
            .filter((cell) => cell.nodeName === 'td')
            .map((cell, index) => [
              `column-${index}`,
              textOf(cell).replace(/\s+/g, ' ').trim(),
            ]),
        ),
      );
    }
    node.childNodes.forEach(visit);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return columns;
}
