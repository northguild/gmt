/**
 * The globe's interaction state machine (#289).
 *
 * Pure: no DOM, no timers, no clock. Every method takes the timestamp it should
 * act at, so the whole thing runs under a fake clock in a test and both
 * renderers inherit identical feel by construction rather than by two people
 * writing the same easing twice.
 *
 * The shell (`engine.ts`) owns the real `requestAnimationFrame` and the one
 * `setTimeout` that wakes the ambient spin; this file only says *when* it wants
 * waking, through `needsFrame()` and `nextWakeAt()`.
 *
 * ## What it models
 *
 * Drag with inertia, wheel and pinch zoom, an eased fly-to, arrow-key nudges,
 * and an ambient spin that eases in from rest once the reader has left the globe
 * alone. All of it collapses to "snap, don't animate" under reduced motion.
 *
 * Two behaviours here differ from the canvas-2D globe this replaces, both
 * deliberate:
 *
 * - **Pinch zoom works.** It was documented but absent: a second `pointerdown`
 *   overwrote the one stored pointer, so two fingers made the globe jump as
 *   moves alternated between them. Pointers are tracked by id now.
 * - **The wheel stops swallowing the page.** `wheel()` reports whether it
 *   actually changed the zoom, so the caller can leave the event alone at the
 *   zoom limits instead of trapping a reader who scrolls onto the hero globe.
 */

import { clampLat, shortestAngle, wrapLng } from "./camera";
import { type Flight, planFlight } from "./flight";

/** Degrees of rotation per pixel of drag, at a given sphere radius. A 90°
 *  sweep across one radius of the sphere, which is what the canvas-2D globe
 *  used and what makes a drag feel like it grips the surface. */
const DRAG_DEG_PER_RADIUS = 90;

/** How long the globe must be left alone before it starts spinning. */
export const IDLE_MS = 2500;

/** Ambient spin rate: 2 degrees a second, a full turn in 3 minutes. The sky behind the Earth is
 *  seen through the globe's own camera, so the stars move about 6.5 times as far as the Earth's
 *  surface; faster, they jump visibly between the spin's 30 ms draws. */
const AMBIENT_DEG_PER_MS = 0.002;

/** How long the ambient spin takes to build from rest to its full rate. */
const AMBIENT_RAMP_MS = 2000;

/** Inertia decay per 16ms frame. */
const FRICTION_PER_16MS = 0.94;

/** Below this angular speed (deg/ms) inertia stops. */
const MIN_OMEGA = 0.0004;

/** Fraction of the remaining zoom distance covered per 16 ms frame. */
const ZOOM_EASE = 0.2;

/** The fraction an ease of `perFrame` per 16 ms covers in `dt` ms, so the motion takes the same
 *  time at 60, 120 or 144 frames a second. */
function easeOver(perFrame: number, dt: number): number {
  return 1 - (1 - perFrame) ** (dt / 16);
}

/** A pointer that moved less than this is a tap, not a drag. */
const TAP_SLOP_PX = 5;

/** Longest frame step honoured, so a backgrounded tab does not lurch on return. */
const MAX_STEP_MS = 48;

/** Wheel sensitivity: `exp(-deltaY * this)` is the zoom factor. */
const WHEEL_GAIN = 0.0015;

/** Zoom factor per keyboard `+` / `-`. */
const KEY_ZOOM_FACTOR = 1.3;

/**
 * How far a pinch zooms before it counts as a step for `onZoom`: one mouse-wheel notch (a `deltaY`
 * of 100). A pinch moves the zoom on every pointer move, and two fingers held still jitter it.
 */
const PINCH_STEP = Math.exp(100 * WHEEL_GAIN);

/** Degrees per arrow key press at zoom 1, scaled down as the globe zooms in. */
const KEY_STEP_DEG = 12;

