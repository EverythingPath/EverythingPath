import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { z } from 'zod';
import {
  isReviewedNotice,
  reviewedAdmissionSchema,
  type Section15Registry,
} from '../../../src/lib/catalog/admission-schema.ts';
import { createNoticeIndex } from '../../../src/lib/catalog/resolve-notice.ts';
import { formatCatalogData } from '../data-files.ts';
import { pcgenPin } from '../inventory.ts';
import { pcgenBooks, pcgenNoticeBooks } from '../pcgen-books.ts';
import { section15PrdCapture } from '../prd-identity.ts';
import {
  confirmationPayload,
  confirmationReference,
  confirmationsPath,
  findSection15RegistryProblems,
  pcgenNoticeKey,
  pcgenSupplementKey,
  pinnedPcgenRoot,
  pinnedPcgenRootAt,
  readPinnedPcgenSha256At,
  reportedDefectSchema,
  section15ConfirmationsSchema,
  section15PayloadSchema,
  type MatchedConfirmation,
  type ReadMismatchKind,
  type Section15Confirmation,
  type Section15Payload,
} from './section15-confirmations.ts';

/**
 * #716 P10a, plan §7: matches each book's Section 15 block in PCGen's pinned
 * `OGL.txt`: the #716 books, and since 2026-10-31 the books outside them whose
 * file carries their own line (`section15Books`). The block is every line
 * after the "15 COPYRIGHT NOTICE" heading (after §14 where a file omits it)
 * to the end of the file, decoded
 * under the file's declared encoding and shipped exactly: chain lines, PCGen's
 * conversion lines, blank lines and line endings included (owner decision 5).
 */

type Book = (typeof pcgenBooks.books)[number];
/**
 * The books the matcher reads: the #716 crosswalk's, then those whose PCGen
 * `OGL.txt` carries their own Section 15 line (owner, 2026-10-31). A book
 * without its own line stays out, owner-owed.
 */
export const section15Books: readonly Book[] = [
  ...pcgenBooks.books,
  ...pcgenNoticeBooks.books,
];
/** Reads PCGen's data folder: a folder's file names and a file's bytes. */
export type PcgenFiles = {
  list: (folder: string) => Promise<string[]>;
  read: (path: string) => Promise<Buffer>;
};
export function pcgenFilesAt(root: string): PcgenFiles {
  return {
    list: (folder) => readdir(join(root, folder)),
    read: (path) => readFile(join(root, path)),
  };
}
/** The pinned store's PCGen files (`tests/fixtures/pinned/pcgen/`). */
export const pinnedPcgenFiles = pcgenFilesAt(pinnedPcgenRoot);

/** A notice hold as the matcher weighs it for a waiver: its notices and recorded statuses. */
export type WeighedHold = { id: string; notices: string[]; statuses: string[] };
/** A reviewed alias naming the title form a book's own line uses. */
export const ownLineAliasSchema = z.strictObject({
  code: z.string().min(1),
  title: z.string().min(1),
  rationale: z.string().min(1),
});
export type OwnLineAlias = z.infer<typeof ownLineAliasSchema>;
/**
 * A defect a book check reports, before its coverage is known. Its source is
 * a reviewed one; only in memory may it be a labelled synthetic one, which
 * the committed schema refuses.
 */
export type ReportedDefect = WithLooseSource<
  z.infer<typeof reportedDefectSchema>
>;
type WithLooseSource<Defect> = Defect extends unknown
  ? Omit<Defect, 'source'> & {
      source: { checkedAgainst: string; locator: string; sha256: string };
    }
  : never;
type CoveredDefect = ReportedDefect & { coveredBy: string | null };

/** A book's confirmation as matched, before it is checked against the committed schema. */
export type MatchedPayload = WithCoveredDefects<Section15Payload>;
type WithCoveredDefects<Payload> = Payload extends unknown
  ? Omit<Payload, 'defects'> & { defects: CoveredDefect[] }
  : never;

export type Section15MatchInput = {
  book: Book;
  files: PcgenFiles;
  registry: Section15Registry;
  holds: readonly WeighedHold[];
  ownLineAliases: readonly OwnLineAlias[];
  /** Defects book checks and reports identified for this book. */
  defects: readonly ReportedDefect[];
  /**
   * The settled policy (plan §7): a #716 record requires its book's reviewed
   * Registry notice. Only a test of the cure path turns it off.
   */
  requiresRegistryNotice?: boolean;
};

