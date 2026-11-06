// @vitest-environment jsdom
import { createChartRuntime, renderChartSvg } from "@tanstack/charts";
import { screen, within } from "@testing-library/dom";
import { renderHtml } from "~/widgets/test-fixture";
import { raw } from "~/widgets/builders/html";
import { barHatchId } from "./bar-chart-kit";
import {
  bundleSizeCharts,
  polyfillLegendHtml,
  polyfillSummaryHtml,
  polyfillTooltips,
  type BundleSizeChartId,
} from "./bundle-size-charts";
import { chartRows, formatBytes, polyfillSets } from "./bundle-size-figures";
import { fixtureReport } from "./bundle-size-figures.fixture";

const IDS: readonly BundleSizeChartId[] = [
  "polyfill-floor-gzipped",
  "polyfill-floor-minified",
  "polyfill-split-gzipped",
  "polyfill-split-minified",
];

/** Render one chart of the fixture to a document, tearing the runtime down as it goes. */
function render(id: BundleSizeChartId, report = fixtureReport()): Document {
  const chart = bundleSizeCharts(report)[id];
  const runtime = createChartRuntime();
  try {
    const scene = runtime.render(chart.definition(), {
      width: chart.width,
      height: chart.height,
    });
    const svg = renderChartSvg(scene, {
      ariaLabel: chart.ariaLabel,
      idPrefix: chart.idPrefix,
    });
    return new DOMParser().parseFromString(svg, "image/svg+xml");
  } finally {
    runtime.destroy();
  }
}

interface Rect {
  fill: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The bar rects of a render: those whose fill is a polyfill token or a polyfill hatch. */
function bars(doc: Document): Rect[] {
  return [...doc.querySelectorAll("rect")]
    .map((rect) => ({
      fill: rect.getAttribute("fill") ?? "",
      x: Number(rect.getAttribute("x")),
      y: Number(rect.getAttribute("y")),
      width: Number(rect.getAttribute("width")),
      height: Number(rect.getAttribute("height")),
    }))
    .filter((rect) => rect.fill.includes("polyfill-"));
}

const solid = (rects: Rect[]) =>
  rects.filter((r) => !r.fill.startsWith("url("));
const hatched = (rects: Rect[]) =>
  rects.filter((r) => r.fill.startsWith("url("));

describe("the bundle-size charts", () => {
  it("render a scene for every id without throwing", () => {
    for (const id of IDS) expect(() => render(id), id).not.toThrow();
  });

  it("draw one bar per set in the floor chart", () => {
    for (const id of [
      "polyfill-floor-gzipped",
      "polyfill-floor-minified",
    ] as const) {
      expect(bars(render(id)), id).toHaveLength(2);
    }
  });

  it("colour the bars by the shipped flag, not by the order of the sets", () => {
    const report = fixtureReport();
    const reversed = {
      ...report,
      polyfills: [...(report.polyfills ?? [])].reverse(),
    };
    for (const r of [report, reversed]) {
      const rects = bars(render("polyfill-floor-gzipped", r));
      expect(rects.map((x) => x.fill)).toEqual([
        `var(--${"gmt"}-polyfill-shipped)`,
        `var(--${"gmt"}-polyfill-previous)`,
      ]);
    }
  });

  it("puts the shipped bar above the previous bar in the floor chart", () => {
    const [first, second] = bars(render("polyfill-floor-gzipped"));
    expect(first.fill).toContain("shipped");
    expect(first.y).toBeLessThan(second.y);
  });

  it("draws a floor rect and a code rect for each package of each chart row", () => {
    const rows = chartRows(fixtureReport()).length;
    for (const id of [
      "polyfill-split-gzipped",
      "polyfill-split-minified",
    ] as const) {
      const rects = bars(render(id));
      expect(solid(rects), id).toHaveLength(2 * rows);
      expect(hatched(rects), id).toHaveLength(2 * rows);
    }
  });

  it("starts each code rect where its floor rect ends, on the same row", () => {
    const rects = bars(render("polyfill-split-gzipped"));
    for (const floor of solid(rects)) {
      const hue = floor.fill.replace("var(--gmt-", "").replace(")", "");
      const code = hatched(rects).find(
        (r) =>
          r.fill === `url(#${barHatchId(hue as "polyfill-shipped")})` &&
          Math.abs(r.y - floor.y) < 0.5,
      );
      expect(
        code,
        `a code rect beside ${floor.fill} at y=${floor.y}`,
      ).toBeDefined();
      expect(
        Math.abs((code?.x ?? 0) - (floor.x + floor.width)),
      ).toBeLessThanOrEqual(0.5);
      expect(code?.height).toBeCloseTo(floor.height, 1);
    }
  });

  it("puts the shipped bar above the previous bar in every band", () => {
    const rects = bars(render("polyfill-split-gzipped"));
    const shipped = solid(rects).filter((r) => r.fill.includes("shipped"));
    const previous = solid(rects).filter((r) => r.fill.includes("previous"));
    expect(shipped).toHaveLength(previous.length);
    for (const [i, rect] of shipped.entries()) {
      expect(rect.y).toBeLessThan(previous[i].y);
      // Each pair shares its band: the previous bar starts within one band below.
      expect(previous[i].y - rect.y).toBeLessThan(2 * rect.height + 4);
    }
  });

  it("sizes the split chart from its row count", () => {
    const report = fixtureReport();
    const rows = chartRows(report).length;
    const chart = bundleSizeCharts(report)["polyfill-split-gzipped"];
    expect(chart.height).toBe(rows * 64 + 80);
    expect(bundleSizeCharts(report)["polyfill-floor-gzipped"].height).toBe(200);
  });

  it("declares the gradients and hatches its marks use", () => {
    const chart = bundleSizeCharts(fixtureReport())["polyfill-split-gzipped"];
    expect(chart.patterns.map((p) => p.hue).sort()).toEqual([
      "polyfill-previous",
      "polyfill-shipped",
    ]);
  });
});

describe("the key and summary", () => {
  it("lists two items for the floor chart, named by package and version", () => {
    renderHtml(raw(polyfillLegendHtml("floor", fixtureReport())));
    const items = within(
      screen.getByRole("list", { name: "Key" }),
    ).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "alpha-poly 2.0.0",
      "beta-poly 0.5.1",
    ]);
  });

