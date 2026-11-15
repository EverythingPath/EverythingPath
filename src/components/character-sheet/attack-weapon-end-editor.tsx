'use client';
import type { ItemPart } from '~/lib/character-sheet-attack-types';
import { cn } from '~/lib/utils';
import { listItemPartWarnings } from './equipment-statistics';
import { InlineWarnings } from './inline-warning';
import {
  bashHint,
  findItemPart,
  listItemAbilityOptions,
  type ItemPartsView,
} from './item-ability-options';
import { ItemAbilityField } from './item-ability-field';
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
type Weapon = Attacks['weapons'][number];
export type { AttackWeaponEnd as WeaponEnd } from '~/lib/character-sheet-attack-types';
import type { AttackWeaponEnd as WeaponEnd } from '~/lib/character-sheet-attack-types';

const endLabels = { primary: 'Primary end', otherEnd: 'Other end' } as const;

/**
 * One end of a Gear weapon, edited in the routine's panel: Masterwork,
 * Enhancement, Material and its Item Abilities (#408). They belong to the
 * weapon, so every routine using it shares them. Each field saves at once
 * with its acknowledgement beside it; a double weapon's two ends save
 * separately, and a shield's details are its bash's, with their own
 * enhancement apart from its AC bonus. The part's construction warnings
 * read beneath its fields. Keyed by the Gear weapon and end.
 */
export function AttackWeaponEndEditor({
  weapon,
  end,
  attacks,
  isReadOnly,
  describedBy,
  itemParts,
  catalogEntries = [],
  spellEffects = [],
  warnings,
  warningController,
}: {
  weapon: Weapon;
  end: WeaponEnd;
  attacks: Attacks;
  isReadOnly: boolean;
  describedBy?: string;
  /** Every item's parts as the resolver states them; without, no abilities. */
  itemParts?: readonly ItemPartsView[];
  /** The sheet's Spell Effects, for the chips of those targeting this end. */
  spellEffects?: readonly SpellEffectView[];
  /** The definitions the Item Ability picker offers from. */
  catalogEntries?: readonly CatalogDefinition[];
  warnings?: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  const isDouble = weapon.weapon.otherEnd !== undefined;
  const isBash = end === 'primary' && weapon.primaryPart === 'bash';
  const part: ItemPart = end === 'primary' ? weapon.primaryPart : 'otherEnd';
  const endName = isBash
    ? 'shield bash'
    : isDouble
      ? endLabels[end].toLowerCase()
      : null;
  const subject = endName ? `${weapon.label}, ${endName}` : weapon.label;
  const resolved = findItemPart(itemParts, weapon.entryId, part);
  const partWarnings =
    warnings && warningController
      ? listItemPartWarnings(warnings, weapon.entryId, part)
      : [];
  return (
    <ItemPartEditor
      subject={subject}
      legend={
        <>
          <span className="min-w-0 font-sans text-sm [overflow-wrap:anywhere]">
            {weapon.label}
          </span>
          {endName ? (
            <span className={cn(chip, 'text-muted-foreground')}>
              {isBash ? 'Shield bash' : endLabels[end]}
            </span>
          ) : null}
        </>
      }
      hint={isBash ? bashHint : undefined}
      value={end === 'primary' ? weapon.primaryState : weapon.otherEndState}
      save={(patch) => attacks.saveWeaponEnd(weapon.entryId, end, patch)}
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
        entryId={weapon.entryId}
        part={part}
      />
      {resolved ? (
        <ItemAbilityField
          endName={endName}
          subject={subject}
          part={resolved}
          options={listItemAbilityOptions(catalogEntries, resolved.kind)}
          save={(abilities) =>
            attacks.saveWeaponEnd(weapon.entryId, end, { abilities })
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
