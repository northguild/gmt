/**
 * What the stage draws on the Earth for the camera's place and its position in the deck: the
 * route's pins and arcs, the clock pins the wall leaves (dated while a lapse plays), and the
 * filing pins. Pure: it reads the route and the state it is given and returns the markers and arcs
 * for the engine.
 */
import type { GlobeArc, GlobeMarker, Rgba } from "~/lib/globe/types";
import type { readTheme } from "~/lib/globe/globe-theme";
import { isGeographic, labelOf, resolvePlace, type Place } from "./places";
import { keyOf, lngLat, reached, type Leg, type Stop } from "./stage-route";
import type { StageAt } from "./stage-state";
import { lapseLabel } from "./time-lapse";

const ARC_ALTITUDE = 0.15;

type Theme = ReturnType<typeof readTheme>;

interface RouteDrawing {
  /** The place the camera is bound for. */
  target: Place;
  homeAt: StageAt;
  stops: readonly Stop[];
  legs: readonly Leg[];
  pins: ReadonlyMap<string, Stop["place"]>;
  theme: Theme;
  colours: { cyan: Rgba; teal: Rgba };
  clocks: { on: ReadonlySet<string>; label(zone: string): string | undefined };
  /** The zones a playing lapse dates, the local stamp each shows, and whether one plays. */
  lapse: {
    zones: readonly string[];
    stamps: Readonly<Record<string, string>>;
    playing: boolean;
  };
  /** The filings each zone holds so far. */
  filings: ReadonlyMap<string, number>;
}

/** The route's own pins: the current one big and ringed, or every one in the overview. */
function routePins(v: RouteDrawing, all: boolean): GlobeMarker[] {
  const current = isGeographic(v.target) ? keyOf(v.target) : undefined;
  const markers: GlobeMarker[] = [];
  for (const [key, p] of v.pins) {
    if (v.clocks.on.has(key)) continue;
    const on = all || key === current;
    markers.push({
      id: `pin-${key}`,
      position: lngLat(p),
      radius: on ? 6 : 3.5,
      color: on ? v.theme.markerPrimary : v.theme.markerOther,
      ...(on ? { label: labelOf(p) } : {}),
      ...(key === current
        ? { ring: { radius: 11, width: 1.5, color: v.theme.markerPrimary } }
        : {}),
    });
  }
  return markers;
}

/** The clock pins: dated and ringed under a lapse, dots beside them, else labelled with the time. */
function clockPins(v: RouteDrawing): GlobeMarker[] {
  const markers: GlobeMarker[] = [];
  const dated = new Set(v.lapse.zones);
  for (const zone of new Set([...v.clocks.on, ...dated])) {
    const place = resolvePlace(zone);
    if (!isGeographic(place)) continue;
    const id = `clock-${zone}`;
    const position = lngLat(place);
    if (dated.has(zone)) {
      // A zone the lapse dates: its own local date and time, ringed, so the flip is the picture.
      markers.push({
        id,
        position,
        radius: 7,
        color: v.theme.markerPrimary,
        label: lapseLabel(labelOf(place), v.lapse.stamps[zone] ?? ""),
        ring: { radius: 12, width: 1.5, color: v.theme.markerPrimary },
      });
    } else if (v.lapse.playing) {
      // The other clocks hold still as dots while time moves, so the dated pins read alone.
      markers.push({ id, position, radius: 3.5, color: v.theme.markerOther });
    } else {
      markers.push({
        id,
        position,
        radius: 6,
        color: v.theme.markerPrimary,
        label: v.clocks.label(zone) ?? labelOf(place),
      });
    }
  }
  return markers;
}

function filingPins(v: RouteDrawing): GlobeMarker[] {
  const markers: GlobeMarker[] = [];
  for (const [zone, count] of v.filings) {
    const place = resolvePlace(zone);
    if (!isGeographic(place)) continue;
    markers.push({
      id: `filing-${zone}`,
      position: lngLat(place),
      radius: 5 + Math.min(count, 4),
      color: v.theme.markerPrimary,
      label: `${labelOf(place)} ${count}`,
    });
  }
  return markers;
}

/** The arcs flown so far, the latest bright; every arc in the overview. */
function routeArcs(v: RouteDrawing, all: boolean): GlobeArc[] {
  const reachedStops = v.stops.filter((s) => reached(s, v.homeAt));
  const flown = v.legs.filter((l) => reachedStops.includes(l.end));
  const arcs: GlobeArc[] = [];
  v.legs.forEach((leg, i) => {
    const isFlown = flown.includes(leg);
    if (!all && !isFlown) return;
    const isCurrent = isFlown && flown[flown.length - 1] === leg;
    arcs.push({
      id: `leg-${i}`,
      from: lngLat(leg.from),
      to: lngLat(leg.to),
      color: all || isCurrent ? v.colours.cyan : v.colours.teal,
      width: 2,
      altitude: ARC_ALTITUDE,
    });
  });
  return arcs;
}

export function drawRoute(v: RouteDrawing): {
  markers: GlobeMarker[];
  arcs: GlobeArc[];
} {
  const all = v.target.kind === "overview";
  return {
    markers: [...routePins(v, all), ...clockPins(v), ...filingPins(v)],
    arcs: routeArcs(v, all),
  };
}
