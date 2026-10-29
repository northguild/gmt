import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FINDING_FIELDS,
  recordFinding,
  recordLabelled,
  recordMeasured,
} from "./findings.mjs";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "gate-report-"));
  file = path.join(dir, "report.ndjson");
});
afterEach(() => {
  delete process.env.GATE_REPORT;
  rmSync(dir, { recursive: true, force: true });
});

const lines = () =>
  readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

describe("recordFinding and recordMeasured", () => {
  it("do nothing without GATE_REPORT", () => {
    delete process.env.GATE_REPORT;
    recordFinding({ gate: "g", rule: "r", target: "page" });
    recordMeasured("g", 3);
    expect(existsSync(file)).toBe(false);
  });

  it("append one NDJSON line per call, every finding with all nine fields", () => {
    process.env.GATE_REPORT = file;
    recordFinding({
      gate: "readout-still",
      rule: "readout-moved",
      page: "/tools/dwell-ledger/",
      target: 'widget:dwell-ledger › status "Total"',
      selector: ".gmt-dwell-total",
      browser: "chromium",
      width: 390,
      message: "moved 4px",
    });
    recordFinding({
      gate: "readout-still",
      rule: "control-missing",
      target: "page",
    });
    recordMeasured("readout-still", 24);
    const [first, second, measured] = lines();
    expect(Object.keys(first)).toEqual(["kind", ...FINDING_FIELDS]);
    expect(first).toEqual({
      kind: "finding",
      gate: "readout-still",
      rule: "readout-moved",
      page: "/tools/dwell-ledger/",
      target: 'widget:dwell-ledger › status "Total"',
      selector: ".gmt-dwell-total",
      browser: "chromium",
      width: 390,
      theme: null,
      message: "moved 4px",
    });
    expect(Object.keys(second)).toEqual(Object.keys(first));
    expect(second.page).toBeNull();
    expect(measured).toEqual({
      kind: "measured",
      gate: "readout-still",
      n: 24,
    });
  });

  it("throws on a finding with no target", () => {
    process.env.GATE_REPORT = file;
    expect(() => recordFinding({ gate: "g", rule: "r" })).toThrow(/no target/);
    expect(() => recordFinding({ gate: "g", rule: "r", target: "" })).toThrow(
      /no target/,
    );
    expect(() => recordFinding({ gate: "g", rule: "r", target: null })).toThrow(
      /no target/,
    );
    expect(existsSync(file)).toBe(false);
  });

  it("writes target right after page", () => {
    expect(FINDING_FIELDS.slice(0, 4)).toEqual([
      "gate",
      "rule",
      "page",
      "target",
    ]);
  });

  it("reads the cell out of a '<browser> <width>px <theme>: text' message", () => {
    process.env.GATE_REPORT = file;
    recordLabelled({
      gate: "canada-layout-check",
      page: "/check/canada-2026-clock-change/",
      target: 'widget:canada-clock-change › table "Stored"',
      message: "webkit 300px dark: the page scrolls sideways",
    });
    recordLabelled({
      gate: "canada-clock-still",
      page: "/p/",
      message: "no cell here",
    });
    const [a, b] = lines();
    expect(a).toMatchObject({
      target: 'widget:canada-clock-change › table "Stored"',
      rule: "sideways-scroll",
      browser: "webkit",
      width: 300,
      theme: "dark",
      message: "the page scrolls sideways",
    });
    expect(b).toMatchObject({
      rule: "check-failed",
      target: "page",
      browser: null,
      width: null,
      message: "no cell here",
    });
  });
});
