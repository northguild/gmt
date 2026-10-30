/**
 * @vitest-environment jsdom
 *
 * The Morocco 2026 clock-change checker as a chat widget (CORE-89): the copy's headings, the pinned
 * zone, the permalink state, and a URL the chat keeps for itself.
 */
import { within } from "@testing-library/dom";
import { moroccoTense } from "./clock-change-tense.fixture";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
import { setHtml, type SafeHtml } from "~/widgets/builders";
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

const roots: HTMLElement[] = [];

function place(markup: SafeHtml): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  roots.push(root);
  setHtml(root, markup);
  return root;
}

function widgetRoot(): HTMLElement {
  return place(renderMoroccoClockChangeWidgetTemplate("rail-1", moroccoTense));
}

describe("the chat template", () => {
  it("is the page's cards without the Key points, and a copy of it has no accessibility violations", async () => {
    const root = widgetRoot();
    expect(
      within(root).getByRole("region", { name: "Your browser" }),
    ).toBeInTheDocument();
    expect(
      within(root).queryByRole("region", { name: "Key points" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(root);
  });

  it("renders no credits button in the markup: the map adds its own when it is drawn", () => {
    const page = place(
      renderMoroccoClockChangeTemplate({ tense: moroccoTense }),
    );
    expect(
      within(page).queryByRole("button", { name: "Data credits" }),
    ).not.toBeInTheDocument();
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
    for (const root of roots.splice(0)) root.remove();
  });

  const zoneButtons = (root: HTMLElement) =>
    within(within(root).getByRole("list", { name: "Zones" })).getAllByRole(
      "button",
    );

  const pressed = (root: HTMLElement) =>
    zoneButtons(root).filter((b) => b.getAttribute("aria-pressed") === "true");

  /** Waits until exactly the named zone is pinned in the list. */
  const expectPinned = (root: HTMLElement, zone: string) =>
    vi.waitFor(() => {
      expect(pressed(root)).toHaveLength(1);
      expect(pressed(root)[0]).toHaveAccessibleName(
        expect.stringContaining(zone),
      );
    });

  it("pins the zone it was given in the list, and says so in its permalink state", async () => {
    const root = widgetRoot();
    const controller = new AbortController();
    const handle = await mountMoroccoClockChangeWidget(
      root,
      { zone: "Africa/El_Aaiun" },
      controller.signal,
    );
    await expectPinned(root, "Africa/El_Aaiun");
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
      expect(zoneButtons(root)[0]).not.toHaveTextContent("no answer yet"),
    );
    expect(pressed(root)).toHaveLength(0);
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
    await expectPinned(root, "Africa/El_Aaiun");
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
