/**
 * @vitest-environment jsdom
 *
 * The Journey Split end to end: template -> mount -> interact -> assert, against
 * the real `@northguild/gmt`, through roles and accessible names the way a person
 * (or a screen reader) meets the page. Every preset's printed calls, results,
 * plates, ribbons and table rows are checked against values a real run of the
 * library gave, and the hand-off link both ways through the Delivery Scheduler's
 * own `readArgs`, so a drift in the library or the widget fails here.
 *
 * The ribbons' geometry (where each segment, chip and bracket sits) is not a
 * thing jsdom can see; the Chromium gates own it. The ribbons' order and kinds
 * are read from the accessible names of the two `img` tracks.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import {
  permalinkOf as deliveryPermalink,
  readArgs as readDeliveryArgs,
} from "./delivery-scheduler";
import { JOURNEY_PRESETS, TABLE_COLUMNS } from "./journey-split";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showJourneySplit"] as AnyWidgetEntry;

/** What a real run of the library gave for each preset. */
interface Expected {
  /** The results, one a line, in the order the calls are printed. */
  results: string[];
  /** The calls' names, in order. */
  calls: string[];
  plates: [string, string[]][];
  /** The hand-off table: one row of five cells for each hand-off. */
  rows: string[][];
  chips: string[];
  brackets: [string, string] | null;
  /** The segment kinds on each ribbon, in order. */
  kinds: string[];
}

const DIFFS = "diffUtcAsDuration";
const CALLS3 = ["multimodalETA", "scheduleDelivery", ...Array(7).fill(DIFFS)];

