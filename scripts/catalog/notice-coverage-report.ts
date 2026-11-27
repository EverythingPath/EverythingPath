import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { assessCatalogAdmission } from './admission.ts';
import { importCatalog } from './import.ts';
import { foundryBooksOf } from './legal/registry-aliases.ts';
import {
  noticeCoverage,
  uncoveredAdmissions,
  type NoticeCoverage,
} from './notice-coverage.ts';
import { pcgenDataPath } from './operator.ts';
import { importPinnedCatalog } from './pinned-import.ts';
import { pinnedCatalogCheckouts } from './party/pinned-catalog-checkouts.ts';
import { partyScopeVersion } from './party/party-scope.ts';
import { pcgenBooks, pcgenNoticeBooks } from './pcgen-books.ts';
import { readCommittedRegisterAdmission } from './register-admission.ts';
import { launchInventoryScopes } from './release-scope.ts';
import { openReleaseScope } from './release-scopes.ts';
import type { Section15Registry } from '../../src/lib/catalog/legal-types.ts';
import { resolveNotice } from '../../src/lib/catalog/resolve-notice.ts';

/** The committed release scopes, the party's first: the report's default. */
export const committedScopes = [partyScopeVersion, ...launchInventoryScopes];
/** The whole corpus at the pins, as `catalog:preview --pcgen` imports it. */
export const wholeCorpus = 'whole-corpus';
const reportable = [...committedScopes, wholeCorpus];

type Gate = ReturnType<typeof assessCatalogAdmission>;
type GateClass = 'admitted' | 'held' | 'dependent-omitted' | 'failed';
type CoverageEntry = { externalKey: string; name: string };

/** A scope's coverage, as `catalog:notice-coverage` reports it. */
export type ScopeCoverage = {
  version: string;
  counts: Record<NoticeCoverage['kind'], number> & { entries: number };
  /** Each book (by the code the gate requires) without a reviewed notice, with its entries. */
  missingBooks: {
    code: string;
    title: string | undefined;
    entries: (CoverageEntry & { gate: GateClass })[];
  }[];
  /** Admitted rows the register does not cover: a release refuses each. */
  uncoveredAdmitted: string[];
};

function classesOf(gate: Gate) {
  const classes = new Map<string, GateClass>();
  for (const { externalKey } of gate.failures)
    classes.set(externalKey, 'failed');
  for (const { externalKey } of gate.dependentOmissions)
    classes.set(externalKey, 'dependent-omitted');
  for (const { externalKey } of gate.held) classes.set(externalKey, 'held');
  for (const { externalKey } of gate.admitted)
    classes.set(externalKey, 'admitted');
  return classes;
}

/**
 * A scope's coverage from its entries and the gate run on the register only
 * (`noticeCoverage`): the counts, the books without a reviewed notice with
 * the entries each holds back, and the admitted rows left uncovered. An
 * entry the gate assessed no row for counts as not decided.
 */
export function summarizeCoverage({
  version,
  entries,
  gate,
  titleOf,
}: {
  version: string;
  entries: readonly CoverageEntry[];
  gate: Gate;
  titleOf: (code: string) => string | undefined;
}): ScopeCoverage {
  const coverage = noticeCoverage(gate);
  const classes = classesOf(gate);
  const counts = {
    entries: entries.length,
    covered: 0,
    uncovered: 0,
    'no-book': 0,
    'not-decided': 0,
  };
  const byBook = new Map<string, ScopeCoverage['missingBooks'][number]>();
  for (const entry of entries) {
    const found = coverage.get(entry.externalKey) ?? {
      kind: 'not-decided' as const,
    };
    counts[found.kind] += 1;
    if (found.kind !== 'uncovered') continue;
    for (const code of found.missing) {
      const book = byBook.get(code) ?? {
        code,
        title: titleOf(code),
        entries: [],
      };
      book.entries.push({
        externalKey: entry.externalKey,
        name: entry.name,
        gate: classes.get(entry.externalKey) ?? 'failed',
      });
      byBook.set(code, book);
    }
  }
  const missingBooks = [...byBook.values()]
    .sort((a, b) => (a.code < b.code ? -1 : 1))
    .map((book) => ({
      ...book,
      entries: book.entries.sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          (a.externalKey < b.externalKey ? -1 : 1),
      ),
    }));
  return {
    version,
    counts,
    missingBooks,
    uncoveredAdmitted: uncoveredAdmissions({
      admitted: gate.admitted,
      coverage,
    }),
  };
}

