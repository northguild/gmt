/**
 * @vitest-environment jsdom
 *
 * The Opening Hours Board end to end against the real `@northguild/gmt`, through roles and
 * accessible names the way a person meets the page. jsdom has no layout, so the still bounding
 * boxes are the `readout-still` gate's; each test destroys its mount in `afterEach`.
 */
import { screen, within } from "@testing-library/dom";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  pasteInto,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { BOARD_PRESETS } from "./opening-hours-board-seed";
import {
  mountOpeningHoursBoard,
  renderOpeningHoursBoardTemplate,
  type BoardArgs,
} from "./opening-hours-board-mount";

installJsdomShims();

const entry: LoadedWidget<BoardArgs> = {
  renderTemplate: renderOpeningHoursBoardTemplate,
  mount: mountOpeningHoursBoard,
};

let live: RenderedWidget | null = null;

// ui-standards-ok: the open/afterEach fixture every mount test owns, so each test tears down its mount
const open = async (args: BoardArgs = {}): Promise<RenderedWidget> => {
  live?.destroy();
  // ui-standards-ok: the mount fixture every test file owns, so each test tears down its own mount
  live = await renderWidget(entry as LoadedWidget<never>, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
});

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const verdict = () => screen.getByRole("status", { name: "Verdict" });
const box = (name: string) => screen.getByRole("textbox", { name });
const fromHandle = () => screen.getByRole("slider", { name: "From" });

describe("opening", () => {
  it("opens on the first preset: a week with open time", async () => {
    const w = await open();
    expect(within(verdict()).getByText("Open this week")).toBeInTheDocument();
    expect(box("Time zone")).toHaveValue("Asia/Tokyo");
    expect(box("Monday window 1 from")).toHaveValue("09:00");
    await expectNoAxeViolations(w.root);
  });

  it("opens seeded from arguments, with the horizon and the duration", async () => {
    await open({
      preset: "tokyo-desk",
      from: "2024-06-14T17:30:00+09:00",
      duration: "PT8H",
    });
    expect(box("Open time to add (optional)")).toHaveValue("PT8H");
    expect(screen.getByRole("group", { name: "Calls made" })).toHaveTextContent(
      "addOperatingTime",
    );
  });

  it("offers every Board preset", async () => {
    await open();
    expect(within(preset()).getAllByRole("option")).toHaveLength(
      BOARD_PRESETS.length + 1,
    );
  });
});

describe("each preset", () => {
  it.each([
    ["tokyo-desk", "Open this week"],
    ["johannesburg-holidays", "Closed all week"],
    ["kolkata-annotated-holiday", "Schedule refused"],
    ["sao-paulo-two-overrides", "Schedule refused"],
    ["sydney-night-curfew", "Open this week"],
  ])("%s reads %s", async (id, title) => {
    const w = await open();
    await w.user.selectOptions(preset(), id);
    expect(within(verdict()).getByText(title)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("shows NO SIGNAL only for a refusal, never for closed", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "johannesburg-holidays");
    expect(within(verdict()).queryByText(/NO SIGNAL/)).not.toBeInTheDocument();
    await w.user.selectOptions(preset(), "kolkata-annotated-holiday");
    expect(within(verdict()).getByText(/NO SIGNAL/)).toBeInTheDocument();
  });
});

describe("a refused schedule", () => {
  it("reads Schedule refused across every plate and names the holiday line", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "kolkata-annotated-holiday");
    expect(screen.getAllByText("Schedule refused").length).toBeGreaterThan(5);
    expect(box("Holidays (one date per line)")).toBeInvalid();
    expect(screen.getByText(/Line 1 is refused/)).toBeInTheDocument();
  });

  it("marks the window the reader broke, and clears it when fixed", async () => {
    const w = await open();
    const group = screen.getByRole("group", { name: "Monday" });
    await pasteInto(w, box("Monday window 1 to"), "25:99");
    expect(within(verdict()).getByText("Schedule refused")).toBeInTheDocument();
    const shown = () =>
      within(group)
        .queryAllByText("Refused on its own")
        .filter((e) => !e.hidden);
    expect(shown()).toHaveLength(1);
    await pasteInto(w, box("Monday window 1 to"), "18:00");
    expect(within(verdict()).getByText("Open this week")).toBeInTheDocument();
    expect(shown()).toHaveLength(0);
  });

  it("refuses a zone the library refuses", async () => {
    const w = await open();
    await pasteInto(w, box("Time zone"), "Mars/Base");
    expect(box("Time zone")).toBeInvalid();
    expect(within(verdict()).getByText("Schedule refused")).toBeInTheDocument();
  });
});

describe("the window editor", () => {
  it("puts focus on Add after removing the only window", async () => {
    const w = await open();
    await w.user.click(
      screen.getByRole("button", { name: "Remove Monday window 1" }),
    );
    expect(
      screen.getByRole("button", { name: "Add Monday window" }),
    ).toHaveFocus();
    expect(within(verdict()).getByText("Open this week")).toBeInTheDocument();
  });

  it("puts focus on the next window's from box after a remove, and on a new one after an add", async () => {
    const w = await open();
    await w.user.click(
      screen.getByRole("button", { name: "Add Monday window" }),
    );
    expect(box("Monday window 2 from")).toHaveFocus();
    await w.user.click(
      screen.getByRole("button", { name: "Remove Monday window 1" }),
    );
    expect(box("Monday window 1 from")).toHaveFocus();
    await expectNoAxeViolations(w.root);
  });

  it("adds and removes an override", async () => {
    const w = await open();
    await w.user.click(screen.getByRole("button", { name: "Add override" }));
    expect(box("Override 1 date")).toHaveFocus();
    await w.user.click(
      screen.getByRole("button", { name: "Remove override 1" }),
    );
    expect(screen.getByRole("button", { name: "Add override" })).toHaveFocus();
  });

  it("says it is the reader's own schedule once a box changes", async () => {
    const w = await open();
    await pasteInto(w, box("Monday window 1 from"), "08:00");
    expect(preset()).toHaveValue("custom");
  });
});

describe("the handles", () => {
  it("moves From by one step with an arrow and leaves the schedule boxes alone", async () => {
    const w = await open({ preset: "tokyo-desk" });
    fromHandle().focus();
    await w.user.keyboard("{ArrowRight}");
    expect(box("From (instant)")).toHaveValue("2024-06-14T17:45:00+09:00");
    expect(fromHandle()).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/Jun/),
    );
    expect(box("Monday window 1 from")).toHaveValue("09:00");
    expect(box("Time zone")).toHaveValue("Asia/Tokyo");
    await expectNoAxeViolations(w.root);
  });

  it("refuses a From the library refuses, in words and not blank", async () => {
    const w = await open();
    await pasteInto(w, box("From (instant)"), "yesterday");
    expect(screen.getAllByText("From refused").length).toBeGreaterThan(0);
    expect(screen.getAllByText("From refused").length).toBeGreaterThan(0);
  });
});

describe("the hand-off", () => {
  it("links to the Checker with the schedule as the fields spell it", async () => {
    await open();
    const link = screen.getByRole("link", {
      name: "Check this schedule in the Operating Schedule Checker",
    });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/tools/operating-schedule-checker/");
    const args = JSON.parse(
      new URL(href, "https://x.test").searchParams.get("wa")!,
    );
    expect(JSON.parse(args.schedule).timeZone).toBe("Asia/Tokyo");
  });
});
