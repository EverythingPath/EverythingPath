import {
  outputSchema,
  type abilitySchema,
} from '../../src/lib/catalog/curation-output-schema.ts';
import { catalogKeySchema } from '../../src/lib/catalog/imported-entry-schema.ts';
import {
  checkStructureBindings,
  structureRecordSchema,
} from './structure-curation.ts';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import {
  modifierTargets,
  personalBonusTypes,
  targetStage,
} from '../../src/lib/character-sheet.ts';
import {
  sourceDescription,
  sourceBody,
  type LoadedRecord,
  type Unsupported,
} from './records.ts';
import { readArray, readObject, readText, skillNames } from './values.ts';
import { mapFormula } from './formula.ts';
import type { ImportKind } from './inventory.ts';
import type { PreviewEntry } from './map.ts';
import { sanitizeDescription } from './sanitize.ts';
import reviewedItemAbilityPolicies from './reviewed-item-ability-policies.json';

const reviewPlaceholder =
  'Review required: replace this placeholder with readable rules text or structured outputs.';

const bindingSchema = z.object({
  externalKey: catalogKeySchema,
  kind: z.enum(['note', 'conditional', 'itemAbility', 'description']),
  target: z.string(),
  text: z.string(),
  textSha256: z.string().regex(/^[a-f0-9]{64}$/),
  actionId: z.string().min(1).optional(),
  conditionalId: z.string().min(1).optional(),
});
const recordSchema = bindingSchema
  .extend({
    status: z.enum(['drafted', 'checked']),
    outputs: z.array(outputSchema),
    rationale: z.string().min(1),
    diagnostics: z
      .array(
        z.strictObject({
          kind: z.enum(['unresolved', 'review']),
          text: z.string().min(1),
        }),
      )
      .default([]),
    reviewedBy: z.string().min(1).optional(),
    reviewedOn: z.iso.date().optional(),
    seedBindings: z.array(bindingSchema).default([]),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.textSha256 !== hashText(record.text))
      context.addIssue({
        code: 'custom',
        message: 'Curation text hash does not match exact text.',
      });
    if (
      record.status === 'checked' &&
      (!record.reviewedBy || !record.reviewedOn)
    )
      context.addIssue({
        code: 'custom',
        message: 'Checked records require reviewer and date.',
      });
    if (
      (record.status === 'checked' || record.diagnostics.length === 0) &&
      record.outputs.some(
        (output) =>
          output.kind === 'note' &&
          sanitizeNoteText(output.text).trim() === reviewPlaceholder,
      )
    )
      context.addIssue({
        code: 'custom',
        message:
          'Applicable records require replacing review placeholder Notes.',
      });
    if (
      record.status !== 'checked' &&
      record.outputs.some(
        (output) => output.kind === 'modifier' && output.stacksWithinEntry,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'stacksWithinEntry requires a checked record.',
      });
  });
export const curationSchema = z.object({
  records: z.array(recordSchema),
  structures: z.array(structureRecordSchema).optional(),
  situations: z
    .array(
      z.strictObject({
        key: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/),
        label: z.string().min(1),
        aliases: z.array(z.string().min(1)),
        reviewedBy: z.string().min(1),
        reviewedOn: z.iso.date(),
      }),
    )
    .default([]),
});
export type CurationData = z.infer<typeof curationSchema>;
export type CurationInput = z.infer<typeof bindingSchema>;
export type CurationRecord = z.infer<typeof recordSchema>;
export type CurationDiagnostic = CurationRecord['diagnostics'][number];
export type CurationOutput = z.infer<typeof outputSchema>;
export type CuratedItemAbility = z.infer<typeof abilitySchema>;

export function hashText(text: string) {
  return createHash('sha256').update(text).digest('hex');
}
type BindingIdentity = Partial<
  Record<
    | 'externalKey'
    | 'kind'
    | 'target'
    | 'actionId'
    | 'conditionalId'
    | 'textSha256',
    unknown
  >
