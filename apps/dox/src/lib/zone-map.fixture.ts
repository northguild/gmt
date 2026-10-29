/**
 * What the zone-map tests share: the map section as the family builder writes it, wired as a
 * page's mount wires it, with fixture rows and a boundary file read from `public/`. Not a `.test`
 * file, like `clock-change-tense.fixture.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { geoPath } from "d3-geo";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { isBeforeUtc } from "@northguild/gmt/utc/compare";
import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import { html } from "~/widgets/builders/html";
import { section, widget } from "~/widgets/builders/layout";
import {
  legendCount,
  zoneLegend,
  zoneMap,
} from "~/widgets/families/clockcheck/zone-map";
import { findWidget } from "~/widgets/root";
import { renderHtml } from "~/widgets/test-fixture";
import type { TenseView } from "./clock-change-tense";
import { msToNextSecond } from "./clock-change-common";
import {
  MAP_WIDTH,
  isZoneFeature,
  largestPartPx,
  wireZoneMap,
  type BoundaryCollection,
  type MapZone,
  type ZoneMapConfig,
  type ZoneMapDeps,
} from "./zone-map";

export const NOW = "2026-10-22T12:00:00Z";

export function loadBoundaries(
  file: "canada" | "morocco",
): BoundaryCollection & Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      resolve(__dirname, `../../public/timezone-boundaries-${file}.json`),
      "utf8",
    ),
  ) as BoundaryCollection & Record<string, unknown>;
}

export function zoneDeps(
  boundaries: BoundaryCollection,
  tense: TenseView,
  over: Partial<ZoneMapDeps> = {},
): ZoneMapDeps {
  return {
    tense: () => tense,
    responseNow: NOW,
    now: () => NOW,
    wall: (at, offset) => convertUtcToPlainDateTime(at, { timeZone: offset }),
    isBefore: isBeforeUtc,
    msToNextSecond,
    fetch: vi.fn(async () =>
      Response.json(boundaries),
    ) as unknown as typeof fetch,
    measure: () => 900,
    location: { href: "https://example.test/gmt/check/" },
    history: { replaceState: vi.fn() },
    ...over,
  };
}

export interface DrawOptions {
  config: ZoneMapConfig;
  /** The zones of the list, in reading order. */
  ids: readonly string[];
  rows: MapZone[];
  deps: ZoneMapDeps;
  signal?: AbortSignal;
}

