/**
 * @vitest-environment jsdom
 *
 * The GNSS Rollover Checker end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles, names, states and visible text the way a person (or
 * a screen reader) meets the page. Values are from a run of the built library, so a drift in
 * the library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  ROLLOVER_PRESETS,
  ROLLING_DATE_TEXT,
  readRollover,
  windowDays,
  ROLLOVER_SENTENCES,
} from "./gnss-rollover-checker";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const NOW = "2026-10-15T00:00:00Z";
const entry = WIDGET_REGISTRY["showGnssRolloverChecker"] as AnyWidgetEntry;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const COUNTERS = [
  "GPS-LNAV",
  "GPS-CNAV",
  "GAL",
  "BDT",
  "QZS-LNAV",
  "QZS-CNAV",
  "IRN-LNAV",
  "IRN-L1NV",
];

/** What each preset shows, from a run of the built library. */
const EXPECTED: Record<
  string,
  { reported: string; verdict: string; wrongFrom: string; left: string }
> = {
  "navic-built-2020": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2039-08-17T00:00:00Z",
    left: "4689 days",
  },
  "navic-built-2020-after-wrap": {
    reported: "2020-05-17T00:00:00Z",
    verdict: "a date 7168 days early",
    wrongFrom: "2039-08-17T00:00:00Z",
    left: "past by 137 days",
  },
  "qzss-built-2005": {
    reported: "2007-03-01T00:00:04Z",
    verdict: "a date 7167 days 23 h 59 min 56 s early",
    wrongFrom: "2025-01-14T23:59:55Z",
    left: "past by 638 days 5 s",
  },
  "galileo-built-2024": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2102-07-03T00:00:00Z",
    left: "27654 days",
  },
  "beidou-built-2024": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2181-01-01T00:00:00Z",
    left: "56326 days",
  },
  "navic-fixed-era": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "4419 days 23 h 59 min 42 s",
  },
  "navic-fixed-era-after-2038": {
    reported: "2019-05-18T00:00:00Z",
    verdict: "a date 7168 days early",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "past by 41 days 18 s",
  },
  "galileo-fixed-first-wrap": {
    reported: "1999-08-31T00:00:05Z",
    verdict: "a date 28671 days 23 h 59 min 55 s early",
    wrongFrom: "2078-02-19T23:59:42Z",
    left: "past by 9 days 18 s",
  },
  "gps-lnav-fixed-era": {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2038-11-20T23:59:42Z",
    left: "4419 days 23 h 59 min 42 s",
  },
  "firmware-ahead": {
    reported: "2046-05-31T00:00:00Z",
    verdict: "a date 7168 days late",
    wrongFrom: "2058-07-06T23:59:42Z",
    left: "11587 days 23 h 59 min 42 s",
  },
  today: {
    reported: "2026-10-15T00:00:00Z",
    verdict: "the right date",
    wrongFrom: "2102-07-03T00:00:00Z",
    left: "27654 days",
  },
};

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });

// The controls, by the names a person reads.
const preset = () => screen.getByRole("combobox", { name: "Preset" });
const counter = () => screen.getByRole("combobox", { name: "Counter" });
const pivotBox = () =>
  screen.getByRole("textbox", { name: "Built on or after (UTC instant)" });
const eraBox = () =>
  screen.getByRole("textbox", { name: "Era the firmware assumes" });
const dateBox = () =>
  screen.getByRole("textbox", { name: "Date to check (UTC instant)" });
const slider = () =>
  screen.getByRole("slider", {
    name: "Slide the date through the firmware's window",
  });
const radio = (name: string) => screen.getByRole("radio", { name });

