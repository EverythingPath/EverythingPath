import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll } from 'vitest';

const moduleReference =
  /\b(?:api|internal)\.([A-Za-z]\w*)\.|['"`]([A-Za-z][\w/]*):[A-Za-z]\w*['"`]/g;

/** The Convex modules a test file's source names through `api.<module>`, `internal.<module>` or a `'<module>:<function>'` reference. */
export function listCalledConvexModules(source: string) {
  const names = new Set<string>();
  for (const [, generated, path] of source.matchAll(moduleReference)) {
    const name = generated ?? path;
    if (name) names.add(name);
  }
  return [...names];
}

/**
 * Load, before a test file's tests, the Convex function modules it calls.
 * convex-test imports a module on its first call, so otherwise the first test
 * pays for loading the sheet calculator and catalog modules, and under
 * full-suite load that alone can take seconds. The list comes from the file's
 * own source, so it follows the calls the file makes; a name that is no module
 * is skipped.
 */
export function preloadCalledConvexModules({
  modules,
  testFile,
}: {
  modules: Record<string, () => Promise<unknown>>;
  testFile: string;
}) {
  beforeAll(async () => {
    const source = readFileSync(fileURLToPath(testFile), 'utf8');
    for (const name of listCalledConvexModules(source))
      await modules[`./${name}.ts`]?.();
  }, 30_000);
}
