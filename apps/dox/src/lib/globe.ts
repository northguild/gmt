/**
 * The Dox globe: time zones, live clocks and selection on top of the reusable
 * globe engine (#289).
 *
 * The engine in `globe/` draws a planet and knows nothing about time. This file
 * is everything that makes it *this* globe — reading the site's colour tokens,
 * turning `getTimeZones()` into markers, fetching zone boundaries to highlight
 * and hit-test, the tooltip, and the clock list beside it. Splitting the two is
 * what lets the same engine draw transport lanes or a region set without a fork.
 *
 * Rendering is WebGPU, with the canvas-2D renderer as the fallback where WebGPU
 * is missing or fails; `globe/engine.ts` chooses and can swap between them.
 * `?globe=webgpu` or `?globe=canvas2d` forces one, which is how
 * `scripts/globe-smoke.mjs` compares the two.
 *
 * Entry point: `initGlobe(host, clockPanel)`, unchanged, so `globe-mount.ts`,
 * the `showGlobe` chat tool and the widget registry need no adjustment.
 *
 * Live times, offsets and DST come from `@northguild/gmt` through `./zone-clock`
 * — never `@js-temporal/polyfill` directly.
 */

import { getUnixNow } from "@northguild/gmt/unix/get";
import { getSystemTimeZone, getTimeZones } from "@northguild/gmt/zoned/get";
import { createGlobeEngine, type GlobeEngineWithHitTest } from "./globe/engine";
import {
  pointInPolygon,
  preparePolygon,
  type PreparedPolygon,
} from "./globe/geometry";
import type {
  GlobeMarker,
  GlobeRegion,
  GlobeTheme,
  LngLat,
  PolygonRings,
  RendererChoice,
  Rgba,
} from "./globe/types";
import {
  COORDINATES_BY_ID,
  resolveGlobeZones,
  rotationForZone,
  type GlobeZone,
} from "./globe-zones";
import { readViewerStamp, readZoneNow, type ZoneReading } from "./zone-clock";
import {
  type ZoneBucket,
  type ZoneFilter,
  bucketFor,
  countBuckets,
  defaultZoneFilter,
  isFilterEngaged,
  matchesFilter,
} from "./zone-filter";
import { type ZoneFilterUi, mountZoneFilters } from "./zone-filter-ui";
import { LABEL_ALPHA, MINOR_MARKER_ALPHA } from "./globe-inks";
import { renderZoneTooltip } from "./zone-readout";
import { skyAt } from "./zone-sky";
import { mountZoneClockList } from "./zone-clock-list";
import { enter, holdEntrance } from "./enter";

export interface GlobeHost {
  /** Rotate the globe to bring a zone to centre and select it. */
  focusZone: (id: string) => void;
  /** Select (or clear) a zone without moving the globe. */
  selectZone: (id: string | null) => void;
  /** Absolute zoom, clamped to the configured range. */
  setZoom: (zoom: number) => void;
  /** Multiply the current zoom target. */
  zoomBy: (factor: number) => void;
  getZoom: () => number;
  /** All zones the globe can plot and clock, sorted by id. */
  getZones: () => GlobeZone[];
  /** The currently selected zone id, or null. */
  getSelected: () => string | null;
  /** Called on every selection change (null when cleared). */
  onSelect: (callback: (reading: ZoneReading | null) => void) => void;
  /** Which backend is drawing — read by the smoke script and useful in the console. */
  getRenderer: () => "webgpu" | "canvas2d";
  destroy: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

/** Marker radii in CSS pixels. Sized so a non-curated zone is still easy to tap. */
const RADIUS_SELECTED = 4;
const RADIUS_PRIMARY = 3;
const RADIUS_OTHER = 2.2;

/** The selection ring's radius and stroke width, in CSS pixels. */
const SELECTION_RING_RADIUS = 8;
const SELECTION_RING_WIDTH = 1.5;

/** Outline width of the selected zone's boundary, in CSS pixels. */
const REGION_STROKE_WIDTH = 1.5;

/** The boundary dataset, fetched after the globe is already interactive. */
const BOUNDARIES_URL = "/timezone-boundaries-globe.json";

/**
 * NASA's Blue Marble, prepared by `scripts/prepare-globe-imagery.py`. Only the
 * WebGPU renderer fetches it, and only while `--gmt-globe-imagery-alpha` is
 * above 0.
 */
const IMAGERY_URL = "/earth-blue-marble.webp";

export async function initGlobe(
  host: HTMLElement,
  clockPanel: HTMLElement | null,
  filterPanel: HTMLElement | null = null,
): Promise<GlobeHost> {
  const reduceMotionQuery = globalThis.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  );
  const reducedMotion = () => reduceMotionQuery?.matches ?? false;

