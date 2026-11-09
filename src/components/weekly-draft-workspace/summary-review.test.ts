import { describe, expect, test } from 'vitest';
import { compoundAcceptanceFixture } from '../../../tests/rules/compound-acceptance-fixture';
import { recurringEventFixture } from '../../../tests/rules/recurring-event-fixture';
import { upkeepFixture, roll } from '../../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { phaseView } from './phase-view';

function review(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  rulesetVersion = 9,
) {
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
  preview.rulesetVersion = rulesetVersion;
  const view = phaseView('summary', draft, source, preview);
  if (view.phase !== 'summary') throw new Error('Expected Summary');
  return { view, preview, facts: view.review };
}
const titles = (facts: ReturnType<typeof review>['facts'], index: number) =>
  facts.sections[index]!.items.map((item) => item.title);
const section = (facts: ReturnType<typeof review>['facts'], index: number) =>
  facts.sections[index]!;
const item = (
  facts: ReturnType<typeof review>['facts'],
  index: number,
  title: string,
) => section(facts, index).items.find((entry) => entry.title === title)!;

test.each([
  { rulesetVersion: 9, expected: 'Player character · 10 Hit Dice' },
  { rulesetVersion: 10, expected: 'Player character · 13 Hit Dice' },
])(
  'live result comparison reads its preview version $rulesetVersion',
  ({ rulesetVersion, expected }) => {
    const { draft, snapshot } = upkeepFixture();
    snapshot.roster.people[0]!.hitDice = null;
    snapshot.characters[0]!.racialHitDice = 3;
    const { facts } = review(draft, snapshot, rulesetVersion);
    expect(
      facts.result.rows.find(
        (entry) => entry.group === 'Roster' && entry.label === 'Aubrin',
      )?.now,
    ).toMatchObject({ text: expected });
  },
);

