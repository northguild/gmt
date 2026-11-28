/**
 * Look at: a kit `disclosure` (icon only) in the globe's zoom stack whose panel is a second bar,
 * drawn as the stack is but wide enough for words: one button per row of `SKY_BODIES`, its icon
 * and its name, in the registry's order (the Sun, the Moon, then the planets outward from the
 * Sun). Pressing one closes the bar and flies the globe's camera until that body sits beside the
 * Earth's limb (`aimBody`), holds it there as the body drifts, and keeps the idle spin off while
 * the view is on; the held body's button is pressed (`aria-pressed`) and the stack's button shows
 * that a view is on. Pressing the held body again, or any work of the reader's on the globe,
 * releases the view and leaves the camera where it is. A point's button is available whenever the
 * planet layer can place the body, a faint one too (the camera turns to it and the layer rings it,
 * `holdBody`); it is unavailable (`aria-disabled`) while the layer loads or when the body has no
 * place. A body that is not a planet says what it is, dim beside its name (`groupTag`:
 * "Asteroid"). A point's row carries a dim second line (visible, so touch and screen readers get
 * it) with the reason or the date, from `sky-events.ts`; the data it reads is asked for when the
 * button of the bar is reached (`askEvents`). The bar's rows are one roving list (`roving`): opening
 * the bar focuses the held body, or the first, and the arrow keys, Home and End move between the rows.
 *
 * Time is the sky's own `now`; the view keeps no timer. It checks the body on the globe's frames
 * (the engine renders one a second at rest), at most once a second of `now`.
 */
import {
  disclosure,
  html,
  raw,
  wireDisclosure,
  type SafeHtml,
} from "~/widgets/builders";
import { roving } from "~/widgets/primitives/roving";
import styles from "~/widgets/tools/sky-look.module.css";
import { hopDuration } from "./globe/controller";
import {
  aimBody,
  aimLens,
  behindEarth,
  bodyAt,
  boxRadius,
  isClear,
  type AimFrame,
  type AimLens,
} from "./sky-aim";
import { groupTag, lookLine } from "./sky-events";
import { askEvents, eventsKit } from "./sky-events-kit";
import {
  holdBody,
  pointSource,
  SKY_BODIES,
  type DiscId,
  type SkyBodyId,
} from "./sky-registry";
import { arcDegrees } from "./slides/places";
import { SKY_ICON_PATHS } from "./zone-sky";

/* A text-presentation selector keeps a symbol from drawing as a coloured emoji. */
const symbol = (char: string): SafeHtml =>
  html`<span class="${styles.face}" aria-hidden="true">${char}\uFE0E</span>`;
const icon = (path: string): SafeHtml =>
  html`<svg class="${styles.face}" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">${raw(path)}</svg>`;

/** A disc's face on its button: the sky's own icons. A point's is its row's astronomical symbol. */
const FACES: Readonly<Record<DiscId, SafeHtml>> = {
  sun: icon(SKY_ICON_PATHS.day),
  moon: icon(SKY_ICON_PATHS.night),
};

/** The stack's button and the bar it opens; `idPrefix` namespaces its ids. */
export function renderSkyView(idPrefix: string): SafeHtml {
  return disclosure({
    id: `${idPrefix}-look`,
    label: "Look at",
    icon: html`<svg viewBox="0 0 24 24" width="16" height="16" focusable="false">${raw(SKY_ICON_PATHS.night)}</svg>`,
    gate: "sky-look",
    className: styles.look,
    buttonClassName: styles.toggle,
    children: html`<div class="${styles.bar}" role="group" aria-label="Look at" data-gate="sky-look-bar">${SKY_BODIES.map(
      (row) =>
        html`<button type="button" class="${styles.body}" data-sky-body="${row.id}" aria-pressed="false">${row.kind === "disc" ? FACES[row.id] : symbol(row.symbol)}<span class="${styles.text}"><span>${row.name}${groupTag(row.id) && html` <span class="${styles.tag}">${groupTag(row.id)}</span>`}</span> ${row.kind === "point" && html`<span class="${styles.line}" data-sky-line></span>`}</span></button>`,
    )}</div>`,
  });
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
  /** The hero: it holds the control and gets `data-sky-view` while a view is on. */
  host: HTMLElement;
  /** The hero's size and the boxes to keep clear of, read afresh each time. */
  avoid: () => AimFrame;
  /** The instant the sky shows, epoch milliseconds. */
  now: () => number;
  reducedMotion: () => boolean;
  signal: AbortSignal;
}

export interface SkyView {
  /** Turn the view off without moving the camera. */
  release(): void;
  destroy(): void;
}

/**
 * Writes a second line as its ` · ` parts, each kept whole, so a line too long for the bar breaks
 * only between parts ("Too faint ·" over "20.7"), never inside one.
 */
