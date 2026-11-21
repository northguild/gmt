/**
 * @vitest-environment jsdom
 *
 * The ice wall's state over a fake renderer and a manual frame clock. What a person sees is the
 * pixels, which the browser gate checks (`scripts/slides-check.mjs`); here the contract is the
 * sequence of states, the frames asked for, the pins that land and the clean-up.
 */
/* oxlint-disable dox-test/no-markup-read, dox-test/no-implementation-assert, dox-test/no-class-query, testing-library/no-node-access */
import type { GlobeEngine } from "~/lib/globe/types";
import type { Drawable } from "./frame";
import { acquireDevice } from "~/lib/globe/webgpu/device";
import { mountIceWall, type IceWall } from "./wall";

const drawn: Drawable[][] = [];
const fake = {
  kind: "canvas2d" as const,
  resize: vi.fn(),
  draw: vi.fn((d: readonly Drawable[]) => {
    drawn.push([...d]);
  }),
  destroy: vi.fn(),
};

vi.mock("./draw-canvas2d", () => ({ createCanvas2dRenderer: () => fake }));
vi.mock("~/lib/globe/webgpu/device", () => ({
  acquireDevice: vi.fn(async () => {
    throw new Error("no gpu");
  }),
}));
const gpuFake = {
  kind: "webgpu" as const,
  resize: vi.fn(),
  draw: vi.fn(),
  destroy: vi.fn(),
};
vi.mock("./draw-webgpu", () => ({ createWebgpuRenderer: async () => gpuFake }));

const ZONES = [
  "Asia/Tokyo",
  "Europe/Helsinki",
  "Africa/Lagos",
  "America/New_York",
  "Asia/Kolkata",
  "Asia/Manila",
  "Europe/Madrid",
  "Africa/Nairobi",
  "Asia/Tehran",
  "Pacific/Apia",
  "Pacific/Niue",
  "Asia/Shanghai",
];

let layer: HTMLElement;
let wall: IceWall | undefined;
let abort: AbortController;
let queue: [number, FrameRequestCallback][] = [];
let nextId = 1;
let reduced = false;
const pins: string[] = [];
let breaks = 0;

const engine = {
  renderer: "canvas2d",
  getView: () => ({
    rotation: [0, 0],
    zoom: 0.8,
    moving: false,
    distance: 6.61,
    focalPx: 1200,
    centre: { x: 480, y: 270 },
  }),
} as unknown as GlobeEngine;

const sources = () =>
  [
    "moment",
    "luxon",
    "date-fns",
    "dayjs",
    "spacetime",
    "internationalized-date",
  ].map((id) => ({
    id,
    image: document.createElement("img"),
  }));

function mount(): IceWall {
  wall = mountIceWall({
    layer,
    engine,
    panes: sources(),
    ice: [0.7, 0.9, 1, 1],
    signal: abort.signal,
    reduced: () => reduced,
    target: () => [480, 270],
    onPin: (zone) => pins.push(zone),
    onBreak: () => {
      breaks += 1;
    },
  });
  return wall;
}

/** Runs the queued frame callbacks at a timestamp. */
function frame(at: number): void {
  const run = queue;
  queue = [];
  for (const [, cb] of run) cb(at);
}

beforeEach(() => {
  drawn.length = 0;
  fake.draw.mockClear();
  fake.destroy.mockClear();
  pins.length = 0;
  breaks = 0;
  reduced = false;
  queue = [];
  abort = new AbortController();
  layer = document.createElement("div");
  Object.defineProperty(layer, "clientWidth", { value: 960 });
  Object.defineProperty(layer, "clientHeight", { value: 540 });
  document.body.append(layer);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    const id = nextId++;
    queue.push([id, cb]);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    queue = queue.filter(([queued]) => queued !== id);
  });
});

afterEach(() => {
  wall?.destroy();
  wall = undefined;
  abort.abort();
  layer.remove();
  vi.restoreAllMocks();
});

