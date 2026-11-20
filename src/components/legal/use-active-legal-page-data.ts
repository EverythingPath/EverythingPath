'use client';

import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useMemo, useState } from 'react';
import { releaseLegalInputsSchema } from '~/lib/catalog/release-legal-inputs';
import { buildPublicLegalPageData } from '~/lib/legal/site-legal-data';
import type { LegalPageData } from './legal-page-types';

/** Public notice updates replace one complete legal view without clearing it. */
export function useActiveLegalPageData(initialData: LegalPageData) {
  const inputs = useQuery(api.catalogRelease.legalInputs, {});
  const incoming = useMemo(() => {
    if (inputs === null || inputs === undefined) return null;
    const parsed = releaseLegalInputsSchema.safeParse(inputs);
    return parsed.success ? buildPublicLegalPageData(parsed.data) : null;
  }, [inputs]);
  const [selected, setSelected] = useState({
    inputs,
    data: incoming ?? initialData,
  });
  if (incoming && inputs !== selected.inputs) {
    setSelected({ inputs, data: incoming });
    return incoming;
  }
  return selected.data;
}
