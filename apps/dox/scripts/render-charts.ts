import {
  barX,
  barY,
  cell,
  createChartRuntime,
  defineChart,
  renderChartSvg,
  text,
} from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";

const libraryMetadata: Record<
  string,
  { tests: number; locales: number; timezones: number; nodeVersions: number }
> = {
  "@northguild/gmt": {
    tests: 16701,
    locales: 17,
    timezones: 10,
    nodeVersions: 2,
  },
  "@intl/date": { tests: 20190, locales: 0, timezones: 0, nodeVersions: 1 },
  Luxon: { tests: 4888, locales: 0, timezones: 0, nodeVersions: 1 },
  "date-fns": { tests: 3213, locales: 0, timezones: 0, nodeVersions: 1 },
  "Moment.js": { tests: 11703, locales: 0, timezones: 0, nodeVersions: 1 },
};

function addTooltipsToBars(svg: string): string {
  const barGroupRegex =
    /<g[^>]*class="ts-chart__bar ts-chart__bar-x"[^>]*>([\s\S]*?)<\/g>/g;
  return svg.replace(barGroupRegex, (match: string, groupContent: string) => {
    const rectRegex = /<rect([^>]*)\/>/g;
    const rects = groupContent.match(rectRegex);
    if (!rects) return match;

    let result = match;
    let offset = 0;

    rects.forEach((rect, index) => {
      const meta = Object.values(libraryMetadata)[index];
      if (!meta) return;

      const executions = [334020, 386, 4888, 3213, 11703][index];
      const library = Object.keys(libraryMetadata)[index];

      const title = `${library}: ${executions.toLocaleString()} executions (${meta.tests.toLocaleString()} tests${meta.locales > 0 ? ` × ${meta.locales} locales` : ""}${meta.timezones > 0 ? ` × ${meta.timezones} timezones` : ""} × ${meta.nodeVersions} Node)`;

      const titleElement = `<title>${title}</title>`;
      const insertPos = result.indexOf(rect, offset) + rect.length;
      result =
        result.slice(0, insertPos) + titleElement + result.slice(insertPos);
      offset = insertPos + titleElement.length;
    });

    return result;
  });
}

