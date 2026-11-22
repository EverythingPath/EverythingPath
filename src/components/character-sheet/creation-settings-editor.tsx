'use client';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import type { CreationSettings } from '~/lib/character-sheet';
import {
  AbilityMethodField,
  CampaignTraitField,
  NumberSettingField,
} from './creation-settings-fields';
import { action, Block, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import { useCreationSettingsForm } from './use-sheet-forms';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * How this Character was made: scores by point buy within a budget or
 * rolled, how many traits, and whether one must be a campaign trait. The
 * sheet's rules warnings are advisory; budgets and trait counts must be
 * whole numbers of 0 or more before saving.
 */
export function CreationSettingsEditor({
  settings,
  save,
}: {
  settings: CreationSettings;
  save: Controller['saveCreationSettings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useCreationSettingsForm({ settings, save });
  const isSaving = editor.status.kind === 'saving';
  const isPointBuy = editor.form.watch('abilityMethod') === 'pointBuy';
  const field = {
    control: editor.form.control,
    isReadOnly: maintenance.readOnly,
  };
  return (
    <Block title="Creation settings">
      <Form {...editor.form}>
        <form
          noValidate
          aria-label="Creation settings"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (maintenance.readOnly) return;
            void editor.save();
          }}
        >
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <AbilityMethodField {...field} />
            {isPointBuy ? (
              <NumberSettingField
                {...field}
                name="pointBuyBudget"
                label="Point-buy budget"
              />
            ) : null}
            <NumberSettingField
              {...field}
              name="traitCount"
              label="Trait count"
            />
            <CampaignTraitField {...field} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button
              type="submit"
              size="sm"
              className={action}
              disabled={isSaving || maintenance.readOnly}
            >
              {isSaving ? 'Saving…' : 'Save creation settings'}
            </Button>
            <SaveFeedback
              status={editor.status}
              savedText="Creation settings saved."
            />
            <MaintenanceReason notice={maintenance} />
            <RemoteNotice
              isShown={editor.hasRemoteChange}
              message={
                editor.form.formState.isDirty
                  ? 'Updated by another player. Your edits are kept.'
                  : 'Updated by another player.'
              }
              subject="creation settings"
              onDismiss={editor.dismissRemoteChange}
            />
          </div>
        </form>
      </Form>
    </Block>
  );
}