/** The 9 PRD books (plan §1), which P10b also checks against the PRD. */
export const prdBookCodes = new Set([
  'PZO1110',
  'PZO1115',
  'PZO1117',
  'PZO1118',
  'PZO1121',
  'PZO1129',
  'PZO1130',
  'PZO1132',
  'PZO9272',
]);
/**
 * The chain statuses earlier batches record for complete-chain holds (plan
 * §7 "Which holds clear"). Only these are waived, because PCGen's block
 * carries the chain lines; named holds with other statuses never are.
 */
export const chainHoldStatuses = new Set([
  'held-complete-chain',
  'held-notice-chain',
  'specifically-held-complete-book-chain',
  'specifically-held-complete-notice-chain',
  'complete-book-chain-held',
  'missing-reviewed-book-notice',
]);
/**
 * The notice reviews #264-#296 hold each compilation notice they couldn't
 * tie to a complete chain as `notice-<n>-complete-chain-<hash>` (status
 * `held`, "not a verified complete book/inherited-rule chain"). Owner
 * decision 7 (2026-10-19): on a matched book's own Registry notice, the
 * book's same-book PCGen block clears them, for #716 records only. Earlier
 * batches' records keep them, and a hold the confirmation doesn't list as
 * waived still holds.
 */
const registryChainHold = /^notice-\d+-complete-chain-[0-9a-f]{64}$/;
const isChainHold = ({ id, statuses }: WeighedHold) =>
  statuses.length > 0 &&
  (statuses.every((status) => chainHoldStatuses.has(status)) ||
    (registryChainHold.test(id) &&
      statuses.every((status) => status === 'held')));
/** PZO1131 stays held under S-02 (#736) and is never waived. */
const neverWaived = new Set(['PZO1131']);

const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

// --- Decoding and the block ------------------------------------------------

/**
 * Windows-1252's 0x80-0x9F, written out because Node's decoder for the label
 * reads them as Latin-1 C1 controls. The five bytes it leaves undefined stay
 * C1 controls here, and a block holding one is `undecodable`.
 */
const windows1252High =
  '\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178';
const undefinedWindows1252 = /[\u0081\u008d\u008f\u0090\u009d]/;
function decodeWindows1252(bytes: Buffer) {
  let text = '';
  for (const byte of bytes)
    text +=
      byte >= 0x80 && byte < 0xa0
        ? windows1252High[byte - 0x80]
        : String.fromCharCode(byte);
  return text;
}
/**
 * Declares a file's encoding: UTF-8 when the whole file decodes as UTF-8
 * (a leading BOM is only an encoding marker), else Windows-1252.
 */
export function decodePcgenText(bytes: Buffer) {
  try {
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const hasBom = text.startsWith('﻿');
    return {
      encoding: 'utf-8' as const,
      hasBom,
      text: hasBom ? text.slice(1) : text,
    };
  } catch {
    return {
      encoding: 'windows-1252' as const,
      hasBom: false,
      text: decodeWindows1252(bytes),
    };
  }
}

type BlockLine = { line: number; text: string };
/** The block's decoded text and lines, numbered as in the file. */
export function extractSection15Block(text: string) {
  const lines = text.split('\n');
  const headings = lines.flatMap((line, index) =>
    /^\s*15\.?\s+COPYRIGHT NOTICE\s*$/.test(line) ? [index] : [],
  );
  const section14 = lines.findIndex((line) =>
    /^\s*14\.?\s+Reformation\b/.test(line),
  );
  if (headings.length > 1)
    throw new Error('The file has more than one Section 15 heading.');
  const [heading] = headings;
  const start = heading ?? (section14 >= 0 ? section14 : undefined);
  if (start === undefined)
    throw new Error('The file has neither a Section 15 heading nor §14.');
  const blockLines: BlockLine[] = lines
    .slice(start + 1)
    .map((line, index) => ({ line: start + 2 + index, text: line }));
  // A final newline ends the last line; it starts none.
  if (blockLines.at(-1)?.text === '') blockLines.pop();
  return {
    from:
      heading === undefined ? ('section-14' as const) : ('heading' as const),
    text: lines.slice(start + 1).join('\n'),
    lines: blockLines,
  };
}

// --- Declared equivalences and the own line ------------------------------

/**
 * Plan §7 "Declared equivalences": `©` against "Copyright" with its leading
 * comma or period, curly against straight quotes, whitespace and a final
 * period, the "Pathfinder Roleplaying Game "/"Pathfinder RPG " prefix, and
 * " & " against " and ". Names, years, publishers and labels are kept.
 */
