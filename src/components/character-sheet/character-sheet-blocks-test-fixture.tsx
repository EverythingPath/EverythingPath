import type { Id } from '@convex/_generated/dataModel';
import { AbilityChanges } from './ability-changes';
import { AttackRoutines } from './attack-routines';
import { BaseScoresEditor } from './base-scores-editor';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { CharacterCompanions } from './character-companions';
import { CharacterSheetCatalog } from './character-sheet-catalog';
import { CharacterSheetEntries } from './character-sheet-entries';
import { CharacterSheetFamiliar } from './character-sheet-familiar';
import { CharacterSheetRaces } from './character-sheet-races';
import { CharacterSheetArchetypes } from './character-sheet-archetypes';
import { CharacterSheetGrants } from './character-sheet-grants';
import { CharacterSheetSelections } from './character-sheet-selections';
import { CharacterSheetSkeleton } from './character-sheet-frame';
import { ClassLevels } from './class-levels';
import { CreationSettingsEditor } from './creation-settings-editor';
import { DefensesBlock } from './defenses-block';
import { Equipment } from './equipment';
import { FavoredClassesEditor } from './favored-classes-editor';
import { OffenseBlock } from './offense-block';
import { SheetOppositionSchools } from './opposition-schools-editor';
import { PersonalAdjustments } from './personal-adjustments';
import { Proficiencies } from './proficiencies';
import { SelectionOrderProvider } from './selection-order-context';
import { RevealEntryRowProvider } from './reveal-entry-row';
import { SheetCatalogProvider } from './sheet-catalog-context';
import { Block, RemoteNotice } from './sheet-parts';
import { SheetSummary } from './sheet-summary';
import { buildSelectedSituations } from './situation-copy';
import { SituationPicker } from './situation-picker';
import { Skills } from './skills';
import { SpellcastingBlock } from './spellcasting-block';
import { characterId } from './character-sheet-test-fixture';
import { useCharacterSheet } from './use-character-sheet';
import { useSituationSelection } from './use-situation-selection';
import {
  describeSheetUnresolved,
  describeIncompleteHp,
  findArchetypeSection,
  listGrantBlockSections,
  listUnplacedSelections,
} from './character-sheet-view-helpers';

type SheetBlock =
  | 'races'
  | 'scores'
  | 'adjustments'
  | 'abilityChanges'
  | 'levels'
  | 'settings'
  | 'favoredClasses'
  | 'defenses'
  | 'offense'
  | 'summary'
  | 'entries'
  | 'skills'
  | 'equipment'
  | 'proficiencies'
  | 'selections'
  | 'archetypes'
  | 'grants'
  | 'catalog'
  | 'attacks'
  | 'companions'
  | 'familiar'
  | 'situations'
  | 'spellcasting';

// Exercise the real controller and selected public blocks against the same
// read snapshots as page integration tests, without rendering unrelated UI.
export function CharacterSheetBlocks({
  blocks,
  scopeCharacterId = characterId,
}: {
  blocks: SheetBlock[];
  /** The route's Character, for tests that switch Characters. */
  scopeCharacterId?: Id<'character'>;
}) {
  const scope = { organizationId: 'org', characterId: scopeCharacterId };
  const controller = useCharacterSheet(scope);
  const sheet = controller.sheet;
  if (!sheet)
    return (
      <CharacterSheetSkeleton
        back={{ href: '/campaigns/campaign-1/characters', label: 'Characters' }}
      />
    );
  const sheetBlocks = (
    <RevealEntryRowProvider>
      <SheetBlocks blocks={blocks} controller={controller} />
    </RevealEntryRowProvider>
  );
  if (!blocks.includes('catalog')) return sheetBlocks;
  return (
    <SheetCatalogProvider scope={scope} snapshot={controller.catalogSnapshot}>
      {sheetBlocks}
    </SheetCatalogProvider>
  );
}

