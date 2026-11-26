// @vitest-environment jsdom
import {
  drawWithoutGlobe,
  followGlobe,
  loadSky,
  skyInputsOf,
} from "./space-sky";
import type { Sky } from "./sky";
import { EMPTY_POINTS, pointSource, providePoints } from "./sky-registry";
import { skyHost } from "~/test/sky-host";

/* The sky itself is tested in sky.test.ts; here it is a recorder that marks its host ready on its first view, as the real one does. */
const views: {
  rotation: readonly [number, number];
  centre: unknown;
  instant: unknown;
}[] = [];
/** The Milky Way map each mounted sky was given. */
const maps: unknown[] = [];
/** What the painters hook was handed each time: the painters that loaded, none for a body that failed. */
const painters: unknown[] = [];
/** The layers each `maps` call was handed, and the planets' chunk: a stub layer, or one that fails to build. */
const layers: unknown[] = [];
const planets = {
  layer: () =>
    Object.assign(() => {}, { place: () => null, drawn: () => [] }) as unknown,
};
vi.mock("./sky-planets", () => ({ createPlanetLayer: () => planets.layer() }));
vi.mock("./body-paint", () => ({
  createMoonPainter: (map: unknown) => ({ moonFor: map }),
}));
vi.mock("./sun-paint", () => ({
  createSunPainter: (map: unknown) => ({ sunFor: map }),
}));
vi.mock("./sky", () => ({
  mountSky: ({ host, milkyWay }: { host: HTMLElement; milkyWay?: unknown }) => {
    maps.push(milkyWay);
    return {
      ready: Promise.resolve(),
      maps: (painter: unknown, layer: unknown) => {
        painters.push(painter);
        layers.push(layer);
      },
      view: (
        rotation: readonly [number, number],
        centre: unknown,
        instant: unknown,
      ) => {
        views.push({ rotation, centre, instant });
        host.dataset["sky"] = "ready";
      },
    };
  },
}));

let host: HTMLElement;
let controller: AbortController;
let stars: HTMLCanvasElement;
let band: HTMLCanvasElement;

const inputs = () => ({
  stars,
  band,
  host,
  src: "/sky.bin",
  milkyWay: "/milkyway.webp",
  signal: controller.signal,
});

beforeEach(() => {
  views.length = 0;
  maps.length = 0;
  painters.length = 0;
  layers.length = 0;
  planets.layer = () =>
    Object.assign(() => {}, { place: () => null, drawn: () => [] });
  controller = new AbortController();
  ({ host, stars, band } = skyHost());
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
    })),
  );
});

