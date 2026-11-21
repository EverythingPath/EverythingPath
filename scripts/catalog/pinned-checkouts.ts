import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { pcgenPin, pins, type Repository } from './inventory.ts';

/**
 * An upstream checkout a catalog command reads, with its pin and the paths in
 * it that are catalog inputs: a local change there counts, a change elsewhere
 * in the checkout does not.
 */
export type PinnedCheckout = {
  name: string;
  path: string;
  commit: string;
  /** How the pin is named in a message: a tag and commit, or the commit. */
  pinName: string;
  /** The checkout's catalog inputs, relative to its root. */
  inputs: readonly string[];
  /** An ignored file that would still be read as an input, if any can be. */
  ignoredInput?: (path: string) => boolean;
};

/** A Foundry checkout (`pins`): its manifest and pack folder, YAML included even when ignored. */
export function foundryCheckout(
  repository: Repository,
  path: string,
): PinnedCheckout {
  const { tag, commit, manifest, directory } = pins[repository];
  return {
    name: repository,
    path,
    commit,
    pinName: `${tag} (${commit})`,
    inputs: [manifest, directory],
    ignoredInput: (file) => file === manifest || /\.ya?ml$/.test(file),
  };
}

/** A PCGen checkout (`pcgenPin`): its data folder. */
export function pcgenCheckout(path: string): PinnedCheckout {
  return {
    name: 'PCGen',
    path,
    commit: pcgenPin.commit,
    pinName: pcgenPin.commit,
    inputs: [pcgenPin.directory],
  };
}

/**
 * Why a pinned checkout cannot be read as a catalog input, or undefined: it
 * is missing, not the root of its own Git checkout, at another commit, or
 * has modified, untracked or ignored input files. The one validation the
 * importer's and the #227 matcher's generation (`verifyInputs`,
 * `generateAttribution227Matches`) and the fresh comparison's run
 * (`freshComparisonRun`) share, so they cannot disagree about whether a
 * checkout is usable.
 */
export function pinnedCheckoutProblem({
  name,
  path,
  commit,
  pinName,
  inputs,
  ignoredInput,
}: PinnedCheckout): string | undefined {
  const at = `${name} checkout ${path}`;
  if (!existsSync(path)) return `${at} is missing.`;
  const git = gitAt(path);
  const top = git('rev-parse', '--show-toplevel');
  if (top === undefined || realpathSync(top) !== realpathSync(path))
    return `${at} must be the root of its upstream Git checkout.`;
  const head = git('rev-parse', 'HEAD');
  if (head !== commit)
    return `${at} must be at pinned ${pinName}, not ${head ?? 'no commit'}.`;
  const problem = inputProblem(git, inputs, ignoredInput);
  return problem && `${at} ${problem}.`;
}

/** A Git command's trimmed output in the checkout at `path`, or undefined when it fails. */
function gitAt(path: string) {
  return (...args: string[]) => {
    try {
      return execFileSync('git', ['-C', path, ...args], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      return undefined;
    }
  };
}

/** Whether the inputs have modified, untracked or (where they count) ignored files. */
function inputProblem(
  git: ReturnType<typeof gitAt>,
  inputs: readonly string[],
  ignoredInput: PinnedCheckout['ignoredInput'],
) {
  const changes = git(
    'status',
    '--porcelain',
    '--untracked-files=all',
    '--',
    ...inputs,
  );
  if (changes === undefined) return 'cannot be read';
  if (changes) return 'has modified or untracked catalog input files';
  if (!ignoredInput) return undefined;
  const ignored = git(
    'ls-files',
    '--others',
    '--ignored',
    '--exclude-standard',
    '-z',
    '--',
    ...inputs,
  );
  if (ignored === undefined) return 'cannot be read';
  return ignored.split('\0').some(ignoredInput)
    ? 'has ignored catalog input files'
    : undefined;
}

/** Throws the checkout's problem, if it has one. */
export function verifyPinnedCheckout(checkout: PinnedCheckout) {
  const problem = pinnedCheckoutProblem(checkout);
  if (problem) throw new Error(problem);
}
