import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import {
  alignmentNames,
  alignments,
  normalize,
  normalizePrerequisiteAtom,
  type Alignment,
} from '../../src/lib/character-sheet-prerequisite-schema.ts';
import type { Ability } from '../../src/lib/character-sheet-abilities.ts';
import type {
  Prerequisite,
  PrerequisiteAtom,
} from '../../src/lib/character-sheet-prerequisites.ts';
import type { ManualProficiency } from '../../src/lib/character-sheet-proficiency-schema.ts';
import { skillDefinitions } from '../../src/lib/character-sheet-skills.ts';
import { sourceDescription, uuidKey, type LoadedRecord } from './records.ts';
import { reviewedDeityRequirements } from './selection-import-rules.ts';
import { readArray, readObject, readText } from './values.ts';
import { pcgenBooks } from './pcgen-books.ts';

type ParseContext = {
  source: LoadedRecord;
  lookup: ReadonlyMap<string, LoadedRecord>;
  resolveKey: (key: string) => string | undefined;
};
const abilityNames: Record<string, Ability> = {
  str: 'strength',
  strength: 'strength',
  dex: 'dexterity',
  dexterity: 'dexterity',
  con: 'constitution',
  constitution: 'constitution',
  int: 'intelligence',
  intelligence: 'intelligence',
  wis: 'wisdom',
  wisdom: 'wisdom',
  cha: 'charisma',
  charisma: 'charisma',
};

const citationTitle = (text: string) =>
  normalize(text)
    .replace(
      /^pathfinder\s+(?:rpg|campaign setting|player companion)\s*:?\s*/,
      '',
    )
    .replace(/^the\s+/, '');
const citationTitles = new Set(
  pcgenBooks.books
    .flatMap((book) => [
      book.book,
      book.title.sourceLong,
      book.code.foundryName,
    ])
    .map(citationTitle),
);
function withoutCitations(text: string) {
  return text.replace(/\s*\(([^()]+)\)/g, (parentheses, content: string) => {
    const citation = /^(.+?)\s+(?:pp?\.?\s*)?\d+(?:[-–]\d+)?$/.exec(content);
    return citation && citationTitles.has(citationTitle(citation[1] ?? ''))
      ? ''
      : parentheses;
  });
}

