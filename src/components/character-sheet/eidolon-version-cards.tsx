'use client';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type { EidolonVersion } from '~/lib/character-sheet-eidolon-progression';
import type { useCharacterCompanionProgression } from './use-character-companion-progression';

export type EidolonVersionChoice = ReturnType<
  typeof useCharacterCompanionProgression
>['eidolonVersions'][number];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'flex-col items-start justify-start gap-1 px-3 py-2 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * The eidolon's rules version as two cards side by side, Original and
 * Unchained, each with what it means. The cards stay side by side on the
 * phone. A controlled radio group: the caller decides what a change does.
 */
export function EidolonVersionCards({
  versions,
  value,
  name,
  labelledBy,
  isDisabled,
  reasonId,
  onValueChange,
  onBlur,
}: {
  versions: readonly EidolonVersionChoice[];
  value: EidolonVersion;
  name: string;
  /** The id of the text that names the choice. */
  labelledBy: string;
  isDisabled: boolean;
  reasonId: string | undefined;
  onValueChange: (version: EidolonVersion) => void;
  onBlur?: () => void;
}) {
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      name={name}
      value={value}
      disabled={isDisabled}
      onBlur={onBlur}
      onValueChange={(next) =>
        onValueChange(next === 'unchained' ? 'unchained' : 'original')
      }
      className="grid-cols-2 gap-2"
    >
      {versions.map((version) => (
        <RadioGroupItem
          key={version.value}
          value={version.value}
          className={card}
          aria-describedby={reasonId}
        >
          <span className="text-base leading-tight">{version.label}</span>
          <span className={note}>{version.description}</span>
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
