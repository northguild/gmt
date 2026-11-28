/**
 * The hero's control stack folds to its info button at rest (src/lib/globe-stack.ts). A gate opens
 * it as a reader does before it presses a control of it: a touch page taps the info button, any
 * other page moves the mouse over it.
 */

const STACK = '[data-gate="globe-zoom"]';

/** Opens the folded stack of the page's hero globe and waits until its controls have grown in. */
export async function openStack(page) {
  const stack = page.locator(STACK).first();
  const info = stack.locator(":scope > [popovertarget]");
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) {
    if (!(await stack.evaluate((el) => el.hasAttribute("data-open"))))
      await info.tap();
  } else await info.hover();
  /* Open, every shown control has its full size once the grow ends. */
  await page.waitForFunction(
    (sel) =>
      [...document.querySelector(sel).children]
        .filter((c) => !c.matches("[popover], [hidden]") && c.checkVisibility())
        .every((c) => {
          const r = c.getBoundingClientRect();
          return (
            r.width >= 16 &&
            r.height >= 16 &&
            getComputedStyle(c).opacity === "1"
          );
        }),
    STACK,
  );
}

/** Opens the stack, then clicks (or, on a touch page, taps) one of its controls. */
export async function stackPress(page, locator) {
  await openStack(page);
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  await (touch ? locator.tap() : locator.click());
}
