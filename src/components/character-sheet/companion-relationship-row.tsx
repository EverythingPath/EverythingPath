'use client';
import { useRef, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { CompanionRelationshipView } from './character-companions-view-model';
import { CharacterCompanionEditor } from './character-companion-editor';
import { CharacterLinkedInputs } from './character-linked-inputs';
import type {
  CompanionLinkedValueProps,
  CompanionOpenerProps,
  CompanionsController,
} from './companion-props';
import { CompanionRelationshipSummary } from './companion-relationship-summary';
import { CompanionSourceSwitches } from './companion-source-switches';
import { InlineDeleteQuestion } from './inline-delete-question';
import { action, SaveFeedback } from './sheet-parts';

type RowProps = CompanionOpenerProps &
  CompanionLinkedValueProps & {
    row: CompanionRelationshipView;
    controller: CompanionsController;
  };

/**
 * One relationship (approved variant B's list rows): who, what and whether
 * it holds, its Supporting Sources, then the actions the current read permits.
 * Interrupting asks first; replacing and adding a source open the editor
 * beneath the row. A row's writes wait on its own save; other rows stay usable.
 * The values it borrows follow beneath, each named on its own (#317).
 */
export function CompanionRelationshipRow({
  row,
  controller,
  rememberOpener,
  characterId,
  maintenanceMessage,
}: RowProps) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const [isAskingToInterrupt, setIsAskingToInterrupt] = useState(false);
  const interruptButton = useRef<HTMLButtonElement>(null);
  const status = controller.statusFor(row.relationshipId);
  const isSaving = status.kind === 'saving';
  const isDisabled = controller.isDisabled || isSaving;
  const isEditing =
    controller.editor !== null &&
    'relationshipId' in controller.editor &&
    controller.editor.relationshipId === row.relationshipId;

  function closeQuestion() {
    setIsAskingToInterrupt(false);
    interruptButton.current?.focus();
  }

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <CompanionRelationshipSummary row={row} className="min-w-0 flex-1" />
        <div className="flex flex-wrap items-center gap-1">
          {row.canManage ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={action}
              aria-describedby={reasonId}
              disabled={isDisabled}
              onClick={(event) => {
                rememberOpener(event.currentTarget);
                controller.openAddSource(row);
              }}
            >
              Add supporting source{' '}
              <span className="sr-only">for {row.name}</span>
            </Button>
          ) : null}
          {row.canReplace ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={action}
              aria-describedby={reasonId}
              disabled={isDisabled}
              onClick={(event) => {
                rememberOpener(event.currentTarget);
                controller.openReplace(row);
              }}
            >
              Replace Companion <span className="sr-only">{row.name}</span>
            </Button>
          ) : null}
          {row.canInterrupt ? (
            <Button
              ref={interruptButton}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(action, 'text-muted-foreground')}
              aria-pressed={isAskingToInterrupt}
              aria-describedby={reasonId}
              disabled={isDisabled}
              onClick={() => setIsAskingToInterrupt(!isAskingToInterrupt)}
            >
              Interrupt relationship{' '}
              <span className="sr-only">with {row.name}</span>
            </Button>
          ) : null}
          {row.canRestore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={action}
              aria-describedby={reasonId}
              disabled={isDisabled}
              onClick={() => void controller.restore(row)}
            >
              {row.status === 'replaced'
                ? 'Reselect Companion'
                : 'Restore relationship'}{' '}
              <span className="sr-only">{row.name}</span>
            </Button>
          ) : null}
        </div>
        <SaveFeedback
          status={status}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
      {row.explanation ? (
        <p className="text-muted-foreground mt-1 text-xs [overflow-wrap:anywhere]">
          {row.explanation}
        </p>
      ) : null}
      <CompanionSourceSwitches
        row={row}
        controller={controller}
        isDisabled={isDisabled}
        reasonId={reasonId}
      />
      <CharacterLinkedInputs
        characterId={characterId}
        relationshipId={row.relationshipId}
        inputs={row.linkedInputs}
        isAvailable={controller.isAvailable}
        maintenanceMessage={maintenanceMessage}
      />
      {isAskingToInterrupt ? (
        <InlineDeleteQuestion
          question={
            row.endpoint
              ? `Interrupt the relationship with ${row.name}?`
              : 'Interrupt this relationship?'
          }
          details="The Character Sheet and supporting source choices are retained."
          subject={row.name}
          deleteLabel="Interrupt relationship"
          keepLabel="Cancel"
          isBusy={isDisabled}
          className="mt-2"
          onDelete={() => {
            void controller.interrupt(row).then((isInterrupted) => {
              if (isInterrupted) closeQuestion();
            });
          }}
          onKeep={closeQuestion}
        />
      ) : null}
      {isEditing ? <CharacterCompanionEditor controller={controller} /> : null}
    </div>
  );
}
