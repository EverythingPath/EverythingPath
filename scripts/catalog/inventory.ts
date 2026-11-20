import { prdCaptureName } from './prd-identity.ts';

export const pins = {
  pf1: {
    tag: 'v11.11',
    version: '11.11',
    commit: '418761d2e16a6037c0156bb4a241f7cea5a2986d',
    manifest: 'public/system.json',
    directory: 'packs',
  },
  'pf1-content': {
    tag: '11.4.0',
    version: '11.4.0',
    commit: '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
    manifest: 'module.json',
    directory: 'src',
  },
};
export type Repository = keyof typeof pins;
/**
 * PCGen's Pathfinder data, the #716 source for archetypes and prestige
 * classes. Read from a checkout at this commit; nothing is fetched at build
 * time. Paths in PCGen locators are relative to `directory`.
 */
export const pcgenPin = {
  repository: 'https://github.com/PCGen/pcgen',
  commit: '25523dbcf10e86c280fc0f447167ea43d67419d3',
  directory: 'data/pathfinder/paizo',
} as const;
/**
 * The one-time PRD capture (#716 P8, owner decision 1 of 2026-10-17):
 * Wayback snapshots of paizo.com's PRD and the facts-only `pf1e-archetypes`
 * checklist, kept read-only in `~/repos/everythingpath/sources/<capture>/`
 * and checked by `verifyPrdCapture` (`prd-pin.ts`). The store keeps its
 * manifest and excerpts (`tests/fixtures/pinned/prd/`). Nothing is fetched at
 * build time.
 */
export const prdPin = {
  capture: prdCaptureName,
  manifestSha256:
    'ab85f25ffd5cf0f0e7d365011a9e98e6095918ad7abacb91fa9acbc5ee3d181e',
  contentSha256:
    'becac42cc3e99f48b5aa1900c9bc11b1413a073646c193817bd048d58b2f27f6',
} as const;
export const itemAbilityHelperId = 'upTvrmZoeKq2LI0F';
export const conditionalHelperIds = new Set([
  'jTaeREVBdEeawArA',
  itemAbilityHelperId,
]);
export type ImportKind =
  | 'race'
  | 'class'
  | 'classFeature'
  | 'feat'
  | 'trait'
  | 'racialTrait'
  | 'item'
  | 'itemAbility'
  | 'spell'
  | 'spellEffect'
  | 'manual'
  | 'creatureType'
  | 'companionFeature'
  | 'companion'
  | 'familiar'
  | 'eidolonForm'
  | 'eidolonEvolution';
type Policy =
  | {
      kind: 'map';
      family: ImportKind | 'buff' | 'naturalAttacks';
    }
  | { kind: 'exclude'; reason: string }
  | { kind: 'unassigned'; reason: string };
