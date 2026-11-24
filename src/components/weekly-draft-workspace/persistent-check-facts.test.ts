import { expect, test } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import { derivePhaseReadiness } from './phase-readiness';
import { persistentView } from './persistent-facts';

type Carried = WeeklyDraft['context']['carriedEvents'][number];

function facts(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [
      { characterId: 'pc', name: 'Aubrin' },
      { characterId: 'pell', name: 'Pell' },
    ],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  return { source, preview, view: persistentView(draft, source, preview) };
}

const total = (value: number, modifiers: RawRoll['modifiers'] = []) =>
  ({
    diceTotal: value,
    diceCount: 1,
    sides: 20,
    provenance: { kind: 'table' },
    modifiers,
  }) satisfies RawRoll;

function carried(
  eventId: string,
  eventType: Carried['eventType'],
  order = 0,
): Carried {
  return { eventId, eventType, startedWeek: 1, order, targets: [] };
}

// Records every rank boon Upkeep asks for, so its rank change is settled.
function settleUpkeep(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  for (const key of facts(draft, snapshot).preview.phases!.upkeep
    .requirements) {
    const subject = /^(upkeep:boon:.+):acknowledgement$/.exec(key)?.[1];
    if (subject)
      draft.acknowledgements.push({
        acknowledgementId: subject,
        subjectId: subject,
        outcome: 'Recorded',
      });
  }
}

function week(events: Carried[]) {
  const fixture = persistentEventFixture('theft');
  fixture.snapshot.treasuryCopper = 100000;
  fixture.draft.context = { ...fixture.draft.context, carriedEvents: events };
  settleUpkeep(fixture.draft, fixture.snapshot);
  return fixture;
}

const theftAt = (view: ReturnType<typeof persistentView>, id: string) =>
  view.events.find((event) => event.eventId === id)!;

test('[PER-07.theft] Theft names each calculated contribution once, with the Low Morale −2 and counted Overseer support', () => {
  const { draft, snapshot } = week([
    carried('theft', 'theft'),
    carried('morale', 'low_morale', 1),
  ]);
  snapshot.characters[0]!.constitution = 16;
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'theft',
      overseerCharacterId: 'pc',
      rolls: { check: total(15) },
    },
  ];
  const event = theftAt(facts(draft, snapshot).view, 'theft');
  const row = event.theftCheck!.row;
  expect(row).toMatchObject({ label: 'Loyalty check', dc: 20 });
  const labels = row.breakdown.map((entry) => [entry.label, entry.value]);
  expect(labels).toContainEqual(['Low Morale', -2]);
  expect(labels).toContainEqual(['Overseer', 3]);
  expect(labels.filter(([label]) => label === 'Overseer')).toHaveLength(1);
  expect(row.modifier).toBe(
    row.breakdown.reduce((sum, entry) => sum + entry.value, 0),
  );
  expect(row.total).toBe(15 + row.modifier!);
  // Nothing is borrowed from Rivalry's inputs.
  expect(event.rivalryCheck).toBeNull();
});

test('[PER-07.theft-result] a Theft check reads success or failure from the preview and an unattempted one has no result', () => {
  const { draft, snapshot } = week([carried('theft', 'theft')]);
  expect(theftAt(facts(draft, snapshot).view, 'theft').theftCheck).toBeNull();
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'theft',
      rolls: {
        check: total(20, [
          { sourceId: 'custom:x', value: 20, reason: 'Stirring speech' },
        ]),
      },
    },
  ];
  let event = theftAt(facts(draft, snapshot).view, 'theft');
  expect(event.theftCheck!.row).toMatchObject({
    succeeded: true,
    resultText: 'Keeps 90% of this week’s incoming gains. The Theft stays.',
  });
  expect(event.result.text).toBe('Stays · keeps 90% of this week’s gains');
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'theft', rolls: { check: total(1) } },
  ];
  event = theftAt(facts(draft, snapshot).view, 'theft');
  expect(event.theftCheck!.row).toMatchObject({
    succeeded: false,
    resultText: 'Half of this week’s incoming gains are lost as usual.',
  });
  expect(event.result.text).toBe('Stays · Loyalty check failed');
});

