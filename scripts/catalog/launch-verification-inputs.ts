import { isBuiltin } from 'node:module';
import ts from 'typescript';
import { readGraphInput } from '../affected-tests.ts';
import {
  moduleResolver,
  namedFiles,
  scanModule,
} from '../affected-tests/scan.ts';

/** The module `catalog:launch-inventory --verify` runs. */
export const launchVerificationBuilder =
  'scripts/catalog/launch-verification-build.ts';
const projectionPath =
  'scripts/catalog/scopes/campaign-mvp-v1.verification.json';

/** A bare specifier's package: `@scope/name` or `name`, without a subpath. */
function packageName(specifier: string) {
  const [first = '', second = ''] = specifier.split('/');
  return first.startsWith('@') ? `${first}/${second}` : first;
}

/**
 * The verification builder's own runtime closure, traced as `test:affected`
 * traces a module (`scripts/affected-tests/scan.ts`): every module it loads
 * (static and re-exported imports, literal `import()` and `require()`),
 * transitively, with the bare packages they load, and every file a loaded
 * module names by a literal path string (a file it reads, such as
 * `new URL('./scopes/campaign-mvp-v1.json', import.meta.url)`). A named file
 * is bound by its bytes; it is read, not run, so what a named module would
 * load is not followed (no module in the closure spawns a repository script).
 * A type-only import loads nothing, so it too is bound by its bytes only, as
 * the gate's runtime scan binds declarations.
 * A loaded module that loads one it cannot name, an `import.meta.glob`, or a
 * local import that resolves to no file refuses the closure, since then it
 * would not be complete. The projection itself is never its own input.
 */
export function launchVerificationClosure(repoRoot: string) {
  const { files, compilerOptions } = readGraphInput(repoRoot);
  if (!files.has(launchVerificationBuilder))
    throw new Error(`Missing ${launchVerificationBuilder}.`);
  const resolveModule = moduleResolver(files, compilerOptions);
  const closure = new Set<string>();
  const loaded = new Set<string>();
  const packages = new Set<string>();
  const queue = [launchVerificationBuilder];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (loaded.has(path)) continue;
    loaded.add(path);
    closure.add(path);
    const source = files.get(path);
    if (typeof source !== 'string') continue;
    const traced = traceModule(path, source, (specifier) =>
      resolveModule(specifier, path),
    );
    queue.push(...traced.loads);
    for (const name of traced.packages) packages.add(name);
    for (const bound of [
      ...traced.declared,
      ...traced.named.flatMap((text) =>
        namedFiles(path, text, files, resolveModule),
      ),
    ])
      closure.add(bound);
  }
  closure.delete(projectionPath);
  return { files: [...closure].sort(), packages: [...packages].sort() };
}

/** What one loaded module loads, names, declares and imports from packages. */
function traceModule(
  path: string,
  source: string,
  resolveFrom: (specifier: string) => string[],
) {
  const scan = scanModule(path, source);
  if (scan.importsUnnamed || scan.globs.length)
    throw new Error(
      `${path} loads a module the verification closure cannot name.`,
    );
  const loads: string[] = [];
  const packages: string[] = [];
  for (const specifier of scan.modules) {
    const targets = resolveFrom(specifier);
    if (targets.length) loads.push(...targets);
    else if (/^(?:\.|\/|~\/)/.test(specifier))
      throw new Error(`Unresolved local import ${specifier} in ${path}.`);
    else if (!isBuiltin(specifier)) packages.push(packageName(specifier));
  }
  return {
    loads,
    packages,
    named: scan.paths,
    // Type-only imports too: `scanModule` drops them, since they load nothing.
    declared: ts
      .preProcessFile(source, true, true)
      .importedFiles.flatMap(({ fileName }) => resolveFrom(fileName)),
  };
}