const EXPECTED: Record<string, Expected> = {
  "scheduled-sailing": {
    results: [
      '{ eta: "2024-06-30T13:30:00+09:30[Australia/Adelaide]", totalLegs: 3, totalTransit: "PT400H", totalDwell: "PT84H" }',
      '{ eta: "2024-06-30T13:30:00+09:30[Australia/Adelaide]", legTimes: [{ arrival: "2024-06-10T06:00:00Z", localArrival: "2024-06-10T14:00:00+08:00[Asia/Shanghai]", dwellAfter: "PT6H", mode: "truck" }, { arrival: "2024-06-26T12:00:00Z", localArrival: "2024-06-26T22:00:00+10:00[Australia/Sydney]", dwellAfter: "PT36H", mode: "ship" }, { arrival: "2024-06-30T04:00:00Z", localArrival: "2024-06-30T13:30:00+09:30[Australia/Adelaide]", dwellAfter: "PT0S", mode: "rail" }] }',
      '"PT6H"',
      '"PT48H"',
      '"PT42H"',
      '"PT36H"',
      '"PT36H"',
      '"PT0S"',
      '"PT484H"',
    ],
    calls: CALLS3,
    plates: [
      ["Sun 30 Jun 13:30", ["Australia/Adelaide", "484 h door to door"]],
      ["16 d 16 h", ["PT400H"]],
      ["3 d 12 h", ["PT84H"]],
    ],
    rows: [
      [
        "Leg 1: Mon 10 Jun 14:00",
        "6 h",
        "Mon 10 Jun 20:00",
        "Wed 12 Jun 14:00",
        "2 d",
      ],
      [
        "Leg 2: Wed 26 Jun 22:00",
        "1 d 12 h",
        "Fri 28 Jun 10:00",
        "Fri 28 Jun 10:00",
        "1 d 12 h",
      ],
    ],
    chips: [
      "2 d: 6 h handling + 42 h for the scheduled departure",
      "1 d 12 h of handling",
    ],
    brackets: ["moving · PT400H", "waiting · PT84H"],
    kinds: ["moving", "handling", "scheduled", "moving", "handling", "moving"],
  },
  "no-schedule": {
    results: [
      '{ eta: "2024-06-28T19:30:00+09:30[Australia/Adelaide]", totalLegs: 3, totalTransit: "PT400H", totalDwell: "PT42H" }',
      '{ eta: "2024-06-28T19:30:00+09:30[Australia/Adelaide]", legTimes: [{ arrival: "2024-06-10T06:00:00Z", localArrival: "2024-06-10T14:00:00+08:00[Asia/Shanghai]", dwellAfter: "PT6H", mode: "truck" }, { arrival: "2024-06-24T18:00:00Z", localArrival: "2024-06-25T04:00:00+10:00[Australia/Sydney]", dwellAfter: "PT36H", mode: "ship" }, { arrival: "2024-06-28T10:00:00Z", localArrival: "2024-06-28T19:30:00+09:30[Australia/Adelaide]", dwellAfter: "PT0S", mode: "rail" }] }',
      '"PT6H"',
      '"PT6H"',
      '"PT0S"',
      '"PT36H"',
      '"PT36H"',
      '"PT0S"',
      '"PT442H"',
    ],
    calls: CALLS3,
    plates: [
      ["Fri 28 Jun 19:30", ["Australia/Adelaide", "442 h door to door"]],
      ["16 d 16 h", ["PT400H"]],
      ["1 d 18 h", ["PT42H"]],
    ],
    rows: [
      [
        "Leg 1: Mon 10 Jun 14:00",
        "6 h",
        "Mon 10 Jun 20:00",
        "Mon 10 Jun 20:00",
        "6 h",
      ],
      [
        "Leg 2: Tue 25 Jun 04:00",
        "1 d 12 h",
        "Wed 26 Jun 16:00",
        "Wed 26 Jun 16:00",
        "1 d 12 h",
      ],
    ],
    chips: ["6 h of handling", "1 d 12 h of handling"],
    brackets: ["moving · PT400H", "waiting · PT42H"],
    kinds: ["moving", "handling", "moving", "handling", "moving"],
  },
  "missed-connection": {
    results: ["null", "null"],
    calls: ["multimodalETA", "scheduleDelivery"],
    plates: [
      ["no result", ["", ""]],
      ["no result", [""]],
      ["no result", [""]],
    ],
    rows: [],
    chips: [],
    brackets: null,
    kinds: [],
  },
  "across-a-clock-change": {
    results: [
      '{ eta: "2024-03-31T12:00:00+01:00[Europe/London]", totalLegs: 2, totalTransit: "PT13H", totalDwell: "PT2H" }',
      '{ eta: "2024-03-31T12:00:00+01:00[Europe/London]", legTimes: [{ arrival: "2024-03-31T06:00:00Z", localArrival: "2024-03-31T07:00:00+01:00[Europe/London]", dwellAfter: "PT2H", mode: "rail" }, { arrival: "2024-03-31T11:00:00Z", localArrival: "2024-03-31T12:00:00+01:00[Europe/London]", dwellAfter: "PT0S", mode: "truck" }] }',
      '"PT2H"',
      '"PT2H"',
      '"PT0S"',
      '"PT15H"',
    ],
    calls: ["multimodalETA", "scheduleDelivery", ...Array(4).fill(DIFFS)],
    plates: [
      ["Sun 31 Mar 12:00", ["Europe/London", "15 h door to door"]],
      ["13 h", ["PT13H"]],
      ["2 h", ["PT2H"]],
    ],
    rows: [
      [
        "Leg 1: Sun 31 Mar 07:00",
        "2 h",
        "Sun 31 Mar 09:00",
        "Sun 31 Mar 09:00",
        "2 h",
      ],
    ],
    chips: ["2 h of handling"],
    brackets: ["moving · PT13H", "waiting · PT2H"],
    kinds: ["moving", "handling", "moving"],
  },
};

type Widget = RenderedWidget;

const open = (args: Record<string, unknown> = {}): Promise<Widget> =>
  renderWidget(entry, { args });

