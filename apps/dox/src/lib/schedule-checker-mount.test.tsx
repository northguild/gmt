/**
 * @vitest-environment jsdom
 *
 * The Operating Schedule Checker end to end against the real `@northguild/gmt`, through roles
 * and accessible names the way a person meets the page. jsdom has no layout, so the still
 * bounding boxes are the `readout-still` gate's; the leak guard checks the abort.
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
import { OPERATING_SCHEDULE_PRESETS } from "~/data/operating-schedule-presets";
import type { ScheduleCheckerArgs } from "./schedule-checker";
import {
  mountScheduleChecker,
  renderScheduleCheckerTemplate,
} from "./schedule-checker-mount";

installJsdomShims();

const entry: LoadedWidget<ScheduleCheckerArgs> = {
  renderTemplate: renderScheduleCheckerTemplate,
  mount: mountScheduleChecker,
};

let live: RenderedWidget | null = null;

const open = async (
  args: ScheduleCheckerArgs = {},
  // ui-standards-ok: the open helper every mount test has; a shared one is a cross-tool change
): Promise<RenderedWidget> => {
  live?.destroy();
  live = await renderWidget(entry as LoadedWidget<never>, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
});

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const scheduleBox = () =>
  screen.getByRole("textbox", { name: "Schedule (JSON)" });
const startBox = () => screen.getByRole("textbox", { name: "Interval start" });
const endBox = () => screen.getByRole("textbox", { name: "Interval end" });
const verdict = () => screen.getByRole("status", { name: "Verdict" });

describe("opening", () => {
  it("opens on the first preset, open in its interval", async () => {
    const w = await open();
    expect(
      within(verdict()).getByText("Open in this interval"),
    ).toBeInTheDocument();
    expect(startBox()).not.toHaveValue("");
    await expectNoAxeViolations(w.root);
  });

  it("opens seeded from arguments", async () => {
    await open({ preset: "johannesburg-holidays" });
    expect(
      within(verdict()).getByText("Closed in this interval"),
    ).toBeInTheDocument();
  });

  it("caps the schedule box", async () => {
    await open();
    expect(scheduleBox()).toHaveAttribute("maxlength", "8000");
  });
});

describe("each verdict", () => {
  it.each([
    ["tokyo-desk", "Open in this interval"],
    ["johannesburg-holidays", "Closed in this interval"],
    ["london-weekday-8", "Refused"],
    ["kolkata-annotated-holiday", "Refused"],
    ["sao-paulo-two-overrides", "Refused"],
    ["sydney-night-curfew", "Open in this interval"],
  ])("%s reads %s", async (id, title) => {
    const w = await open();
    await w.user.selectOptions(preset(), id);
    expect(within(verdict()).getByText(title)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("names a refused part and the calls that agree on []", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "london-weekday-8");
    expect(
      screen.getByRole("list", {
        name: "Parts the library refuses on their own",
      }),
    ).toHaveTextContent('weekly["8"]');
    expect(screen.getByRole("group", { name: "Calls made" })).toHaveTextContent(
      "operatingIntervals",
    );
  });

  it("shows NO SIGNAL only for a refusal, never for closed", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "johannesburg-holidays");
    expect(within(verdict()).queryByText(/NO SIGNAL/)).not.toBeInTheDocument();
    await w.user.selectOptions(preset(), "london-weekday-8");
    expect(within(verdict()).getByText(/NO SIGNAL/)).toBeInTheDocument();
  });

  it("asks for an interval when one end is blank", async () => {
    const w = await open();
    await pasteInto(w, endBox(), "");
    expect(
      within(verdict()).getByText(
        "Type an interval to see whether it is open.",
      ),
    ).toBeInTheDocument();
  });

  it("refuses an interval the library refuses", async () => {
    const w = await open();
    await pasteInto(w, startBox(), "yesterday");
    expect(
      within(verdict()).getByText(/isValidInterval returns false/),
    ).toBeInTheDocument();
  });
});

describe("text that is not JSON", () => {
  it("is the box's own error and no schedule verdict", async () => {
    const w = await open();
    await pasteInto(w, scheduleBox(), "{ nope");
    expect(scheduleBox()).toBeInvalid();
    expect(screen.getAllByText("Not JSON").length).toBeGreaterThan(0);
    expect(within(verdict()).queryByText("Refused")).not.toBeInTheDocument();
    expect(within(verdict()).queryByText(/NO SIGNAL/)).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("the preset box", () => {
  it("says it is the reader's own schedule once the text changes", async () => {
    const w = await open();
    await pasteInto(w, scheduleBox(), "{}");
    expect(preset()).toHaveValue("custom");
  });

  it("offers every preset", async () => {
    await open();
    const options = within(preset()).getAllByRole("option");
    expect(options).toHaveLength(OPERATING_SCHEDULE_PRESETS.length + 1);
  });
});
