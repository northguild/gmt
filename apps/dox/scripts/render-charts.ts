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

const libraryMetadata: Record<string, { tests: number; locales: number; timezones: number; nodeVersions: number }> = {
  GMT: { tests: 16701, locales: 17, timezones: 10, nodeVersions: 2 },
  "@intl/date": { tests: 20190, locales: 0, timezones: 0, nodeVersions: 1 },
  Luxon: { tests: 4888, locales: 0, timezones: 0, nodeVersions: 1 },
  "date-fns": { tests: 3213, locales: 0, timezones: 0, nodeVersions: 1 },
  "Moment.js": { tests: 11703, locales: 0, timezones: 0, nodeVersions: 1 },
};

function addTooltipsToBars(svg: string): string {
  const barGroupRegex = /<g[^>]*class="ts-chart__bar ts-chart__bar-x"[^>]*>([\s\S]*?)<\/g>/g;
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
      result = result.slice(0, insertPos) + titleElement + result.slice(insertPos);
      offset = insertPos + titleElement.length;
    });

    return result;
  });
}

export function renderTestExecutionChart(): string {
  const data = [
    { library: "GMT", executions: 334020, highlight: true },
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
        fill: (d) =>
          (d as { highlight?: boolean }).highlight
            ? "var(--gmt-spring)"
            : "var(--gmt-teal)",
        fillOpacity: 0.35,
        stroke: "var(--gmt-border-strong)",
        strokeWidth: 1,
        radius: 2,
        inset: 2,
      }),
    ],
    scales: {
      x: { scale: scaleLinear, nice: true, grid: true },
      y: { scale: scaleBand, padding: 0.2 },
    },
  });

  const runtime = createChartRuntime();
  const scene = runtime.render(definition, { width: 640, height: 320 });
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
      }),
    ],
    scales: {
      x: { scale: scaleBand, padding: 0.15 },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
  });

  const runtime = createChartRuntime();
  const scene = runtime.render(definition, { width: 640, height: 320 });
  const svg = renderChartSvg(scene, {
    ariaLabel: "API surface by namespace",
    idPrefix: "namespace-distribution",
  });
  runtime.destroy();
  return svg;
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
  return svg;
}

export const testExecutionSvg = renderTestExecutionChart();
export const namespaceDistributionSvg = renderNamespaceChart();
export const localeMatrixSvg = renderLocaleMatrixChart();