// The controls, by the names a person reads.
const preset = () => screen.getByRole("combobox", { name: "Preset" });
const legCount = () => screen.getByRole("combobox", { name: "Legs" });
const startZone = () =>
  screen.getByRole("combobox", { name: "Start zone (optional)" });
/** The control called `name` on leg `n`: hidden legs are out of the tree, so the visible ones count from 1. */
const leg = (role: "textbox" | "combobox", name: string, n: number) =>
  screen.getAllByRole(role, { name })[n - 1]!;
const duration = (n: number) => leg("textbox", "Duration", n);
const handling = (n: number) => leg("textbox", "Handling after (optional)", n);
const zone = (n: number) => leg("combobox", "Arrives in", n);

/** Replaces what a text box holds, in one input event. */
async function enter(w: Widget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

const output = () => screen.getByLabelText("What the calls returned");
const calls = () => screen.getByRole("group", { name: "Calls made" });
const reason = () =>
  screen.queryByRole("complementary", { name: "Why there is no result" });
const summary = () => screen.getByRole("status", { name: "Journey summary" });
const handoffLink = () =>
  screen.getByRole("link", {
    name: "Open these legs in the Delivery Scheduler",
  });
const tracks = () =>
  screen.getAllByRole("img", { name: /^(As it happens|Moving and waiting)/ });
const table = () => screen.getByRole("table", { name: "Hand-offs" });

/** A regular expression that matches `text` and nothing else. */
const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

/** A plate's value and sub lines, by its place among the three plates. */
const PLATE_LINES = [2, 1, 1];
function plate(index: number): { value: HTMLElement; lines: HTMLElement[] } {
  const defs = screen.getAllByRole("definition");
  const start = PLATE_LINES.slice(0, index).reduce((n, l) => n + 1 + l, 0);
  return {
    value: defs[start]!,
    lines: defs.slice(start + 1, start + 1 + PLATE_LINES[index]!),
  };
}

function expectPlate(index: number, [value, lines]: [string, string[]]) {
  const p = plate(index);
  expect(within(p.value).getByText(exact(value))).toBeInTheDocument();
  lines.forEach((line, i) => {
    if (line === "") expect(p.lines[i]).toHaveTextContent(/^$/);
    else expect(p.lines[i]).toHaveTextContent(exact(line));
  });
}

/** The kinds of segment the happens ribbon names, in order. */
function kindsOf(name: string): string[] {
  const happens = name.slice(0, name.indexOf(". Gathered"));
  return [
    ...happens.matchAll(
      /leg \d moving|of handling after|of waiting for the scheduled departure/g,
    ),
  ].map((m) =>
    m[0].endsWith("moving")
      ? "moving"
      : m[0].startsWith("of handling")
        ? "handling"
        : "scheduled",
  );
}

const hopRows = () => within(table()).getAllByRole("row").slice(1);

/** Text a reader sees or hears outside the calls, their results, the reason and the summary. */
function strays(pattern: RegExp): HTMLElement[] {
  const inside = [calls(), output(), summary()];
  const aside = reason();
  if (aside !== null) inside.push(aside);
  return [
    ...screen.queryAllByText(pattern),
    ...screen.queryAllByLabelText(pattern),
  ].filter((el) => !inside.some((box) => box.contains(el)));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2026-10-15T00:00:00Z");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("renderJourneySplitTemplate", () => {
  it("is a named region with three numbered sections, three plates, two ribbons and a five-column table", async () => {
    const w = await open();
    expect(
      screen.getByRole("region", { name: "Journey Split" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Set the legs",
      "2. Moving and waiting",
      "3. What multimodalETA returns",
    ]);
    expect(screen.getAllByRole("term")).toHaveLength(3);
    expect(tracks()).toHaveLength(2);
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual([...TABLE_COLUMNS]);
    // Three rows are reserved for the three possible hand-offs.
    expect(within(table()).getAllByRole("row", { hidden: true })).toHaveLength(
      1 + 3,
    );
    await expectNoAxeViolations(w.root);
  });

  it("opens four leg fieldsets, the fourth hidden for a three-leg preset, each control named", async () => {
    await open();
    expect(screen.getAllByRole("textbox", { name: "Duration" })).toHaveLength(
      3,
    );
    expect(
      screen.getAllByRole("textbox", { name: "Duration", hidden: true }),
    ).toHaveLength(4);
    for (const role of ["combobox", "textbox"] as const) {
      for (const control of screen.getAllByRole(role)) {
        expect(control).toHaveAccessibleName(/\S/);
      }
    }
  });

  it("labels the stated dwellAfter 'Handling after' and never says dwell on screen", async () => {
    await open();
    expect(
      screen.getAllByLabelText("Handling after (optional)", {
        selector: "input",
      }),
    ).toHaveLength(4);
    expect(strays(/dwell/i)).toEqual([]);
  });

  it("shows a hostile seed as text, never as elements", async () => {
    const w = await open({
      legs: [
        {
          departure: '"><img src=x onerror=alert(1)>',
          duration: "<script>x</script>",
          timeZone: '"><svg onload=alert(1)>',
          dwellAfter: "<b>x</b>",
          mode: '"><i>z</i>',
        },
      ],
      startTimeZone: "<u>y</u>",
    });
    expect(duration(1)).toHaveValue("<script>x</script>");
    expect(screen.queryByText("x")).not.toBeInTheDocument();
    expect(screen.queryByText("y")).not.toBeInTheDocument();
    expect(screen.queryByText("z")).not.toBeInTheDocument();
    w.destroy();
  });

  it("keeps two copies on one page apart", async () => {
    const a = await renderWidget(entry, { args: {}, idPrefix: "a" });
    const b = await renderWidget(entry, { args: {}, idPrefix: "b" });
    await a.user.selectOptions(
      within(a.root).getByRole("combobox", { name: "Legs" }),
      "1",
    );
    expect(
      within(a.root).getAllByRole("textbox", { name: "Duration" }),
    ).toHaveLength(1);
    expect(
      within(b.root).getAllByRole("textbox", { name: "Duration" }),
    ).toHaveLength(3);
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      JOURNEY_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(JOURNEY_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await w.user.selectOptions(preset(), id!);
    const want = EXPECTED[id!]!;
    const sentinel = want.results[0] === "null";

    // The calls made, in order, and what they returned, line for line.
    expect(calls()).toHaveTextContent(
      new RegExp(want.calls.map((c) => `${c}\\(`).join("[^]*")),
    );
    expect(
      screen.getByRole("button", { name: "Copy calls" }),
    ).toBeInTheDocument();
    if (sentinel) {
      expect(output()).toHaveTextContent("NO SIGNAL");
      expect(output()).toHaveTextContent(/^NO SIGNAL NO SIGNAL$/);
      expect(within(output()).getAllByText("NO SIGNAL")).toHaveLength(2);
    } else {
      expect(output()).not.toHaveTextContent("NO SIGNAL");
      expect(output()).toHaveTextContent(exact(want.results.join(" ")));
      expect(within(output()).queryByText("NO SIGNAL")).not.toBeInTheDocument();
    }

    // The plates.
    expect(screen.getAllByRole("term")).toHaveLength(3);
    want.plates.forEach((p, i) => expectPlate(i, p));

    // The ribbons: the same journey, named the same on both, segment kinds in order.
    for (const track of tracks()) {
      expect(kindsOf(track.getAttribute("aria-label")!)).toEqual(want.kinds);
    }

    // The chips under the waits and the brackets under the gathered ribbon.
    for (const chip of want.chips) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
    if (want.brackets === null) {
      expect(screen.queryByText(/^moving · /)).not.toBeInTheDocument();
      expect(screen.queryByText(/^waiting · /)).not.toBeInTheDocument();
    } else {
      for (const text of want.brackets) {
        expect(screen.getByText(text)).toBeInTheDocument();
      }
    }

    // The table: one row for each hand-off, in the columns the header names.
    expect(hopRows()).toHaveLength(want.rows.length);
    TABLE_COLUMNS.forEach((column, c) => {
      cellsInColumn(table(), column).forEach((cell, r) => {
        expect(cell).toHaveTextContent(exact(want.rows[r]![c]!));
      });
    });
    await expectNoAxeViolations(w.root);
    w.destroy();
  });

  it("names the moving and waiting totals of the plates on the gathered ribbon, for every preset", async () => {
    const w = await open();
    for (const p of JOURNEY_PRESETS) {
      await w.user.selectOptions(preset(), p.id);
      const want = EXPECTED[p.id]!;
      if (want.brackets === null) continue;
      for (const track of tracks()) {
        expect(track).toHaveAccessibleName(
          new RegExp(
            `Gathered: moving ${want.plates[1]![0]}, then waiting ${want.plates[2]![0]}\\.`,
          ),
        );
      }
    }
    w.destroy();
  });

  it("numbers the stems 1 to 3", async () => {
    const w = await open();
    expect(
      screen
        .getAllByText(/^[1-4]$/, { selector: "span" })
        .map((b) => b.textContent),
    ).toEqual(["1", "2", "3"]);
    w.destroy();
  });
});

describe("a null result", () => {
  it("shows NO SIGNAL with the library's sentence, plates that read no result, and ribbons and a table that say so in words", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "missed-connection");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent(
      "Missed connection: leg 2 is scheduled to leave at",
    );
    expect(reason()).toHaveTextContent("needs PT2H at the handoff");
    expect(screen.getAllByText("no result")).toHaveLength(3);
    // The two ribbons and the table each say so in words.
    expect(screen.getAllByText(/^No journey to draw/)).toHaveLength(3);
    for (const track of tracks()) {
      expect(track).toHaveAccessibleName(/No journey to draw/);
    }
    // Every region keeps its box, and the link still opens the same legs.
    expect(hopRows()).toHaveLength(0);
    expect(within(table()).getAllByRole("row", { hidden: true })).toHaveLength(
      1 + 3,
    );
    expect(handoffLink()).toHaveAttribute(
      "href",
      expect.stringMatching(
        new RegExp(`^${SITE_BASE}/tools/delivery-scheduler/\\?w=delivery&wa=`),
      ),
    );
    await expectNoAxeViolations(w.root);
    w.destroy();
  });

  it("is a different sentence for each reason the library refuses", async () => {
    const w = await open();
    await enter(w, duration(1), "6 hours");
    expect(reason()).toHaveTextContent(
      "Leg 1's duration is not one transitTime accepts",
    );
    await enter(w, duration(1), "PT6H");
    expect(reason()).not.toBeInTheDocument();
    await enter(w, handling(1), "soon");
    expect(reason()).toHaveTextContent(
      "Leg 1's handling time is not a duration of time units, or it is negative.",
    );
    expect(output()).toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(w.root);
    w.destroy();
  });
});

