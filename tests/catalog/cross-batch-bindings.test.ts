import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import turtlebackSnapshot from '../fixtures/cross-batch-756/turtleback-ferry.json';
import {
  checkCrossBatchBindings,
  findStaleCrossBatchBindings,
  findUncoveredBatches,
  loadCommittedBatchFixtures,
  type AcceptedStaleBinding,
  type BatchFixture,
} from './cross-batch-bindings';

/**
 * Stale cross-batch bindings the #756 audit confirmed on the feature head:
 * #523 curated Create Pit after #520 recorded it in its full-context
 * closures. #738 re-bound the affected Hold Person/Daylight cases over full
 * context. Each remaining current fingerprint equals
 * a full-corpus catalog:preview re-bind. The owner deferred re-binding them to
 * the post-curation cleanup (2026-10-17); remove each row once its assessment
 * is re-bound.
 */
const acceptedStale: AcceptedStaleBinding[] = [
  {
    batch: 'spells-520',
    name: 'Hungry Pit',
    externalKey: 'pf1/4osvw3l6mq9unkec',
    changedBy: ['spells-523'],
    changedKeys: ['pf1/8w67l6dzzsi6oz5f'],
    recordedFingerprint:
      'edbc277c9e0498ee25c719b0f3021b9005f0f5eb30e012dfa6389fb0d9edabb4',
    currentFingerprint:
      '1985bf780ee0557d909aced6ccf4702e6bea865d46d983a81fc1a19ccc72ddaa',
  },
  {
    batch: 'spells-520',
    name: 'Spiked Pit',
    externalKey: 'pf1/55yke7az6gco0tyn',
    changedBy: ['spells-523'],
    changedKeys: ['pf1/8w67l6dzzsi6oz5f'],
    recordedFingerprint:
      'f8b6060ae8fc9ef03b24aeb18cf57505d5c1798af809f4b67e5e095ffebb140c',
    currentFingerprint:
      '997f61e0b58425d50873389f32f9e0f431669517438ae7268ec98f7f909e3e80',
  },
];

/**
 * Historical batches whose fixtures don't commit their assessments' content
 * closures, so the staleness check can't see them (#756). #328 and #329
 * commit no fixture entry for most of their records; #330 to #333 and #537 to
 * #546 commit bounded previews only; #516 to #519's bounded previews stripped
 * their links to other spells. Deferred to the post-curation cleanup. This
 * list must not grow: a new batch commits its full-corpus closures.
 */
const uncoveredBatches = [
  'feats-330',
  'feats-331',
  'feats-332',
  'feats-333',
  'races-328',
  'racial-hd-329',
  'spells-516',
  'spells-517',
  'spells-518',
  'spells-519',
  'spells-537',
  'spells-538',
  'spells-539',
  'spells-540',
  'spells-541',
  'spells-542',
  'spells-543',
  'spells-544',
  'spells-545',
  'spells-546',
];

const fixtures = loadCommittedBatchFixtures();
const { assessments } = reviewedAdmission;
const check = (
  batchFixtures: readonly BatchFixture[],
  alsoAccepted: readonly AcceptedStaleBinding[] = [],
) =>
  checkCrossBatchBindings({
    fixtures: batchFixtures,
    assessments,
    acceptedStale: [...acceptedStale, ...alsoAccepted],
    uncoveredBatches,
  });

type EntryAddress = { batch: string; filename: string; externalKey: string };
const fixtureEntry = ({ batch, filename, externalKey }: EntryAddress) => {
  const entry = fixtures
    .find((fixture) => fixture.batch === batch)
    ?.files.find((file) => file.path.endsWith(`/${filename}`))
    ?.entries.find((row) => row.externalKey === externalKey);
  if (!entry) throw new Error(`Missing ${externalKey} in ${batch}/${filename}`);
  return entry;
};
/** The committed fixtures with one entry changed in memory. */
const withEntry = ({
  batch,
  filename,
  externalKey,
  update,
}: EntryAddress & { update: (entry: PreviewEntry) => PreviewEntry }) =>
  fixtures.map((fixture) =>
    fixture.batch !== batch
      ? fixture
      : {
          ...fixture,
          files: fixture.files.map((file) =>
            !file.path.endsWith(`/${filename}`)
              ? file
              : {
                  ...file,
                  entries: file.entries.map((entry) =>
                    entry.externalKey === externalKey ? update(entry) : entry,
                  ),
                },
          ),
        },
  );

