'use client';
import { useId, useState } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { abilityLabels, type ResolvedStatistic } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { InlineWarnings } from './inline-warning';
import { Block, chip, fieldLabel, formatModifier } from './sheet-parts';
import { SkillRankCell } from './skill-rank-cell';
import { SheetStatistic } from './sheet-statistic';
import type { useCharacterSheet } from './use-character-sheet';
import { useCharacterSheetSkills } from './use-character-sheet-skills';

type Controller = ReturnType<typeof useCharacterSheet>;
type SkillsView = ReturnType<typeof useCharacterSheetSkills>;
type Skill = SkillsView['skills'][number];
type LevelRow = SkillsView['levels'][number];
type SelectedLevel = { row: LevelRow; level: number };

const tableHeadingClass = cn(
  fieldLabel,
  'px-1 pb-1 text-left font-normal md:px-2',
);
const tableCellClass = 'px-1 py-0.5 md:px-2';

// "Level 2 · Rogue 1 · 3/8": the row, its class so far, and its ranks.
function describeLevelOption(row: LevelRow) {
  const metadata = row.metadata;
  const className = metadata?.classLevel
    ? `${row.className} ${metadata.classLevel}`
    : row.className;
  const spent = metadata?.skillRanksSpent ?? 0;
  const budget = metadata?.skillRankBudget ?? null;
  const ranks = budget === null ? `${spent} spent` : `${spent}/${budget}`;
  return `Level ${row.state.position} · ${className} · ${ranks}`;
}

// What the level has to spend and how much of it is spent, with how high a
// skill may be taken through it. Without a class the budget is unknown; the
// warning under it says what to choose.
function RankSummary({ metadata }: { metadata: LevelRow['metadata'] }) {
  const spent = metadata?.skillRanksSpent ?? 0;
  const budget = metadata?.skillRankBudget ?? null;
  const remaining = metadata?.skillRanksRemaining ?? null;
  const cap = metadata?.skillRankCap ?? null;
  if (budget === null)
    return (
      <p className="text-muted-foreground font-mono text-xs">{spent} spent</p>
    );
  return (
    <p className="font-mono text-xs">
      {spent}/{budget} spent
      {remaining !== null && remaining > 0 ? (
        <span className="text-sky-300"> · {remaining} left</span>
      ) : null}
      {remaining !== null && remaining < 0 ? (
        <span className="text-amber-300"> · {-remaining} over</span>
      ) : null}
      {cap !== null ? (
        <span className="text-muted-foreground"> · up to {cap} per skill</span>
      ) : null}
    </p>
  );
}

/**
 * Which Class Level's ranks the table's inputs spend, with that level's
 * budget and the warnings about its allocation. The level being built is
 * chosen by default.
 */
