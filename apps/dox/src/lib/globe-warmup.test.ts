// @vitest-environment jsdom
import { IMAGERY_ALPHA_TOKEN, warmGlobe } from "./globe-warmup";
const hooks = vi.hoisted(() => ({
  imported: [] as string[],
}));

vi.mock("./yield-to-main", () => ({ whenPainted: () => Promise.resolve() }));
vi.mock("./globe-assets", () => ({
  EARTH_IMAGERY_URL: "/gmt/_astro/earth.hash.webp",
}));
vi.mock("./globe-mount", () => {
  hooks.imported.push("globe-mount");
  return {};
});
vi.mock("./globe", () => {
  hooks.imported.push("globe");
  return {};
});
vi.mock("./globe/webgpu/renderer-webgpu", () => {
  hooks.imported.push("renderer-webgpu");
  return {};
});

let stage: HTMLElement;

beforeEach(() => {
  stage = document.createElement("div");
  document.body.append(stage);
});

afterEach(() => {
  stage.remove();
  document.head
    .querySelectorAll("link[rel=preload]")
    .forEach((l) => l.remove());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const alpha = (value: string) =>
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (name: string) =>
      name === IMAGERY_ALPHA_TOKEN ? value : "",
  } as CSSStyleDeclaration);
const preloads = () => [
  ...document.head.querySelectorAll<HTMLLinkElement>("link[rel=preload]"),
];

/* A module is imported once per file, so the first test (no WebGPU) sees the two chunks and the second the renderer's as well. */
describe("warmGlobe", () => {
  it("fetches neither the imagery nor the GPU renderer where there is no WebGPU", async () => {
    vi.stubGlobal("navigator", {});
    alpha("1");
    await warmGlobe(stage);
    expect(preloads()).toHaveLength(0);
    expect([...hooks.imported].sort()).toEqual(["globe", "globe-mount"]);
  });

  it("preloads the Earth's imagery and imports the three chunks, where WebGPU exists and the theme shows the photograph", async () => {
    vi.stubGlobal("navigator", { gpu: {} });
    alpha("1");
    await warmGlobe(stage);
    expect(preloads().map((l) => l.getAttribute("href"))).toEqual([
      "/gmt/_astro/earth.hash.webp",
    ]);
    expect(preloads()[0]?.getAttribute("as")).toBe("fetch");
    expect(preloads()[0]?.getAttribute("fetchpriority")).toBe("high");
    expect(preloads()[0]?.crossOrigin).toBe("anonymous");
    expect([...hooks.imported].sort()).toEqual([
      "globe",
      "globe-mount",
      "renderer-webgpu",
    ]);
  });

  it("does not fetch the imagery where the theme zeroes it (forced colours, raised contrast)", async () => {
    vi.stubGlobal("navigator", { gpu: {} });
    alpha("0");
    await warmGlobe(stage);
    expect(preloads()).toHaveLength(0);
  });
});