>;
export function bindingKey(input: BindingIdentity) {
  return JSON.stringify([
    input.externalKey,
    input.kind,
    input.target,
    input.actionId,
    input.conditionalId,
    input.textSha256,
  ]);
}
function bind(input: Omit<CurationInput, 'textSha256'>): CurationInput {
  return { ...input, textSha256: hashText(input.text) };
}
export function collectCurationInputs({
  source,
  externalKey,
  kind,
}: {
  source: LoadedRecord;
  externalKey: string;
  kind: ImportKind | 'helper';
}): CurationInput[] {
  const inputs = readArray(source.record.system.contextNotes).map((value) => {
    const note = readObject(value);
    return bind({
      externalKey,
      kind: 'note',
      target: readText({ value: note.target }),
      text: readText({ value: note.text }),
    });
  });
  for (const [actionIndex, value] of readArray(
    source.record.system.actions,
  ).entries()) {
    const action = readObject(value);
    for (const [conditionalIndex, value] of readArray(
      action.conditionals,
    ).entries()) {
      const conditional = readObject(value);
      inputs.push(
        bind({
          externalKey,
          kind: 'conditional',
          actionId: readText({ value: action._id }) || String(actionIndex),
          conditionalId:
            readText({ value: conditional._id }) || String(conditionalIndex),
          target: readArray(conditional.modifiers)
            .map((value) => {
              const modifier = readObject(value);
              return `${readText({ value: modifier.target })}/${readText({ value: modifier.subTarget })}`;
            })
            .join(','),
          text: JSON.stringify(conditional),
        }),
      );
    }
  }
  if (kind === 'itemAbility')
    inputs.push(
      bind({
        externalKey,
        kind: 'itemAbility',
        target: 'description',
        text: sourceDescription(source.record),
      }),
    );
  return inputs;
}

export function collectDescriptionInputs({
  source,
  externalKey,
  kind,
  explicitlyReviewed = false,
}: {
  source: LoadedRecord;
  externalKey: string;
  kind: ImportKind | 'helper';
  explicitlyReviewed?: boolean;
}): CurationInput[] {
  const text = sourceBody({ source });
  return kind !== 'itemAbility' &&
    (explicitlyReviewed || /\b(?:vs\.?|against|when)\b/i.test(text))
    ? [bind({ externalKey, kind: 'description', target: 'description', text })]
    : [];
}

function situationsOf(output: CurationOutput) {
  if (output.kind === 'note') return [output.situation];
  if (output.kind === 'modifier') return [output.condition?.situation];
  return (output.damageDice ?? []).map((die) => die.situation);
}

export function parseCuration(value: unknown): CurationData {
  const data = curationSchema.parse(value);
  const seen = new Set<string>();
  for (const record of data.records) {
    const key = bindingKey(record);
    if (seen.has(key))
      throw new Error(
        `Duplicate curation record: ${record.externalKey} ${record.target}`,
      );
    seen.add(key);
  }
  const keys = new Set(data.situations.map((situation) => situation.key));
  if (keys.size !== data.situations.length)
    throw new Error('Duplicate shared Situation key.');
  for (const record of data.records)
    for (const output of record.outputs) {
      const situations = situationsOf(output);
      for (const situation of situations)
        if (typeof situation === 'string' && !keys.has(situation))
          throw new Error(`Unreviewed shared Situation: ${situation}`);
    }
  checkStructureBindings(data.structures ?? []);
  return data;
}

type CurationApplication = {
  inputs: CurationInput[];
  seeds: CurationInput[];
  data: CurationData;
  entries: PreviewEntry[];
  /** #719: the entry an output applies to when it is not the record's own. */
  outputHome?: (
    record: CurationRecord,
    output: CurationOutput,
  ) => string | undefined;
};

function reportCuration({ inputs, seeds, data, entries }: CurationApplication) {
  const records = new Map(
    data.records.map((record) => [bindingKey(record), record]),
  );
  const entryKeys = new Set(entries.map((entry) => entry.externalKey));
  const required = new Map(inputs.map((input) => [bindingKey(input), input]));
  const availableSeeds = new Set(seeds.map(bindingKey));
  const matched: CurationRecord[] = [];
  const missing: CurationInput[] = [];
  for (const input of required.values()) {
    const record = records.get(bindingKey(input));
    if (
      record?.seedBindings.every((seed) => availableSeeds.has(bindingKey(seed)))
    )
      matched.push(record);
    else if (input.kind !== 'description') missing.push(input);
  }
  const applied = matched.filter(
    (record) => record.status === 'checked' || record.diagnostics.length === 0,
  );
  const unresolved = matched.filter((record) =>
    record.diagnostics.some(
      (diagnostic) =>
        record.status === 'drafted' || diagnostic.kind === 'unresolved',
    ),
  );
  const unresolvedMechanics = unresolved.filter(
    (record) => record.kind !== 'description',
  );
  const unresolvedDescriptions = unresolved.filter(
    (record) => record.kind === 'description',
  );
  const gateRecords = matched.filter((record) => record.kind !== 'description');
  const descriptionRecords = matched.filter(
    (record) => record.kind === 'description',
  );
  return {
    passed: missing.length === 0 && unresolvedMechanics.length === 0,
    missing,
    applied,
    stale: data.records.filter(
      (record) =>
        entryKeys.has(record.externalKey) &&
        (!required.has(bindingKey(record)) ||
          record.seedBindings.some(
            (seed) => !availableSeeds.has(bindingKey(seed)),
          )),
    ),
    unused: data.records.filter((record) => !entryKeys.has(record.externalKey)),
    unresolvedMechanics,
    unresolvedDescriptions,
    summary: {
      required: [...required.values()].filter(
        (input) => input.kind !== 'description',
      ).length,
      drafted: gateRecords.filter((record) => record.status === 'drafted')
        .length,
      checked: gateRecords.filter((record) => record.status === 'checked')
        .length,
      missing: missing.length,
      descriptions: {
        candidates: [...required.values()].filter(
          (input) => input.kind === 'description',
        ).length,
        drafted: descriptionRecords.filter(
          (record) => record.status === 'drafted',
        ).length,
        checked: descriptionRecords.filter(
          (record) => record.status === 'checked',
        ).length,
      },
    },
  };
}

