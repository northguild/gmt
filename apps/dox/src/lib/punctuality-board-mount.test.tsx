/**
 * @vitest-environment jsdom
 *
 * The Punctuality Board end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles and accessible names. Every printed deviation,
 * class and rate is an appendix Z row (PB1 to PB4, PBP, PBR1).
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { minutesToIso } from "./punctuality-widgets";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showPunctualityBoard"] as AnyWidgetEntry;

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });
const openPreset = (id: string, extra: Record<string, unknown> = {}) =>
  open({ preset: id, ...extra });

const LONDON = "[Europe/London]";
const at = (hhmm: string) => `2024-06-14T${hhmm}:00+01:00${LONDON}`;
const pairs = (...p: [string, string][]) =>
  p.map(([planned, actual]) => ({ planned, actual }));

// The controls, by the names a person reads.
const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const lateSlider = () => screen.getByRole("slider", { name: "Late tolerance" });
const earlySlider = () =>
  screen.getByRole("slider", { name: "Early tolerance" });
const compareSlider = () =>
  screen.getByRole("slider", { name: "Second late tolerance" });
const lateBox = () => screen.getByRole("textbox", { name: "Late tolerance" });
const earlyBox = () => screen.getByRole("textbox", { name: "Early tolerance" });
const earlySwitch = () =>
  screen.getByRole("switch", { name: "Early tolerance" });
const compareSwitch = () =>
  screen.getByRole("switch", { name: "A second late tolerance" });
const output = () =>
  screen.getByRole("status", { name: "What the calls returned" });
const board = () =>
  screen.getByRole("group", { name: "Arrivals against the tolerance" });
const rows = () => within(board()).getAllByRole("listitem");
const reason = () =>
  screen.queryByRole("complementary", { name: "Why NO SIGNAL" });
const callsTable = () =>
  screen.getByRole("table", { name: "The calls and what each returned" });

/** Replaces what a text box holds, in one input event, then commits it with Tab. */
async function enter(w: Widget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
  await w.user.tab();
}

/** Moves focus to a slider and presses keys. */
async function press(w: Widget, slider: HTMLElement, keys: string) {
  slider.focus();
  await w.user.keyboard(keys);
}

/** What one row reads, in order: the deviation, the class, and any second class. */
const readRow = (i: number, ...parts: string[]) =>
  expect(rows()[i]).toHaveTextContent(parts.join(""));

const PRESETS = {
  "fifteen-minute": {
    rate: ["4 of 6 on time, late tolerance 15 min (PT15M)"],
    hero: "4 of 6",
    out: ["{ onTime: 4, total: 6, rate: 0.6666666666666666 }"],
    deltas: [
      "+5 min",
      "+14 min 59 s",
      "+15 min",
      "+17 min",
      "−3 min",
      "−12 min",
    ],
    classes: ["on time", "on time", "late", "late", "on time", "on time"],
  },
  "sixty-and-120": {
    rate: [
      "2 of 6 on time, late tolerance 1 h (PT60M)",
      "4 of 6 on time, late tolerance 2 h (PT120M)",
    ],
    hero: "2 of 6",
    out: [
      "{ onTime: 2, total: 6, rate: 0.3333333333333333 }",
      "{ onTime: 4, total: 6, rate: 0.6666666666666666 }",
    ],
    deltas: [
      "+30 min",
      "+59 min",
      "+1 h",
      "+1 h 35 min",
      "+2 h",
      "+2 h 30 min",
    ],
    classes: [
      "on timeon time under 2 h",
      "on timeon time under 2 h",
      "lateon time under 2 h",
      "lateon time under 2 h",
      "latelate under 2 h",
      "latelate under 2 h",
    ],
  },
  "day-based": {
    rate: [
      "2 of 6 on time, late tolerance 24 h (P1D), early tolerance 24 h (P1D)",
    ],
    hero: "2 of 6",
    out: ["{ onTime: 2, total: 6, rate: 0.3333333333333333 }"],
    deltas: ["−36 h", "−24 h", "−6 h", "+20 h", "+24 h", "+72 h"],
    classes: ["early", "early", "on time", "on time", "late", "late"],
  },
  "fall-back": {
    rate: ["1 of 4 on time, late tolerance 15 min (PT15M)"],
    hero: "1 of 4",
    out: ["{ onTime: 1, total: 4, rate: 0.25 }"],
    deltas: ["+1 h", "+15 min", "+25 min", "+10 min"],
    classes: ["late", "late", "late", "on time"],
  },
} as const;

