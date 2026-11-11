import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import {
  archetypesInScope,
  classCoverageOf,
  coverageOf,
  prdClassExclusions,
  prdClassSchedules,
  prdExclusions,
} from './prd-coverage.ts';
import { fetchTotals, politeFetch } from './prd-fetch.ts';
import {
  checklistCommit,
  checklistProject,
  checklistRepo,
  prdCaptureName,
} from './prd-identity.ts';
import {
  checklistFileSchema,
  checklistItemSchema,
  manifestSchema,
  type CapturedPage,
  type ChecklistItem,
  type CompleteManifest,
  type DraftManifest,
  type DraftPage,
  type Manifest,
  type PageRole,
  type PendingPage,
  type Projection,
} from './prd-manifest.ts';
import { hashPrdCapture, verifyPrdCapture } from './prd-pin.ts';

/**
 * The one-time PRD capture (#716 P8, owner decision 1 of 2026-10-17). Run by
 * hand, never at build or test time:
 *
 *   node --import tsx scripts/catalog/prd-capture.ts <step> [capture dir]
 *
 * Steps, in order: `checklist`, `dry-run`, `pages` and `finish`
 * (docs/catalog-import/README.md, "PRD capture"); `verify` checks a capture
 * against `prdPin` without network.
 *
 * Every page is the latest Wayback snapshot with status 200 before the PRD's
 * retirement, fetched in the `id_` form, which returns the original bytes.
 */
const prdRoot = 'http://paizo.com/pathfinderRPG/prd/';
/**
 * The PRD's retirement: its pages redirect away from paizo.com in Wayback's
 * captures from 2018-09-13 on (the APG sorcerer page from 19:31 that day, the
 * root from 2018-09-14), so a page's snapshot is its latest with status 200
 * up to 2018-09-13. (`fastLatest` isn't used: it can drop the latest 200.)
 */
const retiredBy = '20180913';

const snapshotSchema = z.strictObject({
  original: z.string(),
  timestamp: z.string(),
  length: z.number(),
});
type Snapshot = z.infer<typeof snapshotSchema>;

/** Pages an index links to: a link's path below the PRD root, without its fragment, must match. */
type LinkSelection = {
  kind: 'links';
  book: string;
  role: PageRole;
  pattern: RegExp;
  count?: number;
};
/**
 * The Monster Codex has no book index: the root links its race chapters in
 * book order. The checklist's Monster Codex pages (pp.20–224) fall in
 * 12-page chapters counted from p.8, so each page names its chapter;
 * `finish` confirms every archetype's heading on the chapter picked.
 */
type ChapterSelection = {
  kind: 'checklist-chapters';
  book: 'MC';
  role: 'archetypes';
  pattern: RegExp;
  chapters: number;
  bookId: string;
  firstPage: number;
  chapterPages: number;
};
type Selection = LinkSelection | ChapterSelection;

