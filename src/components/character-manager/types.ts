import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { characterKindSchema } from '~/lib/character-kind';
import { characterLedgerDetails } from '~/lib/character-ledger';

const integerField = (label: string) =>
  z.string().superRefine((raw, ctx) => {
    const value = raw.trim();
    if (!value) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} is required`,
      });
      return;
    }
    if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be a whole number`,
      });
    }
  });

const scoreField = (label: string) =>
  z.string().superRefine((raw, ctx) => {
    const value = raw.trim();
    if (!value)
      ctx.addIssue({ code: 'custom', message: `${label} is required` });
    else if (!Number.isFinite(Number(value)))
      ctx.addIssue({ code: 'custom', message: `${label} must be a number` });
    else if (!Number.isSafeInteger(Number(value)))
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be a whole number`,
      });
  });

export const characterFormSchema = z.object({
  name: z.string().trim().min(1, 'Character name is required').max(100),
  description: z.string().max(500),
  // A record is a PC or an NPC; a legacy stored kind opens as its PC/NPC form.
  kind: characterKindSchema,
  // The record's number, labelled Hit Dice for PCs and NPCs alike.
  level: integerField('Hit Dice').refine((value) => Number(value) >= 1, {
    message: 'Hit Dice must be at least 1',
  }),
  strength: integerField('STR'),
  dexterity: integerField('DEX'),
  constitution: integerField('CON'),
  intelligence: integerField('INT'),
  wisdom: integerField('WIS'),
  charisma: integerField('CHA'),
});

export type CharacterFormValues = z.infer<typeof characterFormSchema>;

export function characterRecordFormSchema(record?: CharacterRecord) {
  if (record && characterLedgerDetails(record).statisticsReadOnly)
    return characterFormSchema.extend({
      level: z.string(),
      strength: z.string(),
      dexterity: z.string(),
      constitution: z.string(),
      intelligence: z.string(),
      wisdom: z.string(),
      charisma: z.string(),
    });
  return record?.sheetMode
    ? characterFormSchema.extend({
        level: integerField('Level').refine((value) => Number(value) >= 0, {
          message: 'Level must be at least 0',
        }),
        strength: scoreField('STR'),
        dexterity: scoreField('DEX'),
        constitution: scoreField('CON'),
        intelligence: scoreField('INT'),
        wisdom: scoreField('WIS'),
        charisma: scoreField('CHA'),
      })
    : characterFormSchema;
}

export const defaultCharacterFormValues: CharacterFormValues = {
  name: '',
  description: '',
  kind: 'pc',
  level: '1',
  strength: '10',
  dexterity: '10',
  constitution: '10',
  intelligence: '10',
  wisdom: '10',
  charisma: '10',
};

// The record fields a valid form submits.
export function toCharacterPayload(values: CharacterFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    kind: values.kind,
    level: Number(values.level),
    strength: Number(values.strength),
    dexterity: Number(values.dexterity),
    constitution: Number(values.constitution),
    wisdom: Number(values.wisdom),
    charisma: Number(values.charisma),
    intelligence: Number(values.intelligence),
  };
}

// A record's current values.
export function toCharacterFormValues(
  record: CharacterRecord,
): CharacterFormValues {
  return {
    name: record.name,
    description: record.description,
    kind: record.kind,
    level: String(record.level),
    strength: String(record.strength),
    dexterity: String(record.dexterity),
    constitution: String(record.constitution),
    intelligence: String(record.intelligence),
    wisdom: String(record.wisdom),
    charisma: String(record.charisma),
  };
}

export function getCharacterErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ConvexError && typeof error.data === 'string')
    return error.data;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export type CharacterRecord = FunctionReturnType<
  typeof api.character.listByCampaign
>[number];

export type MilitiaOnlyClassLevel = NonNullable<
  CharacterRecord['classLevels']
>[number];
