/**
 * @vitest-environment jsdom
 *
 * The Satellite Clock Converter end to end: template -> mount -> interact -> assert,
 * against the real `@northguild/gmt`, through roles and accessible names the way a person
 * (or a screen reader) meets the page. Values are from a run of the built library, so a
 * drift in the library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { lib } from "~/test/gnss-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import {
  CLOCK_PRESETS,
  GLO_NOTE,
  IRN_NOTE,
  PLATE_NO_SIGNAL,
  SENTENCES,
  sliderPositions,
} from "./satellite-clock-converter";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showSatelliteClockConverter"] as AnyWidgetEntry;

const CLOCKS = ["UTC", "TAI", "GPS", "GAL", "BDT", "QZS", "GLO", "IRN"];

/** The UTC plate each preset reads, from a run of the library; `null` is NO SIGNAL. */
const UTC: Record<string, string | null> = {
  "utc-2024": "2024-01-01T00:00:00Z",
  "galileo-first-instant": "1999-08-21T23:59:47Z",
  "beidou-reading": "2024-01-01T00:00:00Z",
  "tai-reading": "2026-01-01T00:00:00Z",
  "inside-leap-second": "2016-12-31T23:59:60Z",
  "before-beidou": "2005-12-31T23:59:59Z",
  "no-leap-second-that-day": null,
  "wrong-token": null,
};

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });

// The controls, by the names a person reads.
const preset = () => screen.getByRole("combobox", { name: "Preset" });
const valueBox = () =>
  screen.getByRole("textbox", { name: /^A time on any clock/ });
const slider = () =>
  screen.getByRole("slider", { name: "Step through the leap seconds" });

/** Replaces what the text box holds, in one input event. */
async function enter(w: Widget, value: string) {
  await w.user.clear(valueBox());
  if (value !== "") await w.user.paste(value);
}

const output = () => screen.getByLabelText("What the calls returned");
const calls = () => screen.getByRole("group", { name: "Calls made" });
const reason = () =>
  screen.queryByRole("complementary", { name: "Why there is no result" });
const status = () => screen.getByRole("status", { name: "Reading summary" });
const footnote = () => screen.getByText(/^BDT: before this system/);

const TABLE = "The same instant on every clock";
const table = () => screen.getByRole("table", { name: TABLE });
const bodyRows = () =>
  within(table())
    .getAllByRole("row")
    .filter((r) => within(r).queryAllByRole("columnheader").length === 0);
const rowOf = (key: string) =>
  bodyRows().find((r) =>
    within(r).queryByRole("rowheader", { name: new RegExp(`^${key}\\b`) }),
  )!;
/** The row headers, one per clock, in order: each names its clock in the first word. */
const expectClocks = () => {
  const names = cellsInColumn(table(), "Clock");
  expect(names).toHaveLength(CLOCKS.length);
  names.forEach((cell, i) =>
    expect(cell).toHaveTextContent(new RegExp(`^${CLOCKS[i]}\\b`)),
  );
};
const ownRows = () =>
  bodyRows().filter((r) => within(r).queryByText(/your reading/) !== null);

const ladder = () => screen.getByRole("img");

const PLATE_CAPTIONS = ["UTC", "TAI − UTC", "Next change"];

/**
 * A plate is a term and three definitions (the value, then two lines), so the value of
 * plate n is definition 3n. A plate reserves the widest text it can show beside the shown
 * one, hidden from assistive technology, so the shown text is the one not hidden.
 */
function plateParts(caption: string) {
  const index = PLATE_CAPTIONS.indexOf(caption);
  const defs = screen.getAllByRole("definition");
  return {
    value: defs[index * 3]!,
    lines: defs.slice(index * 3 + 1, index * 3 + 3),
  };
}
const shownIn = (el: HTMLElement) =>
  within(el)
    .getAllByText(/./)
    .filter((e) => e.getAttribute("aria-hidden") !== "true");
const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

function expectPlate(caption: string, value: string) {
  const shown = shownIn(plateParts(caption).value);
  expect(shown).toHaveLength(1);
  expect(shown[0]).toHaveTextContent(exact(value));
}

/** The text of the two lines under a plate's value that is not hidden. */
const plateLine = (caption: string, n: 0 | 1) => plateParts(caption).lines[n]!;

