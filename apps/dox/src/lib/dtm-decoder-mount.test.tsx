/**
 * @vitest-environment jsdom
 *
 * The DTM Decoder end to end: template -> mount -> interact -> assert, against the
 * real `@northguild/gmt`, through roles and accessible names the way a person (or
 * a screen reader) meets the page. Every preset's printed calls, result, verdict,
 * members and write-back are checked, so a drift in the library or the widget
 * fails here.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { lib } from "~/test/edi-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { DTM_PRESETS, REASON_TEXT, presetState } from "./dtm-decoder";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showDtmDecoder"] as AnyWidgetEntry;

const NOT_STATED = "not stated";

/** preset id → [calls, parse output, verdict, format call | null, format output]. */
const EXPECTED: Record<
  string,
  [string, string, string, string | null, string]
> = {
  "local-203": [
    'classifyEdifactDtmFormat("203")\nparseEdifactDateTime("202406151430", "203")',
    '{ kind: "dateTime", format: "203" }\n"2024-06-15T14:30:00"',
    "Offset: not stated",
    'formatEdifactDateTime("2024-06-15T14:30:00", "203")',
    '"202406151430"',
  ],
  "released-303": [
    'classifyEdifactDtmFormat("303")\nparseEdifactOffsetDateTime("202406151430+00", "303")\ntoOffsetInstant("2024-06-15T14:30:00+00:00")',
    '{ kind: "offsetDateTime", format: "303" }\n"2024-06-15T14:30:00+00:00"\n{ instant: "2024-06-15T14:30:00Z", offset: "+00:00" }',
    "Offset: stated (+00:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "utc-303": [
    'classifyEdifactDtmFormat("303")\nparseEdifactOffsetDateTime("202406151430UTC", "303")\ntoOffsetInstant("2024-06-15T14:30:00+00:00")',
    '{ kind: "offsetDateTime", format: "303" }\n"2024-06-15T14:30:00+00:00"\n{ instant: "2024-06-15T14:30:00Z", offset: "+00:00" }',
    "Offset: stated (+00:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "gmt-303": [
    'classifyEdifactDtmFormat("303")\nparseEdifactOffsetDateTime("202406151430GMT", "303")\ntoOffsetInstant("2024-06-15T14:30:00+00:00")',
    '{ kind: "offsetDateTime", format: "303" }\n"2024-06-15T14:30:00+00:00"\n{ instant: "2024-06-15T14:30:00Z", offset: "+00:00" }',
    "Offset: stated (+00:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "offset-205": [
    'classifyEdifactDtmFormat("205")\nparseEdifactOffsetDateTime("202406151430+0200", "205")\ntoOffsetInstant("2024-06-15T14:30:00+02:00")',
    '{ kind: "offsetDateTime", format: "205" }\n"2024-06-15T14:30:00+02:00"\n{ instant: "2024-06-15T12:30:00Z", offset: "+02:00" }',
    "Offset: stated (+02:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:00+02:00", "205")',
    '"202406151430+0200"',
  ],
  "offset-208": [
    'classifyEdifactDtmFormat("208")\nparseEdifactOffsetDateTime("20240615143045+0200", "208")\ntoOffsetInstant("2024-06-15T14:30:45+02:00")',
    '{ kind: "offsetDateTime", format: "208" }\n"2024-06-15T14:30:45+02:00"\n{ instant: "2024-06-15T12:30:45Z", offset: "+02:00" }',
    "Offset: stated (+02:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:45+02:00", "208")',
    '"20240615143045+0200"',
  ],
  "date-102": [
    'classifyEdifactDtmFormat("102")\nparseEdifactDate("20240615", "102")',
    '{ kind: "date", format: "102" }\n"2024-06-15"',
    "Offset: not stated",
    'formatEdifactDate("2024-06-15", "102")',
    '"20240615"',
  ],
  "time-402": [
    'classifyEdifactDtmFormat("402")\nparseEdifactTime("143045", "402")',
    '{ kind: "time", format: "402" }\n"14:30:45"',
    "Offset: not stated",
    'formatEdifactTime("14:30:45", "402")',
    '"143045"',
  ],
  "period-718": [
    'classifyEdifactDtmFormat("718")\nparseEdifactDatePeriod("2024061520240620", "718")',
    '{ kind: "datePeriod", format: "718" }\n{ start: "2024-06-15", end: "2024-06-20" }',
    "Offset: not stated",
    'formatEdifactDatePeriod("2024-06-15", "2024-06-20", "718")',
    '"2024061520240620"',
  ],
  "period-719": [
    'classifyEdifactDtmFormat("719")\nparseEdifactDateTimePeriod("202406151430202406201600", "719")',
    '{ kind: "dateTimePeriod", format: "719" }\n{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }',
    "Offset: not stated",
    'formatEdifactDateTimePeriod("2024-06-15T14:30:00", "2024-06-20T16:00:00", "719")',
    '"202406151430202406201600"',
  ],
  "cet-303": [
    'classifyEdifactDtmFormat("303")\nparseEdifactOffsetDateTime("202406151430CET", "303")',
    "NO SIGNAL",
    "",
    null,
    "no value to write back",
  ],
  "two-digit-101": [
    'classifyEdifactDtmFormat("101")',
    "NO SIGNAL",
    "",
    null,
    "no value to write back",
  ],
};

