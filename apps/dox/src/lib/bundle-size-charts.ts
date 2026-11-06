/**
 * The two charts on /bundle-size, drawn from `bundle-size-figures.ts` and nothing else: the floor
 * of each polyfill, and each function's size split into the polyfill and GMT's code above it.
 * Every chart is built by `bundleSizeCharts(report)` so a test can hand it a fixture; the
 * registry at the bottom is the live one. Same render path as /why-gmt: the build-time SVG
 * (`scripts/render-charts.ts`) and the live mount in `ChartContainer.astro`.
 *
 * Package names, versions and entry names are read from the report, never typed here. The shipped
 * and previous sets are told apart by the `shipped` flag. Client graph: this module imports the
 * figures module and the kit, and neither reaches the corpus.
 */
import { barX, defineChart, group } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import type {
  ChartTooltipContent,
  ChartTooltipExtension,
} from "@tanstack/charts/tooltip";
import { chartKey, chartSummary } from "~/widgets/builders";
import type { ChartKeyHue } from "~/widgets/builders/chart-key";
import {
  barHatch,
  barHatchId,
  withTooltip,
  type BarChart,
  type BarHue,
} from "./bar-chart-kit";
import {
  chartRows,
  formatBytes,
  polyfillSets,
  type BundleReport,
  type Measure,
  type PolyfillSet,
} from "./bundle-size-figures";
import live from "../generated/bundle-size.json";

const liveReport = live as unknown as BundleReport;

type Side = "shipped" | "previous";

const SIDES: readonly Side[] = ["shipped", "previous"];

const HUE: Record<Side, BarHue & ChartKeyHue> = {
  shipped: "polyfill-shipped",
  previous: "polyfill-previous",
};

const hueVar = (side: Side) => `var(--gmt-${HUE[side]})`;

export type BundleSizeChartId =
  | "polyfill-floor-gzipped"
  | "polyfill-floor-minified"
  | "polyfill-split-gzipped"
  | "polyfill-split-minified";

export type PolyfillChartKind = "floor" | "split";

const label = (set: PolyfillSet) => `${set.package} ${set.version}`;

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** One bar of the floor chart: a polyfill alone. */
export interface FloorDatum {
  set: Side;
  package: string;
  version: string;
  value: number;
}

/** One bar of the split chart: a function on one polyfill. */
export interface SplitDatum {
  name: string;
  set: Side;
  package: string;
  version: string;
  floor: number;
  code: number;
  total: number;
}

function floorRows(report: BundleReport, measure: Measure): FloorDatum[] {
  const sets = polyfillSets(report);
  return SIDES.flatMap((side) => {
    const set = sets[side];
    const entry = set.entries[report.floor];
    if (!entry) return [];
    return [
      {
        set: side,
        package: set.package,
        version: set.version,
        value: entry[measure],
      },
    ];
  });
}