export function normalizeNoticeLine(line: string) {
  return line
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,]?\s*(?:©|Copyright)\s*/g, ' Copyright ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^Pathfinder (?:Roleplaying Game|RPG) /, '')
    .replaceAll(' & ', ' and ')
    .replace(/\.$/, '')
    .trim();
}
/** A line's title: what precedes its copyright, under the equivalences. */
const titlePart = (line: string) =>
  normalizeNoticeLine(line).split(' Copyright ')[0] ?? '';
/** Whether a line names a title: its title is it, or ends with it after a space or colon. */
function namesTitle(line: string, title: string) {
  const part = titlePart(line);
  const wanted = normalizeNoticeLine(title);
  if (!wanted) return false;
  if (part === wanted) return true;
  const before = part.slice(0, part.length - wanted.length);
  return part.endsWith(wanted) && /[\s:]$/.test(before);
}
/** PCGen's own lines (dataset conversions, "Pathfinder RPG Conversion"). */
const isPcgenLine = (line: string) => /PCGen/i.test(line);

type Title = {
  title: string;
  titleFrom: NonNullable<Section15Payload['ownLine']>['titleFrom'];
};
function titlesOf(book: Book, aliases: readonly OwnLineAlias[]): Title[] {
  return [
    { title: book.book, titleFrom: 'book' as const },
    { title: book.title.sourceLong, titleFrom: 'source-long' as const },
    ...(book.registry
      ? [{ title: book.registry.title, titleFrom: 'registry-title' as const }]
      : []),
    ...aliases
      .filter(({ code }) => code === book.code.id)
      .map(({ title }) => ({ title, titleFrom: 'own-line-alias' as const })),
  ];
}
/** The non-PCGen block lines that name the book, each with the first title it matched. */
function findOwnLines(lines: readonly BlockLine[], titles: readonly Title[]) {
  return lines.flatMap((line) => {
    if (!line.text.trim() || isPcgenLine(line.text)) return [];
    const title = titles.find(({ title }) => namesTitle(line.text, title));
    return title ? [{ ...line, ...title }] : [];
  });
}
function compareLines(left: string, right: string) {
  if (left === right) return 'exact' as const;
  return normalizeNoticeLine(left) === normalizeNoticeLine(right)
    ? ('equivalent' as const)
    : ('differs' as const);
}
function compareLineLists(left: readonly string[], right: readonly string[]) {
  if (isDeepStrictEqual(left, right)) return 'exact' as const;
  return isDeepStrictEqual(
    left.map(normalizeNoticeLine),
    right.map(normalizeNoticeLine),
  )
    ? ('equivalent' as const)
    : ('differs' as const);
}

// --- Registry, defects and waivers ----------------------------------------

/** The book's own Registry notice: by its code, else by its crosswalk title. */
function findRegistryNotice({
  book,
  registry,
}: {
  book: Book;
  registry: Section15Registry;
}) {
  const index = createNoticeIndex({ registry });
  const byCode = index.get(book.code.id);
  if (byCode) {
    const key = Object.keys(registry).find((code) => registry[code] === byCode);
    return key ? { key, titleMatch: 'code' as const, notice: byCode } : null;
  }
  if (!book.registry) return null;
  const { title, match } = book.registry;
  const keys = Object.keys(registry).filter(
    (key) => registry[key]?.title === title && !key.startsWith('pcgen'),
  );
  if (keys.length > 1)
    throw new Error(
      `${book.code.id}: several Registry notices are titled ${title}.`,
    );
  const [key] = keys;
  const notice = key ? registry[key] : undefined;
  return key && notice ? { key, titleMatch: match, notice } : null;
}
type FoundRegistryNotice = ReturnType<typeof findRegistryNotice>;

