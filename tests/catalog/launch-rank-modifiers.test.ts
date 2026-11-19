// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { unmappedChangeReason } from '../../scripts/catalog/formula';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import {
  launchMechanismProofs,
  parseLaunchMechanismProofs,
  proofNamesMechanism,
  type LaunchMechanismProof,
} from '../../scripts/catalog/launch-mechanism-proofs';
import {
  currentMechanismProofs,
  launchVerificationStaleness,
  parseLaunchVerification,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { reviewedUnsupportedReason } from '../../scripts/catalog/racial-trait-rules';
import { reviewedReplacementFormulas } from '../../scripts/catalog/reviewed-change-replacements';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import {
  loadControlRows,
  modifierNames,
  type RealEntry,
} from './launch-modifier-evidence';
import { bodies as proofBodies } from '../rank-modifiers-proof';

// rank-modifiers S1 (#777): the rank-scaled Modifiers family. A raw Foundry
// rank-threshold change (`ifelse(gte(@skills.<s>.rank,N),H,L)` or
// `L + if(gte(@skills.<s>.rank, N), H−L)`) imports as nothing: the formula
// grammar has no `ifelse`, `if` or `gte`, so the change is an `unsupported`
// `changes` issue. #724's reviewed output stands in for it, an unconditional
// Modifier `L + (H−L) * min(1, floor(@skillRanks.<s> / N))`. The family proves
// the raw change when the entry carries exactly that output and the issue,
// so the raw change adds nothing and the reviewed output adds it once.
const proofTest = 'convex/characterSheetRankModifiers.integration.test.ts';
const proofFixture = 'tests/rank-modifiers-proof.ts';
const repository = (path: string) => repositoryFileSha256('.', path);
const currentRegistry = {
  registry: launchMechanismProofs,
  sha256Of: repository,
};
const family = (name: string) => {
  const found = launchMechanismProofs.find((proof) => proof.family === name);
  if (!found) throw new Error(`Missing the ${name} family`);
  return found;
};

/** The importer's reason for a change it cannot map, written out here. */
const generic =
  'Unmapped target, bonus type, formula or calculation-stage dependency; contributes nothing.';

/**
 * The listed skills: the 14 Skill Focus rows' and the 20 the Core Rulebook
 * skill-pair feats name (slice 2), 27 in all.
 */
const listedSkills = [
  'acr',
  'blf',
  'clm',
  'crf',
  'dev',
  'dip',
  'dis',
  'esc',
  'fly',
  'han',
  'hea',
  'int',
  'kar',
  'kdu',
  'khi',
  'kna',
  'kpl',
  'kre',
  'per',
  'rid',
  'sen',
  'slt',
  'spl',
  'ste',
  'sur',
  'swm',
  'umd',
] as const;

/** The 4 reviewed `curation.mechanics` diagnostics (root decision R2(b)). */
const reviewedDiagnostics = [
  [
    'pf1-content/LmV6WT0Dv5FZO4Qy',
    'Distinct-skill repeatability is not an overlay fact.',
  ],
  [
    'pf1-content/Z7kvSCJd3aMgwXrn',
    'Chosen-skill repeatability remains unstructured.',
  ],
  [
    'pf1-content/2JWwVMFeqHnFDFSv',
    'Source multiple-selection identity remains unreviewed.',
  ],
  [
    'pf1-content/ZRkknePy6wjAgoVH',
    'Chosen-skill repeatability remains unstructured.',
  ],
] as const;

const skillFocus = (skill: string) =>
  `ifelse(gte(@skills.${skill}.rank,10),6,3)`;
const skillPair = (skill: string) =>
  `2 + if(gte(@skills.${skill}.rank, 10), 2)`;
const name = (target: string, formula: string) =>
  `Modifier ${target} ${formula}`;

const mechanism = (named: string): LaunchRow['mechanisms'][number] => ({
  name: named,
  disposition: 'calculated',
  status: 'outstanding',
  contract: `${named} contract.`,
  evidence: ['row.sources'],
});
const source = 'e'.repeat(64);
type Row = Parameters<typeof verifyLaunchRows>[0]['rows'][number];
function row(key: string, names: readonly string[], kind = 'feat'): Row {
  return {
    key,
    kind,
    catalogKey: key,
    requirement: 'required',
    holds: [],
    mechanisms: names.map(mechanism),
    sources: [
      {
        repository: 'pf1-content',
        pin: 'baseline',
        locator: `src/pf-feats/${key}.yaml`,
        rawSha256: source,
        effectiveSha256: source,
      },
    ],
    noticeEvidence: { state: 'unreviewed', evidence: ['row.sources'] },
  };
}
function entry(key: string, modifiers: unknown[], kind = 'feat') {
  return {
    externalKey: key,
    upstreamKey: key.split('/')[1],
    pack: kind === 'feat' ? 'feats' : 'pf-racial-traits',
    name: key,
    detail:
      kind === 'racialTrait'
        ? {
            kind,
            bonusSkillRanksPerLevel: 0,
            raceKeys: [],
            standard: true,
          }
        : { kind, featTypes: ['General'], repeatable: 'no' },
    description: '',
    sources: [{ book: 'PZO1110' }],
    modifiers,
    unsupported: [],
  };
}
/** #724's reviewed output, `below + step * min(1, floor(ranks / 10))`. */
const reviewed = (skill: string, below = 3, step = 3) => ({
  target: `skill.${skill}`,
  bonusType: 'untyped',
  value: {
    formula: `${below} + ${step} * min(1, floor(@skillRanks.${skill} / 10))`,
  },
});
/** The importer's issue for a raw change it cannot map. */
const rawIssue = (
  target: string,
  formula: string,
  { type = 'untyped', reason = generic, operator = '' } = {},
) => ({
  field: 'changes',
  reason,
  value: { target, formula, type, ...(operator ? { operator } : {}) },
});
type Issue =
  LaunchVerificationInput['unsupported']['entries'][number]['issues'][number];

function projectionInput(
  keys: readonly string[],
  change: Partial<LaunchVerificationInput> = {},
): LaunchVerificationInput {
  return {
    admission: {
      admitted: keys.map((externalKey) => ({
        externalKey,
        reason: 'Admitted.',
      })),
      held: [],
      dependentOmissions: [],
      retainedExceptions: [],
      failures: [],
    },
    scopeBuild: { entries: [], remaps: new Map(), resources: new Map() },
    unsupported: { entries: [] },
    proofs: currentRegistry,
    proseCases: [],
    calculationIdentity: currentCalculationIdentity,
    stale: [],
    ...change,
  };
}

type Case = {
  key: string;
  names: string[];
  modifiers?: unknown[];
  issues: Issue[];
  kind?: string;
  proves: boolean;
};
/** Each case's proven mechanisms, keyed by row, under a registry. */
function proven(
  cases: readonly Case[],
  registry: readonly unknown[] = launchMechanismProofs,
  change: Partial<LaunchVerificationInput> = {},
) {
  return Object.fromEntries(
    verifyLaunchRows(
      {
        rows: cases.map(({ key, names, kind }) => row(key, names, kind)),
        edges: [],
      },
      projectionInput(
        cases.map(({ key }) => key),
        {
          scopeBuild: {
            entries: cases.flatMap(({ key, modifiers, kind }) =>
              modifiers ? [entry(key, modifiers, kind)] : [],
            ),
            remaps: new Map(),
            resources: new Map(),
          },
          unsupported: {
            entries: cases.map(({ key, issues }) => ({
              externalKey: key,
              issues,
            })),
          },
          proofs: { registry, sha256Of: repository },
          ...change,
        },
      ),
    ).map(({ key, mechanisms }) => [key, mechanisms]),
  );
}
const expectCases = (cases: readonly Case[], registry?: readonly unknown[]) => {
  const result = proven(cases, registry);
  expect(
    Object.fromEntries(cases.map(({ key }) => [key, result[key]])),
  ).toEqual(
    Object.fromEntries(
      cases.map(({ key, names, proves }) => [key, proves ? names : []]),
    ),
  );
};

/** A Skill-Focus-shaped feat on one skill, with its reviewed output and issue. */
function skillFocusCase(
  key: string,
  skill: string,
  change: Partial<Case> = {},
): Case {
  const formula = skillFocus(skill);
  return {
    key,
    names: [name(`skill.${skill}`, formula)],
    modifiers: [reviewed(skill)],
    issues: [rawIssue(`skill.${skill}`, formula)],
    proves: false,
    ...change,
  };
}

describe('the rank-modifiers family', () => {
  it('names its public saved-sheet proof with its current bytes, the current calculation identity and the exact proven pairs', () => {
    expect(unmappedChangeReason).toBe(generic);
    const rank = family('rank-modifiers');
    expect(rank).toEqual({
      family: 'rank-modifiers',
      mechanismPrefix: 'Modifier ',
      kinds: ['feat'],
      tests: [
        { path: proofTest, sha256: expect.any(String) },
        { path: proofFixture, sha256: expect.any(String) },
      ],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['racialTraitRule'],
      modifiers: listedSkills.map((skill) => ({
        source: `skill.${skill}`,
        formula: 'rank-threshold',
        target: `skill.${skill}`,
        bonusTypes: ['untyped'],
        thresholds: [
          { below: 3, from: 6, ranks: 10 },
          { below: 2, from: 4, ranks: 10 },
        ],
      })),
      reviewedDiagnostics: reviewedDiagnostics.map(([key, reason]) => ({
        key,
        field: 'curation.mechanics',
        reason,
        basis: expect.stringMatching(/\S/),
      })),
    });
    expect(currentMechanismProofs(currentRegistry)).toContainEqual(rank);
    // The entry with its test or fixture file's bytes changed proves nothing.
    for (const changed of [proofTest, proofFixture])
      expect(
        currentMechanismProofs({
          registry: launchMechanismProofs,
          sha256Of: (path) =>
            path === changed ? 'e'.repeat(64) : repository(path),
        }).map(({ family: named }) => named),
        changed,
      ).not.toContain('rank-modifiers');
  });

  it('proves a feat whose every Modifier mechanism is a rank threshold, whose entry carries exactly the reviewed output for each, and whose changes issues are exactly those raw changes', () => {
    const craft = 'ifelse(gte(@skills.crf.subSkills.crf1.rank,10),6,3)';
    expectCases([
      skillFocusCase('pf1-content/arcana', 'kar', { proves: true }),
      // Skill Focus (Craft) reads the first Craft sub-skill; the app's one
      // Craft skill is its own key (#724).
      {
        key: 'pf1-content/craft',
        names: [name('skill.crf', craft)],
        modifiers: [reviewed('crf')],
        issues: [rawIssue('skill.crf', craft)],
        proves: true,
      },
      // A Core Rulebook skill-pair shape: two changes, two outputs, two issues.
      {
        key: 'pf1/pair',
        names: [
          name('skill.per', skillPair('per')),
          name('skill.sen', skillPair('sen')),
        ],
        modifiers: [reviewed('sen', 2, 2), reviewed('per', 2, 2)],
        issues: [
          rawIssue('skill.sen', skillPair('sen')),
          rawIssue('skill.per', skillPair('per')),
        ],
        proves: true,
      },
      // Spacing Foundry allows in either shape.
      {
        key: 'pf1/spaced',
        names: [name('skill.kar', 'ifelse(gte(@skills.kar.rank, 10), 6, 3)')],
        modifiers: [reviewed('kar')],
        issues: [
          rawIssue('skill.kar', 'ifelse(gte(@skills.kar.rank, 10), 6, 3)'),
        ],
        proves: true,
      },
      // An issue the family does not read, and a descriptive note.
      skillFocusCase('pf1-content/retained', 'per', {
        issues: [
          rawIssue('skill.per', skillFocus('per')),
          { field: 'gameContent', reason: 'Retained.' },
        ],
        proves: true,
      }),
    ]);
  });

  it('proves a change whose reviewed replacement imports the reviewed Modifier itself, with no changes issue, only on that record (R5(a))', () => {
    // Self-Sufficient: Foundry's `.ranks` path gives a flat +2; its reviewed
    // replacements (#726) import #777's formula, so the entry carries the
    // Modifiers and no `changes` issue.
    const selfSufficient = 'pf1/8VZQJOyAXbXghxd7';
    const names = [
      name('skill.hea', '2 + if(gte(@skills.hea.ranks, 10), 2)'),
      name('skill.sur', '2 + if(gte(@skills.sur.ranks, 10), 2)'),
    ];
    const imported = [reviewed('hea', 2, 2), reviewed('sur', 2, 2)];
    expect(
      ['hea', 'sur'].map((skill) =>
        reviewedReplacementFormulas(selfSufficient, {
          target: `skill.${skill}`,
          formula: `2 + if(gte(@skills.${skill}.ranks, 10), 2)`,
        }),
      ),
    ).toEqual([
      ['2 + 2 * min(1, floor(@skillRanks.hea / 10))'],
      ['2 + 2 * min(1, floor(@skillRanks.sur / 10))'],
    ]);
    const outcome = proven([
      {
        key: selfSufficient,
        names,
        modifiers: imported,
        issues: [],
        proves: true,
      },
    ]);
    expect(outcome[selfSufficient]).toEqual(names);
    for (const refused of [
      // The raw change's issue beside the imported Modifier.
      {
        issues: [
          rawIssue('skill.hea', '2 + if(gte(@skills.hea.ranks, 10), 2)'),
        ],
      },
      // A missing or doubled Modifier.
      { modifiers: imported.slice(1) },
      { modifiers: [...imported, reviewed('hea', 2, 2)] },
    ])
      expect(
        proven([
          {
            key: selfSufficient,
            names,
            modifiers: imported,
            issues: [],
            proves: false,
            ...refused,
          },
        ])[selfSufficient],
        JSON.stringify(refused),
      ).toEqual([]);
    // The same row under another key has no replacement.
    expect(
      proven([
        {
          key: 'pf1/probe',
          names,
          modifiers: imported,
          issues: [],
          proves: false,
        },
      ])['pf1/probe'],
    ).toEqual([]);
  });

  it('keeps the mechanisms outstanding when the output, the issues, the raw shape, the kind or the row differ', () => {
    const kar = name('skill.kar', skillFocus('kar'));
    const karIssue = rawIssue('skill.kar', skillFocus('kar'));
    const formula = (value: string) => ({
      target: 'skill.kar',
      bonusType: 'untyped',
      value: { formula: value },
    });
    const refused = (key: string, change: Partial<Case>) =>
      skillFocusCase(`pf1/${key}`, 'kar', change);
    const shape = (key: string, target: string, raw: string) =>
      skillFocusCase(`pf1/${key}`, target.slice('skill.'.length), {
        names: [name(target, raw)],
        issues: [rawIssue(target, raw)],
      });
    expectCases([
      // The output is wrong.
      refused('no-min', {
        modifiers: [formula('3 + 3 * floor(@skillRanks.kar / 10)')],
      }),
      refused('threshold-9', {
        modifiers: [formula('3 + 3 * min(1, floor(@skillRanks.kar / 9))')],
      }),
      refused('other-skill-ranks', {
        modifiers: [formula('3 + 3 * min(1, floor(@skillRanks.kdu / 10))')],
      }),
      refused('flat', { modifiers: [formula('6')] }),
      refused('spaced-output', {
        modifiers: [formula('3+3*min(1, floor(@skillRanks.kar / 10))')],
      }),
      {
        key: 'pf1/pair-with-focus-output',
        names: [name('skill.per', skillPair('per'))],
        modifiers: [reviewed('per')],
        issues: [rawIssue('skill.per', skillPair('per'))],
        proves: false,
      },
      refused('conditional', {
        modifiers: [{ ...reviewed('kar'), condition: { situation: 'rank' } }],
      }),
      refused('stacks-within-entry', {
        modifiers: [{ ...reviewed('kar'), stacksWithinEntry: true }],
      }),
      refused('other-bonus-type', {
        modifiers: [{ ...reviewed('kar'), bonusType: 'competence' }],
      }),
      refused('unproven-raw-type', {
        modifiers: [{ ...reviewed('kar'), bonusType: 'competence' }],
        issues: [
          rawIssue('skill.kar', skillFocus('kar'), { type: 'competence' }),
        ],
      }),
      refused('missing-output', { modifiers: [] }),
      refused('wrong-target-output', {
        modifiers: [{ ...reviewed('kar'), target: 'skill.kdu' }],
      }),
      // An extra Modifier, or a second copy of the output.
      refused('extra', {
        modifiers: [
          reviewed('kar'),
          { target: 'save.will', bonusType: 'untyped', value: 2 },
        ],
      }),
      refused('twice', { modifiers: [reviewed('kar'), reviewed('kar')] }),
      // The issues are wrong: the raw change imported beside the output would
      // count twice; another change contributes nothing.
      refused('no-issue', { issues: [] }),
      refused('second-change', {
        issues: [karIssue, rawIssue('skill.per', '2 + @unknown')],
      }),
      refused('issue-twice', { issues: [karIssue, karIssue] }),
      refused('reviewed-reason', {
        issues: [
          rawIssue('skill.kar', skillFocus('kar'), {
            reason: 'A reviewed reason; contributes nothing.',
          }),
        ],
      }),
      refused('operator', {
        issues: [rawIssue('skill.kar', skillFocus('kar'), { operator: 'add' })],
      }),
      refused('issue-formula', {
        issues: [rawIssue('skill.kar', skillFocus('kdu'))],
      }),
      refused('issue-target', {
        issues: [rawIssue('skill.kdu', skillFocus('kar'))],
      }),
      refused('issue-no-value', {
        issues: [{ field: 'changes', reason: generic }],
      }),
      // The raw formula isn't a proven shape.
      shape('reads-other-skill', 'skill.ste', skillFocus('per')),
      shape('ranks-path', 'skill.hea', '2 + if(gte(@skills.hea.ranks, 10), 2)'),
      shape(
        'second-sub-skill',
        'skill.crf',
        'ifelse(gte(@skills.crf.subSkills.crf2.rank,10),6,3)',
      ),
      shape(
        'sub-skill-of-plain-skill',
        'skill.per',
        'ifelse(gte(@skills.per.subSkills.per1.rank,10),6,3)',
      ),
      shape(
        'unproven-threshold',
        'skill.kar',
        'ifelse(gte(@skills.kar.rank,5),4,2)',
      ),
      shape('decreasing', 'skill.kar', 'ifelse(gte(@skills.kar.rank,10),3,6)'),
      shape('zero-below', 'skill.kar', 'ifelse(gte(@skills.kar.rank,10),3,0)'),
      shape('greater-than', 'skill.kar', 'ifelse(gt(@skills.kar.rank,10),6,3)'),
      shape('trailing', 'skill.kar', `${skillFocus('kar')} + 1`),
      shape('unlisted-skill', 'skill.apr', skillFocus('apr')),
      // A rank change beside a constant Modifier: neither family proves it.
      refused('mixed', {
        names: [kar, 'Modifier will 2'],
        modifiers: [
          reviewed('kar'),
          { target: 'save.will', bonusType: 'untyped', value: 2 },
        ],
      }),
      // A kind the family does not cover, and a row without a scoped entry.
      refused('racial-trait', { kind: 'racialTrait' }),
      refused('trait', { kind: 'trait' }),
      refused('unbuilt', { modifiers: undefined }),
    ]);
  });

  it('tolerates a curation diagnostic only where it is listed with its key, field and exact reason', () => {
    const [stealthKey, stealthReason] = reviewedDiagnostics[2];
    const diagnostic = (field: string, reason: string) => ({ field, reason });
    const stealth = (key: string, issue: Issue, proves: boolean) =>
      skillFocusCase(key, 'ste', {
        issues: [rawIssue('skill.ste', skillFocus('ste')), issue],
        proves,
      });
    // An unlisted row with a listed reason, and another listed row's reason.
    expectCases([
      stealth(
        'pf1-content/unlisted',
        diagnostic('curation.mechanics', stealthReason),
        false,
      ),
      stealth(
        reviewedDiagnostics[0][0],
        diagnostic('curation.mechanics', stealthReason),
        false,
      ),
    ]);
    // The listed row itself, one projection per issue.
    for (const [issue, proves] of [
      [diagnostic('curation.mechanics', stealthReason), true],
      [diagnostic('curation.mechanics', 'Another diagnostic.'), false],
      [diagnostic('curation.mechanics', `${stealthReason} `), false],
      [diagnostic('curation.outputs', stealthReason), false],
      [diagnostic('curation', stealthReason), false],
      [diagnostic('racialTraitRule', 'A rule.'), false],
    ] as const)
      expectCases([stealth(stealthKey, issue, proves)]);
    // A listed diagnostic beside an unlisted one refuses the row.
    expectCases([
      skillFocusCase(stealthKey, 'ste', {
        issues: [
          rawIssue('skill.ste', skillFocus('ste')),
          diagnostic('curation.mechanics', stealthReason),
          diagnostic('curation.mechanics', 'Another diagnostic.'),
        ],
      }),
    ]);
    // Without the list, every curation diagnostic refuses the row.
    const rank = family('rank-modifiers');
    expectCases(
      [
        stealth(
          stealthKey,
          diagnostic('curation.mechanics', stealthReason),
          false,
        ),
      ],
      [{ ...rank, reviewedDiagnostics: undefined }],
    );
  });

  it('refuses a row the gate does not admit or under another calculation identity', () => {
    const found = skillFocusCase('pf1-content/arcana', 'kar', { proves: true });
    expect(
      proven([found], launchMechanismProofs, {
        calculationIdentity: `sha256:${'f'.repeat(64)}`,
      })[found.key],
    ).toEqual([]);
    expect(
      proven([found], launchMechanismProofs, {
        admission: {
          admitted: [],
          held: [{ externalKey: found.key, reason: 'Held.' }],
          dependentOmissions: [],
          retainedExceptions: [],
          failures: [],
        },
      })[found.key],
    ).toBeUndefined();
  });

  it('keeps plain-Modifiers and rank-modifiers disjoint', () => {
    const plain = family('plain-modifiers');
    const rank = family('rank-modifiers');
    const focus = skillFocusCase('pf1-content/arcana', 'kar', { proves: true });
    const constant: Case = {
      key: 'pf1/will',
      names: ['Modifier will 2'],
      modifiers: [{ target: 'save.will', bonusType: 'untyped', value: 2 }],
      issues: [],
      proves: true,
    };
    expectCases([focus, { ...constant, proves: false }], [rank]);
    expectCases([{ ...focus, proves: false }, constant], [plain]);
    // Without its `changes` disqualifier, plain-Modifiers still names no
    // rank shape.
    expectCases(
      [{ ...focus, proves: false }],
      [{ ...plain, disqualifying: [] }],
    );
    const rankName = focus.names[0] ?? '';
    const named = (proof: LaunchMechanismProof, mechanismName: string) =>
      proofNamesMechanism(proof, focus.key, mechanismName);
    expect([named(rank, rankName), named(plain, rankName)]).toEqual([
      true,
      false,
    ]);
    expect([
      named(rank, 'Modifier will 2'),
      named(plain, 'Modifier will 2'),
    ]).toEqual([false, true]);
  });

  it('keeps a committed projection current only while each rank Modifier it names is a proven pair', async () => {
    const committed = parseLaunchVerification(
      JSON.parse(
        await readFile(
          'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
          'utf8',
        ),
      ),
    );
    const current = {
      scopeVersion: committed.scopeVersion,
      launchScopeIdentity: committed.binding.launchScopeIdentity,
      calculationIdentity: committed.binding.calculationIdentity,
      proofsSha256: committed.binding.proofsSha256,
      proofs: currentRegistry,
      proseCases: [],
      sha256Of: () => Promise.resolve(undefined),
      packages: () => Promise.resolve(committed.binding.packages),
    };
    const naming = (named: string) => ({
      ...committed,
      binding: { ...committed.binding, inputs: {} },
      rows: [
        {
          key: 'pf1/probe',
          verified: [],
          mechanisms: [named],
          prose: [],
          evidence: [],
        },
      ],
    });
    for (const named of [
      name('skill.ste', skillFocus('ste')),
      name('skill.per', skillPair('per')),
    ])
      expect(
        await launchVerificationStaleness(naming(named), current),
        named,
      ).toEqual([]);
    for (const named of [
      name('skill.apr', skillFocus('apr')),
      name('skill.hea', '2 + if(gte(@skills.hea.ranks, 10), 2)'),
      name('skill.ste', skillFocus('per')),
    ])
      expect(
        await launchVerificationStaleness(naming(named), current),
        named,
      ).toEqual(['1 row names a mechanism no current registry entry proves']);
  });
});

// The committed-inventory control: real rows with their real entries and
// issues (`launch-modifier-evidence.ts`).

/** The fixed root keys (#777): 10, and 4 more with the reviewed diagnostics. */
const listedRows = [
  'pf1-content/Vi8Fh4JceKVHZ7jK',
  'pf1-content/pslODOJK0u0wOxqL',
  'pf1-content/7mcNePI93Co2JbPF',
  'pf1-content/Vvz4wGmyxEdAaJa0',
  'pf1-content/zes8vxX3D6CKoYC2',
  'pf1-content/WMfe0yuef5IYgE7i',
  'pf1-content/sUwMFZMDtVqqLswV',
  'pf1-content/weePoRFNXCKBgP1S',
  'pf1-content/9yua5ZlomvDj1c7D',
  'pf1-content/kNe3aEHS1byqAX50',
];
const diagnosedRows = reviewedDiagnostics.map(([key]) => key);
/**
 * The 10 Core Rulebook skill-pair feats (slice 2, feat wave FW1), each with
 * its reviewed outputs; Self-Sufficient's are imported through its reviewed
 * replacements (R5(a)).
 */
const skillPairFeats = [
  'pf1/jCxcObXJfdDrx4WS',
  'pf1/Q1cY8r0Pvb66pMG0',
  'pf1/bqoIfsrF8BF1GC28',
  'pf1/rMR6ahXEfYqASE7D',
  'pf1/SUACufUXl12sUvnQ',
  'pf1/SMyexRzOm5PfjT5I',
  'pf1/CLSsMyNmdcNAOUKC',
  'pf1/L10V7jTzmMYz62zz',
  'pf1/8VZQJOyAXbXghxd7',
  'pf1/f5FPqAYWlKj3zCIY',
];
const selfSufficient = 'pf1/8VZQJOyAXbXghxd7';

/**
 * A skill-pair feat's real evidence: one reviewed +2/+4 output per raw change,
 * in order, and that change's generic issue, except for Self-Sufficient,
 * whose reviewed replacements import the outputs and leave no issue; no
 * curation issue and no reviewed unsupported reason.
 */
function expectSkillPairEvidence(
  key: string,
  found: LaunchRow | undefined,
  { entry: built, issues: found_ }: RealEntry,
) {
  // In target order: the family takes outputs in any order.
  const changes = (found ? modifierNames(found) : [])
    .map((named) => {
      const [, target = '', skill = '', formula = ''] =
        /^Modifier (skill\.([a-z]+)) (.+)$/.exec(named) ?? [];
      return { target, skill, formula };
    })
    .sort((a, b) => a.target.localeCompare(b.target));
  const sorted = (items: unknown) =>
    (Array.isArray(items) ? [...items] : []).sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
  expect(changes, key).toHaveLength(2);
  expect(sorted(built?.modifiers), key).toEqual(
    sorted(changes.map(({ skill }) => reviewed(skill, 2, 2))),
  );
  const issues = found_.filter(({ field }) => field === 'changes');
  expect(sorted(issues), key).toEqual(
    key === selfSufficient
      ? []
      : sorted(changes.map(({ target, formula }) => rawIssue(target, formula))),
  );
  expect(
    found_.filter(({ field }) => field.startsWith('curation')),
    key,
  ).toEqual([]);
  for (const { target, formula, skill } of changes) {
    expect(reviewedReplacementFormulas(key, { target, formula }), key).toEqual(
      key === selfSufficient
        ? [`2 + 2 * min(1, floor(@skillRanks.${skill} / 10))`]
        : [],
    );
    expect(
      reviewedUnsupportedReason(key, { target, formula, type: 'untyped' }),
      key,
    ).toBeUndefined();
  }
}

/**
 * A listed row's real evidence: exactly the reviewed output, one generic
 * issue for its raw change, its reviewed diagnostic if it has one, no
 * reviewed replacement and no reviewed unsupported reason.
 */
function expectReviewedEvidence(
  key: string,
  found: LaunchRow | undefined,
  { entry: built, issues: found_ }: RealEntry,
) {
  const [named] = found ? modifierNames(found) : [];
  const [, target = '', skill = '', formula = ''] =
    /^Modifier (skill\.([a-z]+)) (.+)$/.exec(named ?? '') ?? [];
  expect(skill, key).not.toBe('');
  expect(built?.modifiers, key).toEqual([reviewed(skill)]);
  expect(
    found_.filter(({ field }) => field === 'changes'),
    key,
  ).toEqual([rawIssue(target, formula)]);
  expect(
    found_.filter(({ field }) => field.startsWith('curation')),
    key,
  ).toEqual(
    reviewedDiagnostics
      .filter(([listed]) => listed === key)
      .map(([, reason]) => ({ field: 'curation.mechanics', reason })),
  );
  expect(reviewedReplacementFormulas(key, { target, formula }), key).toEqual(
    [],
  );
  expect(
    reviewedUnsupportedReason(key, { target, formula, type: 'untyped' }),
    key,
  ).toBeUndefined();
}

describe('the rank-modifiers family over the committed inventory', () => {
  it('proves exactly the listed rows among the required rows, each with its real reviewed output and generic issue, the Core Rulebook skill-pair feats included', async () => {
    const { committed, modifierRows, real } = await loadControlRows();
    const evidence = (key: string) => {
      const found = real.get(key);
      if (!found) throw new Error(`No real entry for ${key}.`);
      return found;
    };
    const rank = family('rank-modifiers');
    const keys = modifierRows.map(({ key }) => key);
    const entries = keys.flatMap((key) => evidence(key).entry ?? []);
    const issues = keys.map((externalKey) => ({
      externalKey,
      issues: evidence(externalKey).issues,
    }));
    const project = (
      registry: readonly unknown[] = [rank],
      found: LaunchVerificationInput['unsupported']['entries'] = issues,
      built: readonly unknown[] = entries,
    ) =>
      verifyLaunchRows(
        committed,
        projectionInput(keys, {
          scopeBuild: {
            entries: built,
            remaps: new Map(),
            resources: new Map(),
          },
          unsupported: { entries: found },
          proofs: { registry, sha256Of: repository },
        }),
      )
        .filter(({ mechanisms }) => mechanisms.length)
        .map(({ key }) => key)
        .sort();
    const byKey = new Map(committed.rows.map((found) => [found.key, found]));
    const required = (proven: readonly string[]) =>
      proven.filter((key) => byKey.get(key)?.requirement === 'required');
    const control = project();
    expect(required(control)).toEqual(
      [...listedRows, ...diagnosedRows, ...skillPairFeats].sort(),
    );
    // Every other proven row, required or not, is a Skill Focus (<skill>)
    // feat with one rank change.
    for (const key of control.filter((key) => !skillPairFeats.includes(key))) {
      const found = byKey.get(key);
      expect(found?.name, key).toMatch(/^Skill Focus \(.+\)$/);
      expect(found && modifierNames(found), key).toHaveLength(1);
    }
    // Root can shrink the list by the 4 diagnosed rows by data alone.
    expect(required(project([{ ...rank, reviewedDiagnostics: [] }]))).toEqual(
      [...listedRows, ...skillPairFeats].sort(),
    );
    // Each listed row's real evidence: exactly the reviewed output, one
    // generic issue for its raw change, no reviewed replacement and no
    // reviewed unsupported reason.
    for (const key of [...listedRows, ...diagnosedRows])
      expectReviewedEvidence(key, byKey.get(key), evidence(key));
    for (const key of skillPairFeats)
      expectSkillPairEvidence(key, byKey.get(key), evidence(key));
    // A listed row whose reviewed output or raw change changed is refused
    // (Self-Sufficient has no raw change issue to change).
    const listed = [...listedRows, ...diagnosedRows, ...skillPairFeats];
    const changedOutputs = entries.map((built) => {
      const record = built as { externalKey?: unknown; modifiers?: unknown };
      return typeof record.externalKey === 'string' &&
        listed.includes(record.externalKey)
        ? {
            ...record,
            modifiers: [
              JSON.parse(
                JSON.stringify(record.modifiers).replace('/ 10))', '/ 9))'),
              ),
            ].flat(),
          }
        : built;
    });
    expect(required(project([rank], issues, changedOutputs))).toEqual([]);
    const changedIssues = issues.map(({ externalKey, issues: found }) => ({
      externalKey,
      issues: listed.includes(externalKey)
        ? found.map((issue) =>
            issue.field === 'changes'
              ? JSON.parse(JSON.stringify(issue).replace(/, ?10\)/, ',9)'))
              : issue,
          )
        : found,
    }));
    expect(required(project([rank], changedIssues))).toEqual([selfSufficient]);
    // Plain-Modifiers proves none of these rows.
    expect(
      project([family('plain-modifiers')]).filter((key) =>
        control.includes(key),
      ),
    ).toEqual([]);
    // The committed projection, from the real build, proves a rank Modifier
    // on exactly the control rows the inventory does not hold.
    const committedProjection = parseLaunchVerification(
      JSON.parse(
        await readFile(
          'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
          'utf8',
        ),
      ),
    );
    const committedProven = committedProjection.rows
      .filter(({ key, mechanisms }) =>
        mechanisms.some((named) => proofNamesMechanism(rank, key, named)),
      )
      .map(({ key }) => key)
      .sort();
    const held = control.filter((key) => byKey.get(key)?.holds.length);
    expect([...committedProven, ...held].sort()).toEqual(control);
  }, 120_000);
});

