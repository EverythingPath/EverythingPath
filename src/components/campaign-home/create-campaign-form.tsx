'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
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
import { Textarea } from '~/components/ui/textarea';
import {
  createCampaignSchema,
  type CreateCampaignInput,
  type CreateCampaignValues,
} from '~/lib/campaign-fields';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { refusalReason } from '~/lib/write-outcome';
import type { CreateCampaign } from './use-create-campaign';

// The pane's create form. `entry` is why it is shown: "new" was chosen from
// the index (Cancel leaves it), "empty" is an organization without campaigns
// (Cancel only clears the entries; the form is all there is to show).
export function CreateCampaignForm({
  create,
  entry,
  onCancel,
  blockedReason = null,
}: {
  create: CreateCampaign;
  entry: 'new' | 'empty';
  onCancel: () => void;
  /** Why no campaign can be created now (#710); keeps the entries. */
  blockedReason?: string | null;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const form = useForm<CreateCampaignInput, unknown, CreateCampaignValues>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: { name: '', description: '' },
  });
  const pending = create.status.kind === 'pending';
  const locked = pending || maintenance.readOnly || blockedReason !== null;
  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-2xl">
        {entry === 'empty'
          ? 'Create a campaign to get started.'
          : 'New campaign'}
      </h2>
      <Form {...form}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await create.submit(values);
          })}
        >
          <fieldset disabled={locked} className="min-w-0 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign name</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              className="min-h-11 md:min-h-9"
              disabled={locked}
            >
              {pending ? 'Creating…' : 'Create'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 md:min-h-9"
              disabled={pending}
              onClick={entry === 'new' ? onCancel : () => form.reset()}
            >
              Cancel
            </Button>
            <MaintenanceReason notice={maintenance} />
          </div>
          {blockedReason !== null && (
            <p role="status" className="text-muted-foreground text-sm">
              {blockedReason}
            </p>
          )}
          {create.status.kind === 'rejected' && (
            <p role="alert" className="text-destructive text-sm">
              The campaign wasn&apos;t created
              {refusalReason(create.status.message)} Your entries are kept.
            </p>
          )}
          {create.status.kind === 'unknown' && (
            <p role="alert" className="text-destructive text-sm">
              We couldn&apos;t confirm whether the campaign was created. Check
              the campaign list before creating it again.
            </p>
          )}
        </form>
      </Form>
    </div>
  );
}
