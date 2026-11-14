// usage, from a batch worktree (cur-prep.sh, prep_regenerate in prep-lib.sh):
//   pnpm -s exec tsx prep-regen.ts check <wave-base> <wave>
//   pnpm -s exec tsx prep-regen.ts notices
//   pnpm -s exec tsx prep-regen.ts pin <summary.json> <wave-base> <wave>
// The steps of curation prep's regeneration of the generated launch artifacts
// (prep_regen_files in prep-lib.sh) after a rebase conflicted in them. <wave>
// is the batch's commit before the rebase and <wave-base> the commit it was
// made on; the worktree holds the base side of every generated artifact.
// - check refuses, naming the file, a wave whose own change to a generated
//   artifact is not regenerable: content in an authored scope document
//   (advanced, checkpoints, companions, core; the authority beyond its notice
//   authority hash), whose bytes alone follow the shared records dictionary,
//   or launch-document.test.ts beyond its pinned values and comment lines
//   added just above them.
// - notices reproduces the notice authority from a fresh pinned-input build,
//   as `catalog:launch-inventory` verifies it, and rebinds its hash in the
//   authority document; `catalog:launch-inventory --write` then re-compacts
//   both.
// - pin writes launch-document.test.ts as the base side with the wave's added
//   comment lines, pinning <summary.json>, the summary
//   `catalog:launch-inventory --write` printed.
// The catalog modules are the worktree's (the current directory), not this
// checkout's: prep may run from another checkout's scripts.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import type * as InventoryModule from '../catalog/inventory.ts';
import type * as BuildModule from '../catalog/launch-inventory-build.ts';
import type * as DocumentModule from '../catalog/launch-inventory-document.ts';
import type * as LaunchModule from '../catalog/launch-inventory.ts';
import type * as NoticeModule from '../catalog/launch-notice-authority.ts';

const scopes = 'scripts/catalog/scopes';
const pinPath = 'tests/catalog/launch-document.test.ts';
const pinStart = '  expect(JSON.parse(output)).toEqual({';
const pinEnd = '  });';
// The scope documents whose content is authored; their stored bytes follow
// the shared records dictionary. The authority's notice hash is generated.
const authoredScopes = ['advanced', 'checkpoints', 'companions', 'core'];
const never =
  'Generated launch artifacts are never hand-merged: repair the inputs or the generator and regenerate them, or escalate.';

/** Each scope document's text (by short name, the manifest '') and the records dictionary's, at one revision. */
export type ScopeRevision = {
  documents: Record<string, string | undefined>;
  records: string | undefined;
};

function scopeFile(name: string) {
  return `campaign-mvp-v1${name ? `.${name}` : ''}.json`;
}

