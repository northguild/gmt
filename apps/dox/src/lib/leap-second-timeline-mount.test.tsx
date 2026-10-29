/**
 * @vitest-environment jsdom
 *
 * The Leap Second Timeline end to end, against the real `@northguild/gmt`. Every
 * preset's printed calls, results and plates are checked against literal strings read
 * from a run of the built library, so a drift in the library or the widget fails here.
 * Everything is read the way a reader or a screen reader meets it: roles, names,
 * values and visible text.
 */
import { screen, within } from "@testing-library/dom";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
} from "~/test/render-widget";
import {
  BEFORE_1972_TEXT,
  NOT_INSTANT_TEXT,
  TIMELINE_PRESETS,
  VERDICT_INSERTED,
  VERDICT_NOT_INSERTED,
} from "./leap-second-timeline";
import { INSERTION_ROWS } from "./leap-second-timeline-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { SITE_BASE } from "./site";

installJsdomShims();

const entry = WIDGET_REGISTRY["showLeapSecondTimeline"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const dateBox = () => screen.getByRole("textbox", { name: "Date" });
const fromBox = () => screen.getByRole("textbox", { name: "Count from" });
const toBox = () => screen.getByRole("textbox", { name: "Count to" });
const checkBox = () =>
  screen.getByRole("textbox", { name: "A second 60 to check" });
const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const slider = () => screen.getByRole("slider", { name: "Move the date" });
const summary = () => screen.getByRole("status", { name: "Timeline reading" });
const GROUPS = ["offset", "between", "check"] as const;
const groupIndex = (g: (typeof GROUPS)[number]) => GROUPS.indexOf(g);
const callsOf = (g: (typeof GROUPS)[number]) =>
  screen.getAllByRole("group", { name: /Calls made/ })[groupIndex(g)]!;
const outputOf = (g: (typeof GROUPS)[number]) =>
  screen.getAllByRole("status", { name: "What the calls returned" })[
    groupIndex(g)
  ]!;
const asides = () => screen.queryAllByRole("complementary");
const tableRows = () =>
  within(screen.getByRole("table", { name: "Every inserted second" }))
    .getAllByRole("row")
    .slice(1);
const linkNamed = (name: string) => screen.getByText(name);

const PLATE_CAPTIONS = [
  "TAI − UTC on the date",
  "Leap seconds between",
  "Your second 60",
];

/**
 * A plate is a term and three definitions (the value, then two lines), so the value of
 * plate n is definition 3n. A plate reserves the widest text it can show beside the
 * shown one, hidden from assistive technology, so the shown text is the one not hidden.
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
    .queryAllByText(/./)
    .filter((e) => e.getAttribute("aria-hidden") !== "true");
const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

type Plate = [string, string, string];
function expectPlate(caption: string, want: Plate) {
  const { value, lines } = plateParts(caption);
  const shown = shownIn(value);
  expect(shown).toHaveLength(1);
  expect(shown[0]).toHaveTextContent(exact(want[0]));
  [want[1], want[2]].forEach((line, n) => {
    if (line === "") expect(lines[n]).toBeEmptyDOMElement();
    else expect(lines[n]).toHaveTextContent(exact(line));
  });
}
const expectPlates = (want: {
  offset: Plate;
  between: Plate;
  check: Plate;
}) => {
  expectPlate(PLATE_CAPTIONS[0]!, want.offset);
  expectPlate(PLATE_CAPTIONS[1]!, want.between);
  expectPlate(PLATE_CAPTIONS[2]!, want.check);
};

const BLANK = "Not read: the field is blank.";
const NONE: Plate = ["no result", "", ""];
const flat = (s: string) => s.replace(/\n/g, " ");

interface Expected {
  calls: { offset: string; between: string; check: string };
  output: { offset: string; between: string; check: string };
  plates: { offset: Plate; between: Plate; check: Plate };
  /** How many table rows say "counted", and how many say "your second 60". */
  counted: number;
  checked: number;
}

