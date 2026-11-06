import { BAR_CHARTS, isBarChartId, type BarChartId } from "./bar-charts";
import { BUNDLE_SIZE_CHARTS } from "./bundle-size-charts";
import { WHY_GMT_CHARTS } from "./why-gmt-charts";

describe("the joined bar-chart registry", () => {
  it("holds every /why-gmt chart and every /bundle-size chart, each once", () => {
    const ids = Object.keys(BAR_CHARTS).sort();
    expect(ids).toEqual(
      [
        ...Object.keys(WHY_GMT_CHARTS),
        ...Object.keys(BUNDLE_SIZE_CHARTS),
      ].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every chart its own SVG id prefix", () => {
    const prefixes = Object.values(BAR_CHARTS).map((chart) => chart.idPrefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("accepts each registered id and rejects everything else", () => {
    for (const id of Object.keys(BAR_CHARTS))
      expect(isBarChartId(id)).toBe(true);
    expect(isBarChartId("locale-matrix")).toBe(false);
    expect(isBarChartId(undefined)).toBe(false);
  });

  it("types an id as one of the registry's keys", () => {
    const id: BarChartId = "industries";
    expect(BAR_CHARTS[id].patterns.length).toBeGreaterThan(0);
  });
});

describe("what the registry pulls into a browser", () => {
  it("never reaches the reference corpus or the page's server-side table module", async () => {
    const path = await import("node:path");
    const { importsOf, resolveLocal, SRC } =
      await import("~/test/import-graph");
    const seen = new Set<string>();
    const queue = [path.join(SRC, "lib/bar-charts.ts")];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const { specifier } of importsOf(file)) {
        const resolved = resolveLocal(file, specifier);
        if (resolved) queue.push(resolved);
      }
    }
    const reached = [...seen].map((file) => path.relative(SRC, file));
    expect(
      reached.filter((file) => /gmt-corpus|lib\/bundle-size\.ts$/.test(file)),
    ).toEqual([]);
  });
});