describe("a legitimately empty result is not a sentinel", () => {
  it("says a single leg has no hand-off, in words, with no NO SIGNAL", async () => {
    const w = await open();
    await w.user.selectOptions(legCount(), "1");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    expect(screen.queryByText("NO SIGNAL")).not.toBeInTheDocument();
    expect(reason()).not.toBeInTheDocument();
    expect(screen.getByText("A single leg has no hand-off.")).toBeVisible();
    expect(hopRows()).toHaveLength(0);
    expect(screen.queryByText(/^No journey to draw/)).not.toBeInTheDocument();
    expectPlate(2, ["0 h", ["PT0S"]]);
    await expectNoAxeViolations(w.root);
    w.destroy();
  });
});

describe("the form", () => {
  it("opens on the first preset, with its description", async () => {
    await open();
    expect(preset()).toHaveValue("scheduled-sailing");
    expect(legCount()).toHaveValue("3");
    expect(preset()).toHaveAccessibleDescription(
      JOURNEY_PRESETS[0]!.description,
    );
    expect(screen.queryAllByRole("textbox", { name: "Duration" })).toHaveLength(
      3,
    );
  });

  it("makes the preset custom when a field changes", async () => {
    const w = await open();
    await enter(w, handling(1), "PT8H");
    expect(preset()).toHaveValue("custom");
    // The new handling shows in the chip. The ship still sails when it was
    // scheduled to, so the waiting total does not change.
    expect(
      screen.getByText("2 d: 8 h handling + 40 h for the scheduled departure"),
    ).toBeInTheDocument();
    expectPlate(2, ["3 d 12 h", ["PT84H"]]);
    await expectNoAxeViolations(w.root);
    w.destroy();
  });

  it("leaves a blank scheduled departure and handling out of the printed call", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "no-schedule");
    expect(calls()).not.toHaveTextContent('dwellAfter: ""');
    expect(calls()).not.toHaveTextContent('departure: ""');
    expect(calls()).toHaveTextContent(
      '{ duration: "PT52H", timeZone: "Australia/Adelaide", mode: "rail" }',
    );
    w.destroy();
  });

  it("passes the start zone to the library as an option", async () => {
    const w = await open();
    await w.user.selectOptions(legCount(), "1");
    await enter(
      w,
      screen.getByRole("textbox", { name: "Departs" }),
      "2024-06-10T08:00:00",
    );
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent("no offset or zone");
    await w.user.selectOptions(startZone(), "Asia/Shanghai");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    expect(calls()).toHaveTextContent('{ startTimeZone: "Asia/Shanghai" })');
    await expectNoAxeViolations(w.root);
    w.destroy();
  });

  it("refreshes a leg's legend as its mode, duration and zone change", async () => {
    const w = await open();
    await enter(w, duration(2), "P3D");
    expect(screen.getAllByRole("group", { name: /P3D/ })).toHaveLength(1);
    await w.user.selectOptions(zone(2), "Asia/Tokyo");
    expect(screen.getAllByRole("group", { name: /Tokyo/ })).toHaveLength(1);
    await expectNoAxeViolations(w.root);
    w.destroy();
  });

  it("shows a fourth leg when asked for four", async () => {
    const w = await open();
    await w.user.selectOptions(legCount(), "4");
    expect(screen.getAllByRole("textbox", { name: "Duration" })).toHaveLength(
      4,
    );
    expect(preset()).toHaveValue("custom");
    w.destroy();
  });
});