afterEach(() => {
  controller.abort();
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A globe whose camera holds still; each frame callback it is given lands in `frames`. */
const globeAt = (frames: (() => void)[]) => ({
  getRotation: () => [10, 20] as const,
  getCentre: () => ({ x: 100, y: 200, radius: 300 }),
  getZoom: () => 2,
  onFrame: (callback: () => void) => frames.push(callback),
});

describe("the sky", () => {
  it("is built without drawing, so the page stays void until a camera is known", async () => {
    const sky = await loadSky(inputs());
    expect(sky).not.toBeNull();
    expect(views).toHaveLength(0);
    // oxlint-disable-next-line dox-test/no-implementation-assert -- the page fades the layers in from this attribute
    expect(host.dataset["sky"]).toBeUndefined();
  });

  it("is null, not an error, when the star list cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    expect(await loadSky(inputs())).toBeNull();
  });

  it("is null once its caller has gone", async () => {
    controller.abort();
    expect(await loadSky(inputs())).toBeNull();
  });

  it("is drawn once from the globe's camera, then follows each frame until the caller aborts", async () => {
    const sky = loadSky(inputs());
    const frames: (() => void)[] = [];
    const surface = document.createElement("div");
    const drawn = await followGlobe({
      sky,
      globe: globeAt(frames),
      origin: host,
      surface,
      signal: controller.signal,
    });
    expect(drawn).toBe(true);
    expect(views).toHaveLength(1);
    expect(views[0]?.rotation).toEqual([10, 20]);
    expect(views[0]?.centre).toMatchObject({ radius: 300 });
    frames[0]?.();
    expect(views).toHaveLength(2);
    controller.abort();
    frames[0]?.();
    expect(views).toHaveLength(2);
  });

  it("measures nothing on a frame when the globe's surface is the origin itself", async () => {
    const measure = vi.spyOn(host, "getBoundingClientRect");
    const frames: (() => void)[] = [];
    await followGlobe({
      sky: loadSky(inputs()),
      globe: globeAt(frames),
      origin: host,
      surface: host,
      signal: controller.signal,
    });
    frames[0]?.();
    expect(views.map((v) => v.centre)).toEqual([
      { x: 100, y: 200, radius: 300 },
      { x: 100, y: 200, radius: 300 },
    ]);
    expect(measure).not.toHaveBeenCalled();
  });

  it("shows the instant its caller gives, and gmt's now without one", async () => {
    const globe = {
      getRotation: () => [0, 0] as const,
      getCentre: () => ({ x: 0, y: 0, radius: 1 }),
      getZoom: () => 1,
      onFrame: () => {},
    };
    await followGlobe({
      sky: loadSky(inputs()),
      globe,
      origin: host,
      surface: host,
      signal: controller.signal,
      instant: () => 1_800_000_000_000,
    });
    expect(views.at(-1)?.instant).toBe(1_800_000_000_000);
    await followGlobe({
      sky: loadSky(inputs()),
      globe,
      origin: host,
      surface: host,
      signal: controller.signal,
    });
    expect(views.at(-1)?.instant).toBeGreaterThan(1_700_000_000_000);
  });

  it("is not followed when there is no sky", async () => {
    const frames: (() => void)[] = [];
    const drawn = await followGlobe({
      sky: Promise.resolve<Sky | null>(null),
      globe: {
        getRotation: () => [0, 0],
        getCentre: () => ({ x: 0, y: 0, radius: 1 }),
        getZoom: () => 1,
        onFrame: (callback) => frames.push(callback),
      },
      origin: host,
      surface: host,
      signal: controller.signal,
    });
    expect(drawn).toBe(false);
    expect(frames).toHaveLength(0);
  });

  it("is drawn once at the start rotation and the anchor when the globe fails", async () => {
    const sky = loadSky(inputs());
    await drawWithoutGlobe(sky, host, controller.signal);
    expect(views).toHaveLength(1);
    expect(views[0]?.centre).toBeNull();
    // oxlint-disable-next-line dox-test/no-implementation-assert -- the page fades the layers in from this attribute
    expect(host.dataset["sky"]).toBe("ready");
    await drawWithoutGlobe(sky, host, controller.signal);
    expect(views).toHaveLength(1);
  });
});

const pixels = { width: 2, height: 1, data: new Uint8ClampedArray(8) };

/** A browser that decodes any map to `pixels`, or fails `failUrl` at `failAt`. */
function decoder(failAt?: "fetch" | "decode", failUrl = "/milkyway.webp") {
  const closed = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: !(failAt === "fetch" && url === failUrl),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
    })),
  );
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => {
      if (failAt === "decode") throw new Error("cannot decode");
      return { width: 2, height: 1, close: closed };
    }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => {},
    getImageData: () => pixels,
  } as never);
  return closed;
}

describe("the Milky Way", () => {
  it("is fetched with the stars, decoded to its pixels and handed to the sky", async () => {
    const closed = decoder();
    await loadSky(inputs());
    expect(fetch).toHaveBeenCalledWith("/milkyway.webp", expect.anything());
    expect(maps).toEqual([pixels]);
    expect(closed).toHaveBeenCalled();
  });

  it.each(["fetch", "decode"] as const)(
    "is left out when its %s fails, and the stars are still drawn",
    async (failAt) => {
      decoder(failAt);
      const sky = loadSky(inputs());
      await drawWithoutGlobe(sky, host, controller.signal);
      expect(maps).toEqual([undefined]);
      expect(views).toHaveLength(1);
    },
  );
});

