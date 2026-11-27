import { afterEach, describe, expect, it, vi } from "vitest";
import orbitText from "../assets/sky-orbits.json?raw";
import { CAMERA_ROTATION } from "../test/planet-pins";
import { APOPHIS_SITES } from "../test/apophis-pins";
import type { Orbits } from "./ephemeris";
import { skyLens, viewMatrix } from "./sky-math";

/** 2029-07-08 00:00, the Vesta opposition Horizons' APmag 5.405 is read at (camera site). */
const OPPOSITION = 1_878_163_200_000;
/** 2026-11-13: Vesta at its epoch's year, V 6.4 by Horizons, fainter than the sky's limit of 5.5. */
const FAINT_DAY = 1_792_195_200_000;

/* Horizons, COMMAND='4;' CENTER='500@10' EPHEM_TYPE='ELEMENTS' REF_PLANE='ECLIPTIC'
   TLIST='2462318.5' (2029-07-01): osculating elements, with H 3.25 and JPL's fitted G 0.32 (the pair the shipped row carries). */
const FIXTURE = {
  e: 0.08952465814741302,
  i: 7.142421107839589,
  node: 103.657205934982,
  peri: 151.087753233186,
  M: 25.27216596846286,
  n: 0.2716604240449444,
  a: 2.361122209941052,
  epoch: 2_462_318.5,
  days: 720,
  H: 3.25,
  G: 0.32,
};

async function layerWith(
  small: Orbits["small"],
  near?: HTMLCanvasElement | null,
  hooks: {
    signal?: AbortSignal;
    redraw?: () => void;
    held?: () => string | null;
  } = {},
) {
  const orbits = JSON.parse(orbitText) as Orbits;
  vi.resetModules();
  vi.doMock("../assets/sky-orbits.json?raw", () => ({
    default: JSON.stringify({ ...orbits, small }),
  }));
  const { createPlanetLayer } = await import("./sky-planets");
  return createPlanetLayer({ near, ...hooks });
}

afterEach(() => {
  vi.doUnmock("../assets/sky-orbits.json?raw");
  vi.resetModules();
});

describe("Vesta in the planet layer", () => {
  it("is drawn at 5.41 near its 2029 opposition from elements made for the date", async () => {
    const layer = await layerWith({ vesta: FIXTURE });
    const vesta = layer
      .drawn(OPPOSITION, CAMERA_ROTATION)
      .find(({ id }) => id === "vesta");
    expect(vesta?.V).toBeCloseTo(5.405, 1);
    expect(Math.abs(vesta!.V - 5.405)).toBeLessThan(0.05);
  });

  it("is not drawn from the shipped 2026 elements, which do not reach 2029", async () => {
    const layer = await layerWith((JSON.parse(orbitText) as Orbits).small);
    expect(
      layer.drawn(OPPOSITION, CAMERA_ROTATION).map(({ id }) => id),
    ).not.toContain("vesta");
    expect(layer.place("vesta", OPPOSITION, CAMERA_ROTATION)).toBeNull();
  });

  it("is listed exactly when it is drawn: not when fainter than the limit", async () => {
    const layer = await layerWith((JSON.parse(orbitText) as Orbits).small);
    expect(
      layer.drawn(FAINT_DAY, CAMERA_ROTATION).map(({ id }) => id),
    ).not.toContain("vesta");
    expect(layer.place("vesta", FAINT_DAY, CAMERA_ROTATION)).not.toBeNull();
  });

  it("is placed, with its magnitude, while too faint to draw", async () => {
    const layer = await layerWith((JSON.parse(orbitText) as Orbits).small);
    const vesta = layer
      .placed(FAINT_DAY, CAMERA_ROTATION)
      .find(({ id }) => id === "vesta");
    expect(vesta?.V).toBeGreaterThan(5.5);
    expect(vesta?.V).toBeLessThan(7);
  });
});

