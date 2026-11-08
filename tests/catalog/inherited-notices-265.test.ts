// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-265.json';
import {
  buildAssessmentBinding,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import type { AttributionAssessment } from '../../src/lib/catalog/admission-schema';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import { resolveNotice } from '../../src/lib/catalog/resolve-notice';
import {
  legalResources,
  section15Registry,
} from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  '5a7b36cc37599ef615b10eb9593d4e72011305a2d03bd019988fa87fb717695d',
  '6fc2a2874dff56368a6574653a116c9defb44e8f86c0674abe826b670ade147a',
  'cfc1d7d6843bb28015db86137ea65fe93976b881887ab71a6ce466c8e9b13593',
  '8dd5fab68911640215309a2982334c9a51203102bee87397d60992ea13717aed',
  '8bbfec2e4140df48a629b06401960fc8d482d6a12cde406bc6d3429ebdd9c455',
  '8a7d07a771577307cc38548216180e2fc6c40fecbce2fa5ce9fc1892776d3d5b',
  '843ca0ce45977a699f3dec3ed4eb27f79cafa1b860ea0a3db0caa96ac0a31768',
  '0083e6466ec1457191dffb639d8f7db68ed9265032802c18ba2de02ead4ab621',
  '2277fb25f7514fc67d45a1646f4c09fed24a4e8529c8fae0b14226afdca7b2b2',
  '2fa07d77e3084900b2b01c3f54346570d886e1720a4333924606ab3b028dc0ce',
  'b95196e9598fb0eb261726341df71f7a69a0abefc2ef59b340aa3a136fad91e1',
  'efc61320dbaa9aa5bd94e814e6c3763c83d617f32b20717fe1199668f9e9a267',
  'f88d3b7cf3d1b0b2ab8f51f17724b64c4ea2762e805a9f406d554ef8bc8dbc4a',
  '650717f9415b236a4f10b568786b45c62720f69d5bfbbaafc643ae39e782ff91',
  '4f477214db205d699d28909b418727d80f2bb16eb8ee8fa910ddd5347a57db9f',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-265',
    upstreamKey: 'fixture/notice-265',
    pack: 'feats',
    name: 'Synthetic notice gate fixture',
    description: 'Synthetic fixture only; no imported content is assessed.',
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
    sources: [],
    modifiers: [],
    unsupported: [],
  };
  const artifact: AdmissionSource = {
    catalog: { entries: [entry] },
    comparison: {
      packs: [],
      records: [
        {
          repo: 'fixture',
          pack: entry.pack,
          path: 'notice-265.yaml',
          externalKey: entry.externalKey,
          name: entry.name,
          status: 'admitted',
          reason: 'Synthetic fixture only.',
        },
      ],
    },
  };
  const evidence = {
    fixture: {
      content: 'Synthetic content comparison for gate behavior only.',
    },
  };
  const assessments: AttributionAssessment[] = [
    {
      externalKey: entry.externalKey,
      status: 'confirmed',
      ...buildAssessmentBinding({
        entry,
        artifact,
        evidence,
        registry: section15Registry,
        requiredNotices,
        evidenceIds: ['fixture'],
      }),
      requiredNotices,
      rationale: 'Fixture-only assessment; not evidence for a Catalog Entry.',
      reviewedBy: 'Fixture reviewer',
      reviewedOn: '2026-10-07',
    },
  ];
  return { artifact, evidence, assessments, registry: section15Registry };
}

it('binds all 15 immutable blocks to complete verbatim notices at the pinned lines', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review).toMatchObject({
    reviewedBy: reviewer,
    reviewedOn: '2026-10-07',
    checkedAgainst: 'pf1-content',
  });
  for (const [repo, source] of Object.entries(review.sources)) {
    const upstream = legalResources.upstreamNotices.find(
      (notice) => notice.id === source.legalResourceId,
    );
    if (!upstream) throw new Error(`Missing legal resource for ${repo}`);
    const original = legalResources.ogl.text + upstream.text;
    expect(sha256(original)).toBe(source.fileSha256);
    const lines = original.split('\n');
    for (const block of review.blocks.filter((item) => item.source === repo)) {
      const notice = resolveNotice({
        registry: section15Registry,
        code: block.key,
      });
      if (!notice) throw new Error(`Missing Registry record for ${block.key}`);
      expect(block).toMatchObject({ kind: 'complete-notice', joinedWith: [] });
      expect(block.textSha256).toBe(block.key.split('/').at(-1));
      expect(notice.notice).toBe(lines[block.line - 1]);
      expect(sha256(notice.notice)).toBe(block.textSha256);
      expect(notice).toMatchObject({
        checkedAgainst: 'pf1-content',
        checkedOn: '2026-10-07',
        reviewStatus: 'reviewed',
      });
      expect(notice.provenance).toContain(
        `Reviewed by ${reviewer} on 2026-10-07.`,
      );
      expect(notice.provenance).toContain(`${source.url}#L${block.line}`);
      expect(notice).toBe(section15Registry[block.registryKey]);
      expect(notice.aliases).toEqual(
        keys.filter(
          (key) => key !== block.registryKey && key.endsWith(block.textSha256),
        ),
      );
    }
  }
});

