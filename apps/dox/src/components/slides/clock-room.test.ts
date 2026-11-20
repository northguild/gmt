/**
 * The room a slide keeps clear for the Earth and its clock is there from the first paint. The
 * head script sets `html[data-deck]` before the page draws; the stage sets `data-space` only
 * once it mounts. A room keyed on the stage drew every title and card at full width and then
 * squeezed them on a refresh. A full slide gives the room to its content, so the clock fades with
 * the Earth there: a full-width panel drawn over the dial hid half of it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  path.resolve(import.meta.dirname, "slides.css"),
  "utf8",
);

/** The selector of every rule that sets the slide's end padding to the given value. */
function selectorsSetting(value: string): string[] {
  const rules = css.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  return [...rules]
    .filter(([, , body]) => body!.includes(`padding-inline-end: ${value};`))
    .map(([, selector]) => selector!.replace(/\/\*[\s\S]*?\*\//g, "").trim());
}

describe("the clock's room on a slide", () => {
  it.each(["var(--gmt-deck-clock-room)", "var(--gmt-deck-pad-inline)"])(
    "keys the %s end padding on deck mode, not on the mounted stage",
    (value) => {
      const selectors = selectorsSetting(value);
      expect(selectors.length).toBeGreaterThan(0);
      for (const selector of selectors) {
        expect(selector).toMatch(/^html\[data-deck\] \.gmt-deck \.gmt-slide/);
        expect(selector).not.toContain("data-space");
      }
    },
  );

  it("fades the clock with the Earth on a full slide, which takes the clock's room", () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
      ([, selector, body]) =>
        selector!.includes('data-shown-layout="full"') &&
        body!.includes("opacity: 0;"),
    );
    expect(rules).toHaveLength(1);
    expect(rules[0]![1]).toContain("canvas:not([data-wall-canvas])");
    expect(rules[0]![1]).toContain(".gmt-earth-clock");
  });
});
