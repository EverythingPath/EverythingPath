'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { cn } from '~/lib/utils';
import { CharacterCohort } from './character-cohort';
import { CharacterCompanionAllocations } from './character-companion-allocations';
import { CharacterCompanionEditor } from './character-companion-editor';
import { CharacterCombinedForm } from './character-combined-form';
import { CharacterCompanionProgression } from './character-companion-progression';
import { CharacterEidolonProgression } from './character-eidolon-progression';
import type { CompanionsController } from './companion-props';
import { CompanionRelationshipList } from './companion-relationship-list';
import { CompanionSectionActions } from './companion-section-actions';
import { CreatedCompanionNotice } from './created-companion-notice';
import { Block, fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import { useFocusAfterEditorCloses } from './use-focus-after-editor-closes';
import type { useCharacterSheet } from './use-character-sheet';
import type { SheetEntryInput } from './use-character-sheet-entries';

type CharacterCompanionsProps = {
  controller: CompanionsController;
  warningController: ReturnType<typeof useCharacterSheet>['warnings'];
  /** The viewed sheet, for the values its relationships borrow. */
  characterId: Id<'character'>;
  /** Replaces the maintenance notice's own words beside disabled edits. */
  maintenanceMessage?: string;
  /** Records a natural attack on this sheet, for an eidolon's evolutions. */
  createNaturalAttack?: (input: SheetEntryInput) => Promise<unknown>;
};

const emptyText = 'text-muted-foreground text-sm';

/**
 * The Companions section (#309): this Character's Companions and the
 * Character it is a Companion of, current relationships first and former
 * ones beneath, each with its Supporting Sources and permitted actions, then
 * this sheet's own animal companion progression (#325) or eidolon
 * progression (#409) after that context.
 * The maintenance reason is stated once at the foot; every disabled control
 * points at it. Nothing renders for an unavailable sheet.
 */
export function CharacterCompanions({
  controller,
  warningController,
  characterId,
  maintenanceMessage,
  createNaturalAttack,
}: CharacterCompanionsProps) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const focus = useFocusAfterEditorCloses(controller.editorKey);
  if (!controller.isAvailable) return null;
  const rows = controller.rows ?? [];
  const current = rows.filter((row) => row.status === 'active');
  const former = rows.filter((row) => row.status !== 'active');
  const sectionStatus = (['create', 'link'] as const)
    .map(controller.statusFor)
    .find((status) => status.kind !== 'idle') ?? { kind: 'idle' as const };
  const listProps = {
    controller,
    rememberOpener: focus.rememberOpener,
    characterId,
    maintenanceMessage,
  };
  return (
    <MaintenanceReasonScope id={reasonId}>
      <div ref={focus.wrapper}>
        <Block
          title="Companions"
          aside={
            <CompanionSectionActions
              controller={controller}
              rememberOpener={focus.rememberOpener}
            />
          }
        >
          <RemoteNotice
            isShown={controller.hasRemoteChange}
            message="Companion Relationships updated by another player."
            subject="companions"
            onDismiss={controller.dismissRemoteChange}
          />
          <SaveFeedback
            status={sectionStatus}
            savedText="Saved"
            savingText="Saving…"
            shouldHideWhenIdle
          />
          <CreatedCompanionNotice controller={controller} />
          {controller.editor && !('relationshipId' in controller.editor) ? (
            <CharacterCompanionEditor controller={controller} />
          ) : null}
          {controller.isLoading ? (
            <p role="status" className={emptyText}>
              Loading companions…
            </p>
          ) : null}
          {!controller.isLoading && rows.length === 0 ? (
            <p className={emptyText}>No Companion Relationships.</p>
          ) : null}
          <CompanionRelationshipList rows={current} {...listProps} />
          {former.length > 0 ? (
            <>
              <h3 className={cn(fieldLabel, 'mt-3')}>Former and interrupted</h3>
              <CompanionRelationshipList rows={former} {...listProps} />
            </>
          ) : null}
          <CharacterCombinedForm controller={controller.combinedForm} />
          <CharacterCohort
            controller={controller.cohort}
            warningController={warningController}
            characterId={characterId}
            maintenanceMessage={maintenanceMessage}
          />
          <CharacterCompanionAllocations
            controller={controller.allocations}
            characterId={characterId}
            maintenanceMessage={maintenanceMessage}
          />
          <CharacterCompanionProgression
            controller={controller.progression}
            warningController={warningController}
            characterId={characterId}
            isAnimalCompanion={rows.some(
              (row) =>
                row.role === 'associated' && row.kind === 'animalCompanion',
            )}
            maintenanceMessage={maintenanceMessage}
          />
          <CharacterEidolonProgression
            controller={controller.progression}
            warningController={warningController}
            characterId={characterId}
            isEidolon={rows.some(
              (row) =>
                row.role === 'associated' &&
                (row.kind === 'eidolon' || row.kind === 'unchainedEidolon'),
            )}
            eidolonVersion={
              rows.some(
                (row) =>
                  row.role === 'associated' && row.kind === 'unchainedEidolon',
              )
                ? 'unchained'
                : 'original'
            }
            maintenanceMessage={maintenanceMessage}
            createNaturalAttack={createNaturalAttack}
          />
          <MaintenanceReason
            id={reasonId}
            notice={{
              ...maintenance,
              message: maintenanceMessage ?? maintenance.message,
            }}
            className="mt-2 text-xs"
          />
        </Block>
      </div>
    </MaintenanceReasonScope>
  );
}
