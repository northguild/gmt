// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeStars, mountSky, type Sky, type SkyMap } from "./sky";
import { G } from "./globe/pinhole";
import {
  SUN_RADIUS,
  moonFromCamera,
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
    /** Each radial gradient's inner and outer radius. */
    radial: [] as [number, number][],
    arcs: [] as number[],
    /** Each fill's colour (`erase` if it clears) and the last arc's radius, in order. */
    painted: [] as { style: string; radius: number }[],
    rotations: [] as number[],
    /** Each clip: its fill rule, its rectangle and circle, and the fills made before it. */
    clips: [] as {
      rule: string;
      rect: number[];
      circle: number[];
      fillsBefore: number;
    }[],
    /** Saves not yet restored. */
    depth: 0,
    /** The pixels last put on the canvas whole. */
    image: undefined as ImageData | undefined,
    puts: 0,
  };
  const gradient = { addColorStop: vi.fn() };
  let style = "";
  let radius = 0;
  let rect: number[] = [];
  let circle: number[] = [];
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
    globalCompositeOperation: "source-over",
    fill() {
      if (this.globalCompositeOperation === "destination-out")
        return void log.painted.push({ style: "erase", radius });
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
    createRadialGradient: (...args: number[]) => {
      log.gradients += 1;
      log.radial.push([args[2]!, args[5]!]);
      return gradient;
    },
    arc: (x: number, y: number, r: number) => {
      radius = r;
      circle = [x, y, r];
      log.arcs.push(r);
    },
    ellipse: () => {},
    rect: (...box: number[]) => {
      rect = box;
    },
    /* A clip's circle outlines what is kept clear, so it is not a drawn disc. */
    clip: (rule: string) => {
      log.arcs.pop();
      log.clips.push({ rule, rect, circle, fillsBefore: log.fills });
    },
    save: () => {
      log.depth += 1;
    },
    restore: () => {
      log.depth -= 1;
    },
    translate: () => {},
    rotate: (angle: number) => {
      log.rotations.push(angle);
    },
    createImageData: (width: number, height: number) =>
      ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }) as ImageData,
    putImageData: (image: ImageData) => {
      log.image = image;
      log.puts += 1;
    },
  };
  canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;
  return log;
}

/** An all-sky map, 0.5 degree a cell unless sized, dark but for `bright(ra, dec)` at each cell's centre. */
function skyMap(
  bright: (ra: number, dec: number) => number,
  [width, height] = [720, 360],
): SkyMap {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      data[(y * width + x) * 4] = bright(
        (360 * (x + 0.5)) / width,
        90 - (180 * (y + 0.5)) / height,
      );
  return { width, height, data };
}

