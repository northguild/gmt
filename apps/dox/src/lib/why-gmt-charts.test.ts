/// <reference types="vitest/globals" />

import { createChartRuntime, renderChartSvg } from "@tanstack/charts";
import { describe, expect, it } from "vitest";
import {
  coreNamespaces,
  formatCount,
  gmtStats,
  industryNamespaces,
} from "../data/gmt-stats";
import { libraryComparisons } from "../data/library-comparison";
import {
  BAR_CHARTS,
  CORE_FUNCTION_TOTAL,
  INDUSTRY_COUNTS,
  INDUSTRY_FUNCTION_TOTAL,
  NAMESPACE_COUNTS,
  ciExecutionRows,
  ciExecutionTooltip,
  ciSuiteRows,
  industryTooltip,
  isBarChartId,
  namespaceTooltip,
  type BarChartId,
} from "../lib/why-gmt-charts";

function renderStatic(id: BarChartId): string {
  const chart = BAR_CHARTS[id];
  const runtime = createChartRuntime();
  const scene = runtime.render(chart.definition(), {
    width: chart.width,
    height: chart.height,
  });
  const svg = renderChartSvg(scene, {
    ariaLabel: chart.ariaLabel,
    idPrefix: chart.idPrefix,
  });
  runtime.destroy();
  return svg;
}

function barRects(svg: string) {
  const attr = (rect: string, name: string) =>
    rect.match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? "";
  return [...svg.matchAll(/<rect[^>]*fill="url\(#gmt-bar-[^"]*"[^>]*\/>/g)].map(
    ([rect]) => ({
      gradient: attr(rect, "fill").slice("url(#".length, -1),
      x: Number(attr(rect, "x")),
      width: Number(attr(rect, "width")),
    }),
  );
}

function rowsOf(library: string) {
  return ciExecutionRows().filter((row) => row.comparison.id === library);
}

function tooltipOf(library: string) {
  return ciExecutionTooltip(rowsOf(library)[0]);
}

// ---------------------------------------------------------------------------
// ciExecutionRows
// ---------------------------------------------------------------------------

describe("ciExecutionRows", () => {
  it("gives every library one bar equal to its total CI executions", () => {
    expect(ciExecutionRows().map((r) => [r.comparison.id, r.value])).toEqual(
      libraryComparisons.map((c) => [c.id, c.stats.executions]),
    );
  });

  it("gives GMT's bar its executions, not its one-run test count", () => {
    expect(rowsOf("@northguild/gmt").map((r) => r.value)).toEqual([
      gmtStats.executions,
    ]);
  });

  it("labels bars with the short chart label", () => {
    expect(rowsOf("@internationalized/date")[0]?.library).toBe("@intl/date");
  });
});

// ---------------------------------------------------------------------------
// ciSuiteRows
// ---------------------------------------------------------------------------

describe("ciSuiteRows", () => {
  it("gives every library one bar equal to a single run of its tests", () => {
    expect(ciSuiteRows().map((r) => [r.comparison.id, r.value])).toEqual(
      libraryComparisons.map((c) => [c.id, c.stats.tests]),
    );
  });

  it("keeps GMT's one-run bar to its test count, not its CI executions", () => {
    const gmt = ciSuiteRows().find((r) => r.comparison.isSubject);
    expect(gmt?.value).toBe(gmtStats.tests);
    expect(gmt?.value).toBeLessThan(gmtStats.executions);
  });
});

// ---------------------------------------------------------------------------
// ciExecutionTooltip
// ---------------------------------------------------------------------------

describe("ciExecutionTooltip", () => {
  it("breaks GMT's executions into suite, re-runs and matrix", () => {
    expect(tooltipOf("@northguild/gmt")).toEqual({
      title: "@northguild/gmt",
      color: "var(--gmt-spring)",
      rows: [
        { label: "Suite tests", value: formatCount(gmtStats.tests) },
        {
          label: "Matrix re-runs",
          value: formatCount(gmtStats.executions - gmtStats.tests),
        },
        {
          label: "Matrix",
          value: `${gmtStats.timezones} timezones × ${gmtStats.nodes.length} Node versions`,
        },
        { label: "CI executions", value: formatCount(gmtStats.executions) },
      ],
    });
  });

  it("shows Day.js's timezone re-runs", () => {
    expect(tooltipOf("dayjs").rows).toContainEqual({
      label: "Matrix re-runs",
      value: "240",
    });
  });

  it("reports Spacetime's known failures", () => {
    expect(tooltipOf("spacetime").rows.at(-1)).toEqual({
      label: "Known failures",
      value: "41",
    });
  });

  it("shows Luxon's Node-matrix re-runs", () => {
    expect(tooltipOf("luxon").rows).toEqual([
      { label: "Suite tests", value: "1,222" },
      { label: "Matrix re-runs", value: "3,666" },
      { label: "Matrix", value: "4 Node versions" },
      { label: "CI executions", value: "4,888" },
    ]);
  });

  it("omits the matrix rows for a single-run library", () => {
    expect(tooltipOf("date-fns")).toEqual({
      title: "date-fns",
      color: "var(--gmt-signal)",
      rows: [
        { label: "Suite tests", value: "3,213" },
        { label: "CI executions", value: "3,213" },
      ],
    });
  });

  it("returns no rows without a point", () => {
    expect(ciExecutionTooltip(undefined)).toEqual({ rows: [] });
  });
});

// ---------------------------------------------------------------------------
// namespaceTooltip
// ---------------------------------------------------------------------------

