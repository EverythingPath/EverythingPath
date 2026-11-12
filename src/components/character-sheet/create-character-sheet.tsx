'use client';
import type { Id } from '@convex/_generated/dataModel';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useNavigationGuard } from '~/components/campaign-shell/navigation-guard';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import {
  campaignPath,
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import type { SaveStatus } from './save-status';
import { CHARACTER_KINDS, formatCharacterKind } from '~/lib/character-kind';
import { action, Block } from './sheet-parts';
import { useCreateCharacterSheet } from './use-create-character-sheet';

const label = 'font-mono text-sm font-normal';

function getCreateLabel(kind: SaveStatus['kind']) {
  if (kind === 'saving') return 'Creating…';
  if (kind === 'saved') return 'Opening sheet…';
  return 'Create character';
}

/**
 * A compact creation form: name, kind and Notes. A confirmed creation opens
 * the new sheet at once; a refused one keeps every entry for correction.
 */
export function CreateCharacterSheet({
  organizationId,
  campaignId,
  origin,
}: {
  organizationId?: string;
  campaignId?: Id<'campaign'>;
  origin?: CharacterSheetOrigin;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const guard = useNavigationGuard();
  const sheetOrigin =
    origin ??
    (campaignId
      ? {
          href: campaignPath(campaignId, 'characters'),
          organization: { kind: 'unrecorded' as const },
        }
      : undefined);
  const creation = useCreateCharacterSheet({
    organizationId,
    campaignId,
    onCreated: (characterId) =>
      guard.navigate(characterSheetPath(characterId, sheetOrigin)),
  });
  const isBusy =
    creation.status.kind === 'saving' || creation.status.kind === 'saved';
  return (
    <Block title="New character">
      <Form {...creation.form}>
        <form
          noValidate
          aria-label="New character"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (maintenance.readOnly) return;
            void creation.create();
          }}
        >
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,2fr)_8rem_minmax(0,3fr)]">
            <FormField
              control={creation.form.control}
              name="name"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel className={label}>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      disabled={maintenance.readOnly}
                    />
                  </FormControl>
                  <FormMessage role={fieldState.error ? 'alert' : undefined} />
                </FormItem>
              )}
            />
            <FormField
              control={creation.form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={label}>Kind</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={maintenance.readOnly}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CHARACTER_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {formatCharacterKind(kind)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={creation.form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={label}>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      className="min-h-9"
                      disabled={maintenance.readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              className={action}
              disabled={isBusy || maintenance.readOnly}
            >
              {getCreateLabel(creation.status.kind)}
            </Button>
            <MaintenanceReason notice={maintenance} />
            {creation.status.kind === 'error' ? (
              <p
                role="alert"
                className="text-destructive text-sm [overflow-wrap:anywhere]"
              >
                {creation.status.message}
              </p>
            ) : null}
          </div>
        </form>
      </Form>
    </Block>
  );
}
