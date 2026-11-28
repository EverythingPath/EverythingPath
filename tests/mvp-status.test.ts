// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { inspectLaunchInventory } from '../scripts/catalog/launch-inventory';
import {
  admittedKeys,
  mvpStatus,
  mvpStatusLines,
  statusVerification,
} from '../scripts/mvp-status';

const owner = (issue: number) => ({ issue });
const path = (...keys: string[]) => ({ keys });

it('counts each root’s required rows and ends with the met total', () => {
  const lines = mvpStatusLines({
    roots: [
      { key: 'pf1/fighter', name: 'Fighter', kind: 'class' },
      { key: 'pf1/dwarf', name: 'Dwarf', kind: 'race' },
    ],
    rows: [
      {
        key: 'pf1/fighter',
        requirement: 'required',
        holds: [{ reason: 'Fighter launch proof.', owner: owner(596) }],
      },
      { key: 'pf1/feat-met', requirement: 'required', holds: [] },
      {
        key: 'pf1/feat-held',
        requirement: 'required',
        holds: [
          { reason: 'Owning batch must prove it.', owner: owner(739) },
          { reason: 'And its schedule.', owner: owner(739) },
        ],
      },
      { key: 'pf1/shared', requirement: 'required', holds: [] },
      { key: 'pf1/dwarf', requirement: 'required', holds: [] },
      {
        key: 'pf1/optional',
        requirement: 'optional',
        holds: [{ reason: 'Not launch.', owner: owner(1) }],
      },
    ],
    failures: [
      { key: 'pf1/fighter', code: 'hold' },
      { key: 'pf1/fighter', code: 'implementation' },
      { key: 'pf1/feat-held', code: 'hold' },
      { key: 'pf1/feat-held', code: 'hold' },
      // Only outstanding mechanisms: met, and counted as such.
      { key: 'pf1/shared', code: 'implementation' },
      { key: 'pf1/shared', code: 'implementation' },
      { key: 'pf1/dwarf', code: 'structure' },
      { key: 'pf1/dwarf', code: 'implementation' },
      { key: 'pf1/optional', code: 'admission' },
    ],
    incoming: {
      'pf1/feat-met': [path('pf1/fighter', 'pf1/feat-met')],
      'pf1/feat-held': [path('pf1/fighter', 'pf1/feat-held')],
      'pf1/shared': [
        path('pf1/fighter', 'pf1/feat-met', 'pf1/shared'),
        path('pf1/dwarf', 'pf1/shared'),
      ],
      'pf1/optional': [path('pf1/fighter', 'pf1/optional')],
    },
    verification: { rows: 4, stale: [] },
    admitted: new Set([
      'pf1/fighter',
      'pf1/feat-met',
      'pf1/shared',
      'pf1/optional',
    ]),
  });

  expect(lines).toContain(
    '  Fighter: 4 required, 2 met (1 with an outstanding mechanism), 3 admitted, 2 held (#596 1, #739 1)',
  );
  expect(lines).toContain(
    '  Dwarf: 2 required, 1 met (1 with an outstanding mechanism), 1 admitted, 0 held',
  );
  expect(lines.at(-1)).toBe(
    '2 of 5 launch requirements met (1 with an outstanding mechanism)',
  );
  expect(lines[0]).toBe(
    'Admitted: the rows whose admission the committed verification projection verifies: a catalog row when the gate admitted it, a resource row when the scoped build emits it from bytes equal to its bound source; a stale projection admits none. Held: rows with an inventory hold, counted by the issue that owns the hold. Books without a reviewed notice: pnpm -s catalog:notice-coverage.',
  );
  expect(lines[1]).toBe(
    "Met: a required row has no launch failure other than an outstanding mechanism. The inventory is frozen requirements; a content row's observations verify only from the committed verification projection of one current build: the gate admitted it and the scoped build emits a valid entry for it. It also has no hold and no inherited before-reliance failure. A row whose only failures are outstanding mechanisms counts as met: its entry ships labelled unverified and still counts, and each count says how many such rows it holds. A mechanism is no longer outstanding when reused, proven by the mechanism proof registry or permitted prose. Permitted prose is Magical Lineage's recorded metamagic or a PRD-named category identified from a reviewed case, never from a name (owner decision 2026-11-03): identified mystery, patron and spirit cases (D10), unparsed prerequisite clauses (D12) and the #229/#237 attack feats. Archetype proficiency changes (D7) only keep their own recorded issue from disqualifying a proof. Met is not verified, released or approved. A stale projection counts 0 rows. Verification: 4 rows current.",
  );
});

