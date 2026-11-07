'use client';
import { TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { pointCount } from '~/lib/character-sheet-eidolon-progression';
import { cn } from '~/lib/utils';
import type { CompanionAllocationPoolView } from './character-companion-allocations-view-model';
import type { CompanionAllocationsController } from './companion-props';
import { action, chip, fieldLabel, SaveFeedback } from './sheet-parts';

type ComponentPool = Extract<
  CompanionAllocationPoolView,
  { kind: 'component' }
>;
type Purchase = ComponentPool['groupPurchases'][number];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';

function PurchaseRow({
  purchase,
  pool,
  controller,
  reasonId,
}: {
  purchase: Purchase;
  pool: ComponentPool;
  controller: CompanionAllocationsController;
  reasonId: string | undefined;
}) {
  const id = useId();
  const status = controller.statusFor(`${pool.ruleKind}/group/${purchase.key}`);
  const isDisabled = controller.isDisabled || status.kind === 'saving';
  const name = `Buy the ${purchase.label.toLowerCase()} for the brood`;
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Label
          htmlFor={id}
          className={cn(action, 'gap-2 pr-1 text-sm font-normal')}
        >
          <Checkbox
            id={id}
            checked={purchase.purchased}
            aria-label={name}
            aria-describedby={reasonId}
            disabled={isDisabled}
            onCheckedChange={(purchased) =>
              void controller.setGroupPurchase({
                ruleKind: pool.ruleKind,
                key: purchase.key,
                purchased,
              })
            }
          />
          {purchase.label}
        </Label>
        <span className={chip}>{pointCount(purchase.cost)}</span>
        <span className={cn(chip, 'text-muted-foreground')}>
          Summoner level {purchase.minimumLevel}
        </span>
        <SaveFeedback
          status={status}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
      {purchase.purchased
        ? purchase.issues.map((issue) => (
            <p
              key={issue}
              className="flex items-start gap-1.5 text-xs text-amber-300"
            >
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{issue}</span>
            </p>
          ))
        : null}
    </li>
  );
}

/**
 * The purchases made once for the whole brood (#419), such as Larger
 * Brood's large and huge evolutions: one checkbox each with its cost and
 * the summoner level it asks for. A purchase out of order is kept and
 * reads its issues in amber; nothing is removed for the player.
 */
export function CompanionGroupPurchases({
  pool,
  controller,
  reasonId,
}: {
  pool: ComponentPool;
  controller: CompanionAllocationsController;
  reasonId: string | undefined;
}) {
  if (pool.groupPurchases.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className={fieldLabel}>Group purchases</h4>
      <p className={note}>
        Bought once for the whole brood and paid from its evolution points
        before they are divided. They never count as an eidolon’s own evolution.
      </p>
      <ul aria-label="Group purchases" className="flex flex-col gap-1">
        {pool.groupPurchases.map((purchase) => (
          <PurchaseRow
            key={purchase.key}
            purchase={purchase}
            pool={pool}
            controller={controller}
            reasonId={reasonId}
          />
        ))}
      </ul>
    </div>
  );
}
