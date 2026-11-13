import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

export function extractCatalogDescriptionText({ html }: { html: string }) {
  function readNode(node: DefaultTreeAdapterMap['childNode']): string {
    if (node.nodeName === '#text' && 'value' in node) return node.value;
    if (!('tagName' in node)) return '';
    const text = node.childNodes.map(readNode).join('');
    return /^(?:p|br|hr|li|h[1-6]|tr|blockquote)$/.test(node.tagName)
      ? `${text}\n`
      : text;
  }
  return parseFragment(html)
    .childNodes.map(readNode)
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
