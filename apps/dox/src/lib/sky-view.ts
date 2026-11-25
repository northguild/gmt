/**
 * The Sky view group: one toggle button per body of `SKY_VIEWS`, in the zone drawer. Pressing one
 * flies the globe's camera until that body sits beside the Earth's limb (`aimBody`), holds it there
 * as the body drifts, and keeps the idle spin off while the view is on. Pressing the pressed
 * button, or any work of the reader's on the globe, releases the view and leaves the camera where
 * it is. A body is a row of `SKY_VIEWS` and one of `AIM_BODIES`; nothing here names the Sun or the Moon
 * apart from that row.
 *
 * Time is the sky's own `now`; the view keeps no timer. It checks the body on the globe's frames
 * (the engine renders one a second at rest), at most once a second of `now`.
 */
import {
  button,
  buttonRow,
  html,
  raw,
  type SafeHtml,
} from "~/widgets/builders";
import styles from "~/widgets/tools/sky-view.module.css";
import { hopDuration } from "./globe/controller";
import {
  aimBody,
  behindEarth,
  bodyAt,
  boxRadius,
  isClear,
  type AimFrame,
  type AimLens,
  type SkyBodyId,
} from "./sky-aim";
import { arcDegrees } from "./slides/places";
import { SKY_ICON_PATHS } from "./zone-sky";

interface SkyViewEntry {
  id: SkyBodyId;
  label: string;
  /** Inner SVG markup of a 24-unit icon. */
  icon: string;
}

/** The buttons, in order. */
export const SKY_VIEWS: readonly SkyViewEntry[] = [
  { id: "sun", label: "View Sun", icon: SKY_ICON_PATHS.day },
  { id: "moon", label: "View Moon", icon: SKY_ICON_PATHS.night },
];

/** The `data-gate` of a body's button. */
const gateOf = (id: SkyBodyId): string => `sky-view-${id}`;

/** The group's markup; `idPrefix` namespaces the button ids. */
export function renderSkyView(
  idPrefix: string,
  views: readonly SkyViewEntry[] = SKY_VIEWS,
): SafeHtml {
  const buttons = views.map((view) =>
    button({
      id: `${idPrefix}-${view.id}`,
      label: view.label,
      pressed: false,
      gate: gateOf(view.id),
      icon: html`<svg viewBox="0 0 24 24" width="16" height="16" focusable="false">${raw(view.icon)}</svg>`,
    }),
  );
  return html`<div class="${styles.group}" role="group" aria-label="Sky view" data-gate="sky-view">${buttonRow(html`${buttons}`)}</div>`;
}

/** What the view asks of the globe: a `GlobeHost` or a `GlobeEngine` both serve. */
export interface SkyViewEngine {
  getView(): {
    rotation: readonly [number, number];
    zoom: number;
    moving: boolean;
    focalPx: number;
    centre: { x: number; y: number };
  };
  setZoom(zoom: number): void;
  flyTo(
    rotation: readonly [number, number],
    options?: { hop?: { durationMs: number; dipZoom: number } },
  ): void;
  holdAmbient(hold: boolean): void;
  onFrame(callback: () => void): void;
}

interface SkyViewOptions {
  engine: SkyViewEngine;
  /** The hero: it holds the buttons and gets `data-sky-view` while a view is on. */
  host: HTMLElement;
  /** The hero's size and the boxes to keep clear of, read afresh each time. */
  avoid: () => AimFrame;
  /** The instant the sky shows, epoch milliseconds. */
  now: () => number;
  reducedMotion: () => boolean;
  /** A view was pressed on; a stacked phone closes its sheet here. */
  onPress?: () => void;
  signal: AbortSignal;
  views?: readonly SkyViewEntry[];
}

export interface SkyView {
  /** Turn the view off without moving the camera. */
  release(): void;
  destroy(): void;
}

