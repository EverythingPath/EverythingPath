import type { Id } from '../convex/_generated/dataModel';
import { materializeRepresentativeRaceCatalog } from '../convex/lib/representativeRaceCatalog';
import type { ReleaseTest } from './catalog-release-fixture';

// CRB p. 22: the elf and its standard racial traits, installed as global
// catalog content from the representative race seeds.
const elfKeys = [
  'elf',
  'elf-ability',
  'elf-keen-senses',
  'elf-low-light',
  'elf-familiarity',
] as const;

export async function installElf(t: ReleaseTest) {
  return t.run(async (ctx) => {
    const ids = new Map<string, Id<'catalogEntry'>>();
    for (const key of elfKeys)
      ids.set(
        key,
        await ctx.db.insert('catalogEntry', {
          scope: 'global',
          name: key,
          ruleIdentity: key,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'manual' },
        }),
      );
    const placeholder = ids.get('elf');
    if (!placeholder) throw new Error('Missing elf');
    // Other races' rows are discarded; only installed keys need real IDs.
    for (const { key, definition } of materializeRepresentativeRaceCatalog(
      (key) => ids.get(key) ?? placeholder,
    )) {
      const id = ids.get(key);
      if (id)
        await ctx.db.replace('catalogEntry', id, {
          ...definition,
          scope: 'global',
        });
    }
    const id = (key: (typeof elfKeys)[number]) => {
      const value = ids.get(key);
      if (!value) throw new Error(`Missing ${key}`);
      return value;
    };
    return {
      elf: id('elf'),
      ability: id('elf-ability'),
      keenSenses: id('elf-keen-senses'),
    };
  });
}

/**
 * The importer's body for the elf's Ability Scores (CRB p. 22): +2 Dexterity,
 * +2 Intelligence and −2 Constitution.
 */
export const elfAbilityBody = {
  externalKey: 'local/race-ability-scores/pf1/NgIhxRI0axrf3fcO',
  upstreamKey: 'pf1/NgIhxRI0axrf3fcO',
  pack: 'races',
  name: 'Ability Scores',
  detail: { kind: 'racialTrait', bonusSkillRanksPerLevel: 0 },
  description: '',
  sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '22' }],
  modifiers: [
    { target: 'ability.dex', bonusType: 'racial', value: 2 },
    { target: 'ability.int', bonusType: 'racial', value: 2 },
    { target: 'ability.con', bonusType: 'racial', value: -2 },
  ],
  unsupported: [],
};
