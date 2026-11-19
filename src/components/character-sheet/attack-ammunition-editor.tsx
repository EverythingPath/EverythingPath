'use client';
import { cn } from '~/lib/utils';
import { listItemPartWarnings } from './equipment-statistics';
import { InlineWarnings } from './inline-warning';
import { ItemAbilityField } from './item-ability-field';
import {
  findItemPart,
  listItemAbilityOptions,
  type ItemPartsView,
} from './item-ability-options';
import { ItemPartEditor } from './item-part-editor';
import type { CatalogDefinition } from './sheet-catalog-context';
import { chip } from './sheet-parts';
import {
  SpellEffectTargetChips,
  type SpellEffectView,
} from './spell-effect-target-chips';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Attacks = Controller['attacks'];
type Ammunition = Attacks['ammunition'][number];

/**
 * The routine's ammunition, edited in its panel beside the weapon's ends
 * (#408): Masterwork, Enhancement, Material and its Item Abilities. They
 * belong to the ammunition, so every routine firing it shares them; its
 * enhancement competes with the launcher's. Each field saves at once with
 * its acknowledgement beside it, and its construction warnings read beneath
 * its fields. Keyed by the Gear ammunition.
 */
export function AttackAmmunitionEditor({
  ammunition,
  attacks,
  isReadOnly,
  describedBy,
  itemParts,
  catalogEntries = [],
  spellEffects = [],
  warnings,
  warningController,
}: {
  ammunition: Ammunition;
  attacks: Attacks;
  isReadOnly: boolean;
  describedBy?: string;
  /** Every item's parts as the resolver states them; without, no abilities. */
  itemParts?: readonly ItemPartsView[];
  /** The sheet's Spell Effects, for the chips of those targeting the ammunition. */
  spellEffects?: readonly SpellEffectView[];
  /** The definitions the Item Ability picker offers from. */
  catalogEntries?: readonly CatalogDefinition[];
  warnings?: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  const subject = `${ammunition.label}, ammunition`;
  const resolved = findItemPart(itemParts, ammunition.entryId, 'primary');
  const partWarnings =
    warnings && warningController
      ? listItemPartWarnings(warnings, ammunition.entryId, 'primary')
      : [];
  return (
    <ItemPartEditor
      subject={subject}
      legend={
        <>
          <span className="min-w-0 font-sans text-sm [overflow-wrap:anywhere]">
            {ammunition.label}
          </span>
          <span className={cn(chip, 'text-muted-foreground')}>Ammunition</span>
        </>
      }
      value={ammunition.state}
      save={(patch) => attacks.saveAmmunition(ammunition.entryId, patch)}
      operationId={attacks.operationId}
      isReadOnly={isReadOnly}
      describedBy={describedBy}
      isMasterworkImplied={
        resolved ? resolved.masterwork && !resolved.recordedMasterwork : false
      }
      material={{ kind: 'text' }}
    >
      <SpellEffectTargetChips
        spellEffects={spellEffects}
        entryId={ammunition.entryId}
        part="primary"
      />
      {resolved ? (
        <ItemAbilityField
          endName="ammunition"
          subject={subject}
          part={resolved}
          options={listItemAbilityOptions(catalogEntries, resolved.kind)}
          save={(abilities) =>
            attacks.saveAmmunition(ammunition.entryId, { abilities })
          }
          isReadOnly={isReadOnly}
          describedBy={describedBy}
        />
      ) : null}
      {warningController && partWarnings.length > 0 ? (
        <InlineWarnings
          warnings={partWarnings}
          controller={warningController}
        />
      ) : null}
    </ItemPartEditor>
  );
}
