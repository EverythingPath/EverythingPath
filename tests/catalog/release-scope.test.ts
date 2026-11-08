// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import { launchScopeIdentity } from '../../scripts/catalog/launch-inventory';
import type {
  LaunchManifest,
  LaunchRow,
} from '../../scripts/catalog/launch-inventory-schema';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import {
  accountRefusedScopeInputs,
  accountReleaseScope,
  readReleaseScope,
  releaseScopeContent,
  resolveReleaseScope,
  type ReleaseScope,
} from '../../scripts/catalog/release-scope';
import {
  convexValueBoundViolations,
  releaseRowBoundViolations,
} from './convex-value-bounds';
import { importPinnedFighter } from './pinned-fighter';
import { materializePinnedTree } from './pinned-sources';
import {
  exploiter,
  findOutcome,
  magicalLineage,
  pinnedFile,
  race,
  reducedManifest as reduce,
} from './release-scope-fixtures';

// Operator builds are in release-scope-build.test.ts, so this file never
// loads the reviewed attribution data.
// The whole committed manifest parses, inspects and resolves in about 7 s.
// One resolved copy serves every test: each full copy costs about 1 GB.
const slow = 120_000;
const committedPath = new URL(
  '../../scripts/catalog/scopes/campaign-mvp-v1.json',
  import.meta.url,
);
const committedText = await readFile(committedPath, 'utf8');
const committedScope = await readReleaseScope({ version: 'campaign-mvp-v1' });
const committed = committedScope.manifest;
const committedIdentity = committedScope.binding.launchScopeIdentity;

const classRoots = committed.roots
  .filter(({ kind }) => kind === 'class')
  .map(({ key }) => key);
/** The committed manifest with one row replaced; every other row is shared, never mutated. */
function withRow(key: string, change: Partial<LaunchRow>): LaunchManifest {
  return {
    ...committed,
    rows: committed.rows.map((row) =>
      row.key === key ? { ...row, ...change } : row,
    ),
  };
}

const nonRootUpstream = committed.rows.find(
  ({ key, requirement }) =>
    requirement === 'required' &&
    key.startsWith('pf1/') &&
    !committed.roots.some((root) => root.key === key),
)!;

function reducedManifest(
  roots: string[],
  extra?: Parameters<typeof reduce>[2],
) {
  return reduce(committed, roots, extra);
}

function scopeOf(manifest: LaunchManifest) {
  return resolveReleaseScope({
    version: 'campaign-mvp-v1',
    document: {
      manifest,
      documentSha256: 'f'.repeat(64),
      recordsSha256: null,
    },
    committedIdentity,
  });
}

/**
 * Back-edges of a depth-first walk over non-citation edges, from the roots in
 * key order and each row's edges in manifest order.
 */