/** What each preset prints, from a run against `packages/gmt/dist`. */
const EXPECTED: Record<string, Expected> = {
  "from-2000": {
    calls: {
      offset:
        'taiMinusUtc("2000-01-01T00:00:00Z")\nnextLeapSecond("2000-01-01T00:00:00Z")',
      between:
        'leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      check:
        'hasSecond60("2016-12-31T23:59:60Z")\nisLeapSecond("2016-12-31T23:59:60Z")\nisValidInstant("2016-12-31T23:59:60Z")',
    },
    output: {
      offset: '32\n"2005-12-31T23:59:60Z"',
      between: "5",
      check: "true\ntrue\nfalse",
    },
    plates: {
      offset: ["32 s", "next insertion", "2005-12-31"],
      between: ["5", "from 2000-01-01", "to 2024-01-01"],
      check: [VERDICT_INSERTED, "isLeapSecond true", "hasSecond60 true"],
    },
    counted: 4,
    checked: 1,
  },
  "last-insertion": {
    calls: {
      offset:
        'taiMinusUtc("2016-01-01T00:00:00Z")\nnextLeapSecond("2016-01-01T00:00:00Z")',
      between: "",
      check: "",
    },
    output: {
      offset: '36\n"2016-12-31T23:59:60Z"',
      between: BLANK,
      check: BLANK,
    },
    plates: {
      offset: ["36 s", "next insertion", "2016-12-31"],
      between: NONE,
      check: NONE,
    },
    counted: 0,
    checked: 0,
  },
  "after-the-table": {
    calls: {
      offset:
        'taiMinusUtc("2024-01-01T00:00:00Z")\nnextLeapSecond("2024-01-01T00:00:00Z")',
      between: "",
      check: "",
    },
    output: { offset: '37\n""', between: BLANK, check: BLANK },
    plates: {
      offset: ["37 s", "none after this date", ""],
      between: NONE,
      check: NONE,
    },
    counted: 0,
    checked: 0,
  },
  "far-future": {
    calls: {
      offset:
        'taiMinusUtc("2100-01-01T00:00:00Z")\nnextLeapSecond("2100-01-01T00:00:00Z")',
      between: "",
      check: "",
    },
    output: { offset: '37\n""', between: BLANK, check: BLANK },
    plates: {
      offset: ["37 s", "none after this date", ""],
      between: NONE,
      check: NONE,
    },
    counted: 0,
    checked: 0,
  },
  "not-inserted": {
    calls: {
      offset: "",
      between: "",
      check:
        'hasSecond60("2017-12-31T23:59:60Z")\nisLeapSecond("2017-12-31T23:59:60Z")\nisValidInstant("2017-12-31T23:59:60Z")',
    },
    output: { offset: BLANK, between: BLANK, check: "true\nfalse\nfalse" },
    plates: {
      offset: NONE,
      between: NONE,
      check: [VERDICT_NOT_INSERTED, "isLeapSecond false", "hasSecond60 true"],
    },
    counted: 0,
    checked: 0,
  },
  "offset-spelling": {
    calls: {
      offset: "",
      between: "",
      check:
        'hasSecond60("2009-01-01T08:59:60+09:00")\nisLeapSecond("2009-01-01T08:59:60+09:00")\nisValidInstant("2009-01-01T08:59:60+09:00")',
    },
    output: { offset: BLANK, between: BLANK, check: "true\ntrue\nfalse" },
    plates: {
      offset: NONE,
      between: NONE,
      check: [VERDICT_INSERTED, "isLeapSecond true", "hasSecond60 true"],
    },
    counted: 0,
    checked: 1,
  },
  backwards: {
    calls: {
      offset: "",
      between:
        'leapSecondsBetween("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z")',
      check: "",
    },
    output: { offset: BLANK, between: "-5", check: BLANK },
    plates: {
      offset: NONE,
      between: ["-5", "from 2024-01-01", "to 2000-01-01"],
      check: NONE,
    },
    counted: 5,
    checked: 0,
  },
  "before-1972": {
    calls: {
      offset:
        'taiMinusUtc("1971-01-01T00:00:00Z")\nnextLeapSecond("1971-01-01T00:00:00Z")',
      between:
        'leapSecondsBetween("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      check: "",
    },
    // Both calls of the offset group refused, so each prints its own NO SIGNAL.
    output: {
      offset: "NO SIGNAL\nNO SIGNAL",
      between: "NO SIGNAL",
      check: BLANK,
    },
    plates: { offset: NONE, between: NONE, check: NONE },
    counted: 0,
    checked: 0,
  },
};

