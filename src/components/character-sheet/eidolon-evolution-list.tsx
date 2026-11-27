'use client';
import { Lock, Plus, TriangleAlert, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import type { UnchainedSubtypeChoiceKey } from '~/lib/catalog/representative-unchained-eidolons';
import type {
  EidolonEvolutionSelection,
  EidolonProgressionState,
} from '~/lib/character-sheet-eidolon-progression';
import { cn } from '~/lib/utils';
import {
  withEidolonEvolution,
  withoutEidolonEvolution,
  type EidolonProgressionView,
} from './character-eidolon-progression-view-model';
import { EidolonEvolutionPicker } from './eidolon-evolution-picker';
import {
  EidolonSubtypeChoicePrompt,
  missingChoiceForRow,
} from './eidolon-subtype-choice-prompt';
import type { SaveStatus } from './save-status';
import { action, chip, fieldLabel, SaveFeedback } from './sheet-parts';
import type { EvolutionCatalog } from './use-eidolon-evolution-picker-form';

type Projection = EidolonProgressionView['ordinary'];
type Evolution = Projection['evolutions'][number];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
const struck = 'text-muted-foreground line-through';

function evolutionTitle(row: Evolution) {
  return row.choiceLabel ? `${row.name} (${row.choiceLabel})` : row.name;
}
const originLabels: Record<Evolution['origin'], string | null> = {
  baseForm: 'From the base form',
  subtype: 'From the subtype',
  chosen: null,
};

function EvolutionRow({
  row,
  subtype,
  upgradeLabel,
  canRemove,
  isDisabled,
  reasonId,
  status,
  onRemove,
  onChooseSubtypeChoice,
}: {
  row: Evolution;
  subtype: Projection['subtype'];
  upgradeLabel: string | null;
  canRemove: boolean;
  isDisabled: boolean;
  reasonId: string | undefined;
  status: SaveStatus;
  onRemove: () => void;
  onChooseSubtypeChoice: (
    key: UnchainedSubtypeChoiceKey,
    value: string,
  ) => void;
}) {
  const title = evolutionTitle(row);
  const originLabel = row.isFixed ? originLabels[row.origin] : null;
  const isChoiceDormant = row.dormant.includes('choice');
  const isUpgradeDormant = row.dormant.includes('upgrades');
  const missingChoice = subtype ? missingChoiceForRow(subtype, row) : null;
  return (
    <li aria-label={title} className="flex flex-col gap-1 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {originLabel ? (
          <Lock
            aria-hidden
            className="text-muted-foreground size-3.5 shrink-0"
          />
        ) : null}
        <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
          {row.name}
          {row.choiceLabel ? (
            <>
              {' '}
              <span className={cn(isChoiceDormant && struck)}>
                ({row.choiceLabel})
              </span>
            </>
          ) : null}
          {originLabel ? (
            <span className="sr-only"> ({originLabel})</span>
          ) : null}
        </span>
        {row.upgrades > 0 && upgradeLabel ? (
          <span className={cn(chip, isUpgradeDormant && struck)}>
            {upgradeLabel} ×{row.upgrades}
          </span>
        ) : null}
        <span className={cn(chip, row.free && 'text-muted-foreground')}>
          {row.costLabel}
        </span>
        {canRemove ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(action, 'ml-auto h-auto gap-1 px-2 text-xs')}
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={onRemove}
          >
            <X aria-hidden className="size-3.5" />
            Remove <span className="sr-only">{title}</span>
          </Button>
        ) : null}
      </div>
      {row.issues.map((issue) => (
        <p
          key={issue}
          className="flex items-start gap-1.5 text-xs text-amber-300"
        >
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{issue}</span>
        </p>
      ))}
      {row.dormantLabel ? <p className={note}>{row.dormantLabel}</p> : null}
      {missingChoice && subtype ? (
        <EidolonSubtypeChoicePrompt
          subtypeName={subtype.name}
          choice={missingChoice}
          isDisabled={isDisabled}
          reasonId={reasonId}
          status={status}
          onChoose={onChooseSubtypeChoice}
        />
      ) : row.missingChoice && row.origin === 'chosen' ? (
        <p className="text-xs [overflow-wrap:anywhere] text-sky-300">
          Choose what {row.name} applies to: remove it and add it again with its
          option.
        </p>
      ) : null}
    </li>
  );
}

