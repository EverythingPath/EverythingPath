// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { launchVerificationBinding } from '../../scripts/catalog/launch-verification-build';
import { launchVerificationBuilder } from '../../scripts/catalog/launch-verification-inputs';
import {
  launchVerificationStaleness,
  parseLaunchVerification,
} from '../../scripts/catalog/launch-verification';
import { catalogImplementationInputs } from '../../scripts/catalog/release-inputs';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema';

const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const fileSha256 = (path: string) => {
  try {
    return sha256(readFileSync(path));
  } catch {
    return undefined;
  }
};

/** The tracked files a local specifier in `name` may resolve to, as the gate tries them. */
function gateVariants(name: string, imported: string) {
  const aliased = /^~\/(.*)$/.exec(imported)?.[1];
  const target = imported.startsWith('.')
    ? normalize(join(dirname(name), imported))
    : aliased === undefined
      ? undefined
      : `src/${aliased}`;
  if (target === undefined) return [];
  return [
    target,
    ...['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.json'].map(
      (suffix) => target + suffix,
    ),
    ...['.ts', '.tsx', '.js'].map((suffix) => `${target}/index${suffix}`),
    ...(target.endsWith('.js')
      ? ['.ts', '.tsx', '.d.ts'].map((suffix) => target.slice(0, -3) + suffix)
      : []),
  ];
}

/**
 * An independent trace of the builder's local imports, as the gate's runtime
 * scan reads them (`gate_operator.py` `local_runtime_files`): a regular
 * expression over the source, comments included, resolved against tracked
 * files with the same extension variants.
 */
function gateTrace(start: string) {
  const tracked = new Set(
    execFileSync('git', ['ls-files'], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    })
      .split('\n')
      .filter(Boolean),
  );
  const localImport =
    /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s*)['"]([^'"]+)['"]/g;
  const seen = new Set<string>();
  const pending = [start];
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (!/\.(?:tsx?|jsx?|mjs|cjs)$/.test(name)) continue;
    for (const [, imported = ''] of readFileSync(name, 'utf8').matchAll(
      localImport,
    ))
      pending.push(
        ...gateVariants(name, imported).filter((variant) =>
          tracked.has(variant),
        ),
      );
  }
  return seen;
}

// The live readers the round-1 reviews found unbound, and one module only
// reached transitively (through legal-resources-data.ts).
const reviewedOmissions = [
  'scripts/catalog/reviewed-data-files.ts',
  'src/lib/catalog/attribution-evidence-codec.ts',
  'scripts/catalog/release-inputs.ts',
  'src/lib/catalog/legal-resources-data.ts',
  'src/lib/catalog/data/resources.json',
  'src/lib/catalog/data/attribution-evidence.json',
];
const transitive = 'src/lib/catalog/legal-types.ts';

let binding: Awaited<ReturnType<typeof launchVerificationBinding>>;
beforeAll(async () => {
  binding = await launchVerificationBinding('.');
}, 120_000);

describe('launchVerificationBinding', () => {
  it("binds every local module the builder imports, by the gate's own trace", () => {
    const traced = gateTrace(launchVerificationBuilder);
    expect(traced.size).toBeGreaterThan(100);
    expect([...traced].filter((path) => !binding.paths.includes(path))).toEqual(
      [],
    );
    for (const path of [...reviewedOmissions, transitive])
      expect(binding.paths, path).toContain(path);
    expect(binding.paths).not.toContain(
      'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
    );
  });

  it('binds the parser dependency metadata releases bind, and every package the closure imports', async () => {
    const { parsers } = await catalogImplementationInputs();
    expect(binding.packages.parsers).toEqual({
      dependencyVersions: parsers.dependencyVersions,
      resolutionSha256: sha256(
        canonicalReleaseJson(parsers.dependencyResolution),
      ),
    });
    expect(Object.keys(binding.packages.imports)).toEqual(
      expect.arrayContaining(['convex', 'parse5', 'yaml', 'zod']),
    );
  });

  it('makes the header stale when any reviewed omission or a transitive module changes', async () => {
    const document = parseLaunchVerification({
      version: 1,
      scopeVersion: 'campaign-mvp-v1',
      binding: {
        launchScopeIdentity: 'sha256:' + '1'.repeat(64),
        calculationIdentity: 'sha256:' + '2'.repeat(64),
        proofsSha256: '3'.repeat(64),
        gate: {
          extractionFingerprint: '4'.repeat(64),
          reviewedInputsFingerprint: '5'.repeat(64),
          legalResourcesFingerprint: '6'.repeat(64),
          upstream: [],
        },
        inputs: Object.fromEntries(
          binding.paths.map((path) => [path, fileSha256(path)]),
        ),
        packages: binding.packages,
      },
      rows: [],
    });
    const current = {
      scopeVersion: 'campaign-mvp-v1',
      launchScopeIdentity: document.binding.launchScopeIdentity,
      calculationIdentity: document.binding.calculationIdentity,
      proofsSha256: document.binding.proofsSha256,
      proofs: { registry: [], sha256Of: () => undefined },
      proseCases: [],
      sha256Of: (path: string) => Promise.resolve(fileSha256(path)),
      packages: () => Promise.resolve(binding.packages),
    };
    await expect(
      launchVerificationStaleness(document, current),
    ).resolves.toEqual([]);
    for (const path of [...reviewedOmissions, transitive])
      await expect(
        launchVerificationStaleness(document, {
          ...current,
          sha256Of: (read: string) =>
            Promise.resolve(read === path ? '0'.repeat(64) : fileSha256(read)),
        }),
        path,
      ).resolves.toEqual([`1 bound input changed (${path})`]);
  });
});
