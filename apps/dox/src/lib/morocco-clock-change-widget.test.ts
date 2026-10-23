/**
 * @vitest-environment jsdom
 *
 * The Morocco 2026 clock-change checker as a chat widget (CORE-89): the credits id of the map,
 * the pinned zone, the permalink state, and a URL the chat keeps for itself.
 */
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { installJsdomShims } from "~/test/jsdom-shims";
import { handleMoroccoClockChange } from "../../worker/morocco-clock-change";
import { resetRateLimitState } from "../../worker/rate-limit";
import type { MoroccoCheck } from "./morocco-clock-change";
import {
  mountMoroccoClockChangeWidget,
  renderMoroccoClockChangeTemplate,
  renderMoroccoClockChangeWidgetTemplate,
} from "./morocco-clock-change-mount";

installJsdomShims();

const NOW = "2026-10-25T12:00:00Z";

async function workerAnswer(): Promise<MoroccoCheck> {
  const response = await handleMoroccoClockChange(
    new Request("https://northguild.dev/gmt/api/morocco-clock-change", {
      headers: { "cf-connecting-ip": "9.8.7.7" },
    }),
    {},
    () => NOW,
  );
  return (await response.json()) as MoroccoCheck;
}

function widgetRoot(): HTMLElement {
  document.body.innerHTML = renderMoroccoClockChangeWidgetTemplate("rail-1");
  return document.querySelector<HTMLElement>(".gmt-morocco")!;
}

describe("the chat template", () => {
  it("names the map's credits id after the prefix, so two copies cannot collide", () => {
    const root = widgetRoot();
    expect(
      root.querySelector("[data-role='map']")?.getAttribute("data-credits-id"),
    ).toBe("rail-1-data-credits");
  });

  it("prefixes the heading ids so a second copy cannot collide", () => {
    const root = widgetRoot();
    expect(root.querySelector("#rail-1-probe-title")).not.toBeNull();
    expect(root.querySelector("#morocco-probe-title")).toBeNull();
  });

  it("renders no credits button in the markup: the map adds its own when it is drawn", () => {
    document.body.innerHTML = renderMoroccoClockChangeTemplate();
    expect(document.querySelector(".gmt-data-credits-button")).toBeNull();
    expect(
      document
        .querySelector("[data-role='map']")
        ?.getAttribute("data-credits-id"),
    ).toBe("morocco-data-credits");
  });
});

describe("the chat mount", () => {
  beforeEach(async () => {
    resetRateLimitState();
    const answer = await workerAnswer();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answer)),
    );
    // Pin the system clock so the library's now sits at the answer's.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix(NOW)!);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const pressed = (root: HTMLElement) =>
    root.querySelector<HTMLElement>(
      '.gmt-zonemap-zone-btn[aria-pressed="true"]',
    )?.dataset.tzId ?? null;

  it("pins the zone it was given in the list, and says so in its permalink state", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    const handle = await mountMoroccoClockChangeWidget(
      root,
      { zone: "Africa/El_Aaiun" },
      controller.signal,
    );
    await vi.waitFor(() => expect(pressed(root)).toBe("Africa/El_Aaiun"));
    expect(handle.getPermalinkState?.()).toEqual({ zone: "Africa/El_Aaiun" });
    handle.destroy();
    handle.destroy();
  });

  it("opens unpinned for an id that is not on the map", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    const handle = await mountMoroccoClockChangeWidget(
      root,
      { zone: "America/Toronto" },
      controller.signal,
    );
    await vi.waitFor(() =>
      expect(
        root.querySelector('[data-role="legend-count"]')?.textContent,
      ).not.toBe("\u2013"),
    );
    expect(pressed(root)).toBeNull();
    expect(handle.getPermalinkState?.()).toBeNull();
    handle.destroy();
  });

  it("leaves the chat's URL alone", async () => {
    const before = window.location.href;
    const root = widgetRoot();
    const controller = new AbortController();
    const handle = await mountMoroccoClockChangeWidget(
      root,
      { zone: "Africa/El_Aaiun" },
      controller.signal,
    );
    await vi.waitFor(() => expect(pressed(root)).toBe("Africa/El_Aaiun"));
    expect(window.location.href).toBe(before);
    handle.destroy();
  });

  it("returns an inert handle when aborted before it starts", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountMoroccoClockChangeWidget(
      root,
      {},
      controller.signal,
    );
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
