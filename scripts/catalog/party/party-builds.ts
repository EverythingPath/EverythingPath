import { readFile } from 'node:fs/promises';
import { z } from 'zod';

/**
 * The party's builds (`party-builds.json`), hand-kept from the owner's paper
 * sheets: each character by number, never a player or character name, with its
 * classes and levels now and at the next level and the catalog keys it uses,
 * grouped by kind. A row nobody could match stays as an `unmatched` entry, and
 * a fact the sheet doesn't settle is `open`, so both are counted, never
 * guessed. `catalog:party-scope` takes the matched keys as the party scope's
 * roots.
 */
export const partyBuildsPath = 'scripts/catalog/party/party-builds.json';

/**
 * The catalog kinds a key under each group may have; `buildPartyScope`
 * refuses a key whose catalog entry has another kind.
 */
export const partyGroups = [
  'racialTraits',
  'classes',
  'archetypes',
  'bloodlinesAndDomains',
  'classFeatures',
  'feats',
  'traits',
  'spells',
  'equipment',
  'companion',
] as const;
export const partyGroupKinds = {
  racialTraits: ['racialTrait'],
  classes: ['class'],
  archetypes: ['archetype'],
  bloodlinesAndDomains: ['classFeature'],
  classFeatures: ['classFeature'],
  feats: ['feat'],
  traits: ['trait'],
  spells: ['spell'],
  equipment: ['item', 'itemAbility'],
  companion: ['companion', 'companionFeature'],
} as const satisfies Record<
  (typeof partyGroups)[number],
  readonly [string, ...string[]]
>;
/** The race's kinds, for the character's one race. */
export const partyRaceKinds = ['race'] as const;
export type PartyGroup = (typeof partyGroups)[number] | 'race';

const text = z.string().trim().min(1);
const catalogKey = z.string().regex(/^[a-z0-9-]+\/[A-Za-z0-9_.-]+$/);
const matched = z.strictObject({
  kind: z.literal('matched'),
  key: catalogKey,
  name: text,
  note: text.optional(),
});
const unmatched = z.strictObject({
  kind: z.literal('unmatched'),
  name: text,
  note: text,
});
const entry = z.discriminatedUnion('kind', [matched, unmatched]);
const nonEmpty = <T extends z.ZodTypeAny>(item: T) =>
  z.tuple([item]).rest(item);
const entries = nonEmpty(entry).optional();
const groups = z.strictObject({
  racialTraits: entries,
  classes: entries,
  archetypes: entries,
  bloodlinesAndDomains: entries,
  classFeatures: entries,
  feats: entries,
  traits: entries,
  spells: entries,
  equipment: entries,
  companion: entries,
} satisfies Record<(typeof partyGroups)[number], typeof entries>);
const classLevel = z.strictObject({
  class: text,
  level: z.number().int().min(1).max(20),
});
const next = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('known'), classes: nonEmpty(classLevel) }),
  /** The sheet doesn't say which class takes the next level. */
  z.strictObject({
    kind: z.literal('open'),
    characterLevel: z.number().int().min(2).max(20),
    note: text,
  }),
]);
const build = z.strictObject({ now: nonEmpty(classLevel), next });
const levels = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('written'), build }),
  z.strictObject({ kind: z.literal('inferred'), build, note: text }),
  /** Two or more builds the sheet allows; each is carried. */
  z.strictObject({
    kind: z.literal('open'),
    builds: z.tuple([build, build]).rest(build),
    note: text,
  }),
]);
const race = z.discriminatedUnion('kind', [
  matched,
  z.strictObject({ kind: z.literal('open'), note: text }),
]);
const characterId = z.string().regex(/^[1-9][0-9]*$/);
const character = z.discriminatedUnion('kind', [
  z.strictObject({
    id: characterId,
    kind: z.literal('character'),
    race,
    levels,
    keys: groups,
  }),
  z.strictObject({
    id: z.string().regex(/^[1-9][0-9]*c$/),
    kind: z.literal('companion'),
    companionOf: characterId,
    hitDice: z.number().int().min(1).max(20),
    keys: groups,
  }),
]);

const partyBuildsObject = z.strictObject({
  schemaVersion: z.literal(1),
  scopeVersion: z.literal('campaign-party-v1'),
  note: text,
  characters: nonEmpty(character),
});
export const partyBuildsSchema = partyBuildsObject.superRefine(
  (builds, context) => {
    for (const message of partyBuildsProblems(builds))
      context.addIssue({ code: 'custom', message });
  },
);
export type PartyBuilds = z.infer<typeof partyBuildsObject>;

