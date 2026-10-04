/// <reference types="vitest/globals" />

/**
 * The controller takes every timestamp as an argument, so these run on a plain
 * counter rather than fake timers — no clock to install, and a test can jump
 * three seconds ahead in one line.
 *
 * Two of these cover behaviour the canvas-2D globe did not have: pinch zoom
 * (documented but missing, and two fingers used to make the globe jump) and a
 * wheel that reports when it has hit a zoom limit so the page can scroll.
 */

import { describe, expect, it } from "vitest";
import { createController } from "./controller";

const RADIUS = 300;

function make(overrides: Partial<Parameters<typeof createController>[0]> = {}) {
  return createController({
    initialRotation: [0, 0],
    zoomRange: [1, 5],
    ...overrides,
  });
}

/** Run `ms` of animation as 16ms frames, starting at `from`. */
function animate(
  controller: ReturnType<typeof createController>,
  from: number,
  ms: number,
): number {
  let now = from;
  const end = from + ms;
  while (now < end) {
    now += 16;
    controller.step(now);
  }
  return now;
}

describe("drag", () => {
  it("rotates east as the pointer moves right", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerMove(1, 150, 100, 16, RADIUS);
    // 50px at 90°/radius = 15°.
    expect(c.rotation[0]).toBeCloseTo(15, 6);
    expect(c.rotation[1]).toBeCloseTo(0, 6);
  });

  it("rotates towards the pole as the pointer moves up, and clamps there", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerMove(1, 100, 0, 16, RADIUS);
    expect(c.rotation[1]).toBeCloseTo(30, 6);
    c.pointerMove(1, 100, -2000, 32, RADIUS);
    expect(c.rotation[1]).toBe(90);
  });

  it("scales the gain with the sphere's radius, so drag grips the surface", () => {
    const a = make();
    a.pointerDown(1, 0, 0, 0);
    a.pointerMove(1, 100, 0, 16, 100);
    const b = make();
    b.pointerDown(1, 0, 0, 0);
    b.pointerMove(1, 100, 0, 16, 400);
    expect(a.rotation[0]).toBeCloseTo(90, 6);
    expect(b.rotation[0]).toBeCloseTo(22.5, 6);
  });

  it("reports a tap when the pointer barely moved", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerMove(1, 102, 101, 16, RADIUS);
    expect(c.pointerUp(1, 102, 101, 32)).toMatchObject({ tap: true });
  });

  it("reports no tap after a real drag", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerMove(1, 160, 100, 16, RADIUS);
    expect(c.pointerUp(1, 160, 100, 32).tap).toBe(false);
  });

  it("ignores a move for a pointer that never went down", () => {
    const c = make();
    c.pointerMove(9, 500, 500, 16, RADIUS);
    expect(c.rotation[0]).toBe(0);
  });
});

describe("inertia", () => {
  it("keeps spinning after a fast flick, then settles", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerMove(1, 200, 100, 16, RADIUS);
    c.pointerUp(1, 200, 100, 16);
    expect(c.needsFrame()).toBe(true);
    const afterFlick = c.rotation[0];
    animate(c, 16, 100);
    expect(c.rotation[0]).not.toBeCloseTo(afterFlick, 3);
    // Friction brings it to a stop rather than leaving it spinning for ever.
    animate(c, 116, 4000);
    expect(c.isQuiet()).toBe(false);
  });

  it("does not coast after a slow drag", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    // 2px over a full second is nowhere near the flick threshold.
    c.pointerMove(1, 102, 100, 1000, RADIUS);
    c.pointerUp(1, 102, 100, 1000);
    const settled = c.rotation[0];
    animate(c, 1000, 200);
    expect(c.rotation[0]).toBeCloseTo(settled, 6);
  });

  it("is suppressed under reduced motion", () => {
    const c = make({ reducedMotion: () => true });
    c.pointerDown(1, 100, 100, 0);
    c.pointerMove(1, 200, 100, 16, RADIUS);
    c.pointerUp(1, 200, 100, 16);
    const settled = c.rotation[0];
    animate(c, 16, 500);
    expect(c.rotation[0]).toBeCloseTo(settled, 6);
  });
});

