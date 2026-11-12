import { execFileSync } from 'node:child_process';
import { launchManifestSchema } from './catalog/launch-inventory-schema.ts';
import { verifyLaunchCheckpointAuthority } from './catalog/launch-checkpoint-audit.ts';
import { verifyLaunchNoticeAuthority } from './catalog/launch-notice-audit.ts';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildLaunchInventory } from './catalog/launch-inventory-build.ts';
import {
  inspectLaunchInventory,
  serializeLaunchInventory,
  launchInventoryHash,
  renderLaunchInventoryReport,
  renderLaunchInventoryOverview,
} from './catalog/launch-inventory.ts';
import { pcgenPin, pins } from './catalog/inventory.ts';
import { verifyPrdCapture } from './catalog/prd-pin.ts';
import {
  launchInventoryDocuments,
  launchInventoryDocument,
  serializeLaunchInventoryDocument,
  parseLaunchInventory,
  parseLaunchInventoryDocument,
} from './catalog/launch-inventory-document.ts';

const args = new Set(process.argv.slice(2));
if (args.has('--write') && args.has('--check'))
  throw new Error('Choose either --write or read-only --check.');
for (const arg of args)
  if (
    ![
      '--write',
      '--check',
      '--verify',
      '--report',
      '--expanded',
      '--diagnostics',
    ].includes(arg)
  )
    throw new Error(`Unknown inventory argument ${arg}.`);
if (args.has('--verify') && !args.has('--write') && !args.has('--check'))
  throw new Error('--verify needs --write or --check.');
const root = resolve('.');
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
const path = 'scripts/catalog/scopes/campaign-mvp-v1.json';
const markdown = 'docs/catalog-import/campaign-mvp-inventory.md';
const artifactNames = [
  'advanced',
  'authority',
  'checkpoints',
  'companions',
  'core',
  '',
  'notices',
].map((name) => `campaign-mvp-v1${name ? `.${name}` : ''}.json`);
const directory = 'scripts/catalog/scopes';
const verificationPath = join(directory, 'campaign-mvp-v1.verification.json');
let writtenManifest: unknown;
if (args.has('--verify')) {
  // The projection reads the committed inventory; `--check` keeps that current.
  const { buildLaunchVerification } =
    await import('./catalog/launch-verification-build.ts');
  const { serializeLaunchVerification } =
    await import('./catalog/launch-verification.ts');
  const document = await buildLaunchVerification({
    repoRoot: root,
    systemPath: paths.pf1,
    contentPath: paths['pf1-content'],
  });
  const bytes = serializeLaunchVerification(document);
  if (args.has('--write')) await writeFile(verificationPath, bytes);
  else if (bytes !== (await readFile(verificationPath, 'utf8').catch(() => '')))
    throw new Error(
      'The verification projection is stale: run pnpm -s catalog:launch-inventory --verify --write.',
    );
  const met = document.rows.filter(({ verified }) => verified.length === 4);
  process.stdout.write(
    `${JSON.stringify({ version: document.scopeVersion, identity: document.binding.launchScopeIdentity, projectedRows: document.rows.length, allObservationsVerified: met.length, inputs: Object.keys(document.binding.inputs).length, bytes: Buffer.byteLength(bytes) }, null, 2)}\n`,
  );
  process.exit(0);
}
if (args.has('--write') || args.has('--check')) {
  for (const repo of ['pf1', 'pf1-content'] as const) {
    const actual = execFileSync(
      'git',
      ['-C', paths[repo], 'rev-parse', 'HEAD'],
      { encoding: 'utf8' },
    ).trim();
    if (actual !== pins[repo].commit)
      throw new Error(`Wrong pinned ${repo} checkout.`);
  }
  const actualPcgen = execFileSync(
    'git',
    ['-C', paths.pcgen, 'rev-parse', 'HEAD'],
    { encoding: 'utf8' },
  ).trim();
  if (actualPcgen !== pcgenPin.commit)
    throw new Error('Wrong pinned PCGen checkout.');
  await verifyPrdCapture(paths.prd);
  await verifyLaunchCheckpointAuthority({ prdRoot: paths.prd });
  let manifest = await buildLaunchInventory({ paths, repoRoot: root });
  await verifyLaunchNoticeAuthority({ inventory: manifest, repoRoot: root });
  if (args.has('--check')) {
    const stored = parseLaunchInventory(
      JSON.parse(await readFile(path, 'utf8')),
    );
    for (const field of launchManifestSchema.keyof().options) {
      if (
        launchInventoryHash(manifest[field]) !==
        launchInventoryHash(stored[field])
      )
        throw new Error(`Manifest differs from its pinned inputs: ${field}.`);
    }
  }
  // Retain the landed v2 representation's exact array ordering before sharing
  // across artifacts. Expanded set sorting alone changes historical row order.
  manifest = parseLaunchInventory(
    JSON.parse(serializeLaunchInventory(launchInventoryDocument(manifest))),
  );
  function* inputs(): Generator<readonly [string, unknown]> {
    for (const name of artifactNames)
      yield [
        name,
        name === 'campaign-mvp-v1.json'
          ? manifest
          : parseLaunchInventoryDocument(
              JSON.parse(readFileSync(join(directory, name), 'utf8')),
            ),
      ];
  }
  const compact = launchInventoryDocuments(inputs());
  const artifacts = {
    ...compact.documents,
    'campaign-mvp-v1.records.json': compact.records,
  };
  for (const [name, document] of Object.entries(artifacts)) {
    const bytes = serializeLaunchInventoryDocument(document);
    const destination = join(directory, name);
    if (args.has('--write')) await writeFile(destination, bytes);
    else if (bytes !== (await readFile(destination, 'utf8')))
      throw new Error(`Noncanonical inventory storage: ${name}.`);
  }
  const overview = renderLaunchInventoryOverview(manifest);
  if (args.has('--write')) await writeFile(markdown, overview);
  else if ((await readFile(markdown, 'utf8')) !== overview)
    throw new Error('The inventory overview is stale.');
  if (args.has('--write')) writtenManifest = manifest;
}
const value: unknown =
  writtenManifest ?? JSON.parse(await readFile(path, 'utf8'));