/** preset id → the member rows the result holds (others read `not stated`). */
const MEMBERS: Record<string, Record<string, string>> = {
  "local-203": { kind: "local date-time", value: "2024-06-15T14:30:00" },
  "released-303": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:00+00:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "utc-303": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:00+00:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "gmt-303": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:00+00:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "offset-205": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:00+02:00",
    instant: "2024-06-15T12:30:00Z",
    offset: "+02:00",
  },
  "offset-208": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:45+02:00",
    instant: "2024-06-15T12:30:45Z",
    offset: "+02:00",
  },
  "date-102": { kind: "date", value: "2024-06-15" },
  "time-402": { kind: "time", value: "14:30:45" },
  "period-718": {
    kind: "date period",
    value: "2024-06-15",
    "period-end": "2024-06-20",
  },
  "period-719": {
    kind: "date-time period",
    value: "2024-06-15T14:30:00",
    "period-end": "2024-06-20T16:00:00",
  },
};

/** Testing Library collapses whitespace in what it reads, so the expectation is flattened too. */
const flat = (text: string) => text.replaceAll("\n", " ");

const MEMBER_LABELS: Record<string, string> = {
  kind: "Kind",
  value: "Value",
  "period-end": "Period end",
  instant: "Instant",
  offset: "Offset",
};
const MEMBER_KEYS = Object.keys(MEMBER_LABELS);

const open = (args = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const input = () => screen.getByRole("textbox", { name: "Segment or value" });
const format = () => screen.getByRole("textbox", { name: /^Format code/ });
const zone = (n: number) => screen.getByRole("combobox", { name: `Zone ${n}` });
const section = (name: RegExp) => screen.getByRole("region", { name });
const states = () => section(/^2\. /);
const lands = () => section(/^3\. /);
const back = () => section(/^4\. /);

const parseCall = () =>
  within(states()).queryByRole("group", { name: "Calls made" });
const parseOutput = () =>
  within(states()).getByRole("status", { name: "What the calls returned" });
const verdict = () => screen.getByRole("status", { name: "Verdict" });
const reason = () => within(states()).queryByRole("complementary");
const split = () =>
  screen.getByRole("note", { name: "How the text was split" });
const formatOutput = () =>
  within(back()).getByRole("status", { name: "The value written back" });
const formatCall = () =>
  within(back()).queryByRole("group", { name: "Call made" });
const resolveCall = () =>
  within(lands()).queryByRole("group", { name: "Call made" });
const resolveOutput = () =>
  within(lands()).getByRole("status", { name: "What resolveLocal returned" });
const gap = () => screen.getByRole("status", { name: "Widest gap" });
const stripNote = () =>
  screen.getByRole("note", { name: "Where an offsetless value lands" });

function members(): Record<string, string> {
  const table = within(states()).getByRole("table", {
    name: /member by member/,
  });
  const names = cellsInColumn(table, "Member").map((c) =>
    c.textContent!.trim(),
  );
  const values = cellsInColumn(table, "Value").map((c) =>
    c.textContent!.trim(),
  );
  return Object.fromEntries(names.map((n, i) => [n, values[i]!]));
}
const strip = () => screen.getByRole("table", { name: /four zones/ });
const column = (name: string | RegExp) =>
  cellsInColumn(strip(), name).map((c) => c.textContent!.trim());

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(preset(), id);
}
async function retype(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.type(box, value);
}