describe("pinch", () => {
  /* Absent from the canvas-2D globe despite being documented: a second
     `pointerdown` overwrote the single stored pointer, so moves alternating
     between two fingers made the globe lurch. */
  it("zooms in as two fingers separate", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerDown(2, 200, 100, 0); // 100px apart
    c.pointerMove(2, 300, 100, 16, RADIUS); // now 200px apart
    expect(c.targetZoom).toBeCloseTo(2, 6);
  });

  it("zooms out as two fingers close, clamping at the minimum", () => {
    const c = make();
    c.setZoom(4, 0);
    c.pointerDown(1, 100, 100, 0);
    c.pointerDown(2, 300, 100, 0); // 200px
    c.pointerMove(2, 200, 100, 16, RADIUS); // 100px -> half
    expect(c.targetZoom).toBeCloseTo(2, 6);
    c.pointerMove(2, 110, 100, 32, RADIUS); // 10px -> way past the floor
    expect(c.targetZoom).toBe(1);
  });

  it("rotates by the centroid, so a symmetric pinch does not also spin", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerDown(2, 200, 100, 0);
    // Both fingers move apart equally: the centroid stays put.
    c.pointerMove(1, 50, 100, 16, RADIUS);
    c.pointerMove(2, 250, 100, 16, RADIUS);
    expect(c.rotation[0]).toBeCloseTo(0, 6);
    expect(c.targetZoom).toBeGreaterThan(1.9);
  });

  it("is never a tap, even when neither finger moved far", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerDown(2, 200, 100, 0);
    expect(c.pointerUp(1, 100, 100, 16).tap).toBe(false);
    expect(c.pointerUp(2, 200, 100, 32).tap).toBe(false);
  });

  it("leaves no fling when the fingers lift", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerDown(2, 200, 100, 0);
    c.pointerMove(2, 400, 100, 16, RADIUS);
    c.pointerUp(1, 100, 100, 32);
    c.pointerUp(2, 400, 100, 32);
    const settled = c.rotation[0];
    animate(c, 32, 300);
    expect(c.rotation[0]).toBeCloseTo(settled, 6);
  });

  it("hands the gesture back to one finger without jumping", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerDown(2, 200, 100, 0);
    c.pointerMove(2, 260, 100, 16, RADIUS);
    c.pointerUp(2, 260, 100, 32);
    const before = c.rotation[0];
    // The remaining finger has not moved, so nothing should change.
    c.pointerMove(1, 100, 100, 48, RADIUS);
    expect(c.rotation[0]).toBeCloseTo(before, 6);
  });
});

describe("wheel", () => {
  it("zooms in on a negative delta and reports the event consumed", () => {
    const c = make();
    expect(c.wheel(-100, 0)).toBe(true);
    expect(c.targetZoom).toBeGreaterThan(1);
  });

  /* The fix for a reader who scrolls the page, reaches the hero globe, and
     finds the page will not move: at a zoom limit the wheel is not consumed. */
  it("declines the event at the zoom floor, so the page can scroll", () => {
    const c = make();
    expect(c.targetZoom).toBe(1);
    expect(c.wheel(120, 0)).toBe(false);
    expect(c.targetZoom).toBe(1);
  });

  it("declines the event at the zoom ceiling", () => {
    const c = make();
    c.setZoom(5, 0);
    expect(c.wheel(-120, 0)).toBe(false);
    expect(c.targetZoom).toBe(5);
  });

  it("still consumes a wheel that only partly fits before the limit", () => {
    const c = make();
    c.setZoom(4.99, 0);
    expect(c.wheel(-1000, 0)).toBe(true);
    expect(c.targetZoom).toBe(5);
  });
});

