/**
 * The bar charts on /why-gmt. Each definition is shared by the build-time
 * SVG render (scripts/render-charts.ts — the no-JS fallback) and the live mount
 * in ChartContainer.astro, which adds the hover tooltip.
 *
 * Bars are painted like the locale matrix tiles: a diagonal gradient in the
 * series hue. The matrix builds its gradients by rewriting the static SVG
 * string, which a live mount would discard on every render, so the bar
 * gradients are declared here instead — ChartContainer emits them as page-level
 * <defs> and the marks reference them with url(#id). The shaded segments of the
 * "By industry" chart use a hatch pattern declared the same way.
 */
import type { ChartDefinition, ChartPoint } from "@tanstack/charts";
import { barX, barY, defineChart, stack } from "@tanstack/charts";
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
  type IndustryLayerCount,
} from "../data/gmt-stats";
import {
  libraryComparisons,
  type LibraryComparison,
} from "../data/library-comparison";
import { chartTooltipMotion } from "./chart-motion";

type TooltipOption = Parameters<typeof defineChart>[0]["tooltip"];

const shareFormat = new Intl.NumberFormat(undefined, {
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

/**
 * A hatch: a tint of the hue with diagonal lines over it, declared once as a page-level SVG
 * pattern (`ChartContainer.astro`). The tint and the lines are both the hue's token at reduced
 * strength, so the difference from a solid bar never rests on colour alone.
 */
export interface BarPattern {
  id: string;
  hue: BarHue;
  /** The fill strength of the tint under the lines. */
  tint: number;
  /** The strength of the lines. */
  line: number;
  /** The side of the repeating tile, in user units. */
  size: number;
  lineWidth: number;
}

export function barHatchId(hue: BarHue): string {
  return `gmt-bar-${hue}-hatch`;
}

function barHatch(hue: BarHue): BarPattern {
  return {
    id: barHatchId(hue),
    hue,
    tint: 0.12,
    line: 0.6,
    size: 7,
    lineWidth: 2,
  };
}

function withTooltip(
  extension: ChartTooltipExtension | undefined,
  content: (datum: unknown) => ChartTooltipContent,
): { tooltip?: TooltipOption } {
  if (!extension) return {};
  return {
    tooltip: {
      use: extension,
      ...chartTooltipMotion(),
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

/** Functions in the namespace each industry owns, largest first. */
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

/**
 * The industry's name for a module it draws on: the label of the industry that owns the
 * namespace (a shared industry layer), or Core for any other module.
 */
function drawnOnOwner(
  module: string,
  layers: readonly IndustryLayerCount[],
): string {
  const owner = layers.find((layer) => layer.id === module.split("/")[0]);
  return owner ? `${owner.label} industry layer` : "Core";
}

/**
 * The tooltip of any segment of an industry's bar: the industry, its own functions with their
 * share, and one row per module it draws on. The share divides by the distinct functions of
 * all own namespaces, so it is stated for the own segment only: a drawn-on segment repeats
 * functions already counted in their own column or in Core.
 */
export function industryTooltip(
  layer: IndustryLayerCount | undefined,
  layers: readonly IndustryLayerCount[] = gmtStats.industryLayers,
): ChartTooltipContent {
  if (!layer) return { rows: [] };
  const rows: ChartTooltipRow[] =
    layer.own > 0
      ? [
          { label: "Own functions", value: formatCount(layer.own) },
          {
            label: "Share of industry layers",
            value: shareFormat.format(layer.own / INDUSTRY_FUNCTION_TOTAL),
          },
        ]
      : [];
  for (const drawn of layer.drawsOn) {
    rows.push({
      label: `draws on ${drawn.module} (${drawnOnOwner(drawn.module, layers)})`,
      value: formatCount(drawn.count),
    });
  }
  return { title: layer.label, color: "var(--gmt-spring)", rows };
}

// ---------------------------------------------------------------------------
// The stacked "By industry" chart
// ---------------------------------------------------------------------------

/** The series of an industry's own functions; every other series is a module it draws on. */
export const OWN_SERIES = "own";

/** One segment of one industry's bar. */
export interface IndustrySegment {
  /** The industry's label: the bar's place on the x axis. */
  industry: string;
  layer: IndustryLayerCount;
  /** `own`, or the module the segment counts. */
  series: string;
  count: number;
  /** True for a drawn-on module: hatched, never solid. */
  shaded: boolean;
}

/**
 * One segment per own namespace and one per module an industry draws on, industries in declared
 * order. A segment with no function is left out, so an industry that owns no namespace has only
 * shaded segments.
 */
export function industrySegments(
  layers: readonly IndustryLayerCount[] = gmtStats.industryLayers,
): IndustrySegment[] {
  return layers.flatMap((layer) => [
    ...(layer.own > 0
      ? [
          {
            industry: layer.label,
            layer,
            series: OWN_SERIES,
            count: layer.own,
            shaded: false,
          },
        ]
      : []),
    ...layer.drawsOn
      .filter((drawn) => drawn.count > 0)
      .map((drawn) => ({
        industry: layer.label,
        layer,
        series: drawn.module,
        count: drawn.count,
        shaded: true,
      })),
  ]);
}

/**
 * The stack's order, bottom to top: the own functions, then the drawn-on modules as the
 * declarations first name them. An explicit order, so a bar never depends on the order rows
 * happen to arrive in.
 */
function seriesOrder(segments: readonly IndustrySegment[]): string[] {
  return [...new Set([OWN_SERIES, ...segments.map((s) => s.series)])];
}

/**
 * Each industry's own functions in the solid spring gradient, with the modules it draws on
 * stacked above in the hatched tint of the same hue.
 */
export function industryStackDefinition(tooltip?: ChartTooltipExtension) {
  const segments = industrySegments();
  return defineChart({
    marks: [
      barY(segments, {
        x: "industry",
        y: "count",
        z: "series",
        xScale: "x",
        yScale: "y",
        layout: stack({ order: seriesOrder(segments) }),
        fill: (d) =>
          `url(#${(d as IndustrySegment).shaded ? barHatchId("spring") : barGradientId("spring")})`,
        stroke: (d) =>
          (d as IndustrySegment).shaded
            ? "var(--gmt-spring-ink)"
            : "var(--gmt-border-strong)",
        strokeWidth: 1,
        radius: 0,
        inset: 2,
        maxThickness: 40,
      }),
    ],
    scales: {
      x: {
        scale: scaleBand,
        padding: 0.15,
        axis: { tickLabels: { rotate: -40, thin: false } },
      },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    ...withTooltip(tooltip, (datum) =>
      industryTooltip((datum as IndustrySegment | undefined)?.layer),
    ),
  });
}

/** Escapes the few characters that matter in the text of an HTML element. */
const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The key under the chart. A solid swatch and a hatched swatch are marks; the words carry the
 * meaning.
 */
export function industryLegend(): string {
  const item = (modifier: string, words: string) =>
    `<li><span class="gmt-chart-swatch gmt-chart-swatch--${modifier}" aria-hidden="true"></span><span>${escapeHtml(words)}</span></li>`;
  return [
    `<ul class="gmt-chart-legend" aria-label="Key">`,
    item("own", "the industry's own functions"),
    item("shared", "a shared layer it draws on"),
    `</ul>`,
  ].join("");
}

/**
 * Each industry's own count and each drawn-on module's count in words, for a reader who cannot
 * see the bars. Visually hidden: the chart has no table.
 */
export function industrySummary(
  layers: readonly IndustryLayerCount[] = gmtStats.industryLayers,
): string {
  const items = layers.map((layer) => {
    const parts = [
      layer.own > 0
        ? `${formatCount(layer.own)} own functions`
        : "no namespace of its own",
      ...layer.drawsOn.map(
        (drawn) =>
          `draws on ${drawn.module}, ${formatCount(drawn.count)} functions (${drawnOnOwner(drawn.module, layers)})`,
      ),
    ];
    return `<li>${escapeHtml(`${layer.label}: ${parts.join("; ")}.`)}</li>`;
  });
  return `<ul class="gmt-chart-visually-hidden">${items.join("")}</ul>`;
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

/** The stacked "By industry" chart: see `industryStackDefinition`. */
export function industryDefinition(tooltip?: ChartTooltipExtension) {
  return industryStackDefinition(tooltip);
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
  /** Hatches the chart's shaded marks refer to, declared as page-level patterns. */
  patterns: readonly BarPattern[];
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
    patterns: [],
    definition: ciExecutionsDefinition as unknown as BarChart["definition"],
  },
  "ci-suite": {
    ariaLabel: "Test suite size per library, one run",
    idPrefix: "suite-tests",
    width: 1200,
    height: 420,
    gradients: [barGradient("spring"), barGradient("signal")],
    patterns: [],
    definition: ciSuiteDefinition as unknown as BarChart["definition"],
  },
  namespaces: {
    ariaLabel: "Public functions by core namespace",
    idPrefix: "namespace-distribution",
    width: 1200,
    height: 360,
    gradients: [barGradient("cyan")],
    patterns: [],
    definition: namespaceDefinition as unknown as BarChart["definition"],
  },
  industries: {
    ariaLabel: "Public functions by industry layer, own and shared",
    idPrefix: "industry-distribution",
    width: 1200,
    height: 360,
    gradients: [barGradient("spring")],
    patterns: [barHatch("spring")],
    definition: industryDefinition as unknown as BarChart["definition"],
  },
};

export function isBarChartId(value: string | undefined): value is BarChartId {
  return value !== undefined && value in BAR_CHARTS;
}
