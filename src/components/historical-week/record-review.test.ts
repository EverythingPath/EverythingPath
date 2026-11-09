import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  confirmedWeek,
  deepFreeze,
} from '../../../tests/history/resolution-record-fixtures';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { managerWeek } from '../../../tests/rules/role-aware-officers-fixture';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { canonicalResolutionRecordSchema } from '~/lib/canonical-resolution-record';
import type {
  ResultCell,
  ReviewItem,
  WeekReviewFacts,
} from '~/components/week-review/review-facts';
import {
  ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION,
  prepareCanonicalResolutionRecord,
  projectWeeklyDraft,
  resolveCanonicalWeeklyDraft,
  ROLE_AWARE_OFFICERS_RULESET_VERSION,
} from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { phaseView } from '../weekly-draft-workspace/phase-view';
import { recordWeekReview } from './record-review';

function liveReview(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [
      { characterId: 'pc', name: 'Aubrin' },
      { characterId: 'strategist', name: 'Kasvarina' },
    ],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('summary', draft, source, preview);
  if (view.phase !== 'summary') throw new Error('Expected Summary');
  return view.review;
}

const items = (facts: WeekReviewFacts, index: number) =>
  facts.sections[index]!.items;
const item = (facts: WeekReviewFacts, index: number, title: string) => {
  const found = items(facts, index).find((entry) => entry.title === title);
  if (!found)
    throw new Error(
      `No "${title}" in ${items(facts, index)
        .map((entry) => entry.title)
        .join(', ')}`,
    );
  return found;
};
const notes = (entry: ReviewItem) =>
  entry.notes.map((note) =>
    note.kind === 'warning'
      ? note.message
      : note.kind === 'outcome'
        ? note.text
        : note.reason,
  );
const cellKey = (cell: ResultCell) =>
  cell.kind === 'value' ? `value:${cell.key}` : cell.kind;
const row = (facts: WeekReviewFacts, group: string, label: string) => {
  const found = facts.result.rows.find(
    (entry) => entry.group === group && entry.label === label,
  );
  if (!found) throw new Error(`No ${group} · ${label} row`);
  return found;
};

/** Everything a player can read in the facts, for opaque-identity checks. */
function visibleText(facts: WeekReviewFacts) {
  return [
    ...facts.sections.flatMap((section) => [
      section.title,
      section.statusText ?? '',
      ...section.chips,
      ...section.items.flatMap((entry) => [
        entry.title,
        ...entry.details,
        ...entry.effects.map((effect) => effect.text),
        ...notes(entry),
        ...entry.notes.flatMap((note) =>
          note.kind === 'exception' ? [note.rule] : [],
        ),
      ]),
    ]),
    ...facts.unassociated.map((note) =>
      note.kind === 'warning'
        ? note.message
        : note.kind === 'outcome'
          ? note.text
          : `${note.rule} ${note.reason}`,
    ),
    ...facts.adjustments.flatMap((entry) => [
      entry.kind,
      entry.effect,
      entry.reason,
    ]),
    ...facts.result.rows.flatMap((entry) =>
      [entry.now, entry.baseline, entry.final].map((cell) =>
        cell.kind === 'unavailable' ? (cell.text ?? '') : cell.text,
      ),
    ),
    ...facts.result.rows.flatMap((entry) => [entry.group, entry.label]),
  ].join('\n');
}

