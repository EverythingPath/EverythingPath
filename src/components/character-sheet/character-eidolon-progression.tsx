'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId, useState } from 'react';
import {
  MaintenanceReason,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type {
  EidolonProgressionState,
  EidolonVersion,
} from '~/lib/character-sheet-eidolon-progression';
import { withEidolonSubtype } from './character-eidolon-progression-view-model';
import type { CompanionsController } from './companion-props';
import { CompanionProgressionEditorToggle } from './companion-progression-editor-toggle';
import { EidolonBaseFormChoice } from './eidolon-base-form-choice';
import { EidolonProgressionEditor } from './eidolon-progression-editor';
import {
  EidolonProgressionSummary,
  type EidolonWrittenControl,
} from './eidolon-progression-summary';
import { EidolonSubtypeChoice } from './eidolon-subtype-choice';
import type { SaveStatus } from './save-status';
import { blockHeading, chip, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import type { SheetEntryInput } from './use-character-sheet-entries';
import { useFocusAfterEditorCloses } from './use-focus-after-editor-closes';

type ProgressionController = CompanionsController['progression'];
type WrittenControl =
  | EidolonWrittenControl
  | 'baseForm'
  | 'subtype'
  | 'choices';

type CharacterEidolonProgressionProps = {
  controller: ProgressionController;
  warningController: ReturnType<typeof useCharacterSheet>['warnings'];
  /** The viewed Companion sheet; a different one starts afresh. */
  characterId: Id<'character'>;
  /** Whether this sheet is the eidolon of another Character. */
  isEidolon: boolean;
  /** The version a first record starts with: an Unchained eidolon link's. */
  eidolonVersion?: EidolonVersion;
  /** Replaces the maintenance notice's own words beside disabled edits. */
  maintenanceMessage?: string;
  /** Records a natural attack on this sheet, for Add beside an evolution's. */
  createNaturalAttack?: (input: SheetEntryInput) => Promise<unknown>;
};

const idle: SaveStatus = { kind: 'idle' };
const muted = 'text-muted-foreground text-sm';

/**
 * The viewed eidolon's own progression (#409, #418), beneath its
 * relationship: version and base form, summoner level, actual Hit Dice and
 * Class Levels apart, the totals and budgets they give, the summoner's
 * evolution pool with the recorded evolutions against it, the natural
 * attacks they give, and the recorded choices with their editor. An eidolon
 * without a record is asked to choose a version and a base form; an
 * Unchained one without a subtype is then asked for its subtype. Any other
 * sheet without recorded eidolon progression shows nothing here.
 */
export function CharacterEidolonProgression({
  characterId,
  ...props
}: CharacterEidolonProgressionProps) {
  return <EidolonSection key={characterId} {...props} />;
}

function EidolonSection({
  controller,
  warningController,
  isEidolon,
  eidolonVersion = 'original',
  maintenanceMessage,
  createNaturalAttack,
}: Omit<CharacterEidolonProgressionProps, 'characterId'>) {
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
  const { eidolon, status } = controller;
  const recorded = eidolon?.choices ?? null;
  const needsSubtype = recorded?.version === 'unchained' && !recorded.subtype;
  if (controller.isLoading)
    return (
      <p role="status" className={muted}>
        Loading eidolon progression…
      </p>
    );
  if (!eidolon && !isEidolon) return null;
  const isSaving = status.kind === 'saving';
  const isDisabled = controller.isDisabled || isSaving;
  const statusAt = (control: WrittenControl) =>
    writtenControl === control ? status : idle;

  async function save(
    control: WrittenControl,
    progression: EidolonProgressionState,
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 id={headingId} className={blockHeading}>
            Eidolon progression
          </h3>
          {eidolon ? (
            <span className={chip}>{eidolon.ordinary.versionLabel}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isEditorOpen ? null : (
            <SaveFeedback
              status={statusAt('choices')}
              savedText="Saved"
              savingText="Saving…"
              shouldHideWhenIdle
            />
          )}
          {eidolon?.choices ? (
            <CompanionProgressionEditorToggle
              label="Edit eidolon choices"
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
        message="Eidolon progression updated by another player. Your edits are kept."
        subject="eidolon progression"
        onDismiss={controller.dismissRemoteChange}
      />
      {eidolon ? null : (
        <EidolonBaseFormChoice
          forms={controller.eidolonBaseForms}
          versions={controller.eidolonVersions}
          initialVersion={eidolonVersion}
          isDisabled={isDisabled}
          reasonId={reasonId}
          status={statusAt('baseForm')}
          onChoose={(baseForm, version) =>
            void save('baseForm', controller.newEidolon(baseForm, version))
          }
        />
      )}
      {needsSubtype && recorded && !isEditorOpen ? (
        <EidolonSubtypeChoice
          subtypes={controller.unchainedSubtypes}
          isDisabled={isDisabled}
          reasonId={reasonId}
          status={statusAt('subtype')}
          onChoose={(subtype) =>
            save('subtype', withEidolonSubtype(recorded, subtype))
          }
        />
      ) : null}
      {isEditorOpen && eidolon?.choices ? (
        <EidolonProgressionEditor
          choices={eidolon.choices}
          subtype={eidolon.ordinary.subtype}
          catalogs={controller}
          isDisabled={controller.isDisabled}
          status={statusAt('choices')}
          reasonId={reasonId}
          onSave={(progression) => save('choices', progression)}
          onClose={() => setIsEditorOpen(false)}
        />
      ) : null}
      {eidolon ? (
        <EidolonProgressionSummary
          eidolon={eidolon}
          catalog={controller.evolutionCatalogFor(eidolon.ordinary.version)}
          warningController={warningController}
          isDisabled={isDisabled}
          reasonId={reasonId}
          statusAt={statusAt}
          onChange={save}
          createNaturalAttack={createNaturalAttack}
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