const map = (family: Extract<Policy, { kind: 'map' }>['family']): Policy => ({
  kind: 'map',
  family,
});
const exclude = (reason: string): Policy => ({ kind: 'exclude', reason });
const unassigned = (reason: string): Policy => ({ kind: 'unassigned', reason });
const policies: Record<Repository, Record<string, Policy>> = {
  pf1: {
    races: map('race'),
    classes: map('class'),
    'class-abilities': map('classFeature'),
    feats: map('feat'),
    items: map('item'),
    'armors-and-shields': map('item'),
    'weapons-and-ammo': map('item'),
    technology: map('item'),
    buffs: map('buff'),
    spells: map('spell'),
    'racial-hd': map('creatureType'),
    'monster-abilities': map('naturalAttacks'),
    'companion-features': map('companionFeature'),
    'basic-monsters': unassigned(
      'Monster actors need a reviewed companion/cohort dependency inventory.',
    ),
    'mythic-paths': exclude('Mythic systems are outside PRD #251 scope.'),
    'monster-templates': unassigned(
      'Monster templates need a reviewed companion dependency inventory.',
    ),
    'template-abilities': unassigned(
      'Template abilities need a reviewed companion dependency inventory.',
    ),
    macros: exclude(
      'Foundry runtime macros are not game-content catalog inputs.',
    ),
    'roll-tables': exclude('Roll tables are not catalog definitions.'),
    'ultimate-equipment': exclude(
      'Equipment roll tables are not item definitions.',
    ),
    rules: exclude(
      'Journal rules are not catalog definitions; rules use the project corpus.',
    ),
  },
  'pf1-content': {
    'pf-class-abilities': map('classFeature'),
    'pf-feats': map('feat'),
    'pf-traits': map('trait'),
    'pf-racial-traits': map('racialTrait'),
    'pf-buffs': map('buff'),
    'pf-special-qualities': map('itemAbility'),
    'pf-artifacts': map('item'),
    'pf-cursed-items': map('item'),
    'pf-intelligent-items': map('item'),
    'pf-items': map('item'),
    'pf-magic-items': map('item'),
    'pf-scaling-items': map('item'),
    'pf-wondrous': map('item'),
    'pf-society': unassigned(
      'Pathfinder Society content awaits a reviewed pack scope decision.',
    ),
    'pf-companions': map('companion'),
    'pf-familiars': map('familiar'),
    'pf-eidolon-forms': map('eidolonForm'),
    'pf-companion-features': map('companionFeature'),
    'pf-eidolon-evolutions': map('eidolonEvolution'),
    'pf-35-content': exclude('3.5 content is explicitly excluded.'),
    'pf-third-party': exclude('Third-party packs are explicitly excluded.'),
    'pf-goods-services': exclude('Goods and services are explicitly excluded.'),
    'pf-collab-content': unassigned(
      'Mixed collaboration content needs a reviewed per-record scope decision.',
    ),
    'pf-maladies': unassigned(
      'Maladies have no admitted family in the current inventory.',
    ),
    'pf-occult-rituals': unassigned(
      'Occult rituals need a reviewed scope decision; they are not ordinary spells.',
    ),
    'pf-universal-monster-rules': unassigned(
      'Monster rules need a reviewed companion dependency inventory.',
    ),
    'pf-deities': exclude('Deity journals are not catalog definitions.'),
    'gm-quick-reference': exclude(
      'Reference journals are not catalog definitions.',
    ),
    'harrow-deck': exclude(
      'Harrow journals are outside the decided catalog sources.',
    ),
    'pf-rules': exclude('Rules journals are not catalog definitions.'),
    'pf-merchants': exclude('Merchant actors are outside companion scope.'),
    'pf-traps-and-haunts': exclude(
      'Trap and haunt actors are outside companion scope.',
    ),
    'pf-encounter-tables': exclude(
      'Encounter roll tables are not catalog definitions.',
    ),
    'pf-magic-tables': exclude(
      'Magic roll tables are not catalog definitions.',
    ),
    'pf-tables': exclude('Roll tables are not catalog definitions.'),
  },
};
export function packPolicy({
  repo,
  pack,
}: {
  repo: Repository;
  pack: string;
}): Policy {
  return (
    policies[repo][pack] ??
    unassigned('Pack is absent from the reviewed import inventory.')
  );
}
export const naturalAttackIds = new Set([
  'szjeStouwI3F3WdP',
  'MZnbCVzqpvPsMvfT',
  '3xwmfkQBA3R0Cozz',
  'pX3qRL8U1wfBcH80',
  'iMix2jm1eh8V6cCN',
  'GrbQIXcmp5VXxYA7',
  'cuOCNj2vlx0Q1X3J',
  'qP52Vv8OelEql6Oq',
  'ogIJ8XWiWFlJIF6S',
  'PfmCJRQ9qOgwcUxb',
  '5gG3V7rB4Q7LoBFT',
  '1sU57tRb1My6XZMC',
  'h9ogVoyFP7qMBJhg',
]);
