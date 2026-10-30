/**
 * @vitest-environment jsdom
 *
 * The GNSS Week Decoder end to end: template -> mount -> interact -> assert,
 * against the real `@northguild/gmt`, through roles and accessible names the way
 * a person (or a screen reader) meets the page. Values are from a run of the
 * built library, so a drift in the library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { NO_RESULT } from "~/widgets/builders";
import { lib } from "~/test/gnss-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { GNSS_WEEK_COUNTERS } from "./gnss-names";
import {
  GNSS_PRESETS,
  SECONDS_PER_WEEK,
  lastWeekOf,
} from "./gnss-week-decoder";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showGnssWeekDecoder"] as AnyWidgetEntry;

const UTC: Record<string, string> = {
  "galileo-2019": "2019-04-07T00:00:00Z",
  "lnav-2024": "2024-01-01T00:00:00Z",
  "not-before-2020": "2024-01-01T00:00:00Z",
  "same-reading-two-dates": "1981-12-05T23:59:59Z",
  "second-rollover": "2019-04-06T23:59:42Z",
  "third-rollover": "2038-11-20T23:59:42Z",
  "nearest-today": "2024-01-01T00:00:00Z",
  "cnav-2024": "2024-01-01T00:00:00Z",
  "beidou-2024": "2024-01-01T00:00:00Z",
  "leap-second": "2016-12-31T23:59:60Z",
  "rinex-navic": "2024-01-01T00:00:00Z",
  "rinex-leap-second": "2016-12-31T23:59:60Z",
  "utc-2019-rollover": "2019-04-07T00:00:00Z",
  "utc-2024": "2024-01-01T00:00:00Z",
};
const SENTINEL = new Set([
  "week-past-the-counter",
  "utc-before-galileo",
  "utc-no-leap-second",
]);

/** The seventeen result lines of `utc-before-galileo`, from a run of the
 *  library: 1999-08-21T23:59:46Z is before Galileo's first week. */
const GALILEO_1999_RESULTS = [
  "NO SIGNAL",
  "NO SIGNAL",
  "NO SIGNAL",
  "false",
  "{ week: 1023, timeOfWeekSeconds: 604799, era: 0 }",
  "{ week: 1023, timeOfWeekSeconds: 604799, era: 0 }",
  "NO SIGNAL",
  "NO SIGNAL",
  "{ week: 1023, timeOfWeekSeconds: 604799, era: 0 }",
  "{ week: 1023, timeOfWeekSeconds: 604799, era: 0 }",
  "NO SIGNAL",
  "NO SIGNAL",
  "{ week: 1023, timeOfWeekSeconds: 604799 }",
  "NO SIGNAL",
  "NO SIGNAL",
  "{ week: 1023, timeOfWeekSeconds: 604799 }",
  "NO SIGNAL",
];

const CLOCKS = "Every satellite clock at this moment";
const ROLLOVER = "Is a receiver on this counter affected, and when?";

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });

// The controls, by the names a person reads.
const preset = () => screen.getByRole("combobox", { name: "Preset" });
const counter = () => screen.getByRole("combobox", { name: "Counter" });
const system = () => screen.getByRole("combobox", { name: "RINEX system" });
const eraMode = () => screen.getByRole("combobox", { name: "Which era" });
const weekBox = () => screen.getByRole("textbox", { name: "Week" });
const towBox = () =>
  screen.getByRole("textbox", { name: "Time of week (seconds)" });
const eraBox = () => screen.getByRole("textbox", { name: "Era number" });
const weekSlider = () => screen.getByRole("slider", { name: "Slide the week" });
const towSlider = () =>
  screen.getByRole("slider", { name: "Slide the time of week" });
const mode = (name: "Broadcast week" | "RINEX week" | "UTC instant") =>
  screen.getByRole("radio", { name });