function RankAllocation({
  levels,
  selected,
  onSelect,
  warningController,
  reasonId,
}: {
  levels: LevelRow[];
  selected: SelectedLevel | null;
  onSelect: (entryId: string) => void;
  warningController: Controller['warnings'];
  /** The block's one maintenance reason, stated beside the selector. */
  reasonId: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  if (!selected)
    return (
      <p className="text-muted-foreground text-sm">
        Add a Class Level to allocate skill ranks.
      </p>
    );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-muted-foreground">Allocate ranks at level</span>
        <Select value={selected.row._id} onValueChange={onSelect}>
          <SelectTrigger
            aria-label="Allocate ranks at level"
            className="h-10 w-64 rounded-none font-mono text-sm md:h-8 md:py-1"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((row) => (
              <SelectItem key={row._id} value={row._id}>
                {describeLevelOption(row)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RankSummary metadata={selected.row.metadata} />
        <MaintenanceReason id={reasonId} notice={maintenance} />
      </div>
      <InlineWarnings
        warnings={selected.row.warnings}
        controller={warningController}
      />
    </div>
  );
}

// The name with its marks inline: a class skill, and the armor check
// penalty where armor applies to it.
function SkillName({ skill }: { skill: Skill }) {
  return (
    <>
      {skill.name}
      {skill.classSkill ? (
        <span className={cn(chip, 'border-primary/60 text-primary ml-1.5')}>
          Class skill
        </span>
      ) : null}
      {skill.armorCheckPenalty !== 0 ? (
        <abbr
          title="Armor check penalty"
          className={cn(chip, 'ml-1.5 text-amber-300 no-underline')}
        >
          ACP {formatModifier(skill.armorCheckPenalty)}
        </abbr>
      ) : null}
    </>
  );
}

function SkillRow({
  skill,
  statistic,
  selected,
  saveRank,
}: {
  skill: Skill;
  statistic: ResolvedStatistic;
  selected: SelectedLevel | null;
  saveRank: SkillsView['saveRank'];
}) {
  return (
    <tr
      data-skill={skill.key}
      className="border-foreground/10 border-b align-top"
    >
      <th
        scope="row"
        className={cn(tableCellClass, 'py-1.5 text-left text-sm font-normal')}
      >
        <SkillName skill={skill} />
      </th>
      <td className={cn(tableCellClass, 'text-right')}>
        <SheetStatistic
          label={skill.name}
          statistic={statistic}
          target={skill.key}
          format={formatModifier}
          className="min-h-7 text-sm"
          alternates={{ isStacked: true }}
        />
      </td>
      <td className={cn(tableCellClass, 'py-1.5 text-right font-mono text-sm')}>
        {skill.ranks}
      </td>
      {selected ? (
        <td className={tableCellClass}>
          <SkillRankCell
            key={`${selected.row._id}:${skill.key}`}
            skill={skill.name}
            level={selected.level}
            ranks={selected.row.ranksFor(skill.key)}
            save={(ranks) => saveRank(selected.row._id, skill.key, ranks)}
          />
        </td>
      ) : null}
      <td
        className={cn(
          tableCellClass,
          'text-muted-foreground py-1.5 font-mono text-sm',
        )}
      >
        <abbr title={abilityLabels[skill.ability]} className="no-underline">
          {abilityLabels[skill.ability].slice(0, 3)}
        </abbr>
      </td>
    </tr>
  );
}

/**
 * Skills (approved variant B): every skill with its current total and its
 * breakdown, its ranks across all levels, and an input spending the chosen
 * Class Level's ranks, with that level's budget and cap read above the
 * table. Class skills and armor check penalties are marked by the name. On
 * the phone the table scrolls within this block.
 */
export function Skills({ controller }: { controller: Controller }) {
  const { skills, levels, saveRank } = useCharacterSheetSkills(controller);
  const reasonId = useId();
  const [pickedLevelId, setPickedLevelId] = useState<string | null>(null);
  const pickedIndex = levels.findIndex((row) => row._id === pickedLevelId);
  const index = pickedIndex === -1 ? levels.length - 1 : pickedIndex;
  const row = levels[index];
  const selected = row ? { row, level: row.state.position } : null;
  const sheet = controller.sheet;
  if (!sheet) return null;
  return (
    <Block
      title="Skills"
      aside={
        <p className="text-muted-foreground font-mono text-xs">
          Ranks use permanent Intelligence at every level.
        </p>
      }
    >
      <MaintenanceReasonScope id={reasonId}>
        <div className="space-y-2">
          <RankAllocation
            levels={levels}
            selected={selected}
            onSelect={setPickedLevelId}
            warningController={controller.warnings}
            reasonId={reasonId}
          />
          <div data-skills-table className="overflow-x-auto">
            <table className="w-full min-w-80 border-collapse text-sm">
              <thead>
                <tr className="border-foreground/20 border-b">
                  <th className={tableHeadingClass}>Skill</th>
                  <th className={cn(tableHeadingClass, 'text-right')}>Total</th>
                  <th className={cn(tableHeadingClass, 'text-right')}>Ranks</th>
                  {selected ? (
                    <th className={tableHeadingClass}>
                      At level {selected.level}
                    </th>
                  ) : null}
                  <th className={tableHeadingClass}>Ability</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((skill) => (
                  <SkillRow
                    key={skill.key}
                    skill={skill}
                    statistic={sheet.calculated.breakdowns[skill.key]}
                    selected={selected}
                    saveRank={saveRank}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </MaintenanceReasonScope>
    </Block>
  );
}
