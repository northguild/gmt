/**
 * The canvas-2D fallback renderer (#289).
 *
 * This is the drawing code the globe shipped with before it moved to WebGPU,
 * moved behind the `GlobeRenderer` interface and otherwise left alone. It runs
 * only where `navigator.gpu` is missing or the GPU backend fails to start, and
 * the shell loads it through a dynamic `import()`, so a browser with WebGPU
 * never downloads it — nor `d3-geo`, `topojson-client` or `world-atlas`, which
 * this directory is the last globe code to use.
 *
 * **Deleting this is one step:** remove this directory and the `import()` in
 * `../engine.ts`. Nothing else in `globe/` imports it, and the tests that cover
 * it are in here too. That is the whole reason it is a directory of its own
 * rather than a branch inside the renderer.
 *
 * ## Deliberately not modernised
 *
 * It keeps d3's projection rather than `../camera.ts`, and d3's `geoPath`
 * rather than `../geometry.ts`. Both would work, and the drawn result would move
 * by a fraction of a pixel — which is exactly what a fallback must not do, since
 * this is the picture the WebGPU renderer is compared against for parity and the
 * one the site's visual gate has baselines for. The engine still uses the shared
 * camera for hit-testing and tooltip placement on both paths, so the parts a
 * reader can *interact* with agree regardless of which renderer is running.
 */