/** The notices whose lines can cure a defect: those every #716 record of the book requires, apart from the block. */
function coveringNotices({
  registryNotice,
  supplements,
  registry,
  requiresRegistryNotice,
}: {
  registryNotice: FoundRegistryNotice;
  supplements: readonly string[];
  registry: Section15Registry;
  requiresRegistryNotice: boolean;
}) {
  return [
    ...(registryNotice &&
    requiresRegistryNotice &&
    isReviewedNotice(registryNotice.notice)
      ? [{ key: registryNotice.key, text: registryNotice.notice.notice }]
      : []),
    ...supplements.flatMap((key) => {
      const notice = registry[key];
      return notice && isReviewedNotice(notice)
        ? [{ key, text: notice.notice }]
        : [];
    }),
  ];
}
/** Each defect with the required notice that holds its exact text as a line, if one does. */
export function coverDefects({
  defects,
  notices,
}: {
  defects: readonly ReportedDefect[];
  notices: readonly { key: string; text: string }[];
}): CoveredDefect[] {
  return defects.map((defect) => ({
    ...defect,
    coveredBy:
      notices.find(({ text }) => text.split('\n').includes(defect.exactText))
        ?.key ?? null,
  }));
}
/**
 * Plan §7, "How defects are identified" 1: a Registry `differs` against a
 * reviewed notice is a `wrong-line` defect of the own line.
 */
function findRegistryDefects({
  own,
  registryNotice,
  comparison,
}: {
  own: OwnLine | null;
  registryNotice: FoundRegistryNotice;
  comparison: LineComparison | null;
}): ReportedDefect[] {
  if (
    !own ||
    !registryNotice ||
    comparison !== 'differs' ||
    !isReviewedNotice(registryNotice.notice)
  )
    return [];
  const { key, notice } = registryNotice;
  return [
    {
      kind: 'wrong-line',
      blockLine: own.line,
      source: {
        checkedAgainst: notice.checkedAgainst,
        locator: key,
        sha256: sha256(notice.notice),
      },
      exactText: notice.notice,
    },
  ];
}

/** The earlier chain holds on the book's code or Registry notice, which PCGen's block waives. */
function findWaivedHolds({
  code,
  registryKey,
  holds,
}: {
  code: string;
  registryKey: string | null;
  holds: readonly WeighedHold[];
}) {
  const keys = new Set([code, ...(registryKey ? [registryKey] : [])]);
  return holds
    .filter(
      (hold) =>
        hold.notices.some((notice) => keys.has(notice)) &&
        !hold.notices.some((notice) => neverWaived.has(notice)) &&
        isChainHold(hold),
    )
    .map(({ id }) => id)
    .sort();
}

// --- One book ---------------------------------------------------------------

async function findOgl({ book, files }: { book: Book; files: PcgenFiles }) {
  for (const pack of book.packs) {
    const names = await files.list(pack.folder);
    const name = names.find((file) => file.toLowerCase() === 'ogl.txt');
    if (name) return { pack, path: `${pack.folder}/${name}` };
  }
  return undefined;
}
/** The `.pcc`'s `COPYRIGHT:` lines, which PCGen also writes into `OGL.txt`. */
async function readPccCopyrights({
  path,
  files,
}: {
  path: string;
  files: PcgenFiles;
}) {
  return decodePcgenText(await files.read(path))
    .text.split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.startsWith('COPYRIGHT:'))
    .map((line) => line.slice('COPYRIGHT:'.length));
}

/** A book's `OGL.txt` as read: the file, its decoded block and the `.pcc` comparison. */
async function readBookEvidence({
  book,
  files,
}: {
  book: Book;
  files: PcgenFiles;
}) {
  const ogl = await findOgl({ book, files });
  if (!ogl) return null;
  const bytes = await files.read(ogl.path);
  const decoded = decodePcgenText(bytes);
  const block = extractSection15Block(decoded.text);
  const pccLines = await readPccCopyrights({ path: ogl.pack.pcc, files });
  return {
    block,
    isUndecodable:
      decoded.encoding === 'windows-1252' &&
      undefinedWindows1252.test(block.text),
    pcgen: {
      commit: pcgenPin.commit,
      path: ogl.path,
      sha256: sha256(bytes),
      encoding: decoded.encoding,
      hasBom: decoded.hasBom,
    },
    blockPart: {
      firstLine: block.lines[0]?.line ?? 1,
      lastLine: block.lines.at(-1)?.line ?? 1,
      from: block.from,
      sha256: sha256(block.text),
    },
    pcc: {
      path: ogl.pack.pcc,
      comparison: compareLineLists(
        pccLines,
        block.lines.filter(({ text }) => text.trim()).map(({ text }) => text),
      ),
    },
  };
}

type OwnLine = ReturnType<typeof findOwnLines>[number];
type LineComparison = ReturnType<typeof compareLines>;
/**
 * A read book's status (plan §7 "What `matched` means now"): exactly one
 * non-PCGen line names it, the block decodes, and every identified defect is
 * covered by a notice its #716 records require. A PRD book then waits for
 * P10b.
 */