async function enter(w: Widget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

const output = () => screen.getByLabelText("What the calls returned");
const calls = () => screen.getByRole("group", { name: "Calls made" });
const reason = () =>
  screen.queryByRole("complementary", { name: "Why there is no result" });
const status = () => screen.getByRole("status", { name: "Reading summary" });
const countdown = () => screen.getByRole("figure");
const marks = () => screen.getByRole("list", { name: "Marks on the timeline" });
const fuse = () => screen.getByRole("img", { name: /Fuse timeline|No window/ });

const table = () =>
  screen.getByRole("table", { name: "When each counter next wraps" });
const bodyRows = () =>
  within(table())
    .getAllByRole("row")
    .filter((r) => within(r).queryAllByRole("columnheader").length === 0);
const rowOf = (name: string) =>
  bodyRows().find((r) =>
    within(r).queryByRole("rowheader", { name: new RegExp(`^${name}\\b`) }),
  )!;

/** The shown definitions of the two plates: reports value and line, wrong-from value and line. */
const defs = () => screen.getAllByRole("definition");

describe("renderGnssRolloverCheckerTemplate", () => {
  it("is a named region with four numbered sections and the controls a person needs", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "GNSS Rollover Checker" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Describe the receiver",
      "2. Where the firmware goes wrong",
      "3. When each counter next wraps",
      "4. What the library returns",
    ]);
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    await expectNoAxeViolations(document.body);
  });

  it("opens on the first preset, checked on a date, with all eight counters", async () => {
    await open();
    expect(preset()).toHaveValue(ROLLOVER_PRESETS[0]!.id);
    expect(radio("Build date")).toBeChecked();
    expect(radio("A date")).toBeChecked();
    expect(bodyRows()).toHaveLength(8);
    COUNTERS.forEach((c, i) =>
      expect(within(bodyRows()[i]!).getByRole("rowheader")).toHaveTextContent(
        new RegExp(`^${c}`),
      ),
    );
  });
});

