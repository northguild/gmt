import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { DAY_MS, subsolarPoint } from "~/lib/globe/sun";
import {
  SUN_GLIDE_MS,
  TROPICAL_YEAR_DAYS,
  foldYears,
  glideOffset,
  runSunGlide,
} from "./sun-glide";

const ms = (iso: string): number =>
  Temporal.Instant.from(iso).epochMilliseconds;
const HOUR_MS = 3_600_000;

/** The angle between two points on the Earth, degrees. */
function arc(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const cos =
    Math.sin(a.lat * rad) * Math.sin(b.lat * rad) +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.cos((a.lng - b.lng) * rad);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad;
}

describe("foldYears", () => {
  it("leaves a gap under half a year alone", () => {
    expect(foldYears(40 * DAY_MS + 5 * HOUR_MS)).toBe(
      40 * DAY_MS + 5 * HOUR_MS,
    );
    expect(foldYears(-150 * DAY_MS)).toBe(-150 * DAY_MS);
  });

  it("takes out whole days only, so the time of day is kept", () => {
    const gap = ms("2026-11-19T10:17:00Z") - ms("1844-12-30T22:00:00Z");
    const left = foldYears(gap);
    expect((gap - left) % DAY_MS).toBe(0);
    expect(Math.abs(left)).toBeLessThan((TROPICAL_YEAR_DAYS / 2 + 1) * DAY_MS);
  });

  it("snaps 182 years without moving the sun more than a fraction of a degree", () => {
    const shown = ms("2026-11-19T10:17:00Z");
    const start = ms("1844-11-19T10:17:00Z");
    const snapped = start + foldYears(shown - start);
    // The same season and time of day: the sun stands where it stood.
    expect(arc(subsolarPoint(shown), subsolarPoint(snapped))).toBeLessThan(0.5);
  });
});

describe("glideOffset", () => {
  const start = 41 * DAY_MS + 7 * HOUR_MS;

  it("starts on the gap and ends on the timeline", () => {
    expect(glideOffset(start, 0)).toBe(start);
    expect(glideOffset(start, 1)).toBe(0);
    expect(glideOffset(-start, 1)).toBe(0);
  });

  it("eases the hours the short way: three hours back, never 21 forward", () => {
    const back = 2 * DAY_MS - 3 * HOUR_MS;
    for (let k = 0; k <= 100; k += 1) {
      const offset = glideOffset(back, k / 100);
      const hours = offset - Math.round(offset / DAY_MS) * DAY_MS;
      expect(hours).toBeLessThanOrEqual(0);
      expect(hours).toBeGreaterThanOrEqual(-3 * HOUR_MS);
    }
  });

  it("moves the sun smoothly: at no frame does it jump", () => {
    const base = ms("2027-02-06T13:56:00Z");
    let last = subsolarPoint(base + start);
    // 60 frames a second over the glide.
    const frames = Math.ceil((SUN_GLIDE_MS / 1000) * 60);
    for (let k = 1; k <= frames; k += 1) {
      const sun = subsolarPoint(base + glideOffset(start, k / frames));
      expect(arc(last, sun)).toBeLessThan(5);
      last = sun;
    }
    expect(arc(last, subsolarPoint(base))).toBe(0);
  });
});

describe("runSunGlide", () => {
  it("shows the gap first, then eases to 0 on the frames' own stamps", () => {
    const callbacks: ((stamp: number) => void)[] = [];
    const seen: number[] = [];
    runSunGlide({
      startMs: start(),
      win: {
        requestAnimationFrame: (cb) => callbacks.push(cb),
        cancelAnimationFrame: () => {},
      },
      onFrame: (offset) => seen.push(offset),
    });
    expect(seen).toEqual([start()]);
    callbacks.shift()!(1000);
    callbacks.shift()!(1000 + SUN_GLIDE_MS / 2);
    callbacks.shift()!(1000 + SUN_GLIDE_MS);
    expect(seen.at(-1)).toBe(0);
    expect(callbacks).toHaveLength(0);
  });

  it("stops when told", () => {
    const callbacks: ((stamp: number) => void)[] = [];
    const seen: number[] = [];
    const stop = runSunGlide({
      startMs: start(),
      win: {
        requestAnimationFrame: (cb) => callbacks.push(cb),
        cancelAnimationFrame: () => {},
      },
      onFrame: (offset) => seen.push(offset),
    });
    stop();
    callbacks.shift()!(1000);
    expect(seen).toHaveLength(1);
  });

  function start(): number {
    return 3 * DAY_MS + 5 * HOUR_MS;
  }
});
