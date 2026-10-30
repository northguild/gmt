/**
 * @vitest-environment jsdom
 *
 * The B/L Date Stamp end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through the roles and accessible names a reader meets. Every
 * preset's printed calls and results are checked against the literal strings the library
 * returns, the lit day of each lane against the library's date, and the slider against
 * the window it must not move, so a drift in the library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import {
  resolveWidget,
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
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import { BL_DATE_PRESETS, SLIDER_MAX } from "./bl-date-stamp";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showBlDateStamp"] as AnyWidgetEntry;

const VALUE = "2024-06-16T01:00:00Z";
const NO_SIGNAL = "NO SIGNAL";

const bol = (value: string, event: string, zone: string | null) =>
  zone === null
    ? `bolTimestamp("${value}", "${event}")`
    : `bolTimestamp("${value}", "${event}", { timeZone: "${zone}" })`;

interface Expected {
  /** The printed calls, one a line. */
  copy: string;
  /** The output, or "NO SIGNAL". */
  output: string;
  /** The B/L plate: value, then its two sub lines. */
  bl: [string, string, string];
  /** The UTC plate: value, then its two sub lines. */
  utc: [string, string, string];
  /** The lit date of each lane, UTC first; `""` for a lane with nothing lit. */
  lit: string[];
}

/** What each preset prints, from a run against `packages/gmt/dist`. */
const EXPECTED: Record<string, Expected> = {
  "sao-paulo-evening": {
    copy: [
      bol(VALUE, "shippedOnBoard", "America/Sao_Paulo"),
      bol(VALUE, "shippedOnBoard", "UTC"),
      bol(VALUE, "shippedOnBoard", "Asia/Shanghai"),
      'areDatesEqual("2024-06-16", "2024-06-15")',
      'isAfterDate("2024-06-16", "2024-06-15")',
    ].join("\n"),
    output: [
      '"2024-06-15"',
      '"2024-06-16"',
      '"2024-06-16"',
      "false",
      "true",
    ].join("\n"),
    bl: ["Sat 15 Jun 2024", "22:00 in America/Sao_Paulo", ""],
    utc: ["Sun 16 Jun 2024", "one day later", ""],
    lit: ["2024-06-16", "2024-06-15", "2024-06-16", "", ""],
  },
  "shanghai-morning": {
    copy: [
      bol("2024-06-14T23:00:00Z", "shippedOnBoard", "Asia/Shanghai"),
      bol("2024-06-14T23:00:00Z", "shippedOnBoard", "UTC"),
      'areDatesEqual("2024-06-14", "2024-06-15")',
      'isAfterDate("2024-06-14", "2024-06-15")',
    ].join("\n"),
    output: ['"2024-06-15"', '"2024-06-14"', "false", "false"].join("\n"),
    bl: ["Sat 15 Jun 2024", "07:00 in Asia/Shanghai", ""],
    utc: ["Fri 14 Jun 2024", "one day earlier", ""],
    lit: ["2024-06-14", "2024-06-15", "", "", ""],
  },
  "rotterdam-fall-back": {
    copy: [
      bol("2024-10-27T00:30:00Z", "received", "Europe/Amsterdam"),
      bol("2024-10-27T00:30:00Z", "received", "UTC"),
      'areDatesEqual("2024-10-27", "2024-10-27")',
      'isAfterDate("2024-10-27", "2024-10-27")',
    ].join("\n"),
    output: ['"2024-10-27"', '"2024-10-27"', "true", "false"].join("\n"),
    bl: ["Sun 27 Oct 2024", "02:30 in Europe/Amsterdam", ""],
    utc: ["Sun 27 Oct 2024", "same date", ""],
    lit: ["2024-10-27", "2024-10-27", "", "", ""],
  },
  "apia-deleted-day": {
    copy: [
      bol("2011-12-30T10:00:00Z", "shippedOnBoard", "Pacific/Apia"),
      bol("2011-12-30T10:00:00Z", "shippedOnBoard", "UTC"),
      'areDatesEqual("2011-12-30", "2011-12-31")',
      'isAfterDate("2011-12-30", "2011-12-31")',
    ].join("\n"),
    output: ['"2011-12-31"', '"2011-12-30"', "false", "false"].join("\n"),
    bl: ["Sat 31 Dec 2011", "00:00 in Pacific/Apia", ""],
    utc: ["Fri 30 Dec 2011", "one day earlier", ""],
    lit: ["2011-12-30", "2011-12-31", "", "", ""],
  },
  "fixed-offset": {
    copy: [
      bol(VALUE, "shippedOnBoard", "+08:00"),
      bol(VALUE, "shippedOnBoard", "UTC"),
      'areDatesEqual("2024-06-16", "2024-06-16")',
      'isAfterDate("2024-06-16", "2024-06-16")',
    ].join("\n"),
    output: ['"2024-06-16"', '"2024-06-16"', "true", "false"].join("\n"),
    bl: ["Sun 16 Jun 2024", "09:00 in +08:00", ""],
    utc: ["Sun 16 Jun 2024", "same date", ""],
    lit: ["2024-06-16", "2024-06-16", "", "", ""],
  },
  "no-zone": {
    copy: [
      bol(VALUE, "shippedOnBoard", null),
      bol(VALUE, "shippedOnBoard", "UTC"),
    ].join("\n"),
    output: NO_SIGNAL,
    bl: ["no result", "", ""],
    utc: ["Sun 16 Jun 2024", "", ""],
    lit: ["2024-06-16", "", "", "", ""],
  },
};

