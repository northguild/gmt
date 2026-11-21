import { describe, expect, it } from "vitest";
import {
  assertRecord,
  experimentViews,
  libraryTotals,
  probeFootnote,
  zoneProbe,
  type ProbeRecord,
} from "./zone-probe";

const clone = (): ProbeRecord => structuredClone(zoneProbe);

describe("the zone probe record", () => {
  it("passes its own assert and keeps GMT at zero in every experiment", () => {
    expect(() => assertRecord(clone())).not.toThrow();
    for (const view of experimentViews()) {
      expect(view.rows.at(-1)).toMatchObject({ id: "gmt", wrong: 0 });
    }
  });

  it("has three or four experiments with a question and what was fed in", () => {
    const views = experimentViews();
    expect(views.length).toBeGreaterThanOrEqual(3);
    expect(views.length).toBeLessThanOrEqual(4);
    for (const view of views) {
      expect(view.question.endsWith("?")).toBe(true);
      expect(view.fed.length).toBeGreaterThan(0);
      expect(view.cases).toBeGreaterThan(0);
    }
  });

  it("sorts the worst library first and pins GMT last", () => {
    for (const view of experimentViews()) {
      const peers = view.rows.slice(0, -1).map((r) => r.wrong);
      expect(peers).toEqual([...peers].sort((a, b) => b - a));
      expect(view.example?.name).toBe(view.rows[0]?.name);
    }
  });

  it("names the versions and the run date in the footnote", () => {
    const note = probeFootnote();
    expect(note).toContain(zoneProbe.runDate);
    for (const l of zoneProbe.libraries) expect(note).toContain(l.version);
  });
});

describe("assertRecord", () => {
  it("throws when GMT is wrong", () => {
    const record = clone();
    const row = record.experiments[0]!.perLibrary.find(
      (r) => r.library === "gmt",
    )!;
    row.wrong = 1;
    row.wrongEverywhere = 1;
    row.example = { input: "a", answer: "b", expected: "c", zones: "every" };
    expect(() => assertRecord(record)).toThrow(/GMT was wrong/);
  });

  it("throws when the counts do not add up", () => {
    const record = clone();
    const row = record.experiments[0]!.perLibrary.find((r) => r.wrong > 0)!;
    row.wrongEverywhere += 1;
    expect(() => assertRecord(record)).toThrow(/do not add up/);
  });

  it("throws when a library ran fewer cases than the experiment holds", () => {
    const record = clone();
    record.experiments[1]!.perLibrary[0]!.total -= 1;
    expect(() => assertRecord(record)).toThrow(/cases/);
  });

  it("throws when an example is missing for a wrong count", () => {
    const record = clone();
    const row = record.experiments[0]!.perLibrary.find((r) => r.wrong > 0)!;
    row.example = null;
    expect(() => assertRecord(record)).toThrow(/example/);
  });

  it("throws on a dropped case and on a missing library result", () => {
    const dropped = clone();
    dropped.dropped = 2;
    expect(() => assertRecord(dropped)).toThrow(/dropped/);
    const missing = clone();
    missing.experiments[0]!.perLibrary.pop();
    expect(() => assertRecord(missing)).toThrow(/no result/);
  });
});

describe("the library totals", () => {
  it("add every experiment's wrong count and cases, and keep GMT at zero", () => {
    const totals = libraryTotals();
    const cases = zoneProbe.experiments.reduce((sum, e) => sum + e.cases, 0);
    expect(totals.map((t) => t.id)).toEqual(
      zoneProbe.libraries.map((l) => l.id),
    );
    for (const t of totals) {
      expect(t.total).toBe(cases);
      const byExperiment = experimentViews().map(
        (v) => v.rows.find((r) => r.id === t.id)!.wrong,
      );
      expect(t.wrong).toBe(byExperiment.reduce((a, b) => a + b, 0));
    }
    expect(totals.find((t) => t.id === "gmt")?.wrong).toBe(0);
  });
});
