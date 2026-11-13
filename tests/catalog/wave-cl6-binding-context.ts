import type { PreviewEntry } from '../../scripts/catalog/map';
import { waveBindingContext } from './wave-binding-context';

/**
 * Wave CL6 (#517, #519 and #520): the 53 re-assessed Spells and every entry
 * their gate closures reach, as the full-corpus preview imports them. A wave
 * CL6 row binds against these entries, as the gate does (wave CL1's binding
 * context).
 *
 * Each entry is read from the first committed fixture that holds it, exactly
 * equal to the full-corpus import; only keys are stored here. Four roots link a
 * Spell of another batch, which their batch previews strip. Shared Wrath's and
 * Forcecage's complete entries are already committed (spell-bindings-738's
 * full context and spells-520's binding preview), so they are read from there
 * before the batch previews' stripped copies; only Pain Strike, Mass and
 * Summon Monster II, which no committed fixture holds, are stored, in
 * wave-cl6/binding-preview.json.
 */
const SOURCES = [
  'wave-cl6/binding-preview.json',
  'spell-bindings-738/full-context.json',
  'spells-520/binding-preview.json',
  'spells-517/preview.json',
  'spells-519/preview.json',
  'spells-520/preview.json',
  'spells-521/preview.json',
  'spells-529/preview.json',
  'spells-533/preview.json',
  'spells-541/preview.json',
] as const;

/**
 * The wave's re-assessed keys in inventory order: spells-517's 15 roots,
 * spells-519's 18 (Stone Shield on a named content hold) and spells-520's 16
 * (Severed Fate on a named content hold), then the Spells the roots reach:
 * Wrath (#521), Wall of Force (#529), Pain Strike (#533) and Fester (#541, on a
 * named content hold).
 */
export const WAVE_CL6_KEYS: readonly string[] = [
  'pf1/184d4mq7yubz2qnq', // Campfire Wall
  'pf1/1a4v0ccufso0de5z', // Ear-Piercing Scream
  'pf1/1deu73tsthfuepk5', // Aspect of the Stag
  'pf1/1dkzhi78je32sbrr', // Pain Strike, Mass
  'pf1/1mi4y3g4n8adtfl3', // Antipathy
  'pf1/1moeejp3mch70ys5', // Ball Lightning
  'pf1/1n1q5cbu2tz9nqui', // Locate Weakness
  'pf1/1rhpxleafu8mi5yu', // Snake Staff
  'pf1/1wnzvfrpl2gp829u', // Burning Gaze
  'pf1/1ziz3r5a1gzd1jw2', // Nap Stack
  'pf1/22x4iooz3c3vqof9', // Virtue
  'pf1/24zg8a05hqum3e6j', // Mending
  'pf1/26vm5jhjkxpq1xm3', // Summon Monster II
  'pf1/272szq5d556toqgc', // Blessing of Courage and Life
  'pf1/27c1lt6aws5f63yk', // Bloodhound
  'pf1/3fkwj6d8s65ufwar', // Accelerate Poison
  'pf1/3fravqa4vrm4ygkr', // Transmute Metal to Wood
  'pf1/3lfx1ccxo2hdqrf3', // Telekinesis
  'pf1/3mfmhx8avu7h3iom', // Spider Climb
  'pf1/3nxf2nap088jjzbi', // Stone Shield
  'pf1/3p5s2rkpe7u7ifzn', // Chill Metal
  'pf1/3v1k7qnzd13s5dj3', // Expeditious Excavation
  'pf1/3w1ozzzf8hk0gdzm', // Reincarnate
  'pf1/3wcvosazm31i8758', // Contagious Zeal
  'pf1/476th5lyxxemseyx', // Ablative Barrier
  'pf1/478jgozgfbt20u0q', // Hydraulic Torrent
  'pf1/499phaxpgce53z6q', // Ride The Waves
  'pf1/49yc9dpr4kvgki2s', // Magic Missile
  'pf1/4br9puuneexco5hx', // Contingency
  'pf1/4dczr3vd96vbcirc', // Hunter's Howl
  'pf1/4eu1kdpfr6lxtvt8', // Winter Feathers
  'pf1/4gxx3bodf76e63en', // River of Wind
  'pf1/4mvqcqfaqv54drf3', // Shared Wrath
  'pf1/4n9gp6b46h74y70m', // Restful Sleep
  'pf1/4w51afqi5d9t8nl4', // Innocence
  'pf1/4wq7yxu0wyl0na7y', // Adhesive Blood
  'pf1/4x4ozs8ps7tfbgpd', // Severed Fate
  'pf1/4ya1fs9tyvsqnwqx', // Status
  'pf1/4yfd85igzmvu154c', // Sonic Scream
  'pf1/50maksnxymh9jsj2', // Instant Armor
  'pf1/54x9nw6ni4rpphcn', // Keen Senses
  'pf1/56atnwmo4s61hi45', // Wall of Nausea
  'pf1/5g3k1ocjvt4omciq', // Spite
  'pf1/5h7qpvgnqof7oku7', // Forcecage
  'pf1/5kkfeituhm3d8vps', // Stumble Gap
  'pf1/5o8uysrb153tnvci', // Sanctify Corpse
  'pf1/5px118dfc2ww7lyz', // Putrefy Food and Drink
  'pf1/5spjx8eba8jgjuqw', // Eruptive Pustules
  'pf1/5t62v90lidkv3sml', // Challenge Evil
  'pf1/5zrqn8bj3jxm05pl', // Wrath (closure)
  'pf1/fb38vn4hm4rur6gm', // Wall of Force (closure)
  'pf1/jy64xofud29j5ju6', // Pain Strike (closure)
  'pf1/thnav06t8k8ox78j', // Fester (closure)
];

/** Closure entries that are not themselves wave keys (admitted earlier). */
const CONTEXT_KEYS = [
  'pf1/kyo0kwhw2jhuztju', // Summon Monster I
];

const context = waveBindingContext({
  wave: 'CL6',
  sources: SOURCES,
  keys: WAVE_CL6_KEYS,
  contextKeys: CONTEXT_KEYS,
});

/** The 54 entries, sorted by key: the wave's keys and the context they reach. */
export const waveCl6Closure: readonly PreviewEntry[] = context.closure;

/** A wave CL6 Spell's full-corpus entry and its closure as the artifact. */
export const waveCl6BindingContext = context.bindingContext;