/** The book index pages the dry run reads, and the pages it takes from each. */
const indexPages: { path: string; book: string; selections: Selection[] }[] = [
  {
    path: '',
    book: 'PRD',
    // The root lists the Monster Codex's race chapters and the Technology
    // Guide's, Ultimate Magic's and Ultimate Combat's pages without a book
    // index.
    selections: [
      {
        kind: 'checklist-chapters',
        book: 'MC',
        role: 'archetypes',
        pattern: /^monsterCodex\/(?!appendix\.html)\w+\.html$/,
        chapters: 20,
        bookId: 'PZO1130',
        firstPage: 8,
        chapterPages: 12,
      },
      {
        kind: 'links',
        book: 'TG',
        role: 'archetypes',
        pattern: /^technologyGuide\/archetypes\.html$/,
        count: 1,
      },
      {
        kind: 'links',
        book: 'UM',
        role: 'classes',
        pattern: /^ultimateMagic\/spellcasters\/magus\.html$/,
        count: 1,
      },
      {
        kind: 'links',
        book: 'UC',
        role: 'classes',
        pattern: /^ultimateCombat\/classes\/\w+\.html$/,
        count: 3,
      },
      {
        kind: 'links',
        book: 'PRD',
        role: 'license',
        pattern: /^openGameLicense\.html$/,
        count: 1,
      },
    ],
  },
  {
    path: 'coreRulebook/prestigeClasses.html',
    book: 'CRB',
    selections: [
      {
        kind: 'links',
        book: 'CRB',
        role: 'prestige',
        pattern: /^coreRulebook\/prestigeClasses\/\w+\.html$/,
        count: 10,
      },
    ],
  },
  {
    path: 'advancedPlayersGuide/advancedCoreClasses.html',
    book: 'APG',
    selections: [
      {
        kind: 'links',
        book: 'APG',
        role: 'archetypes',
        pattern: /^advancedPlayersGuide\/coreClasses\/\w+\.html$/,
        count: 11,
      },
    ],
  },
  {
    path: 'advancedPlayersGuide/advancedPrestigeClasses.html',
    book: 'APG',
    selections: [
      {
        kind: 'links',
        book: 'APG',
        role: 'prestige',
        pattern: /^advancedPlayersGuide\/prestigeClasses\/\w+\.html$/,
        count: 8,
      },
    ],
  },
  {
    path: 'ultimateMagic/spellcastingClassOptions.html',
    book: 'UM',
    selections: [
      {
        kind: 'links',
        book: 'UM',
        role: 'archetypes',
        pattern: /^ultimateMagic\/spellcastingClassOptions\/\w+\.html$/,
      },
    ],
  },
  {
    path: 'ultimateCombat/classArchetypes.html',
    book: 'UC',
    selections: [
      {
        kind: 'links',
        book: 'UC',
        role: 'archetypes',
        pattern: /^ultimateCombat\/classArchetypes\/\w+\.html$/,
      },
    ],
  },
  {
    path: 'advancedRaceGuide/coreRaces.html',
    book: 'ARG',
    selections: [
      {
        kind: 'links',
        book: 'ARG',
        role: 'archetypes',
        pattern: /^advancedRaceGuide\/coreRaces\/\w+\.html$/,
        count: 7,
      },
    ],
  },
  {
    path: 'advancedRaceGuide/featuredRaces.html',
    book: 'ARG',
    selections: [
      {
        kind: 'links',
        book: 'ARG',
        role: 'archetypes',
        pattern: /^advancedRaceGuide\/featuredRaces\/\w+\.html$/,
        count: 16,
      },
    ],
  },
  {
    path: 'advancedClassGuide/classOptions/index.html',
    book: 'ACG',
    selections: [
      {
        kind: 'links',
        book: 'ACG',
        role: 'archetypes',
        pattern: /^advancedClassGuide\/classOptions\/(?!index\.html)\w+\.html$/,
      },
    ],
  },
  {
    path: 'occultAdventures/archetypes/index.html',
    book: 'OA',
    selections: [
      {
        kind: 'links',
        book: 'OA',
        role: 'archetypes',
        pattern: /^occultAdventures\/archetypes\/(?!index\.html)\w+\.html$/,
      },
    ],
  },
  // The base-class pages (#716 P8b, owner decision 8 of 2026-10-20).
  {
    path: 'coreRulebook/classes.html',
    book: 'CRB',
    selections: [
      {
        kind: 'links',
        book: 'CRB',
        role: 'classes',
        pattern: /^coreRulebook\/classes\/\w+\.html$/,
        count: 11,
      },
    ],
  },
  {
    path: 'advancedPlayersGuide/advancedBaseClasses.html',
    book: 'APG',
    selections: [
      {
        kind: 'links',
        book: 'APG',
        role: 'classes',
        pattern: /^advancedPlayersGuide\/baseClasses\/\w+\.html$/,
        count: 6,
      },
    ],
  },
  {
    path: 'advancedClassGuide/classes/index.html',
    book: 'ACG',
    selections: [
      {
        kind: 'links',
        book: 'ACG',
        role: 'classes',
        pattern: /^advancedClassGuide\/classes\/(?!index\.html)\w+\.html$/,
        count: 10,
      },
    ],
  },
  {
    path: 'occultAdventures/classes/index.html',
    book: 'OA',
    selections: [
      {
        kind: 'links',
        book: 'OA',
        role: 'classes',
        pattern: /^occultAdventures\/classes\/(?!index\.html)\w+\.html$/,
        count: 6,
      },
    ],
  },
  {
    path: 'unchained/classes/index.html',
    book: 'PU',
    selections: [
      {
        kind: 'links',
        book: 'PU',
        role: 'classes',
        pattern: /^unchained\/classes\/(?!index\.html)\w+\.html$/,
        count: 4,
      },
    ],
  },
];

