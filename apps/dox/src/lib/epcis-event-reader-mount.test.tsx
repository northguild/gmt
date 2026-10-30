/**
 * @vitest-environment jsdom
 *
 * The EPCIS Event Reader end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles and accessible names the way a person (or a screen
 * reader) meets the page. Every preset's printed calls, result, verdict, members, dates,
 * write-back and hand-off are checked, so a drift in the library or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { blDateLib } from "~/test/ledger-lib";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { readArgs as readBlArgs, readBlDate } from "./bl-date-stamp";
import {
  EPCIS_PRESETS,
  HANDOFF_LABEL,
  NULL_TEXT,
  presetState,
} from "./epcis-event-reader";
import { SITE_BASE } from "./site";
import {
  decodeWidgetPermalink,
  encodeWidgetPermalink,
  seedFromLocation,
} from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showEpcisEventReader"] as AnyWidgetEntry;

/** preset id → [parse call, parse output, verdict]. */
const EXPECTED: Record<string, [string, string, string]> = {
  "next-day": [
    'parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" })',
    '{ instant: "2024-06-15T23:30:00Z", offset: "+02:00", local: "2024-06-16T01:30:00" }',
    "Offset: stated (+02:00)",
  ],
  "offsets-disagree": [
    'parseEpcisEvent({ eventTime: "2024-06-15T10:00:00+02:00", eventTimeZoneOffset: "-05:00" })',
    '{ instant: "2024-06-15T08:00:00Z", offset: "-05:00", local: "2024-06-15T03:00:00" }',
    "Offset: stated (-05:00)",
  ],
  "minus-zero": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-00:00" })',
    '{ instant: "2024-06-15T14:30:00Z", offset: "+00:00", local: "2024-06-15T14:30:00" }',
    "Offset: stated (+00:00)",
  ],
  "no-offset": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z" })',
    "NO SIGNAL",
    "Offset: not stated",
  ],
  "z-as-offset": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "Z" })',
    "NO SIGNAL",
    "",
  ],
  "no-colon": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "+0200" })',
    "NO SIGNAL",
    "",
  ],
  "no-seconds": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30Z", eventTimeZoneOffset: "+02:00" })',
    "NO SIGNAL",
    "",
  ],
  "february-30": [
    'parseEpcisEvent({ eventTime: "2024-02-30T14:30:00Z", eventTimeZoneOffset: "+02:00" })',
    "NO SIGNAL",
    "",
  ],
};

/** preset id → [UTC date, local date, words, written back, note]. */
const DATES: Record<string, [string, string, string, string, string]> = {
  "next-day": [
    "2024-06-15",
    "2024-06-16",
    "The local date is the next day.",
    '{ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" }',
    "",
  ],
  "offsets-disagree": [
    "2024-06-15",
    "2024-06-15",
    "The same date on both clocks.",
    '{ eventTime: "2024-06-15T08:00:00Z", eventTimeZoneOffset: "-05:00" }',
    "eventTime is written again as the instant in UTC, ending in Z, with no trailing zeros in a fraction.",
  ],
  "minus-zero": [
    "2024-06-15",
    "2024-06-15",
    "The same date on both clocks.",
    '{ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "+00:00" }',
    "The offset came back with a plus sign: the library writes -00:00 as +00:00.",
  ],
};

