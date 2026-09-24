/**
 * The bar charts on /why-gmt. Each definition is shared by the build-time
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
import type {
  ChartTooltipContent,
  ChartTooltipExtension,
  ChartTooltipRow,
} from "@tanstack/charts/tooltip";
import {
  coreFunctions,
  coreNamespaces,
  formatCount,
  gmtStats,
  industryFunctions,
  industryNamespaces,
} from "../data/gmt-stats";
import {
  libraryComparisons,
  type LibraryComparison,
} from "../data/library-comparison";

type TooltipOption = Parameters<typeof defineChart>[0]["tooltip"];

const shareFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

// ---------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------

export type BarHue = "spring" | "signal" | "cyan";

export interface BarGradient {
  id: string;
  hue: BarHue;
  top: number;
  bottom: number;
}

// Same recipe as the locale matrix tiles: the bottom stop sits 0.09 under the top.
const BAR_OPACITY = { top: 0.32, bottom: 0.23 };

export function barGradientId(hue: BarHue): string {
  return `gmt-bar-${hue}`;
}

function barGradient(hue: BarHue): BarGradient {
  return { id: barGradientId(hue), hue, ...BAR_OPACITY };
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
  value: number;
  comparison: LibraryComparison;
}

function ciRow(comparison: LibraryComparison, value: number): CiExecutionRow {
  return {
    library: comparison.chartLabel ?? comparison.displayName,
    value,
    comparison,
  };
}

/** One bar per library: every test execution its CI runs, matrix re-runs included. */
export function ciExecutionRows(
  comparisons: readonly LibraryComparison[] = libraryComparisons,
): CiExecutionRow[] {
  return comparisons.map((c) => ciRow(c, c.stats.executions));
}

/**
 * One bar per library: a single run of its suite, before any CI matrix. GMT's matrix makes its
 * CI executions dwarf every other bar, so /why-gmt shows this view first.
 */
export function ciSuiteRows(
  comparisons: readonly LibraryComparison[] = libraryComparisons,
): CiExecutionRow[] {
  return comparisons.map((c) => ciRow(c, c.stats.tests));
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
    { label: "Suite tests", value: formatCount(tests) },
  ];
  if (reruns > 0) {
    rows.push({ label: "Matrix re-runs", value: formatCount(reruns) });
  }
  if (comparison.matrixLabel) {
    rows.push({ label: "Matrix", value: comparison.matrixLabel });
  }
  rows.push({ label: "CI executions", value: formatCount(executions) });
  if (knownFailures) {
    rows.push({
      label: "Known failures",
      value: formatCount(knownFailures),
    });
  }

  return {
    title: comparison.displayName,
    color: `var(--gmt-${ciHue(comparison)})`,
    rows,
  };
}

export function ciExecutionsDefinition(tooltip?: ChartTooltipExtension) {
  return ciBarsDefinition(ciExecutionRows(), tooltip);
}

export function ciSuiteDefinition(tooltip?: ChartTooltipExtension) {
  return ciBarsDefinition(ciSuiteRows(), tooltip);
}

