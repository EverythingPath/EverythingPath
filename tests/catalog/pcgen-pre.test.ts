// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  formatPrerequisite,
  parsePrerequisite,
} from '../../scripts/catalog/pcgen/pre';

// #716 plan §2 and §3: PCGen PRExxx tokens parse to an AST the prestige and
// archetype mappers (P4, P5) translate. Tokens are real fixture lines.
describe('the PCGen prerequisite parser', () => {
  it('reads a count and its items (Duelist, cr_classes.lst:400)', () => {
    expect(
      parsePrerequisite(
        'PREABILITY:3,CATEGORY=FEAT,Dodge,Mobility,Weapon Finesse',
      ),
    ).toEqual({
      kind: 'PREABILITY',
      isNegated: false,
      count: 3,
      items: ['CATEGORY=FEAT', 'Dodge', 'Mobility', 'Weapon Finesse'],
    });
    expect(parsePrerequisite('PRETOTALAB:6')).toEqual({
      kind: 'PRETOTALAB',
      isNegated: false,
      count: 6,
      items: [],
    });
  });

  it('keeps tokens without a count as items (Fighter ~ Bravery, cr_abilities_class.lst:258)', () => {
    expect(parsePrerequisite('PREVAREQ:Fighter_CF_Bravery,0')).toEqual({
      kind: 'PREVAREQ',
      isNegated: false,
      count: null,
      items: ['Fighter_CF_Bravery', '0'],
    });
  });

  it('nests bracketed branches and negations (Archer, apg_abilities_class.lst:2102)', () => {
    const token =
      'PREMULT:1,[PREABILITY:1,CATEGORY=Archetype,Fighter Archetype ~ Archer],[!PREABILITY:1,CATEGORY=Archetype,TYPE.FighterBravery,TYPE.FighterArmorTraining1]';
    expect(parsePrerequisite(token)).toEqual({
      kind: 'PREMULT',
      isNegated: false,
      count: 1,
      items: [
        {
          kind: 'PREABILITY',
          isNegated: false,
          count: 1,
          items: ['CATEGORY=Archetype', 'Fighter Archetype ~ Archer'],
        },
        {
          kind: 'PREABILITY',
          isNegated: true,
          count: 1,
          items: [
            'CATEGORY=Archetype',
            'TYPE.FighterBravery',
            'TYPE.FighterArmorTraining1',
          ],
        },
      ],
    });
  });

  it('nests PREMULT inside PREMULT (Master Chymist, apg_classes.lst:426, and a nested compound)', () => {
    const chymist =
      'PREMULT:2,[PREABILITY:1,CATEGORY=Special Ability,Alchemist ~ Mutagen],[PREABILITY:1,CATEGORY=Special Ability,Discovery ~ Feral Mutagen,Discovery ~ Infuse Mutagen]';
    const parsed = parsePrerequisite(chymist);
    expect(parsed.count).toBe(2);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[1]).toEqual({
      kind: 'PREABILITY',
      isNegated: false,
      count: 1,
      items: [
        'CATEGORY=Special Ability',
        'Discovery ~ Feral Mutagen',
        'Discovery ~ Infuse Mutagen',
      ],
    });
    const nested =
      'PREMULT:2,[PREDEITY:1,Y],[PREMULT:1,[PREABILITY:1,CATEGORY=Special Ability,Touched by Divinity],[!PREABILITY:1,CATEGORY=Special Ability,TYPE.CampaignTrait]]';
    expect(parsePrerequisite(nested).items[1]).toMatchObject({
      kind: 'PREMULT',
      count: 1,
      items: [{ isNegated: false }, { isNegated: true }],
    });
    expect(formatPrerequisite(parsePrerequisite(chymist))).toBe(chymist);
    expect(formatPrerequisite(parsePrerequisite(nested))).toBe(nested);
  });

  it('rejects tokens that are not prerequisites or whose brackets are unbalanced', () => {
    expect(() => parsePrerequisite('ABILITY:Class|AUTOMATIC|Duelist')).toThrow(
      /not a PCGen prerequisite/,
    );
    expect(() => parsePrerequisite('PREMULT:1,[PRECLASS:1,Fighter=1')).toThrow(
      /unbalanced/,
    );
  });
});