async function pick(w: Awaited<ReturnType<typeof open>>, id: string) {
  await w.user.selectOptions(presetBox(), id);
}
async function typeInto(
  w: Awaited<ReturnType<typeof open>>,
  box: HTMLElement,
  value: string,
) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

describe("the template", () => {
  it("is a named region with three numbered sections and the controls a reader needs", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Leap Second Timeline" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Set a date, a span and a second 60",
      "2. Every inserted second",
      "3. What the library returns",
    ]);
    expect(presetBox()).toHaveValue("from-2000");
    expect(dateBox()).toHaveValue("2000-01-01T00:00:00Z");
    expect(checkBox()).toHaveValue("2016-12-31T23:59:60Z");
    expect(slider()).toBeEnabled();
    await expectNoAxeViolations(document.body);
  });

  it("draws one row for every second the library lists", async () => {
    await open();
    expect(tableRows()).toHaveLength(INSERTION_ROWS);
  });

  it("gives the plot the summary as its name", async () => {
    await open();
    expect(summary()).toHaveTextContent(/27 leap seconds are inserted/);
    expect(
      screen.getByRole("img", { name: summary().textContent! }),
    ).toBeInTheDocument();
  });

  it("escapes a hostile seed", async () => {
    const hostile = '"><img src=x onerror=alert(1)>';
    await open({ date: hostile, check: hostile, from: hostile, to: hostile });
    expect(screen.queryByRole("img", { name: /^$/ })).not.toBeInTheDocument();
    expect(dateBox()).toHaveValue(hostile);
    expect(checkBox()).toHaveValue(hostile);
  });

  it("gives two copies on one page their own ids", async () => {
    await open({}, "one");
    await open({}, "two");
    expect(screen.getAllByRole("textbox", { name: "Date" })).toHaveLength(2);
    expect(
      screen.getAllByRole("region", { name: "Leap Second Timeline" }),
    ).toHaveLength(2);
  });
});

