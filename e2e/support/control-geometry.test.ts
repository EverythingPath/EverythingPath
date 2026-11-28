// @vitest-environment node
import {
  chromium,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  expectVisibleControlsFit,
  measureControlBoxes,
  measureVisibleControls,
} from './control-geometry';
import { expectNoHorizontalOverflow } from './responsive-shell';

// The journeys measured each control with its own protocol calls before
// #774: Playwright's isVisible, boundingBox, getAttribute, textContent and
// evaluate. That loop is the oracle the one-call measurement must match on
// real Chromium layouts.
async function perControl(controls: Locator, visibleOnly = true) {
  const measured = [];
  for (const control of await controls.all()) {
    if (visibleOnly && !(await control.isVisible())) continue;
    measured.push({
      tag: await control.evaluate((element) => element.tagName),
      ariaLabel: await control.getAttribute('aria-label'),
      name: await control.getAttribute('name'),
      text: await control.textContent(),
      isInput: await control.evaluate(
        (element) => element instanceof HTMLInputElement,
      ),
      inputLabel: await control.evaluate((element) =>
        element instanceof HTMLInputElement
          ? element.labels?.[0]?.textContent
          : undefined,
      ),
      bounds: await control.boundingBox(),
      contentFits: await control.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    });
  }
  return measured;
}

const layout = `
<style>
  body { margin: 0; font: 16px/1.25 sans-serif; height: 1200px; }
  button, input { font: inherit; box-sizing: border-box; }
  .at { position: absolute; }
</style>
<main>
  <button class="at" style="left:10px;top:10px;width:80px;height:30px" aria-label="Plain" data-case="plain">Plain</button>
  <button style="display:none">Display none</button>
  <button style="visibility:hidden" name="hidden-by-visibility">Visibility hidden</button>
  <button style="width:0;height:0;padding:0;border:0"></button>
  <details><summary>More</summary><button>Inside closed details</button></details>
  <div class="at" style="left:0;top:60px;width:50px;height:20px;overflow:hidden">
    <button style="width:120px;white-space:nowrap">Clipped by its parent</button>
  </div>
  <button class="at" style="left:360.5px;top:100px;width:80px" data-case="right">Right edge</button>
  <button class="at" style="left:-20px;top:140px;width:60px" data-case="left">Left edge</button>
  <button class="at" style="left:10px;top:180px;width:60px;white-space:nowrap;overflow:hidden" data-case="long">A label far too long</button>
  <button class="at" style="left:100px;top:180px;width:60px;white-space:normal" data-case="wraps">A label that wraps</button>
  <label class="at" style="left:10px;top:250px">Field <input id="scrolled" name="field" style="width:60px" data-case="scrolled" value="a very long value that scrolls inside the field"></label>
  <input class="at" style="left:200px;top:250px;width:40px">
  <button class="at" style="left:200px;top:10px;width:40px;height:20px;transform:translate(5px,7px) scale(1.5)">T</button>
  <button style="display:contents" data-case="contents"><span>Contents child</span></button>
  <button class="at" style="left:10px;top:900px;width:90px">Below the fold</button>
</main>`;

