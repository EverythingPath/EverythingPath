import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

// pnpm -s lint:paths <path...> | --since <ref>: ESLint on the named files
// only, for fix rounds (docs/agents/orchestration/operations.md). It runs the
// full lint's three legs, lint:eslint:app, lint:eslint:tests and
// lint:eslint:convex, read from package.json with their target replaced by
// the files: tests/ in the tests leg's process, convex/ in the Convex leg's,
// everything else in the app leg's, one after the other. So it
// reports what the full lint reports for these files, suppressions included
// (ESLint matches them per linted file). It cannot report a finding that a
// change causes in a file it does not lint, such as a type change in an
// unchanged dependent; only the full lint does.
//
// Above maxFiles it refuses: its memory class, curator-lintpaths at 7 GiB
// (memory-reservations.tsv), covers the worst 50-file set measured, 6.12 GiB
// real (the 30 files importing the most JSON and the 20 largest
// tests/catalog files), plus 10%. The cost is the JSON a file's types reach,
// not its count: 25 such files already peaked at 4.94 GiB. Past 50 files the
// full lint is the check.
const maxFiles = 50;
const extensions = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.jsx',
  '.ts',
  '.cts',
  '.mts',
  '.tsx',
]);
const usage =
  'usage: pnpm -s lint:paths <path...> | pnpm -s lint:paths --since <ref>';
const plainWord = /^[\w./=:@%+,-]+$/;

type Leg = {
  name: 'app' | 'tests' | 'Convex';
  script: string;
  target: string;
  files: string[];
};
type Named = { file: string; deleted?: boolean };

class Refusal extends Error {}

function git(root: string, args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr =
      error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
    throw new Refusal(`git ${args.join(' ')} failed: ${stderr.trim()}`);
  }
}

// The files changed since <ref>'s merge base with HEAD, in the working tree:
// added, modified and renamed (by the new path), committed or not; untracked
// files git does not ignore; and the deleted ones, to be named as skipped.
function changedSince(root: string, ref: string): Named[] {
  const fields = git(root, [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    '--merge-base',
    ref,
    '--',
  ]).split('\0');
  const named: Named[] = [];
  for (let i = 0; i + 1 < fields.length; ) {
    const status = fields[i++] ?? '';
    // A rename or copy names the old path, then the new one.
    if (/^[RC]/.test(status)) i++;
    named.push({ file: fields[i++] ?? '', deleted: status === 'D' });
  }
  const untracked = git(root, [
    'ls-files',
    '-z',
    '--others',
    '--exclude-standard',
  ]);
  for (const file of untracked.split('\0')) if (file) named.push({ file });
  return named;
}

function parseArgs(root: string, args: string[]): Named[] {
  if (args[0] === '--since') {
    const ref = args[1];
    if (args.length !== 2 || !ref || ref.startsWith('-'))
      throw new Refusal(usage);
    return changedSince(root, ref);
  }
  if (!args.length || args.some((arg) => arg.startsWith('-')))
    throw new Refusal(usage);
  return args.map((file) => ({ file }));
}

const quote = (word: string) =>
  plainWord.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;

// A leg's command from its package script, with the target that follows
// eslint.js replaced by the files. Only plain and single-quoted words are
// read, so a script this cannot read exactly is refused.
function legCommand(root: string, leg: Leg) {
  // Safe cast: package.json is an object; a missing script is refused below.
  const { scripts } = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> };
  const script = scripts?.[leg.script] ?? '';
  const words = [...script.matchAll(/'([^']*)'|(\S+)/g)].map(
    ([text, quoted, plain]) => ({ text, word: quoted ?? plain ?? '', quoted }),
  );
  const eslint = words.findIndex(({ word }) =>
    word.endsWith('/eslint/bin/eslint.js'),
  );
  const readable = words.every(
    ({ word, quoted }) => quoted !== undefined || plainWord.test(word),
  );
  if (
    !readable ||
    words[0]?.word !== 'node' ||
    eslint < 0 ||
    words[eslint + 1]?.word !== leg.target
  )
    throw new Refusal(
      `can't read ${leg.script} as node <flags> .../eslint.js ${leg.target} <options>: ${script}`,
    );
  const before = words.slice(0, eslint + 1);
  const after = words.slice(eslint + 2);
  return {
    // Without the leading node: the leg runs under this process's node.
    argv: [
      ...before.slice(1).map(({ word }) => word),
      ...leg.files,
      ...after.map(({ word }) => word),
    ],
    shown: [
      ...before.map(({ text }) => text),
      ...leg.files.map(quote),
      ...after.map(({ text }) => text),
    ].join(' '),
  };
}