// #371's Regional Recluse - Turtleback Ferry covers #370's Urglin.
const turtlebackFerry = 'pf1-content/EtUNYMr9ykH2XhZA';
const urglin = {
  batch: 'traits-370',
  filename: 'preview.json',
  externalKey: 'pf1-content/BDByEeeSK08bn8gp',
};
const staleFor = (batchFixtures: readonly BatchFixture[], key: string) =>
  findStaleCrossBatchBindings({ fixtures: batchFixtures, assessments }).filter(
    (row) => row.externalKey === key,
  );

/**
 * A frozen #370/#371 case the tests hold themselves, so later re-binds of
 * Turtleback Ferry (#375 and on) leave them unchanged: #371's committed
 * closure of Turtleback Ferry and #370's Urglin, at feature head 51fe093d.
 */
const frozenSnapshotPath =
  'tests/fixtures/cross-batch-756/turtleback-ferry.json';
const frozen371 = turtlebackSnapshot.traits371 as unknown as PreviewEntry[];
const [frozenUrglin] =
  turtlebackSnapshot.traits370 as unknown as PreviewEntry[];
if (!frozenUrglin) throw new Error('Missing the frozen Urglin');
/** #371's copy of Urglin as #371 landed, before #370 curated it. */
const urglinBefore370: PreviewEntry = (({ situationalNotes: _, ...entry }) => ({
  ...entry,
  modifiers: [{ target: 'skill.sur', bonusType: 'trait', value: 1 }],
}))(frozenUrglin);
/** Turtleback Ferry's binding over #370's Urglin, as #370 re-bound it. */
const reboundBy370 =
  '3db111e1eeda3f1a3c072339c548fade8f37ddcb9da16b1c0484e3c6f07d2c66';
/** Its binding over #371's own copy, as #371 recorded it. */
const recordedBy371 =
  'b990aa104514082b57cfb9264e4d662be55ae6de88b925fa679a861d22997bfd';
const frozenFixtures = ({
  copy = urglinBefore370,
  owner = frozenUrglin,
}: { copy?: PreviewEntry; owner?: PreviewEntry } = {}): BatchFixture[] => [
  {
    batch: 'traits-371',
    ownedKeys: new Set([turtlebackFerry]),
    files: [
      {
        path: frozenSnapshotPath,
        entries: frozen371.map((entry) =>
          entry.externalKey === urglin.externalKey ? copy : entry,
        ),
      },
    ],
  },
  {
    batch: 'traits-370',
    ownedKeys: new Set([urglin.externalKey]),
    files: [{ path: frozenSnapshotPath, entries: [owner] }],
  },
];
const frozenAssessments = [
  { externalKey: turtlebackFerry, contentFingerprint: reboundBy370 },
];
/**
 * The check's problems for the frozen batches. They strip none of the listed
 * dangling links, which the committed fixtures account for.
 */
const checkFrozen = ({
  batchFixtures,
  accepted = [],
}: {
  batchFixtures: readonly BatchFixture[];
  accepted?: readonly AcceptedStaleBinding[];
}) =>
  checkCrossBatchBindings({
    fixtures: batchFixtures,
    assessments: frozenAssessments,
    acceptedStale: accepted,
    uncoveredBatches: [],
  }).filter((line) => !line.endsWith('Remove it from the dangling links.'));