/** Renders the section and wires it. Await `handle.ready` for the drawing. */
export function drawZoneMap({ config, ids, rows, deps, signal }: DrawOptions) {
  const fixture = renderHtml(
    widget(
      { name: config.idPrefix, label: "Zone map test", scope: config.idPrefix },
      zoneMap({
        idPrefix: config.idPrefix,
        zones: ids,
        listLabel: `${config.idPrefix} time zones, scrollable list`,
        mapHeight: config.height,
        legend: zoneLegend(config.idPrefix, [
          { kind: "stopped", text: html`${legendCount("stopped")} stopped` },
          {
            kind: "changes-after",
            text: html`${legendCount("changes-after")} still change`,
          },
          { kind: "none", text: html`${legendCount("none")} never change` },
        ]),
        clocks: section(
          { id: "clocks", heading: "Clocks", level: 4 },
          html`<p>Live clocks go here.</p>`,
        ),
      }),
    ),
  );
  const found = findWidget(fixture.host, config.idPrefix);
  const handle = wireZoneMap(
    found,
    rows,
    signal ?? new AbortController().signal,
    deps,
    config,
  );
  return { fixture, found, handle, user: userEvent.setup() };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The parts of a drawn section a test reaches by role and name. Call after `handle.ready`. */
export function mapQueries(config: ZoneMapConfig) {
  const list = () => screen.getByRole("list", { name: "Zones" });
  return {
    /** The drawing; absent (`null`) when it was never drawn. */
    svg: () => screen.queryByRole("group", { name: config.mapLabel }),
    frame: () => screen.getByRole("group", { name: "Zones on the map" }),
    /** Every button the drawing has for a zone: its shape, and a ring on a small zone. */
    shapes: (id: string) =>
      within(screen.getByRole("group", { name: config.mapLabel })).getAllByRole(
        "button",
        { name: new RegExp(`^${escape(id)},`) },
      ),
    /** The shape of a zone in the drawing. */
    shape: (id: string) =>
      within(screen.getByRole("group", { name: config.mapLabel })).getAllByRole(
        "button",
        { name: new RegExp(`^${escape(id)},`) },
      )[0]!,
    /** The list button of a zone. */
    listButton: (id: string) =>
      within(list()).getByRole("button", { name: new RegExp(escape(id)) }),
    listButtons: () => within(list()).getAllByRole("button"),
  };
}

/** The rings the drawing puts on its small zones, in drawing px: the same rule the mount applies. */
export function ringsOf(config: ZoneMapConfig, boundaries: BoundaryCollection) {
  const rings = new Map<string, { x: number; y: number; r: number }>();
  if (config.markerMinPx === undefined || !config.markers) return rings;
  const projection = config.projection(boundaries, MAP_WIDTH, config.height);
  const path = geoPath(projection);
  for (const feature of boundaries.features) {
    if (!isZoneFeature(feature)) continue;
    const id = feature.properties.tzid;
    const at = config.markers[id];
    if (!at || largestPartPx(feature, path) >= config.markerMinPx) continue;
    const point = projection([at[0], at[1]]);
    if (point) rings.set(id, { x: point[0], y: point[1], r: 6 });
  }
  return rings;
}

// ---------------------------------------------------------------------------
// The map's palette, measured from the module and the token sheet
// ---------------------------------------------------------------------------

/**
 * The map's class strokes against the map background (WCAG 1.4.11, 3:1). The map and its swatches
 * are `gmt-theme-dark` islands, so the dark theme's token values apply in both themes. Values are
 * read from `zone-map.module.css`, the module both dated checkers share, so a change to either is
 * measured.
 */
const stylesDir = resolve(__dirname, "../styles");
const tokenSheet = readFileSync(resolve(stylesDir, "gmt-tokens.css"), "utf8");
const shared = readFileSync(
  resolve(__dirname, "../widgets/families/clockcheck/zone-map.module.css"),
  "utf8",
);

type Rgb = [number, number, number];
const darkBlock = tokenSheet.slice(
  tokenSheet.indexOf(".gmt-theme-dark {"),
  tokenSheet.indexOf('[data-theme="light"] {'),
);
const token = (name: string): Rgb => {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(darkBlock);
  if (!m) throw new Error(`no ${name}`);
  const h = m[1]!;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};
const alpha = (name: string): number => {
  const m = new RegExp(`--zonemap-${name}:\\s*([0-9.]+);`).exec(shared);
  if (!m) throw new Error(`no ${name}`);
  return Number(m[1]);
};
const lum = (c: Rgb) => {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb =>
  a.map((v, i) => v * t + b[i]! * (1 - t)) as Rgb;

/** The class strokes, the sea and the land, as colours; `contrast` is the WCAG ratio of two. */
export function mapPalette() {
  const sea = mix(
    token("--gmt-cyan"),
    token("--gmt-globe-casing"),
    alpha("sea-cyan"),
  );
  const land = mix(
    token("--gmt-cyan"),
    token("--gmt-globe-casing"),
    alpha("land-cyan"),
  );
  const strokes: [string, Rgb][] = [
    [
      "never changes: cyan",
      mix(token("--gmt-cyan"), sea, alpha("none-edge-a")),
    ],
    [
      "still changes: gold (the dark -ink is an alias of it)",
      mix(token("--gmt-dst-gold"), sea, alpha("changes-edge-a")),
    ],
    ["stops in 2026: purple ink", token("--gmt-dst-purple-ink")],
    ["selected: green", token("--gmt-globe-selected")],
  ];
  return { sea, land, strokes, contrast: ratio };
}
