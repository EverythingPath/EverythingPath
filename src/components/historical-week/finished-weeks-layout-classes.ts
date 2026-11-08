// Layout, as on the campaign home. One DOM order serves every width: index
// heading, index rows (with any "Earlier weeks" control in place), the pane,
// the closing lines. The `<nav>` and `<ol>` are `display: contents`, so the
// heading, every row and the pane are items of one grid on `<main>`.
//   Phone: a single column. `order` puts the pane right after the selected
//   row (rows up to it are 1, the pane 2, the rest 3), so the selected week
//   is the only expanded one; with no selected row the pane follows the
//   heading.
//   Tablet (20rem index) and desktop (26rem, page centred): the index items
//   take column 1, one row each, and the pane sits in column 2 spanning
//   every row plus a final `1fr` row that absorbs its extra height, so the
//   index rows keep their natural height. `--index-rows` counts the column-1
//   items for that template. The pane is mounted exactly once either way.

/** A column-1 grid item on tablet and desktop. */
export const indexItemClass = 'md:col-start-1';
export const rowClass =
  'block min-h-11 border-l-4 border-transparent px-4 py-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset';
/** The selected index row and the selected audit entry. */
export const currentRowClass = 'border-primary bg-primary/10';
export const phoneDividerClass = 'max-md:border-b max-md:border-foreground/15';
export const paneSlotClass =
  'md:border-foreground/15 order-2 min-w-0 p-4 md:order-none md:col-start-2 md:[grid-row:1/-1] md:border-l md:p-6';
export const focusRingClass =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
export const monoBadgeClass = 'font-mono font-normal';
/** Marks what is shown but isn't the effective record. */
export const amberBadgeClass = `${monoBadgeClass} border-amber-300/60 text-amber-300`;
/** Placeholder rows while the index loads. */
export const skeletonRowCount = 4;