/**
 * The eidolon's evolutions as the resolver lists them: the base form's and
 * the subtype's fixed ones first, locked, then every recorded one with its
 * cost, its unmet requirements in amber and a missing option as a prompt.
 * A recorded choice or upgrade the current rules do not offer is struck
 * through and kept. Over budget trims nothing. Add opens the picker;
 * Remove writes the whole record without that one evolution.
 */
export function EidolonEvolutionList({
  projection,
  choices,
  baseFormName,
  catalog,
  isDisabled,
  reasonId,
  status,
  subtypeChoiceStatus,
  onChange,
  onChooseSubtypeChoice,
}: {
  projection: Projection;
  /** The recorded choices; null leaves the list read-only. */
  choices: EidolonProgressionState | null;
  baseFormName: string | null;
  catalog: EvolutionCatalog;
  isDisabled: boolean;
  reasonId: string | undefined;
  status: SaveStatus;
  subtypeChoiceStatus: SaveStatus;
  onChange: (progression: EidolonProgressionState) => Promise<boolean>;
  onChooseSubtypeChoice: (
    key: UnchainedSubtypeChoiceKey,
    value: string,
  ) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const upgradeLabel = (key: Evolution['key']) =>
    catalog.find((item) => item.key === key)?.upgrade?.label ?? null;
  // The same evolution can be taken more than once; its rows are told apart
  // by how many like it come before.
  const occurrence = (position: number) => {
    const row = projection.evolutions[position];
    return projection.evolutions
      .slice(0, position)
      .filter((other) => other.key === row?.key && other.choice === row?.choice)
      .length;
  };
  function add(selection: EidolonEvolutionSelection) {
    if (!choices) return Promise.resolve(false);
    return onChange(withEidolonEvolution(choices, selection));
  }
  function remove(position: number) {
    if (!choices) return;
    // Free evolutions come first, so a row's recorded index skips them.
    const index =
      position -
      projection.evolutions.slice(0, position).filter((row) => row.free).length;
    void onChange(withoutEidolonEvolution(choices, index));
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h4 className={fieldLabel}>Evolutions</h4>
        {choices ? (
          <Button
            ref={opener}
            type="button"
            size="sm"
            variant="outline"
            className={action}
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={() => setIsPickerOpen(true)}
          >
            <Plus aria-hidden className="size-3.5" />
            Add evolution
          </Button>
        ) : null}
      </div>
      {projection.evolutions.length > 0 ? (
        <ul aria-label="Evolutions" className="divide-foreground/10 divide-y">
          {projection.evolutions.map((row, position) => (
            <EvolutionRow
              key={`${row.key}/${row.choice ?? ''}/${occurrence(position)}`}
              row={row}
              subtype={projection.subtype}
              upgradeLabel={upgradeLabel(row.key)}
              canRemove={!row.isFixed && choices !== null}
              isDisabled={isDisabled}
              reasonId={reasonId}
              status={subtypeChoiceStatus}
              onRemove={() => remove(position)}
              onChooseSubtypeChoice={onChooseSubtypeChoice}
            />
          ))}
        </ul>
      ) : (
        <p className={note}>No evolutions recorded.</p>
      )}
      <SaveFeedback
        status={isPickerOpen ? { kind: 'idle' } : status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
      {choices ? (
        <EidolonEvolutionPicker
          isOpen={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          catalog={catalog}
          summonerLevel={projection.summonerLevel}
          reductionLabel={projection.reduction?.label ?? null}
          baseFormName={baseFormName}
          subtypeName={projection.subtype?.name ?? null}
          isDisabled={isDisabled}
          reasonId={reasonId}
          status={status}
          onAdd={add}
        />
      ) : null}
    </div>
  );
}