test('[PER-07.custom] entered modifiers count once by source; a copy of a calculated source is shown but not added', () => {
  const { draft, snapshot } = week([carried('theft', 'theft')]);
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'theft',
      rolls: {
        check: total(10, [
          { sourceId: 'custom:a', value: 2, reason: 'Stirring speech' },
          { sourceId: 'custom:a', value: 5, reason: 'Stirring speech again' },
          { sourceId: 'officers', value: 4, reason: 'Officers copy' },
        ]),
      },
    },
  ];
  const check = theftAt(facts(draft, snapshot).view, 'theft').theftCheck!;
  expect(check.row.breakdown).toContainEqual({
    source: 'custom:a',
    label: 'Stirring speech',
    value: 2,
  });
  expect(
    check.modifiers.map((entry) => [entry.index, entry.kind, entry.note]),
  ).toEqual([
    [0, 'custom', null],
    [
      1,
      'custom',
      'This source is recorded more than once; only its first entry counts.',
    ],
    [
      2,
      'other',
      'The rules already count this source, so this copy adds nothing.',
    ],
  ]);
});

test('[PER-04.bonus] an available one-use Loyalty bonus is offered and, once recorded, counted and no longer offered', () => {
  const { draft, snapshot } = week([carried('theft', 'theft')]);
  snapshot.bonuses = [
    {
      bonusId: 'rally',
      source: 'Rally banner',
      check: 'loyalty',
      value: 2,
      availableWeek: draft.week,
      consumedWeek: null,
    },
  ] as UpkeepSnapshot['bonuses'];
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'theft', rolls: { check: total(10) } },
  ];
  let check = theftAt(facts(draft, snapshot).view, 'theft').theftCheck!;
  expect(check.bonusChoices).toEqual([
    { sourceId: 'bonus:rally', label: 'Rally banner', value: 2 },
  ]);
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'theft',
      rolls: {
        check: total(10, [
          { sourceId: 'bonus:rally', value: 2, reason: 'Rally banner' },
        ]),
      },
    },
  ];
  check = theftAt(facts(draft, snapshot).view, 'theft').theftCheck!;
  expect(check.bonusChoices).toEqual([]);
  expect(check.modifiers[0]).toMatchObject({
    kind: 'bonus',
    label: 'Rally banner',
    note: null,
  });
  expect(check.row.breakdown).toContainEqual({
    source: 'bonus:rally',
    label: 'Rally banner',
    value: 2,
  });
});

test('[PER-07.treasury] a successful Theft check raises the whole-week treasury and makes a later buyoff affordable', () => {
  const { draft, snapshot } = week([
    carried('theft', 'theft'),
    carried('morale', 'low_morale', 1),
  ]);
  draft.upkeep.treasuryTransfers = [
    { transferId: 'income', direction: 'deposit', copper: 1000 },
  ];
  draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'morale' }];
  // Leave the treasury 200 copper short of the buyoff with half the gains.
  const start = facts(draft, snapshot);
  const cost = start.view.buyoffCostCopper!;
  snapshot.treasuryCopper +=
    cost - 200 - start.preview.phases!.event.outcome.treasuryCopper;
  const halved = facts(draft, snapshot);
  expect(theftAt(halved.view, 'morale').result.text).toBe(
    'Buyoff needs a Rules Exception',
  );
  expect(halved.view.events[1]!.requirements).toContain(
    'morale:treasury:exception',
  );
  draft.persistent.decisions.push({
    kind: 'mitigate',
    eventId: 'theft',
    rolls: {
      check: total(20, [
        { sourceId: 'custom:speech', value: 20, reason: 'Stirring speech' },
      ]),
    },
  });
  const kept = facts(draft, snapshot);
  expect(theftAt(kept.view, 'theft').theftCheck!.row.succeeded).toBe(true);
  // 90% instead of 50% of the 1000 copper deposit.
  expect(
    kept.preview.phases!.event.outcome.treasuryCopper -
      halved.preview.phases!.event.outcome.treasuryCopper,
  ).toBe(400);
  expect(theftAt(kept.view, 'morale').result.text).toBe(
    `Ends · buyoff ${cost / 100} gp`,
  );
  expect(kept.preview.phases!.persistent.outcome.treasuryCopper).toBe(
    cost + 200 - cost,
  );
});

