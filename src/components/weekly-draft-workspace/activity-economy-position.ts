import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import { prepareEconomy, type EconomyLedger } from '~/lib/rules-economy';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { ActivityPositionFacts } from './types';

// The militia's items and caches as the Activity fold sees them at one slot:
// the post-Upkeep economy, prepared for the Activity (returning caches and
// due market orders arrive), then every item and cache change made by the
// choices in earlier slots. Receipts recorded for later in the Activity are
// not applied, since the rules take them after every slot.
export function economyAtPosition(
  draft: WeeklyDraft,
  preview: CanonicalResolutionPreview,
  index: number,
): ActivityPositionFacts['economy'] {
  const upkeep = preview.phases?.upkeep;
  const projection = preview.phases?.activity;
  if (!upkeep?.outcome.economy || !projection) return null;
  // Preparing touches only the economy, so only it is copied.
  const economy = structuredClone(upkeep.outcome.economy);
  const ledger: EconomyLedger = {
    outcome: { ...upkeep.outcome, economy },
    plan: [],
    requirements: [],
  };
  prepareEconomy(draft, ledger);
  const earlier = new Set(
    draft.activity.slots
      .slice(0, index)
      .flatMap((slot) => (slot.choice ? [slot.choice.choiceId] : [])),
  );
  for (const change of projection.plan) {
    if (!('choiceId' in change) || !earlier.has(change.choiceId)) continue;
    if (change.kind === 'item') {
      const at = economy.items.findIndex(
        (item) => item.itemId === change.after.itemId,
      );
      if (at >= 0) economy.items[at] = { ...change.after };
      else economy.items.push({ ...change.after });
    } else if (change.kind === 'cache') {
      const at = economy.caches.findIndex(
        (cache) => cache.cacheId === change.after.cacheId,
      );
      if (at >= 0) economy.caches[at] = structuredClone(change.after);
      else economy.caches.push(structuredClone(change.after));
    }
  }
  return { items: economy.items, caches: economy.caches };
}
