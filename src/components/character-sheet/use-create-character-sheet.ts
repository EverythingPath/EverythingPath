'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Character name is required'),
  kind: z.enum(['pc', 'npc']),
  description: z.string(),
});

export function useCreateCharacterSheet({
  organizationId,
  campaignId,
  onCreated,
}: {
  organizationId?: string;
  campaignId?: Id<'campaign'>;
  onCreated: (characterId: Id<'character'>) => void;
}) {
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', kind: 'pc', description: '' },
  });
  void form.formState.errors;
  const createCharacter = useMutation(api.characterSheet.create);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const isBusy = useRef(false);

  async function create() {
    if (isBusy.current || status.kind === 'saved') return;
    isBusy.current = true;
    try {
      await form.handleSubmit(async (values) => {
        setStatus({ kind: 'saving' });
        try {
          const id = await createCharacter({
            ...values,
            organizationId,
            campaignId,
            operationId: crypto.randomUUID(),
          });
          setStatus({ kind: 'saved' });
          onCreated(id);
        } catch (error) {
          const failure = classifyWriteFailure(error);
          setStatus({
            kind: 'error',
            message:
              failure.kind === 'rejected'
                ? `Character wasn't created${refusalReason(failure.message)} Your entries are kept. Try again.`
                : 'Character may have been created. Check the character list before trying again.',
          });
        }
      })();
    } finally {
      isBusy.current = false;
    }
  }

  return { form, status, create };
}
