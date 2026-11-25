'use client';
import { useEffect, useId, useRef } from 'react';
import { Pencil } from 'lucide-react';
import type { Doc } from '@convex/_generated/dataModel';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { FantasyDatePicker } from '~/components/ui/fantasy-date-picker';
import { Label } from '~/components/ui/label';
import { Skeleton } from '~/components/ui/skeleton';
import { Textarea } from '~/components/ui/textarea';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { formatInGameDate } from '~/lib/campaign-fields';
import { cn } from '~/lib/utils';
import { CampaignHomeContent } from './campaign-home-content';
import { CreateCampaignForm } from './create-campaign-form';
import type { Organization } from './home-state';
import {
  useCampaignHeader,
  type CampaignHeaderEditor,
  type HeaderFieldControl,
} from './use-campaign-header';
import type { CampaignHomeSelection } from './use-campaign-home';

const action = 'min-h-11 md:min-h-9';

// The validation error (in the field, referenced by the control) and the
// polite write feedback under one header field.
function FieldNotes({
  errorId,
  field,
}: {
  errorId: string;
  field: HeaderFieldControl;
}) {
  const failed =
    field.status?.kind === 'rejected' || field.status?.kind === 'unknown';
  return (
    <>
      {field.error && (
        <p
          id={errorId}
          className="corner-brackets border-destructive/60 bg-card/80 text-destructive flex min-h-6 items-center border-2 px-2 py-0.5 font-mono text-xs leading-tight tracking-wide uppercase"
        >
          {field.error}
        </p>
      )}
      <p
        role="status"
        aria-live="polite"
        className={cn(
          'text-sm',
          failed ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {field.feedback}
      </p>
    </>
  );
}

function HeaderForm({ header }: { header: CampaignHeaderEditor }) {
  const maintenance = useInitialMigrationMaintenance();
  const id = useId();
  const { description, inGameDate } = header.fields;
  const descriptionId = `${id}-description`;
  const descriptionErrorId = `${id}-description-error`;
  const dateLabelId = `${id}-date-label`;
  const dateErrorId = `${id}-date-error`;
  return (
    <form
      noValidate
      className="max-w-xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        header.save();
      }}
    >
      <fieldset
        disabled={header.pending || maintenance.readOnly}
        className="min-w-0 space-y-4"
      >
        <div className="grid gap-2">
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            autoFocus
            rows={4}
            value={description.value}
            onChange={(event) => description.change(event.target.value)}
            aria-invalid={description.error !== null}
            aria-describedby={
              description.error ? descriptionErrorId : undefined
            }
          />
          <FieldNotes errorId={descriptionErrorId} field={description} />
        </div>
        <div className="grid gap-2">
          <Label asChild>
            <span id={dateLabelId}>In-game date</span>
          </Label>
          <div
            role="group"
            aria-labelledby={dateLabelId}
            aria-invalid={inGameDate.error !== null}
            aria-describedby={inGameDate.error ? dateErrorId : undefined}
            className="flex flex-wrap items-center gap-2"
          >
            <FantasyDatePicker
              className="w-full max-w-xs"
              value={inGameDate.value}
              onChange={inGameDate.change}
              ariaLabel="In-game date"
            />
            {inGameDate.value !== '' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={action}
                onClick={() => inGameDate.change('')}
              >
                Clear date
              </Button>
            )}
          </div>
          <FieldNotes errorId={dateErrorId} field={inGameDate} />
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          className={action}
          disabled={header.pending || maintenance.readOnly}
        >
          {header.pending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={action}
          disabled={header.pending}
          onClick={header.cancel}
        >
          Cancel
        </Button>
        <MaintenanceReason notice={maintenance} />
      </div>
    </form>
  );
}

// One campaign's home: the header (name, saved date, description) with its
// in-place editor, then the content slot. Focus goes to the description when
// editing starts and back to Edit when the editor closes.
function CampaignPane({
  campaign,
  organizationId,
}: {
  campaign: Doc<'campaign'>;
  organizationId: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const header = useCampaignHeader(campaign, organizationId);
  const headingId = useId();
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(header.editing);
  useEffect(() => {
    if (wasEditing.current && !header.editing) editButton.current?.focus();
    wasEditing.current = header.editing;
  }, [header.editing]);
  const date = formatInGameDate(campaign.inGameDate);
  return (
    <section aria-labelledby={headingId} className="max-w-4xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            id={headingId}
            className="min-w-0 text-3xl [overflow-wrap:anywhere]"
          >
            {campaign.name}
          </h2>
          {date && <Badge variant="outline">{date}</Badge>}
          {!header.editing && (
            <Button
              ref={editButton}
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Edit campaign details"
              className={cn(action, 'ml-auto')}
              disabled={maintenance.readOnly}
              onClick={header.edit}
            >
              <Pencil /> Edit
            </Button>
          )}
          {header.editing ? null : <MaintenanceReason notice={maintenance} />}
        </div>
        {header.editing ? (
          <HeaderForm header={header} />
        ) : (
          <>
            {campaign.description !== '' && (
              <p className="text-muted-foreground max-w-prose [overflow-wrap:anywhere] whitespace-pre-line">
                {campaign.description}
              </p>
            )}
            <p
              role="status"
              aria-live="polite"
              className="text-muted-foreground text-sm"
            >
              {header.updated
                ? 'Campaign details were updated.'
                : header.saved
                  ? 'Saved.'
                  : null}
            </p>
          </>
        )}
      </header>
      <CampaignHomeContent campaign={campaign} />
    </section>
  );
}

export function CampaignHomePane({
  organization,
  home,
  createBlockedReason = null,
}: {
  organization: Organization;
  home: CampaignHomeSelection;
  /** Why no campaign can be created now (#710). */
  createBlockedReason?: string | null;
}) {
  const { pane } = home;
  switch (pane.kind) {
    case 'campaign':
      return (
        <CampaignPane
          key={`${organization.id}:${pane.campaign._id}`}
          campaign={pane.campaign}
          organizationId={organization.id}
        />
      );
    case 'opening':
      return (
        <div className="max-w-4xl space-y-4">
          <Skeleton aria-hidden className="h-9 w-64 max-w-full" />
          <Skeleton aria-hidden className="h-5 w-full max-w-prose" />
          <p role="status" className="text-muted-foreground">
            Opening {pane.name}…
          </p>
        </div>
      );
    case 'unavailable':
      return (
        <Card className="max-w-2xl gap-3 p-6">
          <h2 className="text-xl [overflow-wrap:anywhere]">
            This campaign isn&apos;t available in {organization.name}.
          </h2>
          <p className="text-muted-foreground">
            Choose a campaign from the list.
          </p>
        </Card>
      );
    case 'create':
      return (
        <CreateCampaignForm
          create={home.create}
          entry={pane.entry}
          onCancel={home.cancelCreate}
          blockedReason={createBlockedReason}
        />
      );
  }
}