/** Where a page is stored in the capture: `pages/<path below the PRD root>`. */
function storedPath(path: string) {
  return `pages/${path === '' ? 'index.html' : path}`;
}

const digest = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

// --- Snapshots ---------------------------------------------------------------

/**
 * A rerun after a dropped connection reuses the snapshot lookups it already
 * has; `finish` deletes the cache.
 */
const cacheFile = '.snapshot-cache.json';

async function snapshotLookup(capture: string) {
  const file = join(capture, cacheFile);
  const snapshots = existsSync(file)
    ? z
        .record(z.string(), snapshotSchema)
        .parse(JSON.parse(await readFile(file, 'utf8')))
    : {};
  return async (path: string) => {
    const known = snapshots[path];
    if (known) return known;
    const snapshot = await latestSnapshot(path);
    snapshots[path] = snapshot;
    await writeFile(file, JSON.stringify(snapshots));
    return snapshot;
  };
}
type SnapshotLookup = Awaited<ReturnType<typeof snapshotLookup>>;

async function latestSnapshot(path: string): Promise<Snapshot> {
  const query = `https://web.archive.org/cdx/search/cdx?url=paizo.com/pathfinderRPG/prd/${path}&to=${retiredBy}&filter=statuscode:200&fl=original,timestamp,length&limit=-1`;
  const response = await politeFetch(query);
  const [original, timestamp, length] = response.body
    .toString('utf8')
    .trim()
    .split(' ');
  if (response.status !== 200 || !original || !timestamp || !length)
    throw new Error(`No snapshot of ${prdRoot}${path} before ${retiredBy}.`);
  return { original, timestamp, length: Number(length) };
}

function pendingPage({
  path,
  book,
  role,
  snapshot,
}: {
  path: string;
  book: string;
  role: PageRole;
  snapshot: Snapshot;
}): PendingPage {
  return {
    path,
    file: storedPath(path),
    book,
    role,
    originalUrl: `${prdRoot}${path}`,
    captureUrl: `https://web.archive.org/web/${snapshot.timestamp}id_/${snapshot.original}`,
    captureTimestamp: snapshot.timestamp,
  };
}

// --- Pages -------------------------------------------------------------------