describe("the hand-off to the Delivery Scheduler", () => {
  it("is the Delivery Scheduler's permalink under the other kind, with an href in every state", async () => {
    const w = await open();
    for (const p of JOURNEY_PRESETS) {
      await w.user.selectOptions(preset(), p.id);
      expect(handoffLink()).not.toHaveAttribute("aria-disabled");
      const state = readDeliveryArgs({
        legs: p.legs as never,
        ...(p.startTimeZone === "" ? {} : { startTimeZone: p.startTimeZone }),
      });
      expect(handoffLink(), p.id).toHaveAttribute(
        "href",
        encodeWidgetPermalink("delivery", deliveryPermalink(state)),
      );
    }
    w.destroy();
  });

  it("opens the same legs in the Delivery Scheduler: every leg key, legCount and startTimeZone survive", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "scheduled-sailing");
    await w.user.selectOptions(startZone(), "Asia/Shanghai");
    const href = handoffLink().getAttribute("href")!;
    const seeded = seedFromLocation("delivery", href.slice(href.indexOf("?")));
    const state = readDeliveryArgs(seeded);
    expect(state.legCount).toBe("3");
    expect(state.startTimeZone).toBe("Asia/Shanghai");
    expect(deliveryPermalink(state)).toEqual(seeded);
    for (const [i, source] of JOURNEY_PRESETS[0]!.legs.entries()) {
      expect(state.legs[i]).toEqual({
        departure: source.departure,
        duration: source.duration,
        timeZone: source.timeZone,
        dwellAfter: source.dwellAfter,
        mode: source.mode,
      });
    }
    w.destroy();
  });

  it("opens from the Delivery Scheduler's link: its permalink seeds this tool with every key", async () => {
    const legs = JOURNEY_PRESETS[0]!.legs;
    const state = readDeliveryArgs({
      legs: legs as never,
      startTimeZone: "Asia/Shanghai",
    });
    const href = encodeWidgetPermalink(
      "journeysplit",
      deliveryPermalink(state),
    );
    const seeded = seedFromLocation(
      "journeysplit",
      href.slice(href.indexOf("?")),
    )!;
    const w = await open(seeded);
    expect(startZone()).toHaveValue("Asia/Shanghai");
    expect(legCount()).toHaveValue("3");
    const url = w.permalink();
    expect(
      seedFromLocation("journeysplit", url.slice(url.indexOf("?"))),
    ).toEqual(deliveryPermalink(state));
    w.destroy();
  });
});

