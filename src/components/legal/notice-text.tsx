import type { LegalNotice } from '~/lib/catalog/legal-types';
import type { NoticeLink } from '~/lib/legal/site-legal';
import { LinkedText } from './linked-text';

// Notice text is rendered as text with its line breaks kept; nothing is
// trimmed or collapsed. Only a section's named link becomes an anchor, over
// the same characters. Long lines and URLs wrap inside the column.
export function NoticeText({
  notice,
  showTitle,
  link,
}: {
  notice: LegalNotice;
  showTitle: boolean;
  link?: NoticeLink;
}) {
  return (
    <div className="mt-5">
      {showTitle ? <h3 className="text-base">{notice.title}</h3> : null}
      <p className="font-text mt-2 max-w-prose text-base leading-7 wrap-anywhere whitespace-pre-wrap">
        {link ? <LinkedText text={notice.text} link={link} /> : notice.text}
      </p>
    </div>
  );
}