/** The band's alpha at a place in the hero, CSS pixels. */
const glowAt = (x: number, y: number): number => {
  const image = bandLog.image!;
  return image.data[
    (Math.floor(y / 8) * image.width + Math.floor(x / 8)) * 4 + 3
  ]!;
};

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
let milkyWay: SkyMap | undefined;

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
    milkyWay,
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
  milkyWay = skyMap(() => 255);
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
    /* Turn the camera so the Moon of 1992-04-12 is the view's centre. */
    const at = moonRaDec(APR_12);
    sky.view([siderealDeg(APR_12) + 180 - at.ra, at.dec], CENTRE, APR_12);
    const [sun, , ...moon] = bodies();
    const [moonX, moonY, lit] = moon.map(Number);
    /* A Moon more than half lit is more than 90 degrees from the Sun: looking at it, the Sun is behind you. */
    expect(sun).toBe("none");
    expect(Math.abs(moonX! - CENTRE.x)).toBeLessThan(3);
    expect(Math.abs(moonY! - CENTRE.y)).toBeLessThan(3);
    /* Meeus 48.a: 0.679 of the disc is lit. */
    expect(lit!).toBeCloseTo(0.677, 2);
  });

  it("turn the lit side toward the Sun on screen: Meeus 48.a puts the limb at 285 degrees", () => {
    const sky = mount();
    const moon = moonRaDec(APR_12);
    sky.view([siderealDeg(APR_12) + 180 - moon.ra, moon.dec], CENTRE, APR_12);
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
    const rotation: [number, number] = [
      siderealDeg(instant) + 180 - moon.ra,
      moon.dec,
    ];
    starLog.painted.length = 0;
    sky.view(rotation, CENTRE, instant);
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
      lit: moonFromCamera(instant, rotation).lit,
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

  /** 2026-11-17T12:00:00Z, a first-quarter Moon, where the camera's parallax moves the lit fraction most. */
  const QUARTER = 1_794_916_800_000;
  /** A rotation that puts the Moon of `QUARTER` `by` degrees of right ascension off the point behind the Earth. */
  const offMoon = (by: number): [number, number] => {
    const moon = moonRaDec(QUARTER);
    return [siderealDeg(QUARTER) + 180 - moon.ra + by, moon.dec];
  };

  it("light the Moon as the camera sees it, not as the Earth's centre would", () => {
    const sky = mount();
    sky.view(offMoon(8), { ...CENTRE, radius: 300 }, QUARTER);
    const lit = Number(bodies()[4]);
    expect(bodies()[2]).not.toBe("none");
    expect(lit).toBeCloseTo(moonFromCamera(QUARTER, offMoon(8)).lit, 3);
    /* The camera exactly opposite the Moon sees the geocentric phase; 8 degrees off, a different one. */
    expect(
      Math.abs(lit - moonFromCamera(QUARTER, offMoon(0)).lit),
    ).toBeGreaterThan(0.002);
  });

  it("do not draw a Moon outside the field of view, and draw the same Moon inside it", () => {
    const sky = mount();
    const litFills = (by: number): number => {
      starLog.painted.length = 0;
      sky.view(offMoon(by), { ...CENTRE, radius: 300 }, QUARTER);
      return starLog.painted.filter(({ style }) => style === "#f4f6ff").length;
    };
    expect(litFills(8)).toBe(1);
    expect(bodies()[2]).not.toBe("none");
    expect(litFills(60)).toBe(0);
    expect(bodies()[2]).toBe("none");
  });

  /** A rotation that puts the Sun `by` degrees of right ascension off the point behind the Earth. */
  const offSun = (by: number): [number, number] => {
    const sun = sunRaDec(T0);
    return [siderealDeg(T0) + 180 - sun.ra + by, sun.dec];
  };

  it("cover the Sun with the Moon at an eclipse: the annular one a camera sees on 2026-08-12", () => {
    /* 20:12 UTC, 13.5 degrees of right ascension and 2.5 of declination off the Sun from the point
       behind the Earth: from this camera the Moon's centre is 0.003 degree from the Sun's, and its
       disc, 0.244 degree in radius, is smaller than the Sun's 0.267, so a ring of the Sun shows. */
    /* 2026-08-12T20:12:00Z. */
    const instant = 1_786_565_520_000;
    const sun = sunRaDec(instant);
    const rotation: [number, number] = [
      siderealDeg(instant) + 180 - sun.ra + 13.5,
      sun.dec - 2.5,
    ];
    const sky = mount();
    starLog.painted.length = 0;
    sky.view(rotation, { ...CENTRE, radius: 200 }, instant);
    const [sunX, sunY, moonX, moonY] = bodies().map(Number);
    expect(Math.hypot(sunX! - moonX!, sunY! - moonY!)).toBeLessThan(0.5);
    /* The Sun is drawn first, then the Moon's disc clears it and the Moon is drawn over the gap. */
    const styles = starLog.painted.map(({ style }) => style);
    const core = styles.indexOf("#fffaf0");
    const cleared = styles.indexOf("erase");
    expect(core).toBeGreaterThan(-1);
    expect(cleared).toBeGreaterThan(core);
    expect(styles.indexOf("#f4f6ff")).toBeGreaterThan(cleared);
    const moon = starLog.painted[cleared]!.radius;
    expect(moon).toBeLessThan(starLog.painted[core]!.radius);
    /* The Milky Way behind the Moon is left out too, and shows just past its limb. */
    expect(glowAt(moonX!, moonY!)).toBe(0);
    expect(glowAt(moonX! + moon + 16, moonY!)).toBeGreaterThan(0);
  });

  it("hide a Sun whose glare lies wholly inside the Earth's disc, and show one whose glare reaches its rim", () => {
    const sky = mount();
    /* At an Earth of 300 px (f = 1,960) the Sun's disc is 9.2 px and its glare reaches 27.5 px: 7.5 degrees off the centre is 258 px, 258 + 27.5 inside the rim; 8.3 degrees is 286 px, past it. */
    sky.view(offSun(7.5), { ...CENTRE, radius: 300 }, T0);
    expect(bodies().slice(0, 2)).toEqual(["none", "none"]);
    sky.view(offSun(8.3), { ...CENTRE, radius: 300 }, T0);
    expect(bodies()[0]).not.toBe("none");
  });

  it("show a Sun at the view's centre when no globe is drawn, since no Earth hides it", () => {
    const sky = mount();
    sky.view(offSun(0), null, T0);
    expect(bodies()[0]).not.toBe("none");
    sky.view(offSun(0), { ...CENTRE, radius: 300 }, T0);
    expect(bodies()[0]).toBe("none");
  });

  it("grow the Sun's glare with its disc: two of its radii past its edge, at every zoom", () => {
    const sky = mount();
    for (const radius of [150, 300]) {
      sky.view(offSun(10), { ...CENTRE, radius }, T0);
      const [inner, outer] = starLog.radial.at(-1)!;
      expect(outer).toBeCloseTo(3 * inner, 6);
      expect(inner).toBeCloseTo(
        (radius * G * Math.tan(SUN_RADIUS * (Math.PI / 180))) /
          Math.cos(10 * (Math.PI / 180)),
        1,
      );
    }
  });

  it("draw nothing inside the solid Earth's disc on either canvas, and keep nothing out with no globe", () => {
    const sky = mount();
    expect(starLog.clips.at(-1)!.circle[2]).toBe(0);
    sky.view(offSun(5), CENTRE, T0);
    expect(glowAt(CENTRE.x, CENTRE.y)).toBeGreaterThan(0);
    const stars = starLog.fills;
    sky.view(offSun(5), { ...CENTRE, radius: 160 }, T0);
    /* The whole hero less the Earth's disc, set before anything of the draw is filled. */
    expect(starLog.clips.at(-1)).toEqual({
      rule: "evenodd",
      rect: [0, 0, 1440, 844],
      circle: [600, 400, 160],
      fillsBefore: stars,
    });
    /* The band is drawn pixel by pixel, so it leaves the disc out pixel by pixel. */
    expect(glowAt(CENTRE.x, CENTRE.y)).toBe(0);
    expect(glowAt(CENTRE.x + 155, CENTRE.y)).toBe(0);
    expect(glowAt(CENTRE.x + 170, CENTRE.y)).toBeGreaterThan(0);
    expect(starLog.depth).toBe(0);
  });

  it("puts the Sun's place on the globe's camera: its offset from the Earth's centre grows with the Earth's radius, a lens zoom", () => {
    const sky = mount();
    sky.view(offSun(8), { ...CENTRE, radius: 100 }, T0, 1);
    const [sunX1, sunY1] = bodies().map(Number);
    sky.view(offSun(8), { ...CENTRE, radius: 300 }, T0, 3);
    const [sunX2, sunY2] = bodies().map(Number);
    expect(Math.abs(sunX1! - CENTRE.x)).toBeGreaterThan(50);
    /* The gate rounds each place to 0.1 px, so a threefold scale-up can be a few tenths off. */
    expect(sunX2! - CENTRE.x).toBeCloseTo(3 * (sunX1! - CENTRE.x), 0);
    expect(sunY2! - CENTRE.y).toBeCloseTo(3 * (sunY1! - CENTRE.y), 0);
  });

  it("leave out a Sun outside the field of view, off the hero's edge, and one at its edge with glare to spare", () => {
    const sky = mount();
    /* At f = 1,960 the hero's left and right edges are 17 and 20 degrees from the centre. */
    sky.view(offSun(10), { ...CENTRE, radius: 300 }, T0);
    expect(bodies()[0]).not.toBe("none");
    sky.view(offSun(60), { ...CENTRE, radius: 300 }, T0);
    expect(bodies()[0]).toBe("none");
  });

  it.each([
    ["Sun", 0, sunRaDec(T0)],
    ["Moon", 2, moonRaDec(T0)],
  ] as const)(
    "leave out a %s behind the reader, past 90 degrees from the point behind the Earth",
    (_, index, body) => {
      const sky = mount();
      /* At the body's own declination, 10 degrees of right ascension is 10 degrees of arc and 100 is 99. */
      const turned = (by: number): [number, number] => [
        siderealDeg(T0) + 180 - body.ra + by,
        body.dec,
      ];
      sky.view(turned(10), { ...CENTRE, radius: 300 }, T0);
      expect(bodies()[index]).not.toBe("none");
      sky.view(turned(100), { ...CENTRE, radius: 300 }, T0);
      expect(bodies()[index]).toBe("none");
    },
  );

  it("redraws on a zoom alone, with no rotation, centre or clock change", () => {
    const sky = mount();
    sky.view([0, 0], CENTRE, T0, 1);
    const before = draws();
    sky.view([0, 0], CENTRE, T0, 1.5);
    expect(draws()).toBe(before + 1);
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
    expect(bandLog.puts).toBe(1);
    await expect(sky.ready).resolves.toBeUndefined();
  });

  it("sizes the stars canvas for the pixel ratio and the band canvas to an eighth", () => {
    vi.stubGlobal("devicePixelRatio", 3);
    mount();
    expect(stars.width).toBe(Math.round(1440 * 1.5));
    expect(band.width).toBe(180);
    expect(band.height).toBe(106);
    expect([bandLog.image!.width, bandLog.image!.height]).toEqual([180, 106]);
    vi.unstubAllGlobals();
  });

  it("draws once on mount at the anchor, and says which view it drew", () => {
    mount();
    const [ra, dec, instant] = stars.dataset["skyView"]!.split(" ");
    expect(Number(ra)).toBeCloseTo(17.693, 3);
    expect(Number(dec)).toBe(0);
    expect(Number(instant)).toBe(T0);
  });

  it("says which camera it drew: the Earth's centre and radius it was given", () => {
    const sky = mount();
    sky.view([0, 0], { x: 612.34, y: 401.26, radius: 287.72 }, T0);
    // oxlint-disable-next-line dox-test/no-implementation-assert -- the gate reads this attribute to check the sky used the globe's camera
    expect(stars.dataset["skyCamera"]).toBe("612.3 401.3 287.7");
  });

  it("redraws for a change of the Earth's radius alone of half a pixel, and not for less", () => {
    const sky = mount();
    sky.view([0, 0], { ...CENTRE, radius: 300 }, T0);
    const before = draws();
    sky.view([0, 0], { ...CENTRE, radius: 300.3 }, T0);
    expect(draws()).toBe(before);
    sky.view([0, 0], { ...CENTRE, radius: 300.6 }, T0);
    expect(draws()).toBe(before + 1);
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

  it("redraws for a tilt past 89 degrees, where the readout's declination stops", () => {
    const sky = mount();
    sky.view([0, 89], CENTRE, T0);
    const before = draws();
    sky.view([0, 89.9], CENTRE, T0);
    expect(draws()).toBe(before + 1);
  });

  it("counts a change from the last draw, so slow drift still lands", () => {
    const sky = mount();
    sky.view([0, 0], CENTRE, T0);
    const before = draws();
    for (let i = 1; i <= 30; i++) sky.view([i * 0.004, 0], CENTRE, T0);
    expect(draws()).toBeGreaterThan(before);
  });

  it("follows the clock from a caller ticking each second, once it has turned the view 0.01 degree", () => {
    /* The sidereal clock turns the sky 360.9856 degrees a day (Astronomical Almanac, Section B),
       0.00418 degree a second: 2 s stays under the 0.01 degree step, 3 s is past it. */
    const sky = mount();
    sky.view([0, 0], CENTRE, T0);
    const before = draws();
    sky.view([0, 0], CENTRE, T0 + 1_000);
    sky.view([0, 0], CENTRE, T0 + 2_000);
    expect(draws()).toBe(before);
    sky.view([0, 0], CENTRE, T0 + 3_000);
    expect(draws()).toBe(before + 1);
    expect(stars.dataset["skyView"]!.split(" ")[2]).toBe(String(T0 + 3_000));
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
    expect(bandLog.puts).toBe(0);
    expect(starLog.fills).toBeGreaterThan(0);
  });

  it("draws no Milky Way without its map, and the stars still", () => {
    milkyWay = undefined;
    mount();
    expect(bandLog.puts).toBe(0);
    expect(bandLog.clears).toBeGreaterThan(0);
    expect(starLog.fills).toBeGreaterThan(0);
  });

  it("reads the map where the camera looks: a bright cell at the Sun is drawn where the Sun is", () => {
    /* The Sun 10 degrees east and 3 north of the point behind the Earth, past the disc's rim, so
       a flip of either axis puts the bright cell on the far side of the centre. */
    const sun = sunRaDec(T0);
    const cell = (degrees: number): number =>
      Math.floor(degrees * 2) / 2 + 0.25;
    milkyWay = skyMap((ra, dec) =>
      ra === cell(sun.ra) && dec === cell(sun.dec) ? 255 : 0,
    );
    const sky = mount();
    sky.view(
      [siderealDeg(T0) + 180 - sun.ra + 10, sun.dec - 3],
      { ...CENTRE, radius: 150 },
      T0,
    );
    const [sunX, sunY] = stars.dataset["skyBodies"]!.split(" ").map(Number);
    expect(Math.hypot(sunX! - CENTRE.x, sunY! - CENTRE.y)).toBeGreaterThan(150);
    const { data, width } = bandLog.image!;
    let peak = 3;
    for (let i = 3; i < data.length; i += 4)
      if (data[i]! > data[peak]!) peak = i;
    const x = (((peak - 3) / 4) % width) * 8 + 4;
    const y = Math.floor((peak - 3) / 4 / width) * 8 + 4;
    expect(data[peak]).toBeGreaterThan(0);
    /* The cell is 0.5 degree across, about 10 px here; a band pixel is 8. */
    expect(Math.hypot(x - sunX!, y - sunY!)).toBeLessThan(16);
  });

  /** Draws the Sun 10 degrees east and 3 north of the point behind the Earth, off its disc, and returns where it is. */
  function sunOffDisc(): { x: number; y: number; ra: number; dec: number } {
    const sun = sunRaDec(T0);
    const sky = mount();
    sky.view(
      [siderealDeg(T0) + 180 - sun.ra + 10, sun.dec - 3],
      { ...CENTRE, radius: 150 },
      T0,
    );
    const [x, y] = stars.dataset["skyBodies"]!.split(" ").map(Number);
    expect(Math.hypot(x! - CENTRE.x, y! - CENTRE.y)).toBeGreaterThan(150);
    return { x: x!, y: y!, ...sun };
  }

  it("draws a full map cell at the band's peak alpha, and nothing on the Earth's disc", () => {
    milkyWay = skyMap(() => 255);
    sunOffDisc();
    /* 255 x 0.09 x 8 = 183.6, rounded by the image's clamped bytes. */
    expect(glowAt(CENTRE.x + 400, CENTRE.y)).toBe(184);
    expect(glowAt(20, 20)).toBe(184);
    expect(glowAt(CENTRE.x, CENTRE.y)).toBe(0);
  });

  it("reads the map between cell centres, so a two-cell map ramps from one centre to the other", () => {
    /* A cell's value belongs to its centre: a sample half a cell off one is the two cells' mean.
       Reading cells by their corner instead shifts each ramp by half a cell. */
    const full = 255 * 0.09 * 8;
    const across = (ra: number): number =>
      Math.abs(((((ra - 90) % 360) + 540) % 360) - 180);
    milkyWay = skyMap((ra) => (ra < 180 ? 255 : 0), [2, 2]);
    const east = sunOffDisc();
    expect(glowAt(east.x, east.y)).toBeCloseTo(
      full * Math.max(0, 1 - across(east.ra) / 180),
      -0.5,
    );
    milkyWay = skyMap((_, dec) => (dec < 0 ? 255 : 0), [2, 2]);
    const south = sunOffDisc();
    expect(glowAt(south.x, south.y)).toBeCloseTo(
      full * Math.min(1, Math.max(0, (45 - south.dec) / 90)),
      -0.5,
    );
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
