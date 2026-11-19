/**
 * The plate-text check `plate-fit.mjs` runs: no text in a readout plate reaches past the plate's
 * inner right edge.
 *
 * `measurePlates` runs in the page and returns what it found at the viewport the page has now.
 * A plate is any element with a class that ends in `plate` or `Plate` (`gmt-plates__plate`,
 * `gmt-signal-plates__plate`, a tool's own `__plate` or `__outPlate`); the row classes that end in
 * `plates` are not plates. The edge is the plate's padding edge (inside its border), and a text
 * node counts when any line of it reaches more than `TOLERANCE` px past that edge.
 *
 * Two kinds of text are measured, and each has its own rule:
 *
 * - `plate-text-overflows`: text a reader can see. A text node is skipped when it is not drawn:
 *   `display: none`, `visibility: hidden`, `aria-hidden`, or a box of 2 px or less that clips
 *   (`.gmt-sr-only`), on it or on an ancestor inside the plate.
 * - `plate-sample-overflows`: the hidden samples a plate reserves its room with (the element has a
 *   class that contains `ghost`). A sample is the widest reading the plate can show, so one that
 *   passes the edge means the reading it stands for would pass it too, even when the reading on
 *   the page now is short. Samples are hidden and `aria-hidden` by design, so only this rule
 *   reads them.
 *
 * It is a plain function with no closure, so Playwright can serialise it:
 * `page.evaluate(measurePlates)`.
 */
export const TOLERANCE = 1.5;

export function measurePlates() {
  const TOL = 1.5;
  const isPlate = (el) => [...el.classList].some((c) => /[pP]late$/.test(c));
  const isSample = (el) =>
    [...el.classList].some((c) => c.toLowerCase().includes("ghost"));
  /** A box of 2 px or less in either dimension that clips what it holds: nothing in it is drawn. */
  const clipsAway = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return false;
    const cs = getComputedStyle(el);
    return (
      cs.overflowX !== "visible" ||
      cs.overflowY !== "visible" ||
      (cs.clipPath !== "none" && cs.clipPath !== "") ||
      (cs.clip !== "auto" && cs.clip !== "")
    );
  };
  const found = [];
  for (const plate of document.querySelectorAll("main *")) {
    if (!isPlate(plate)) continue;
    const box = plate.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const edge = box.left + plate.clientLeft + plate.clientWidth;
    const walker = document.createTreeWalker(plate, NodeFilter.SHOW_TEXT);
    let worst = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (!text) continue;
      let sample = false;
      let drawn = true;
      let hiddenByAria = false;
      for (let el = node.parentElement; el; el = el.parentElement) {
        if (isSample(el)) sample = true;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || clipsAway(el)) drawn = false;
        if (cs.visibility === "hidden") hiddenByAria = true;
        if (el.getAttribute("aria-hidden") === "true") hiddenByAria = true;
        if (el === plate) break;
      }
      // A sample is hidden on purpose; the other hidden text is not drawn and not measured.
      if (sample ? !drawn : !drawn || hiddenByAria) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      let right = -Infinity;
      for (const r of range.getClientRects()) {
        if (r.width > 0) right = Math.max(right, r.right);
      }
      const past = right - edge;
      if (past > TOL && (worst === null || past > worst.past)) {
        worst = { past, text: text.slice(0, 60), sample };
      }
    }
    if (worst !== null) {
      const heading = plate.querySelector(
        "dt, [class*=caption], [class*=Caption]",
      );
      found.push({
        plate: (heading?.firstElementChild ?? heading ?? plate).textContent
          .trim()
          .slice(0, 40),
        plateWidth: Math.round(plate.clientWidth),
        past: Math.round(worst.past * 10) / 10,
        text: worst.text,
        sample: worst.sample,
        plateClass: [...plate.classList].find((c) => /[pP]late$/.test(c)),
      });
    }
  }
  return {
    plates: [...document.querySelectorAll("main *")]
      .filter(isPlate)
      .filter((el) => el.getBoundingClientRect().width > 0).length,
    found,
  };
}