  const zones = resolveGlobeZones(getTimeZones());

  // Default to the viewer's own zone when it can be placed.
  const systemZone = getSystemTimeZone();
  const defaultZone =
    systemZone && zones.some((zone) => zone.id === systemZone)
      ? systemZone
      : null;
  const defaultRotation = defaultZone
    ? rotationForZone(COORDINATES_BY_ID.get(defaultZone)!)
    : ([-10, -15] as [number, number]);

  let theme = readTheme(host);

  const tooltip = document.createElement("div");
  tooltip.className = "gmt-globe-tooltip gmt-popover";
  tooltip.hidden = true;
  host.appendChild(tooltip);

  const zoomControls = host.querySelector<HTMLElement>(".gmt-globe-zoom");

  /* The clock list is mounted before the renderer starts, deliberately. It is the
     usable fallback if no renderer can start at all, and the previous code
     mounted it afterwards — so the one case it was meant to cover, a browser with
     no canvas, left the panel empty. */
  const zoneClockList = clockPanel
    ? mountZoneClockList(
        clockPanel,
        zones.map((zone) => zone.id),
        (id) => focusZone(id),
      )
    : null;
  /* The list is ready now but arrives with the globe, a beat behind it. The
     hold releases itself if the renderer never gets that far. */
  const releaseClocks = clockPanel ? holdEntrance(clockPanel) : () => {};

  let engine: GlobeEngineWithHitTest;
  try {
    engine = (await createGlobeEngine(host, {
      renderer: rendererOverride(),
      sunInstant: nowMs,
      theme,
      labelFont: labelFont(host),
      ariaLabel:
        "Interactive globe. Drag to rotate, scroll to zoom. Use the zone list to read a zone's live time.",
      initialRotation: defaultRotation,
      zoomRange: [MIN_ZOOM, MAX_ZOOM],
      reducedMotion,
      imageryUrl: IMAGERY_URL,
    })) as GlobeEngineWithHitTest;
  } catch (error) {
    tooltip.remove();
    zoneClockList?.destroy();
    throw error;
  }

  // --- selection -----------------------------------------------------------
  let selectedId: string | null = null;
  let selectedReading: ZoneReading | null = null;
  /* The viewer's own local date, against which the tooltip measures its
     "yesterday / tomorrow" call-out. Refreshed on each tick, not captured
     once: it changes at the viewer's own midnight. Declared up here with the
     rest of the selection state, above every function that reads it — this
     file mounts by running straight down, and a `let` below the first
     `setSelected` would still be in its temporal dead zone. */
  let viewerDate = readViewerStamp().date;
  let selectCallback: ((reading: ZoneReading | null) => void) | null = null;

  // --- filtering -----------------------------------------------------------
  /* Which day and DST buckets the clock list and the globe's markers are
     showing. Declared here, above `buildMarkers` and the region hit test that
     both read it, for the same temporal-dead-zone reason as `viewerDate`. */
  let filter: ZoneFilter = defaultZoneFilter();
  let filterUi: ZoneFilterUi | null = null;
  /* zone id -> its bucket, and the minute that map was built for. Empty while
     nothing needs it: see `refreshBuckets`. */
  let buckets = new Map<string, ZoneBucket>();
  let bucketMinute = "";
  /* Ticks since the last scan, used only when the viewer's zone cannot be
     named and `bucketMinute` is therefore always `""` — without it the
     minute comparison below would match itself forever and the DST buckets
     would never refresh again for the life of the page. */
  let ticksSinceScan = 0;
  /* The ids last handed to the clock list, so a rescan that changes nothing
     does not tear the list down. */
  let appliedIds: readonly string[] | null = null;

