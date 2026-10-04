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

/** Degrees of rotation per pixel of drag, at a given sphere radius. A 90°
 *  sweep across one radius of the sphere, which is what the canvas-2D globe
 *  used and what makes a drag feel like it grips the surface. */
const DRAG_DEG_PER_RADIUS = 90;

/** How long the globe must be left alone before it starts spinning. */
const IDLE_MS = 2500;

/** Ambient spin rate — a full turn in 90 seconds. */
const AMBIENT_DEG_PER_MS = 0.004;

/** How long the ambient spin takes to build from rest to its full rate. */
const AMBIENT_RAMP_MS = 2000;

/** Inertia decay per 16ms frame. */
const FRICTION_PER_16MS = 0.94;

/** Below this angular speed (deg/ms) inertia stops. */
const MIN_OMEGA = 0.0004;

/** Fraction of the remaining zoom distance covered each frame. */
const ZOOM_EASE = 0.2;

/** Fraction of the remaining fly-to rotation covered each frame. */
const FOCUS_EASE = 0.16;

/** A pointer that moved less than this is a tap, not a drag. */
const TAP_SLOP_PX = 5;

/** Longest frame step honoured, so a backgrounded tab does not lurch on return. */
const MAX_STEP_MS = 48;

/** Wheel sensitivity: `exp(-deltaY * this)` is the zoom factor. */
const WHEEL_GAIN = 0.0015;

/** Zoom factor per keyboard `+` / `-`. */
const KEY_ZOOM_FACTOR = 1.3;

/** Degrees per arrow key press at zoom 1, scaled down as the globe zooms in. */
const KEY_STEP_DEG = 12;

export interface ControllerOptions {
  initialRotation: readonly [number, number];
  zoomRange?: readonly [number, number];
  /** Read on every step, so a preference change lands without a remount. */
  reducedMotion?: () => boolean;
}

/** What `pointerUp` decided the gesture was. */
export interface PointerUpResult {
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
  /** `radiusPx` is the sphere's on-screen radius, which sets the drag gain. */
  pointerMove(
    id: number,
    x: number,
    y: number,
    now: number,
    radiusPx: number,
  ): void;
  pointerUp(id: number, x: number, y: number, now: number): PointerUpResult;
  pointerCancel(id: number): void;
  /** Returns true when the zoom changed, so the caller knows to consume the
   *  event. False means the wheel hit a zoom limit and the page should scroll. */
  wheel(deltaY: number, now: number): boolean;
  /** Returns true when the key was one the globe uses. */
  key(key: string, now: number): boolean;
  setZoom(zoom: number, now: number): void;
  zoomBy(factor: number, now: number): void;
  /** Rotate to `[λ, φ]`, eased unless reduced motion is on. */
  flyTo(rotation: readonly [number, number], now: number): void;
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
  /** True while dragging or coasting — the cue for dimming grid lines and
   *  hiding labels, which is how the canvas-2D globe reads too. */
  isQuiet(): boolean;
  /** Drop inertia and any fly-to, leaving the globe where it is. */
  halt(): void;
}

