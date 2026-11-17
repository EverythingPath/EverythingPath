'use client';
import { useId, type ReactNode } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { ArchetypeListChanges } from './archetype-list-changes';
import { BreakdownResolverProvider } from './breakdown-resolver';
import type { CharacterScope } from './character-scope';
import { CharacterSheetFrame, type BackLink } from './character-sheet-frame';
import { GrantedSpells } from './granted-spells';
import { OrphanedSpells } from './orphaned-spells';
import { Block, RemoteNotice } from './sheet-parts';
import { SpellBrowser } from './spell-browser';
import { headerAction, SpellCollection } from './spell-collection';
import {
  describeCollectionHeading,
  describeRecordedCount,
} from './spellcasting-block';
import { SpellcastingNumbers } from './spellcasting-numbers';
import type { useCharacterSheet } from './use-character-sheet';
import { useCharacterSpellsPage } from './use-character-spells-page';

type Controller = ReturnType<typeof useCharacterSheet>;
type Page = ReturnType<typeof useCharacterSpellsPage>;
type Sheet = NonNullable<Controller['sheet']>;

function collectionOf(sheet: Sheet, classEntryId: string) {
  return sheet.calculated.spellCollections.collections.find(
    (collection) => collection.classEntryId === classEntryId,
  );
}