function countBackEdges(manifest: LaunchManifest) {
  const outgoing = new Map<string, string[]>();
  for (const edge of manifest.edges) {
    if (edge.kind === 'citation') continue;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const state = new Map<string, 'open' | 'done'>();
  let backEdges = 0;
  for (const root of manifest.roots.map(({ key }) => key).sort()) {
    if (state.has(root)) continue;
    state.set(root, 'open');
    const stack: [string, number][] = [[root, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const targets = outgoing.get(top[0]) ?? [];
      if (top[1] === targets.length) {
        state.set(top[0], 'done');
        stack.pop();
        continue;
      }
      const next = targets[top[1]++]!;
      const seen = state.get(next);
      if (seen === 'open') backEdges++;
      else if (!seen) {
        state.set(next, 'open');
        stack.push([next, 0]);
      }
    }
  }
  return backEdges;
}

function remapOf(from: string, to: string) {
  return {
    from,
    to,
    kind: 'identity',
    reason: 'Test-only identity collision.',
    evidence: 'Test',
    reviewedBy: 'Test',
    reviewedOn: '2026-10-29',
  };
}

describe('the committed campaign-mvp-v1 scope', () => {
  const scope: ReleaseScope = committedScope;

  it('binds the committed documents and resolves exactly the required rows despite cycles', () => {
    const required = committed.rows
      .filter(({ requirement }) => requirement === 'required')
      .map(({ key }) => key)
      .sort();
    // #596 run A's six inventories add PZO9455/PZO9481 and require PZO9491 (+2 rows, +3 required, -1 optional).
    // #615 wave D's held Mercy requires PZO9475 (+1 row, +1 required).
    // The waves 1-2 correction's mapping books add PZO9283, PZO9424, PZO9431
    // and PZO9441 and require PZO9443, PZO9448 and PZO9460 (+4 rows, +7
    // required, -3 optional).
    expect(required).toHaveLength(16_744);
    expect(scope.closure).toEqual(required);
    expect(countBackEdges(committed)).toBe(51);
    const optional = new Set(
      committed.rows
        .filter(({ requirement }) => requirement === 'optional')
        .map(({ key }) => key),
    );
    expect(
      committed.edges.filter(
        ({ from, to, kind }) =>
          kind !== 'citation' && required.includes(from) && optional.has(to),
      ),
    ).toEqual([]);
    expect(scope.findings).toEqual([]);
    expect(scope.binding).toEqual({
      version: 'campaign-mvp-v1',
      // Computed independently of the scope module.
      launchScopeIdentity: launchScopeIdentity(JSON.parse(committedText)),
      documentSha256: createHash('sha256').update(committedText).digest('hex'),
      recordsSha256: JSON.parse(committedText).recordsSha256,
      roots: committed.roots.map(({ key }) => key).sort(),
      closureFingerprint: createHash('sha256')
        .update(
          JSON.stringify(
            required.map((key) => [
              key,
              committed.rows.find((row) => row.key === key)?.requirement,
            ]),
          ),
        )
        .digest('hex'),
    });
  });

  it('imports every upstream closure row and cited target, but no requirement, notice, resource, local or EverythingPath row', () => {
    const keys = new Set(scope.importKeys);
    for (const root of classRoots) expect(keys).toContain(root);
    expect(classRoots).toHaveLength(21);
    expect(keys).toContain(magicalLineage);
    expect(keys).not.toContain(exploiter);
    expect(
      scope.importKeys.every((key) => /^(?:pf1|pf1-content)\//.test(key)),
    ).toBe(true);
    const upstreamRequired = committed.rows.filter(
      ({ key, requirement }) =>
        requirement === 'required' && /^(?:pf1|pf1-content)\//.test(key),
    );
    expect(upstreamRequired).toHaveLength(4_261);
    for (const { key } of upstreamRequired) expect(keys).toContain(key);
    // Description citations are gate dependencies, so cited optional rows come too.
    const cited = committed.edges.find(
      ({ kind, from, to }) =>
        kind === 'citation' &&
        keys.has(from) &&
        /^(?:pf1|pf1-content)\//.test(to) &&
        committed.rows.find((row) => row.key === to)?.requirement ===
          'optional',
    );
    expect(cited && keys.has(cited.to)).toBe(true);
    expect([...keys].sort()).toEqual(scope.importKeys);
  });

  it('reports FAILED at HEAD and accounts every row exactly once', async () => {
    const tree = await materializePinnedTree([]);
    try {
      const artifact = await importCatalog({
        systemPath: tree.systemPath,
        contentPath: tree.contentPath,
        remaps: [],
        scopeKeys: [],
      });
      const gate = assessCatalogAdmission({
        artifact,
        assessments: [],
        evidence: {},
        registry: {},
      });
      const report = accountReleaseScope({
        scope,
        artifact,
        gate,
        authoredResources: ['builtin:casting-tables'],
      });
      expect(report.qualification.status).toBe('FAILED');
      expect(report.rows).toHaveLength(19_272);
      expect(new Set(report.rows.map(({ key }) => key)).size).toBe(19_272);
      const { counts } = report.qualification;
      expect(counts).toMatchObject({
        rows: 19_272,
        required: 16_744,
        optional: 2_528,
        outsideMvp: 2_528,
        included: 0,
      });
      expect(counts.included + counts.held + counts.dependentOmitted).toBe(
        counts.required,
      );
      expect(
        Object.values(counts.heldByCause).reduce((sum, n) => sum + n, 0),
      ).toBe(counts.held);
      const everythingpath = report.rows.filter(({ key }) =>
        key.startsWith('everythingpath/'),
      );
      expect(everythingpath).toHaveLength(318);
      expect(
        everythingpath.every(
          (row) => row.outcome === 'held' && row.cause === 'no-candidate',
        ),
      ).toBe(true);
      expect(findOutcome(report, exploiter)).toMatchObject({
        outcome: 'held',
        cause: 'no-candidate',
        owner: 771,
        path: [exploiter],
      });
      expect(
        findOutcome(report, 'resource/companion-progression-rules'),
      ).toMatchObject({ outcome: 'held', cause: 'no-candidate', owner: 770 });
      // A held requirement keeps each hold and outstanding mechanism with its owner.
      const bloodrager = committed.rows.find(
        ({ key }) => key === 'rule/advanced/bloodrager-feat/0',
      )!;
      const hold = bloodrager.holds[0]!;
      const mechanism = bloodrager.mechanisms.find(
        ({ status }) => status === 'outstanding',
      )!;
      expect(findOutcome(report, bloodrager.key)).toMatchObject({
        outcome: 'held',
        cause: 'requirement',
        reason: hold.reason,
        owner: 739,
        blockers: expect.arrayContaining([
          { code: 'hold', reason: hold.reason, owner: 739 },
          {
            code: 'implementation',
            reason: `${mechanism.name}: ${mechanism.contract}`,
            owner: 739,
          },
          { code: 'admission', reason: 'admission is unreviewed.', owner: 768 },
        ]),
      });
      // A present resource still waits for its own manifest observations.
      expect(
        findOutcome(report, 'resource/builtin:casting-tables'),
      ).toMatchObject({ outcome: 'held', cause: 'requirement' });
      for (const prefix of ['rule/', 'notice/', 'local/'])
        expect(
          report.rows
            .filter(
              ({ key, requirement }) =>
                key.startsWith(prefix) && requirement === 'required',
            )
            .every(({ outcome }) => outcome === 'held'),
        ).toBe(true);
      const held = findOutcome(report, 'pf1/0c4lYDywj6bQ0i8r');
      expect(held).toMatchObject({ outcome: 'held', cause: 'no-candidate' });
      const nested = report.rows.flatMap((row) =>
        row.outcome === 'held' && row.path.length > 2 ? [row.path] : [],
      )[0];
      expect(committed.roots.some(({ key }) => key === nested?.[0])).toBe(true);
    } finally {
      await tree.dispose();
    }
  });

  // S3: an imported class brings its schedule's increments, which the gate
  // assesses with their parents instead of reporting no candidate.
  it("gate-assesses the Fighter's 20 schedule increments; the other increment and Exploiter rows still have no candidate", async () => {
    const artifact = await importPinnedFighter();
    const gate = assessCatalogAdmission({
      artifact,
      assessments: [],
      evidence: {},
      registry: {},
    });
    const report = accountReleaseScope({
      scope,
      artifact,
      gate,
      authoredResources: ['builtin:casting-tables'],
    });
    const everythingpath = report.rows.filter(({ key }) =>
      key.startsWith('everythingpath/'),
    );
    expect(everythingpath).toHaveLength(318);
    const fighterRows = everythingpath.filter(({ key }) =>
      key.startsWith('everythingpath/fighter-'),
    );
    expect(fighterRows).toHaveLength(20);
    for (const row of fighterRows)
      expect(row, row.key).toMatchObject({
        outcome: 'held',
        cause: 'held',
        gate: 'held',
        reason: 'missing Attribution Assessment',
      });
    expect(
      everythingpath
        .filter((row) => !fighterRows.includes(row))
        .every((row) => row.outcome === 'held' && row.cause === 'no-candidate'),
    ).toBe(true);
    expect(findOutcome(report, exploiter)).toMatchObject({
      outcome: 'held',
      cause: 'no-candidate',
    });
  });

  // Content verification: the scope projects its own build through
  // `verifyLaunchRows`, so an admitted, proof-complete row is included and a
  // resource the build emits from its bound bytes is satisfied.
  it(
    "includes the Fighter's admitted increments and a resource emitted from its bound bytes, and nothing the gate did not admit",
    async () => {
      const artifact = await importPinnedFighter();
      const fighterKeys = artifact.catalog.entries
        .map(({ externalKey }) => externalKey)
        .filter((key) => key.startsWith('everythingpath/fighter-'))
        .sort();
      const parents = [
        ...new Set(
          artifact.catalog.entries.flatMap(({ externalKey, detail }) =>
            fighterKeys.includes(externalKey) &&
            detail.kind === 'classFeature' &&
            detail.parentFeature
              ? [detail.parentFeature]
              : [],
          ),
        ),
      ];
      const admit = (keys: string[]) =>
        keys.map((externalKey) => ({
          externalKey,
          name: externalKey,
          reason: 'Admitted.',
          requiredNotices: ['PZO1110'],
          missingNotices: [],
          evidence: [],
        }));
      const gate = {
        passed: false,
        admitted: admit([...fighterKeys, ...parents]),
        held: [],
        dependentOmissions: [],
        retainedExceptions: [],
        requiredNotices: ['PZO1110'],
        failures: [],
      };
      const source = await readFile(
        new URL(
          '../../scripts/catalog/reviewed-casting-tables.json',
          import.meta.url,
        ),
        'utf8',
      );
      const report = accountReleaseScope({
        scope,
        artifact,
        gate,
        authoredResources: ['builtin:casting-tables'],
        resourceSources: {
          authored: [{ key: 'builtin:casting-tables', source }],
        },
      });
      expect(fighterKeys).toHaveLength(20);
      for (const key of fighterKeys)
        expect(findOutcome(report, key), key).toMatchObject({
          outcome: 'included',
          satisfiedBy: 'definition',
          gate: 'admitted',
        });
      // A parent feature keeps its outstanding mechanisms: admitted, not included.
      for (const key of parents)
        expect(findOutcome(report, key), key).toMatchObject({
          outcome: 'held',
          cause: 'requirement',
          gate: 'admitted',
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: 'implementation' }),
          ]),
        });
      expect(
        findOutcome(report, 'resource/builtin:casting-tables'),
      ).toMatchObject({ outcome: 'included', satisfiedBy: 'requirement' });
      // The bytes must be the ones the row binds.
      const changed = accountReleaseScope({
        scope,
        artifact,
        gate,
        authoredResources: ['builtin:casting-tables'],
        resourceSources: {
          authored: [{ key: 'builtin:casting-tables', source: `${source} ` }],
        },
      });
      expect(
        findOutcome(changed, 'resource/builtin:casting-tables'),
      ).toMatchObject({ outcome: 'held', cause: 'requirement' });
      // An increment follows its parent: without the parent's admission none is included.
      const orphaned = accountReleaseScope({
        scope,
        artifact,
        gate: { ...gate, admitted: admit(fighterKeys) },
        authoredResources: ['builtin:casting-tables'],
      });
      for (const key of fighterKeys)
        expect(findOutcome(orphaned, key), key).toMatchObject({
          outcome: 'held',
          cause: 'requirement',
        });
      // The 20 increments, the resource and the verified notice the gate requires.
      expect(
        report.rows
          .filter(({ outcome }) => outcome === 'included')
          .map(({ key }) => key)
          .sort(),
      ).toEqual(
        [
          ...fighterKeys,
          'notice/PZO1110',
          'resource/builtin:casting-tables',
        ].sort(),
      );
    },
    slow,
  );

  // #770 slice B: convex-test enforces neither the 8,192-value array limit
  // nor the 1 MiB document limit, so the committed report is checked here.
  it('keeps every content:scope row of the committed scope inside the Convex value limits', () => {
    expect(
      convexValueBoundViolations({ findings: Array<number>(8_193).fill(0) }),
    ).toHaveLength(1);
    const content = releaseScopeContent(
      accountRefusedScopeInputs({ scope, reason: 'Release inputs refused.' }),
    );
    const rows = [
      { kind: 'report', key: 'content:scope', payload: content.summary },
      ...content.chunks.map((payload, index) => ({
        kind: 'report',
        key: `content:scope:${index}`,
        payload,
      })),
    ];
    expect(content.chunks.reduce((sum, chunk) => sum + chunk.length, 0)).toBe(
      19_272,
    );
    expect(rows.flatMap(releaseRowBoundViolations)).toEqual([]);
  });
});