// "Admitted" is the projection's admission observation: a catalog row's when
// the gate admitted it, a resource row's when the scoped build emits it from
// bytes equal to its bound source (fix r1). The committed projection verifies
// admission on every row it holds, eight of them resources.
it('counts admitted from the committed projection, eight resource rows among them', async () => {
  const committed = JSON.parse(
    await readFile(
      'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
      'utf8',
    ),
  );
  const status = await mvpStatus(committed);
  expect(status.verification.stale).toEqual([]);
  expect(status.admitted.size).toBe(5949);
  const kinds = new Map(
    status.manifest.rows.map(({ key, kind }) => [key, kind]),
  );
  expect(
    [...status.admitted].filter((key) => kinds.get(key) === 'resource').sort(),
  ).toEqual([
    'resource/builtin:casting-tables',
    'resource/builtin:representative-archetype-catalog',
    'resource/builtin:representative-class-catalog',
    'resource/builtin:representative-race-catalog',
    'resource/builtin:representative-selection-catalog',
    'resource/builtin:representative-spellcasting-catalog',
    'resource/legal-resources',
    'resource/section15-registry',
  ]);
  // Iron Will, a catalog row the gate admitted.
  expect(status.admitted.has('pf1/iAbIGhm7T2OK9Brt')).toBe(true);
  // A stale projection admits nothing.
  const stale = await mvpStatus(undefined);
  expect(stale.admitted.size).toBe(0);
}, 120_000);

// The committed projection holds no row without a verified admission, so a
// fixture shows that such a row is not admitted.
it('admits only the projection rows whose admission it verifies', () => {
  expect(
    admittedKeys([
      { key: 'pf1/admitted', verified: ['admission', 'structure'] },
      { key: 'pf1/admission-only', verified: ['admission'] },
      { key: 'pf1/structure-only', verified: ['structure'] },
      { key: 'pf1/nothing', verified: [] },
    ]),
  ).toEqual(new Set(['pf1/admitted', 'pf1/admission-only']));
});

const identity = (digit: string) => `sha256:${digit.repeat(64)}`;
const projection = {
  version: 1,
  scopeVersion: 'campaign-mvp-v1',
  binding: {
    launchScopeIdentity: identity('1'),
    calculationIdentity: identity('2'),
    proofsSha256: '3'.repeat(64),
    gate: {
      extractionFingerprint: '4'.repeat(64),
      reviewedInputsFingerprint: '5'.repeat(64),
      legalResourcesFingerprint: '6'.repeat(64),
      upstream: [],
    },
    inputs: {
      'src/lib/catalog/data/attribution-assessments.json': '7'.repeat(64),
    },
    packages: {
      parsers: {
        dependencyVersions: { yaml: '2.9.1' },
        resolutionSha256: '9'.repeat(64),
      },
      imports: { zod: { version: '4.3.6', lockSha256: 'a'.repeat(64) } },
    },
  },
  rows: [
    {
      key: 'everythingpath/fighter-bonus-feats-2',
      verified: ['admission', 'structure'],
      mechanisms: [],
      prose: [],
      evidence: [],
    },
  ],
};
const current = {
  scopeVersion: 'campaign-mvp-v1',
  launchScopeIdentity: identity('1'),
  calculationIdentity: identity('2'),
  proofsSha256: '3'.repeat(64),
  proofs: { registry: [], sha256Of: () => undefined },
  proseCases: [],
  sha256Of: () => Promise.resolve('7'.repeat(64)),
  packages: () => Promise.resolve(projection.binding.packages),
};

it('counts a current projection’s rows and nothing from a stale or missing one, printing the reason', async () => {
  await expect(statusVerification(projection, current)).resolves.toEqual({
    rows: projection.rows,
    stale: [],
  });
  const stale = await statusVerification(projection, {
    ...current,
    sha256Of: () => Promise.resolve('8'.repeat(64)),
  });
  expect(stale).toEqual({
    rows: [],
    stale: [
      '1 bound input changed (src/lib/catalog/data/attribution-assessments.json)',
    ],
  });
  await expect(
    statusVerification(projection, {
      ...current,
      packages: () =>
        Promise.resolve({
          ...projection.binding.packages,
          parsers: {
            ...projection.binding.packages.parsers,
            dependencyVersions: { yaml: '2.9.2' },
          },
        }),
    }),
  ).resolves.toEqual({
    rows: [],
    stale: ['the package resolution changed (parsers)'],
  });
  await expect(statusVerification(undefined, current)).resolves.toEqual({
    rows: [],
    stale: ['no committed verification projection'],
  });
  const { packages: _, ...unpackaged } = projection.binding;
  await expect(
    statusVerification({ ...projection, binding: unpackaged }, current),
  ).resolves.toEqual({
    rows: [],
    stale: ['the committed verification projection is malformed'],
  });
  const lines = mvpStatusLines({
    roots: [{ key: 'pf1/fighter', name: 'Fighter', kind: 'class' }],
    rows: [
      {
        key: 'pf1/fighter',
        requirement: 'required',
        holds: [],
      },
    ],
    failures: [{ key: 'pf1/fighter', code: 'admission' }],
    incoming: {},
    verification: { rows: stale.rows.length, stale: stale.stale },
    admitted: new Set(),
  });
  expect(lines[1]).toMatch(
    /Verification stale \(1 bound input changed \(src\/lib\/catalog\/data\/attribution-assessments\.json\)\): it counts 0 rows; regenerate it with `pnpm -s catalog:launch-inventory --verify --write`\.$/,
  );
  expect(lines.at(-1)).toBe(
    '0 of 1 launch requirements met (0 with an outstanding mechanism)',
  );
});

