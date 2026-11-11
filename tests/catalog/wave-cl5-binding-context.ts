import type { PreviewEntry } from '../../scripts/catalog/map';
import { waveBindingContext } from './wave-binding-context';

/**
 * Wave CL5 (#526, #535 and #546): the 40 re-assessed Spells and every entry
 * their gate closures reach, as the full-corpus preview imports them. A wave
 * CL5 row binds against these entries, as the gate does (wave CL1's binding
 * context).
 *
 * Each entry is read from the committed preview that already holds it, exactly
 * equal to the full-corpus import; only keys are stored here.
 */
const SOURCES = [
  'spells-526/preview.json',
  'spells-535/preview.json',
  'spells-546/preview.json',
  'spells-529/preview.json',
  'spells-541/preview.json',
  'spells-537/preview.json',
  'spells-533/preview.json',
] as const;

/**
 * The wave's re-assessed keys in inventory order: spells-526's 15 roots,
 * spells-535's 14 and spells-546's 9, then Symbol of Death (#529), which
 * Symbol of Fear and Symbol of Stunning reach, and Detect Evil (#541), held on
 * a named content hold.
 */
export const WAVE_CL5_KEYS: readonly string[] = [
  'pf1/bc1vmv1ezifvfer8', // Mount
  'pf1/be8yiccvifj38hd1', // Marid's Mastery
  'pf1/bf2lu50t56iswz18', // Feather Step
  'pf1/bhmziba5gtp0yrd4', // Steal Breath
  'pf1/bp1j6n5r1lsok3kf', // Twilight Knife
  'pf1/brw5fsblcj8snqo2', // Perceive Cues
  'pf1/bvojk0ljz9brf9ig', // Symbol of Fear
  'pf1/bvsi2gzhq49mmt2f', // Simulacrum
  'pf1/c0hvjnqzry149ugs', // Curse Water
  'pf1/c11olzqztodz5o5x', // Vanish
  'pf1/c3qqu6l3vdcfaoh7', // Sequester
  'pf1/c3vws58yy0pk47gs', // Planar Ally, Lesser
  'pf1/c5ipv2mivkdb03sb', // Evolution Surge, Lesser
  'pf1/c9a27yvlb5mrow83', // Boiling Blood
  'pf1/cagn38jcxzmcgf7g', // Cast Out
  'pf1/mf6k8tg8xu0wedoz', // Summon Monster VI
  'pf1/mfmo3q7h6kqr15fa', // Symbol of Stunning
  'pf1/mh42f68xv26jo42m', // Evolution Surge
  'pf1/miz7g08q96mwwwel', // Break
  'pf1/mjddoap3a58b2bux', // Sanctify Armor
  'pf1/msaqovkgfxi6q8s8', // Message
  'pf1/mt3gozaeg6qqy180', // Warp Wood
  'pf1/mtxqp85izkb20djq', // Ghost Sound
  'pf1/mxexufme4unc4l6c', // Spellstaff
  'pf1/n390v9tbwxya1tz4', // Bleed
  'pf1/n879x6fw79jiofew', // Ray of Frost
  'pf1/n8k4pdmjjg8xuv7l', // Arcane Mark
  'pf1/ngcx59msygjom4h2', // Ant Haul
  'pf1/ni93l43asrq29ytd', // Wandering Star Motes
  'pf1/zijz3jxq5xauhpd0', // Nature's Exile
  'pf1/zkvylzsupqboef0z', // Hide from Animals
  'pf1/zlo02mawsd5q1o8f', // Sculpt Sound
  'pf1/zms7u0g03ogxrvi3', // Sift
  'pf1/zotzaxjui2u1y3zb', // Blood Crow Strike
  'pf1/zpav8ywcqwkcuojw', // Consecrate
  'pf1/zpwd0f19q1lm04p3', // Phantom Steed
  'pf1/zunl3gkgtgatogjp', // Sundering Shards
  'pf1/zymaptg3vmnvfvxl', // Dancing Lights
  'pf1/g0x2fnktg1553wv1', // Symbol of Death (closure)
  'pf1/tr7m97npkbgm4wp7', // Detect Evil (closure)
];

/** Closure entries that are not themselves wave keys (both admitted earlier). */
const CONTEXT_KEYS = [
  'pf1/oylikodnyku2zewu', // Invisibility
  'pf1/kyo0kwhw2jhuztju', // Summon Monster I
];

const context = waveBindingContext({
  wave: 'CL5',
  sources: SOURCES,
  keys: WAVE_CL5_KEYS,
  contextKeys: CONTEXT_KEYS,
});

/** The 42 entries, sorted by key: the wave's keys and the context they reach. */
export const waveCl5Closure: readonly PreviewEntry[] = context.closure;

/** A wave CL5 Spell's full-corpus entry and its closure as the artifact. */
export const waveCl5BindingContext = context.bindingContext;
