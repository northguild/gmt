/**
 * What the slide-deck gate reads off a deck page: the settled stage, its box, the slides as the DOM
 * lists them, and the elements of the shown slide that leave the stage. Shared by every check family
 * in `families.mjs`.
 */
import { frames } from "../page-frames.mjs";

export const STAGE = "[data-deck-stage]";

/** The gate's `at(rule, message, target)`: one finding for the page, size and engine under test. */
export const findingAt =
  ({ report, browserName, size, pagePath }) =>
  (rule, message, target = "page") =>
    report(browserName, size.width, pagePath, rule, target, message);

/** Waits out the slide fade, so a read sees the settled stage. */
export const settle = async (page) => {
  await frames(page);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState !== "running" ||
          a.effect?.getTiming().iterations === Infinity,
      ),
  );
};

export const stageBox = (page) =>
  page.locator(STAGE).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

/** The slides as the DOM lists them: id, title, build count. */
export const readSlides = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-slide]")].map((s) => ({
      id: s.id,
      title: s.querySelector("h2")?.textContent?.trim() ?? "",
      // As the deck counts them: builds that share a number reveal together, one step.
      builds: Math.max(
        0,
        ...[...s.querySelectorAll("[data-build]")].map(
          (b) => Number(b.getAttribute("data-build")) || 1,
        ),
      ),
      place: s.dataset.place ?? "",
      spare: s.hasAttribute("data-spare"),
    })),
  );

/**
 * The boxes of the shown slide's visible elements that fall outside the stage. What sits in a box
 * that scrolls (a chat's answer, a tool's panel) is reached by scrolling it, so the box stands for
 * it: the box itself is checked.
 */
export const escapees = (page, stage) =>
  page.evaluate((outer) => {
    const out = [];
    const shown = document.querySelector("[data-slide][data-shown]");
    if (!shown) return ["no slide is shown"];
    const scrolls = (el) => {
      for (let a = el.parentElement; a && a !== shown; a = a.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(a);
        if ([overflowX, overflowY].some((o) => o === "auto" || o === "scroll"))
          return true;
      }
      return false;
    };
    for (const el of shown.querySelectorAll("*")) {
      if (el.closest("[data-notes]") || scrolls(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const tol = 1;
      if (
        r.x < outer.x - tol ||
        r.y < outer.y - tol ||
        r.right > outer.x + outer.width + tol ||
        r.bottom > outer.y + outer.height + tol
      )
        out.push(
          `<${el.localName}> "${(el.textContent ?? "").trim().slice(0, 30)}" at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
    }
    return out;
  }, stage);
