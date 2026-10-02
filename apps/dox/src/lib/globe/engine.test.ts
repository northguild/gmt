// @vitest-environment jsdom
/// <reference types="vitest/globals" />

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
  canvas.className = "gmt-globe-canvas";
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
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("adopting a renderer after a device loss", () => {
  it("marks the replacement canvas entered, so the stylesheet does not keep it at opacity 0", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);
    const engine = await createGlobeEngine(host, options("webgpu"));

    const first = made[0]!;
    // The first canvas is the host's to reveal, once, through `enter()`.
    expect(first.canvas.hasAttribute("data-entered")).toBe(false);

    first.fail("device lost");
    await vi.waitFor(() => expect(made).toHaveLength(2));

    const second = made[1]!;
    expect(second.canvas.isConnected).toBe(true);
    expect(second.canvas.hasAttribute("data-entered")).toBe(true);

    // The one retry is spent: a second loss falls back to canvas-2D, whose
    // canvas must also be visible.
    second.fail("device lost again");
    await vi.waitFor(() => expect(made).toHaveLength(3));
    expect(made[2]!.kind).toBe("canvas2d");
    expect(made[2]!.canvas.hasAttribute("data-entered")).toBe(true);

    engine.destroy();
  });
});
