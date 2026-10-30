// @vitest-environment jsdom

/**
 * The engine's renderer hand-over after a device loss. The backends are faked:
 * what is under test is which canvas the reader can see afterwards.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import { createGlobeEngine } from "./engine";
import type { GlobeRenderer } from "./renderer";
import type { GlobeOptions, RendererKind } from "./types";

installJsdomShims();

const made: Array<GlobeRenderer & { fail: (reason: string) => void }> = [];

function fakeRenderer(
  kind: RendererKind,
  host: HTMLElement,
): GlobeRenderer & { fail: (reason: string) => void } {
  const canvas = document.createElement("canvas");
  host.append(canvas);
  let onFailure: (reason: string) => void = () => {};
  const renderer = {
    kind,
    canvas,
    resize() {},
    setTheme() {},
    setRegions() {},
    setMarkers() {},
    setArcs() {},
    render() {},
    onFailure(cb: (reason: string) => void) {
      onFailure = cb;
    },
    destroy() {
      canvas.remove();
    },
    fail(reason: string) {
      onFailure(reason);
    },
  };
  made.push(renderer);
  return renderer;
}

vi.mock("./webgpu/renderer-webgpu", () => ({
  createWebgpuRenderer: async (init: { host: HTMLElement }) =>
    fakeRenderer("webgpu", init.host),
}));
vi.mock("./canvas2d/renderer-canvas2d", () => ({
  createCanvas2dRenderer: async (init: { host: HTMLElement }) =>
    fakeRenderer("canvas2d", init.host),
}));

const options = (renderer: GlobeOptions["renderer"]): GlobeOptions => ({
  renderer,
  sunInstant: () => 0,
  theme: {} as GlobeOptions["theme"],
  labelFont: "12px sans-serif",
  ariaLabel: "Globe",
  initialRotation: [0, 0],
});

afterEach(() => {
  made.length = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("adopting a renderer after a device loss", () => {
  it("adopts a replacement canvas after a device loss, and falls back to canvas-2D after a second", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);
    const engine = await createGlobeEngine(host, options("webgpu"));

    const first = made[0]!;
    first.fail("device lost");
    await vi.waitFor(() => expect(made).toHaveLength(2));

    const second = made[1]!;
    expect(second.canvas.isConnected).toBe(true);

    // The one retry is spent: a second loss falls back to canvas-2D, whose
    // canvas must also be visible.
    second.fail("device lost again");
    await vi.waitFor(() => expect(made).toHaveLength(3));
    expect(made[2]!.kind).toBe("canvas2d");

    engine.destroy();
  });
});
