'use client';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { AttackFieldFeedback } from './attack-field-feedback';
import {
  describeBonusEquivalent,
  toItemAbilityInputs,
  type ItemAbilityInput,
  type ItemAbilityOption,
  type ItemPartView,
} from './item-ability-options';
import { FoeField } from './foe-field';
import { chip, fieldLabel } from './sheet-parts';
import { useItemAbilityList } from './use-item-ability-list';

const hint = 'text-muted-foreground text-xs';
const mutedChip = cn(chip, 'text-muted-foreground');

type Row = {
  key: string;
  ref: ItemAbilityInput;
  name: string;
  bonusEquivalent: number;
  available: boolean;
  requiresChoice: 'creatureType' | null;
};

// The shown list is the saved one, or the one being saved or refused. Each
// reference reads through the resolver's ability at its place when it is
// the same one, else through its catalog option, else as unavailable.
function describeRows(
  list: readonly ItemAbilityInput[],
  part: ItemPartView,
  options: readonly ItemAbilityOption[],
): Row[] {
  return list.map((ref, index) => {
    const resolved = part.abilities[index];
    const key = `${index}:${ref.catalogEntryId}`;
    if (resolved?.catalogEntryId === ref.catalogEntryId)
      return {
        key,
        ref,
        name: resolved.name,
        bonusEquivalent: resolved.bonusEquivalent,
        available: resolved.available,
        requiresChoice: resolved.requiresChoice,
      };
    const option = options.find(
      (candidate) => candidate.catalogEntryId === ref.catalogEntryId,
    );
    return option
      ? {
          key,
          ref,
          name: option.name,
          bonusEquivalent: option.bonusEquivalent,
          available: true,
          requiresChoice: option.requiresChoice,
        }
      : {
          key,
          ref,
          name: 'Unavailable Item Ability',
          bonusEquivalent: 0,
          available: false,
          requiresChoice: null,
        };
  });
}

/**
 * One item part's Item Abilities (#408): the list it carries, each with its
 * bonus equivalent and Remove, bane's foe beneath it, and Add ability from
 * the abilities that suit this kind of item. Adding, removing or choosing a
 * foe saves the whole list at once with one acknowledgement; duplicates and
 * unsuitable abilities save and warn beneath the part rather than being
 * refused. Named with its end so the ends read apart.
 */
export function ItemAbilityField({
  endName,
  subject,
  part,
  options,
  save,
  isReadOnly,
  describedBy,
}: {
  /** "other end", "shield bash"; null for the item itself. */
  endName: string | null;
  /** Completes "Try again saving Item Abilities for …". */
  subject: string;
  part: ItemPartView;
  options: readonly ItemAbilityOption[];
  save: (abilities: ItemAbilityInput[]) => Promise<unknown>;
  isReadOnly: boolean;
  describedBy?: string;
}) {
  const abilities = useItemAbilityList({
    value: toItemAbilityInputs(part.abilities),
    save,
  });
  const rows = describeRows(abilities.list, part, options);
  const groupName = endName ? `Item Abilities, ${endName}` : 'Item Abilities';
  function change(next: ItemAbilityInput[]) {
    if (isReadOnly) return;
    void abilities.change(next);
  }
  return (
    <fieldset aria-label={groupName} className="min-w-0 space-y-1.5">
      <legend className={cn(fieldLabel, 'pb-1')}>Item Abilities</legend>
      {rows.length > 0 ? (
        <ul className="space-y-1">
          {rows.map((row, index) => {
            const bonus = describeBonusEquivalent(row.bonusEquivalent);
            return (
              <li key={row.key} className="space-y-1">
                <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 md:min-h-8">
                  <span
                    className={cn(
                      'min-w-0 text-sm [overflow-wrap:anywhere]',
                      !row.available && 'text-muted-foreground',
                    )}
                  >
                    {row.name}
                  </span>
                  {bonus ? <span className={mutedChip}>{bonus}</span> : null}
                  {row.available ? null : (
                    <span className={mutedChip}>Unavailable</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hover:text-destructive ml-auto size-11 shrink-0 md:size-8"
                    disabled={isReadOnly}
                    aria-describedby={describedBy}
                    onClick={() =>
                      change(abilities.list.filter((_, at) => at !== index))
                    }
                  >
                    <X aria-hidden className="size-4" />
                    <span className="sr-only">Remove {row.name}</span>
                  </Button>
                </div>
                {row.requiresChoice === 'creatureType' ? (
                  <FoeField
                    choice={row.ref.choice ?? null}
                    isDisabled={isReadOnly}
                    describedBy={describedBy}
                    onSave={(foe) =>
                      change(
                        abilities.list.map((ref, at) =>
                          at === index
                            ? {
                                catalogEntryId: ref.catalogEntryId,
                                ...(foe ? { choice: foe } : {}),
                              }
                            : ref,
                        ),
                      )
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={hint}>None.</p>
      )}
      {options.length > 0 ? (
        <Select
          value=""
          disabled={isReadOnly}
          onValueChange={(picked) => {
            const option = options.find(
              (candidate) => candidate.catalogEntryId === picked,
            );
            if (option)
              change([
                ...abilities.list,
                { catalogEntryId: option.catalogEntryId },
              ]);
          }}
        >
          <SelectTrigger
            aria-label={endName ? `Add ability, ${endName}` : 'Add ability'}
            aria-describedby={describedBy}
            className="h-11 w-full max-w-72 rounded-none font-mono text-sm md:h-8 md:py-1"
          >
            <SelectValue placeholder="Add ability" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => {
              const bonus = describeBonusEquivalent(option.bonusEquivalent);
              return (
                <SelectItem
                  key={option.catalogEntryId}
                  value={option.catalogEntryId}
                  textValue={option.name}
                >
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <span>{option.name}</span>
                      {bonus ? (
                        <span className="text-muted-foreground font-mono text-xs">
                          {bonus}
                        </span>
                      ) : null}
                    </span>
                    {option.description ? (
                      <span className="text-muted-foreground line-clamp-2 max-w-72 text-xs whitespace-normal">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : (
        <p className={hint}>No Item Abilities to add.</p>
      )}
      <AttackFieldFeedback
        status={abilities.status}
        label={`Item Abilities for ${subject}`}
        isDisabled={isReadOnly}
        onRetry={() => void abilities.retry()}
      />
    </fieldset>
  );
}
