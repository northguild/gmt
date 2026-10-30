/**
 * @vitest-environment jsdom
 *
 * Mounting the globe's chrome onto a stand-in engine: the real one needs a canvas and WebGPU,
 * which jsdom has neither of. What is tested is the wiring a reader feels: choosing a zone in
 * the search box focuses it, the zoom buttons zoom, and a selection on the globe fills the box.
 */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderHtml } from "~/widgets/test-fixture";
import { installJsdomShims } from "../test/jsdom-shims";
import { renderGlobeTemplate } from "./globe-mount";

installJsdomShims();

const calls: string[] = [];
let selectListener: ((reading: { id: string } | null) => void) | undefined;

vi.mock("./globe", () => ({
  initGlobe: async () => ({
    getZones: () => [{ id: "Asia/Tokyo" }, { id: "Europe/London" }],
    getSelected: () => "Europe/London",
    focusZone: (id: string) => calls.push(`focus ${id}`),
    zoomBy: (factor: number) => calls.push(`zoomBy ${factor.toFixed(2)}`),
    setZoom: (value: number) => calls.push(`setZoom ${value}`),
    onSelect: (fn: typeof selectListener) => {
      selectListener = fn;
    },
    destroy: () => calls.push("destroy"),
  }),
}));

async function mount(args: { zone?: string } = {}) {
  const { mountGlobe } = await import("./globe-mount");
  const r = renderHtml(renderGlobeTemplate());
  const handle = await mountGlobe(r.host, args, new AbortController().signal);
  return { handle, host: r.host };
}

beforeEach(() => {
  calls.length = 0;
  selectListener = undefined;
});

describe("mountGlobe", () => {
  it("starts the search box on the selected zone", async () => {
    await mount();
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveValue(
      "Europe/London",
    );
  });

  it("focuses a zone the reader picks from the search list", async () => {
    await mount();
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: "Find a zone" });
    await user.clear(input);
    await user.type(input, "tok");
    await user.click(screen.getByRole("option", { name: "Asia/Tokyo" }));
    expect(calls).toContain("focus Asia/Tokyo");
  });

  it("zooms in, out and back with the three buttons", async () => {
    await mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(calls).toEqual(["zoomBy 1.40", "zoomBy 0.71", "setZoom 1"]);
  });

  it("follows a selection made on the globe", async () => {
    await mount();
    selectListener?.({ id: "Asia/Tokyo" });
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveValue(
      "Asia/Tokyo",
    );
    selectListener?.(null);
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveValue(
      "",
    );
  });

  it("seeds the zone it was asked for and tears down", async () => {
    const { handle } = await mount({ zone: "Asia/Tokyo" });
    expect(calls).toContain("focus Asia/Tokyo");
    handle.destroy();
    expect(calls).toContain("destroy");
  });
});