describe("mountPunctualityBoard: each preset", () => {
  it.each(Object.entries(PRESETS))(
    "%s prints the library's rates, deviations and classes",
    async (id, expected) => {
      const w = await openPreset(id);
      for (const line of expected.rate) {
        expect(screen.getByText(line)).toBeInTheDocument();
      }
      expect(presetBox()).toHaveValue(id);
      const lines = expected.out.join(" ");
      expect(output()).toHaveTextContent(lines);
      expect(rows()).toHaveLength(expected.deltas.length);
      expected.deltas.forEach((d, i) => {
        readRow(i, d, expected.classes[i]!);
      });
      await expectNoAxeViolations(w.root);
    },
  );

  it("fall-back also reads the wall clocks, each marked naive", async () => {
    await openPreset("fall-back");
    expect(
      screen.getByText("Read off the wall clocks (naive): 3 of 4 on time"),
    ).toBeInTheDocument();
    const wall: [string, string][] = [
      ["0 min", "on time"],
      ["−45 min", "on time"],
      ["+25 min", "late"],
      ["+10 min", "on time"],
    ];
    wall.forEach(([d, word], i) => {
      expect(rows()[i]).toHaveTextContent(`wall clock: ${d}${word} (naive)`);
    });
  });

  it("fifteen-minute has no naive reading", async () => {
    await openPreset("fifteen-minute");
    expect(
      screen.queryByText(/Read off the wall clocks/),
    ).not.toBeInTheDocument();
  });

  it("lists the calls made and what each returned", async () => {
    await openPreset("fifteen-minute");
    const call = screen.getByRole("group", { name: "Calls made" });
    expect(call).toHaveTextContent(/^punctualityRate\(\[\{ planned: /);
    expect(call).toHaveTextContent(/\}\], \{ late: "PT15M" \}\)$/);
    expect(cellsInColumn(callsTable(), "scheduleDeviation")).toHaveLength(6);
    const third = cellsInColumn(callsTable(), "classifyPunctuality")[2]!;
    expect(third).toHaveTextContent('"late"');
  });

  it("names every tolerance in the calls table when two are compared", async () => {
    await openPreset("sixty-and-120");
    expect(
      screen.getByRole("columnheader", {
        name: "classifyPunctuality, late 1 h",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", {
        name: "classifyPunctuality, late 2 h",
      }),
    ).toBeInTheDocument();
  });
});

