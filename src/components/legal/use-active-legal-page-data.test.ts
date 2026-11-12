import { renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { buildLegalPageData } from '~/lib/catalog/legal-page-data';
import {
  conditionRequiredNotices,
  legalResources,
  section15Registry,
} from '~/lib/catalog/section15-registry-data';
import { useActiveLegalPageData } from './use-active-legal-page-data';

const transport = vi.hoisted(() => ({ inputs: undefined as unknown }));
vi.mock('convex/react', () => ({ useQuery: () => transport.inputs }));

test('an open legal page retains complete notices until the selected release supplies complete replacement inputs', () => {
  const inputs = {
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: conditionRequiredNotices,
  };
  const initial = buildLegalPageData(inputs);
  const view = renderHook(() => useActiveLegalPageData(initial));
  expect(view.result.current).toEqual(initial);
  transport.inputs = {
    ...inputs,
    resources: {
      ...inputs.resources,
      section8: {
        ...inputs.resources.section8,
        text: 'Replacement Section 8 notice.',
      },
    },
  };
  view.rerender();
  expect(
    view.result.current.sections.find((section) => section.id === 'section8')
      ?.notices[0]?.text,
  ).toBe('Replacement Section 8 notice.');
  transport.inputs = undefined;
  view.rerender();
  expect(
    view.result.current.sections.find((section) => section.id === 'section8')
      ?.notices[0]?.text,
  ).toBe('Replacement Section 8 notice.');
  transport.inputs = { resources: {} };
  view.rerender();
  expect(
    view.result.current.sections.find((section) => section.id === 'section8')
      ?.notices[0]?.text,
  ).toBe('Replacement Section 8 notice.');
});