it('publishes 15 reviewed notices for 15 keys and retains every historic notice version', () => {
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: keys,
  });
  expect(page.outstandingNotices).toEqual([]);
  expect(
    page.sections.find((section) => section.id === 'section15')?.notices,
  ).toEqual(page.permanentNoticeSuperset);
  expect(
    page.permanentNoticeSuperset.filter((notice) =>
      notice.id.startsWith('registry:'),
    ),
  ).toHaveLength(15);
  for (const code of keys) {
    expect(page.permanentNoticeSuperset).toContainEqual({
      id: `registry:${code}`,
      title: section15Registry[code]!.title,
      text: section15Registry[code]!.notice,
      provenance: section15Registry[code]!.provenance,
    });
  }
  expect(page.permanentNoticeSuperset).toEqual(
    expect.arrayContaining(legalResources.permanentNoticeSuperset),
  );
  const laterPage = buildLegalPageData({
    registry: {},
    resources: legalResources,
    permanentNoticeSuperset: page.permanentNoticeSuperset,
    requiredNotices: [],
  });
  expect(laterPage.permanentNoticeSuperset).toEqual(
    page.permanentNoticeSuperset,
  );
});

it('requires a separate content assessment and enforces the batch notice holds even when all inherited notices are reviewed', () => {
  const input = fixture();
  expect(assessWithUnclearedHolds({ ...input, assessments: [] })).toMatchObject(
    {
      passed: true,
      admitted: [],
      held: [
        {
          externalKey: 'fixture/notice-265',
          reason: 'missing Attribution Assessment',
        },
      ],
    },
  );
  const result = assessWithUnclearedHolds(input);
  expect(result).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-265',
        requiredNotices: [...keys].sort(),
        missingNotices: [],
        reason: expect.stringMatching(/^Notice holds: /),
      },
    ],
    failures: [],
  });
  for (const hold of review.holds) {
    expect(result.held[0]?.reason).toContain(`${hold.noticeKey} (`);
    expect(result.held[0]?.reason).toContain(hold.id);
  }
  expect(input.artifact.catalog.entries[0]?.sources).toEqual([]);
});

it('reopens an accepted fixture assessment when its reviewed notice changes', () => {
  const input = fixture();
  const code = keys[0]!;
  const registry = structuredClone(section15Registry);
  registry[code]!.notice += ' Fixture-only changed notice.';
  expect(assessWithUnclearedHolds({ ...input, registry })).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-265',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-265-complete-chain-'))
      .map((hold) => hold.noticeKey),
  ).toEqual(keys);
  expect(new Set(review.holds.map((hold) => hold.id)).size).toBe(16);
  for (const hold of review.holds) {
    expect(hold.status).toBe('held');
    expect(
      resolveNotice({ registry: section15Registry, code: hold.title }),
    ).toBeUndefined();
  }
  const bookTitles = [...new Set(review.holds.map((hold) => hold.title))];
  const unreviewedSeeds = ['PZO9419', 'PZO9416', 'PZO1137', 'PZO9269'];
  const requiredNotices = [...bookTitles, ...unreviewedSeeds];
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices,
  });
  expect(page.outstandingNotices).toEqual(
    expect.arrayContaining([
      ...bookTitles.map((code) => ({ code, title: code, reason: 'missing' })),
      ...unreviewedSeeds.map((code) => ({
        code,
        title: section15Registry[code]!.title,
        reason: 'unreviewed',
      })),
    ]),
  );
  expect(page.outstandingNotices).toHaveLength(requiredNotices.length);
  // PZO9419 and PZO9416 have reviewed PCGen blocks since their confirmations'
  // review was recorded (2026-10-31): the gate resolves them, while the page
  // still lists their own unreviewed Registry records.
  const gateMissing = requiredNotices.filter(
    (code) => code !== 'PZO9419' && code !== 'PZO9416',
  );
  expect(assessWithUnclearedHolds(fixture(requiredNotices))).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-265',
        missingNotices: expect.arrayContaining(gateMissing),
      },
    ],
  });
});

