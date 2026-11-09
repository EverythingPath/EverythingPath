// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  checkNoticeDependencies,
  readNoticeDependencyInputs,
} from '../../scripts/catalog/notice-dependencies';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { section15Registry as registry } from '../../src/lib/catalog/section15-registry-data';

type PinnedCandidate = Record<string, unknown> & {
  externalKey: string;
  name: string;
};

/**
 * One pinned batch candidate, named by key or name, as its own inventory,
 * optionally edited the way a curation mistake would.
 */
function inventoryOf({
  batch,
  candidate: keyOrName,
  edit,
}: {
  batch: string;
  candidate: string;
  edit?: (candidate: PinnedCandidate) => void;
}) {
  const path = `scripts/catalog/legal/${batch}.json`;
  const { candidates } = JSON.parse(readFileSync(path, 'utf8')) as {
    candidates: PinnedCandidate[];
  };
  const candidate = candidates.find(
    ({ externalKey, name }) => externalKey === keyOrName || name === keyOrName,
  );
  if (!candidate) throw new Error(`${keyOrName} is not in ${path}`);
  edit?.(candidate);
  return { path, data: { candidates: [candidate] } };
}

const withoutNotice = (notice: string) => (candidate: PinnedCandidate) => {
  candidate.requiredNotices = (candidate.requiredNotices as string[]).filter(
    (code) => code !== notice,
  );
};

const cockatriceStrike = 'pf1-content/6yivoRJHy6kQQJiC';
const cockatriceWithoutUnchained = () =>
  inventoryOf({
    batch: 'feats-337',
    candidate: cockatriceStrike,
    edit: withoutNotice('PZO1131'),
  });
const testWaiver = (notice: string) => ({
  key: cockatriceStrike,
  notice,
  reason: 'Waiver exercised by the notice-dependency gate test.',
  reviewedBy: 'Notice-dependency gate test',
  reviewedOn: '2026-10-08',
});

it('keeps every committed batch inventory within its recorded notice dependencies and waivers', async () => {
  const inputs = await readNoticeDependencyInputs('.');
  expect(inputs.inventories.map(({ path }) => path)).toEqual(
    expect.arrayContaining([
      'scripts/catalog/legal/feats-337.json',
      'scripts/catalog/legal/spells-524.json',
      'scripts/catalog/legal/races-328.json',
    ]),
  );
  const report = checkNoticeDependencies({
    ...inputs,
    heldNotices,
    registry,
    descriptions: reviewedCuration.records,
  });
  // Guards against a vacuous pass: the recorded shapes are read.
  expect(report.checked.dependencies).toBeGreaterThan(0);
  expect(report.gaps).toEqual([]);
  expect(report.stale).toEqual([]);
  expect(report.passed).toBe(true);
});

it('fails a #337 Combat Trick whose recorded PZO1131 hold is missing from its required notices', () => {
  const report = checkNoticeDependencies({
    inventories: [cockatriceWithoutUnchained()],
    heldNotices,
    registry,
  });
  expect(report.passed).toBe(false);
  expect(report.gaps).toEqual([
    expect.objectContaining({
      key: cockatriceStrike,
      notice: 'PZO1131',
      kind: 'missing',
      recordedBy: ['noticeHoldIds: feats-337-notice-PZO1131-complete-chain'],
    }),
  ]);
});

it('passes a recorded dependency gap that an explicit reviewed waiver names, and reports the waiver', () => {
  const report = checkNoticeDependencies({
    inventories: [cockatriceWithoutUnchained()],
    heldNotices,
    registry,
    waivers: [testWaiver('PZO1131')],
  });
  expect(report).toMatchObject({
    passed: true,
    gaps: [],
    waived: [
      expect.objectContaining({ key: cockatriceStrike, notice: 'PZO1131' }),
    ],
  });
});

it.each([
  // #338 hard finding: ARG race abilities.
  ['feats-338', 'Improved Drow Nobility', 'PZO1121', 'inheritedRuleNotices'],
  // #339 hard finding: Wolf Style.
  ['feats-339', 'Wolf Trip', 'PZO9439', 'fullContentReview.inheritedRules'],
  // #341 hard finding: Story feats.
  ['feats-341', 'Apotheosis', 'PZO1125', 'inheritedRuleNotices'],
  [
    'feats-341',
    'First General of the East',
    'PZO1133',
    'inheritedRuleSourceEvidence',
  ],
  // #520 hard finding: advanced simple template.
  ['spells-520', 'Umbral Infusion', 'PZO1112', 'inheritedNoticeReview'],
  [
    'spells-520',
    'Umbral Infusion',
    'PZO1112',
    'mechanicsReview.inheritedRuleEvidence',
  ],
  [
    'spells-518',
    'Animal Aspect, Greater',
    'PZO1118',
    'mechanicsReview.inheritedRuleEvidence',
  ],
  [
    'spells-523',
    'Erase Impressions',
    'PZO1132',
    'mechanicsReview.inheritedRuleEvidence',
  ],
])(
  'fails %s %s without %s, recorded by %s',
  (batch, candidate, notice, recordedBy) => {
    const inventory = inventoryOf({
      batch,
      candidate,
      edit: withoutNotice(notice),
    });
    const report = checkNoticeDependencies({
      inventories: [inventory],
      heldNotices,
      registry,
    });
    expect(report.gaps).toContainEqual(
      expect.objectContaining({
        name: candidate,
        notice,
        kind: 'missing',
        recordedBy: expect.arrayContaining([
          expect.stringMatching(new RegExp(`^${recordedBy}: `)),
        ]),
      }),
    );
  },
);