interface ControllerOptions {
  initialRotation: readonly [number, number];
  zoomRange?: readonly [number, number];
  /** The zoom to start at, clamped to the range; defaults to the range's low end. */
  initialZoom?: number;
  /** Read on every step, so a preference change lands without a remount. */
  reducedMotion?: () => boolean;
  /** False never schedules the ambient spin, so the globe is at rest until moved. Default true. */
  ambient?: boolean;
  /**
   * The reader moved the zoom a step: `dir` is 1 in, -1 out, and `closeness` where the target now
   * sits, 0 at the widest zoom to 1 at the closest, on a log scale. A wheel event, a `+` or `-`,
   * `setZoom`, `zoomBy`, or a pinch every `PINCH_STEP`. One that hits a limit and changes nothing
   * does not count.
   */
  onZoom?: (dir: 1 | -1, closeness: number) => void;
}

/** A timed flight: the camera lifts to `dipZoom` at the midpoint and comes down at the goal. */
export interface HopOptions {
  durationMs: number;
  dipZoom: number;
}

/** A continuous camera rate: degrees per second east and north of the view centre, and zoom
 *  units per second (positive zooms in). */
export interface SteerVector {
  lng: number;
  lat: number;
  zoom: number;
}

/** A hop takes 2 s for an arc of 30 degrees or less, growing to 4 s at 180: slow enough for a
 *  room watching a projected globe to follow the flight from one place to the next. */
const HOP_SHORT_MS = 2000;
const HOP_LONG_MS = 4000;
const HOP_SHORT_ARC = 30;

/** How long a hop over `arcDeg` degrees of great circle takes. */
export function hopDuration(arcDeg: number): number {
  if (arcDeg <= HOP_SHORT_ARC) return HOP_SHORT_MS;
  const u = Math.min((arcDeg - HOP_SHORT_ARC) / (180 - HOP_SHORT_ARC), 1);
  return HOP_SHORT_MS + (HOP_LONG_MS - HOP_SHORT_MS) * u;
}

/** Cubic ease-in-out: zero velocity at both ends. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

interface HopState {
  startAt: number;
  durationMs: number;
  from: [number, number];
  /** Longitude delta along the short way, and the latitude delta. */
  delta: [number, number];
  startZoom: number;
  goalZoom: number;
  /** How far the midpoint zoom sits below the straight line from start to goal. */
  dip: number;
}

/** What a gesture turned out to be, reported once when it commits. */
export type GestureKind = "drag" | "pinch";

/** What `pointerUp` decided the gesture was. */
interface PointerUpResult {
  /** A tap the caller should hit-test. False after a drag or a pinch. */
  tap: boolean;
  x: number;
  y: number;
}

interface ActivePointer {
  x: number;
  y: number;
  time: number;
  startX: number;
  startY: number;
}