test('[PER-07.repeated] with two Thefts, one successful check keeps its event but the gains stay halved until both succeed', () => {
  const { draft, snapshot } = week([
    carried('first', 'theft'),
    carried('second', 'theft', 1),
  ]);
  draft.upkeep.treasuryTransfers = [
    { transferId: 'income', direction: 'deposit', copper: 1000 },
  ];
  const success = total(20, [
    { sourceId: 'custom:speech', value: 20, reason: 'Stirring speech' },
  ]);
  const none = facts(draft, snapshot).preview.phases!.event.outcome
    .treasuryCopper;
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'first', rolls: { check: success } },
  ];
  let { view, preview } = facts(draft, snapshot);
  expect(theftAt(view, 'first').result.text).toBe(
    'Stays · check succeeded · another Theft still halves gains',
  );
  expect(theftAt(view, 'first').theftCheck!.row.resultText).toBe(
    'This Theft keeps 90%, but Theft · Event 2 still takes half of this week’s gains.',
  );
  expect(preview.phases!.event.outcome.treasuryCopper).toBe(none);
  draft.persistent.decisions.push({
    kind: 'mitigate',
    eventId: 'second',
    rolls: { check: success },
  });
  ({ view, preview } = facts(draft, snapshot));
  expect(view.events.map((event) => event.result.text)).toEqual([
    'Stays · keeps 90% of this week’s gains',
    'Stays · keeps 90% of this week’s gains',
  ]);
  expect(preview.phases!.event.outcome.treasuryCopper).toBe(none + 400);
});

test('[PER-10.dice] a missing check die is one decision in the section and in This phase', () => {
  const { draft, snapshot } = week([
    carried('theft', 'theft'),
    {
      ...carried('rivalry', 'rivalry', 1),
      targets: [
        { kind: 'team', teamId: 'team' },
        { kind: 'team', teamId: 'second-team' },
      ],
    },
  ]);
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'theft' },
    {
      kind: 'mitigate',
      eventId: 'rivalry',
      officerCheck: { characterId: 'pc', skill: 'bluff', skillBonus: 0 },
    },
  ];
  const { view, source, preview } = facts(draft, snapshot);
  expect(theftAt(view, 'theft').requirements).toEqual([
    'theft:mitigation:1d20',
  ]);
  expect(theftAt(view, 'rivalry').requirements).toEqual([
    'rivalry:officer:1d20',
  ]);
  const persistent = derivePhaseReadiness(draft, source, preview).phases.find(
    (item) => item.phase === 'persistent',
  )!;
  expect(persistent.requirements.map((item) => item.id)).toEqual([
    'theft:mitigation:1d20',
    'rivalry:officer:1d20',
  ]);
});

function rivalryWeek() {
  const fixture = week([
    {
      ...carried('rivalry', 'rivalry'),
      targets: [
        { kind: 'team', teamId: 'team' },
        { kind: 'team', teamId: 'second-team' },
      ],
    },
  ]);
  fixture.snapshot.characters.push({
    ...fixture.snapshot.characters[0]!,
    characterId: 'pell',
  });
  fixture.snapshot.roster.people.push({
    characterId: 'pell',
    kind: 'pc',
    hitDice: 4,
  } as UpkeepSnapshot['roster']['people'][number]);
  return fixture;
}

test.each(['diplomacy', 'bluff', 'intimidate'] as const)(
  '[PER-07.rivalry.%s] the officer check adds only the skill bonus and entered modifiers',
  (skill) => {
    const { draft, snapshot } = rivalryWeek();
    draft.persistent.decisions = [
      {
        kind: 'mitigate',
        eventId: 'rivalry',
        officerCheck: {
          characterId: 'pc',
          skill,
          skillBonus: 11,
          roll: total(7, [
            { sourceId: 'custom:inspired', value: 2, reason: 'Inspired' },
            { sourceId: 'pc', value: 5, reason: 'A copy of the character' },
          ]),
        },
      },
    ];
    const event = facts(draft, snapshot).view.events[0]!;
    expect(event.rivalryCheck).toMatchObject({
      characterId: 'pc',
      skill,
      skillBonus: 11,
      modifier: 13,
      total: 20,
      succeeded: true,
      resultText: 'Ends the Rivalry for good.',
      breakdown: [
        { source: 'skill-bonus', label: 'Skill bonus', value: 11 },
        { source: 'custom:inspired', label: 'Inspired', value: 2 },
      ],
      notOfficer: false,
      unavailable: false,
    });
    expect(event.rivalryCheck!.modifiers[1]!.note).not.toBeNull();
    expect(event.result.text).toBe('Ends · officer check succeeded');
    expect(event.theftCheck).toBeNull();
  },
);

