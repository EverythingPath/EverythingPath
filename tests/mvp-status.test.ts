// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { inspectLaunchInventory } from '../scripts/catalog/launch-inventory';
import {
  mvpStatus,
  mvpStatusLines,
  statusVerification,
} from '../scripts/mvp-status';

const owner = (issue: number) => ({ issue });
const path = (...keys: string[]) => ({ keys });
const verified = { state: 'verified' };
const held = { state: 'held' };

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
        noticeEvidence: held,
        holds: [{ reason: 'Fighter launch proof.', owner: owner(596) }],
      },
      {
        key: 'pf1/feat-met',
        requirement: 'required',
        holds: [],
        noticeEvidence: held,
      },
      {
        key: 'pf1/feat-held',
        requirement: 'required',
        noticeEvidence: held,
        holds: [
          {
            reason: 'feats-330-abcdefghijklmnop-whole-content-abcdefghijklmnop',
            owner: owner(330),
          },
          {
            reason: 'feats-330-abcdefghijklmnop-notice-PZO1115-complete-chain',
            owner: owner(330),
          },
        ],
      },
      {
        key: 'pf1/shared',
        requirement: 'required',
        holds: [],
        noticeEvidence: held,
      },
      {
        key: 'notice/PZO1110',
        requirement: 'required',
        holds: [],
        noticeEvidence: held,
      },
      {
        key: 'pf1/dwarf',
        requirement: 'required',
        holds: [],
        noticeEvidence: held,
      },
      {
        key: 'pf1/optional',
        requirement: 'optional',
        noticeEvidence: held,
        holds: [{ reason: 'Not launch.', owner: owner(1) }],
      },
    ],
    failures: [
      { key: 'pf1/fighter' },
      { key: 'pf1/feat-held' },
      { key: 'pf1/feat-held' },
      { key: 'pf1/shared' },
      { key: 'notice/PZO1110' },
      { key: 'pf1/dwarf' },
      { key: 'pf1/optional' },
    ],
    incoming: {
      'pf1/feat-met': [path('pf1/fighter', 'pf1/feat-met')],
      'pf1/feat-held': [path('pf1/fighter', 'pf1/feat-held')],
      'pf1/shared': [
        path('pf1/fighter', 'pf1/feat-met', 'pf1/shared'),
        path('pf1/dwarf', 'pf1/shared'),
      ],
      'notice/PZO1110': [path('pf1/fighter', 'notice/PZO1110')],
      'pf1/optional': [path('pf1/fighter', 'pf1/optional')],
    },
    verification: { rows: 0, stale: [] },
    admissions: new Map([
      ['pf1/feat-met', { disposition: 'admitted' }],
      ['pf1/feat-held', { disposition: 'held' }],
      ['pf1/shared', { disposition: 'dependently-omitted' }],
      ['pf1/dwarf', { disposition: 'supported/admitted' }],
    ]),
  });

  expect(lines).toContain(
    '  Fighter: 5 required, 1 met, 1 admitted, 2 held (#596 1, notice chain 1, whole content 1), 1 omitted, missing notices 1: PZO1110',
  );
  expect(lines).toContain(
    '  Dwarf: 2 required, 0 met, 1 admitted, 0 held, 1 omitted, missing notices 0',
  );
  expect(lines.at(-1)).toBe('1 of 6 launch requirements met');
  expect(lines[0]).toBe(
    'Held reasons: "notice chain" counts notice holds still in force (the inventory drops a hold the notice clearances name); a required notice that is not verified counts under "missing notices".',
  );
  expect(lines[1]).toBe(
    "Met: a row has no launch failure. The inventory is frozen requirements; a content row's observations verify only from the committed verification projection of one current build (the gate admitted it, the scoped build emits a valid entry, it has no hold, its notices are verified), and a mechanism counts only when reused, proven by the mechanism proof registry or permitted prose. Permitted prose is Magical Lineage's recorded metamagic or a PRD-named category identified from a reviewed case, never from a name (owner decision 2026-11-03): identified mystery, patron and spirit cases (D10), unparsed prerequisite clauses (D12) and the #229/#237 attack feats. Archetype proficiency changes (D7) only keep their own recorded issue from disqualifying a proof. A stale projection counts 0 rows. Verification: 0 rows current.",
  );
});

