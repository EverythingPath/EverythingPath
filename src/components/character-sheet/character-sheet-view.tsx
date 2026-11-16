'use client';
import type { ReactNode } from 'react';
import type { CharacterSheetOrigin } from '~/lib/campaign-routes';
import { formatCharacterKind, type CharacterKind } from '~/lib/character-kind';
import { AbilityChanges } from './ability-changes';
import { AttackRoutines } from './attack-routines';
import { BaseScoresEditor } from './base-scores-editor';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { BuildOutControl } from './build-out-control';
import { CharacterCompanions } from './character-companions';
import type { CharacterScope } from './character-scope';
import { CharacterSheetCatalog } from './character-sheet-catalog';
import { CharacterSheetArchetypes } from './character-sheet-archetypes';
import { CharacterSheetEntries } from './character-sheet-entries';
import { CharacterSheetFamiliar } from './character-sheet-familiar';
import { CharacterSheetFrame, type BackLink } from './character-sheet-frame';
import { CharacterSheetGrants } from './character-sheet-grants';
import { CharacterSheetRaces } from './character-sheet-races';
import { CharacterSheetSelections } from './character-sheet-selections';
import { ClassLevels } from './class-levels';
import { DefensesBlock } from './defenses-block';
import { Equipment } from './equipment';
import { FavoredClassesEditor } from './favored-classes-editor';
import { OffenseBlock } from './offense-block';
import { SheetOppositionSchools } from './opposition-schools-editor';
import { PersonalAdjustments } from './personal-adjustments';
import { Proficiencies } from './proficiencies';
import { CreationSettingsEditor } from './creation-settings-editor';
import { SelectionOrderProvider } from './selection-order-context';
import { RevealEntryRowProvider } from './reveal-entry-row';
import { SheetCatalogProvider } from './sheet-catalog-context';
import { Block, chip, fieldLabel, RemoteNotice } from './sheet-parts';
import { SheetSummary } from './sheet-summary';
import { buildSelectedSituations } from './situation-copy';
import { SituationPicker } from './situation-picker';
import { Skills } from './skills';
import { SpellcastingBlock } from './spellcasting-block';
import type { useCharacterSheet } from './use-character-sheet';
import { useSituationSelection } from './use-situation-selection';
import {
  describeSheetUnresolved,
  describeIncompleteHp,
  findArchetypeSection,
  listGrantBlockSections,
  listSelectionSections,
  listUnplacedSelections,
} from './character-sheet-view-helpers';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;

// Existing metadata, shown; this slice has no sheet-side identity editor.
// The name is in the summary row, so it is not repeated here. A minimal
// Character offers its one-way Build out here, once.
function CharacterBlock({
  kind,
  notes,
  buildOut,
  favoredClasses,
}: {
  kind: CharacterKind;
  notes: string;
  buildOut: Controller['buildOut'];
  favoredClasses: ReactNode;
}) {
  return (
    <Block
      title="Character"
      aside={
        buildOut.available ? <BuildOutControl buildOut={buildOut} /> : null
      }
    >
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4 lg:grid-cols-8">
        <div className="flex flex-col gap-0.5">
          <dt className={fieldLabel}>Kind</dt>
          <dd className="text-sm">{formatCharacterKind(kind)}</dd>
        </div>
        <div className="col-span-2 flex flex-col gap-0.5 md:col-span-3 lg:col-span-7">
          <dt className={fieldLabel}>Notes</dt>
          <dd className="text-sm [overflow-wrap:anywhere]">
            {notes.trim() ? notes : '—'}
          </dd>
        </div>
      </dl>
      <div className="mt-2">{favoredClasses}</div>
    </Block>
  );
}

// Where the Character belongs. The sheet read carries no campaign name, so a
// campaign sheet opened without one states the fact instead of a stand-in.
function CampaignMembership({
  isPrivate,
  campaignName,
}: {
  isPrivate: boolean;
  campaignName?: string;
}) {
  if (isPrivate)
    return (
      <>
        <span>No campaign</span>
        <span className="text-muted-foreground text-xs">
          Only you can see this character.
        </span>
      </>
    );
  if (campaignName)
    return <span className="[overflow-wrap:anywhere]">{campaignName}</span>;
  return (
    <span className="text-muted-foreground text-xs">
      Shared with a campaign.
    </span>
  );
}

