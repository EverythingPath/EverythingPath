'use client';
import { TriangleAlert } from 'lucide-react';
import { classLabels } from '~/lib/catalog/representative-companion-rules';
import { pointCount } from '~/lib/character-sheet-eidolon-progression';
import { cn } from '~/lib/utils';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import { fieldLabel } from './sheet-parts';

type Pool = EidolonProgressionView['ordinary']['pool'];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';

/** "7 (6 + Archon subtype (4th level) 1)": the total with what the subtype adds. */
function totalLabel(pool: Pool) {
  if (pool.total === null) return 'Unresolved';
  if (pool.bonuses.length === 0) return String(pool.total);
  const base =
    pool.total - pool.bonuses.reduce((sum, bonus) => sum + bonus.points, 0);
  const added = pool.bonuses
    .map((bonus) => `${bonus.label} ${bonus.points}`)
    .join(' + ');
  return `${pool.total} (${base} + ${added})`;
}

function poolLine(pool: Pool) {
  const total = totalLabel(pool);
  const balance =
    pool.remaining === null
      ? null
      : pool.remaining < 0
        ? `${-pool.remaining} over`
        : `${pool.remaining} left`;
  return [`Evolution pool ${total}`, `spent ${pool.spent}`, balance]
    .filter((part) => part !== null)
    .join(' · ');
}

/**
 * The summoner's evolution pool against what the eidolon has spent, and
 * the sources that supply it. Over budget is amber and advisory: every
 * recorded evolution stays listed and counting. A brood eidolon's pool is
 * its allocated share of the brood's points (#419).
 */
export function EidolonEvolutionPool({
  pool,
  isAllocated = false,
}: {
  pool: Pool;
  /** Whether the pool is a share divided from a brood's points. */
  isAllocated?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className={fieldLabel}>Evolution pool</h4>
      <p
        className={cn(
          'flex items-start gap-1.5 font-mono text-sm tabular-nums',
          pool.isOverBudget && 'text-amber-300',
        )}
      >
        {pool.isOverBudget ? (
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
        ) : null}
        {poolLine(pool)}
      </p>
      {isAllocated ? (
        <p className={note}>Allocated from the brood’s evolution points.</p>
      ) : null}
      {pool.sources.length > 0 ? (
        <ul aria-label="Evolution pool sources" className="flex flex-col">
          {pool.sources.map((source) => (
            <li
              key={`${source.sourceKey}/${source.classRuleIdentity}`}
              className="text-sm"
            >
              {source.sourceLabel}: {pointCount(source.points)},{' '}
              {classLabels[source.classRuleIdentity] ??
                source.classRuleIdentity}
            </li>
          ))}
        </ul>
      ) : (
        <p className={note}>No supporting source supplies a pool now.</p>
      )}
    </div>
  );
}
