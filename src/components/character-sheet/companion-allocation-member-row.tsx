'use client';
import { Button } from '~/components/ui/button';
import { companionComponentLabels } from '~/lib/character-sheet-companion-components';
import { cn } from '~/lib/utils';
import type { CompanionAllocationMemberView } from './character-companion-allocations-view-model';
import { CompanionAllocationEditor } from './companion-allocation-editor';
import { CompanionComponentEditor } from './companion-component-editor';
import { CompanionName } from './companion-name';
import type {
  CompanionAllocationsController,
  CompanionOpenerProps,
} from './companion-props';
import { action, chip, missingChoice, SaveFeedback } from './sheet-parts';

type ComponentMember = Extract<
  CompanionAllocationMemberView,
  { kind: 'component' }
>;

/** A table cell from 768px; a line of the companion's card below. */
const allocationCell =
  'max-md:block max-md:py-0.5 md:px-2 md:py-1.5 md:align-top';
// A ruled row from 768px; a bordered card on the phone.
const allocationRow =
  'max-md:border-foreground/20 max-md:bg-card max-md:block max-md:border max-md:p-3 md:border-foreground/10 md:border-b';

/** The eidolon's recorded shares in words, with the ones it still needs. */
function ComponentShares({ member }: { member: ComponentMember }) {
  const isUnallocated = member.components === null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        className={cn(
          chip,
          'max-w-full [overflow-wrap:anywhere] whitespace-normal',
          isUnallocated && 'text-muted-foreground',
          isUnallocated && !member.stateLabel && missingChoice,
        )}
      >
        {member.componentsLabel}
      </span>
      {member.missing.length > 0 && !member.stateLabel ? (
        <p className="text-xs [overflow-wrap:anywhere] text-sky-300">
          Allocate{' '}
          {member.missing
            .map((key) => companionComponentLabels[key])
            .join(', ')}
          .
        </p>
      ) : null}
    </div>
  );
}

/**
 * One companion's share of a divided budget: its name (a link while its
 * sheet is accessible), the share or Not allocated, why a kept share is not
 * counting, and Edit and Clear for a budget that divides levels or
 * components. The open editor takes the share's place while Edit stays
 * pressed, so closing it can hand focus back.
 */
export function CompanionAllocationMemberRow({
  member,
  poolLabel,
  controller,
  reasonId,
  rememberOpener,
}: CompanionOpenerProps & {
  /**
   * A share of divided levels, an eidolon's divided components, or a
   * companion under a one-companion limit.
   */
  member: CompanionAllocationMemberView;
  poolLabel: string;
  controller: CompanionAllocationsController;
  reasonId: string | undefined;
}) {
  const title = `${member.name}'s ${poolLabel} share`;
  const status = controller.statusFor(member.key);
  const isDisabled = controller.isDisabled || status.kind === 'saving';
  // Only a share of divided levels or components has a share to show, edit
  // or clear; each kind has its own editor.
  const share = member.kind === 'allocation' ? member : null;
  const components = member.kind === 'component' ? member : null;
  const isEditing = components
    ? controller.componentEditor?.key === member.key
    : controller.editor?.key === member.key;
  const hasRecord = share
    ? share.levels !== null
    : components
      ? components.components !== null
      : false;
  function toggleEditor(opener: HTMLElement) {
    if (components) {
      if (isEditing) return controller.closeComponentEditor();
      rememberOpener(opener);
      return controller.openComponentEditor(components);
    }
    if (!share) return;
    if (isEditing) return controller.closeEditor();
    rememberOpener(opener);
    controller.openEditor(share);
  }
  function clear() {
    if (components) return void controller.clearComponents(components);
    if (share) return void controller.clear(share);
  }
  return (
    <tr role="row" className={allocationRow}>
      <th
        role="rowheader"
        scope="row"
        className={cn(allocationCell, 'text-left font-normal')}
      >
        <CompanionName row={member} />
      </th>
      {share ? (
        <td role="cell" className={allocationCell}>
          {isEditing ? (
            <CompanionAllocationEditor
              controller={controller}
              title={title}
              status={status}
              reasonId={reasonId}
            />
          ) : (
            <span
              className={cn(
                chip,
                share.levels === null && 'text-muted-foreground',
                share.levels === null && !share.stateLabel && missingChoice,
              )}
            >
              {share.levelsLabel}
            </span>
          )}
        </td>
      ) : null}
      {components ? (
        <td role="cell" className={allocationCell}>
          {isEditing ? (
            <CompanionComponentEditor
              controller={controller}
              title={title}
              status={status}
              reasonId={reasonId}
            />
          ) : (
            <ComponentShares member={components} />
          )}
        </td>
      ) : null}
      <td
        role="cell"
        className={cn(
          allocationCell,
          'text-muted-foreground text-xs [overflow-wrap:anywhere]',
        )}
      >
        {member.stateLabel}
      </td>
      {share || components ? (
        <td role="cell" className={allocationCell}>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={action}
              aria-pressed={isEditing}
              aria-describedby={reasonId}
              disabled={isDisabled}
              onClick={(event) => toggleEditor(event.currentTarget)}
            >
              Edit <span className="sr-only">{title}</span>
            </Button>
            {hasRecord && !isEditing ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(action, 'text-muted-foreground')}
                aria-describedby={reasonId}
                disabled={isDisabled}
                onClick={clear}
              >
                Clear <span className="sr-only">{title}</span>
              </Button>
            ) : null}
            <SaveFeedback
              status={status}
              savedText="Saved"
              savingText="Saving…"
              shouldHideWhenIdle
            />
          </div>
        </td>
      ) : null}
    </tr>
  );
}
