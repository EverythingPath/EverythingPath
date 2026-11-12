'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId, useState } from 'react';
import {
  MaintenanceReason,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import { CharacterCompanionProgressionEditor } from './character-companion-progression-editor';
import type { CompanionsController } from './companion-props';
import { CompanionProgressionEditorToggle } from './companion-progression-editor-toggle';
import { CompanionProgressionSummary } from './companion-progression-summary';
import type { SaveStatus } from './save-status';
import { blockHeading, RemoteNotice, SaveFeedback } from './sheet-parts';
import { useFocusAfterEditorCloses } from './use-focus-after-editor-closes';
import type { useCharacterSheet } from './use-character-sheet';

type ProgressionController = CompanionsController['progression'];
type WrittenControl = 'choices' | 'advancement' | 'keep';

type CharacterCompanionProgressionProps = {
  controller: ProgressionController;
  warningController: ReturnType<typeof useCharacterSheet>['warnings'];
  /** The viewed Companion sheet; a different one starts afresh. */
  characterId: Id<'character'>;
  /** Whether this sheet is an animal companion of another Character. */
  isAnimalCompanion: boolean;
  /** Replaces the maintenance notice's own words beside disabled edits. */
  maintenanceMessage?: string;
};

const idle: SaveStatus = { kind: 'idle' };
const muted = 'text-muted-foreground text-sm';

/**
 * The viewed Companion's own progression (#325), beneath its relationship:
 * species, effective progression level, actual Hit Dice and Class Levels
 * apart, the totals and budgets they give, where they come from, and the
 * recorded choices with their editor. An animal companion without a
 * species is asked to choose one; any other sheet without recorded
 * progression shows nothing here.
 */
export function CharacterCompanionProgression({
  characterId,
  ...props
}: CharacterCompanionProgressionProps) {
  return <ProgressionSection key={characterId} {...props} />;
}

function ProgressionSection({
  controller,
  warningController,
  isAnimalCompanion,
  maintenanceMessage,
}: Omit<CharacterCompanionProgressionProps, 'characterId'>) {
  const maintenance = useInitialMigrationMaintenance();
  const sharedReasonId = useMaintenanceReasonId(maintenance);
  const ownReasonId = useId();
  const reasonId = maintenance.readOnly
    ? (sharedReasonId ?? ownReasonId)
    : undefined;
  const headingId = useId();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [writtenControl, setWrittenControl] = useState<WrittenControl | null>(
    null,
  );
  const focus = useFocusAfterEditorCloses(
    isEditorOpen ? 'progression' : null,
    'h3',
  );
  const { summary, status } = controller;
  if (controller.isLoading)
    return (
      <p role="status" className={muted}>
        Loading companion progression…
      </p>
    );
  if (!summary && !isAnimalCompanion) return null;
  const isSaving = status.kind === 'saving';
  const isDisabled = controller.isDisabled || isSaving;
  const statusAt = (control: WrittenControl) =>
    writtenControl === control ? status : idle;

  async function save(
    control: WrittenControl,
    progression: AnimalCompanionProgressionState,
  ) {
    if (isDisabled) return false;
    setWrittenControl(control);
    const isSaved = await controller.save(progression);
    if (isSaved && control === 'choices') setIsEditorOpen(false);
    return isSaved;
  }
  function toggle(opener: HTMLElement) {
    if (isEditorOpen) return setIsEditorOpen(false);
    focus.rememberOpener(opener);
    setWrittenControl(null);
    setIsEditorOpen(true);
  }

  return (
    <section
      ref={focus.wrapper}
      aria-labelledby={headingId}
      className="border-foreground/10 mt-3 flex flex-col gap-3 border-t pt-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className={blockHeading}>
          Animal companion progression
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isEditorOpen ? null : (
            <SaveFeedback
              status={statusAt('choices')}
              savedText="Saved"
              savingText="Saving…"
              shouldHideWhenIdle
            />
          )}
          {summary ? (
            <CompanionProgressionEditorToggle
              label="Edit companion choices"
              isEditorOpen={isEditorOpen}
              reasonId={reasonId}
              isDisabled={controller.isDisabled}
              onToggle={toggle}
            />
          ) : null}
        </div>
      </header>
      <RemoteNotice
        isShown={controller.hasRemoteChange}
        message="Companion progression updated by another player. Your edits are kept."
        subject="companion progression"
        onDismiss={controller.dismissRemoteChange}
      />
      {summary ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm">Choose an animal companion species.</p>
          <CompanionProgressionEditorToggle
            label="Set up companion progression"
            isEditorOpen={isEditorOpen}
            reasonId={reasonId}
            isDisabled={controller.isDisabled}
            onToggle={toggle}
          />
        </div>
      )}
      {isEditorOpen ? (
        <CharacterCompanionProgressionEditor
          choices={summary?.choices ?? null}
          speciesChoices={controller.speciesChoices}
          isDisabled={controller.isDisabled}
          status={statusAt('choices')}
          reasonId={reasonId}
          onSave={(progression) =>
            progression ? save('choices', progression) : Promise.resolve(false)
          }
          onClose={() => setIsEditorOpen(false)}
        />
      ) : null}
      {summary ? (
        <CompanionProgressionSummary
          summary={summary}
          warningController={warningController}
          isDisabled={isDisabled}
          reasonId={reasonId}
          statusAt={statusAt}
          onChange={(control, progression) => void save(control, progression)}
        />
      ) : null}
      {sharedReasonId ? null : (
        <MaintenanceReason
          id={ownReasonId}
          notice={{
            ...maintenance,
            message: maintenanceMessage ?? maintenance.message,
          }}
          className="text-xs"
        />
      )}
    </section>
  );
}
