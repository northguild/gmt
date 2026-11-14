// @vitest-environment jsdom
/**
 * The feature map, with a `postal` config and a two-state fixture: the drawing, the narrow
 * fallback, the roving keys, pin and unpin, an overlay that no one can press, and an abort that
 * leaves nothing drawn. The checkers' own configs are covered by `zone-map.test.ts`.
 */
import { screen, waitFor, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import {
  OVERLAY_URL,
  STATE_BOUNDARIES_FIXTURE,
  destroyDrawnFeatureMaps,
  drawFeatureMap,
  featureConfig,
  featureDeps,
} from "./feature-map.fixture";

afterEach(destroyDrawnFeatureMaps);

const list = () => screen.getByRole("list", { name: "Zones" });
const rowOf = (name: RegExp) => within(list()).getByRole("button", { name });
const map = () =>
  screen.queryByRole("group", { name: /Map of two test states/ });

describe("wireFeatureMap, keyed by postal", () => {
  it("draws one pressable shape per state in its own class, under the land", async () => {
    const { handle } = drawFeatureMap(featureConfig(), featureDeps());
    await handle.ready;
    const drawing = within(map()!);
    expect(drawing.getAllByRole("button")).toHaveLength(2);
    expect(
      drawing.getByRole("button", { name: "Alpha, standard" }),
    ).toHaveAttribute("tabindex", "-1");
    expect(
      drawing.getByRole("button", { name: "Beta, daylight" }),
    ).toHaveAttribute("tabindex", "-1");
    // The data credits button sits on the drawing.
    expect(screen.getByRole("button", { name: /data credits/i })).toBeVisible();
    await expectNoAxeViolations(document.body);
  });

  it("draws the map below 520 px as well, beside the list", async () => {
    const deps = featureDeps({ measure: () => 400 });
    const { handle } = drawFeatureMap(featureConfig(), deps);
    await handle.ready;
    expect(deps.fetch).toHaveBeenCalled();
    expect(map()).not.toBeNull();
    expect(within(list()).getAllByRole("button")).toHaveLength(2);
  });

  it("moves with the arrow keys, wraps, and jumps with Home and End", async () => {
    const { handle, user } = drawFeatureMap(featureConfig(), featureDeps());
    await handle.ready;
    const [first, second] = within(list()).getAllByRole("button");
    first!.focus();
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(first).toHaveFocus();
    await user.keyboard("{End}");
    expect(second).toHaveFocus();
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(second).toHaveFocus();
  });

  it("pins from the keyboard and from the shape, and tells the page", async () => {
    const onPin = vi.fn();
    const { handle, user } = drawFeatureMap(
      featureConfig({ onPin }),
      featureDeps(),
    );
    await handle.ready;
    rowOf(/AA/).focus();
    await user.keyboard("{Enter}");
    expect(rowOf(/AA/)).toBePressed();
    expect(onPin).toHaveBeenLastCalledWith("AA", true);
    expect(
      within(map()!).getByRole("button", { name: "Alpha, standard" }),
    ).toBePressed();
    await user.click(
      within(map()!).getByRole("button", { name: "Beta, daylight" }),
    );
    expect(rowOf(/BB/)).toBePressed();
    expect(rowOf(/AA/)).not.toBePressed();
    expect(handle.pinned()).toBe("BB");
  });

  it("makes the drawn shapes one roving tab stop on keyboard: shapes, and pins from them", async () => {
    const onPin = vi.fn();
    const { handle, user } = drawFeatureMap(
      featureConfig({ keyboard: "shapes", onPin }),
      featureDeps(),
    );
    await handle.ready;
    const drawing = within(map()!);
    const alpha = drawing.getByRole("button", { name: "Alpha, standard" });
    const beta = drawing.getByRole("button", { name: "Beta, daylight" });
    // One stop: the first shape, in the list's order.
    expect(alpha).toHaveAttribute("tabindex", "0");
    expect(beta).toHaveAttribute("tabindex", "-1");
    alpha.focus();
    await user.keyboard("{ArrowRight}");
    expect(beta).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(alpha).toHaveFocus();
    await user.keyboard("{End}");
    expect(beta).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(beta).toBePressed();
    expect(onPin).toHaveBeenLastCalledWith("BB", true);
    // A pin from elsewhere moves the stop to the pinned shape.
    handle.pin("AA");
    expect(alpha).toHaveAttribute("tabindex", "0");
    expect(beta).toHaveAttribute("tabindex", "-1");
  });

  it("clears the pin with null, and a restored pin tells the page it was not the reader's", async () => {
    const onPin = vi.fn();
    const { handle } = drawFeatureMap(featureConfig({ onPin }), featureDeps());
    await handle.ready;
    expect(handle.pin("ZZ")).toBe(false);
    expect(handle.pin("AA", { user: false })).toBe(true);
    expect(onPin).toHaveBeenLastCalledWith("AA", false);
    expect(handle.pin(null)).toBe(true);
    expect(handle.pinned()).toBeNull();
    expect(onPin).toHaveBeenLastCalledWith(null, true);
    expect(rowOf(/AA/)).not.toBePressed();
    expect(
      within(map()!).getByRole("button", { name: "Alpha, standard" }),
    ).not.toBePressed();
  });

  it("clears the pin when the pinned row is pressed again, if the config says toggle", async () => {
    const { handle, user } = drawFeatureMap(
      featureConfig({ toggle: true }),
      featureDeps(),
    );
    await handle.ready;
    await user.click(rowOf(/AA/));
    expect(rowOf(/AA/)).toBePressed();
    await user.click(rowOf(/AA/));
    expect(rowOf(/AA/)).not.toBePressed();
    expect(handle.pinned()).toBeNull();
  });

  it("draws an overlay no one can press, hidden from assistive technology", async () => {
    const deps = featureDeps();
    const { handle } = drawFeatureMap(
      featureConfig({ overlayUrl: OVERLAY_URL }),
      deps,
    );
    await handle.ready;
    expect(deps.fetch).toHaveBeenCalledWith(OVERLAY_URL, expect.anything());
    const svg = map()!;
    // oxlint-disable-next-line testing-library/no-node-access -- the overlay is aria-hidden and has no role by design, so only a selector reaches it
    const hidden = svg.querySelectorAll("path[aria-hidden='true']");
    // The land and the one line; the two states are the buttons.
    expect(hidden.length).toBeGreaterThanOrEqual(2);
    expect(within(svg).getAllByRole("button")).toHaveLength(2);
    // oxlint-disable-next-line testing-library/no-node-access -- proves the overlay paths take no tab stop, which no role query can show
    expect(svg.querySelectorAll("path[tabindex]")).toHaveLength(2);
  });

  it("still draws the states when the overlay file is missing", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) =>
      String(url) === OVERLAY_URL
        ? new Response("", { status: 404 })
        : Response.json(STATE_BOUNDARIES_FIXTURE),
    ) as unknown as typeof fetch;
    const { handle } = drawFeatureMap(
      featureConfig({ overlayUrl: OVERLAY_URL }),
      featureDeps({ fetch: fetcher }),
    );
    await handle.ready;
    expect(within(map()!).getAllByRole("button")).toHaveLength(2);
  });

  it("draws nothing when it is aborted mid-fetch", async () => {
    let release: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const deps = featureDeps({
      fetch: (() => pending) as unknown as typeof fetch,
    });
    const { handle, controller } = drawFeatureMap(featureConfig(), deps);
    controller.abort();
    release(Response.json({ type: "FeatureCollection", features: [] }));
    await handle.ready;
    await waitFor(() => expect(map()).toBeNull());
    expect(handle.pin("AA")).toBe(true);
  });

  it("stops at destroy() without ending the page's own signal", async () => {
    const { handle, controller } = drawFeatureMap(
      featureConfig(),
      featureDeps(),
    );
    await handle.ready;
    handle.destroy();
    expect(controller.signal.aborted).toBe(false);
  });
});
