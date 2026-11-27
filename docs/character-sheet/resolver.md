## Resolver

The resolver lives in `src/lib`, is pure, and is shared by the client and Convex:

```ts
type SourcedModifier = Modifier & { sheetEntryId: string; entryName: string; source: string; builtIn: boolean };

collectModifiers(character, entries, catalog): SourcedModifier[]   // active entries, their Item Abilities + built-ins from state
resolveSheet(modifiers, { permanentOnly?: boolean; situations?: Situation[] }): ResolvedSheet // staged; each statistic → { total, applied, suppressed, conditional }; plus one resolved Spellcasting per casting class
resolveRoutine(character, sheet, routine, { situations? }): { single, attacks }   // see "Attacks"
militiaCharacterFacts(character, entries, catalog): MilitiaCharacterFacts // permanentOnly; the one function the militia uses
calculatePointBuy({ baseModifiers, abilityMethod }): { spent: number | null } | null
sheetWarnings({ characterKind, base, levels, baseModifiers, creationSettings, pointBuy, hp }): SheetWarning[] // implemented; pure derived output, never stored
```