function applyCurationOutput({
  output,
  entry,
}: {
  output: CurationOutput;
  entry: PreviewEntry;
}) {
  if (output.kind === 'modifier') {
    const { kind: _, ...modifier } = output;
    entry.modifiers.push(modifier);
    return;
  }
  if (output.kind === 'note') {
    const { kind: _, ...note } = output;
    (entry.situationalNotes ??= []).push({
      ...note,
      text: sanitizeNoteText(note.text),
    });
    return;
  }
  if (entry.detail.kind !== 'itemAbility')
    throw new Error(
      `Item Ability output on ${entry.externalKey} (${entry.detail.kind}).`,
    );
  const { kind: _, sourceKey, damageDice, ...mechanics } = output;
  if (sourceKey) entry.sourceKey = sourceKey;
  entry.detail = {
    ...entry.detail,
    ...mechanics,
    ...(damageDice
      ? { damageDice: [...(entry.detail.damageDice ?? []), ...damageDice] }
      : {}),
  };
}

function applyCurationRecord({
  record,
  entry,
  homeOf,
}: {
  record: CurationRecord;
  entry: PreviewEntry;
  homeOf: (output: CurationOutput) => PreviewEntry | undefined;
}) {
  for (const output of record.outputs) {
    const home = homeOf(output);
    if (home) applyCurationOutput({ output, entry: home });
    else
      entry.unsupported.push({
        field: 'curation.home',
        reason:
          'The entry this reviewed output belongs to is outside this extraction; it is not applied.',
        value: output,
      });
  }
  entry.unsupported.push(
    ...listCurationFormulaIssues({
      record,
      isSpellEffect: entry.detail.kind === 'spellEffect',
    }),
  );
  entry.unsupported = entry.unsupported.filter(
    (issue) =>
      !(record.kind === 'itemAbility' && issue.field === 'itemAbility'),
  );
}

function addMissingCurationIssue({
  input,
  entry,
}: {
  input: CurationInput;
  entry: PreviewEntry;
}) {
  const conditional =
    input.kind === 'conditional'
      ? readObject(JSON.parse(input.text))
      : undefined;
  const value = conditional
    ? [
        {
          name: extractNoteText(readText({ value: conditional.name })),
          modifiers: readArray(conditional.modifiers).map((value) => {
            const modifier = readObject(value);
            return {
              formula: readText({ value: modifier.formula }),
              target: readText({ value: modifier.target }),
              subTarget: readText({ value: modifier.subTarget }),
              type: readText({ value: modifier.type }),
            };
          }),
        },
      ]
    : { target: input.target, text: extractNoteText(input.text) };
  entry.unsupported.push({
    field:
      input.kind === 'note'
        ? 'contextNotes'
        : input.kind === 'conditional'
          ? 'actions.conditionals'
          : 'itemAbility',
    reason: 'Missing curation record; contributes no structured output.',
    value,
  });
}

export function applyCuration({
  inputs,
  seeds,
  data,
  entries,
  outputHome,
}: CurationApplication) {
  const report = reportCuration({ inputs, seeds, data, entries });
  const byKey = new Map(entries.map((entry) => [entry.externalKey, entry]));
  for (const record of report.applied) {
    const entry = byKey.get(record.externalKey);
    if (!entry) continue;
    // A re-homed output follows its owning entry; when that entry is outside
    // this extraction, the output is not applied and is reported.
    const homeOf = (output: CurationOutput) => {
      const home = outputHome?.(record, output);
      return home === undefined ? entry : byKey.get(home);
    };
    applyCurationRecord({ record, entry, homeOf });
  }
  for (const record of new Set([
    ...report.applied,
    ...report.unresolvedMechanics,
    ...report.unresolvedDescriptions,
  ]))
    byKey.get(record.externalKey)?.unsupported.push(
      ...record.diagnostics.map((diagnostic) => ({
        field: 'curation.mechanics',
        reason: diagnostic.text,
      })),
    );
  for (const input of report.missing) {
    const entry = byKey.get(input.externalKey);
    if (entry) addMissingCurationIssue({ input, entry });
  }
  return report;
}

