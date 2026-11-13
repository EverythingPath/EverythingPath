'use client';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import { moveGroupRefusalText, stayingReasonText } from './character-move-copy';
import { chip, fieldLabel } from './sheet-parts';
import type { useCharacterMove } from './use-character-move';

type Movement = ReturnType<typeof useCharacterMove>;

/**
 * Who moves with the requested Character, and who stays and why, as the
 * server previews it (#711): the active same-owner Companions travel as one
 * group, up to the cap; an inactive link, another owner or the Character a
 * Companion belongs to marks where the group ends. Shown before the move is
 * confirmed, beside the destination choice and the leave confirmation. A
 * lone Character with nothing staying has no group to explain. A staying
 * Character the player cannot reach reads only as unavailable, with no
 * link, name or label. To move fewer, a relationship is interrupted first
 * through its own controls; nothing here chooses members.
 */
export function MoveGroupPreview({
  movement,
  className,
}: {
  movement: Movement;
  className?: string;
}) {
  const headingId = useId();
  const preview = movement.groupPreview;
  if (!preview) return null;
  if (preview.refusal)
    return (
      <p
        role="alert"
        className={cn(
          'text-destructive min-w-0 text-xs [overflow-wrap:anywhere]',
          className,
        )}
      >
        {moveGroupRefusalText(preview.refusal)}
      </p>
    );
  const { moving, staying, maxGroupSize } = preview;
  if (moving.length <= 1 && staying.length === 0) return null;
  const stayingHeadingId = `${headingId}-staying`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex min-w-0 flex-col gap-1.5 text-sm', className)}
    >
      <h3 id={headingId} className={fieldLabel}>
        Moving together
      </h3>
      <ul
        aria-labelledby={headingId}
        className="flex flex-wrap items-center gap-1"
      >
        {moving.map((member) => (
          <li
            key={member.characterId}
            className={cn(
              chip,
              'max-w-full font-sans [overflow-wrap:anywhere]',
            )}
          >
            {member.name}
          </li>
        ))}
      </ul>
      {moving.length > 1 ? (
        <p className="text-muted-foreground text-xs">
          Up to {maxGroupSize} Characters move together. To move fewer,
          interrupt a Companion Relationship first.
        </p>
      ) : null}
      {staying.length > 0 ? (
        <>
          <h3 id={stayingHeadingId} className={cn(fieldLabel, 'mt-1')}>
            Staying
          </h3>
          <ul
            aria-labelledby={stayingHeadingId}
            className="divide-foreground/10 flex flex-col divide-y"
          >
            {staying.map((entry, index) => (
              <li
                key={entry.characterId ?? `unavailable-${index}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1"
              >
                <span
                  className={cn(
                    'font-sans [overflow-wrap:anywhere]',
                    entry.name === undefined && 'text-muted-foreground',
                  )}
                >
                  {entry.name ?? 'Character unavailable'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {stayingReasonText[entry.reason]}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