import {
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import { feature } from "topojson-client";
import land110m from "world-atlas/land-110m.json";
import { cityLightsOn, paintShading, type Rgb } from "../shading";
import type { FrameState, GlobeRenderer, RendererInit } from "../renderer";
import type { GlobeArc, GlobeMarker, GlobeRegion, Rgba } from "../types";
import { greatCirclePoints } from "../geometry";

type TopologyLike = Parameters<typeof feature>[0];
const topology = land110m as unknown as TopologyLike;
const topologyObjects = (topology as { objects: Record<string, unknown> })
  .objects;
const landObject = topologyObjects.land as Parameters<typeof feature>[1];
const land = feature(topology, landObject) as unknown as GeoPermissibleObjects;
const graticule = geoGraticule10() as unknown as GeoPermissibleObjects;
const sphere = { type: "Sphere" } as unknown as GeoPermissibleObjects;

/** Grid lines dim to this fraction while dragging or coasting. */
const GRID_QUIET_FACTOR = 0.56;

/** How far the atmosphere glow reaches past the limb, as a multiple of R. */
const ATMOSPHERE_REACH = 1.06;

/** Share of the glow the night limb keeps, so the ring never vanishes. */
const ATMOSPHERE_NIGHT_FLOOR = 0.15;

/** How much brighter the ring gets with the sun straight behind the globe. */
const ATMOSPHERE_BACKLIGHT = 0.8;

/** The shading buffer's resolution per CSS pixel. */
const SHADE_RESOLUTION = 0.5;

/** Above this zoom, marker labels are dropped as clutter. */
const LABEL_MAX_ZOOM = 2.5;

/** `Rgba` (0..1 channels) to a canvas colour string. */
function css(color: Rgba, alphaScale = 1): string {
  const r = Math.round(color[0] * 255);
  const g = Math.round(color[1] * 255);
  const b = Math.round(color[2] * 255);
  return `rgba(${r}, ${g}, ${b}, ${color[3] * alphaScale})`;
}

/** `Rgba` to the 0..255 triple `paintShading` takes. */
function rgb(color: Rgba): Rgb {
  return [
    Math.round(color[0] * 255),
    Math.round(color[1] * 255),
    Math.round(color[2] * 255),
  ];
}

/** A region's rings as something `geoPath` will draw. */
function regionGeometry(region: GlobeRegion): GeoPermissibleObjects {
  return {
    type: "MultiPolygon",
    coordinates: region.polygons.map((polygon) =>
      polygon.map((ring) => ring.map((point) => [point[0], point[1]])),
    ),
  } as unknown as GeoPermissibleObjects;
}

export async function createCanvas2dRenderer(
  init: RendererInit,
): Promise<GlobeRenderer> {
  const canvas = document.createElement("canvas");
  canvas.className = "gmt-globe-canvas";
  canvas.dataset.renderer = "canvas2d";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", init.ariaLabel);

  const context = canvas.getContext("2d");
  if (!context) {
    /* No 2D context either. Rejecting rather than returning something inert is
       what lets the shell tell the reader the globe is unavailable — the old
       code returned a silent no-op host here, which left live-looking controls
       that did nothing and a zone list that never mounted. */
    throw new Error("canvas 2D is unavailable");
  }
  const ctx = context;

  const projection = geoOrthographic().clipAngle(90).precision(0.4);

  let theme = init.theme;
  const labelFont = init.labelFont;
  let width = 1;
  let height = 1;
  let dpr = 1;
  let regions: readonly GlobeRegion[] = [];
  let markers: readonly GlobeMarker[] = [];
  let arcs: readonly GlobeArc[] = [];
  let destroyed = false;

  init.host.appendChild(canvas);

  // --- offscreen shading buffer -------------------------------------------
  const shadeCanvas = document.createElement("canvas");
  const shadeCtx = shadeCanvas.getContext("2d");
  let shadeImage: ImageData | null = null;
  let shadeKey = "";

  function drawShading(
    path: ReturnType<typeof geoPath>,
    cx: number,
    cy: number,
    radius: number,
    sun: readonly [number, number, number],
    moving: boolean,
  ): void {
    if (!shadeCtx) return;
    const shadeWidth = Math.max(1, Math.ceil(width * SHADE_RESOLUTION));
    const shadeHeight = Math.max(1, Math.ceil(height * SHADE_RESOLUTION));
    if (
      !shadeImage ||
      shadeImage.width !== shadeWidth ||
      shadeImage.height !== shadeHeight
    ) {
      shadeCanvas.width = shadeWidth;
      shadeCanvas.height = shadeHeight;
      shadeImage = shadeCtx.createImageData(shadeWidth, shadeHeight);
    }
    const scaleX = shadeWidth / width;
    const scaleY = shadeHeight / height;
    /* The sun drifts ~0.004° a second, so rounding its vector repaints the
       buffer on roughly one clock tick in 14 while the globe is still. In motion
       the screen vector moves every frame regardless, so the rounding widens and
       most frames reuse the buffer. */
    const precision = moving ? 2 : 3;
    const key = [
      shadeWidth,
      shadeHeight,
      cx,
      cy,
      radius,
      ...sun.map((n) => n.toFixed(precision)),
      ...theme.day,
      ...theme.night,
      theme.haze[3],
    ].join("|");
    if (key !== shadeKey) {
      shadeKey = key;
      paintShading(shadeImage.data, {
        width: shadeWidth,
        height: shadeHeight,
        cx: cx * scaleX,
        cy: cy * scaleY,
        radius: radius * scaleX,
        sun,
        day: rgb(theme.day),
        night: rgb(theme.night),
        dayAlpha: theme.day[3],
        nightAlpha: theme.night[3],
        hazeAlpha: theme.haze[3],
      });
      shadeCtx.putImageData(shadeImage, 0, 0);
    }

    ctx.save();
    ctx.beginPath();
    path(sphere);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(shadeCanvas, 0, 0, width, height);
    ctx.restore();
  }

  // --- offscreen atmosphere ring ------------------------------------------
  const atmosphereCanvas = document.createElement("canvas");
  const atmosphereCtx = atmosphereCanvas.getContext("2d");
  let atmosphereKey = "";

  function drawAtmosphere(
    cx: number,
    cy: number,
    radius: number,
    sunX: number,
    sunY: number,
    sunZ: number,
    moving: boolean,
  ): void {
    if (!atmosphereCtx) {
      drawAtmosphereDirect(cx, cy, radius, sunZ);
      return;
    }
    const outer = radius * ATMOSPHERE_REACH;
    const size = Math.max(1, Math.ceil(outer * 2 * dpr));
    const precision = moving ? 2 : 3;
    const key = [
      size,
      sunX.toFixed(precision),
      sunY.toFixed(precision),
      sunZ.toFixed(precision),
      ...theme.atmosphere,
    ].join("|");

    if (key !== atmosphereKey) {
      atmosphereKey = key;
      if (atmosphereCanvas.width !== size || atmosphereCanvas.height !== size) {
        atmosphereCanvas.width = size;
        atmosphereCanvas.height = size;
      }
      atmosphereCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      atmosphereCtx.clearRect(0, 0, outer * 2, outer * 2);

      const bufferCx = outer;
      const bufferCy = outer;
      const backlight = 1 + ATMOSPHERE_BACKLIGHT * Math.max(0, -sunZ);
      const glow = atmosphereCtx.createRadialGradient(
        bufferCx,
        bufferCy,
        radius,
        bufferCx,
        bufferCy,
        outer,
      );
      glow.addColorStop(0, css(theme.atmosphere, Math.min(1, backlight)));
      glow.addColorStop(1, css(theme.atmosphere, 0));
      atmosphereCtx.beginPath();
      atmosphereCtx.arc(bufferCx, bufferCy, outer, 0, Math.PI * 2);
      atmosphereCtx.arc(bufferCx, bufferCy, radius, 0, Math.PI * 2, true);
      atmosphereCtx.fillStyle = glow;
      atmosphereCtx.fill("evenodd");

      // Older engines without conic gradients keep an even ring.
      if (typeof atmosphereCtx.createConicGradient === "function") {
        const tilt = Math.min(Math.hypot(sunX, sunY), 1);
        const mask = atmosphereCtx.createConicGradient(
          Math.atan2(sunY, sunX),
          bufferCx,
          bufferCy,
        );
        const steps = 16;
        for (let i = 0; i <= steps; i++) {
          const lit = 0.5 + 0.5 * tilt * Math.cos((i / steps) * Math.PI * 2);
          const strength =
            ATMOSPHERE_NIGHT_FLOOR + (1 - ATMOSPHERE_NIGHT_FLOOR) * lit;
          mask.addColorStop(i / steps, `rgba(0, 0, 0, ${strength})`);
        }
        atmosphereCtx.globalCompositeOperation = "destination-in";
        atmosphereCtx.fillStyle = mask;
        atmosphereCtx.fillRect(0, 0, outer * 2, outer * 2);
        atmosphereCtx.globalCompositeOperation = "source-over";
      }
    }

    ctx.drawImage(
      atmosphereCanvas,
      cx - outer,
      cy - outer,
      outer * 2,
      outer * 2,
    );
  }

  /** Plain radial glow straight onto the canvas, when no buffer is available. */
  function drawAtmosphereDirect(
    cx: number,
    cy: number,
    radius: number,
    sunZ: number,
  ): void {
    const outer = radius * ATMOSPHERE_REACH;
    const backlight = 1 + ATMOSPHERE_BACKLIGHT * Math.max(0, -sunZ);
    const glow = ctx.createRadialGradient(cx, cy, radius, cx, cy, outer);
    glow.addColorStop(0, css(theme.atmosphere, Math.min(1, backlight)));
    glow.addColorStop(1, css(theme.atmosphere, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
    ctx.fillStyle = glow;
    ctx.fill("evenodd");
  }

  function render(frame: FrameState): void {
    if (destroyed) return;
    const { camera, sun, subsolar, quiet, moving } = frame;

    projection
      .rotate([camera.rotation[0], camera.rotation[1]])
      .scale(camera.radius)
      .translate([camera.centreX, camera.centreY]);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const path = geoPath(projection, ctx);
    const cx = camera.centreX;
    const cy = camera.centreY;
    const radius = camera.radius;

    if (theme.atmosphere[3] > 0) {
      drawAtmosphere(cx, cy, radius, sun[0], sun[1], sun[2], moving);
    }

    ctx.beginPath();
    path(sphere);
    ctx.fillStyle = css(theme.ocean);
    ctx.fill();

    /* Painted right after the sphere base and before grid, land and markers, so
       the night side is a backdrop those draw *over* rather than a wash that
       hides them. */
    drawShading(path, cx, cy, radius, sun, moving);

    ctx.beginPath();
    path(sphere);
    ctx.lineWidth = 1;
    ctx.strokeStyle = css(theme.limb);
    ctx.stroke();

    ctx.beginPath();
    path(graticule);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = css(theme.grid, quiet ? GRID_QUIET_FACTOR : 1);
    ctx.stroke();

    ctx.beginPath();
    path(land);
    ctx.fillStyle = css(theme.land);
    ctx.fill();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = css(theme.landStroke);
    ctx.stroke();

    for (const region of regions) {
      const geometry = regionGeometry(region);
      ctx.beginPath();
      path(geometry);
      ctx.fillStyle = css(region.fill);
      ctx.fill();
      ctx.lineWidth = region.strokeWidth;
      ctx.strokeStyle = css(region.stroke);
      ctx.stroke();
    }

    for (const arc of arcs) {
      const points = greatCirclePoints(arc.from, arc.to);
      ctx.beginPath();
      path({
        type: "LineString",
        coordinates: Array.from({ length: points.length / 2 }, (_, i) => [
          points[i * 2],
          points[i * 2 + 1],
        ]),
      } as unknown as GeoPermissibleObjects);
      ctx.lineWidth = arc.width;
      ctx.strokeStyle = css(arc.color);
      ctx.stroke();
    }

    drawMarkers(frame, subsolar, quiet);

    ctx.restore();
  }

  function drawMarkers(
    frame: FrameState,
    subsolar: readonly [number, number],
    quiet: boolean,
  ): void {
    const point: [number, number] = [0, 0];
    const subsolarVec = unit(subsolar[0], subsolar[1]);
    const centre: [number, number] = [
      -frame.camera.rotation[0],
      -frame.camera.rotation[1],
    ];
    const centreVec = unit(centre[0], centre[1]);

    for (const marker of markers) {
      const markerVec = unit(marker.position[0], marker.position[1]);
      if (dot(markerVec, centreVec) < 0) continue;
      point[0] = marker.position[0];
      point[1] = marker.position[1];
      const at = projection(point);
      if (!at) continue;

      /* Night colour from civil dusk, not the horizon: a dot in daylight is not
         a "city light" at all, and the switch matches where the day wash in
         `shading.ts` has finished fading out. */
      const fill =
        marker.nightColor && cityLightsOn(dot(markerVec, subsolarVec))
          ? marker.nightColor
          : marker.color;
      ctx.beginPath();
      ctx.arc(at[0], at[1], marker.radius, 0, Math.PI * 2);
      ctx.fillStyle = css(fill);
      ctx.fill();

      if (marker.ring) {
        ctx.beginPath();
        ctx.arc(at[0], at[1], marker.ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = css(marker.ring.color);
        ctx.lineWidth = marker.ring.width;
        ctx.stroke();
      }

      if (marker.label && !quiet && frame.zoom < LABEL_MAX_ZOOM) {
        ctx.fillStyle = css(theme.label);
        ctx.font = labelFont;
        ctx.fillText(marker.label, at[0] + 6, at[1] + 3);
      }
    }
  }

  return {
    kind: "canvas2d",
    canvas,
    resize(cssWidth, cssHeight, nextDpr) {
      width = Math.max(1, cssWidth);
      height = Math.max(1, cssHeight);
      dpr = nextDpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    },
    setTheme(next) {
      theme = next;
      // Both buffers bake the palette in, so a theme change must repaint them.
      shadeKey = "";
      atmosphereKey = "";
    },
    setRegions(next) {
      regions = next;
    },
    setMarkers(next) {
      markers = next;
    },
    setArcs(next) {
      arcs = next;
    },
    render,
    onFailure() {
      // Canvas 2D has nothing to lose once it has a context; there is no
      // equivalent of a lost GPU device to report.
    },
    destroy() {
      destroyed = true;
      canvas.remove();
    },
  };
}

/** Local copies so this file needs nothing from `../camera.ts`. */
function unit(lng: number, lat: number): [number, number, number] {
  const rad = Math.PI / 180;
  const cosLat = Math.cos(lat * rad);
  return [
    cosLat * Math.cos(lng * rad),
    cosLat * Math.sin(lng * rad),
    Math.sin(lat * rad),
  ];
}

function dot(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