describe("the scenario's seed", () => {
  it("opens the scenario's own legs: handling of two days, the ship leaving at 10:00 on the 13th", async () => {
    const seed = {
      legCount: "3",
      departure1: "2024-06-10T08:00:00+08:00[Asia/Shanghai]",
      duration1: "PT6H",
      timeZone1: "Asia/Shanghai",
      dwellAfter1: "P2D",
      mode1: "truck",
      departure2: "2024-06-13T10:00:00+08:00[Asia/Shanghai]",
      duration2: "P14DT6H",
      timeZone2: "America/Los_Angeles",
      dwellAfter2: "PT36H",
      mode2: "ship",
      duration3: "PT52H",
      timeZone3: "America/Chicago",
      mode3: "rail",
    };
    const href = encodeWidgetPermalink("journeysplit", seed);
    const w = await open(
      seedFromLocation("journeysplit", href.slice(href.indexOf("?")))!,
    );
    expect(output()).toHaveTextContent(
      '{ eta: "2024-06-30T19:00:00-05:00[America/Chicago]", totalLegs: 3, totalTransit: "PT400H", totalDwell: "PT104H" }',
    );
    expectPlate(1, ["16 d 16 h", ["PT400H"]]);
    expectPlate(2, ["4 d 8 h", ["PT104H"]]);
    expect(preset()).toHaveValue("custom");
    w.destroy();
  });
});