function prerequisiteLine(html: string) {
  function read(node: DefaultTreeAdapterMap['childNode']): string {
    if (node.nodeName === '#text' && 'value' in node) return node.value;
    if (!('tagName' in node) || ['script', 'style'].includes(node.tagName))
      return '';
    const text = node.childNodes.map(read).join('');
    return ['p', 'div', 'br', 'li'].includes(node.tagName)
      ? `\n${text}\n`
      : text;
  }
  const text = parseFragment(html).childNodes.map(read).join('');
  const line = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .find((line) => /^(?:Prerequisites?|Requirements?)\s*:/i.test(line));
  return line
    ? {
        heading: /^Requirements?/i.test(line)
          ? 'requirements'
          : 'prerequisites',
        text: line
          .replace(/^(?:Prerequisites?|Requirements?)\s*:\s*/i, '')
          .replace(/\.$/, ''),
      }
    : undefined;
}
function splitClauses(text: string, separators = ',;') {
  let depth = 0;
  let start = 0;
  const clauses: string[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '(' || text[index] === '[' || text[index] === '{')
      depth += 1;
    if (text[index] === ')' || text[index] === ']' || text[index] === '}')
      depth -= 1;
    if (
      separators.includes(text[index] ?? '') &&
      depth === 0 &&
      (text[index] !== '.' || /^\.\s+[A-Z]/.test(text.slice(index)))
    ) {
      clauses.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  clauses.push(text.slice(start).trim());
  return clauses.filter(Boolean);
}
function referenceKind(source: LoadedRecord) {
  if (source.record.type === 'class') return 'class';
  if (source.record.type === 'race') return 'race';
  if (/racial.trait/.test(source.pack)) return 'racialTrait';
  if (/class.abili/.test(source.pack)) return 'classFeature';
  return source.record.type === 'feat' && /^(?:pf-)?feats$/.test(source.pack)
    ? 'feat'
    : undefined;
}
function sourceReferenceKind(text: string, context: ParseContext) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const description = sourceDescription(context.source.record);
  const prerequisite = prerequisiteLine(description);
  // Repeated names can describe different alternatives. Only their own
  // explicit wording (or UUID) can determine each occurrence's kind.
  if (
    (prerequisite?.text.match(new RegExp(`\\b${escaped}\\b`, 'gi'))?.length ??
      0) > 1
  )
    return;
  const body = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const feat = new RegExp(`\\b${escaped}\\s+feat\\b`, 'i').test(body);
  const feature = new RegExp(`\\b${escaped}\\s+class feature\\b`, 'i').test(
    body,
  );
  return feat !== feature ? (feat ? 'feat' : 'classFeature') : undefined;
}
function isRaceTrait(source: LoadedRecord) {
  return (
    source.pack === 'pf-traits' && source.record.system.traitType === 'race'
  );
}
function matchesReferenceName(source: LoadedRecord, text: string) {
  const name = source.record.name.replace(/\s*\(UC\)$/, '');
  if (normalize(name) === normalize(text).replace(/\s*\(uc\)$/, ''))
    return true;
  // Owner-qualified feature names are ambiguity evidence, not equivalent
  // identities. A bare name must not silently select the unqualified owner.
  return (
    referenceKind(source) === 'classFeature' &&
    /\s+\([A-Z]{2,3}\)$/.test(name) &&
    normalize(name.replace(/\s+\([A-Z]{2,3}\)$/, '')) === normalize(text)
  );
}
function namedReference(
  text: string,
  context: ParseContext,
  kind?: ReturnType<typeof referenceKind>,
) {
  const uuid = /^@(?:UUID|Compendium)\[([^\]]+)\](?:\{[^}]*\})?$/.exec(text);
  if (uuid) {
    const key = uuidKey(
      uuid[1]?.startsWith('Compendium.') ? uuid[1] : `Compendium.${uuid[1]}`,
    );
    const source = key ? context.lookup.get(key) : undefined;
    const identity = key ? context.resolveKey(key) : undefined;
    if (source && identity) return { source, identity };
    return;
  }
  const namedCandidates = [...context.lookup.entries()].filter(
    ([, source]) =>
      referenceKind(source) !== undefined && matchesReferenceName(source, text),
  );
  const namesRule = namedCandidates.some(([, source]) =>
    ['feat', 'classFeature'].includes(referenceKind(source) ?? ''),
  );
  const tags = readArray(context.source.record.system.tags);
  const namesRacialOption =
    (isRaceTrait(context.source) ||
      (referenceKind(context.source) === 'feat' &&
        tags.some(
          (tag) => typeof tag === 'string' && normalize(tag) === 'racial',
        ))) &&
    tags.some(
      (tag) => typeof tag === 'string' && normalize(tag) === normalize(text),
    );
  const requiredKind =
    kind ??
    (namesRacialOption
      ? 'race'
      : namesRule
        ? (sourceReferenceKind(text, context) ??
          (referenceKind(context.source) === 'feat' ||
          context.source.pack === 'pf-traits'
            ? 'feat'
            : undefined))
        : undefined);
  const candidates = namedCandidates.filter(
    ([, source]) => !requiredKind || referenceKind(source) === requiredKind,
  );
  if (new Set(candidates.map(([, source]) => referenceKind(source))).size > 1)
    return;
  if (
    candidates.some(([, source]) => referenceKind(source) === 'classFeature') &&
    new Set(
      candidates.map(([, source]) =>
        normalize(source.record.name).replace(/\s*\(uc\)$/, ''),
      ),
    ).size > 1
  )
    return;
  const preferred = candidates.filter(([, source]) => source.repo === 'pf1');
  const matches = preferred.length ? preferred : candidates;
  if (matches.length !== 1) return;
  const match = matches[0];
  const identity = match && context.resolveKey(match[0]);
  return match && identity ? { source: match[1], identity } : undefined;
}
function classFeatureClass(identity: string, context: ParseContext) {
  const owners = new Set<string>();
  for (const [key, source] of context.lookup) {
    if (source.record.type !== 'class') continue;
    const associations = readArray(
      readObject(source.record.system.links).classAssociations,
    );
    const ownsFeature = associations.some((association) => {
      const featureKey = uuidKey(
        readText({ value: readObject(association).uuid }),
      );
      return featureKey && context.resolveKey(featureKey) === identity;
    });
    const classIdentity = context.resolveKey(key);
    if (ownsFeature && classIdentity) owners.add(classIdentity);
  }
  return owners.size === 1 ? [...owners][0] : undefined;
}
function atom(
  text: string,
  context: ParseContext & { heading: string },
): PrerequisiteAtom {
  const clean = withoutCitations(text.trim().replace(/\.$/, ''));
  const ability =
    /^(str(?:ength)?|dex(?:terity)?|con(?:stitution)?|int(?:elligence)?|wis(?:dom)?|cha(?:risma)?)\s+(\d+)$/i.exec(
      clean,
    );
  const abilityKey = ability?.[1] && abilityNames[normalize(ability[1])];
  if (ability && abilityKey)
    return { ability: abilityKey, min: Number(ability[2]) };
  const bab = /^(?:base attack bonus|BAB)\s*\+?(\d+)$/i.exec(clean);
  if (bab) return { bab: Number(bab[1]) };
  const skill = /^(.+?)\s+(\d+)\s+ranks?$/i.exec(clean);
  const skillDefinition =
    skill &&
    skillDefinitions.find(
      (definition) => normalize(definition.name) === normalize(skill[1] ?? ''),
    );
  if (skill && skillDefinition)
    return { skillRanks: skillDefinition.key, min: Number(skill[2]) };
  const character =
    /^(?:character level\s+(\d+)(?:st|nd|rd|th)?|(\d+)(?:st|nd|rd|th)-level)$/i.exec(
      clean,
    );
  if (character)
    return { characterLevel: Number(character[1] ?? character[2]) };
  const ordinalClass = /^(\d+)(?:st|nd|rd|th)-level\s+(.+)$/i.exec(clean);
  const classLevel =
    /^(.+?)\s+level\s+(\d+)(?:st|nd|rd|th)?$/i.exec(clean) ??
    (ordinalClass ? [clean, ordinalClass[2], ordinalClass[1]] : null);
  if (classLevel) {
    const reference = namedReference(classLevel[1] ?? '', context, 'class');
    if (reference && referenceKind(reference.source) === 'class')
      return { classLevel: reference.identity, min: Number(classLevel[2]) };
  }
  if (
    /^(?:proficiency with (?:the )?selected weapon|proficient with (?:the )?selected weapon)$/i.test(
      clean,
    )
  )
    return { proficiency: { choice: true } };
  const featChoice = /^(.+?)\s+\(([^)]+)\)$/.exec(clean);
  const explicitFeature = /\s+class feature$/i.test(clean);
  const directReference = namedReference(clean, context);
  const reference =
    directReference ??
    namedReference(
      clean.replace(/\s+class feature$/i, ''),
      context,
      explicitFeature ? 'classFeature' : undefined,
    ) ??
    (featChoice ? namedReference(featChoice[1] ?? '', context) : undefined);
  const proficiencyName = normalize(reference?.source.record.name ?? clean);
  const weaponProficiencyName = normalize(
    reference?.source.record.name ?? featChoice?.[1] ?? clean,
  );
  if (
    /^(?:martial|exotic) weapon proficiency$/.test(weaponProficiencyName) &&
    featChoice?.[2]
  )
    return /\bor\b/i.test(featChoice[2])
      ? { unchecked: readableText(clean, context) }
      : { proficiency: { baseType: featChoice[2] } };
  if (weaponProficiencyName === 'exotic weapon proficiency')
    return { unchecked: readableText(clean, context) };
  const proficiency = new Map<
    string,
    Extract<ManualProficiency, { category: string }>['category']
  >([
    ['martial weapon proficiency', 'martial'],
    ['simple weapon proficiency', 'simple'],
    ['light armor proficiency', 'light'],
    ['medium armor proficiency', 'medium'],
    ['heavy armor proficiency', 'heavy'],
    ['armor proficiency (light)', 'light'],
    ['armor proficiency (medium)', 'medium'],
    ['armor proficiency (heavy)', 'heavy'],
    ['shield proficiency', 'shield'],
    ['tower shield proficiency', 'towerShield'],
  ]).get(proficiencyName);
  if (proficiency) return { proficiency: { category: proficiency } };
  const worship = /^(?:worshiper|worshipper) of\s+(.+)$/i.exec(clean);
  const deityName =
    worship?.[1] ?? (context.heading === 'requirements' ? clean : undefined);
  const deity = deityName
    ? reviewedDeityRequirements.find(
        (requirement) => normalize(requirement.name) === normalize(deityName),
      )
    : undefined;
  if (deity) return { deity: deity.name };
  const alignmentSets: Record<string, Alignment[]> = {
    ...Object.fromEntries(
      alignments.map((alignment) => [
        normalize(alignmentNames[alignment]),
        [alignment],
      ]),
    ),
    'any nonlawful': ['NG', 'CG', 'N', 'CN', 'NE', 'CE'],
    'any lawful': ['LG', 'LN', 'LE'],
    'any chaotic': ['CG', 'CN', 'CE'],
    'any good': ['LG', 'NG', 'CG'],
    'any evil': ['LE', 'NE', 'CE'],
    good: ['LG', 'NG', 'CG'],
    evil: ['LE', 'NE', 'CE'],
    lawful: ['LG', 'LN', 'LE'],
    chaotic: ['CG', 'CN', 'CE'],
  };
  const alignment =
    alignmentSets[normalize(clean).replace(/\s+alignment$/, '')];
  if (alignment) return { alignment };
  if (reference) {
    const kind = referenceKind(reference.source);
    if (kind === 'feat' && !/\bor\b|\bany\b|\[|\]/i.test(featChoice?.[2] ?? ''))
      return featChoice && !directReference
        ? { feat: reference.identity, choice: featChoice[2] }
        : { feat: reference.identity };
    if (kind === 'race' && !featChoice) return { race: [reference.identity] };
    if (
      kind === 'classFeature' &&
      (!featChoice || directReference) &&
      (explicitFeature ||
        sourceReferenceKind(clean, context) === kind ||
        /^@(?:UUID|Compendium)\[/.test(clean))
    ) {
      const owner = classFeatureClass(reference.identity, context);
      return {
        classFeature: reference.identity,
        classFeatureName: reference.source.record.name.replace(
          /\s*\(UC\)$/,
          '',
        ),
        ...(owner ? { classFeatureClass: owner } : {}),
      };
    }
    if (kind === 'racialTrait' && /^@(?:UUID|Compendium)\[/.test(clean))
      return { racialTrait: reference.identity };
  }
  return { unchecked: readableText(clean, context) };
}

function readableText(text: string, context: ParseContext) {
  return text.replace(
    /@(?:UUID|Compendium)\[[^\]]+\](?:\{([^}]+)\})?/g,
    (token: string, label: string | undefined) =>
      label ??
      namedReference(token, context)?.source.record.name ??
      'Unresolved reference',
  );
}