describe('cross-batch content bindings (#756)', () => {
  it('passes on the committed batches, with the accepted stale bindings and uncovered batches', () => {
    expect(check(fixtures)).toEqual([]);
  });

  it('checks #738 full-context roots against governing owners and rejects Dispel Evil drift', () => {
    const root = 'pf1/3lgy3s4h4087ojht'; // Dispel Chaos
    const dependency = 'pf1/sg3eq6xpsum65fgm'; // Dispel Evil, governing spell
    const supplement = 'tests/fixtures/spell-bindings-738/full-context.json';
    expect(
      fixtures
        .find((fixture) => fixture.batch === 'spells-519')
        ?.files.some(
          (file) =>
            file.path === supplement &&
            file.entries.some((entry) => entry.externalKey === root),
        ),
    ).toBe(true);
    expect(staleFor(fixtures, root)).toEqual([]);
    const changed = withEntry({
      batch: 'spells-540',
      filename: 'preview.json',
      externalKey: dependency,
      update: (entry) => ({
        ...entry,
        description: `${entry.description}<p>Owner correction.</p>`,
      }),
    });
    expect(staleFor(changed, root)).toContainEqual(
      expect.objectContaining({
        batch: 'spells-519',
        fixture: supplement,
        changedKeys: [dependency],
        changedBy: ['spells-540'],
      }),
    );
    expect(
      check(changed).some(
        (problem) => problem.includes(root) && problem.includes(dependency),
      ),
    ).toBe(true);
  });

  it('keeps #738 supplement roots subordinate to their own owner and requires their full closure', () => {
    const root = 'pf1/3lgy3s4h4087ojht'; // Dispel Chaos, #519
    const dependency = 'pf1/sg3eq6xpsum65fgm'; // Dispel Evil
    const supplement = 'tests/fixtures/spell-bindings-738/full-context.json';
    const changedRoot = withEntry({
      batch: 'spells-519',
      filename: 'preview.json',
      externalKey: root,
      update: (entry) => ({
        ...entry,
        description: `${entry.description}<p>Owner correction.</p>`,
      }),
    });
    expect(staleFor(changedRoot, root)).toContainEqual(
      expect.objectContaining({
        fixture: supplement,
        changedKeys: [root],
        changedBy: ['spells-519'],
      }),
    );
    const missingDependency = fixtures.map((fixture) =>
      fixture.batch !== 'spells-519'
        ? fixture
        : {
            ...fixture,
            files: fixture.files.map((file) =>
              file.path !== supplement
                ? file
                : {
                    ...file,
                    entries: file.entries.filter(
                      (entry) => entry.externalKey !== dependency,
                    ),
                  },
            ),
          },
    );
    const uncovered = (batchFixtures: readonly BatchFixture[]) =>
      findUncoveredBatches({ fixtures: batchFixtures, assessments }).find(
        (row) => row.batch === 'spells-519',
      )?.externalKeys ?? [];
    expect(uncovered(fixtures)).not.toContain(root);
    expect(uncovered(missingDependency)).toContain(root);
  });

  it('requires a governing owner copy for every #738 supplement dependency', () => {
    const key = 'pf1/sg3eq6xpsum65fgm'; // Dispel Evil
    const missingOwner = fixtures.map((fixture) =>
      fixture.batch !== 'spells-540'
        ? fixture
        : {
            ...fixture,
            files: fixture.files.map((file) => ({
              ...file,
              entries: file.entries.filter(
                (entry) => entry.externalKey !== key,
              ),
            })),
          },
    );
    expect(check(missingOwner)).toContainEqual(
      expect.stringContaining(
        `tests/fixtures/spell-bindings-738/full-context.json: ${key} has no governing owner fixture`,
      ),
    );
  });

  it('names the stale assessment, its bindings and the batch whose curation changed its closure', () => {
    // With #370's Urglin in #371's copy, the closure binds as #370 re-bound it.
    expect(
      checkFrozen({ batchFixtures: frozenFixtures({ copy: frozenUrglin }) }),
    ).toEqual([]);
    const before370 = frozenFixtures();
    expect(
      findStaleCrossBatchBindings({
        fixtures: before370,
        assessments: frozenAssessments,
      }),
    ).toEqual([
      {
        batch: 'traits-371',
        fixture: frozenSnapshotPath,
        externalKey: turtlebackFerry,
        name: 'Regional Recluse - Turtleback Ferry (Varisia)',
        changedBy: ['traits-370'],
        changedKeys: [urglin.externalKey],
        recordedFingerprint: reboundBy370,
        fixtureFingerprint: recordedBy371,
        currentFingerprint: reboundBy370,
      },
    ]);
    expect(checkFrozen({ batchFixtures: before370 })).toEqual([
      `traits-371: Regional Recluse - Turtleback Ferry (Varisia) (${turtlebackFerry}) is bound to ${reboundBy370}, but traits-370 has since curated ${urglin.externalKey} in its closure (${frozenSnapshotPath}). Update the fixture copy and re-bind the assessment.`,
    ]);
  });

  it('fails when an accepted stale binding drifts further', () => {
    // Accept Turtleback Ferry's stale binding as it stood before #370.
    const accepted: AcceptedStaleBinding = {
      batch: 'traits-371',
      name: 'Regional Recluse - Turtleback Ferry (Varisia)',
      externalKey: turtlebackFerry,
      changedBy: ['traits-370'],
      changedKeys: [urglin.externalKey],
      recordedFingerprint: reboundBy370,
      currentFingerprint: reboundBy370,
    };
    expect(
      checkFrozen({ batchFixtures: frozenFixtures(), accepted: [accepted] }),
    ).toEqual([]);
    // #370's Urglin changes again.
    const drifted = frozenFixtures({
      owner: { ...frozenUrglin, modifiers: frozenUrglin.modifiers.slice(1) },
    });
    const problems = checkFrozen({
      batchFixtures: drifted,
      accepted: [accepted],
    });
    expect(problems).toHaveLength(2);
    for (const line of problems) expect(line).toContain(turtlebackFerry);
  });

  it('re-binds with an owner’s changed description text', () => {
    // Only stripped catalog links are normalized; other description text
    // reaches the fingerprint.
    const changed = withEntry({
      ...urglin,
      update: (entry) => ({
        ...entry,
        description: entry.description.replace('Urglin', 'Urglin (revised)'),
      }),
    });
    const [stale] = staleFor(changed, turtlebackFerry);
    expect(stale?.changedBy).toEqual(['traits-370']);
    expect(stale?.currentFingerprint).not.toBe(stale?.fixtureFingerprint);
  });

  it('compares every field curation writes: Modifiers, Notes, Item Ability source keys and diagnostics', () => {
    const changes: ((entry: PreviewEntry) => PreviewEntry)[] = [
      (entry) => ({ ...entry, modifiers: entry.modifiers.slice(1) }),
      (entry) => ({ ...entry, situationalNotes: [] }),
      (entry) => ({ ...entry, sourceKey: 'pf1/O0jbkTJcIji9BNiF' }),
      (entry) => ({
        ...entry,
        unsupported: [
          ...entry.unsupported,
          { field: 'curation.mechanics', reason: 'Review the Orc option.' },
        ],
      }),
    ];
    for (const update of changes)
      expect(
        staleFor(withEntry({ ...urglin, update }), turtlebackFerry).map(
          (row) => row.changedBy,
        ),
      ).toEqual([['traits-370']]);
  });

  it('ignores the description links a bounded import strips', () => {
    // #517's bounded Magic Circle against Evil lacks the catalog links #521's
    // full-context copy has, and reports each stripped link.
    const magicCircle = {
      batch: 'spells-517',
      filename: 'preview.json',
      externalKey: 'pf1/1i8b1v3dngkxj6jp',
    };
    const fullContext = fixtureEntry({
      ...magicCircle,
      batch: 'spells-521',
      filename: 'binding-preview.json',
    });
    const bounded = fixtureEntry(magicCircle);
    expect(fullContext.description).toContain('href="catalog:');
    expect(bounded.description).not.toContain('href="catalog:');
    expect(
      bounded.unsupported.some((issue) => issue.field === 'description.link'),
    ).toBe(true);
    const changing = (batchFixtures: readonly BatchFixture[]) =>
      findStaleCrossBatchBindings({ fixtures: batchFixtures, assessments })
        .filter((row) => row.changedKeys.includes(magicCircle.externalKey))
        .map((row) => row.batch);
    expect(changing(fixtures)).toEqual([]);
    // A curated Note on #517's entry does change #521's binding.
    const curated = withEntry({
      ...magicCircle,
      update: (entry) => ({
        ...entry,
        situationalNotes: (entry.situationalNotes ?? []).slice(1),
      }),
    });
    expect(changing(curated)).toContain('spells-521');
  });

  it('ignores a label-less description link a bounded import strips to "Reference unavailable"', () => {
    // #517's bounded Summon Monster III names Summon Monster I through a
    // label-less link, which it strips to "Reference unavailable"; #397's
    // full-corpus copy resolves it to the spell's name. Variant Aasimar
    // Abilities' binding over that copy is current.
    const summon = {
      batch: 'spells-517',
      filename: 'preview.json',
      externalKey: 'pf1/1zmn8vqy3s5l9kiv',
    };
    const fullContext = fixtureEntry({
      ...summon,
      batch: 'racial-traits-397',
    });
    expect(fixtureEntry(summon).description).toContain(
      'functions like Reference unavailable,',
    );
    expect(fullContext.description).toContain('>Summon Monster I</a>,');
    const variant = 'pf1-content/ZW41vB78wXvRWWfs';
    expect(staleFor(fixtures, variant)).toEqual([]);
    // Any other change to the description is still a change.
    const reworded = withEntry({
      ...summon,
      update: (entry) => ({
        ...entry,
        description: entry.description.replace('3rd-level', '4th-level'),
      }),
    });
    expect(staleFor(reworded, variant).map((row) => row.changedBy)).toEqual([
      ['spells-517'],
    ]);
  });

  it('tells a race imported with fewer Racial Traits (#719) apart from a curation change', () => {
    // #524's full-context Dwarf lists all its Racial Traits, which carry its
    // mechanics; #328's bounded Dwarf lists only its ability score trait and
    // keeps them. Fey Boon's binding over the full-context Dwarf is current.
    const dwarf = {
      batch: 'races-328',
      filename: 'preview.json',
      externalKey: 'pf1/nEltI9y37rKJTeWo',
    };
    const fullContext = fixtureEntry({
      ...dwarf,
      batch: 'spells-524',
      filename: 'binding-preview.json',
    });
    expect(fixtureEntry(dwarf).modifiers).not.toHaveLength(0);
    expect(fullContext.modifiers).toEqual([]);
    const feyBoon = 'pf1/JYgzYISWlo5CQQg3';
    expect(staleFor(fixtures, feyBoon)).toEqual([]);
    // The same Racial Traits with other mechanics is a change.
    const sameTraits = withEntry({
      ...dwarf,
      update: (entry) => ({ ...entry, detail: fullContext.detail }),
    });
    expect(staleFor(sameTraits, feyBoon).map((row) => row.changedBy)).toEqual([
      ['races-328'],
    ]);
  });

  it('compares an alternate Racial Trait’s replacements, which #721 resolves through curation', () => {
    // #371's Carnation Scales (Kobold) covers Day Raider, which replaces the
    // kobold's Darkvision and Light Sensitivity. An owner whose replacements
    // differ changes its binding. #396 owns Day Raider now; the in-memory
    // owner stands in for it.
    const dayRaider = fixtureEntry({
      batch: 'traits-371',
      filename: 'preview.json',
      externalKey: 'pf1-content/VIBm0jH0Xerz1xxp',
    });
    if (dayRaider.detail.kind !== 'racialTrait') throw new Error('Day Raider');
    const owner: BatchFixture = {
      batch: 'racial-traits-721',
      ownedKeys: new Set([dayRaider.externalKey]),
      files: [
        {
          path: 'in memory',
          entries: [
            { ...dayRaider, detail: { ...dayRaider.detail, replaces: [] } },
          ],
        },
      ],
    };
    const changed = findStaleCrossBatchBindings({
      fixtures: [
        ...fixtures.filter(
          (fixture) => !fixture.ownedKeys.has(dayRaider.externalKey),
        ),
        owner,
      ],
      assessments,
    }).filter((row) => row.changedKeys.includes(dayRaider.externalKey));
    expect(
      changed.map(({ batch, name, changedBy }) => ({ batch, name, changedBy })),
    ).toEqual([
      {
        batch: 'traits-371',
        name: 'Carnation Scales (Kobold)',
        changedBy: ['racial-traits-721'],
      },
    ]);
  });

  it('fails on a batch whose fixtures don’t commit its closures', () => {
    // #371 committed as a bounded preview, without its closure.
    const bounded = fixtures.map((fixture) =>
      fixture.batch !== 'traits-371'
        ? fixture
        : {
            ...fixture,
            files: fixture.files.map((file) => ({
              ...file,
              entries: file.entries.filter((entry) =>
                fixture.ownedKeys.has(entry.externalKey),
              ),
            })),
          },
    );
    const uncovered = findUncoveredBatches({ fixtures: bounded, assessments });
    expect(uncovered.map((row) => row.batch)).toEqual(
      [...uncoveredBatches, 'traits-371'].sort(),
    );
    expect(
      uncovered.find((row) => row.batch === 'traits-371')?.externalKeys,
    ).toContain(turtlebackFerry);
    expect(check(bounded)).toEqual([
      expect.stringMatching(
        /^traits-371: \d+ assessments' content closures aren't committed/,
      ),
    ]);
    // A batch with no fixture fails the same way.
    const missing = fixtures.map((fixture) =>
      fixture.batch === 'traits-371' ? { ...fixture, files: [] } : fixture,
    );
    expect(check(missing)).toEqual([
      expect.stringMatching(/^traits-371: 99 assessments' content closures/),
    ]);
  });

  it('counts each stripped catalog link as a dependency, whatever else the file holds', () => {
    // #517's bounded preview stripped its links to other spells. An unrelated
    // copy of #370's Urglin added to it doesn't commit them.
    const keysOf = (batchFixtures: readonly BatchFixture[]) =>
      findUncoveredBatches({ fixtures: batchFixtures, assessments }).find(
        (row) => row.batch === 'spells-517',
      )?.externalKeys;
    const withUnrelatedCopy = fixtures.map((fixture) =>
      fixture.batch !== 'spells-517'
        ? fixture
        : {
            ...fixture,
            files: fixture.files.map((file) => ({
              ...file,
              entries: [...file.entries, fixtureEntry(urglin)],
            })),
          },
    );
    expect(keysOf(fixtures)).toHaveLength(25);
    expect(keysOf(withUnrelatedCopy)).toEqual(keysOf(fixtures));
  });

  it('rejects a batch inventory or fixture preview without its expected arrays', () => {
    const root = mkdtempSync(join(tmpdir(), 'cross-batch-'));
    const write = (path: string, data: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(data));
    };
    try {
      const preview = { entries: [frozenUrglin] };
      write('scripts/catalog/legal/traits-371.json', {
        candidates: [{ externalKey: urglin.externalKey }],
      });
      write('tests/fixtures/traits-371/preview.json', preview);
      expect(loadCommittedBatchFixtures(root)).toHaveLength(1);
      write('tests/fixtures/traits-371/preview.json', { closure: [] });
      expect(() => loadCommittedBatchFixtures(root)).toThrow();
      write('tests/fixtures/traits-371/preview.json', preview);
      write('scripts/catalog/legal/traits-371.json', { candidates: {} });
      expect(() => loadCommittedBatchFixtures(root)).toThrow();
      write('scripts/catalog/legal/traits-371.json', { ticket: 371 });
      expect(() => loadCommittedBatchFixtures(root)).toThrow();
      // A notice review before #286 inventories no content.
      write('scripts/catalog/legal/traits-371.json', {
        candidates: [{ externalKey: urglin.externalKey }],
      });
      write('scripts/catalog/legal/inherited-notices-264.json', { issue: 264 });
      expect(loadCommittedBatchFixtures(root)).toHaveLength(1);
      // From #286 on, and under any unlisted name, a notice review must
      // carry its candidates.
      for (const name of [
        'inherited-notices-286.json',
        'inherited-notices-999.json',
      ]) {
        write(`scripts/catalog/legal/${name}`, { issue: 286 });
        expect(() => loadCommittedBatchFixtures(root)).toThrow();
        rmSync(join(root, 'scripts/catalog/legal', name));
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
