/**
 * @vitest-environment jsdom
 *
 * The Demurrage Clock end to end: template -> mount -> interact -> assert, against
 * the real `@northguild/gmt`, through the roles and names a reader meets. Every
 * preset's printed calls and results are checked against the literal strings of
 * `demurrageClock`'s JSDoc examples, the lanes against the library's intervals, and
 * the hand-off link through the Free Time Ledger's own `readArgs`, so a drift in the
 * library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import { renderHtml } from "~/widgets/test-fixture";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { CLOCK_EVENT_TYPES, DEMURRAGE_PRESETS } from "./demurrage-clock";
import { renderDemurrageClockTemplate } from "./demurrage-clock-mount";
import { readArgs as readFreeTimeArgs } from "./free-time-ledger";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showDemurrageClock"] as AnyWidgetEntry;
const freeTimeEntry = WIDGET_REGISTRY["showFreeTimeLedger"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const IMPORT = [
  ["discharged", "2024-06-14T19:00:00Z"],
  ["available", "2024-06-15T12:00:00Z"],
  ["gatedOut", "2024-06-20T14:30:00Z"],
  ["emptyReturned", "2024-06-27T09:00:00Z"],
] as const;
const EXPORT = [
  ["emptyReleased", "2024-07-01T08:00:00Z"],
  ["gatedIn", "2024-07-05T16:00:00Z"],
  ["loaded", "2024-07-09T03:00:00Z"],
] as const;

type Pairs = readonly (readonly [string, string])[];
const list = (events: Pairs) =>
  `[${events.map(([type, at]) => `{ type: "${type}", at: "${at}" }`).join(", ")}]`;
const call = (events: Pairs, scope: string, direction: string) =>
  `demurrageClock(${list(events)}, "${scope}", { direction: "${direction}" })`;
const interval = (start: string, end: string) =>
  `{ start: "${start}", end: "${end}" }`;
const offsetOf = (instant: string) =>
  `{ instant: "${instant}", offset: "+00:00" }`;

const TWICE: Pairs = [
  ["discharged", "2024-06-14T19:00:00Z"],
  ["discharged", "2024-06-15T19:00:00Z"],
  ["gatedOut", "2024-06-20T14:30:00Z"],
];
const INVERTED: Pairs = [
  ["discharged", "2024-06-21T19:00:00Z"],
  ["gatedOut", "2024-06-20T14:30:00Z"],
];

/** The four lane calls, in lane order, then the chosen one first. */
function calls(events: Pairs, direction: string, chosen: string): string[] {
  const order = ["demurrage", "detention", "storage", "combined"];
  return [chosen, ...order.filter((s) => s !== chosen)].map((s) =>
    call(events, s, direction),
  );
}

interface Expected {
  /** The printed calls, one a line. */
  copy: string;
  /** The output, or "NO SIGNAL". */
  output: string;
  /** Per lane (demurrage, detention, storage, combined): the interval or null. */
  lanes: ([string, string] | null)[];
  plates: [string, string, string] | null;
}

const IMPORT_LANES: Expected["lanes"] = [
  ["2024-06-14T19:00:00Z", "2024-06-20T14:30:00Z"],
  ["2024-06-20T14:30:00Z", "2024-06-27T09:00:00Z"],
  ["2024-06-14T19:00:00Z", "2024-06-20T14:30:00Z"],
  ["2024-06-14T19:00:00Z", "2024-06-27T09:00:00Z"],
];
const EXPORT_LANES: Expected["lanes"] = [
  ["2024-07-05T16:00:00Z", "2024-07-09T03:00:00Z"],
  ["2024-07-01T08:00:00Z", "2024-07-05T16:00:00Z"],
  ["2024-07-05T16:00:00Z", "2024-07-09T03:00:00Z"],
  ["2024-07-01T08:00:00Z", "2024-07-09T03:00:00Z"],
];

function expected(
  events: Pairs,
  direction: string,
  scope: string,
  lanes: Expected["lanes"],
  duration: string | null,
): Expected {
  const order = ["demurrage", "detention", "storage", "combined"];
  const chosen = lanes[order.indexOf(scope)];
  const sequence = [scope, ...order.filter((s) => s !== scope)];
  const results = sequence.map((s) => {
    const l = lanes[order.indexOf(s)];
    return l === null || l === undefined ? "null" : interval(l[0], l[1]);
  });
  const printed = calls(events, direction, scope);
  if (chosen !== null && chosen !== undefined) {
    printed.push(
      `toOffsetInstant("${chosen[0]}")`,
      `toOffsetInstant("${chosen[1]}")`,
      `diffUtcAsDuration("${chosen[0]}", "${chosen[1]}", "hours")`,
    );
    results.push(offsetOf(chosen[0]), offsetOf(chosen[1]), `"${duration}"`);
  }
  return {
    copy: printed.join("\n"),
    output:
      chosen === null || chosen === undefined
        ? "NO SIGNAL"
        : results.join("\n"),
    lanes,
    plates: null,
  };
}