describe("renderSatelliteClockConverterTemplate", () => {
  it("is a named region with four numbered sections, three plates, a ladder of eight clocks and eight rows", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Satellite Clock Converter" }),
    ).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 4 });
    [
      "1. Say what a clock reads",
      "2. How far each clock is from UTC",
      "3. The same instant on every clock",
      "4. What the library returns",
    ].forEach((name, i) => expect(headings[i]).toHaveTextContent(name));
    expect(headings).toHaveLength(4);
    expect(screen.getAllByRole("term")).toHaveLength(3);
    expectClocks();
    expect(ladder()).toBeInTheDocument();
  });

  it("limits the value to 64 characters and names every control", async () => {
    await open();
    expect(valueBox()).toHaveAttribute("maxlength", "64");
    for (const role of ["combobox", "textbox", "slider"] as const) {
      for (const control of screen.getAllByRole(role)) {
        expect(control).toHaveAccessibleName(/\S/);
      }
    }
  });

  it("shows a hostile seed as text, never as elements", async () => {
    await open({ value: '"><img src=x onerror=alert(1)><script>x</script>' });
    expect(screen.queryByRole("img", { name: /^x$/ })).not.toBeInTheDocument();
    expect(valueBox()).toHaveValue(
      '"><img src=x onerror=alert(1)><script>x</script>',
    );
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(UTC).sort()).toEqual(
      CLOCK_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(CLOCK_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await w.user.selectOptions(preset(), id!);
    expect(preset()).toHaveValue(id);
    expect(screen.getAllByRole("term")).toHaveLength(3);
    expect(bodyRows()).toHaveLength(8);
    if (UTC[id!] === null) {
      expect(output()).toHaveTextContent(/^NO SIGNAL( NO SIGNAL)*$/);
      expect(reason()).toHaveTextContent(/\S/);
    } else {
      expect(output()).not.toHaveTextContent(/NO SIGNAL/);
      expectPlate("UTC", UTC[id!]!);
      expect(reason()).not.toBeInTheDocument();
      expect(calls()).toHaveTextContent("utcToGnss");
    }
    await expectNoAxeViolations(w.root);
  });
});

describe("the table", () => {
  it("reads the start of 2024 on every clock", async () => {
    const w = await open({ preset: "utc-2024" });
    const readings = [
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:37 TAI",
      "2024-01-01T00:00:18 GPS",
      "2024-01-01T00:00:18 GAL",
      "2024-01-01T00:00:04 BDT",
      "2024-01-01T00:00:18 QZS",
      "2024-01-01T00:00:00 GLO",
      "2024-01-01T00:00:18 IRN",
    ];
    const cells = cellsInColumn(table(), "Reading");
    readings.forEach((reading, i) =>
      expect(cells[i]).toHaveTextContent(new RegExp(`^${reading}`)),
    );
    const leads = cellsInColumn(table(), "Ahead of UTC");
    [
      "the reference",
      "37 s",
      "18 s",
      "18 s",
      "4 s",
      "18 s",
      "0 s",
      "18 s",
    ].forEach((lead, i) => expect(leads[i]).toHaveTextContent(exact(lead)));
    expect(rowOf("UTC")).toHaveTextContent("your reading");
    expect(rowOf("IRN")).toHaveTextContent("derived");
    await expectNoAxeViolations(w.root);
  });

  it("names the reader's own clock", async () => {
    const w = await open({ preset: "beidou-reading" });
    expect(ownRows()).toEqual([rowOf("BDT")]);
    await expectNoAxeViolations(w.root);
  });

  it("says written as under a reading the library spells differently", async () => {
    const w = await open({ value: "2024-01-01T00:00:00+01:00" });
    expect(rowOf("UTC")).toHaveTextContent(
      "2024-01-01T00:00:00+01:00 written as 2023-12-31T23:00:00Z",
    );
    await enter(w, "2024-01-01T00:00:00Z");
    expect(rowOf("UTC")).not.toHaveTextContent("written as");
    await expectNoAxeViolations(w.root);
  });

  it("says no result for a clock that has not started, and why under the table", async () => {
    const w = await open({ preset: "before-beidou" });
    expect(rowOf("BDT")).toHaveTextContent(/^BDT\s*no result\s*no result$/);
    expect(footnote()).toHaveTextContent(
      "BDT: before this system's first instant.",
    );
    // A correct "no result" row is not a NO SIGNAL for the whole reading.
    expect(output()).not.toHaveTextContent(/NO SIGNAL/);
    await expectNoAxeViolations(w.root);
  });

  it("says inside an inserted second where a duration cannot be taken", async () => {
    const w = await open({ preset: "inside-leap-second" });
    expect(rowOf("GPS")).toHaveTextContent(
      /^GPS\s*2017-01-01T00:00:17 GPS\s*inside an inserted second$/,
    );
    expectPlate("TAI − UTC", "36 s");
    await expectNoAxeViolations(w.root);
  });

  it("keeps all eight rows, in order, when the reading goes to NO SIGNAL", async () => {
    const w = await open({ preset: "utc-2024" });
    await enter(w, "garbage");
    expect(output()).toHaveTextContent(/NO SIGNAL/);
    expectClocks();
    expect(reason()).toHaveTextContent(SENTENCES.notAnInstant);
    await expectNoAxeViolations(w.root);
  });

  it("states the two page notes at all times", async () => {
    await open({ preset: "wrong-token" });
    expect(screen.getByText(GLO_NOTE)).toBeInTheDocument();
    expect(screen.getByText(IRN_NOTE)).toBeInTheDocument();
  });
});