export function mapPrerequisites(context: ParseContext): {
  prerequisiteText?: string;
  prerequisites?: Prerequisite[];
} {
  const line = prerequisiteLine(sourceDescription(context.source.record));
  if (!line?.text) return {};
  const { text, heading } = line;
  const parsedAtom = (text: string) =>
    normalizePrerequisiteAtom(atom(text, { ...context, heading }));
  const clauses = splitClauses(text, ';.').flatMap((segment) => {
    if (
      /^(?:you\b|must\b|no\b|ability to\b|able to\b|proficien(?:cy|t)\b|if\b)/i.test(
        segment,
      )
    )
      return [segment];
    const clauses = splitClauses(segment, ',');
    if (
      isRaceTrait(context.source) &&
      clauses.length > 1 &&
      clauses.every((clause) => parsedAtom(clause).kind === 'race')
    )
      return [clauses.join(' or ')];
    for (let index = 0; index < clauses.length; index += 1) {
      const clause = clauses[index] ?? '';
      if (!/^or\s+/i.test(clause)) continue;
      const last = clause.replace(/^or\s+/i, '');
      const kind = parsedAtom(last).kind;
      if (kind === 'unchecked') return [segment];
      const previousKind = parsedAtom(clauses[index - 1] ?? '').kind;
      const groupKinds =
        kind === 'classFeature'
          ? ['bab', 'classLevel', 'skillRanks'].includes(previousKind)
            ? [previousKind, 'bab', 'classLevel', 'classFeature']
            : ['feat', 'classFeature']
          : kind === 'feat'
            ? ['feat', 'classFeature']
            : ['bab', 'classLevel', 'classFeature'];
      const sameGroup = (text: string) => {
        const candidate = parsedAtom(text).kind;
        return kind === 'race' || kind === 'alignment'
          ? candidate === kind
          : groupKinds.includes(candidate);
      };
      let start = index;
      while (start > 0 && sameGroup(clauses[start - 1] ?? '')) start -= 1;
      if (start === index) return [segment];
      clauses.splice(
        start,
        index - start + 1,
        [...clauses.slice(start, index), last].join(' or '),
      );
      index = start;
    }
    return clauses;
  });
  const prerequisites = clauses.map((clause): Prerequisite => {
    if (namedReference(clause, context)) return parsedAtom(clause);
    let depth = 0;
    let start = 0;
    const alternatives: string[] = [];
    for (let index = 0; index < clause.length; index += 1) {
      if ('([{'.includes(clause[index] ?? '')) depth += 1;
      if (')]}'.includes(clause[index] ?? '')) depth -= 1;
      const separator =
        depth === 0 ? /^\s+or\s+/i.exec(clause.slice(index)) : undefined;
      if (separator) {
        alternatives.push(clause.slice(start, index).trim());
        index += separator[0].length - 1;
        start = index + 1;
      }
    }
    alternatives.push(clause.slice(start).trim());
    if (alternatives.length === 1) return parsedAtom(clause);
    const last = alternatives.at(-1) ?? '';
    const suffix =
      /(?:\s+level\s+\d+(?:st|nd|rd|th)?|\s+\d+\s+ranks?|\s+\d+)$/i.exec(
        last,
      )?.[0];
    const lastKind = parsedAtom(last).kind;
    const atoms = alternatives.map((text) => {
      const original = parsedAtom(text);
      if (
        !suffix ||
        original.kind !== 'unchecked' ||
        !['ability', 'skillRanks', 'classLevel'].includes(lastKind)
      )
        return original;
      const expanded = parsedAtom(text + suffix);
      return expanded.kind === lastKind ? expanded : original;
    });
    if (atoms.every((atom) => atom.kind === 'alignment'))
      return {
        kind: 'alignment',
        alignment: [...new Set(atoms.flatMap((atom) => atom.alignment))],
      };
    return atoms.some((atom) => atom.kind === 'unchecked')
      ? { kind: 'unchecked', unchecked: readableText(clause, context) }
      : { anyOf: atoms };
  });
  const readable = readableText(text, context);
  return { prerequisiteText: readable, prerequisites };
}
