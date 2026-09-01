import {
  geoEqualEarth,
  geoGraticule,
  type ExtendedFeature,
  type GeoGeometryObjects,
  type GeoPermissibleObjects,
} from "d3-geo";
import { feature } from "topojson-client";

import { Temporal } from "@js-temporal/polyfill";
import type { ChartPoint } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts";
import { mountChart } from "@tanstack/charts/dom";
import { whenFocused } from "@tanstack/charts/focus/mark";
import { geoShape } from "@tanstack/charts/geo";
import { tooltip } from "@tanstack/charts/tooltip";
import worldAtlas from "world-atlas/countries-110m.json";
import { TIMEZONES } from "./timezones";

type TopologyLike = Parameters<typeof feature>[0];

const topology = worldAtlas as unknown as TopologyLike;
const objects = (topology as { objects: Record<string, unknown> }).objects;
const countryObject = objects.countries as Parameters<typeof feature>[1];
const land = feature(topology, countryObject) as {
  features: GeoPermissibleObjects[];
};
const landFeatures: GeoPermissibleObjects[] = land.features;

const sphere: GeoPermissibleObjects = { type: "Sphere" };
const graticule: GeoPermissibleObjects = geoGraticule()();

const projection = {
  type: () => geoEqualEarth().rotate([-10, 0]),
  fit: "sphere" as const,
};

type TimezoneDatum = {
  type: "Point";
  coordinates: [number, number];
  properties: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    localTime: string;
    offset: string;
  };
};

function stripMs(iso: string): string {
  return iso.replace(/\.\d+/, "");
}

type TimezoneFeature = ExtendedFeature<GeoGeometryObjects, { tzid: string }>;

let timezoneFeatures: TimezoneFeature[] = [];

async function loadTimezoneBoundaries(): Promise<TimezoneFeature[]> {
  if (timezoneFeatures.length > 0) return timezoneFeatures;
  try {
    const res = await fetch("/timezone-boundaries.json");
    if (!res.ok) return [];
    const data = (await res.json()) as {
      type: "FeatureCollection";
      features: TimezoneFeature[];
    };
    timezoneFeatures = data.features.filter(
      (f) => f && f.properties && typeof f.properties.tzid === "string",
    );
  } catch {
    timezoneFeatures = [];
  }
  return timezoneFeatures;
}

function buildPoints(): TimezoneDatum[] {
  const now = Temporal.Now.instant();
  return TIMEZONES.map((tz) => {
    const zdt = now.toZonedDateTimeISO(tz.id);
    const dateTime = zdt.toPlainDateTime().toString();
    const offset = zdt.offset;
    return {
      type: "Point",
      coordinates: [tz.lng, tz.lat] as [number, number],
      properties: {
        id: tz.id,
        name: tz.name,
        lat: tz.lat,
        lng: tz.lng,
        localTime: dateTime,
        offset: offset,
      },
    };
  });
}

