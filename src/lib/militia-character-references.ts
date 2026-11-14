import type { Doc } from '../../convex/_generated/dataModel';

type MilitiaSnapshot = Doc<'canonicalMilitiaState'>['snapshot'];
type WeeklyDraft = Doc<'canonicalWeeklyDraft'>['draft'];
type JoinPath<Prefix extends string, Tail extends string> = Tail extends ''
  ? Prefix
  : `${Prefix}.${Tail}`;
type StringLeafPath<Value> = Value extends string
  ? ''
  : Value extends readonly (infer Item)[]
    ? JoinPath<'*', StringLeafPath<Item>>
    : Value extends object
      ? {
          [Key in keyof Value & string]: JoinPath<
            Key,
            StringLeafPath<Value[Key]>
          >;
        }[keyof Value & string]
      : never;

// Exact schema paths; * selects array members, never arbitrary object keys.
// Schema metadata coverage requires new Character references to be listed here.
export const militiaSnapshotCharacterReferencePaths = [
  'characters.*.characterId',
  'roster.people.*.characterId',
  'roster.officers.*.characterId',
  'roster.teams.*.managerCharacterId',
  'economy.items.*.ownerCharacterId',
  'characterActions.people.*.characterId',
  'eventBenefits.skills.*.characterIds.*',
] as const satisfies readonly StringLeafPath<MilitiaSnapshot>[];

export const weeklyDraftCharacterReferencePaths = [
  'context.carriedEvents.*.targets.*.characterId',
  'activity.slots.*.choice.characterId',
  'activity.slots.*.choice.candidates.*.officerCheck.characterId',
  'activity.slots.*.choice.candidates.*.targets.*.characterId',
  'activity.slots.*.choice.candidates.*.persistentDecision.officerCheck.characterId',
  'activity.slots.*.choice.candidates.*.persistentDecision.overseerCharacterId',
  'activity.slots.*.choice.candidates.*.overseerCharacterId',
  'activity.slots.*.choice.candidates.*.targetChecks.*.target.characterId',
  'activity.slots.*.choice.candidates.*.rewards.*.characterId',
  'event.occurrences.*.officerCheck.characterId',
  'event.occurrences.*.targets.*.characterId',
  'event.occurrences.*.persistentDecision.officerCheck.characterId',
  'event.occurrences.*.persistentDecision.overseerCharacterId',
  'event.occurrences.*.overseerCharacterId',
  'event.occurrences.*.targetChecks.*.target.characterId',
  'event.occurrences.*.rewards.*.characterId',
  'persistent.decisions.*.officerCheck.characterId',
  'persistent.decisions.*.overseerCharacterId',
] as const satisfies readonly StringLeafPath<WeeklyDraft>[];

function referencesAtPaths(value: unknown, paths: readonly string[]): string[] {
  const ids = new Set<string>();
  function visit(node: unknown, fields: string[], index: number) {
    if (index === fields.length) {
      if (typeof node === 'string') ids.add(node);
      return;
    }
    const field = fields[index];
    if (field === '*') {
      if (Array.isArray(node))
        for (const item of node) visit(item, fields, index + 1);
    } else if (
      field !== undefined &&
      typeof node === 'object' &&
      node !== null &&
      field in node
    ) {
      visit(Reflect.get(node, field), fields, index + 1);
    }
  }
  for (const path of paths) visit(value, path.split('.'), 0);
  return [...ids];
}

export function militiaSnapshotCharacterReferences(snapshot: MilitiaSnapshot) {
  return referencesAtPaths(snapshot, militiaSnapshotCharacterReferencePaths);
}

export function weeklyDraftCharacterReferences(draft: WeeklyDraft) {
  return referencesAtPaths(draft, weeklyDraftCharacterReferencePaths);
}