function settleStatus({
  code,
  ownLines,
  isUndecodable,
  defects,
}: {
  code: string;
  ownLines: readonly OwnLine[];
  isUndecodable: boolean;
  defects: readonly CoveredDefect[];
}) {
  const [own] = ownLines;
  const ownLine =
    own && ownLines.length === 1
      ? { line: own.line, title: own.title, titleFrom: own.titleFrom }
      : null;
  const mismatch = (kind: ReadMismatchKind) => ({
    status: 'mismatch' as const,
    mismatch: kind,
    ownLine,
  });
  if (isUndecodable) return mismatch('undecodable');
  if (!ownLine)
    return mismatch(
      ownLines.length ? 'ambiguous-own-line' : 'own-line-missing',
    );
  if (defects.some(({ coveredBy }) => coveredBy === null))
    return mismatch('uncured-defect');
  return {
    status: prdBookCodes.has(code)
      ? ('pending-prd' as const)
      : ('matched' as const),
    mismatch: null,
    ownLine,
  };
}

const emptyPayload = (book: Book) => ({
  code: book.code.id,
  book: book.book,
  prd: prdBookCodes.has(book.code.id)
    ? { capture: section15PrdCapture, comparison: 'pending' as const }
    : null,
  supplements: [],
});

/** Matches one book's PCGen Section 15 block (plan §7). */
export async function matchSection15Book({
  book,
  files,
  registry,
  holds,
  ownLineAliases,
  defects: reported,
  requiresRegistryNotice = true,
}: Section15MatchInput): Promise<{
  confirmation: MatchedPayload;
  block: { text: string } | null;
}> {
  const code = book.code.id;
  const registryNotice = findRegistryNotice({ book, registry });
  // `none` is a book without a Registry notice; null, one with no own line to compare.
  const registryPart = (comparison: LineComparison | null) => ({
    key: registryNotice?.key ?? null,
    titleMatch: registryNotice?.titleMatch ?? null,
    comparison: registryNotice ? comparison : ('none' as const),
  });
  const evidence = await readBookEvidence({ book, files });
  if (!evidence) {
    const confirmation: MatchedPayload = {
      ...emptyPayload(book),
      registry: registryPart(null),
      pcgen: null,
      block: null,
      ownLine: null,
      pcc: null,
      defects: [],
      waivedHoldIds: [],
      status: 'mismatch',
      mismatch: 'no-pcgen-ogl',
    };
    return { confirmation, block: null };
  }
  const ownLines = findOwnLines(
    evidence.block.lines,
    titlesOf(book, ownLineAliases),
  );
  const [own = null] = ownLines.length === 1 ? ownLines : [];
  const comparison =
    own && registryNotice
      ? compareLines(own.text, registryNotice.notice.notice)
      : null;
  const supplements = registry[pcgenSupplementKey(code)]
    ? [pcgenSupplementKey(code)]
    : [];
  const defects = coverDefects({
    defects: [
      ...findRegistryDefects({ own, registryNotice, comparison }),
      ...reported,
    ],
    notices: coveringNotices({
      registryNotice,
      supplements,
      registry,
      requiresRegistryNotice,
    }),
  });
  const settled = settleStatus({
    code,
    ownLines,
    isUndecodable: evidence.isUndecodable,
    defects,
  });
  const confirmation: MatchedPayload = {
    ...emptyPayload(book),
    registry: registryPart(comparison),
    pcgen: evidence.pcgen,
    block: evidence.blockPart,
    pcc: evidence.pcc,
    defects,
    supplements,
    waivedHoldIds:
      settled.status === 'matched'
        ? findWaivedHolds({
            code,
            registryKey: registryNotice?.key ?? null,
            holds,
          })
        : [],
    ...settled,
  };
  return { confirmation, block: { text: evidence.block.text } };
}

// --- Every book, and the committed files -----------------------------------

/** Reviewed matcher inputs: own-line aliases and the defects book checks reported. */
export const section15InputsPath =
  'scripts/catalog/legal/section15-inputs-716.json';
const section15InputsSchema = z.strictObject({
  ownLineAliases: z.array(ownLineAliasSchema),
  bookDefects: z.array(
    z.strictObject({ code: z.string().min(1), defect: reportedDefectSchema }),
  ),
});
/** The #716 hold evidence: the books whose #716 records stay held. */
export const section15HoldsPath =
  'scripts/catalog/legal/section15-holds-716.json';
export const section15HoldId = (code: string) =>
  `716-notice-${code}-complete-chain`;