const open = (args = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const time = () => screen.getByRole("textbox", { name: "eventTime" });
const offset = () =>
  screen.getByRole("textbox", { name: "eventTimeZoneOffset" });
const section = (name: RegExp) => screen.getByRole("region", { name });
const states = () => section(/^2\. /);
const clocks = () => section(/^3\. /);
const back = () => section(/^4\. /);

const parseCall = () =>
  within(states()).queryByRole("group", { name: "Call made" });
const parseOutput = () =>
  within(states()).getByRole("status", { name: "What the call returned" });
const verdict = () => screen.getByRole("status", { name: "Verdict" });
const reason = () => within(states()).queryByRole("complementary");
const datesCall = () =>
  within(clocks()).queryByRole("group", { name: "Calls made" });
const datesOutput = () =>
  within(clocks()).getByRole("status", { name: "What the calls returned" });
const words = () =>
  screen.getByRole("status", { name: "The two dates compared" });
const formatCall = () =>
  within(back()).queryByRole("group", { name: "Call made" });
const formatOutput = () =>
  within(back()).getByRole("status", { name: "The value written back" });
const formatNote = () =>
  screen.getByRole("note", { name: "About the written value" });
const utcRail = () => screen.getByRole("img", { name: /^UTC: / });
const localRail = () => screen.getByRole("img", { name: /^Local clock/ });
const figure = () => screen.queryByRole("img", { name: /^eventTime/ });
const handoff = () => screen.queryByRole("link", { name: HANDOFF_LABEL });

function table(name: RegExp, region: HTMLElement): Record<string, string> {
  const t = within(region).getByRole("table", { name });
  const names = cellsInColumn(t, "Member").map((c) => c.textContent!.trim());
  const values = cellsInColumn(t, "Value").map((c) => c.textContent!.trim());
  return Object.fromEntries(names.map((n, i) => [n, values[i]!]));
}
const members = () => table(/member by member/, states());
const dates = () => table(/date on each clock/, clocks());

const flat = (text: string) => text.replaceAll("\n", " ");

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(preset(), id);
}
async function retype(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.type(box, value);
}

