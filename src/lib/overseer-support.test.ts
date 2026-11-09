import { expect, test } from 'vitest';
import { threatEventFixture } from '../../tests/rules/threat-event-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from './canonical-weekly-resolution';
import { createMemoryDraftAuthority } from './memory-draft-persistence';
import {
  assignOverseerSupportEdit,
  clearOverseerSupportEdit,
  moveOverseerSupport,
  overseerSupportHolders,
  overseerSupportSource,
  type OverseerSupportSend,
} from './overseer-support';
import type { WeeklyDraft } from './weekly-draft-contract';
import { createDraftPersistence } from './weekly-draft-persistence';

type Device = ReturnType<typeof createDraftPersistence>;

// Sickness twice (the second occurrence has its mandatory Loyalty save), a
// carried Theft with a Loyalty mitigation check, and one Overseer. Support
// starts on the second Sickness, which also records a Sabotage reaction, and
// on the carried Theft's decision.
function week() {
  const { draft, snapshot } = threatEventFixture(90, true);
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  snapshot.characters[0]!.constitution = 16;
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'carried',
        eventType: 'theft',
        startedWeek: draft.week - 1,
        order: 0,
        targets: [],
      },
    ],
  };
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'carried',
      overseerCharacterId: 'pc',
      rolls: { check: roll(20, 12) },
    },
  ];
  const second = draft.event.occurrences.find(
    (event) => event.eventId === 'second',
  )!;
  second.overseerCharacterId = 'pc';
  second.sabotage = { choiceId: 'react' };
  return { draft, snapshot };
}

function supportUse(
  draft: WeeklyDraft,
  snapshot: ReturnType<typeof week>['snapshot'],
) {
  const phases = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  }).phases!;
  const checks = new Map(
    [...phases.event.checks, ...phases.persistent.checks].map((check) => [
      check.checkId,
      check,
    ]),
  );
  return {
    supported: [...checks.values()]
      .filter((check) =>
        check.modifiers.some(
          (modifier) => modifier.source === 'overseer-support',
        ),
      )
      .map((check) => check.checkId),
    refused: [
      ...phases.event.requirements,
      ...phases.persistent.requirements,
    ].filter((code) => code.includes('overseer')),
  };
}

const observed = (device: Device) =>
  overseerSupportSource(device.getSnapshot().observation!.draft!);
const move = (device: Device, to: string | null, send?: OverseerSupportSend) =>
  moveOverseerSupport({
    to,
    characterId: 'pc',
    latest: () => observed(device),
    send: send ?? ((edit) => device.edit(edit)),
  });

async function devices(
  draft: WeeklyDraft,
  snapshot: ReturnType<typeof week>['snapshot'],
) {
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const first = createDraftPersistence(authority.transport);
  const second = createDraftPersistence(authority.transport);
  await Promise.all([first.ready, second.ready]);
  return [first, second] as const;
}

test('[rules.EVT-10.overseer-holders] occurrence and carried-decision selections each read as their event’s holder, and the rules count support once', () => {
  const { draft, snapshot } = week();
  expect(overseerSupportHolders(overseerSupportSource(draft))).toEqual([
    { eventId: 'second', kind: 'occurrence', characterId: 'pc' },
    { eventId: 'carried', kind: 'carried', characterId: 'pc' },
  ]);
  // Two holders: the earlier event keeps the support, the other is refused.
  const use = supportUse(draft, snapshot);
  expect(use.supported).toEqual(['second:sickness']);
  expect(use.refused).toEqual(['carried:mitigation:overseer-already-used']);
});

test('[rules.EVT-10.overseer-edits] clearing and assigning keep every unrelated field of the owning record', () => {
  const { draft } = week();
  const source = overseerSupportSource(draft);
  const second = draft.event.occurrences.find(
    (event) => event.eventId === 'second',
  )!;
  const cleared = clearOverseerSupportEdit(source, 'second');
  // The reaction, check roll and targets stay.
  expect(cleared).toEqual({
    kind: 'event_occurrence',
    occurrence: {
      eventId: 'second',
      origin: second.origin,
      tableRoll: second.tableRoll,
      targets: second.targets,
      rolls: second.rolls,
      sabotage: { choiceId: 'react' },
    },
  });
  expect(assignOverseerSupportEdit(source, 'second', 'pc')).toBe('already');
  expect(assignOverseerSupportEdit(source, 'second', 'npc')).toEqual({
    kind: 'event_occurrence',
    occurrence: {
      eventId: 'second',
      origin: second.origin,
      tableRoll: second.tableRoll,
      targets: second.targets,
      rolls: second.rolls,
      sabotage: { choiceId: 'react' },
      overseerCharacterId: 'npc',
    },
  });
  expect(clearOverseerSupportEdit(source, 'carried')).toEqual({
    kind: 'persistent_decision',
    decision: {
      kind: 'mitigate',
      eventId: 'carried',
      rolls: { check: roll(20, 12) },
    },
  });
  expect(assignOverseerSupportEdit(source, 'carried', 'pc')).toBe('already');
  expect(clearOverseerSupportEdit(source, 'first')).toBeNull();
  // A carried event without a mitigation decision has nowhere to hold it.
  expect(
    assignOverseerSupportEdit({ ...source, decisions: [] }, 'carried', 'pc'),
  ).toBe('unavailable');
});