describe("renderDtmDecoderTemplate", () => {
  it("is a named region with four numbered sections and named controls", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "DTM Decoder" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Paste a segment or a value",
      "2. What the value states",
      "3. Where an offsetless value lands",
      "4. Written back by the matching formatter",
    ]);
    for (const c of [preset(), input(), format(), zone(1), zone(4)]) {
      expect(c).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("textbox", { name: /year/i }),
    ).not.toBeInTheDocument();
  });

  it("does not run a hostile seed", async () => {
    await open({
      input: '"><img src=x onerror=alert(1)>',
      zone1: '"><script>x</script>',
    });
    expect(input()).toHaveValue('"><img src=x onerror=alert(1)>');
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      DTM_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(DTM_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await choose(w, id!);
    const [call, result, verdictText, formatCallText, formatOut] =
      EXPECTED[id!]!;

    expect(parseCall()).toHaveTextContent(flat(call));
    expect(parseOutput()).toHaveTextContent(flat(result));
    expect(verdict()).toHaveTextContent(
      verdictText === "" ? /^$/ : verdictText,
    );

    const expected = MEMBERS[id!];
    const got = members();
    for (const key of MEMBER_KEYS) {
      const want =
        expected === undefined ? "no result" : (expected[key] ?? NOT_STATED);
      expect(got[MEMBER_LABELS[key]!], key).toBe(want);
    }

    if (result === "NO SIGNAL") expect(reason()).toBeInTheDocument();
    else expect(reason()).not.toBeInTheDocument();

    expect(formatOutput()).toHaveTextContent(formatOut);
    if (formatCallText === null) {
      expect(formatCall()).not.toBeInTheDocument();
    } else {
      expect(formatCall()).toHaveTextContent(formatCallText);
    }
    await expectNoAxeViolations(w.root);
  });

  it("lands CET under 303 on the sentinel with the signed-hour sentence", async () => {
    const w = await open();
    await choose(w, "cet-303");
    expect(reason()).toHaveTextContent("signed hour");
    expect(reason()).toHaveTextContent("CET");
    expect(parseCall()).toHaveTextContent("parseEdifactOffsetDateTime");
    await expectNoAxeViolations(w.root);
  });

  it("lands a two-digit-year code on the sentinel and points at the pattern parsers", async () => {
    const w = await open();
    await choose(w, "two-digit-101");
    expect(reason()).toHaveTextContent("yyMMdd");
    expect(reason()).toHaveTextContent("yearWindow");
    expect(parseCall()).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("keeps the segment's function qualifier as sent", async () => {
    const w = await open();
    await retype(w, input(), "DTM+999:202406151430:203'");
    expect(split()).toHaveTextContent(
      "function qualifier 999, shown as sent and not interpreted",
    );
    await expectNoAxeViolations(w.root);
  });
});

describe("the strip", () => {
  it("reads 202406151430 in the four example zones", async () => {
    const w = await open();
    expect(column("Instant")).toEqual([
      "2024-06-15T12:30:00Z",
      "2024-06-15T12:30:00Z",
      "2024-06-15T06:30:00Z",
      "2024-06-15T04:30:00Z",
    ]);
    expect(column("Offset")[0]).toBe("+02:00");
    expect(column("As 205")[0]).toBe("202406151430+0200");
    expect(gap()).toHaveTextContent("Widest gap: 8 h");
    expect(resolveCall()).toHaveTextContent(
      'resolveLocal("2024-06-15T14:30:00", "Africa/Johannesburg", { disambiguation: "reject" })',
    );
    await expectNoAxeViolations(w.root);
  });

  it("reads a period of local date-times at both ends, with the end beside the start", async () => {
    const w = await open();
    await choose(w, "period-719");
    expect(column("Instant")[1]).toBe("2024-06-15T12:30:00Z");
    expect(column("End instant")[1]).toBe("2024-06-20T14:00:00Z");
    await choose(w, "local-203");
    expect(column("As 205")).toHaveLength(4);
    expect(
      within(strip()).queryByRole("columnheader", { name: "End instant" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("changes a row when its zone changes, and leaves the preset for Custom", async () => {
    const w = await open();
    await w.user.selectOptions(zone(3), "Asia/Kolkata");
    expect(column("Instant")[2]).toBe("2024-06-15T09:00:00Z");
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("says no zone chosen for a blank slot, and no gap with one zone", async () => {
    const w = await open();
    for (const n of [2, 3, 4]) await w.user.selectOptions(zone(n), "");
    expect(column("Instant")[1]).toBe("no zone chosen");
    expect(gap()).toHaveTextContent(
      "Choose two zones to see how far apart the answers are.",
    );
    await expectNoAxeViolations(w.root);
  });

  it("disables the zone selects and blanks the cells when the value states its offset", async () => {
    const w = await open();
    await choose(w, "offset-205");
    for (const n of [1, 2, 3, 4]) expect(zone(n)).toBeDisabled();
    expect(column("Instant")).toEqual(["", "", "", ""]);
    expect(stripNote()).toHaveTextContent(
      "The value states its offset, so there is nothing to choose.",
    );
    expect(resolveCall()).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("keeps the example zones off every preset whose result gives the strip no work", async () => {
    const w = await open();
    for (const p of DTM_PRESETS) {
      await choose(w, p.id);
      const filled = [1, 2, 3, 4].some(
        (n) => (zone(n) as HTMLSelectElement).value !== "",
      );
      expect(filled, p.id).toBe(p.zones.some((z) => z !== ""));
    }
  });

  it("never fills a zone from the code or the value typed", async () => {
    const w = await open();
    for (const n of [1, 2, 3, 4]) await w.user.selectOptions(zone(n), "");
    await retype(w, input(), "DTM+137:202406151430UTC:303'");
    await retype(w, input(), "202406151430");
    await retype(w, format(), "203");
    for (const n of [1, 2, 3, 4]) expect(zone(n)).toHaveValue("");
    await expectNoAxeViolations(w.root);
  });

  it("renders a time the clock shows twice as NO SIGNAL with its reason", async () => {
    const w = await open();
    await retype(w, input(), "202411030130");
    await retype(w, format(), "203");
    await w.user.selectOptions(zone(1), "America/New_York");
    expect(column("Instant")[0]).toBe("NO SIGNAL");
    expect(within(lands()).getByRole("complementary")).toHaveTextContent(
      "happens twice",
    );
    expect(resolveOutput()).toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(w.root);
  });

  it("says an offset-free date names no instant, and a period of dates is named", async () => {
    const w = await open();
    await choose(w, "date-102");
    expect(lands()).toHaveTextContent("nothing to place");
    await choose(w, "period-718");
    expect(stripNote()).toHaveTextContent("period of dates");
    await expectNoAxeViolations(w.root);
  });
});

describe("bare values and segments", () => {
  it("shows the library's own sentinel for a value with the release character", async () => {
    const w = await open();
    await retype(w, input(), "202406151430?+02");
    await retype(w, format(), "303");
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent(
      REASON_TEXT["released-character"]({ form: "value" }),
    );
    expect(split()).toHaveTextContent("Read as a bare value.");
    await expectNoAxeViolations(w.root);
  });

  it("un-releases the same text in a segment", async () => {
    const w = await open();
    await retype(w, input(), "DTM+137:202406151430?+02:303'");
    expect(parseOutput()).toHaveTextContent('"2024-06-15T14:30:00+02:00"');
    expect(parseCall()).toHaveTextContent(
      'parseEdifactOffsetDateTime("202406151430+02", "303")',
    );
    await expectNoAxeViolations(w.root);
  });

  it("follows the segment typed from CET to a stated offset", async () => {
    const w = await open();
    await retype(w, input(), "DTM+137:202406151430CET:303'");
    expect(preset()).toHaveValue("custom");
    expect(verdict()).toHaveTextContent(/^$/);
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    await retype(w, input(), "DTM+137:202406151430UTC:303'");
    expect(verdict()).toHaveTextContent("Offset: stated (+00:00)");
    await expectNoAxeViolations(w.root);
  });

  it("restores the typed format when a segment goes back to a bare value", async () => {
    const w = await open();
    await retype(w, input(), "240615");
    await retype(w, format(), "101");
    await retype(w, input(), "DTM+137:202406151430:203'");
    expect(format()).toHaveValue("203");
    expect(format()).toBeDisabled();
    await retype(w, input(), "240615");
    expect(format()).toHaveValue("101");
    expect(format()).toBeEnabled();
    await expectNoAxeViolations(w.root);
  });

  it.each([
    ["", "203", "Paste a DTM segment or a value."],
    ["202406151430", "", "Type the code."],
    ["2024", "602", "602 is not a format code the library reads."],
    ["not a date", "203", "does not fit code 203"],
    ["240615", "101", "two-digit year"],
    ["202406151430CET", "304", "CET"],
  ])("explains %j under %j", async (text, code, snippet) => {
    const w = await open();
    await retype(w, input(), text);
    await retype(w, format(), code);
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent(snippet);
    await expectNoAxeViolations(w.root);
  });

  it("a blank form makes no call and says nothing to read", async () => {
    const w = await open();
    await retype(w, input(), "");
    await retype(w, format(), "");
    expect(parseOutput()).toHaveTextContent("nothing to read");
    expect(parseOutput()).not.toHaveTextContent("NO SIGNAL");
    expect(parseCall()).not.toBeInTheDocument();
    expect(reason()).not.toBeInTheDocument();
    expect(verdict()).toHaveTextContent(/^$/);
    expect(members()["Value"]).toBe("no result");
    expect(formatOutput()).toHaveTextContent("no value to write back");
    expect(stripNote()).toHaveTextContent("No value.");
    await expectNoAxeViolations(w.root);
  });

  it("goes from blank to a refused value to a result and back, with the call frame following", async () => {
    const w = await open();
    await retype(w, input(), "");
    await retype(w, format(), "");
    expect(parseCall()).not.toBeInTheDocument();

    // The first character is partial input: a value with no format code is the
    // sentinel with its reason, not the empty state.
    await retype(w, input(), "2");
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent("Type the code.");

    await retype(w, input(), "202406151430");
    await retype(w, format(), "203");
    expect(parseCall()).toBeInTheDocument();
    expect(parseOutput()).toHaveTextContent('"2024-06-15T14:30:00"');

    await retype(w, input(), "");
    await retype(w, format(), "");
    expect(parseOutput()).toHaveTextContent("nothing to read");
    expect(parseCall()).not.toBeInTheDocument();
    expect(reason()).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("a format code with no value is partial input: the sentinel, with its reason", async () => {
    const w = await open();
    await retype(w, input(), "");
    await retype(w, format(), "203");
    expect(parseCall()).toBeInTheDocument();
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent("Paste a DTM segment or a value.");
    await expectNoAxeViolations(w.root);
  });

  it("says the segment carries no format code", async () => {
    const w = await open();
    await retype(w, input(), "DTM+137:202406151430'");
    expect(reason()).toHaveTextContent("The segment carries none.");
    await expectNoAxeViolations(w.root);
  });
});

describe("seeding", () => {
  it("seeds an unlisted zone without dropping it", async () => {
    await open({
      input: "202406151430",
      format: "203",
      zone1: "Pacific/Auckland",
    });
    expect(zone(1)).toHaveValue("Pacific/Auckland");
    expect(column("Instant")[0]).toBe("2024-06-15T02:30:00Z");
  });

  it("seeds the starter question with no zone: the widget answers not stated", async () => {
    await open({ input: "202406151430", format: "203" });
    expect(verdict()).toHaveTextContent("Offset: not stated");
    expect(column("Instant")[0]).toBe("no zone chosen");
  });

  it("seeds the segment text into its box", async () => {
    await open({ input: "DTM+137:202406151430:205'" });
    expect(input()).toHaveValue("DTM+137:202406151430:205'");
  });

  it("loads an old link that still carries a year window without error, and ignores it", async () => {
    const w = await open({
      input: "240615",
      format: "101",
      yearWindow: "2000",
    });
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toHaveTextContent("yearWindow");
    expect(w.permalink()).not.toContain("yearWindow");
    const url = w.permalink();
    expect(seedFromLocation("dtm", url.slice(url.indexOf("?")))).toEqual({
      input: "240615",
      format: "101",
    });
  });
});

describe("permalinks", () => {
  it.each(DTM_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choose(first, id!);
      const url = first.permalink();
      expect(url).toMatch(/\?w=dtm&wa=[^)"'\s]+$/);
      const state = seedFromLocation(
        "dtm",
        url.slice(url.indexOf("?")),
      ) as Record<string, unknown>;
      expect(
        Object.values(state).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      expect(encodeWidgetPermalink("dtm", state)).toBe(url);
      first.destroy();

      await open(state, "second");
      expect(parseOutput()).toHaveTextContent(flat(EXPECTED[id!]![1]));
      expect(preset()).toHaveValue(id);
    },
  );

  it("carries the format only for a bare value, and never a year window", async () => {
    const w = await open();
    expect(w.permalink()).not.toContain("format");
    await retype(w, input(), "240615");
    await retype(w, format(), "101");
    const url = w.permalink();
    expect(seedFromLocation("dtm", url.slice(url.indexOf("?")))).toMatchObject({
      input: "240615",
      format: "101",
    });
    expect(url).not.toContain("yearWindow");
  });
});

describe("naming", () => {
  it("names no regulator, statute, agency, docket or customs body, and no business event", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|gate-in)\b/i;
    const w = await open();
    expect(w.root).not.toHaveTextContent(forbidden);
    for (const p of DTM_PRESETS) {
      expect(`${p.label} ${p.description}`).not.toMatch(forbidden);
      await choose(w, p.id);
      expect(w.root).not.toHaveTextContent(forbidden);
      expect(presetState(p).input).not.toMatch(forbidden);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert, and destroying twice is safe", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(members()["Value"]).toBe("no result");
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});

describe("on-screen words", () => {
  it.each(DTM_PRESETS.map((p) => [p.id]))(
    "%s never names the library as GMT, and shows no raw null",
    async (id) => {
      const w = await open();
      await choose(w, id!);
      expect(w.root).not.toHaveTextContent(
        /GMT (does|returns|maps|reads|never)/,
      );
      expect(states()).not.toHaveTextContent(/\bundefined\b/);
      for (const v of Object.values(members())) {
        expect(v).not.toMatch(/null|undefined|^$/);
      }
    },
  );

  it("takes the segment's parts and the value apart, in words", async () => {
    await open();
    expect(
      screen.getByRole("img", {
        name: "Segment with function qualifier 137, shown as sent. 202406151430 under code 203: year 2024, month 06, day 15, hour 14, minute 30; no offset",
      }),
    ).toBeInTheDocument();
  });

  it("describes the release character and the offset as a group", async () => {
    const w = await open();
    await choose(w, "released-303");
    const figure = screen.getByRole("img", {
      name: /^Segment with function qualifier/,
    });
    expect(figure).not.toHaveAccessibleName(/no offset/);
    await expectNoAxeViolations(w.root);
  });

  it("shows a period's two halves", async () => {
    const w = await open();
    for (const id of ["period-718", "period-719"]) {
      await choose(w, id);
      expect(
        screen.getByRole("img", { name: /start: .*; end: / }),
      ).toBeInTheDocument();
    }
    await expectNoAxeViolations(w.root);
  });

  it("draws a refused value without claiming an offset", async () => {
    const w = await open();
    await retype(w, input(), "DTM+137:202413151430:203'");
    expect(screen.getByRole("img")).not.toHaveAccessibleName(/no offset/);
    await expectNoAxeViolations(w.root);
  });
});

describe("the library under the widget", () => {
  it("is the real one: a printed call is the call the library made", () => {
    expect(lib.parseEdifactDateTime("202406151430", "203")).toBe(
      "2024-06-15T14:30:00",
    );
  });
});

describe("the length cap", () => {
  it("stops the format code at 8 characters", async () => {
    const w = await open();
    await retype(w, input(), "240615");
    const box = format();
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(16));
    expect(box).toHaveValue("x".repeat(8));
  });
});
