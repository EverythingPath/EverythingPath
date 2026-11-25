import { z } from 'zod';
import type { Prerequisite } from '../../../src/lib/character-sheet-prerequisite-schema';
import data from '../pcgen-archetype-races.json' with { type: 'json' };
import type { PcgenSourcedToken } from './tokens';
import {
  formatPrerequisite,
  isPrerequisiteToken,
  parsePrerequisite,
  type PcgenPrerequisite,
} from './pre';
import {
  renderRequirement,
  translateRequirement,
  type PrestigeReferences,
  type TranslatedRequirement,
} from './requirements';

/**
 * archetype-race-eligibility: an archetype record's race restriction, read
 * from its own PCGen tokens through the reviewed map in
 * `pcgen-archetype-races.json`.
 *
 * - The map names each race the way an archetype record names it, either a
 *   `PRERACE` race KEY or a `PREFACT:1,TEMPLATES,Is<Race>=true` template fact,
 *   at the PCGen line that defines that name (the race record, or the fact's
 *   `FACTDEF` with its `DISPLAYNAME`). Each row gives the race's key in the
 *   import (the pinned Foundry race record's).
 *   `tests/catalog/archetype-race-eligibility.test.ts` checks every row
 *   against the pinned files.
 * - PCGen's `Is<Race>` fact is its own counts-as fact: the race's template
 *   sets it, and so does Racial Heritage of that race
 *   (`dwarf_templates.lst:3-8`). The sheet's `race` clause reads the same
 *   thing (`countsAsRaces`), so a Character counting as the race qualifies.
 * - A race token (`PRERACE`, a `TEMPLATES` `PREFACT`) is translated by the
 *   prestige classes' builder (`translateRequirement`). What it can't type
 *   stays an `unchecked` clause, which the mapper holds as an
 *   `uncheckedRequirement`: a race the map lacks or the import does not emit,
 *   a `RACETYPE` or `RACESUBTYPE` form, a count other than 1, a negation. A
 *   race token inside a combined form (a `PREMULT`) is held as it is.
 */
const pcgenPath = z.string().regex(/^(?:[a-z0-9_]+\/)+[A-Za-z0-9_.-]+$/);
const archetypeRaceSchema = z.strictObject({
  pcgen: z.strictObject({
    token: z.enum(['PRERACE', 'PREFACT']),
    /** The race KEY a `PRERACE` names, or the template fact a `PREFACT` names. */
    name: z.string().min(1),
    file: pcgenPath,
    line: z.number().int().positive(),
  }),
  race: z.strictObject({
    name: z.string().min(1),
    key: z.string().regex(/^pf1\/[A-Za-z0-9]{16}$/),
    file: z.string().regex(/^packs\/races\/[a-z0-9-]+\.[A-Za-z0-9]{16}\.yaml$/),
  }),
});
const archetypeRacesSchema = z
  .strictObject({ races: z.array(archetypeRaceSchema).min(1) })
  .superRefine(({ races }, context) => {
    const seen = new Set<string>();
    for (const { pcgen } of races) {
      const name = `${pcgen.token} ${pcgen.name.toLowerCase()}`;
      if (seen.has(name))
        context.addIssue({
          code: 'custom',
          message: `${pcgen.token} ${pcgen.name} is mapped twice.`,
        });
      seen.add(name);
    }
  });
export type ArchetypeRace = z.infer<typeof archetypeRaceSchema>;

export const reviewedArchetypeRaces = archetypeRacesSchema.parse(data).races;

const keyOf = (token: ArchetypeRace['pcgen']['token'], name: string) =>
  reviewedArchetypeRaces.find(
    ({ pcgen }) =>
      pcgen.token === token && pcgen.name.toLowerCase() === name.toLowerCase(),
  )?.race.key;

/**
 * The map as prerequisite references: a race by its `PRERACE` name or its
 * template fact, while the import emits it (`importedRaceKeys`; omitted, the
 * map's keys stand, as in a mapper test without the Foundry import). Nothing
 * else resolves.
 */
export function archetypeRaceReferences(
  importedRaceKeys?: ReadonlySet<string>,
): PrestigeReferences {
  const importedKey = (key: string | undefined) =>
    key && (!importedRaceKeys || importedRaceKeys.has(key)) ? key : undefined;
  return {
    feat: () => undefined,
    classFeature: () => undefined,
    race: (name) => importedKey(keyOf('PRERACE', name)),
    raceFact: (fact) => importedKey(keyOf('PREFACT', fact)),
    spell: () => undefined,
    className: () => undefined,
  };
}

/** A race token itself: `PRERACE`, or a `TEMPLATES` `PREFACT`. */
const isRaceToken = (node: PcgenPrerequisite) =>
  node.kind === 'PRERACE' ||
  (node.kind === 'PREFACT' && node.items[0] === 'TEMPLATES');

/** Whether a prerequisite names a race: a race token, or a form holding one. */
function namesRace(node: PcgenPrerequisite): boolean {
  return (
    isRaceToken(node) ||
    node.items.some((item) => typeof item !== 'string' && namesRace(item))
  );
}

/**
 * A race token inside a combined form (a `PREMULT`, say) stays unchecked
 * whatever the builder could make of it: an archetype's restriction is a
 * top-level `race` clause, and a race in an `anyOf` beside an alignment
 * would let the alignment stand for the race.
 */
const combinedForm = (node: PcgenPrerequisite): TranslatedRequirement => ({
  token: formatPrerequisite(node),
  clauses: [
    {
      rule: 'unchecked: race token in a combined form',
      prerequisite: { kind: 'unchecked', unchecked: renderRequirement(node) },
    },
  ],
  findings: [],
});

/**
 * An archetype record's race requirements: each of its prerequisite tokens
 * that names a race, translated, with the first such token for provenance
 * and the entry's `prerequisites` field (none without one).
 */
export function archetypeRaceRequirements({
  tokens,
  importedRaceKeys,
}: {
  tokens: readonly PcgenSourcedToken[];
  importedRaceKeys?: ReadonlySet<string>;
}): {
  first?: PcgenSourcedToken;
  requirements: TranslatedRequirement[];
  fields: { prerequisites?: Prerequisite[] };
} {
  const references = archetypeRaceReferences(importedRaceKeys);
  const found = tokens.flatMap((sourced) => {
    if (!isPrerequisiteToken(sourced.token)) return [];
    const node = parsePrerequisite(sourced.token);
    return namesRace(node) ? [{ sourced, node }] : [];
  });
  const requirements = found.map(({ node }) =>
    isRaceToken(node)
      ? translateRequirement(node, {
          references,
          openCastingRequirement: undefined,
        })
      : combinedForm(node),
  );
  const prerequisites = requirements.flatMap(({ clauses }) =>
    clauses.map(({ prerequisite }) => prerequisite),
  );
  return {
    first: found[0]?.sourced,
    requirements,
    fields: prerequisites.length ? { prerequisites } : {},
  };
}