it.each(['missing', 'unreviewed'] as const)(
  'holds an entry when one batch notice becomes %s',
  (state) => {
    const input = fixture();
    const code = keys[0]!;
    const registry = structuredClone(section15Registry);
    if (state === 'missing') delete registry[code];
    else registry[code]!.reviewStatus = 'unreviewed';
    expect(assessWithUnclearedHolds({ ...input, registry })).toMatchObject({
      passed: true,
      admitted: [],
      held: [{ externalKey: 'fixture/notice-265', missingNotices: [code] }],
      failures: [],
    });
    const page = buildLegalPageData({
      registry,
      resources: legalResources,
      permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
      requiredNotices: keys,
    });
    expect(page.outstandingNotices).toEqual([
      {
        code,
        title: state === 'missing' ? code : registry[code]!.title,
        reason: state,
      },
    ]);
  },
);

it('keeps Revised and Complete daemon versions distinct without owner-seed aliases', () => {
  for (const [complete, revised] of [
    [6, 7],
    [9, 10],
    [12, 13],
    [14, 11],
  ]) {
    const completeNotice = section15Registry[keys[complete!]!]!;
    const revisedNotice = section15Registry[keys[revised!]!]!;
    expect(completeNotice.notice).toContain('Complete © 2011');
    expect(revisedNotice.notice).toContain('Revised © 2002');
    expect(completeNotice).not.toEqual(revisedNotice);
    expect(completeNotice.aliases).toEqual([]);
    expect(revisedNotice.aliases).toEqual([]);
  }
  const owner = section15Registry.PZO1137!;
  const ownerLines = owner.notice.split('\n');
  expect(owner.reviewStatus).toBe('unreviewed');
  expect(owner.checkedAgainst).toBe('owner-transcription');
  const overlap = keys.filter((key) =>
    ownerLines.includes(section15Registry[key]!.notice),
  );
  expect(overlap).toEqual([keys[6], keys[9], keys[12]]);
  expect(section15Registry[keys[8]!]!.notice).toContain('Daemon, Guardian');
  expect(owner.notice).toContain('Daemon, Ceustodaemon (Guardian Daemon)');
  expect(ownerLines).not.toContain(section15Registry[keys[8]!]!.notice);
  expect(resolveNotice({ registry: section15Registry, code: 'PZO1137' })).toBe(
    owner,
  );
});

it('preserves both Core Rulebook variants and Condition Cards spacing verbatim', () => {
  const core = section15Registry[keys[3]!]!;
  expect(core.notice).toContain('Core Rulebook. © 2010');
  expect(core.notice).toContain('Author: Jason Buhlman');
  expect(core.aliases).toEqual([]);
  const existingCore = resolveNotice({
    registry: section15Registry,
    code: 'PZO1110',
  });
  expect(existingCore).toBe(section15Registry.CRB);
  expect(existingCore?.notice).toContain(
    'Pathfinder RPG Core Rulebook. Copyright 2009',
  );
  expect(existingCore?.notice).toContain('Author: Jason Bulmahn');
  expect(existingCore).not.toBe(core);
  const comparison = review.comparisons.find(
    (item) => item.registryKey === 'CRB',
  );
  expect(comparison).toMatchObject({ source: 'pf1-content', line: 415 });
  expect(sha256(existingCore!.notice)).toBe(comparison?.textSha256);
  expect(review.holds).toContainEqual(
    expect.objectContaining({
      id: 'notice-265-core-rulebook-variant-comparison',
      noticeKey: keys[3],
      status: 'held',
    }),
  );
  expect(section15Registry[keys[2]!]!.notice).toBe(
    'Condition Cards.  Copyright 2010, Paizo Publishing, LLC.  Author: Jason Bulmahn.',
  );
});
