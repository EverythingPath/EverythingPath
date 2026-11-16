'use client';
import { RadioGroupItem } from '~/components/ui/radio-group';
import { pointCount } from '~/lib/character-sheet-eidolon-progression';
import { chip } from './sheet-parts';
import type { EvolutionCatalogEntry } from './use-eidolon-evolution-picker-form';

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'flex-col items-start justify-start gap-1 px-3 py-2 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/** What the card states and, in muted text, which stated requirement the sheet does not meet now. A display comparison only. */
function requirementLines({
  evolution,
  summonerLevel,
  reductionLabel,
  baseFormName,
  subtypeName,
}: {
  evolution: EvolutionCatalogEntry;
  summonerLevel: number | null;
  reductionLabel: string | null;
  baseFormName: string | null;
  subtypeName: string | null;
}) {
  const stated: string[] = [];
  const unmet: string[] = [];
  if (evolution.minimumLevel !== null) {
    stated.push(`Summoner level ${evolution.minimumLevel}`);
    if (summonerLevel !== null && summonerLevel < evolution.minimumLevel)
      unmet.push(
        reductionLabel
          ? `Needs summoner level ${evolution.minimumLevel}; ${reductionLabel} counts the summoner level as ${summonerLevel}.`
          : `Needs summoner level ${evolution.minimumLevel}; the summoner level is ${summonerLevel}.`,
      );
  }
  if (evolution.baseForms) {
    stated.push(`${evolution.baseForms.join(' or ')} only`);
    if (baseFormName !== null && !evolution.baseForms.includes(baseFormName))
      unmet.push(`Not for the ${baseFormName} base form.`);
  }
  if (evolution.subtypes) {
    stated.push(`${evolution.subtypes.join(', ')} only`);
    if (subtypeName !== null && !evolution.subtypes.includes(subtypeName))
      unmet.push(`Not for the ${subtypeName} subtype.`);
  }
  return { stated, unmet };
}

/** One evolution as a selectable card: name, cost, summary and requirements. */
export function EidolonEvolutionCard({
  evolution,
  summonerLevel,
  reductionLabel,
  baseFormName,
  subtypeName,
  reasonId,
}: {
  evolution: EvolutionCatalogEntry;
  /** The level the eidolon table is read at. */
  summonerLevel: number | null;
  /** The rule that reduced the summoner level to that, when one applies. */
  reductionLabel: string | null;
  baseFormName: string | null;
  /** The counting Unchained subtype; null for an original eidolon. */
  subtypeName: string | null;
  reasonId: string | undefined;
}) {
  const { stated, unmet } = requirementLines({
    evolution,
    summonerLevel,
    reductionLabel,
    baseFormName,
    subtypeName,
  });
  return (
    <RadioGroupItem
      value={evolution.key}
      className={card}
      aria-describedby={reasonId}
    >
      <span className="flex w-full flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {evolution.name}
        </span>
        <span className={chip}>{pointCount(evolution.cost)}</span>
      </span>
      <span className={note}>{evolution.summary}</span>
      {stated.length > 0 ? (
        <span className={note}>{stated.join(' · ')}</span>
      ) : null}
      {unmet.map((line) => (
        <span key={line} className={note}>
          {line}
        </span>
      ))}
    </RadioGroupItem>
  );
}