// The coverage tie: every (skill, threshold) pair the family certifies is one
// the public proof releases and checks at 0, 9, 10 and 20 recorded ranks. The
// public test releases its fixture's bodies (`tests/rank-modifiers-proof.ts`,
// bound by bytes in the registry entry beside the test), so the certified
// set must be a subset of the reviewed outputs those bodies carry. A
// reviewed replacement (R5(a)) imports the same output, so it is no shape of
// its own; the raw Foundry forms (Craft's `subSkills.crf1` included) are the
// catalog side's, which the refusal tests above cover.

/** A reviewed rank-threshold output in the tie's words. */
const rankWord = ({
  ranksOf,
  target,
  bonusType,
  below,
  from,
  ranks,
}: {
  ranksOf: string;
  target: string;
  bonusType: string;
  below: number;
  from: number;
  ranks: number;
}) => `${ranksOf} ${target} ${bonusType} ${below}/${from} at ${ranks}`;
const reviewedOutput =
  /^([1-9][0-9]*) \+ ([1-9][0-9]*) \* min\(1, floor\(@skillRanks\.([a-z]+) \/ ([1-9][0-9]*)\)\)$/;

/** What the public fixture releases, in the tie's words. */
function exercised(released: typeof proofBodies) {
  const words = new Set<string>();
  for (const { modifiers } of released)
    for (const { target, bonusType, value } of modifiers) {
      const found = reviewedOutput.exec(value.formula);
      if (!found) continue;
      const [, below, step, skill, ranks] = found;
      words.add(
        rankWord({
          ranksOf: `skill.${String(skill)}`,
          target,
          bonusType,
          below: Number(below),
          from: Number(below) + Number(step),
          ranks: Number(ranks),
        }),
      );
    }
  return words;
}

