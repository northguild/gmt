/**
 * The parts every bar-chart registry shares: the hues, the page-level gradients and hatches
 * `ChartContainer` declares, the tooltip wrapper and the `BarChart` shape. `why-gmt-charts.ts` and
 * `bundle-size-charts.ts` each build a registry from these, and `bar-charts.ts` joins the two, so
 * neither page's charts import the other's module.
 *
 * Kept free of the stats and the report: a chart module in the client graph imports this file.
 */
import type { ChartDefinition, ChartPoint } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts";
import type {
  ChartTooltipContent,
  ChartTooltipExtension,
} from "@tanstack/charts/tooltip";
import { chartTooltipMotion } from "./chart-motion";

type TooltipOption = Parameters<typeof defineChart>[0]["tooltip"];

// ---------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------

/** A series hue: the name after `--gmt-` of the token that paints it. */
export type BarHue =
  | "spring"
  | "signal"
  | "cyan"
  | "polyfill-shipped"
  | "polyfill-previous";

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

export function barGradient(hue: BarHue): BarGradient {
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

export function barHatch(
  hue: BarHue,
  overrides: Partial<Pick<BarPattern, "tint" | "line" | "lineWidth">> = {},
): BarPattern {
  return {
    id: barHatchId(hue),
    hue,
    tint: 0.12,
    line: 0.6,
    size: 7,
    lineWidth: 2,
    ...overrides,
  };
}

export function withTooltip(
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
// The shape of a registered chart
// ---------------------------------------------------------------------------

export interface BarChart {
  ariaLabel: string;
  idPrefix: string;
  width: number;
  height: number;
  gradients: readonly BarGradient[];
  /** Hatches the chart's shaded marks refer to, declared as page-level patterns. */
  patterns: readonly BarPattern[];
  /** Widened to the runtime's untyped definition so every chart shares a caller. */
  definition: (tooltip?: ChartTooltipExtension) => ChartDefinition;
}
