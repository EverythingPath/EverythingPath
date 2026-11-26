'use client';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { UpkeepTransfer } from './types';
import { clearRulesException, type UpkeepEdit } from './upkeep-edits';
import { IssueNotes, ReasonedDecision, signedGold } from './upkeep-parts';
import {
  recordTransferFundsException,
  removeTransfer,
} from './upkeep-transfer-edits';
import { formatGold } from './week-frame/reference-copy';

// The words for each direction: the staged row's heading, the noun in its
// remove button's label, and the action on the form's toggle.
export const directionCopy = {
  deposit: { row: 'Deposit', noun: 'deposit', action: 'Deposit' },
  withdraw: { row: 'Withdrawal', noun: 'withdrawal', action: 'Withdraw' },
} as const;

export function StagedTransfer({
  item,
  edit,
  disabled,
}: {
  item: UpkeepTransfer;
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const fundsException = item.fundsException;
  const deposit = item.direction === 'deposit';
  const copy = directionCopy[item.direction];
  return (
    <li className="space-y-2 rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {copy.row}
        </span>
        <span className="shrink-0 font-mono text-sm">
          {signedGold(deposit ? item.copper : -item.copper)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${copy.noun} of ${formatGold(item.copper)}`}
          disabled={disabled}
          className="shrink-0"
          onClick={() => {
            for (const e of removeTransfer(item)) edit(e);
          }}
        >
          <X />
        </Button>
      </div>
      {item.theftCopper !== null ? (
        <p className="text-muted-foreground text-sm">
          Theft withholds {formatGold(-item.theftCopper)} of this deposit.
        </p>
      ) : null}
      <IssueNotes issues={item.issues} />
      {fundsException ? (
        <div className="space-y-2 border-l-2 border-amber-500/60 pl-3">
          <p className="text-sm">
            This withdrawal exceeds the available treasury.
          </p>
          <ReasonedDecision
            label="Reason for the rules exception"
            current={fundsException.reason}
            disabled={disabled}
            onSave={(reason) => {
              const e = recordTransferFundsException(item, reason);
              if (e) edit(e);
            }}
            onClear={() =>
              edit(clearRulesException(fundsException.exceptionId))
            }
          />
        </div>
      ) : null}
    </li>
  );
}
