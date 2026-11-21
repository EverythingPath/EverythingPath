'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { gp } from '~/components/week-review/review-text';
import type { DetailOption } from './activity-action-detail';
import type {
  AvailabilityFact,
  CacheContents,
  DetailReferenceList,
  PurchaseFact,
} from './activity-economy-detail';
import {
  purchaseFormSchema,
  purchaseFormValues,
  purchaseFromForm,
  type EconomyFieldEdits,
  type PurchaseForm,
  type PurchaseValues,
} from './activity-economy-edits';
import {
  Field,
  Muted,
  Note,
  type FieldContext as SharedContext,
} from './activity-detail-parts';
import { ActivityText } from './activity-text';

// The pieces the market, cache and Special Order editors share: a purchase
// list with its row form, a list of item references with an add control, the
// table's availability answer, a cache's contents, and the note for a
// recorded reference the militia no longer has.

export type EconomyContext = SharedContext<EconomyFieldEdits>;

const LIST = 'max-w-xl divide-y rounded-md border text-sm';
const ROW = 'flex min-h-11 items-start gap-3 px-3 py-2';

// A button that performs one edit; outline unless told otherwise.
export function ActionButton({
  context,
  onClick,
  variant = 'outline',
  size,
  label,
  children,
}: {
  context: Pick<EconomyContext, 'disabled'>;
  onClick: () => unknown;
  variant?: 'outline' | 'ghost';
  size?: 'sm' | 'icon-sm';
  label?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={label}
      disabled={context.disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function RemoveButton(props: {
  context: Pick<EconomyContext, 'disabled'>;
  label: string;
  onClick: () => unknown;
}) {
  return (
    <ActionButton {...props} variant="ghost" size="icon-sm">
      <X aria-hidden className="size-4" />
    </ActionButton>
  );
}

// An input in the enclosing Form's row with its reserved error slot; the
// field reads its control from the Form provider.
export function TextFormField({
  name,
  label,
  disabled,
  decimal = false,
}: {
  name: string;
  label: string;
  disabled: boolean;
  decimal?: boolean;
}) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0 space-y-1">
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="text"
              inputMode={decimal ? 'decimal' : 'text'}
              autoComplete="off"
              className={decimal ? 'font-mono' : undefined}
              disabled={disabled}
            />
          </FormControl>
          <div className="min-h-5">
            <FormMessage role="alert" />
          </div>
        </FormItem>
      )}
    />
  );
}

function hasMissing(options: DetailOption[] | null | undefined) {
  return (options ?? []).some((option) => option.missing);
}
// Whether any listed option or selected entry is a reference the militia no
// longer has.
export function anyMissing(
  ...lists: (DetailOption[] | DetailReferenceList | null | undefined)[]
) {
  return lists.some((list) =>
    list && 'available' in list
      ? hasMissing(list.selected) || hasMissing(list.available)
      : hasMissing(list),
  );
}

// A link to Militia corrections, where missing references are restored.
export function CorrectionsLink({
  correctionsHref,
}: {
  correctionsHref?: string;
}) {
  if (!correctionsHref) return null;
  return (
    <>
      {' '}
      <GuardedLink
        href={correctionsHref}
        className="text-primary underline-offset-4 hover:underline"
      >
        Open Militia corrections
      </GuardedLink>
    </>
  );
}

export function MissingReferenceNote({
  correctionsHref,
}: {
  correctionsHref?: string;
}) {
  return (
    <Note>
      A recorded item, cache or settlement is no longer the militia’s. Choose
      another or restore it in Militia corrections.
      <CorrectionsLink correctionsHref={correctionsHref} />
    </Note>
  );
}

// The table's answer to whether an item was found available.
export function AvailabilityAnswer({
  availability,
  name,
  context,
}: {
  availability: AvailabilityFact;
  name: string;
  context: EconomyContext;
}) {
  const { edits, disabled } = context;
  const unanswered = availability.outcome === null;
  return (
    <Field name="acknowledgements" context={context}>
      <div className="space-y-2">
        {availability.required && unanswered && (
          <Muted>Record whether the table found it available.</Muted>
        )}
        <ActivityText
          name={`Availability of ${name}`}
          value={availability.outcome ?? ''}
          required
          disabled={disabled}
          onValue={(text) =>
            edits.setAvailability(availability.itemId, text.trim())
          }
        />
        {!unanswered && (
          <ActionButton
            context={context}
            size="sm"
            label={`Clear availability of ${name}`}
            onClick={() => edits.clearAvailability(availability.itemId)}
          >
            Clear availability
          </ActionButton>
        )}
      </div>
    </Field>
  );
}