/** Fetches a page's snapshot in the `id_` form and stores its original bytes. */
async function fetchPage({
  capture,
  page,
}: {
  capture: string;
  page: PendingPage;
}): Promise<CapturedPage> {
  const file = join(capture, page.file);
  let body;
  if (existsSync(file)) body = await readFile(file);
  else {
    const response = await politeFetch(page.captureUrl);
    if (response.status !== 200)
      throw new Error(`${page.captureUrl} returned ${response.status}.`);
    body = response.body;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  return { ...page, bytes: body.length, sha256: digest(body) };
}

/** A page captured earlier, checked against its stored bytes. */
async function capturedBefore({
  capture,
  page,
}: {
  capture: string;
  page: CapturedPage;
}) {
  const bytes = await readFile(join(capture, page.file));
  if (bytes.length !== page.bytes || digest(bytes) !== page.sha256)
    throw new Error(`${capture}/${page.file} changed since it was captured.`);
  return page;
}

type HtmlNode = DefaultTreeAdapterMap['childNode'];

/** The paths below the PRD root that a page links to, in document order, without fragments. */
function linkedPaths({ html, path }: { html: string; path: string }) {
  const paths = new Set<string>();
  const base = new URL(path, prdRoot);
  const visit = (node: HtmlNode) => {
    if ('attrs' in node && node.nodeName === 'a')
      for (const { name, value } of node.attrs) {
        if (name !== 'href') continue;
        const url = new URL(value.trim(), base);
        if (
          url.host === 'paizo.com' &&
          url.pathname.startsWith('/pathfinderRPG/prd/')
        )
          paths.add(url.pathname.slice('/pathfinderRPG/prd/'.length));
      }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  parse(html).childNodes.forEach(visit);
  return [...paths];
}

/**
 * The Monster Codex chapters holding the checklist's Monster Codex
 * archetypes: the chapter a page falls in, counting `chapterPages`-page
 * chapters in the root's order from `firstPage`.
 */
export function monsterCodexChapters({
  links,
  items,
  selection,
}: {
  links: readonly string[];
  items: readonly ChecklistItem[];
  selection: Omit<ChapterSelection, 'kind' | 'book' | 'role'>;
}) {
  const chapters = links.filter((link) => selection.pattern.test(link));
  if (chapters.length !== selection.chapters)
    throw new Error(
      `The PRD root links ${chapters.length} Monster Codex chapters, not ${selection.chapters}.`,
    );
  const paths = new Set<string>();
  for (const item of items)
    for (const source of item.sources) {
      if (source.id !== selection.bookId) continue;
      const chapter =
        chapters[
          Math.floor(
            (Number(source.pages) - selection.firstPage) /
              selection.chapterPages,
          )
        ];
      if (!chapter)
        throw new Error(
          `${item.name}: no Monster Codex chapter holds p.${source.pages}.`,
        );
      paths.add(chapter);
    }
  return [...paths].sort();
}

/** The paths a selection takes from an index page's links. */
function selectedPaths({
  index,
  links,
  selection,
  archetypes,
}: {
  index: string;
  links: readonly string[];
  selection: Selection;
  archetypes: readonly ChecklistItem[];
}) {
  if (selection.kind === 'checklist-chapters')
    return monsterCodexChapters({ links, items: archetypes, selection });
  const paths = links.filter((link) => selection.pattern.test(link)).sort();
  if (selection.count !== undefined && paths.length !== selection.count)
    throw new Error(
      `${index || 'The PRD root'} links ${paths.length} ${selection.book} ${selection.role} pages, not ${selection.count}: ${paths.join(', ')}`,
    );
  return paths;
}

// --- Manifest ----------------------------------------------------------------

const manifestFile = 'manifest.json';

async function readManifest(capture: string): Promise<Manifest | null> {
  const file = join(capture, manifestFile);
  if (!existsSync(file)) return null;
  return manifestSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}

async function writeManifest({
  capture,
  manifest,
}: {
  capture: string;
  manifest: Manifest;
}) {
  await writeFile(
    join(capture, manifestFile),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

/** A captured draft page as the complete manifest records it. */
const withoutKind = ({
  kind: _kind,
  ...page
}: Extract<DraftPage, { kind: 'captured' }>): CapturedPage => page;

/** The pages an earlier manifest already captured, by path. */
function capturedPages(manifest: Manifest | null) {
  const pages =
    manifest?.status === 'complete'
      ? manifest.pages
      : (manifest?.pages ?? []).flatMap((page) =>
          page.kind === 'captured' ? [withoutKind(page)] : [],
        );
  return new Map(pages.map((page) => [page.path, page]));
}

const checklistPaths = ['src/pf-prestige-classes', 'src/pf-archetypes'];
const checklistFile = (path: string) =>
  `checklist/${path.split('/').at(-1) ?? path}.json`;

async function readChecklist({
  capture,
  path,
}: {
  capture: string;
  path: string;
}) {
  return checklistFileSchema.parse(
    JSON.parse(await readFile(join(capture, checklistFile(path)), 'utf8')),
  );
}

// --- Dry run -----------------------------------------------------------------

type Listed = { path: string; book: string; role: PageRole };

/**
 * Discovery: reads each book index page (captured earlier, or fetched now)
 * and lists the pages its selections take.
 */
async function discoverPages({
  capture,
  previous,
  lookup,
  archetypes,
}: {
  capture: string;
  previous: Map<string, CapturedPage>;
  lookup: SnapshotLookup;
  archetypes: readonly ChecklistItem[];
}) {
  const indexes: CapturedPage[] = [];
  const listed: Listed[] = [];
  const archived = new Map<string, number>();
  for (const index of indexPages) {
    const known = previous.get(index.path);
    let page;
    if (known) page = await capturedBefore({ capture, page: known });
    else {
      const snapshot = await lookup(index.path);
      archived.set(index.path, snapshot.length);
      page = await fetchPage({
        capture,
        page: pendingPage({ ...index, role: 'index', snapshot }),
      });
    }
    indexes.push(page);
    const links = linkedPaths({
      html: await readFile(join(capture, page.file), 'utf8'),
      path: index.path,
    });
    for (const selection of index.selections)
      for (const path of selectedPaths({
        index: index.path,
        links,
        selection,
        archetypes,
      }))
        listed.push({ path, book: selection.book, role: selection.role });
  }
  return { indexes, listed, archived };
}

/**
 * The draft pages: those captured earlier, checked against their bytes, and
 * the rest pending at their latest snapshot.
 */
async function draftPages({
  capture,
  previous,
  lookup,
  listed,
}: {
  capture: string;
  previous: Map<string, CapturedPage>;
  lookup: SnapshotLookup;
  listed: readonly Listed[];
}) {
  const pages: DraftPage[] = [];
  const archived = new Map<string, number>();
  for (const page of listed) {
    const known = previous.get(page.path);
    if (known) {
      pages.push({
        kind: 'captured',
        ...(await capturedBefore({ capture, page: known })),
      });
      continue;
    }
    const snapshot = await lookup(page.path);
    archived.set(page.path, snapshot.length);
    pages.push({ kind: 'pending', ...pendingPage({ ...page, snapshot }) });
  }
  return { pages, archived };
}

/**
 * Projects the capture's size: captured pages at their bytes, pending ones
 * from their archived lengths (or the captured pages' mean size, when no
 * page was fetched in this run to measure the ratio).
 */
function projectionOf({
  pages,
  archived,
}: {
  pages: readonly DraftPage[];
  archived: ReadonlyMap<string, number>;
}): Projection {
  const captured = pages.filter((page) => page.kind === 'captured');
  const pending = pages.filter((page) => page.kind === 'pending');
  const capturedBytes = sum(captured.map((page) => page.bytes));
  const measured = captured.filter((page) => archived.has(page.path));
  const pendingArchivedBytes = sum(
    pending.map((page) => archived.get(page.path) ?? 0),
  );
  const basis: Projection['basis'] =
    measured.length > 0
      ? {
          kind: 'archived-ratio',
          pendingArchivedBytes,
          originalToArchivedRatio: Number(
            (
              sum(measured.map((page) => page.bytes)) /
              sum(measured.map((page) => archived.get(page.path) ?? 0))
            ).toFixed(3),
          ),
        }
      : {
          kind: 'mean-page',
          meanPageBytes: Math.round(capturedBytes / captured.length),
        };
  const pendingBytes =
    basis.kind === 'archived-ratio'
      ? pendingArchivedBytes * basis.originalToArchivedRatio
      : pending.length * basis.meanPageBytes;
  return {
    pages: pages.length,
    capturedBytes,
    pendingPages: pending.length,
    basis,
    projectedBytes: Math.round(capturedBytes + pendingBytes),
  };
}

/**
 * Dry run: lists the pages from the book index pages and the checklist,
 * looks up each new page's latest snapshot and writes the manifest draft with
 * the projected size. Pages an earlier manifest captured are kept.
 */
async function dryRun(capture: string) {
  await mkdir(capture, { recursive: true });
  const previous = capturedPages(await readManifest(capture));
  const lookup = await snapshotLookup(capture);
  const { items } = await readChecklist({ capture, path: 'src/pf-archetypes' });
  const discovered = await discoverPages({
    capture,
    previous,
    lookup,
    archetypes: archetypesInScope(items),
  });
  const { pages, archived } = await draftPages({
    capture,
    previous,
    lookup,
    listed: discovered.listed,
  });
  const all: DraftPage[] = [
    ...discovered.indexes.map((page) => ({
      kind: 'captured' as const,
      ...page,
    })),
    ...pages,
  ];
  const projection = projectionOf({
    pages: all,
    archived: new Map([...discovered.archived, ...archived]),
  });
  await writeManifest({
    capture,
    manifest: {
      status: 'draft',
      capture: capture.split('/').at(-1) ?? capture,
      source: `Wayback Machine snapshots of ${prdRoot}, the latest with status 200 up to ${retiredBy}, fetched in the id_ form.`,
      retiredBy,
      pages: all,
      projection,
    },
  });
  process.stdout.write(
    `${JSON.stringify({ ...projection, network: fetchTotals() })}\n`,
  );
}

async function readDraft(capture: string): Promise<DraftManifest> {
  const manifest = await readManifest(capture);
  if (manifest?.status !== 'draft')
    throw new Error(`${capture} has no manifest draft.`);
  return manifest;
}

/** Fetches every pending page of the manifest draft and records its bytes and hash. */
async function fetchPages(capture: string) {
  const draft = await readDraft(capture);
  const pages: DraftPage[] = [];
  for (const page of draft.pages)
    if (page.kind === 'captured') pages.push(page);
    else {
      const { kind: _kind, ...pending } = page;
      pages.push({
        kind: 'captured',
        ...(await fetchPage({ capture, page: pending })),
      });
    }
  await writeManifest({ capture, manifest: { ...draft, pages } });
  process.stdout.write(
    `${JSON.stringify({
      pages: pages.length,
      fetched: draft.pages.filter((page) => page.kind === 'pending').length,
      network: fetchTotals(),
    })}\n`,
  );
}

// --- Checklist ---------------------------------------------------------------

/**
 * The `pf1e-archetypes` module at its pinned commit (`prd-identity.ts`). Its
 * text is copied from AoN, so the capture keeps only facts: each item's name,
 * classes and sources (book and page), with its file and git blob id, which
 * every downloaded file is checked against.
 */
const blobListSchema = z.object({
  data: z.object({
    project: z.object({
      repository: z.object({
        tree: z.object({
          blobs: z.object({
            nodes: z.array(z.object({ path: z.string(), sha: z.string() })),
            pageInfo: z.object({
              hasNextPage: z.boolean(),
              endCursor: z.string().nullable(),
            }),
          }),
        }),
      }),
    }),
  }),
});
const blobTextsSchema = z.object({
  data: z.object({
    project: z.object({
      repository: z.object({
        blobs: z.object({
          nodes: z.array(
            z.object({ path: z.string(), rawTextBlob: z.string() }),
          ),
        }),
      }),
    }),
  }),
});
const treeEntrySchema = z.strictObject({ path: z.string(), id: z.string() });
type TreeEntry = z.infer<typeof treeEntrySchema>;

/** Lists the YAML files below `path` at the pinned commit, with their blob ids. */
async function treeOf(path: string) {
  const files: TreeEntry[] = [];
  let after: string | null = null;
  for (;;) {
    const response = await politeFetch('https://gitlab.com/api/graphql', {
      query:
        'query($project: ID!, $ref: String!, $path: String!, $after: String) { project(fullPath: $project) { repository { tree(ref: $ref, path: $path, recursive: true) { blobs(first: 100, after: $after) { nodes { path sha } pageInfo { hasNextPage endCursor } } } } } }',
      variables: {
        project: checklistProject,
        ref: checklistCommit,
        path,
        after,
      },
    });
    if (response.status !== 200)
      throw new Error(`Listing ${path} returned ${response.status}.`);
    const blobs = blobListSchema.parse(
      JSON.parse(response.body.toString('utf8')),
    ).data.project.repository.tree.blobs;
    for (const node of blobs.nodes)
      if (node.path.endsWith('.yaml'))
        files.push({ path: node.path, id: node.sha });
    if (!blobs.pageInfo.hasNextPage) return files;
    after = blobs.pageInfo.endCursor;
  }
}

const gitBlobId = (bytes: Buffer) =>
  createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');

/** A folder record of the module; it has no facts. */
const folderSchema = z.object({
  _key: z.string().startsWith('!folders!'),
});
/** The YAML fields an item's facts come from. */
const itemSchema = z.object({
  name: z.string(),
  type: z.string(),
  system: z.object({
    subType: z.string(),
    associations: z.object({ classes: z.array(z.string()) }).optional(),
    sources: z
      .array(z.object({ id: z.string(), pages: z.string() }))
      .optional(),
  }),
});

/** An item's facts from its YAML file; a folder record has none. */
export function factsOf({
  file,
  blob,
  text,
}: {
  file: string;
  blob: string;
  text: string;
}): ChecklistItem | null {
  const yaml: unknown = parseYaml(text);
  if (folderSchema.safeParse(yaml).success) return null;
  const record = itemSchema.parse(yaml);
  return checklistItemSchema.parse({
    file,
    blob,
    name: record.name,
    type: record.type,
    subType: record.system.subType,
    classes: record.system.associations?.classes ?? null,
    sources: (record.system.sources ?? []).map(({ id, pages }) => ({
      id,
      pages,
    })),
  });
}

/**
 * Fetches up to 50 files at the pinned commit in one GraphQL request (GitLab
 * throttled one request per file) and checks each against its blob id.
 */
async function fetchBlobs(entries: readonly TreeEntry[]) {
  const response = await politeFetch('https://gitlab.com/api/graphql', {
    query:
      'query($project: ID!, $ref: String!, $paths: [String!]!) { project(fullPath: $project) { repository { blobs(ref: $ref, paths: $paths) { nodes { path rawTextBlob } } } } }',
    variables: {
      project: checklistProject,
      ref: checklistCommit,
      paths: entries.map((entry) => entry.path),
    },
  });
  if (response.status !== 200)
    throw new Error(`GitLab returned ${response.status}; rerun to resume.`);
  const nodes = blobTextsSchema.parse(
    JSON.parse(response.body.toString('utf8')),
  ).data.project.repository.blobs.nodes;
  const texts = new Map(nodes.map((node) => [node.path, node.rawTextBlob]));
  for (const entry of entries) {
    const text = texts.get(entry.path);
    if (text === undefined || gitBlobId(Buffer.from(text)) !== entry.id)
      throw new Error(`${entry.path} doesn't match blob ${entry.id}.`);
  }
  return texts;
}

/** Builds one facts-only checklist file, resuming from a partial run. */
async function fetchChecklistFile({
  capture,
  path,
}: {
  capture: string;
  path: string;
}) {
  const file = join(capture, checklistFile(path));
  if (existsSync(file)) return;
  await mkdir(dirname(file), { recursive: true });
  // A rerun resumes from the listing and the files already checked.
  const name = path.split('/').at(-1) ?? path;
  const treeFile = join(capture, 'checklist', `.tree-${name}.json`);
  const partialFile = join(capture, 'checklist', `.partial-${name}.json`);
  const tree = existsSync(treeFile)
    ? z
        .array(treeEntrySchema)
        .parse(JSON.parse(await readFile(treeFile, 'utf8')))
    : await treeOf(path);
  await writeFile(treeFile, JSON.stringify(tree));
  const partial = existsSync(partialFile)
    ? z
        .record(z.string(), checklistItemSchema.nullable())
        .parse(JSON.parse(await readFile(partialFile, 'utf8')))
    : {};
  const missing = tree.filter((entry) => !(entry.path in partial));
  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50);
    const texts = await fetchBlobs(batch);
    for (const entry of batch)
      partial[entry.path] = factsOf({
        file: entry.path,
        blob: entry.id,
        text: texts.get(entry.path) ?? '',
      });
    await writeFile(partialFile, JSON.stringify(partial));
    process.stdout.write(
      `${path}: ${Object.keys(partial).length} of ${tree.length} files\n`,
    );
  }
  const items = tree.flatMap((entry) => partial[entry.path] ?? []);
  await writeFile(
    file,
    `${JSON.stringify(
      { repo: checklistRepo, commit: checklistCommit, path, items },
      null,
      2,
    )}\n`,
  );
  await rm(partialFile);
  await rm(treeFile);
  process.stdout.write(`${path}: ${items.length} items\n`);
}

/** Builds the facts-only checklist files from the pinned commit. */
async function fetchChecklist(capture: string) {
  for (const path of checklistPaths)
    await fetchChecklistFile({ capture, path });
  process.stdout.write(`${JSON.stringify(fetchTotals())}\n`);
}

// --- Finish ------------------------------------------------------------------

/**
 * Completes the manifest with the checklist entries, the coverage of the
 * checklist's archetypes and of the base-class schedules, deletes the
 * snapshot cache and prints the hashes `prdPin` records. No network.
 */
async function finish(capture: string) {
  const draft = await readDraft(capture);
  const pages = draft.pages.map((page) => {
    if (page.kind !== 'captured')
      throw new Error(`${capture} lacks ${page.file}; run the pages step.`);
    return withoutKind(page);
  });
  const checklist = [];
  for (const path of checklistPaths) {
    const file = checklistFile(path);
    const bytes = await readFile(join(capture, file));
    checklist.push({
      repo: checklistRepo,
      commit: checklistCommit,
      path,
      file,
      bytes: bytes.length,
      sha256: digest(bytes),
    });
  }
  const { items } = await readChecklist({ capture, path: 'src/pf-archetypes' });
  const htmlPages = await Promise.all(
    pages.map(async (page) => ({
      path: page.path,
      book: page.book,
      role: page.role,
      html: await readFile(join(capture, page.file), 'utf8'),
    })),
  );
  const coverage = coverageOf({
    items,
    pages: htmlPages.filter((page) => page.role === 'archetypes'),
  });
  const classCoverage = classCoverageOf({
    schedules: prdClassSchedules,
    pages: htmlPages,
  });
  const { projection: _projection, ...rest } = draft;
  const manifest: CompleteManifest = {
    ...rest,
    status: 'complete',
    pages,
    totals: {
      pages: pages.length,
      bytes: sum(pages.map((page) => page.bytes)),
    },
    checklist,
    coverage: {
      exclusions: {
        'arg-uncommon-races': prdExclusions['arg-uncommon-races'].reason,
      },
      items: coverage,
      classes: {
        exclusions: {
          'not-in-prd': prdClassExclusions['not-in-prd'].reason,
        },
        schedules: classCoverage,
      },
    },
  };
  await writeManifest({ capture, manifest });
  await rm(join(capture, cacheFile), { force: true });
  process.stdout.write(`${JSON.stringify(await hashPrdCapture(capture))}\n`);
}

const defaultCapture = join(
  homedir(),
  'repos/everythingpath/sources',
  prdCaptureName,
);

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, capture = defaultCapture] = process.argv.slice(2);
  if (command === 'checklist') await fetchChecklist(capture);
  else if (command === 'dry-run') await dryRun(capture);
  else if (command === 'pages') await fetchPages(capture);
  else if (command === 'finish') await finish(capture);
  else if (command === 'verify')
    process.stdout.write(
      `${JSON.stringify(await verifyPrdCapture(capture))}\n`,
    );
  else
    throw new Error(
      'Usage: prd-capture.ts checklist|dry-run|pages|finish|verify [capture dir]',
    );
}
