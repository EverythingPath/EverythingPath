'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import type {
  CompanionLinkedInput,
  LinkedInputProjection,
} from '~/lib/character-sheet-linked-inputs';
import { cn } from '~/lib/utils';
import { CharacterLinkedInputEditor } from './character-linked-input-editor';
import {
  action,
  chip,
  missingChoice,
  RemoteNotice,
  SaveFeedback,
} from './sheet-parts';
import {
  useCharacterSheetLinkedInput,
  type LinkedInputSnapshot,
} from './use-character-sheet-linked-input';
import { useFocusAfterEditorCloses } from './use-focus-after-editor-closes';

export type LinkedInputDescriptor = {
  input: CompanionLinkedInput;
  /** A readable class name already disclosed to this viewer, for Class Levels. */
  classLabel?: string;
};

export type CharacterLinkedInputRowProps = {
  descriptor: LinkedInputDescriptor;
  characterId: Id<'character'>;
  relationshipId: Id<'companionRelationship'>;
  projection?: LinkedInputProjection;
  snapshot: LinkedInputSnapshot | undefined;
};

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
const labelSelector = '[data-linked-input-label]';

/**
 * One borrowed value under its Companion Relationship: its name, the number
 * the sheet uses now (or Unresolved), why, and the saved fallback or
 * interpretation that answers a gap. Writes wait on this row's own save;
 * maintenance keeps the value readable and any open draft intact.
 */
export function CharacterLinkedInputRow({
  descriptor,
  characterId,
  relationshipId,
  projection,
  snapshot,
}: CharacterLinkedInputRowProps) {
  const controller = useCharacterSheetLinkedInput({
    scope: { characterId, relationshipId, input: descriptor.input, projection },
    snapshot,
    classLabel: descriptor.classLabel,
  });
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const labelId = useId();
  const focus = useFocusAfterEditorCloses(controller.editor, labelSelector);
  const { view, editor, status } = controller;
  if (controller.isLoading || !view)
    return (
      <p role="status" className={cn(note, 'py-2')}>
        Loading linked value…
      </p>
    );
  const isDisabled = controller.isDisabled || status.kind === 'saving';
  const control = (
    label: string,
    onClick: (opener: HTMLButtonElement) => void,
    variant: 'outline' | 'ghost' = 'outline',
  ) => (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={cn(action, variant === 'ghost' && 'text-muted-foreground')}
      aria-describedby={reasonId}
      disabled={isDisabled}
      onClick={(event) => onClick(event.currentTarget)}
    >
      {label} <span className="sr-only">for {view.label}</span>
    </Button>
  );
  return (
    <div
      ref={focus.wrapper}
      role="group"
      aria-labelledby={labelId}
      className={cn(
        'grid min-w-0 gap-x-4 gap-y-2 py-2',
        editor && 'md:grid-cols-2',
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span id={labelId} data-linked-input-label className="text-sm">
            {view.label}
          </span>
          <span
            className={cn(
              chip,
              controller.snapshot?.value === null &&
                cn('text-muted-foreground', missingChoice),
            )}
          >
            {view.valueLabel}
          </span>
        </div>
        {view.explanation ? <p className={note}>{view.explanation}</p> : null}
        {view.fallbackExplanation ? (
          <p className={note}>{view.fallbackExplanation}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          {control(
            view.hasFallback ? 'Edit fallback' : 'Set fallback',
            (opener) => {
              focus.rememberOpener(opener);
              controller.openFallback();
            },
          )}
          {view.canChooseInterpretation
            ? control(
                view.hasInterpretation
                  ? 'Change interpretation'
                  : 'Choose interpretation',
                (opener) => {
                  focus.rememberOpener(opener);
                  controller.openInterpretation();
                },
              )
            : null}
          {view.hasFallback
            ? control(
                'Clear fallback',
                () => void controller.clearFallback(),
                'ghost',
              )
            : null}
          {view.hasInterpretation
            ? control(
                'Clear interpretation',
                () => void controller.clearInterpretation(),
                'ghost',
              )
            : null}
        </div>
        <SaveFeedback
          status={status}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
        <RemoteNotice
          isShown={controller.hasRemoteChange}
          message={`${view.label} updated by another player.`}
          subject={view.label}
          onDismiss={controller.dismissRemoteChange}
        />
      </div>
      {editor ? <CharacterLinkedInputEditor controller={controller} /> : null}
    </div>
  );
}
