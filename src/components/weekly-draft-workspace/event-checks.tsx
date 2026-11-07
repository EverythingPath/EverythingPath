import { EVENT_CHECK_SOURCES } from './event-check-facts';
import type { EventView } from './types';
export function EventChecks({
  item,
  view,
  exclude = [],
}: {
  item: EventView['occurrences'][number];
  view: EventView;
  // Checks another control already shows.
  exclude?: readonly string[];
}) {
  const occurrence = item.occurrence;
  const inputModifiers = [
    occurrence.tableRoll,
    occurrence.officerCheck?.roll,
    ...Object.values(occurrence.rolls ?? {}),
    ...Object.values(occurrence.sabotage?.rolls ?? {}),
    ...(occurrence.targetChecks ?? []).flatMap((target) =>
      Object.values(target.rolls ?? {}),
    ),
  ].flatMap((roll) => roll?.modifiers ?? []);
  const checks = view.checks.filter(
    (check) =>
      check.checkId.startsWith(`${occurrence.eventId}:`) &&
      !exclude.includes(check.checkId),
  );
  return checks.map((check) => {
    const target = [
      ...(view.options.characterId ?? []),
      ...(view.options.cacheId ?? []),
    ].find((target) => check.checkId.includes(`:${target.value}:`));
    // Safe cast: split(':') never returns an empty array, so at(-1) is set.
    const kind = check.checkId.includes(':sabotage:')
      ? 'Sabotage'
      : ({
          sickness: 'Sickness',
          theft: 'Theft',
          rivalry: 'Rivalry',
          diplomacy: 'Diplomacy',
          mitigation: 'Mitigation',
        }[check.checkId.split(':').at(-1)!] ?? 'Event');
    return (
      <div key={check.checkId} className="space-y-1 text-sm">
        <p>
          {target ? `${target.label} · ` : ''}
          {kind} check · Calculated bonus: {check.modifier >= 0 ? '+' : ''}
          {check.modifier} · Total: {check.total ?? 'Awaiting roll'}
        </p>
        <ul
          aria-label={`${kind} modifiers`}
          className="text-muted-foreground space-y-1 text-xs"
        >
          {check.modifiers.map((modifier) => (
            <li key={modifier.source}>
              {inputModifiers.find(
                (input) => input.sourceId === modifier.source,
              )?.reason ??
                view.options.modifierSources?.find(
                  (option) => option.value === modifier.source,
                )?.label ??
                EVENT_CHECK_SOURCES[modifier.source] ??
                'Calculated modifier'}
              : {modifier.value >= 0 ? '+' : ''}
              {modifier.value}
            </li>
          ))}
        </ul>
      </div>
    );
  });
}