describe("a wall at rest", () => {
  it("draws six whole panes once and asks for no frames", () => {
    mount().show();
    expect(wall!.state).toBe("whole");
    expect(drawn.at(-1)).toHaveLength(6);
    expect(drawn.at(-1)!.every((d) => d.cell === -1)).toBe(true);
    expect(queue).toHaveLength(0);
  });

  it("is hidden before it is shown, and draws nothing", () => {
    mount();
    expect(wall!.state).toBe("hidden");
    expect(layer).toHaveAttribute("data-wall", "hidden");
    expect(fake.draw).not.toHaveBeenCalled();
  });

  it("redraws when the depth changes, and not when it does not", () => {
    mount().show(1);
    const count = fake.draw.mock.calls.length;
    wall!.setDepth(1);
    expect(fake.draw.mock.calls).toHaveLength(count);
    wall!.setDepth(0.8);
    expect(fake.draw.mock.calls).toHaveLength(count + 1);
    expect(queue).toHaveLength(0);
  });

  it("reports where each pane's centre is, three across then two down, left to right", () => {
    const centres = mount().paneCentres();
    expect(centres).toHaveLength(6);
    expect(centres[0]![0]).toBeCloseTo(centres[3]![0], 6);
    expect(centres[0]![0]).toBeLessThan(centres[1]![0]);
    expect(centres[1]![0]).toBeLessThan(centres[2]![0]);
    expect(centres[0]![1]).toBeCloseTo(centres[2]![1], 6);
    expect(centres[0]![1]).toBeLessThan(centres[3]![1]);
  });

  it("reports a pane's width, which fits between two neighbouring centres", () => {
    const wall = mount();
    const centres = wall.paneCentres();
    expect(wall.paneWidth()).toBeGreaterThan(0);
    expect(wall.paneWidth()).toBeLessThan(centres[1]![0] - centres[0]![0]);
  });
});

describe("a wall with cards", () => {
  /** Six cards in a 3 x 2 grid, each 200 x 125, placed in the layer's pixels. */
  const cards = (left: number, top: number) =>
    sources().map((source, i) => {
      const card = document.createElement("figure");
      const box = {
        x: left + (i % 3) * 210,
        y: top + Math.floor(i / 3) * 135,
        w: 200,
        h: 125,
      };
      card.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: box.x, y: box.y, width: box.w, height: box.h });
      layer.append(card);
      return { ...source, card, box };
    });

  const mountOver = (panes: ReturnType<typeof cards>): IceWall => {
    wall = mountIceWall({
      layer,
      engine,
      panes,
      ice: [0.7, 0.9, 1, 1],
      signal: abort.signal,
      reduced: () => reduced,
      target: () => [480, 270],
    });
    return wall;
  };

  const centresOf = (panes: ReturnType<typeof cards>) =>
    panes.map(({ box }) => [box.x + box.w / 2, box.y + box.h / 2]);

  it("hangs each pane on its card, whatever the depth", () => {
    const panes = cards(40, 90);
    const wall = mountOver(panes);
    for (const depth of [1, 0.8, 1.3]) {
      wall.show(depth);
      wall.paneCentres().forEach((centre, i) => {
        expect(centre[0]).toBeCloseTo(centresOf(panes)[i]![0]!, 6);
        expect(centre[1]).toBeCloseTo(centresOf(panes)[i]![1]!, 6);
      });
      expect(wall.paneWidth()).toBeCloseTo(200, 6);
    }
  });

  it("follows its cards when they move, as after a zoom", () => {
    const panes = cards(40, 90);
    const wall = mountOver(panes);
    wall.show(1);
    for (const { box } of panes) {
      box.x = box.x * 2 + 10;
      box.y = box.y * 2 + 5;
      box.w = 400;
      box.h = 250;
    }
    wall.setDepth(0.9);
    wall.paneCentres().forEach((centre, i) => {
      expect(centre[0]).toBeCloseTo(centresOf(panes)[i]![0]!, 6);
      expect(centre[1]).toBeCloseTo(centresOf(panes)[i]![1]!, 6);
    });
    expect(wall.paneWidth()).toBeCloseTo(400, 6);
  });

  it("says when it is drawn whole, and not while it breaks", () => {
    const drawnWhole = vi.fn();
    wall = mountIceWall({
      layer,
      engine,
      panes: cards(40, 90),
      ice: [0.7, 0.9, 1, 1],
      signal: abort.signal,
      reduced: () => reduced,
      target: () => [480, 270],
      onDrawn: drawnWhole,
    });
    wall.show(1);
    expect(drawnWhole).toHaveBeenCalledTimes(1);
    wall.setDepth(0.9);
    expect(drawnWhole).toHaveBeenCalledTimes(2);
    wall.breakAll(ZONES);
    for (let t = 0; t < 3000; t += 16) frame(t);
    expect(drawnWhole).toHaveBeenCalledTimes(2);
  });
});