  it("lists four items for the split chart, each naming the polyfill or the GMT code above it", () => {
    renderHtml(raw(polyfillLegendHtml("split", fixtureReport())));
    const items = within(
      screen.getByRole("list", { name: "Key" }),
    ).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "alpha-poly polyfill",
      "GMT code above alpha-poly",
      "beta-poly polyfill",
      "GMT code above beta-poly",
    ]);
  });

  it("gives the floor chart one summary line per bar", () => {
    renderHtml(raw(polyfillSummaryHtml("floor", "gzipped", fixtureReport())));
    expect(screen.getAllByRole("listitem").map((i) => i.textContent)).toEqual([
      `alpha-poly 2.0.0: ${formatBytes(2000)}.`,
      `beta-poly 0.5.1: ${formatBytes(4800)}.`,
    ]);
  });

  it("gives the split chart one line per bar, from the figures", () => {
    renderHtml(raw(polyfillSummaryHtml("split", "gzipped", fixtureReport())));
    const lines = screen.getAllByRole("listitem").map((i) => i.textContent);
    expect(lines).toHaveLength(2 * chartRows(fixtureReport()).length);
    expect(lines[0]).toBe(
      `fnSmall, alpha-poly: polyfill ${formatBytes(2000)}, GMT code ${formatBytes(300)}, total ${formatBytes(2300)}.`,
    );
  });

  it("reads the minified measure in the minified summary", () => {
    renderHtml(raw(polyfillSummaryHtml("floor", "minified", fixtureReport())));
    expect(screen.getAllByRole("listitem").map((i) => i.textContent)).toEqual([
      `alpha-poly 2.0.0: ${formatBytes(5000)}.`,
      `beta-poly 0.5.1: ${formatBytes(12000)}.`,
    ]);
  });
});

describe("the tooltips", () => {
  const { floor, split } = polyfillTooltips(fixtureReport());

  it("name the package and version, then the polyfill, in the floor chart", () => {
    const { shipped } = polyfillSets(fixtureReport());
    const content = floor({
      set: "shipped",
      package: shipped.package,
      version: shipped.version,
      value: 2000,
    });
    expect(content.title).toBe("alpha-poly 2.0.0");
    expect(content.rows).toEqual([
      { label: "Polyfill", value: formatBytes(2000) },
    ]);
  });

  it("give polyfill, GMT code and total in the split chart", () => {
    const content = split({
      name: "fnBig",
      set: "previous",
      package: "beta-poly",
      version: "0.5.1",
      floor: 4800,
      code: 1400,
      total: 6200,
    });
    expect(content.title).toBe("fnBig");
    expect(content.rows).toEqual([
      { label: "Package", value: "beta-poly 0.5.1" },
      { label: "Polyfill", value: formatBytes(4800) },
      { label: "GMT code", value: formatBytes(1400) },
      { label: "Total", value: formatBytes(6200) },
    ]);
  });
});