// The campaign row under the summary (approved variant B's membership
// strip): where the Character belongs on the left, its one lifecycle action
// on the right. It scrolls with the body.
function CampaignRow({
  character,
  campaignName,
  action,
}: {
  character: ReadySheet['character'];
  campaignName?: string;
  action: ReactNode;
}) {
  return (
    <div
      data-sheet-campaign
      className="bg-sidebar/60 border-foreground/15 mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border px-3 py-2 text-sm"
    >
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className={fieldLabel}>Campaign</span>
        <CampaignMembership
          isPrivate={!character.campaignId}
          campaignName={campaignName}
        />
        {character.isActive ? null : <span className={chip}>Archived</span>}
      </p>
      {action}
    </div>
  );
}

/**
 * The living sheet (approved variant B, #208): the pinned summary row, the
 * campaign row that scrolls with the body, the Situation picker whose
 * choices show alternate totals beside the numbers they change, then Character,
 * Race, a familiar’s own Familiar summary, Class Levels,
 * Archetypes and Ability scores with their damage and drain in the left five of the
 * sheet's twelve columns with Defenses, Equipment, Offense, Attacks and
 * Proficiencies, and the skills, Feats & traits after Skills, personal
 * adjustments, sheet entries,
 * granted and dormant entries, Companions, the catalog and the creation settings beside them,
 * then the Spellcasting section across the full width. Each calculation warning sits by its
 * subject (unresolved HP under the Class Levels it is summed from, a
 * formula under its Modifier); only another player's acceptances are
 * announced for the sheet. A familiar's numbers that need its base creature
 * or its associated Character read Unresolved, never a partial sum.
 */
