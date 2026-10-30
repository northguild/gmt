/**
 * @vitest-environment jsdom
 *
 * The Elapsed vs. Clock Difference tool end to end, against the real `@northguild/gmt`.
 * Every preset's printed calls, results, plates, rulers and list are checked against
 * literal strings read from a run of the built library, so a drift in the library or the
 * widget fails here. Everything is read the way a reader or a screen reader meets it:
 * roles, names, values and visible text.
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
  CLOCK_REFUSES_TEXT,
  ELAPSED_PRESETS,
  NOT_INSERTED_TEXT,
  NOT_INSTANT_TEXT,
} from "./elapsed-vs-clock";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { SITE_BASE } from "./site";

installJsdomShims();

const entry = WIDGET_REGISTRY["showElapsedVsClock"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

type Opened = Awaited<ReturnType<typeof open>>;

const startBox = () => screen.getByRole("textbox", { name: "Start" });
const endBox = () => screen.getByRole("textbox", { name: "End" });
const presetBox = () => screen.getByRole("combobox", { name: "Preset" });
const slider = () => screen.getByRole("slider", { name: "Move the end" });
const summary = () => screen.getByRole("status", { name: "Reading summary" });
const figure = () =>
  screen.getByRole("img", { name: summary().textContent ?? "" });
const insertions = () =>
  screen.getByRole("list", { name: "Seconds inserted between the two" });
const endsGroup = () =>
  screen.getByRole("group", { name: "Where the span starts and ends" });

const GROUPS = [
  { id: "clock", heading: "Clock difference" },
  { id: "elapsed", heading: "Seconds that passed" },
  { id: "count", heading: "Leap seconds between" },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];
const headingOf = (g: GroupId) => GROUPS.find((x) => x.id === g)!.heading;
const callsOf = (g: GroupId) =>
  screen.getByRole("group", { name: `${headingOf(g)}: calls made` });
const outputOf = (g: GroupId) =>
  screen.getByRole("status", {
    name: `${headingOf(g)}: what the calls returned`,
  });
const asideOf = (g: GroupId) =>
  screen.queryByRole("complementary", {
    name: `Why there is no result: ${headingOf(g).toLowerCase()}`,
  });
const linkNamed = (name: string) => screen.getByText(name);

/** The plates in the order the sum shows them: clock difference, leap seconds, seconds that passed. */
const PLATE_CAPTIONS = [
  "Clock difference",
  "Leap seconds between",
  "Seconds that passed",
];
const CLOCK_LINES = ["read as UTC", "counts no inserted second"] as const;
const ELAPSED_LINES = ["read through TAI", "counts every second"] as const;

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
const flat = (s: string) => s.replace(/\n/g, " ");

type Plate = [string, string, string];
function expectPlate(caption: string, want: Plate) {
  const { value, lines } = plateParts(caption);
  const shown = shownIn(value);
  expect(shown).toHaveLength(1);
  expect(shown[0]).toHaveTextContent(exact(want[0]));
  [want[1], want[2]].forEach((line, n) => {
    if (line === "") expect(lines[n]).toHaveTextContent(/^$/);
    else expect(lines[n]).toHaveTextContent(exact(line));
  });
}

const BLANK = "Not read: the field is blank.";
const NONE_COUNTED = "No second was inserted between these two.";
const RULER_NO_SIGNAL = "⟨ NO SIGNAL — invalid input ⟩";
/** The elapsed ruler's inserted second, and the clock face's. */
const ELAPSED_MARK = /^\+1( s)?$/;
const CLOCK_MARK = /^(:60|\d\d:\d\d:60)$/;

interface Expected {
  copy: { clock: string; elapsed: string; count: string };
  output: { clock: string; elapsed: string; count: string };
  plates: { clock: string; elapsed: string; count: string };
  countLines: [string, string];
  marks: number;
  list: string[];
  asides: [string, string, string];
}

