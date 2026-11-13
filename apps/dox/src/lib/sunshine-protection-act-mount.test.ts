/**
 * @vitest-environment jsdom
 *
 * The Sunshine Protection Act page end to end: template, mount, fetch, render. The Worker's answer
 * comes from the real Worker code at a fixed instant. The measure reports a narrow section, so the
 * lists are the interface and no boundary file is fetched.
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
import { setHtml, type SafeHtml } from "~/widgets/builders";
import { computeSunshineActZones } from "../../worker/sunshine-protection-act";
import {
  PROPOSALS_CHECKED,
  STATE_CODES,
} from "../data/sunshine-protection-act-proposals";
import {
  mountSunshineProtectionAct,
  renderSunshineProtectionActTemplate,
  renderSunshineProtectionActWidgetTemplate,
  type SunshineActSeed,
} from "./sunshine-protection-act-mount";

installJsdomShims();

const NOW = "2026-11-13T12:00:00Z";
const controllers: AbortController[] = [];
const roots: HTMLElement[] = [];

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.abort();
  for (const root of roots.splice(0)) root.remove();
});

const place = (markup: SafeHtml): HTMLElement => {
  const root = document.createElement("div");
  document.body.append(root);
  roots.push(root);
  setHtml(root, markup);
  return root;
};

const answering = (): typeof fetch =>
  vi.fn(async () => Response.json(computeSunshineActZones(NOW))) as never;

async function mount(
  seed?: SunshineActSeed,
  fetchFn: typeof fetch = answering(),
  guidance = true,
) {
  const root = place(renderSunshineProtectionActTemplate({ guidance }));
  const controller = new AbortController();
  controllers.push(controller);
  const handle = await mountSunshineProtectionAct(
    root,
    controller.signal,
    seed,
    {
      fetch: fetchFn,
      measure: () => 400,
      today: async () => PROPOSALS_CHECKED,
    },
  );
  return { root, handle, user: userEvent.setup() };
}

const todayList = () =>
  screen.getByRole("region", { name: "US time zones, scrollable list" });
const stateList = (hidden = false) =>
  screen.getByRole("region", {
    name: "US states and territories, scrollable list",
    hidden,
  });

describe("the Sunshine Protection Act page", () => {
  it("renders every zone and state before the answer, and passes axe", async () => {
    const root = place(renderSunshineProtectionActTemplate({ guidance: true }));
    expect(within(todayList()).getAllByRole("button")).toHaveLength(36);
    expect(
      within(stateList(true)).getAllByRole("button", { hidden: true }),
    ).toHaveLength(STATE_CODES.length);
    await expectNoAxeViolations(root);
  });

  it("shows Today first and switches to Proposals", async () => {
    const { user, handle } = await mount();
    await handle.ready;
    expect(screen.getByRole("radio", { name: "Today" })).toBeChecked();
    expect(todayList()).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Proposals" }));
    expect(stateList()).toBeVisible();
    expect(
      screen.queryByRole("region", { name: /time zones/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Today" }));
    expect(todayList()).toBeVisible();
  });

  it("words each zone from the Worker's answer", async () => {
    const { handle } = await mount();
    await handle.ready;
    expect(
      within(todayList()).getByRole("button", { name: /New_York|New York/ }),
    ).toHaveTextContent("Still changes clocks");
    expect(
      within(todayList()).getByRole("button", { name: /Phoenix/ }),
    ).toHaveTextContent("Never changes clocks");
  });

  it("lists the Navajo Nation, and drops the No data row once every zone has an answer", async () => {
    const { handle } = await mount();
    await handle.ready;
    expect(
      screen.getByText("Navajo Nation, in Arizona: still changes clocks"),
    ).toBeVisible();
    expect(screen.queryByText(/^No data/)).not.toBeVisible();
  });

  it("pins a zone from the list and fills its panel", async () => {
    const { user, handle } = await mount();
    await handle.ready;
    await user.click(
      within(todayList()).getByRole("button", { name: /Phoenix/ }),
    );
    expect(screen.getAllByText("Offset now").length).toBeGreaterThan(0);
    expect(screen.getByText(/UTC-07:00|−07:00|-07:00/)).toBeVisible();
    expect(
      within(todayList()).getByRole("button", { name: /Phoenix/ }),
    ).toBePressed();
    expect(handle.state()).toEqual({ kind: "today", zone: "America/Phoenix" });
    await user.click(
      within(todayList()).getByRole("button", { name: /Phoenix/ }),
    );
    expect(handle.state()).toEqual({ kind: "today" });
  });

  it("opens on the view and place a seed names", async () => {
    const { handle } = await mount({ kind: "proposals", state: "DE" });
    await handle.ready;
    expect(screen.getByRole("radio", { name: "Proposals" })).toBeChecked();
    expect(handle.state()).toEqual({ kind: "proposals", state: "DE" });
    expect(screen.getAllByText(/Delaware/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/New York, Pennsylvania/).length,
    ).toBeGreaterThan(0);
  });

  it("opens unpinned for a place the page does not list", async () => {
    const { handle } = await mount({ kind: "today", zone: "Mars/Olympus" });
    await handle.ready;
    expect(handle.state()).toEqual({ kind: "today" });
  });

  it("says so when the Worker fails, and keeps the lists", async () => {
    const failing = vi.fn(
      async () => new Response("", { status: 500 }),
    ) as never;
    const { handle } = await mount(undefined, failing);
    await handle.ready;
    expect(screen.getByText("The check could not finish.")).toBeVisible();
    expect(within(todayList()).getAllByRole("button")).toHaveLength(36);
  });

  it("leaves the guidance cards out of the chat copy", () => {
    const page = place(renderSunshineProtectionActTemplate({ guidance: true }));
    expect(
      within(page).queryAllByRole("heading", { level: 3 }).length,
    ).toBeGreaterThan(0);
    const chat = place(renderSunshineProtectionActWidgetTemplate("chat"));
    expect(
      within(chat).getByRole("region", { name: /US time zones/ }),
    ).toBeInTheDocument();
    expect(within(chat).queryAllByRole("heading", { level: 3 })).toHaveLength(
      0,
    );
  });
});
