/**
 * DOX-E1a — the interactive globe.
 *
 * Rendering approach: `d3-geo` `geoOrthographic` drawn to a `<canvas>`. Not
 * WebGL. The decision, the alternatives weighed, and the criteria for
 * revisiting it are recorded in
 * `context/dox/reference/findings/globe-rendering-approach.md`. In short:
 * SVG/canvas orthographic gives draggable rotation, scroll-wheel zoom,
 * hit-testing and a `prefers-reduced-motion` / no-WebGL story essentially for
 * free, at ~1/5 the JS weight of a three.js scene, and the site's aesthetic is
 * a "futuristic grid globe", not a photoreal sphere.
 *
 * Canvas (not SVG) because the globe must stay smooth under continuous drag,
 * inertia, ambient spin and zoom — re-projecting the land mesh every frame is
 * cheaper to a canvas context than diffing thousands of SVG path nodes.
 *
 * Entry point: `initGlobe(host, clockPanel)` — positional host element, matching
 * `initTimezoneMap` so DOX-C3b's widget registry (`showGlobe`) mounts it with no
 * adapter.
 *
 * Live times/offsets/DST come from `@northguild/gmt` via `./zone-clock` — never
 * `@js-temporal/polyfill` directly.
 */

import {
  geoCircle,
  geoContains,
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import { feature } from "topojson-client";
import { getUnixNow } from "@northguild/gmt/unix/get";
import { getSystemTimeZone, getTimeZones } from "@northguild/gmt/zoned/get";
import land110m from "world-atlas/land-110m.json";
import { antisolarPoint } from "./globe-terminator";
import {
  COORDINATES_BY_ID,
  resolveGlobeZones,
  rotationForZone,
  type GlobeZone,
} from "./globe-zones";
import { readZoneNow, type ZoneReading } from "./zone-clock";
import { mountZoneClockList } from "./zone-clock-list";

export interface GlobeHost {
  /** Rotate the globe to bring a zone to centre and select it. */
  focusZone: (id: string) => void;
  /** Select (or clear) a zone without moving the globe. */
  selectZone: (id: string | null) => void;
  /** Absolute zoom, clamped to [MIN_ZOOM, MAX_ZOOM]. */
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
  destroy: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const IDLE_MS = 2500;
const AMBIENT_DEG_PER_MS = 0.004;
const FRICTION_PER_16MS = 0.94;
const MIN_OMEGA = 0.0004; // deg/ms — below this, inertia stops
const HIT_RADIUS_PX = 14;

type TopologyLike = Parameters<typeof feature>[0];
const topology = land110m as unknown as TopologyLike;
const topologyObjects = (topology as { objects: Record<string, unknown> })
  .objects;
const landObject = topologyObjects.land as Parameters<typeof feature>[1];
const land = feature(topology, landObject) as unknown as GeoPermissibleObjects;
const graticule = geoGraticule10() as unknown as GeoPermissibleObjects;
const sphere = { type: "Sphere" } as unknown as GeoPermissibleObjects;

interface Palette {
  /**
   * The day/night terminator's night-side tint. Deliberately its own token
   * (`--gmt-globe-night`, not `--gmt-void`) — `--gmt-void` is a background
   * *role* that flips to white in the light theme, which made night render
   * lighter than day and wash out to a flat grey instead of a dark sky.
   * Night must stay dark regardless of which theme the site is in.
   */
  night: string;
  cyan: string;
  spring: string;
  teal: string;
  ice: string;
  signal: string;
  /**
   * Fill alpha for the ocean (sphere) and land washes. The same low alpha
   * that reads clearly against the dark theme's near-black surface washes
   * out to almost nothing against the light theme's pale one, so these are
   * theme-tuned tokens rather than fixed numbers — see `--gmt-globe-*-alpha`
   * in gmt-globe.css.
   */
  oceanAlpha: number;
  landAlpha: number;
}

function readPalette(el: HTMLElement): Palette {
  const style = getComputedStyle(el);
  const pick = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  const pickNumber = (name: string, fallback: number): number => {
    const parsed = Number.parseFloat(pick(name, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    night: pick("--gmt-globe-night", "#03080c"),
    cyan: pick("--gmt-cyan", "#22d3ee"),
    spring: pick("--gmt-spring", "#4ade80"),
    teal: pick("--gmt-teal", "#0e7490"),
    ice: pick("--gmt-ice", "#cfeaf2"),
    signal: pick("--gmt-signal", "#f5a524"),
    oceanAlpha: pickNumber("--gmt-globe-ocean-alpha", 0.07),
    landAlpha: pickNumber("--gmt-globe-land-alpha", 0.12),
  };
}

/** `#rrggbb` (or `#rgb`) + alpha -> `rgba(...)`, leaving non-hex values alone. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (full.length !== 6) return color;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export async function initGlobe(
  host: HTMLElement,
  clockPanel: HTMLElement | null,
): Promise<GlobeHost> {
  const reduceMotion = globalThis.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  );

  const zones = resolveGlobeZones(getTimeZones());

  // Default to the viewer's own zone when we can place it.
  const systemZone = getSystemTimeZone();
  const defaultZone =
    systemZone && zones.some((zone) => zone.id === systemZone)
      ? systemZone
      : null;
  const defaultRotation = defaultZone
    ? rotationForZone(COORDINATES_BY_ID.get(defaultZone)!)
    : ([-10, -15] as [number, number]);

  const canvas = document.createElement("canvas");
  canvas.className = "gmt-globe-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "Interactive globe. Drag to rotate, scroll to zoom. Use the zone list to read a zone's live time.",
  );
  host.appendChild(canvas);

  const tooltip = document.createElement("div");
  tooltip.className = "gmt-globe-tooltip";
  tooltip.hidden = true;
  host.appendChild(tooltip);

  const context = canvas.getContext("2d");
  if (!context) {
    // Canvas 2D unavailable: leave the clock panel (populated by the caller)
    // as the usable fallback and no-op the rest.
    return inertHost(zones);
  }
  const ctx = context;

  const projection = geoOrthographic().clipAngle(90).precision(0.4);

  // --- mutable state -------------------------------------------------------
  let palette = readPalette(host);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let baseScale = 1;

  let rotation: [number, number] = [defaultRotation[0], defaultRotation[1]];
  let zoom = 1;
  let targetZoom = 1;

  let dragging = false;
  let lastPointer: { x: number; y: number; t: number } | null = null;
  let omega: [number, number] = [0, 0]; // deg/ms, drives inertia
  let inertiaActive = false;

  let ambientActive = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  let focusGoal: [number, number] | null = null;

  let selectedId: string | null = null;
  let selectedReading: ZoneReading | null = null;
  let selectCallback: ((reading: ZoneReading | null) => void) | null = null;

  /** tzid -> boundary geometry, fetched lazily after the globe is interactive. */
  let boundaries: Map<string, GeoPermissibleObjects> | null = null;

  let frameHandle = 0;
  let hovered = false;
  let destroyed = false;

  // --- sizing ------------------------------------------------------------
  function measure(): void {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    // Leave a small margin so the whole sphere shows at zoom 1.
    baseScale = (Math.min(width, height) / 2) * 0.94;
    render();
  }

  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(host);

  // --- rendering -------------------------------------------------------
  function nightGeometry(): GeoPermissibleObjects {
    const { lat, lng } = antisolarPoint(getUnixNow());
    return geoCircle().center([lng, lat]).radius(90)() as GeoPermissibleObjects;
  }

  /** Map an IANA id to the boundary dataset's `tzid` value. */
  function boundaryKey(id: string): string {
    return id === "UTC" ? "Etc/UTC" : id;
  }

  async function loadBoundaries(): Promise<void> {
    try {
      const response = await fetch("/timezone-boundaries-globe.json");
      if (!response.ok) return;
      const data = (await response.json()) as {
        features: {
          properties: { tzid: string };
          geometry: GeoPermissibleObjects;
        }[];
      };
      const map = new Map<string, GeoPermissibleObjects>();
      for (const feature of data.features) {
        if (feature?.properties?.tzid) {
          map.set(feature.properties.tzid, feature.geometry);
        }
      }
      boundaries = map;
      render();
    } catch {
      // The globe is fully usable without the demarcation outlines.
    }
  }

  function render(): void {
    if (destroyed) return;
    projection
      .rotate([rotation[0], rotation[1]])
      .scale(baseScale * zoom)
      .translate([width / 2, height / 2]);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const path = geoPath(projection, ctx);
    const quiet = dragging || inertiaActive;

    ctx.beginPath();
    path(sphere);
    ctx.fillStyle = withAlpha(palette.teal, palette.oceanAlpha);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(palette.cyan, 0.4);
    ctx.stroke();

    // Day/night terminator: painted right after the sphere base and before
    // the grid/land/highlight/dots, so the night side is a dark backdrop
    // those draw *over* — not a wash that gets painted over them and hides
    // them. `palette.night` is a fixed dark tone (not `--gmt-void`, which
    // flips to white in the light theme) so night stays darker than day in
    // every theme.
    ctx.beginPath();
    path(nightGeometry());
    ctx.fillStyle = withAlpha(palette.night, 0.5);
    ctx.fill();

    ctx.beginPath();
    path(graticule);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = withAlpha(palette.cyan, quiet ? 0.1 : 0.18);
    ctx.stroke();

    ctx.beginPath();
    path(land);
    ctx.fillStyle = withAlpha(palette.cyan, palette.landAlpha);
    ctx.fill();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = withAlpha(palette.cyan, 0.45);
    ctx.stroke();

    // Timezone demarcation: the selected zone's own area, outlined in green
    // and lightly washed. Only the selected zone — not every border on the
    // globe.
    if (boundaries && selectedId) {
      const selectedGeometry = boundaries.get(boundaryKey(selectedId));
      if (selectedGeometry) {
        ctx.beginPath();
        path(selectedGeometry);
        ctx.fillStyle = withAlpha(palette.spring, 0.12);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = palette.spring;
        ctx.stroke();
      }
    }

    const centre: [number, number] = [-rotation[0], -rotation[1]];
    for (const zone of zones) {
      if (geoDistance([zone.lng, zone.lat], centre) > Math.PI / 2) continue;
      const point = projection([zone.lng, zone.lat]);
      if (!point) continue;
      const isSelected = zone.id === selectedId;
      // Every dot here is a real, resolvable IANA zone (resolveGlobeZones only
      // plots the intersection of getTimeZones() with the coordinate table) —
      // the non-primary majority is just unlabelled, not fake. Sized up from
      // 1.6px so a zone outside the curated set is still an easy click target.
      const radius = isSelected ? 4 : zone.primary ? 3 : 2.2;
      ctx.beginPath();
      ctx.arc(point[0], point[1], radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected
        ? palette.spring
        : zone.primary
          ? palette.cyan
          : withAlpha(palette.ice, 0.55);
      ctx.fill();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 8, 0, Math.PI * 2);
        ctx.strokeStyle = palette.spring;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (zone.primary && !quiet && zoom < 2.5) {
        ctx.fillStyle = withAlpha(palette.ice, 0.75);
        ctx.font =
          '600 10px ui-monospace, "JetBrains Mono", "SFMono-Regular", monospace';
        ctx.fillText(shortLabel(zone.id), point[0] + 6, point[1] + 3);
      }
    }
    ctx.restore();
    positionTooltip();
  }

  // --- animation loop -------------------------------------------------
  function needsFrame(): boolean {
    return (
      dragging ||
      inertiaActive ||
      ambientActive ||
      focusGoal !== null ||
      Math.abs(targetZoom - zoom) > 0.001
    );
  }

  function scheduleFrame(): void {
    if (destroyed || frameHandle || document.hidden) return;
    frameHandle = requestAnimationFrame(step);
  }

  let lastStep = 0;
  function step(now: number): void {
    frameHandle = 0;
    const dt = lastStep ? Math.min(now - lastStep, 48) : 16;
    lastStep = now;

    if (Math.abs(targetZoom - zoom) > 0.001) {
      zoom += (targetZoom - zoom) * (reduceMotion?.matches ? 1 : 0.2);
    } else {
      zoom = targetZoom;
    }

    if (focusGoal) {
      const ease = reduceMotion?.matches ? 1 : 0.16;
      rotation = [
        rotation[0] + shortestAngle(rotation[0], focusGoal[0]) * ease,
        rotation[1] + (focusGoal[1] - rotation[1]) * ease,
      ];
      if (
        Math.abs(shortestAngle(rotation[0], focusGoal[0])) < 0.1 &&
        Math.abs(focusGoal[1] - rotation[1]) < 0.1
      ) {
        rotation = [normalizeLng(focusGoal[0]), focusGoal[1]];
        focusGoal = null;
      }
    } else if (inertiaActive) {
      rotation = [
        normalizeLng(rotation[0] + omega[0] * dt),
        clampLat(rotation[1] + omega[1] * dt),
      ];
      const decay = FRICTION_PER_16MS ** (dt / 16);
      omega = [omega[0] * decay, omega[1] * decay];
      if (Math.hypot(omega[0], omega[1]) < MIN_OMEGA) {
        inertiaActive = false;
        omega = [0, 0];
      }
    } else if (ambientActive) {
      rotation = [
        normalizeLng(rotation[0] + AMBIENT_DEG_PER_MS * dt),
        rotation[1],
      ];
    }

    render();
    if (needsFrame()) scheduleFrame();
    else lastStep = 0;
  }

  // --- idle / ambient -------------------------------------------------
  function markInteraction(): void {
    ambientActive = false;
    if (idleTimer) clearTimeout(idleTimer);
    if (reduceMotion?.matches) return;
    idleTimer = setTimeout(() => {
      if (
        dragging ||
        hovered ||
        inertiaActive ||
        focusGoal ||
        Math.abs(targetZoom - 1) > 0.01
      )
        return;
      ambientActive = true;
      lastStep = 0;
      scheduleFrame();
    }, IDLE_MS);
  }

  // --- pointer / drag ------------------------------------------------
  let pointerDownAt: { x: number; y: number } | null = null;

  function onPointerDown(event: PointerEvent): void {
    dragging = true;
    inertiaActive = false;
    focusGoal = null;
    omega = [0, 0];
    lastPointer = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    pointerDownAt = { x: event.clientX, y: event.clientY };
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Some input stacks (and any programmatically-dispatched pointer
      // event) have no live pointer to capture — dragging and tap-to-select
      // both still work without it.
    }
    markInteraction();
    scheduleFrame();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging || !lastPointer) return;
    const k = 90 / (baseScale * zoom);
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    const dtMs = Math.max(event.timeStamp - lastPointer.t, 1);
    rotation = [
      normalizeLng(rotation[0] + dx * k),
      clampLat(rotation[1] - dy * k),
    ];
    if (!reduceMotion?.matches) {
      omega = [(dx * k) / dtMs, (-dy * k) / dtMs];
    }
    lastPointer = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    scheduleFrame();
  }

  function onPointerUp(event: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // Capture may already be gone (never granted, or released by the
      // browser already) — releasing it is best-effort, never load-bearing
      // for the tap-to-select handling below.
    }
    const moved = pointerDownAt
      ? Math.hypot(
          event.clientX - pointerDownAt.x,
          event.clientY - pointerDownAt.y,
        )
      : 0;
    if (
      !reduceMotion?.matches &&
      Math.hypot(omega[0], omega[1]) > MIN_OMEGA * 3
    ) {
      inertiaActive = true;
    }
    lastPointer = null;
    pointerDownAt = null;
    // A tap (no meaningful drag) is a selection attempt.
    if (moved < 5) hitTest(event.clientX, event.clientY);
    markInteraction();
    scheduleFrame();
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    targetZoom = clampZoom(targetZoom * factor);
    markInteraction();
    scheduleFrame();
  }

  function hitTest(clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const centre: [number, number] = [-rotation[0], -rotation[1]];
    let best: string | null = null;
    let bestDist = HIT_RADIUS_PX;
    for (const zone of zones) {
      if (geoDistance([zone.lng, zone.lat], centre) > Math.PI / 2) continue;
      const point = projection([zone.lng, zone.lat]);
      if (!point) continue;
      const dist = Math.hypot(point[0] - x, point[1] - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = zone.id;
      }
    }
    // No dot was close enough — fall back to the zone whose actual drawn
    // boundary the click landed inside, so a tap anywhere in, say, Brazil
    // selects America/Sao_Paulo even nowhere near its marker. Only zones with
    // boundary geometry (the 419-zone demarcation dataset) support this; the
    // rest are still reachable by their dot or the search box.
    if (best === null && boundaries) {
      const geoPoint = projection.invert?.([x, y]);
      if (geoPoint) {
        for (const zone of zones) {
          const geometry = boundaries.get(boundaryKey(zone.id));
          if (geometry && geoContains(geometry, geoPoint)) {
            best = zone.id;
            break;
          }
        }
      }
    }
    setSelected(best);
  }

  // --- selection / tooltip ------------------------------------------
  function setSelected(id: string | null): void {
    selectedId = id;
    selectedReading = id ? readZoneNow(id) : null;
    renderTooltip();
    zoneClockList?.select(id);
    selectCallback?.(selectedReading);
    render();
  }

  function focusZoneImpl(id: string): void {
    const coord = COORDINATES_BY_ID.get(id);
    if (!coord) return;
    focusGoal = rotationForZone(coord);
    inertiaActive = false;
    setSelected(id);
    markInteraction();
    scheduleFrame();
  }

  function renderTooltip(): void {
    if (!selectedId || !selectedReading) {
      tooltip.hidden = true;
      return;
    }
    const r = selectedReading;
    tooltip.hidden = false;
    if (!r.ok) {
      tooltip.innerHTML = `<span class="gmt-globe-tooltip-zone">${escapeHtml(
        selectedId,
      )}</span><span class="gmt-signal-lost">⟨ NO SIGNAL — zone unavailable ⟩</span>`;
      return;
    }
    const dst = !r.observesDst
      ? "no DST"
      : r.inDst
        ? "in DST"
        : "standard time";
    tooltip.innerHTML =
      `<span class="gmt-globe-tooltip-zone">${escapeHtml(selectedId)}</span>` +
      `<span class="gmt-globe-tooltip-time">${r.time}</span>` +
      `<span class="gmt-globe-tooltip-meta">UTC${r.offset} · ${dst}</span>`;
  }

  function positionTooltip(): void {
    if (tooltip.hidden || !selectedId) return;
    const coord = COORDINATES_BY_ID.get(selectedId);
    if (!coord) return;
    const centre: [number, number] = [-rotation[0], -rotation[1]];
    if (geoDistance([coord.lng, coord.lat], centre) > Math.PI / 2) {
      tooltip.style.opacity = "0.35";
      return;
    }
    tooltip.style.opacity = "1";
    const point = projection([coord.lng, coord.lat]);
    if (!point) return;
    // Clamp inside the (overflow-hidden) stage; flip below the point when it
    // would otherwise be clipped at the top edge.
    const pad = 8;
    const x = Math.min(
      Math.max(point[0], tooltip.offsetWidth / 2 + pad),
      width - tooltip.offsetWidth / 2 - pad,
    );
    const flip = point[1] - tooltip.offsetHeight - 16 < 0;
    tooltip.classList.toggle("gmt-globe-tooltip-below", flip);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${point[1] + (flip ? 12 : 0)}px`;
  }

  // --- keyboard ----------------------------------------------------
  function onKeyDown(event: KeyboardEvent): void {
    const stepDeg = 12 / zoom;
    switch (event.key) {
      case "ArrowLeft":
        rotation = [normalizeLng(rotation[0] + stepDeg), rotation[1]];
        break;
      case "ArrowRight":
        rotation = [normalizeLng(rotation[0] - stepDeg), rotation[1]];
        break;
      case "ArrowUp":
        rotation = [rotation[0], clampLat(rotation[1] + stepDeg)];
        break;
      case "ArrowDown":
        rotation = [rotation[0], clampLat(rotation[1] - stepDeg)];
        break;
      case "+":
      case "=":
        targetZoom = clampZoom(targetZoom * 1.3);
        break;
      case "-":
        targetZoom = clampZoom(targetZoom / 1.3);
        break;
      default:
        return;
    }
    event.preventDefault();
    focusGoal = null;
    inertiaActive = false;
    markInteraction();
    scheduleFrame();
  }

  // --- clock panel: virtualized zone list, ticking "now" strings -----
  const zoneClockList = clockPanel
    ? mountZoneClockList(
        clockPanel,
        zones.map((zone) => zone.id),
        focusZoneImpl,
      )
    : null;

  function tickClocks(): void {
    if (destroyed || document.hidden) return;
    zoneClockList?.tick();
    if (selectedId) {
      selectedReading = readZoneNow(selectedId);
      renderTooltip();
    }
    render(); // moves the terminator
  }
  let clockTimer = setInterval(tickClocks, 1000);

  // --- visibility --------------------------------------------------
  function onVisibility(): void {
    if (document.hidden) {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      clearInterval(clockTimer);
      if (idleTimer) clearTimeout(idleTimer);
    } else {
      clockTimer = setInterval(tickClocks, 1000);
      lastStep = 0;
      render();
      markInteraction();
    }
  }

  // --- theme changes ---------------------------------------------
  const themeObserver = new MutationObserver(() => {
    palette = readPalette(host);
    render();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // --- wire up --------------------------------------------------
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointerenter", () => {
    hovered = true;
    ambientActive = false;
  });
  canvas.addEventListener("pointerleave", () => {
    hovered = false;
    markInteraction();
  });
  document.addEventListener("visibilitychange", onVisibility);

  measure();
  markInteraction();
  void loadBoundaries();
  if (defaultZone) setSelected(defaultZone);

  return {
    focusZone: focusZoneImpl,
    selectZone: setSelected,
    setZoom(value: number) {
      targetZoom = clampZoom(value);
      markInteraction();
      scheduleFrame();
    },
    zoomBy(factor: number) {
      targetZoom = clampZoom(targetZoom * factor);
      markInteraction();
      scheduleFrame();
    },
    getZoom: () => zoom,
    getZones: () => zones.slice(),
    getSelected: () => selectedId,
    onSelect(callback) {
      selectCallback = callback;
    },
    destroy() {
      destroyed = true;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      if (idleTimer) clearTimeout(idleTimer);
      clearInterval(clockTimer);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      zoneClockList?.destroy();
      canvas.remove();
      tooltip.remove();
    },
  };
}

// --- helpers ---------------------------------------------------------
function inertHost(zones: GlobeZone[]): GlobeHost {
  return {
    focusZone: () => {},
    selectZone: () => {},
    setZoom: () => {},
    zoomBy: () => {},
    getZoom: () => 1,
    getZones: () => zones.slice(),
    getSelected: () => null,
    onSelect: () => {},
    destroy: () => {},
  };
}

function shortLabel(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return tail.replace(/_/g, " ");
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function clampLat(lat: number): number {
  return Math.min(90, Math.max(-90, lat));
}

function normalizeLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** Signed shortest angular delta from `a` to `b`, in degrees. */
function shortestAngle(a: number, b: number): number {
  return normalizeLng(b - a);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}