function SheetBlocks({
  blocks,
  controller,
}: {
  blocks: SheetBlock[];
  controller: ReturnType<typeof useCharacterSheet>;
}) {
  const sheet = controller.sheet;
  const situations = useSituationSelection({
    groups: controller.situations,
    scopeKey: sheet?.character._id ?? '',
  });
  if (!sheet) return null;
  const incompleteHpReason = describeIncompleteHp(sheet);
  return (
    <BreakdownResolverProvider
      spellcastings={sheet.calculated.spellcastings}
      previewSituation={controller.previewSituation}
      adjustments={sheet.adjustments}
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
        <RemoteNotice
          isShown={controller.warnings.hasRemoteChange}
          message="Warnings updated by another player."
          subject="warnings"
          onDismiss={controller.warnings.dismissRemoteChange}
        />
        {blocks.map((block) => {
          switch (block) {
            case 'races':
              return (
                <CharacterSheetRaces
                  key={block}
                  races={sheet.races}
                  statistics={sheet.raceStatistics}
                  raceNames={sheet.raceNames}
                  calculated={sheet.calculated}
                  actions={controller.races}
                  grants={controller.grants}
                  warnings={sheet.warnings}
                  warningController={controller.warnings}
                />
              );
            case 'skills':
              return <Skills key={block} controller={controller} />;
            case 'equipment':
              return (
                <Equipment
                  key={block}
                  equipment={controller.equipment}
                  attacks={controller.attacks}
                  catalogEntries={controller.catalogSnapshot?.catalogEntries}
                  spellEffects={sheet.calculated.spellEffects}
                  warnings={sheet.warnings}
                  warningController={controller.warnings}
                />
              );
            case 'attacks':
              return (
                <AttackRoutines
                  key={block}
                  attacks={controller.attacks}
                  warnings={sheet.warnings}
                  warningController={controller.warnings}
                  itemParts={sheet.calculated.itemParts}
                  catalogEntries={controller.catalogSnapshot?.catalogEntries}
                  spellEffects={sheet.calculated.spellEffects}
                />
              );
            case 'selections':
              return (
                <CharacterSheetSelections
                  key={`${block}:${sheet.character._id}`}
                  view={sheet.selections}
                  controls={controller.selections}
                  warnings={controller.warnings}
                  grantSections={sheet.grants.filter(
                    (section) =>
                      section.kind === 'feat' || section.kind === 'trait',
                  )}
                  grants={controller.grants}
                  sheetWarnings={sheet.warnings}
                />
              );
            case 'proficiencies':
              return (
                <Proficiencies
                  key={block}
                  proficiencies={controller.proficiencies}
                />
              );
            case 'archetypes':
              return (
                <CharacterSheetArchetypes
                  key={block}
                  archetypes={controller.archetypes}
                  section={findArchetypeSection(sheet.grants)}
                  featureNames={sheet.classFeatureNames}
                  spellNames={sheet.spellNames}
                  grants={controller.grants}
                  warnings={sheet.warnings}
                  warningController={controller.warnings}
                />
              );
            case 'scores':
              return (
                <BaseScoresEditor
                  key={block}
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
              );
            case 'adjustments':
              return (
                <PersonalAdjustments
                  key={block}
                  rows={sheet.adjustments}
                  actions={controller.adjustments}
                  warnings={sheet.warnings}
                  warningController={controller.warnings}
                />
              );
            case 'abilityChanges':
              return (
                <AbilityChanges
                  key={block}
                  rows={sheet.abilityChanges}
                  actions={controller.abilityChanges}
                />
              );
            case 'levels':
              return (
                <ClassLevels
                  key={block}
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
              );
            case 'settings':
              return (
                <CreationSettingsEditor
                  key={block}
                  settings={sheet.calculated.creationSettings}
                  save={controller.saveCreationSettings}
                />
              );
            case 'favoredClasses':
              return (
                <Block key={block} title="Character">
                  <FavoredClassesEditor
                    classChoices={sheet.classChoices}
                    favoredClassIds={sheet.favoredClassIds}
                    warnings={sheet.warnings}
                    warningController={controller.warnings}
                    save={controller.saveFavoredClasses}
                  />
                </Block>
              );
            case 'defenses':
              return (
                <DefensesBlock
                  key={block}
                  statistics={sheet.calculated.derivedStatistics}
                />
              );
            case 'offense':
              return (
                <OffenseBlock
                  key={block}
                  statistics={sheet.calculated.derivedStatistics}
                />
              );
            case 'summary':
              return (
                <SheetSummary
                  key={block}
                  name={sheet.character.name}
                  calculated={sheet.calculated}
                  incompleteHpReason={incompleteHpReason}
                />
              );
            case 'catalog':
              return <CharacterSheetCatalog key={block} />;
            case 'companions':
              return (
                <CharacterCompanions
                  key={block}
                  controller={controller.companions}
                  warningController={controller.warnings}
                  characterId={sheet.character._id}
                  createNaturalAttack={controller.attacks.createNaturalAttack}
                />
              );
            case 'familiar':
              return (
                <CharacterSheetFamiliar
                  key={block}
                  controller={controller.familiar}
                />
              );
            case 'spellcasting':
              return (
                <SpellcastingBlock
                  key={block}
                  characterName={sheet.character.name}
                  spellcastings={sheet.calculated.spellcastings}
                  unresolved={sheet.calculated.spellcastingUnresolved}
                />
              );
            case 'situations':
              return (
                <SituationPicker
                  key={block}
                  groups={controller.situations}
                  selection={situations}
                  findPrerequisiteName={controller.findPrerequisiteName}
                />
              );
            case 'grants':
              return (
                <CharacterSheetGrants
                  key={block}
                  sections={listGrantBlockSections(sheet.grants)}
                  actions={controller.grants}
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
              );
            case 'entries':
              return (
                <CharacterSheetEntries
                  key={block}
                  rows={sheet.sheetEntries}
                  conditionEffects={sheet.calculated.conditionEffects}
                  actions={controller.sheetEntries}
                  warnings={sheet.warnings}
                  warningController={controller.warnings}
                />
              );
          }
        })}
      </SelectionOrderProvider>
    </BreakdownResolverProvider>
  );
}