const registryPath = 'src/lib/catalog/data/section15-registry.json';
const heldNoticesPath = 'scripts/catalog/legal/held-notices.json';

const evidenceSchema = z.object({
  holds: z
    .array(z.object({ id: z.string(), status: z.string().optional() }))
    .default([]),
  noticeRequirements: z
    .array(
      z.object({
        holdId: z.string().nullable().optional(),
        status: z.string().optional(),
      }),
    )
    .default([]),
});
const heldNoticesSchema = z.array(
  z.object({
    id: z.string(),
    notices: z.array(z.string()),
    evidence: z.array(z.string()),
  }),
);
/** Every hold in `held-notices.json` with the statuses batch evidence records for it. */
export async function readWeighedHolds(root: string): Promise<WeighedHold[]> {
  const directory = join(root, 'scripts/catalog/legal');
  const statuses = new Map<string, Set<string>>();
  const record = (id: string, status: string | undefined) =>
    status && statuses.set(id, new Set([...(statuses.get(id) ?? []), status]));
  for (const file of (await readdir(directory)).sort()) {
    if (!file.endsWith('.json') || file === 'held-notices.json') continue;
    const data: unknown = JSON.parse(
      await readFile(join(directory, file), 'utf8'),
    );
    if (Array.isArray(data)) continue;
    const parsed = evidenceSchema.safeParse(data);
    if (!parsed.success) continue;
    for (const hold of parsed.data.holds) record(hold.id, hold.status);
    for (const requirement of parsed.data.noticeRequirements)
      if (requirement.holdId) record(requirement.holdId, requirement.status);
  }
  const held = heldNoticesSchema.parse(
    JSON.parse(await readFile(join(directory, 'held-notices.json'), 'utf8')),
  );
  return held.map(({ id, notices }) => ({
    id,
    notices,
    statuses: [...(statuses.get(id) ?? [])].sort(),
  }));
}

/**
 * What the matcher reads from a checkout: the Registry, its reviewed inputs,
 * the committed confirmations, every hold with its statuses, and the pinned
 * PCGen files.
 */
export async function readSection15State({ root }: { root: string }) {
  const json = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(join(root, path), 'utf8'));
  return {
    registry: reviewedAdmissionSchema.shape.registry.parse(
      await json(registryPath),
    ),
    inputs: section15InputsSchema.parse(await json(section15InputsPath)),
    previous: section15ConfirmationsSchema.parse(await json(confirmationsPath))
      .confirmations,
    holds: await readWeighedHolds(root),
    heldNotices: heldNoticesSchema.parse(await json(heldNoticesPath)),
    files: pcgenFilesAt(pinnedPcgenRootAt(root)),
  };
}
export type Section15State = Awaited<ReturnType<typeof readSection15State>>;

type RegistryNotice = Section15Registry[string];
/** The `pcgen:<code>` Registry record for a matched book (plan §7 "Shipped notices"). */
export function pcgenRegistryRecord({
  confirmation,
  text,
}: {
  confirmation: MatchedConfirmation;
  text: string;
}): RegistryNotice {
  const { pcgen, block, code, review } = confirmation;
  return {
    title: `PCGen dataset: ${confirmation.book}`,
    notice: text,
    checkedAgainst: 'pcgen',
    checkedOn:
      review.status === 'checked' ? review.reviewedOn : confirmation.measuredOn,
    aliases: [],
    reviewStatus: review.status === 'checked' ? 'reviewed' : 'unreviewed',
    provenance: [
      `${pcgenPin.repository}/blob/${pcgen.commit}/${pcgenPin.directory}/${pcgen.path}`,
      `PCGen commit ${pcgen.commit}, ${pcgenPin.directory}/${pcgen.path}`,
      `OGL.txt sha256:${pcgen.sha256}; block (lines ${block.firstLine}-${block.lastLine}, after the ${block.from === 'heading' ? 'Section 15 heading' : '§14 paragraph'}) sha256:${block.sha256}`,
      `Decoded as ${pcgen.encoding}${pcgen.hasBom ? ' (a leading BOM, outside the block)' : ''}; shipped untrimmed (owner decision 5, 2026-10-17).`,
      confirmationReference(code),
    ],
  };
}

/**
 * A book's confirmation now, against its committed one (plan §7, waivers).
 * An unchanged payload keeps the committed confirmation, its date and review.
 * So does one that differs only by new waivers: a later batch's new chain
 * hold on the book stays unwaived (and holds its #716 records) until
 * `adoptWaivers` redrafts the confirmation for a new review. A committed
 * waiver of a hold that is no longer waivable is `stale`. Any other change is
 * a new drafted confirmation measured today.
 */
