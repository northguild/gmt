// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountSky, type Sky } from "./sky";
import type { MoonPainter, SunPainter } from "./sky-bodies";
import { moonRaDec, siderealDeg, sunRaDec } from "./sky-math";
import { skyHost } from "~/test/sky-host";

const LIST = readFileSync(resolve(process.cwd(), "src/assets/hero-sky.bin"));

/** A canvas context that writes down every call and assignment; the calls are what a draw is. */
function recorder(canvas: HTMLCanvasElement): string[] {
  const calls: string[] = [];
  const show = (v: unknown): string =>
    typeof v === "number"
      ? String(Math.round(v * 1e4) / 1e4)
      : typeof v === "object"
        ? "obj"
        : String(v);
  const ctx = new Proxy({} as Record<string, unknown>, {
    get:
      (_target, name: string) =>
      (...args: unknown[]) => {
        calls.push(`${name}(${args.map(show).join(",")})`);
        return name === "createRadialGradient"
          ? {
              addColorStop: (...a: unknown[]) =>
                calls.push(`stop(${a.map(show).join(",")})`),
            }
          : undefined;
      },
    set: (_target, name: string, value) => {
      calls.push(`${name}=${show(value)}`);
      return true;
    },
  });
  canvas.getContext = (() => ctx) as never;
  return calls;
}

class Path {
  moveTo() {}
  arc() {}
}

/** Three skies the flat Moon was recorded in before it moved here, with the digest of every canvas call. */
const SKIES: [
  string,
  number,
  (t: number) => [number, number],
  number,
  string,
][] = [
  [
    "a quarter Moon at the centre",
    703_036_800_000,
    (t) => [siderealDeg(t) + 180 - moonRaDec(t).ra, moonRaDec(t).dec],
    62,
    "3ac96b91ed3dae106cc89c2af3312ee970affd0f106b902464c083bc9d58a51d",
  ],
  [
    "an annular eclipse",
    1_786_565_520_000,
    (t) => [
      siderealDeg(t) + 180 - sunRaDec(t).ra + 13.5,
      sunRaDec(t).dec - 2.5,
    ],
    67,
    "fee599e8d8410123d8503c32aecbca629c354bb5dfcb708d6f01a0f5565e32f9",
  ],
  [
    "a new Moon off to one side",
    947_182_440_000,
    (t) => [siderealDeg(t) + 180 - moonRaDec(t).ra + 3, moonRaDec(t).dec],
    62,
    "8746c5a6721c9abbb49e64a0607c786b0181ab45448aca188adbe23788fb5896",
  ],
];

let host: HTMLElement | undefined;
let control: AbortController | undefined;

/** Mounts the sky and draws it at `t`, returning what the stars canvas was asked to do. */
function drawn(t: number, rotation: [number, number]) {
  const made = skyHost();
  host = made.host;
  vi.stubGlobal("Path2D", Path);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => new EventTarget());
  vi.spyOn(host, "getBoundingClientRect").mockImplementation(() => ({
    width: 1440,
    height: 844,
    left: 0,
    top: 0,
    right: 1440,
    bottom: 844,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
  const calls = recorder(made.stars);
  recorder(made.band);
  control = new AbortController();
  const sky: Sky = mountSky({
    stars: made.stars,
    band: made.band,
    host,
    data: LIST.buffer.slice(
      LIST.byteOffset,
      LIST.byteOffset + LIST.byteLength,
    ) as ArrayBuffer,
    signal: control.signal,
    rotation: [0, 0],
    now: () => t,
  });
  calls.length = 0;
  sky.view(rotation, { x: 600, y: 400, radius: 300 }, t);
  return { sky, calls, stars: made.stars };
}

const digest = (calls: string[]): string =>
  createHash("sha256").update(calls.join("\n")).digest("hex");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  control?.abort();
  host?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

describe("the flat bodies", () => {
  it.each(SKIES)(
    "draw %s exactly as they did before the textures",
    (_name, t, rotation, count, hash) => {
      const { calls } = drawn(t, rotation(t));
      expect(calls).toHaveLength(count);
      expect(digest(calls)).toBe(hash);
    },
  );
});

describe("the textured Moon's hook", () => {
  const [, t, rotation, , hash] = SKIES[0]!;

  it("hands the painter the Moon's disc and takes over its lit part", () => {
    const flat = drawn(t, rotation(t));
    const flatCalls = flat.calls.length;
    control?.abort();
    host?.remove();
    const paint = vi.fn<MoonPainter>(() => true);
    const { sky, calls } = drawn(t, rotation(t));
    calls.length = 0;
    sky.maps({ moon: paint });
    expect(paint).toHaveBeenCalledTimes(1);
    const [, , , instantMs, , disc, moon] = paint.mock.calls[0]!;
    expect(instantMs).toBe(t);
    expect(disc.r).toBeGreaterThan(2.5);
    expect(moon.lit).toBeGreaterThan(0.5);
    /* The painter drew the disc, so the flat terminator's ellipse and fill are not asked for. */
    expect(calls.some((call) => call.startsWith("ellipse"))).toBe(false);
    expect(calls.length).toBeLessThan(flatCalls);
  });

  it("draws the flat Moon when the painter declines", () => {
    const { sky, calls } = drawn(t, rotation(t));
    calls.length = 0;
    sky.maps({ moon: () => false });
    expect(digest(calls)).toBe(hash);
  });

  it("says so, and keeps the flat Moon, when the map failed", () => {
    const { sky, calls } = drawn(t, rotation(t));
    calls.length = 0;
    sky.maps({});
    expect(digest(calls)).toBe(hash);
  });
});

describe("the textured Sun's hook", () => {
  /* The annular eclipse's sky shows the Sun a little above the Earth's edge. */
  const [, t, rotation] = SKIES[1]!;
  const atSun = (): [number, number] => rotation(t);

  it("hands the painter the Sun's disc and its sky position, and skips the flat core when it paints", () => {
    const flat = drawn(t, atSun());
    const flatCalls = [...flat.calls];
    control?.abort();
    host?.remove();
    const { sky, calls } = drawn(t, atSun());
    calls.length = 0;
    const paint = vi.fn<SunPainter>(() => true);
    sky.maps({ sun: paint });
    expect(paint).toHaveBeenCalledTimes(1);
    const [, , , instantMs, , disc, sun] = paint.mock.calls[0]!;
    expect(instantMs).toBe(t);
    expect(disc.r).toBeGreaterThan(2.5);
    expect(sun).toEqual(sunRaDec(t));
    /* The flat core is a filled arc in its colour; the painter drew it, so it is not asked for. */
    expect(flatCalls.some((call) => call === "fillStyle=#fffaf0")).toBe(true);
    expect(calls.some((call) => call === "fillStyle=#fffaf0")).toBe(false);
  });

  it("draws the flat Sun when the painter declines", () => {
    const flat = drawn(t, atSun());
    const flatDigest = digest(flat.calls);
    control?.abort();
    host?.remove();
    const { sky, calls } = drawn(t, atSun());
    calls.length = 0;
    sky.maps({ sun: () => false });
    expect(digest(calls)).toBe(flatDigest);
  });
});