/** A 2D context that records the name of every call, and the canvas it belongs to. */
function recorder() {
  const calls: string[] = [];
  const canvas = { dataset: {}, width: 1440, height: 900 };
  const ctx = new Proxy(
    { canvas },
    {
      get: (target, name: string) =>
        name in target
          ? target[name as "canvas"]
          : (..._: unknown[]) => {
              calls.push(name);
              return { addColorStop: () => undefined };
            },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, canvas };
}

const LENS = skyLens(1440, 900, { x: 720, y: 450, radius: 300 });
const TINT = [255, 255, 255] as const;
/** Where the camera looks with the sky's longitude 0, latitude 0: Apophis is behind the image plane at 20:00 UT. */
/** 2029-04-10 00:00 UT: before the pass's table, which the element sets place. */
const BEFORE_TABLE = 1_870_473_600_000;
const BEHIND = { t: 1870804800000, rotation: [0, 0] as const };

/**
 * Draws the layer at an instant: the listing the gate reads, and how many dots each canvas took.
 * A pass's chunk loads on the first draw inside its window and asks for another: `loaded` waits for
 * that (when it is to come) and draws again, as the sky does.
 */
async function drawAt(
  t: number,
  rotation: readonly [number, number],
  { loaded = true }: { loaded?: boolean } = {},
) {
  const stars = recorder();
  const near = recorder();
  const asked = Promise.withResolvers<void>();
  const layer = await layerWith(
    (JSON.parse(orbitText) as Orbits).small,
    near.canvas as unknown as HTMLCanvasElement,
    { redraw: asked.resolve },
  );
  /* The layer asks `near` for a 2D context: the recorder is it. */
  (near.canvas as unknown as HTMLCanvasElement).getContext = (() =>
    near.ctx) as never;
  const draw = () => {
    stars.calls.length = near.calls.length = 0;
    layer(
      stars.ctx,
      LENS,
      viewMatrix(rotation, t),
      [1440, 900, 300, 1],
      rotation,
      t,
      TINT as never,
    );
  };
  draw();
  if (loaded) {
    await asked.promise;
    draw();
  }
  const listing =
    (stars.canvas.dataset as { skyPlanets?: string }).skyPlanets ?? "";
  return {
    apophis: listing.split(";").find((entry) => entry.startsWith("apophis")),
    dots: (one: { calls: string[] }) =>
      one.calls.filter((call) => call === "arc").length,
    stars,
    near,
  };
}

describe("Apophis in the planet layer", () => {
  it("is drawn on the near canvas, not the stars', from the site 4,113 km from it", async () => {
    const site = APOPHIS_SITES.find((one) => one.name === "near")!;
    const drawn = await drawAt(site.t, site.rotation);
    expect(drawn.apophis).toMatch(/^apophis [\d.]+ [\d.]+ -?[\d.]+$/);
    expect(drawn.dots(drawn.near)).toBe(1);
    expect((drawn.near.canvas as { hidden?: boolean }).hidden).toBe(false);
  });

  it("is listed behind, and not drawn, when it lies behind the image plane", async () => {
    const drawn = await drawAt(BEHIND.t, BEHIND.rotation);
    expect(drawn.apophis).toMatch(/^apophis behind /);
    expect(drawn.dots(drawn.near)).toBe(0);
  });

  it("is listed earth, and not drawn, with the Earth between", async () => {
    const site = APOPHIS_SITES.find((one) => one.name === "earth")!;
    const drawn = await drawAt(site.t, site.rotation);
    expect(drawn.apophis).toMatch(/^apophis earth /);
    expect(drawn.dots(drawn.near)).toBe(0);
  });

  it("clears and hides the near canvas on a draw that finds no body on it, so a body that has left leaves nothing", async () => {
    /* Behind the Earth the pass is on neither canvas; its chunk has loaded, so the near canvas is ready and cleared. */
    const drawn = await drawAt(BEHIND.t, BEHIND.rotation);
    expect(drawn.near.calls).toContain("clearRect");
    expect(drawn.dots(drawn.near)).toBe(0);
    /* Empty, it is hidden: a bare full-screen layer over the globe still costs a blend on every frame. */
    expect((drawn.near.canvas as { hidden?: boolean }).hidden).toBe(true);
  });

  it("is not drawn, nor listed, until its states have loaded, then is", async () => {
    const asked = Promise.withResolvers<void>();
    const layer = await layerWith(
      (JSON.parse(orbitText) as Orbits).small,
      null,
      { redraw: asked.resolve },
    );
    const ids = () =>
      layer.drawn(BEHIND.t, BEHIND.rotation).map(({ id }) => id);
    expect(ids()).not.toContain("apophis");
    await asked.promise;
    expect(ids()).toContain("apophis");
  });

  it("asks for its states only inside the pass's window", async () => {
    const redraw = vi.fn();
    const layer = await layerWith(
      (JSON.parse(orbitText) as Orbits).small,
      null,
      { redraw },
    );
    layer.drawn(BEFORE_TABLE, BEHIND.rotation);
    await vi.dynamicImportSettled();
    expect(redraw).not.toHaveBeenCalled();
  });

  it("changes nothing when its states arrive after the layer has ended", async () => {
    const redraw = vi.fn();
    const ended = new AbortController();
    const layer = await layerWith(
      (JSON.parse(orbitText) as Orbits).small,
      null,
      { redraw, signal: ended.signal },
    );
    layer.drawn(BEHIND.t, BEHIND.rotation);
    ended.abort();
    await vi.dynamicImportSettled();
    expect(redraw).not.toHaveBeenCalled();
    expect(
      layer.drawn(BEHIND.t, BEHIND.rotation).map(({ id }) => id),
    ).not.toContain("apophis");
  });

  it("is in the drawn list at 20:00 UT on the day, and placed but not drawn, too faint, two days before", async () => {
    const asked = Promise.withResolvers<void>();
    const layer = await layerWith(
      (JSON.parse(orbitText) as Orbits).small,
      null,
      { redraw: asked.resolve },
    );
    layer.drawn(BEHIND.t, BEHIND.rotation);
    await asked.promise;
    const ids = (t: number) =>
      layer.drawn(t, BEHIND.rotation).map(({ id }) => id);
    expect(ids(1870804800000)).toContain("apophis");
    expect(ids(BEFORE_TABLE)).not.toContain("apophis");
    expect(
      layer.place("apophis", BEFORE_TABLE, BEHIND.rotation),
    ).not.toBeNull();
  });

  it("starts no timer", async () => {
    vi.useFakeTimers();
    try {
      await drawAt(BEHIND.t, BEHIND.rotation);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the ring of a held faint body", () => {
  /** A camera that sees Vesta on screen at `FAINT_DAY`, 165 degrees round from the camera of the pins. */
  const SEES_VESTA = [-165, 0] as const;

  /** Draws one frame at `FAINT_DAY` with `held` as the held body: the listing and what the canvas was asked. */
  async function ringed(
    held: string | null,
    rotation: readonly [number, number] = SEES_VESTA,
  ) {
    const stars = recorder();
    const layer = await layerWith(
      (JSON.parse(orbitText) as Orbits).small,
      null,
      { held: () => held },
    );
    layer(
      stars.ctx,
      LENS,
      viewMatrix(rotation, FAINT_DAY),
      [1440, 900, 300, 1],
      rotation,
      FAINT_DAY,
      TINT as never,
    );
    const listing =
      (stars.canvas.dataset as { skyPlanets?: string }).skyPlanets ?? "";
    return { listing, calls: stars.calls };
  }

  it("is a stroked circle, listed as a ring row, for the held faint body", async () => {
    const held = await ringed("vesta");
    expect(held.listing).toMatch(/(^|;)vesta ring [\d.]+ [\d.]+ 6\.\d\d(;|$)/);
    expect(held.calls).toContain("stroke");
    expect(held.calls).not.toContain("fill");
  });

  it("is made for no faint body that is not held", async () => {
    const unheld = await ringed(null);
    expect(unheld.listing).not.toMatch(/vesta|ring/);
    expect(unheld.calls).not.toContain("stroke");
    const other = await ringed("uranus");
    expect(other.listing).not.toMatch(/vesta|ring/);
  });

  it("is never made for a body bright enough to draw", async () => {
    const drawn = await ringed("mercury", CAMERA_ROTATION);
    expect(drawn.listing).toMatch(/(^|;)mercury [\d.]+ [\d.]+ /);
    expect(drawn.listing).not.toMatch(/ring/);
  });
});