const report = inspectLaunchInventory(value);
if (args.has('--report'))
  process.stdout.write(renderLaunchInventoryReport(value));
else if (args.has('--expanded')) writeJson(parseLaunchInventory(value));
else if (args.has('--diagnostics')) writeJson(report);
else
  process.stdout.write(
    `${JSON.stringify({ version: report.scopeVersion, identity: report.identity, roots: report.roots.length, checkpoints: report.checkpoints.length, rows: report.rowCount, pools: report.poolCount, inventoryErrors: report.inventoryErrors.length, outstandingRequirements: report.launchFailures.length, genericComplete: report.genericComplete, launchQualified: report.launchQualified, party: report.party.status }, null, 2)}\n`,
  );
// A successful inventory build/check does not hide failed completeness/qualification.
if (!args.has('--write') && !args.has('--check') && !report.genericComplete)
  process.exitCode = 1;

// Large diagnostic arrays are emitted incrementally, avoiding a second complete string in memory.
function writeJson(value: Record<string, unknown>) {
  process.stdout.write('{');
  let separator = '';
  for (const [key, item] of Object.entries(value)) {
    process.stdout.write(`${separator}${JSON.stringify(key)}:`);
    separator = ',';
    if (!Array.isArray(item)) {
      process.stdout.write(JSON.stringify(item));
      continue;
    }
    process.stdout.write('[');
    let itemSeparator = '';
    for (const entry of item) {
      process.stdout.write(`${itemSeparator}${JSON.stringify(entry)}`);
      itemSeparator = ',';
    }
    process.stdout.write(']');
  }
  process.stdout.write('}\n');
}