test('[PER-07.rivalry-bonus] a zero or negative skill bonus is valid, an empty one is incomplete', () => {
  const { draft, snapshot } = rivalryWeek();
  const decide = (skillBonus: number | undefined) => {
    draft.persistent.decisions = [
      {
        kind: 'mitigate',
        eventId: 'rivalry',
        officerCheck: {
          characterId: 'pc',
          skill: 'intimidate',
          ...(skillBonus === undefined ? {} : { skillBonus }),
          roll: total(19),
        },
      },
    ];
    return facts(draft, snapshot).view.events[0]!;
  };
  expect(decide(0).rivalryCheck).toMatchObject({
    modifier: 0,
    total: 19,
    succeeded: false,
    resultText:
      'The Rivalry stays. Another officer check can be tried next week.',
  });
  expect(decide(0).result.text).toBe('Stays · officer check failed');
  expect(decide(-2).rivalryCheck).toMatchObject({ modifier: -2, total: 17 });
  const empty = decide(undefined);
  expect(empty.rivalryCheck).toMatchObject({
    skillBonus: null,
    modifier: null,
    total: null,
    required: { skillBonus: true },
  });
  expect(empty.requirements).toContain('rivalry:skill-bonus');
});

test('[PER-07.rivalry-officer] a non-officer needs the officer-assignment exception and an unavailable character is repairable', () => {
  const { draft, snapshot } = rivalryWeek();
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'rivalry',
      officerCheck: {
        characterId: 'pell',
        skill: 'diplomacy',
        skillBonus: 5,
        roll: total(18),
      },
    },
  ];
  let event = facts(draft, snapshot).view.events[0]!;
  expect(event.rivalryCheck!.characters).toEqual([
    { value: 'pc', label: 'Aubrin · Overseer', officer: true, available: true },
    {
      value: 'pell',
      label: 'Pell · not an officer',
      officer: false,
      available: true,
    },
  ]);
  expect(event.rivalryCheck!.notOfficer).toBe(true);
  expect(event.requirements).toContain('rivalry:officer-assignment:exception');
  expect(event.rivalryCheck!.total).toBeNull();
  draft.rulesExceptions.push({
    exceptionId: 'persistent:rivalry:officer-assignment',
    subjectId: 'rivalry',
    ruleId: 'officer-assignment',
    reason: 'Pell leads the negotiation.',
  });
  event = facts(draft, snapshot).view.events[0]!;
  expect(event.rivalryCheck).toMatchObject({ total: 23, succeeded: true });
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'rivalry',
      officerCheck: { characterId: 'gone', skill: 'diplomacy', skillBonus: 5 },
    },
  ];
  event = facts(draft, snapshot).view.events[0]!;
  expect(event.rivalryCheck).toMatchObject({
    unavailable: true,
    required: { character: true },
  });
  expect(event.rivalryCheck!.characters[0]).toEqual({
    value: 'gone',
    label: 'Unavailable character',
    officer: false,
    available: false,
  });
});

test('[PER-04.retained] recorded fields the check does not use stay listed, and Rivalry keeps its two team targets', () => {
  const { draft, snapshot } = rivalryWeek();
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'rivalry',
      overseerCharacterId: 'pc',
      rolls: { check: total(12) },
    },
  ];
  const event = facts(draft, snapshot).view.events[0]!;
  expect(event.retained.map((entry) => [entry.field, entry.value])).toEqual([
    ['rolls', 'roll 12'],
    ['overseerCharacterId', 'adds nothing to a skill check'],
  ]);
  expect(event.targetNames).toHaveLength(2);
});
