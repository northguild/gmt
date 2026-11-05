import {
  cubicBezier,
  DAWN_DELAY_MS,
  DAWN_END_MS,
  dawnExposure,
  FALLBACK_FADE_MS,
  fallbackOpacity,
} from "./dawn";

describe("cubicBezier", () => {
  it("passes through its end points and rises monotonically", () => {
    const ease = cubicBezier(0.3, 0, 0.2, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let previous = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      expect(ease(t)).toBeGreaterThanOrEqual(previous);
      previous = ease(t);
    }
  });
});

describe("dawnExposure", () => {
  it("holds at 0 through the delay, then rises to 1 and stays", () => {
    expect(dawnExposure(0)).toBe(0);
    expect(dawnExposure(DAWN_DELAY_MS)).toBe(0);
    expect(dawnExposure(DAWN_DELAY_MS + 1000)).toBeGreaterThan(0);
    expect(dawnExposure(DAWN_DELAY_MS + 1000)).toBeLessThan(1);
    expect(dawnExposure(DAWN_END_MS)).toBe(1);
    expect(dawnExposure(DAWN_END_MS + 5000)).toBe(1);
  });

  it("passes .95 at about 1.83 s, when the night disc has gone", () => {
    expect(dawnExposure(1800)).toBeLessThan(0.95);
    expect(dawnExposure(1850)).toBeGreaterThan(0.95);
  });
});

describe("fallbackOpacity", () => {
  it("fades from 0 to 1 over the fallback fade", () => {
    expect(fallbackOpacity(0)).toBe(0);
    expect(fallbackOpacity(FALLBACK_FADE_MS / 2)).toBeGreaterThan(0);
    expect(fallbackOpacity(FALLBACK_FADE_MS / 2)).toBeLessThan(1);
    expect(fallbackOpacity(FALLBACK_FADE_MS)).toBe(1);
    expect(fallbackOpacity(FALLBACK_FADE_MS * 3)).toBe(1);
  });
});