describe('[HIST-05] frozen Resolution Record adapter', () => {
  test('[rules.HIST-05.frozen-parity] a confirmed record tells the same six-section story as the live review of the week it recorded', () => {
    const { draft, snapshot, record } = confirmedWeek();
    const live = liveReview(draft, snapshot);
    const frozen = recordWeekReview(record);
    expect(frozen.mode).toBe('record');
    const shape = (facts: WeekReviewFacts) =>
      facts.sections.map((section) => ({
        number: section.number,
        title: section.title,
        status: section.status,
        chips: section.chips,
        // Effect keys name each consequence's subject and plan position.
        effects: section.items.flatMap((entry) =>
          entry.effects.map((effect) => effect.key),
        ),
        outcomes: section.items.flatMap((entry) =>
          entry.notes.flatMap((note) =>
            note.kind === 'outcome' ? [`${entry.key}:${note.text}`] : [],
          ),
        ),
        exceptions: section.items.flatMap((entry) =>
          entry.notes.flatMap((note) =>
            note.kind === 'exception'
              ? [`${entry.key}:${note.exceptionId}:${note.reason}`]
              : [],
          ),
        ),
      }));
    expect(shape(frozen)).toEqual(shape(live));
    expect(
      frozen.adjustments.map(({ notes: _notes, ...entry }) => entry),
    ).toEqual(live.adjustments.map(({ notes: _notes, ...entry }) => entry));
    const messages = (facts: WeekReviewFacts) =>
      facts.adjustments.flatMap((entry) =>
        entry.notes.map((note) =>
          note.kind === 'warning' ? note.message : '',
        ),
      );
    expect(messages(frozen)).toEqual(messages(live));
    // The record keeps the applied adjustment's code; like live, it is shown
    // by the adjustment's quoted reason, not repeated as a warning.
    expect(record.warnings.map((warning) => warning.code)).toContain(
      'adjustment',
    );
    expect(messages(frozen)).toEqual([]);
    expect(frozen.adjustments.map((entry) => entry.reason)).toEqual([
      'The officer was rescued',
    ]);
    // The same Result: rows, and every column's recorded value.
    const columns = (facts: WeekReviewFacts) =>
      facts.result.rows.map((entry) => ({
        key: entry.key,
        now: cellKey(entry.now),
        baseline: cellKey(entry.baseline),
        final: cellKey(entry.final),
        changed: entry.changed,
        finalDiffers: entry.finalDiffers,
      }));
    expect(columns(frozen)).toEqual(columns(live));
    expect(frozen.result).toMatchObject({
      complete: true,
      nextWeek: live.result.nextWeek,
    });
  });

  test('[rules.HIST-05.frozen-names] record-local names, officers at confirmation and recorded week context, with no opaque identities', () => {
    const { record } = confirmedWeek();
    const facts = recordWeekReview(record);
    // A roll retained for a step the recorded plan never ran is not a step.
    expect(items(facts, 0).map((entry) => entry.title)).toEqual([
      'Rescuers',
      'Training attrition',
      'Rank',
      'Treasury deposit',
    ]);
    // The record stores no character names: they stay distinct by number.
    expect(item(facts, 0, 'Treasury deposit').effects).toEqual([
      expect.objectContaining({ text: 'Treasury +7 gp' }),
    ]);
    expect(
      item(facts, 1, 'Slot 1 · Change Officer Role').effects.map((e) => e.text),
    ).toEqual(['Character 1 becomes Ambassador · Character 1 leaves Overseer']);
    // The event's recorded type names it alongside its Event phase label.
    expect(items(facts, 2).map((entry) => entry.title)).toEqual([
      'Event chance',
      'Event 1 · Calm before the Storm',
    ]);
    expect(item(facts, 2, 'Event 1 · Calm before the Storm').details).toEqual([
      'Table roll: dice total 54 (1d100)',
    ]);
    expect(row(facts, 'Officers', 'Ambassador')).toMatchObject({
      now: { kind: 'absent' },
      final: { kind: 'value', text: 'Character 1' },
    });
    expect(row(facts, 'Officers', 'Strategist').now).toMatchObject({
      text: 'Character 2',
    });
    expect(row(facts, 'Next week', 'Operating from')).toMatchObject({
      final: { kind: 'value', text: 'Town' },
    });
    expect(
      row(facts, 'Next week', 'Uneventful-week benefit').now,
    ).toMatchObject({ text: 'No' });
    expect(row(facts, 'Next week', 'Skip first Upkeep').now).toMatchObject({
      text: 'No',
    });
    expect(visibleText(facts)).not.toMatch(
      /\b(rescuers-permission|rescue-done|wand-available|storm|old-event|gear|role-slot|strategist|pc|id-transfer)\b/,
    );
  });

  test('[rules.HIST-05.frozen-rolls] recorded dice totals read exactly as recorded', () => {
    const totals = recordWeekReview(confirmedWeek().record);
    expect(item(totals, 2, 'Event 1 · Calm before the Storm').details).toEqual([
      'Table roll: dice total 54 (1d100)',
    ]);
    expect(
      item(totals, 1, 'Slot 2 · Rescue Character · Rescuers').details[0],
    ).toBe('Check roll: dice total 20 (1d20)');
  });

  test('[rules.HIST-05.record-only] reading never changes the record, and nothing outside the record can change what it shows', () => {
    const { draft, snapshot, record } = confirmedWeek();
    const before = structuredClone(record);
    // The fixture is deeply frozen: any write while reading would throw.
    const facts = recordWeekReview(record);
    expect(record).toEqual(before);
    // The adapter's only input is the record (see the import boundary test):
    // edits to the week's source objects after recording change nothing.
    snapshot.roster.teams[0]!.name = 'Renamed today';
    snapshot.roster.officers = [];
    draft.tableAdjustments = [];
    expect(recordWeekReview(structuredClone(record))).toEqual(facts);
    expect(recordWeekReview.length).toBe(1);
  });
});