export interface Controller {
  /** `[λ, φ]` in degrees, negated as `.rotate()` takes it. Read, do not write. */
  readonly rotation: readonly [number, number];
  /** Current (eased) zoom. */
  readonly zoom: number;
  /** Where the zoom is heading. */
  readonly targetZoom: number;
  /** True while a drag, inertia, ambient spin, fly-to or zoom ease is running. */
  needsFrame(): boolean;
  /**
   * When the controller next wants a step even though `needsFrame()` is false —
   * the moment the ambient spin is due. Null when nothing is pending.
   */
  nextWakeAt(): number | null;
  /** Advance to `now`. Safe to call repeatedly. */
  step(now: number): void;
  pointerDown(id: number, x: number, y: number, now: number): void;
  /**
   * `radiusPx` is the sphere's on-screen radius, which sets the drag gain.
   * Returns the gesture's kind on the one move that commits it — past the tap
   * slop, or with a second finger down — and null for every other move, so a
   * tap or a jitter never reads as the reader working the globe.
   */
  pointerMove(
    id: number,
    x: number,
    y: number,
    now: number,
    radiusPx: number,
  ): GestureKind | null;
  pointerUp(id: number, x: number, y: number, now: number): PointerUpResult;
  pointerCancel(id: number): void;
  /** Returns true when the zoom changed, so the caller knows to consume the
   *  event. False means the wheel hit a zoom limit and the page should scroll. */
  wheel(deltaY: number, now: number): boolean;
  /** Returns true when the key was one the globe uses. */
  key(key: string, now: number): boolean;
  setZoom(zoom: number, now: number): void;
  zoomBy(factor: number, now: number): void;
  /**
   * Rotate to `[λ, φ]`, eased unless reduced motion is on. With `hop` the flight is timed: a
   * cubic ease-in-out on rotation, and a zoom that dips to `hop.dipZoom` at the midpoint and
   * returns to the zoom the controller is heading for. Under reduced motion both snap.
   */
  flyTo(
    rotation: readonly [number, number],
    now: number,
    hop?: HopOptions,
  ): void;
  /**
   * Hold a continuous rate until the next `steer` with all zeros. Stepped on the controller's
   * clock, clamped to the latitude and zoom ranges. A drag or a `flyTo` cancels it.
   */
  steer(vector: SteerVector, now: number): void;
  /** Hovering holds the ambient spin off without counting as an interaction. */
  setHovered(hovered: boolean, now: number): void;
  /**
   * Treat `now` as the last time the reader did something: stop any ambient
   * spin and restart the countdown to the next one.
   *
   * Every input method above already does this. The shell calls it directly at
   * two moments of its own — on mount, which is what arms the first spin, and
   * when a hidden tab comes back, where resuming mid-spin from a stale
   * timestamp would look like a jump.
   */
  markInteraction(now: number): void;
  /** True while the ambient spin is the only thing moving the globe: no drag, coast, fly-to or zoom ease. */
  isAmbientOnly(): boolean;
  /**
   * A host that wants the globe turning, with no idle wait and at any zoom, asks for the spin here.
   * It is the same spin the idle globe gets (the same rate, the same smoothstep ramp in), and it
   * waits for a flight, a hop, a drag or a steer to end. Turning it off eases the speed down on the
   * same ramp, so the globe never stops short. Reduced motion never spins.
   */
  setSpin(on: boolean): void;
  /** True from the moment the requested spin starts until its ramp down has ended. */
  isSpinning(): boolean;
  /** True while only a requested spin (building, cruising or easing down) moves the globe. */
  isSpinOnly(): boolean;
  /** True while dragging or coasting — the cue for dimming grid lines and
   *  hiding labels, which is how the canvas-2D globe reads too. */
  isQuiet(): boolean;
  /** Drop inertia and any fly-to, leaving the globe where it is. */
  halt(): void;
}

