'use client';

import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useOrganization, useOrganizationList } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  resolveCharacterSheetBack,
  readCharacterSheetOrigin,
} from '~/lib/campaign-routes';
import { useNavigationGuard } from '~/components/campaign-shell/navigation-guard';

type OrganizationSwitch =
  | { kind: 'idle' }
  | { kind: 'switching' | 'failed' | 'done'; target: string };

type Activation = {
  target: string;
  satisfied: boolean;
  promise: Promise<void> | null;
};

export function useCharacterSheetNavigation(characterId?: string) {
  const params = useSearchParams();
  const origin = readCharacterSheetOrigin(params);
  const back = resolveCharacterSheetBack(origin);
  const auth = useConvexAuth();
  const snapshot = useQuery({
    ...convexQuery(
      api.characterSheet.read,
      characterId && auth.isAuthenticated ? { characterId } : 'skip',
    ),
    throwOnError: false,
  });
  const campaign =
    auth.isAuthenticated && characterId && !snapshot.error
      ? snapshot.data?.campaign
      : undefined;
  const { organization } = useOrganization();
  const { isLoaded, setActive } = useOrganizationList();
  const guard = useNavigationGuard();
  const router = useRouter();
  const attempted = useRef<string | null>(null);
  const activation = useRef<Activation | null>(null);
  const activeOrganization = useRef(organization?.id ?? null);
  useEffect(() => {
    activeOrganization.current = organization?.id ?? null;
  }, [organization?.id]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [retryCount, setRetryCount] = useState(0);
  const [switchStatus, setSwitchStatus] = useState<OrganizationSwitch>({
    kind: 'idle',
  });
  const target = campaign ? `${characterId}/${campaign.organizationId}` : null;
  const matchesCampaign = organization?.id === campaign?.organizationId;
  // Reconcile a new sheet or completed manual selection before rendering.
  if (
    target &&
    (switchStatus.kind === 'idle' ||
      switchStatus.target !== target ||
      (matchesCampaign && switchStatus.kind !== 'done'))
  ) {
    setSwitchStatus({ target, kind: matchesCampaign ? 'done' : 'switching' });
  }
  useEffect(() => {
    if (!target) {
      attempted.current = null;
      return;
    }
    if (!campaign || !isLoaded) return;
    if (organization?.id === campaign.organizationId) {
      attempted.current = target;
      if (activation.current?.target === target)
        activation.current.satisfied = true;
      return;
    }
    if (attempted.current === target) return;
    attempted.current = target;
    const attempt: Activation = { target, satisfied: false, promise: null };
    activation.current = attempt;
    attempt.promise = setActive({
      organization: campaign.organizationId,
    }).then(
      () => {
        if (mounted.current && attempted.current === target) {
          // Clerk may publish the new organization after setActive resolves.
          if (!attempt.satisfied)
            activeOrganization.current = campaign.organizationId;
          setSwitchStatus({ target, kind: 'done' });
        }
      },
      () => {
        if (mounted.current && attempted.current === target)
          setSwitchStatus((current) =>
            current.kind === 'done' && current.target === target
              ? current
              : { target, kind: 'failed' },
          );
      },
    );
  }, [target, campaign, isLoaded, organization?.id, setActive, retryCount]);

  const navigateBack = () =>
    guard.requestDeparture({
      failureMessage: 'The organization could not be changed. Try again.',
      commit: async () => {
        await activation.current?.promise;
        const source = origin?.organization;
        const sourceOrganization =
          source?.kind === 'organization' ? source.id : null;
        if (
          source &&
          source.kind !== 'unrecorded' &&
          sourceOrganization !== activeOrganization.current
        ) {
          if (!isLoaded) throw new Error('Organizations are not available.');
          await setActive({ organization: sourceOrganization });
          activeOrganization.current = sourceOrganization;
        }
        router.push(back.href);
      },
    });
  let kind: 'idle' | 'switching' | 'failed' = 'idle';
  if (target && !matchesCampaign) {
    if (switchStatus.kind === 'idle' || switchStatus.target !== target)
      kind = 'switching';
    else if (switchStatus.kind !== 'done') kind = switchStatus.kind;
  }
  return {
    back: { ...back, onNavigate: navigateBack },
    origin,
    campaign,
    navigateBack,
    organizationSwitch: {
      kind,
      retry: () => {
        attempted.current = null;
        setSwitchStatus({ kind: 'idle' });
        setRetryCount((value) => value + 1);
      },
    },
  };
}