export function reconcileConfirmation({
  earlier,
  payload,
  measuredOn,
  adoptWaivers = false,
}: {
  earlier: Section15Confirmation | undefined;
  payload: Section15Payload;
  measuredOn: string;
  adoptWaivers?: boolean;
}) {
  const drafted: Section15Confirmation = {
    ...payload,
    measuredOn,
    review: { status: 'drafted' },
  };
  if (!earlier) return { confirmation: drafted, lagging: [], stale: [] };
  const committed = earlier.waivedHoldIds;
  const now = payload.waivedHoldIds;
  const stale = committed.filter((id) => !now.includes(id));
  const lagging = now.filter((id) => !committed.includes(id));
  const withoutWaivers = (row: Section15Payload) => ({
    ...row,
    waivedHoldIds: [],
  });
  const isUnchanged =
    !stale.length &&
    (!lagging.length || !adoptWaivers) &&
    isDeepStrictEqual(
      withoutWaivers(confirmationPayload(earlier)),
      withoutWaivers(payload),
    );
  return isUnchanged
    ? { confirmation: earlier, lagging, stale }
    : { confirmation: drafted, lagging: [], stale };
}

/** A note on one book's waivers: the hold IDs it names. */
type WaiverNote = { code: string; holdIds: string[] };
/**
 * Matches every book (`section15Books`) and gives the committed files' new
 * contents: the confirmations (`reconcileConfirmation`), the Registry with one
 * `pcgen:<code>` per matched book, the #716 holds of every other book, and
 * the waivers that lag or are stale.
 */
export async function matchAllSection15Books({
  state,
  measuredOn,
  adoptWaivers = false,
}: {
  state: Section15State;
  measuredOn: string;
  adoptWaivers?: boolean;
}) {
  const { registry, inputs, previous, holds, files } = state;
  const confirmations: Section15Confirmation[] = [];
  const lagging: WaiverNote[] = [];
  const stale: WaiverNote[] = [];
  const nextRegistry: Record<string, RegistryNotice> = Object.fromEntries(
    Object.entries(registry).filter(([key]) => !key.startsWith('pcgen:')),
  );
  for (const book of section15Books) {
    const code = book.code.id;
    const matched = await matchSection15Book({
      book,
      files,
      registry,
      holds,
      ownLineAliases: inputs.ownLineAliases,
      defects: inputs.bookDefects
        .filter((row) => row.code === code)
        .map(({ defect }) => defect),
    });
    const reconciled = reconcileConfirmation({
      earlier: previous.find((row) => row.code === code),
      payload: section15PayloadSchema.parse(matched.confirmation),
      measuredOn,
      adoptWaivers,
    });
    const { confirmation } = reconciled;
    confirmations.push(confirmation);
    if (reconciled.lagging.length)
      lagging.push({ code, holdIds: reconciled.lagging });
    if (reconciled.stale.length)
      stale.push({ code, holdIds: reconciled.stale });
    if (confirmation.status === 'matched' && matched.block)
      nextRegistry[pcgenNoticeKey(code)] = pcgenRegistryRecord({
        confirmation,
        text: matched.block.text,
      });
  }
  confirmations.sort((left, right) => left.code.localeCompare(right.code));
  return {
    confirmations,
    registry: nextRegistry,
    holds: holdsOf(confirmations),
    lagging,
    stale,
  };
}

/** The #716 hold of each book that isn't matched, keyed by its `pcgen:` notice. */
function holdsOf(confirmations: readonly Section15Confirmation[]) {
  return confirmations
    .filter(({ status }) => status !== 'matched')
    .map((confirmation) => ({
      id: section15HoldId(confirmation.code),
      noticeKey: pcgenNoticeKey(confirmation.code),
      relatedNoticeKeys: [],
      book: confirmation.code,
      title: confirmation.book,
      status:
        confirmation.status === 'pending-prd'
          ? 'section15-pending-prd'
          : 'section15-mismatch',
      mismatch:
        confirmation.status === 'mismatch'
          ? {
              kind: confirmation.mismatch,
              pcgen: confirmation.pcgen
                ? {
                    path: confirmation.pcgen.path,
                    sha256: confirmation.pcgen.sha256,
                    encoding: confirmation.pcgen.encoding,
                  }
                : null,
              registryKey: confirmation.registry.key,
              prd: confirmation.prd,
            }
          : null,
    }));
}

const formatJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
/**
 * Matches every book and renders the files the matcher writes, with their new
 * text, alongside the confirmations and the waiver notes.
 */
export async function renderSection15Files({
  state,
  measuredOn,
  adoptWaivers = false,
}: {
  state: Section15State;
  measuredOn: string;
  adoptWaivers?: boolean;
}) {
  const result = await matchAllSection15Books({
    state,
    measuredOn,
    adoptWaivers,
  });
  const nextHeld = [
    ...state.heldNotices.filter(({ id }) => !id.startsWith('716-notice-')),
    ...result.holds.map(({ id, noticeKey }) => ({
      id,
      notices: [noticeKey],
      evidence: [section15HoldsPath],
    })),
  ];
  const files = new Map([
    [
      confirmationsPath,
      // Parsed, so the fields follow the schema's order.
      formatJson(
        section15ConfirmationsSchema.parse({
          confirmations: result.confirmations,
        }),
      ),
    ],
    [registryPath, formatCatalogData('registry', result.registry)],
    [heldNoticesPath, formatCatalogData('heldNotices', nextHeld)],
    [
      section15HoldsPath,
      formatJson({
        issue: 716,
        phase: 'P10a',
        summary:
          'Books whose #716 records stay held on Section 15 (plan §7 "Mismatch handling"): a mismatch, or a PRD book pending P10b. Each hold is keyed by the book\'s pcgen: notice, so it holds #716 candidates only.',
        holds: result.holds,
      }),
    ],
  ]);
  return { ...result, files };
}
export type RenderedSection15Files = Awaited<
  ReturnType<typeof renderSection15Files>
>;

/** The committed text of each file the matcher writes; empty when a file is missing. */
export async function readCommittedSection15Files({
  root,
  paths,
}: {
  root: string;
  paths: Iterable<string>;
}) {
  return new Map(
    await Promise.all(
      [...paths].map(
        async (path) =>
          [
            path,
            await readFile(join(root, path), 'utf8').catch(() => ''),
          ] as const,
      ),
    ),
  );
}

/**
 * Where the committed files differ from what the matcher writes now, and a
 * stale waiver; lagging waivers are only noted (`reconcileConfirmation`).
 */
export function findSection15FileProblems({
  rendered,
  committed,
}: {
  rendered: Pick<RenderedSection15Files, 'files' | 'lagging' | 'stale'>;
  committed: ReadonlyMap<string, string>;
}) {
  const problems = [
    ...rendered.stale.map(
      ({ code, holdIds }) =>
        `${code} waives holds it can't: ${holdIds.join(', ')}.`,
    ),
    ...[...rendered.files]
      .filter(([path, text]) => committed.get(path) !== text)
      .map(([path]) => `${path} is not what the matcher writes.`),
  ];
  const lagging = rendered.lagging.map(
    ({ code, holdIds }) => `${code} doesn't waive ${holdIds.join(', ')} yet.`,
  );
  return { problems, lagging };
}

async function main() {
  const { values } = parseArgs({
    options: {
      check: { type: 'boolean' },
      date: { type: 'string' },
      root: { type: 'string' },
      'adopt-waivers': { type: 'boolean' },
    },
    strict: true,
  });
  const root =
    values.root ?? fileURLToPath(new URL('../../../', import.meta.url));
  const measuredOn = values.date ?? new Date().toISOString().slice(0, 10);
  const state = await readSection15State({ root });
  const rendered = await renderSection15Files({
    state,
    measuredOn,
    adoptWaivers: values['adopt-waivers'] ?? false,
  });
  const committed = await readCommittedSection15Files({
    root,
    paths: rendered.files.keys(),
  });
  const { problems, lagging } = findSection15FileProblems({
    rendered,
    committed,
  });
  for (const line of lagging) process.stdout.write(`NOTE ${line}\n`);
  if (!values.check) {
    for (const [path, text] of rendered.files)
      await writeFile(join(root, path), text);
    return;
  }
  problems.push(
    ...findSection15RegistryProblems({
      registry: reviewedAdmissionSchema.shape.registry.parse(
        JSON.parse(rendered.files.get(registryPath) ?? '{}'),
      ),
      confirmations: state.previous,
      currentSha256: readPinnedPcgenSha256At(root),
    }),
  );
  for (const problem of problems) process.stdout.write(`FAIL ${problem}\n`);
  if (problems.length) process.exitCode = 1;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
