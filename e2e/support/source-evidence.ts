import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listSourceFiles } from './source-files';

// The source files the fingerprints cover: runtime, tests, configuration,
// lockfile and normative rules/decisions. Human-readable reports can be
// recorded afterward without changing test inputs.
function fingerprintedFiles(root: string) {
  return listSourceFiles(root)
    .filter(
      (file) =>
        !file.startsWith('.agents/') &&
        !file.startsWith('.claude/') &&
        file !== 'CLAUDE.md' &&
        !file.startsWith('agent/') &&
        (!file.startsWith('docs/') ||
          file.startsWith('docs/ai/ironfang-militia/')) &&
        // The index retains tracked files deleted from the working tree.
        existsSync(join(root, file)),
    )
    .sort();
}

function hashFiles(root: string, files: string[]) {
  const hash = createHash('sha256');
  for (const file of files) {
    const content = readFileSync(join(root, file));
    hash.update(`${file}\0${content.length}\0`);
    hash.update(content);
  }
  return hash.digest('hex');
}

/** The full source fingerprint: run evidence (#754: never a reuse key). */
export function sourceFingerprint(root: string) {
  return hashFiles(root, fingerprintedFiles(root));
}

// Only Playwright loads a top-level spec; nothing built or deployed imports
// one (source-evidence.test.ts checks that), so a spec cannot change a
// prepared environment. A reused one gets the current specs copied in.
export const isTopLevelSpec = (file: string) =>
  /^e2e\/[^/]+\.spec\.ts$/.test(file);

// Variables whose values can change what the deployment or build produces.
// Every other variable counts by name only: secret values never enter the
// fingerprint, and per-run values (TMPDIR, run file, tokens) never reach the
// output.
const isBuildRelevant = (name: string) =>
  name === 'NODE_ENV' ||
  name === 'CI' ||
  name === 'E2E_FORCE_FAILURE' ||
  name.startsWith('NEXT_PUBLIC_');
const perRunNames = new Set([
  'TMPDIR',
  'E2E_RUN_FILE',
  'E2E_RUN_TOKEN',
  'E2E_PROCESS_TOKEN',
]);

const hashText = (text: string) =>
  createHash('sha256').update(text).digest('hex');

/**
 * The installed dependencies, as pnpm records them: its install metadata,
 * its copy of the resolved lockfile and the package directories it created.
 * Hashing every installed file would take too long; a hand-patched file in
 * `node_modules` is not detected.
 */
function dependencyFingerprint(root: string) {
  const read = (file: string) => {
    try {
      return readFileSync(join(root, file), 'utf8');
    } catch {
      return '';
    }
  };
  let packages: string[] = [];
  try {
    packages = readdirSync(join(root, 'node_modules', '.pnpm')).sort();
  } catch {
    packages = [];
  }
  return hashText(
    JSON.stringify([
      read('node_modules/.modules.yaml'),
      read('node_modules/.pnpm/lock.yaml'),
      packages,
    ]),
  );
}

/**
 * What a prepared environment's reuse matches on (#754): the sources less
 * the top-level specs, the effective build environment, the toolchain and
 * the installed dependencies.
 */
export function reuseFingerprint({
  root,
  environment,
  toolchain,
}: {
  root: string;
  environment: Record<string, string | undefined>;
  toolchain: { node: string; pnpm: string };
}) {
  const buildEnvironment = Object.keys(environment)
    .filter((name) => environment[name] !== undefined && !perRunNames.has(name))
    .sort()
    .map((name) =>
      isBuildRelevant(name) ? [name, environment[name]] : [name],
    );
  const parts = {
    sources: hashFiles(
      root,
      fingerprintedFiles(root).filter((file) => !isTopLevelSpec(file)),
    ),
    buildEnvironment: hashText(JSON.stringify(buildEnvironment)),
    node: toolchain.node,
    pnpm: toolchain.pnpm,
    dependencies: dependencyFingerprint(root),
  };
  return { reuseFingerprint: hashText(JSON.stringify(parts)), parts };
}
