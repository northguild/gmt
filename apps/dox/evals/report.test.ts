import {
  baselineBlocker,
  diffReports,
  mergeReport,
  serialiseReport,
  type CaseReport,
  type LiveReport,
} from "./report";

const entry = (
  status: CaseReport["status"],
  neurons: number | null = 100,
  checks = {},
): CaseReport => ({
  status,
  checks,
  neurons,
  firstTokenMs: 1000,
  totalMs: 3000,
});

const committed: LiveReport = {
  brain: "b",
  model: "m",
  generatedAt: "2026-11-18T10:00:00Z",
  neurons: { spent: 300, budget: 2500 },
  cases: {
    a: entry("pass", 100, { tool: true, links: true }),
    b: entry("pass", 200, { tool: true }),
    c: entry("fail", 0, { tool: false }),
  },
};

describe("diffReports", () => {
  it("flags a case that passed and now fails, and names the checks that changed", () => {
    const diffs = diffReports(committed, {
      a: entry("fail", 120, { tool: true, links: false }),
      b: entry("pass", 210, { tool: true }),
    });
    expect(diffs.map((d) => [d.id, d.regression])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(diffs[0]!.changedChecks).toEqual(["links: true -> false"]);
    expect(diffs[1]!.changedChecks).toEqual([]);
    expect(diffs[0]!.neurons).toEqual({ before: 100, after: 120 });
  });

  it("is not a regression when a failing case still fails, or a case is new or ungraded", () => {
    const diffs = diffReports(committed, {
      c: entry("fail", 0, { tool: false }),
      d: entry("fail"),
      a: entry("ungraded", null, {}),
    });
    expect(diffs.some((d) => d.regression)).toBe(false);
    expect(diffs.find((d) => d.id === "d")!.before).toBe("none");
  });

  it("compares only the cases the run holds", () => {
    expect(
      diffReports(committed, { b: entry("pass", 200, { tool: true }) }),
    ).toHaveLength(1);
    expect(diffReports(undefined, { z: entry("pass") })[0]!.before).toBe(
      "none",
    );
  });
});

describe("mergeReport", () => {
  const base = {
    brain: "b",
    model: "m",
    generatedAt: "2026-11-19T00:00:00Z",
    budget: 2500,
  };

  it("replaces only a partial run's cases and adds its Neurons to spent", () => {
    const merged = mergeReport(committed, {
      ...base,
      cases: { b: entry("fail", 150) },
      partial: true,
    });
    expect(merged.cases.a).toEqual(committed.cases.a);
    expect(merged.cases.b!.status).toBe("fail");
    expect(merged.neurons.spent).toBe(committed.neurons.spent + 150);
  });

  it("replaces everything on a full run and sorts the keys", () => {
    const merged = mergeReport(committed, {
      ...base,
      cases: { z: entry("pass", 50), y: entry("pass", 60) },
      partial: false,
    });
    expect(Object.keys(merged.cases)).toEqual(["y", "z"]);
    expect(merged.neurons.spent).toBe(110);
    const text = serialiseReport({
      ...merged,
      cases: { b: entry("pass", 1, { tool: true, brain: true }) },
    });
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.indexOf('"brain": true')).toBeLessThan(
      text.indexOf('"tool": true'),
    );
  });
});

describe("baselineBlocker", () => {
  it("lets only a run where every case passed become the report", () => {
    expect(
      baselineBlocker({ a: entry("pass"), b: entry("pass") }),
    ).toBeUndefined();
  });

  it("refuses a run with a failing case and names it", () => {
    expect(
      baselineBlocker({ a: entry("pass"), d: entry("fail"), c: entry("fail") }),
    ).toBe("failed: c, d");
  });

  it("refuses a run with an ungraded case and names it", () => {
    expect(baselineBlocker({ a: entry("pass"), b: entry("ungraded") })).toBe(
      "ungraded: b",
    );
  });
});
