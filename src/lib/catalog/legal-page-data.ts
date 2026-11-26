import { isPublishableNotice } from './admission-schema.ts';
import type {
  LegalNotice,
  LegalResources,
  Section15Registry,
} from './legal-types.ts';
import { createNoticeIndex, resolveNotice } from './resolve-notice.ts';

type NoticeRequirement = {
  code: string;
  canonicalCode: string;
  notice: Section15Registry[string] | undefined;
};
type OutstandingNotice = {
  code: string;
  title: string;
  reason: 'missing' | 'unreviewed';
};

export function buildLegalPageData({
  registry,
  resources,
  permanentNoticeSuperset,
  requiredNotices,
}: {
  registry: Section15Registry;
  resources: LegalResources;
  permanentNoticeSuperset: LegalNotice[];
  requiredNotices: string[];
}) {
  const requirements = resolveRequiredNotices({ registry, requiredNotices });
  const notices = collectPublishedNotices({
    requirements,
    resources,
    permanentNoticeSuperset,
  });
  const outstandingResources: string[] = [];
  return {
    outstandingResources,
    outstandingNotices: listOutstandingNotices(requirements),
    permanentNoticeSuperset: notices,
    title: 'Legal notices',
    introduction:
      'Copyright notices and license terms for content used by Keepnet. Some content remains unavailable while its attribution is reviewed.',
    // `notes` follow a section's notices; only Section 15 carries any (the
    // outstanding resource notes).
    sections: [
      {
        id: 'ogl',
        title: 'Open Game License 1.0a',
        notices: [resources.ogl],
        notes: [],
      },
      {
        id: 'section15',
        title: 'Section 15 — Copyright notices',
        notices,
        notes: outstandingResources,
      },
      {
        id: 'section8',
        title: 'Section 8 — Open Game Content',
        notices: [resources.section8],
        notes: [],
      },
      {
        id: 'paizo',
        title: 'Paizo Community Use',
        notices: [resources.paizo],
        notes: [],
      },
    ],
  };
}

function resolveRequiredNotices({
  registry,
  requiredNotices,
}: {
  registry: Section15Registry;
  requiredNotices: string[];
}): NoticeRequirement[] {
  const index = createNoticeIndex({ registry });
  const codesByNotice = new Map(
    Object.entries(registry).map(([code, notice]) => [notice, code]),
  );
  return [...new Set(requiredNotices)].sort().map((code) => {
    const notice = resolveNotice({ registry, code, index });
    return {
      code,
      canonicalCode: notice ? (codesByNotice.get(notice) ?? code) : code,
      notice,
    };
  });
}

function collectPublishedNotices({
  requirements,
  resources,
  permanentNoticeSuperset,
}: {
  requirements: NoticeRequirement[];
  resources: LegalResources;
  permanentNoticeSuperset: LegalNotice[];
}) {
  const requiredNotices = requirements
    .sort((left, right) =>
      left.canonicalCode.localeCompare(right.canonicalCode),
    )
    .flatMap(({ canonicalCode, notice }) =>
      notice && isPublishableNotice(notice)
        ? [
            {
              id: `registry:${canonicalCode}`,
              title: notice.title,
              text: notice.notice,
              provenance: notice.provenance,
            },
          ]
        : [],
    );
  const candidates = [
    ...permanentNoticeSuperset,
    ...resources.upstreamNotices,
    ...requiredNotices,
    ...(resources.projectNotice ? [resources.projectNotice] : []),
  ];
  const versions = new Set<string>();
  return candidates.filter((notice) => {
    const version = JSON.stringify([notice.id, notice.text]);
    if (versions.has(version)) return false;
    versions.add(version);
    return true;
  });
}

function listOutstandingNotices(requirements: NoticeRequirement[]) {
  return [...requirements]
    .sort((left, right) => left.code.localeCompare(right.code))
    .flatMap<OutstandingNotice>(({ code, notice }) => {
      if (!notice?.notice.trim())
        return [{ code, title: notice?.title ?? code, reason: 'missing' }];
      if (!isPublishableNotice(notice))
        return [{ code, title: notice.title, reason: 'unreviewed' }];
      return [];
    });
}
