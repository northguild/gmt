import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(import.meta.dirname, "../widgets/tools/globe.module.css"),
  "utf8",
);
const probe = readFileSync(
  join(import.meta.dirname, "globe/canvas2d/text-parity.ts"),
  "utf8",
);

const painter = readFileSync(
  join(import.meta.dirname, "globe/canvas2d/painter.ts"),
  "utf8",
);

/** The body of the `& > canvas` block that follows a layer selector. */
function canvasRule(layer: string): string {
  const at = css.indexOf(`\n${layer} {`);
  if (at < 0) throw new Error(`no ${layer} rule`);
  const from = css.indexOf("& > canvas {", at);
  return css.slice(from, css.indexOf("\n  }", from));
}

describe("globe canvas font smoothing", () => {
  it.each([".stage", ".globeLayer"])(
    "uses auto smoothing on the %s canvas, so the worker and the page draw labels alike",
    (layer) => {
      const body = canvasRule(layer);
      expect(body).toContain("-webkit-font-smoothing: auto");
      expect(body).toContain("-moz-osx-font-smoothing: auto");
    },
  );

  it("gives the parity probe's canvas the same smoothing", () => {
    expect(probe).toContain("-webkit-font-smoothing:auto");
    expect(probe).toContain("-moz-osx-font-smoothing:auto");
  });
});

describe("canvas 2D painter edges", () => {
  it("never clips: a page canvas and an OffscreenCanvas anti-alias a clip edge differently", () => {
    expect(painter).not.toMatch(/\.clip\(/);
  });
});