describe("seeding", () => {
  it("seeds the chat's legs array and paints it on the first frame", async () => {
    const w = await open({
      legs: [
        {
          departure: "2024-06-15T00:00:00Z",
          duration: "PT10H",
          timeZone: "UTC",
          dwellAfter: "PT2H",
        },
        { duration: "PT5H", timeZone: "Asia/Tokyo" },
      ],
    });
    expect(duration(2)).toHaveValue("PT5H");
    expect(legCount()).toHaveValue("2");
    expect(preset()).toHaveValue("custom");
    expect(plate(0).value).toHaveTextContent("Sun 16 Jun 02:00");
    expect(output()).toHaveTextContent('totalDwell: "PT2H"');
    await expectNoAxeViolations(w.root);
    w.destroy();
  });

  it("seeds an unlisted mode and zone without dropping them", async () => {
    const w = await open({
      legs: [
        {
          departure: "2024-06-15T00:00:00Z",
          duration: "PT1H",
          timeZone: "Pacific/Chatham",
          mode: "barge",
        },
      ],
    });
    expect(leg("combobox", "Mode (optional)", 1)).toHaveValue("barge");
    expect(zone(1)).toHaveValue("Pacific/Chatham");
    w.destroy();
  });
});

describe("permalinks", () => {
  it.each(JOURNEY_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await first.user.selectOptions(preset(), id!);
      const url = first.permalink();
      expect(url).toMatch(
        new RegExp(`^${SITE_BASE}/tools/journey-split/\\?w=journeysplit&wa=`),
      );
      const seeded = seedFromLocation(
        "journeysplit",
        url.slice(url.indexOf("?")),
      )!;
      expect(
        Object.values(seeded).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      expect(encodeWidgetPermalink("journeysplit", seeded)).toBe(url);
      const shown = output().textContent?.replace(/\s+/g, " ").trim();
      first.destroy();

      const second = await open(seeded);
      expect(output()).toHaveTextContent(exact(shown ?? ""));
      expect(preset()).toHaveValue(id);
      second.destroy();
    },
  );

  it("leaves a blank departure, handling, mode and start zone out of the link", async () => {
    const w = await open();
    const url = w.permalink();
    const state = seedFromLocation(
      "journeysplit",
      url.slice(url.indexOf("?")),
    ) as Record<string, string>;
    expect(state).not.toHaveProperty("startTimeZone");
    expect(state).not.toHaveProperty("departure3");
    expect(state).not.toHaveProperty("dwellAfter3");
    expect(state["legCount"]).toBe("3");
    w.destroy();
  });
});