const cell = (text: string) => text.replaceAll('|', '\\|');

/** The report as Markdown: a short table per scope, then its uncovered entries by book. */
export function formatCoverageReport(scopes: readonly ScopeCoverage[]) {
  const lines = [
    '# Notice coverage',
    '',
    'Every entry of each release scope as the release gate decides it on the notice register and the frozen stored notices alone: covered when every book it comes from, and every notice its stored assessment required, has a reviewed notice; uncovered when one has none; no book when neither its record nor the scripted match names one and no stored notice applies. Not decided holds the entries the gate failed before reading their books (a broken structure or reference, an entry absent from the import inventory, a duplicate): the gate does not expose their books, so they are counted, not listed by book. A book is named by the code the gate requires for it.',
  ];
  for (const scope of scopes) {
    const { counts } = scope;
    lines.push(
      '',
      `## ${scope.version}`,
      '',
      '| entries | covered | uncovered | no book | not decided |',
      '|---|---|---|---|---|',
      `| ${counts.entries} | ${counts.covered} | ${counts.uncovered} | ${counts['no-book']} | ${counts['not-decided']} |`,
      '',
      scope.uncoveredAdmitted.length
        ? `Admitted but uncovered (a release refuses these): ${scope.uncoveredAdmitted.join('; ')}.`
        : 'Admitted but uncovered: none.',
    );
    if (!scope.missingBooks.length) {
      lines.push('', 'Books without a reviewed notice: none.');
      continue;
    }
    lines.push(
      '',
      'Books without a reviewed notice:',
      '',
      '| book | title | entries |',
      '|---|---|---|',
      ...scope.missingBooks.map(
        ({ code, title, entries }) =>
          `| ${cell(code)} | ${cell(title ?? '(title unknown)')} | ${entries.length} |`,
      ),
      '',
      '### Uncovered entries by book',
    );
    for (const { code, title, entries } of scope.missingBooks)
      lines.push(
        '',
        `**${cell(code)}** ${cell(title ?? '(title unknown)')}`,
        '',
        '| entry | key | gate |',
        '|---|---|---|',
        ...entries.map(
          ({ name, externalKey, gate }) =>
            `| ${cell(name)} | \`${externalKey}\` | ${gate} |`,
        ),
      );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * A book's title, where known: its Registry record's (by code or alias, even
 * an unreviewed one), else Foundry's book registry's (with its product line
 * for a companion or setting book), else the PCGen crosswalk's.
 */
export function bookTitles({
  registry,
  foundrySources,
}: {
  registry: Section15Registry;
  foundrySources: string;
}) {
  const foundry = foundryBooksOf(foundrySources);
  const crosswalk = new Map(
    [...pcgenBooks.books, ...pcgenNoticeBooks.books].map(({ book, code }) => [
      code.id,
      book,
    ]),
  );
  const lines: Record<string, string> = {
    companion: 'Player Companion: ',
    setting: 'Campaign Setting: ',
  };
  const foundryTitle = (code: string) => {
    const book = foundry.get(code);
    return book && `${(book.type && lines[book.type]) ?? ''}${book.name}`;
  };
  return (code: string) =>
    resolveNotice({ registry, code })?.title ??
    foundryTitle(code) ??
    crosswalk.get(code);
}

/** A scope's import, as `catalog:release build --scope` reads it, or the whole corpus. */
async function importFor(
  version: string,
  checkouts: Awaited<ReturnType<typeof pinnedCatalogCheckouts>>,
  read: (path: string) => Promise<unknown>,
) {
  if (version === wholeCorpus)
    return (await importPinnedCatalog({ checkouts })).artifact;
  const scope = await openReleaseScope({ version });
  return importCatalog({
    systemPath: checkouts.system,
    contentPath: checkouts.content,
    remaps: await read('reviewed-remaps.json'),
    curation: await read('reviewed-curation.json'),
    scopeKeys: scope.importKeys,
    ...(scope.pcgenKeys &&
      checkouts.pcgen && {
        pcgen: {
          path: pcgenDataPath(checkouts.pcgen),
          scopeKeys: scope.pcgenKeys,
        },
      }),
    wholeCorpus: checkouts.verification.status === 'verified',
  });
}

/**
 * `pnpm catalog:notice-coverage [--scope <version>]`: each scope imported as
 * `catalog:release build --scope` imports it (or the whole corpus), at the
 * pinned checkouts, and the gate run on it with the committed register and
 * frozen stored notices only.
 */
export async function reportNoticeCoverage(versions: readonly string[]) {
  const read = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(new URL(`./${path}`, import.meta.url), 'utf8'));
  // The register first: an unreadable one refuses before any import.
  const register = await readCommittedRegisterAdmission();
  const checkouts = await pinnedCatalogCheckouts();
  const titleOf = bookTitles({
    registry: register.registry,
    foundrySources: await readFile(
      join(checkouts.system, 'module/registry/sources.mjs'),
      'utf8',
    ),
  });
  const scopes: ScopeCoverage[] = [];
  for (const version of versions) {
    const artifact = await importFor(version, checkouts, read);
    scopes.push(
      summarizeCoverage({
        version,
        entries: [...artifact.catalog.entries, ...artifact.catalog.resources],
        gate: assessCatalogAdmission({ artifact, ...register }),
        titleOf,
      }),
    );
  }
  return {
    text: formatCoverageReport(scopes),
    uncoveredAdmitted: scopes.flatMap(({ version, uncoveredAdmitted }) =>
      uncoveredAdmitted.map((row) => `${version}: ${row}`),
    ),
  };
}

const usage = `Usage: pnpm -s catalog:notice-coverage [--scope VERSION]
Imports each release scope (default: ${committedScopes.join(' and ')}; ${wholeCorpus} for the whole corpus) as catalog:release build --scope does, at the pinned checkouts, runs the admission gate on it with the committed notice register and frozen stored notices only, and prints, per scope, the entries whose every book and stored notice has a reviewed notice, the books without one with the entries each holds back, the entries with no book and those not decided. Exits 0 on a report or this help; 2 when it cannot produce a report: a usage error, an unknown scope, unreadable input, or a report that fails its own consistency check (an admitted entry it does not cover, named).
`;

/** The command's outcome: its exit status and output. */
export type CoverageCommandResult = {
  status: 0 | 2;
  stdout: string;
  stderr: string;
};

/**
 * `catalog:notice-coverage` as a function of its arguments: 0 for a report
 * or the help, 2 when no report could be produced (an unknown option or
 * scope, an unreadable input, or a report whose consistency check fails: the
 * gate admitted a row it does not cover, which it never does, so the keys are
 * named as an error).
 */
export async function runNoticeCoverageCommand(
  args: readonly string[],
  report: typeof reportNoticeCoverage = reportNoticeCoverage,
): Promise<CoverageCommandResult> {
  let scope: string | undefined;
  try {
    const { values } = parseArgs({
      args: [...args],
      options: { scope: { type: 'string' }, help: { type: 'boolean' } },
      strict: true,
      allowPositionals: false,
    });
    if (values.help) return { status: 0, stdout: usage, stderr: '' };
    scope = values.scope;
  } catch (error) {
    return { status: 2, stdout: '', stderr: `${message(error)}\n${usage}` };
  }
  if (scope !== undefined && !reportable.includes(scope))
    return {
      status: 2,
      stdout: '',
      stderr: `Unknown scope ${scope}; known: ${reportable.join(', ')}.\n`,
    };
  try {
    const { text, uncoveredAdmitted } = await report(
      scope === undefined ? committedScopes : [scope],
    );
    return uncoveredAdmitted.length
      ? {
          status: 2,
          stdout: '',
          stderr: `Inconsistent coverage report: admitted but uncovered: ${uncoveredAdmitted.join('; ')}.\n`,
        }
      : { status: 0, stdout: text, stderr: '' };
  } catch (error) {
    return { status: 2, stdout: '', stderr: `${message(error)}\n` };
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
