import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Waits until no finite CSS animation or transition is running, so a
 * geometry baseline is not captured mid-transition; perpetual decoration
 * must not prevent the check from running.
 */
export async function settleAnimations(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    for (;;) {
      const animations = document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return (
          (animation.playState === 'running' || animation.pending) &&
          timing &&
          Number.isFinite(timing.endTime)
        );
      });
      if (animations.length === 0) return;
      // A responsive update may replace a transition, rejecting finished.
      // Re-read the animation list to also wait for its replacement.
      await Promise.allSettled(
        animations.map((animation) => animation.finished),
      );
    }
  });
}

/** A control's layout facts, as one-call measurement returns them. */
export type ControlGeometry = {
  tag: string;
  ariaLabel: string | null;
  /** The `name` attribute. */
  name: string | null;
  text: string | null;
  isInput: boolean;
  /** An input's first label's text; undefined for other controls. */
  inputLabel: string | null | undefined;
  /** The border box relative to the viewport, null without a box of its own. */
  bounds: { x: number; y: number; width: number; height: number } | null;
  /** The content is no wider than the element's own box. */
  contentFits: boolean;
};

/**
 * Every element `controls` matches, measured in one browser call instead of
 * several protocol calls per control (#774), at this instant: no waiting,
 * and an empty selection gives an empty list. Bounds match `boundingBox()`:
 * the border box relative to the viewport, null for an element with no box,
 * such as `display: none` or `display: contents`. Geometry only:
 * reachability, scrolling and trial clicks stay with `expectReachable`.
 */
export function readControls(controls: Locator): Promise<ControlGeometry[]> {
  return controls.evaluateAll((elements) =>
    elements.map((element) => {
      const isInput = element instanceof HTMLInputElement;
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        ariaLabel: element.getAttribute('aria-label'),
        name: element.getAttribute('name'),
        text: element.textContent,
        isInput,
        inputLabel: isInput ? element.labels?.[0]?.textContent : undefined,
        bounds:
          element.getClientRects().length === 0
            ? null
            : {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
        contentFits: element.scrollWidth <= element.clientWidth,
      };
    }),
  );
}

/**
 * Every visible element `controls` matches, measured in one call
 * (`readControls`). Visibility is Playwright's own (the `visible` filter,
 * as `isVisible()`). The snapshot is taken once finite CSS transitions have
 * settled, so a resize is measured after its responsive update, not
 * mid-transition. A selection with nothing visible fails with `what`, so a
 * broken selector cannot pass by measuring no controls.
 */
export async function measureVisibleControls(
  controls: Locator,
  what: string,
): Promise<ControlGeometry[]> {
  await settleAnimations(controls.page());
  const measured = await readControls(controls.filter({ visible: true }));
  expect(measured.length, `${what}: visible controls measured`).toBeGreaterThan(
    0,
  );
  return measured;
}

/**
 * Every element `controls` matches, hidden ones included, measured once
 * finite CSS transitions have settled: the per-control `boundingBox()` loop
 * in one call. A hidden control with a box (`visibility: hidden`, zero
 * size) keeps it; one without has null bounds. A selection that matches
 * nothing fails with `what`.
 */
export async function measureControlBoxes(
  controls: Locator,
  what: string,
): Promise<ControlGeometry[]> {
  await settleAnimations(controls.page());
  const measured = await readControls(controls);
  expect(measured.length, `${what}: controls measured`).toBeGreaterThan(0);
  return measured;
}

/**
 * Every visible one of `controls` lies within the viewport width, and each
 * button's label fits its own box, from one measurement for all controls.
 * `size` names the viewport in messages.
 */
export async function expectVisibleControlsFit(
  controls: Locator,
  size: string,
  width: number,
) {
  for (const control of await measureVisibleControls(controls, size)) {
    const label =
      control.ariaLabel ??
      (control.isInput ? control.inputLabel : control.text) ??
      'Unlabelled control';
    const description = `${size}: ${control.tag} ${label}`;
    expect(control.bounds, description).not.toBeNull();
    expect(control.bounds!.x, description).toBeGreaterThanOrEqual(0);
    expect(
      control.bounds!.x + control.bounds!.width,
      description,
    ).toBeLessThanOrEqual(width);
    // Text fields intentionally scroll long entered values inside their bounds.
    if (control.tag === 'BUTTON')
      expect(control.contentFits, description).toBe(true);
  }
}