export function renderTestExecutionChart(): string {
  const data = [
    { library: "@northguild/gmt", executions: 334020, highlight: true },
    { library: "@intl/date", executions: 386, highlight: false },
    { library: "Luxon", executions: 4888, highlight: false },
    { library: "date-fns", executions: 3213, highlight: false },
    { library: "Moment.js", executions: 11703, highlight: false },
  ];

  const definition = defineChart({
    marks: [
      barX(data, {
        y: "library",
        x: "executions",
        yScale: "y",
        xScale: "x",
        // GMT rides the standard (spring green); every legacy library shares the
        // fault colour (signal orange) used by the "alternatives inherit it"
        // diagram above.
        fill: (d) =>
          (d as { highlight?: boolean }).highlight
            ? "var(--gmt-spring)"
            : "var(--gmt-signal)",
        fillOpacity: 0.35,
        stroke: (d) =>
          (d as { highlight?: boolean }).highlight
            ? "var(--gmt-border-strong)"
            : "var(--gmt-signal-border)",
        strokeWidth: 1,
        radius: 2,
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
  });

  const runtime = createChartRuntime();
  // Rendered at the same natural width as the locale matrix so the SVG scales
  // to the full content column: bars stretch horizontally, height and text size
  // stay put (the chart is not blown up proportionally).
  const scene = runtime.render(definition, { width: 1200, height: 360 });
  const svg = renderChartSvg(scene, {
    ariaLabel: "CI test execution volume comparison",
    idPrefix: "test-executions",
  });
  runtime.destroy();
  return addTooltipsToBars(svg);
}

export function renderNamespaceChart(): string {
  const data = [
    { namespace: "plain", count: 223 },
    { namespace: "zoned", count: 119 },
    { namespace: "unix", count: 75 },
    { namespace: "utc", count: 75 },
    { namespace: "duration", count: 12 },
    { namespace: "regex", count: 22 },
  ];

  const definition = defineChart({
    marks: [
      barY(data, {
        x: "namespace",
        y: "count",
        xScale: "x",
        yScale: "y",
        fill: "var(--gmt-cyan)",
        fillOpacity: 0.35,
        stroke: "var(--gmt-border-strong)",
        strokeWidth: 1,
        radius: 2,
        inset: 2,
        // Match the thickness cap used on the CI executions chart so both
        // charts read with the same bar weight.
        maxThickness: 40,
      }),
    ],
    scales: {
      x: { scale: scaleBand, padding: 0.15 },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
  });

  const runtime = createChartRuntime();
  // Same natural width as the other charts — fills the content column without
  // scaling the bars or labels up (see renderTestExecutionChart).
  const scene = runtime.render(definition, { width: 1200, height: 360 });
  const svg = renderChartSvg(scene, {
    ariaLabel: "API surface by namespace",
    idPrefix: "namespace-distribution",
  });
  runtime.destroy();
  return svg;
}

// Family key + base tile opacity. TanStack's static renderer doesn't evaluate
// mark `states`, so every cell rect comes out with the same flat fill. We give
// the matrix its heatmap read by post-processing the SVG: each tile gets its own
// diagonal gradient in its family hue, dimming slightly down each column so the
// grid looks tiled rather than a single wash of color.
const localeFamilyStyle: Record<string, { key: string; base: number }> = {
  Latin: { key: "latin", base: 0.2 },
  CJK: { key: "cjk", base: 0.2 },
  "Arabic/Hebrew": { key: "arabic-hebrew", base: 0.32 },
  Cyrillic: { key: "cyrillic", base: 0.16 },
  Turkic: { key: "turkic", base: 0.18 },
};

function styleLocaleMatrixCells(
  svg: string,
  cells: readonly { family: string; row: number }[],
): string {
  const clamp = (n: number) => Math.max(0.03, Math.round(n * 1000) / 1000);
  const defs: string[] = [];
  let index = 0;

  const styled = svg.replace(
    /<rect data-ts-key="rect-0:[^"]*"[^>]*\/>/g,
    (rect) => {
      const cell = cells[index];
      if (!cell) return rect;
      const id = `locale-matrix-cell-${index}`;
      const { key, base } = localeFamilyStyle[cell.family];
      const top = clamp(base - cell.row * 0.014);
      const bottom = clamp(top - 0.09);
      defs.push(
        `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
          `<stop offset="0" stop-color="var(--gmt-family-${key})" stop-opacity="${top}"/>` +
          `<stop offset="1" stop-color="var(--gmt-family-${key})" stop-opacity="${bottom}"/>` +
          `</linearGradient>`,
      );
      index += 1;
      return rect
        .replace(/ fill="[^"]*"/, ` fill="url(#${id})"`)
        .replace(/ fill-opacity="[^"]*"/, "");
    },
  );

  if (!defs.length) return styled;
  return styled.replace(
    '<g data-ts-key="marks" class="ts-chart__marks">',
    `<g data-ts-key="marks" class="ts-chart__marks"><defs>${defs.join("")}</defs>`,
  );
}

export function renderLocaleMatrixChart(): string {
  const familyVar: Record<string, string> = {
    Latin: "var(--gmt-family-latin)",
    CJK: "var(--gmt-family-cjk)",
    "Arabic/Hebrew": "var(--gmt-family-arabic-hebrew)",
    Cyrillic: "var(--gmt-family-cyrillic)",
    Turkic: "var(--gmt-family-turkic)",
  };

  const data = [
    {
      family: "Latin",
      locale: "en-US",
      name: "English (US)",
      row: 0,
      fill: familyVar["Latin"],
    },
    {
      family: "Latin",
      locale: "en-GB",
      name: "English (UK)",
      row: 1,
      fill: familyVar["Latin"],
    },
    {
      family: "Latin",
      locale: "de-DE",
      name: "German",
      row: 2,
      fill: familyVar["Latin"],
    },
    {
      family: "Latin",
      locale: "fr-FR",
      name: "French",
      row: 3,
      fill: familyVar["Latin"],
    },
    {
      family: "Latin",
      locale: "es-ES",
      name: "Spanish",
      row: 4,
      fill: familyVar["Latin"],
    },
    {
      family: "Latin",
      locale: "it-IT",
      name: "Italian",
      row: 5,
      fill: familyVar["Latin"],
    },
    {
      family: "Latin",
      locale: "pt-PT",
      name: "Portuguese",
      row: 6,
      fill: familyVar["Latin"],
    },
    {
      family: "Latin",
      locale: "sv-SE",
      name: "Swedish",
      row: 7,
      fill: familyVar["Latin"],
    },
    {
      family: "Latin",
      locale: "is-IS",
      name: "Icelandic",
      row: 8,
      fill: familyVar["Latin"],
    },
    {
      family: "CJK",
      locale: "zh-CN",
      name: "Chinese (Simplified)",
      row: 0,
      fill: familyVar["CJK"],
    },
    {
      family: "CJK",
      locale: "zh-TW",
      name: "Chinese (Traditional)",
      row: 1,
      fill: familyVar["CJK"],
    },
    {
      family: "CJK",
      locale: "ja-JP",
      name: "Japanese",
      row: 2,
      fill: familyVar["CJK"],
    },
    {
      family: "CJK",
      locale: "ko-KR",
      name: "Korean",
      row: 3,
      fill: familyVar["CJK"],
    },
    {
      family: "Arabic/Hebrew",
      locale: "ar-SA",
      name: "Arabic",
      row: 0,
      fill: familyVar["Arabic/Hebrew"],
    },
    {
      family: "Arabic/Hebrew",
      locale: "he-IL",
      name: "Hebrew",
      row: 1,
      fill: familyVar["Arabic/Hebrew"],
    },
    {
      family: "Cyrillic",
      locale: "ru-RU",
      name: "Russian",
      row: 0,
      fill: familyVar["Cyrillic"],
    },
    {
      family: "Turkic",
      locale: "tr-TR",
      name: "Turkish",
      row: 0,
      fill: familyVar["Turkic"],
    },
  ];

  const definition = defineChart({
    marks: [
      cell(data, {
        x: "family",
        y: "row",
        fill: "var(--gmt-cyan)",
        fillOpacity: 0.05,
        stroke: "var(--gmt-border-strong)",
        strokeWidth: 1,
        radius: 0,
        states: [
          {
            when: () => true,
            style: {
              fill: (context) => context.datum.fill,
            },
          },
        ],
      }),
      text(data, {
        x: "family",
        y: "row",
        text: (d) => `${d.locale}  ${d.name}`,
        fill: "var(--gmt-ice)",
        fontSize: 11,
        anchor: "middle",
      }),
    ],
    scales: {
      x: { scale: scaleBand, padding: 0.3 },
      y: { scale: scaleBand, padding: 0.3 },
    },
  });

  const runtime = createChartRuntime();
  const scene = runtime.render(definition, { width: 1200, height: 420 });
  const svg = renderChartSvg(scene, {
    ariaLabel: "Locale matrix grouped by script family",
    idPrefix: "locale-matrix",
  });
  runtime.destroy();
  return styleLocaleMatrixCells(svg, data);
}

export const testExecutionSvg = renderTestExecutionChart();
export const namespaceDistributionSvg = renderNamespaceChart();
export const localeMatrixSvg = renderLocaleMatrixChart();