describe("the break", () => {
  it("shatters the panes, lands every pin once, and ends at rest", () => {
    mount().show();
    wall!.breakAll(ZONES);
    expect(wall!.state).toBe("breaking");
    expect(breaks).toBe(1);
    frame(1000);
    expect(drawn.at(-1)!.length).toBeGreaterThan(6 * 20);
    for (let t = 1016; t < 3000 && wall!.state === "breaking"; t += 16)
      frame(t);
    expect(wall!.state).toBe("gone");
    expect([...pins].sort()).toEqual([...ZONES].sort());
    expect(drawn.at(-1)).toHaveLength(0);
    expect(queue).toHaveLength(0);
  });

  it("lands the ten matrix zones, one pin each, over six panes", () => {
    const ten = ZONES.slice(0, 10);
    mount().show();
    wall!.breakAll(ten);
    for (let t = 0; t < 3000 && wall!.state === "breaking"; t += 16) frame(t);
    expect(wall!.state).toBe("gone");
    expect([...pins].sort()).toEqual([...ten].sort());
  });

  it("finishes inside two seconds", () => {
    mount().show();
    wall!.breakAll(ZONES);
    let t = 0;
    frame(t);
    while (wall!.state === "breaking" && t < 5000) {
      t += 16;
      frame(t);
    }
    expect(t).toBeLessThan(2000);
  });

  it("flies in first, then breaks", () => {
    mount().show();
    wall!.flyThrough(ZONES);
    expect(wall!.state).toBe("approach");
    expect(breaks).toBe(0);
    frame(0);
    frame(500);
    expect(wall!.state).toBe("approach");
    frame(1000);
    expect(wall!.state).toBe("breaking");
    expect(breaks).toBe(1);
  });

  it("does nothing while hidden", () => {
    mount().breakAll(ZONES);
    expect(wall!.state).toBe("hidden");
    expect(breaks).toBe(0);
  });

  it("puts the panes back whole on restore", () => {
    mount().show();
    wall!.breakAll(ZONES);
    frame(0);
    wall!.restore();
    expect(wall!.state).toBe("whole");
    expect(drawn.at(-1)).toHaveLength(6);
    expect(queue).toHaveLength(0);
  });
});

describe("reduced motion", () => {
  it("cracks and fades the panes in a third of a second, without an approach", () => {
    reduced = true;
    mount().show();
    wall!.flyThrough(ZONES);
    expect(wall!.state).toBe("breaking");
    frame(0);
    expect(drawn.at(-1)!.every((d) => d.cell === -1)).toBe(true);
    expect(drawn.at(-1)!.some((d) => d.cracks)).toBe(true);
    for (let t = 16; t < 1000 && wall!.state === "breaking"; t += 16) frame(t);
    expect(wall!.state).toBe("gone");
    expect(pins.length).toBeGreaterThan(0);
  });
});

describe("clean-up", () => {
  it("cancels its frame, removes its canvas and releases the renderer on destroy", () => {
    mount().show();
    wall!.breakAll(ZONES);
    expect(queue.length).toBeGreaterThan(0);
    wall!.destroy();
    expect(queue).toHaveLength(0);
    expect(fake.destroy).toHaveBeenCalled();
    expect(layer).not.toHaveAttribute("data-wall");
  });

  it("stops when its signal aborts", () => {
    mount().show();
    wall!.breakAll(ZONES);
    abort.abort();
    expect(queue).toHaveLength(0);
    expect(fake.destroy).toHaveBeenCalled();
  });
});

describe("a WebGPU wall whose device fails", () => {
  /** Mounts on a WebGPU globe and waits for the WebGPU renderer; hands back the ways to fail it. */
  async function mountOnGpu() {
    let fail: (() => void) | undefined;
    let lose: (() => void) | undefined;
    const release = vi.fn();
    const device = {
      addEventListener: (_type: string, listener: () => void) => {
        fail = listener;
      },
      removeEventListener: vi.fn(),
    };
    vi.mocked(acquireDevice).mockImplementationOnce((async (
      onLost?: () => void,
    ) => {
      lose = onLost;
      return { device, canvasFormat: "bgra8unorm", release };
    }) as unknown as typeof acquireDevice);
    (engine as { renderer: string }).renderer = "webgpu";
    try {
      mount().show();
      await vi.waitFor(() => expect(wall!.renderer).toBe("webgpu"));
    } finally {
      (engine as { renderer: string }).renderer = "canvas2d";
    }
    return { release, fail: () => fail?.(), lose: () => lose?.() };
  }

  it("draws on WebGPU while the device is healthy", async () => {
    await mountOnGpu();
    expect(wall!.renderer).toBe("webgpu");
    expect(fake.draw).not.toHaveBeenCalled();
  });

  it("falls back to canvas-2D and draws the panes when the device reports an error", async () => {
    const { release, fail } = await mountOnGpu();
    fail();
    expect(wall!.renderer).toBe("canvas2d");
    expect(gpuFake.destroy).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
    expect(fake.draw).toHaveBeenCalled();
    expect(layer.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("falls back the same way when the device is lost", async () => {
    const { lose } = await mountOnGpu();
    lose();
    expect(wall!.renderer).toBe("canvas2d");
    expect(fake.draw).toHaveBeenCalled();
  });
});
