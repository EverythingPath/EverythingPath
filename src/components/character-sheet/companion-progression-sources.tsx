'use client';
import { cn } from '~/lib/utils';
import type { CompanionProgressionView } from './character-companion-progression-view-model';
import { chip, fieldLabel, missingChoice } from './sheet-parts';

type Projection = CompanionProgressionView['ordinary'];
type Contribution = Projection['contributions'][number];
/** What the eidolon's projection (#409) shares with the animal's. */
export type ProgressionSourcesView = Pick<
  Projection,
  'contributions' | 'restrictions' | 'sources'
>;

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';

function ContributionRow({
  contribution,
  levelLabel,
}: {
  contribution: Contribution;
  levelLabel: string;
}) {
  const name = contribution.familyLabel;
  // An increase has no class levels of its own: its summary says what it adds.
  const values = !contribution.counting
    ? []
    : contribution.kind === 'increase'
      ? [{ label: levelLabel, value: contribution.effectiveLevel }]
      : [
          { label: `${name} class levels`, value: contribution.classLevels },
          { label: levelLabel, value: contribution.effectiveLevel },
        ];
  return (
    <li
      aria-label={`${contribution.sourceLabel}, ${name}`}
      className="flex flex-col gap-1 py-2"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm">{contribution.sourceLabel}</span>
        <span className={cn(chip, 'text-muted-foreground')}>{name}</span>
        <span
          className={cn(
            chip,
            !contribution.counting && 'text-muted-foreground',
            contribution.counting &&
              contribution.resolution === 'unresolved' &&
              cn('text-muted-foreground', missingChoice),
          )}
        >
          {contribution.valueLabel}
        </span>
        {contribution.isOtherVersion ? (
          <span className={cn(chip, 'text-muted-foreground')}>
            Not counting
          </span>
        ) : null}
      </div>
      {values.length > 0 ? (
        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          {values.map((item) => (
            <div key={item.label} className="flex items-baseline gap-1.5">
              <dt className={fieldLabel}>{item.label}</dt>
              <dd className="font-mono text-sm tabular-nums">
                {item.value ?? 'Unresolved'}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {contribution.allocationSummary ? (
        <p className="text-xs [overflow-wrap:anywhere]">
          {contribution.allocationSummary}
        </p>
      ) : null}
      {contribution.fallbackState === 'suspended' ? (
        <p className={note}>
          Saved fallback is retained; the source value applies.
        </p>
      ) : null}
      {contribution.hasSavedFallback ? (
        <p className={note}>
          Edit or clear the saved fallback under {name} class levels in the
          linked values above.
        </p>
      ) : null}
    </li>
  );
}

/**
 * Where the progression comes from: each granting source with its class
 * levels and what it adds, a lost one listed as Not contributing, then the
 * sources' own restrictions and the published rules they follow.
 */
export function CompanionProgressionSources({
  projection,
  levelLabel = 'Progression',
}: {
  projection: ProgressionSourcesView;
  /** What each source's effective level is called. */
  levelLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <h4 className={fieldLabel}>Granting sources</h4>
        {projection.contributions.length > 0 ? (
          <ul
            aria-label="Granting sources"
            className="divide-foreground/10 divide-y"
          >
            {projection.contributions.map((contribution) => (
              <ContributionRow
                key={`${contribution.sourceKey}/${contribution.classRuleIdentity}`}
                contribution={contribution}
                levelLabel={levelLabel}
              />
            ))}
          </ul>
        ) : (
          <p className={cn(note, 'py-1')}>No granting source counts now.</p>
        )}
      </div>
      {projection.restrictions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className={fieldLabel}>Source restrictions</h4>
          <ul
            aria-label="Source restrictions"
            className="flex list-disc flex-col gap-1 pl-4 text-sm [overflow-wrap:anywhere]"
          >
            {projection.restrictions.map((restriction) => (
              <li key={restriction}>{restriction}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h4 className={fieldLabel}>Rules</h4>
        <ul aria-label="Rules" className="flex flex-col gap-1 text-sm">
          {projection.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="focus-visible:ring-ring/50 inline-flex min-h-11 items-center [overflow-wrap:anywhere] underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-[3px] md:min-h-7"
              >
                {source.book}, pp. {source.pages}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
