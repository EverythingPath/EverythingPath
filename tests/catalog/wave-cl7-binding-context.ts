import type { PreviewEntry } from '../../scripts/catalog/map';
import { waveBindingContext } from './wave-binding-context';

/**
 * Wave CL7 (#521, #528 and #541, and the Harrow keys): the 47 re-assessed
 * Spells and every entry their gate closures reach, as the full-corpus preview
 * imports them. A wave CL7 row binds against these entries, as the gate does
 * (wave CL1's binding context).
 *
 * Each entry is read from the first committed fixture that holds it, exactly
 * equal to the full-corpus import; only keys are stored here, and the wave adds
 * no fixture. Shadow Conjuration, Greater links shadow conjuration, a Spell of
 * another batch, which spells-519's preview strips; its complete entry is
 * already committed in spell-bindings-738's full context, which is read first.
 */
const SOURCES = [
  'spell-bindings-738/full-context.json',
  'spells-521/preview.json',
  'spells-528/preview.json',
  'spells-541/preview.json',
  'spells-538/preview.json',
] as const;

/**
 * The wave's re-assessed keys in inventory order: the Harrow root Shadow
 * Conjuration, Greater (#519), spells-521's 13 roots (Unravel Destiny on a
 * named content hold), Hold Person (#522, closure), spells-528's 15 roots with
 * Shadow Conjuration (closure), Rejuvenate Eidolon, Lesser (#538, closure) and
 * spells-541's 14 roots with Move Earth (closure).
 */
export const WAVE_CL7_KEYS: readonly string[] = [
  'pf1/44nj6jzo81o9mng9', // Shadow Conjuration, Greater
  'pf1/5v3j49r4mdq9rbx6', // Paragon Surge
  'pf1/62eepdqfnmyrawcn', // Deadly Finale
  'pf1/62oq0e87kd4i36a7', // Enemy Hammer
  'pf1/65i0wc0e6fq0evk5', // Detect Animals or Plants
  'pf1/67hykfkm8zbj53rn', // Mudball
  'pf1/6fbwb3gq0g36n7r9', // Blood Scent
  'pf1/6h3p3zr2hbrjea8k', // Molten Orb
  'pf1/6ho3wsspkqkhypt0', // Tree Shape
  'pf1/6jz03m4lryndt0kd', // Phantasmal Revenge
  'pf1/6kmkxepwgsbta6ui', // Clairaudience/Clairvoyance
  'pf1/6lebv7569xsypp8u', // Rainbow Pattern
  'pf1/6lxhv5l29a98c41k', // Unravel Destiny (named content hold)
  'pf1/6vx3lvbhp6h220wq', // Thorn Javelin
  'pf1/78kwl5t99j9e8tzh', // Hold Person (closure)
  'pf1/dqj6m4atpnp7dd9k', // Flame Blade
  'pf1/ds011sdiv3d8c86w', // Cup of Dust
  'pf1/dw9vwkp70rj39lyd', // Rejuvenate Eidolon, Greater
  'pf1/e3x3r4atthq8wtr0', // Arrow Eruption
  'pf1/ea7zkaqouwphii1h', // Purified Calling
  'pf1/ech2cibcsmsms9s7', // Dust of Twilight
  'pf1/ed0epy1pofukpgm6', // Liveoak
  'pf1/ed7fvzc2p4m6n7a2', // Shadow Conjuration (closure)
  'pf1/ed93p7o0rk7wr09l', // Beguiling Gift
  'pf1/eg2gwmkpoaqljkzu', // Spark
  'pf1/eg67vvykmv9c6j7h', // Flare
  'pf1/egkveez3tq5jo04x', // Eagle Eye
  'pf1/ej87t487r59demgy', // Call Animal
  'pf1/elsmcz3jzrj1h1ev', // Fool's Forbiddance
  'pf1/esia6azb5g68tfs7', // Imprisonment
  'pf1/eu2xv8klucttzqmd', // Acid Splash
  'pf1/qwdi86zm5wbnd92l', // Rejuvenate Eidolon, Lesser (closure)
  'pf1/tog7q2uezhexxp92', // Spike Growth
  'pf1/togu205od8d2tmuf', // Cure Moderate Wounds, Mass
  'pf1/tpid8izzs2rrfxv3', // Vortex
  'pf1/ts50hpvkdgerfp1a', // Touch of the Sea
  'pf1/ts50ndgdc9ssw3ui', // Bestow Grace
  'pf1/tsndfcfijmgxs37p', // Darkness
  'pf1/tziyew0s5ufahcmv', // Earth Glide
  'pf1/u01yelxlhrd85181', // Unhallow
  'pf1/u3qfd57wvcmhgwca', // Summon Nature's Ally III
  'pf1/u7y6niex9e7tbhyp', // Resurgent Transformation
  'pf1/uddlhatt6uq4e5yf', // Hold Person, Mass
  'pf1/ufo5z8s3u6ff45t0', // Aspect of the Bear
  'pf1/ug7ycubjoxgp7ppc', // Open/Close
  'pf1/ujo3w551azr3kran', // Passwall
  'pf1/ukuyfbufbglbzfco', // Move Earth (closure)
];

/** Closure entries that are not themselves wave keys (admitted earlier). */
const CONTEXT_KEYS = [
  'pf1/0jwi6xovzukorxok', // Summon Nature's Ally I
  'pf1/ejk08uk2e3h5eg3a', // Cure Light Wounds, Mass
];

const context = waveBindingContext({
  wave: 'CL7',
  sources: SOURCES,
  keys: WAVE_CL7_KEYS,
  contextKeys: CONTEXT_KEYS,
});

/** The 49 entries, sorted by key: the wave's keys and the context they reach. */
export const waveCl7Closure: readonly PreviewEntry[] = context.closure;

/** A wave CL7 Spell's full-corpus entry and its closure as the artifact. */
export const waveCl7BindingContext = context.bindingContext;
