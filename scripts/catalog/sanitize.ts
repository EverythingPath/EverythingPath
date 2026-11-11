import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['childNode'];
const allowed = new Set([
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sup',
  'sub',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'blockquote',
  'code',
  'pre',
]);
const discard = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'img',
  'video',
  'audio',
]);
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function sanitizeDescription({
  html,
  link,
  isTextReference = () => false,
}: {
  html: string;
  link: (uuid: string) => { key: string; name: string } | undefined;
  /** A labelled link to a non-catalog reference, kept as its label (#738). */
  isTextReference?: (uuid: string) => boolean;
}): string {
  function renderText(value: string): string {
    return value
      .split(/(@(?:UUID|Compendium)\[[^\]]+\](?:\{[^}]*\})?)/g)
      .map((part) => {
        const match = /^@(UUID|Compendium)\[([^\]]+)\](?:\{([^}]*)\})?$/.exec(
          part,
        );
        if (!match) return escapeHtml(part);
        const uuid =
          match[1] === 'Compendium'
            ? `Compendium.${match[2]}`
            : (match[2] ?? '');
        if (match[3] !== undefined && isTextReference(uuid))
          return escapeHtml(match[3]);
        const resolved = link(uuid);
        const label = escapeHtml(
          match[3] ?? resolved?.name ?? 'Reference unavailable',
        );
        return resolved
          ? `<a href="catalog:${escapeHtml(resolved.key)}">${label}</a>`
          : label;
      })
      .join('');
  }
  function render(node: Node): string {
    if (node.nodeName === '#text' && 'value' in node)
      return renderText(node.value);
    if (!('tagName' in node) || discard.has(node.tagName)) return '';
    const body = node.childNodes.map(render).join('');
    if (node.tagName === 'a') {
      const href = node.attrs.find((attr) => attr.name === 'href')?.value;
      if (href) {
        try {
          const url = new URL(href);
          if (['http:', 'https:'].includes(url.protocol))
            return `<a href="${escapeHtml(url.href)}">${body}</a>`;
        } catch {
          /* Relative and malformed upstream links lose their target. */
        }
      }
      return body;
    }
    if (!allowed.has(node.tagName)) return body;
    return `<${node.tagName}>${body}${['br', 'hr'].includes(node.tagName) ? '' : `</${node.tagName}>`}`;
  }
  return parseFragment(html).childNodes.map(render).join('');
}
