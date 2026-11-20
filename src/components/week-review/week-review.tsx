'use client';
import { cn } from '~/lib/utils';
import { Adjustments } from './review-adjustments';
import type {
  ReviewItem,
  ReviewMode,
  ReviewSection,
  WeekReviewFacts,
} from './review-facts';
import { Notes } from './review-note-list';
import {
  Chip,
  Frame,
  SectionNumber,
  wrap,
  type WeekReviewCapabilities,
} from './review-parts';
import { Result } from './review-result';

// The one renderer of the six-section week: it draws already-named facts and
// nothing else. With no capabilities it is a read-only record; the live
// Summary hands in the editing controls it wants shown at each seam.

export type { WeekReviewCapabilities };

function Item({
  item,
  mode,
  capabilities,
}: {
  item: ReviewItem;
  mode: ReviewMode;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <li className="min-w-0 space-y-2 py-2">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className={cn('flex-1 basis-40 text-sm', wrap)}>
          {item.title}
          {item.details.length > 0 && (
            <span className="text-muted-foreground">
              {' · '}
              {item.details.join(' · ')}
            </span>
          )}
        </p>
        {item.effects.length > 0 && (
          <ul className="flex max-w-full flex-wrap justify-end gap-1">
            {item.effects.map((effect) => (
              <li key={effect.key} className="min-w-0">
                <Chip>{effect.text}</Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
      {item.missing && (
        <p className="text-muted-foreground text-xs">
          {mode === 'live'
            ? 'No longer part of this week.'
            : 'Its subject is not part of this recorded week.'}
        </p>
      )}
      <Notes notes={item.notes} capabilities={capabilities} />
    </li>
  );
}

function PhaseSection({
  section,
  mode,
  capabilities,
}: {
  section: ReviewSection;
  mode: ReviewMode;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <Frame
      label={`${section.number} ${section.title}`}
      heading={
        <>
          <SectionNumber>{section.number}</SectionNumber>
          {section.title}
        </>
      }
      right={
        section.chips.length > 0 ? (
          <ul className="flex max-w-full flex-wrap gap-1">
            {section.chips.map((chip) => (
              <li key={chip} className="min-w-0">
                <Chip>{chip}</Chip>
              </li>
            ))}
          </ul>
        ) : undefined
      }
    >
      {section.statusText && (
        <p className={cn('text-muted-foreground text-sm', wrap)}>
          {section.statusText}
        </p>
      )}
      {section.items.length > 0 && (
        <ul className="divide-border min-w-0 divide-y">
          {section.items.map((item) => (
            <Item
              key={item.key}
              item={item}
              mode={mode}
              capabilities={capabilities}
            />
          ))}
        </ul>
      )}
    </Frame>
  );
}

export function WeekReviewSections({
  facts,
  capabilities,
}: {
  facts: WeekReviewFacts;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <div className="min-w-0 space-y-4">
      {facts.sections.map((section) => (
        <PhaseSection
          key={section.phase}
          section={section}
          mode={facts.mode}
          capabilities={capabilities}
        />
      ))}
      {facts.unassociated.length > 0 && (
        <Frame label="Unlinked facts" heading="Facts not linked to a phase">
          <Notes notes={facts.unassociated} capabilities={capabilities} />
        </Frame>
      )}
      <Adjustments
        adjustments={facts.adjustments}
        mode={facts.mode}
        capabilities={capabilities}
      />
      <Result result={facts.result} mode={facts.mode} />
    </div>
  );
}
