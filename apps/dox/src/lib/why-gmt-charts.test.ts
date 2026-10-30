// @vitest-environment jsdom
import { within } from "@testing-library/dom";
import { createChartRuntime, renderChartSvg } from "@tanstack/charts";
import {
  coreNamespaces,
  formatCount,
  gmtStats,
  type IndustryLayerCount,
} from "../data/gmt-stats";
import { raw } from "~/widgets/builders/html";
import { renderHtml } from "~/widgets/test-fixture";
import { libraryComparisons } from "../data/library-comparison";
import {
  BAR_CHARTS,
  CORE_FUNCTION_TOTAL,
  INDUSTRY_FUNCTION_TOTAL,
  NAMESPACE_COUNTS,
  OWN_SERIES,
  barGradientId,
  barHatchId,
  ciExecutionRows,
  ciExecutionTooltip,
  ciSuiteRows,
  industryLegend,
  industrySegments,
  industrySummary,
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

/** The rects of a static render with their stacking position, for the stacked chart. */
function renderStaticRects(id: BarChartId) {
  const attr = (rect: string, name: string) =>
    rect.match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? "";
  return [
    ...renderStatic(id).matchAll(
      /<rect[^>]*fill="url\(#gmt-bar-[^"]*"[^>]*\/>/g,
    ),
  ].map(([rect]) => ({
    key: attr(rect, "data-ts-key"),
    gradient: attr(rect, "fill").slice("url(#".length, -1),
    x: Number(attr(rect, "x")),
    y: Number(attr(rect, "y")),
  }));
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
      color: expect.any(String),
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
      { label: "Suite tests", value: formatCount(1222) },
      { label: "Matrix re-runs", value: formatCount(3666) },
      { label: "Matrix", value: "4 Node versions" },
      { label: "CI executions", value: formatCount(4888) },
    ]);
  });

  it("omits the matrix rows for a single-run library", () => {
    expect(tooltipOf("date-fns")).toEqual({
      title: "date-fns",
      color: expect.any(String),
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
    expect(share?.value).toMatch(/^\d{1,3}(?:[.,]\d)?\s?%$/);
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
  it("splits the public function total between core and industry", () => {
    expect(CORE_FUNCTION_TOTAL + INDUSTRY_FUNCTION_TOTAL).toBe(
      gmtStats.functions,
    );
  });
});

/**
 * Four industries as the declarations can make them: one that owns a namespace and draws on
 * nothing, one that draws on another industry's, one that draws on a sub-module of a Core
 * namespace, and one that owns none. None is a figure of the library's: the tests that follow
 * state what each fixture says.
 */
const FIXTURE: readonly IndustryLayerCount[] = [
  { id: "workforce", label: "Workforce", own: 8, drawsOn: [] },
  {
    id: "transport",
    label: "Transport",
    own: 15,
    drawsOn: [{ module: "workforce", count: 8, shared: true }],
  },
  {
    id: "gnss",
    label: "GNSS",
    own: 6,
    drawsOn: [{ module: "timescale/convert", count: 2, shared: false }],
  },
  {
    id: "maritime",
    label: "Maritime",
    own: 0,
    drawsOn: [
      { module: "gnss", count: 6, shared: true },
      { module: "timescale", count: 6, shared: false },
    ],
  },
];

describe("industryTooltip", () => {
  it("shows an industry's own functions and its share of the distinct functions of the industry layers", () => {
    const [layer] = gmtStats.industryLayers;
    expect(industryTooltip(layer)).toEqual({
      title: layer?.label,
      color: expect.any(String),
      rows: [
        { label: "Own functions", value: formatCount(layer?.own ?? 0) },
        {
          label: "Share of industry layers",
          value: shareOf(layer?.own ?? 0),
        },
        ...(layer?.drawsOn ?? []).map((drawn) => ({
          label: expect.stringMatching(/^draws on \S+ \(.+\)$/),
          value: formatCount(drawn.count),
        })),
      ],
    });
  });

  it("names a shared industry layer by its industry and a Core module as Core, one row for each", () => {
    expect(industryTooltip(FIXTURE[1], FIXTURE).rows).toEqual([
      { label: "Own functions", value: "15" },
      { label: "Share of industry layers", value: shareOf(15) },
      { label: "draws on workforce (Workforce industry layer)", value: "8" },
    ]);
    expect(industryTooltip(FIXTURE[2], FIXTURE).rows.at(-1)).toEqual({
      label: "draws on timescale/convert (Core)",
      value: "2",
    });
  });

  it("gives an industry that owns no namespace only the rows of what it draws on, and no share", () => {
    expect(industryTooltip(FIXTURE[3], FIXTURE)).toEqual({
      title: "Maritime",
      color: expect.any(String),
      rows: [
        { label: "draws on gnss (GNSS industry layer)", value: "6" },
        { label: "draws on timescale (Core)", value: "6" },
      ],
    });
  });

  it("states the share for the own functions only, never for what is drawn on", () => {
    for (const layer of FIXTURE) {
      const shares = industryTooltip(layer, FIXTURE).rows.filter((row) =>
        row.label.startsWith("Share"),
      );
      expect(shares).toHaveLength(layer.own > 0 ? 1 : 0);
    }
  });

  it("returns no rows without a point", () => {
    expect(industryTooltip(undefined)).toEqual({ rows: [] });
  });
});

/** The share the tooltip states, from the distinct total of all own namespaces. */
function shareOf(own: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(own / INDUSTRY_FUNCTION_TOTAL);
}

describe("industrySegments", () => {
  it("draws each industry's own functions solid, then one shaded segment for each module it draws on", () => {
    expect(
      industrySegments(FIXTURE).map((s) => [
        s.industry,
        s.series,
        s.count,
        s.shaded,
      ]),
    ).toEqual([
      ["Workforce", OWN_SERIES, 8, false],
      ["Transport", OWN_SERIES, 15, false],
      ["Transport", "workforce", 8, true],
      ["GNSS", OWN_SERIES, 6, false],
      ["GNSS", "timescale/convert", 2, true],
      ["Maritime", "gnss", 6, true],
      ["Maritime", "timescale", 6, true],
    ]);
  });

  it("gives an industry that owns no namespace no solid segment", () => {
    const maritime = industrySegments(FIXTURE).filter(
      (s) => s.industry === "Maritime",
    );
    expect(maritime.every((s) => s.shaded)).toBe(true);
  });

  it("leaves out a segment with no function", () => {
    const empty: IndustryLayerCount[] = [
      {
        id: "x",
        label: "X",
        own: 0,
        drawsOn: [{ module: "timescale", count: 0, shared: false }],
      },
    ];
    expect(industrySegments(empty)).toEqual([]);
  });

  it("counts no function twice in the total the caption and the share use", () => {
    // Intermodal's `transport` segment is Transport's own count, drawn again above its own bar:
    // a drawn-on segment is never added into a total.
    const layers = gmtStats.industryLayers;
    const own = layers.reduce((sum, layer) => sum + layer.own, 0);
    expect(INDUSTRY_FUNCTION_TOTAL).toBe(own);
    const drawn = industrySegments().filter((s) => s.shaded);
    expect(drawn.length).toBeGreaterThan(0);
    expect(
      industrySegments().reduce((sum, s) => sum + s.count, 0),
    ).toBeGreaterThan(INDUSTRY_FUNCTION_TOTAL);
  });

  it("counts a whole shared layer as the functions of its own namespace", () => {
    const layers = gmtStats.industryLayers;
    for (const layer of layers) {
      for (const drawn of layer.drawsOn.filter((d) => d.shared)) {
        const owner = layers.find((l) => l.id === drawn.module.split("/")[0]);
        if (!drawn.module.includes("/")) expect(drawn.count).toBe(owner?.own);
      }
    }
  });
});

describe("the key and the summary under the industry chart", () => {
  it("names both kinds of segment in words, so the swatches are decoration", () => {
    const { host } = renderHtml(raw(industryLegend()));
    const key = within(host).getByRole("list", { name: "Key" });
    const items = within(key).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "the industry's own functions",
      "a shared layer it draws on",
    ]);
  });

  it("states each industry's own count and each drawn-on module's count in words", () => {
    const { host } = renderHtml(raw(industrySummary(FIXTURE)));
    const items = within(host)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toContain("Workforce: 8 own functions.");
    expect(items).toContain(
      "Transport: 15 own functions; draws on workforce, 8 functions (Workforce industry layer).",
    );
    expect(items).toContain(
      "Maritime: no namespace of its own; draws on gnss, 6 functions (GNSS industry layer); draws on timescale, 6 functions (Core).",
    );
  });

  it("states a line for every industry the stats hold", () => {
    const { host } = renderHtml(raw(industrySummary()));
    expect(within(host).getAllByRole("listitem")).toHaveLength(
      gmtStats.industryLayers.length,
    );
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
      expect(
        rects.filter((r) => r.gradient === barGradientId("spring")),
      ).toHaveLength(1);
      expect(
        rects.filter((r) => r.gradient === barGradientId("signal")),
      ).toHaveLength(libraryComparisons.length - 1);
    },
  );

  it("draws namespaces as one cyan bar per row", () => {
    const rects = barRects(renderStatic("namespaces"));
    expect(rects).toHaveLength(coreNamespaces.length + 1);
    expect(rects.every((r) => r.gradient === barGradientId("cyan"))).toBe(true);
  });

  it("draws industries stacked: a solid spring segment for each own namespace and a hatched one for each module drawn on", () => {
    const rects = barRects(renderStatic("industries"));
    const segments = industrySegments();
    expect(rects).toHaveLength(segments.length);
    expect(
      rects.filter((r) => r.gradient === barGradientId("spring")),
    ).toHaveLength(segments.filter((s) => !s.shaded).length);
    expect(
      rects.filter((r) => r.gradient === barHatchId("spring")),
    ).toHaveLength(segments.filter((s) => s.shaded).length);
  });

  it("stacks a drawn-on segment on top of its industry's own, in one column", () => {
    const rects = renderStaticRects("industries");
    for (const layer of gmtStats.industryLayers) {
      const column = rects.filter((r) => r.key.endsWith(`:${layer.label}`));
      expect(new Set(column.map((r) => r.x)).size, layer.id).toBe(1);
      const own = column.find((r) => r.gradient === barGradientId("spring"));
      const drawn = column.filter((r) => r.gradient === barHatchId("spring"));
      for (const segment of drawn) {
        // Above: a smaller y is higher on the page.
        expect(segment.y, layer.id).toBeLessThan(own?.y ?? Infinity);
      }
    }
  });

  it("only references gradients and patterns its container declares", () => {
    for (const id of Object.keys(BAR_CHARTS) as BarChartId[]) {
      const declared = [
        ...BAR_CHARTS[id].gradients.map((g) => g.id),
        ...BAR_CHARTS[id].patterns.map((p) => p.id),
      ];
      for (const rect of barRects(renderStatic(id))) {
        expect(declared).toContain(rect.gradient);
      }
    }
  });

  it("declares a hatch for the industry chart and for no other", () => {
    expect(BAR_CHARTS.industries.patterns.map((p) => p.id)).toEqual([
      barHatchId("spring"),
    ]);
    for (const id of Object.keys(BAR_CHARTS) as BarChartId[]) {
      if (id !== "industries") expect(BAR_CHARTS[id].patterns).toEqual([]);
    }
  });

  it("names the industry chart for what it shows, own and shared", () => {
    expect(BAR_CHARTS.industries.ariaLabel).toBe(
      "Public functions by industry layer, own and shared",
    );
  });
});

describe("namespace chart labels", () => {
  // /why-gmt lays the chart out in a grid column about 524px wide, where the axis thinned the
  // labels of precision, interval and calendar away. Every bar must keep its label.
  it.each([
    ["namespaces", NAMESPACE_COUNTS.map((r) => r.namespace)],
    ["industries", gmtStats.industryLayers.map((layer) => layer.label)],
  ] as const)(
    "keeps every %s label at the page's real chart width",
    (id, expected) => {
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
      for (const label of expected) {
        expect(labels).toContain(label);
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
