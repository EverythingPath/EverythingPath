'use client';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RemoteNotice, SaveFeedback } from './sheet-parts';
import { useSkillRankForm } from './use-character-sheet-skills';

/**
 * The ranks one skill has at one Class Level: the plain number, saved when
 * the field is left or on Enter. A number the sheet cannot read is refused at
 * the field; a number outside the rules saves and warns in the allocation
 * summary. A refused save keeps the draft and offers Save beside it.
 * Mounted once per level and skill, so a draft never travels to another
 * level. The column heading names the level; the field itself carries its
 * full name, so thirty-five cells add no label elements to the sheet, and
 * as a number field it is a spin button, not one more text box among the
 * sheet's many.
 */
export function SkillRankCell({
  skill,
  level,
  ranks,
  save,
}: {
  skill: string;
  level: number;
  ranks: number;
  save: (ranks: number) => Promise<unknown>;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const editor = useSkillRankForm({ ranks, save });
  const isDirty = editor.form.formState.isDirty;
  const isSaving = editor.status.kind === 'saving';
  const subject = `${skill} ranks at level ${level}`;
  return (
    <Form {...editor.form}>
      <FormField
        control={editor.form.control}
        name="value"
        render={({ field, fieldState }) => (
          <FormItem className="flex flex-col items-start gap-1">
            <FormControl>
              <Input
                {...field}
                aria-label={subject}
                disabled={maintenance.readOnly}
                type="number"
                inputMode="numeric"
                autoComplete="off"
                className="h-10 w-14 text-center font-mono md:h-8"
                onBlur={() => {
                  field.onBlur();
                  if (maintenance.readOnly || !isDirty) return;
                  void editor.save();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  if (maintenance.readOnly || !isDirty) return;
                  void editor.save();
                }}
              />
            </FormControl>
            {fieldState.error ? (
              <FormMessage role="alert" className="max-w-40" />
            ) : null}
            {editor.status.kind === 'error' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 md:min-h-8"
                aria-describedby={reasonId}
                disabled={isSaving || maintenance.readOnly}
                onClick={() => {
                  if (maintenance.readOnly) return;
                  void editor.save();
                }}
              >
                Save <span className="sr-only">{subject}</span>
              </Button>
            ) : null}
            <SaveFeedback
              status={editor.status}
              savedText="Ranks saved."
              shouldHideWhenIdle
            />
            <RemoteNotice
              isShown={editor.hasRemoteChange}
              message={
                isDirty
                  ? 'Updated by another player. Your edits are kept.'
                  : 'Updated by another player.'
              }
              subject={subject}
              onDismiss={editor.dismissRemoteChange}
            />
          </FormItem>
        )}
      />
    </Form>
  );
}
