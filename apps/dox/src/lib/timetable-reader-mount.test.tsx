/**
 * @vitest-environment jsdom
 *
 * The Timetable Reader widget end to end: template -> mount -> interact -> assert, against
 * the real `@northguild/gmt`, through roles and accessible names. Every preset's row 1 call
 * and result are section 9 rows.
 */
import { screen, waitFor, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { SKIPPED_OFFSET_TEXT, TIMETABLE_PRESETS } from "./timetable-reader";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showTimetableReader"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });
const openPreset = (id: string): Promise<RenderedWidget> => {
  const p = TIMETABLE_PRESETS.find((x) => x.id === id)!;
  return open({
    startTimeZone: p.startTimeZone,
    duration: p.duration,
    timeZone: p.timeZone,
    ...Object.fromEntries(
      p.rows.flatMap((r, i) => [
        [`departure${i + 1}`, r.departure],
        [`offset${i + 1}`, r.offset],
      ]),
    ),
  });
};

const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const durationBox = () => screen.getByRole("textbox", { name: "Run time" });
const rowSet = (n: number) => screen.getByRole("group", { name: `Row ${n}` });
const departure = (n: number) =>
  within(rowSet(n)).getByRole("textbox", { name: "Printed departure" });
const offset = (n: number) =>
  within(rowSet(n)).getByRole("combobox", { name: "Offset (optional)" });
const slider = (n: number) =>
  screen.getByRole("slider", { name: `Row ${n} printed time` });
const valueOf = (el: HTMLElement): number =>
  Number(el.getAttribute("aria-valuenow"));
const rowPick = () =>
  screen.getByRole("combobox", { name: "Show the call for" });
const callBox = () => screen.getByRole("group", { name: "The call made" });
const outputBox = () =>
  screen.getByRole("status", { name: "What scheduleDelivery returned" });
const chart = () => screen.getByRole("img", { name: /./ });
const rowsTable = () =>
  screen.getByRole("table", { name: "Printed times read as exact instants" });
// The table holds one row per filled printed time, after its header row.
const tableRow = (n: number) => within(rowsTable()).getAllByRole("row")[n]!;

async function enter(
  w: RenderedWidget,
  box: HTMLElement,
  text: string,
): Promise<void> {
  await w.user.clear(box);
  if (text !== "") await w.user.paste(text);
  box.blur();
}

const EXPECTED: Record<string, [string, string]> = {
  "fall-back": [
    '[{ departure: "2024-10-27T00:30:00", duration: "PT1H", timeZone: "Europe/London" }], { startTimeZone: "Europe/London" }',
    "2024-10-27T01:30:00+01:00[Europe/London]",
  ],
  "offset-picks": [
    '[{ departure: "2024-10-27T01:30:00", duration: "PT1H", timeZone: "Europe/London" }], { startTimeZone: "Europe/London" }',
    "2024-10-27T01:30:00+00:00[Europe/London]",
  ],
  "spring-forward": [
    '[{ departure: "2024-03-31T00:30:00", duration: "PT1H", timeZone: "Europe/London" }], { startTimeZone: "Europe/London" }',
    "2024-03-31T02:30:00+01:00[Europe/London]",
  ],
  "published-local": [
    '[{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "Asia/Tokyo" }',
    "2024-06-15T02:00:00+00:00[UTC]",
  ],
  "berlin-fall-back": [
    '[{ departure: "2024-10-27T02:30:00", duration: "PT1H", timeZone: "Europe/Amsterdam" }], { startTimeZone: "Europe/Berlin" }',
    "2024-10-27T02:30:00+01:00[Europe/Amsterdam]",
  ],
};

describe("the default template", () => {
  it("starts on London's fall-back night with the first preset", async () => {
    const w = await open();
    expect(presetBox()).toHaveValue("fall-back");
    expect(departure(1)).toHaveValue("2024-10-27T00:30:00");
    expect(departure(4)).toHaveValue("");
    expect(durationBox()).toHaveValue("PT1H");
    await expectNoAxeViolations(w.root);
  });

  it("names its three sections", async () => {
    await open();
    for (const name of [
      "1. The timetable",
      "2. What each printed time means",
      "3. What scheduleDelivery returns",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("describes the day, the chart and the rows", async () => {
    await open();
    expect(
      screen.getByText("Local day 2024-10-27 in Europe/London"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("01:00–02:00 happens twice").length,
    ).toBeGreaterThan(0);
    expect(chart()).toHaveAccessibleName(/./);
    expect(
      screen.getByText("Arrival times are in Europe/London."),
    ).toBeInTheDocument();
  });
});

describe.each(Object.keys(EXPECTED))("preset %s", (id) => {
  it("shows the call and the result for row 1", async () => {
    const w = await openPreset(id);
    expect(presetBox()).toHaveValue(id);
    expect(callBox()).toHaveTextContent(EXPECTED[id]![0]);
    expect(outputBox()).toHaveTextContent(EXPECTED[id]![1]);
    await expectNoAxeViolations(w.root);
  });

  it("round-trips through the permalink", async () => {
    const w = await openPreset(id);
    const link = w.permalink();
    const seed = seedFromLocation("timetable", link.slice(link.indexOf("?")));
    w.destroy();
    await open(seed ?? {});
    expect(presetBox()).toHaveValue(id);
    expect(callBox()).toHaveTextContent(EXPECTED[id]![0]);
  });
});

describe("choosing a preset", () => {
  it("fills every control from the preset", async () => {
    const w = await open();
    await w.user.selectOptions(presetBox(), "published-local");
    expect(departure(1)).toHaveValue("2024-06-15T10:00:00");
    expect(departure(2)).toHaveValue("");
    expect(durationBox()).toHaveValue("PT1H");
    expect(outputBox()).toHaveTextContent(EXPECTED["published-local"]![1]);
    await expectNoAxeViolations(w.root);
  });

  it("keeps row 2's +00:00 when offset-picks follows another preset", async () => {
    const w = await open();
    await w.user.selectOptions(presetBox(), "published-local");
    await w.user.selectOptions(presetBox(), "offset-picks");
    expect(offset(2)).toHaveValue("+00:00");
    expect(presetBox()).toHaveValue("offset-picks");
  });

  it("reads custom once a typed value leaves every preset", async () => {
    const w = await open();
    await enter(w, durationBox(), "PT2H");
    expect(presetBox()).toHaveValue("custom");
    await enter(w, durationBox(), "PT1H");
    expect(presetBox()).toHaveValue("fall-back");
  });
});

describe("the rows table", () => {
  it("reads each printed time as an exact instant", async () => {
    const w = await openPreset("fall-back");
    expect(tableRow(1)).toHaveTextContent("2024-10-27T00:30:00+01:00");
    expect(tableRow(2)).toHaveTextContent("Occurs twice");
    expect(tableRow(2)).toHaveTextContent("2024-10-27T01:30:00+01:00");
    expect(tableRow(3)).toHaveTextContent("2024-10-27T02:30:00+00:00");
    await expectNoAxeViolations(w.root);
  });

  it("flags a skipped hour and shows its row and the later one at one instant", async () => {
    await openPreset("spring-forward");
    expect(tableRow(2)).toHaveTextContent("Never shows on the clock");
    const leaves = (n: number) =>
      /2024-03-31T02:30:00\+01:00/.exec(tableRow(n).textContent ?? "")?.[0];
    expect(leaves(2)).toBeDefined();
    expect(leaves(2)).toBe(leaves(3));
  });

  it("notes a written offset", async () => {
    await openPreset("offset-picks");
    expect(tableRow(2)).toHaveTextContent("Offset written");
  });

  it("shows NO SIGNAL for a time the library cannot read", async () => {
    const w = await openPreset("fall-back");
    await enter(w, departure(4), "not a time");
    expect(within(tableRow(4)).getAllByText("NO SIGNAL")).toHaveLength(2);
    await enter(w, departure(4), "2024-10-27T03:30:00");
    expect(tableRow(4)).toHaveTextContent("2024-10-27T03:30:00+00:00");
  });
});

describe("the offset field", () => {
  const WHY: Record<string, string> = {
    once: "Happens once: nothing to choose.",
    blank: "Type a printed time first.",
    twice: "Happens twice: the offset picks the pass.",
    never: "Never shows: no offset makes it valid.",
  };

  it("is available only for a repeated hour, with its reason attached", async () => {
    await openPreset("fall-back");
    expect(offset(1)).toBeDisabled();
    expect(offset(1)).toHaveAccessibleDescription(WHY["once"]!);
    expect(offset(2)).toBeEnabled();
    expect(offset(2)).toHaveAccessibleDescription(WHY["twice"]!);
    expect(offset(4)).toBeDisabled();
    expect(offset(4)).toHaveAccessibleDescription(WHY["blank"]!);
  });

  it("says that a skipped hour has nothing to pick", async () => {
    await openPreset("spring-forward");
    expect(offset(2)).toHaveAccessibleDescription(WHY["never"]!);
  });

  it("picks the later pass of a repeated hour", async () => {
    const w = await openPreset("fall-back");
    await w.user.selectOptions(rowPick(), "1");
    await w.user.selectOptions(offset(2), "+00:00");
    expect(callBox()).toHaveTextContent("01:30:00+00:00[Europe/London]");
    expect(presetBox()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("keeps the offset when the time stays in the repeated hour", async () => {
    const w = await openPreset("offset-picks");
    await enter(w, departure(2), "2024-10-27T01:45:00");
    expect(offset(2)).toHaveValue("+00:00");
  });
});

describe("the call", () => {
  it("follows the row picked", async () => {
    const w = await openPreset("fall-back");
    await w.user.selectOptions(rowPick(), "2");
    expect(callBox()).toHaveTextContent("2024-10-27T02:30:00");
    await expectNoAxeViolations(w.root);
  });

  it("explains why a skipped offset is null", async () => {
    const w = await open({
      startTimeZone: "Europe/London",
      duration: "PT1H",
      timeZone: "Europe/London",
      departure1: "2024-03-31T00:30:00",
      departure2: "2024-03-31T01:30:00",
      offset2: "+00:00",
    });
    await w.user.selectOptions(rowPick(), "1");
    expect(outputBox()).toHaveTextContent("NO SIGNAL");
    expect(screen.getByText(SKIPPED_OFFSET_TEXT)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("a chat seed", () => {
  it("applies the flat form to the default template", async () => {
    await open({
      startTimeZone: "Europe/Helsinki",
      duration: "PT2H",
      timeZone: "Europe/Helsinki",
      departure1: "2024-10-27T03:30:00",
    });
    expect(screen.getByRole("combobox", { name: "Printed in" })).toHaveValue(
      "Europe/Helsinki",
    );
    expect(durationBox()).toHaveValue("PT2H");
    expect(departure(1)).toHaveValue("2024-10-27T03:30:00");
    expect(presetBox()).toHaveValue("custom");
  });
});

describe("the day track", () => {
  it("names the handle of each row that has a time", async () => {
    await openPreset("fall-back");
    expect(valueOf(slider(1))).toBe(30);
    expect(valueOf(slider(2))).toBe(90);
    expect(slider(2)).toHaveAttribute(
      "aria-valuetext",
      "01:30, happens twice, read as the earlier pass",
    );
  });

  it("reads a skipped time on its handle", async () => {
    await openPreset("spring-forward");
    expect(slider(2)).toHaveAttribute(
      "aria-valuetext",
      "01:30, never shows on the clock, read as 02:30",
    );
  });

  it("has no handle for a row that has no time", async () => {
    await openPreset("fall-back");
    expect(
      screen.queryByRole("slider", { name: "Row 4 printed time" }),
    ).not.toBeInTheDocument();
  });

  it("moves the printed time by keyboard and flips the preset to custom", async () => {
    const w = await openPreset("fall-back");
    slider(1).focus();
    await w.user.keyboard("{ArrowRight}");
    expect(departure(1)).toHaveValue("2024-10-27T00:35:00");
    expect(presetBox()).toHaveValue("custom");
    await w.user.keyboard("{PageUp}");
    expect(departure(1)).toHaveValue("2024-10-27T01:35:00");
    await w.user.keyboard("{End}");
    expect(departure(1)).toHaveValue("2024-10-27T23:55:00");
    await w.user.keyboard("{Home}");
    expect(departure(1)).toHaveValue("2024-10-27T00:00:00");
    await expectNoAxeViolations(w.root);
  });

  it("returns the preset when the handle returns to its time", async () => {
    const w = await openPreset("fall-back");
    slider(1).focus();
    await w.user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(presetBox()).toHaveValue("fall-back");
  });

  it("follows a typed time", async () => {
    const w = await openPreset("fall-back");
    await enter(w, departure(4), "2024-10-27T03:15:00");
    expect(valueOf(slider(4))).toBe(195);
    await enter(w, departure(4), "2024-11-27T03:15:00");
    expect(
      screen.queryByRole("slider", { name: "Row 4 printed time" }),
    ).not.toBeInTheDocument();
  });

  it("steps from a time that is not a multiple of five to the next one", async () => {
    const w = await open({ departure1: "2024-10-27T01:32:00" });
    slider(1).focus();
    await w.user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(departure(1)).toHaveValue("2024-10-27T01:35:00"),
    );
  });

  it("keeps the offset when the handle moves through the repeated hour", async () => {
    const w = await openPreset("offset-picks");
    slider(2).focus();
    await w.user.keyboard("{ArrowRight}");
    expect(offset(2)).toHaveValue("+00:00");
  });

  it("fixes the offset-written row with a one-hour step", async () => {
    const w = await openPreset("offset-picks");
    slider(2).focus();
    await w.user.keyboard("{PageDown}");
    expect(departure(2)).toHaveValue("2024-10-27T00:30:00");
  });

  it("keeps the handles in the tab order and the chart out of it", async () => {
    await openPreset("fall-back");
    expect(chart()).not.toHaveAttribute("tabindex");
    for (const n of [1, 2, 3])
      expect(slider(n)).toHaveAttribute("tabindex", "0");
  });

  it("names the day and the band", async () => {
    const w = await openPreset("spring-forward");
    expect(
      screen.getAllByText("01:00–02:00 never shows").length,
    ).toBeGreaterThan(0);
    await enter(w, departure(1), "2024-06-15T10:00:00");
    expect(
      screen.getAllByText("No clock change this day").length,
    ).toBeGreaterThan(0);
  });

  it("asks for a time when every row is empty", async () => {
    const w = await openPreset("published-local");
    await enter(w, departure(1), "");
    expect(
      screen.getByText("Type a printed departure in a row to draw its day."),
    ).toBeInTheDocument();
    expect(chart()).toHaveAccessibleName(
      "Type a printed departure in a row to draw the two clocks.",
    );
    await expectNoAxeViolations(w.root);
  });
});

// One pixel is one minute: the day's track is 1440 px wide and starts at the viewport's left.
function stubTrackWidth(): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 1440,
    width: 1440,
    top: 0,
    bottom: 28,
    height: 28,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}
const emptyLaneTag = () => screen.getByText("4 \u00b7 click to add");
const press = (clientX: number) =>
  ({
    keys: "[MouseLeft>]",
    target: emptyLaneTag(),
    coords: { clientX },
  }) as const;

describe("an empty lane", () => {
  afterEach(() => vi.restoreAllMocks());

  it("takes a time where its tag is clicked", async () => {
    const w = await openPreset("fall-back");
    stubTrackWidth();
    await w.user.pointer({
      keys: "[MouseLeft]",
      target: emptyLaneTag(),
      coords: { clientX: 600 },
    });
    expect(departure(4)).toHaveValue("2024-10-27T10:00:00");
  });

  it("takes a time where its tag is pressed", async () => {
    const w = await openPreset("fall-back");
    stubTrackWidth();
    expect(departure(4)).toHaveValue("");
    await w.user.pointer([press(720), { keys: "[/MouseLeft]" }]);
    expect(departure(4)).toHaveValue("2024-10-27T12:00:00");
    expect(valueOf(slider(4))).toBe(720);
  });

  it("follows the pointer while it stays down, and stops when it comes up", async () => {
    const w = await openPreset("fall-back");
    stubTrackWidth();
    await w.user.pointer([press(720), { coords: { clientX: 900 } }]);
    expect(departure(4)).toHaveValue("2024-10-27T15:00:00");
    await w.user.pointer([{ keys: "[/MouseLeft]" }]);
    await w.user.pointer({ coords: { clientX: 300 } });
    expect(departure(4)).toHaveValue("2024-10-27T15:00:00");
  });

  it("flips the preset to custom once it takes a time", async () => {
    const w = await openPreset("fall-back");
    stubTrackWidth();
    await w.user.pointer([press(720), { keys: "[/MouseLeft]" }]);
    expect(presetBox()).toHaveValue("custom");
  });

  it("is not changed by a press on a lane that has a time, away from its handle", async () => {
    const w = await openPreset("fall-back");
    stubTrackWidth();
    const rowOneTag = screen.getByText(/^1 \u00b7 00:30/);
    await w.user.pointer([
      { keys: "[MouseLeft>]", target: rowOneTag, coords: { clientX: 900 } },
      { coords: { clientX: 1000 } },
      { keys: "[/MouseLeft]" },
    ]);
    expect(departure(1)).toHaveValue("2024-10-27T00:30:00");
  });
});

describe("the chart", () => {
  it("summarises the rows in its name", async () => {
    await openPreset("fall-back");
    expect(chart()).toHaveAccessibleName(/01:30/);
  });

  it("names the printed zone when it differs from the arrival zone", async () => {
    await openPreset("berlin-fall-back");
    expect(
      screen.getByText(/The timetable is printed in Europe\/Berlin\./),
    ).toBeInTheDocument();
  });
});

describe("lifecycle", () => {
  it("does nothing when aborted before it starts", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(departure(1)).toHaveValue("2024-10-27T00:30:00");
    w.destroy();
  });

  it("is safe to destroy twice", async () => {
    const w = await open();
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
  });
});