const EXPECTED: Record<string, Expected> = {
  "import-demurrage": expected(
    IMPORT,
    "import",
    "demurrage",
    IMPORT_LANES,
    "PT139H30M",
  ),
  "import-detention": expected(
    IMPORT,
    "import",
    "detention",
    IMPORT_LANES,
    "PT162H30M",
  ),
  "export-storage": expected(
    EXPORT,
    "export",
    "storage",
    EXPORT_LANES,
    "PT83H",
  ),
  "merged-clock": expected(
    IMPORT,
    "import",
    "combined",
    IMPORT_LANES,
    "PT302H",
  ),
  "recorded-twice": expected(
    TWICE,
    "import",
    "demurrage",
    [null, null, null, null],
    null,
  ),
  "gate-out-before-discharge": expected(
    INVERTED,
    "import",
    "demurrage",
    [null, null, null, null],
    null,
  ),
};

/** Plates: [start value, start time, end value, end time, ran value, ran sub]. */
const PLATES: Record<string, string[]> = {
  "import-demurrage": [
    "discharged",
    "Fri 14 Jun 20:00",
    "gated out",
    "Thu 20 Jun 15:30",
    "5 d 19 h 30 min",
    "PT139H30M",
  ],
  "import-detention": [
    "gated out",
    "Thu 20 Jun 16:30",
    "empty returned",
    "Thu 27 Jun 11:00",
    "6 d 18 h 30 min",
    "PT162H30M",
  ],
  "export-storage": [
    "gated in",
    "Sat 6 Jul 00:00",
    "loaded",
    "Tue 9 Jul 11:00",
    "3 d 11 h",
    "PT83H",
  ],
  "merged-clock": [
    "discharged",
    "Fri 14 Jun 21:00",
    "empty returned",
    "Thu 27 Jun 11:00",
    "12 d 14 h",
    "PT302H",
  ],
  "recorded-twice": [
    "discharged",
    "no result",
    "gated out",
    "no result",
    "no result",
    "",
  ],
  "gate-out-before-discharge": [
    "discharged",
    "no result",
    "gated out",
    "no result",
    "no result",
    "",
  ],
};

const SCOPES = ["demurrage", "detention", "storage", "combined"];
const HANDOFF = "Count the days in the Free Time Ledger";
const NO_CLOCK_HINT =
  "No clock to count: the chosen clock returned no interval.";

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const scope = () => screen.getByRole("combobox", { name: "Clock" });
const direction = () => screen.getByRole("combobox", { name: "Direction" });
const startEvent = () =>
  screen.getByRole("combobox", { name: "Start event (optional)" });
const zone = () => screen.getByRole("combobox", { name: "Terminal clock" });
const typeOf = (n: number) =>
  screen.getByRole("combobox", { name: `Event ${String(n)}` });
const atOf = (n: number) =>
  screen.getByRole("textbox", { name: `Instant ${String(n)}` });
const callsFrame = () => screen.getByRole("group", { name: "Calls made" });
const output = () =>
  screen.getByRole("status", { name: "What the calls returned" });
const summary = () => screen.getByRole("status", { name: "Reading summary" });
const aside = () => screen.queryByRole("complementary");
const link = () => screen.queryByRole("link", { name: HANDOFF });
const plates = () => screen.getByRole("group", { name: "The chosen clock" });
const lanes = () =>
  within(screen.getByRole("list", { name: "Clocks" })).getAllByRole("listitem");
const laneNames = () => lanes().map((l) => l.getAttribute("aria-label")!);
const railNames = () =>
  within(screen.getByRole("list", { name: "Events" }))
    .queryAllByRole("listitem")
    .map((l) => l.getAttribute("aria-label"));
const days = () =>
  within(screen.getByRole("list", { name: "Local days" })).queryAllByRole(
    "listitem",
  );

const flat = (text: string) => text.replace(/\n\s*/g, " ");

