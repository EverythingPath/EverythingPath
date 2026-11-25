import type { z } from 'zod';
import type { fieldProvenanceSchema } from '../../../src/lib/catalog/imported-entry-schema';
import type { Unsupported } from '../records';
import { pcgenSkillKey } from './requirements';
import type { PcgenSourcedToken } from './tokens';

/**
 * Entry fields the #716 PCGen mappers share (P4 prestige classes, P5
 * archetypes): class skill lists and field provenance.
 */
type Provenance = Record<string, z.infer<typeof fieldProvenanceSchema>>;

const allKnowledge = [
  'skill.kar',
  'skill.kdu',
  'skill.ken',
  'skill.kge',
  'skill.khi',
  'skill.klo',
  'skill.kna',
  'skill.kno',
  'skill.kpl',
  'skill.kre',
];
/**
 * #716 P10a, owner decision 3 (plan §7 "Product Identity"): a record PCGen
 * flags NAMEISPI or DESCISPI is held with an attribution hold, which no
 * structure review settles, so it gets no gap fill and no admission.
 */
export function productIdentityHolds(record: {
  isNamePI: boolean;
  isDescPI: boolean;
  locator: { file: string; line: number };
}): Unsupported[] {
  const at = `${record.locator.file}:${record.locator.line}`;
  return [
    ...(record.isNamePI ? ['NAMEISPI'] : []),
    ...(record.isDescPI ? ['DESCISPI'] : []),
  ].map((flag) => ({
    field: 'attribution',
    reason: `Product Identity: ${flag} (${at})`,
  }));
}

/** A CSKILL name's runtime skills: a specialty is its skill, a TYPE its skills; undefined when none fits. */
export function classSkillKeys(name: string) {
  const type = /^TYPE[=.](.+)$/i.exec(name)?.[1];
  if (type?.toLowerCase() === 'knowledge') return allKnowledge;
  const key = pcgenSkillKey(type ?? name)?.replace(
    /^(skill\.(?:crf|prf|pro))\..+$/,
    '$1',
  );
  return key ? [key] : undefined;
}

/**
 * The skills a `CSKILL` (class skills gained) or `CCSKILL` (lost) list
 * names, as runtime skill keys, with an `unsupported` entry for each name
 * no runtime skill fits.
 */
export function skillListOf(
  tokens: readonly PcgenSourcedToken[],
  tag: 'CSKILL' | 'CCSKILL',
) {
  const found = tokens.filter(({ token }) => token.startsWith(`${tag}:`));
  const names = found.flatMap(({ token }) =>
    token.slice(tag.length + 1).split('|'),
  );
  return {
    keys: [
      ...new Set(names.flatMap((name) => classSkillKeys(name) ?? [])),
    ].sort(),
    first: found[0],
    unsupported: names.flatMap((name): Unsupported[] =>
      classSkillKeys(name)
        ? []
        : [
            {
              field: 'classSkills',
              reason:
                'No runtime skill has this PCGen class skill; it stays prose.',
              value: name,
            },
          ],
    ),
  };
}

/** Each mapped field's PCGen line, by the record's KEY. */
export function pcgenProvenance(
  key: string,
  located: Record<string, Pick<PcgenSourcedToken, 'file' | 'line'> | undefined>,
): Provenance {
  return Object.fromEntries(
    Object.entries(located).flatMap(([field, at]) =>
      at
        ? [
            [
              field,
              {
                source: 'pcgen',
                locator: { file: at.file, line: at.line, key },
              } satisfies Provenance[string],
            ],
          ]
        : [],
    ),
  );
}