describe("keyboard", () => {
  it("nudges with the arrow keys and reports the key handled", () => {
    const c = make();
    expect(c.key("ArrowLeft", 0)).toBe(true);
    expect(c.rotation[0]).toBeCloseTo(12, 6);
    expect(c.key("ArrowRight", 0)).toBe(true);
    expect(c.rotation[0]).toBeCloseTo(0, 6);
    expect(c.key("ArrowUp", 0)).toBe(true);
    expect(c.rotation[1]).toBeCloseTo(12, 6);
  });

  it("takes smaller steps the further in the globe is zoomed", () => {
    const c = make();
    c.setZoom(4, 0);
    // Long enough for the ease to close the last 0.001 and snap to 4 exactly.
    const now = animate(c, 0, 1000);
    expect(c.zoom).toBe(4);
    c.key("ArrowLeft", now);
    expect(c.rotation[0]).toBeCloseTo(3, 6);
  });

  it("zooms with + and -", () => {
    const c = make();
    c.key("+", 0);
    expect(c.targetZoom).toBeCloseTo(1.3, 6);
    c.key("-", 0);
    expect(c.targetZoom).toBeCloseTo(1, 6);
  });

  it("leaves keys it does not use alone", () => {
    const c = make();
    expect(c.key("a", 0)).toBe(false);
    expect(c.key("Enter", 0)).toBe(false);
    expect(c.key("Tab", 0)).toBe(false);
    expect(c.rotation[0]).toBe(0);
  });
});

describe("fly-to", () => {
  it("eases to the goal and stops there", () => {
    const c = make();
    c.flyTo([-139, -35], 0);
    expect(c.needsFrame()).toBe(true);
    animate(c, 0, 2000);
    expect(c.rotation[0]).toBeCloseTo(-139, 6);
    expect(c.rotation[1]).toBeCloseTo(-35, 6);
    expect(c.needsFrame()).toBe(false);
  });

  it("snaps straight there under reduced motion", () => {
    const c = make({ reducedMotion: () => true });
    c.flyTo([100, 20], 0);
    c.step(16);
    expect(c.rotation[0]).toBeCloseTo(100, 6);
    expect(c.rotation[1]).toBeCloseTo(20, 6);
  });

  it("takes the short way round the seam", () => {
    const c = make({ initialRotation: [170, 0] });
    c.flyTo([-170, 0], 0);
    // One step must move east past 180, not 340° back the other way.
    c.step(16);
    expect(c.rotation[0]).toBeGreaterThan(170);
  });

  it("is abandoned when the reader grabs the globe", () => {
    const c = make();
    c.flyTo([-139, -35], 0);
    c.step(16);
    c.pointerDown(1, 100, 100, 32);
    const grabbed = c.rotation[0];
    c.step(48);
    expect(c.rotation[0]).toBeCloseTo(grabbed, 6);
  });

  it("clamps a goal past the pole", () => {
    const c = make();
    c.flyTo([0, 200], 0);
    animate(c, 0, 3000);
    expect(c.rotation[1]).toBe(90);
  });
});

describe("zoom easing", () => {
  it("approaches the target over several frames", () => {
    const c = make();
    c.setZoom(3, 0);
    expect(c.zoom).toBe(1);
    c.step(16);
    expect(c.zoom).toBeGreaterThan(1);
    expect(c.zoom).toBeLessThan(3);
    animate(c, 16, 1000);
    expect(c.zoom).toBeCloseTo(3, 6);
  });

  it("snaps under reduced motion", () => {
    const c = make({ reducedMotion: () => true });
    c.setZoom(3, 0);
    c.step(16);
    expect(c.zoom).toBeCloseTo(3, 6);
  });

  it("clamps to the configured range", () => {
    const c = make({ zoomRange: [1, 2] });
    c.setZoom(99, 0);
    expect(c.targetZoom).toBe(2);
    c.zoomBy(0.001, 0);
    expect(c.targetZoom).toBe(1);
  });
});