async function enter(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

/** The text a plate shows, by its caption: the value, then its sub line. */
function expectPlates(want: string[]) {
  const dl = within(plates());
  for (const text of want) {
    if (text !== "") expect(dl.getAllByText(text).length).toBeGreaterThan(0);
  }
}

function template(args?: Record<string, unknown>): HTMLElement {
  return renderHtml(renderDemurrageClockTemplate("demurrage-clock", args)).host;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("renderDemurrageClockTemplate", () => {
  it("renders three numbered sections, six event rows and four lanes, and holds no result", () => {
    const host = within(template());
    expect(
      host.getByRole("heading", { name: "1. Set the events and the options" }),
    ).toBeInTheDocument();
    expect(
      host.getByRole("heading", { name: "2. Which events bound each clock" }),
    ).toBeInTheDocument();
    expect(
      host.getByRole("heading", { name: "3. What demurrageClock returns" }),
    ).toBeInTheDocument();
    for (let n = 1; n <= 6; n++) {
      expect(
        host.getByRole("textbox", { name: `Instant ${String(n)}` }),
      ).toBeInTheDocument();
    }
    expect(
      within(host.getByRole("list", { name: "Clocks" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(4);
    expect(host.getAllByText("no result")).toHaveLength(3);
  });

  it("says beside the control that the terminal clock is a display zone, not an argument", () => {
    const host = template();
    expect(host).toHaveTextContent("The terminal clock is a display zone.");
    expect(host).toHaveTextContent("not an argument of demurrageClock");
  });

  it("offers the seven event types the library accepts, and a blank", () => {
    const host = within(template());
    const options = within(
      host.getByRole("combobox", { name: "Event 1" }),
    ).getAllByRole<HTMLOptionElement>("option");
    expect(options.map((o) => o.value)).toEqual(["", ...CLOCK_EVENT_TYPES]);
    expect(options[0]).toHaveTextContent("No event");
  });

  it("escapes a hostile seed", () => {
    const host = template({
      events: [
        { type: '"><img src=x onerror=alert(1)>', at: "<script>x</script>" },
      ],
      scope: '"><script>y</script>',
      direction: "<b>x</b>",
      startEvent: "<i>z</i>",
      zone: '"><svg onload=alert(1)>',
    });
    const h = within(host);
    expect(h.queryByRole("img")).not.toBeInTheDocument();
    expect(h.getByRole("textbox", { name: "Instant 1" })).toHaveValue(
      "<script>x</script>",
    );
    expect(
      h.getByRole("option", { name: '"><img src=x onerror=alert(1)>' }),
    ).toBeInTheDocument();
    expect(h.getByRole("combobox", { name: "Direction" })).toHaveValue(
      "<b>x</b>",
    );
    expect(h.getByRole("combobox", { name: "Terminal clock" })).toHaveValue(
      '"><svg onload=alert(1)>',
    );
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      DEMURRAGE_PRESETS.map((p) => p.id).sort(),
    );
    expect(Object.keys(PLATES).sort()).toEqual(
      DEMURRAGE_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await w.user.selectOptions(preset(), id!);
    const want = EXPECTED[id!]!;
    const sentinel = want.output === "NO SIGNAL";

    // The calls made and what they returned, in the same order.
    expect(callsFrame()).toHaveTextContent(flat(want.copy));
    expect(output()).toHaveTextContent(flat(want.output));
    if (!sentinel) expect(output()).not.toHaveTextContent("NO SIGNAL");

    // Each lane says its own call's interval, or why it has none.
    const names = laneNames();
    want.lanes.forEach((lane, i) => {
      if (lane === null)
        expect(names[i], `lane ${i + 1}`).not.toMatch(/: from /);
      else expect(names[i], `lane ${i + 1}`).toMatch(/: from /);
    });
    // Exactly one lane is the chosen clock: the preset's scope.
    const chosen = names.filter((n) => n.endsWith(", the chosen clock"));
    expect(chosen).toHaveLength(1);
    expect(names.indexOf(chosen[0]!)).toBe(
      SCOPES.indexOf(DEMURRAGE_PRESETS.find((x) => x.id === id)!.scope),
    );
    // The reason is in words, only when the chosen clock has no interval.
    expect(aside() !== null).toBe(sentinel);

    expectPlates(PLATES[id!]!);
    await expectNoAxeViolations(w.root);
  });

  it("opens on the first preset with its terminal clock", async () => {
    await open();
    expect(preset()).toHaveValue("import-demurrage");
    expect(zone()).toHaveValue("Europe/London");
    expect(startEvent()).toHaveDisplayValue("not given");
  });

  it("lays the day columns out in the terminal's zone, with the clocks over them", async () => {
    await open();
    const names = days().map((d) => d.getAttribute("aria-label")!);
    expect(names.length).toBeGreaterThan(5);
    expect(names).toContain("14 Jun Fri");
    expect(names).toContain("27 Jun Thu");
    expect(laneNames()[0]).toContain(
      "from Fri 14 Jun 20:00 to Thu 20 Jun 15:30",
    );
  });

  it("names one diamond for each event, with the word and the local time", async () => {
    await open();
    expect(railNames()).toEqual([
      "discharged, Fri 14 Jun 20:00 on the Europe/London clock",
      "available, Sat 15 Jun 13:00 on the Europe/London clock",
      "gated out, Thu 20 Jun 15:30 on the Europe/London clock",
      "empty returned, Thu 27 Jun 10:00 on the Europe/London clock",
    ]);
  });
});

describe("the terminal clock is a display zone", () => {
  it("changes the day columns and the local times and nothing the library is asked", async () => {
    const w = await open();
    await w.user.selectOptions(zone(), "Asia/Shanghai");
    expect(railNames()[0]).toBe(
      "discharged, Sat 15 Jun 03:00 on the Asia/Shanghai clock",
    );
    expectPlates(["Sat 15 Jun 03:00"]);
    expect(callsFrame()).toHaveTextContent(
      flat(EXPECTED["import-demurrage"]!.copy),
    );
    expect(output()).toHaveTextContent(
      flat(EXPECTED["import-demurrage"]!.output),
    );
    expect(preset()).toHaveValue("custom");
    await w.user.selectOptions(zone(), "UTC (no zone)");
    expect(railNames()[0]).toBe(
      "discharged, Fri 14 Jun 19:00 on the UTC clock",
    );
    expectPlates(["Fri 14 Jun 19:00"]);
    await expectNoAxeViolations(w.root);
  });

  it("says when a seeded zone cannot be read, and still answers", async () => {
    const w = await open({
      events: [
        { type: "discharged", at: "2024-06-14T19:00:00Z" },
        { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
      ],
      scope: "demurrage",
      direction: "import",
      zone: "Nowhere/Land",
    });
    expect(screen.getAllByText("zone not read").length).toBeGreaterThan(0);
    expect(days()).toHaveLength(0);
    expect(output()).toHaveTextContent("PT139H30M");
    expect(zone()).toHaveValue("Nowhere/Land");
    await expectNoAxeViolations(w.root);
  });
});

describe("the options", () => {
  it("moves the bars with the start event: each lane is a fresh call", async () => {
    const w = await open();
    await w.user.selectOptions(startEvent(), "available");
    expect(callsFrame()).toHaveTextContent(
      '{ direction: "import", startEvent: "available" }',
    );
    expectPlates(["available", "Sat 15 Jun 13:00"]);
    expect(output()).toHaveTextContent(
      interval("2024-06-15T12:00:00Z", "2024-06-20T14:30:00Z"),
    );
    await w.user.selectOptions(startEvent(), "not given");
    expect(callsFrame()).not.toHaveTextContent("startEvent");
    await expectNoAxeViolations(w.root);
  });

  it("reads the same events as an export and finds no clock, with the reason in words", async () => {
    const w = await open();
    await w.user.selectOptions(direction(), "export");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(aside()).toHaveTextContent("is not recorded");
    // The pair is read from the library, so the captions hold.
    expectPlates(["gated in", "loaded"]);
    expect(laneNames()[0]).toContain("gated in is not recorded");
    await expectNoAxeViolations(w.root);
  });

  it("changes the chosen clock", async () => {
    const w = await open();
    await w.user.selectOptions(scope(), "combined");
    expectPlates(["empty returned"]);
    expect(laneNames()[3]).toMatch(/, the chosen clock$/);
    expect(laneNames()[0]).not.toMatch(/, the chosen clock$/);
    expect(callsFrame()).toHaveTextContent('"combined"');
    await expectNoAxeViolations(w.root);
  });

  it("names a reason on the lane of every clock the library returns null for, and no signal on the chosen output", async () => {
    const w = await open();
    // Drop the empty return: detention and the combined clock lose their end.
    await w.user.selectOptions(typeOf(4), "No event");
    await enter(w, atOf(4), "");
    const names = laneNames();
    expect(names[1]).toContain("empty returned is not recorded");
    expect(names[3]).toContain("empty returned is not recorded");
    expect(names[0]).toMatch(/: from /);
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    expect(output()).toHaveTextContent("null");
    await expectNoAxeViolations(w.root);
  });

  it("names a row that is not a valid event", async () => {
    const w = await open();
    await enter(w, atOf(2), "2024-06-15T12:00:00");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(aside()).toHaveTextContent("Row 2 is not a valid event");
    expect(laneNames()[0]).toContain("row 2 is not a valid event");
    await expectNoAxeViolations(w.root);
  });

  it("makes a blank form a clock with its own reason, not the empty state or a blank box", async () => {
    const w = await open();
    for (let n = 1; n <= 6; n++) {
      await w.user.selectOptions(typeOf(n), "No event");
      await enter(w, atOf(n), "");
    }
    expect(callsFrame()).toHaveTextContent("demurrageClock([]");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(aside()).toHaveTextContent("is not recorded");
    expect(screen.getByText(/Add an event/)).toBeVisible();
    // Every region keeps its place.
    expect(within(plates()).getAllByText("no result").length).toBeGreaterThan(
      0,
    );
    expect(lanes()).toHaveLength(4);
    expect(link()).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("does not guess a direction or a scope for a seed that names neither", async () => {
    const w = await open({
      events: [{ type: "discharged", at: "2024-06-14T19:00:00Z" }],
    });
    expect(direction()).toHaveValue("");
    expect(scope()).toHaveValue("");
    expect(aside()).toHaveTextContent("No clock is chosen");
    await w.user.selectOptions(scope(), "demurrage");
    expect(aside()).toHaveTextContent("must be import or export");
    await expectNoAxeViolations(w.root);
  });
});

describe("the hand-off to the Free Time Ledger", () => {
  it("links the chosen interval and the terminal clock, and the Free Time Ledger reads them back", async () => {
    const w = await open();
    const href = link()!.getAttribute("href")!;
    expect(link()).not.toHaveAttribute("aria-disabled");
    expect(href).toBe(
      encodeWidgetPermalink("freetime", {
        clockStart: "2024-06-14T19:00:00Z",
        clockEnd: "2024-06-20T14:30:00Z",
        zone: "Europe/London",
      }),
    );
    const seeded = seedFromLocation("freetime", href.slice(href.indexOf("?")));
    expect(seeded).toEqual({
      clockStart: "2024-06-14T19:00:00Z",
      clockEnd: "2024-06-20T14:30:00Z",
      zone: "Europe/London",
    });
    const state = readFreeTimeArgs(seeded);
    expect(state.clockStart).toBe("2024-06-14T19:00:00Z");
    expect(state.clockEnd).toBe("2024-06-20T14:30:00Z");
    expect(state.zone).toBe("Europe/London");
    // And the tool the link opens shows the same values.
    w.destroy();
    await renderWidget(freeTimeEntry, { args: seeded! });
    expect(screen.getByRole("textbox", { name: "Clock start" })).toHaveValue(
      "2024-06-14T19:00:00Z",
    );
    expect(screen.getByRole("textbox", { name: "Clock end" })).toHaveValue(
      "2024-06-20T14:30:00Z",
    );
    expect(screen.getByRole("combobox", { name: "Terminal zone" })).toHaveValue(
      "Europe/London",
    );
  });

  it("carries the strings the library returned, and leaves the zone out when there is none", async () => {
    const w = await open();
    await enter(w, atOf(1), "2024-06-14T15:00:00-04:00[America/New_York]");
    await w.user.selectOptions(zone(), "UTC (no zone)");
    const href = link()!.getAttribute("href")!;
    const seeded = seedFromLocation("freetime", href.slice(href.indexOf("?")));
    expect(seeded).toEqual({
      clockStart: "2024-06-14T15:00:00-04:00[America/New_York]",
      clockEnd: "2024-06-20T14:30:00Z",
    });
    expect(readFreeTimeArgs(seeded).clockStart).toBe(
      "2024-06-14T15:00:00-04:00[America/New_York]",
    );
  });

  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))(
    "is a link for %s only when the clock has an interval",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(preset(), id!);
      const has = EXPECTED[id!]!.output !== "NO SIGNAL";
      if (has) {
        expect(link()).toBeInTheDocument();
      } else {
        expect(link()).not.toBeInTheDocument();
        const disabled = screen.getByText(HANDOFF);
        expect(disabled).toHaveAttribute("aria-disabled", "true");
        expect(disabled).toHaveAccessibleDescription(NO_CLOCK_HINT);
      }
      await expectNoAxeViolations(w.root);
    },
  );
});

describe("seeding", () => {
  it("seeds the chat's events array and paints it on the first frame", async () => {
    const w = await open({
      events: [
        { type: "discharged", at: "2024-06-14T19:00:00Z" },
        { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
      ],
      scope: "detention",
      direction: "import",
      zone: "Pacific/Auckland",
    });
    expect(atOf(2)).toHaveValue("2024-06-20T14:30:00Z");
    expect(zone()).toHaveValue("Pacific/Auckland");
    expect(preset()).toHaveValue("custom");
    expect(output()).toHaveTextContent("NO SIGNAL");
    expect(laneNames()[1]).toContain("empty returned is not recorded");
    await expectNoAxeViolations(w.root);
  });

  it("seeds an unlisted event type, scope and zone without dropping them", async () => {
    const w = await open({
      events: [{ type: "arrived", at: "2024-06-14T19:00:00Z" }],
      scope: "laytime",
      direction: "import",
      zone: "Pacific/Chatham",
    });
    expect(typeOf(1)).toHaveValue("arrived");
    expect(scope()).toHaveValue("laytime");
    expect(zone()).toHaveValue("Pacific/Chatham");
    expect(callsFrame()).toHaveTextContent('"laytime"');
    expect(aside()).toHaveTextContent("laytime is not a clock");
    await expectNoAxeViolations(w.root);
  });
});

describe("permalinks", () => {
  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await first.user.selectOptions(preset(), id!);
      const url = first.permalink();
      expect(url).toMatch(
        new RegExp(`^${SITE_BASE}/tools/demurrage-clock/\\?w=demclock&wa=`),
      );
      const state = seedFromLocation("demclock", url.slice(url.indexOf("?")))!;
      expect(
        Object.values(state).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      first.destroy();

      await open(state);
      expect(preset()).toHaveValue(id);
      expect(output()).toHaveTextContent(flat(EXPECTED[id!]!.output));
    },
  );

  it("leaves a blank row, a blank start event and a blank zone out of the link", async () => {
    const w = await open();
    await w.user.selectOptions(zone(), "UTC (no zone)");
    await enter(w, atOf(2), "");
    await w.user.selectOptions(typeOf(2), "No event");
    const url = w.permalink();
    const state = seedFromLocation("demclock", url.slice(url.indexOf("?")))!;
    expect(state).not.toHaveProperty("zone");
    expect(state).not.toHaveProperty("startEvent");
    expect(state).not.toHaveProperty("type2");
    expect(state["eventCount"]).toBe("4");
  });
});

describe("on-screen words", () => {
  it.each(DEMURRAGE_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined",
    async (id) => {
      const w = await open();
      await w.user.selectOptions(preset(), id!);
      expect(w.root).not.toHaveTextContent(/\b(null|undefined)\b/);
      for (const name of [...laneNames(), ...railNames()]) {
        expect(name).not.toMatch(/\b(null|undefined)\b/);
      }
    },
  );

  it("names no law, regulator, carrier or court", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\w*/i;
    const w = await open();
    expect(w.root).not.toHaveTextContent(forbidden);
    for (const p of DEMURRAGE_PRESETS) {
      await w.user.selectOptions(preset(), p.id);
      expect(w.root).not.toHaveTextContent(forbidden);
    }
  });

  it("states the chosen clock in one polite sentence", async () => {
    await open();
    expect(summary()).toHaveTextContent(
      "demurrage: discharged to gated out: from Fri 14 Jun 20:00 to Thu 20 Jun 15:30 on the Europe/London clock. It ran for 5 d 19 h 30 min.",
    );
  });
});

describe("lifecycle", () => {
  it("is inert when aborted before it mounts", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(output()).not.toHaveTextContent("PT139H30M");
    expect(screen.getAllByText("no result")).toHaveLength(3);
    w.destroy();
  });

  it("survives a double destroy", async () => {
    const w = await open();
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
  });

  it("draws again when the width changes, and releases the observer on destroy", async () => {
    const spy = spyOnResizeObservers();
    try {
      const w = await open();
      expect(spy.live.size).toBeGreaterThan(0);
      spy.fire();
      expect(railNames()).toHaveLength(4);
      w.destroy();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});

describe("the length cap", () => {
  it("stops an event instant at 64 characters", async () => {
    const w = await open();
    const box = screen.getByRole("textbox", { name: "Instant 1" });
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(72));
    expect(box).toHaveValue("x".repeat(64));
  });
});