describe("every preset", () => {
  it("covers every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      TIMELINE_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(Object.entries(EXPECTED))("%s", async (id, want) => {
    const w = await open();
    await pick(w, id);
    expect(presetBox()).toHaveValue(id);
    for (const g of GROUPS) {
      const out = want.output[g];
      expect(outputOf(g), g).toHaveTextContent(exact(flat(out)));
      if (want.calls[g] !== "") {
        expect(callsOf(g), g).toHaveTextContent(want.calls[g].split("\n")[0]!);
        expect(callsOf(g), g).toHaveTextContent(flat(want.calls[g]));
        // One result line for each call line.
        expect(out.split("\n").length, g).toBe(
          want.calls[g].split("\n").length,
        );
      }
    }
    expectPlates(want.plates);
    const table = within(
      screen.getByRole("table", { name: "Every inserted second" }),
    );
    expect(table.queryAllByText("counted")).toHaveLength(want.counted);
    expect(table.queryAllByText("your second 60")).toHaveLength(want.checked);
    expect(tableRows()).toHaveLength(INSERTION_ROWS);
    expect(
      screen.getByRole("img", { name: summary().textContent! }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("before-1972 explains each no signal in one sentence", async () => {
    const w = await open();
    await pick(w, "before-1972");
    const reasons = asides().filter((a) =>
      a.textContent?.includes(BEFORE_1972_TEXT),
    );
    expect(reasons).toHaveLength(2);
    for (const a of reasons) {
      expect(a).toHaveAccessibleName(/^Why there is no result: /);
    }
  });

  it("a legitimately empty next insertion is a live result, not no signal", async () => {
    const w = await open();
    await pick(w, "after-the-table");
    expect(outputOf("offset")).not.toHaveTextContent(/NO SIGNAL/);
    expect(asides()).toHaveLength(0);
    expect(
      screen.queryByText("⟨ NO SIGNAL — invalid input ⟩"),
    ).not.toBeInTheDocument();
  });

  it("the table lists the 27 seconds in order with the offset after each", async () => {
    await open();
    const rows = tableRows();
    expect(rows[0]).toHaveTextContent("1972-06-30T23:59:60Z");
    expect(rows[0]).toHaveTextContent("11 s");
    expect(rows[26]).toHaveTextContent("2016-12-31T23:59:60Z");
    expect(rows[26]).toHaveTextContent("37 s");
    // The counted rows say so in words, not by colour alone.
    expect(rows[22]).toHaveTextContent("counted");
    expect(rows[26]).toHaveTextContent("your second 60");
  });
});

describe("typing", () => {
  it("a typed date past the axis says so, and the preset becomes custom", async () => {
    const w = await open();
    await typeInto(w, dateBox(), "2100-01-01T00:00:00Z");
    expect(screen.getByText(/\(past the axis\)/)).toBeInTheDocument();
    expect(presetBox()).toHaveValue("custom");
    await expectNoAxeViolations(document.body);
  });

  it("an offset-spelled date reads as the same instant, and keeps the slider enabled", async () => {
    const w = await open();
    await typeInto(w, dateBox(), "2016-01-01T09:00:00+09:00");
    expect(outputOf("offset")).toHaveTextContent('36 "2016-12-31T23:59:60Z"');
    expect(slider()).toBeEnabled();
    expect(outputOf("offset")).not.toHaveTextContent(/NO SIGNAL/);
  });

  it("an invalid date is no signal with the reason", async () => {
    const w = await open();
    await typeInto(w, dateBox(), "soon");
    expect(outputOf("offset")).toHaveTextContent(/NO SIGNAL/);
    expect(
      asides().some((a) => a.textContent?.includes(NOT_INSTANT_TEXT)),
    ).toBe(true);
    expect(presetBox()).toHaveValue("custom");
    expect(slider()).toBeDisabled();
    await expectNoAxeViolations(document.body);
  });

  it("clearing a field leaves its call out and its output empty", async () => {
    const w = await open();
    await typeInto(w, checkBox(), "");
    expect(outputOf("check")).toHaveTextContent(exact(BLANK));
    expect(outputOf("check")).not.toHaveTextContent(/NO SIGNAL/);
  });

  it("a second 60 that is not an instant is no signal", async () => {
    const w = await open();
    await typeInto(w, checkBox(), "garbage");
    expect(outputOf("check")).toHaveTextContent(/NO SIGNAL/);
    expectPlate(PLATE_CAPTIONS[2]!, NONE);
    expect(
      asides().some((a) => a.textContent?.includes(NOT_INSTANT_TEXT)),
    ).toBe(true);
  });
});

describe("the date slider", () => {
  const at = async (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix(iso) ?? 0);
    return open();
  };
  afterEach(() => vi.useRealTimers());

  it("runs from 1972-01-01 to continuous UTC while today is earlier", async () => {
    await at("2026-10-16T09:00:00Z");
    expect(slider()).toHaveAttribute("min", "0");
    expect(slider()).toHaveAttribute("max", "20228");
    expect(screen.getByText("1972-01-01")).toBeInTheDocument();
    expect(screen.getByText("2027-05-20")).toBeInTheDocument();
  });

  it("runs to the reader's today once it is later", async () => {
    await at("2030-03-10T09:00:00Z");
    expect(slider()).toHaveAttribute("max", "21253");
    expect(screen.getByText("2030-03-10")).toBeInTheDocument();
  });

  it("writes a midnight and follows the date it wrote", async () => {
    await at("2026-10-16T09:00:00Z");
    setRange(slider(), 0);
    expect(dateBox()).toHaveValue("1972-01-01T00:00:00Z");
    expectPlate(PLATE_CAPTIONS[0]!, ["10 s", "next insertion", "1972-06-30"]);
    setRange(slider(), 20228);
    expect(dateBox()).toHaveValue("2027-05-20T00:00:00Z");
    expect(plateParts(PLATE_CAPTIONS[0]!).value).toHaveTextContent("37 s");
    expect(slider()).toHaveValue("20228");
    await expectNoAxeViolations(document.body);
  });

  it("is disabled while the date cannot be placed, and a typed date moves it", async () => {
    const w = await at("2026-10-16T09:00:00Z");
    await typeInto(w, dateBox(), "soon");
    expect(slider()).toBeDisabled();
    await typeInto(w, dateBox(), "1972-01-11T12:00:00Z");
    expect(slider()).toBeEnabled();
    expect(slider()).toHaveValue("10");
  });

  it("keeps the same table and plates while it moves", async () => {
    await at("2026-10-16T09:00:00Z");
    for (const day of [0, 5000, 10000, 20228]) {
      setRange(slider(), day);
      expect(tableRows()).toHaveLength(INSERTION_ROWS);
      expect(screen.getAllByRole("definition")).toHaveLength(9);
    }
  });
});

describe("permalinks", () => {
  it.each(TIMELINE_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await pick(first, id!);
      const link = first.permalink();
      const url = new URL(link, "https://x.test");
      expect(link).toMatch(
        new RegExp(
          `^${SITE_BASE}/tools/leap-second-timeline/\\?w=leapline&wa=`,
        ),
      );
      expect(url.search).toContain("leapline");
      const seeded = seedFromLocation(
        "leapline",
        link.slice(link.indexOf("?")),
      );
      expect(seeded).not.toBeNull();
      expect(
        Object.values(seeded as Record<string, unknown>).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      const outputs = GROUPS.map((g) => outputOf(g).textContent);
      first.destroy();

      await open(seeded as Record<string, unknown>, "second");
      expect(GROUPS.map((g) => outputOf(g).textContent)).toEqual(outputs);
      expect(presetBox()).toHaveValue(id);
    },
  );

  it("leaves blank fields out of the link", async () => {
    const w = await open();
    await pick(w, "last-insertion");
    const link = w.permalink();
    expect(seedFromLocation("leapline", link.slice(link.indexOf("?")))).toEqual(
      { date: "2016-01-01T00:00:00Z" },
    );
  });
});

describe("on-screen words", () => {
  it.each(TIMELINE_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined",
    async (id) => {
      const w = await open();
      await pick(w, id!);
      expect(document.body).not.toHaveTextContent(/\b(null|undefined)\b/);
    },
  );

  it("names no law, regulator or national lead", async () => {
    const forbidden =
      /\b(CFR|statut|regulat|docket|agency|court|America\/|en-US|NIST|USNO)\w*/i;
    const w = await open();
    for (const p of TIMELINE_PRESETS) {
      await pick(w, p.id);
      expect(document.body).not.toHaveTextContent(forbidden);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(w.permalink).toBeDefined();
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
});

describe("the links row", () => {
  const ELAPSED = "Count the real seconds between these dates";
  const CLOCKS = "Every clock on this date";
  const enabledLink = (name: string) => screen.getByRole("link", { name });
  const expectDisabled = (name: string) => {
    expect(linkNamed(name)).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
  };

  it("sends the span to Elapsed vs. Clock as start and end, and the date to the Clock Converter", async () => {
    await open();
    expect(enabledLink(ELAPSED)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("elapsed", {
        start: "2000-01-01T00:00:00Z",
        end: "2024-01-01T00:00:00Z",
      }),
    );
    expect(enabledLink(CLOCKS)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("satclock", { value: "2000-01-01T00:00:00Z" }),
    );
  });

  it("sends a backwards span as typed", async () => {
    const w = await open();
    await pick(w, "backwards");
    expect(enabledLink(ELAPSED)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("elapsed", {
        start: "2024-01-01T00:00:00Z",
        end: "2000-01-01T00:00:00Z",
      }),
    );
  });

  it("follows what is typed", async () => {
    const w = await open();
    await typeInto(w, dateBox(), "2016-01-01T00:00:00Z");
    expect(enabledLink(CLOCKS)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("satclock", { value: "2016-01-01T00:00:00Z" }),
    );
    await typeInto(w, toBox(), "2020-01-01T00:00:00Z");
    expect(enabledLink(ELAPSED)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("elapsed", {
        start: "2000-01-01T00:00:00Z",
        end: "2020-01-01T00:00:00Z",
      }),
    );
  });

  it("follows the slider's date", async () => {
    await open();
    setRange(slider(), 0);
    expect(enabledLink(CLOCKS)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("satclock", { value: "1972-01-01T00:00:00Z" }),
    );
  });

  it("disables the clocks link with no date, and the span link with no span", async () => {
    const w = await open();
    await pick(w, "backwards");
    expectDisabled(CLOCKS);
    expect(enabledLink(ELAPSED)).toBeInTheDocument();
    await typeInto(w, fromBox(), "");
    expectDisabled(ELAPSED);
  });

  it("disables the clocks link for a date before 1972", async () => {
    const w = await open();
    await pick(w, "before-1972");
    expectDisabled(CLOCKS);
  });

  it("disables both links on a second 60 that never happened", async () => {
    const w = await open();
    await pick(w, "not-inserted");
    expectDisabled(ELAPSED);
    expectDisabled(CLOCKS);
  });

  it("disables the span link for a span the library refused, and lights it again", async () => {
    const w = await open();
    await typeInto(w, fromBox(), "not a date");
    expectDisabled(ELAPSED);
    expect(enabledLink(CLOCKS)).toBeInTheDocument();
    await typeInto(w, fromBox(), "2000-01-01T00:00:00Z");
    expect(enabledLink(ELAPSED)).not.toHaveAttribute("aria-disabled");
  });

  it("lands on seeds the other tools read back", async () => {
    await open();
    const read = (name: string, kind: "elapsed" | "satclock") => {
      const href = enabledLink(name).getAttribute("href")!;
      return seedFromLocation(kind, href.slice(href.indexOf("?")));
    };
    expect(read(ELAPSED, "elapsed")).toEqual({
      start: "2000-01-01T00:00:00Z",
      end: "2024-01-01T00:00:00Z",
    });
    expect(read(CLOCKS, "satclock")).toEqual({
      value: "2000-01-01T00:00:00Z",
    });
  });
});

describe("the staircase", () => {
  it("draws the y axis and the end cap as text", async () => {
    await open();
    for (const tick of ["10", "20", "30", "37"]) {
      expect(screen.getAllByText(tick).length).toBeGreaterThan(0);
    }
    expect(
      screen.getByText("continuous UTC from 2027-05-20"),
    ).toBeInTheDocument();
  });

  it("counts the span and the checked second", async () => {
    await open();
    expect(screen.getByText("5 leap seconds counted")).toBeInTheDocument();
  });

  it("reads the cursor's date and offset", async () => {
    await open();
    expect(screen.getByText("2000-01-01 · 32 s")).toBeInTheDocument();
  });

  it("says never inserted only for a second 60 that never happened", async () => {
    const w = await open();
    expect(screen.queryByText(/never inserted/)).not.toBeInTheDocument();
    await pick(w, "not-inserted");
    expect(screen.getByText(/never inserted/)).toBeInTheDocument();
    expect(screen.queryByText(/counted$/)).not.toBeInTheDocument();
  });

  it("shows NO SIGNAL in the plot for a date before 1972, and not for a legitimate empty result", async () => {
    const w = await open();
    const lost = "⟨ NO SIGNAL — invalid input ⟩";
    expect(screen.queryByText(lost)).not.toBeInTheDocument();
    await pick(w, "after-the-table");
    expect(screen.queryByText(lost)).not.toBeInTheDocument();
    await pick(w, "before-1972");
    expect(screen.getByText(lost)).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });
});
