import type { CatalogDefinition } from './sheet-catalog-context';

type DefinitionKind = CatalogDefinition['detail']['kind'];

export const definitionKindLabels: Record<DefinitionKind, string> = {
  base: 'Base scores',
  class: 'Class',
  race: 'Race',
  racialTrait: 'Racial trait',
  archetype: 'Archetype',
  classFeature: 'Class feature',
  feat: 'Feat',
  trait: 'Trait',
  manual: 'Personal adjustment',
  item: 'Item',
  spell: 'Spell',
  spellEffect: 'Spell Effect',
  condition: 'Condition',
  itemAbility: 'Item Ability',
};

export const definitionScopeLabels: Record<CatalogDefinition['scope'], string> =
  {
    global: 'Global catalog',
    campaign: 'Campaign catalog',
    character: 'This character only',
  };

export const definitionScopeDescriptions: Record<
  CatalogDefinition['scope'],
  string
> = {
  global: 'Global catalog content is read-only.',
  campaign: 'Changes apply to characters using this campaign definition.',
  character: 'Only this character uses this definition.',
};
