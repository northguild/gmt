/**
 * What the feature-map test shares: a two-state boundary file keyed by `postal`, a zone-line
 * overlay, and the map section as the family builder writes it, wired as a page's mount wires it.
 * Not a `.test` file, like `zone-map.fixture.ts`.
 */
import { geoEquirectangular } from "d3-geo";
import userEvent from "@testing-library/user-event";
import { html } from "~/widgets/builders/html";
import { section, widget } from "~/widgets/builders/layout";
import {
  legendCount,
  zoneLegend,
  zoneMap,
} from "~/widgets/families/clockcheck/zone-map";
import { findWidget } from "~/widgets/root";
import { renderHtml } from "~/widgets/test-fixture";
import { COASTLINES, STATE_BOUNDARIES } from "./data-credits";
import {
  wireFeatureMap,
  type BoundaryCollection,
  type FeatureMapConfig,
  type FeatureMapDeps,
  type FeatureMapHandle,
} from "./feature-map";

export const STATES = ["AA", "BB"] as const;

const square = (lon: number, lat: number, size: number) => ({
  type: "Polygon",
  coordinates: [
    [
      [lon, lat],
      [lon + size, lat],
      [lon + size, lat + size],
      [lon, lat + size],
      [lon, lat],
    ],
  ],
});

/** Two squares side by side and the land around them. */
export const STATE_BOUNDARIES_FIXTURE: BoundaryCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { land: "other" },
      geometry: square(-10, -10, 30),
    },
    {
      type: "Feature",
      properties: { postal: "AA" },
      geometry: square(0, 0, 8),
    },
    {
      type: "Feature",
      properties: { postal: "BB" },
      geometry: square(10, 0, 8),
    },
  ],
};

/** A line over the two states, as a zone-line file would hold. */
export const OVERLAY_FIXTURE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { tzid: "Test/Line" },
      geometry: {
        type: "LineString",
        coordinates: [
          [9, -5],
          [9, 15],
        ],
      },
    },
  ],
};

export const BOUNDARIES_URL = "https://example.test/states.json";
export const OVERLAY_URL = "https://example.test/zone-lines.json";

const NAMES: Record<string, string> = { AA: "Alpha", BB: "Beta" };

export function featureConfig(
  over: Partial<FeatureMapConfig> = {},
): FeatureMapConfig {
  return {
    idPrefix: "states",
    height: 400,
    boundariesUrl: BOUNDARIES_URL,
    featureKey: "postal",
    projection: (boundaries, width, height) =>
      geoEquirectangular().fitExtent(
        [
          [16, 16],
          [width - 16, height - 16],
        ],
        boundaries as unknown as Parameters<
          ReturnType<typeof geoEquirectangular>["fitExtent"]
        >[1],
      ),
    classOf: (id) => (id === "AA" ? "standard" : "daylight"),
    nameOf: (id) => NAMES[id] ?? id,
    shapeLabel: (id) =>
      `${NAMES[id]}, ${id === "AA" ? "standard" : "daylight"}`,
    onPin: () => {},
    keyboard: "list",
    mapLabel: "Map of two test states.",
    labelled: [],
    anchors: {},
    credits: [STATE_BOUNDARIES, COASTLINES],
    creditsCorner: "corner",
    ...over,
  };
}

export function featureDeps(
  over: Partial<FeatureMapDeps> = {},
): FeatureMapDeps {
  return {
    fetch: vi.fn(async (url: RequestInfo | URL) =>
      Response.json(
        String(url) === OVERLAY_URL
          ? OVERLAY_FIXTURE
          : STATE_BOUNDARIES_FIXTURE,
      ),
    ) as unknown as typeof fetch,
    measure: () => 900,
    ...over,
  };
}

const controllers = new Set<AbortController>();

/** Aborts every live map between tests, whatever an assertion did. */
export function destroyDrawnFeatureMaps(): void {
  for (const controller of controllers) controller.abort();
  controllers.clear();
}

export interface DrawnFeatureMap {
  handle: FeatureMapHandle;
  controller: AbortController;
  user: ReturnType<typeof userEvent.setup>;
}

/** Renders the section with a postal-keyed list and wires it. Await `handle.ready`. */
export function drawFeatureMap(
  config: FeatureMapConfig,
  deps: FeatureMapDeps,
): DrawnFeatureMap {
  const controller = new AbortController();
  controllers.add(controller);
  const fixture = renderHtml(
    widget(
      {
        name: config.idPrefix,
        label: "Feature map test",
        scope: config.idPrefix,
      },
      zoneMap({
        idPrefix: config.idPrefix,
        zones: STATES,
        idKey: "feature",
        listLabel: "Test states, scrollable list",
        mapHeight: config.height,
        legend: zoneLegend(config.idPrefix, [
          { kind: "stopped", text: html`${legendCount("stopped")} standard` },
          { kind: "none", text: html`${legendCount("none")} daylight` },
        ]),
        clocks: section(
          { id: "clocks", heading: "Clocks", level: 4 },
          html`<p>Nothing here.</p>`,
        ),
      }),
    ),
  );
  const found = findWidget(fixture.host, config.idPrefix);
  const handle = wireFeatureMap(found, STATES, controller.signal, deps, config);
  return { handle, controller, user: userEvent.setup() };
}
