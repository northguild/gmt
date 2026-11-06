// @vitest-environment jsdom
import {
  followGlobe,
  offerGlobe,
  skyWithoutGlobe,
  startHeroEntrance,
  startHeroSky,
} from "./hero-space";
import type { GlobeHost } from "./globe";

/* The sky itself is tested in sky.test.ts; here it is a recorder that marks the hero ready on its first view, as the real one does. */
const views: { rotation: readonly [number, number]; centre: unknown }[] = [];
vi.mock("./sky", () => ({
  mountSky: ({ host }: { host: HTMLElement }) => ({
    ready: Promise.resolve(),
    view: (rotation: readonly [number, number], centre: unknown) => {
      views.push({ rotation, centre });
      host.dataset["sky"] = "ready";
    },
  }),
}));
const meteors: number[] = [];
vi.mock("./space-fx", () => ({
  mountSpaceFx: () => {
    meteors.push(1);
  },
}));

let hero: HTMLElement;
let skyRoot: HTMLElement;
let controller: AbortController;

const globe = (frames: (() => void)[]): GlobeHost =>
  ({
    getRotation: () => [10, 20],
    getCentre: () => ({ x: 100, y: 200, radius: 300 }),
    onFrame: (callback: () => void) => frames.push(callback),
  }) as unknown as GlobeHost;

beforeEach(() => {
  views.length = 0;
  meteors.length = 0;
  controller = new AbortController();
  hero = document.createElement("div");
  hero.dataset["gate"] = "hero-stage";
  skyRoot = document.createElement("div");
  skyRoot.dataset["heroSky"] = "";
  skyRoot.dataset["src"] = "/sky.bin";
  for (const which of ["band", "stars", "meteor"]) {
    const canvas = document.createElement("canvas");
    canvas.dataset["skyCanvas"] = which;
    skyRoot.append(canvas);
  }
  const copy = document.createElement("div");
  copy.dataset["gate"] = "hero-copy";
  hero.append(skyRoot, copy);
  document.body.append(hero);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })),
  );
});

afterEach(() => {
  controller.abort();
  hero.remove();
  vi.unstubAllGlobals();
});

const sky = (): HTMLElement => skyRoot;

describe("the hero's sky", () => {
  it("is not drawn, and has no meteor, when the page starts it", async () => {
    startHeroSky(sky());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(views).toHaveLength(0);
    // oxlint-disable-next-line dox-test/no-implementation-assert -- the page fades the layers in from this attribute
    expect(hero.dataset["sky"]).toBeUndefined();
    expect(meteors).toHaveLength(0);
  });

  it("is drawn once from the globe's camera, before any frame, then the meteor starts", async () => {
    startHeroSky(sky());
    const frames: (() => void)[] = [];
    const stage = document.createElement("div");
    await followGlobe(hero, globe(frames), stage, stage, controller.signal);
    expect(views).toHaveLength(1);
    expect(views[0]?.rotation).toEqual([10, 20]);
    expect(views[0]?.centre).toMatchObject({ radius: 300 });
    // oxlint-disable-next-line dox-test/no-implementation-assert -- the page fades the layers in from this attribute
    expect(hero.dataset["sky"]).toBe("ready");
    expect(meteors).toHaveLength(1);
    frames[0]?.();
    expect(views).toHaveLength(2);
  });

  it("is drawn once at the start rotation and the anchor when the globe fails", async () => {
    startHeroSky(sky());
    await skyWithoutGlobe(hero);
    expect(views).toHaveLength(1);
    expect(views[0]?.centre).toBeNull();
    // oxlint-disable-next-line dox-test/no-implementation-assert -- the page fades the layers in from this attribute
    expect(hero.dataset["sky"]).toBe("ready");
    await skyWithoutGlobe(hero);
    expect(views).toHaveLength(1);
  });
});

describe("the hero's entrance", () => {
  const html = document.documentElement;

  /** A globe that can dawn, recording when it is told to. */
  function dawner(ready: Promise<void> = Promise.resolve()) {
    const startDawn = vi.fn(async () => {});
    return {
      startDawn,
      globe: { dawnReady: ready, startDawn } as unknown as GlobeHost,
    };
  }

  beforeEach(() => {
    html.dataset["entrance"] = "wait";
    vi.spyOn(performance, "mark").mockReturnValue({} as PerformanceMark);
  });
  afterEach(() => {
    delete html.dataset["entrance"];
    vi.restoreAllMocks();
  });

  it("runs once the sky has drawn and the globe is offered, and starts the dawn", async () => {
    startHeroSky(sky());
    startHeroEntrance(hero, controller.signal);
    const { globe: stub, startDawn } = dawner();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(html.dataset["entrance"]).toBe("wait");

    offerGlobe(hero, stub);
    await vi.waitFor(() => expect(html.dataset["entrance"]).toBe("run"));
    expect(startDawn).toHaveBeenCalledTimes(1);
  });

  it("holds the dawn until the renderer is ready", async () => {
    let upload = () => {};
    const { globe: stub, startDawn } = dawner(
      new Promise<void>((resolve) => (upload = resolve)),
    );
    startHeroSky(sky());
    startHeroEntrance(hero, controller.signal);
    offerGlobe(hero, stub);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(startDawn).not.toHaveBeenCalled();
    upload();
    await vi.waitFor(() => expect(startDawn).toHaveBeenCalledTimes(1));
  });

  it("starts the meteor only after the entrance has brought the sky in", async () => {
    vi.useFakeTimers();
    try {
      startHeroSky(sky());
      const stage = document.createElement("div");
      const following = followGlobe(
        hero,
        globe([]),
        stage,
        stage,
        controller.signal,
      );
      await vi.advanceTimersByTimeAsync(2899);
      expect(meteors).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      await following;
      expect(meteors).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs when the globe never mounts", async () => {
    startHeroSky(sky());
    startHeroEntrance(hero, controller.signal);
    await skyWithoutGlobe(hero);
    offerGlobe(hero, null);
    await vi.waitFor(() => expect(html.dataset["entrance"]).toBe("run"));
  });
});