test('[rules.EVT-10.overseer-move] moving support between Event and Persistent clears the other holders first and applies it once', async () => {
  const { draft, snapshot } = week();
  const [device] = await devices(draft, snapshot);
  const sent: string[] = [];
  const send: OverseerSupportSend = (edit) => {
    sent.push(edit.kind);
    return device.edit(edit);
  };
  expect(await move(device, 'carried', send)).toEqual({
    status: 'done',
    cleared: ['second'],
  });
  expect(sent).toEqual(['event_occurrence']);
  const moved = device.getSnapshot().observation!.draft!;
  expect(overseerSupportHolders(overseerSupportSource(moved))).toMatchObject([
    { eventId: 'carried' },
  ]);
  expect(supportUse(moved, snapshot)).toEqual({
    supported: ['carried:mitigation'],
    refused: [],
  });
  // And back to Event: the decision keeps its roll.
  expect(await move(device, 'second')).toEqual({
    status: 'done',
    cleared: ['carried'],
  });
  const back = device.getSnapshot().observation!.draft!;
  expect(back.persistent.decisions).toEqual([
    { kind: 'mitigate', eventId: 'carried', rolls: { check: roll(20, 12) } },
  ]);
  expect(supportUse(back, snapshot)).toEqual({
    supported: ['second:sickness'],
    refused: [],
  });
  // Turning it off removes it everywhere.
  expect(await move(device, null)).toEqual({
    status: 'done',
    cleared: ['second'],
  });
  expect(overseerSupportHolders(observed(device))).toEqual([]);
  device.dispose();
});

test('[rules.EVT-10.overseer-partial] a refusal between edits stops the move, says where, never records support twice, and retrying finishes it', async () => {
  const { draft, snapshot } = week();
  const [device] = await devices(draft, snapshot);
  const refuse =
    (kind: string): OverseerSupportSend =>
    (edit) =>
      edit.kind === kind ? Promise.resolve('failed') : device.edit(edit);
  // Moving to the second Sickness: the carried Theft's clear is refused, so
  // nothing more is recorded and the Theft keeps its selection.
  expect(await move(device, 'second', refuse('persistent_decision'))).toEqual({
    status: 'failed',
    stage: 'clear',
    eventId: 'carried',
    cleared: [],
  });
  expect(overseerSupportHolders(observed(device))).toMatchObject([
    { eventId: 'second' },
    { eventId: 'carried' },
  ]);
  // Moving to the carried Theft: the Sickness clear is accepted and
  // recording it on the Theft is refused, so support is on neither event.
  await device.edit(clearOverseerSupportEdit(observed(device), 'carried')!);
  expect(await move(device, 'carried', refuse('persistent_decision'))).toEqual({
    status: 'failed',
    stage: 'assign',
    eventId: 'carried',
    cleared: ['second'],
  });
  expect(overseerSupportHolders(observed(device))).toEqual([]);
  // Running the move again resumes it.
  expect(await move(device, 'carried')).toEqual({
    status: 'done',
    cleared: [],
  });
  expect(
    supportUse(device.getSnapshot().observation!.draft!, snapshot),
  ).toEqual({
    supported: ['carried:mitigation'],
    refused: [],
  });
  device.dispose();
});

test('[rules.EVT-10.overseer-concurrent] two devices moving support at once leave it on one event; the refused device retries from fresh facts', async () => {
  const { draft, snapshot } = week();
  const [first, second] = await devices(draft, snapshot);
  const moves = [move(first, 'first'), move(second, 'carried')];
  const results = await Promise.all(moves);
  await Promise.all([first.settled(), second.settled()]);
  expect(results.map((result) => result.status).sort()).toEqual([
    'done',
    'failed',
  ]);
  const holders = overseerSupportHolders(observed(second));
  expect(holders).toHaveLength(1);
  // The unrelated check roll on the second Sickness survives.
  expect(
    observed(first).occurrences.find((event) => event.eventId === 'second')
      ?.rolls?.check,
  ).toEqual(roll(20, 17));
  // Whichever device was refused retries and wins from the newest facts.
  const [loser, target] =
    results[0]!.status === 'failed'
      ? ([first, 'first'] as const)
      : ([second, 'carried'] as const);
  expect((await move(loser, target)).status).toBe('done');
  await Promise.all([first.settled(), second.settled()]);
  expect(overseerSupportHolders(observed(first))).toMatchObject([
    { eventId: target },
  ]);
  expect(
    supportUse(first.getSnapshot().observation!.draft!, snapshot).refused,
  ).toEqual([]);
  first.dispose();
  second.dispose();
});

test('[rules.EVT-10.overseer-interleaved] interleaved moves can record support on two events; the rules still apply it once and flag the other until one is moved', async () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'carried', rolls: { check: roll(20, 12) } },
  ];
  const second = draft.event.occurrences.find(
    (event) => event.eventId === 'second',
  )!;
  delete second.overseerCharacterId;
  const [one, two] = await devices(draft, snapshot);
  // Each device sees no other holder and records its own.
  expect((await move(one, 'second')).status).toBe('done');
  const stale = overseerSupportSource(draft);
  expect(
    await two.edit(assignOverseerSupportEdit(stale, 'carried', 'pc') as never),
  ).toBe('accepted');
  const both = one.getSnapshot().observation!.draft!;
  expect(overseerSupportHolders(overseerSupportSource(both))).toHaveLength(2);
  expect(supportUse(both, snapshot)).toEqual({
    supported: ['second:sickness'],
    refused: ['carried:mitigation:overseer-already-used'],
  });
  expect(await move(two, 'carried')).toEqual({
    status: 'done',
    cleared: ['second'],
  });
  expect(supportUse(two.getSnapshot().observation!.draft!, snapshot)).toEqual({
    supported: ['carried:mitigation'],
    refused: [],
  });
  one.dispose();
  two.dispose();
});