describe('[SUM-10] live six-section consequences', () => {
  test('four expanded phase sections follow rules order with plan-derived chips, check details and item-local facts', () => {
    const { input } = compoundAcceptanceFixture();
    const { facts, preview } = review(input.revision, input.militiaSnapshot);
    expect(preview.status).toBe('ready');
    expect(facts.mode).toBe('live');
    expect(facts.sections.map((entry) => [entry.number, entry.title])).toEqual([
      [1, 'Upkeep'],
      [2, 'Activity'],
      [3, 'Event'],
      [4, 'Persistent'],
    ]);
    expect(facts.sections.every((entry) => entry.status === 'complete')).toBe(
      true,
    );

    // Upkeep: the disabled team's decision and the attrition check, in order.
    expect(titles(facts, 0).slice(0, 2)).toEqual([
      'Rescuers',
      'Training attrition',
    ]);
    expect(item(facts, 0, 'Rescuers').details).toContain('Left disabled');
    const attrition = item(facts, 0, 'Training attrition');
    expect(attrition.details[0]).toMatch(/^Loyalty \d+ vs DC \d+ · /);
    expect(attrition.effects.map((effect) => effect.text)).toEqual([
      'Training −1',
    ]);
    expect(section(facts, 0).chips).toContain('Training −1');

    // Activity: every staged choice in slot order with its own exception and outcome.
    expect(titles(facts, 1)).toEqual([
      'Slot 1 · Change Officer Role',
      'Slot 2 · Rescue Character · Rescuers',
      'Slot 3 · Secure Cache · Spies',
      'Slot 4 · Broker Market · Fixers',
    ]);
    const rescue = item(facts, 1, 'Slot 2 · Rescue Character · Rescuers');
    // The resolved rescue check replaces the bare check total: no repeats.
    expect(rescue.details).toEqual([
      expect.stringMatching(
        /^Rescue Aubrin · Check \d+ vs DC \d+ · succeeded$/,
      ),
    ]);
    expect(rescue.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'exception',
          exceptionId: 'rescuers-permission',
          rule: 'Team Condition',
          obsolete: false,
        }),
        expect.objectContaining({
          kind: 'outcome',
          text: 'The officer returns home',
        }),
      ]),
    );
    expect(
      item(facts, 1, 'Slot 4 · Broker Market · Fixers').notes,
    ).toContainEqual(
      expect.objectContaining({
        kind: 'outcome',
        text: 'Wand available in town',
      }),
    );
    expect(
      item(facts, 1, 'Slot 1 · Change Officer Role').effects.map((e) => e.text),
    ).toEqual(['Aubrin becomes Ambassador · Aubrin leaves Overseer']);
    expect(section(facts, 1).chips).toEqual([
      'Treasury −120 gp',
      'Notoriety +10',
    ]);
    // A zero-change plan entry is not shown as a consequence chip.
    expect(
      item(facts, 1, 'Slot 3 · Secure Cache · Spies').effects.map(
        (e) => e.text,
      ),
    ).toEqual(['Supplies updated', 'Cache at Bridge established']);

    // Event opens with the chance, then its occurrence.
    expect(titles(facts, 2)[0]).toBe('Event chance');
    expect(titles(facts, 2)).toHaveLength(2);

    // Persistent: the carried event's buyoff belongs here only once.
    const carried = section(facts, 3).items[0]!;
    expect(carried.details).toContain('Decision: Buyoff');
    expect(carried.effects.map((effect) => effect.text)).toEqual([
      'Treasury −140 gp',
      'Ends',
    ]);
    expect(section(facts, 3).chips).toEqual([
      'Treasury −140 gp',
      '1 event ends',
    ]);
    expect(section(facts, 2).chips).not.toContain('Treasury −140 gp');
    expect(facts.unassociated).toEqual([]);
  });

  test('Table Adjustments are listed in order and the Result compares Now, Rules Baseline and Final from one preview', () => {
    const { input } = compoundAcceptanceFixture();
    const { facts, view, preview } = review(
      input.revision,
      input.militiaSnapshot,
    );
    const applied = input.revision.tableAdjustments.map(
      (entry) => `adjustment:${entry.adjustmentId}:${entry.reason}`,
    );
    expect(applied).toHaveLength(1);
    expect(preview.warnings).toEqual(expect.arrayContaining(applied));
    expect(facts.adjustments).toEqual([
      expect.objectContaining({
        number: 1,
        kind: 'Settlement reputation',
        effect: expect.stringMatching(/ → Friendly$/),
        reason: 'The officer was rescued',
        // Applying it is the table's decision, shown by its reason: the
        // preview's applied code is no warning under it or in Warnings.
        notes: [],
      }),
    ]);
    expect(view.warnings).not.toEqual(expect.arrayContaining(applied));
    expect(facts.result.complete).toBe(true);
    expect(facts.result.nextWeek).toBe(3);
    const training = facts.result.rows.find((row) => row.label === 'Training')!;
    expect(training).toMatchObject({
      now: { text: '55' },
      baseline: { text: '54' },
      final: { text: '54' },
      changed: true,
      finalDiffers: false,
    });
    const town = facts.result.rows.find(
      (row) => row.group === 'Settlements' && !row.label.includes('·'),
    )!;
    expect(town).toMatchObject({
      finalDiffers: true,
      final: { text: 'Friendly' },
    });
    const visible = [
      ...facts.sections.flatMap((entry) => [
        ...entry.chips,
        ...entry.items.flatMap((i) => [
          i.title,
          ...i.details,
          ...i.effects.map((e) => e.text),
          ...i.notes.map((n) =>
            n.kind === 'warning'
              ? n.message
              : n.kind === 'outcome'
                ? n.text
                : `${n.rule} ${n.reason}`,
          ),
        ]),
      ]),
      ...facts.adjustments.flatMap((a) => [a.kind, a.effect, a.reason]),
      ...facts.result.rows.flatMap((row) =>
        [row.group, row.label, row.now, row.baseline, row.final].map((cell) =>
          typeof cell === 'string'
            ? cell
            : cell.kind === 'unavailable'
              ? ''
              : cell.text,
        ),
      ),
    ].join('\n');
    expect(visible).not.toMatch(
      /\b(rescuers-permission|rescue-done|wand-available|storm|old-event|gear|role-slot)\b/,
    );
  });

  test('warnings attach to their subject, keep identical messages separate, and fall back to the phase', () => {
    const { draft, snapshot } = upkeepFixture();
    snapshot.roster.teams = ['a', 'b'].map((teamId) => ({
      teamId,
      teamType: 'spies' as const,
      name: teamId === 'a' ? 'North Spies' : 'South Spies',
      status: 'disabled' as const,
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    }));
    draft.upkeep.teamDecisions = [
      { teamId: 'a', decision: 'recover', costCopper: 1 },
      { teamId: 'b', decision: 'recover', costCopper: 1 },
    ];
    draft.upkeep.rolls = { check: roll(20, 0), training: roll(4, 1, 1) };
    const { facts, view } = review(draft, snapshot);
    const north = item(facts, 0, 'North Spies');
    const south = item(facts, 0, 'South Spies');
    const warning = (entry: typeof north) =>
      entry.notes.filter((note) => note.kind === 'warning');
    expect(warning(north).map((note) => note.key)).toContain(
      'warning:team:a:recovery-cost-baseline',
    );
    expect(warning(south).map((note) => note.key)).toContain(
      'warning:team:b:recovery-cost-baseline',
    );
    expect(view.warnings).toContain('upkeep:attrition:roll-range');
    expect(
      warning(item(facts, 0, 'Training attrition')).map((note) => note.key),
    ).toContain('warning:upkeep:attrition:roll-range');
    // Every live warning appears exactly once in the sections.
    const placed = facts.sections
      .flatMap((entry) => entry.items)
      .flatMap((entry) => entry.notes)
      .filter((note) => note.kind === 'warning')
      .map((note) => note.key)
      .concat(facts.unassociated.map((note) => note.key));
    expect(placed.sort()).toEqual(
      view.warnings.map((code) => `warning:${code}`).sort(),
    );
  });

  test('an obsolete action-allowance exception whose choice is gone stays visible in Activity', () => {
    const { draft, snapshot } = upkeepFixture();
    draft.rulesExceptions = [
      {
        exceptionId: 'old',
        subjectId: 'removed-choice',
        ruleId: 'action-capacity',
        reason: 'An extra day was once allowed',
      },
      {
        exceptionId: 'mystery',
        subjectId: 'unknown-subject',
        ruleId: 'unknown-rule',
        reason: 'Recorded long ago',
      },
    ];
    const { facts } = review(draft, snapshot);
    const orphan = section(facts, 1).items.at(-1)!;
    expect(orphan).toMatchObject({ missing: true });
    expect(orphan.notes).toEqual([
      expect.objectContaining({
        kind: 'exception',
        obsolete: true,
        reason: 'An extra day was once allowed',
      }),
    ]);
    expect(facts.unassociated).toEqual([
      expect.objectContaining({ kind: 'exception', exceptionId: 'mystery' }),
    ]);
  });

  test('a leftover impossible-propaganda exception is obsolete now that GM approval is assumed', () => {
    const { draft, snapshot } = upkeepFixture();
    draft.rulesExceptions = [
      {
        exceptionId: 'ruled-out',
        subjectId: 'removed-propaganda',
        ruleId: 'propaganda-impossible',
        reason: 'The GM once ruled it out',
      },
    ];
    const { facts } = review(draft, snapshot);
    expect(section(facts, 1).items.at(-1)!.notes).toEqual([
      expect.objectContaining({
        kind: 'exception',
        ruleId: 'propaganda-impossible',
        obsolete: true,
        reason: 'The GM once ruled it out',
      }),
    ]);
  });

  test('an incomplete preview keeps partial consequences and never fabricates a Result', () => {
    const { draft, snapshot } = upkeepFixture();
    const { facts, preview } = review(draft, snapshot);
    expect(preview.status).toBe('incomplete');
    expect(section(facts, 0).status).toBe('incomplete');
    expect(section(facts, 0).statusText).toMatch(/partial/);
    expect(facts.result.complete).toBe(false);
    expect(
      facts.result.rows.every(
        (row) =>
          row.baseline.kind === 'unavailable' &&
          row.final.kind === 'unavailable',
      ),
    ).toBe(true);
    expect(section(facts, 3)).toMatchObject({
      status: 'not-applicable',
      items: [],
    });
  });

  test('Event items use the Event phase labels and the chance line follows the resolver', () => {
    const { draft, snapshot } = recurringEventFixture(26, true);
    const { facts } = review(draft, snapshot);
    // A rolled Roll Twice is not itself selected, but an event still occurs.
    expect(item(facts, 2, 'Event chance').details).toEqual([
      'Event chance 10% · roll 1 · an event occurs',
    ]);
    expect(titles(facts, 2)).toEqual([
      'Event chance',
      'Event 1 · Roll Twice',
      'Event 1.1 · High Morale',
      'Event 1.2 · High Morale',
    ]);
    expect(item(facts, 2, 'Event 1.2 · High Morale').details).toContain(
      'Rolled twice from Event 1',
    );
    // All Is Calm from last week replaces the roll instead of awaiting it.
    draft.context = {
      ...draft.context,
      queuedEffects: [
        {
          effectId: 'calm',
          sourceId: 'last-week',
          startsWeek: draft.week,
          endsWeek: draft.week,
          effect: { kind: 'all_is_calm' },
        },
      ],
    };
    expect(
      item(review(draft, snapshot).facts, 2, 'Event chance').details,
    ).toEqual(['Event chance · no roll: All Is Calm makes this a calm week']);
  });

  test('a first militia week shows Upkeep as not applicable', () => {
    const { draft, snapshot } = upkeepFixture();
    draft.context = { ...draft.context, firstMilitiaWeek: true };
    const { facts } = review(draft, snapshot);
    expect(section(facts, 0)).toMatchObject({
      status: 'not-applicable',
      statusText: 'Upkeep is skipped in the militia’s first week.',
      items: [],
    });
  });

  test('[rules.P85.outcome-sources] bonuses and queued effects are named from their source event without opaque identities', () => {
    const { draft, snapshot } = upkeepFixture();
    draft.context = {
      ...draft.context,
      persistentPhaseEligible: true,
      carriedEvents: [
        {
          eventId: 'hidden-event',
          eventType: 'high_morale',
          startedWeek: 39,
          order: 0,
          targets: [],
        },
      ],
      queuedEffects: [
        {
          effectId: 'hidden-effect',
          sourceId: 'hidden-event',
          startsWeek: 40,
          endsWeek: 41,
          effect: { kind: 'narrative', instruction: 'Neighbors supply scouts' },
        },
      ],
    };
    snapshot.bonuses = [
      {
        bonusId: 'hidden-bonus',
        source: 'hidden-event',
        check: 'loyalty',
        value: 2,
        availableWeek: 40,
        consumedWeek: null,
      },
    ];
    const { facts } = review(draft, snapshot);
    const rows = facts.result.rows.map((row) => ({
      label: row.label,
      now: row.now.kind === 'value' ? row.now.text : row.now.kind,
    }));
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          label: 'Loyalty bonus · High Morale · Event 1',
          now: expect.stringContaining('Value: 2'),
        },
        {
          label: 'High Morale · Event 1',
          now: expect.stringContaining('Neighbors supply scouts'),
        },
      ]),
    );
    expect(JSON.stringify(rows)).not.toMatch(/hidden-/);
  });
});