async function worktreeModule<T>(path: string) {
  // Safe cast: T names the type of this module in this checkout; the worktree's copy is the same module on the integration base.
  return (await import(pathToFileURL(resolve(path)).href)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function splitPin(text: string) {
  const lines = text.split('\n');
  const starts = lines.flatMap((line, i) => (line === pinStart ? [i] : []));
  const start = starts[0];
  const end =
    start === undefined
      ? -1
      : lines.findIndex((line, i) => i > start && line === pinEnd);
  if (starts.length !== 1 || start === undefined || end < 0)
    throw new Error(`${pinPath} does not hold one CLI pin.`);
  return {
    head: lines.slice(0, start).map((line) => `${line}\n`),
    tail: lines.slice(end).join('\n'),
  };
}

/** The comment lines the wave added just above the pin, refusing any other change to the file but the pinned values. */
export function pinComment(waveBase: string, wave: string) {
  const before = splitPin(waveBase);
  const after = splitPin(wave);
  const added = after.head.slice(before.head.length);
  if (
    after.tail !== before.tail ||
    before.head.some((line, i) => after.head[i] !== line) ||
    added.some((line) => !/^\s*\/\/.*\n$/.test(line))
  )
    throw new Error(
      `The wave changed ${pinPath} outside its pinned values and the comment above them. ${never}`,
    );
  return added.join('');
}

/** The base side's pin file with the wave's comment lines (once), pinning the regenerated summary. */
export async function regeneratePin({
  base,
  comment,
  summary,
}: {
  base: string;
  comment: string;
  summary: Record<string, unknown>;
}) {
  const { head, tail } = splitPin(base);
  const above = head.join('');
  const values = Object.entries(summary)
    .map(([key, value]) => `    ${key}: ${JSON.stringify(value)},\n`)
    .join('');
  const text = `${above.endsWith(comment) ? above : above + comment}${pinStart}\n${values}${tail}`;
  const config = await resolveConfig(resolve(pinPath));
  return format(text, { ...config, filepath: pinPath });
}

/** The scope documents whose content the wave changed beyond what regeneration rewrites, by file name. */
export async function scopeChanges(
  before: ScopeRevision,
  after: ScopeRevision,
) {
  // Not launch-inventory.ts: it parses the committed authority when loaded,
  // and the worktree mixes both sides' scope documents until the base side
  // is taken.
  const documents = await worktreeModule<typeof DocumentModule>(
    'scripts/catalog/launch-inventory-document.ts',
  );
  const content = (revision: ScopeRevision, name: string) => {
    const text = revision.documents[name];
    if (text === undefined) return undefined;
    const value = documents.parseLaunchInventoryDocument(
      JSON.parse(text),
      revision.records === undefined ? undefined : JSON.parse(revision.records),
    );
    if (name !== 'authority' || !isRecord(value)) return canonical(value);
    const { noticeAuthoritySha256: _, ...rest } = value;
    return canonical(rest);
  };
  return ['authority', ...authoredScopes]
    .filter((name) => content(before, name) !== content(after, name))
    .map(scopeFile)
    .sort();
}

// JSON with sorted keys, so equal content compares equal however stored.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}

function show(revision: string, path: string) {
  try {
    return execFileSync('git', ['show', `${revision}:${path}`], {
      encoding: 'utf8',
      maxBuffer: 1 << 30,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

function scopeRevision(revision: string): ScopeRevision {
  return {
    documents: Object.fromEntries(
      ['authority', ...authoredScopes].map((name) => [
        name,
        show(revision, `${scopes}/${scopeFile(name)}`),
      ]),
    ),
    records: show(revision, `${scopes}/campaign-mvp-v1.records.json`),
  };
}

async function check(waveBase: string, wave: string) {
  const changed = await scopeChanges(
    scopeRevision(waveBase),
    scopeRevision(wave),
  );
  if (changed.length)
    throw new Error(
      `The wave changed the content of ${changed.join(', ')}, which regeneration would drop. ${never}`,
    );
  pinComment(show(waveBase, pinPath) ?? '', show(wave, pinPath) ?? '');
}

async function notices() {
  const root = resolve('.');
  const { buildLaunchInventory } = await worktreeModule<typeof BuildModule>(
    'scripts/catalog/launch-inventory-build.ts',
  );
  const { buildLaunchNoticeAuthority } = await worktreeModule<
    typeof NoticeModule
  >('scripts/catalog/launch-notice-authority.ts');
  const { pcgenPin } = await worktreeModule<typeof InventoryModule>(
    'scripts/catalog/inventory.ts',
  );
  const { parseLaunchInventoryDocument } = await worktreeModule<
    typeof DocumentModule
  >('scripts/catalog/launch-inventory-document.ts');
  const { launchInventoryHash } = await worktreeModule<typeof LaunchModule>(
    'scripts/catalog/launch-inventory.ts',
  );
  // The pinned inputs, as scripts/catalog-launch-inventory.ts reads them.
  const parent = join(homedir(), 'repos/everythingpath');
  const paths = {
    pf1: join(parent, 'sources/foundryvtt-pathfinder1'),
    'pf1-content': join(parent, 'sources/pf1-content'),
    pcgen: join(
      parent,
      `.ep-cache/pcgen-${pcgenPin.commit.slice(0, 8)}`,
      pcgenPin.directory,
    ),
    prd: join(parent, 'sources/prd-2026-10-20'),
  };
  const inventory = await buildLaunchInventory({ paths, repoRoot: root });
  const reproduced = await buildLaunchNoticeAuthority({
    inventory,
    repoRoot: root,
  });
  const authorityPath = join(scopes, scopeFile('authority'));
  const authority = parseLaunchInventoryDocument(
    JSON.parse(readFileSync(authorityPath, 'utf8')),
  );
  if (!isRecord(authority))
    throw new Error(`${authorityPath} is not an authority document.`);
  const before = authority.noticeAuthoritySha256;
  authority.noticeAuthoritySha256 = launchInventoryHash(reproduced);
  writeFileSync(join(scopes, scopeFile('notices')), JSON.stringify(reproduced));
  writeFileSync(authorityPath, JSON.stringify(authority));
  process.stdout.write(
    `notice authority ${String(before)} -> ${String(authority.noticeAuthoritySha256)}\n`,
  );
}

async function pin(summaryPath: string, waveBase: string, wave: string) {
  const comment = pinComment(
    show(waveBase, pinPath) ?? '',
    show(wave, pinPath) ?? '',
  );
  const summary: unknown = JSON.parse(readFileSync(summaryPath, 'utf8'));
  if (!isRecord(summary))
    throw new Error(`${summaryPath} is not the inventory summary.`);
  writeFileSync(
    pinPath,
    await regeneratePin({
      base: readFileSync(pinPath, 'utf8'),
      comment,
      summary,
    }),
  );
}

const commands: Record<string, (...args: string[]) => Promise<void>> = {
  check: (waveBase = '', wave = '') => check(waveBase, wave),
  notices,
  pin: (summary = '', waveBase = '', wave = '') => pin(summary, waveBase, wave),
};
const arity: Record<string, number> = { check: 2, notices: 0, pin: 3 };

async function main([command = '', ...args]: string[]) {
  const run = commands[command];
  if (!run || args.length !== arity[command] || args.some((arg) => !arg))
    throw new Error(
      'usage: prep-regen.ts check <wave-base> <wave> | notices | pin <summary.json> <wave-base> <wave>',
    );
  await run(...args);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  await main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `prep-regen: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
