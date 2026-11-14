import { readFile } from 'node:fs/promises';
import { z } from 'zod';

/**
 * The party's recorded exceptions (`party-exceptions.json`): what the party
 * enters as one-off entries until the catalog has it, each with who decided
 * and when. A `key` exception names a scope row, an `unmatched` one a name
 * the builds leave unmatched, and a `form` one a kind of entry the catalog
 * has no form for, which the builds never name. Qualification
 * (`party-qualification.ts`) passes the rows and names they cover and fails
 * on a stale one.
 */
export const partyExceptionsPath =
  'scripts/catalog/party/party-exceptions.json';

const text = z.string().trim().min(1);
const subject = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('key'),
    key: z.string().regex(/^[a-z0-9-]+\/[A-Za-z0-9_./-]+$/),
  }),
  z.strictObject({ kind: z.literal('unmatched'), name: text }),
  z.strictObject({ kind: z.literal('form'), name: text }),
]);
const exception = z.strictObject({
  subject,
  reason: text,
  decidedBy: text,
  decidedOn: z.iso.date(),
});
export type PartyException = z.infer<typeof exception>;
export type PartyExceptionSubject = PartyException['subject'];

/** What an exception covers, as one string: its kind, then its key or name. */
export const exceptionSubject = (subject: PartyExceptionSubject) =>
  `${subject.kind} ${subject.kind === 'key' ? subject.key : subject.name}`;

const partyExceptionsSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    scopeVersion: z.literal('campaign-party-v1'),
    note: text,
    exceptions: z.array(exception),
  })
  .superRefine(({ exceptions }, context) => {
    const subjects = exceptions.map(({ subject }) => exceptionSubject(subject));
    subjects.forEach((current, index) => {
      const prior = subjects[index - 1];
      if (prior !== undefined && prior >= current)
        context.addIssue({
          code: 'custom',
          path: ['exceptions', index],
          message:
            prior === current
              ? `Exception ${current} appears twice.`
              : `Exception ${current} is out of order: exceptions sort by kind, then key or name.`,
        });
    });
  });

export function parsePartyExceptions(value: unknown) {
  return partyExceptionsSchema.parse(value).exceptions;
}

export async function readPartyExceptions(path = partyExceptionsPath) {
  return parsePartyExceptions(JSON.parse(await readFile(path, 'utf8')));
}