const targetPatterns: [
  RegExp,
  Extract<CurationOutput, { kind: 'modifier' }>['target'],
][] = [
  [/\bCMD\b/i, 'cmd'],
  [/\bCMB\b/i, 'cmb'],
  [/\bWill\b/i, 'save.will'],
  [/\bFortitude\b/i, 'save.fort'],
  [/\bReflex\b/i, 'save.ref'],
  [/\bsav(?:e|es|ing throws)\b/i, 'saves'],
  [/\bStealth\b/i, 'skill.ste'],
];
const conditionalBonusTypes: Record<string, string> = {
  enh: 'enhancement',
  nat: 'naturalArmor',
  def: 'deflection',
};
const conditionalTargets: Record<string, string> = {
  allAttack: 'attack',
  meleeAttack: 'attack.melee',
  rangedAttack: 'attack.ranged',
  allDamage: 'damage',
  meleeDamage: 'damage.melee',
  rangedDamage: 'damage.ranged',
};

/** Raw note targets that name a different runtime statistic. */
export const noteTargetAliases: Readonly<Record<string, string>> = {
  allSavingThrows: 'saves',
  skills: 'skills',
  meleeWeapon: 'attack.melee',
  rangedWeapon: 'attack.ranged',
  fort: 'save.fort',
  ref: 'save.ref',
  will: 'save.will',
  cl: 'casterLevel',
  conChecks: 'concentration',
  spellEffect: 'spellDC',
};
function findNoteTarget({ target, text }: { target: string; text: string }) {
  const mapped = noteTargetAliases[target] ?? target;
  const parsed = z.enum(modifierTargets).safeParse(mapped);
  if (parsed.success) return parsed.data;
  if (target) return undefined;
  return targetPatterns.find(([pattern]) => pattern.test(text))?.[1];
}
function findSituation({ text, data }: { text: string; data: CurationData }) {
  const reviewed = data.situations.find((situation) =>
    situation.aliases.some(
      (alias) => alias.toLowerCase() === text.toLowerCase(),
    ),
  );
  return reviewed ? reviewed.key : { local: text };
}

function splitSituations(text: string) {
  const match = /^(vs\.?|against)\s+(.+?)(\s+while\s+.+)?$/i.exec(text);
  return match
    ? (match[2] ?? '')
        .split(/\s*(?:,\s*(?:and\s+)?|\s+and\s+|\s+or\s+)\s*/)
        .filter(Boolean)
        .map((part) => `${match[1]} ${part}${match[3] ?? ''}`)
    : [text];
}

function draftConditional({
  conditional,
  source,
  data,
  isItemAbility = false,
}: {
  conditional: Record<string, unknown>;
  source: LoadedRecord;
  data: CurationData;
  isItemAbility?: boolean;
}): { outputs: CurationOutput[]; diagnostics: CurationDiagnostic[] } {
  const outputs: CurationOutput[] = [];
  const diagnostics: CurationDiagnostic[] = [];
  const name = readText({ value: conditional.name }) || source.record.name;
  const dice: NonNullable<CuratedItemAbility['damageDice']> = [];
  for (const value of readArray(conditional.modifiers)) {
    const modifier = readObject(value);
    const formulaText = readText({ value: modifier.formula });
    const type = readText({ value: modifier.type });
    const bonusType = z
      .enum(personalBonusTypes)
      .safeParse(conditionalBonusTypes[type] ?? type);
    const targetText = readText({ value: modifier.target });
    const subTarget = readText({ value: modifier.subTarget });
    const target = findNoteTarget({
      target: conditionalTargets[subTarget] ?? targetText,
      text: name,
    });
    if (
      isItemAbility &&
      targetText === 'damage' &&
      /^[1-9]\d*d[1-9]\d*(?:[+-]\d+)?$/.test(formulaText)
    ) {
      dice.push({
        on: modifier.critical === 'crit' ? 'crit' : 'hit',
        dice: formulaText,
        damageType:
          readText({ value: readArray(modifier.damageType)[0] }) || 'untyped',
      });
      continue;
    }
    const formula = mapFormula({
      input: formulaText,
      classTag: readText({ value: source.record.system.class }) || undefined,
    });
    if (target && bonusType.success && formula !== undefined)
      outputs.push({
        kind: 'modifier',
        target,
        bonusType: bonusType.data,
        value: typeof formula === 'number' ? formula : { formula },
        condition: {
          weapon: '$self',
          situation: findSituation({ text: name, data }),
        },
      });
    else {
      diagnostics.push({
        kind: 'unresolved',
        text: `Unresolved conditional mechanics: ${targetText}/${subTarget} ${formulaText} ${type}`,
      });
      outputs.push({
        kind: 'note',
        text: reviewPlaceholder,
      });
    }
  }
  if (dice.length) outputs.push({ kind: 'itemAbility', damageDice: dice });
  return { outputs, diagnostics };
}

