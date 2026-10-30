/**
 * @vitest-environment jsdom
 *
 * The Zone Planner mounted as a chat-rail widget: template -> mount -> read.
 */
import { screen, within } from "@testing-library/dom";
import { WIDGET_REGISTRY } from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
} from "~/test/render-widget";
import { setHtml } from "~/widgets/builders";
import { seedFromLocation } from "./widget-permalink";
import { seededZones } from "./zone-planner";
import {
  mountZonePlanner,
  renderZonePlannerTemplate,
} from "./zone-planner-mount";

installJsdomShims();

const NY_SPRING = "2026-03-08T06:45:00Z";
const planner = WIDGET_REGISTRY["showZonePlanner"]!;

// The mount imports the scrubber on first use. Under a full parallel suite
// that cold import alone can pass the 20 s test timeout, so load it once here
// with room to spare and let each test time only its own work.
beforeAll(async () => {
  await import("./multi-zone-scrubber");
}, 120_000);

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("mountZonePlanner", () => {
  it("pins the seeded zones in order, at the seeded time", async () => {
    const w = await renderWidget(planner, {
      args: {
        zones: ["America/New_York", "Europe/London", "Asia/Tokyo"],
        time: NY_SPRING,
      },
    });
    const view = within(w.root);
    const names = view
      .getAllByRole("button", { name: /^Remove / })
      .map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual([
      "Remove America/New_York",
      "Remove Europe/London",
      "Remove Asia/Tokyo",
    ]);
    expect(view.getByText("Sun 8 Mar 2026, 06:45 UTC")).toBeVisible();
    expect(view.getByRole("article", { name: "New York" })).toHaveTextContent(
      "01:45",
    );
    await expectNoAxeViolations(w.root);
    w.destroy();
  });

  it("does not rewrite the page's URL, which in the rail is /dox", async () => {
    const w = await renderWidget(planner, {
      args: { zones: ["Asia/Tokyo"], time: NY_SPRING },
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const replace = vi.spyOn(globalThis.history, "replaceState");
    setRange(within(w.root).getByRole("slider"), 60);
    vi.advanceTimersByTime(1000);
    expect(replace).not.toHaveBeenCalled();
    w.destroy();
  });

  it("points the share link at the planner's own page", async () => {
    const w = await renderWidget(planner, {
      args: { zones: ["Asia/Tokyo"], time: NY_SPRING },
    });
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await w.user.click(
      within(w.root).getByRole("button", { name: "Copy shareable link" }),
    );
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const url = String((writeText.mock.calls[0] as unknown[])[0]);
    expect(new URL(url).pathname).toBe("/gmt/tools/zone-planner/");
    expect(url).toContain("tz=Asia%2FTokyo");
    w.destroy();
  });

  it("hands back a permalink of strings that seeds the page the same way", async () => {
    const w = await renderWidget(planner, {
      args: { zones: ["America/New_York", "Europe/London"], time: NY_SPRING },
    });
    setRange(within(w.root).getByRole("slider"), 15);
    const search = w.permalink().slice(w.permalink().indexOf("?"));
    const wa = new URLSearchParams(search).get("wa")!;
    expect(JSON.parse(wa)).toEqual({
      time: "2026-03-08T07:00:00Z",
      zone1: "America/New_York",
      zone2: "Europe/London",
    });
    expect(seededZones(seedFromLocation("planner", search))).toEqual([
      "America/New_York",
      "Europe/London",
    ]);
    w.destroy();
  });

  it("is inert when aborted before the planner loads", async () => {
    const root = document.createElement("div");
    setHtml(root, renderZonePlannerTemplate());
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountZonePlanner(
      root,
      { zones: ["Asia/Tokyo"] },
      controller.signal,
    );
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("can be destroyed twice", async () => {
    const w = await renderWidget(planner, { args: { zones: ["Asia/Tokyo"] } });
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});