  /**
   * The zones passing the filter, or `null` for "everything".
   *
   * `null` rather than a full set when nothing is filtered, so the common case
   * allocates nothing and every caller below can skip its membership test.
   */
  function visibleZoneIds(): Set<string> | null {
    if (!isFilterEngaged(filter) || buckets.size === 0) return null;
    const visible = new Set<string>();
    for (const zone of zones) {
      const bucket = buckets.get(zone.id);
      if (!bucket || matchesFilter(bucket, filter)) visible.add(zone.id);
    }
    return visible;
  }

  /**
   * Rebuild the bucket map, at most once a minute.
   *
   * Reading all ~420 zones costs about 11 ms warm — nothing once a minute,
   * but a tenth of a frame's budget every second, and this runs beside a
   * globe that is trying to hold 60 fps. A zone's day and DST state can only
   * change on a whole-minute boundary, so a per-second scan would be
   * recomputing an answer that provably has not moved.
   *
   * Skipped entirely while the accordion is shut and no filter is on: that is
   * the state the globe mounts in and the one most readers never leave, and
   * in it nothing on screen depends on any of this.
   */
  function refreshBuckets(
    stamp: { date: string; minute: string },
    force = false,
  ): void {
    const wanted = (filterUi?.isOpen() ?? false) || isFilterEngaged(filter);
    if (!wanted) {
      if (buckets.size === 0) return;
      buckets = new Map();
      bucketMinute = "";
      return;
    }
    const stale =
      stamp.minute === ""
        ? ++ticksSinceScan >= 60
        : stamp.minute !== bucketMinute;
    if (!force && !stale && buckets.size > 0) return;
    bucketMinute = stamp.minute;
    ticksSinceScan = 0;
    /* One instant for the whole scan, so every zone is bucketed against the
       same sun rather than against a clock that moved mid-loop. */
    const instantMs = nowMs();
    const next = new Map<string, ZoneBucket>();
    for (const zone of zones) {
      next.set(
        zone.id,
        bucketFor(
          readZoneNow(zone.id),
          stamp.date,
          skyAt(zone.lat, zone.lng, instantMs),
        ),
      );
    }
    buckets = next;
    applyFilter();
  }

  /** Push the current filter into the clock list, the markers and the UI. */
  function applyFilter(): void {
    const visible = visibleZoneIds();
    const ids = visible
      ? zones.filter((zone) => visible.has(zone.id)).map((zone) => zone.id)
      : zones.map((zone) => zone.id);

    /* Only when the list actually moved. `applyFilter` is on the once-a-minute
       rescan as well as the filter-change path, and `setIds` drops every
       mounted row and sends the list back to the top — correct after a real
       filter change, and a reader thrown back to the first zone once a minute
       otherwise, for as long as the panel is open. Most minutes change no
       bucket at all. */
    const moved =
      appliedIds === null ||
      appliedIds.length !== ids.length ||
      ids.some((id, index) => appliedIds?.[index] !== id);
    if (moved) {
      appliedIds = ids;
      zoneClockList?.setIds(ids);
      engine.setMarkers(buildMarkers());
    }

    /* Outside the guard: a zone can cross midnight or a DST transition without
       changing what is *shown*, and the counts beside each toggle still have
       to follow it. */
    if (buckets.size > 0) {
      filterUi?.update(
        countBuckets(buckets.values()),
        ids.length,
        zones.length,
      );
    }
  }

  /** tzid -> prepared polygons, populated once the boundary set has loaded. */
  let boundaries: Map<string, PreparedPolygon[]> | null = null;

  function setSelected(id: string | null): void {
    selectedId = id;
    selectedReading = id ? readZoneNow(id) : null;
    renderTooltip();
    zoneClockList?.select(id);
    engine.setMarkers(buildMarkers());
    engine.setRegions(buildRegions());
    selectCallback?.(selectedReading);
  }

  function focusZone(id: string): void {
    const coordinate = COORDINATES_BY_ID.get(id);
    if (!coordinate) return;
    engine.flyTo(rotationForZone(coordinate));
    setSelected(id);
  }