describe("the ladder", () => {
  const sentences = () =>
    screen.getAllByText(/^[A-Z]{3}: /, { selector: "li" });

  it("is one labelled image that says each clock's lead, with a list of sentences beside it", async () => {
    const w = await open({ preset: "utc-2024" });
    const figure = screen.getByRole("img", {
      name: /Ladder of 8 clocks on one scale of seconds ahead of UTC/,
    });
    expect(figure).toHaveAccessibleName(
      /GPS, GAL, QZS and IRN 18 s ahead of UTC/,
    );
    expect(sentences()).toHaveLength(8);
    expect(within(figure).queryByRole("link")).not.toBeInTheDocument();
    expect(within(figure).queryByRole("button")).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("says each clock's lead as a chip beside its rung", async () => {
    await open({ preset: "utc-2024" });
    const figure = ladder();
    for (const chip of ["the reference", "37 s", "18 s", "4 s", "0 s"]) {
      expect(within(figure).getAllByText(chip).length).toBeGreaterThan(0);
    }
    expect(within(figure).getAllByText("18 s")).toHaveLength(4);
  });

  it("says which clocks are tied to TAI and which follow UTC, from the library", async () => {
    await open({ preset: "utc-2024" });
    const figure = ladder();
    expect(within(figure).getByText("baseline")).toBeInTheDocument();
    expect(within(figure).getByText("top rail")).toBeInTheDocument();
    expect(within(figure).getAllByText("tied to TAI")).toHaveLength(5);
    expect(within(figure).getByText("follows UTC")).toBeInTheDocument();
  });

  it("puts a clock with no reading off the scale, and says so", async () => {
    const w = await open({ preset: "before-beidou" });
    const figure = ladder();
    expect(
      within(figure).getByText("No place on the scale"),
    ).toBeInTheDocument();
    expect(
      within(figure).getByText("before its first instant"),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("moves clocks on and off the scale as the slider steps through the stops", async () => {
    const w = await open({ preset: "utc-2024" });
    // Before 1980 the five TAI-tied clocks are off the scale.
    const offCount = () =>
      within(ladder()).queryAllByText("before its first instant").length;
    setRange(slider(), 0);
    const early = offCount();
    expect(early).toBeGreaterThanOrEqual(5);
    setRange(slider(), 20);
    expect(offCount()).not.toBe(early);
    await expectNoAxeViolations(w.root);
  });

  it("reads an inserted second in words, and a bad token is not a ladder", async () => {
    const w = await open({ preset: "inside-leap-second" });
    expect(ladder()).toHaveAccessibleName(/inserted/);
    await w.user.selectOptions(preset(), "wrong-token");
    expect(
      screen.queryByRole("img", { name: /Ladder of 8/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("⟨ NO SIGNAL — invalid input ⟩"),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("the plates", () => {
  it("read UTC, TAI minus UTC and the next change", async () => {
    await open({ preset: "galileo-first-instant" });
    expectPlate("UTC", "1999-08-21T23:59:47Z");
    expectPlate("TAI − UTC", "32 s");
    expectPlate("Next change", "2005-12-31T23:59:60Z");
  });

  it("say none after this instant as a result, not a no-signal", async () => {
    const w = await open({ preset: "utc-2024" });
    expectPlate("Next change", "none after this instant");
    expect(plateLine("Next change", 0)).toHaveTextContent(
      "these gaps stay as they are",
    );
    expect(within(w.root).queryByText(PLATE_NO_SIGNAL)).not.toBeInTheDocument();
  });

  it("all say NO SIGNAL in words under a sentinel", async () => {
    await open({ preset: "wrong-token" });
    for (const caption of PLATE_CAPTIONS) expectPlate(caption, PLATE_NO_SIGNAL);
  });

  it("read no result for a blank value", async () => {
    const w = await open({ preset: "utc-2024" });
    await enter(w, "");
    for (const caption of PLATE_CAPTIONS) expectPlate(caption, "no result");
    expect(screen.queryByText(PLATE_NO_SIGNAL)).not.toBeInTheDocument();
  });
});

describe("the sentinel sentences", () => {
  it("are four different sentences for four different faults", async () => {
    const w = await open({ preset: "utc-2024" });
    const faults = [
      "2024-01-01T00:00:37 UTC",
      "2017-12-31T23:59:60Z",
      "1990-01-01T00:00:00 GAL",
      "garbage",
    ];
    const seen: string[] = [];
    for (const value of faults) {
      await enter(w, value);
      expect(output(), value).toHaveTextContent(/NO SIGNAL/);
      const sentence = Object.values(SENTENCES).find(
        (s) => within(reason()!).queryByText(s) !== null,
      );
      expect(sentence, value).toBeDefined();
      seen.push(sentence!);
    }
    expect(new Set(seen).size).toBe(4);
    await expectNoAxeViolations(w.root);
  });

  it("an empty value is an empty state, never amber", async () => {
    const w = await open({ preset: "utc-2024" });
    await enter(w, "");
    expect(output()).not.toHaveTextContent(/NO SIGNAL/);
    expect(reason()).not.toBeInTheDocument();
    expect(calls()).not.toHaveTextContent("utcToGnss");
    expect(bodyRows()).toHaveLength(8);
    await expectNoAxeViolations(w.root);
  });
});

describe("the form", () => {
  it("opens on the first preset", async () => {
    await open();
    expect(preset()).toHaveValue("utc-2024");
    expect(valueBox()).toHaveValue("2024-01-01T00:00:00Z");
  });

  it("makes the preset custom when the value changes, and back when it matches", async () => {
    const w = await open();
    await enter(w, "2030-05-05T05:05:05Z");
    expect(preset()).toHaveValue("custom");
    await enter(w, "2024-01-01T00:00:04 BDT");
    expect(preset()).toHaveValue("beidou-reading");
  });

  it("reads the clock from the token after the space", async () => {
    const w = await open();
    await enter(w, "2024-01-01T00:00:18 GPS");
    expectPlate("UTC", "2024-01-01T00:00:00Z");
    expect(plateLine("UTC", 0)).toHaveTextContent("read from GPS");
    expect(ownRows()).toEqual([rowOf("GPS")]);
  });
});

describe("the slider", () => {
  it("has one more stop than there are inserted seconds, and starts on the latest", async () => {
    await open();
    const stops = sliderPositions(lib);
    expect(slider()).toHaveAttribute("min", "0");
    expect(slider()).toHaveAttribute("max", String(stops.length - 1));
    expect(slider()).toHaveValue(String(stops.length - 1));
    expect(stops[0]).toBe("1972-01-01T00:00:00Z");
  });

  it("writes the stop's UTC instant into the value and reads it", async () => {
    const w = await open();
    const stops = sliderPositions(lib);
    setRange(slider(), 0);
    expect(valueBox()).toHaveValue(stops[0]);
    expectPlate("TAI − UTC", "10 s");
    // Before any satellite clock began, they have no result and the footnote says so.
    expect(
      screen.getAllByText(/before this system.s first instant/).length,
    ).toBeGreaterThan(0);
    setRange(slider(), stops.length - 1);
    expect(valueBox()).toHaveValue(stops.at(-1));
    expectPlate("TAI − UTC", "37 s");
    await expectNoAxeViolations(w.root);
  });

  it("has a typed equivalent and follows a typed stop", async () => {
    const w = await open();
    const stops = sliderPositions(lib);
    await enter(w, stops[3]!);
    expect(slider()).toHaveValue("3");
  });

  it("leaves the slider where it is for a value that is not a stop", async () => {
    const w = await open();
    setRange(slider(), 5);
    await enter(w, "2030-05-05T05:05:05Z");
    expect(slider()).toHaveValue("5");
    await expectNoAxeViolations(w.root);
  });
});

describe("seeding and permalinks", () => {
  it("seeds a chat call's value and paints it on the first frame", async () => {
    await open({ value: "2026-01-01T00:00:37 TAI" });
    expect(valueBox()).toHaveValue("2026-01-01T00:00:37 TAI");
    expectPlate("UTC", "2026-01-01T00:00:00Z");
    expect(preset()).toHaveValue("tai-reading");
  });

  it.each(CLOCK_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of one string",
    async (id) => {
      const first = await open();
      await first.user.selectOptions(preset(), id!);
      const url = first.permalink();
      expect(url).toMatch(
        new RegExp(
          `^${SITE_BASE}/tools/satellite-clock-converter/\\?w=satclock&wa=`,
        ),
      );
      const seeded = seedFromLocation("satclock", url.slice(url.indexOf("?")))!;
      expect(Object.keys(seeded)).toEqual(["value"]);
      expect(typeof seeded["value"]).toBe("string");
      expect((seeded["value"] as string).length).toBeLessThanOrEqual(64);
      expect(encodeWidgetPermalink("satclock", seeded)).toBe(url);
      const sentinel = reason() !== null;
      first.destroy();

      const second = await open(seeded);
      expect(reason() !== null).toBe(sentinel);
      expect(preset()).toHaveValue(id);
      expect(second.permalink()).toBe(url);
    },
  );

  it("writes a custom value as typed", async () => {
    const w = await open();
    await enter(w, "2030-05-05T05:05:05Z");
    const url = w.permalink();
    expect(seedFromLocation("satclock", url.slice(url.indexOf("?")))).toEqual({
      value: "2030-05-05T05:05:05Z",
    });
  });
});

describe("on-screen words", () => {
  /** What a reader sees or hears, bar the calls and what they returned and the GLO note. */
  const regions = () => [
    table(),
    ladder(),
    status(),
    screen.getAllByRole("term")[0]!,
  ];

  it.each(CLOCK_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined and names no body, zone or country",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(preset(), id!);
      for (const region of regions()) {
        expect(region).not.toHaveTextContent(/\bnull\b|undefined|NaN/);
        expect(region).not.toHaveTextContent(
          /UTC\+3|Moscow|MSK|New_York|en-US|\bGMT\b|GLONASS/,
        );
      }
      expect(ladder()).not.toHaveAccessibleName(/\bnull\b|undefined|NaN/);
      // GLONASS appears only in the one note that says what GLO is.
      expect(screen.getAllByText(/GLONASS/)).toHaveLength(1);
    },
  );

  it("states the reading in one live sentence", async () => {
    await open({ preset: "beidou-reading" });
    expect(status()).toHaveTextContent("UTC 2024-01-01T00:00:00Z");
    expect(status()).toHaveTextContent("TAI − UTC 37 s");
  });

  it("uses real controls", async () => {
    await open();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getAllByRole("slider")).toHaveLength(1);
  });

  it("prints the calls it made", async () => {
    await open({ preset: "beidou-reading" });
    for (const name of [
      "gnssToUtc",
      "toTAI",
      "taiMinusUtc",
      "nextLeapSecond",
    ]) {
      expect(calls()).toHaveTextContent(name);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const w = await renderWidget(entry, { aborted: true });
    expect(output()).not.toHaveTextContent(/NO SIGNAL/);
    w.destroy();
    w.destroy();
  });

  it("two converters on one page keep separate controls", async () => {
    const a = await renderWidget(entry, { idPrefix: "a" });
    const b = await renderWidget(entry, { idPrefix: "b" });
    await a.user.selectOptions(
      within(a.root).getByRole("combobox", { name: "Preset" }),
      "beidou-reading",
    );
    expect(
      within(a.root).getByRole("combobox", { name: "Preset" }),
    ).toHaveValue("beidou-reading");
    expect(
      within(b.root).getByRole("combobox", { name: "Preset" }),
    ).toHaveValue("utc-2024");
  });
});

describe("the links row", () => {
  const WEEKS = "This moment as a week on every counter";
  const TIMELINE = "Why these gaps grew";
  const isOpen = (name: string) =>
    screen.queryByRole("link", { name }) !== null;
  const href = (name: string) =>
    screen.getByRole("link", { name }).getAttribute("href");
  const closed = (name: string) => {
    const el = screen.getByText(name);
    return {
      disabled: el.getAttribute("aria-disabled"),
      href: el.getAttribute("href"),
    };
  };

  it("has both links in a named group, in order", async () => {
    await open();
    const group = screen.getByRole("group", { name: "Other tools" });
    const links = within(group).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent(WEEKS);
    expect(links[1]).toHaveTextContent(TIMELINE);
  });

  it("sends the UTC instant to the Week Decoder in UTC mode and to the timeline as its date", async () => {
    await open();
    expect(href(WEEKS)).toBe(
      encodeWidgetPermalink("gnssweek", {
        mode: "utc",
        utc: "2024-01-01T00:00:00Z",
      }),
    );
    expect(href(TIMELINE)).toBe(
      encodeWidgetPermalink("leapline", { date: "2024-01-01T00:00:00Z" }),
    );
  });

  it("sends the UTC instant a labelled reading stands for, not the text typed", async () => {
    for (const id of [
      "tai-reading",
      "beidou-reading",
      "galileo-first-instant",
    ]) {
      const w = await open({ preset: id });
      const utc = UTC[id]!;
      expect(href(WEEKS)).toBe(
        encodeWidgetPermalink("gnssweek", { mode: "utc", utc }),
      );
      expect(href(TIMELINE)).toBe(
        encodeWidgetPermalink("leapline", { date: utc }),
      );
      w.destroy();
    }
  });

  it("sends a leap second's own instant", async () => {
    await open({ preset: "inside-leap-second" });
    expect(href(WEEKS)).toBe(
      encodeWidgetPermalink("gnssweek", {
        mode: "utc",
        utc: "2016-12-31T23:59:60Z",
      }),
    );
  });

  it("follows the slider to the stop's instant", async () => {
    await open();
    const stops = sliderPositions(lib);
    setRange(slider(), 0);
    expect(href(WEEKS)).toBe(
      encodeWidgetPermalink("gnssweek", { mode: "utc", utc: stops[0] }),
    );
    expect(href(TIMELINE)).toBe(
      encodeWidgetPermalink("leapline", { date: stops[0] }),
    );
  });

  it.each(["no-leap-second-that-day", "wrong-token"])(
    "disables both links, with no href, on NO SIGNAL (%s)",
    async (id) => {
      await open({ preset: id });
      for (const name of [WEEKS, TIMELINE]) {
        expect(isOpen(name)).toBe(false);
        expect(closed(name)).toEqual({ disabled: "true", href: null });
      }
    },
  );

  it("disables both links for a blank value, and lights them again for a reading", async () => {
    const w = await open();
    await enter(w, "");
    expect(isOpen(WEEKS)).toBe(false);
    expect(isOpen(TIMELINE)).toBe(false);
    await enter(w, "2024-01-01T00:00:00Z");
    expect(isOpen(WEEKS)).toBe(true);
    expect(isOpen(TIMELINE)).toBe(true);
  });

  it("lands on seeds the other tools read back", async () => {
    await open();
    const read = (name: string, kind: "gnssweek" | "leapline") => {
      const target = href(name)!;
      return seedFromLocation(kind, target.slice(target.indexOf("?")));
    };
    expect(read(WEEKS, "gnssweek")).toEqual({
      mode: "utc",
      utc: "2024-01-01T00:00:00Z",
    });
    expect(read(TIMELINE, "leapline")).toEqual({
      date: "2024-01-01T00:00:00Z",
    });
  });
});

describe("the length cap", () => {
  it("stops the time field at 64 characters", async () => {
    const w = await open();
    const box = valueBox();
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(72));
    expect(box).toHaveValue("x".repeat(64));
  });
});
