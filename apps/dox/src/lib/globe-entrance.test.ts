// @vitest-environment jsdom

/**
 * How `initGlobe` brings the canvas in. The engine is stubbed: what is under test is which
 * entrance the host runs and what it arms afterwards.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import { initGlobe, type GlobeHost } from "./globe";

installJsdomShims();

const engineOptions: Array<Record<string, unknown>> = [];
let finishDawn: () => void = () => {};
let dawnStarts = 0;
/* The silhouette the stub engine reports; the host must hand it on untouched. */
const ENGINE_CENTRE = { x: 210, y: 140, radius: 123.456 };

vi.mock("./globe/engine", () => ({
  createGlobeEngine: async (
    host: HTMLElement,
    options: Record<string, unknown>,
  ) => {
    engineOptions.push(options);
    const canvas = document.createElement("canvas");
    host.append(canvas);
    const dawn = new Promise<void>((resolve) => (finishDawn = resolve));
    const noop = () => {};
    return new Proxy(
      {
        renderer: "webgpu",
        dawnReady: Promise.resolve(),
        startDawn: () => {
          dawnStarts += 1;
          return dawn;
        },
        getRotation: () => [0, 0],
        getZoom: () => 1,
        getCentre: () => ENGINE_CENTRE,
        project: () => ({ x: 0, y: 0, visible: false }),
      } as Record<string, unknown>,
      {
        // Not a thenable: the engine is awaited out of an async function.
        get: (target, key: string) =>
          key === "then" ? undefined : (target[key] ?? noop),
      },
    );
  },
}));

const hosts: GlobeHost[] = [];

async function mount(entrance?: "dawn") {
  const host = document.createElement("div");
  const tooltip = document.createElement("div");
  const zoom = document.createElement("div");
  document.body.append(host, tooltip, zoom);
  const globe = await initGlobe(host, null, null, {
    tooltip,
    zoom,
    ...(entrance ? { engine: { entrance } } : {}),
  });
  hosts.push(globe);
  return { globe };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 404 }));
});

afterEach(() => {
  for (const globe of hosts.splice(0)) globe.destroy();
  document.body.replaceChildren();
  engineOptions.length = 0;
  dawnStarts = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("initGlobe entrance", () => {
  it("leaves the entrance to the canvas fade by default", async () => {
    await mount();
    await vi.advanceTimersByTimeAsync(2000);
    expect(engineOptions[0]!["entrance"]).toBeUndefined();
  });

  it("hands the engine the dawn, and starts the dawn only when asked", async () => {
    const { globe } = await mount("dawn");
    await vi.advanceTimersByTimeAsync(2000);
    expect(engineOptions[0]!["entrance"]).toBe("dawn");
    expect(dawnStarts).toBe(0);
    const done = globe.startDawn();
    expect(dawnStarts).toBe(1);
    finishDawn();
    await expect(done).resolves.toBeUndefined();
  });

  it("passes the engine's readiness through", async () => {
    const { globe } = await mount("dawn");
    await expect(globe.dawnReady).resolves.toBeUndefined();
  });
});

describe("initGlobe getCentre", () => {
  it("reports the engine's silhouette radius, not a figure of its own", async () => {
    const { globe } = await mount();
    expect(globe.getCentre().radius).toBe(ENGINE_CENTRE.radius);
    expect(globe.getCentre()).toEqual(ENGINE_CENTRE);
  });
});
