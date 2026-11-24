import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  canonicalReleaseJson,
  isObject,
  parseReleaseJson,
} from '../../src/lib/catalog/release-schema.ts';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

/**
 * The importer's parser dependencies, as releases bind them
 * (`catalogImplementationInputs().parsers`): each installed version and its
 * `pnpm-lock.yaml` package and snapshot entries.
 */
export async function parserDependencies() {
  const dependencyVersions = await readInstalledParserVersions();
  const dependencyResolution =
    await readParserDependencyResolution(dependencyVersions);
  return { dependencyVersions, dependencyResolution };
}

async function readInstalledParserVersions() {
  const [yaml, parse5, zod, entities] = await Promise.all([
    readInstalledPackageVersion('yaml'),
    readInstalledPackageVersion('parse5'),
    readInstalledPackageVersion('zod'),
    readEntitiesVersion(),
  ]);
  return { yaml, parse5, zod, entities };
}

async function readInstalledPackageVersion(name: string) {
  const data: unknown = JSON.parse(
    await readFile(
      resolve(projectRoot, 'node_modules', name, 'package.json'),
      'utf8',
    ),
  );
  if (!isObject(data) || typeof data.version !== 'string')
    throw new Error(`Missing parser version: ${name}.`);
  return data.version;
}

/** A directory's `package.json`, or undefined when it has none. */
async function readPackageManifest(directory: string): Promise<unknown> {
  try {
    return JSON.parse(
      await readFile(resolve(directory, 'package.json'), 'utf8'),
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error;
  }
}

async function readEntitiesVersion() {
  const entitiesEntry = createRequire(
    await realpath(resolve(projectRoot, 'node_modules/parse5/package.json')),
  ).resolve('entities');
  for (
    let directory = dirname(entitiesEntry);
    directory !== dirname(directory);
    directory = dirname(directory)
  ) {
    const data = await readPackageManifest(directory);
    if (
      isObject(data) &&
      data.name === 'entities' &&
      typeof data.version === 'string'
    )
      return data.version;
  }
  throw new Error('Missing parse5 entities dependency version.');
}

async function readLock() {
  const lock: unknown = parse(
    await readFile(resolve(projectRoot, 'pnpm-lock.yaml'), 'utf8'),
  );
  if (!isObject(lock) || !isObject(lock.packages) || !isObject(lock.snapshots))
    throw new Error('Invalid parser dependency lock.');
  return {
    importers: lock.importers,
    packages: lock.packages,
    snapshots: lock.snapshots,
  };
}

async function readParserDependencyResolution(
  dependencyVersions: Record<string, string>,
) {
  const { packages, snapshots } = await readLock();
  const dependencyResolution = Object.fromEntries(
    Object.entries(dependencyVersions).map(([name, version]) => {
      const key = `${name}@${version}`;
      if (!(key in packages) || !(key in snapshots))
        throw new Error(`Missing parser lock entry: ${key}.`);
      return [
        key,
        {
          package: parseReleaseJson(packages[key]),
          snapshot: parseReleaseJson(snapshots[key]),
        },
      ];
    }),
  );
  return dependencyResolution;
}

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

type Lock = Awaited<ReturnType<typeof readLock>>;

/** The root importer's entry for a package, from any dependency group. */
function lockImporterEntry(lock: Lock, name: string) {
  const importer = isObject(lock.importers) ? lock.importers['.'] : undefined;
  for (const group of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ]) {
    const entries = isObject(importer) ? importer[group] : undefined;
    const entry = isObject(entries) ? entries[name] : undefined;
    if (isObject(entry) && typeof entry.version === 'string')
      return { specifier: entry.specifier, version: entry.version };
  }
  throw new Error(`The lock does not name package ${name}.`);
}

/** A directly imported package's installed version and its lock entries' SHA-256. */
async function importedPackageResolution(lock: Lock, name: string) {
  const locked = lockImporterEntry(lock, name);
  // An `npm:` alias locks as `<package>@<version>`.
  const alias = /^(@?[^@(]+)@(\d.*)$/.exec(locked.version);
  const lockName = alias?.[1] ?? name;
  const lockVersion = alias?.[2] ?? locked.version;
  const version = await readInstalledPackageVersion(name);
  const base = lockVersion.replace(/\(.*$/, '');
  if (base !== version)
    throw new Error(
      `Package ${name} is installed at ${version}, not the lock's ${base}.`,
    );
  const packageEntry = lock.packages[`${lockName}@${base}`];
  const snapshot = lock.snapshots[`${lockName}@${lockVersion}`];
  if (packageEntry === undefined || snapshot === undefined)
    throw new Error(`Missing lock entry: ${lockName}@${lockVersion}.`);
  return {
    version,
    lockSha256: sha256(
      canonicalReleaseJson({
        importer: parseReleaseJson(locked),
        package: parseReleaseJson(packageEntry),
        snapshot: parseReleaseJson(snapshot),
      }),
    ),
  };
}

/**
 * The package resolution a verification build ran on: the parser
 * dependencies (`parserDependencies`), and for every bare package the
 * builder's closure imports (`imports`, package names), its installed version
 * and the SHA-256 of its lock importer, package and snapshot entries. A
 * package the lock doesn't name, or installed at another version than the
 * lock's, is refused.
 */
export async function launchVerificationPackages(imports: readonly string[]) {
  const parsers = await parserDependencies();
  const lock = await readLock();
  const resolved: Record<string, { version: string; lockSha256: string }> = {};
  for (const name of [...new Set(imports)].sort())
    resolved[name] = await importedPackageResolution(lock, name);
  return {
    parsers: {
      dependencyVersions: parsers.dependencyVersions,
      resolutionSha256: sha256(
        canonicalReleaseJson(parsers.dependencyResolution),
      ),
    },
    imports: resolved,
  };
}