/** What each preset prints, from a run against `packages/gmt/dist`. */
const EXPECTED: Record<string, Expected> = {
  "across-2016": {
    copy: {
      clock: 'spanNs("2016-12-31T23:59:59Z", "2017-01-01T00:00:01Z")',
      elapsed:
        'toTAI("2016-12-31T23:59:59Z")\ntoTAI("2017-01-01T00:00:01Z")\nspanNs("2017-01-01T00:00:35Z", "2017-01-01T00:00:38Z")',
      count:
        'leapSecondsBetween("2016-12-31T23:59:59Z", "2017-01-01T00:00:01Z")',
    },
    output: {
      clock: "2000000000n",
      elapsed:
        '"2017-01-01T00:00:35 TAI"\n"2017-01-01T00:00:38 TAI"\n3000000000n',
      count: "1",
    },
    plates: { clock: "2 s", elapsed: "3 s", count: "1" },
    countLines: ["from 2016-12-31", "to 2017-01-01"],
    marks: 1,
    list: ["2016-12-31T23:59:60Z"],
    asides: ["", "", ""],
  },
  "start-is-the-leap-second": {
    copy: {
      clock: 'spanNs("2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z")',
      elapsed:
        'toTAI("2016-12-31T23:59:60Z")\ntoTAI("2017-01-01T00:00:00Z")\nspanNs("2017-01-01T00:00:36Z", "2017-01-01T00:00:37Z")',
      count:
        'leapSecondsBetween("2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z")',
    },
    output: {
      clock: "NO SIGNAL",
      elapsed:
        '"2017-01-01T00:00:36 TAI"\n"2017-01-01T00:00:37 TAI"\n1000000000n',
      count: "1",
    },
    plates: { clock: "no result", elapsed: "1 s", count: "1" },
    countLines: ["from 2016-12-31", "to 2017-01-01"],
    marks: 1,
    list: ["2016-12-31T23:59:60Z"],
    asides: [CLOCK_REFUSES_TEXT, "", ""],
  },
  "twenty-four-years": {
    copy: {
      clock: 'spanNs("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      elapsed:
        'toTAI("2000-01-01T00:00:00Z")\ntoTAI("2024-01-01T00:00:00Z")\nspanNs("2000-01-01T00:00:32Z", "2024-01-01T00:00:37Z")',
      count:
        'leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
    },
    output: {
      clock: "757382400000000000n",
      elapsed:
        '"2000-01-01T00:00:32 TAI"\n"2024-01-01T00:00:37 TAI"\n757382405000000000n',
      count: "5",
    },
    plates: { clock: "757382400 s", elapsed: "757382405 s", count: "5" },
    countLines: ["from 2000-01-01", "to 2024-01-01"],
    marks: 5,
    list: [
      "2005-12-31T23:59:60Z",
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ],
    asides: ["", "", ""],
  },
  "no-insertions": {
    copy: {
      clock: 'spanNs("2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      elapsed:
        'toTAI("2020-01-01T00:00:00Z")\ntoTAI("2024-01-01T00:00:00Z")\nspanNs("2020-01-01T00:00:37Z", "2024-01-01T00:00:37Z")',
      count:
        'leapSecondsBetween("2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
    },
    output: {
      clock: "126230400000000000n",
      elapsed:
        '"2020-01-01T00:00:37 TAI"\n"2024-01-01T00:00:37 TAI"\n126230400000000000n',
      count: "0",
    },
    plates: { clock: "126230400 s", elapsed: "126230400 s", count: "0" },
    countLines: ["from 2020-01-01", "to 2024-01-01"],
    marks: 0,
    list: [NONE_COUNTED],
    asides: ["", "", ""],
  },
  backwards: {
    copy: {
      clock: 'spanNs("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z")',
      elapsed:
        'toTAI("2024-01-01T00:00:00Z")\ntoTAI("2000-01-01T00:00:00Z")\nspanNs("2024-01-01T00:00:37Z", "2000-01-01T00:00:32Z")',
      count:
        'leapSecondsBetween("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z")',
    },
    output: {
      clock: "-757382400000000000n",
      elapsed:
        '"2024-01-01T00:00:37 TAI"\n"2000-01-01T00:00:32 TAI"\n-757382405000000000n',
      count: "-5",
    },
    plates: { clock: "-757382400 s", elapsed: "-757382405 s", count: "-5" },
    countLines: ["from 2024-01-01", "to 2000-01-01"],
    marks: 5,
    list: [
      "2005-12-31T23:59:60Z",
      "2008-12-31T23:59:60Z",
      "2012-06-30T23:59:60Z",
      "2015-06-30T23:59:60Z",
      "2016-12-31T23:59:60Z",
    ],
    asides: ["", "", ""],
  },
  "not-inserted": {
    copy: {
      clock: 'spanNs("2017-12-31T23:59:60Z", "2018-01-01T00:00:00Z")',
      elapsed: 'toTAI("2017-12-31T23:59:60Z")\ntoTAI("2018-01-01T00:00:00Z")',
      count:
        'leapSecondsBetween("2017-12-31T23:59:60Z", "2018-01-01T00:00:00Z")',
    },
    output: {
      clock: "NO SIGNAL",
      elapsed: 'NO SIGNAL\n"2018-01-01T00:00:37 TAI"',
      count: "NO SIGNAL",
    },
    plates: { clock: "no result", elapsed: "no result", count: "no result" },
    countLines: ["", ""],
    marks: 0,
    list: ["Not read: there is no count."],
    asides: [NOT_INSERTED_TEXT, NOT_INSERTED_TEXT, NOT_INSERTED_TEXT],
  },
  "before-1972": {
    copy: {
      clock: 'spanNs("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
      elapsed: 'toTAI("1971-01-01T00:00:00Z")\ntoTAI("2024-01-01T00:00:00Z")',
      count:
        'leapSecondsBetween("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z")',
    },
    output: {
      clock: "1672531200000000000n",
      elapsed: 'NO SIGNAL\n"2024-01-01T00:00:37 TAI"',
      count: "NO SIGNAL",
    },
    plates: { clock: "1672531200 s", elapsed: "no result", count: "no result" },
    countLines: ["", ""],
    marks: 0,
    list: ["Not read: there is no count."],
    asides: ["", BEFORE_1972_TEXT, BEFORE_1972_TEXT],
  },
};