// One tab per Spellcasting, each naming its record and count or "whole
// list". With a single Spellcasting there is nothing to choose between.
function SpellcastingTabs({
  page,
  sheet,
  children,
}: {
  page: Page;
  sheet: Sheet;
  children: ReactNode;
}) {
  if (!page.selected || page.spellcastings.length < 2) return children;
  return (
    <Tabs
      value={page.selected.classEntryId}
      activationMode="manual"
      onValueChange={page.selectSpellcasting}
      className="gap-3"
    >
      <TabsList
        aria-label="Spellcasting"
        className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0 md:w-auto"
      >
        {page.spellcastings.map((casting) => {
          const collection = collectionOf(sheet, casting.classEntryId);
          const heading = collection?.heading ?? null;
          return (
            <TabsTrigger
              key={casting.classEntryId}
              value={casting.classEntryId}
              className={cn(
                'border-foreground/40 text-muted-foreground hover:bg-foreground/10 h-auto min-h-11 flex-1 flex-col items-start gap-0 px-3 py-1 text-left font-normal shadow-none md:min-h-9 md:flex-none md:flex-row md:items-baseline md:gap-x-2',
                'data-[state=active]:border-primary data-[state=active]:bg-primary/15 data-[state=active]:text-primary',
              )}
            >
              <span className="font-sans text-base">{casting.name}</span>{' '}
              <span className="font-mono text-xs">
                {heading && collection
                  ? `${heading.toLowerCase()} · ${collection.spells.length}`
                  : describeCollectionHeading(
                      collection,
                      casting,
                      'whole list',
                    ).text.toLowerCase()}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value={page.selected.classEntryId} className="space-y-3">
        {children}
      </TabsContent>
    </Tabs>
  );
}

/** How many Granted Spells the selected Spellcasting has, by its features. */
function countGrantedSpells(page: Page) {
  return (
    page.features?.grantedSpellsByLevel.reduce(
      (sum, group) => sum + group.spells.length,
      0,
    ) ?? 0
  );
}

/**
 * The selected Spellcasting's numbers, every one opening its breakdown, and
 * the Spells its Archetypes add to or remove from its list (#422).
 */
function NumbersBlock({ page, sheet }: { page: Page; sheet: Sheet }) {
  if (!page.selected) return null;
  const granted = countGrantedSpells(page);
  const counts = [
    page.collection ? describeRecordedCount(page.collection) : null,
    granted > 0 ? `${granted} granted` : null,
  ].filter((text) => text !== null);
  const heading = describeCollectionHeading(
    page.collection ?? undefined,
    page.selected,
    'whole list',
  );
  return (
    <Block
      title={`${page.selected.name} · ${heading.kind === 'waiting' ? heading.text.toLowerCase() : heading.text}`}
      aside={
        counts.length > 0 ? (
          <span className="text-muted-foreground font-mono text-sm">
            {counts.join(' · ')}
          </span>
        ) : null
      }
    >
      <SpellcastingNumbers
        casting={page.selected}
        isHeadingVisible={false}
        hasFigureBreakdowns
        features={page.features}
        className=""
      />
      <ArchetypeListChanges
        casting={page.selected}
        spellNames={sheet.spellNames}
      />
    </Block>
  );
}

/** The Granted Spells under the record; Add mode shows the class list alone. */
function GrantedSection({ page }: { page: Page }) {
  if (!page.features || (page.isBrowsing && !page.readOnly)) return null;
  return (
    <GrantedSpells
      groups={page.features.grantedSpellsByLevel}
      descriptions={page}
      hasPendingChoice={
        page.selected?.unresolved.includes('grantedSpells') ?? false
      }
    />
  );
}

/** The record, Add mode, or a whole-list caster's read-only list. */
function SpellsBlock({ page }: { page: Page }) {
  const selected = page.selected;
  if (!selected) return null;
  const className = selected.name.toLowerCase();
  if (page.readOnly)
    return (
      <Block
        title={`The ${className} list`}
        aside={
          <span className="text-muted-foreground text-xs">
            Nothing to record.
          </span>
        }
      >
        <SpellBrowser page={page} />
      </Block>
    );
  if (!page.isBrowsing) return <SpellCollection page={page} />;
  return (
    <Block
      title={`Add to the ${page.collection?.heading?.toLowerCase() ?? 'record'}`}
      aside={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={page.leaveBrowser}
          className={headerAction}
        >
          Done
        </Button>
      }
    >
      <SpellBrowser page={page} />
    </Block>
  );
}

/**
 * The Spells page (approved spellcasting variant 3): the Character's
 * Spellcastings as tabs, the selected one's numbers, then its record by
 * level, or its class list in Add mode or for a whole-list caster, and its
 * Granted Spells (#415). Domain, school and bloodline picks and opposition
 * schools are made on the class feature rows of the sheet, not here. Spells
 * under no Spellcasting keep their own group, even when no Spellcasting is
 * left. The shell's "← Sheet" is the page's only way back.
 */
export function CharacterSpellsView({
  controller,
  scope,
  back,
}: {
  controller: Controller;
  scope: CharacterScope;
  back: BackLink;
}) {
  const page = useCharacterSpellsPage(scope, controller);
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const sheet = controller.sheet;
  if (!sheet) return null;
  return (
    <CharacterSheetFrame back={back}>
      <BreakdownResolverProvider
        previewSituation={controller.previewSituation}
        adjustments={sheet.adjustments}
        spellcastings={sheet.calculated.spellcastings}
        findPrerequisiteName={controller.findPrerequisiteName}
      >
        <MaintenanceReasonScope id={reasonId}>
          <div className="space-y-3">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-sans text-2xl">Spells</h1>
              <span className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
                {sheet.character.name}
              </span>
            </header>
            <MaintenanceReason id={reasonId} notice={maintenance} />
            <RemoteNotice
              isShown={page.writes.hasRemoteChange}
              message="Spells changed. Review the collection."
              subject="Spells"
              onDismiss={page.writes.dismissRemoteChange}
            />
            <RemoteNotice
              isShown={page.warnings.hasRemoteChange}
              message="Warnings updated by another player."
              subject="warnings"
              onDismiss={page.warnings.dismissRemoteChange}
            />
            <SpellcastingTabs page={page} sheet={sheet}>
              <NumbersBlock page={page} sheet={sheet} />
              <SpellsBlock page={page} />
              <GrantedSection page={page} />
            </SpellcastingTabs>
            <OrphanedSpells
              spells={page.spellsWithoutSpellcasting}
              writes={page.writes}
              warningController={page.warnings}
              isFramed
            />
            {page.selected ||
            page.spellsWithoutSpellcasting.length > 0 ? null : (
              <p className="text-muted-foreground text-sm">
                {sheet.character.name} has no Spellcasting.
              </p>
            )}
          </div>
        </MaintenanceReasonScope>
      </BreakdownResolverProvider>
    </CharacterSheetFrame>
  );
}
