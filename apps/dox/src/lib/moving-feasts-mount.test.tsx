/**
 * @vitest-environment jsdom
 *
 * Moving Feasts end to end against the real `@northguild/gmt`, through roles and accessible
 * names the way a reader meets the page.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { FEAST_OFFSETS } from "./moving-feasts";
import { NO_SIGNAL_SHORT } from "./moving-feasts-mount";

installJsdomShims();

const entry = WIDGET_REGISTRY["showMovingFeasts"] as AnyWidgetEntry;

async function mount(args: unknown = {}): Promise<RenderedWidget> {
  return renderWidget(entry, { args });
}

async function setYear(rendered: RenderedWidget, year: string): Promise<void> {
  const field = screen.getByRole("textbox", { name: "Year" });
  await rendered.user.clear(field);
  await rendered.user.paste(year);
}

const summary = () => screen.getByRole("status", { name: "Easter summary" });
const yearNote = () => screen.getByRole("note", { name: "Year note" });
const picks = () =>
  within(
    screen.getAllByRole("list", { name: "Marked dates" })[0]!,
  ).queryAllByRole("listitem");

describe("section 1", () => {
  it("2024 reads both Easters and 35 days", async () => {
    const rendered = await mount();
    await setYear(rendered, "2024");
    expect(summary()).toHaveTextContent(
      "2024: Gregorian Easter 2024-03-31, Julian Easter 2024-05-05, 35 days apart.",
    );
    expect(screen.getByText("2024-03-31")).toBeInTheDocument();
    expect(screen.getByText("2024-05-05")).toBeInTheDocument();
    expect(screen.getByText("35 days")).toBeInTheDocument();
    await expectNoAxeViolations(rendered.root);
  });

  it("2025 reads same day", async () => {
    const rendered = await mount();
    await setYear(rendered, "2025");
    expect(summary()).toHaveTextContent("the same day");
    expect(screen.getAllByText("same day").length).toBeGreaterThan(0);
    await expectNoAxeViolations(rendered.root);
  });

  it("a year the library cannot place is NO SIGNAL on both plates, with an empty grid", async () => {
    const rendered = await mount();
    await setYear(rendered, "-300000");
    expect(summary()).toHaveTextContent("-300000: no Easter placed.");
    expect(screen.getAllByText(NO_SIGNAL_SHORT).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(yearNote()).toHaveTextContent("NO SIGNAL");
    expect(picks()).toHaveLength(0);
    await expectNoAxeViolations(rendered.root);
  });

  it("walks the ends of the range without throwing, each year answered from the library", async () => {
    const rendered = await mount();
    const field = screen.getByRole("textbox", { name: "Year" });
    for (const year of [
      "33808",
      "33809",
      "-271815",
      "-271821",
      "-271822",
      "275760",
      "275761",
    ]) {
      await setYear(rendered, year);
      expect(field).toHaveValue(year);
      expect(summary()).toHaveTextContent(`${year}:`);
    }
    await setYear(rendered, "33808");
    expect(yearNote()).toHaveTextContent("in another calendar year");
    await setYear(rendered, "-271821");
    expect(yearNote()).toHaveTextContent("neighbouring years");
    expect(picks().length).toBeGreaterThan(0);
    await setYear(rendered, "-271822");
    expect(summary()).toHaveTextContent("no Easter placed");
    expect(picks()).toHaveLength(0);
    await expectNoAxeViolations(rendered.root);
  });

  it("one toggle per offset, each marking a date", async () => {
    const rendered = await mount();
    await setYear(rendered, "2024");
    const group = screen.getByRole("group", { name: "Days from Easter" });
    const toggles = within(group).getAllByRole("checkbox");
    expect(toggles).toHaveLength(FEAST_OFFSETS.length);
    expect(picks().length).toBeGreaterThan(0);
    const before = picks().length;
    const open = toggles.find((t) => !(t as HTMLInputElement).checked)!;
    await rendered.user.click(open);
    expect(picks().length).toBeGreaterThan(before);
    await expectNoAxeViolations(rendered.root);
  });

  it("dragging the slider moves the year and both Easters with it", async () => {
    const rendered = await mount();
    const slider = screen.getByRole("slider", { name: "Year slider" });
    for (const year of [2024, 2025]) {
      setRange(slider, year);
      expect(screen.getByRole("textbox", { name: "Year" })).toHaveValue(
        String(year),
      );
      expect(summary()).toHaveTextContent(`${year}: Gregorian Easter`);
    }
    await expectNoAxeViolations(rendered.root);
  });
});

describe("section 2", () => {
  it("fifth Friday of February is NO SIGNAL, and January gives the 30th with both chips", async () => {
    const rendered = await mount({ preset: "fifth-friday" });
    expect(screen.getByRole("note", { name: "Date note" })).toHaveTextContent(
      "no fifth Friday",
    );
    expect(
      screen.getByRole("status", { name: "Date summary" }),
    ).toHaveTextContent("no fifth Friday");
    await rendered.user.selectOptions(
      screen.getByRole("combobox", { name: "Month" }),
      "January",
    );
    expect(
      screen.getByRole("status", { name: "Date summary" }),
    ).toHaveTextContent("2026-01-30");
    const lists = screen.getAllByRole("list", { name: "Marked dates" });
    const item = within(lists[1]!)
      .getAllByRole("listitem")
      .find((li) => /30 January 2026/.test(li.textContent ?? ""));
    expect(item).toHaveTextContent("ordinals 5, -1");
    expect(item).toHaveTextContent("series 1 pick");
    await expectNoAxeViolations(rendered.root);
  });
});

describe("the Builder link", () => {
  it("points at the Builder once there is a year and an offset", async () => {
    const rendered = await mount();
    await setYear(rendered, "2024");
    expect(
      screen.getByRole("link", { name: "Build a calendar from these" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/tools/holiday-rule-builder/"),
    );
    await expectNoAxeViolations(rendered.root);
  });

  it("has no link and says why when no year is placed", async () => {
    const rendered = await mount();
    await setYear(rendered, "-300000");
    expect(screen.getByText("Build a calendar from these")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("note", { name: "Hand-off hint" }),
    ).not.toHaveTextContent(/^$/);
    await expectNoAxeViolations(rendered.root);
  });
});

describe("the permalink", () => {
  it("carries the typed year", async () => {
    const rendered = await mount();
    await setYear(rendered, "2031");
    expect(rendered.permalink()).toContain("2031");
  });
});