  // --- markers and regions -------------------------------------------------
  function buildMarkers(): GlobeMarker[] {
    const selectedColour = theme.markerSelected;
    const visible = visibleZoneIds();
    /* The selected zone keeps its marker whatever the filter says. Its tooltip
       is open and its region is outlined; dropping the dot from under them
       would leave both pointing at bare ocean. */
    const shown = visible
      ? zones.filter((zone) => visible.has(zone.id) || zone.id === selectedId)
      : zones;
    return shown.map((zone) => {
      const selected = zone.id === selectedId;
      const marker: GlobeMarker = {
        id: zone.id,
        position: [zone.lng, zone.lat] as LngLat,
        radius: selected
          ? RADIUS_SELECTED
          : zone.primary
            ? RADIUS_PRIMARY
            : RADIUS_OTHER,
        color: selected
          ? selectedColour
          : zone.primary
            ? theme.markerPrimary
            : theme.markerOther,
        /* Gold once it is dark where the marker is, like the city lights in an
           Earth-at-night photograph. A selected zone keeps its own colour: that is
           a "focused" signal, not part of the city-lights palette. */
        nightColor: selected
          ? undefined
          : zone.primary
            ? theme.markerNightPrimary
            : theme.markerNightOther,
      };
      if (selected) {
        marker.ring = {
          radius: SELECTION_RING_RADIUS,
          width: SELECTION_RING_WIDTH,
          color: selectedColour,
        };
      }
      if (zone.primary) marker.label = shortLabel(zone.id);
      return marker;
    });
  }

  /**
   * Only the selected zone's own area, not every border on the globe.
   *
   * The engine is handed the raw rings and prepares them itself, while the
   * prepared copy below stays here for hit-testing — the two want the same data
   * in different shapes, and preparing it twice is cheaper than sharing a cache
   * across that boundary.
   */
  function buildRegions(): GlobeRegion[] {
    if (!selectedId) return [];
    const polygons = rawBoundaries?.get(boundaryKey(selectedId));
    if (!polygons) return [];
    return [
      {
        id: selectedId,
        polygons,
        fill: theme.regionFill,
        stroke: theme.regionStroke,
        strokeWidth: REGION_STROKE_WIDTH,
      },
    ];
  }

  /** Raw rings for the engine, prepared ones for hit-testing. */
  let rawBoundaries: Map<string, PolygonRings[]> | null = null;

  /** The boundary dataset names UTC `Etc/UTC`. */
  function boundaryKey(id: string): string {
    return id === "UTC" ? "Etc/UTC" : id;
  }

  async function loadBoundaries(): Promise<void> {
    try {
      const response = await fetch(BOUNDARIES_URL);
      if (!response.ok) return;
      const data = (await response.json()) as {
        features: {
          properties: { tzid: string };
          geometry:
            | { type: "Polygon"; coordinates: number[][][] }
            | { type: "MultiPolygon"; coordinates: number[][][][] };
        }[];
      };
      const prepared = new Map<string, PreparedPolygon[]>();
      const raw = new Map<string, PolygonRings[]>();
      for (const feature of data.features) {
        const tzid = feature?.properties?.tzid;
        if (!tzid) continue;
        const polygons =
          feature.geometry.type === "Polygon"
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates;
        const rings = polygons.map((polygon) =>
          polygon.map((ring) =>
            ring.map((point) => [point[0], point[1]] as LngLat),
          ),
        );
        raw.set(tzid, rings);
        prepared.set(
          tzid,
          rings.map((polygon) => preparePolygon(polygon)),
        );
      }
      boundaries = prepared;
      rawBoundaries = raw;
      engine.setRegions(buildRegions());
    } catch {
      // The globe is fully usable without the boundary outlines.
    }
  }

  /**
   * Which zone a tap inside no marker landed in.
   *
   * Straight-line polygon edges per RFC 7946 §3.1.1, via `globe/geometry.ts`, so
   * the answer does not depend on which renderer is drawing.
   */
  engine.setRegionHitTest((lng, lat) => {
    if (!boundaries) return null;
    /* A filtered-out zone has no marker, so tapping its territory must not
       select it either — otherwise the globe hands back a zone the list is
       deliberately not showing. */
    const visible = visibleZoneIds();
    for (const zone of zones) {
      if (visible && !visible.has(zone.id)) continue;
      const polygons = boundaries.get(boundaryKey(zone.id));
      if (!polygons) continue;
      for (const polygon of polygons) {
        if (pointInPolygon(polygon, lng, lat)) return zone.id;
      }
    }
    return null;
  });