export function createController(options: ControllerOptions): Controller {
  const [minZoom, maxZoom] = options.zoomRange ?? [1, 5];
  const reducedMotion = options.reducedMotion ?? (() => false);
  const ambientAllowed = options.ambient ?? true;

  const rotation: [number, number] = [
    options.initialRotation[0],
    options.initialRotation[1],
  ];
  let zoom = clampZoom(options.initialZoom ?? minZoom);
  let targetZoom = zoom;

  const pointers = new Map<number, ActivePointer>();
  /** Set once a gesture involved two pointers, so releasing one is not a tap. */
  let gestureWasPinch = false;
  /** Set once the current gesture has been reported as committed. */
  let gestureCommitted = false;
  /** Pinch reference: pointer separation and zoom when the second finger landed. */
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;
  /** The zoom the last pinch step reported, so the next one waits for `PINCH_STEP` more. */
  let pinchStepZoom = 1;

  /** Angular velocity in deg/ms, driving inertia after a drag. */
  const omega: [number, number] = [0, 0];
  let inertiaActive = false;

  let ambientActive = false;
  /** How long the current ambient spin has been running, in stepped ms. */
  let ambientElapsed = 0;
  /** When the ambient spin becomes due, or null while it is off the table. */
  let ambientDueAt: number | null = null;
  /** A host asked for the spin (`setSpin`), whatever the idle rules say. */
  let spinWanted = false;
  /** The running spin was asked for, so it ignores the idle rules and eases down when released. */
  let spinOwned = false;
  let hovered = false;

  /** The fly-to under way, a pure function of the time since `flightStart`. */
  let flight: Flight | null = null;
  let flightStart = 0;
  /** Rate of `[λ, φ]` at the last flight step, in deg/ms, so a retarget carries it on. */
  const flightRate: [number, number] = [0, 0];
  let hop: HopState | null = null;
  const steerRate: SteerVector = { lng: 0, lat: 0, zoom: 0 };

  let lastStep = 0;

  function steering(): boolean {
    return steerRate.lng !== 0 || steerRate.lat !== 0 || steerRate.zoom !== 0;
  }

  function cancelSteer(): void {
    steerRate.lng = 0;
    steerRate.lat = 0;
    steerRate.zoom = 0;
  }

  /** Drop a running hop, leaving the zoom to ease on to where the hop was heading. */
  function cancelHop(): void {
    if (!hop) return;
    targetZoom = hop.goalZoom;
    hop = null;
  }

  function clampZoom(value: number): number {
    return Math.min(maxZoom, Math.max(minZoom, value));
  }

  /** Where `value` sits between the widest and the closest zoom, 0 to 1, on a log scale. */
  function closeness(value: number): number {
    return maxZoom > minZoom
      ? Math.log(value / minZoom) / Math.log(maxZoom / minZoom)
      : 0;
  }

  /** Report a step from `from` to `to` to `onZoom`, if the zoom moved. */
  function reportZoom(from: number, to: number): void {
    if (Math.abs(to - from) < 1e-9) return;
    options.onZoom?.(to > from ? 1 : -1, closeness(to));
  }

  /** Aim the zoom at `value`, clamped, as one reader step. */
  function aimZoom(value: number): void {
    const from = targetZoom;
    targetZoom = clampZoom(value);
    reportZoom(from, targetZoom);
  }

  function isDragging(): boolean {
    return pointers.size > 0;
  }

  /**
   * The reader did something, so hold the ambient spin off and restart its
   * countdown.
   *
   * Under reduced motion the spin never starts, so there is nothing to schedule.
   */
  function markInteraction(now: number): void {
    ambientActive = false;
    spinOwned = false;
    ambientDueAt = reducedMotion() || !ambientAllowed ? null : now + IDLE_MS;
  }

  /** Whether nothing else holds the camera, so a requested spin can begin. */
  function spinFree(): boolean {
    return (
      !isDragging() &&
      !inertiaActive &&
      flight === null &&
      hop === null &&
      !steering()
    );
  }

  /** Whether the globe is settled enough for the ambient spin to take over. */
  function ambientEligible(): boolean {
    return (
      !isDragging() &&
      !hovered &&
      !inertiaActive &&
      flight === null &&
      hop === null &&
      !steering() &&
      // Only at rest zoom: spinning a zoomed-in globe reads as a glitch.
      Math.abs(targetZoom - minZoom) < 0.01
    );
  }

  /**
   * Degrees the ambient spin has turned `elapsed` ms after it started.
   *
   * The speed follows a smoothstep from zero to the full rate over
   * `AMBIENT_RAMP_MS`, so the acceleration is zero at both ends: the globe
   * neither lurches off nor snaps onto its cruising speed. This is that speed
   * integrated, so a step turns by the difference between two readings and the
   * ramp covers the same ground at any frame rate.
   */
  function ambientTravel(elapsed: number): number {
    const u = Math.min(elapsed / AMBIENT_RAMP_MS, 1);
    const ramp = AMBIENT_RAMP_MS * (u ** 3 - u ** 4 / 2);
    const cruise = Math.max(elapsed - AMBIENT_RAMP_MS, 0);
    return AMBIENT_DEG_PER_MS * (ramp + cruise);
  }

  /** The ambient spin's speed in deg/ms `elapsed` ms in: the derivative of `ambientTravel`. */
  function ambientRate(elapsed: number): number {
    const u = Math.min(elapsed / AMBIENT_RAMP_MS, 1);
    return AMBIENT_DEG_PER_MS * (3 * u * u - 2 * u ** 3);
  }

  /** The two-finger centroid, and their separation. */
  function pinchGeometry(): { cx: number; cy: number; distance: number } {
    let cx = 0;
    let cy = 0;
    const list = [...pointers.values()];
    for (const p of list) {
      cx += p.x;
      cy += p.y;
    }
    cx /= list.length;
    cy /= list.length;
    const distance =
      list.length >= 2
        ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y)
        : 0;
    return { cx, cy, distance };
  }

  const controller: Controller = {
    rotation,
    get zoom() {
      return zoom;
    },
    get targetZoom() {
      return targetZoom;
    },

    needsFrame(): boolean {
      return (
        isDragging() ||
        inertiaActive ||
        ambientActive ||
        (spinWanted && !reducedMotion()) ||
        flight !== null ||
        hop !== null ||
        steering() ||
        Math.abs(targetZoom - zoom) > 0.001
      );
    },

    nextWakeAt(): number | null {
      if (controller.needsFrame()) return null;
      return ambientEligible() ? ambientDueAt : null;
    },

    step(now: number): void {
      const dt = lastStep ? Math.min(now - lastStep, MAX_STEP_MS) : 16;
      lastStep = now;

      const snap = reducedMotion();

      // The preference can change under a running spin or a pending one.
      if (snap) {
        ambientActive = false;
        spinOwned = false;
        ambientDueAt = null;
      }

      // A requested spin starts as soon as the camera is free, on the idle spin's own ramp.
      if (spinWanted && !snap && !ambientActive && spinFree()) {
        ambientActive = true;
        spinOwned = true;
        ambientElapsed = 0;
      }

      // Due to spin, and nothing in the way.
      if (
        !ambientActive &&
        ambientDueAt !== null &&
        now >= ambientDueAt &&
        ambientEligible()
      ) {
        ambientActive = true;
        ambientElapsed = 0;
      }

      if (hop) {
        // A hop owns zoom and rotation until it lands, on the real elapsed time so it ends at
        // exactly its duration whatever the frame step.
        const t = snap ? 1 : Math.min((now - hop.startAt) / hop.durationMs, 1);
        const e = easeInOutCubic(t);
        zoom = clampZoom(
          hop.startZoom +
            (hop.goalZoom - hop.startZoom) * e -
            hop.dip * Math.sin(Math.PI * t),
        );
        rotation[0] = wrapLng(hop.from[0] + hop.delta[0] * e);
        rotation[1] = clampLat(hop.from[1] + hop.delta[1] * e);
        if (t >= 1) {
          zoom = hop.goalZoom;
          targetZoom = hop.goalZoom;
          hop = null;
        }
      } else if (Math.abs(targetZoom - zoom) > 0.001) {
        zoom += (targetZoom - zoom) * (snap ? 1 : easeOver(ZOOM_EASE, dt));
      } else {
        zoom = targetZoom;
      }

      if (hop) {
        // Rotation was set above.
      } else if (steering()) {
        const seconds = dt / 1000;
        rotation[0] = wrapLng(rotation[0] - steerRate.lng * seconds);
        rotation[1] = clampLat(rotation[1] - steerRate.lat * seconds);
        targetZoom = clampZoom(targetZoom + steerRate.zoom * seconds);
      } else if (flight) {
        const sample = flight.at(snap ? Infinity : now - flightStart);
        rotation[0] = sample.rotation[0];
        rotation[1] = sample.rotation[1];
        flightRate[0] = sample.rate[0];
        flightRate[1] = sample.rate[1];
        if (sample.done) {
          flight = null;
          // The globe rests on the place it flew to before the spin takes it away again.
          markInteraction(now);
        }
      } else if (inertiaActive) {
        rotation[0] = wrapLng(rotation[0] + omega[0] * dt);
        rotation[1] = clampLat(rotation[1] + omega[1] * dt);
        const decay = FRICTION_PER_16MS ** (dt / 16);
        omega[0] *= decay;
        omega[1] *= decay;
        if (Math.hypot(omega[0], omega[1]) < MIN_OMEGA) {
          inertiaActive = false;
          omega[0] = 0;
          omega[1] = 0;
        }
      } else if (ambientActive) {
        const turned = ambientTravel(ambientElapsed);
        if (spinOwned && !spinWanted) {
          // Released: run the ramp backwards, so the speed eases to zero the way it eased in.
          ambientElapsed = Math.max(ambientElapsed - dt, 0);
          rotation[0] = wrapLng(
            rotation[0] + turned - ambientTravel(ambientElapsed),
          );
          if (ambientElapsed === 0) {
            ambientActive = false;
            spinOwned = false;
          }
        } else {
          ambientElapsed += dt;
          rotation[0] = wrapLng(
            rotation[0] + ambientTravel(ambientElapsed) - turned,
          );
        }
      }

      // Idle again once nothing is animating, so the next wake is scheduled.
      if (!controller.needsFrame()) lastStep = 0;
    },

    pointerDown(id, x, y, now): void {
      pointers.set(id, { x, y, time: now, startX: x, startY: y });
      inertiaActive = false;
      flight = null;
      cancelHop();
      cancelSteer();
      omega[0] = 0;
      omega[1] = 0;
      if (pointers.size >= 2) {
        gestureWasPinch = true;
        pinchStartDistance = pinchGeometry().distance;
        pinchStartZoom = targetZoom;
        pinchStepZoom = targetZoom;
      }
      markInteraction(now);
    },

    pointerMove(id, x, y, now, radiusPx): GestureKind | null {
      const pointer = pointers.get(id);
      if (!pointer) return null;

      const previous = pinchGeometry();
      pointer.x = x;
      pointer.y = y;
      const elapsed = Math.max(now - pointer.time, 1);
      pointer.time = now;
      const current = pinchGeometry();

      /* Rotation follows the centroid, so one finger and two behave the same
         way and a pinch does not also fling the globe sideways. */
      const gain = DRAG_DEG_PER_RADIUS / Math.max(radiusPx, 1);
      const dx = current.cx - previous.cx;
      const dy = current.cy - previous.cy;
      rotation[0] = wrapLng(rotation[0] + dx * gain);
      rotation[1] = clampLat(rotation[1] - dy * gain);

      if (pointers.size >= 2 && pinchStartDistance > 0) {
        targetZoom = clampZoom(
          (pinchStartZoom * current.distance) / pinchStartDistance,
        );
        if (
          Math.abs(Math.log(targetZoom / pinchStepZoom)) >= Math.log(PINCH_STEP)
        ) {
          reportZoom(pinchStepZoom, targetZoom);
          pinchStepZoom = targetZoom;
        }
        // A pinch should not leave the globe coasting when the fingers lift.
        omega[0] = 0;
        omega[1] = 0;
      } else if (!reducedMotion()) {
        omega[0] = (dx * gain) / elapsed;
        omega[1] = (-dy * gain) / elapsed;
      }

      markInteraction(now);

      if (gestureCommitted) return null;
      const kind: GestureKind | null =
        pointers.size >= 2
          ? "pinch"
          : Math.hypot(x - pointer.startX, y - pointer.startY) >= TAP_SLOP_PX
            ? "drag"
            : null;
      if (kind) gestureCommitted = true;
      return kind;
    },

    pointerUp(id, x, y, now): PointerUpResult {
      const pointer = pointers.get(id);
      pointers.delete(id);
      if (!pointer) return { tap: false, x, y };

      const moved = Math.hypot(x - pointer.startX, y - pointer.startY);

      if (pointers.size === 1) {
        // A finger lifted mid-pinch: re-anchor so the remaining one keeps
        // dragging from where it is instead of jumping.
        pinchStartDistance = 0;
        const remaining = [...pointers.values()][0];
        remaining.time = now;
      }

      if (pointers.size === 0) {
        if (
          !gestureWasPinch &&
          !reducedMotion() &&
          Math.hypot(omega[0], omega[1]) > MIN_OMEGA * 3
        ) {
          inertiaActive = true;
        }
        const tap = !gestureWasPinch && moved < TAP_SLOP_PX;
        gestureWasPinch = false;
        gestureCommitted = false;
        markInteraction(now);
        return { tap, x, y };
      }

      markInteraction(now);
      return { tap: false, x, y };
    },

    pointerCancel(id): void {
      pointers.delete(id);
      if (pointers.size === 0) {
        gestureWasPinch = false;
        gestureCommitted = false;
        omega[0] = 0;
        omega[1] = 0;
      }
    },

    wheel(deltaY, now): boolean {
      const next = clampZoom(targetZoom * Math.exp(-deltaY * WHEEL_GAIN));
      markInteraction(now);
      cancelHop();
      /* Unchanged means the wheel is pushing past a zoom limit. Reporting that
         lets the caller leave the event alone, so the page scrolls instead of
         the reader getting stuck on a globe that eats every wheel tick. */
      if (Math.abs(next - targetZoom) < 1e-9) return false;
      aimZoom(next);
      return true;
    },

    key(key, now): boolean {
      const stepDeg = KEY_STEP_DEG / Math.max(zoom, 1e-6);
      switch (key) {
        case "ArrowLeft":
          rotation[0] = wrapLng(rotation[0] + stepDeg);
          break;
        case "ArrowRight":
          rotation[0] = wrapLng(rotation[0] - stepDeg);
          break;
        case "ArrowUp":
          rotation[1] = clampLat(rotation[1] + stepDeg);
          break;
        case "ArrowDown":
          rotation[1] = clampLat(rotation[1] - stepDeg);
          break;
        case "+":
        case "=":
          aimZoom(targetZoom * KEY_ZOOM_FACTOR);
          break;
        case "-":
          aimZoom(targetZoom / KEY_ZOOM_FACTOR);
          break;
        default:
          return false;
      }
      flight = null;
      cancelHop();
      inertiaActive = false;
      markInteraction(now);
      return true;
    },

    setZoom(value, now): void {
      aimZoom(value);
      markInteraction(now);
    },

    zoomBy(factor, now): void {
      aimZoom(targetZoom * factor);
      markInteraction(now);
    },

    flyTo(goal, now, hopOptions): void {
      cancelSteer();
      cancelHop();
      if (hopOptions) {
        flight = null;
        omega[0] = 0;
        omega[1] = 0;
      } else {
        // Carry on at whatever speed the globe has: a flight in progress, a
        // coast, or the ambient spin's ramp.
        let rate: [number, number] = [0, 0];
        if (flight) rate = [flightRate[0], flightRate[1]];
        else if (inertiaActive) rate = [omega[0], omega[1]];
        else if (ambientActive) rate = [ambientRate(ambientElapsed), 0];
        flight = planFlight(rotation, rate, goal);
        flightStart = now;
        flightRate[0] = rate[0];
        flightRate[1] = rate[1];
        omega[0] = 0;
        omega[1] = 0;
      }
      inertiaActive = false;
      markInteraction(now);
      if (!hopOptions) return;
      const goalLat = clampLat(goal[1]);
      const deltaLng = shortestAngle(rotation[0], goal[0]);
      const startZoom = zoom;
      const goalZoom = targetZoom;
      const dipZoom = clampZoom(hopOptions.dipZoom);
      hop = {
        startAt: now,
        durationMs: Math.max(hopOptions.durationMs, 1),
        from: [rotation[0], rotation[1]],
        delta: [deltaLng, goalLat - rotation[1]],
        startZoom,
        goalZoom,
        dip: Math.max((startZoom + goalZoom) / 2 - dipZoom, 0),
      };
    },

    steer(vector, now): void {
      steerRate.lng = vector.lng;
      steerRate.lat = vector.lat;
      steerRate.zoom = vector.zoom;
      if (steering()) {
        flight = null;
        cancelHop();
        inertiaActive = false;
        omega[0] = 0;
        omega[1] = 0;
      }
      markInteraction(now);
    },

    setHovered(value, now): void {
      hovered = value;
      // Leaving restarts the countdown; arriving simply holds it off.
      if (!value) markInteraction(now);
      else if (!spinOwned) ambientActive = false;
    },

    markInteraction,

    isQuiet(): boolean {
      return isDragging() || inertiaActive;
    },

    isAmbientOnly(): boolean {
      return (
        ambientActive &&
        !isDragging() &&
        !inertiaActive &&
        flight === null &&
        hop === null &&
        !steering() &&
        Math.abs(targetZoom - zoom) <= 0.001
      );
    },

    setSpin(on): void {
      if (on === spinWanted) return;
      spinWanted = on;
      // The ramp down starts from the cruise end of the ramp, not from however long it has cruised.
      if (!on && spinOwned) {
        ambientElapsed = Math.min(ambientElapsed, AMBIENT_RAMP_MS);
      }
    },

    isSpinning(): boolean {
      return spinOwned && ambientActive;
    },

    isSpinOnly(): boolean {
      return spinOwned && controller.isAmbientOnly();
    },

    halt(): void {
      inertiaActive = false;
      flight = null;
      cancelHop();
      cancelSteer();
      omega[0] = 0;
      omega[1] = 0;
    },
  };

  return controller;
}