// Spec review r1 #1's probe: the committed projection with archetype
// proficiency (D7) prose entries naming Fleet's outstanding speed Modifier
// (Skill Focus (Stealth)'s until the rank-scaled family proved it, #777, then
// Alertness's until feat wave FW1 proved it). D7 is issue-only, so the
// projection reader refuses it.
it('refuses a committed projection naming archetype proficiency prose, which would otherwise clear any mechanism', async () => {
  const committed: { rows: { key: string; prose: unknown[] }[] } = JSON.parse(
    await readFile(
      'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
      'utf8',
    ),
  );
  const featKey = 'pf1/BkKYCzEGNTzZRiTz';
  const modifiers = [
    'Modifier landSpeed if(and(lt(@armor.type, 2), lt(@attributes.encumbrance.level, 1)), 5)',
  ];
  const prose = <Category extends string>(category: Category) =>
    modifiers.map((mechanism) => ({ mechanism, category }));
  const probe = {
    ...committed,
    rows: committed.rows.map((row) =>
      row.key === featKey
        ? { ...row, prose: prose('archetype-proficiency') }
        : row,
    ),
  };
  expect(probe.rows.some(({ key }) => key === featKey)).toBe(true);
  const failing = (report: ReturnType<typeof inspectLaunchInventory>) =>
    new Set(report.launchFailures.map(({ key }) => key));
  const current = await mvpStatus(committed);
  expect(current.verification.stale).toEqual([]);
  expect(failing(current.report).has(featKey)).toBe(true);
  const probed = await mvpStatus(probe);
  expect(probed.verification).toEqual({
    rows: [],
    stale: ['the committed verification projection is malformed'],
  });
  expect(probed.lines[1]).toMatch(/Verification stale .*: it counts 0 rows/);
  // Past the reader, the inspector, which reads only the prose mechanisms,
  // would clear the Modifiers and meet the row: the reader is what refuses
  // the probe.
  const bypassed = failing(
    inspectLaunchInventory(current.manifest, {
      verification: current.verification.rows.map((row) =>
        row.key === featKey
          ? { ...row, prose: prose('attack-feat-text') }
          : row,
      ),
    }),
  );
  expect(
    [...failing(current.report)].filter((key) => !bypassed.has(key)),
  ).toEqual([featKey]);
}, 120_000);

// A Modifiers family proves a Modifier only as a proven pair: a committed
// projection claiming Fleet's speed Modifier proven (a conditional formula no
// pair names; Self-Sufficient's `.ranks` spelling until feat wave FW1's
// reviewed replacements), which would otherwise meet the row, is stale on
// read.
it('refuses a committed projection claiming a Modifier that is no proven pair, and counts the proven ones', async () => {
  const committed: { rows: { key: string; mechanisms: string[] }[] } =
    JSON.parse(
      await readFile(
        'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
        'utf8',
      ),
    );
  const featKey = 'pf1/BkKYCzEGNTzZRiTz';
  const ironWill = 'pf1/iAbIGhm7T2OK9Brt';
  const modifiers = [
    'Modifier landSpeed if(and(lt(@armor.type, 2), lt(@attributes.encumbrance.level, 1)), 5)',
  ];
  const failing = (report: ReturnType<typeof inspectLaunchInventory>) =>
    new Set(report.launchFailures.map(({ key }) => key));
  const current = await mvpStatus(committed);
  expect(current.verification.stale).toEqual([]);
  expect(failing(current.report).has(featKey)).toBe(true);
  expect(failing(current.report).has(ironWill)).toBe(false);
  expect(
    committed.rows.find(({ key }) => key === ironWill)?.mechanisms,
  ).toEqual(['Modifier will 2']);
  const probe = {
    ...committed,
    rows: committed.rows.map((row) =>
      row.key === featKey ? { ...row, mechanisms: modifiers } : row,
    ),
  };
  expect(probe.rows.some(({ key }) => key === featKey)).toBe(true);
  const probed = await mvpStatus(probe);
  expect(probed.verification).toEqual({
    rows: [],
    stale: ['1 row names a mechanism no current registry entry proves'],
  });
  expect(probed.lines[1]).toMatch(/Verification stale .*: it counts 0 rows/);
  expect(failing(probed.report).has(ironWill)).toBe(true);
}, 120_000);