async function pick(w: Opened, id: string) {
  await w.user.selectOptions(presetBox(), id);
}
async function typeInto(w: Opened, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the template", () => {
  it("is a named region with three numbered sections and the controls a reader needs", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Elapsed vs. Clock Difference" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Set a start and an end",
      "2. The same span, counted two ways",
      "3. What the library returns",
    ]);
    expect(presetBox()).toHaveValue("across-2016");
    expect(startBox()).toHaveValue("2016-12-31T23:59:59Z");
    expect(endBox()).toHaveValue("2017-01-01T00:00:01Z");
    expect(slider()).toBeEnabled();
    await expectNoAxeViolations(document.body);
  });

  it("describes both readings with the note on the second 60", async () => {
    await open();
    for (const box of [startBox(), endBox()]) {
      expect(box).toHaveAccessibleDescription(
        /A 23:59:60 is allowed on a day when a second was inserted/,
      );
    }
  });

  it("stops a typed start or end at 64 characters", async () => {
    const w = await open();
    for (const box of [startBox(), endBox()]) {
      await w.user.clear(box);
      await w.user.click(box);
      await w.user.paste("2".repeat(80));
      expect(box).toHaveValue("2".repeat(64));
    }
  });

  it("names the rulers with the summary", async () => {
    await open();
    expect(summary()).toHaveTextContent(/The clock difference is 2 s/);
    expect(figure()).toBeInTheDocument();
  });

  it("escapes a hostile seed", async () => {
    const hostile = '"><img src=x onerror=alert(1)>';
    await open({ start: hostile, end: hostile });
    // Only the rulers' own figure is an image.
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(startBox()).toHaveValue(hostile);
    expect(endBox()).toHaveValue(hostile);
  });

  it("gives two copies on one page their own ids", async () => {
    await open({}, "one");
    await open({}, "two");
    expect(screen.getAllByRole("textbox", { name: "Start" })).toHaveLength(2);
    expect(
      screen.getAllByRole("region", { name: "Elapsed vs. Clock Difference" }),
    ).toHaveLength(2);
  });
});

