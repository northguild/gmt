import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatJson } from "../../../../scripts/lib/format-json.mjs";
import {
  VERDICT_FILES,
  couldNotRunVerdict,
  leapSecondsVerdict,
  writeVerdict,
} from "../../../../scripts/lib/canary-verdict.mjs";

/**
 * The JSON `leap-seconds.mjs check` writes for the canary reporter (CORE-81). Inputs are built
 * by hand; expected values come from the verdict schema (source, status, header, row counts,
 * differences). The difference strings are
 * deliberately not leap-second rows: the builder passes them through untouched, and a realistic
 * invented row is how a wrong leap second once entered a spec.
 */
const HEADER = "Updated through IERS Bulletin C 72";

describe("leapSecondsVerdict", () => {
  it("a matching table is status ran with equal row counts and no differences", () => {
    expect(
      leapSecondsVerdict({
        header: HEADER,
        gmtRows: 28,
        iersRows: 28,
        differences: [],
      }),
    ).toEqual({
      source: "leap-seconds",
      status: "ran",
      header: HEADER,
      rows: { gmt: 28, iers: 28 },
      differences: [],
    });
  });

  it("an added IERS row keeps its difference string verbatim", () => {
    const verdict = leapSecondsVerdict({
      header: HEADER,
      gmtRows: 28,
      iersRows: 29,
      differences: ["row 29: fixture difference"],
    });
    expect(verdict.rows).toEqual({ gmt: 28, iers: 29 });
    expect(verdict.differences).toEqual(["row 29: fixture difference"]);
  });

  it("a file with no header line records header null and keeps the problem", () => {
    const problem = 'IERS: no "Updated through" line';
    const verdict = leapSecondsVerdict({
      header: null,
      gmtRows: 28,
      iersRows: 28,
      differences: [problem],
    });
    expect(verdict.header).toBeNull();
    expect(verdict.differences).toEqual([problem]);
  });

  it("keeps several differences in the order given", () => {
    const verdict = leapSecondsVerdict({
      header: HEADER,
      gmtRows: 28,
      iersRows: 28,
      differences: ["b problem", "a problem", "c problem"],
    });
    expect(verdict.differences).toEqual([
      "b problem",
      "a problem",
      "c problem",
    ]);
  });

  it("does not share the caller's differences array", () => {
    const differences = ["x"];
    const verdict = leapSecondsVerdict({
      header: HEADER,
      gmtRows: 1,
      iersRows: 1,
      differences,
    });
    differences.push("y");
    expect(verdict.differences).toEqual(["x"]);
  });
});

describe("the leap-seconds verdict file", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "leap-verdict-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("is named artifacts/leap-seconds.json", () => {
    expect(VERDICT_FILES["leap-seconds"]).toBe("artifacts/leap-seconds.json");
  });

  it("writes a ran verdict in formatJson layout, creating the folder", () => {
    const verdict = leapSecondsVerdict({
      header: HEADER,
      gmtRows: 28,
      iersRows: 29,
      differences: ["row 29: fixture difference"],
    });
    writeVerdict(root, verdict);
    expect(
      readFileSync(join(root, "artifacts/leap-seconds.json"), "utf8"),
    ).toBe(formatJson(verdict));
  });

  it("writes a could-not-run verdict with its message kept", () => {
    const message = "cannot run: HTTP 503 from https://example.invalid/file";
    writeVerdict(root, couldNotRunVerdict("leap-seconds", message));
    expect(
      JSON.parse(
        readFileSync(join(root, "artifacts/leap-seconds.json"), "utf8"),
      ),
    ).toEqual({ source: "leap-seconds", status: "could-not-run", message });
  });
});