describe('a copied manifest', () => {
  it(
    'refuses a demoted required dependency',
    () => {
      const { findings } = scopeOf(
        withRow(nonRootUpstream.key, { requirement: 'optional' }),
      );
      expect(findings.map(({ code }) => code)).toEqual(
        expect.arrayContaining(['drift', 'inventory-incomplete', 'demotion']),
      );
      expect(findings.find(({ code }) => code === 'demotion')).toMatchObject({
        key: nonRootUpstream.key,
        path: expect.arrayContaining([nonRootUpstream.key]),
      });
    },
    slow,
  );

  it(
    'refuses a removed required dependency',
    () => {
      const removed = committed.edges.find(
        ({ kind, to }) => kind !== 'citation' && to.startsWith('pf1/'),
      )!;
      const scope = scopeOf({
        ...committed,
        rows: committed.rows.filter(({ key }) => key !== removed.to),
      });
      expect(scope.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'drift' }),
          expect.objectContaining({
            code: 'dependency-missing',
            key: removed.to,
          }),
        ]),
      );
      const missing = scope.findings.find(
        ({ code, key }) => code === 'dependency-missing' && key === removed.to,
      );
      expect(missing?.path.at(-1)).toBe(removed.to);
      expect(committed.roots.some(({ key }) => key === missing?.path[0])).toBe(
        true,
      );
    },
    slow,
  );

  it(
    'refuses a required row no root reaches',
    () => {
      const orphan = nonRootUpstream.key;
      expect(
        scopeOf({
          ...committed,
          edges: committed.edges.filter(
            ({ to, kind }) => kind === 'citation' || to !== orphan,
          ),
        }).findings,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'orphan', key: orphan }),
        ]),
      );
    },
    slow,
  );

  it('refuses an unknown version and a malformed manifest, and never infers one', async () => {
    await expect(
      readReleaseScope({ version: 'campaign-mvp-v2' }),
    ).rejects.toThrow('Unknown release scope');
    expect(() =>
      resolveReleaseScope({
        version: 'campaign-mvp-v1',
        document: {
          manifest: { ...committed, rows: 'not rows' },
          documentSha256: '0'.repeat(64),
          recordsSha256: null,
        },
        committedIdentity,
      }),
    ).toThrow();
  });
});