describe('measureVisibleControls on real Chromium', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  async function show(html: string) {
    await page.setContent(html);
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('#scrolled');
      if (input) input.scrollLeft = 200;
    });
  }

  const controls = () => page.locator('main button, main input');

  it('measures what the per-control loop measured, at the top of the page', async () => {
    await show(layout);
    const measured = await measureVisibleControls(controls(), 'top');
    expect(measured).toEqual(await perControl(controls()));
    // Hidden, zero-size and closed-details controls are left out; one
    // clipped by its parent's overflow, past either edge or below the fold
    // is visible and keeps its full box.
    expect(
      measured.map((control) => control.ariaLabel ?? control.text),
    ).toEqual([
      'Plain',
      'Clipped by its parent',
      'Right edge',
      'Left edge',
      'A label far too long',
      'A label that wraps',
      '',
      '',
      'T',
      'Contents child',
      'Below the fold',
    ]);
    const byText = (text: string) =>
      measured.find((control) => control.text === text)!;
    expect(byText('Right edge').bounds).toEqual({
      x: 360.5,
      y: 100,
      width: 80,
      height: expect.any(Number),
    });
    expect(byText('Left edge').bounds!.x).toBe(-20);
    expect(byText('Clipped by its parent').bounds!.width).toBe(120);
    expect(byText('Below the fold').bounds!.y).toBe(900);
    // Scaled about its centre: 40×20 becomes 60×30, shifted by the translate.
    expect(byText('T').bounds).toEqual({
      x: 195,
      y: 12,
      width: 60,
      height: 30,
    });
    // display: contents is visible through its text but has no box of its own.
    expect(byText('Contents child').bounds).toBeNull();
    expect(byText('A label far too long').contentFits).toBe(false);
    expect(byText('A label that wraps').contentFits).toBe(true);
    const [scrolled, unlabelled] = measured.filter(
      (control) => control.isInput,
    );
    expect(scrolled!.inputLabel).toBe('Field ');
    expect(scrolled!.name).toBe('field');
    expect(scrolled!.contentFits).toBe(false);
    expect(unlabelled!.inputLabel).toBeUndefined();
  });

  it('keeps bounds relative to the viewport once the document has scrolled', async () => {
    await show(layout);
    await page.evaluate(() => window.scrollTo(0, 700));
    const measured = await measureVisibleControls(controls(), 'scrolled');
    expect(measured).toEqual(await perControl(controls()));
    expect(
      measured.find((control) => control.text === 'Below the fold')!.bounds!.y,
    ).toBe(200);
  });

  it('refuses a selection with nothing visible instead of passing on no controls', async () => {
    await show(layout);
    await expect(
      measureVisibleControls(
        page.locator('main [aria-label="Missing"]'),
        'phone',
      ),
    ).rejects.toThrow('phone: visible controls measured');
    await expect(
      measureVisibleControls(
        page.locator('main button').filter({ hasText: 'Display none' }),
        'phone',
      ),
    ).rejects.toThrow('phone: visible controls measured');
  });

  it('measures a resized layout after its transition has settled, not mid-way', async () => {
    await page.setViewportSize({ width: 800, height: 300 });
    await page.setContent(`
      <style>
        body { margin: 0; }
        button { position: absolute; top: 10px; left: 500px; width: 80px; transition: left 600ms linear; }
        @media (max-width: 500px) { button { left: 10px; } }
      </style>
      <main><button>Moves on resize</button></main>`);
    await page.setViewportSize({ width: 400, height: 300 });
    const [moved] = await measureVisibleControls(controls(), 'phone');
    expect(moved!.bounds!.x).toBe(10);
  });
});

describe('measureControlBoxes on real Chromium', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  const controls = () => page.locator('main button, main input');

  // Setup's loop: every control with a box, hidden or not, as
  // `boundingBox()` gives it, null without one.
  it('measures every matched control as boundingBox() does, hidden ones included', async () => {
    await page.setContent(layout);
    const measured = await measureControlBoxes(controls(), 'setup');
    expect(measured).toEqual(await perControl(controls(), false));
    const boxed = measured.filter((control) => control.bounds !== null);
    // visibility: hidden, zero-size and closed-details controls keep their
    // boxes (Chromium lays out a closed details' content, hidden); display:
    // none and display: contents have none.
    expect(boxed.map((control) => control.name ?? control.text)).toEqual([
      'Plain',
      'hidden-by-visibility',
      '',
      'Inside closed details',
      'Clipped by its parent',
      'Right edge',
      'Left edge',
      'A label far too long',
      'A label that wraps',
      'field',
      '',
      'T',
      'Below the fold',
    ]);
    expect(
      measured
        .filter((control) => control.bounds === null)
        .map((control) => control.text),
    ).toEqual(['Display none', 'Contents child']);
  });

  it('refuses a selection that matches nothing', async () => {
    await page.setContent(layout);
    await expect(
      measureControlBoxes(page.locator('main select'), 'phone'),
    ).rejects.toThrow('phone: controls measured');
  });
});

