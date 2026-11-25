'use client';
import { StagedTransfer } from './staged-transfer';
import { TransferForm } from './transfer-form';
import type { UpkeepSections } from './types';
import type { UpkeepEdit } from './upkeep-edits';
import { upkeepStepAnchor } from './source-anchors';
import { IssueNotes, signedGold, Step } from './upkeep-parts';
import { formatGold } from './week-frame/reference-copy';

// Step 5: the staged deposits and withdrawals in order, and the form that
// stages another. Players may stage transfers before the earlier steps are
// resolved; the treasury line only appears once those are known.
export function Deposits({
  transfers,
  edit,
  disabled,
}: {
  transfers: UpkeepSections['transfers'];
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  return (
    <Step
      number={5}
      title="Deposits and withdrawals"
      anchor={upkeepStepAnchor('transfers')}
      status={transfers.status}
      effect={
        transfers.beforeCopper === null || transfers.afterCopper === null
          ? 'Waiting for the steps above'
          : `Treasury ${formatGold(transfers.beforeCopper)} → ${formatGold(transfers.afterCopper)}`
      }
    >
      {transfers.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No deposits or withdrawals this week.
        </p>
      ) : (
        <ul aria-label="Staged transfers" className="space-y-2">
          {transfers.items.map((item) => (
            <StagedTransfer
              key={item.transferId}
              item={item}
              edit={edit}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
      {transfers.adjustments.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {`Table Adjustments apply after the whole week and are not included above: ${transfers.adjustments
            .map((adjustment) =>
              adjustment.operation === 'add'
                ? `${adjustment.label} ${signedGold(adjustment.copper)}`
                : `${adjustment.label}: treasury set to ${formatGold(adjustment.copper)}`,
            )
            .join('; ')}.`}
        </p>
      ) : null}
      <TransferForm edit={edit} disabled={disabled} />
      <IssueNotes issues={transfers.issues} />
    </Step>
  );
}