describe("renderEpcisEventReaderTemplate", () => {
  it("is a named region with four numbered sections and named controls", async () => {
    const w = await open();
    expect(
      screen.getByRole("region", { name: "EPCIS Event Reader" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. The event's two fields",
      "2. What the event states",
      "3. The same moment on two clocks",
      "4. Written back by formatEpcisEvent",
    ]);
    for (const c of [preset(), time(), offset()]) {
      expect(c).toBeInTheDocument();
    }
    await expectNoAxeViolations(w.root);
  });

  it("opens on the first preset unless it is seeded", async () => {
    const first = await open();
    expect(preset()).toHaveValue("next-day");
    expect(time()).toHaveValue("2024-06-15T23:30:00Z");
    first.destroy();
    await open({ eventTime: "2024-06-15T15:00:00Z" }, "second");
    expect(preset()).toHaveValue("custom");
    expect(offset()).toHaveValue("");
  });

  it("does not run a hostile seed", async () => {
    await open({
      eventTime: '"><img src=x onerror=alert(1)>',
      eventTimeZoneOffset: '"><script>x</script>',
    });
    expect(time()).toHaveValue('"><img src=x onerror=alert(1)>');
    expect(screen.queryByRole("img", { name: "x" })).not.toBeInTheDocument();
  });

  it("limits what can be typed to what the library could read", async () => {
    const w = await open();
    await retype(w, offset(), "+02:00".repeat(10));
    expect((offset() as HTMLInputElement).value.length).toBeLessThanOrEqual(16);
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      EPCIS_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(EPCIS_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await choose(w, id!);
    const [call, result, verdictLine] = EXPECTED[id!]!;
    const sentinel = result === "NO SIGNAL";

    expect(parseCall()).toHaveTextContent(call);
    expect(parseOutput()).toHaveTextContent(flat(result));
    expect(verdict()).toHaveTextContent(
      verdictLine === "" ? /^$/ : verdictLine,
    );
    if (sentinel) expect(reason()).toBeInTheDocument();
    else expect(reason()).not.toBeInTheDocument();
    expect(
      screen.getByText(EPCIS_PRESETS.find((p) => p.id === id)!.description, {
        selector: "p",
      }),
    ).toBeInTheDocument();

    const got = members();
    for (const key of ["Instant", "Offset", "Local"]) {
      if (sentinel) expect(got[key]).toBe("no result");
      else expect(got[key]).not.toBe("no result");
    }

    const expected = DATES[id!];
    if (expected === undefined) {
      expect(dates()).toEqual({
        "UTC date": "no result",
        "Local date": "no result",
      });
      expect(words()).toHaveTextContent(/^$/);
      expect(datesCall()).not.toBeInTheDocument();
      expect(datesOutput()).toHaveTextContent("no dates to compare");
      expect(formatOutput()).toHaveTextContent("no value to write back");
      expect(formatCall()).not.toBeInTheDocument();
      expect(formatNote()).toHaveTextContent(/^$/);
      expect(handoff()).not.toBeInTheDocument();
      expect(screen.getByText(HANDOFF_LABEL)).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expectNoAxeViolations(w.root);
      return;
    }
    const [utc, local, wordsText, written, note] = expected;
    expect(dates()).toEqual({ "UTC date": utc, "Local date": local });
    expect(words()).toHaveTextContent(wordsText);
    expect(datesCall()).toBeInTheDocument();
    expect(datesOutput()).not.toHaveTextContent("NO SIGNAL");
    expect(formatOutput()).toHaveTextContent(flat(written));
    expect(formatCall()).toBeInTheDocument();
    expect(formatNote()).toHaveTextContent(note === "" ? /^$/ : note);
    expect(utcRail()).toHaveTextContent(utc);
    expect(localRail()).toHaveTextContent(local);
    expect(handoff()).toHaveAttribute(
      "href",
      expect.stringContaining(`${SITE_BASE}/tools/bl-date-stamp/?w=bldate&wa=`),
    );
    await expectNoAxeViolations(w.root);
  });

  it("prints the four date calls in the order made, and their results beside them", async () => {
    const w = await open();
    expect(datesCall()).toHaveTextContent(
      [
        'convertUtcToPlainDate("2024-06-15T23:30:00Z")',
        'chopTime("2024-06-16T01:30:00")',
        'areDatesEqual("2024-06-15", "2024-06-16")',
        'isAfterDate("2024-06-16", "2024-06-15")',
      ].join(" "),
    );
    expect(datesOutput()).toHaveTextContent(
      ['"2024-06-15"', '"2024-06-16"', "false", "true"].join(" "),
    );
    await expectNoAxeViolations(w.root);
  });

  it.each([
    ["no-offset", NULL_TEXT.noOffset],
    ["z-as-offset", NULL_TEXT.badOffset],
    ["no-colon", NULL_TEXT.badOffset],
    ["no-seconds", NULL_TEXT.badTime],
    ["february-30", NULL_TEXT.badDate],
  ])(
    "%s says why in one sentence from the library's validators",
    async (id, sentence) => {
      const w = await open();
      await choose(w, id);
      expect(reason()).toHaveTextContent(sentence);
      await expectNoAxeViolations(w.root);
    },
  );
});

describe("the day rails", () => {
  it("names each clock and the date the event falls on", async () => {
    const w = await open();
    expect(utcRail()).toHaveAccessibleName(
      "UTC: the event falls on 2024-06-15.",
    );
    expect(localRail()).toHaveAccessibleName(
      "Local clock +02:00: the event falls on 2024-06-16.",
    );
    expect(localRail()).toHaveTextContent("Local clock +02:00");
    expect(localRail()).toHaveTextContent("00:00");
    await expectNoAxeViolations(w.root);
  });

  it("keeps each rail and says why in words without a result", async () => {
    const w = await open();
    await choose(w, "no-offset");
    expect(localRail()).toHaveTextContent(
      "Not stated: the offset is missing, so the local clock is unknown.",
    );
    expect(utcRail()).toHaveTextContent(
      "No instant to place: the library read no result.",
    );
    expect(utcRail()).toHaveTextContent("no result");
    expect(utcRail()).not.toHaveTextContent("00:00");
    await expectNoAxeViolations(w.root);
    await choose(w, "z-as-offset");
    expect(localRail()).toHaveTextContent(
      "No local clock: the library read no result.",
    );
    await expectNoAxeViolations(w.root);
  });

  it("is always there, whichever preset is chosen", async () => {
    const w = await open();
    for (const p of EPCIS_PRESETS) {
      await choose(w, p.id);
      expect(utcRail()).toBeInTheDocument();
      expect(localRail()).toBeInTheDocument();
    }
  });
});

describe("a blank form and partial input", () => {
  it("a blank form makes no call and is empty, not amber", async () => {
    const w = await open();
    await retype(w, time(), "");
    await retype(w, offset(), "");
    expect(parseOutput()).toHaveTextContent("nothing to read");
    expect(parseOutput()).not.toHaveTextContent("NO SIGNAL");
    expect(parseCall()).not.toBeInTheDocument();
    expect(reason()).not.toBeInTheDocument();
    expect(verdict()).toHaveTextContent(/^$/);
    expect(members()["Instant"]).toBe("no result");
    expect(formatOutput()).toHaveTextContent("no value to write back");
    expect(utcRail()).toHaveTextContent("Nothing to place yet.");
    expect(localRail()).toHaveTextContent("Nothing to place yet.");
    expect(
      within(states()).getByText(
        "Type an eventTime and an eventTimeZoneOffset to take them apart.",
        { selector: "p" },
      ),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("anything typed in one field is partial input, and the library answers it", async () => {
    const w = await open();
    await retype(w, time(), "");
    await retype(w, offset(), "+02:00");
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    expect(parseCall()).toHaveTextContent(
      'parseEpcisEvent({ eventTime: "", eventTimeZoneOffset: "+02:00" })',
    );
    expect(reason()).toHaveTextContent(NULL_TEXT.noTime);
    await expectNoAxeViolations(w.root);
    await retype(w, offset(), "");
    await retype(w, time(), "2024-06-15T14:30:00Z");
    expect(reason()).toHaveTextContent(NULL_TEXT.noOffset);
    expect(verdict()).toHaveTextContent("Offset: not stated");
    expect(parseCall()).toHaveTextContent(
      'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z" })',
    );
    await expectNoAxeViolations(w.root);
  });

  it("goes from blank to a refused value to a result and back, with the call frame following", async () => {
    const w = await open();
    await retype(w, time(), "");
    await retype(w, offset(), "");
    expect(parseCall()).not.toBeInTheDocument();
    await retype(w, time(), "2024-06-15T14:30:00Z");
    expect(parseCall()).toBeInTheDocument();
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    await retype(w, offset(), "-05:00");
    expect(parseOutput()).toHaveTextContent('local: "2024-06-15T09:30:00"');
    expect(words()).toHaveTextContent("The same date on both clocks.");
    await expectNoAxeViolations(w.root);
    await retype(w, time(), "");
    await retype(w, offset(), "");
    expect(parseCall()).not.toBeInTheDocument();
    expect(members()["Local"]).toBe("no result");
  });

  it("changes the preset to Custom when a field is edited, and back when it matches", async () => {
    const w = await open();
    await retype(w, offset(), "+03:00");
    expect(preset()).toHaveValue("custom");
    await retype(w, offset(), "+02:00");
    expect(preset()).toHaveValue("next-day");
  });

  it("draws a refused field in a neutral box that names the text, never as a sentinel", async () => {
    const w = await open();
    await choose(w, "z-as-offset");
    expect(figure()).toHaveAccessibleName(
      /eventTimeZoneOffset Z: text the library does not read/,
    );
    await expectNoAxeViolations(w.root);
    await choose(w, "no-offset");
    expect(figure()).toHaveAccessibleName(/eventTimeZoneOffset not sent/);
    await expectNoAxeViolations(w.root);
  });

  it("takes both fields apart, each part named", async () => {
    const w = await open();
    expect(figure()).toHaveAccessibleName(/^eventTime 2024-06-15T23:30:00Z: /);
    expect(figure()).toHaveAccessibleName(/date 2024-06-15/);
    expect(figure()).toHaveAccessibleName(/offset \+02:00/);
    expect(figure()).toHaveTextContent("eventTime");
    expect(figure()).toHaveTextContent("eventTimeZoneOffset");
    await expectNoAxeViolations(w.root);
  });
});

describe("the hand-off", () => {
  it("opens the B/L Date Stamp on the instant, the event and the offset", async () => {
    await open();
    const link = handoff()!;
    expect(link).toHaveAccessibleName(
      "Read this moment as a shipped on board date in the B/L Date Stamp",
    );
    const href = link.getAttribute("href")!;
    expect(href).toBe(
      encodeWidgetPermalink("bldate", {
        value: "2024-06-15T23:30:00Z",
        event: "shippedOnBoard",
        timeZone: "+02:00",
      }),
    );
    const decoded = decodeWidgetPermalink(href.slice(href.indexOf("?")));
    expect(decoded!.kind).toBe("bldate");
    const seeded = seedFromLocation("bldate", href.slice(href.indexOf("?")));
    // The B/L Date Stamp reads the offset as its place zone.
    const bl = readBlDate(readBlArgs(seeded), blDateLib);
    expect(bl.bl).toBe("2024-06-16");
    expect(bl.utc).toBe("2024-06-15");
  });

  it("follows the fields, and loses its address when the result goes", async () => {
    const w = await open();
    await retype(w, offset(), "-05:00");
    expect(decodeURIComponent(handoff()!.getAttribute("href")!)).toContain(
      '"timeZone":"-05:00"',
    );
    await retype(w, offset(), "Z");
    expect(handoff()).not.toBeInTheDocument();
    expect(screen.getByText(HANDOFF_LABEL)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expectNoAxeViolations(w.root);
  });
});

describe("seeding", () => {
  it("seeds the scenario's event and opens it as the next-day preset", async () => {
    await open({
      eventTime: "2024-06-15T23:30:00Z",
      eventTimeZoneOffset: "+02:00",
    });
    expect(preset()).toHaveValue("next-day");
    expect(dates()["Local date"]).toBe("2024-06-16");
    expect(words()).toHaveTextContent("The local date is the next day.");
    expect(verdict()).toHaveTextContent("Offset: stated (+02:00)");
  });

  it("never fills a missing offset in", async () => {
    await open({ eventTime: "2024-06-15T14:30:00Z" });
    expect(offset()).toHaveValue("");
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    expect(verdict()).toHaveTextContent("Offset: not stated");
    expect(preset()).toHaveValue("no-offset");
  });

  it("shows what it was seeded with", async () => {
    await open({
      eventTime: "2024-06-15T14:30:00Z",
      eventTimeZoneOffset: "-05:00",
    });
    expect(time()).toHaveValue("2024-06-15T14:30:00Z");
    expect(offset()).toHaveValue("-05:00");
  });
});

describe("permalinks", () => {
  it.each(EPCIS_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choose(first, id!);
      const url = first.permalink();
      expect(url).toMatch(/\?w=epcis&wa=[^)"'\s]+$/);
      const state = seedFromLocation(
        "epcis",
        url.slice(url.indexOf("?")),
      ) as Record<string, unknown>;
      expect(
        Object.values(state).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      // A blank offset has no key.
      expect("eventTimeZoneOffset" in state).toBe(id !== "no-offset");
      expect(encodeWidgetPermalink("epcis", state)).toBe(url);
      const output = parseOutput().textContent!;
      first.destroy();

      await open(state, "second");
      expect(parseOutput()).toHaveTextContent(output, {
        normalizeWhitespace: false,
      });
      expect(preset()).toHaveValue(id);
    },
  );
});

describe("naming", () => {
  it("names no regulator, statute, agency, docket or customs body", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\b/i;
    const w = await open();
    expect(w.root).not.toHaveTextContent(forbidden);
    for (const p of EPCIS_PRESETS) {
      expect(`${p.label} ${p.description}`).not.toMatch(forbidden);
      await choose(w, p.id);
      expect(w.root).not.toHaveTextContent(forbidden);
      expect(presetState(p).eventTime).not.toMatch(forbidden);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert, and destroying twice is safe", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(members()["Instant"]).toBe("no result");
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});

describe("on-screen words", () => {
  it.each(EPCIS_PRESETS.map((p) => [p.id]))(
    "%s never names the library as GMT, and shows no raw null",
    async (id) => {
      const w = await open();
      await choose(w, id!);
      expect(w.root).not.toHaveTextContent(/GMT/);
      expect(states()).not.toHaveTextContent(/\bundefined\b/);
      for (const v of [
        ...Object.values(members()),
        ...Object.values(dates()),
      ]) {
        expect(v).not.toMatch(/null|undefined|^$/);
      }
    },
  );

  it("calls the library the library", async () => {
    const w = await open();
    await choose(w, "no-offset");
    expect(reason()).toHaveTextContent(/the library does not assume UTC/);
  });
});

describe("the library under the widget", () => {
  it("is the real one: a printed call is the call the library made", async () => {
    const w = await open();
    await choose(w, "minus-zero");
    expect(members()["Offset"]).toBe("+00:00");
    expect(formatOutput()).toHaveTextContent('eventTimeZoneOffset: "+00:00"');
  });
});

describe("the length cap", () => {
  it("stops eventTimeZoneOffset at 16 characters", async () => {
    const w = await open();
    const box = offset();
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(24));
    expect(box).toHaveValue("x".repeat(16));
  });
});
