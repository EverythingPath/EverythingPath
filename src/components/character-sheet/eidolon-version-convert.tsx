'use client';
import { Button } from '~/components/ui/button';
import type { EidolonVersion } from '~/lib/character-sheet-eidolon-progression';
import type { SaveStatus } from './save-status';
import { action, SaveFeedback } from './sheet-parts';

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';

/**
 * The way out of a version mismatch that lives on this sheet: convert the
 * eidolon to the version its supporting summoner levels are. The
 * summoner's own class version is changed on the summoner's sheet. The
 * conversion keeps every recorded choice, as the copy says.
 */
export function EidolonVersionConvert({
  version,
  isDisabled,
  reasonId,
  status,
  onConvert,
}: {
  version: EidolonVersion;
  isDisabled: boolean;
  reasonId: string | undefined;
  status: SaveStatus;
  onConvert: (version: EidolonVersion) => void;
}) {
  const other: EidolonVersion =
    version === 'unchained' ? 'original' : 'unchained';
  const otherLabel = other === 'unchained' ? 'Unchained' : 'Original';
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={action}
        aria-describedby={reasonId}
        disabled={isDisabled}
        onClick={() => onConvert(other)}
      >
        Convert to an {otherLabel} eidolon
      </Button>
      <span className={note}>Your other choices are kept.</span>
      <SaveFeedback
        status={status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}