const open = (args: Record<string, unknown> = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const moment = () => screen.getByRole("textbox", { name: "Moment" });
const event = () => screen.getByRole("combobox", { name: "Event" });
const place = () =>
  screen.getByRole("combobox", { name: "Place of the event" });
const calendar = (n: 2 | 3 | 4) =>
  screen.getByRole("combobox", { name: `Calendar ${n} (optional)` });
const latest = () => screen.getByLabelText("Latest date allowed (optional)");
const slider = () =>
  screen.getByRole("slider", { name: "Move the moment" }) as HTMLInputElement;
const output = () =>
  screen.getByRole("status", { name: "What bolTimestamp returned" });
const call = () => screen.getByRole("group", { name: "Call to bolTimestamp" });
const summary = () => screen.getByRole("status", { name: "Reading summary" });
const reason = () => screen.queryByRole("complementary", { name: "No result" });

/** The plates' definitions, in reading order: B/L value and lines, then UTC's. */
const definitions = () => screen.getAllByRole("definition");
const plate = (which: "bl" | "utc") =>
  definitions().slice(which === "bl" ? 0 : 3, which === "bl" ? 3 : 6);
const exactly = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

function expectPlate(which: "bl" | "utc", want: [string, string, string]) {
  const [value, line1, line2] = plate(which);
  // The value cell also holds a hidden sample that keeps its width.
  expect(value).toHaveTextContent(want[0]);
  for (const [cell, text] of [
    [line1, want[1]],
    [line2, want[2]],
  ] as const) {
    if (text === "") expect(cell).toHaveTextContent(/^$/);
    else expect(cell).toHaveTextContent(exactly(text));
  }
}

/** The lanes, in order: UTC, the place, then calendars 2, 3 and 4. */
const lanes = () =>
  within(screen.getByRole("list", { name: "Calendars, one lane each" }))
    .getAllByRole("listitem")
    .filter(
      (item) =>
        within(item).queryByRole("list", { name: "Local days" }) !== null,
    );
const dayColumns = (lane: number) =>
  within(
    screen.getAllByRole("list", { name: "Local days" })[lane]!,
  ).queryAllByRole("listitem");
const nameOf = (el: HTMLElement) => el.getAttribute("aria-label") ?? "";
/** The dates a lane draws, from the column names (`15 Jun Sat`, lit ones add `, 2024-06-15`). */
const columnNames = (lane: number) => dayColumns(lane).map(nameOf);
const lit = (lane: number) =>
  columnNames(lane)
    .map((n) => /, (\d{4}-\d\d-\d\d)$/.exec(n)?.[1])
    .filter((d): d is string => d !== undefined)
    .join(",");
const laneName = (lane: number) => nameOf(lanes()[lane]!);

async function enter(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}
const choose = (w: RenderedWidget, box: HTMLElement, value: string) =>
  w.user.selectOptions(box, value);

afterEach(() => {
  vi.useRealTimers();
});

describe("renderBlDateStampTemplate", () => {
  it("is a named region with three numbered sections and named controls", async () => {
    const w = await open();
    expect(
      screen.getByRole("region", { name: "B/L Date Stamp" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Set the moment and the place",
      "2. The date in each place",
      "3. What bolTimestamp returns",
    ]);
    for (const c of [
      preset(),
      moment(),
      event(),
      place(),
      slider(),
      latest(),
    ]) {
      expect(c).toBeInTheDocument();
    }
    for (const n of [2, 3, 4] as const) expect(calendar(n)).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("draws five lanes: UTC hollow first, then the place and three calendars", async () => {
    await open();
    expect(lanes()).toHaveLength(5);
    expect(screen.getAllByRole("list", { name: "Local days" })).toHaveLength(5);
    // Before the library answers a plate would read "no result"; this one has.
    expect(plate("bl")[0]).not.toHaveTextContent("no result");
  });

  it("opens on the first preset's controls, with a native slider and a date input", async () => {
    await open();
    expect(moment()).toHaveValue(VALUE);
    expect(moment()).toHaveAttribute("maxlength", "64");
    expect(event()).toHaveValue("shippedOnBoard");
    expect(place()).toHaveValue("America/Sao_Paulo");
    expect(calendar(2)).toHaveValue("Asia/Shanghai");
    expect(slider()).toHaveAttribute("min", "0");
    expect(slider()).toHaveAttribute("max", String(SLIDER_MAX));
    expect(slider()).toHaveAttribute("step", "1");
    expect(latest()).toHaveAttribute("type", "date");
  });

  it("labels the three events with the field each fills", async () => {
    await open();
    expect(
      within(event())
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "Shipped on board (shippedOnBoardDate)",
      "Received for shipment (receivedForShipmentDate)",
      "Issue (issueDate)",
    ]);
  });

  it("offers 'No zone', the transport zones and the offsets for the place", async () => {
    await open();
    const options = within(place())
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(options[0]).toBe("");
    expect(options).toContain("Europe/Amsterdam");
    expect(options).toContain("+08:00");
    expect(options).toContain("-05:00");
    expect(new Set(options).size).toBe(options.length);
  });

  it("adds a seed the lists lack as its own option and never replaces it", async () => {
    await open({
      value: VALUE,
      event: "loaded",
      timeZone: "Pacific/Chatham",
      zone2: "+05:45",
    });
    expect(event()).toHaveValue("loaded");
    expect(place()).toHaveValue("Pacific/Chatham");
    expect(calendar(2)).toHaveValue("+05:45");
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      BL_DATE_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
    "%s prints the calls made and the results the library returned",
    async (id) => {
      const w = await open();
      await choose(w, preset(), id!);
      const want = EXPECTED[id!]!;
      for (const line of want.copy.split("\n")) {
        expect(call()).toHaveTextContent(line, { normalizeWhitespace: true });
      }
      if (want.output === NO_SIGNAL) {
        expect(output()).toHaveTextContent(exactly(NO_SIGNAL));
      } else {
        expect(output()).not.toHaveTextContent(NO_SIGNAL);
        expect(output()).toHaveTextContent(want.output.replaceAll("\n", " "), {
          normalizeWhitespace: true,
        });
      }
      expectPlate("bl", want.bl);
      expectPlate("utc", want.utc);
      await expectNoAxeViolations(w.root);
    },
  );

  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
    "%s lights the library's date in each lane",
    async (id) => {
      const w = await open();
      await choose(w, preset(), id!);
      const want = EXPECTED[id!]!;
      for (let lane = 0; lane < 5; lane++) {
        expect(lit(lane), `lane ${lane}`).toBe(want.lit[lane]);
      }
    },
  );

  it("opens on the first preset", async () => {
    await open();
    expect(preset()).toHaveValue("sao-paulo-evening");
    expect(output()).toHaveTextContent('"2024-06-15"');
    expect(preset()).toHaveAccessibleDescription(
      BL_DATE_PRESETS[0]!.description,
    );
  });

  it("shows two calendars on the first paint: the place, UTC and Shanghai", async () => {
    await open();
    expect(laneName(0)).toBe("UTC (naive): Sun 16 Jun 2024");
    expect(laneName(1)).toBe("America/Sao_Paulo: Sat 15 Jun 2024");
    expect(laneName(2)).toBe("Asia/Shanghai: Sun 16 Jun 2024");
    expect(laneName(3)).toBe("Calendar 3: no zone chosen");
    expect(laneName(4)).toBe("Calendar 4: no zone chosen");
  });

  it("chips the gate with the moment in UTC and numbers the lanes", async () => {
    await open();
    expect(screen.getByText("01:00Z")).toBeInTheDocument();
    [1, 2, 3, 4].forEach((n) => {
      expect(within(lanes()[n]!).getByText(String(n))).toBeInTheDocument();
    });
  });

  it("draws the Rotterdam day as 25 hours and Apia without its 30th", async () => {
    const w = await open();
    await choose(w, preset(), "rotterdam-fall-back");
    expect(columnNames(1).some((n) => n.includes("25 hours"))).toBe(true);
    expect(screen.getByText("25 h")).toBeInTheDocument();
    await choose(w, preset(), "apia-deleted-day");
    const apia = columnNames(1).join("|");
    expect(apia).toContain("29 Dec");
    expect(apia).toContain("31 Dec");
    expect(apia).not.toContain("30 Dec");
    expect(columnNames(0).join("|")).toContain("30 Dec");
  });
});

describe("the slider", () => {
  it("moves the moment in 15-minute steps and writes it in the form it was typed", async () => {
    await open();
    // 01:00Z on 16 June is 34 hours into a window that starts at 15:00Z on 14 June.
    expect(slider()).toHaveValue("136");
    expect(slider()).toHaveAttribute("aria-valuetext", "Sun 16 Jun 01:00Z");
    setRange(slider(), 137);
    expect(moment()).toHaveValue("2024-06-16T01:15:00Z");
    expect(slider()).toHaveAttribute("aria-valuetext", "Sun 16 Jun 01:15Z");
    expect(screen.getByText("01:15Z")).toBeInTheDocument();
  });

  it("keeps a zoned moment zoned, and an offset moment on its offset", async () => {
    const zoned = await open({
      value: "2024-06-16T09:00:00+08:00[Asia/Shanghai]",
      event: "shippedOnBoard",
      timeZone: "Asia/Shanghai",
    });
    setRange(slider(), Number(slider().value) + 1);
    expect(moment()).toHaveValue("2024-06-16T09:15:00+08:00[Asia/Shanghai]");
    zoned.destroy();
    await open(
      {
        value: "2024-06-16T09:00:00+08:00",
        event: "shippedOnBoard",
        timeZone: "Asia/Shanghai",
      },
      "second",
    );
    setRange(slider(), Number(slider().value) + 4);
    expect(moment()).toHaveValue("2024-06-16T10:00:00+08:00");
  });

  it("changes the date when the moment crosses the place's midnight, and in no other lane at the same time", async () => {
    await open();
    expect(lit(1)).toBe("2024-06-15");
    // The window is centred on midnight in São Paulo, 03:00Z: position 144.
    setRange(slider(), 143);
    expect(moment()).toHaveValue("2024-06-16T02:45:00Z");
    expect(lit(1)).toBe("2024-06-15");
    setRange(slider(), 144);
    expect(moment()).toHaveValue("2024-06-16T03:00:00Z");
    expect(lit(1)).toBe("2024-06-16");
    expectPlate("bl", ["Sun 16 Jun 2024", "00:00 in America/Sao_Paulo", ""]);
    expect(plate("utc")[1]).toHaveTextContent(exactly("same date"));
    expect(lit(0)).toBe("2024-06-16");
    expect(lit(2)).toBe("2024-06-16");
  });

  it("does not move the window while it moves: the day columns keep their places", async () => {
    await open();
    const before = [0, 1, 2].map(columnNames);
    for (const position of [0, 50, 144, 200, SLIDER_MAX, 132]) {
      setRange(slider(), position);
    }
    // The moment is back at 33 hours in; the same days are drawn, in the same order.
    expect(
      [0, 1, 2].map((lane) => columnNames(lane).map((n) => n.split(",")[0])),
    ).toEqual(before.map((names) => names.map((n) => n.split(",")[0])));
    expect(slider()).toHaveValue("132");
  });

  it("sets the window again when a typed value, a zone or a preset settles", async () => {
    const w = await open();
    expect(slider()).toHaveValue("136");
    await enter(w, moment(), "2024-06-20T12:00:00Z");
    // 12:00Z is 09:00 in São Paulo, 45 hours into a window that starts at 15:00Z
    // on 18 June.
    expect(slider()).toHaveValue("180");
    await choose(w, place(), "Asia/Shanghai");
    expect(slider()).not.toHaveValue("180");
    await choose(w, preset(), "sao-paulo-evening");
    expect(slider()).toHaveValue("136");
  });

  it("keeps the window when the event, a calendar or the latest date changes", async () => {
    const w = await open();
    setRange(slider(), 140);
    const before = columnNames(1);
    await choose(w, event(), "issue");
    await choose(w, calendar(3), "Europe/Amsterdam");
    await w.user.type(latest(), "2024-06-15");
    expect(slider()).toHaveValue("140");
    expect(columnNames(1)).toEqual(before);
  });

  it("makes the state custom and empties the description", async () => {
    await open();
    expect(preset()).toHaveValue("sao-paulo-evening");
    setRange(slider(), 140);
    expect(preset()).toHaveValue("custom");
    expect(preset()).not.toHaveAccessibleDescription(
      BL_DATE_PRESETS[0]!.description,
    );
  });

  it("is disabled, and says so, when the value is not a moment it can write back", async () => {
    const w = await open();
    await enter(w, moment(), "2024-06-16T01:00:00");
    expect(slider()).toBeDisabled();
    expect(slider()).toHaveAttribute("aria-valuetext", "no moment");
    expect(dayColumns(1)).toEqual([]);
    expect(output()).toHaveTextContent(NO_SIGNAL);
    await expectNoAxeViolations(w.root);
    await enter(w, moment(), VALUE);
    expect(slider()).toBeEnabled();
    expect(dayColumns(1).length).toBeGreaterThan(0);
  });

  it("reads the new moment out once the slider has been still, and a typed change at once", async () => {
    const w = await open();
    const first =
      "Shipped on board date: Sat 15 Jun 2024, 22:00 in America/Sao_Paulo. UTC date: Sun 16 Jun 2024, one day later.";
    expect(summary()).toHaveTextContent(first);
    vi.useFakeTimers();
    setRange(slider(), 144);
    setRange(slider(), 145);
    expect(summary()).toHaveTextContent(first);
    vi.advanceTimersByTime(499);
    expect(summary()).toHaveTextContent(first);
    vi.advanceTimersByTime(1);
    expect(summary()).toHaveTextContent(
      "Shipped on board date: Sun 16 Jun 2024, 00:15 in America/Sao_Paulo. UTC date: Sun 16 Jun 2024, same date.",
    );
    expect(summary()).toHaveAttribute("role", "status");
    vi.useRealTimers();
    await choose(w, preset(), "shanghai-morning");
    expect(summary()).toHaveTextContent("Fri 14 Jun 2024, one day earlier");
  });
});

describe("the options", () => {
  it("compares both dates against the latest date allowed", async () => {
    const w = await open();
    await w.user.type(latest(), "2024-06-15");
    expectPlate("bl", [
      "Sat 15 Jun 2024",
      "22:00 in America/Sao_Paulo",
      "on or before the latest date",
    ]);
    expectPlate("utc", [
      "Sun 16 Jun 2024",
      "one day later",
      "after the latest date",
    ]);
    expect(output()).toHaveTextContent(/true false true$/, {
      normalizeWhitespace: true,
    });
    await w.user.clear(latest());
    expect(plate("bl")[2]).toHaveTextContent(/^$/);
    await expectNoAxeViolations(w.root);
  });

  it("says a latest date that is not a date makes no comparison, even when the date input refuses it", async () => {
    const w = await open({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "America/Sao_Paulo",
      latest: "2024-02-30",
    });
    expect(latest()).toHaveValue("");
    expect(plate("bl")[2]).toHaveTextContent("latest date is not a date");
    expect(plate("utc")[2]).toHaveTextContent("latest date is not a date");
    expect(output()).not.toHaveTextContent("true true");
    expect(
      (decodeURIComponent(w.permalink()) as string).includes("2024-02-30"),
    ).toBe(true);
    await w.user.type(latest(), "2024-06-15");
    expect(plate("bl")[2]).toHaveTextContent("on or before the latest date");
  });

  it("changes the caption with the event, and reaches the library with the event as given", async () => {
    const w = await open();
    await choose(w, event(), "received");
    expect(screen.getAllByRole("term")[0]).toHaveTextContent(
      "Received for shipment date",
    );
    expect(call()).toHaveTextContent('"received"');
    await choose(w, event(), "issue");
    expect(screen.getAllByRole("term")[0]).toHaveTextContent("Issue date");
  });

  it("adds a calendar in its own lane and lights its date", async () => {
    const w = await open();
    await choose(w, calendar(3), "Europe/Amsterdam");
    expect(laneName(3)).toBe("Europe/Amsterdam: Sun 16 Jun 2024");
    expect(lit(3)).toBe("2024-06-16");
    expect(call()).toHaveTextContent('{ timeZone: "Europe/Amsterdam" }');
  });

  it("leaves a blank calendar out of the call", async () => {
    const w = await open();
    await choose(w, calendar(2), "");
    expect(call()).not.toHaveTextContent("Asia/Shanghai");
    expect(call()).toHaveTextContent('"UTC"');
  });
});

describe("NO SIGNAL", () => {
  it("asks for a place when there is none", async () => {
    const w = await open();
    await choose(w, preset(), "no-zone");
    expect(output()).toHaveTextContent(NO_SIGNAL);
    expect(reason()).toHaveTextContent(
      "Choose the place of the event. Every bill of lading date is the local one, so the zone is required.",
    );
    expect(lit(1)).toBe("");
    expect(laneName(1)).toBe("Place of the event: no zone chosen");
    await expectNoAxeViolations(w.root);
  });

  it("says in the lane why it draws nothing: no zone, or no date from the library", async () => {
    const w = await open();
    await choose(w, preset(), "no-zone");
    expect(within(lanes()[1]!).getByText("no zone chosen")).toBeVisible();
    await choose(w, place(), "Asia/Shanghai");
    expect(
      within(lanes()[1]!).queryByText("no zone chosen"),
    ).not.toBeInTheDocument();
  });

  it("names a place the library cannot read in its lane as no date", async () => {
    await open({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "Mars/Base",
    });
    expect(
      within(lanes()[1]!).getByText("the library returned no date"),
    ).toBeVisible();
  });

  it("hides the gate chip while there is no moment, and shows it again for one", async () => {
    const w = await open();
    expect(screen.getByText("01:00Z")).toBeVisible();
    await enter(w, moment(), "2024-06-16");
    expect(screen.queryByText("01:00Z")).not.toBeVisible();
    await enter(w, moment(), VALUE);
    expect(screen.getByText("01:00Z")).toBeVisible();
  });

  it("clears the reason when a date comes back", async () => {
    const w = await open();
    await choose(w, preset(), "no-zone");
    await choose(w, place(), "Asia/Shanghai");
    expect(reason()).not.toBeInTheDocument();
    expect(output()).not.toHaveTextContent(NO_SIGNAL);
  });

  it("says when the value is not a moment", async () => {
    const w = await open();
    await enter(w, moment(), "2024-06-16");
    expect(reason()).toHaveTextContent("The value is not a moment.");
    expect(plate("bl")[0]).toHaveTextContent("no result");
    expect(plate("utc")[0]).toHaveTextContent("no result");
  });

  it("shows a chat seed with a zone the library cannot read as NO SIGNAL with its reason, and mounts", async () => {
    await open({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "Mars/Base",
    });
    expect(place()).toHaveValue("Mars/Base");
    expect(output()).toHaveTextContent(exactly(NO_SIGNAL));
    expect(reason()).toHaveTextContent(
      "The library does not read Mars/Base as a place.",
    );
    expect(plate("bl")[0]).toHaveTextContent("no result");
    expect(plate("utc")[0]).toHaveTextContent("Sun 16 Jun 2024");
    expect(laneName(1)).toBe("Mars/Base: no date");
  });

  it("accepts a chat seed that names a UTC offset as the place and as a calendar", async () => {
    await open({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "-05:00",
      zone2: "+08:00",
      zone3: "+05:45",
    });
    expect(output()).not.toHaveTextContent(NO_SIGNAL);
    expectPlate("bl", ["Sat 15 Jun 2024", "20:00 in -05:00", ""]);
    expect(lit(1)).toBe("2024-06-15");
    expect(lit(2)).toBe("2024-06-16");
    expect(lit(3)).toBe("2024-06-16");
  });

  it("shows a calendar the library does not read in its own lane, and keeps the answer", async () => {
    await open({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "America/Sao_Paulo",
      zone2: "Mars/Base",
    });
    expect(output()).not.toHaveTextContent(NO_SIGNAL);
    expect(laneName(2)).toBe("Mars/Base: no date");
    expect(lit(1)).toBe("2024-06-15");
    expect(plate("bl")[0]).toHaveTextContent("Sat 15 Jun 2024");
  });

  it("says when a zone is read but its days cannot be drawn, and shows the library's date", async () => {
    await open({
      value: VALUE,
      event: "shippedOnBoard",
      timeZone: "America/Sao_Paulo",
      zone2: "+08:00:30",
    });
    expect(dayColumns(2)).toEqual([]);
    expect(laneName(2)).toBe("+08:00:30: Sun 16 Jun 2024");
    expect(lanes()[2]).toHaveTextContent("2024-06-16 · its days are not drawn");
  });

  it("names an event that is not one of the three", async () => {
    await open({
      value: VALUE,
      event: "loaded",
      timeZone: "America/Sao_Paulo",
    });
    expect(event()).toHaveValue("loaded");
    expect(output()).toHaveTextContent(NO_SIGNAL);
    expect(reason()).toHaveTextContent("loaded is not one of the three events");
    expect(screen.getAllByRole("term")[0]).toHaveTextContent("B/L date");
  });

  it("does not guess a place or an event for a seed that names neither", async () => {
    await open({ value: VALUE });
    expect(place()).toHaveValue("");
    expect(event()).toHaveValue("");
    expect(output()).toHaveTextContent(NO_SIGNAL);
  });
});

describe("the chat registration", () => {
  const base = { value: VALUE, event: "shippedOnBoard" };

  it("accepts a zone the library cannot read, and a UTC offset, and does not validate either", async () => {
    for (const timeZone of [
      "Mars/Base",
      "+08:00",
      "-05:00",
      "Etc/GMT+8",
      "+08:00:30",
    ]) {
      const resolved = resolveWidget("showBlDateStamp", { ...base, timeZone });
      expect(resolved.ok, timeZone).toBe(true);
      if (!resolved.ok) continue;
      expect(
        await resolved.entry.validate?.(resolved.args),
        timeZone,
      ).toBeFalsy();
    }
    const calendars = resolveWidget("showBlDateStamp", {
      ...base,
      timeZone: "America/Sao_Paulo",
      zone2: "Mars/Base",
      zone3: "+05:45",
      zone4: "Asia/Shanghai",
    });
    expect(calendars.ok).toBe(true);
  });

  it("refuses a call that does not fit the shape", () => {
    expect(resolveWidget("showBlDateStamp", { ...base }).ok).toBe(false);
    expect(
      resolveWidget("showBlDateStamp", { ...base, timeZone: "New York" }).ok,
    ).toBe(false);
    expect(
      resolveWidget("showBlDateStamp", {
        ...base,
        event: "loaded",
        timeZone: "UTC",
      }).ok,
    ).toBe(false);
  });
});

describe("seeding", () => {
  it("seeds the chat's arguments and paints them on the first frame", async () => {
    const args = {
      value: "2024-06-14T23:00:00Z",
      event: "received",
      timeZone: "Asia/Shanghai",
      zone2: "America/Sao_Paulo",
      latest: "2024-06-14",
    };
    await open(args);
    expect(moment()).toHaveValue(args.value);
    expect(event()).toHaveValue("received");
    expect(latest()).toHaveValue("2024-06-14");
    expect(preset()).toHaveValue("custom");
    expectPlate("bl", [
      "Sat 15 Jun 2024",
      "07:00 in Asia/Shanghai",
      "after the latest date",
    ]);
    expect(lit(2)).toBe("2024-06-14");
  });

  it("opens on a preset whose controls a seed matches", async () => {
    const p = BL_DATE_PRESETS.find((x) => x.id === "shanghai-morning")!;
    await open({ value: p.value, event: p.event, timeZone: p.timeZone });
    expect(preset()).toHaveValue("shanghai-morning");
  });
});

describe("permalinks", () => {
  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choose(first, preset(), id!);
      const url = first.permalink();
      expect(url).toMatch(
        new RegExp(`^${SITE_BASE}/tools/bl-date-stamp/\\?w=bldate&wa=`),
      );
      const seeded = seedFromLocation("bldate", url.slice(url.indexOf("?")))!;
      expect(
        Object.values(seeded).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      expect(encodeWidgetPermalink("bldate", seeded)).toBe(url);
      first.destroy();

      const second = await open(seeded, "second");
      for (const line of EXPECTED[id!]!.copy.split("\n")) {
        expect(call()).toHaveTextContent(line, { normalizeWhitespace: true });
      }
      expect(output()).toHaveTextContent(
        EXPECTED[id!]!.output.replaceAll("\n", " "),
        { normalizeWhitespace: true },
      );
      expect(preset()).toHaveValue(id);
      second.destroy();
    },
  );

  it("leaves a blank place, calendar and latest date out of the link", async () => {
    const w = await open();
    await choose(w, place(), "");
    await choose(w, calendar(2), "");
    const url = w.permalink();
    expect(seedFromLocation("bldate", url.slice(url.indexOf("?")))).toEqual({
      value: VALUE,
      event: "shippedOnBoard",
    });
  });

  it("carries a moment the slider wrote", async () => {
    const w = await open();
    setRange(slider(), 144);
    const url = w.permalink();
    expect(
      seedFromLocation("bldate", url.slice(url.indexOf("?")))!["value"],
    ).toBe("2024-06-16T03:00:00Z");
  });
});

describe("on-screen words", () => {
  /** Everything a reader meets outside the printed calls and results. */
  function words(w: RenderedWidget): string {
    const names = within(w.root)
      .getAllByRole("listitem")
      .map((e) => e.getAttribute("aria-label") ?? "");
    const chrome = within(w.root)
      .getAllByRole("heading")
      .map((h) => h.textContent ?? "");
    const plates = definitions().map((d) => d.textContent ?? "");
    return [...names, ...chrome, ...plates].join("\n");
  }

  it.each(BL_DATE_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined outside the printed output",
    async (id) => {
      const w = await open();
      await choose(w, preset(), id!);
      expect(words(w)).not.toMatch(/\b(null|undefined)\b/);
    },
  );

  it("names no law, regulator, carrier or court", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\w*/i;
    const w = await open();
    for (const p of BL_DATE_PRESETS) {
      await choose(w, preset(), p.id);
      expect(words(w)).not.toMatch(forbidden);
      expect(w.root).not.toHaveTextContent(forbidden);
    }
  });

  it("names the library's three DCSA fields and no other standard body", async () => {
    const w = await open();
    expect(w.root).toHaveTextContent("shippedOnBoardDate");
    expect(w.root).toHaveTextContent("receivedForShipmentDate");
    expect(w.root).toHaveTextContent("issueDate");
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert, and destroying twice is safe", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(plate("bl")[0]).toHaveTextContent("no result");
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });

  it("releases its width observer on destroy, and destroying twice is safe", async () => {
    const spy = spyOnResizeObservers();
    const w = await open();
    expect(spy.live.size).toBeGreaterThan(0);
    w.destroy();
    w.destroy();
    expect(spy.live.size).toBe(0);
    spy.restore();
  });

  it("drops a pending reading on destroy", async () => {
    const w = await open();
    const first = summary();
    vi.useFakeTimers();
    setRange(slider(), 144);
    w.destroy();
    vi.advanceTimersByTime(1000);
    expect(first).toHaveTextContent(
      "Shipped on board date: Sat 15 Jun 2024, 22:00 in America/Sao_Paulo.",
    );
  });

  it("draws again when the width changes, and keeps the window", async () => {
    const spy = spyOnResizeObservers();
    const w = await open();
    setRange(slider(), 144);
    const before = columnNames(1);
    spy.fire();
    expect(columnNames(1)).toEqual(before);
    expect(slider()).toHaveValue("144");
    expect(spy.live.size).toBeGreaterThan(0);
    w.destroy();
    spy.restore();
  });
});

describe("the length cap", () => {
  it("stops the Moment field at 64 characters", async () => {
    const w = await open();
    const box = moment();
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(72));
    expect(box).toHaveValue("x".repeat(64));
  });
});
