'use client';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import { Block, chip, fieldLabel } from './sheet-parts';
import { SpellName } from './spell-name';
import { schoolChoice } from './spell-school-choice';
import type { SpellcastingFeaturesView } from './spellcasting-features-view-model';
import {
  formatSpellLevel,
  formatSpellLevelHeading,
} from './spellcasting-parts';
import type { useSpellDescriptionExpansion } from './use-spell-description-expansion';

type Groups = SpellcastingFeaturesView['grantedSpellsByLevel'];
type GrantedSpell = Groups[number]['spells'][number];
type Descriptions = ReturnType<typeof useSpellDescriptionExpansion>;

const tag = cn(
  chip,
  'border-sky-400/60 px-1 py-0 text-[11px] whitespace-nowrap text-sky-300',
);

// The same dense row as a recorded Spell, less its record check: level,
// school, name with its granted chip naming every source ("granted · Fire
// Domain, Sun Domain") and tag, the description beside it from tablet width
// and under it on a tap of the name on the phone.
function GrantedSpellRow({
  spell,
  descriptions,
}: {
  spell: GrantedSpell;
  descriptions: Descriptions;
}) {
  const panelId = useId();
  const isExpanded = descriptions.isDescriptionExpanded(spell.key);
  const school = spell.school ? schoolChoice(spell.school) : null;
  return (
    <li className="border-foreground/10 grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-2 border-b py-0.5 last:border-b-0 md:grid-cols-[2.5rem_3rem_minmax(0,19rem)_minmax(0,1fr)] md:gap-x-3 lg:grid-cols-[2.5rem_3rem_minmax(0,23rem)_minmax(0,1fr)]">
      <span className="col-start-1 row-start-1 text-center font-mono text-base">
        {formatSpellLevel(spell.spellLevel)}
      </span>
      <span
        className="text-muted-foreground hidden font-mono text-sm md:col-start-2 md:row-start-1 md:inline"
        title={school?.label}
      >
        {school?.abbreviation}
      </span>
      <span className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:col-start-3">
        <SpellName
          name={spell.name}
          panelId={panelId}
          isExpanded={isExpanded}
          onToggle={() => descriptions.toggleDescription(spell.key)}
        />
        {school ? (
          <span
            className="text-muted-foreground font-mono text-xs md:hidden"
            title={school.label}
          >
            {school.abbreviation}
          </span>
        ) : null}
        <span
          className={tag}
          title={`Granted by ${spell.sources
            .map((source) => source.name)
            .join(' and ')}: always available, never recorded.`}
        >
          granted · {spell.sourceNames}
        </span>
        {spell.domainSlotOnly ? (
          <span
            className={tag}
            title="Not on the class list: prepared only in the domain slot."
          >
            domain slot only
          </span>
        ) : null}
      </span>
      <span
        className="text-muted-foreground hidden min-w-0 truncate text-sm md:col-start-4 md:row-start-1 md:block"
        title={spell.description}
      >
        {spell.description}
      </span>
      {isExpanded ? (
        <p
          id={panelId}
          className="text-muted-foreground col-span-full col-start-2 pb-1.5 text-xs [overflow-wrap:anywhere] md:hidden"
        >
          {[school?.label, spell.description].filter(Boolean).join(' · ')}
        </p>
      ) : null}
    </li>
  );
}

function LevelGroup({
  group,
  descriptions,
}: {
  group: Groups[number];
  descriptions: Descriptions;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="pt-2 first:pt-0">
      <h3
        id={headingId}
        className={cn(
          fieldLabel,
          'flex flex-wrap items-baseline gap-x-2 pb-0.5',
        )}
      >
        <span className="text-foreground">
          {formatSpellLevelHeading(group.spellLevel)}
        </span>
        <span>{group.spells.length} granted</span>
      </h3>
      <ul>
        {group.spells.map((spell) => (
          <GrantedSpellRow
            key={spell.key}
            spell={spell}
            descriptions={descriptions}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * The Granted Spells of a Spellcasting (#415), under its recorded Spells:
 * domain, bloodline and school Spells by level, each naming every feature
 * or Archetype granting it.
 * They are derived, never recorded or counted, so no row has a check or
 * Remove; a domain Spell off the class list says it fits the domain slot
 * only. Nothing renders without Granted Spells, unless some wait for an
 * Archetype choice (#422), which the group then says.
 */
export function GrantedSpells({
  groups,
  descriptions,
  hasPendingChoice = false,
}: {
  groups: Groups;
  descriptions: Descriptions;
  /** An Archetype choice still decides some of the Granted Spells. */
  hasPendingChoice?: boolean;
}) {
  const count = groups.reduce((sum, group) => sum + group.spells.length, 0);
  if (count === 0 && !hasPendingChoice) return null;
  return (
    <Block
      title="Granted Spells"
      aside={
        count > 0 ? (
          <span className="text-muted-foreground font-mono text-sm">
            {count} granted
          </span>
        ) : null
      }
    >
      {hasPendingChoice ? (
        <p className="mb-1 text-xs text-sky-300">
          Some Granted Spells wait for a choice
        </p>
      ) : null}
      {groups.map((group) => (
        <LevelGroup
          key={group.spellLevel}
          group={group}
          descriptions={descriptions}
        />
      ))}
    </Block>
  );
}
