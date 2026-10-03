import { describe, expect, it } from "vitest";
import { extractReference, gateInput } from "./build-reference";
import { findGaps, formatGapReport } from "./build-utils/doc-gate";

// The gate against the real gmt source: every public type, member and option is described,
// and every optional input property states its default. A failure prints the gap list.
describe("reference documentation", () => {
  it("has no gaps in packages/gmt/src", () => {
    const gaps = findGaps(gateInput(extractReference()));
    expect(formatGapReport(gaps)).toBe("0 gaps");
  }, 120_000);
});