describe("ambient spin", () => {
  it("does not want a frame while idle, but asks to be woken", () => {
    const c = make();
    c.pointerDown(1, 0, 0, 1000);
    c.pointerUp(1, 0, 0, 1000);
    expect(c.needsFrame()).toBe(false);
    expect(c.nextWakeAt()).toBe(1000 + 2500);
  });

  it("starts spinning once the idle period has passed", () => {
    const c = make();
    c.key("ArrowLeft", 0); // arms the countdown, like any other input
    const start = c.rotation[0];
    c.step(2600);
    expect(c.needsFrame()).toBe(true);
    animate(c, 2600, 1000);
    expect(c.rotation[0]).not.toBeCloseTo(start, 3);
  });

  it("stays off while the pointer rests on the globe", () => {
    const c = make();
    c.setHovered(true, 0);
    c.step(5000);
    expect(c.needsFrame()).toBe(false);
    expect(c.nextWakeAt()).toBeNull();
  });

  it("resumes its countdown when the pointer leaves", () => {
    const c = make();
    c.setHovered(true, 0);
    c.setHovered(false, 1000);
    expect(c.nextWakeAt()).toBe(3500);
  });

  it("stays off while the globe is zoomed in", () => {
    const c = make();
    c.setZoom(3, 0);
    animate(c, 0, 1000);
    c.step(5000);
    expect(c.nextWakeAt()).toBeNull();
    // Only the ambient spin is off; the globe is otherwise settled.
    expect(c.needsFrame()).toBe(false);
  });

  it("is armed by the shell on mount, since nothing has been interacted with yet", () => {
    const c = make();
    // Nothing has happened, so there is no countdown to run.
    expect(c.nextWakeAt()).toBeNull();
    c.markInteraction(0);
    expect(c.nextWakeAt()).toBe(2500);
  });

  it("never starts under reduced motion", () => {
    const c = make({ reducedMotion: () => true });
    c.key("ArrowLeft", 0);
    expect(c.nextWakeAt()).toBeNull();
    c.step(99_999);
    expect(c.needsFrame()).toBe(false);
  });

  it("is interrupted by a drag", () => {
    const c = make();
    c.markInteraction(0);
    c.step(3000);
    expect(c.needsFrame()).toBe(true);
    c.pointerDown(1, 0, 0, 3000);
    c.pointerUp(1, 0, 0, 3000);
    expect(c.needsFrame()).toBe(false);
  });

  /** Degrees turned by each 16ms frame over `ms`, from the frame that starts
   *  the spin. */
  function spinFrames(
    controller: ReturnType<typeof createController>,
    from: number,
    ms: number,
  ): number[] {
    const frames: number[] = [];
    for (let now = from; now < from + ms; now += 16) {
      const before = controller.rotation[0];
      controller.step(now);
      frames.push(controller.rotation[0] - before);
    }
    return frames;
  }

  it("eases in from rest instead of starting at full speed", () => {
    const c = make();
    c.markInteraction(0);
    const [first] = spinFrames(c, 2500, 16);
    expect(first).toBeGreaterThan(0);
    // Full speed would turn 16 * 0.004 = 0.064° in the first frame.
    expect(first).toBeLessThan(0.064 / 100);
  });

  it("builds speed without a jolt, then holds the full rate", () => {
    const c = make();
    c.markInteraction(0);
    const frames = spinFrames(c, 2500, 4000);
    for (let i = 1; i < frames.length; i++) {
      const gain = frames[i] - frames[i - 1];
      // Never slows on the way up, and no frame gains more than a sliver of
      // the full 0.064° — a jump in speed is what reads as a jolt.
      expect(gain).toBeGreaterThanOrEqual(-1e-12);
      expect(gain).toBeLessThan(0.064 / 50);
    }
    expect(frames.at(-1)).toBeCloseTo(0.064, 9);
  });

  it("turns the same distance whatever the frame rate", () => {
    const at60 = make();
    at60.markInteraction(0);
    for (let now = 2500; now <= 2500 + 3200; now += 16) at60.step(now);

    const at120 = make();
    at120.markInteraction(0);
    // Same first frame, since a step from idle always counts as 16ms.
    at120.step(2500);
    for (let now = 2508; now <= 2500 + 3200; now += 8) at120.step(now);

    expect(at120.rotation[0]).toBeCloseTo(at60.rotation[0], 9);
  });

  it("stops mid-spin when reduced motion is switched on", () => {
    let reduced = false;
    const c = make({ reducedMotion: () => reduced });
    c.markInteraction(0);
    spinFrames(c, 2500, 1008); // spinning, last frame at 3492
    reduced = true;
    const [turned] = spinFrames(c, 3508, 16);
    expect(turned).toBe(0);
    expect(c.needsFrame()).toBe(false);
    expect(c.nextWakeAt()).toBeNull();
  });

  it("does not start when reduced motion is switched on during the countdown", () => {
    let reduced = false;
    const c = make({ reducedMotion: () => reduced });
    c.markInteraction(0);
    reduced = true;
    const [turned] = spinFrames(c, 2500, 16);
    expect(turned).toBe(0);
    expect(c.needsFrame()).toBe(false);
    expect(c.nextWakeAt()).toBeNull();
  });

  type Interruption = (
    controller: ReturnType<typeof createController>,
    now: number,
  ) => void;

  it.each<[string, Interruption]>([
    [
      "the pointer rested on it",
      (c, now) => {
        c.setHovered(true, now);
        c.setHovered(false, now + 500);
      },
    ],
    [
      "a tap",
      (c, now) => {
        c.pointerDown(1, 0, 0, now);
        c.pointerUp(1, 0, 0, now);
      },
    ],
    [
      "a flick that coasts to a stop",
      (c, now) => {
        c.pointerDown(1, 0, 0, now);
        c.pointerMove(1, 200, 0, now + 16, RADIUS);
        c.pointerUp(1, 200, 0, now + 16);
      },
    ],
    ["a fly-to", (c, now) => c.flyTo([120, 30], now)],
    ["an arrow key", (c, now) => c.key("ArrowLeft", now)],
    [
      "a zoom in and back out",
      (c, now) => {
        c.setZoom(3, now);
        c.setZoom(1, now + 16);
      },
    ],
    ["a wheel that hit the zoom floor", (c, now) => c.wheel(120, now)],
    ["the tab coming back", (c, now) => c.markInteraction(now)],
  ])("eases in again after %s", (_name, interrupt) => {
    const c = make();
    c.markInteraction(0);
    spinFrames(c, 2500, 4000); // up to full speed
    interrupt(c, 6500);
    // Let any coast, fly-to or zoom ease finish, as the shell's frames would.
    let now = 6500;
    while (c.needsFrame()) c.step((now += 16));

    const wakeAt = c.nextWakeAt();
    expect(wakeAt).not.toBeNull();
    const [first] = spinFrames(c, Math.max(wakeAt ?? 0, now + 16), 16);
    expect(first).toBeGreaterThan(0);
    // Full speed would turn 0.064° in the first frame back.
    expect(first).toBeLessThan(0.064 / 100);
  });
});

