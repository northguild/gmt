/**
 * The fakes the space stage's tests share: the globe engine, the ice wall, gmt's zoned clock, the
 * venue clock, the theme reader and the sky, as the factories each test file hands to `vi.mock`
 * (a factory is imported inside `vi.mock`'s callback, so hoisting cannot reach it early), and the
 * three-slide deck they run over. A test file keeps its own `root`, `abort` and `stage`.
 */
import { Temporal } from "@js-temporal/polyfill";

export const NOW = Temporal.Instant.from(
  "2027-02-06T12:00:00Z",
).epochMilliseconds;

const colour = [0.1, 0.2, 0.3, 1] as const;

export interface FakeEngine {
  options: Record<string, unknown>;
  flyTo: ReturnType<typeof vi.fn>;
  steer: ReturnType<typeof vi.fn>;
  setSpin: ReturnType<typeof vi.fn>;
  isSpinning: ReturnType<typeof vi.fn>;
  /** What `isSpinning` answers: set it to stand for the ramp still running or over. */
  spinActive: boolean;
  setZoom: ReturnType<typeof vi.fn>;
  setMarkers: ReturnType<typeof vi.fn>;
  setTheme: ReturnType<typeof vi.fn>;
  setArcs: ReturnType<typeof vi.fn>;
  refit: ReturnType<typeof vi.fn>;
  requestRender: ReturnType<typeof vi.fn>;
  onInteract: ReturnType<typeof vi.fn>;
  getView: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  getCentre: ReturnType<typeof vi.fn>;
  project: ReturnType<typeof vi.fn>;
  onFrame: ReturnType<typeof vi.fn>;
  frame: () => void;
  destroy: ReturnType<typeof vi.fn>;
  interact: () => void;
}

export const made: FakeEngine[] = [];
/** `fail` makes the fake engine refuse to start; `hold`, while set, makes it wait to stand for a slow start. */
export const control: { fail: boolean; hold: Promise<void> | undefined } = {
  fail: false,
  hold: undefined,
};

/** The factory for `vi.mock("~/lib/globe/engine")`. */
export const engineMock = () => ({
  createGlobeEngine: vi.fn(
    async (host: HTMLElement, options: Record<string, unknown>) => {
      await control.hold;
      if (control.fail) throw new Error("no renderer");
      const canvas = document.createElement("canvas");
      canvas.tabIndex = 0;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Globe");
      host.append(canvas);
      let interact: () => void = () => {};
      let frame: () => void = () => {};
      const engine: FakeEngine = {
        options,
        flyTo: vi.fn(),
        steer: vi.fn(),
        setSpin: vi.fn(),
        isSpinning: vi.fn(() => engine.spinActive),
        spinActive: false,
        setZoom: vi.fn(),
        setMarkers: vi.fn(),
        setTheme: vi.fn(),
        setArcs: vi.fn(),
        refit: vi.fn(),
        requestRender: vi.fn(),
        onInteract: vi.fn((cb: () => void) => {
          interact = cb;
        }),
        getView: vi.fn(() => ({ rotation: [0, 0], zoom: 1, moving: false })),
        getZoom: vi.fn(() => 0.8),
        getCentre: vi.fn(() => ({ x: 500, y: 300, radius: 160 })),
        project: vi.fn(() => ({ x: 10, y: 20, visible: true })),
        onFrame: vi.fn((cb: () => void) => {
          frame = cb;
        }),
        destroy: vi.fn(),
        interact: () => interact(),
        frame: () => frame(),
      };
      made.push(engine);
      return engine;
    },
  ),
});