/** What the family's pairs certify, in the same words. */
function certified(proof: LaunchMechanismProof) {
  const words = new Set<string>();
  if (!('modifiers' in proof)) return words;
  for (const pair of proof.modifiers)
    if (pair.formula === 'rank-threshold')
      for (const bonusType of pair.bonusTypes)
        for (const threshold of pair.thresholds)
          words.add(
            rankWord({
              ranksOf: pair.source,
              target: pair.target,
              bonusType,
              ...threshold,
            }),
          );
    else words.add(`${pair.formula} ${pair.source}`);
  return words;
}

/** What the family certifies that the public fixture doesn't release. */
function uncovered(
  proof: LaunchMechanismProof,
  released: typeof proofBodies = proofBodies,
) {
  const seen = exercised(released);
  return [...certified(proof)].filter((word) => !seen.has(word)).sort();
}

describe('the rank-modifiers pairs’ coverage tie to the public proof', () => {
  const rank = () => family('rank-modifiers');
  /** The family with one more pair. */
  const withPair = (pair: object) => {
    const proof = rank();
    if (!('modifiers' in proof)) throw new Error('Missing the pairs');
    return { ...proof, modifiers: [...proof.modifiers, pair] };
  };
  const pair = (skill: string, below: number, from: number) => ({
    source: `skill.${skill}`,
    formula: 'rank-threshold',
    target: `skill.${skill}`,
    bonusTypes: ['untyped'],
    thresholds: [{ below, from, ranks: 10 }],
  });

  it('certifies only skills and thresholds the public fixture releases', () => {
    expect(uncovered(rank())).toEqual([]);
    // 27 skills, each at both thresholds.
    expect(certified(rank()).size).toBe(54);
  });

  it('names exactly the skill, threshold or bonus type a pair certifies beyond the fixture', () => {
    const parsed = (extra: object) => {
      const proof = parseLaunchMechanismProofs([withPair(extra)])[0];
      if (!proof) throw new Error('Missing the widened entry');
      return proof;
    };
    // A skill the fixture gives no feat.
    expect(uncovered(parsed(pair('apr', 3, 6)))).toEqual([
      'skill.apr skill.apr untyped 3/6 at 10',
    ]);
    // A threshold the fixture never releases on a listed skill.
    expect(uncovered(parsed(pair('per', 1, 2)))).toEqual([
      'skill.per skill.per untyped 1/2 at 10',
    ]);
    // A bonus type the fixture never releases.
    expect(
      uncovered(parsed({ ...pair('per', 3, 6), bonusTypes: ['competence'] })),
    ).toEqual(['skill.per skill.per competence 3/6 at 10']);
    // Without the skill-pair feats, the 2/4 threshold is unexercised on
    // every skill.
    expect(
      uncovered(
        rank(),
        proofBodies.filter(({ modifiers }) =>
          modifiers.every(({ value }) => value.formula.startsWith('3 + ')),
        ),
      ),
    ).toHaveLength(27);
  });
});
