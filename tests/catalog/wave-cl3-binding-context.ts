import type { PreviewEntry } from '../../scripts/catalog/map';
import { waveBindingContext } from './wave-binding-context';

/**
 * Wave CL3 (#543 and #523): the 42 re-assessed Spells and every entry their
 * gate closures reach, as the full-corpus preview imports them. A wave CL3 row
 * binds against these entries, as the gate does (wave CL1's binding context).
 *
 * Each entry is read from the committed preview that already holds it, exactly
 * equal to the full-corpus import; only keys are stored here.
 */
const SOURCES = [
  'spells-543/preview.json',
  'spells-523/binding-preview.json',
  'spells-527/binding-preview.json',
  'spells-529/binding-preview.json',
  'spells-537/preview.json',
] as const;

/**
 * The wave's re-assessed keys in inventory order: spells-543's 20 roots, then
 * spells-523's 18 roots and Create Pit, then Eagle's Splendor (#527), Globe of
 * Invulnerability, Lesser (#529) and Cure Light Wounds, Mass (#528).
 */
export const WAVE_CL3_KEYS: readonly string[] = [
  'pf1/vr35zocojcg7gei8', // Cloak of Shade
  'pf1/vsr1e8ib0hfhbnxb', // Undetectable Alignment
  'pf1/vwmjuvpef2b9wqts', // Resinous Skin
  'pf1/vxmp5prgw5fj4h6f', // Hallow
  'pf1/vycoymg42schzzxq', // Burst of Speed
  'pf1/w24m5lf68tmllnrp', // Find Traps
  'pf1/w6bdfme0t8frk73p', // Animal Aspect
  'pf1/w6ttezzz9rt4qnh7', // Globe of Invulnerability
  'pf1/w74yfh5n4302nxcq', // Stay the Hand
  'pf1/wbgyh6dqjvytk13s', // Cacophonous Call, Mass
  'pf1/wcjlvlkpnjhx5pcf', // Acid Pit
  'pf1/wd41d3i472hmr8ib', // Touch of Gracelessness
  'pf1/weyfn0mg2oifasq1', // Seeming
  'pf1/wh9zc2reqneafxro', // Acid Arrow
  'pf1/wifi44l62ymqdvt8', // Unshakable Chill
  'pf1/wkmkd6wvqjj15vnd', // Eagle's Splendor, Mass
  'pf1/wmpys61zcmmb4atb', // Howling Agony
  'pf1/wn0c48h6w8grfz68', // Strong Wings
  'pf1/wn45wjbebnbtdllt', // Icicle Dagger
  'pf1/wpi7zlhfdusin7yi', // Flames of the Faithful
  'pf1/82z60xtalr9fzkwb', // Foe to Friend
  'pf1/879sdozw7ca7ci9k', // Stone Fist
  'pf1/8ai7fslz4zu8xe9s', // Magic Jar
  'pf1/8h84spdczbsi69gr', // Hostile Levitation
  'pf1/8kqajvwnbv9psq1h', // Instant Enemy
  'pf1/8nbpbvgkggj0wbmd', // Brow Gasher
  'pf1/8nnswcde15poheci', // Rampart
  'pf1/8nrt26t37v7koqr8', // Misdirection
  'pf1/8qligfr61kotnlwx', // Volcanic Storm
  'pf1/8w67l6dzzsi6oz5f', // Create Pit (closure)
  'pf1/8y24u1ejlqeoiyqb', // Cure Serious Wounds, Mass
  'pf1/911ksc2j8ssv692y', // Crafter's Curse
  'pf1/96wkex2umgqrjwr4', // Mage's Sword
  'pf1/97mcivnu2owb8119', // Mirror Strike
  'pf1/9968j68bl9x9iq7u', // Clone
  'pf1/99ihqk5u93smyy9x', // Jester's Jaunt
  'pf1/99xovzg8h1nh9o9a', // Lullaby
  'pf1/9b4iklatq5hn1z5m', // Quench
  'pf1/9crmpewzt1y0hk73', // Resounding Blow
  'pf1/d4oubr5bdoo8w1ev', // Eagle's Splendor (closure)
  'pf1/exwa9xra4u82j0sx', // Globe of Invulnerability, Lesser (closure)
  'pf1/ejk08uk2e3h5eg3a', // Cure Light Wounds, Mass (closure)
];

/** Closure entries that are not themselves wave keys. */
const CONTEXT_KEYS = [
  'pf1/oj36nfak6jc2s5ky', // Disguise Self
  'pf1/p222zrbf0ynwblzd', // Cacophonous Call
];

const context = waveBindingContext({
  wave: 'CL3',
  sources: SOURCES,
  keys: WAVE_CL3_KEYS,
  contextKeys: CONTEXT_KEYS,
});

/** The 44 entries, sorted by key: the wave's keys and the context they reach. */
export const waveCl3Closure: readonly PreviewEntry[] = context.closure;

/** A wave CL3 Spell's full-corpus entry and its closure as the artifact. */
export const waveCl3BindingContext = context.bindingContext;