/** How far the body may drift from its spot before the camera follows, px. */
const DRIFT_PX = 8;
/** The hold looks at the body no more often than this, ms of `now`. */
const CHECK_MS = 1000;

export function mountSkyView(options: SkyViewOptions): SkyView {
  const { engine, host, avoid, now, signal } = options;
  const views = options.views ?? SKY_VIEWS;
  const buttons = new Map<SkyBodyId, HTMLElement>();
  for (const { id } of views) {
    const el = host.querySelector<HTMLElement>(`[data-gate="${gateOf(id)}"]`);
    if (el) buttons.set(id, el);
  }

  let active: SkyBodyId | null = null;
  let destroyed = false;
  /** Where the body sits on screen when the camera is on it, in the hero's pixels. */
  let anchor: { x: number; y: number } | null = null;
  let checkedAt = -Infinity;

  /** The camera and the hero as `aimBody` wants them. */
  function lensOf(frame: AimFrame): AimLens {
    const view = engine.getView();
    return {
      width: frame.width,
      height: frame.height,
      centre: {
        x: view.centre.x + frame.shift.x,
        y: view.centre.y + frame.shift.y,
      },
      focalAtRest: view.focalPx / view.zoom,
      rotation: view.rotation,
    };
  }

  function mark(): void {
    for (const [id, el] of buttons)
      el.setAttribute("aria-pressed", id === active ? "true" : "false");
    if (active) host.dataset["skyView"] = active;
    else delete host.dataset["skyView"];
  }

  /** Aim the camera at the active body. `hop` flies a timed arc; otherwise it eases the short way. */
  function aim(id: SkyBodyId, hop: boolean): void {
    const at = now();
    const frame = avoid();
    const lens = lensOf(frame);
    const found = aimBody(id, at, lens, frame.rects);
    /* No clear spot: look past the Earth's centre at the body, at rest zoom. */
    const goal = found ?? { rotation: behindEarth(id, at), zoom: 1 };
    anchor = found
      ? bodyAt(id, at, { ...lens, rotation: goal.rotation }, goal.zoom)
      : null;
    /* The hop returns to the zoom the controller is heading for, so the zoom is set first. */
    engine.setZoom(goal.zoom);
    if (hop && !options.reducedMotion()) {
      const [from, to] = [lens.rotation, goal.rotation];
      const arc = arcDegrees([-from[0], -from[1]], [-to[0], -to[1]]);
      engine.flyTo(goal.rotation, {
        hop: { durationMs: hopDuration(arc), dipZoom: goal.zoom },
      });
    } else engine.flyTo(goal.rotation);
    checkedAt = at;
  }

  function release(): void {
    if (active === null) return;
    active = null;
    anchor = null;
    mark();
    engine.holdAmbient(false);
  }

  function press(id: SkyBodyId): void {
    if (active === id) return release();
    active = id;
    mark();
    options.onPress?.();
    engine.holdAmbient(true);
    aim(id, true);
  }

  engine.onFrame(() => {
    if (destroyed || active === null || engine.getView().moving) return;
    const at = now();
    if (at - checkedAt < CHECK_MS) return;
    checkedAt = at;
    const frame = avoid();
    const lens = lensOf(frame);
    const view = engine.getView();
    const disc = bodyAt(active, at, lens, view.zoom);
    if (!disc) return aim(active, false);
    /* With no anchor (no clear spot was found) only a box that meets something moves the camera. */
    const drifted =
      anchor !== null &&
      Math.hypot(disc.x - anchor.x, disc.y - anchor.y) > DRIFT_PX;
    if (drifted || !isClear(disc, boxRadius(active, disc.r), lens, frame.rects))
      aim(active, false);
  });

  for (const [id, el] of buttons)
    el.addEventListener("click", () => press(id), { signal });
  const destroy = (): void => {
    if (destroyed) return;
    release();
    destroyed = true;
  };
  signal.addEventListener("abort", destroy, { once: true });

  return { release, destroy };
}
