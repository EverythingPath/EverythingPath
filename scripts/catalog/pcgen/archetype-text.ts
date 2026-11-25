import type { ScheduledFeature } from './schedule-model';

/**
 * Reading an archetype's own text against its class's reviewed schedule
 * (archetype-mapper-2): its sentences, and which schedule features a sentence
 * names. A name matches as whole words, its articles, a trailing
 * parenthetical tag (`Flurry of Blows (UC)`) and a final plural `s` aside,
 * longest name first, and each match is blanked before shorter names are
 * looked for, so "improved evasion" names Improved Evasion and not Evasion,
 * and "rage powers" Rage Powers and not Rage. A name followed by "slot" is
 * the slot's: "bonus school spell slots" (Sword Binder) names no Spells. A
 * final "y" also reads as "ies", and the words of a name may be joined by a
 * hyphen or written as one.
 */

/** Lower case, apostrophes straightened, possessives and articles dropped. */
export function normaliseText(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/(\w)'s\b/g, '$1')
    .replace(/(\w)s'(?!\w)/g, '$1s')
    .replace(/\b(?:the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A PCGen DESC's sentences: split after `.`, `!` or `?` and at `&nl;`. */
export function sentencesOf(text: string) {
  return text
    .split(/&nl;|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stemOf = (name: string) => {
  const normalised = normaliseText(name.replace(/\s*\([^()]*\)$/, ''));
  return normalised.length > 3 ? normalised.replace(/s$/, '') : normalised;
};

/** A name as the pattern it is found by in normalised text. */
const namePattern = (name: string) => {
  const stem = stemOf(name);
  // "favored enemies" names Favored Enemy; "wildshape" and
  // "jack-of-all-trades" name Wild Shape and Jack of All Trades.
  const body = /[^aeiou]y$/.test(stem)
    ? `${escape(stem.slice(0, -1))}(?:y|ies)`
    : `${escape(stem)}(?:e?s)?`;
  return new RegExp(
    `(?<![\\w'-])${body.replace(/ /g, '[\\s-]?')}(?![\\w-])(?!\\s+slots?\\b)`,
  );
};

/** Whether normalised text names a name, as `featuresNamedIn` finds it. */
export const isNamedIn = (text: string, name: string) =>
  namePattern(name).test(text);

/** A PCGen variable suffix as words: `FinalJudgment1` is "final judgment". */
export const suffixWords = (suffix: string) =>
  suffix
    .replace(/(?:Lvl)?\d+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

/**
 * The schedule features a piece of normalised text names, longest name
 * first, each match blanked so a shorter name inside it isn't found again;
 * with where each was found. `masks` are other names the class knows, such
 * as a defect's or a non-row's ("final judgment", "power over undead"):
 * blanked in the same order, they name no feature, so "replaces final
 * judgment" names no Judgment. A mask spelled like a feature is left out.
 */
export function featuresNamedIn(
  text: string,
  features: readonly ScheduledFeature[],
  masks: readonly string[] = [],
) {
  // "counter song" (Bard_CF_CounterSong) is spelled like Countersong.
  const joined = (name: string) => stemOf(name).replace(/[\s-]/g, '');
  const featureStems = new Set(features.map(({ name }) => joined(name)));
  const names = [
    ...features.map((feature) => ({ feature, name: feature.name })),
    ...masks
      .filter((mask) => !featureStems.has(joined(mask)))
      .map((name) => ({ feature: undefined, name })),
  ].sort(
    (a, b) =>
      stemOf(b.name).length - stemOf(a.name).length ||
      Number(Boolean(b.feature)) - Number(Boolean(a.feature)),
  );
  let rest = text;
  const found: { feature: ScheduledFeature; at: number; end: number }[] = [];
  for (const { feature, name } of names) {
    const match = namePattern(name).exec(rest);
    if (!match) continue;
    const end = match.index + match[0].length;
    if (feature) found.push({ feature, at: match.index, end });
    rest = `${rest.slice(0, match.index)}${'#'.repeat(match[0].length)}${rest.slice(end)}`;
  }
  return found.sort((a, b) => a.at - b.at);
}
