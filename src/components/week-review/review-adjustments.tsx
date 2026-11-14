import type { ReviewAdjustment, ReviewMode } from './review-facts';
import { Notes } from './review-note-list';
import {
  Chip,
  Frame,
  Quoted,
  SectionNumber,
  type WeekReviewCapabilities,
} from './review-parts';

function AdjustmentArticle({
  adjustment,
  index,
  capabilities,
}: {
  adjustment: ReviewAdjustment;
  index: number;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <article
      aria-label={`Adjustment ${adjustment.number}`}
      className="min-w-0 space-y-2 border p-3"
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground font-mono text-sm">
          {adjustment.number}
        </span>
        <Chip>{adjustment.effect}</Chip>
        <span className="text-muted-foreground text-xs">{adjustment.kind}</span>
      </p>
      {capabilities?.adjustment ? (
        // The live editor owns the reason, so the renderer does not repeat it.
        capabilities.adjustment(adjustment, index)
      ) : (
        <Quoted text={adjustment.reason} />
      )}
      <Notes notes={adjustment.notes} capabilities={capabilities} />
    </article>
  );
}

export function Adjustments({
  adjustments,
  mode,
  capabilities,
}: {
  adjustments: ReviewAdjustment[];
  mode: ReviewMode;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <Frame
      label="Table Adjustments"
      heading={
        <>
          <SectionNumber>5</SectionNumber>Table Adjustments
        </>
      }
      right={
        <p className="text-muted-foreground text-xs">
          Applied after the Rules Baseline, in this order.
        </p>
      }
    >
      {adjustments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Table Adjustments. The Final{' '}
          {mode === 'live' ? 'preview' : 'outcome'} equals the Rules Baseline.
        </p>
      ) : (
        <ol className="min-w-0 space-y-2">
          {adjustments.map((adjustment, index) => (
            <li key={adjustment.key} className="min-w-0">
              <AdjustmentArticle
                adjustment={adjustment}
                index={index}
                capabilities={capabilities}
              />
            </li>
          ))}
        </ol>
      )}
      {capabilities?.addAdjustment}
    </Frame>
  );
}