it('fails a required inherited notice that is neither a reviewed Registry notice nor held', () => {
  // PZO1131's PRD record is reviewed (2026-10-30); without it and its holds,
  // the notice is neither.
  const { PZO1131: _reviewed, ...withoutUnchained } = registry;
  const report = checkNoticeDependencies({
    inventories: [
      inventoryOf({ batch: 'feats-339', candidate: 'Coordinated Maneuvers' }),
    ],
    heldNotices: heldNotices.filter(
      (hold) => !hold.notices.includes('PZO1131'),
    ),
    registry: withoutUnchained,
  });
  expect(report.gaps).toEqual([
    expect.objectContaining({
      key: 'pf1-content/9dRwUyYiX5zsX3ce',
      notice: 'PZO1131',
      kind: 'unheld',
      recordedBy: [
        'inheritedRuleNotices: Combat Trick stamina resource',
        'fullContentReview.inheritedRules: Combat Trick stamina resource',
      ],
    }),
  ]);
});

it('fails a waiver that no longer matches a gap as stale', () => {
  expect(
    checkNoticeDependencies({
      inventories: [
        inventoryOf({ batch: 'feats-337', candidate: cockatriceStrike }),
      ],
      heldNotices,
      registry,
      waivers: [testWaiver('PZO1131')],
    }),
  ).toMatchObject({
    passed: false,
    gaps: [],
    stale: [{ key: cockatriceStrike, notice: 'PZO1131' }],
  });
});

it.each([
  // The hard review findings, each a real record whose reviewed notice the
  // gate must miss as soon as it is removed again.
  ['feats-337', 'Cockatrice Strike', 'PZO1131'],
  ['feats-337', 'Snake Sidewind', 'PZO1131'],
  ['feats-338', 'Improved Drow Nobility', 'PZO1121'],
  ['feats-338', 'Improved Shadowy Resistance', 'PZO1121'],
  ['feats-338', 'Improved Fiendish Sorcery', 'PZO1121'],
  ['feats-338', 'Triton Portal', 'PZO1121'],
  ['feats-339', "Mascot's Affection", 'PZO9454'],
  ['feats-339', 'Wolf Trip', 'PZO9439'],
  ['feats-339', 'Linnorm Vengeance', 'PZO9470'],
  ['feats-341', 'Apotheosis', 'PZO1125'],
  ['feats-341', 'Never Conquered, Forever Feared', 'PZO1125'],
  ['feats-341', 'Dynasty Founder', 'PZO1125'],
  ['spells-520', 'Umbral Infusion', 'PZO1112'],
])('catches the %s hard finding %s without %s', (batch, candidate, notice) => {
  const report = checkNoticeDependencies({
    inventories: [
      inventoryOf({ batch, candidate, edit: withoutNotice(notice) }),
    ],
    heldNotices,
    registry,
  });
  expect(report.passed).toBe(false);
  expect(report.gaps).toContainEqual(
    expect.objectContaining({ name: candidate, notice, kind: 'missing' }),
  );
});

it("warns, without failing, when a linked record's book is not required, since links include prerequisites", () => {
  // #333 Shield Master links its prerequisite feats, all Core Rulebook.
  const report = checkNoticeDependencies({
    inventories: [
      inventoryOf({
        batch: 'feats-333',
        candidate: 'Shield Master',
        edit: withoutNotice('PZO1110'),
      }),
    ],
    heldNotices,
    registry,
  });
  expect(report).toMatchObject({ passed: true, gaps: [] });
  expect(report.advisories).toContainEqual({
    kind: 'linked',
    inventory: 'scripts/catalog/legal/feats-333.json',
    key: 'pf1/yB4JlE2GC1MYlweS',
    name: 'Shield Master',
    notice: 'PZO1110',
    alternatives: [],
    linked: 'Two-Weapon Fighting',
  });
});

it('warns, without failing, when reviewed description text names a term whose book is not required', () => {
  const report = checkNoticeDependencies({
    inventories: [
      // Names Linnorm Style with no required notices.
      inventoryOf({ batch: 'feats-337', candidate: 'Linnorm Wrath' }),
      // Names Linnorm Style and requires PZO9470 after the #339 review.
      inventoryOf({ batch: 'feats-339', candidate: 'Linnorm Vengeance' }),
    ],
    heldNotices,
    registry,
    descriptions: reviewedCuration.records,
  });
  expect(report.passed).toBe(true);
  expect(report.advisories).toEqual([
    expect.objectContaining({
      kind: 'term',
      key: 'pf1-content/6nTc9JPQKOHwfSuS',
      term: 'Linnorm Style',
      notice: 'PZO9470',
    }),
  ]);
});

it('rejects a curated candidate whose recorded dependency is malformed, rather than skipping it', () => {
  const inventory = inventoryOf({
    batch: 'feats-338',
    candidate: 'Fleeting Spell',
    edit: (candidate) => {
      const [rule] = candidate.inheritedRuleNotices as { book?: string }[];
      if (rule) delete rule.book;
    },
  });
  expect(() =>
    checkNoticeDependencies({
      inventories: [inventory],
      heldNotices,
      registry,
    }),
  ).toThrow(`${inventory.path} pf1-content/7bCi7mC6Y31vC06S`);
});