describe("the bodies' maps", () => {
  const withBodies = () => ({
    ...inputs(),
    sunMap: "/sun.webp",
    moonMap: "/moon.webp",
  });
  /** Lets every promise and the stubbed idle callback run. */
  const settle = () => vi.advanceTimersByTimeAsync(0);
  const mapFetches = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(
        ([url]) => url === "/moon.webp" || url === "/sun.webp",
      );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", (callback: () => void) =>
      setTimeout(callback, 50),
    );
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
    }));
  });

  afterEach(() => {
    controller.abort();
    providePoints(null);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("hand the planets' layer to the sky and the registry its source, and take the source back when the sky goes", async () => {
    decoder();
    expect(pointSource()).toBeNull();
    await loadSky(withBodies());
    await vi.advanceTimersByTimeAsync(100);
    expect(typeof layers[0]).toBe("function");
    expect(pointSource()).toBe(layers[0]);
    controller.abort();
    expect(pointSource()).toBeNull();
  });

  it("leave the planets out, and the list no longer waiting for them, when their chunk fails to build", async () => {
    decoder();
    planets.layer = () => {
      throw new Error("no chunk");
    };
    await loadSky(withBodies());
    await vi.advanceTimersByTimeAsync(100);
    expect(layers).toEqual([undefined]);
    expect(pointSource()).toBe(EMPTY_POINTS);
    expect(painters).toEqual([
      { sun: { sunFor: pixels }, moon: { moonFor: pixels } },
    ]);
  });

  it("are fetched only after the sky is built and the browser idle, both in one wait, then handed over as painters", async () => {
    decoder();
    await loadSky(withBodies());
    await vi.advanceTimersByTimeAsync(10);
    expect(mapFetches()).toHaveLength(0);
    expect(stars.dataset["skyMaps"]).toBe("flat");
    await vi.advanceTimersByTimeAsync(50);
    expect(mapFetches()).toHaveLength(2);
    expect(painters).toEqual([
      { sun: { sunFor: pixels }, moon: { moonFor: pixels } },
    ]);
    expect(stars.dataset["skyMaps"]).toBe("ready");
  });

  it("load the one map a page declares and leave the other body flat", async () => {
    decoder();
    await loadSky({ ...inputs(), moonMap: "/moon.webp" });
    await vi.advanceTimersByTimeAsync(100);
    expect(mapFetches()).toHaveLength(1);
    expect(painters).toEqual([{ moon: { moonFor: pixels } }]);
  });

  it("are not fetched under forced colours, where the sky is hidden", async () => {
    decoder();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(forced-colors: active)",
    }));
    await loadSky(withBodies());
    await settle();
    await vi.advanceTimersByTimeAsync(100);
    expect(mapFetches()).toHaveLength(0);
    expect(painters).toEqual([]);
  });

  it("are not fetched when the caller goes before the idle wait ends", async () => {
    decoder();
    await loadSky(withBodies());
    controller.abort();
    await vi.advanceTimersByTimeAsync(100);
    expect(mapFetches()).toHaveLength(0);
    expect(painters).toEqual([]);
  });

  it.each([
    ["/sun.webp", { moon: { moonFor: pixels } }],
    ["/moon.webp", { sun: { sunFor: pixels } }],
  ])(
    "leave the other body textured, and the sky ready, when the map at %s fails",
    async (failUrl, expected) => {
      decoder("fetch", failUrl);
      await loadSky(withBodies());
      await vi.advanceTimersByTimeAsync(100);
      expect(painters).toEqual([expected]);
      expect(stars.dataset["skyMaps"]).toBe("ready");
    },
  );

  it("leave both bodies flat, with no throw, and say so, when both maps fail to decode", async () => {
    decoder("decode");
    await loadSky(withBodies());
    await vi.advanceTimersByTimeAsync(100);
    expect(painters).toEqual([{}]);
    expect(stars.dataset["skyMaps"]).toBe("failed");
  });

  it("are never asked for by a page that declares none", async () => {
    decoder();
    await loadSky(inputs());
    await vi.advanceTimersByTimeAsync(100);
    expect(mapFetches()).toHaveLength(0);
    /* No map is fetched, but the planets still load and the sky is handed their layer, with no painters. */
    expect(painters).toEqual([{}]);
    expect(typeof layers[0]).toBe("function");
  });
});

describe("a page's sky inputs", () => {
  it("are read from its attributes, with the canvases inside it", () => {
    host.dataset["skySrc"] = "/sky.bin";
    host.dataset["milkyWay"] = "/mw.webp";
    host.dataset["sunMap"] = "/sun.webp";
    host.dataset["moonMap"] = "/moon.webp";
    host.querySelector("canvas")!.dataset["skyCanvas"] = "band";
    host.querySelectorAll("canvas")[1]!.dataset["skyCanvas"] = "stars";
    expect(skyInputsOf(host, host, controller.signal)).toEqual({
      stars: host.querySelectorAll("canvas")[1],
      band: host.querySelector("canvas"),
      host,
      src: "/sky.bin",
      milkyWay: "/mw.webp",
      sunMap: "/sun.webp",
      moonMap: "/moon.webp",
      signal: controller.signal,
    });
  });

  it("are null when the page has no star list or no canvases", () => {
    expect(skyInputsOf(host, host, controller.signal)).toBeNull();
    host.dataset["skySrc"] = "/sky.bin";
    expect(skyInputsOf(host, host, controller.signal)).toBeNull();
  });
});
