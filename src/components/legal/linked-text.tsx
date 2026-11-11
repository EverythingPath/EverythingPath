import type { NoticeLink } from '~/lib/legal/site-legal';

// The notice text with the first occurrence of the link's text as an anchor;
// the text is unchanged when the link's text does not occur.
export function LinkedText({ text, link }: { text: string; link: NoticeLink }) {
  const at = text.indexOf(link.text);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <a
        href={link.href}
        className="hover:text-primary focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-[3px]"
      >
        {link.text}
      </a>
      {text.slice(at + link.text.length)}
    </>
  );
}
