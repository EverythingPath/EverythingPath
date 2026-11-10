import { realpath, readdir } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { pins, type Repository } from './inventory.ts';
import { runCapturedProcess } from './process.ts';

async function verifyCheckout({
  repository,
  root,
}: {
  repository: Repository;
  root: string;
}) {
  function runGit(...args: string[]) {
    const result = runCapturedProcess({
      command: 'git',
      args: ['-C', root, ...args],
    });
    if (result.status !== 0)
      throw new Error(
        `Cannot verify ${repository} checkout: ${result.stderr.trim()}`,
      );
    return result.stdout.trim();
  }
  if ((await realpath(runGit('rev-parse', '--show-toplevel'))) !== root) {
    throw new Error(
      `${repository} path must be the root of its upstream Git checkout.`,
    );
  }
  const commit = runGit('rev-parse', 'HEAD');
  if (commit !== pins[repository].commit) {
    throw new Error(
      `${repository} checkout must be at pinned ${pins[repository].tag} (${pins[repository].commit}).`,
    );
  }
  if (
    runGit(
      'status',
      '--porcelain',
      '--untracked-files=all',
      '--',
      pins[repository].manifest,
      pins[repository].directory,
    )
  ) {
    throw new Error(
      `${repository} checkout has modified or untracked catalog input files.`,
    );
  }
  const ignored = runGit(
    'ls-files',
    '--others',
    '--ignored',
    '--exclude-standard',
    '-z',
    '--',
    pins[repository].manifest,
    pins[repository].directory,
  ).split('\0');
  if (
    ignored.some(
      (path) => path === pins[repository].manifest || /\.ya?ml$/.test(path),
    )
  ) {
    throw new Error(`${repository} checkout has ignored catalog input files.`);
  }
  return { repository, commit };
}

function isMissing(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function resolveOutputPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (!isMissing(error)) throw error;
    return join(await resolveOutputPath(dirname(path)), basename(path));
  }
}

function containsPath({ parent, child }: { parent: string; child: string }) {
  const difference = relative(parent, child);
  return (
    difference === '' ||
    (difference !== '..' && !difference.startsWith(`..${sep}`))
  );
}

export async function validateOutput({
  output,
  sources,
  reports = [
    'admission.json',
    'catalog.json',
    'unsupported.json',
    'comparison.json',
    'curation.json',
  ],
}: {
  output: string;
  sources: string[];
  reports?: string[];
}) {
  if (
    sources.some(
      (source) =>
        containsPath({ parent: source, child: output }) ||
        containsPath({ parent: output, child: source }),
    )
  ) {
    throw new Error(
      'Output directory must not overlap either source checkout.',
    );
  }
  try {
    const existing = await readdir(output, { withFileTypes: true });
    const allowed = new Set(reports);
    if (existing.some((file) => !allowed.has(file.name) || !file.isFile())) {
      throw new Error(
        'Output directory must be empty or contain only regular catalog preview report files.',
      );
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

export async function verifyInputs({
  system,
  content,
  allowUnverified,
}: {
  system: string;
  content: string;
  allowUnverified: boolean;
}) {
  return allowUnverified
    ? { status: 'unverified' as const }
    : {
        status: 'verified' as const,
        repositories: [
          await verifyCheckout({ repository: 'pf1', root: system }),
          await verifyCheckout({ repository: 'pf1-content', root: content }),
        ],
      };
}
