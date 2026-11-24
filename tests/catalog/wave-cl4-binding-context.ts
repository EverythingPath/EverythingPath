import type { PreviewEntry } from '../../scripts/catalog/map';
import { waveBindingContext } from './wave-binding-context';

/**
 * Wave CL4 (#529, #531 and #540): the 41 re-assessed Spells and every entry
 * their gate closures reach, as the full-corpus preview imports them. A wave
 * CL4 row binds against these entries, as the gate does (wave CL1's binding
 * context).
 *
 * Each entry is read from the committed preview that already holds it, exactly
 * equal to the full-corpus import; only keys are stored here.
 */
const SOURCES = [
  'spells-529/preview.json',
  'spells-531/preview.json',
  'spells-540/preview.json',
  'spells-518/preview.json',
  'spells-527/preview.json',
  'spells-543/preview.json',
  'spells-522/preview.json',
  'spells-541/preview.json',
] as const;

/**
 * The wave's re-assessed keys in inventory order: spells-529's 13 roots,
 * spells-531's 13 and spells-540's 14, then Reduce Person (#518), which
 * Reduce Person, Mass reaches.
 */
export const WAVE_CL4_KEYS: readonly string[] = [
  'pf1/evoz9r9n186nsjf0', // Planar Adaptation
  'pf1/f4v928e4ebt7h0hz', // Reduce Person, Mass
  'pf1/f6lqt3ju8m7r5la2', // Life Bubble
  'pf1/f7b6erou3d9ds1p1', // Residual Tracking
  'pf1/f7gaaxcschrg2r0q', // Stormbolts
  'pf1/f98kluovmjf6w7d5', // Halt Undead
  'pf1/fdg9goug5f6s1qtx', // Transmute Mud to Rock
  'pf1/fe8jy0h1l3su2322', // Cloak of Winds
  'pf1/ffsr22oaciurke4e', // Desecrate
  'pf1/fipqx43u5blpjsvo', // Stabilize
  'pf1/fp5r5razueuqj8z8', // Helping Hand
  'pf1/fqugizy52juiiw4v', // Solid Note
  'pf1/ftrg3ira8jwicetv', // Unholy Sword
  'pf1/hfca2lb4tlmrzoxm', // Firebrand
  'pf1/hi72gh3dlf7a1qyt', // Maze
  'pf1/hjmisosq82rnt21i', // Bow Spirit
  'pf1/hk3xhc08blqzniv0', // Daze
  'pf1/hlom4mgjkdy2dd5u', // Weapon of Awe
  'pf1/hqorwsybk8u2wrd7', // Gravity Bow
  'pf1/hrlql4cdfkppfblb', // Rope Trick
  'pf1/hy95c7we5tfxqzri', // Wall of Sound
  'pf1/i22bvq17g4r3bp4j', // Pillar of Life
  'pf1/i973i4haczi7e0xp', // Rally Point
  'pf1/igmb8lisqcnsxd2d', // Restoration, Greater
  'pf1/ik9u3eel5vfwrtb5', // Grease
  'pf1/ip9onjfp6nf1vlv9', // Light
  'pf1/sfkg0szik18z0wrb', // Arcana Theft
  'pf1/sn3mvplvwktbc9hl', // Inflict Moderate Wounds, Mass
  'pf1/snj78r5rw96btfjn', // Create Water
  'pf1/spmmt3l9ch7t3zfj', // Tiny Hut
  'pf1/spni4gy84sp8ftkv', // Hide Campsite
  'pf1/steozrynqopyxiua', // Long Arm
  'pf1/sv9mj8rvqmfogwyu', // Summon Eidolon
  'pf1/sw043b79qfk3lj2e', // Flame Arrow
  'pf1/sw2nmtsjv1f2kx24', // Antiplant Shell
  'pf1/sxmqgt29h4ojebx6', // Scent Trail
  'pf1/sxtpslsxy4yn66tg', // Amplify Elixir
  'pf1/t1w2zq5fx7mislq8', // Touch of Fatigue
  'pf1/t8ei2mrmqg7252vw', // Baleful Polymorph
  'pf1/tfml9xp8w3xdq0e8', // Blood Biography
  'pf1/2y9e1l6zso9tdg0a', // Reduce Person (closure)
];

/** Closure entries that are not themselves wave keys (all admitted earlier). */
const CONTEXT_KEYS = [
  'pf1/fxz69pwpqt9b6uss', // Restoration, Lesser
  'pf1/dhjhfv5hzthy0fgu', // Inflict Light Wounds, Mass
  'pf1/w88ddxpu89qcr5c0', // Beast Shape III
  'pf1/774kmgcb7ygviht0', // Beast Shape II
  'pf1/tjdfluulncmqacc3', // Beast Shape I
];

const context = waveBindingContext({
  wave: 'CL4',
  sources: SOURCES,
  keys: WAVE_CL4_KEYS,
  contextKeys: CONTEXT_KEYS,
});

/** The 46 entries, sorted by key: the wave's keys and the context they reach. */
export const waveCl4Closure: readonly PreviewEntry[] = context.closure;

/** A wave CL4 Spell's full-corpus entry and its closure as the artifact. */
export const waveCl4BindingContext = context.bindingContext;
