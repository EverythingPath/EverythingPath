import type { PreviewEntry } from '../../scripts/catalog/map';
import { waveBindingContext } from './wave-binding-context';

/**
 * Wave CL2 (#525 and #537): the 48 re-assessed Spells and every entry their
 * gate closures reach, as the full-corpus preview imports them. A wave CL2 row
 * binds against these entries, as the gate does (wave CL1's binding context).
 *
 * Each entry is read from the committed preview that already holds it, exactly
 * equal to the full-corpus import; only keys are stored here.
 */
const SOURCES = [
  'spells-525/binding-preview.json',
  'spells-537/preview.json',
  'spells-534/preview.json',
  'spells-541/preview.json',
  'spells-523/preview.json',
] as const;

/** The wave's re-assessed keys: 42 roots (two on named holds), then 6 closure keys. */
export const WAVE_CL2_KEYS: readonly string[] = [
  'pf1/a1jn7g374wcrb9mz', // Stone to Flesh
  'pf1/a284vfyjpxla98v0', // Transmogrify
  'pf1/a2y1yf0a4jy3610w', // Hallucinatory Terrain
  'pf1/a6a6s9jysswthu3r', // Guiding Star
  'pf1/a6isom7wx0nmhwfp', // Prestidigitation
  'pf1/a6vrmpywwpg4dpwx', // Shock Shield
  'pf1/a73dq2t8pd5n0y1g', // Retribution
  'pf1/aa0w7tk852iqn3ni', // Detect Undead
  'pf1/abdap816xisu362w', // Honeyed Tongue
  'pf1/acjpqe8vchvzt5rl', // Air Geyser
  'pf1/ad5nqt2ll67zt64d', // Shocking Image
  'pf1/anya5qwdjhdfyk8u', // Restoration
  'pf1/aoov6nqfm195txdb', // Forceful Hand
  'pf1/aq152bwi65cfz8fo', // Phobia
  'pf1/aqri3zf6mzgd4di6', // Summon Monster IV
  'pf1/atml1a51o9w777w7', // Undead Anatomy I
  'pf1/b1wzbehqfac9s1be', // Mage's Faithful Hound
  'pf1/b3hyz4dnnkgw9nfu', // Blade Lash
  'pf1/b3slhttlo5jytfti', // Ki Leech
  'pf1/b433azw2m5ov8pkq', // Thorny Entanglement
  'pf1/b8h35mj2mzvhbqux', // Heroic Fortune (named hold)
  'pf1/b9ggsagifzk4fwut', // Owl's Wisdom
  'pf1/ba8ur1roqmqxn0j5', // Elemental Speech
  'pf1/ook1mq55lqyeppel', // Touch of Slime
  'pf1/oplskt3tgws8ujv8', // Spectral Hand
  'pf1/orfdhrn1ze8h71ds', // Bristle
  'pf1/oyu8efso7sio8arn', // Disrupt Undead
  'pf1/ozcg2uihudylm27s', // Unwitting Ally
  'pf1/p222zrbf0ynwblzd', // Cacophonous Call
  'pf1/p2kosvizylhy8vfa', // Commune
  'pf1/p46zbz8sj1are8yj', // Oath of Peace
  'pf1/p4h6ocn0axh59xrc', // Unshakable Zeal (named hold)
  'pf1/p4l1e3hih2gau0df', // Discordant Blast
  'pf1/p7edwwc2h3mb0bo5', // Ghostbane Dirge, Mass
  'pf1/p8dbns0wei8eayas', // Sepia Snake Sigil
  'pf1/p8guuisr2o3butpj', // Blood Transcription
  'pf1/p8lm7khq3ynyif21', // Mage Hand
  'pf1/pa6mgkl4caihdrhm', // Giant Vermin
  'pf1/pasrd8rsy38vmaw6', // Diminish Plants
  'pf1/pbbzalvsxxhop3q3', // Thunderstomp, Greater
  'pf1/ph3krpxerzptnwbl', // Flaming Sphere, Greater
  'pf1/psrxebolpvm64xlg', // Corrosive Touch
  'pf1/2nn2tshkn4p7k25l', // Entangle
  'pf1/4jsss37x0pplib8f', // Mirror Image
  'pf1/lzos34s87qsc620l', // Flaming Sphere
  'pf1/fxz69pwpqt9b6uss', // Restoration, Lesser
  'pf1/tyhxeck30qtsp35q', // Ghostbane Dirge
  'pf1/8c326bzvz1dbe6q4', // Thunderstomp
];

/** Closure entries that are not themselves wave keys. */
const CONTEXT_KEYS = [
  'pf1/wu4y1ilg6iq28cr6', // Interposing Hand
  'pf1/kyo0kwhw2jhuztju', // Summon Monster I
];

const context = waveBindingContext({
  wave: 'CL2',
  sources: SOURCES,
  keys: WAVE_CL2_KEYS,
  contextKeys: CONTEXT_KEYS,
});

/** The 50 entries, sorted by key: the wave's keys and the context they reach. */
export const waveCl2Closure: readonly PreviewEntry[] = context.closure;

/** A wave CL2 Spell's full-corpus entry and its closure as the artifact. */
export const waveCl2BindingContext = context.bindingContext;