describe("every preset", () => {
  it("covers every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      ELAPSED_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(Object.entries(EXPECTED))("%s", async (id, want) => {
    const w = await open();
    await pick(w, id);
    expect(presetBox()).toHaveValue(id);
    for (const { id: g } of GROUPS) {
      // One result line for each call line, a refusal replacing only its own.
      expect(callsOf(g), g).toHaveTextContent(flat(want.copy[g]));
      expect(outputOf(g), g).toHaveTextContent(exact(flat(want.output[g])));
      expect(want.output[g].split("\n").length, g).toBe(
        want.copy[g].split("\n").length,
      );
    }
    GROUPS.forEach(({ id: g }, i) => {
      const reason = want.asides[i]!;
      if (reason === "") expect(asideOf(g), g).not.toBeInTheDocument();
      else expect(asideOf(g), g).toHaveTextContent(reason);
    });
    expectPlate(PLATE_CAPTIONS[0]!, [
      want.plates.clock,
      ...(want.plates.clock === "no result"
        ? (["", ""] as const)
        : CLOCK_LINES),
    ]);
    expectPlate(PLATE_CAPTIONS[1]!, [want.plates.count, ...want.countLines]);
    expectPlate(PLATE_CAPTIONS[2]!, [
      want.plates.elapsed,
      ...(want.plates.elapsed === "no result"
        ? (["", ""] as const)
        : ELAPSED_LINES),
    ]);

    // Each inserted second is a stretched cell on the clock face and a hatched "+1 s"
    // cell on the elapsed ruler; a ruler with no value says so in brackets instead.
    const clockNone = want.plates.clock === "no result";
    const elapsedNone = want.plates.elapsed === "no result";
    expect(screen.queryAllByText(CLOCK_MARK)).toHaveLength(
      clockNone ? 0 : want.marks,
    );
    expect(screen.queryAllByText(ELAPSED_MARK)).toHaveLength(
      elapsedNone ? 0 : want.marks,
    );
    expect(screen.queryAllByText(RULER_NO_SIGNAL)).toHaveLength(
      Number(clockNone) + Number(elapsedNone),
    );

    expect(
      within(insertions())
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(want.list);
    expect(figure()).toHaveAccessibleName(summary().textContent ?? "");
    await expectNoAxeViolations(document.body);
  });

  it("the rulers' ends read earlier first, whichever way the span runs", async () => {
    const w = await open();
    await pick(w, "backwards");
    expect(endsGroup()).toHaveTextContent(/2000-01-01.*2024-01-01/);
  });

  it("an empty list is a live answer and not a no signal", async () => {
    const w = await open();
    await pick(w, "no-insertions");
    expect(outputOf("count")).not.toHaveTextContent(/NO SIGNAL/);
    expect(asideOf("count")).not.toBeInTheDocument();
    expect(screen.queryByText(RULER_NO_SIGNAL)).not.toBeInTheDocument();
    expect(insertions()).toHaveTextContent(NONE_COUNTED);
  });

  it("a blank field leaves every call out and every output empty", async () => {
    const w = await open();
    await typeInto(w, endBox(), "");
    for (const { id: g } of GROUPS) {
      expect(outputOf(g)).toHaveTextContent(exact(BLANK));
      expect(outputOf(g)).not.toHaveTextContent(/NO SIGNAL/);
      expect(asideOf(g)).not.toBeInTheDocument();
    }
    expect(summary()).toHaveTextContent("Give a start and an end to compare.");
    expect(screen.getAllByText("Give a start and an end.")).toHaveLength(2);
    expect(screen.queryByText(RULER_NO_SIGNAL)).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("text that is not an instant is no signal with the reason", async () => {
    const w = await open();
    await typeInto(w, startBox(), "soon");
    // The end still reads, so the elapsed group keeps its second answer.
    expect(outputOf("clock")).toHaveTextContent(exact("NO SIGNAL"));
    expect(outputOf("elapsed")).toHaveTextContent(
      exact('NO SIGNAL "2017-01-01T00:00:38 TAI"'),
    );
    expect(outputOf("count")).toHaveTextContent(exact("NO SIGNAL"));
    for (const { id: g } of GROUPS) {
      expect(asideOf(g), g).toHaveTextContent(NOT_INSTANT_TEXT);
    }
    expect(presetBox()).toHaveValue("custom");
    expect(slider()).toBeEnabled();
    await expectNoAxeViolations(document.body);
  });
});

describe("the end slider", () => {
  const at = async (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix(iso) ?? 0);
    return open();
  };

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

  it("writes a midnight into the end and reads the new span", async () => {
    const w = await at("2026-10-16T09:00:00Z");
    await pick(w, "twenty-four-years");
    setRange(slider(), 20228);
    expect(endBox()).toHaveValue("2027-05-20T00:00:00Z");
    expect(startBox()).toHaveValue("2000-01-01T00:00:00Z");
    expect(plateParts(PLATE_CAPTIONS[1]!).value).toHaveTextContent("5");
    expect(presetBox()).toHaveValue("custom");
    setRange(slider(), 10);
    expect(endBox()).toHaveValue("1972-01-11T00:00:00Z");
    // The span now runs backwards from 2000, over every second inserted since 1972.
    expect(plateParts(PLATE_CAPTIONS[1]!).value).toHaveTextContent("-22");
    await expectNoAxeViolations(document.body);
  });

  it("is disabled while the end cannot be placed, and a typed end moves it", async () => {
    const w = await at("2026-10-16T09:00:00Z");
    await typeInto(w, endBox(), "soon");
    expect(slider()).toBeDisabled();
    await typeInto(w, endBox(), "1972-01-11T12:00:00Z");
    expect(slider()).toBeEnabled();
    expect(slider()).toHaveValue("10");
  });

  it("keeps the same plates and list while it moves", async () => {
    await at("2026-10-16T09:00:00Z");
    for (const day of [0, 5000, 10000, 20228]) {
      setRange(slider(), day);
      expect(screen.getAllByRole("definition")).toHaveLength(9);
      expect(insertions()).toBeInTheDocument();
    }
  });
});

describe("offset-spelled input", () => {
  it("draws the same marks as the Z spelling and prints the library's answers", async () => {
    const w = await open();
    await typeInto(w, startBox(), "2017-01-01T08:59:59+09:00");
    await typeInto(w, endBox(), "2017-01-01T09:00:01+09:00");
    expect(screen.getAllByText(CLOCK_MARK)).toHaveLength(1);
    expect(screen.getAllByText(ELAPSED_MARK)).toHaveLength(1);
    expect(outputOf("clock")).toHaveTextContent("2000000000n");
    expect(outputOf("count")).toHaveTextContent(exact("1"));
    expect(slider()).toBeEnabled();
  });
});

describe("permalinks", () => {
  it.each(ELAPSED_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await pick(first, id!);
      const link = first.permalink();
      expect(link).toMatch(
        new RegExp(
          `^${SITE_BASE}/tools/elapsed-vs-clock-difference/\\?w=elapsed&wa=`,
        ),
      );
      const seeded = seedFromLocation("elapsed", link.slice(link.indexOf("?")));
      expect(seeded).not.toBeNull();
      expect(Object.keys(seeded as object).sort()).toEqual(["end", "start"]);
      expect(
        Object.values(seeded as Record<string, unknown>).every(
          (v) => typeof v === "string" && v.length >= 10 && v.length <= 64,
        ),
      ).toBe(true);
      const outputs = GROUPS.map((g) => outputOf(g.id).textContent);
      first.destroy();

      await open(seeded as Record<string, unknown>, "second");
      expect(GROUPS.map((g) => outputOf(g.id).textContent)).toEqual(outputs);
      expect(presetBox()).toHaveValue(id);
    },
  );
});

