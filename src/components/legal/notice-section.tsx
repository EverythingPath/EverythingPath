import type { LegalNotice } from '~/lib/catalog/legal-types';
import type { LegalSection } from './legal-page-types';
import { NoticeText } from './notice-text';
import { SectionFrame } from './section-frame';

export function NoticeSection({ section }: { section: LegalSection }) {
  return (
    <SectionFrame id={section.id} title={section.title}>
      {section.notices.length === 0 ? (
        <p className="text-muted-foreground font-text mt-4 text-base">
          No copyright notices are available.
        </p>
      ) : (
        keyedNotices(section.notices).map(({ key, notice }) => (
          <NoticeText
            key={key}
            notice={notice}
            showTitle={notice.title !== section.title}
            link={section.link}
          />
        ))
      )}
      {section.notes.map((note) => (
        <p
          key={note}
          className="text-muted-foreground font-text mt-4 max-w-prose text-base leading-7"
        >
          {note}
        </p>
      ))}
    </SectionFrame>
  );
}

// The same notice identity can appear in more than one historic version, so
// the key is the identity plus its position among that identity's versions.
function keyedNotices(notices: LegalNotice[]) {
  const versions = new Map<string, number>();
  return notices.map((notice) => {
    const version = (versions.get(notice.id) ?? 0) + 1;
    versions.set(notice.id, version);
    return { key: `${notice.id}:${version}`, notice };
  });
}
