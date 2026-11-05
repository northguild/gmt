// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeStars, mountSky, type Sky } from "./sky";
import {
  moonPhase,
  moonRaDec,
  siderealDeg,
  skyCentre,
  sunRaDec,
} from "./sky-math";

/** 1992-04-12T00:00:00Z, Meeus examples 47.a and 48.a. */
const APR_12 = 703_036_800_000;

const LIST = readFileSync(resolve(process.cwd(), "src/assets/hero-sky.bin"));
const data = (): ArrayBuffer =>
  LIST.buffer.slice(
    LIST.byteOffset,
    LIST.byteOffset + LIST.byteLength,
  ) as ArrayBuffer;

/** What a stub 2D context was asked to do. */
function stubContext(canvas: HTMLCanvasElement) {
  const log = {
    fills: 0,
    strokes: 0,
    clears: 0,
    gradients: 0,
    arcs: [] as number[],
    /** Each fill's colour and the radius of the arc last added, in order. */
    painted: [] as { style: string; radius: number }[],
    rotations: [] as number[],
  };
  const gradient = { addColorStop: vi.fn() };
  let style = "";
  let radius = 0;
  const ctx = {
    get fillStyle(): string {
      return style;
    },
    set fillStyle(value: string) {
      style = value;
    },
    setTransform: () => {},
    clearRect: () => {
      log.clears += 1;
    },
    fill: () => {
      log.fills += 1;
      log.painted.push({ style, radius });
    },
    fillRect: () => {},
    stroke: () => {
      log.strokes += 1;
    },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    createRadialGradient: () => {
      log.gradients += 1;
      return gradient;
    },
    arc: (_x: number, _y: number, r: number) => {
      radius = r;
      log.arcs.push(r);
    },
    ellipse: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: (angle: number) => {
      log.rotations.push(angle);
    },
  };
  canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;
  return log;
}

