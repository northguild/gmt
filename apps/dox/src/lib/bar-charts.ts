/**
 * Every bar chart the site draws, joined from the per-page registries. `ChartContainer.astro` and
 * `scripts/render-charts.ts` read this one registry; each page's charts live in their own module,
 * so neither page's chart code imports the other's.
 */
import type { BarChart } from "./bar-chart-kit";
import {
  BUNDLE_SIZE_CHARTS,
  type BundleSizeChartId,
} from "./bundle-size-charts";
import { WHY_GMT_CHARTS, type WhyGmtChartId } from "./why-gmt-charts";

export type { BarGradient, BarPattern } from "./bar-chart-kit";

export type BarChartId = WhyGmtChartId | BundleSizeChartId;

export const BAR_CHARTS: Record<BarChartId, BarChart> = {
  ...WHY_GMT_CHARTS,
  ...BUNDLE_SIZE_CHARTS,
};

export function isBarChartId(id: string | undefined): id is BarChartId {
  return id !== undefined && Object.hasOwn(BAR_CHARTS, id);
}
