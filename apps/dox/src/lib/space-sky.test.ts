// @vitest-environment jsdom
import { drawWithoutGlobe, followGlobe, loadSky } from "./space-sky";
import type { Sky } from "./sky";

/* The sky itself is tested in sky.test.ts; here it is a recorder that marks its host ready on its first view, as the real one does. */
const views: {
  rotation: readonly [number, number];
  centre: unknown;
  instant: unknown;
}[] = [];
/** The Milky Way map each mounted sky was given. */
const maps: unknown[] = [];
vi.mock("./sky", () => ({
  mountSky: ({ host, milkyWay }: { host: HTMLElement; milkyWay?: unknown }) => {
    maps.push(milkyWay);
    return {
      ready: Promise.resolve(),
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
  controller = new AbortController();
  host = document.createElement("div");
  stars = document.createElement("canvas");
  band = document.createElement("canvas");
  host.append(band, stars);
  document.body.append(host);
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
      globe: {
        getRotation: () => [10, 20],
        getCentre: () => ({ x: 100, y: 200, radius: 300 }),
        getZoom: () => 2,
        onFrame: (callback) => frames.push(callback),
      },
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

describe("the Milky Way", () => {
  const pixels = { width: 2, height: 1, data: new Uint8ClampedArray(8) };

  /** A browser that decodes the map to `pixels`, or fails at `failAt`. */
  function decoder(failAt?: "fetch" | "decode") {
    const closed = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !(failAt === "fetch" && url === "/milkyway.webp"),
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

  it("is fetched with the stars, decoded to its pixels and handed to the sky", async () => {
    const closed = decoder();
    await loadSky(inputs());
    expect(fetch).toHaveBeenCalledWith("/milkyway.webp");
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