/** Both CI views share one bar definition, so they differ only in their rows. */
function ciBarsDefinition(
  rows: readonly CiExecutionRow[],
  tooltip?: ChartTooltipExtension,
) {
  return defineChart({
    marks: [
      barX(rows, {
        y: "library",
        x: "value",
        yScale: "y",
        xScale: "x",
        fill: (d) =>
          `url(#${barGradientId(ciHue((d as CiExecutionRow).comparison))})`,
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
// Public functions by namespace, and by industry layer
// ---------------------------------------------------------------------------

export interface NamespaceRow {
  namespace: string;
  count: number;
}

/**
 * Functions per core namespace, largest first, then `regex`'s patterns — from gmt-stats.json.
 * The industry layers have a chart of their own: beside `plain`'s hundreds their bars were slivers.
 */
export const NAMESPACE_COUNTS: readonly NamespaceRow[] = [
  ...coreNamespaces,
  { namespace: "regex", count: gmtStats.patterns },
];

/** Functions per industry layer, largest first. */
export const INDUSTRY_COUNTS: readonly NamespaceRow[] = industryNamespaces;

/** `regex` exports patterns, not functions, so it sits outside the total. */
export const CORE_FUNCTION_TOTAL = coreFunctions;
export const INDUSTRY_FUNCTION_TOTAL = industryFunctions;

export function namespaceTooltip(
  row: NamespaceRow | undefined,
): ChartTooltipContent {
  if (!row) return { rows: [] };
  const color = "var(--gmt-cyan)";
  if (row.namespace === "regex") {
    return {
      title: row.namespace,
      color,
      rows: [{ label: "Exported patterns", value: formatCount(row.count) }],
    };
  }
  return {
    title: row.namespace,
    color,
    rows: [
      { label: "Public functions", value: formatCount(row.count) },
      {
        label: "Share of core",
        value: shareFormat.format(row.count / CORE_FUNCTION_TOTAL),
      },
    ],
  };
}

export function industryTooltip(
  row: NamespaceRow | undefined,
): ChartTooltipContent {
  if (!row) return { rows: [] };
  return {
    title: row.namespace,
    color: "var(--gmt-spring)",
    rows: [
      { label: "Public functions", value: formatCount(row.count) },
      {
        label: "Share of industry layers",
        value: shareFormat.format(row.count / INDUSTRY_FUNCTION_TOTAL),
      },
    ],
  };
}

/** Both API-surface views share one bar definition, so they differ in rows, hue and tooltip. */
function apiSurfaceDefinition(
  rows: readonly NamespaceRow[],
  hue: BarHue,
  content: (row: NamespaceRow | undefined) => ChartTooltipContent,
  tooltip?: ChartTooltipExtension,
) {
  return defineChart({
    marks: [
      barY(rows, {
        x: "namespace",
        y: "count",
        xScale: "x",
        yScale: "y",
        fill: `url(#${barGradientId(hue)})`,
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
      x: {
        scale: scaleBand,
        padding: 0.15,
        // Eleven bars share ~45px each in the page's ~524px grid column, and the longer names
        // (precision, calendar, duration) are wider than that. The axis's default collision
        // thinning then hid some labels outright, so angle them and keep every one.
        axis: { tickLabels: { rotate: -40, thin: false } },
      },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    ...withTooltip(tooltip, (datum) =>
      content(datum as NamespaceRow | undefined),
    ),
  });
}

export function namespaceDefinition(tooltip?: ChartTooltipExtension) {
  return apiSurfaceDefinition(
    NAMESPACE_COUNTS,
    "cyan",
    namespaceTooltip,
    tooltip,
  );
}

/** Industry layers are painted spring green, so the toggle reads as a change of chart, not of data. */
export function industryDefinition(tooltip?: ChartTooltipExtension) {
  return apiSurfaceDefinition(
    INDUSTRY_COUNTS,
    "spring",
    industryTooltip,
    tooltip,
  );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type BarChartId =
  | "ci-executions"
  | "ci-suite"
  | "namespaces"
  | "industries";

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
    gradients: [barGradient("spring"), barGradient("signal")],
    definition: ciExecutionsDefinition as unknown as BarChart["definition"],
  },
  "ci-suite": {
    ariaLabel: "Test suite size per library, one run",
    idPrefix: "suite-tests",
    width: 1200,
    height: 420,
    gradients: [barGradient("spring"), barGradient("signal")],
    definition: ciSuiteDefinition as unknown as BarChart["definition"],
  },
  namespaces: {
    ariaLabel: "Public functions by core namespace",
    idPrefix: "namespace-distribution",
    width: 1200,
    height: 360,
    gradients: [barGradient("cyan")],
    definition: namespaceDefinition as unknown as BarChart["definition"],
  },
  industries: {
    ariaLabel: "Public functions by industry layer",
    idPrefix: "industry-distribution",
    width: 1200,
    height: 360,
    gradients: [barGradient("spring")],
    definition: industryDefinition as unknown as BarChart["definition"],
  },
};

export function isBarChartId(value: string | undefined): value is BarChartId {
  return value !== undefined && value in BAR_CHARTS;
}
