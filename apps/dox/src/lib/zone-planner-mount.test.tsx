/**
 * @vitest-environment jsdom
 *
 * The Zone Planner mounted as a chat-rail widget: template -> mount -> read.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { seedFromLocation } from "./widget-permalink";
import { seededZones } from "./zone-planner";
import {
  mountZonePlanner,
  renderZonePlannerTemplate,
} from "./zone-planner-mount";

installJsdomShims();

const NY_SPRING = "2026-03-08T06:45:00Z";

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderZonePlannerTemplate();
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountZonePlanner(root, args, controller.signal);
  return { root, handle, controller };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("mountZonePlanner", () => {
  it("pins the seeded zones in order, at the seeded time", async () => {
    const { root } = await mount({
      zones: ["America/New_York", "Europe/London", "Asia/Tokyo"],
      time: NY_SPRING,
    });
    const rows = [...root.querySelectorAll<HTMLElement>("[data-zone-row]")];
    expect(rows.map((r) => r.dataset.zoneRow)).toEqual([
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
    ]);
    expect(root.querySelector('[data-role="readout"]')!.textContent).toBe(
      "Sun 8 Mar 2026, 06:45 UTC",
    );
    const ny = rows[0]!.querySelector('[data-field="time"]')!.textContent;
    expect(ny).toBe("01:45");
  });

  it("does not rewrite the page's URL, which in the rail is /dox", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const replace = vi.spyOn(globalThis.history, "replaceState");
    const { root } = await mount({ zones: ["Asia/Tokyo"], time: NY_SPRING });
    const slider = root.querySelector<HTMLInputElement>(
      '[data-role="slider"]',
    )!;
    slider.value = "60";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(1000);
    expect(replace).not.toHaveBeenCalled();
  });

  it("points the share link at the planner's own page", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { root } = await mount({ zones: ["Asia/Tokyo"], time: NY_SPRING });
    root.querySelector<HTMLButtonElement>('[data-role="share"]')!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const url = String((writeText.mock.calls[0] as unknown[])[0]);
    expect(new URL(url).pathname).toBe("/tools/zone-planner/");
    expect(url).toContain("tz=Asia%2FTokyo");
  });

  it("hands back a permalink of strings that seeds the page the same way", async () => {
    const { root, handle } = await mount({
      zones: ["America/New_York", "Europe/London"],
      time: NY_SPRING,
    });
    const slider = root.querySelector<HTMLInputElement>(
      '[data-role="slider"]',
    )!;
    slider.value = "15";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    const state = handle.getPermalinkState?.() as Record<string, string>;
    expect(state).toEqual({
      time: "2026-03-08T07:00:00Z",
      zone1: "America/New_York",
      zone2: "Europe/London",
    });
    const search = `?w=planner&wa=${encodeURIComponent(JSON.stringify(state))}`;
    expect(seededZones(seedFromLocation("planner", search))).toEqual([
      "America/New_York",
      "Europe/London",
    ]);
  });

  it("is inert when aborted before the planner loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderZonePlannerTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountZonePlanner(
      root,
      { zones: ["Asia/Tokyo"] },
      controller.signal,
    );
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(root.querySelector("[data-zone-row]")).toBeNull();
  });

  it("can be destroyed twice", async () => {
    const { handle } = await mount({ zones: ["Asia/Tokyo"] });
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});
