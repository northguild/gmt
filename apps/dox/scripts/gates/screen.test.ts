import { describe, expect, it } from "vitest";
import { findingLine, formatDuration, formatGatesScreen } from "./screen.mjs";

describe("formatDuration", () => {
  it("writes seconds under a minute and minutes with two-digit seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(38_400)).toBe("38s");
    expect(formatDuration(62_000)).toBe("1m02s");
    expect(formatDuration(252_000)).toBe("4m12s");
  });
});

const finding = (over = {}) => ({
  rule: "readout-moved",
  page: "/tools/dwell-ledger/",
  selector: ".gmt-dwell-total",
  browser: "chromium",
  width: 390,
  message: "moved 4px",
  ...over,
});

const summary = {
  status: "FAIL" as const,
  headline: "1 of 8 failed",
  context:
    "against origin/main @ 0a59823, 4 pages, chromium,webkit, dark,light",
  durationMs: 252_000,
  logsDir: "/abs/path/apps/dox/.gates/",
  summaryPath: ".gates/summary.json",
  rows: [
    { id: "build", status: "PASS", detail: "", durationMs: 108_000 },
    {
      id: "contrast-measure",
      status: "PASS",
      detail: "4 pages · chromium · dark,light",
      durationMs: 38_000,
    },
    {
      id: "grow-measure",
      status: "PASS",
      detail: "3 pages · chromium,webkit",
      durationMs: 51_000,
    },
    {
      id: "readout-still",
      status: "FAIL",
      detail: "1 page · chromium,webkit",
      durationMs: 52_000,
      findings: [finding()],
      moreIn: ".gates/readout-still.log",
    },
    {
      id: "canada-clock-still",
      status: "FLAKY",
      detail: "failed once, passed on retry",
      durationMs: 62_000,
    },
    {
      id: "globe-smoke",
      status: "SKIP",
      detail: "not selected (no globe page changed)",
    },
    {
      id: "visual-diff",
      status: "SKIP",
      detail: "needs --baseline (built.md Runbooks: gate baseline)",
    },
  ],
};

describe("formatGatesScreen", () => {
  // Pinned line for line. The columns are the runner's own: status padded to 5, id to 20, detail
  // to 34, so the durations line up (the spec's hand-written sample does not quite).
  it("prints the screen line for line", () => {
    expect(formatGatesScreen(summary).split("\n")).toEqual([
      "gates: FAIL  1 of 8 failed  (against origin/main @ 0a59823, 4 pages, chromium,webkit, dark,light)  4m12s",
      "  PASS   build                                                     1m48s",
      "  PASS   contrast-measure      4 pages · chromium · dark,light     38s",
      "  PASS   grow-measure          3 pages · chromium,webkit           51s",
      "  FAIL   readout-still         1 page · chromium,webkit            52s",
      "         readout-moved  /tools/dwell-ledger/  chromium 390  .gmt-dwell-total moved 4px",
      "  FLAKY  canada-clock-still    failed once, passed on retry        1m02s",
      "  SKIP   globe-smoke           not selected (no globe page changed)",
      "  SKIP   visual-diff           needs --baseline (built.md Runbooks: gate baseline)",
      "logs: /abs/path/apps/dox/.gates/   summary: .gates/summary.json",
    ]);
  });

  it("shows five findings, then how many more are in the log", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      finding({ message: `moved ${i}px`, selector: null }),
    );
    const lines = formatGatesScreen({
      ...summary,
      rows: [{ ...summary.rows[3], findings: many }],
    }).split("\n");
    expect(
      lines.filter((l) => l.startsWith("         readout-moved")),
    ).toHaveLength(5);
    expect(lines).toContain("         3 more in .gates/readout-still.log");
  });

  it("shows the last ten log lines for a FAIL that wrote no finding", () => {
    const logTail = Array.from({ length: 14 }, (_, i) => `line ${i + 1}`);
    const lines = formatGatesScreen({
      ...summary,
      rows: [{ ...summary.rows[3], findings: [], logTail }],
    }).split("\n");
    expect(lines.filter((l) => l.startsWith("         line "))).toHaveLength(
      10,
    );
    expect(lines).toContain("         line 14");
    expect(lines).not.toContain("         line 4");
  });
});

describe("findingLine", () => {
  it("joins rule, page, cell and message, adding the selector only when the message lacks it", () => {
    expect(findingLine(finding())).toBe(
      "readout-moved  /tools/dwell-ledger/  chromium 390  .gmt-dwell-total moved 4px",
    );
    expect(findingLine(finding({ selector: ".x", message: ".x moved" }))).toBe(
      "readout-moved  /tools/dwell-ledger/  chromium 390  .x moved",
    );
    expect(findingLine({ rule: "r", message: "m" })).toBe("r  m");
  });
});