function extractNoteText(html: string): string {
  const sanitized = sanitizeDescription({ html, link: () => undefined });
  function readNode(node: DefaultTreeAdapterMap['childNode']): string {
    if (node.nodeName === '#text' && 'value' in node) return node.value;
    if (!('tagName' in node)) return '';
    const text = node.childNodes.map(readNode).join('');
    return /^(?:p|br|hr|li|h[1-6]|tr|blockquote)$/.test(node.tagName)
      ? `${text}\n`
      : text;
  }
  return parseFragment(sanitized)
    .childNodes.map(readNode)
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function sanitizeNoteText(html: string): string {
  return extractNoteText(html)
    .replace(/\[\[(.*?)\]\]/gs, (_, expression: string) =>
      expression.replace(/^\/(?:r|roll|gmroll|blindroll)\s+/i, ''),
    )
    .replace(
      /@[A-Za-z][\w]*(?:\.[\w]+)+/g,
      (reference) => reference.split('.').at(-1)?.replaceAll('_', ' ') ?? '',
    );
}

const skillTargets = new Map(
  Object.entries(skillNames).map(([key, name]) => [
    name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(),
    `skill.${key}`,
  ]),
);
const statisticTargets: Record<string, string> = {
  cmd: 'cmd',
  cmb: 'cmb',
  'saving throws': 'saves',
  saves: 'saves',
  'will saves': 'save.will',
  'will saving throws': 'save.will',
  'fortitude saves': 'save.fort',
  'fortitude saving throws': 'save.fort',
  'reflex saves': 'save.ref',
  'reflex saving throws': 'save.ref',
};
function findStatisticTarget(text: string) {
  const name = text.toLowerCase().trim();
  const target =
    statisticTargets[name] ?? skillTargets.get(name.replace(/ checks?$/, ''));
  const parsed = z.enum(modifierTargets).safeParse(target);
  return parsed.success ? parsed.data : undefined;
}

function parseSkillBonus(sentence: string): CurationOutput | undefined {
  const match =
    /^(?:(?:This (?:armor|shield|weapon|item|ability) (?:grants|gives)|(?:The )?wearer (?:gains|receives)|You (?:gain|receive)) (?:a )?)?([+-]\d+) (\w+) bonus on ([\w ]+) checks?\.?$/i.exec(
      sentence,
    );
  if (!match) return undefined;
  const target = findStatisticTarget(match[3] ?? '');
  const bonusType = z
    .enum(personalBonusTypes)
    .safeParse(match[2]?.toLowerCase());
  return target && bonusType.success
    ? {
        kind: 'modifier',
        target,
        bonusType: bonusType.data,
        value: Number(match[1]),
      }
    : undefined;
}

function isThreatDoublingClause(sentence: string) {
  return (
    !/\b(?:not|when|while|only|unless|except|if)\b/i.test(sentence) &&
    /^(?:This ability|The ability|(?:An?|The) (?:[\w-]+ ){0,3}weapon) doubles? the threat range(?: of (?:a|the) weapon)?\.?$/i.test(
      sentence,
    )
  );
}

function isCoveredAbilityClause({
  sentence,
  outputs,
}: {
  sentence: string;
  outputs: CurationOutput[];
}) {
  if (parseSkillBonus(sentence)) return true;
  const damage =
    /^(?:An?|The) [\w -]+? weapon deals? (?:an? )?(?:extra|additional) (\d+d\d+) (?:points? of )?(\w+) damage on (?:a )?(?:successful )?(hit|critical hit)\.?$/i.exec(
      sentence,
    );
  const dice = outputs.flatMap((output) =>
    output.kind === 'itemAbility' ? (output.damageDice ?? []) : [],
  );
  if (
    damage &&
    dice.some(
      (die) =>
        die.dice === damage[1] &&
        die.damageType.toLowerCase() === damage[2]?.toLowerCase() &&
        die.on ===
          (damage[3]?.toLowerCase() === 'critical hit' ? 'crit' : 'hit'),
    )
  )
    return true;
  const abilities = outputs.filter((output) => output.kind === 'itemAbility');
  if (
    abilities.some((ability) => ability.doublesThreat) &&
    isThreatDoublingClause(sentence)
  )
    return true;
  return (
    abilities.some(
      (ability) =>
        ability.weaponDamageTypes?.includes('piercing') &&
        ability.weaponDamageTypes.includes('slashing'),
    ) &&
    /^Only piercing or slashing (?:melee )?weapons (?:can be [\w -]+|may (?:have|receive) this ability)\.?$/i.test(
      sentence,
    )
  );
}

function draftAbilityProse({
  input,
  source,
  outputs,
}: {
  input: CurationInput;
  source: LoadedRecord;
  outputs: CurationOutput[];
}): DraftResult {
  const text = extractNoteText(input.text);
  const price =
    /(?:^|;\s*)Price\s+\+(?:([1-5])\s+bonus|([\d,]+)\s+gp)(?=$|[.;])/im.exec(
      text,
    );
  if (price)
    outputs.push({
      kind: 'itemAbility',
      bonusEquivalent: price[1] ? Number(price[1]) : 0,
    });
  const withoutPrice = (price ? text.replace(price[0], '') : text).replace(
    /^Slot (?:weapon|armor|shield) quality;? *$/gim,
    '',
  );
  const clauses = withoutPrice
    .split(/\n|(?<=[.;]) +/)
    .map((sentence) => sentence.trim().replace(/;$/, ''))
    .filter((sentence) => /[\w\d]/.test(sentence));
  if (clauses.some(isThreatDoublingClause))
    outputs.push({
      kind: 'itemAbility',
      doublesThreat: true,
      ...(/piercing or slashing/i.test(input.text)
        ? { weaponDamageTypes: ['piercing', 'slashing'] }
        : {}),
    });
  const policy = reviewedItemAbilityPolicies.find(
    (policy) => policy.name === source.record.name.toLowerCase(),
  );
  if (policy?.kind === 'sharedSource')
    outputs.push({ kind: 'itemAbility', sourceKey: policy.sourceKey });
  for (const sentence of clauses) {
    const modifier = parseSkillBonus(sentence);
    if (modifier) outputs.push(modifier);
  }
  const residual = clauses
    .filter((sentence) => !isCoveredAbilityClause({ sentence, outputs }))
    .join('\n');
  const diagnostics: CurationDiagnostic[] =
    /[+-]\d+\s+\w+\s+bonus|\[\[|\b\d+d\d+\b/i.test(residual)
      ? [
          {
            kind: 'unresolved',
            text: 'Unresolved Item Ability numeric mechanics; metadata does not cover its effects.',
          },
        ]
      : [];
  if (/\bthreat\s+range\b/i.test(residual))
    diagnostics.push({
      kind: 'review',
      text: 'Unparsed or qualified threat-range mechanics require review before supplying outputs.',
    });
  if (residual) outputs.push({ kind: 'note', text: residual });
  return { outputs, diagnostics };
}

type DraftResult = {
  outputs: CurationOutput[];
  diagnostics: CurationDiagnostic[];
};

function draftDescription({
  input,
  data,
}: {
  input: CurationInput;
  data: CurationData;
}): DraftResult {
  const outputs: CurationOutput[] = [];
  const diagnostics: CurationDiagnostic[] = [];
  const sentences = extractNoteText(input.text).split(/\n|(?<=[.;]) +/);
  for (const sentence of sentences) {
    const suffix =
      /^(?:You (?:gain|receive|have) (?:a )?)?([+-]\d+) (\w+) bonus (?:to|on) (.+?) ((?:vs\.?|against|when) .+?)\.?$/i.exec(
        sentence,
      );
    const prefix =
      /^(?:When defending )?((?:vs\.?|against) .+?), (?:you )?(?:gain|receive) (?:a )?([+-]\d+) (\w+) bonus (?:to|on) (.+?)\.?$/i.exec(
        sentence,
      );
    const value = suffix?.[1] ?? prefix?.[2];
    const type = suffix?.[2] ?? prefix?.[3];
    const statistic = suffix?.[3] ?? prefix?.[4];
    const circumstance = suffix?.[4] ?? prefix?.[1];
    const target = findStatisticTarget(statistic ?? '');
    const bonusType = z.enum(personalBonusTypes).safeParse(type?.toLowerCase());
    if (
      !value ||
      !target ||
      !bonusType.success ||
      !circumstance ||
      /\b(?:but|except|unless|not|only)\b/i.test(circumstance) ||
      /[+−-]\d|\[\[|\bbonus\b/i.test(`${statistic} ${circumstance}`)
    ) {
      diagnostics.push({
        kind: 'review',
        text: 'Description is unparsed or only partly parsed; check the imported text before supplying outputs.',
      });
      continue;
    }
    for (const situation of splitSituations(circumstance))
      outputs.push({
        kind: 'modifier',
        target,
        bonusType: bonusType.data,
        value: Number(value),
        condition: { situation: findSituation({ text: situation, data }) },
      });
  }
  return { outputs, diagnostics };
}

type DraftContext = {
  input: CurationInput;
  source: LoadedRecord;
  data: CurationData;
};

function draftNote({ input, source, data }: DraftContext): DraftResult {
  const target = findNoteTarget({ target: input.target, text: input.text });
  const outputs: CurationOutput[] = [];
  const diagnostics: CurationDiagnostic[] = [];
  if (target) {
    const clauses = input.text.split(/\s*(?:;|\s+and\s+(?=[+-]?\[\[))\s*/);
    for (const clause of clauses) {
      const numeric = /^\s*([+-]?)\[\[(.*?)\]\]\s*(.*)$/s.exec(clause);
      const plain = /^\s*([+-]?\d+)\s+(\w+)\s+(?:bonus\s+)?(.*)$/s.exec(clause);
      if (!numeric && !plain) {
        const circumstance = /\b(?:vs\.?|against|immune to)\s+(.+)$/i.exec(
          clause,
        );
        outputs.push({
          kind: 'note',
          target,
          text: clause || source.record.name,
          ...(circumstance?.[1]
            ? { situation: findSituation({ text: circumstance[1], data }) }
            : {}),
        });
        if (/\[\[|\bbonus\b/i.test(clause))
          diagnostics.push({
            kind: 'unresolved',
            text: 'Unresolved numeric mechanics require operator drafting; only readable text is supplied.',
          });
        continue;
      }
      const tail = numeric?.[3] ?? `${plain?.[2] ?? ''} ${plain?.[3] ?? ''}`;
      const firstWord = /^(\w+)\b\s*(.*)$/s.exec(tail);
      const parsedType = z
        .enum(personalBonusTypes)
        .safeParse(firstWord?.[1]?.toLowerCase());
      const bonusType = parsedType.success ? parsedType.data : 'untyped';
      const circumstanceText = parsedType.success
        ? (firstWord?.[2]?.trim() ?? '')
        : tail.trim();
      const circumstance =
        /\b((?:vs\.?|against|when)\s+.+)$/i.exec(circumstanceText)?.[1] ??
        circumstanceText;
      const rawFormula = numeric
        ? `${numeric[1] === '-' ? '-' : ''}${numeric[2] ?? ''}`
        : (plain?.[1] ?? '');
      const formula = mapFormula({
        input: rawFormula,
        classTag: readText({ value: source.record.system.class }) || undefined,
        allowCasterLevel:
          target === 'casterLevel' ||
          (source.record.type === 'buff' &&
            source.record.system.subType === 'spell'),
      });
      if (/\[\[|\+\d+\s+\w+\s+bonus/.test(circumstance)) {
        diagnostics.push({
          kind: 'unresolved',
          text: 'Unresolved compound numeric clause; operator must split its mechanics.',
        });
        outputs.push({ kind: 'note', target, text: clause });
        continue;
      }
      for (const situation of splitSituations(circumstance))
        outputs.push({
          kind: 'modifier',
          target,
          bonusType,
          value:
            formula === undefined
              ? { formula: rawFormula }
              : typeof formula === 'number'
                ? formula
                : { formula },
          ...(situation
            ? {
                condition: {
                  situation: findSituation({ text: situation, data }),
                },
              }
            : {}),
        });
      if (formula === undefined) {
        outputs.push({ kind: 'note', target, text: sanitizeNoteText(clause) });
        diagnostics.push({
          kind: 'review',
          text: 'Unsupported note formula requires review; its readable text does not supply a numeric effect.',
        });
      }
    }
  }
  if (!outputs.length) {
    const circumstance = /\b(?:vs\.?|against|immune to)\s+(.+)$/i.exec(
      input.text,
    );
    outputs.push({
      kind: 'note',
      ...(target ? { target } : {}),
      ...(circumstance?.[1]
        ? { situation: findSituation({ text: circumstance[1], data }) }
        : {}),
      text: input.text || source.record.name,
    });
    if (/\[\[|\bbonus\b/i.test(input.text))
      diagnostics.push({
        kind: 'unresolved',
        text: 'Unresolved numeric mechanics require operator drafting; only readable text is supplied.',
      });
  }
  return { outputs, diagnostics };
}

function draftItemAbility({
  input,
  source,
  data,
  seeds,
}: DraftContext & { seeds: CurationInput[] }): DraftResult {
  const outputs: CurationOutput[] = [];
  const diagnostics: CurationDiagnostic[] = [];

  for (const seed of seeds) {
    const conditional = readObject(JSON.parse(seed.text));
    if (
      reviewedItemAbilityPolicies.some(
        (policy) =>
          policy.kind === 'targetDependent' &&
          policy.name === source.record.name.toLowerCase(),
      )
    ) {
      diagnostics.push({
        kind: 'unresolved',
        text: 'Unresolved target-dependent helper seed; operator must supply its Situation and any required choice.',
      });
      outputs.push({
        kind: 'note',
        text: reviewPlaceholder,
      });
      continue;
    }
    const drafted = draftConditional({
      conditional,
      source,
      data,
      isItemAbility: true,
    });
    outputs.push(...drafted.outputs);
    diagnostics.push(...drafted.diagnostics);
  }
  const drafted = draftAbilityProse({ input, source, outputs });
  diagnostics.push(...drafted.diagnostics);
  return { outputs, diagnostics };
}

function draftInput(
  context: DraftContext & { seeds: CurationInput[] },
): DraftResult {
  if (context.input.kind === 'note') return draftNote(context);
  if (context.input.kind === 'itemAbility') return draftItemAbility(context);
  if (context.input.kind === 'description') return draftDescription(context);
  return draftConditional({
    conditional: readObject(JSON.parse(context.input.text)),
    source: context.source,
    data: context.data,
  });
}

export function draftCurationRecord({
  input,
  source,
  data,
  seeds = [],
}: DraftContext & { seeds?: CurationInput[] }): CurationRecord {
  const seedBindings =
    input.kind === 'itemAbility'
      ? seeds.filter(
          (seed) =>
            readText({
              value: readObject(JSON.parse(seed.text)).name,
            }).toLowerCase() === source.record.name.toLowerCase(),
        )
      : [];
  const { outputs, diagnostics } = draftInput({
    input,
    source,
    data,
    seeds: seedBindings,
  });
  if (/stacks with/i.test(input.text))
    diagnostics.push({
      kind: 'review',
      text: 'Review same-entry stacking before setting stacksWithinEntry.',
    });
  const policy =
    input.kind === 'itemAbility'
      ? reviewedItemAbilityPolicies.find(
          (policy) => policy.name === source.record.name.toLowerCase(),
        )
      : undefined;
  const citation = policy
    ? ` Policy: ${policy.rationale} Rules: ${policy.rulesSource.repository} ${policy.rulesSource.version} ${policy.rulesSource.path} (${policy.rulesSource.sources.map((source) => `${source.id} p. ${source.pages}`).join('; ')}).`
    : '';
  return recordSchema.parse({
    ...input,
    status: 'drafted',
    outputs: diagnostics.some((diagnostic) => diagnostic.kind === 'unresolved')
      ? outputs.map((output) =>
          output.kind === 'note'
            ? { ...output, text: reviewPlaceholder }
            : output,
        )
      : outputs,
    diagnostics,
    seedBindings,
    rationale: `Parser draft; check against the imported description before marking checked.${citation}`,
  });
}

export function listCurationFormulaIssues({
  record,
  isSpellEffect = false,
}: {
  record: CurationRecord;
  isSpellEffect?: boolean;
}): Unsupported[] {
  return record.outputs.flatMap((output) => {
    if (output.kind !== 'modifier' || typeof output.value === 'number')
      return [];
    const formula = mapFormula({
      input: output.value.formula,
      allowCasterLevel: output.target === 'casterLevel' || isSpellEffect,
      allowItemEnhancement: record.kind === 'itemAbility',
    });
    const stage = targetStage(output.target);
    return formula === undefined ||
      (stage <= 2 && output.value.formula.includes('@ability.')) ||
      (stage <= 3 && /@(?:bab|hitDice)\b/.test(output.value.formula)) ||
      (stage <= 4 && output.value.formula.includes('@casterLevel.')) ||
      (!isSpellEffect &&
        stage < 4 &&
        /@casterLevel\b/.test(output.value.formula))
      ? [
          {
            field: 'curation.formula',
            reason:
              'Unsupported formula or calculation-stage dependency; contributes nothing.',
            value: output.value.formula,
          },
        ]
      : [];
  });
}