async function skipReason(eslint: ESLint, root: string, named: Named) {
  if (named.deleted) return 'deleted';
  const absolute = path.resolve(root, named.file);
  const stat = statSync(absolute, { throwIfNoEntry: false });
  if (!stat) return 'not found (deleted?)';
  if (stat.isDirectory())
    throw new Refusal(
      `${named.file} is a directory: name its files, or run pnpm -s lint`,
    );
  if (!extensions.has(path.extname(absolute)))
    return 'not a JavaScript or TypeScript file';
  if (await eslint.isPathIgnored(absolute))
    return 'ignored by the ESLint configuration';
  return undefined;
}

// The files to lint, repository-relative and sorted, after naming each
// skipped one and why.
async function choose(root: string, named: Named[]) {
  const eslint = new ESLint({ cwd: root });
  const lint = new Set<string>();
  const skipped = new Map<string, string>();
  for (const entry of named) {
    const relative = path.relative(root, path.resolve(root, entry.file));
    const file = relative.split(path.sep).join('/');
    const reason =
      relative.startsWith('..') || path.isAbsolute(relative)
        ? 'outside the repository'
        : await skipReason(eslint, root, { ...entry, file });
    if (reason) skipped.set(file, reason);
    else lint.add(file);
  }
  for (const [file, reason] of skipped)
    process.stdout.write(`lint:paths: skipped ${file}: ${reason}\n`);
  return [...lint].sort();
}

const plural = (n: number) => `${n} file${n === 1 ? '' : 's'}`;

// Each leg with files, in its own process, one after the other; the exit
// status is the last failing leg's, as in lint:eslint. A file goes to the leg
// whose target holds it (the app leg ignores tests/ and convex/).
function runLegs(root: string, files: string[]) {
  const inTests = (file: string) => file.startsWith('tests/');
  const inConvex = (file: string) => file.startsWith('convex/');
  const all: Leg[] = [
    {
      name: 'app',
      script: 'lint:eslint:app',
      target: '.',
      files: files.filter((file) => !inTests(file) && !inConvex(file)),
    },
    {
      name: 'tests',
      script: 'lint:eslint:tests',
      target: 'tests',
      files: files.filter(inTests),
    },
    {
      name: 'Convex',
      script: 'lint:eslint:convex',
      target: 'convex',
      files: files.filter(inConvex),
    },
  ];
  const legs = all.filter((leg) => leg.files.length);
  const commands = legs.map((leg) => ({ leg, ...legCommand(root, leg) }));
  const failed: string[] = [];
  let status = 0;
  for (const { leg, argv, shown } of commands) {
    process.stdout.write(
      `lint:paths: the ${leg.name} leg lints ${plural(leg.files.length)}:\n${leg.files.map((file) => `  ${file}\n`).join('')}$ ${shown}\n`,
    );
    const code =
      spawnSync(process.execPath, argv, { cwd: root, stdio: 'inherit' })
        .status ?? 1;
    if (code !== 0) {
      failed.push(`the ${leg.name} leg failed (exit ${code})`);
      status = code;
    }
  }
  process.stdout.write(
    `lint:paths: ${failed.length ? failed.join('; ') : `${plural(files.length)} passed`}\n`,
  );
  return status;
}

async function main(root: string, args: string[]) {
  const files = await choose(root, parseArgs(root, args));
  if (!files.length) {
    process.stdout.write('lint:paths: nothing to lint\n');
    return 0;
  }
  if (files.length > maxFiles)
    throw new Refusal(
      `${files.length} files to lint, more than ${maxFiles}, which the lint:paths memory class covers; run the full lint: pnpm -s lint`,
    );
  return runLegs(root, files);
}

try {
  process.exitCode = await main(process.cwd(), process.argv.slice(2));
} catch (error) {
  if (!(error instanceof Refusal)) throw error;
  process.stderr.write(`lint:paths: ${error.message}\n`);
  process.exitCode = 2;
}
