import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  catalogDataFileNames,
  catalogDataFiles,
  parseCatalogDataText,
} from './catalog/data-files.ts';
import { mergeCatalogData } from './catalog/data-merge.ts';
import {
  appendOnlyTables,
  mergeAppendOnlyTable,
} from './catalog/table-merge.ts';

type MergeInput = {
  path: string;
  target: string;
  base?: string;
  ours: string;
  theirs: string;
};

function git(root: string, args: string[]) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function fileFor(path: string) {
  if (path in appendOnlyTables) return undefined;
  const file = catalogDataFileNames.find(
    (name) => catalogDataFiles[name] === path,
  );
  if (!file)
    throw new Error(
      `${path} is not a shared catalog data file or append-only table: ${mergeablePaths.join(', ')}.`,
    );
  return file;
}

const mergeablePaths = [
  ...Object.values(catalogDataFiles),
  ...Object.keys(appendOnlyTables),
];

/**
 * Reads base (stage 1), ours (2) and theirs (3) of each conflicted data file
 * and append-only table.
 */
function readConflictStages(root: string): MergeInput[] {
  const listing = git(root, [
    'ls-files',
    '--unmerged',
    '-z',
    '--',
    ...mergeablePaths,
  ]);
  const stages = new Map<string, Set<string>>();
  for (const line of listing.split('\0').filter(Boolean)) {
    const [info, path] = line.split('\t');
    const stage = info?.split(' ')[2];
    if (path && stage)
      stages.set(path, new Set([...(stages.get(path) ?? []), stage]));
  }
  return [...stages].map(([path, present]) => {
    if (!present.has('2') || !present.has('3'))
      throw new Error(
        `${path} was deleted on one side; resolve that conflict by hand.`,
      );
    const show = (stage: string) => git(root, ['show', `:${stage}:${path}`]);
    return {
      path,
      target: join(root, path),
      base: present.has('1') ? show('1') : undefined,
      ours: show('2'),
      theirs: show('3'),
    };
  });
}

async function readExplicitInput({
  target,
  base,
  ours,
  theirs,
}: {
  target: string;
  base?: string;
  ours?: string;
  theirs?: string;
}): Promise<MergeInput> {
  if (!ours || !theirs)
    throw new Error('--ours PATH and --theirs PATH are required with a file.');
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const absolute = resolve(target);
  return {
    path: relative(root, absolute),
    target: absolute,
    base: base ? await readFile(resolve(base), 'utf8') : undefined,
    ours: await readFile(resolve(ours), 'utf8'),
    theirs: await readFile(resolve(theirs), 'utf8'),
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      base: { type: 'string' },
      ours: { type: 'string' },
      theirs: { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: true,
  });
  if (values.help) {
    process.stdout.write(
      `Usage: pnpm catalog:merge [FILE --ours PATH --theirs PATH [--base PATH]]\nWithout arguments, three-way merges every shared catalog data file Git reports as conflicted (during a rebase or merge) by entry identity, and writes it in canonical form. With FILE, merges the given versions into that data file. Entries added on either side are kept and one-sided changes or deletions win; an identity both sides changed differently, a Situation alias or Registry identifier claimed twice, or an invalid result is reported and that file is left untouched. The append-only tables (${Object.entries(
        appendOnlyTables,
      )
        .map(([path, { variable }]) => `${variable} in ${path}`)
        .join(
          ', ',
        )}) merge the same way by row (base rows, then ours, then theirs, formatted with Prettier), except that a removed or reordered row or any change outside the table is reported too. Stage the merged files with git add afterwards.\n`,
    );
    return;
  }
  if (positionals.length > 1) throw new Error('Name at most one data file.');
  const inputs = positionals[0]
    ? [await readExplicitInput({ target: positionals[0], ...values })]
    : readConflictStages(
        git(process.cwd(), ['rev-parse', '--show-toplevel']).trim(),
      );
  if (!inputs.length) {
    process.stdout.write(
      'No conflicted catalog data files or append-only tables.\n',
    );
    return;
  }
  const failures: string[] = [];
  for (const input of inputs) {
    const file = fileFor(input.path);
    if (!file) {
      const table = await mergeAppendOnlyTable(input);
      if (table.text === undefined) {
        failures.push(
          `${input.path}:\n${table.conflicts.map((line) => `  ${line}`).join('\n')}`,
        );
        continue;
      }
      await writeFile(input.target, table.text);
      process.stdout.write(`Merged ${input.path}\n`);
      continue;
    }
    const parse = (side: string, text: string) => {
      try {
        return parseCatalogDataText(file, text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          error instanceof SyntaxError
            ? `${input.path} ${side} is not JSON: ${message}`
            : `${input.path} ${side}: ${message}`,
        );
      }
    };
    const result = mergeCatalogData({
      file,
      base: input.base === undefined ? undefined : parse('base', input.base),
      ours: parse('ours', input.ours),
      theirs: parse('theirs', input.theirs),
    });
    if (result.text === undefined) {
      failures.push(
        `${input.path}:\n${result.conflicts.map((line) => `  ${line}`).join('\n')}`,
      );
      continue;
    }
    await writeFile(input.target, result.text);
    process.stdout.write(`Merged ${input.path}\n`);
  }
  if (failures.length) {
    process.stderr.write(
      `Not merged; resolve these by hand, then run pnpm catalog:format:\n${failures.join('\n')}\n`,
    );
    process.exitCode = 1;
  }
}
main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