describe("the presets", () => {
  it.each(Object.keys(EXPECTED))("reads %s", async (id) => {
    const w = await open();
    await w.user.selectOptions(preset(), id);
    const e = EXPECTED[id]!;
    expect(defs()[0]).toHaveTextContent(e.reported);
    expect(defs()[1]).toHaveTextContent(e.verdict);
    expect(defs()[2]).toHaveTextContent(e.wrongFrom);
    expect(countdown()).toHaveTextContent(e.left.replace(/^past by /, ""));
    expect(status()).toHaveTextContent(/./);
    expect(reason()).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("names the verdict in words for every reading", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "navic-built-2020");
    expect(screen.getByText("Reports the right date")).toBeInTheDocument();
    await w.user.selectOptions(preset(), "navic-built-2020-after-wrap");
    expect(
      screen.getByText("Reports a date 7168 days early"),
    ).toBeInTheDocument();
    await w.user.selectOptions(preset(), "firmware-ahead");
    expect(
      screen.getByText("Reports a date 7168 days late"),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("captions the countdown Past by once the window has closed", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "navic-built-2020");
    expect(countdown()).toHaveTextContent(/^Time left/);
    await w.user.selectOptions(preset(), "navic-built-2020-after-wrap");
    expect(countdown()).toHaveTextContent(/^Past by/);
    await expectNoAxeViolations(w.root);
  });
});

describe("the table of counters", () => {
  it("lists all eight, marking the receiver's own and the next to wrap", async () => {
    await open({ preset: "navic-built-2020" });
    expect(bodyRows()).toHaveLength(8);
    expect(rowOf("IRN-LNAV")).toHaveTextContent("your receiver");
    expect(rowOf("GPS-LNAV")).toHaveTextContent("next to wrap");
    expect(rowOf("GAL")).toHaveTextContent("weeks below 4096");
    expect(rowOf("BDT")).toHaveTextContent("2163-01-01T23:59:56Z");
  });

  it("says the rolling row's words under the table", async () => {
    await open({ preset: "navic-built-2020" });
    expect(screen.getByText(/^rolling reads /)).toBeInTheDocument();
  });

  it("keeps all eight rows when the reading goes to NO SIGNAL", async () => {
    const w = await open();
    await enter(w, pivotBox(), "nonsense");
    expect(bodyRows()).toHaveLength(8);
    expect(cellsInColumn(table(), "Counter")).toHaveLength(8);
    await expectNoAxeViolations(w.root);
  });
});

describe("the fuse timeline", () => {
  it("is one named image that says the reading in words", async () => {
    await open({ preset: "navic-built-2020" });
    expect(fuse()).toHaveAccessibleName(
      /^Fuse timeline of the IRN-LNAV counter/,
    );
  });

  it("lists five marks, the first the build date", async () => {
    await open({ preset: "navic-built-2020" });
    const items = within(marks()).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("build date 2020-01-01T00:00:00Z");
  });

  it("explains its parts in a key", async () => {
    await open({ preset: "navic-built-2020" });
    const key = screen.getByRole("list", { name: "Key to the timeline" });
    expect(key).toHaveTextContent("reads the right date");
    expect(key).toHaveTextContent("wrong from");
    expect(key).toHaveTextContent("next wrap");
  });
});

describe("NO SIGNAL", () => {
  it.each([
    ["pivot", ROLLOVER_SENTENCES.pivot],
    ["date", ROLLOVER_SENTENCES.date],
    ["era", ROLLOVER_SENTENCES.era],
  ])("says why, in words, for a bad %s", async (field, sentence) => {
    const w = await open();
    if (field === "pivot") {
      await enter(w, pivotBox(), "nonsense");
    } else if (field === "era") {
      await w.user.click(radio("Fixed era"));
      await enter(w, eraBox(), "x");
    } else {
      await w.user.click(radio("A date"));
      await enter(w, dateBox(), "nonsense");
    }
    expect(reason()).toHaveTextContent(sentence);
    expect(output()).toHaveTextContent(/NO SIGNAL/);
    await expectNoAxeViolations(w.root);
  });

  it("is not NO SIGNAL for a blank field, which only asks for the value", async () => {
    const w = await open();
    await enter(w, pivotBox(), "");
    expect(reason()).not.toBeInTheDocument();
    expect(
      screen.getByText("Type the build date to check a receiver."),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("the form", () => {
  it("shows Custom when a field no longer matches a preset", async () => {
    const w = await open();
    await enter(w, pivotBox(), "2021-02-03T00:00:00Z");
    expect(preset()).toHaveValue("custom");
    await w.user.selectOptions(preset(), "navic-built-2020");
    expect(pivotBox()).toHaveValue("2020-01-01T00:00:00Z");
  });

  it("shows the build date field or the era field, not both", async () => {
    const w = await open();
    expect(pivotBox()).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: "Era the firmware assumes" }),
    ).not.toBeInTheDocument();
    await w.user.click(radio("Fixed era"));
    expect(eraBox()).toBeVisible();
    expect(
      screen.queryByRole("textbox", {
        name: "Built on or after (UTC instant)",
      }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("carries the instant being watched into the date field when switching to a date", async () => {
    const w = await open({ preset: "today" });
    await w.user.click(radio("A date"));
    expect(dateBox()).toHaveValue(NOW);
    await expectNoAxeViolations(w.root);
  });

  it("changes the counter", async () => {
    const w = await open();
    await w.user.selectOptions(counter(), "GAL");
    expect(preset()).toHaveValue("custom");
    expect(rowOf("GAL")).toHaveTextContent("your receiver");
    await expectNoAxeViolations(w.root);
  });
});

describe("the date slider", () => {
  it("is offered only when a date is checked", async () => {
    const w = await open({ preset: "today" });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    await w.user.click(radio("A date"));
    expect(slider()).toBeEnabled();
    await expectNoAxeViolations(w.root);
  });

  it("writes the day it stops on into the date field and reads it back", async () => {
    const w = await open({ preset: "navic-built-2020" });
    await w.user.click(radio("A date"));
    const read = readRollover(
      lib,
      {
        counter: "IRN-LNAV",
        model: "pivot",
        pivot: "2020-01-01T00:00:00Z",
        era: "0",
        nowMode: "date",
        date: NOW,
      },
      NOW,
    );
    const days = windowDays(lib, read)!;
    expect(slider()).toHaveAttribute("max", String(days));
    setRange(slider(), 10);
    expect(dateBox()).toHaveValue("2020-01-11T00:00:00Z");
    expect(slider()).toHaveValue("10");
    await expectNoAxeViolations(w.root);
  });

  it("moves with a typed date, its typed equivalent", async () => {
    const w = await open({ preset: "navic-built-2020" });
    await w.user.click(radio("A date"));
    await enter(w, dateBox(), "2020-01-21T00:00:00Z");
    expect(slider()).toHaveValue("20");
    await expectNoAxeViolations(w.root);
  });
});

describe("the live clock", () => {
  it("ticks once a second in Today mode and stops for a date", async () => {
    const w = await open({ preset: "today" });
    expect(vi.getTimerCount()).toBe(1);
    await w.user.click(radio("A date"));
    expect(vi.getTimerCount()).toBe(0);
    await w.user.click(radio("Today"));
    expect(vi.getTimerCount()).toBe(1);
  });

  it("keeps the announcement still between ticks", async () => {
    await open({ preset: "today" });
    const before = status().textContent ?? "";
    vi.advanceTimersByTime(3000);
    expect(status()).toHaveTextContent(before, { normalizeWhitespace: false });
    expect(status()).toHaveTextContent(
      /^Today, a GAL receiver reports the right date\./,
    );
  });

  it("speaks again when the verdict changes", async () => {
    const w = await open({ preset: "today" });
    const before = status().textContent ?? "";
    await w.user.selectOptions(preset(), "navic-built-2020-after-wrap");
    expect(status()).not.toHaveTextContent(before, {
      normalizeWhitespace: false,
    });
  });

  it("states the date for a pinned date", async () => {
    await open({ preset: "navic-built-2020-after-wrap" });
    expect(status()).toHaveTextContent(/2040/);
  });
});

describe("seeding and permalinks", () => {
  it("seeds a chat call's values and paints them on the first frame", async () => {
    await open({ counter: "GAL", firmwareNotBefore: "2024-01-01T00:00:00Z" });
    expect(counter()).toHaveValue("GAL");
    expect(pivotBox()).toHaveValue("2024-01-01T00:00:00Z");
  });

  it.each(ROLLOVER_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink",
    async (id) => {
      const first = await open();
      await first.user.selectOptions(preset(), id!);
      const url = first.permalink();
      expect(url).toMatch(
        new RegExp(
          `^${SITE_BASE}/tools/gnss-rollover-checker/\\?w=rollover&wa=`,
        ),
      );
      const seeded = seedFromLocation("rollover", url.slice(url.indexOf("?")))!;
      expect(encodeWidgetPermalink("rollover", seeded)).toBe(url);
      const sentinel = reason() !== null;
      first.destroy();

      const second = await open(seeded);
      expect(preset()).toHaveValue(id);
      expect(reason() !== null).toBe(sentinel);
      expect(second.permalink()).toBe(url);
    },
  );

  it("writes a custom check with its date", async () => {
    const w = await open();
    await w.user.selectOptions(counter(), "GAL");
    await enter(w, pivotBox(), "2023-03-03T00:00:00Z");
    await w.user.click(radio("A date"));
    await enter(w, dateBox(), "2030-01-01T00:00:00Z");
    const url = w.permalink();
    expect(seedFromLocation("rollover", url.slice(url.indexOf("?")))).toEqual({
      counter: "GAL",
      firmwareNotBefore: "2023-03-03T00:00:00Z",
      date: "2030-01-01T00:00:00Z",
    });
  });

  it("writes a fixed era for today without a date", async () => {
    const w = await open();
    await w.user.click(radio("A date"));
    await w.user.click(radio("Today"));
    await w.user.click(radio("Fixed era"));
    await enter(w, eraBox(), "3");
    const url = w.permalink();
    const seeded = seedFromLocation("rollover", url.slice(url.indexOf("?")))!;
    expect(seeded["firmwareEra"]).toBe("3");
    expect(seeded["date"]).toBeUndefined();
  });
});

describe("on-screen words", () => {
  it("never says null or names a system's own jargon", async () => {
    const w = await open();
    for (const id of ROLLOVER_PRESETS.map((p) => p.id)) {
      await w.user.selectOptions(preset(), id);
      const text = w.root.textContent ?? "";
      expect(text).not.toMatch(/\bnull\b|GPS rollover|GLONASS|Moscow|UTC\+3/);
    }
  });

  it("shows the calls the reading made", async () => {
    await open({ preset: "navic-built-2020" });
    for (const name of [
      "utcToGnssWeek",
      "gnssWeekToUtc",
      "diffUtcAsDuration",
      "areUtcEqual",
    ]) {
      expect(calls()).toHaveTextContent(name);
    }
  });

  it("shows the rolling read when today is checked", async () => {
    await open({ preset: "today" });
    expect(calls()).toHaveTextContent(/rolling/);
  });

  it("says the rolling row is the device's own clock when a date is checked", async () => {
    const w = await open({ preset: "navic-built-2020" });
    await w.user.click(radio("A date"));
    expect(screen.getByText(ROLLING_DATE_TEXT)).toBeInTheDocument();
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert and runs no timer", async () => {
    const w = await renderWidget(entry, { aborted: true });
    expect(vi.getTimerCount()).toBe(0);
    w.destroy();
    w.destroy();
  });

  it("clears the timer on destroy", async () => {
    const w = await open({ preset: "today" });
    expect(vi.getTimerCount()).toBe(1);
    w.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("two checkers on one page keep separate controls", async () => {
    const a = await renderWidget(entry, { idPrefix: "a" });
    const b = await renderWidget(entry, { idPrefix: "b" });
    await a.user.selectOptions(
      within(a.root).getByRole("combobox", { name: "Preset" }),
      "galileo-built-2024",
    );
    expect(
      within(b.root).getByRole("combobox", { name: "Preset" }),
    ).toHaveValue(ROLLOVER_PRESETS[0]!.id);
  });
});

describe("the links row", () => {
  const ERAS = "See every era of this reading";

  it("sends the reading to the Week Decoder with the firmware's own form", async () => {
    await open({ preset: "navic-built-2020" });
    const href = screen.getByRole("link", { name: ERAS }).getAttribute("href")!;
    const seeded = seedFromLocation("gnssweek", href.slice(href.indexOf("?")))!;
    expect(seeded["mode"]).toBe("broadcast");
    expect(seeded["counter"]).toBe("IRN-LNAV");
    expect(seeded["rolloverNotBefore"]).toBe("2020-01-01T00:00:00Z");
  });

  it("sends a fixed era as rolloverEra", async () => {
    await open({ preset: "navic-fixed-era" });
    const href = screen.getByRole("link", { name: ERAS }).getAttribute("href")!;
    const seeded = seedFromLocation("gnssweek", href.slice(href.indexOf("?")))!;
    expect(seeded["rolloverEra"]).toBe("1");
  });

  it("is disabled on NO SIGNAL and lights again for a reading", async () => {
    const w = await open();
    await enter(w, pivotBox(), "nonsense");
    expect(screen.queryByRole("link", { name: ERAS })).not.toBeInTheDocument();
    expect(screen.getByText(ERAS)).toHaveAttribute("aria-disabled", "true");
    await enter(w, pivotBox(), "2020-01-01T00:00:00Z");
    expect(screen.getByRole("link", { name: ERAS })).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("the length cap", () => {
  it("stops the date field at 64 characters", async () => {
    const w = await open();
    const box = dateBox();
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(72));
    expect(box).toHaveValue("x".repeat(64));
  });
});
