import { realpath, readdir } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { pcgenPin, pins, type Repository } from './inventory.ts';
import {
  foundryCheckout,
  pcgenCheckout,
  verifyPinnedCheckout,
} from './pinned-checkouts.ts';

/** A Foundry checkout's pinned commit, once `verifyPinnedCheckout` accepts it. */
function verifyCheckout({
  repository,
  root,
}: {
  repository: Repository;
  root: string;
}) {
  verifyPinnedCheckout(foundryCheckout(repository, root));
  return { repository, commit: pins[repository].commit };
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
  pcgen,
  allowUnverified,
}: {
  system: string;
  content: string;
  /** #716 E1: a PCGen checkout, verified clean at `pcgenPin` as the #227 matcher's is. */
  pcgen?: string;
  allowUnverified: boolean;
}) {
  if (allowUnverified) return { status: 'unverified' as const };
  if (pcgen !== undefined) verifyPinnedCheckout(pcgenCheckout(pcgen));
  return {
    status: 'verified' as const,
    repositories: [
      verifyCheckout({ repository: 'pf1', root: system }),
      verifyCheckout({ repository: 'pf1-content', root: content }),
      ...(pcgen === undefined
        ? []
        : [{ repository: 'pcgen' as const, commit: pcgenPin.commit }]),
    ],
  };
}

/** The data folder of a PCGen checkout (`pcgenPin.directory`), which the importer reads. */
export const pcgenDataPath = (checkout: string) =>
  join(checkout, pcgenPin.directory);