  engine.onTap(({ markerId, regionId }) => {
    setSelected(markerId ?? regionId ?? null);
  });

  // --- tooltip -------------------------------------------------------------
  /* Markup lives in `zone-readout.ts`, shared with the clock list so the two
     surfaces cannot drift apart again — and so it is testable at all, since
     the globe cannot mount under jsdom (no canvas, no WebGPU). */
  function renderTooltip(): void {
    if (!selectedId || !selectedReading) {
      tooltip.hidden = true;
      return;
    }
    tooltip.hidden = false;
    const at = COORDINATES_BY_ID.get(selectedId);
    const sky = at ? skyAt(at.lat, at.lng, nowMs()) : undefined;
    tooltip.innerHTML = renderZoneTooltip(selectedReading, viewerDate, sky);
  }

  function positionTooltip(): void {
    if (tooltip.hidden || !selectedId) return;
    const coordinate = COORDINATES_BY_ID.get(selectedId);
    if (!coordinate) return;
    const at = engine.project([coordinate.lng, coordinate.lat]);
    if (!at.visible) {
      tooltip.style.opacity = "0.35";
      return;
    }
    tooltip.style.opacity = "1";
    // Clamp inside the stage, and flip below the point near the top edge.
    const pad = 8;
    const width = host.clientWidth;
    const x = Math.min(
      Math.max(at.x, tooltip.offsetWidth / 2 + pad),
      width - tooltip.offsetWidth / 2 - pad,
    );
    const flip = at.y - tooltip.offsetHeight - 16 < 0;
    tooltip.classList.toggle("gmt-globe-tooltip-below", flip);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${at.y + (flip ? 12 : 0)}px`;
  }

  engine.onFrame(positionTooltip);

  if (filterPanel) {
    filterUi = mountZoneFilters(
      filterPanel,
      (next) => {
        filter = next;
        /* Force the scan: the reader has just changed what they want to see,
           and the once-a-minute cadence would otherwise leave the list stale
           for up to a minute on the very interaction that asked for it. */
        refreshBuckets(readViewerStamp(), true);
        applyFilter();
      },
      () => refreshBuckets(readViewerStamp(), true),
    );
  }

  // --- the ticking clock ---------------------------------------------------
  /**
   * One second is the cadence the clocks need, and it is also what moves the
   * terminator while the globe is at rest.
   *
   * `requestRender` rather than a full frame: the sun has moved, nothing else
   * has, so the GPU renderer skips rebuilding the land coverage and redraws only
   * the surface.
   */
  function tick(): void {
    if (document.hidden) return;
    const stamp = readViewerStamp();
    viewerDate = stamp.date;
    refreshBuckets(stamp);
    zoneClockList?.tick();
    if (selectedId) {
      selectedReading = readZoneNow(selectedId);
      renderTooltip();
    }
    engine.requestRender();
  }
  let clockTimer = setInterval(tick, 1000);

  function onVisibility(): void {
    clearInterval(clockTimer);
    if (!document.hidden) clockTimer = setInterval(tick, 1000);
  }
  document.addEventListener("visibilitychange", onVisibility);

  // --- theme and preferences ----------------------------------------------
  function refreshTheme(): void {
    theme = readTheme(host);
    engine.setTheme(theme);
    engine.setMarkers(buildMarkers());
    engine.setRegions(buildRegions());
  }

  const themeObserver = new MutationObserver(refreshTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  /* `gmt-a11y.css` zeroes the atmosphere, haze and imagery tokens under these
     preferences, and the renderer only sees a token when the theme is re-read. */
  const preferenceQueries = [
    "(prefers-reduced-transparency: reduce)",
    "(prefers-contrast: more)",
    "(forced-colors: active)",
  ].flatMap((query) => globalThis.matchMedia?.(query) ?? []);
  for (const query of preferenceQueries) {
    query.addEventListener("change", refreshTheme);
  }

  // --- start ---------------------------------------------------------------
  engine.setMarkers(buildMarkers());
  revealCanvas(host, zoomControls);
  releaseClocks({ delayMs: 80 });
  void loadBoundaries();
  if (defaultZone) setSelected(defaultZone);

  return {
    focusZone,
    selectZone: setSelected,
    setZoom: (value) => engine.setZoom(value),
    zoomBy: (factor) => engine.zoomBy(factor),
    getZoom: () => engine.getZoom(),
    getZones: () => zones.slice(),
    getSelected: () => selectedId,
    onSelect(callback) {
      selectCallback = callback;
    },
    getRenderer: () => engine.renderer,
    destroy() {
      clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
      for (const query of preferenceQueries) {
        query.removeEventListener("change", refreshTheme);
      }
      zoneClockList?.destroy();
      filterUi?.destroy();
      engine.destroy();
      tooltip.remove();
    },
  };
}

/**
 * The first-frame reveal.
 *
 * The canvas is drawn while still hidden, so the shared entrance (`enter()`,
 * `.gmt-enter`) is the viewer's first sight of the globe rather than a raw
 * pop-in. The `gmt-globe-zoom-ready` class does not itself show the zoom
 * controls — they fade in on hover or focus — it arms them, so they cannot
 * flash into view mid-reveal because the pointer happened to be over the
 * stage. `enter()` arms them at once under reduced motion, and its timer arms
 * them even if animationend never comes: the controls are the keyboard and
 * touch path to zoom, so losing them is losing the feature.
 */
function revealCanvas(
  host: HTMLElement,
  zoomControls: HTMLElement | null,
): void {
  const canvas = host.querySelector<HTMLCanvasElement>(
    "canvas.gmt-globe-canvas",
  );
  if (!canvas) return;
  requestAnimationFrame(() => {
    enter(canvas, {
      onEntered: () => zoomControls?.classList.add("gmt-globe-zoom-ready"),
    });
  });
}

/**
 * `?globe=webgpu` or `?globe=canvas2d` pins the backend.
 *
 * Only for verification — `scripts/globe-smoke.mjs` uses it to render the same
 * frame through both and compare. Anything else, including no parameter at all,
 * leaves the engine to choose.
 */
function rendererOverride(): RendererChoice {
  try {
    const value = new URLSearchParams(globalThis.location?.search ?? "").get(
      "globe",
    );
    if (value === "webgpu" || value === "canvas2d") return value;
  } catch {
    // No location (a test environment, a worker): take the default.
  }
  return "auto";
}

/** The current epoch-ms. `getUnixNow` returns null only for a clock it cannot
 *  read, so the fallback never renders in practice. */
function nowMs(): number {
  return getUnixNow() ?? 0;
}

function shortLabel(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return tail.replace(/_/g, " ");
}

/**
 * The label font, taken from the site's own mono token.
 *
 * 12px, not the 10px the canvas-2D globe hard-coded: that was below the site's
 * own 12px floor, and `font-floor.test.ts` missed it only because its patterns
 * never looked at a canvas `font` assignment. Both are fixed.
 */
function labelFont(host: HTMLElement): string {
  const style = getComputedStyle(host);
  const family =
    style.getPropertyValue("--gmt-font-mono").trim() ||
    'ui-monospace, "JetBrains Mono", "SFMono-Regular", monospace';
  return `600 12px ${family}`;
}

/** The Dox globe's colours, read from the site's CSS custom properties. */
interface DoxTheme extends GlobeTheme {
  markerPrimary: Rgba;
  markerOther: Rgba;
  markerNightPrimary: Rgba;
  markerNightOther: Rgba;
  markerSelected: Rgba;
  regionFill: Rgba;
  regionStroke: Rgba;
}

/**
 * Build the theme from `--gmt-*` tokens.
 *
 * Re-read rather than cached, because `data-theme` flips them, and
 * `gmt-a11y.css` zeroes the atmosphere and haze alphas under reduced
 * transparency and raised contrast, and the imagery under raised contrast and
 * forced colours.
 */
function readTheme(host: HTMLElement): DoxTheme {
  const style = getComputedStyle(host);
  const token = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  const number = (name: string, fallback: number): number => {
    const parsed = Number.parseFloat(token(name, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const colour = (name: string, fallback: string, alpha: number): Rgba => {
    const [r, g, b, a] = parseColour(token(name, fallback)) ?? [1, 1, 1, 1];
    return [r, g, b, a * alpha];
  };

  const cyan = "--gmt-cyan";
  /* The overlay inks are the same in both themes: every marker, ring, label
     and outline sits on the dark casing (globe/casing.ts), so it is the casing
     they contrast with, not the page. */
  const ink = "--gmt-globe-ink";
  const selected = "--gmt-globe-selected";
  return {
    ocean: colour(
      "--gmt-teal",
      "#0e7490",
      number("--gmt-globe-ocean-alpha", 0.05),
    ),
    limb: colour(cyan, "#22d3ee", 0.4),
    grid: colour(cyan, "#22d3ee", number("--gmt-globe-grid-alpha", 0.18)),
    land: colour(cyan, "#22d3ee", number("--gmt-globe-land-alpha", 0.12)),
    landStroke: colour(cyan, "#22d3ee", 0.45),
    day: colour(cyan, "#22d3ee", number("--gmt-globe-day-alpha", 0.26)),
    night: colour(
      "--gmt-globe-night",
      "#03080c",
      number("--gmt-globe-night-alpha", 0.5),
    ),
    atmosphere: colour(
      cyan,
      "#22d3ee",
      number("--gmt-globe-atmosphere-alpha", 0.42),
    ),
    haze: colour(cyan, "#22d3ee", number("--gmt-globe-haze-alpha", 0.2)),
    label: colour(ink, "#cfeaf2", LABEL_ALPHA),
    casing: colour(
      "--gmt-globe-casing",
      "#03080c",
      number("--gmt-globe-casing-alpha", 0.9),
    ),
    imagery: Math.min(Math.max(number("--gmt-globe-imagery-alpha", 1), 0), 1),
    vectorOverlay: Math.min(
      Math.max(number("--gmt-globe-vector-overlay", 0), 0),
      1,
    ),
    imageryDuotone: Math.min(
      Math.max(number("--gmt-globe-imagery-duotone", 0), 0),
      1,
    ),
    markerPrimary: colour("--gmt-globe-marker", "#22d3ee", 1),
    markerOther: colour(ink, "#cfeaf2", MINOR_MARKER_ALPHA),
    markerNightPrimary: colour("--gmt-globe-gold", "#fde047", 1),
    markerNightOther: colour("--gmt-globe-gold", "#fde047", MINOR_MARKER_ALPHA),
    markerSelected: colour(selected, "#4ade80", 1),
    regionFill: colour(selected, "#4ade80", 0.12),
    regionStroke: colour(selected, "#4ade80", 1),
  };
}

/**
 * Any CSS colour to `[r, g, b, a]` with channels in 0..1.
 *
 * Hex is handled directly, since every `--gmt-*` colour token is hex today. A
 * 2D canvas parses anything else: assigning to `fillStyle` and reading it back
 * gives a normalised value, which means a token written as `rgb()`, `hsl()` or
 * `oklch()` keeps working. The canvas-2D globe parsed hex only and silently
 * passed anything else through to a draw call, so a token in another notation
 * would have worked there and broken here.
 */
export function parseColour(value: string): Rgba | null {
  const hex = parseHex(value);
  if (hex) return hex;

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  /* An unparsable value leaves `fillStyle` at its default, so seeding it with a
     colour nothing resolves to makes "did not parse" detectable. */
  probe.fillStyle = "#010203";
  probe.fillStyle = value;
  const normalised = probe.fillStyle;
  if (typeof normalised !== "string" || normalised === "#010203") return null;
  return parseHex(normalised) ?? parseRgbFunction(normalised);
}

function parseHex(value: string): Rgba | null {
  const match = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
  if (!match) return null;
  const digits = match[1];
  const expand = (part: string): number => Number.parseInt(part, 16) / 255;
  if (digits.length === 3 || digits.length === 4) {
    const parts = digits.split("").map((c) => expand(c + c));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  if (digits.length === 6 || digits.length === 8) {
    const parts: number[] = [];
    for (let i = 0; i < digits.length; i += 2) {
      parts.push(expand(digits.slice(i, i + 2)));
    }
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  return null;
}

function parseRgbFunction(value: string): Rgba | null {
  const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (!match) return null;
  /* A canvas normalises to `rgba(r, g, b, a)` with 0-255 channels and a 0-1
     alpha, so there are no percentages to handle here. */
  const parts = match[1]
    .split(/[\s,/]+/)
    .filter((part) => part.length > 0)
    .map((part) => Number.parseFloat(part));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part)))
    return null;
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts[3] ?? 1];
}
