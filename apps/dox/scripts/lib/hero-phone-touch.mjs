/**
 * The touch steps of the `hero-phone` gate: the zone sheet opened by a tap, the Earth dragged by a
 * touch pointer, and the zone card on its pin as the Earth turns. Shares `check` and the helpers
 * with `hero-phone-steps.mjs`.
 */
import {
  TARGET,
  cameraRadius,
  check,
  scrolled,
  settle,
  tapCentre,
} from "./hero-phone-steps.mjs";

/**
 * Every control `locator` finds is at least 44 x 44, and it finds at least `min` with a box: a
 * locator that matches nothing would otherwise check nothing and pass.
 */
export async function small(ctx, locator, where, min) {
  const found = [];
  for (const el of await locator.all()) {
    const box = await el.boundingBox();
    if (box) found.push({ el, box });
  }
  check(
    ctx,
    found.length >= min,
    "targets-missing",
    `${found.length} ${where} control(s) measured, at least ${min} expected`,
    where,
  );
  for (const { el, box } of found) {
    const name =
      (await el.getAttribute("aria-label")) ??
      (await el.evaluate((e) => e.textContent.trim().slice(0, 30)));
    check(
      ctx,
      box.width >= TARGET - 0.5 && box.height >= TARGET - 0.5,
      "target-small",
      `${where} control "${name}" is ${box.width.toFixed(0)}x${box.height.toFixed(0)}`,
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
  /* What globe-phone.module.css sizes in the sheet: its buttons, the search field and the
     option rows. */
  const drawer = page.locator("[data-drawer]");
  await small(ctx, drawer.getByRole("button"), "sheet button", 1);
  await small(ctx, drawer.getByRole("combobox"), "sheet field", 1);
  await small(ctx, drawer.getByRole("option"), "sheet option", 3);
  /* The card's band ends at the open sheet's top: a card that shows stays above it. */
  const over = await page.evaluate(() => {
    const c = document.querySelector('[data-gate="globe-tooltip"]');
    const sheet = document.querySelector('[data-drawer] [role="region"]');
    const off =
      !c ||
      c.hidden ||
      getComputedStyle(c).visibility === "hidden" ||
      Number(c.style.opacity || 1) < 1;
    if (off) return null;
    return c.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top;
  });
  if (over !== null)
    check(
      ctx,
      over <= 0.5,
      "card-under-sheet",
      `the zone card runs ${over.toFixed(0)}px under the open sheet's top`,
      "zone card",
    );
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

/** A touch drag on the Earth by `dx`, `dy` CSS px, one step a frame, held still before the lift
    so it does not fling. */
async function drag(page, dx, dy) {
  await page.evaluate(
    async ([dx, dy]) => {
      const el = document.querySelector('[data-gate="globe-hit"]');
      const b = el.getBoundingClientRect();
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const at = (t, buttons = 1) => ({
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
        cancelable: true,
        clientX: b.x + b.width / 2 + dx * t,
        clientY: b.y + b.height / 2 + dy * t,
        buttons,
      });
      el.dispatchEvent(new PointerEvent("pointerdown", at(0)));
      for (let i = 1; i <= 8; i++) {
        el.dispatchEvent(new PointerEvent("pointermove", at(i / 8)));
        await frame();
      }
      for (let i = 0; i < 3; i++) await frame();
      el.dispatchEvent(new PointerEvent("pointerup", at(1, 0)));
    },
    [dx, dy],
  );
}

/** Runs in the page: the zone card's state, and its box and the stage's when it shows. */
const cardNow = () => {
  const c = document.querySelector('[data-gate="globe-tooltip"]');
  if (!c || c.hidden) return { state: "none" };
  if (getComputedStyle(c).visibility === "hidden") return { state: "occluded" };
  /* A pin behind the Earth dims its card and leaves it where it was. */
  if (Number(c.style.opacity || 1) < 1) return { state: "behind" };
  const b = c.getBoundingClientRect();
  const stage = document
    .querySelector('[data-gate="globe-stage"]')
    .getBoundingClientRect();
  return {
    state: "shown",
    l: b.left,
    t: b.top,
    r: b.right,
    b: b.bottom,
    stage,
  };
};

/** Waits until the card stays put for a run of frames: the Earth has stopped turning. */
const cardStill = async (page) => {
  await page.evaluate(() => {
    window.__card = undefined;
  });
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-gate="globe-tooltip"]');
    const key = `${c?.style.left} ${c?.style.top} ${c?.style.opacity}`;
    const s = (window.__card ??= { key: "", n: 0 });
    s.n = key === s.key ? s.n + 1 : 0;
    s.key = key;
    return s.n >= 8;
  });
};

export async function card(ctx, page, width) {
  /* The zone card stays across the screen and inside the Earth's stage, never over the intro and
     the buttons above it, wherever its pin is. The stage may run past the fold (320 x 568, a
     landscape phone), and the card with it, as the zoom row does. The pinned zone is selected at
     load, so the card shows on its pin at the Earth's centre. Small drags then carry the pin
     from the centre toward each edge, about 12 degrees a step, until it leaves sight: near the
     top the card hangs below its pin, at the sides it is clamped. */
  const look = async (where) => {
    await cardStill(page);
    const c = await page.evaluate(cardNow);
    if (c.state !== "shown") return false;
    check(
      ctx,
      c.l >= -0.5 &&
        c.r <= width + 0.5 &&
        c.t >= c.stage.top - 0.5 &&
        c.b <= c.stage.bottom + 0.5,
      "card-off-stage",
      `with its pin ${where}, the zone card spans ${c.l.toFixed(0)},${c.t.toFixed(0)} to ${c.r.toFixed(0)},${c.b.toFixed(0)}; the stage ${c.stage.top.toFixed(0)}..${c.stage.bottom.toFixed(0)} of ${width} wide`,
      "zone card",
    );
    return true;
  };
  check(
    ctx,
    await look("at the centre"),
    "card-missing",
    "the selected zone shows no card at load",
    "zone card",
  );
  const disc = await page.locator('[data-gate="globe-hit"]').boundingBox();
  const step = 0.08 * (disc.width / 2);
  const ways = [
    ["above", 0, -1],
    ["below", 0, 1],
    ["left", -1, 0],
    ["right", 1, 0],
  ];
  for (const [way, x, y] of ways) {
    let steps = 0;
    let seen = 0;
    while (steps < 6) {
      await drag(page, x * step, y * step);
      steps++;
      if (!(await look(`${steps} step(s) ${way} the centre`))) break;
      seen++;
    }
    check(
      ctx,
      seen >= 2,
      "card-unchecked",
      `the card showed on ${seen} of the steps ${way} the centre`,
      "zone card",
    );
    await drag(page, -x * step * steps, -y * step * steps);
  }
  await cardStill(page);
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
  await drag(page, 80, 0);
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
  // In, out, reset and "Find a zone".
  await small(ctx, page.locator('[data-gate="globe-zoom"] button'), "zoom", 4);

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