export interface FakeWall {
  options: Record<string, (...args: unknown[]) => unknown>;
  state: string;
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  flyThrough: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  paneCentres: ReturnType<typeof vi.fn>;
  paneWidth: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

export const walls: FakeWall[] = [];

/** The factory for `vi.mock("./ice-wall/wall")`. */
export const wallMock = () => ({
  mountIceWall: vi.fn((options: FakeWall["options"]) => {
    const wall: FakeWall = {
      options,
      state: "whole",
      show: vi.fn(),
      hide: vi.fn(),
      restore: vi.fn(),
      flyThrough: vi.fn(),
      setDepth: vi.fn(),
      paneCentres: vi.fn(() => [[1, 2]]),
      paneWidth: vi.fn(() => 400),
      destroy: vi.fn(),
    };
    walls.push(wall);
    return wall;
  }),
});

/** gmt as the stage loads it, with a zoned clock that reads 23:30 in every zone; `real` is the true module. */
export const gmtLoaderMock = (
  real: typeof import("~/lib/slides/gmt-loader"),
) => {
  return {
    ...real,
    loadDeckGmt: async () => {
      const gmt = await real.loadDeckGmt();
      return {
        ...gmt,
        zonedGet: {
          ...gmt.zonedGet,
          getZonedNow: () => "2024-02-29T23:30+09:00[Asia/Tokyo]",
        },
      };
    },
  };
};

/**
 * The Earth's clock ticks through the venue clock, whose own test is `title-clock.test.ts`. Here its
 * time now is 23:30, and it knows the instants a build holds it at and the talk's start that a
 * locked deck holds it at.
 */
/** The factory for `vi.mock("./title-clock")`. */
export const titleClockMock = () => ({
  loadClock: async () => ({
    read: () => ({
      hour: 23,
      minute: 30,
      second: 0,
      zoned: "2026-11-20T23:30:00+02:00[Europe/Helsinki]",
    }),
    at: (utc: string) =>
      ({
        "2026-12-15T16:00:00Z": {
          hour: 18,
          minute: 0,
          second: 0,
          zoned: "2026-12-15T18:00:00+02:00[Europe/Helsinki]",
        },
        "2027-03-28T00:59:00Z": {
          hour: 2,
          minute: 59,
          second: 0,
          zoned: "2027-03-28T02:59:00+02:00[Europe/Helsinki]",
        },
        "2027-03-28T01:00:00Z": {
          hour: 4,
          minute: 0,
          second: 0,
          zoned: "2027-03-28T04:00:00+03:00[Europe/Helsinki]",
        },
      })[utc] ?? null,
    untilNextSecond: () => 1000,
  }),
});

/** The factory for `vi.mock("~/lib/globe/globe-theme")`. */
export const themeMock = async () => ({
  /* The real observer: a look flip reaches the stage as it does on the page. */
  watchTheme: (
    await vi.importActual<typeof import("~/lib/globe/globe-theme")>(
      "~/lib/globe/globe-theme",
    )
  ).watchTheme,
  readTheme: () => ({
    markerPrimary: colour,
    markerOther: colour,
    label: colour,
  }),
  parseColour: () => colour,
  labelFont: () => "12px sans-serif",
  rendererOverride: () => "auto",
});

export const skyCalls = { drawWithout: 0, follow: 0 };

/** The factory for `vi.mock("~/lib/space-sky")`. */
export const skyMock = async () => ({
  ...(await vi.importActual<typeof import("~/lib/space-sky")>(
    "~/lib/space-sky",
  )),
  loadClock: async () => ({
    getUnixNow: () => NOW,
    getSystemTimeZone: () => "UTC",
  }),
  loadSky: vi.fn(async () => ({})),
  drawWithoutGlobe: vi.fn(async () => {
    skyCalls.drawWithout += 1;
  }),
  followGlobe: vi.fn(async () => {
    skyCalls.follow += 1;
    return true;
  }),
});

/** A three-slide deck: Helsinki, then Tokyo with a build that goes to Manila, then the wall. */
export function fixture(): HTMLElement {
  const root = document.createElement("article");
  root.innerHTML = `
    <div data-deck-space data-sky-src="/sky.bin" data-earth="/earth.webp">
      <div><canvas data-sky-canvas="band"></canvas></div>
      <canvas data-sky-canvas="stars"></canvas>
    </div>
    <div data-deck-stage>
      <section data-slide data-place="Europe/Helsinki"><h2>One</h2></section>
      <section data-slide data-place="Asia/Tokyo"><h2>Two</h2>
        <div data-build="1" data-place="Asia/Manila">b</div>
      </section>
      <section data-slide data-place="wall"><h2>Three</h2></section>
    </div>`;
  document.body.append(root);
  return root;
}
export const engine = (): FakeEngine => made[made.length - 1]!;

/**
 * Waits for the globe to come up under `root` and returns its engine. The first globe test pays
 * for the stage's cold dynamic imports, which can take past `waitFor`'s one-second default when
 * the whole suite runs at once.
 */
export async function readyEngine(root: HTMLElement): Promise<FakeEngine> {
  await vi.waitFor(
    () =>
      expect(root.querySelector("[data-deck-space]")).toHaveAttribute(
        "data-globe",
        "ready",
      ),
    { timeout: 5000 },
  );
  return engine();
}

/** Clears what the fakes recorded, before each test. */
export function resetFakes(): void {
  made.length = 0;
  walls.length = 0;
  control.fail = false;
  control.hold = undefined;
  skyCalls.drawWithout = 0;
  skyCalls.follow = 0;
}

/**
 * The stage tests' one lifecycle. Before each test: the fakes cleared and a fresh fixture deck.
 * After it: the stage destroyed, its signal aborted, the deck removed and every spy restored.
 * `mount` puts the stage on the deck with `mountOn` and keeps it for the clean-up.
 */
export function stageHarness<S extends { destroy(): void }>(
  mountOn: (root: HTMLElement, signal: AbortSignal) => S,
): {
  readonly root: HTMLElement;
  readonly signal: AbortSignal;
  /** Aborts the stage's signal now, as a deck torn down does. */
  abort(): void;
  /** The stage `mount` put up in this test. */
  readonly stage: S;
  mount(): S;
  /** Swaps the fixture deck for another, before the stage is mounted. */
  useDeck(deck: HTMLElement): void;
  ready(): Promise<FakeEngine>;
} {
  let abort = new AbortController();
  let deck: HTMLElement | null = null;
  let stage: S | undefined;
  const root = (): HTMLElement => {
    if (!deck) throw new Error("the stage harness runs inside a test");
    return deck;
  };
  beforeEach(() => {
    resetFakes();
    abort = new AbortController();
    deck = fixture();
  });
  afterEach(() => {
    stage?.destroy();
    stage = undefined;
    abort.abort();
    deck?.remove();
    deck = null;
    vi.restoreAllMocks();
  });
  return {
    get root() {
      return root();
    },
    get signal() {
      return abort.signal;
    },
    abort: () => abort.abort(),
    get stage() {
      if (!stage) throw new Error("no stage is mounted in this test");
      return stage;
    },
    mount() {
      stage = mountOn(root(), abort.signal);
      return stage;
    },
    useDeck(next) {
      deck?.remove();
      deck = next;
    },
    ready: () => readyEngine(root()),
  };
}