describe("namespaceTooltip", () => {
  it("totals the core namespaces' functions, leaving regex patterns out", () => {
    const functions = NAMESPACE_COUNTS.filter((r) => r.namespace !== "regex");
    expect(functions.reduce((sum, r) => sum + r.count, 0)).toBe(
      CORE_FUNCTION_TOTAL,
    );
  });

  it("shows a namespace's function count and share of the core", () => {
    const plain = NAMESPACE_COUNTS.find((r) => r.namespace === "plain");
    const [count, share] = namespaceTooltip(plain).rows;
    expect(count).toEqual({
      label: "Public functions",
      value: formatCount(plain?.count ?? 0),
    });
    expect(share?.label).toBe("Share of core");
    expect(share?.value).toMatch(/^\d{1,3}(\.\d)?%$/);
  });

  it("counts regex as patterns with no share of the function total", () => {
    const regex = NAMESPACE_COUNTS.find((r) => r.namespace === "regex");
    expect(namespaceTooltip(regex).rows).toEqual([
      { label: "Exported patterns", value: formatCount(gmtStats.patterns) },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Core and industry split
// ---------------------------------------------------------------------------

describe("namespace and industry charts", () => {
  it("charts every namespace exactly once between them", () => {
    const charted = [...NAMESPACE_COUNTS, ...INDUSTRY_COUNTS]
      .map((r) => r.namespace)
      .filter((namespace) => namespace !== "regex");
    expect(charted.sort()).toEqual(
      gmtStats.byNamespace.map((r) => r.namespace).sort(),
    );
  });

  it("keeps the industry layers out of the core chart", () => {
    const core = NAMESPACE_COUNTS.map((r) => r.namespace);
    for (const { namespace } of INDUSTRY_COUNTS) {
      expect(core).not.toContain(namespace);
    }
  });

  it("splits the public function total between core and industry", () => {
    expect(CORE_FUNCTION_TOTAL + INDUSTRY_FUNCTION_TOTAL).toBe(
      gmtStats.functions,
    );
  });
});

describe("industryTooltip", () => {
  it("shows a layer's function count and share of the industry layers", () => {
    const [layer] = INDUSTRY_COUNTS;
    expect(industryTooltip(layer)).toEqual({
      title: layer?.namespace,
      color: "var(--gmt-spring)",
      rows: [
        { label: "Public functions", value: formatCount(layer?.count ?? 0) },
        {
          label: "Share of industry layers",
          value: expect.stringMatching(/^\d{1,3}(\.\d)?%$/),
        },
      ],
    });
  });

  it("returns no rows without a point", () => {
    expect(industryTooltip(undefined)).toEqual({ rows: [] });
  });
});

// ---------------------------------------------------------------------------
// Static render
// ---------------------------------------------------------------------------

describe("static bar chart render", () => {
  it.each(["ci-suite", "ci-executions"] as const)(
    "draws %s as one unsplit bar per library, GMT in spring and the rest in signal",
    (id) => {
      const rects = barRects(renderStatic(id));
      expect(rects).toHaveLength(libraryComparisons.length);
      expect(rects.filter((r) => r.gradient === "gmt-bar-spring")).toHaveLength(
        1,
      );
      expect(rects.filter((r) => r.gradient === "gmt-bar-signal")).toHaveLength(
        libraryComparisons.length - 1,
      );
    },
  );

  it.each([
    ["namespaces", "gmt-bar-cyan", coreNamespaces.length + 1],
    ["industries", "gmt-bar-spring", industryNamespaces.length],
  ] as const)("draws %s as one %s bar per row", (id, gradient, bars) => {
    const rects = barRects(renderStatic(id));
    expect(rects).toHaveLength(bars);
    expect(rects.every((r) => r.gradient === gradient)).toBe(true);
  });

  it("only references gradients its container declares", () => {
    for (const id of Object.keys(BAR_CHARTS) as BarChartId[]) {
      const declared = BAR_CHARTS[id].gradients.map((g) => g.id);
      for (const rect of barRects(renderStatic(id))) {
        expect(declared).toContain(rect.gradient);
      }
    }
  });
});

describe("namespace chart labels", () => {
  // /why-gmt lays the chart out in a grid column about 524px wide, where the axis thinned the
  // labels of precision, interval and calendar away. Every bar must keep its namespace label.
  it.each([
    ["namespaces", NAMESPACE_COUNTS],
    ["industries", INDUSTRY_COUNTS],
  ] as const)(
    "keeps every %s label at the page's real chart width",
    (id, rows) => {
      const chart = BAR_CHARTS[id];
      const width = 524;
      const runtime = createChartRuntime();
      const scene = runtime.render(chart.definition(), {
        width,
        height: Math.round((width * chart.height) / chart.width),
      });
      const svg = renderChartSvg(scene, {
        ariaLabel: chart.ariaLabel,
        idPrefix: chart.idPrefix,
      });
      runtime.destroy();

      const labels = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(
        ([, text]) => text,
      );
      for (const { namespace } of rows) {
        expect(labels).toContain(namespace);
      }
    },
  );
});

describe("isBarChartId", () => {
  it("accepts registered charts and rejects everything else", () => {
    expect(isBarChartId("namespaces")).toBe(true);
    expect(isBarChartId("industries")).toBe(true);
    expect(isBarChartId("ci-suite")).toBe(true);
    expect(isBarChartId("locale-matrix")).toBe(false);
    expect(isBarChartId(undefined)).toBe(false);
  });
});
