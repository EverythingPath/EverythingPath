'use client';
import { listItemPartWarnings } from './equipment-statistics';
import { InlineWarnings } from './inline-warning';
import { ItemAbilityField } from './item-ability-field';
import {
  bashHint,
  describeBakedMaterial,
  describeItemPart,
  listItemAbilityOptions,
  type ItemPartsView,
  type ItemPartView,
} from './item-ability-options';
import { ItemPartEditor } from './item-part-editor';
import type { CatalogDefinition } from './sheet-catalog-context';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * One part of a Gear item in its panel (#408): the armor or shield, or a
 * shield's bash, with its enhancement, masterwork, material and Item
 * Abilities saved at once, field by field, and its construction warnings
 * beneath. A specific item's own material is a fact rather than a choice.
 */
export function EquipmentPartSection({
  entryId,
  part,
  bakedMaterial,
  equipment,
  catalogEntries,
  operationId,
  isReadOnly,
  describedBy,
  warnings,
  warningController,
}: {
  entryId: string;
  part: ItemPartView;
  bakedMaterial: ItemPartsView['bakedMaterial'];
  equipment: Controller['equipment'];
  catalogEntries: readonly CatalogDefinition[];
  operationId?: string | null;
  isReadOnly: boolean;
  describedBy?: string;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const title = describeItemPart(part);
  return (
    <section className="border-foreground/15 border-t pt-3 first:border-t-0 first:pt-0">
      <ItemPartEditor
        subject={title}
        legend={<span className="min-w-0 font-sans text-sm">{title}</span>}
        hint={part.part === 'bash' ? bashHint : undefined}
        value={{
          masterwork: part.recordedMasterwork,
          enhancement: part.enhancement,
          material: part.material,
        }}
        save={(patch) => equipment.save(entryId, { ...patch, end: part.part })}
        operationId={operationId}
        isReadOnly={isReadOnly}
        describedBy={describedBy}
        isMasterworkImplied={part.masterwork && !part.recordedMasterwork}
        material={
          part.part === 'primary' && bakedMaterial
            ? { kind: 'fact', text: describeBakedMaterial(bakedMaterial) }
            : { kind: 'select' }
        }
        hasStepper
      >
        <ItemAbilityField
          endName={part.part === 'primary' ? null : title.toLowerCase()}
          subject={title}
          part={part}
          options={listItemAbilityOptions(catalogEntries, part.kind)}
          save={(abilities) =>
            equipment.save(entryId, { abilities, end: part.part })
          }
          isReadOnly={isReadOnly}
          describedBy={describedBy}
        />
        <InlineWarnings
          warnings={listItemPartWarnings(warnings, entryId, part.part)}
          controller={warningController}
        />
      </ItemPartEditor>
    </section>
  );
}