export function CharacterSheetView({
  scope,
  sheet,
  controller,
  back,
  campaignName,
  origin,
  lifecycle,
}: {
  /** The route's scope, carried by the catalog's reads and writes. */
  scope: CharacterScope;
  sheet: ReadySheet;
  controller: Controller;
  back: BackLink;
  campaignName?: string;
  /** Where the sheet was opened from; its Spells page keeps the same Back. */
  origin?: CharacterSheetOrigin;
  /** The Character's archive or delete control, bound to the route scope. */
  lifecycle: ReactNode;
}) {
  const situations = useSituationSelection({
    groups: controller.situations,
    scopeKey: sheet.character._id,
  });
  return (
    <CharacterSheetFrame back={back}>
      <SheetCatalogProvider scope={scope} snapshot={controller.catalogSnapshot}>
        <RevealEntryRowProvider>
          <BreakdownResolverProvider
            previewSituation={controller.previewSituation}
            adjustments={sheet.adjustments}
            spellcastings={sheet.calculated.spellcastings}
            unresolved={describeSheetUnresolved(sheet, controller.familiar)}
            findPrerequisiteName={controller.findPrerequisiteName}
            selected={buildSelectedSituations({
              groups: controller.situations,
              selection: situations,
              findPrerequisiteName: controller.findPrerequisiteName,
            })}
            entryNotes={sheet.calculated.entryNotes}
          >
            <SelectionOrderProvider
              controls={controller.selections}
              view={sheet.selections}
            >
              <SheetSummary
                name={sheet.character.name}
                calculated={sheet.calculated}
                incompleteHpReason={describeIncompleteHp(sheet)}
              />
              <CampaignRow
                character={sheet.character}
                campaignName={campaignName}
                action={lifecycle}
              />
              <RemoteNotice
                isShown={controller.warnings.hasRemoteChange}
                message="Warnings updated by another player."
                subject="warnings"
                onDismiss={controller.warnings.dismissRemoteChange}
              />
              <SituationPicker
                groups={controller.situations}
                selection={situations}
                findPrerequisiteName={controller.findPrerequisiteName}
              />
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-12">
                  <CharacterBlock
                    kind={sheet.character.kind}
                    notes={sheet.character.description}
                    buildOut={controller.buildOut}
                    favoredClasses={
                      <FavoredClassesEditor
                        classChoices={sheet.classChoices}
                        favoredClassIds={sheet.favoredClassIds}
                        warnings={sheet.warnings}
                        warningController={controller.warnings}
                        save={controller.saveFavoredClasses}
                      />
                    }
                  />
                </div>
                <div className="min-w-0 lg:col-span-12">
                  <CharacterSheetRaces
                    races={sheet.races}
                    statistics={sheet.raceStatistics}
                    raceNames={sheet.raceNames}
                    calculated={sheet.calculated}
                    actions={controller.races}
                    grants={controller.grants}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                  />
                </div>
                {controller.familiar.isAvailable ||
                (controller.familiar.isLoading && sheet.calculated.familiar) ? (
                  <div className="min-w-0 lg:col-span-12">
                    <CharacterSheetFamiliar controller={controller.familiar} />
                  </div>
                ) : null}
                <div className="min-w-0 lg:col-span-12">
                  <ClassLevels
                    rows={sheet.levels}
                    metadata={sheet.calculated.classLevels}
                    classes={controller.classes}
                    unplacedSelections={listUnplacedSelections(sheet)}
                    warnings={sheet.warnings}
                    advisory={sheet.warning}
                    showMissingChoices={sheet.showMissingChoices}
                    warningController={controller.warnings}
                    levels={controller.levels}
                    saveHitPoints={controller.saveHitPoints}
                    saveClassLevel={controller.saveClassLevel}
                  />
                </div>
                <div className="min-w-0 lg:col-span-12">
                  <CharacterSheetArchetypes
                    archetypes={controller.archetypes}
                    section={findArchetypeSection(sheet.grants)}
                    featureNames={sheet.classFeatureNames}
                    spellNames={sheet.spellNames}
                    grants={controller.grants}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                  />
                </div>
                <div className="min-w-0 space-y-3 lg:col-span-5">
                  <BaseScoresEditor
                    scores={sheet.baseScores}
                    abilities={sheet.calculated.abilities}
                    creationSettings={sheet.calculated.creationSettings}
                    pointBuy={sheet.calculated.pointBuy}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                    breakdowns={sheet.calculated.breakdowns}
                    modifierBreakdowns={
                      sheet.calculated.abilityModifierBreakdowns
                    }
                    permanent={sheet.permanentCalculated.abilities}
                    save={controller.saveBaseScores}
                  />
                  <DefensesBlock
                    statistics={sheet.calculated.derivedStatistics}
                  />
                  <Equipment
                    equipment={controller.equipment}
                    spellEffects={sheet.calculated.spellEffects}
                    attacks={controller.attacks}
                    catalogEntries={controller.catalogSnapshot?.catalogEntries}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                  />
                  <OffenseBlock
                    statistics={sheet.calculated.derivedStatistics}
                  />
                  <AttackRoutines
                    attacks={controller.attacks}
                    spellEffects={sheet.calculated.spellEffects}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                    itemParts={sheet.calculated.itemParts}
                    catalogEntries={controller.catalogSnapshot?.catalogEntries}
                  />
                  <Proficiencies proficiencies={controller.proficiencies} />
                  <AbilityChanges
                    rows={sheet.abilityChanges}
                    actions={controller.abilityChanges}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
                  <Skills controller={controller} />
                  <CharacterSheetSelections
                    key={sheet.character._id}
                    view={sheet.selections}
                    controls={controller.selections}
                    warnings={controller.warnings}
                    grantSections={listSelectionSections(sheet.grants)}
                    grants={controller.grants}
                    sheetWarnings={sheet.warnings}
                  />
                  <PersonalAdjustments
                    rows={sheet.adjustments}
                    actions={controller.adjustments}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                  />
                  <CharacterSheetEntries
                    rows={sheet.sheetEntries}
                    conditionEffects={sheet.calculated.conditionEffects}
                    actions={controller.sheetEntries}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                  />
                  <CharacterSheetGrants
                    sections={listGrantBlockSections(sheet.grants)}
                    actions={controller.grants}
                    equipmentRowIds={
                      new Set(
                        controller.equipment.rows.map((row) => row.entryId),
                      )
                    }
                    renderExtra={(row) => (
                      <SheetOppositionSchools
                        row={row}
                        choices={controller.spellcastingChoices}
                        warningController={controller.warnings}
                      />
                    )}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                  />
                  <CharacterCompanions
                    controller={controller.companions}
                    warningController={controller.warnings}
                    characterId={sheet.character._id}
                    createNaturalAttack={controller.attacks.createNaturalAttack}
                  />
                  <CharacterSheetCatalog />
                  <CreationSettingsEditor
                    settings={sheet.calculated.creationSettings}
                    save={controller.saveCreationSettings}
                  />
                </div>
                <div className="min-w-0 lg:col-span-12">
                  <SpellcastingBlock
                    characterName={sheet.character.name}
                    spellcastings={sheet.calculated.spellcastings}
                    unresolved={sheet.calculated.spellcastingUnresolved}
                    spells={{
                      characterId: sheet.character._id,
                      origin,
                      collections: sheet.calculated.spellCollections,
                      warnings: sheet.warnings,
                      warningController: controller.warnings,
                      writes: controller.spells,
                    }}
                  />
                </div>
              </div>
            </SelectionOrderProvider>
          </BreakdownResolverProvider>
        </RevealEntryRowProvider>
      </SheetCatalogProvider>
    </CharacterSheetFrame>
  );
}
