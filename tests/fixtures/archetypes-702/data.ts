import { pcgenPin } from '../../../scripts/catalog/inventory';
import {
  pcgenOwnerEmissionFiles,
  wizardClosureFiles,
} from '../pcgen-716/owner-emission-files';

// #702 batch 1 (#716 E2a): the Exploiter Wizard's pinned inputs. The E1 wizard
// tree (`owner-emission-files.ts`) plus the Foundry records of the exploit
// pool's 24 members, in arcanist.html order (advancedClassGuide/classes/
// arcanist.html:461-510), and one greater exploit outside the pool.

/** The 24 ordinary ACG arcanist exploits, by stable key and pinned file. */
export const exploiterPoolMembers = [
  ['pf1/bDES4OvFrtuMmPsW', 'acid-jet'],
  ['pf1/q7y6hIc0NEwjGTKG', 'arcane-barrier'],
  ['pf1/8LTtHB6wiIh5tB6J', 'arcane-weapon'],
  ['pf1/h2HnbWEh7rlY0JcF', 'bloodline-development'],
  ['pf1/YoKXg3OTiARGNZyo', 'consume-magic-items'],
  ['pf1/IPJqsPrrMnudA70e', 'counterspell'],
  ['pf1/P17L09Wh6jFpIPWh', 'dimensional-slide'],
  ['pf1/B1abP8HNMYf9SLdn', 'energy-shield'],
  ['pf1/YQgJJcgq11g7TBWP', 'familiar-arc'],
  ['pf1/gxiVBtQ9S1naEMJq', 'flame-arc'],
  ['pf1/MP8rPf56VvijFsQj', 'force-strike'],
  ['pf1/zfsU3oRTcd2mPFX1', 'ice-missile'],
  ['pf1/aPV8b5DEOfJLtwLx', 'item-crafting'],
  ['pf1/giiZFEuN7c0s8UbA', 'lightning-lance'],
  ['pf1/z2fcXtp99PkuabS5', 'metamagic-knowledge'],
  ['pf1/kUjXL9ec9TGCoJYq', 'metamixing'],
  ['pf1/ByZBsqXi9uhbPSJn', 'potent-magic'],
  ['pf1/bQIHXFmVTfQv6rD3', 'quick-study-arc'],
  ['pf1/k1OBZUPyNyodotBI', 'school-understanding'],
  ['pf1/BQ0p8MFQV8FAlmQt', 'see-magic'],
  ['pf1/1dZxb8Eii34a6YS4', 'spell-disruption'],
  ['pf1/CO1zRIeXTn6L5yQY', 'spell-resistance-arc'],
  ['pf1/lguuanLKWDVYPleV', 'spell-tinkerer'],
  ['pf1/c5anvABG4nXco4pn', 'swift-consume'],
].map(([key = '', slug = '']) => ({
  key,
  file: `pf1/packs/class-abilities/${slug}.${key.slice('pf1/'.length)}.yaml`,
}));

/** A greater exploit (acg_abilities_class.lst:127), outside the pool. */
export const alterEnhancements = {
  key: 'pf1/frdZ5fkuGZhkE9DU',
  file: 'pf1/packs/class-abilities/alter-enhancements.frdZ5fkuGZhkE9DU.yaml',
};

/**
 * The Spells the members' descriptions link to: Counterspell and Spell
 * Disruption to Dispel Magic, See Magic to Detect Magic, Force Strike to
 * Magic Missile. A link outside the import fails the member's admission.
 */
const memberReferenceFiles = [
  'pf1/packs/spells/dispel-magic.gmgwyjfpeuuc4t4o.yaml',
  'pf1/packs/spells/detect-magic.uqh87jz757r2cb7r.yaml',
  'pf1/packs/spells/magic-missile.49yc9dpr4kvgki2s.yaml',
];

/**
 * The Exploiter Wizard's tree: the wizard closure, the pool, the Spells it
 * links to and its outsider, and the PCGen files.
 */
export const exploiterTreeFiles = [
  ...wizardClosureFiles,
  ...exploiterPoolMembers.map(({ file }) => file),
  ...memberReferenceFiles,
  alterEnhancements.file,
  ...pcgenOwnerEmissionFiles.map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
];