// One purchase's name, price and weight. `onSave` reports whether the write
// was accepted, so the row only closes on success.
function PurchaseFormFields({
  label,
  defaultValues,
  disabled,
  onSave,
  onCancel,
}: {
  label: string;
  defaultValues: PurchaseForm;
  disabled: boolean;
  onSave: (values: PurchaseValues) => boolean;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: zodResolver(purchaseFormSchema),
  });
  const input = { disabled };
  return (
    <Form {...form}>
      <form
        noValidate
        aria-label={label}
        className="space-y-2"
        onSubmit={form.handleSubmit((values) => {
          onSave(purchaseFromForm(values));
        })}
      >
        <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,8rem)_minmax(0,7rem)]">
          <TextFormField {...input} name="name" label="Item name" />
          <TextFormField {...input} name="price" label="Price (gp)" decimal />
          <TextFormField {...input} name="weight" label="Weight (lb)" decimal />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={disabled}>
            Save purchase
          </Button>
          <ActionButton context={input} variant="ghost" onClick={onCancel}>
            Cancel
          </ActionButton>
        </div>
      </form>
    </Form>
  );
}

function PurchaseRow({
  purchase,
  context,
}: {
  purchase: PurchaseFact;
  context: EconomyContext;
}) {
  const [isEditing, setEditing] = useState(false);
  const { edits, disabled } = context;
  const name = purchase.name ?? 'Unnamed item';
  if (isEditing)
    return (
      <li className="px-3 py-2">
        <PurchaseFormFields
          label={`Purchase ${name}`}
          defaultValues={purchaseFormValues(purchase)}
          disabled={disabled}
          onSave={(values) => {
            const saved = edits.savePurchase(purchase.itemId, values);
            if (saved) setEditing(false);
            return saved;
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  return (
    <li className={ROW}>
      <div className="min-w-0 flex-1 space-y-1 [overflow-wrap:anywhere]">
        <p>
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground">
            {` · ${gp(purchase.priceCopper)} · `}
            {purchase.weight === null
              ? 'Weight not recorded'
              : `${purchase.weight} lb`}
          </span>
        </p>
        {purchase.incomplete && <Note>Needs a name and a weight.</Note>}
        {purchase.duplicate && (
          <Note>
            This item already exists; remove this purchase and add it again as a
            new item.
          </Note>
        )}
        <AvailabilityAnswer
          availability={purchase.availability}
          name={name}
          context={context}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ActionButton
          context={context}
          size="sm"
          label={`Edit purchase ${name}`}
          onClick={() => setEditing(true)}
        >
          Edit
        </ActionButton>
        <RemoveButton
          context={context}
          label={`Remove purchase ${name}`}
          onClick={() => edits.removePurchase(purchase.itemId)}
        />
      </div>
    </li>
  );
}

// The purchases of a market or a placed cache: not recorded, none, or a list
// with one form per row and one for a new purchase.
export function PurchaseList({
  purchases,
  context,
  intro,
}: {
  purchases: PurchaseFact[] | null;
  context: EconomyContext;
  intro: string;
}) {
  const [isAdding, setAdding] = useState(false);
  const { edits, disabled } = context;
  return (
    <Field name="purchases" context={context}>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Purchases</h3>
        <Muted>{intro}</Muted>
        {purchases === null && <Muted>Not recorded yet.</Muted>}
        {purchases?.length === 0 && <Muted>No purchases.</Muted>}
        {purchases && purchases.length > 0 && (
          <ul aria-label="Purchases" className={LIST}>
            {purchases.map((purchase) => (
              <PurchaseRow
                key={purchase.itemId}
                purchase={purchase}
                context={context}
              />
            ))}
          </ul>
        )}
        {isAdding ? (
          <div className="max-w-xl rounded-md border px-3 py-2 text-sm">
            <PurchaseFormFields
              label="New purchase"
              defaultValues={purchaseFormValues()}
              disabled={disabled}
              onSave={(values) => {
                const added = edits.addPurchase(values);
                if (added) setAdding(false);
                return added;
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ActionButton context={context} onClick={() => setAdding(true)}>
              Add purchase
            </ActionButton>
            {purchases === null && (
              <ActionButton
                context={context}
                onClick={() => edits.recordNoPurchases()}
              >
                No purchases
              </ActionButton>
            )}
            {purchases?.length === 0 && (
              <ActionButton
                context={context}
                onClick={() => edits.clearPurchases()}
              >
                Clear purchases
              </ActionButton>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

function ReferenceItem({ option }: { option: DetailOption }) {
  return (
    <SelectItem value={option.value} className="min-h-10">
      {option.label}
      {option.description !== null && (
        <span className="text-muted-foreground"> · {option.description}</span>
      )}
    </SelectItem>
  );
}

// A recorded list of item references (sales, items to place) with a select
// to add one. `empty` renders the list's own not-recorded or none state.
export function ItemReferenceList({
  list,
  heading,
  addLabel,
  removeLabel,
  onAdd,
  onRemove,
  context,
  correctionsHref,
  empty,
}: {
  list: DetailReferenceList;
  heading: string;
  addLabel: string;
  removeLabel: (label: string) => string;
  onAdd: (itemId: string) => unknown;
  onRemove: (itemId: string) => unknown;
  context: EconomyContext;
  correctionsHref?: string;
  empty?: ReactNode;
}) {
  const selected = list.selected ?? [];
  const eligible = list.available.filter((option) => option.eligible);
  const other = list.available.filter((option) => !option.eligible);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{heading}</h3>
      {selected.length === 0 && empty}
      {selected.length > 0 && (
        <ul aria-label={heading} className={LIST}>
          {selected.map((entry) => (
            <li key={entry.value} className={ROW}>
              <span className="min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]">
                <span className="block">{entry.label}</span>
                {entry.description !== null && (
                  <span className="text-muted-foreground block text-xs">
                    {entry.description}
                  </span>
                )}
                {entry.missing && (
                  <span role="note" className="block text-xs text-amber-300">
                    Missing
                    <CorrectionsLink correctionsHref={correctionsHref} />
                  </span>
                )}
              </span>
              <RemoveButton
                context={context}
                label={removeLabel(entry.label)}
                onClick={() => onRemove(entry.value)}
              />
            </li>
          ))}
        </ul>
      )}
      {list.available.length > 0 && (
        <Select value="" disabled={context.disabled} onValueChange={onAdd}>
          <SelectTrigger aria-label={addLabel} className="w-full max-w-xl">
            <SelectValue placeholder={`${addLabel}…`} />
          </SelectTrigger>
          <SelectContent>
            {eligible.map((option) => (
              <ReferenceItem key={option.value} option={option} />
            ))}
            {other.length > 0 && (
              <>
                {eligible.length > 0 && <SelectSeparator />}
                <SelectGroup>
                  <SelectLabel>Other items</SelectLabel>
                  {other.map((option) => (
                    <ReferenceItem key={option.value} option={option} />
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// "7 lb of 5 lb, over the limit": an amount against its class limit, which
// is undefined without a class and null when the class sets none.
function measured(
  amount: number,
  limit: number | null | undefined,
  format: (value: number) => string,
) {
  if (limit === undefined) return format(amount);
  if (limit === null) return `${format(amount)} (no limit)`;
  return `${format(amount)} of ${format(limit)}${amount > limit ? ', over the limit' : ''}`;
}

// What a placed cache holds against its class's limits.
export function ContentsSummary({ contents }: { contents: CacheContents }) {
  const { limit } = contents;
  const parts = [
    measured(
      contents.weight,
      limit === null ? undefined : limit.weight,
      // Decimal weights add up with floating-point noise.
      (value) => `${Math.round(value * 1000) / 1000} lb`,
    ),
    measured(
      contents.valueCopper,
      limit === null ? undefined : limit.valueCopper,
      gp,
    ),
  ];
  const unknown =
    contents.unknown > 0
      ? ` (${contents.unknown} item${contents.unknown === 1 ? '' : 's'} without a known weight or value)`
      : '';
  const text = `Contents: ${parts.join(' · ')}${unknown}`;
  const over =
    (limit?.weight != null && contents.weight > limit.weight) ||
    (limit?.valueCopper != null && contents.valueCopper > limit.valueCopper);
  return over ? <Note>{text}</Note> : <Muted>{text}</Muted>;
}
