import type { Ability, LeafTarget } from './character-sheet';

export const skillDefinitions = [
  { key: 'skill.acr', name: 'Acrobatics', ability: 'dexterity' },
  { key: 'skill.apr', name: 'Appraise', ability: 'intelligence' },
  { key: 'skill.blf', name: 'Bluff', ability: 'charisma' },
  { key: 'skill.clm', name: 'Climb', ability: 'strength' },
  { key: 'skill.crf', name: 'Craft', ability: 'intelligence' },
  { key: 'skill.dip', name: 'Diplomacy', ability: 'charisma' },
  { key: 'skill.dev', name: 'Disable Device', ability: 'dexterity' },
  { key: 'skill.dis', name: 'Disguise', ability: 'charisma' },
  { key: 'skill.esc', name: 'Escape Artist', ability: 'dexterity' },
  { key: 'skill.fly', name: 'Fly', ability: 'dexterity' },
  { key: 'skill.han', name: 'Handle Animal', ability: 'charisma' },
  { key: 'skill.hea', name: 'Heal', ability: 'wisdom' },
  { key: 'skill.int', name: 'Intimidate', ability: 'charisma' },
  { key: 'skill.kar', name: 'Knowledge (arcana)', ability: 'intelligence' },
  {
    key: 'skill.kdu',
    name: 'Knowledge (dungeoneering)',
    ability: 'intelligence',
  },
  {
    key: 'skill.ken',
    name: 'Knowledge (engineering)',
    ability: 'intelligence',
  },
  { key: 'skill.kge', name: 'Knowledge (geography)', ability: 'intelligence' },
  { key: 'skill.khi', name: 'Knowledge (history)', ability: 'intelligence' },
  { key: 'skill.klo', name: 'Knowledge (local)', ability: 'intelligence' },
  { key: 'skill.kna', name: 'Knowledge (nature)', ability: 'intelligence' },
  { key: 'skill.kno', name: 'Knowledge (nobility)', ability: 'intelligence' },
  { key: 'skill.kpl', name: 'Knowledge (planes)', ability: 'intelligence' },
  { key: 'skill.kre', name: 'Knowledge (religion)', ability: 'intelligence' },
  { key: 'skill.lin', name: 'Linguistics', ability: 'intelligence' },
  { key: 'skill.per', name: 'Perception', ability: 'wisdom' },
  { key: 'skill.prf', name: 'Perform', ability: 'charisma' },
  { key: 'skill.pro', name: 'Profession', ability: 'wisdom' },
  { key: 'skill.rid', name: 'Ride', ability: 'dexterity' },
  { key: 'skill.sen', name: 'Sense Motive', ability: 'wisdom' },
  { key: 'skill.slt', name: 'Sleight of Hand', ability: 'dexterity' },
  { key: 'skill.spl', name: 'Spellcraft', ability: 'intelligence' },
  { key: 'skill.ste', name: 'Stealth', ability: 'dexterity' },
  { key: 'skill.sur', name: 'Survival', ability: 'wisdom' },
  { key: 'skill.swm', name: 'Swim', ability: 'strength' },
  { key: 'skill.umd', name: 'Use Magic Device', ability: 'charisma' },
] as const satisfies readonly {
  key: LeafTarget;
  name: string;
  ability: Ability;
}[];

export type SkillTarget = (typeof skillDefinitions)[number]['key'];
