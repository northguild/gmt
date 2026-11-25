/**
 * The touch steps of the `hero-phone` gate: the zone sheet opened by a tap, and the Earth dragged
 * by a touch pointer. Shares `check` and the helpers with `hero-phone-steps.mjs`.
 */
import {
  TARGET,
  cameraRadius,
  check,
  scrolled,
  settle,
  tapCentre,
} from "./hero-phone-steps.mjs";

/** Every control is at least 44 x 44. */
export async function small(ctx, locator, where) {
  for (const b of await locator.all()) {
    const box = await b.boundingBox();
    if (box)
      check(
        ctx,
        box.width >= TARGET - 0.5 && box.height >= TARGET - 0.5,
        "target-small",
        `${where} control "${await b.getAttribute("aria-label")}" is ${box.width.toFixed(0)}x${box.height.toFixed(0)}`,
        where,
      );
  }
}

export async function sheet(ctx, page) {
  // The zone sheet.
  const wide = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  check(
    ctx,
    await wide(),
    "scrolls-sideways",
    "the page scrolls sideways",
    "page",
  );
  /* On a phone a tap on the Earth picks a zone but leaves the sheet shut: only "Find a zone"
     opens it. */
  await tapCentre(page, page.locator('[data-gate="globe-hit"]'));
  await settle(page);
  check(
    ctx,
    !(await page.getByRole("combobox").first().isVisible()),
    "sheet-on-tap",
    "a tap on the Earth opened the zone sheet",
    "sheet",
  );
  const find = page.getByRole("button", { name: "Find a zone" });
  const fold = await find.evaluate(
    (b) => b.getBoundingClientRect().bottom - innerHeight,
  );
  if (fold > 0) await page.evaluate((by) => scrollBy(0, by), fold + 8);
  await scrolled(page);
  const y0 = await page.evaluate(() => scrollY);
  await tapCentre(page, find);
  const field = page.getByRole("combobox").first();
  await field.waitFor({ state: "visible" });
  await settle(page);
  const open = await page.evaluate(() => {
    const f = document.activeElement.getBoundingClientRect();
    const v = window.visualViewport;
    return {
      y: scrollY,
      inside:
        f.top >= v.offsetTop - 0.5 && f.bottom <= v.offsetTop + v.height + 0.5,
      focus: document.activeElement.getAttribute("role"),
    };
  });
  check(
    ctx,
    open.y === y0,
    "sheet-scrolled",
    `opening the sheet moved scrollY ${y0} -> ${open.y}`,
    "sheet",
  );
  check(
    ctx,
    open.inside,
    "field-off-screen",
    "the search field is outside the visual viewport",
    "sheet",
  );
  await small(ctx, page.locator("[data-drawer]").getByRole("button"), "sheet");
  check(
    ctx,
    await wide(),
    "scrolls-sideways",
    "the page scrolls sideways with the sheet open",
    "sheet",
  );
  await page.keyboard.press("Escape");
  await field.waitFor({ state: "hidden" });
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label"),
  );
  check(
    ctx,
    focused === "Find a zone",
    "focus-lost",
    `closing the sheet left focus on "${focused}"`,
    "sheet",
  );

  await page.evaluate(() => scrollTo(0, 0));
  await scrolled(page);
}

export async function stillness(ctx, page) {
  // Stillness under a touch drag.
  const hit = page.locator('[data-gate="globe-hit"]');
  const before = await hit.boundingBox();
  const view = () =>
    page.evaluate(
      () => document.querySelector("[data-sky-canvas='stars']").dataset.skyView,
    );
  const viewBefore = await view();
  await page.evaluate(async () => {
    const el = document.querySelector('[data-gate="globe-hit"]');
    const b = el.getBoundingClientRect();
    const at = (dx) => ({
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      clientX: b.x + b.width / 2 + dx,
      clientY: b.y + b.height / 2,
      buttons: 1,
    });
    el.dispatchEvent(new PointerEvent("pointerdown", at(0)));
    for (let dx = 10; dx <= 80; dx += 10) {
      el.dispatchEvent(new PointerEvent("pointermove", at(dx)));
      await new Promise((r) => requestAnimationFrame(r));
    }
    el.dispatchEvent(new PointerEvent("pointerup", { ...at(80), buttons: 0 }));
  });
  await page
    .waitForFunction(
      (v) =>
        document.querySelector("[data-sky-canvas='stars']").dataset.skyView !==
        v,
      viewBefore,
      { timeout: 5000 },
    )
    .catch(() => {});
  const after = await hit.boundingBox();
  check(
    ctx,
    (await view()) !== viewBefore,
    "drag-inert",
    "the touch drag did not turn the Earth",
    "globe hit",
  );
  const moved = Math.max(
    ...["x", "y", "width", "height"].map((k) => Math.abs(after[k] - before[k])),
  );
  check(
    ctx,
    moved <= 0.5,
    "disc-moved",
    `the disc's box moved ${moved.toFixed(2)}px under a drag`,
    "globe disc",
  );
}

export async function dots(ctx, page) {
  // Targets: the zoom stack.
  const zoom = page
    .getByRole("group", { name: "Globe controls" })
    .getByRole("button");
  await small(ctx, zoom, "zoom stack");

  // Dot scale and layout shift.
  const radius = await page.evaluate(cameraRadius);
  check(
    ctx,
    radius < ctx.lockedRadius,
    "dots-not-smaller",
    `camera radius ${radius} is not below the 1440x900 one (${ctx.lockedRadius})`,
    "sky",
  );
  const shift = await page.evaluate(() => {
    window.__po?.disconnect();
    return window.__po ? window.__shift : null;
  });
  if (shift !== null)
    check(
      ctx,
      shift < 0.0005,
      "layout-shift",
      `layout shift ${shift.toFixed(4)}`,
      "page",
    );
}