describe('expectVisibleControlsFit on real Chromium', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    await page.setContent(layout);
    await page.evaluate(() => {
      document.querySelector<HTMLInputElement>('#scrolled')!.scrollLeft = 200;
    });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  const only = (...cases: string[]) =>
    page.locator(cases.map((name) => `main [data-case="${name}"]`).join(', '));

  it('passes controls inside the width whose button labels fit, scrolled inputs included', async () => {
    await expectVisibleControlsFit(
      only('plain', 'wraps', 'scrolled'),
      'tablet',
      400,
    );
  });

  it('names the viewport, tag and label of a control past the right edge', async () => {
    await expect(
      expectVisibleControlsFit(only('right'), 'phone', 400),
    ).rejects.toThrow('phone: BUTTON Right edge');
  });

  it('names a control past the left edge', async () => {
    await expect(
      expectVisibleControlsFit(only('left'), 'phone', 400),
    ).rejects.toThrow('phone: BUTTON Left edge');
  });

  it('names a button whose label overflows its own box', async () => {
    await expect(
      expectVisibleControlsFit(only('long'), 'phone', 400),
    ).rejects.toThrow('phone: BUTTON A label far too long');
  });

  it('refuses a visible control with no box of its own', async () => {
    await expect(
      expectVisibleControlsFit(only('contents'), 'phone', 400),
    ).rejects.toThrow('phone: BUTTON Contents child');
  });

  it('names an input by its label', async () => {
    await expect(
      expectVisibleControlsFit(only('scrolled'), 'phone', 50),
    ).rejects.toThrow('phone: INPUT Field');
  });
});

// The top bar's controls, checked by their boxes in one browser call. They
// sit in a box that clips its own overflow, so only their boxes show it.
describe('expectNoHorizontalOverflow top bar on real Chromium', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  const header = (controls: string) => `
    <style>
      body { margin: 0; font: 16px sans-serif; }
      .clip { position: relative; height: 40px; overflow: hidden; }
      .clip > * { position: absolute; top: 4px; }
    </style>
    <header><div class="clip">${controls}</div></header>
    <main><p>Page</p></main>`;

  it('passes top bar controls within a pixel of either edge, hidden ones and the Pages strip ignored', async () => {
    await page.setContent(
      header(`
        <a href="#" style="left:-1px;width:60px">Home</a>
        <button style="left:200px;width:201px">Account</button>
        <div role="combobox" style="left:100px;width:80px">Where you are</div>
        <button style="left:390px;width:80px;visibility:hidden">Hidden</button>
        <button style="left:390px;width:80px;display:none">Gone</button>
        <nav aria-label="Pages" style="left:0;width:400px;overflow-x:auto;white-space:nowrap">
          <a href="#" aria-current="page">Week</a>
          <a href="#" style="margin-left:600px">Far along the strip</a>
        </nav>`),
    );
    await expectNoHorizontalOverflow(page);
  });

  it('passes a page without a top bar', async () => {
    await page.setContent('<main><button>Only</button></main>');
    await expectNoHorizontalOverflow(page);
  });

  it('fails a top bar control past the right edge', async () => {
    await page.setContent(
      header('<button style="left:330px;width:80px">Account</button>'),
    );
    await expect(expectNoHorizontalOverflow(page)).rejects.toThrow(
      'top bar content fits the viewport',
    );
  });

  it('fails a top bar control that starts before the left edge', async () => {
    await page.setContent(
      header('<a href="#" style="left:-3px;width:40px">Home</a>'),
    );
    await expect(expectNoHorizontalOverflow(page)).rejects.toThrow(
      'top bar content starts inside the viewport',
    );
  });
});