class Watcher {
  static last: Watcher | undefined;
  disconnected = false;
  constructor(public callback: () => void) {
    Watcher.last = this;
  }
  observe(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

class Path {
  moveTo(): void {}
  arc(): void {}
}

let controller: AbortController;
let host: HTMLElement;
let stars: HTMLCanvasElement;
let band: HTMLCanvasElement;
let starLog: ReturnType<typeof stubContext>;
let bandLog: ReturnType<typeof stubContext>;
let size = { width: 1440, height: 844 };
let frames: ReturnType<typeof vi.spyOn>;

const draws = (): number => Number(stars.dataset["skyDraws"] ?? 0);
/** 1987-04-10T00:00:00Z, Meeus example 12.a: the sidereal time there is 197.693195 degrees. */
const T0 = 545_011_200_000;
const MINUTE = 60_000;
let clock = T0;
let hidden = false;
const CENTRE = { x: 600, y: 400 };
const mountUnstarted = (): Sky =>
  mountSky({
    stars,
    band,
    host,
    data: data(),
    signal: controller.signal,
    rotation: [0, 0],
    now: () => clock,
  });
/** A sky whose first draw is made, at the anchor, as a globe that never mounted gets it. */
const mount = (): Sky => {
  const sky = mountUnstarted();
  sky.view([0, 0], null, clock);
  return sky;
};

beforeEach(() => {
  vi.useFakeTimers();
  controller = new AbortController();
  host = document.createElement("div");
  stars = document.createElement("canvas");
  band = document.createElement("canvas");
  host.append(band, stars);
  document.body.append(host);
  size = { width: 1440, height: 844 };
  clock = T0;
  hidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  vi.spyOn(host, "getBoundingClientRect").mockImplementation(() => ({
    ...size,
    left: 0,
    top: 0,
    right: size.width,
    bottom: size.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
  starLog = stubContext(stars);
  bandLog = stubContext(band);
  vi.stubGlobal("Path2D", Path);
  vi.stubGlobal("ResizeObserver", Watcher);
  vi.stubGlobal("matchMedia", () => new EventTarget());
  frames = vi.spyOn(globalThis, "requestAnimationFrame");
});

afterEach(() => {
  controller.abort();
  Watcher.last = undefined;
  delete (document as { hidden?: boolean }).hidden;
  vi.useRealTimers();
});

describe("decodeStars", () => {
  it("reads 6 bytes a star, faintest first, with real positions", () => {
    const list = decodeStars(data());
    expect(list.count).toBe(LIST.byteLength / 6);
    expect(list.mag[0]).toBeGreaterThan(list.mag[list.count - 1]!);
    expect(Math.max(...list.mag)).toBeLessThanOrEqual(5.5);
  });

  it.each([
    ["Betelgeuse", 5.919529 * 15, 7.407063, 0.5],
    ["Rigel", 5.242298 * 15, -8.20164, 0.18],
    ["Sirius", 6.752481 * 15, -16.716116, -1.46],
  ])(
    "finds %s within 0.01 degree of its catalogue position",
    (_name, ra, dec, mag) => {
      const list = decodeStars(data());
      let best = Infinity;
      for (let i = 0; i < list.count; i++) {
        if (Math.abs(list.mag[i]! - mag) > 0.2) continue;
        best = Math.min(best, Math.hypot(list.ra[i]! - ra, list.dec[i]! - dec));
      }
      expect(best).toBeLessThan(0.01);
    },
  );
});

describe("the Sun and the Moon", () => {
  const bodies = (): string[] => stars.dataset["skyBodies"]!.split(" ");

  it("are drawn after the stars, and the gate can read where", () => {
    const sky = mount();
    /* Turn the camera so the Moon of 1992-04-12 (RA 134.7, Dec 13.8) is the view's centre. */
    sky.view([siderealDeg(APR_12) + 180 - 134.69, 13.77], CENTRE, APR_12);
    const [sunX, sunY, moonX, moonY, lit] = bodies().map(Number);
    for (const value of [sunX, sunY, moonX, moonY, lit])
      expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(moonX! - CENTRE.x)).toBeLessThan(3);
    expect(Math.abs(moonY! - CENTRE.y)).toBeLessThan(3);
    /* Meeus 48.a: 0.679 of the disc is lit. */
    expect(lit!).toBeCloseTo(0.677, 2);
  });

  it("turn the lit side toward the Sun on screen: Meeus 48.a puts the limb at 285 degrees", () => {
    const sky = mount();
    sky.view([siderealDeg(APR_12) + 180 - 134.69, 13.77], CENTRE, APR_12);
    /* At the view's centre north is up and east is left: the limb is right of up, a little above the horizontal. */
    const angle = starLog.rotations.at(-1)!;
    expect(angle).toBeCloseTo(
      Math.atan2(
        -Math.cos(285 * (Math.PI / 180)),
        -Math.sin(285 * (Math.PI / 180)),
      ),
      1,
    );
  });

  it("never draw smaller than 2.5 px", () => {
    mount();
    expect(starLog.arcs.length).toBeGreaterThan(0);
    for (const radius of starLog.arcs)
      expect(radius).toBeGreaterThanOrEqual(2.5);
  });

  /** The earthshine fill and the lit fill of the Moon when it is the view's centre at `instant`, and the alpha of the first. */
  const moonFills = (instant: number) => {
    const sky = mount();
    const moon = moonRaDec(instant);
    starLog.painted.length = 0;
    sky.view([siderealDeg(instant) + 180 - moon.ra, moon.dec], CENTRE, instant);
    const lit = starLog.painted.findLastIndex(
      ({ style }) => style === "#f4f6ff",
    );
    const before = starLog.painted[lit - 1];
    /* The star drawn last is the brightest, fully opaque; only the earthshine before the lit part is faint. */
    const alpha = before
      ? // oxlint-disable-next-line dox-test/no-implementation-assert -- `style` is the canvas fill colour the stub recorded
        Number(/, ([\d.e-]+)\)$/.exec(before.style)?.[1] ?? 1)
      : 1;
    return {
      shine: alpha < 0.5 ? alpha : 0,
      lit: moonPhase(sunRaDec(instant), moon).lit,
    };
  };

  it("show earthshine on the dark disc: .08 at a new Moon, none at a full one", () => {
    /* The new Moon of 2000-01-06 and the full Moon of 2000-01-21. */
    const fresh = moonFills(947_182_440_000);
    expect(fresh.lit).toBeLessThan(0.01);
    expect(fresh.shine).toBeCloseTo(0.08 * (1 - fresh.lit), 4);
    expect(fresh.shine).toBeGreaterThan(0.079);
    const full = moonFills(948_429_600_000);
    expect(full.lit).toBeGreaterThan(0.99);
    expect(full.shine).toBeLessThan(0.0008);
  });

  it("hide a Sun more than 90 px inside the Earth's disc, and show one at its rim", () => {
    const sky = mount();
    sky.view([0, 0], { ...CENTRE, radius: 2_000 }, T0);
    expect(bodies().slice(0, 2)).toEqual(["none", "none"]);
    sky.view([0, 0], { x: CENTRE.x + 1, y: CENTRE.y, radius: 40 }, T0);
    expect(bodies()[0]).not.toBe("none");
  });

  it("lose the Sun's glare, and keep its disc, when the reader asks for more contrast", () => {
    mount();
    const plain = starLog.gradients;
    controller.abort();
    controller = new AbortController();
    stars = document.createElement("canvas");
    starLog = stubContext(stars);
    vi.stubGlobal("matchMedia", (query: string) =>
      Object.assign(new EventTarget(), {
        matches: query === "(prefers-contrast: more)",
      }),
    );
    mount();
    expect(starLog.gradients).toBe(plain - 1);
    expect(bodies()[0]).not.toBe("none");
  });
});

describe("mountSky", () => {
  it("draws nothing, and is not ready, until the first view", async () => {
    const sky = mountUnstarted();
    let settled = false;
    void sky.ready.then(() => {
      settled = true;
    });
    expect(draws()).toBe(0);
    // oxlint-disable-next-line dox-test/no-implementation-assert -- the page fades the layers in from this attribute
    expect(host.dataset["sky"]).toBeUndefined();
    expect(stars.dataset["skyView"]).toBeUndefined();
    /* A resize, a change of the reader's settings and a minute of the clock draw nothing either. */
    Watcher.last?.callback();
    vi.advanceTimersByTime(20);
    clock += 2 * MINUTE;
    vi.advanceTimersByTime(2 * MINUTE);
    expect(draws()).toBe(0);
    await Promise.resolve();
    expect(settled).toBe(false);
    sky.view([12, 34], CENTRE, clock);
    expect(draws()).toBe(1);
    // oxlint-disable-next-line dox-test/no-implementation-assert -- the page fades the layers in from this attribute
    expect(host.dataset["sky"]).toBe("ready");
    await expect(sky.ready).resolves.toBeUndefined();
    const [ra, dec] = stars.dataset["skyView"]!.split(" ").map(Number);
    expect(ra).toBeCloseTo(skyCentre([12, 34], clock).ra, 3);
    expect(dec).toBeCloseTo(skyCentre([12, 34], clock).dec, 3);
  });

  it("draws once on mount and resolves ready", async () => {
    const sky = mount();
    expect(draws()).toBe(1);
    expect(starLog.fills).toBeGreaterThan(0);
    expect(bandLog.fills).toBeGreaterThan(0);
    await expect(sky.ready).resolves.toBeUndefined();
  });

  it("sizes the stars canvas for the pixel ratio and the band canvas to a quarter", () => {
    vi.stubGlobal("devicePixelRatio", 3);
    mount();
    expect(stars.width).toBe(Math.round(1440 * 1.5));
    expect(band.width).toBe(360);
    expect(band.height).toBe(211);
    vi.unstubAllGlobals();
  });

  it("draws once on mount at the anchor, and says which view it drew", () => {
    mount();
    const [ra, dec, instant] = stars.dataset["skyView"]!.split(" ");
    expect(Number(ra)).toBeCloseTo(17.693, 3);
    expect(Number(dec)).toBe(0);
    expect(Number(instant)).toBe(T0);
  });

  it("draws nothing for a change under the thresholds, and once for a larger one", () => {
    const sky = mount();
    sky.view([0, 0], CENTRE, T0);
    expect(draws()).toBe(2);
    /* 0.005 degree of right ascension and 0.3 px of the Earth's centre. */
    sky.view([-0.005, 0], { x: 600.3, y: 400 }, T0);
    expect(draws()).toBe(2);
    sky.view([-0.5, 0], { x: 600.3, y: 400 }, T0);
    expect(draws()).toBe(3);
    sky.view([-0.5, 0], { x: 601, y: 400 }, T0);
    expect(draws()).toBe(4);
    sky.view([-0.5, 0.004], { x: 601, y: 400.2 }, T0);
    expect(draws()).toBe(4);
    sky.view([-0.5, 0.05], { x: 601, y: 400.2 }, T0);
    expect(draws()).toBe(5);
  });

  it("counts a change from the last draw, so slow drift still lands", () => {
    const sky = mount();
    sky.view([0, 0], CENTRE, T0);
    const before = draws();
    for (let i = 1; i <= 30; i++) sky.view([i * 0.004, 0], CENTRE, T0);
    expect(draws()).toBeGreaterThan(before);
  });

  it("does not draw for a later instant alone: the minute check owns the clock", () => {
    const sky = mount();
    sky.view([0, 0], CENTRE, T0);
    const before = draws();
    sky.view([0, 0], CENTRE, T0 + 2_000);
    sky.view([0, 0], CENTRE, T0 + 120_000);
    expect(draws()).toBe(before);
  });

  it("draws a moved camera at the instant it is given", () => {
    const sky = mount();
    sky.view([5, 0], CENTRE, T0 + 120_000);
    expect(stars.dataset["skyView"]!.split(" ")[2]).toBe(String(T0 + 120_000));
  });

  it("checks the clock each minute at rest and redraws once after drift", () => {
    const sky = mount();
    sky.view([0, 0], CENTRE, T0);
    const before = draws();
    clock = T0 + MINUTE;
    vi.advanceTimersByTime(MINUTE);
    expect(draws()).toBe(before + 1);
    /* A minute in which the clock did not move far enough draws nothing. */
    vi.advanceTimersByTime(MINUTE - 1);
    expect(draws()).toBe(before + 1);
    clock = T0 + 2 * MINUTE;
    vi.advanceTimersByTime(1);
    expect(draws()).toBe(before + 2);
  });

  it("stops the minute check while hidden and takes it up again on return", () => {
    mount();
    hidden = true;
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action changes visibility or a media query; the event is the input
    document.dispatchEvent(new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(0);
    clock = T0 + 10 * MINUTE;
    vi.advanceTimersByTime(10 * MINUTE);
    expect(draws()).toBe(1);
    hidden = false;
    // oxlint-disable-next-line dox-test/no-dispatch-event -- no user action changes visibility or a media query; the event is the input
    document.dispatchEvent(new Event("visibilitychange"));
    expect(draws()).toBe(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("does not draw a hidden layer", () => {
    band.checkVisibility = () => false;
    mount();
    expect(bandLog.fills).toBe(0);
    expect(starLog.fills).toBeGreaterThan(0);
  });

  it("draws nothing before the hero has a size", () => {
    size = { width: 0, height: 0 };
    const sky = mount();
    sky.view([5, 0], CENTRE, T0);
    expect(draws()).toBe(0);
  });

  it("asks for one frame for a resize burst and draws once", () => {
    mount();
    expect(frames).not.toHaveBeenCalled();
    size = { width: 1000, height: 700 };
    Watcher.last?.callback();
    Watcher.last?.callback();
    expect(frames).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20);
    expect(draws()).toBe(2);
    expect(stars.width).toBe(1000);
  });

  it("ignores a resize notice that changes nothing", () => {
    mount();
    Watcher.last?.callback();
    vi.advanceTimersByTime(20);
    expect(draws()).toBe(1);
  });

  it("asks for no frame of its own", () => {
    const sky = mount();
    sky.view([3, 3], CENTRE, T0);
    expect(frames).not.toHaveBeenCalled();
  });

  it("disconnects, cancels a pending frame and the minute check, and draws no more on abort", () => {
    const sky = mount();
    size = { width: 900, height: 600 };
    Watcher.last?.callback();
    const cancel = vi.spyOn(globalThis, "cancelAnimationFrame");
    controller.abort();
    expect(Watcher.last?.disconnected).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    sky.view([20, 0], CENTRE, T0);
    expect(draws()).toBe(1);
  });
});
