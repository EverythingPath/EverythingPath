import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepTransfer } from './types';
import { clearRulesException } from './upkeep-edits';

// Weekly Draft edits behind the Deposits and withdrawals controls. A transfer
// carries no character; its stable identity is created once here, and the
// ordered list changes only through `upkeep_transfer` and its clear.

export function addTransfer(
  direction: UpkeepTransfer['direction'],
  copper: number,
  transferId: string = crypto.randomUUID(),
): WeeklyDraftEdit {
  return {
    kind: 'upkeep_transfer',
    transfer: { transferId, direction, copper },
  };
}

// Removing a transfer also clears the funds ruling recorded for it, so no
// ruling outlives the withdrawal it excused.
export function removeTransfer(transfer: UpkeepTransfer): WeeklyDraftEdit[] {
  const ruling = transfer.fundsException;
  return [
    { kind: 'clear_upkeep_transfer', transferId: transfer.transferId },
    ...(ruling?.reason ? [clearRulesException(ruling.exceptionId)] : []),
  ];
}

export function recordTransferFundsException(
  transfer: UpkeepTransfer,
  reason: string,
): WeeklyDraftEdit | null {
  if (!transfer.fundsException) return null;
  return {
    kind: 'rules_exception',
    exception: {
      exceptionId: transfer.fundsException.exceptionId,
      subjectId: transfer.transferId,
      ruleId: 'upkeep-transfer-funds',
      reason,
    },
  };
}