describe('the scoped selector', () => {
  it(
    'lifts only the curation class cap and counts coverage over every record',
    async () => {
      const tree = await materializePinnedTree([
        ...classRoots.map((key) => {
          const file = committed.rows
            .find((row) => row.key === key)
            ?.sources.find(({ repository }) => repository === 'pf1')?.locator;
          if (!file) throw new Error(`No pinned class file for ${key}.`);
          return `pf1/${file}`;
        }),
        'pf1/packs/monster-templates/celestial.8kHcvgFNoGObDhQ8.yaml',
      ]);
      try {
        const base = {
          systemPath: tree.systemPath,
          contentPath: tree.contentPath,
          remaps: [],
        };
        await expect(
          importCatalog({ ...base, candidateKeys: classRoots.slice(0, 4) }),
        ).rejects.toThrow('at most three class definitions');
        // Unchanged curation path: an unselected unassigned record is out of view.
        const batch = await importCatalog({
          ...base,
          candidateKeys: classRoots.slice(0, 3),
        });
        expect(batch.comparison.coverageComplete).toBe(true);
        const scoped = await importCatalog({ ...base, scopeKeys: classRoots });
        expect(
          scoped.comparison.records
            .map(({ externalKey }) => externalKey)
            .sort(),
        ).toEqual([...classRoots].sort());
        expect(scoped.comparison.coverageComplete).toBe(false);
        await expect(
          importCatalog({
            ...base,
            candidateKeys: classRoots.slice(0, 1),
            scopeKeys: classRoots,
          }),
        ).rejects.toThrow('exclusive');
      } finally {
        await tree.dispose();
      }
    },
    slow,
  );
});

