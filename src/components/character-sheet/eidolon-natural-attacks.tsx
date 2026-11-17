'use client';
import { TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  cloneWeaponDetail,
  createNaturalAttackWeapon,
  naturalAttackProfiles,
} from '~/lib/character-sheet-natural-attacks';
import { cn } from '~/lib/utils';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import { NaturalAttackEditor } from './natural-attack-editor';
import { action, chip, fieldLabel } from './sheet-parts';
import type { SheetEntryInput } from './use-character-sheet-entries';

type Projection = EidolonProgressionView['ordinary'];
type NaturalAttack = Projection['naturalAttacks'][number];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';

/**
 * What a new natural attack starts as, from the evolution that grants it:
 * its type, primary or secondary, and the printed Medium dice. The sheet
 * scales the dice by size itself.
 */
function prefillFor(attack: NaturalAttack): SheetEntryInput {
  const weapon = createNaturalAttackWeapon(attack.type);
  return {
    name: naturalAttackProfiles[attack.type].name,
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        ...cloneWeaponDetail(weapon),
        dice: attack.mediumDice ?? weapon.dice,
        naturalAttack: { type: attack.type, role: attack.role },
      },
    },
  };
}

/**
 * The natural attacks the evolutions give, counted against the eidolon's
 * maximum: each type with its count, dice and role, how many the sheet
 * already records, and Add for the rest. Add opens the natural attack
 * editor (#323) prefilled from the evolution; the entry it writes is an
 * ordinary natural attack of this sheet.
 */
export function EidolonNaturalAttacks({
  projection,
  isDisabled,
  reasonId,
  createNaturalAttack,
}: {
  projection: Projection;
  isDisabled: boolean;
  reasonId: string | undefined;
  /** Absent, the attacks are listed without Add. */
  createNaturalAttack?: (input: SheetEntryInput) => Promise<unknown>;
}) {
  const [adding, setAdding] = useState<NaturalAttack['type'] | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const editing = projection.naturalAttacks.find(
    (attack) => attack.type === adding,
  );
  const limit = projection.maxAttacks ?? 'Unresolved';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className={fieldLabel}>Natural attacks</h4>
        <span
          className={cn(
            chip,
            'gap-1',
            projection.isOverAttackLimit &&
              'border-amber-500/60 text-amber-300',
          )}
        >
          {projection.isOverAttackLimit ? (
            <TriangleAlert aria-hidden className="size-3" />
          ) : null}
          {projection.attackCount} of max {limit}
        </span>
        {projection.multiattack ? (
          <span className={chip}>Multiattack</span>
        ) : null}
      </div>
      {projection.naturalAttacks.length > 0 ? (
        <ul
          aria-label="Natural attacks"
          className="divide-foreground/10 divide-y"
        >
          {projection.naturalAttacks.map((attack) => (
            <li
              key={attack.type}
              aria-label={attack.name}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm">{attack.name}</span>
                <span className={note}>
                  {attack.count} × {attack.dice ?? 'Unresolved'} ·{' '}
                  {attack.roleLabel} · {attack.recorded} of {attack.count}{' '}
                  recorded
                </span>
              </div>
              {attack.missing > 0 && createNaturalAttack ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={action}
                  aria-describedby={reasonId}
                  disabled={isDisabled}
                  onClick={(event) => {
                    opener.current = event.currentTarget;
                    setAdding(attack.type);
                  }}
                >
                  Add {attack.name}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={note}>No natural attacks from evolutions.</p>
      )}
      {editing && createNaturalAttack ? (
        <NaturalAttackEditor
          prefill={prefillFor(editing)}
          save={createNaturalAttack}
          onClose={() => {
            setAdding(null);
            opener.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
