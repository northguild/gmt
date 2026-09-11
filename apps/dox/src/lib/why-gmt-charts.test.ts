/// <reference types="vitest/globals" />

import { createChartRuntime, renderChartSvg } from "@tanstack/charts";
import { describe, expect, it } from "vitest";
import { formatCount, gmtStats } from "../data/gmt-stats";
import { libraryComparisons } from "../data/library-comparison";
import {
  BAR_CHARTS,
  NAMESPACE_COUNTS,
  PUBLIC_FUNCTION_TOTAL,
  ciExecutionRows,
  ciExecutionTooltip,
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
  it("splits every library's executions into suite plus matrix exactly", () => {
    for (const comparison of libraryComparisons) {
      const total = rowsOf(comparison.id).reduce((sum, r) => sum + r.value, 0);
      expect(total).toBe(comparison.stats.executions);
    }
  });

  it("gives GMT a suite segment and a matrix segment", () => {
    expect(rowsOf("@northguild/gmt").map((r) => [r.segment, r.value])).toEqual([
      ["suite", gmtStats.tests],
      ["matrix", gmtStats.executions - gmtStats.tests],
    ]);
  });

  it("drops the matrix segment when CI runs the suite once", () => {
    expect(rowsOf("date-fns").map((r) => r.segment)).toEqual(["suite"]);
  });

  it("labels bars with the short chart label", () => {
    expect(rowsOf("@internationalized/date")[0]?.library).toBe("@intl/date");
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
  it("totals the namespaces' functions, leaving regex patterns out", () => {
    const functions = NAMESPACE_COUNTS.filter((r) => r.namespace !== "regex");
    expect(functions.reduce((sum, r) => sum + r.count, 0)).toBe(
      PUBLIC_FUNCTION_TOTAL,
    );
  });

  it("shows a namespace's function count and share of the API", () => {
    const plain = NAMESPACE_COUNTS.find((r) => r.namespace === "plain");
    const [count, share] = namespaceTooltip(plain).rows;
    expect(count).toEqual({
      label: "Public functions",
      value: formatCount(plain?.count ?? 0),
    });
    expect(share?.label).toBe("Share of API");
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
// Static render
// ---------------------------------------------------------------------------

describe("static bar chart render", () => {
  it("stacks GMT's matrix re-runs directly after its suite", () => {
    const rects = barRects(renderStatic("ci-executions"));
    expect(rects).toHaveLength(ciExecutionRows().length);

    const suite = rects.find((r) => r.gradient === "gmt-bar-spring-suite");
    const matrix = rects.find((r) => r.gradient === "gmt-bar-spring-matrix");
    expect(suite).toBeDefined();
    expect(matrix?.x).toBeCloseTo((suite?.x ?? 0) + (suite?.width ?? 0), 1);
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

describe("isBarChartId", () => {
  it("accepts registered charts and rejects everything else", () => {
    expect(isBarChartId("namespaces")).toBe(true);
    expect(isBarChartId("locale-matrix")).toBe(false);
    expect(isBarChartId(undefined)).toBe(false);
  });
});
