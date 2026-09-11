/**
 * The two bar charts on /why-gmt. Each definition is shared by the build-time
 * SVG render (scripts/render-charts.ts — the no-JS fallback) and the live mount
 * in ChartContainer.astro, which adds the hover tooltip.
 *
 * Bars are painted like the locale matrix tiles: a diagonal gradient in the
 * series hue. The matrix builds its gradients by rewriting the static SVG
 * string, which a live mount would discard on every render, so the bar
 * gradients are declared here instead — ChartContainer emits them as page-level
 * <defs> and the marks reference them with url(#id).
 */
import type { ChartDefinition, ChartPoint } from "@tanstack/charts";
import { barX, barY, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { stack } from "@tanstack/charts/stack";
import type {
  ChartTooltipContent,
  ChartTooltipExtension,
  ChartTooltipRow,
} from "@tanstack/charts/tooltip";
import {
  libraryComparisons,
  type LibraryComparison,
} from "../data/library-comparison";

type TooltipOption = Parameters<typeof defineChart>[0]["tooltip"];

const countFormat = new Intl.NumberFormat("en-US");
const shareFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

// ---------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------

export type BarHue = "spring" | "signal" | "cyan";
/** `suite` is one run of the tests; `matrix` is the CI re-runs on top of it. */
export type BarSegment = "suite" | "matrix";

export interface BarGradient {
  id: string;
  hue: BarHue;
  top: number;
  bottom: number;
}

// Same recipe as the locale matrix tiles: the bottom stop sits 0.09 under the
// top. The re-run segment keeps its library's hue at a fainter opacity.
const SEGMENT_OPACITY: Record<BarSegment, { top: number; bottom: number }> = {
  suite: { top: 0.32, bottom: 0.23 },
  matrix: { top: 0.14, bottom: 0.05 },
};

export function barGradientId(hue: BarHue, segment: BarSegment): string {
  return `gmt-bar-${hue}-${segment}`;
}

function barGradient(hue: BarHue, segment: BarSegment): BarGradient {
  return { id: barGradientId(hue, segment), hue, ...SEGMENT_OPACITY[segment] };
}

function withTooltip(
  extension: ChartTooltipExtension | undefined,
  content: (datum: unknown) => ChartTooltipContent,
): { tooltip?: TooltipOption } {
  if (!extension) return {};
  return {
    tooltip: {
      use: extension,
      content: (points: readonly ChartPoint<unknown>[]) =>
        content(points[0]?.datum),
    } as TooltipOption,
  };
}

// ---------------------------------------------------------------------------
// CI executions per library
// ---------------------------------------------------------------------------

export interface CiExecutionRow {
  library: string;
  segment: BarSegment;
  value: number;
  comparison: LibraryComparison;
}

/**
 * One row per bar segment: the suite's own tests, then the extra executions
 * its CI matrix adds. A library whose CI runs the suite once has no matrix row.
 */
export function ciExecutionRows(
  comparisons: readonly LibraryComparison[] = libraryComparisons,
): CiExecutionRow[] {
  return comparisons.flatMap((comparison) => {
    const library = comparison.chartLabel ?? comparison.displayName;
    const { tests, executions } = comparison.stats;
    const segments: [BarSegment, number][] = [
      ["suite", tests],
      ["matrix", executions - tests],
    ];
    return segments
      .filter(([, value]) => value > 0)
      .map(([segment, value]) => ({ library, segment, value, comparison }));
  });
}

/**
 * GMT rides the standard (spring green); every legacy library shares the fault
 * colour (signal orange) used by the "alternatives inherit it" diagram.
 */
export function ciHue(comparison: LibraryComparison): BarHue {
  return comparison.isSubject ? "spring" : "signal";
}

export function ciExecutionTooltip(
  row: CiExecutionRow | undefined,
): ChartTooltipContent {
  if (!row) return { rows: [] };
  const { comparison } = row;
  const { tests, executions, knownFailures } = comparison.stats;
  const reruns = executions - tests;

  const rows: ChartTooltipRow[] = [
    { label: "Suite tests", value: countFormat.format(tests) },
  ];
  if (reruns > 0) {
    rows.push({ label: "Matrix re-runs", value: countFormat.format(reruns) });
  }
  if (comparison.matrixLabel) {
    rows.push({ label: "Matrix", value: comparison.matrixLabel });
  }
  rows.push({ label: "CI executions", value: countFormat.format(executions) });
  if (knownFailures) {
    rows.push({
      label: "Known failures",
      value: countFormat.format(knownFailures),
    });
  }

  return {
    title: comparison.displayName,
    color: `var(--gmt-${ciHue(comparison)})`,
    rows,
  };
}

export function ciExecutionsDefinition(tooltip?: ChartTooltipExtension) {
  return defineChart({
    marks: [
      barX(ciExecutionRows(), {
        y: "library",
        x: "value",
        z: "segment",
        layout: stack({ order: ["suite", "matrix"] }),
        yScale: "y",
        xScale: "x",
        fill: (d) => {
          const row = d as CiExecutionRow;
          return `url(#${barGradientId(ciHue(row.comparison), row.segment)})`;
        },
        stroke: "var(--gmt-border-strong)",
        strokeWidth: 1,
        radius: 0,
        inset: 2,
        // Cap the bar to an absolute thickness so the wide viewBox doesn't
        // stretch it — the band scale still centers it on the category tick.
        maxThickness: 40,
      }),
    ],
    scales: {
      x: { scale: scaleLinear, nice: true, grid: true },
      y: { scale: scaleBand, padding: 0.2 },
    },
    ...withTooltip(tooltip, (datum) =>
      ciExecutionTooltip(datum as CiExecutionRow | undefined),
    ),
  });
}

// ---------------------------------------------------------------------------
// Public functions by namespace
// ---------------------------------------------------------------------------

export interface NamespaceRow {
  namespace: string;
  count: number;
}

export const NAMESPACE_COUNTS: readonly NamespaceRow[] = [
  { namespace: "plain", count: 225 },
  { namespace: "zoned", count: 122 },
  { namespace: "unix", count: 78 },
  { namespace: "utc", count: 76 },
  { namespace: "duration", count: 12 },
  { namespace: "precision", count: 18 },
  { namespace: "span", count: 4 },
  { namespace: "instant", count: 4 },
  { namespace: "regex", count: 25 },
];

/** `regex` exports patterns, not functions, so it sits outside the total. */
export const PUBLIC_FUNCTION_TOTAL = NAMESPACE_COUNTS.filter(
  (row) => row.namespace !== "regex",
).reduce((total, row) => total + row.count, 0);

export function namespaceTooltip(
  row: NamespaceRow | undefined,
): ChartTooltipContent {
  if (!row) return { rows: [] };
  const color = "var(--gmt-cyan)";
  if (row.namespace === "regex") {
    return {
      title: row.namespace,
      color,
      rows: [
        { label: "Exported patterns", value: countFormat.format(row.count) },
      ],
    };
  }
  return {
    title: row.namespace,
    color,
    rows: [
      { label: "Public functions", value: countFormat.format(row.count) },
      {
        label: "Share of API",
        value: shareFormat.format(row.count / PUBLIC_FUNCTION_TOTAL),
      },
    ],
  };
}

export function namespaceDefinition(tooltip?: ChartTooltipExtension) {
  return defineChart({
    marks: [
      barY(NAMESPACE_COUNTS, {
        x: "namespace",
        y: "count",
        xScale: "x",
        yScale: "y",
        fill: `url(#${barGradientId("cyan", "suite")})`,
        stroke: "var(--gmt-border-strong)",
        strokeWidth: 1,
        radius: 0,
        inset: 2,
        // Same thickness cap as the CI executions chart, so both charts read
        // with the same bar weight.
        maxThickness: 40,
      }),
    ],
    scales: {
      x: { scale: scaleBand, padding: 0.15 },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    ...withTooltip(tooltip, (datum) =>
      namespaceTooltip(datum as NamespaceRow | undefined),
    ),
  });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type BarChartId = "ci-executions" | "namespaces";

export interface BarChart {
  ariaLabel: string;
  idPrefix: string;
  width: number;
  height: number;
  gradients: readonly BarGradient[];
  /** Widened to the runtime's untyped definition so both charts share a caller. */
  definition: (tooltip?: ChartTooltipExtension) => ChartDefinition;
}

/**
 * Both charts render at the locale matrix's natural width of 1200, so they
 * fill the content column the same way.
 */
export const BAR_CHARTS: Record<BarChartId, BarChart> = {
  "ci-executions": {
    ariaLabel: "CI test execution volume comparison",
    idPrefix: "test-executions",
    width: 1200,
    height: 420,
    gradients: [
      barGradient("spring", "suite"),
      barGradient("spring", "matrix"),
      barGradient("signal", "suite"),
      barGradient("signal", "matrix"),
    ],
    definition: ciExecutionsDefinition as unknown as BarChart["definition"],
  },
  namespaces: {
    ariaLabel: "API surface by namespace",
    idPrefix: "namespace-distribution",
    width: 1200,
    height: 360,
    gradients: [barGradient("cyan", "suite")],
    definition: namespaceDefinition as unknown as BarChart["definition"],
  },
};

export function isBarChartId(value: string | undefined): value is BarChartId {
  return value !== undefined && value in BAR_CHARTS;
}