export function createController(options: ControllerOptions): Controller {
  const [minZoom, maxZoom] = options.zoomRange ?? [1, 5];
  const reducedMotion = options.reducedMotion ?? (() => false);

  const rotation: [number, number] = [
    options.initialRotation[0],
    options.initialRotation[1],
  ];
  let zoom = minZoom;
  let targetZoom = minZoom;

  const pointers = new Map<number, ActivePointer>();
  /** Set once a gesture involved two pointers, so releasing one is not a tap. */
  let gestureWasPinch = false;
  /** Pinch reference: pointer separation and zoom when the second finger landed. */
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;

  /** Angular velocity in deg/ms, driving inertia after a drag. */
  const omega: [number, number] = [0, 0];
  let inertiaActive = false;

  let ambientActive = false;
  /** How long the current ambient spin has been running, in stepped ms. */
  let ambientElapsed = 0;
  /** When the ambient spin becomes due, or null while it is off the table. */
  let ambientDueAt: number | null = null;
  let hovered = false;

  let focusGoal: [number, number] | null = null;

  let lastStep = 0;

  function clampZoom(value: number): number {
    return Math.min(maxZoom, Math.max(minZoom, value));
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
    ambientDueAt = reducedMotion() ? null : now + IDLE_MS;
  }

  /** Whether the globe is settled enough for the ambient spin to take over. */
  function ambientEligible(): boolean {
    return (
      !isDragging() &&
      !hovered &&
      !inertiaActive &&
      focusGoal === null &&
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
        focusGoal !== null ||
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
        ambientDueAt = null;
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

      if (Math.abs(targetZoom - zoom) > 0.001) {
        zoom += (targetZoom - zoom) * (snap ? 1 : ZOOM_EASE);
      } else {
        zoom = targetZoom;
      }

      if (focusGoal) {
        const ease = snap ? 1 : FOCUS_EASE;
        rotation[0] += shortestAngle(rotation[0], focusGoal[0]) * ease;
        rotation[1] += (focusGoal[1] - rotation[1]) * ease;
        if (
          Math.abs(shortestAngle(rotation[0], focusGoal[0])) < 0.1 &&
          Math.abs(focusGoal[1] - rotation[1]) < 0.1
        ) {
          rotation[0] = wrapLng(focusGoal[0]);
          rotation[1] = focusGoal[1];
          focusGoal = null;
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
        ambientElapsed += dt;
        rotation[0] = wrapLng(
          rotation[0] + ambientTravel(ambientElapsed) - turned,
        );
      }

      // Idle again once nothing is animating, so the next wake is scheduled.
      if (!controller.needsFrame()) lastStep = 0;
    },

    pointerDown(id, x, y, now): void {
      pointers.set(id, { x, y, time: now, startX: x, startY: y });
      inertiaActive = false;
      focusGoal = null;
      omega[0] = 0;
      omega[1] = 0;
      if (pointers.size >= 2) {
        gestureWasPinch = true;
        pinchStartDistance = pinchGeometry().distance;
        pinchStartZoom = targetZoom;
      }
      markInteraction(now);
    },

    pointerMove(id, x, y, now, radiusPx): void {
      const pointer = pointers.get(id);
      if (!pointer) return;

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
        // A pinch should not leave the globe coasting when the fingers lift.
        omega[0] = 0;
        omega[1] = 0;
      } else if (!reducedMotion()) {
        omega[0] = (dx * gain) / elapsed;
        omega[1] = (-dy * gain) / elapsed;
      }

      markInteraction(now);
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
        omega[0] = 0;
        omega[1] = 0;
      }
    },

    wheel(deltaY, now): boolean {
      const next = clampZoom(targetZoom * Math.exp(-deltaY * WHEEL_GAIN));
      markInteraction(now);
      /* Unchanged means the wheel is pushing past a zoom limit. Reporting that
         lets the caller leave the event alone, so the page scrolls instead of
         the reader getting stuck on a globe that eats every wheel tick. */
      if (Math.abs(next - targetZoom) < 1e-9) return false;
      targetZoom = next;
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
          targetZoom = clampZoom(targetZoom * KEY_ZOOM_FACTOR);
          break;
        case "-":
          targetZoom = clampZoom(targetZoom / KEY_ZOOM_FACTOR);
          break;
        default:
          return false;
      }
      focusGoal = null;
      inertiaActive = false;
      markInteraction(now);
      return true;
    },

    setZoom(value, now): void {
      targetZoom = clampZoom(value);
      markInteraction(now);
    },

    zoomBy(factor, now): void {
      targetZoom = clampZoom(targetZoom * factor);
      markInteraction(now);
    },

    flyTo(goal, now): void {
      focusGoal = [goal[0], clampLat(goal[1])];
      inertiaActive = false;
      markInteraction(now);
    },

    setHovered(value, now): void {
      hovered = value;
      // Leaving restarts the countdown; arriving simply holds it off.
      if (!value) markInteraction(now);
      else ambientActive = false;
    },

    markInteraction,

    isQuiet(): boolean {
      return isDragging() || inertiaActive;
    },

    halt(): void {
      inertiaActive = false;
      focusGoal = null;
      omega[0] = 0;
      omega[1] = 0;
    },
  };

  return controller;
}