/** What the schema alone can't refuse: ids, companions, keys and levels across the file. */
function partyBuildsProblems(builds: PartyBuilds): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const { id } of builds.characters) {
    if (ids.has(id)) problems.push(`Character ${id} appears twice.`);
    ids.add(id);
  }
  const groupOf = new Map<string, PartyGroup>();
  for (const character of builds.characters) {
    if (character.kind === 'companion')
      problems.push(...companionProblems(character, builds.characters));
    else problems.push(...levelProblems(character));
    const seen = new Set<string>();
    for (const [group, key] of partyCharacterKeys(character)) {
      if (seen.has(key))
        problems.push(`Character ${character.id} names ${key} twice.`);
      seen.add(key);
      const prior = groupOf.get(key);
      if (prior && prior !== group)
        problems.push(`${key} is under ${prior} and ${group}.`);
      groupOf.set(key, group);
    }
  }
  return problems;
}

function companionProblems(
  companion: Extract<PartyCharacter, { kind: 'companion' }>,
  characters: readonly PartyCharacter[],
) {
  const master = characters.find(({ id }) => id === companion.companionOf);
  if (master?.kind !== 'character')
    return [
      `Companion ${companion.id} belongs to no character ${companion.companionOf}.`,
    ];
  return companion.id === `${companion.companionOf}c`
    ? []
    : [
        `Companion ${companion.id} is not numbered after character ${companion.companionOf}.`,
      ];
}

const levelTotal = (levels: readonly { level: number }[]) =>
  levels.reduce((sum, { level }) => sum + level, 0);

/** A build's levels are in the character's classes, and each class has one. */
function classProblems(
  id: string,
  classes: ReadonlySet<string>,
  { now, next }: z.infer<typeof build>,
) {
  const problems: string[] = [];
  const named = [...now, ...(next.kind === 'known' ? next.classes : [])];
  for (const { class: name } of named)
    if (!classes.has(name))
      problems.push(
        `Character ${id} has levels in ${name}, which its classes don't name.`,
      );
  for (const name of classes)
    if (!now.some((level) => level.class === name))
      problems.push(
        `Character ${id} names the class ${name} but has no level in it.`,
      );
  return problems;
}

/** Each build's classes are the character's, and its next level is one more. */
function levelProblems(
  character: Extract<PartyCharacter, { kind: 'character' }>,
) {
  const problems: string[] = [];
  const classes = new Set(
    (character.keys.classes ?? []).map(({ name }) => name),
  );
  const builds =
    character.levels.kind === 'open'
      ? character.levels.builds
      : [character.levels.build];
  for (const { now, next } of builds) {
    problems.push(...classProblems(character.id, classes, { now, next }));
    const nextLevel =
      next.kind === 'known' ? levelTotal(next.classes) : next.characterLevel;
    if (nextLevel !== levelTotal(now) + 1)
      problems.push(
        `Character ${character.id}'s next level is ${nextLevel}, not ${levelTotal(now) + 1}.`,
      );
  }
  return [...new Set(problems)];
}
export type PartyCharacter = PartyBuilds['characters'][number];

/** Each matched key a character names, with its group. */
export function partyCharacterKeys(
  character: PartyCharacter,
): [PartyGroup, string][] {
  const keys: [PartyGroup, string][] = [];
  if (character.kind === 'character' && character.race.kind === 'matched')
    keys.push(['race', character.race.key]);
  for (const group of partyGroups)
    for (const entry of character.keys[group] ?? [])
      if (entry.kind === 'matched') keys.push([group, entry.key]);
  return keys;
}

/**
 * What a character needs that the catalog can't give: its unmatched entries
 * and, for a character whose race the sheet doesn't settle, the race.
 */
export function partyCharacterGaps(
  character: PartyCharacter,
): { group: PartyGroup; name: string; note: string }[] {
  const gaps: { group: PartyGroup; name: string; note: string }[] = [];
  if (character.kind === 'character' && character.race.kind === 'open')
    gaps.push({
      group: 'race',
      name: 'race not written',
      note: character.race.note,
    });
  for (const group of partyGroups)
    for (const entry of character.keys[group] ?? [])
      if (entry.kind === 'unmatched')
        gaps.push({ group, name: entry.name, note: entry.note });
  return gaps;
}

/** Characters in number order, a companion after its character. */
export function comparePartyIds(a: string, b: string) {
  const parse = (id: string) => [parseInt(id, 10), id.endsWith('c') ? 1 : 0];
  const [x = 0, y = 0] = parse(a);
  const [u = 0, v = 0] = parse(b);
  return x - u || y - v;
}

export function parsePartyBuilds(value: unknown): PartyBuilds {
  return partyBuildsSchema.parse(value);
}

/** The committed builds file's bytes and parsed builds. */
export async function readPartyBuilds(path = partyBuildsPath) {
  const bytes = await readFile(path, 'utf8');
  return { bytes, builds: parsePartyBuilds(JSON.parse(bytes)) };
}