describe("on-screen words", () => {
  it.each(JOURNEY_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null, undefined or 'dwell' outside the printed call, its output, the reason and the summary",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(preset(), id!);
      expect(strays(/\b(null|undefined)\b/)).toEqual([]);
      expect(strays(/dwell/i)).toEqual([]);
      w.destroy();
    },
  );

  it("names no law, regulator, carrier or court", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\w*/i;
    const w = await open();
    for (const p of JOURNEY_PRESETS) {
      await w.user.selectOptions(preset(), p.id);
      expect(w.root).not.toHaveTextContent(forbidden);
      expect(screen.queryAllByLabelText(forbidden)).toEqual([]);
    }
    w.destroy();
  });

  it("states the split in one polite sentence", async () => {
    const w = await open();
    expect(summary()).toHaveTextContent(
      "Moving 16 d 16 h and waiting 3 d 12 h. ETA Sun 30 Jun 13:30 in Australia/Adelaide, 484 h door to door.",
    );
    await w.user.selectOptions(preset(), "missed-connection");
    expect(summary()).toHaveTextContent(/^No journey\./);
    w.destroy();
  });

  it("names each ribbon for a screen reader, and nothing inside a chart takes focus", async () => {
    const w = await open();
    for (const track of tracks()) {
      expect(track).toHaveAccessibleName(
        /Gathered: moving 16 d 16 h, then waiting 3 d 12 h\./,
      );
      expect(within(track).queryAllByRole("link")).toEqual([]);
      expect(within(track).queryAllByRole("button")).toEqual([]);
      expect(within(track).queryAllByRole("textbox")).toEqual([]);
      expect(within(track).queryAllByRole("combobox")).toEqual([]);
    }
    w.destroy();
  });

  it("has no drag handle or slider", async () => {
    const w = await open();
    expect(screen.queryAllByRole("slider")).toEqual([]);
    w.destroy();
  });
});

describe("the hand-off table", () => {
  it("has a header row of five columns, and rows that hold their box", async () => {
    const w = await open();
    expect(within(table()).getAllByRole("columnheader")).toHaveLength(5);
    expect(hopRows()).toHaveLength(2);
    // Three rows are reserved: the third is blank and hidden from assistive technology.
    expect(within(table()).getAllByRole("row", { hidden: true })).toHaveLength(
      1 + 3,
    );
    w.destroy();
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const w = await renderWidget(entry, { aborted: true });
    expect(screen.getAllByText("no result")).toHaveLength(3);
    expect(calls()).not.toHaveTextContent("(");
    expect(w.permalink()).toMatch(/\?w=journeysplit&wa=/);
    w.destroy();
    w.destroy();
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
