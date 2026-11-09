'use client';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { ChoiceCards } from './choice-cards';
import { WholeNumberField } from './whole-number-field';
import { activityLabel } from './activity-labels';
import { RecordedRollTotal } from './recorded-roll';
import {
  rollNotation,
  rollPathSegments,
  type RollSpecResolver,
} from './roll-facts';
import { RollTotalField } from './roll-total-field';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { RollSpec } from '~/lib/raw-roll';
type Options = Record<string, { value: string; label: string }[]>;
export function choiceFieldLabel(field: string) {
  if (/^\d+$/.test(field)) return `Entry ${Number(field) + 1}`;
  return activityLabel(field.replace(/([a-z])([A-Z])/g, '$1_$2'))
    .replace(/ Ids?$/, '')
    .replace(/Copper$/, '(copper)');
}
function unwrap(schema: z.ZodType): z.ZodType {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  )
    // Safe cast: wrappers of a Zod schema wrap a Zod schema.
    return unwrap(schema.unwrap() as z.ZodType);
  return schema;
}
// Nested editors recognise the shared raw-roll schema by its shape, so a roll
// is edited as one dice total rather than as a generic object.
function findRollSchema(schema: z.ZodType) {
  return schema instanceof z.ZodObject &&
    'diceTotal' in schema.shape &&
    'diceCount' in schema.shape &&
    'sides' in schema.shape &&
    'provenance' in schema.shape
    ? schema
    : null;
}
function initial(schema: z.ZodType, field = ''): unknown {
  if (schema instanceof z.ZodOptional) return undefined;
  const base = unwrap(schema);
  if (base instanceof z.ZodLiteral) return base.value;
  // A roll starts absent: its total is typed directly into the roll field.
  if (findRollSchema(base)) return undefined;
  if (base instanceof z.ZodDiscriminatedUnion)
    // Safe cast: a discriminated union's options are Zod object schemas.
    return initial(base.options[0] as z.ZodType, field);
  if (base instanceof z.ZodArray) return [];
  if (
    base instanceof z.ZodObject &&
    'sourceId' in base.shape &&
    'value' in base.shape &&
    'reason' in base.shape
  )
    return { sourceId: `custom:${crypto.randomUUID()}`, value: 0 };
  if (base instanceof z.ZodObject)
    return Object.fromEntries(
      Object.entries(base.shape)
        // Safe cast: a Zod object's shape holds Zod schemas.
        .map(([key, child]) => [key, initial(child as z.ZodType, key)])
        .filter(([, value]) => value !== undefined),
    );
  if (base instanceof z.ZodRecord) return {};
  if (
    base instanceof z.ZodString &&
    ['eventId', 'itemId', 'acknowledgementId', 'choiceId'].includes(field)
  )
    return crypto.randomUUID();
  return undefined;
}
function scalarText(value: unknown) {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '';
}
function record(value: unknown): Record<string, unknown> {
  // Safe cast: the cast branch only sees a non-null, non-array object.
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
// Local malformed text in a nested total field never reaches the form value,
// so the enclosing Save must know about it. Entries belong to the mounted
// field instance (not to a path string): a field reports while it exists,
// moves when its path shifts, and disappears when it unmounts through entry
// removal, a branch switch or a container clear. The Save then blocks with a
// styled error at each still-mounted invalid field and nowhere else.
type InvalidInputRegistry = {
  report(id: string, path: string, message: string | null): void;
  release(id: string): void;
};
const InvalidInputContext = createContext<InvalidInputRegistry>({
  report: () => undefined,
  release: () => undefined,
});
function useInvalidInput(path: string) {
  const registry = useContext(InvalidInputContext);
  const id = useId();
  const message = useRef<string | null>(null);
  useEffect(() => {
    if (message.current !== null) registry.report(id, path, message.current);
    return () => registry.release(id);
  }, [id, path, registry]);
  return (next: string | null) => {
    message.current = next;
    registry.report(id, path, next);
  };
}
type FieldProps = {
  schema: z.ZodType;
  value: unknown;
  change: (value: unknown) => void;
  name: string;
  options: Options;
  path?: string;
  issues: z.core.$ZodIssue[];
  disabled: boolean;
  modifierContext?: boolean;
  rollSpec?: RollSpecResolver;
  // The whole value under edit, for context-dependent roll specifications.
  rootValue?: unknown;
};
function nestedField(props: FieldProps) {
  return (
    schema: z.ZodType,
    value: unknown,
    name: string,
    change: (value: unknown) => void,
    key: string = name,
  ) => {
    const parentOptions = props.options[props.name];
    return (
      <Fields
        key={key}
        rollSpec={props.rollSpec}
        rootValue={props.rootValue}
        modifierContext={props.modifierContext}
        schema={schema}
        value={value}
        name={name}
        change={change}
        options={
          /^\d+$/.test(name) && parentOptions
            ? { ...props.options, [name]: parentOptions }
            : props.options
        }
        path={props.path ? `${props.path}.${name}` : name}
        issues={props.issues}
        disabled={props.disabled}
      />
    );
  };
}
// Structured schemas get an explicit "Add" control while optional and absent;
// scalars render their input directly. The raw-roll schema counts as structured.
type StructuredBase =
  | { kind: 'roll'; roll: z.ZodObject }
  | { kind: 'union'; base: z.ZodDiscriminatedUnion }
  | { kind: 'object'; base: z.ZodObject | z.ZodRecord }
  | { kind: 'array'; base: z.ZodArray };
function classifyStructured(base: z.ZodType): StructuredBase | null {
  const roll = findRollSchema(base);
  if (roll) return { kind: 'roll', roll };
  if (base instanceof z.ZodDiscriminatedUnion) return { kind: 'union', base };
  if (base instanceof z.ZodObject || base instanceof z.ZodRecord)
    return { kind: 'object', base };
  if (base instanceof z.ZodArray) return { kind: 'array', base };
  return null;
}
function ProvenanceNote({ value }: { value: unknown }) {
  if (record(value).kind !== 'generated') return null;
  return <p className="text-muted-foreground text-xs">Recorded roll.</p>;
}
function AddStructured(props: FieldProps & { base: z.ZodType }) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={props.disabled}
      onClick={() => props.change(initial(props.base, props.name))}
    >
      Add {choiceFieldLabel(props.name).toLowerCase()}
    </Button>
  );
}
function StructuredFields(props: FieldProps & { structured: StructuredBase }) {
  const { structured } = props;
  switch (structured.kind) {
    case 'roll':
      return <RollFields {...props} roll={structured.roll} />;
    case 'union':
      return <UnionFields {...props} base={structured.base} />;
    case 'object':
      return <ObjectFields {...props} base={structured.base} />;
    case 'array':
      return <ArrayFields {...props} base={structured.base} />;
  }
}
function Fields(props: FieldProps) {
  if (props.name === 'provenance')
    return <ProvenanceNote value={props.value} />;
  const base = unwrap(props.schema);
  if (base instanceof z.ZodLiteral) return null;
  const structured = classifyStructured(base);
  if (!structured) return <ScalarField {...props} base={base} />;
  if (
    props.schema instanceof z.ZodOptional &&
    props.value === undefined &&
    structured.kind !== 'roll'
  )
    return <AddStructured {...props} base={base} />;
  return <StructuredFields {...props} structured={structured} />;
}
// The editable total subtree owns its malformed-text registration: it
// registers only while a rule specification exists for this path and is keyed
// by that specification, so losing the specification (or changing count/sides)
// unmounts it, discards only its own inapplicable local text and releases its
// block. Other still-editable malformed fields keep blocking the Save.
function EditableRollTotal({
  path,
  ...field
}: {
  path: string;
  label: string;
  spec: RollSpec;
  recorded: RawRoll | null;
  disabled: boolean;
  onRoll: (roll: RawRoll | null) => void;
}) {
  const reportInvalid = useInvalidInput(path);
  return <RollTotalField {...field} onInvalid={reportInvalid} />;
}
// Every supported nested roll is one dice-only total against the rule
// specification resolved from its path. Recorded data reads through the
// shared editor; modifiers stay editable beside it; a blank total
// omits the optional key. Without an authoritative specification (for example
// an occurrence whose type is not resolved yet) the recorded roll is shown
// read-only with its metadata and can only be removed, never guessed.
function isRawRollValue(value: Record<string, unknown>): value is RawRoll {
  return typeof value.sides === 'number' && typeof value.diceTotal === 'number';
}
function RollFields(props: FieldProps & { roll: z.ZodObject }) {
  const { value, change, name, path = '', issues, disabled, roll } = props;
  const object = record(value);
  const recorded = isRawRollValue(object) ? object : null;
  const spec =
    props.rollSpec?.(rollPathSegments(path), props.rootValue) ?? null;
  if (!spec && !recorded) return null;
  const title = choiceFieldLabel(name);
  const label = /roll$/i.test(title) ? title : `${title} roll`;
  const error = issues.find((issue) => issue.path.join('.') === path)?.message;
  const nested = nestedField(props);
  const modifiers =
    recorded &&
    nested(
      // Safe cast: a roll schema's modifiers field is a Zod schema.
      roll.shape.modifiers as z.ZodType,
      recorded.modifiers,
      'modifiers',
      (next) => change({ ...recorded, modifiers: next ?? [] }),
    );
  return (
    <fieldset className="min-w-0 space-y-3 rounded-md border p-3">
      <legend className="text-sm font-semibold">{title}</legend>
      {spec ? (
        <EditableRollTotal
          key={rollNotation(spec)}
          path={path}
          label={label}
          spec={spec}
          recorded={recorded}
          disabled={disabled}
          onRoll={(next) => change(next ?? undefined)}
        />
      ) : (
        <>
          {recorded ? (
            <RecordedRollTotal label={label} recorded={recorded} />
          ) : null}
          <p role="note" className="text-muted-foreground text-xs">
            This roll has no rule specification in the current context, so its
            number cannot be edited here. Resolve the event first or remove the
            recorded roll.
          </p>
        </>
      )}
      {modifiers}
      {!spec && props.schema.isOptional() && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => change(undefined)}
        >
          Remove {title.toLowerCase()}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
function UnionFields(props: FieldProps & { base: z.ZodDiscriminatedUnion }) {
  const {
    value,
    change,
    name,
    options,
    path = '',
    issues,
    disabled,
    base,
  } = props;
  const title = choiceFieldLabel(name);
  const discriminator = String(base.def.discriminator);
  const selected = record(value)[discriminator];
  const variants = base.options.filter(
    (option): option is z.ZodObject => option instanceof z.ZodObject,
  );
  const selectedSchema = variants.find(
    (option) =>
      option.shape[discriminator] instanceof z.ZodLiteral &&
      option.shape[discriminator].value === selected,
  );
  return (
    <div className="space-y-3 rounded-md border p-3">
      <ChoiceCards
        label={title}
        value={typeof selected === 'string' ? selected : ''}
        choices={variants.map((option) => {
          const value = String(
            // Safe cast: a discriminated union's discriminator is a string
            // literal on every option.
            (option.shape[discriminator] as z.ZodLiteral<string>).value,
          );
          return { value, label: activityLabel(value) };
        })}
        disabled={disabled}
        onChange={(selected) => {
          // Safe cast: ChoiceCards only offers the values mapped from these
          // variants' discriminator literals, so one variant matches.
          const option = variants.find(
            (option) =>
              // Safe cast: a discriminated union's discriminator is a string
              // literal on every option.
              (option.shape[discriminator] as z.ZodLiteral<string>).value ===
              selected,
          )!;
          change(initial(option, name));
        }}
      />
      {selectedSchema && (
        <Fields
          rollSpec={props.rollSpec}
          rootValue={props.rootValue}
          modifierContext={props.modifierContext}
          schema={selectedSchema}
          value={value}
          change={change}
          name={name}
          options={options}
          path={path}
          issues={issues}
          disabled={disabled}
        />
      )}
    </div>
  );
}
function optionsForSource(
  options: Options,
  name: string,
  modifier: boolean,
  current: unknown,
) {
  if (name === 'origin') return options.automaticSources ?? [];
  if (!modifier) return null;
  const known = options.modifierSources ?? [];
  const custom =
    typeof current === 'string' && !known.some((item) => item.value === current)
      ? current
      : `custom:${crypto.randomUUID()}`;
  return [...known, { value: custom, label: 'Custom table modifier' }];
}
function ObjectFields(props: FieldProps & { base: z.ZodObject | z.ZodRecord }) {
  const { value, change, name, path = '', issues, base } = props;
  const title = choiceFieldLabel(name);
  const error = issues.find((issue) => issue.path.join('.') === path)?.message;
  const object = record(value);
  const modifier = props.modifierContext === true || path.includes('modifiers');
  const knownSources = optionsForSource(
    props.options,
    name,
    Boolean(modifier),
    object.sourceId,
  );
  const nested = nestedField({
    ...props,
    options: knownSources
      ? { ...props.options, sourceId: knownSources }
      : props.options,
  });
  // Safe cast: a Zod object's shape holds Zod schemas.
  const fields: [string, z.ZodType][] =
    base instanceof z.ZodObject
      ? (Object.entries(base.shape) as [string, z.ZodType][])
      : base.keyType instanceof z.ZodEnum
        ? base.keyType.options.map((key) => [
            String(key),
            // Safe cast: a Zod record's value type is a Zod schema.
            (base.valueType as z.ZodType).optional(),
          ])
        : [];
  return (
    <fieldset className="min-w-0 space-y-3 rounded-md border p-3">
      <legend className="text-sm font-semibold">{title}</legend>
      {fields.map(([key, child]) => {
        if (
          [
            'eventId',
            'itemId',
            'acknowledgementId',
            'choiceId',
            'subjectId',
          ].includes(key) &&
          (key === 'subjectId' || key === 'choiceId' || !('kind' in object))
        )
          return null;
        return nested(child, object[key], key, (next) =>
          change(
            Object.fromEntries(
              Object.entries({
                ...object,
                [key]: next,
              }).filter(([, value]) => value !== undefined),
            ),
          ),
        );
      })}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
function ArrayFields(props: FieldProps & { base: z.ZodArray }) {
  const { value, change, name, path = '', issues, disabled, base } = props;
  const title = choiceFieldLabel(name);
  const error = issues.find((issue) => issue.path.join('.') === path)?.message;
  const nested = nestedField({
    ...props,
    modifierContext: props.modifierContext === true || name === 'modifiers',
  });
  const values: unknown[] = Array.isArray(value) ? value : [];
  // Entries without a domain identity keep a stable local key across edits,
  // so removing one entry unmounts exactly that entry's fields (and any
  // malformed text they hold) instead of shifting state onto the next row.
  const keys = useRef<string[]>([]);
  while (keys.current.length < values.length)
    keys.current.push(crypto.randomUUID());
  keys.current.length = values.length;
  const entryKey = (entry: unknown, index: number) =>
    scalarText(record(entry).eventId ?? record(entry).itemId) ||
    // Safe cast: keys.current was just sized to values.length, and index
    // comes from values.map.
    keys.current[index]!;
  return (
    <fieldset className="min-w-0 space-y-3 rounded-md border p-3">
      <legend className="text-sm font-semibold">{title}</legend>
      {values.map((entry, index) => (
        <div key={entryKey(entry, index)} className="space-y-2">
          {nested(
            // Safe cast: a Zod array's element is a Zod schema.
            base.element as z.ZodType,
            entry,
            String(index),
            (next) =>
              change(
                values.map((item, itemIndex) =>
                  itemIndex === index ? next : item,
                ),
              ),
            entryKey(entry, index),
          )}
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              keys.current.splice(index, 1);
              change(values.filter((_, itemIndex) => itemIndex !== index));
            }}
          >
            Remove {title.toLowerCase()} {index + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() =>
          // Safe cast: a Zod array's element is a Zod schema.
          change([...values, initial(base.element as z.ZodType, name)])
        }
      >
        Add {title.toLowerCase()} entry
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
function ScalarField(props: FieldProps & { base: z.ZodType }) {
  const {
    value,
    change,
    name,
    options,
    path = '',
    issues,
    disabled,
    base,
  } = props;
  const title = choiceFieldLabel(name);
  const { schema } = props;
  const id = useId();
  const [formatError, setFormatError] = useState('');
  const error =
    formatError ||
    issues.find((issue) => issue.path.join('.') === path)?.message;
  const choices =
    options[name] ??
    (base instanceof z.ZodEnum
      ? base.options.map((value) => ({
          value: String(value),
          label: activityLabel(String(value)),
        }))
      : base instanceof z.ZodBoolean
        ? [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]
        : null);
  if (choices)
    return (
      <div>
        <ChoiceCards
          label={title}
          value={scalarText(value)}
          choices={[{ value: '', label: 'Not selected' }, ...choices]}
          disabled={disabled}
          onChange={(selected) =>
            change(
              selected === ''
                ? undefined
                : base instanceof z.ZodBoolean
                  ? selected === 'true'
                  : selected,
            )
          }
        />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    );
  if (base instanceof z.ZodNumber && base.isInt && (base.minValue ?? 0) >= 0)
    return (
      <div>
        <WholeNumberField
          label={title}
          value={typeof value === 'number' ? value : null}
          disabled={disabled}
          required={!schema.isOptional()}
          onValue={(number) => change(number ?? undefined)}
        />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {title}
      </label>
      <Input
        id={id}
        value={scalarText(value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const text = event.target.value;
          if (base instanceof z.ZodNumber) {
            if (
              text !== '' &&
              (!/^-?[0-9]*(?:\.[0-9]*)?$/.test(text) ||
                (text !== '-' &&
                  !text.endsWith('.') &&
                  !Number.isFinite(Number(text))))
            ) {
              setFormatError('Enter a valid number.');
              return;
            }
            setFormatError('');
            change(
              text === ''
                ? undefined
                : text === '-' || text.endsWith('.')
                  ? text
                  : Number(text),
            );
          } else change(text || undefined);
        }}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
export function StructuredChoiceField({
  schema,
  value,
  name,
  options,
  onValue,
  disabled,
  rollSpec,
}: {
  rollSpec?: RollSpecResolver;
  schema: z.ZodType;
  value: unknown;
  name: string;
  options: Options;
  onValue: (value: unknown) => boolean | void;
  disabled: boolean;
}) {
  const form = useForm<{ value: unknown }>({ values: { value } });
  const [issues, setIssues] = useState<z.core.$ZodIssue[]>([]);
  const invalid = useRef(new Map<string, { path: string; message: string }>());
  const registry = useRef<InvalidInputRegistry>({
    report(id, path, message) {
      if (message === null) invalid.current.delete(id);
      else invalid.current.set(id, { path, message });
    },
    release(id) {
      invalid.current.delete(id);
    },
  });
  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={form.handleSubmit(({ value }) => {
        if (invalid.current.size > 0) {
          setIssues(
            [...invalid.current.values()].map(({ path, message }) => ({
              code: 'custom',
              path: rollPathSegments(path),
              message,
              input: undefined,
            })),
          );
          return;
        }
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
          setIssues(
            parsed.error.issues.map((issue) => ({
              ...issue,
              message:
                issue.code === 'invalid_type' &&
                String(issue.message).includes('undefined')
                  ? 'A value is required.'
                  : issue.message,
            })),
          );
          return;
        }
        setIssues([]);
        onValue(parsed.data);
      })}
    >
      <InvalidInputContext value={registry.current}>
        <Fields
          rollSpec={rollSpec}
          rootValue={form.watch('value')}
          schema={schema}
          value={form.watch('value')}
          change={(value) => {
            form.setValue('value', value);
            setIssues([]);
          }}
          name={name}
          options={options}
          issues={issues}
          disabled={disabled}
        />
      </InvalidInputContext>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" type="submit" disabled={disabled}>
          Save {choiceFieldLabel(name).toLowerCase()}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={disabled}
          onClick={() => {
            if (onValue(undefined) !== false) form.reset({ value: undefined });
          }}
        >
          Clear {choiceFieldLabel(name).toLowerCase()}
        </Button>
      </div>
    </form>
  );
}
