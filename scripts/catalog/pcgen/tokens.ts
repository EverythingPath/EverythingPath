import {
  isPrerequisiteToken,
  parsePrerequisite,
  type PcgenPrerequisite,
} from './pre';

/**
 * One LST line by its file and line number: tab-separated `TAG:value` tokens,
 * and its raw text, which structure records hash (plan §6).
 */
export type PcgenLine = {
  file: string;
  line: number;
  tokens: string[];
  text: string;
};
/**
 * A level line of a class block (`1	ABILITY:Class|AUTOMATIC|Duelist`). A
 * `<level>:REPEATLEVEL:<every>` line (`2:REPEATLEVEL:1	ADD:SPELLCASTER|Witch`)
 * applies at its level and every `repeatEvery` levels after it.
 */
export type PcgenLevelLine = PcgenLine & {
  level: number;
  repeatEvery: number | null;
};

const levelPattern = /^(\d+)(?::REPEATLEVEL:(\d+))?$/;

/** A level line's level and repeat interval, or null when the first token is no level. */
export function parseLevelToken(token: string) {
  const match = levelPattern.exec(token);
  if (!match) return null;
  const every = match[2] === undefined ? null : Number(match[2]);
  return {
    level: Number(match[1]),
    repeatEvery: every !== null && every > 0 ? every : null,
  };
}

/** The class levels a level line applies at, through `maxLevel`. */
export function levelsOf(
  { level, repeatEvery }: Pick<PcgenLevelLine, 'level' | 'repeatEvery'>,
  maxLevel: number,
) {
  if (repeatEvery === null) return [level];
  const levels: number[] = [];
  for (let at = level; at <= maxLevel; at += repeatEvery) levels.push(at);
  return levels;
}
/** An `ABILITY:<category>|<nature>|<key>|…|PRE…` grant, by the line it is on. */
export type PcgenGrant = {
  category: string;
  nature: string;
  keys: string[];
  prerequisites: PcgenPrerequisite[];
  file: string;
  line: number;
};
/** A token with the line it comes from, so merged records keep provenance. */
export type PcgenSourcedToken = { token: string; file: string; line: number };

/** Lines as PCGen's text mode reads them: `\r\n`, `\r` or `\n`. */
export const splitLines = (text: string) => text.split(/\r\n|\r|\n/);

export const lineTokens = (line: string) =>
  line
    .split('\t')
    .map((token) => token.trim())
    .filter((token) => token !== '');

/** The value of the first `<name>:` token, or null. */
export function tagValue(tokens: readonly string[], name: string) {
  const token = tokens.find((candidate) => candidate.startsWith(`${name}:`));
  return token === undefined ? null : token.slice(name.length + 1);
}

/** Every `<name>:` token's value, in line order. */
export function tagValues(tokens: readonly string[], name: string) {
  return tokens
    .filter((token) => token.startsWith(`${name}:`))
    .map((token) => token.slice(name.length + 1));
}

/** A record's KEY, else (when missing or empty) its name. */
export function keyOf(tokens: readonly string[], name: string) {
  const key = tagValue(tokens, 'KEY');
  return key === null || key === '' ? name : key;
}

function parseGrant(token: PcgenSourcedToken): PcgenGrant {
  const [category = '', nature = '', ...rest] = token.token
    .slice('ABILITY:'.length)
    .split('|');
  const firstPre = rest.findIndex(isPrerequisiteToken);
  const keys = firstPre === -1 ? rest : rest.slice(0, firstPre);
  const prerequisites = firstPre === -1 ? [] : rest.slice(firstPre);
  return {
    category,
    nature,
    keys: keys.map((key) => key.trim()),
    prerequisites: prerequisites
      .filter(isPrerequisiteToken)
      .map(parsePrerequisite),
    file: token.file,
    line: token.line,
  };
}

/** The ABILITY grants among sourced tokens. */
export function grantsOf(tokens: readonly PcgenSourcedToken[]) {
  return tokens
    .filter(({ token }) => token.startsWith('ABILITY:'))
    .map(parseGrant);
}

/** A line's tokens, each sourced to the line. */
export function sourcedTokens({
  file,
  line,
  tokens,
}: Pick<PcgenLine, 'file' | 'line' | 'tokens'>) {
  return tokens.map((token): PcgenSourcedToken => ({ token, file, line }));
}

/** The ABILITY grants on one line. */
export const lineGrants = (line: Pick<PcgenLine, 'file' | 'line' | 'tokens'>) =>
  grantsOf(sourcedTokens(line));
