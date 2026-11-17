'use client';

/** Extra dice an Item Ability adds in a Situation: "Bane" "+2d6 vs. undead". */
export type SituationDice = { text: string; source: string };

/** The dice a Situation adds, credited to their Item Ability (#408). */
export function SituationDiceLines({
  dice,
}: {
  dice: readonly SituationDice[] | undefined;
}) {
  if (!dice || dice.length === 0) return null;
  // Two banes against the same foe read as two lines.
  const seen = new Map<string, number>();
  const keyed = dice.map((part) => {
    const text = `${part.source}|${part.text}`;
    const count = (seen.get(text) ?? 0) + 1;
    seen.set(text, count);
    return { part, key: `${text}|${count}` };
  });
  return (
    <ul className="space-y-0.5 pl-3">
      {keyed.map(({ part, key }) => (
        <li key={key} className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate">{part.source}</span>
          <span className="text-muted-foreground font-mono text-[11px]">
            extra dice
          </span>
          <span className="font-mono">{part.text}</span>
        </li>
      ))}
    </ul>
  );
}