it('lists only notices whose readiness is not verified', () => {
  const lines = mvpStatusLines({
    roots: [{ key: 'pf1/wizard', name: 'Wizard', kind: 'class' }],
    rows: [
      {
        key: 'pf1/wizard',
        requirement: 'required',
        noticeEvidence: held,
        holds: [],
      },
      {
        key: 'pf1/held',
        requirement: 'required',
        noticeEvidence: held,
        holds: [
          {
            reason: 'spells-516-abcdefghijklmnop-notice-PZO1115-complete-chain',
            owner: owner(516),
          },
        ],
      },
      {
        key: 'notice/PZO1115',
        requirement: 'required',
        noticeEvidence: verified,
        holds: [],
      },
      {
        key: 'notice/PZO1123',
        requirement: 'required',
        noticeEvidence: verified,
        holds: [],
      },
      {
        key: 'notice/PZO9488',
        requirement: 'required',
        noticeEvidence: held,
        holds: [],
      },
      {
        key: 'notice/PZO9999',
        requirement: 'optional',
        noticeEvidence: held,
        holds: [],
      },
    ],
    failures: [
      { key: 'pf1/wizard' },
      { key: 'pf1/held' },
      { key: 'notice/PZO9488' },
      { key: 'notice/PZO9999' },
    ],
    incoming: {
      'pf1/held': [path('pf1/wizard', 'pf1/held')],
      'notice/PZO1115': [path('pf1/wizard', 'pf1/held', 'notice/PZO1115')],
      'notice/PZO1123': [path('pf1/wizard', 'notice/PZO1123')],
      'notice/PZO9488': [path('pf1/wizard', 'notice/PZO9488')],
      'notice/PZO9999': [path('pf1/wizard', 'notice/PZO9999')],
    },
    verification: { rows: 0, stale: [] },
    admissions: new Map(),
  });

  // A notice hold on a row counts as a notice chain whether or not its notice
  // reads as verified: the inventory keeps only holds in force. PZO1115 and
  // PZO1123 are verified; only PZO9488 is not ready.
  expect(lines).toContain(
    '  Wizard: 5 required, 2 met, 0 admitted, 1 held (notice chain 1), 0 omitted, missing notices 1: PZO9488',
  );
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
      verified: ['admission', 'structure', 'contentEvidence', 'noticeEvidence'],
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
        noticeEvidence: held,
        holds: [],
      },
    ],
    failures: [{ key: 'pf1/fighter' }],
    incoming: {},
    verification: { rows: stale.rows.length, stale: stale.stale },
    admissions: new Map(),
  });
  expect(lines[1]).toMatch(
    /Verification stale \(1 bound input changed \(src\/lib\/catalog\/data\/attribution-assessments\.json\)\): it counts 0 rows; regenerate it with `pnpm -s catalog:launch-inventory --verify --write`\.$/,
  );
  expect(lines.at(-1)).toBe('0 of 1 launch requirements met');
});

// Spec review r1 #1's probe: the committed projection with an archetype
// proficiency (D7) prose entry naming Skill Focus (Stealth)'s outstanding
// skill Modifier. D7 is issue-only, so the projection reader refuses it.
it('refuses a committed projection naming archetype proficiency prose, which would otherwise clear any mechanism', async () => {
  const committed: { rows: { key: string; prose: unknown[] }[] } = JSON.parse(
    await readFile(
      'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
      'utf8',
    ),
  );
  const skillFocus = 'pf1-content/2JWwVMFeqHnFDFSv';
  const modifier = 'Modifier skill.ste ifelse(gte(@skills.ste.rank,10),6,3)';
  const probe = {
    ...committed,
    rows: committed.rows.map((row) =>
      row.key === skillFocus
        ? {
            ...row,
            prose: [{ mechanism: modifier, category: 'archetype-proficiency' }],
          }
        : row,
    ),
  };
  expect(probe.rows.some(({ key }) => key === skillFocus)).toBe(true);
  const failing = (report: ReturnType<typeof inspectLaunchInventory>) =>
    new Set(report.launchFailures.map(({ key }) => key));
  const current = await mvpStatus(committed);
  expect(current.verification.stale).toEqual([]);
  expect(failing(current.report).has(skillFocus)).toBe(true);
  const probed = await mvpStatus(probe);
  expect(probed.verification).toEqual({
    rows: [],
    stale: ['the committed verification projection is malformed'],
  });
  expect(probed.lines[1]).toMatch(/Verification stale .*: it counts 0 rows/);
  // Past the reader, the inspector, which reads only the prose mechanism,
  // would clear the Modifier and meet the row: the reader is what refuses
  // the probe.
  const bypassed = failing(
    inspectLaunchInventory(current.manifest, {
      verification: current.verification.rows.map((row) =>
        row.key === skillFocus
          ? {
              ...row,
              prose: [{ mechanism: modifier, category: 'attack-feat-text' }],
            }
          : row,
      ),
    }),
  );
  expect(
    [...failing(current.report)].filter((key) => !bypassed.has(key)),
  ).toEqual([skillFocus]);
}, 120_000);

// The plain-Modifiers family proves a Modifier only as a proven pair: a
// committed projection claiming Skill Focus (Stealth)'s rank-scaled skill
// Modifier proven, which would otherwise meet the row, is stale on read.
it('refuses a committed projection claiming a Modifier that is no proven pair, and counts the proven ones', async () => {
  const committed: { rows: { key: string; mechanisms: string[] }[] } =
    JSON.parse(
      await readFile(
        'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
        'utf8',
      ),
    );
  const skillFocus = 'pf1-content/2JWwVMFeqHnFDFSv';
  const ironWill = 'pf1/iAbIGhm7T2OK9Brt';
  const modifier = 'Modifier skill.ste ifelse(gte(@skills.ste.rank,10),6,3)';
  const failing = (report: ReturnType<typeof inspectLaunchInventory>) =>
    new Set(report.launchFailures.map(({ key }) => key));
  const current = await mvpStatus(committed);
  expect(current.verification.stale).toEqual([]);
  expect(failing(current.report).has(skillFocus)).toBe(true);
  expect(failing(current.report).has(ironWill)).toBe(false);
  expect(
    committed.rows.find(({ key }) => key === ironWill)?.mechanisms,
  ).toEqual(['Modifier will 2']);
  const probe = {
    ...committed,
    rows: committed.rows.map((row) =>
      row.key === skillFocus ? { ...row, mechanisms: [modifier] } : row,
    ),
  };
  expect(probe.rows.some(({ key }) => key === skillFocus)).toBe(true);
  const probed = await mvpStatus(probe);
  expect(probed.verification).toEqual({
    rows: [],
    stale: ['1 row names a mechanism no current registry entry proves'],
  });
  expect(probed.lines[1]).toMatch(/Verification stale .*: it counts 0 rows/);
  expect(failing(probed.report).has(ironWill)).toBe(true);
}, 120_000);
