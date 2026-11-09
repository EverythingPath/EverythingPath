import { expect, test } from 'vitest';
import { roll, upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { weekStartFactsSchema } from '~/lib/weekly-draft-contract';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { phaseView } from './phase-view';

// Rank 3, training 15 (stays rank 3), treasury 30 gp; attrition resolved so
// the transfers step is not waiting.
function upkeep(
  arrange: (draft: WeeklyDraft, snapshot: UpkeepSnapshot) => void = () =>
    undefined,
  base = upkeepFixture(),
) {
  const { draft, snapshot } = base;
  snapshot.training = 15;
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  arrange(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Ameiko' }],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('upkeep', draft, source, preview);
  if (view.phase !== 'upkeep' || !view.sections)
    throw new Error('Expected Upkeep sections');
  return { ...view, sections: view.sections };
}

test('[rules.UPK-10.rows] transfers list in staged order without a character', () => {
  const view = upkeep((draft, snapshot) => {
    snapshot.roster.officers = [];
    draft.upkeep.treasuryTransfers = [
      { transferId: 'new', direction: 'deposit', copper: 7 },
      { transferId: 'withdraw', direction: 'withdraw', copper: 500 },
      { transferId: 'zero', direction: 'deposit', copper: 0 },
    ];
  });
  expect(view.sections.transfers).toMatchObject({
    status: 'resolved',
    beforeCopper: 3000,
    afterCopper: 2507,
    adjustments: [],
    issues: [],
    items: [
      {
        transferId: 'new',
        direction: 'deposit',
        copper: 7,
        theftCopper: null,
        fundsException: null,
        issues: [],
      },
      { transferId: 'withdraw', direction: 'withdraw', issues: [] },
      { transferId: 'zero', direction: 'deposit' },
    ],
  });
  expect(view.requirements).toEqual([]);
  expect(view.exceptions).toEqual([]);
});

test('[rules.UPK-09.withdrawal-funds] a withdrawal beyond the running treasury carries its warning and reasoned exception on its own row', () => {
  const overdraft = (draft: WeeklyDraft) => {
    draft.upkeep.treasuryTransfers = [
      { transferId: 'deposit', direction: 'deposit', copper: 100 },
      { transferId: 'withdraw', direction: 'withdraw', copper: 3200 },
    ];
  };
  const open = upkeep(overdraft).sections.transfers;
  expect(open.status).toBe('open');
  expect(open.afterCopper).toBe(-100);
  expect(open.items[0]!.fundsException).toBeNull();
  expect(open.items[1]).toMatchObject({
    fundsException: {
      exceptionId: 'upkeep:upkeep-transfer-funds:withdraw',
      reason: '',
      required: true,
    },
    issues: [
      {
        code: 'transfer:withdraw:funds',
        message:
          'This withdrawal of 32 gp exceeds the available treasury. Record a table ruling to proceed.',
      },
    ],
  });
  const ruled = upkeep((draft) => {
    overdraft(draft);
    draft.rulesExceptions = [
      {
        exceptionId: 'loan',
        subjectId: 'withdraw',
        ruleId: 'upkeep-transfer-funds',
        reason: 'The table approves a loan',
      },
    ];
  }).sections.transfers;
  expect(ruled.status).toBe('resolved');
  expect(ruled.items[1]!.fundsException).toEqual({
    exceptionId: 'loan',
    reason: 'The table approves a loan',
    required: false,
  });
});

test('[rules.UPK-10.theft] the header includes Theft on a deposit, and treasury Table Adjustments are only named', () => {
  const base = upkeepFixture();
  const draft = createWeeklyDraft({
    draftId: base.draft.draftId,
    week: base.draft.week,
    slotIds: [],
    context: weekStartFactsSchema.strip().parse({
      ...base.draft.context,
      carriedEvents: [
        {
          eventId: 'theft',
          eventType: 'theft',
          startedWeek: 39,
          order: 0,
          targets: [],
        },
      ],
    }),
  });
  const view = upkeep(
    (draft, snapshot) => {
      snapshot.roster.teams.push({
        teamId: 'scouts',
        teamType: 'patrons',
        name: 'Scouts',
        status: 'active',
        managerCharacterId: null,
        rewardCapExempt: false,
        notes: '',
      });
      draft.upkeep.treasuryTransfers = [
        { transferId: 'deposit', direction: 'deposit', copper: 501 },
      ];
      draft.tableAdjustments = [
        {
          kind: 'militia_value',
          adjustmentId: 'upkeep-recovery:scouts',
          field: 'treasuryCopper',
          operation: 'add',
          value: -1000,
          reason: 'The healer charged more',
        },
        {
          kind: 'militia_value',
          adjustmentId: 'reward',
          field: 'treasuryCopper',
          operation: 'set',
          value: 9000,
          reason: 'Recounted the chest',
        },
        {
          kind: 'militia_value',
          adjustmentId: 'drill',
          field: 'training',
          operation: 'add',
          value: 1,
          reason: 'Extra drill',
        },
      ];
    },
    { draft, snapshot: base.snapshot },
  );
  expect(view.sections.transfers).toMatchObject({
    beforeCopper: 3000,
    afterCopper: 3251,
    items: [{ transferId: 'deposit', theftCopper: -250 }],
    adjustments: [
      {
        adjustmentId: 'upkeep-recovery:scouts',
        label: 'Scouts recovery price',
        operation: 'add',
        copper: -1000,
      },
      {
        adjustmentId: 'reward',
        label: 'Recounted the chest',
        operation: 'set',
        copper: 9000,
      },
    ],
  });
});

test('[rules.UPK-11.officer-diagnostics] with no officer requirement left, an archived officer still reports its check-bonus warning', () => {
  const view = upkeep((draft, snapshot) => {
    snapshot.characters[0]!.isActive = false;
    snapshot.characters.push({
      ...snapshot.characters[0]!,
      characterId: 'leader',
      isActive: true,
    });
    snapshot.roster.people.push({
      characterId: 'leader',
      kind: 'pc',
      hitDice: 10,
    });
    draft.upkeep.treasuryTransfers = [
      { transferId: 'deposit', direction: 'deposit', copper: 100 },
    ];
  });
  expect(view.warnings).toContain('officer:pc:archived');
  expect(view.sections.general.map((issue) => issue.code)).toEqual([
    'officer:pc:archived',
  ]);
  expect(view.warnings.some((code) => code.startsWith('transfer:'))).toBe(
    false,
  );
});