// A week confirmed before GM approval was assumed for Spread Propaganda: the
// GM had ruled it impossible and a reasoned exception let it go ahead.
// Resolved through today's engine, then recorded with the version, warning
// and exception it had.
test('[rules.HIST-05.propaganda-permission-version] a record confirmed before assumed propaganda approval keeps its impossible-target exception and warning, read-only', () => {
  const input = foundationWeek(3);
  const snapshot = input.militiaSnapshot;
  snapshot.settlements.push({
    settlementId: 'town',
    name: 'Town',
    reputation: 'Hostile',
    secured: false,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
  snapshot.roster.teams.push({
    teamId: 'voices',
    teamType: 'propagandists',
    name: 'Voices',
    status: 'active',
    managerCharacterId: 'pc',
    rewardCapExempt: false,
    notes: '',
  });
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'sway',
    actionId: 'spread_propaganda',
    teamId: 'voices',
    settlementId: 'town',
    possible: false,
    acknowledgements: [
      {
        acknowledgementId: 'posters',
        subjectId: 'propaganda:sway',
        outcome: 'Posters at dawn',
      },
    ],
    rolls: { check: roll(20, 17) },
  };
  const exception = {
    exceptionId: 'ruled-out',
    subjectId: 'sway',
    ruleId: 'propaganda-impossible',
    reason: 'Disguise changes the situation',
  };
  input.revision.rulesExceptions.push(exception);
  const current = prepareCanonicalResolutionRecord(
    resolveCanonicalWeeklyDraft(input),
    'earlier-record',
  );
  const warning = 'sway:propaganda-impossible';
  expect(current.warnings.map((entry) => entry.message)).not.toContain(warning);
  const record = deepFreeze(
    canonicalResolutionRecordSchema.parse({
      ...current,
      rulesetVersion: ROLE_AWARE_OFFICERS_RULESET_VERSION,
      warnings: [...current.warnings, { code: 'sway', message: warning }],
    }),
  );
  expect(record.rulesetVersion).toBeLessThan(
    ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION,
  );
  const before = structuredClone(record);
  const facts = recordWeekReview(record);
  expect(record).toEqual(before);
  const sway = items(facts, 1).find((entry) =>
    entry.title.includes('Spread Propaganda'),
  )!;
  // History quotes the recorded ruling as it stood; it is not marked
  // obsolete and offers no removal.
  expect(sway.notes).toContainEqual(
    expect.objectContaining({
      kind: 'exception',
      ruleId: 'propaganda-impossible',
      reason: 'Disguise changes the situation',
      obsolete: false,
    }),
  );
  const shown = [
    ...facts.sections.flatMap((section) =>
      section.items.flatMap((entry) => entry.notes),
    ),
    ...facts.unassociated,
  ].filter((note) => note.kind === 'warning');
  expect(shown).toHaveLength(record.warnings.length);
});

// The roster Result rows of a record whose `ally` (level 4) has the given
// Hit Dice override and whose PC keeps an explicit 10.
function recordedHitDice(
  allyHitDice: number | null,
  rulesetVersion = 9,
  racialHitDice = 0,
) {
  const input = managerWeek('npc', true, 16);
  input.militiaSnapshot.roster.people[1]!.hitDice = allyHitDice;
  input.militiaSnapshot.characters[1]!.level = 4;
  input.militiaSnapshot.characters[1]!.racialHitDice = racialHitDice;
  const record = prepareCanonicalResolutionRecord(
    resolveCanonicalWeeklyDraft(input),
    'hit-dice-record',
  );
  return recordWeekReview({ ...record, rulesetVersion })
    .result.rows.filter((entry) => entry.group === 'Roster')
    .flatMap((entry) =>
      entry.now.kind === 'value' && entry.now.text.includes('Hit Dice')
        ? [entry.now.text]
        : [],
    );
}

test('[rules.HIST-05.record-hit-dice] a blank Hit Dice override reads as the record’s own level, and an explicit override wins', () => {
  expect(recordedHitDice(null)).toEqual([
    'Player character · 10 Hit Dice',
    'NPC · 4 Hit Dice',
  ]);
  // An explicit override always wins, and zero stays zero.
  expect(recordedHitDice(7)).toContain('NPC · 7 Hit Dice');
  expect(recordedHitDice(0)).toContain('NPC · 0 Hit Dice');
});

test('frozen roster Hit Dice use the Resolution Record version even when it records racial HD', () => {
  expect(recordedHitDice(null, 9, 3)).toContain('NPC · 4 Hit Dice');
  expect(recordedHitDice(null, 10, 3)).toContain('NPC · 7 Hit Dice');
  expect(recordedHitDice(0, 10, 3)).toContain('NPC · 0 Hit Dice');
});

test('[rules.HIST-05.frozen-boundary] the frozen adapter imports no live store, backend, React or rules resolver', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const files = [
    'record-review.ts',
    'record-artifacts.ts',
    'record-names.ts',
    'record-event-tree.ts',
  ];
  const pattern = /import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/g;
  // Pure shared presentation, structural schemas and static label catalogs.
  const values = new Set([
    '~/lib/canonical-weekly-source',
    '~/lib/weekly-draft-contract',
    '~/lib/militia-event-table',
    '~/lib/ruleset-versions',
    '../weekly-draft-workspace/activity-labels',
    '../weekly-draft-workspace/summary-messages',
  ]);
  for (const file of files) {
    const source = readFileSync(path.join(directory, file), 'utf8');
    for (const match of source.matchAll(pattern)) {
      const typeOnly = match[1] !== undefined;
      const specifier = match[2]!;
      const allowed =
        typeOnly ||
        specifier.startsWith('./') ||
        specifier.startsWith('~/components/week-review/') ||
        values.has(specifier);
      expect(allowed, `${file} imports ${specifier}`).toBe(true);
      for (const forbidden of [
        'convex',
        'store',
        'react',
        'use-',
        'rules-',
        'canonical-weekly-resolution',
        'weekly-draft-workspace/workspace',
      ])
        expect(specifier, `${file} imports ${specifier}`).not.toContain(
          forbidden,
        );
    }
  }
});
