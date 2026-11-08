import type { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../convex/_generated/api';
import { LegalPage } from '~/components/legal/legal-page';
import { loadLegalPageData } from '~/lib/catalog/legal-page-loader';

export const metadata: Metadata = { title: 'Legal notices' };

// Public: outside the campaign layout, and `proxy.ts` protects no route, so
// no sign-in or organization is needed. Candidate notices remain private;
// before activation the page retains its committed notice inputs.
export default async function LegalRoute() {
  const data = await loadLegalPageData(() =>
    fetchQuery(api.catalogRelease.legalInputs, {}),
  );
  return <LegalPage data={data} />;
}