describe('qualification', () => {
  it(
    'qualifies only when every required row is included and the scope has no finding',
    async () => {
      const tree = await materializePinnedTree([pinnedFile[race.human]!]);
      try {
        const manifest = reducedManifest([race.human]);
        const human = manifest.rows.find(({ key }) => key === race.human)!;
        const verified = { state: 'verified' as const, evidence: ['test'] };
        // Only the test's in-memory copy claims verified observations.
        Object.assign(human, {
          holds: [],
          admission: verified,
          structure: verified,
          contentEvidence: verified,
          noticeEvidence: verified,
          mechanisms: human.mechanisms.map((mechanism) => ({
            ...mechanism,
            status: 'reused' as const,
          })),
        });
        const scope = scopeOf(manifest);
        const artifact = await importCatalog({
          systemPath: tree.systemPath,
          contentPath: tree.contentPath,
          remaps: [],
          scopeKeys: scope.importKeys,
        });
        const entry = artifact.catalog.entries.find(
          ({ externalKey }) => externalKey === race.human,
        )!;
        const admitted = {
          passed: true,
          admitted: [
            {
              externalKey: entry.externalKey,
              name: entry.name,
              reason: 'Admitted.',
              requiredNotices: [],
              missingNotices: [],
              evidence: [],
            },
          ],
          held: [],
          dependentOmissions: [],
          retainedExceptions: [],
          requiredNotices: [],
          failures: [],
        };
        const input = {
          scope,
          artifact,
          gate: admitted,
          authoredResources: [],
        };
        expect(
          findOutcome(accountReleaseScope(input), race.human),
        ).toMatchObject({ outcome: 'included', gate: 'admitted' });
        expect(accountReleaseScope(input).qualification.status).toBe('FAILED');
        const clean = accountReleaseScope({
          ...input,
          scope: { ...scope, findings: [] },
        });
        expect(clean.qualification).toMatchObject({
          status: 'QUALIFIED',
          findings: [],
          counts: { required: 1, included: 1 },
        });
        // A refused build includes nothing, even when the gate admitted it or a
        // requirement is satisfied.
        const notice = committed.rows.find(
          ({ key }) => key === 'notice/PZO1110',
        )!;
        const rule = committed.rows.find(
          ({ key }) => key === 'rule/advanced/bloodrager-feat/0',
        )!;
        const satisfiedRule = {
          ...rule,
          holds: [],
          admission: verified,
          structure: verified,
          contentEvidence: verified,
          noticeEvidence: verified,
          mechanisms: rule.mechanisms.map((mechanism) => ({
            ...mechanism,
            status: 'reused' as const,
          })),
        };
        const withRequirements = {
          ...scope,
          manifest: {
            ...scope.manifest,
            rows: [...scope.manifest.rows, notice, satisfiedRule],
          },
          findings: [],
        };
        expect(
          findOutcome(
            accountReleaseScope({ ...input, scope: withRequirements }),
            rule.key,
          ),
        ).toMatchObject({ outcome: 'included' });
        const refused = accountReleaseScope({
          ...input,
          scope: withRequirements,
          refusal: 'Catalog Release legal gate failed.',
        });
        for (const key of [race.human, notice.key, rule.key])
          expect(findOutcome(refused, key)).toMatchObject({
            outcome: 'held',
            cause: 'failed',
            reason: 'Catalog Release legal gate failed.',
          });
        expect(refused.qualification.status).toBe('FAILED');
        // Two manifest keys may not resolve to one release key.
        const twice = scopeOf(reducedManifest([race.human, race.halfOrc], {}));
        const remapped = accountReleaseScope({
          ...input,
          scope: { ...twice, findings: [] },
          artifact: {
            ...artifact,
            catalog: {
              ...artifact.catalog,
              remaps: [{ ...remapOf(race.halfOrc, race.human), applied: true }],
            },
          },
        });
        expect(remapped.qualification.findings).toEqual([
          expect.objectContaining({ code: 'duplicate-key', key: race.human }),
        ]);
      } finally {
        await tree.dispose();
      }
    },
    slow,
  );
});
