// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "../test/jsdom-shims";
import { expectNoAxeViolations } from "../test/render-widget";
import { renderDataCreditsHtml, TZ_BOUNDARIES } from "./data-credits";
import { mountTimezoneMap, type TimezoneMapHost } from "./timezone-map";
import { TIMEZONES } from "./timezones";
import { setHtml } from "~/widgets/builders";
import { zoneMapShell } from "~/widgets/families/zones/zone-map-shell";

installJsdomShims();

const mounted: Array<{ map: TimezoneMapHost; host: HTMLElement }> = [];

afterEach(() => {
  for (const { map, host } of mounted.splice(0)) {
    map.destroy();
    host.remove();
  }
  vi.unstubAllGlobals();
});

async function mount() {
  /* The boundary file is optional: an unavailable one leaves the map without zone polygons. */
  vi.stubGlobal("fetch", async () => ({ ok: false }));
  const host = document.createElement("div");
  document.body.append(host);
  setHtml(
    host,
    zoneMapShell({
      idPrefix: "test",
      zones: TIMEZONES,
      title: "Zones now",
      caption: "Every zone, live.",
      credits: renderDataCreditsHtml([TZ_BOUNDARIES], {
        id: "test-credits",
        placement: "corner",
      }),
    }),
  );
  const map = await mountTimezoneMap(host, new AbortController().signal);
  mounted.push({ map, host });
  return { host, map };
}

describe("timezone map", () => {
  it("is a region holding the map, a heading, the clock panel and a caption", async () => {
    const { host } = await mount();
    const region = screen.getByRole("region", { name: "Timezone map" });
    expect(
      within(region).getByRole("heading", { name: "Zones now" }),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("group", { name: "Time zones" }),
    ).toBeInTheDocument();
    expect(within(region).getByText("Every zone, live.")).toBeVisible();
    expect(
      within(region).getByRole("button", { name: "Data credits" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("fills each button with its offset and its local time", async () => {
    await mount();
    const button = screen.getByRole("button", { name: /^America\/New_York / });
    expect(button).toHaveTextContent(/GMT[+-]\d{2}:\d{2}/);
    expect(button).toHaveTextContent(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("presses the zone's button when it is chosen, and only that one", async () => {
    const user = userEvent.setup();
    const { host } = await mount();
    const newYork = screen.getByRole("button", { name: /^America\/New_York / });
    const utc = screen.getByRole("button", { name: /^UTC / });
    await user.click(newYork);
    expect(newYork).toBePressed();
    expect(utc).not.toBePressed();
    await user.click(utc);
    expect(utc).toBePressed();
    expect(newYork).not.toBePressed();
    await expectNoAxeViolations(host);
  });

  it("chooses a zone from the keyboard with Enter and Space", async () => {
    const user = userEvent.setup();
    await mount();
    const newYork = screen.getByRole("button", { name: /^America\/New_York / });
    newYork.focus();
    await user.keyboard("{Enter}");
    expect(newYork).toBePressed();
    const utc = screen.getByRole("button", { name: /^UTC / });
    utc.focus();
    await user.keyboard(" ");
    expect(utc).toBePressed();
    expect(newYork).not.toBePressed();
  });

  it("clears the pressed zone when the map is clicked", async () => {
    const user = userEvent.setup();
    const { host } = await mount();
    const newYork = screen.getByRole("button", { name: /^America\/New_York / });
    await user.click(newYork);
    expect(newYork).toBePressed();
    await user.click(
      screen.getByRole("img", { name: "Live timezone world map" }),
    );
    await waitFor(() => expect(newYork).not.toBePressed());
    await expectNoAxeViolations(host);
  });
});