function buildDefinition(
  points: TimezoneDatum[],
  boundaries: TimezoneFeature[],
) {
  const boundaryMarks = [
    geoShape([sphere], {
      projection,
      fill: "color(from var(--gmt-cyan) srgb r g b / 0.05)",
      stroke: "none",
    }),
    geoShape(landFeatures, {
      projection,
      fill: "color(from var(--gmt-cyan) srgb r g b / 0.35)",
      stroke: "none",
    }),
    ...(boundaries.length > 0
      ? [
          geoShape(boundaries, {
            projection,
            key: (f: TimezoneFeature) => f.properties.tzid,
            fill: "color(from var(--gmt-cyan) srgb r g b / 0.25)",
            fillOpacity: 0.01,
            stroke: "var(--gmt-cyan)",
            strokeOpacity: 0.5,
            strokeWidth: 0.75,
            className: "gmt-timezone-polygon",
          }),
        ]
      : []),
    geoShape([graticule], {
      projection,
      fill: "none",
      stroke: "var(--gmt-ice)",
      strokeOpacity: 0.3,
      strokeWidth: 0.5,
    }),
    geoShape(points, {
      projection,
      key: (p: TimezoneDatum) => p.properties.id,
      fill: "var(--gmt-cyan)",
      stroke: "var(--gmt-cyan)",
      strokeWidth: 1,
      r: 5,
    }),
    whenFocused(
      geoShape(points, {
        projection,
        key: (p: TimezoneDatum) => p.properties.id,
        fill: "none",
        stroke: "var(--gmt-spring)",
        strokeWidth: 1,
      }),
      { retarget: true },
    ),
    whenFocused(
      geoShape(points, {
        projection,
        key: (p: TimezoneDatum) => p.properties.id,
        fill: "none",
        stroke: "var(--gmt-spring)",
        strokeWidth: 1,
        r: 12,
      }),
      { retarget: true },
    ),
  ];

  return defineChart({
    marks: boundaryMarks,
    scales: { x: null, y: null },
    focus: {
      resolve: (points, context) => {
        let nearest: (typeof points)[number] | null = null;
        let nearestDist = context.maxDistance * context.maxDistance;
        for (const p of points) {
          if ((p.datum as { type?: string } | undefined)?.type !== "Point") {
            continue;
          }
          const dx = p.x - context.x;
          const dy = p.y - context.y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= nearestDist) {
            nearest = p;
            nearestDist = d2;
          }
        }
        return nearest ? [nearest] : [];
      },
      group: (_points, { point }) => [point],
      navigation: (points) => points,
    },
    focusRing: false,
    maxFocusDistance: 10,
    tooltip: {
      use: tooltip,
      sticky: true,
      content: (
        points: readonly ChartPoint<
          TimezoneDatum | TimezoneFeature | GeoPermissibleObjects
        >[],
      ) => {
        const point = points[0];
        if (!point) return { rows: [] };
        const datum = point.datum as TimezoneDatum;
        if (datum.type !== "Point") return { rows: [] };
        const p = datum.properties;
        if (!p) return { rows: [] };
        return {
          rows: [
            { label: p.name, value: `GMT${p.offset}` },
            { label: stripMs(p.localTime), value: "" },
          ],
        };
      },
    } as Parameters<typeof defineChart>[0]["tooltip"],
  });
}

export interface TimezoneMapHost {
  update: (options: { definition: unknown; height: number }) => void;
  focusTimezone: (id: string) => void;
  destroy: () => void;
}

export async function initTimezoneMap(
  host: HTMLElement,
  clockPanel: HTMLElement | null,
): Promise<TimezoneMapHost> {
  const boundaries = await loadTimezoneBoundaries();

  const initialPoints = buildPoints();
  const initialDefinition = buildDefinition(initialPoints, boundaries);

  const chartHost = mountChart(host, {
    definition: initialDefinition as unknown as Parameters<
      typeof mountChart<TimezoneDatum>
    >[1]["definition"],
    ariaLabel: "Live timezone world map",
    height: 400,
  });

  function focusTimezone(id: string): void {
    const scene = chartHost.getScene();
    const target = scene.points.find((p) => {
      const d = p.datum as
        | { type?: string; properties?: { id?: string } }
        | undefined;
      return d?.type === "Point" && d.properties?.id === id;
    });
    if (!target) return;
    chartHost.interaction.setControlledFocus(target, { pinned: true });
  }

  function tick(): void {
    const points = buildPoints();
    const definition = buildDefinition(points, boundaries);
    chartHost.update({
      definition: definition as unknown as Parameters<
        typeof mountChart<TimezoneDatum>
      >[1]["definition"],
      height: 400,
      ariaLabel: "Live timezone world map",
    });

    if (clockPanel) {
      const entries = clockPanel.querySelectorAll<HTMLElement>("[data-tz-id]");
      entries.forEach((el) => {
        const tzId = el.dataset.tzId;
        if (!tzId) return;
        const tz = TIMEZONES.find((t) => t.id === tzId);
        if (!tz) return;
        const now = Temporal.Now.instant();
        const zdt = now.toZonedDateTimeISO(tz.id);
        const dateTime = zdt.toPlainDateTime().toString();
        const offset = zdt.offset;
        const timeEl = el.querySelector<HTMLElement>("[data-tz-field='time']");
        const offsetEl = el.querySelector<HTMLElement>(
          "[data-tz-field='offset']",
        );
        if (timeEl) timeEl.textContent = stripMs(dateTime);
        if (offsetEl) offsetEl.textContent = `GMT${offset}`;
      });
    }
  }

  tick();
  const interval = setInterval(tick, 1000);

  return {
    update: (opts) =>
      chartHost.update(opts as Parameters<typeof chartHost.update>[0]),
    focusTimezone,
    destroy: () => {
      clearInterval(interval);
      chartHost.destroy();
    },
  };
}