describe("step", () => {
  it("clamps a long gap, so a backgrounded tab does not lurch on return", () => {
    const fast = make();
    fast.markInteraction(0);
    fast.step(3000); // ambient begins
    animate(fast, 3000, 16);
    const oneFrame = fast.rotation[0];

    const slow = make();
    slow.markInteraction(0);
    slow.step(3000);
    slow.step(3016); // establish a baseline step
    const before = slow.rotation[0];
    slow.step(3016 + 60_000); // a minute in one step
    const jump = slow.rotation[0] - before;
    // At most the 48ms cap, not a minute's worth of spin.
    expect(Math.abs(jump)).toBeLessThanOrEqual(48 * 0.004 + 1e-9);
    expect(oneFrame).toBeGreaterThan(0);
  });

  it("is safe to call when nothing is animating", () => {
    const c = make();
    c.setHovered(true, 0);
    c.step(100);
    c.step(200);
    expect(c.rotation[0]).toBe(0);
    expect(c.rotation[1]).toBe(0);
  });
});

describe("isQuiet", () => {
  it("is true while dragging and while coasting, false during ambient spin", () => {
    const c = make();
    expect(c.isQuiet()).toBe(false);
    c.pointerDown(1, 0, 0, 0);
    expect(c.isQuiet()).toBe(true);
    c.pointerMove(1, 200, 0, 16, RADIUS);
    c.pointerUp(1, 200, 0, 16);
    expect(c.isQuiet()).toBe(true); // inertia
    animate(c, 16, 5000);
    expect(c.isQuiet()).toBe(false); // ambient spin is not "quiet"
  });
});

describe("halt", () => {
  it("drops inertia and any fly-to without moving the globe", () => {
    const c = make();
    c.flyTo([90, 45], 0);
    c.step(16);
    const where = [c.rotation[0], c.rotation[1]];
    c.halt();
    c.step(32);
    expect(c.rotation[0]).toBeCloseTo(where[0], 6);
    expect(c.rotation[1]).toBeCloseTo(where[1], 6);
  });
});

describe("pointerCancel", () => {
  it("ends the gesture without a tap or a fling", () => {
    const c = make();
    c.pointerDown(1, 100, 100, 0);
    c.pointerMove(1, 200, 100, 16, RADIUS);
    c.pointerCancel(1);
    const settled = c.rotation[0];
    animate(c, 16, 300);
    expect(c.rotation[0]).toBeCloseTo(settled, 6);
  });
});