function writeLine(slot: Element, line: string | null): void {
  const parts = (line ?? "").split(" · ").filter(Boolean);
  slot.replaceChildren(
    ...parts.flatMap((part, i) => {
      const keep = document.createElement("span");
      keep.textContent = part;
      return i === 0 ? [keep] : [" · ", keep];
    }),
  );
}

/** A point's second line while the planet layer has not loaded. */
const LOADING = "Loading";

/** How far the body may drift from its spot before the camera follows, px. */
const DRIFT_PX = 8;
/** The hold looks at the body no more often than this, ms of `now`. */
const CHECK_MS = 1000;

export function mountSkyView(options: SkyViewOptions): SkyView {
  const { engine, host, avoid, now, signal } = options;
  const control = host.querySelector<HTMLElement>('[data-gate="sky-look"]');
  if (!control) throw new Error("the sky view is missing its Look at control");
  const toggle = control.querySelector<HTMLElement>("button");
  const buttons = [
    ...control.querySelectorAll<HTMLButtonElement>("button[data-sky-body]"),
  ];
  /* Opening reads the planet layer afresh, so the bar never shows a stale state. */
  const panel = wireDisclosure(control, {
    signal,
    light: true,
    onToggle: (open) => {
      if (!open) return;
      syncPoints();
      reach();
      /* Into the bar, as a menu button opens: the arrow keys work on its rows at once. */
      stop?.current()?.focus({ preventScroll: true });
    },
  });
  control.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element | null)?.closest<HTMLElement>(
        "button[data-sky-body]",
      );
      if (button && button.getAttribute("aria-disabled") !== "true")
        choose(button.dataset["skyBody"] ?? "");
    },
    { signal },
  );
  const bar = control.querySelector<HTMLElement>('[data-gate="sky-look-bar"]');
  const stop = bar ? roving(bar, { items: () => buttons, signal }) : null;

  /** Marks the points that cannot be looked at now, and writes each one's second line. */
  function syncPoints(): void {
    const source = pointSource();
    const at = now();
    const placed = new Map(
      source?.placed(at, engine.getView().rotation).map((p) => [p.id, p.V]),
    );
    for (const button of buttons) {
      const row = SKY_BODIES.find((r) => r.id === button.dataset["skyBody"]);
      if (row?.kind !== "point") continue;
      const V = placed.get(row.id) ?? null;
      const line = source ? lookLine(eventsKit(), row.id, V, at) : LOADING;
      const slot = button.querySelector("[data-sky-line]");
      if (slot && slot.textContent !== (line ?? "")) writeLine(slot, line);
      button.toggleAttribute("data-line", line !== null);
      if (V === null) button.setAttribute("aria-disabled", "true");
      else button.removeAttribute("aria-disabled");
    }
  }
  /* The data the lines read arrives on the first reach of the button; the lines are written again then. */
  const reach = (): void =>
    void askEvents().then(() => {
      if (!signal.aborted) syncPoints();
    });
  for (const type of ["pointerenter", "focus"])
    toggle?.addEventListener(type, reach, { signal });
  syncPoints();

  let active: SkyBodyId | null = null;
  let destroyed = false;
  /** Where the body sits on screen when the camera is on it, in the frame's pixels. */
  let anchor: { x: number; y: number } | null = null;
  let checkedAt = -Infinity;

  const lensOf = (frame: AimFrame): AimLens => aimLens(engine.getView(), frame);

  function mark(): void {
    toggle?.toggleAttribute("data-held", active !== null);
    for (const button of buttons)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset["skyBody"] === active),
      );
    /* The held body is the bar's tab stop, so Tab comes back to it. */
    const held = buttons.find((b) => b.dataset["skyBody"] === active);
    if (held) stop?.set(held);
    holdBody(active);
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
    const behind = behindEarth(id, at);
    const goal = found ?? (behind && { rotation: behind, zoom: 1 });
    /* A body with no place (a point whose source is gone) cannot be looked at. */
    if (!goal) return release();
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

  /** A body was chosen: the bar closes, and the view aims, switches or (the held one) releases. */
  function choose(id: string): void {
    panel.set(false, true);
    if (!SKY_BODIES.some((row) => row.id === id)) return;
    const body = id as SkyBodyId;
    if (active === body) return release();
    active = body;
    mark();
    engine.holdAmbient(true);
    aim(body, true);
  }

  let syncedAt = -Infinity;
  engine.onFrame(() => {
    if (destroyed) return;
    const at = now();
    if (at - syncedAt >= CHECK_MS) {
      syncedAt = at;
      syncPoints();
    }
    if (active === null || engine.getView().moving) return;
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

  const destroy = (): void => {
    if (destroyed) return;
    release();
    destroyed = true;
  };
  signal.addEventListener("abort", destroy, { once: true });

  return { release, destroy };
}