function splitRows(report: BundleReport, measure: Measure): SplitDatum[] {
  const sets = polyfillSets(report);
  return chartRows(report).flatMap((row) =>
    SIDES.map((side) => {
      const part = (side === "shipped" ? row.shipped : row.previous)[measure];
      return {
        name: row.name,
        set: side,
        package: sets[side].package,
        version: sets[side].version,
        floor: part.floor,
        code: part.code,
        total: part.total,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------

export function polyfillTooltips(report: BundleReport = liveReport): {
  floor: (datum: FloorDatum | undefined) => ChartTooltipContent;
  split: (datum: SplitDatum | undefined) => ChartTooltipContent;
} {
  void report;
  return {
    floor: (datum) =>
      datum
        ? {
            title: `${datum.package} ${datum.version}`,
            color: hueVar(datum.set),
            rows: [{ label: "Polyfill", value: formatBytes(datum.value) }],
          }
        : { rows: [] },
    split: (datum) =>
      datum
        ? {
            title: datum.name,
            color: hueVar(datum.set),
            rows: [
              { label: "Package", value: `${datum.package} ${datum.version}` },
              { label: "Polyfill", value: formatBytes(datum.floor) },
              { label: "GMT code", value: formatBytes(datum.code) },
              { label: "Total", value: formatBytes(datum.total) },
            ],
          }
        : { rows: [] },
  };
}

// ---------------------------------------------------------------------------
// Key and summary
// ---------------------------------------------------------------------------

export function polyfillLegendHtml(
  kind: PolyfillChartKind,
  report: BundleReport = liveReport,
): string {
  const sets = polyfillSets(report);
  if (kind === "floor") {
    return chartKey(
      SIDES.map((side) => ({
        kind: "own" as const,
        hue: HUE[side],
        words: label(sets[side]),
      })),
    ).toString();
  }
  return chartKey(
    SIDES.flatMap((side) => [
      {
        kind: "own" as const,
        hue: HUE[side],
        words: `${sets[side].package} polyfill`,
      },
      {
        kind: "shared" as const,
        hue: HUE[side],
        words: `GMT code above ${sets[side].package}`,
      },
    ]),
  ).toString();
}

export function polyfillSummaryHtml(
  kind: PolyfillChartKind,
  measure: Measure,
  report: BundleReport = liveReport,
): string {
  const lines =
    kind === "floor"
      ? floorRows(report, measure).map(
          (d) => `${d.package} ${d.version}: ${formatBytes(d.value)}.`,
        )
      : splitRows(report, measure).map(
          (d) =>
            `${d.name}, ${d.package}: polyfill ${formatBytes(d.floor)}, GMT code ${formatBytes(d.code)}, total ${formatBytes(d.total)}.`,
        );
  return chartSummary(lines).toString();
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

const axisBytes = {
  scale: scaleLinear,
  nice: true,
  grid: true,
  axis: { ticks: { format: (value: unknown) => formatBytes(Number(value)) } },
};

function floorDefinition(
  report: BundleReport,
  measure: Measure,
  tooltip?: ChartTooltipExtension,
) {
  const content = polyfillTooltips(report).floor;
  return defineChart({
    marks: [
      barX(floorRows(report, measure), {
        y: "set",
        x: "value",
        yScale: "y",
        xScale: "x",
        fill: (d) => hueVar((d as FloorDatum).set),
        stroke: "var(--gmt-border-strong)",
        strokeWidth: 1,
        radius: 0,
        inset: 2,
        maxThickness: 40,
      }),
    ],
    scales: {
      x: axisBytes,
      y: {
        scale: () => scaleBand<string>().domain([...SIDES]),
        padding: 0.3,
        axis: {
          tickLabels: false,
          ticks: false,
        },
      },
    },
    ...withTooltip(tooltip, (datum) =>
      content(datum as FloorDatum | undefined),
    ),
  });
}

function splitDefinition(
  report: BundleReport,
  measure: Measure,
  tooltip?: ChartTooltipExtension,
) {
  const content = polyfillTooltips(report).split;
  const rows = splitRows(report, measure);
  const layout = group({
    scale: scaleBand<string>().domain([...SIDES]),
    padding: 0.08,
  });
  const common = {
    y: "name",
    z: "set",
    yScale: "y",
    xScale: "x",
    layout,
    stroke: (d: unknown) =>
      `var(--gmt-${HUE[(d as SplitDatum).set]}-ink, var(--gmt-border-strong))`,
    strokeWidth: 1.5,
    radius: 0,
    inset: 1,
    maxThickness: 22,
  } as const;
  return defineChart({
    marks: [
      barX(rows, {
        ...common,
        x1: () => 0,
        x2: "floor",
        fill: (d) => hueVar((d as SplitDatum).set),
        stroke: "var(--gmt-border-strong)",
      }),
      barX(rows, {
        ...common,
        x1: "floor",
        x2: "total",
        fill: (d) => `url(#${barHatchId(HUE[(d as SplitDatum).set])})`,
      }),
    ],
    scales: {
      x: axisBytes,
      y: { scale: scaleBand, padding: 0.25 },
    },
    ...withTooltip(tooltip, (datum) =>
      content(datum as SplitDatum | undefined),
    ),
  });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const WIDTH = 1200;
const FLOOR_HEIGHT = 200;
const ROW_HEIGHT = 64;
const SPLIT_CHROME = 80;

const PATTERNS = [barHatch("polyfill-shipped"), barHatch("polyfill-previous")];

export function bundleSizeCharts(
  report: BundleReport = liveReport,
): Record<BundleSizeChartId, BarChart> {
  const sets = polyfillSets(report);
  const rows = chartRows(report).length;
  const build = (
    kind: PolyfillChartKind,
    measure: Measure,
  ): [BundleSizeChartId, BarChart] => [
    `polyfill-${kind}-${measure}` as BundleSizeChartId,
    {
      ariaLabel:
        kind === "floor"
          ? `Size of ${sets.shipped.package} and ${sets.previous.package} alone, ${measure}`
          : `Size of each function on ${sets.shipped.package} and on ${sets.previous.package}, ${measure}`,
      idPrefix: `polyfill-${kind}-${measure}`,
      width: WIDTH,
      height:
        kind === "floor" ? FLOOR_HEIGHT : rows * ROW_HEIGHT + SPLIT_CHROME,
      gradients: [],
      patterns: kind === "floor" ? [] : PATTERNS,
      definition: ((tooltip?: ChartTooltipExtension) =>
        kind === "floor"
          ? floorDefinition(report, measure, tooltip)
          : splitDefinition(
              report,
              measure,
              tooltip,
            )) as unknown as BarChart["definition"],
    },
  ];
  return Object.fromEntries([
    build("floor", "gzipped"),
    build("floor", "minified"),
    build("split", "gzipped"),
    build("split", "minified"),
  ]) as Record<BundleSizeChartId, BarChart>;
}

export const BUNDLE_SIZE_CHARTS = bundleSizeCharts();