/** Replaces what a text box holds, in one input event. */
async function enter(w: Widget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

const output = () => screen.getByLabelText("What the calls returned");
const calls = () => screen.getByRole("group", { name: "Calls made" });
const lines = (el: HTMLElement) => (el.textContent ?? "").split("\n");

/** The first line under a plate's caption: the value the plate shows. */
function plateValue(caption: string): string {
  const term = screen.getAllByText(caption, { selector: "dt span" })[0]!;
  return term.closest("dt")!.nextElementSibling!.firstElementChild!
    .textContent!;
}

const LANE = /^(era \d+|[A-Z][A-Z0-9-]*): /;
const lanes = () =>
  screen.getAllByRole("group").filter((g) => LANE.test(g.ariaLabel ?? ""));
const laneName = (g: HTMLElement) => g.ariaLabel!.split(": ")[0]!;
const laneValue = (g: HTMLElement) =>
  g.ariaLabel!.slice(g.ariaLabel!.indexOf(": ") + 2).replace(/ \(.*\)$/, "");
const laneValues = () => lanes().map(laneValue);

const drawing = () =>
  screen
    .getAllByRole("group")
    .find((g) =>
      /odometer ring|unwrapped track|No counter/.test(g.ariaLabel!),
    )!;

const reason = () =>
  screen.queryByRole("complementary", { name: "Why there is no result" });

const bodyRows = (table: string) =>
  within(screen.getByRole("table", { name: table }))
    .getAllByRole("row")
    .slice(1);
const COUNTERS = "The moment on every broadcast counter";
const RINEX = "The moment on every RINEX system";
const rowCells = (row: HTMLElement) =>
  [
    ...within(row).queryAllByRole("rowheader"),
    ...within(row).queryAllByRole("cell"),
  ].map((c) => c.textContent);
const readingRows = (table: string) =>
  bodyRows(table).filter((r) => /your reading/.test(r.textContent!));

const hubText = (text: string | RegExp) =>
  screen.getAllByText(text, { selector: "text" });

const isLinkOpen = (name: string) =>
  screen.queryByRole("link", { name }) !== null;
const linkHref = (name: string) =>
  screen.getByRole("link", { name }).getAttribute("href");
const closedLink = (name: string) => {
  const el = screen.getByText(name);
  return {
    disabled: el.getAttribute("aria-disabled"),
    href: el.getAttribute("href"),
  };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2026-10-15T00:00:00Z");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("renderGnssWeekDecoderTemplate", () => {
  const render = (idPrefix = "t", args = {}) =>
    renderWidget(entry, { args, idPrefix });

  it("is a named region with four numbered sections, three plates and both tables", async () => {
    await render();
    expect(
      screen.getByRole("region", { name: "GNSS Week Decoder" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Say which week you have",
      "2. Read it",
      "3. The same moment on every counter",
      "4. What the library returns",
    ]);
    expect(screen.getAllByRole("term")).toHaveLength(3);
    expect(bodyRows(COUNTERS)).toHaveLength(8);
    expect(bodyRows(RINEX)).toHaveLength(5);
  });

  it("opens on the first preset's controls, each with a name its prefix-scoped label gives", async () => {
    await render("rail-7");
    expect(preset()).toHaveValue("galileo-2019");
    expect(weekBox()).toHaveValue("1024");
    expect(
      screen.queryByRole("textbox", { name: "UTC instant" }),
    ).not.toBeInTheDocument();
    // Labels reach their controls through ids, so a wrong prefix leaves a control unnamed.
    for (const role of ["combobox", "textbox", "radio", "slider"] as const) {
      for (const control of screen.getAllByRole(role)) {
        expect(control).toHaveAccessibleName(/\S/);
      }
    }
  });

  it("shows a hostile seed as text, never as elements", async () => {
    await render("t", {
      week: '"><img src=x onerror=alert(1)>',
      timeOfWeekSeconds: "<script>x</script>",
      utc: '"><svg onload=alert(1)>',
      rolloverNotBefore: "<b>x</b>",
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect([...Object.keys(UTC), ...SENTINEL].sort()).toEqual(
      GNSS_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(GNSS_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await w.user.selectOptions(preset(), id!);
    expect(preset()).toHaveValue(id);
    expect(screen.getAllByRole("term")).toHaveLength(3);
    if (id === "utc-before-galileo") {
      // Galileo had no signal in 1999: the calls that refused print NO SIGNAL
      // and every other call keeps its own result, line for line.
      expect(lines(output())).toEqual(GALILEO_1999_RESULTS);
      expect(lines(output())).toHaveLength(lines(calls()).length);
      expect(within(output()).getAllByText("NO SIGNAL")).toHaveLength(10);
      expect(reason()).toHaveTextContent(/\S/);
      w.destroy();
      return;
    }
    if (SENTINEL.has(id!)) {
      expect(output()).toHaveTextContent(/^NO SIGNAL$/);
      expect(reason()).toHaveTextContent(/\S/);
      w.destroy();
      return;
    }
    expect(plateValue("UTC")).toBe(UTC[id!]);
    expect(reason()).toBeNull();
    expect(calls()).toHaveTextContent("gnss");
    expect(lines(output())).toHaveLength(lines(calls()).length);
    w.destroy();
  });
});

describe("a null result", () => {
  it("shows NO SIGNAL with the library's sentence, plates that read no result and no lanes", async () => {
    await open({ preset: "week-past-the-counter" });
    expect(output()).toHaveTextContent(/^NO SIGNAL$/);
    expect(reason()).toHaveTextContent("This counter shows weeks below 1024.");
    for (const caption of ["UTC", "RINEX week"]) {
      expect(plateValue(caption)).toBe(NO_RESULT);
    }
    expect(lanes()).toHaveLength(0);
  });

  it("is a different sentence for each reason the library refuses", async () => {
    const w = await open({ preset: "lnav-2024" });
    const sentences = new Set<string>();
    for (const [box, value] of [
      [weekBox, "x"],
      [towBox, "604800"],
      [eraBox, "x"],
      [eraBox, "99999999"],
    ] as const) {
      await enter(w, box(), value);
      expect(output()).toHaveTextContent(/^NO SIGNAL$/);
      sentences.add(reason()!.textContent!);
      await w.user.selectOptions(preset(), "lnav-2024");
    }
    expect(sentences.size).toBe(4);
  });
});

describe("a lane the counter cannot show is a result, not a no-signal", () => {
  it("draws no pin for it and no NO SIGNAL", async () => {
    await open({ preset: "rinex-navic" });
    expect(within(output()).queryByText("NO SIGNAL")).not.toBeInTheDocument();
    expect(laneValues()).toEqual([
      "2024-01-01T00:00:00Z",
      "no result",
      "2043-08-17T00:00:00Z",
    ]);
    expect(within(output()).queryByText("NO SIGNAL")).not.toBeInTheDocument();
  });
});

describe("the form", () => {
  it("opens on the first preset", async () => {
    await open();
    expect(preset()).toHaveValue("galileo-2019");
    expect(plateValue("UTC")).toBe("2019-04-07T00:00:00Z");
    expect(laneValues()).toEqual([
      "2019-04-07T00:00:00Z",
      "2097-10-06T00:00:00Z",
    ]);
  });

  it("makes the preset custom when a field changes", async () => {
    const w = await open();
    await enter(w, weekBox(), "1025");
    expect(preset()).toHaveValue("custom");
    await enter(w, weekBox(), "1024");
    expect(preset()).toHaveValue("galileo-2019");
  });

  it("shows only the fields a mode reads", async () => {
    const w = await open();
    const visible = () =>
      [
        ["combobox", "Counter"],
        ["combobox", "RINEX system"],
        ["textbox", "Week"],
        ["slider", "Slide the week"],
        ["textbox", "Time of week (seconds)"],
        ["slider", "Slide the time of week"],
        ["combobox", "Which era"],
        ["textbox", "Era number"],
        ["textbox", "On or after (UTC instant)"],
        ["textbox", "UTC instant"],
      ]
        .filter(
          ([role, name]) =>
            screen.queryByRole(role as "textbox", { name: name! }) !== null,
        )
        .map(([, name]) => name);
    expect(visible()).toEqual([
      "Counter",
      "Week",
      "Slide the week",
      "Time of week (seconds)",
      "Slide the time of week",
      "Which era",
      "Era number",
    ]);
    await w.user.click(mode("RINEX week"));
    expect(visible()).toEqual([
      "RINEX system",
      "Week",
      "Time of week (seconds)",
      "Slide the time of week",
    ]);
    await w.user.click(mode("UTC instant"));
    expect(visible()).toEqual(["Counter", "UTC instant"]);
    await w.user.click(mode("Broadcast week"));
    await w.user.selectOptions(eraMode(), "notBefore");
    expect(visible()).toEqual([
      "Counter",
      "Week",
      "Slide the week",
      "Time of week (seconds)",
      "Slide the time of week",
      "Which era",
      "On or after (UTC instant)",
    ]);
  });

  it("carries the moment across a change of mode", async () => {
    const w = await open({ preset: "lnav-2024" });
    await w.user.click(mode("UTC instant"));
    expect(screen.getByRole("textbox", { name: "UTC instant" })).toHaveValue(
      "2024-01-01T00:00:00Z",
    );
    expect(plateValue("UTC")).toBe("2024-01-01T00:00:00Z");
    await w.user.click(mode("RINEX week"));
    // RINEX counts one continuous week: 2024-01-01 is week 2295, not 247.
    expect(weekBox()).toHaveValue("2295");
    expect(towBox()).toHaveValue("86418");
    expect(system()).toHaveValue("GPS");
    expect(plateValue("UTC")).toBe("2024-01-01T00:00:00Z");
  });

  it("carries a RINEX week back to the counter's own week and era", async () => {
    const w = await open({ preset: "rinex-navic" });
    await w.user.click(mode("Broadcast week"));
    expect(weekBox()).not.toHaveValue("2295");
    expect(plateValue("UTC")).toBe("2024-01-01T00:00:00Z");
    expect(reason()).toBeNull();
    expect(weekBox()).toHaveValue(
      String(lib.utcToGnssWeek("IRN-LNAV", "2024-01-01T00:00:00Z")!.week),
    );
  });

  it("moves the reading's counter when the RINEX system changes", async () => {
    const w = await open({ preset: "rinex-navic" });
    expect(readingRows(COUNTERS).map((r) => rowCells(r)[0])).toEqual([
      "IRN-LNAV (your reading)",
    ]);
    await w.user.selectOptions(system(), "GAL");
    const marked = readingRows(COUNTERS).map((r) => rowCells(r)[0]!);
    expect(marked).toHaveLength(1);
    expect(marked[0]!.startsWith("GAL")).toBe(true);
  });

  it("draws the reading's era among the lanes when it is further out than today's", async () => {
    await open({
      preset: "lnav-2024",
      week: "0",
      timeOfWeekSeconds: "0",
      rolloverEra: "4",
    });
    expect(lanes().map(laneName)).toContain("era 4");
    expect(
      lanes()
        .filter((g) => /your reading/.test(g.ariaLabel!))
        .map(laneName),
    ).toEqual(["era 4"]);
    expect(hubText("0")).not.toHaveLength(0);
  });

  it("reads the same moment on every counter", async () => {
    await open({ preset: "utc-2019-rollover" });
    const rows = bodyRows(COUNTERS);
    expect(rows).toHaveLength(8);
    const row = (name: string) =>
      rowCells(rows.find((r) => rowCells(r)[0]!.startsWith(name))!);
    expect(row("GPS-LNAV")[0]).toContain("your reading");
    expect(row("GPS-LNAV").slice(1)).toEqual(["0", "18", "2"]);
    expect(row("GPS-CNAV").slice(1, 2)).toEqual(["2048"]);
    expect(row("GAL").slice(1, 2)).toEqual(["1024"]);
    expect(readingRows(COUNTERS)).toHaveLength(1);
  });

  it("says no result in a cell the library gave none for, and why under the table", async () => {
    await open({ preset: "same-reading-two-dates" });
    const gal = bodyRows(COUNTERS).find((r) =>
      rowCells(r)[0]!.startsWith("GAL"),
    )!;
    expect(gal).toHaveTextContent("no result");
    expect(
      screen.getByText("No reading: before this system's first week."),
    ).toBeInTheDocument();
  });

  it("keeps the table rows when a reading goes to NO SIGNAL", async () => {
    const w = await open({ preset: "lnav-2024" });
    await enter(w, weekBox(), "x");
    expect(bodyRows(COUNTERS)).toHaveLength(8);
    expect(bodyRows(RINEX)).toHaveLength(5);
  });
});

describe("the sliders", () => {
  it("ends the week slider at each counter's last week and the time-of-week slider at the end of the week", async () => {
    const w = await open();
    for (const c of GNSS_WEEK_COUNTERS) {
      await w.user.selectOptions(counter(), c);
      const week = weekSlider();
      expect(week).toHaveAttribute("min", "0");
      expect(week).toHaveAttribute("step", "1");
      expect(week).toHaveAttribute("max", String(lastWeekOf(lib, c)));
      expect(week).toBeEnabled();
      // The last stop reads; the one past it is the library's refusal.
      expect(lib.gnssWeekToUtc(c, lastWeekOf(lib, c), 0, 0)).not.toBe("");
      expect(lib.gnssWeekToUtc(c, lastWeekOf(lib, c) + 1, 0, 0)).toBe("");
    }
    const tow = towSlider();
    expect(tow).toHaveAttribute("min", "0");
    expect(tow).toHaveAttribute("step", "1");
    expect(tow).toHaveAttribute("max", String(SECONDS_PER_WEEK - 1));
    // The last counter's last week is the label at the week range's far end.
    expect(
      screen.getAllByText(String(lastWeekOf(lib, "IRN-L1NV"))).length,
    ).toBeGreaterThan(0);
  });

  it("follows the counter when it changes the range of weeks", async () => {
    const w = await open({ preset: "lnav-2024" });
    expect(weekSlider()).toHaveAttribute("max", "1023");
    await w.user.selectOptions(counter(), "GPS-CNAV");
    expect(weekSlider()).toHaveAttribute("max", "8191");
  });

  it("starts at the typed week and time of week", async () => {
    await open({ preset: "lnav-2024" });
    expect(weekSlider()).toHaveValue("247");
    expect(towSlider()).toHaveValue("86418");
    expect(weekSlider()).toHaveAccessibleName("Slide the week");
    expect(weekSlider()).toHaveAttribute("aria-valuetext", "week 247");
    expect(towSlider()).toHaveAttribute("aria-valuetext", "86418 s");
  });

  it("writes a dragged stop into the typed field and reads again", async () => {
    await open({ preset: "lnav-2024" });
    setRange(weekSlider(), 500);
    expect(weekBox()).toHaveValue("500");
    expect(preset()).toHaveValue("custom");
    expect(weekSlider()).toHaveAttribute("aria-valuetext", "week 500");
    const afterWeek = plateValue("UTC");
    expect(afterWeek).not.toBe("2024-01-01T00:00:00Z");
    setRange(towSlider(), 0);
    expect(towBox()).toHaveValue("0");
    expect(towSlider()).toHaveAttribute("aria-valuetext", "0 s");
    expect(plateValue("UTC")).not.toBe(afterWeek);
    // Back on the preset's own numbers, the preset is recognised again.
    setRange(weekSlider(), 247);
    setRange(towSlider(), 86418);
    expect(preset()).toHaveValue("lnav-2024");
    expect(plateValue("UTC")).toBe("2024-01-01T00:00:00Z");
  });

  it("moves to a typed value, and a fraction rounds down to the second below", async () => {
    const w = await open({ preset: "lnav-2024" });
    await enter(w, weekBox(), "700");
    expect(weekSlider()).toHaveValue("700");
    expect(weekSlider()).toHaveAttribute("aria-valuetext", "week 700");
    await enter(w, towBox(), "12345.5");
    expect(towSlider()).toHaveValue("12345");
    // The typed field keeps what was typed.
    expect(towBox()).toHaveValue("12345.5");
  });

  it("stays put for a typed value that is not a stop", async () => {
    const w = await open({ preset: "lnav-2024" });
    for (const week of ["", "x", "5000", "-1"]) {
      await enter(w, weekBox(), week);
      expect(weekSlider()).toHaveValue("247");
    }
    for (const tow of ["", "x", "604800", "-1"]) {
      await enter(w, towBox(), tow);
      expect(towSlider()).toHaveValue("86418");
    }
  });

  it("is live in the modes that read its field and hidden in the others", async () => {
    const w = await open({ preset: "lnav-2024" });
    const state = () =>
      [["Slide the week"], ["Slide the time of week"]].map(([name]) => {
        const el = screen.queryByRole("slider", { name: name! });
        return el === null
          ? "hidden"
          : (el as HTMLInputElement).disabled
            ? "disabled"
            : "live";
      });
    expect(state()).toEqual(["live", "live"]);
    await w.user.click(mode("RINEX week"));
    expect(state()).toEqual(["hidden", "live"]);
    await w.user.click(mode("UTC instant"));
    expect(state()).toEqual(["hidden", "hidden"]);
    // Hidden or not, a slider the mode does not read is switched off.
    expect(
      screen.getByRole("slider", {
        name: "Slide the time of week",
        hidden: true,
      }),
    ).toBeDisabled();
    await w.user.click(mode("Broadcast week"));
    expect(state()).toEqual(["live", "live"]);
  });

  it("turns the week slider off while no counter is picked", async () => {
    const w = await open({ preset: "lnav-2024" });
    await w.user.selectOptions(counter(), "(none)");
    expect(weekSlider()).toBeDisabled();
    expect(weekSlider()).toHaveAttribute("max", "0");
    expect(towSlider()).toBeEnabled();
  });

  it("drags the time of week in RINEX mode", async () => {
    await open({ preset: "rinex-leap-second" });
    expect(towSlider()).toHaveValue("17");
    setRange(towSlider(), 18);
    expect(towBox()).toHaveValue("18");
    expect(plateValue("UTC")).toBe("2017-01-01T00:00:00Z");
  });

  it("changes nothing but the chip and the readings while dragging", async () => {
    await open({ preset: "lnav-2024" });
    const shape = () => ({
      lanes: lanes().length,
      terms: screen.getAllByRole("term").length,
      rows: screen.getAllByRole("row").length,
      sliders: screen.getAllByRole("slider").length,
    });
    const before = shape();
    for (const v of [0, 1, 302400, 604799]) {
      setRange(towSlider(), v);
      expect(shape()).toEqual(before);
    }
  });

  it("leaves the permalink to the typed fields, so a drag and a typed value write the same one", async () => {
    const dragged = await open({ preset: "lnav-2024" });
    setRange(weekSlider(), 100);
    setRange(towSlider(), 5);
    const a = seedFromLocation(
      "gnssweek",
      dragged.permalink().slice(dragged.permalink().indexOf("?")),
    );
    dragged.destroy();
    const typed = await open({ preset: "lnav-2024" });
    await enter(typed, weekBox(), "100");
    await enter(typed, towBox(), "5");
    const b = seedFromLocation(
      "gnssweek",
      typed.permalink().slice(typed.permalink().indexOf("?")),
    );
    expect(a).toEqual(b);
    expect(a).toEqual({
      mode: "broadcast",
      week: "100",
      timeOfWeekSeconds: "5",
      counter: "GPS-LNAV",
      rolloverEra: "2",
    });
    expect(Object.keys(a!).some((k) => /slider/i.test(k))).toBe(false);
  });
});

describe("the links row", () => {
  it("has both links in the links row, in order", async () => {
    await open();
    const row = screen.getByRole("group", { name: "Other tools" });
    expect(
      within(row)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual([CLOCKS, ROLLOVER]);
  });

  it("sends the UTC result to the Clock Converter and the counter, era and date to the Rollover Checker", async () => {
    await open();
    expect(linkHref(CLOCKS)).toBe(
      encodeWidgetPermalink("satclock", { value: "2019-04-07T00:00:00Z" }),
    );
    expect(linkHref(ROLLOVER)).toBe(
      encodeWidgetPermalink("rollover", {
        counter: "GAL",
        firmwareEra: "0",
        date: "2019-04-07T00:00:00Z",
      }),
    );
  });

  it("carries a pivot as firmwareNotBefore, and the era rolling chose as firmwareEra", async () => {
    const pivot = await open({ preset: "not-before-2020" });
    expect(linkHref(ROLLOVER)).toBe(
      encodeWidgetPermalink("rollover", {
        counter: "QZS-LNAV",
        firmwareNotBefore: "2020-01-01T00:00:00Z",
        date: "2024-01-01T00:00:00Z",
      }),
    );
    pivot.destroy();
    await open({ preset: "nearest-today" });
    expect(linkHref(ROLLOVER)).toBe(
      encodeWidgetPermalink("rollover", {
        counter: "GPS-LNAV",
        firmwareEra: "2",
        date: "2024-01-01T00:00:00Z",
      }),
    );
  });

  it("follows the current reading, not the one the page opened on", async () => {
    await open({ preset: "lnav-2024" });
    setRange(weekSlider(), 100);
    setRange(towSlider(), 0);
    const utc = plateValue("UTC");
    expect(utc).toMatch(/^\d{4}-\d\d-\d\dT[\d:]+Z$/);
    expect(utc).not.toBe("2024-01-01T00:00:00Z");
    expect(linkHref(CLOCKS)).toBe(
      encodeWidgetPermalink("satclock", { value: utc }),
    );
    expect(linkHref(ROLLOVER)).toBe(
      encodeWidgetPermalink("rollover", {
        counter: "GPS-LNAV",
        firmwareEra: "2",
        date: utc,
      }),
    );
  });

  it("sends a RINEX reading to the Clock Converter only: it has no counter to send", async () => {
    await open({ preset: "rinex-navic" });
    expect(linkHref(CLOCKS)).toBe(
      encodeWidgetPermalink("satclock", { value: "2024-01-01T00:00:00Z" }),
    );
    expect(isLinkOpen(ROLLOVER)).toBe(false);
    expect(closedLink(ROLLOVER)).toEqual({ disabled: "true", href: null });
  });

  it("sends a UTC reading's counter and the era the library read", async () => {
    await open({ preset: "utc-2019-rollover" });
    expect(linkHref(CLOCKS)).toBe(
      encodeWidgetPermalink("satclock", { value: "2019-04-07T00:00:00Z" }),
    );
    expect(linkHref(ROLLOVER)).toBe(
      encodeWidgetPermalink("rollover", {
        counter: "GPS-LNAV",
        firmwareEra: "2",
        date: "2019-04-07T00:00:00Z",
      }),
    );
  });

  it.each([
    "week-past-the-counter",
    "utc-before-galileo",
    "utc-no-leap-second",
  ])("disables both links, with no href, on NO SIGNAL (%s)", async (id) => {
    await open({ preset: id });
    expect(closedLink(CLOCKS)).toEqual({ disabled: "true", href: null });
    expect(closedLink(ROLLOVER)).toEqual({ disabled: "true", href: null });
  });

  it("disables both links when nothing is typed, and lights them again when a reading returns", async () => {
    const w = await open({ preset: "lnav-2024" });
    expect(isLinkOpen(CLOCKS)).toBe(true);
    await enter(w, weekBox(), "5000");
    expect(closedLink(CLOCKS)).toEqual({ disabled: "true", href: null });
    expect(closedLink(ROLLOVER)).toEqual({ disabled: "true", href: null });
    await enter(w, weekBox(), "247");
    expect(linkHref(CLOCKS)).toBe(
      encodeWidgetPermalink("satclock", { value: "2024-01-01T00:00:00Z" }),
    );
    expect(screen.getByRole("link", { name: CLOCKS })).not.toHaveAttribute(
      "aria-disabled",
    );
  });

  it("lands on a seed the Clock Converter reads back", async () => {
    await open();
    const href = linkHref(CLOCKS)!;
    expect(seedFromLocation("satclock", href.slice(href.indexOf("?")))).toEqual(
      { value: "2019-04-07T00:00:00Z" },
    );
  });
});

describe("seeding", () => {
  it("seeds a chat call's numbers and paints them on the first frame", async () => {
    await open({
      counter: "GPS-LNAV",
      week: 247,
      timeOfWeekSeconds: 86418,
      rolloverEra: 2,
    });
    expect(preset()).toHaveValue("lnav-2024");
    expect(plateValue("UTC")).toBe("2024-01-01T00:00:00Z");
  });

  it("seeds a not-before date", async () => {
    await open({
      counter: "QZS-LNAV",
      week: "247",
      timeOfWeekSeconds: "86418",
      rolloverNotBefore: "2020-01-01T00:00:00Z",
    });
    expect(preset()).toHaveValue("not-before-2020");
    expect(eraMode()).toHaveValue("notBefore");
  });
});

describe("permalinks", () => {
  it.each(GNSS_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await first.user.selectOptions(preset(), id!);
      const url = first.permalink();
      expect(url).toMatch(
        new RegExp(`^${SITE_BASE}/tools/gnss-week-decoder/\\?w=gnssweek&wa=`),
      );
      const seeded = seedFromLocation("gnssweek", url.slice(url.indexOf("?")))!;
      expect(
        Object.values(seeded).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      expect(encodeWidgetPermalink("gnssweek", seeded)).toBe(url);
      const shown = lines(output());
      first.destroy();

      await open(seeded);
      expect(lines(output())).toEqual(shown);
      expect(preset()).toHaveValue(id);
    },
  );

  it("writes a custom reading as the keys it uses", async () => {
    const w = await open({ preset: "lnav-2024" });
    await enter(w, weekBox(), "100");
    const url = w.permalink();
    expect(seedFromLocation("gnssweek", url.slice(url.indexOf("?")))).toEqual({
      mode: "broadcast",
      week: "100",
      timeOfWeekSeconds: "86418",
      counter: "GPS-LNAV",
      rolloverEra: "2",
    });
  });
});

describe("on-screen words", () => {
  /** Everything a reader sees or hears, except the calls and what they returned. */
  function screenText(root: HTMLElement): string {
    const hidden = [calls(), output()];
    let text = root.textContent ?? "";
    for (const h of hidden) text = text.replace(h.textContent ?? "", "");
    const skip = new Set(hidden.map((h) => h.getAttribute("aria-label")));
    const labels = within(root)
      .queryAllByLabelText(/./)
      .map((e) => e.getAttribute("aria-label"))
      .filter((l): l is string => l !== null && !skip.has(l));
    return `${text}\n${labels.join("\n")}`;
  }

  it.each(GNSS_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined and names no body, zone or country",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(preset(), id!);
      const shown = screenText(w.root);
      expect(shown).not.toMatch(/\bnull\b|undefined|NaN/);
      expect(shown).not.toMatch(
        /UTC\+3|Moscow|MSK|New_York|en-US|\bGMT\b|GLONASS/,
      );
      w.destroy();
    },
  );

  it("states the reading in one hidden live sentence", async () => {
    await open({ preset: "beidou-2024" });
    expect(
      screen.getByRole("status", { name: "Reading summary" }),
    ).toHaveTextContent("BDT time 2024-01-01T00:00:04 BDT");
  });

  it("draws the counter as a ring: a lap for each era, one hand, the week in the hub", async () => {
    await open({ preset: "lnav-2024" });
    expect(drawing()).toHaveAccessibleName(
      /odometer ring of 1024 weeks on GPS-LNAV, with the hand at week 247/,
    );
    // Four laps, and the hub's own era line.
    expect(hubText(/^era \d$/)).toHaveLength(5);
    expect(hubText("247")).toHaveLength(1);
    expect(hubText("of 1024")).toHaveLength(1);
    expect(hubText("era 2")).toHaveLength(2);
    expect(
      lanes().filter((g) => /your reading/.test(g.ariaLabel!)),
    ).toHaveLength(1);
    expect(lanes().map(laneName)).toEqual(["era 0", "era 1", "era 2", "era 3"]);
  });

  it("labels the ring with the counter's own modulus", async () => {
    await open({ preset: "beidou-2024" });
    expect(hubText("of 8192")).toHaveLength(1);
    expect(
      hubText(/^\d+$/)
        .map((e) => e.textContent)
        .filter((t) => Number(t) % 1024 === 0 && t !== "939"),
    ).toEqual(["0", "1024", "2048", "3072", "4096", "5120", "6144", "7168"]);
  });

  it("moves the hand when the week slider moves", async () => {
    await open({ preset: "lnav-2024" });
    setRange(weekSlider(), 512);
    expect(hubText("512").length).toBeGreaterThan(0);
    expect(drawing()).toHaveAccessibleName(/with the hand at week 512/);
  });

  it("says NO SIGNAL in the hub, not a blank ring, and shows no hand", async () => {
    await open({ preset: "week-past-the-counter" });
    expect(hubText(/NO SIGNAL/)).toHaveLength(1);
    expect(screen.getByText(/invalid input/)).toBeInTheDocument();
    expect(hubText(/^\d+$/).map((e) => e.textContent)).not.toContain("247");
  });

  it("draws a RINEX week as an unwrapped track, not a ring", async () => {
    await open({ preset: "rinex-navic" });
    expect(drawing()).toHaveAccessibleName(/unwrapped track/);
  });

  it("names the lanes for a screen reader and nothing inside the drawing takes focus", async () => {
    await open({ preset: "lnav-2024" });
    expect(drawing()).toHaveAccessibleName(/era 2: 2024-01-01T00:00:00Z/);
    expect(lanes()).toHaveLength(4);
    expect(within(drawing()).queryAllByRole("link")).toHaveLength(0);
    expect(within(drawing()).queryAllByRole("button")).toHaveLength(0);
    expect(within(drawing()).queryAllByRole("textbox")).toHaveLength(0);
  });

  it("has two real ranges, the week and the time of week, and nothing else to drag", async () => {
    await open();
    expect(
      screen.getAllByRole("slider").map((s) => s.getAttribute("aria-label")),
    ).toEqual(["Slide the week", "Slide the time of week"]);
    for (const slider of screen.getAllByRole("slider")) {
      expect(slider.tagName).toBe("INPUT");
      expect(slider).toHaveAttribute("type", "range");
    }
  });

  it("uses real controls", async () => {
    await open();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const w = await renderWidget(entry, { aborted: true });
    expect(calls()).not.toHaveTextContent("(");
    w.destroy();
    w.destroy();
  });

  it("two decoders on one page keep separate mode groups", async () => {
    const a = await renderWidget(entry, { idPrefix: "a" });
    const b = await renderWidget(entry, { idPrefix: "b" });
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAccessibleName(/\S/);
    }
    await a.user.click(
      within(a.root).getByRole("radio", { name: "UTC instant" }),
    );
    expect(
      within(a.root).getByRole("radio", { name: "UTC instant" }),
    ).toBeChecked();
    expect(
      within(b.root).getByRole("radio", { name: "Broadcast week" }),
    ).toBeChecked();
    expect(
      within(b.root).getByRole("radio", { name: "UTC instant" }),
    ).not.toBeChecked();
  });
});

describe("accessibility", () => {
  it("has no axe violations on a reading, nor on NO SIGNAL", async () => {
    const w = await open({ preset: "lnav-2024" });
    await expectNoAxeViolations(w.root);
    await w.user.selectOptions(preset(), "week-past-the-counter");
    await expectNoAxeViolations(w.root);
  });
});
