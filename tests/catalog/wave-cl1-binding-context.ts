import { readFileSync } from 'node:fs';
import type { AdmissionSource } from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';

/**
 * Wave CL1 (#527 and #542): the 60 re-assessed Spells and every entry their
 * gate closures reach, as the full-corpus preview imports them. Their batches'
 * bounded fixtures predate later changes to the bodies some of them link, so a
 * wave CL1 row binds against these entries, as the gate does (wave F2's
 * binding-context precedent).
 *
 * Each entry is read from the committed preview that already holds it, exactly
 * equal to the full-corpus import; only keys are stored here.
 */
const SOURCES = [
  'spells-527/preview.json',
  'spells-527/binding-preview.json',
  'spells-542/preview.json',
  'spells-537/preview.json',
  'spells-538/preview.json',
  'spells-543/preview.json',
  'spells-546/preview.json',
] as const;

/** The wave's re-assessed keys: 51 roots, then 9 closure keys. */
export const WAVE_CL1_KEYS: readonly string[] = [
  'pf1/cx711jp7ufpt5n77', // Blaze of Glory
  'pf1/cp5m19me647dojha', // Changestaff
  'pf1/crq6etku9g9o2imx', // Devolution
  'pf1/dq65gtj0phmasj87', // Divine Transfer
  'pf1/d3a93wcwatqhywqy', // Fire Snake
  'pf1/djv6d485oznk72f1', // Fire of Entanglement
  'pf1/co28xtj01acamq9z', // Firefall
  'pf1/d8yy4njnr25hacek', // Glide
  'pf1/dhjhfv5hzthy0fgu', // Inflict Light Wounds, Mass
  'pf1/co0mc49xhtf7aczt', // Invigorate, Mass
  'pf1/cxgi0ub77t6aink1', // Invisibility, Greater
  'pf1/d0rd4z2kcln69xif', // Lead Blades
  'pf1/cxp0vodhvuwnfmye', // Litany of Madness
  'pf1/dlmeq0hpxfbjtibb', // Mind Fog
  'pf1/ch6iof333ghti2tj', // Negate Aroma
  'pf1/d40ia71c2eljm91k', // Polymorph
  'pf1/dckgxyd6ariois1s', // Primal Scream
  'pf1/dm52jk1e37b05v9d', // Righteous Vigor
  'pf1/d6lfhyonb3ewpjt4', // Secret Chest
  'pf1/d0d86z521shpman1', // Sending
  'pf1/cmwcavfyc1vbehy8', // Shadow Step
  'pf1/ct9fhh8uawn8e4md', // Speak with Animals
  'pf1/ci6r8zasm4exo85c', // Thundering Drums
  'pf1/df1xj7itjzu1hcyc', // Tireless Pursuit
  'pf1/d8ok0wwf6twlqiho', // Venomous Bolt
  'pf1/dpdfv4rvj5quxo7e', // Wave Shield
  'pf1/vi7biwvv87ra1zef', // Aura of Greater Courage
  'pf1/usdv1eqvibmxun6x', // Bear's Endurance
  'pf1/v2cz94zxdkhshd1r', // Bomber's Eye
  'pf1/vhfj5bkt9hmgvh9p', // Bullet Shield
  'pf1/v8cj29iz2ok4z694', // Burrow
  'pf1/uqh87jz757r2cb7r', // Detect Magic
  'pf1/uuzeynxotp9dzu15', // Expend
  'pf1/vi5fko8sb8mxlk0i', // Fire Trap
  'pf1/vefvam94asoxl7ow', // Gloomblind Bolts
  'pf1/vct8uncenmmkf0up', // Hellmouth Lash
  'pf1/uv3bvuerhe0furhu', // Hollow Heroism
  'pf1/vd4xn8jmxica85ez', // Inflict Serious Wounds
  'pf1/v0o7d0io653ctspi', // Ki Arrow
  'pf1/uo317ywjn95w316n', // Paladin's Sacrifice
  'pf1/vappsitr1eswxhw8', // Reviving Finale
  'pf1/v05u8sl116ab2n9c', // Shillelagh
  'pf1/v2vylzr1sxk2em93', // Stone Discus
  'pf1/uwfm60ovjpdudwhc', // Strong Jaw
  'pf1/v8s6gfrhzzzhru7k', // Telekinetic Sphere
  'pf1/v6hay9644wlopisd', // Treasure Stitching
  'pf1/v9fm3tvbahmqlugg', // Twin Form
  'pf1/v1nropy1tvj0476l', // Urban Step
  'pf1/uus00fo4fn7yro0w', // Vermin Shape I
  'pf1/vjnynvz1omleni8a', // Versatile Weapon
  'pf1/uqm9qhmeetoiype1', // Wake of Light
  'pf1/oylikodnyku2zewu', // Invisibility
  'pf1/vdh0yuzpjwhky6kr', // Poison
  'pf1/vqfrp8t0c1lw1jna', // Heroism
  'pf1/cvv6oimqks9n62vy', // Magic Weapon
  'pf1/zq7xi7l5vgpqu7rt', // Magic Weapon, Greater
  'pf1/9d9rk0olitnscems', // Invigorate
  'pf1/kouqz0pm1xl8xilm', // Alter Self
  'pf1/qooag8g9dxck4lik', // Inflict Light Wounds
  'pf1/p0bhjyhpgn4pfgzi', // Resilient Sphere
];

/** Closure entries that are not themselves wave keys. */
const CONTEXT_KEYS = [
  'pf1/774kmgcb7ygviht0', // Beast Shape II
  'pf1/pawbnw1nm4f0b98e', // Elemental Body I
  'pf1/tjdfluulncmqacc3', // Beast Shape I
];

function previewEntries(name: string): PreviewEntry[] {
  const preview = JSON.parse(
    readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'),
  ) as { entries: PreviewEntry[] };
  return preview.entries;
}

/** The first listed preview holding each key supplies its entry. */
function assembleClosure(): PreviewEntry[] {
  const wanted = new Set([...WAVE_CL1_KEYS, ...CONTEXT_KEYS]);
  const found = new Map<string, PreviewEntry>();
  for (const name of SOURCES)
    for (const entry of previewEntries(name))
      if (wanted.has(entry.externalKey) && !found.has(entry.externalKey))
        found.set(entry.externalKey, entry);
  const missing = [...wanted].filter((key) => !found.has(key));
  if (missing.length)
    throw new Error(`Wave CL1 context missing ${missing.join(', ')}`);
  return [...found.values()].sort((a, b) =>
    a.externalKey < b.externalKey ? -1 : 1,
  );
}

const closure = assembleClosure();
const entries = new Map(closure.map((entry) => [entry.externalKey, entry]));

/** The 63 entries, sorted by key: the wave's keys and the context they reach. */
export const waveCl1Closure: readonly PreviewEntry[] = closure;

/** A wave CL1 Spell's full-corpus entry and its closure as the artifact. */
export function waveCl1BindingContext(externalKey: string): {
  entry: PreviewEntry;
  artifact: AdmissionSource;
} {
  const entry = entries.get(externalKey);
  if (!entry || !WAVE_CL1_KEYS.includes(externalKey))
    throw new Error(`${externalKey} is not a wave CL1 key`);
  return {
    entry,
    artifact: {
      catalog: { entries: closure, resources: [], remaps: [] },
      comparison: { records: [], packs: [] },
    },
  };
}
