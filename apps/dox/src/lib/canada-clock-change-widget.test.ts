/**
 * @vitest-environment jsdom
 *
 * The Canada 2026 clock-change checker as a chat widget (CORE-88): the credits id of the map,
 * the pinned zone, the permalink state, and a URL the chat keeps for itself.
 */
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { installJsdomShims } from "~/test/jsdom-shims";
import { handleCanadaClockChange } from "../../worker/canada-clock-change";
import { resetRateLimitState } from "../../worker/rate-limit";
import type { CanadaCheck } from "./canada-clock-change";
import {
  mountCanadaClockChangeWidget,
  renderCanadaClockChangeTemplate,
  renderCanadaClockChangeWidgetTemplate,
} from "./canada-clock-change-mount";

installJsdomShims();

const NOW = "2026-10-22T12:00:00Z";

async function workerAnswer(): Promise<CanadaCheck> {
  const response = await handleCanadaClockChange(
    new Request("https://northguild.dev/gmt/api/canada-clock-change", {
      headers: { "cf-connecting-ip": "9.8.7.6" },
    }),
    {},
    () => NOW,
  );
  return (await response.json()) as CanadaCheck;
}

function widgetRoot(): HTMLElement {
  document.body.innerHTML = renderCanadaClockChangeWidgetTemplate("rail-1");
  return document.querySelector<HTMLElement>(".gmt-canada")!;
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
    expect(root.querySelector("#canada-probe-title")).toBeNull();
  });

  it("renders no credits button in the markup: the map adds its own when it is drawn", () => {
    document.body.innerHTML = renderCanadaClockChangeTemplate();
    expect(document.querySelector(".gmt-data-credits-button")).toBeNull();
    expect(
      document
        .querySelector("[data-role='map']")
        ?.getAttribute("data-credits-id"),
    ).toBe("canada-data-credits");
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
    root.querySelector<HTMLElement>('.gmt-canada-zone-btn[aria-pressed="true"]')
      ?.dataset.tzId ?? null;

  it("pins the zone it was given in the list, and says so in its permalink state", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    const handle = await mountCanadaClockChangeWidget(
      root,
      { zone: "America/Winnipeg" },
      controller.signal,
    );
    await vi.waitFor(() => expect(pressed(root)).toBe("America/Winnipeg"));
    expect(handle.getPermalinkState?.()).toEqual({ zone: "America/Winnipeg" });
    handle.destroy();
    handle.destroy();
  });

  it("opens unpinned for an id that is not on the map", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    const handle = await mountCanadaClockChangeWidget(
      root,
      { zone: "Europe/London" },
      controller.signal,
    );
    await vi.waitFor(() =>
      expect(root.querySelector('[data-role="legend-count"]')?.textContent).not.toBe(
        "\u2013",
      ),
    );
    expect(pressed(root)).toBeNull();
    expect(handle.getPermalinkState?.()).toBeNull();
    handle.destroy();
  });

  it("leaves the chat's URL alone", async () => {
    const before = window.location.href;
    const root = widgetRoot();
    const controller = new AbortController();
    const handle = await mountCanadaClockChangeWidget(
      root,
      { zone: "America/Winnipeg" },
      controller.signal,
    );
    await vi.waitFor(() => expect(pressed(root)).toBe("America/Winnipeg"));
    expect(window.location.href).toBe(before);
    handle.destroy();
  });

  it("returns an inert handle when aborted before it starts", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountCanadaClockChangeWidget(root, {}, controller.signal);
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