describe("mountPunctualityBoard: the late tolerance handle", () => {
  it("is a named slider with a written value", async () => {
    await openPreset("fifteen-minute");
    const slider = lateSlider();
    expect(slider).toHaveValue(15);
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Late tolerance 15 minutes, PT15M",
    );
  });

  it("ArrowRight moves a minute and the boundary row turns on time", async () => {
    const w = await openPreset("fifteen-minute");
    await press(w, lateSlider(), "{ArrowRight}");
    expect(lateBox()).toHaveValue("PT16M");
    readRow(2, "+15 min", "on time");
    expect(screen.getByText(/^5 of 6 on time/)).toBeInTheDocument();
    expect(output()).toHaveTextContent(
      "{ onTime: 5, total: 6, rate: 0.8333333333333334 }",
    );
    expect(presetBox()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("arrowing back returns to the preset", async () => {
    const w = await openPreset("fifteen-minute");
    await press(w, lateSlider(), "{ArrowRight}{ArrowLeft}");
    expect(lateBox()).toHaveValue("PT15M");
    expect(presetBox()).toHaveValue("fifteen-minute");
  });

  it("Home goes to zero", async () => {
    const w = await openPreset("fifteen-minute");
    await press(w, lateSlider(), "{Home}");
    expect(lateBox()).toHaveValue("PT0S");
    expect(screen.getByText(/^2 of 6 on time/)).toBeInTheDocument();
  });

  it("End goes to the far edge, and the axis refits so it can go on", async () => {
    const w = await openPreset("fifteen-minute");
    await press(w, lateSlider(), "{End}");
    expect(lateBox()).toHaveValue(minutesToIso(30));
    await w.user.keyboard("{ArrowRight}");
    expect(lateBox()).toHaveValue(minutesToIso(31));
  });

  it("PageUp and PageDown move ten steps", async () => {
    const w = await openPreset("fifteen-minute");
    await press(w, lateSlider(), "{PageUp}");
    expect(lateBox()).toHaveValue("PT25M");
    await w.user.keyboard("{PageDown}");
    expect(lateBox()).toHaveValue("PT15M");
  });

  it("never goes below zero", async () => {
    const w = await openPreset("fifteen-minute");
    await press(w, lateSlider(), "{Home}{ArrowLeft}{PageDown}");
    expect(lateBox()).toHaveValue("PT0S");
  });

  it("follows a readable typed value and holds on one it cannot read", async () => {
    const w = await openPreset("fifteen-minute");
    await enter(w, lateBox(), "PT20M");
    expect(lateSlider()).toHaveValue(20);
    await enter(w, lateBox(), "P1W");
    expect(lateSlider()).toHaveValue(20);
  });

  it("a committed typed value refits the axis labels", async () => {
    const w = await openPreset("fifteen-minute");
    expect(screen.getByText("+30 min")).toBeInTheDocument();
    await enter(w, lateBox(), "PT2H");
    expect(screen.queryByText("+30 min")).not.toBeInTheDocument();
  });
});

describe("mountPunctualityBoard: the early tolerance", () => {
  it("is disabled until its switch is on, then reads early", async () => {
    const w = await openPreset("fifteen-minute");
    expect(earlyBox()).toBeDisabled();
    await w.user.click(earlySwitch());
    expect(earlySwitch()).toBeChecked();
    expect(earlyBox()).toBeEnabled();
    await enter(w, earlyBox(), "PT10M");
    readRow(5, "−12 min", "early");
    expect(screen.getByText(/^3 of 6 on time/)).toBeInTheDocument();
    expect(output()).toHaveTextContent("{ onTime: 3, total: 6, rate: 0.5 }");
    await expectNoAxeViolations(w.root);
  });

  it("End goes to zero and Home to the far edge", async () => {
    const w = await openPreset("fifteen-minute", { early: "PT10M" });
    expect(earlySlider()).toHaveAttribute("aria-valuemin", "-30");
    await press(w, earlySlider(), "{End}");
    expect(earlyBox()).toHaveValue("PT0S");
    await w.user.keyboard("{Home}");
    expect(earlyBox()).toHaveValue("PT30M");
  });

  it("ArrowLeft makes it longer and PageDown ten longer", async () => {
    const w = await openPreset("fifteen-minute", { early: "PT10M" });
    await press(w, earlySlider(), "{ArrowLeft}");
    expect(earlyBox()).toHaveValue("PT11M");
    await w.user.keyboard("{PageDown}");
    expect(earlyBox()).toHaveValue("PT21M");
  });

  it("switching the day-based early edge off makes the first row on time", async () => {
    const w = await openPreset("day-based");
    readRow(0, "−36 h", "early");
    await w.user.click(earlySwitch());
    expect(earlySwitch()).not.toBeChecked();
    readRow(0, "−36 h", "on time");
    expect(presetBox()).toHaveValue("custom");
  });

  it("a zero deviation with an early tolerance of zero reads early", async () => {
    await open({
      pairs: pairs([at("09:00"), at("09:00")]),
      late: "PT15M",
      early: "PT0S",
    });
    expect(rows()[0]).toHaveTextContent("early");
  });
});

describe("mountPunctualityBoard: the second tolerance", () => {
  it("shows its handle and result when switched on", async () => {
    const w = await openPreset("fifteen-minute");
    expect(
      screen.queryByRole("slider", { name: "Second late tolerance" }),
    ).not.toBeInTheDocument();
    await w.user.click(compareSwitch());
    expect(compareSwitch()).toBeChecked();
    expect(compareSlider()).toBeInTheDocument();
    expect(output()).toHaveTextContent("onTime");
    await expectNoAxeViolations(w.root);
  });

  it("moves with its own handle", async () => {
    const w = await openPreset("sixty-and-120");
    await press(w, compareSlider(), "{PageDown}");
    expect(
      screen.getByRole("textbox", { name: "Second late tolerance" }),
    ).toHaveValue(minutesToIso(110));
  });
});

describe("mountPunctualityBoard: NO SIGNAL", () => {
  it("PBR1: a weeks tolerance shows NO SIGNAL and why", async () => {
    const w = await openPreset("fifteen-minute");
    await enter(w, lateBox(), "P1W");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent(
      "The late tolerance is not an exact duration",
    );
    expect(rows()[0]).toHaveTextContent("NO SIGNAL");
    expect(screen.getByText(/no rate, late tolerance/)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("clears the reason once the tolerance is valid again", async () => {
    const w = await openPreset("fifteen-minute");
    await enter(w, lateBox(), "P1W");
    await enter(w, lateBox(), "PT15M");
    expect(reason()).not.toBeInTheDocument();
    expect(output()).toHaveTextContent("onTime: 4");
  });

  it("a zoneless arrival shows NO SIGNAL for the rate and names its row", async () => {
    await open({
      pairs: pairs(
        [at("09:00"), at("09:05")],
        [at("09:00"), "2024-06-14T09:15:00"],
      ),
      late: "PT15M",
    });
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent("Arrival 2's planned or actual");
    expect(rows()[1]).toHaveTextContent("NO SIGNAL");
    expect(rows()[0]).toHaveTextContent("+5 min");
  });

  it.each([
    ["2024-02-30T08:00:00+00:00[Europe/London]", "08:00"],
    ["2024-06-31T10:05:00+03:00[Europe/Helsinki]", "10:05"],
  ])(
    "an impossible zoned planned time (%s) is a NO SIGNAL row and the mount does not reject",
    async (planned, clock) => {
      await open({
        pairs: pairs([planned, at("09:05")], [at("09:00"), at("09:05")]),
        late: "PT15M",
      });
      expect(rows()[0]).toHaveTextContent("NO SIGNAL");
      expect(rows()[0]).toHaveTextContent(`${clock} → 09:05`);
      expect(rows()[1]).toHaveTextContent("+5 min");
      expect(output()).toHaveTextContent("NO SIGNAL");
      expect(reason()).toHaveTextContent("Arrival 1's planned or actual");
    },
  );

  it("an impossible zoned actual time in a seed does not throw either", async () => {
    await open({
      pairs: pairs([at("09:00"), "2024-02-30T08:00:00+00:00[Europe/London]"]),
      late: "PT15M",
    });
    expect(rows()[0]).toHaveTextContent("NO SIGNAL");
    expect(board()).toHaveAccessibleDescription(/NO SIGNAL/);
  });
});

describe("mountPunctualityBoard: seeds", () => {
  it("PBP: one row, +15 min, late, 0 of 1", async () => {
    await open({ pairs: pairs([at("09:00"), at("09:15")]), late: "PT15M" });
    expect(rows()).toHaveLength(1);
    readRow(0, "+15 min", "late");
    expect(output()).toHaveTextContent("{ onTime: 0, total: 1, rate: 0 }");
    expect(screen.getByText(/^0 of 1 on time/)).toBeInTheDocument();
    expect(presetBox()).toHaveValue("custom");
  });

  it("PB1e: the preset with a 10-minute early tolerance", async () => {
    await open({ preset: "fifteen-minute", early: "PT10M" });
    readRow(5, "−12 min", "early");
    expect(screen.getByText(/^3 of 6 on time/)).toBeInTheDocument();
  });

  it("a page seed writes the preset onto the controls", async () => {
    await open({ preset: "sixty-and-120" });
    expect(lateBox()).toHaveValue("PT60M");
    expect(presetBox()).toHaveValue("sixty-and-120");
    expect(output()).toHaveTextContent("onTime: 4");
  });
});

describe("mountPunctualityBoard: the rate summary", () => {
  it("speaks once, after the change settles", async () => {
    const w = await openPreset("fifteen-minute");
    const live = screen.getByRole("status", { name: "Rate summary" });
    expect(live).toHaveTextContent(/^$/);
    await press(
      w,
      lateSlider(),
      "{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}",
    );
    expect(live).not.toHaveTextContent("of 6 on time");
    await within(live).findByText(/of 6 on time/, undefined, { timeout: 2000 });
    expect(live).toHaveTextContent("PT20M");
  });

  it("drops a pending reading when destroyed", async () => {
    const w = await openPreset("fifteen-minute");
    const live = screen.getByRole("status", { name: "Rate summary" });
    await press(w, lateSlider(), "{ArrowRight}");
    w.destroy();
    await new Promise((r) => setTimeout(r, 800));
    expect(live).toHaveTextContent(/^$/);
  });
});

describe("mountPunctualityBoard: presets, permalinks and teardown", () => {
  it("a cleared late tolerance survives the permalink instead of restoring the preset's", async () => {
    const w = await openPreset("fifteen-minute");
    await w.user.clear(lateBox());
    const state = seedFromLocation(
      "punctuality",
      w.permalink().slice(w.permalink().indexOf("?")),
    );
    expect(state).toEqual({ preset: "fifteen-minute", late: "none" });
    w.destroy();
    await open(state ?? {});
    expect(lateBox()).toHaveValue("");
    expect(output()).toHaveTextContent("NO SIGNAL");
  });

  it("choosing a preset replaces the rows and the tolerance", async () => {
    const w = await openPreset("fifteen-minute");
    await w.user.selectOptions(presetBox(), "day-based");
    expect(lateBox()).toHaveValue("P1D");
    expect(earlySwitch()).toBeChecked();
    readRow(0, "−36 h", "early");
    expect(presetBox()).toHaveAccessibleDescription(/Singapore/);
    await expectNoAxeViolations(w.root);
  });

  it("round-trips the preset form through the permalink", async () => {
    const w = await openPreset("fifteen-minute");
    await w.user.click(earlySwitch());
    await enter(w, earlyBox(), "PT10M");
    const link = w.permalink();
    const seed = seedFromLocation("punctuality", link.slice(link.indexOf("?")));
    expect(seed).toEqual({ preset: "fifteen-minute", early: "PT10M" });
    w.destroy();
    await open(seed ?? {});
    readRow(5, "−12 min", "early");
  });

  it("round-trips the custom form through the permalink", async () => {
    const w = await open({
      pairs: pairs([at("09:00"), at("09:15")]),
      late: "PT15M",
    });
    await press(w, lateSlider(), "{ArrowRight}");
    const link = w.permalink();
    const seed = seedFromLocation("punctuality", link.slice(link.indexOf("?")));
    expect(seed).toMatchObject({ pairCount: "1", late: "PT16M" });
    w.destroy();
    await open(seed ?? {});
    readRow(0, "+15 min", "on time");
    expect(lateBox()).toHaveValue("PT16M");
  });

  it("is inert when aborted before the library loads", async () => {
    await renderWidget(entry, { args: {}, aborted: true });
    expect(lateBox()).toHaveValue("PT15M");
  });

  it("destroying twice does not throw", async () => {
    const w = await openPreset("fifteen-minute");
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
  });
});

describe("mountPunctualityBoard: the plates and the board", () => {
  it.each(Object.entries(PRESETS))(
    "%s reads its count in the plate",
    async (id, expected) => {
      await openPreset(id);
      const plate = screen.getAllByRole("figure", { hidden: true })[0]!;
      expect(plate).toHaveTextContent(expected.hero);
    },
  );

  it("hides the plates from assistive technology, so the rate lines carry the facts", async () => {
    await openPreset("fifteen-minute");
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    const plate = screen.getByRole("figure", { hidden: true });
    expect(plate).toHaveTextContent("late tolerance 15 min");
    expect(screen.getByText(/^4 of 6 on time/)).toBeInTheDocument();
  });

  it("the day-based plate names both edges", async () => {
    await openPreset("day-based");
    const plate = screen.getByRole("figure", { hidden: true });
    expect(plate).toHaveTextContent("late tolerance 24 h");
    expect(plate).toHaveTextContent("early 24 h");
  });

  it("a second plate appears only when two tolerances are compared", async () => {
    const w = await openPreset("fifteen-minute");
    expect(screen.getAllByRole("figure", { hidden: true })).toHaveLength(1);
    await w.user.click(compareSwitch());
    const plates = screen.getAllByRole("figure", { hidden: true });
    expect(plates).toHaveLength(2);
    expect(plates[1]).toHaveTextContent("second late tolerance");
  });

  it("the board's only controls are the named sliders", async () => {
    await openPreset("sixty-and-120");
    const inside = within(board()).getAllByRole("slider");
    expect(inside).toHaveLength(2);
    expect(within(board()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(board()).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("the second class shows on its own line only under compare", async () => {
    const w = await openPreset("fifteen-minute");
    expect(rows()[0]).not.toHaveTextContent("under");
    await w.user.click(compareSwitch());
    expect(rows()[0]).toHaveTextContent("under");
  });
});

describe("mountPunctualityBoard: observers", () => {
  it("destroy disconnects every ResizeObserver", async () => {
    const spy = spyOnResizeObservers();
    try {
      const w = await openPreset("fifteen-minute");
      expect(spy.live.size).toBeGreaterThan(0);
      w.destroy();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});