describe("on-screen words", () => {
  it.each(ELAPSED_PRESETS.map((p) => [p.id]))(
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
    for (const p of ELAPSED_PRESETS) {
      await pick(w, p.id);
      expect(document.body).not.toHaveTextContent(forbidden);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(w.permalink).toBeDefined();
    expect(within(document.body).getAllByText("no result")).toHaveLength(3);
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

  it("redraws when the width changes, and keeps every inserted second", async () => {
    const spy = spyOnResizeObservers();
    const w = await open();
    await pick(w, "twenty-four-years");
    expect(screen.getAllByText(ELAPSED_MARK)).toHaveLength(5);
    const width = vi.spyOn(Element.prototype, "clientWidth", "get");
    width.mockReturnValue(600);
    spy.fire();
    expect(screen.getAllByText(ELAPSED_MARK)).toHaveLength(5);
    width.mockReturnValue(300);
    spy.fire();
    // Narrow, the five can share one cell, but the count is still there.
    expect(screen.getAllByText(/^\+(1|5)( s)?$/).length).toBeGreaterThan(0);
    expect(outputOf("count")).toHaveTextContent(exact("5"));
    await expectNoAxeViolations(document.body);
    width.mockRestore();
    spy.restore();
  });
});

describe("the links row", () => {
  const TIMELINE = "See these dates on the timeline";
  const CLOCKS = "Every clock at the start";
  const enabledLink = (name: string) => screen.getByRole("link", { name });
  const expectDisabled = (name: string) => {
    expect(linkNamed(name)).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
  };

  it("has both links, in order", async () => {
    await open();
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual([
      TIMELINE,
      CLOCKS,
    ]);
  });

  it("sends the span to the timeline as from and to, and the start to the Clock Converter", async () => {
    await open();
    expect(enabledLink(TIMELINE)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("leapline", {
        from: "2016-12-31T23:59:59Z",
        to: "2017-01-01T00:00:01Z",
      }),
    );
    expect(enabledLink(CLOCKS)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("satclock", { value: "2016-12-31T23:59:59Z" }),
    );
  });

  it("sends a leap second's own instant, and a span before 1972, which still reads a clock difference", async () => {
    const w = await open();
    await pick(w, "start-is-the-leap-second");
    expect(enabledLink(CLOCKS)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("satclock", { value: "2016-12-31T23:59:60Z" }),
    );
    await pick(w, "before-1972");
    expect(enabledLink(TIMELINE)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("leapline", {
        from: "1971-01-01T00:00:00Z",
        to: "2024-01-01T00:00:00Z",
      }),
    );
  });

  it("sends a backwards span as typed", async () => {
    const w = await open();
    await pick(w, "backwards");
    expect(enabledLink(TIMELINE)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("leapline", {
        from: "2024-01-01T00:00:00Z",
        to: "2000-01-01T00:00:00Z",
      }),
    );
    expect(enabledLink(CLOCKS)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("satclock", { value: "2024-01-01T00:00:00Z" }),
    );
  });

  it("follows what is typed", async () => {
    const w = await open();
    await typeInto(w, startBox(), "2020-01-01T00:00:00Z");
    await typeInto(w, endBox(), "2024-01-01T00:00:00Z");
    expect(enabledLink(TIMELINE)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("leapline", {
        from: "2020-01-01T00:00:00Z",
        to: "2024-01-01T00:00:00Z",
      }),
    );
    expect(enabledLink(CLOCKS)).toHaveAttribute(
      "href",
      encodeWidgetPermalink("satclock", { value: "2020-01-01T00:00:00Z" }),
    );
  });

  it("disables both links, with no href, on a second 60 that never happened", async () => {
    const w = await open();
    await pick(w, "not-inserted");
    expectDisabled(TIMELINE);
    expectDisabled(CLOCKS);
  });

  it("disables both links for blank fields, and lights them again for a reading", async () => {
    const w = await open();
    await typeInto(w, startBox(), "");
    await typeInto(w, endBox(), "");
    expectDisabled(TIMELINE);
    expectDisabled(CLOCKS);
    await typeInto(w, startBox(), "2020-01-01T00:00:00Z");
    await typeInto(w, endBox(), "2024-01-01T00:00:00Z");
    expect(enabledLink(TIMELINE)).not.toHaveAttribute("aria-disabled");
    expect(enabledLink(CLOCKS)).not.toHaveAttribute("aria-disabled");
  });

  it("lands on seeds the other tools read back", async () => {
    await open();
    const read = (name: string, kind: "leapline" | "satclock") => {
      const href = enabledLink(name).getAttribute("href")!;
      return seedFromLocation(kind, href.slice(href.indexOf("?")));
    };
    expect(read(TIMELINE, "leapline")).toEqual({
      from: "2016-12-31T23:59:59Z",
      to: "2017-01-01T00:00:01Z",
    });
    expect(read(CLOCKS, "satclock")).toEqual({
      value: "2016-12-31T23:59:59Z",
    });
  });
});
