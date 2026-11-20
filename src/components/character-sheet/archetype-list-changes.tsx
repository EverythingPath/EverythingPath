'use client';
import { useId } from 'react';
import {
  describeProvenance,
  type SpellNames,
} from './archetype-casting-view-model';
import { fieldLabel } from './sheet-parts';
import type { Spellcasting } from './spellcasting-parts';

/**
 * The Spells an Archetype adds to or removes from a Spellcasting's list
 * (#422), under the Spells page numbers: "Daylight added at level 3 from
 * Psychic Detective", "Fireball removed". Nothing renders without a change.
 */
export function ArchetypeListChanges({
  casting,
  spellNames,
}: {
  casting: Spellcasting;
  spellNames: SpellNames;
}) {
  const headingId = useId();
  const { added, removed } = casting.spellList;
  if (added.length === 0 && removed.length === 0) return null;
  const sourceOf = (ruleIdentity: string) => {
    const property = casting.castingProperties.find(
      (row) => row.key === `spellList:${ruleIdentity}`,
    );
    return property ? describeProvenance(property) : null;
  };
  const rows = [
    ...added.map((row) => ({
      key: `added:${row.ruleIdentity}`,
      text: `${spellNames[row.catalogEntryId] ?? spellNames[row.ruleIdentity] ?? row.ruleIdentity} added at level ${row.spellLevel}`,
      source: sourceOf(row.ruleIdentity),
    })),
    ...removed.map((ruleIdentity) => ({
      key: `removed:${ruleIdentity}`,
      text: `${spellNames[ruleIdentity] ?? ruleIdentity} removed`,
      source: sourceOf(ruleIdentity),
    })),
  ];
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="border-foreground/10 mt-3 flex flex-col gap-1 border-t pt-2"
    >
      <p id={headingId} className={fieldLabel}>
        Archetype list changes
      </p>
      <ul className="flex flex-col gap-0.5 text-sm sm:flex-row sm:flex-wrap sm:gap-x-4">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-baseline gap-x-1.5 [overflow-wrap:anywhere]"
          >
            <span>{row.text}</span>
            {row.source ? (
              <span className="text-muted-foreground text-xs">
                {row.source}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
