/**
 * @vitest-environment jsdom
 *
 * The X12 Time Reader end to end: template -> mount -> interact -> assert, against
 * the real `@northguild/gmt`, through roles and accessible names the way a person
 * (or a screen reader) meets the page. Every preset's printed calls, results,
 * verdict, members, instant and write-back are checked, so a drift in the library
 * or the widget fails here.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { DTP_PRESETS, X12_PRESETS } from "./x12-time-reader";

installJsdomShims();

const entry = WIDGET_REGISTRY["showX12TimeReader"] as AnyWidgetEntry;

const NOT_STATED = "not stated";

interface Expected {
  /** The printed section 2 calls, one per line. */
  calls: string;
  /** The printed results, one per line. */
  results: string;
  verdict: string;
  /** Member cells the read holds; the rest read `not stated`. */
  members: Record<string, string>;
  instant: string;
  date: string;
  time: string;
}

const L = "2024-06-15T14:30:00";
const AT = '"20240615", "1430"';

const EXPECTED: Record<string, Expected> = {
  "status-et": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("ET")\nx12TimeCodeZone("ET")`,
    results: `"${L}"\n{ kind: "zone", timeCode: "ET" }\n{ zone: "Eastern", daylight: null }`,
    verdict: "Offset: not stated",
    members: {
      kind: "local date-time",
      value: L,
      code: "names a zone",
      zone: "Eastern",
      daylight: "not said",
    },
    instant: "2024-06-15T18:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "status-ed": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("ED")\nx12TimeCodeZone("ED")`,
    results: `"${L}"\n{ kind: "zone", timeCode: "ED" }\n{ zone: "Eastern", daylight: true }`,
    verdict: "Offset: not stated",
    members: {
      kind: "local date-time",
      value: L,
      code: "names a zone",
      zone: "Eastern",
      daylight: "daylight",
    },
    instant: "2024-06-15T18:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "status-es": {
    calls:
      'parseX12DateAndTime("20240115", "1430")\nclassifyX12TimeCode("ES")\nx12TimeCodeZone("ES")',
    results:
      '"2024-01-15T14:30:00"\n{ kind: "zone", timeCode: "ES" }\n{ zone: "Eastern", daylight: false }',
    verdict: "Offset: not stated",
    members: {
      kind: "local date-time",
      value: "2024-01-15T14:30:00",
      code: "names a zone",
      zone: "Eastern",
      daylight: "standard",
    },
    instant: "2024-01-15T19:30:00Z",
    date: "20240115",
    time: "1430",
  },
  "status-ut": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("UT")\nx12TimeCodeOffset("UT")`,
    results: `"${L}"\n{ kind: "offset", timeCode: "UT" }\n"+00:00"`,
    verdict: "Offset: stated (+00:00)",
    members: {
      kind: "local date-time",
      value: L,
      code: "states an offset",
      offset: "+00:00",
      instant: "2024-06-15T14:30:00Z",
    },
    instant: "2024-06-15T14:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "code-13": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("13")\nx12TimeCodeOffset("13")`,
    results: `"${L}"\n{ kind: "offset", timeCode: "13" }\n"-12:00"`,
    verdict: "Offset: stated (-12:00)",
    members: {
      kind: "local date-time",
      value: L,
      code: "states an offset",
      offset: "-12:00",
      instant: "2024-06-16T02:30:00Z",
    },
    instant: "2024-06-16T02:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "code-24": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("24")\nx12TimeCodeOffset("24")`,
    results: `"${L}"\n{ kind: "offset", timeCode: "24" }\n"-01:00"`,
    verdict: "Offset: stated (-01:00)",
    members: {
      kind: "local date-time",
      value: L,
      code: "states an offset",
      offset: "-01:00",
      instant: "2024-06-15T15:30:00Z",
    },
    instant: "2024-06-15T15:30:00Z",
    date: "20240615",
    time: "1430",
  },
  hundredths: {
    calls: 'parseX12DateAndTime("20240615", "14300012")',
    results: '"2024-06-15T14:30:00.12"',
    verdict: "Offset: not stated",
    members: { kind: "local date-time", value: "2024-06-15T14:30:00.12" },
    instant: "2024-06-15T13:30:00.12Z",
    date: "20240615",
    time: "14300012",
  },
  "no-code": {
    calls: `parseX12DateAndTime(${AT})`,
    results: `"${L}"`,
    verdict: "Offset: not stated",
    members: { kind: "local date-time", value: L },
    instant: "2024-06-15T13:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "local-lt": {
    calls: `parseX12DateAndTime(${AT})\nclassifyX12TimeCode("LT")\nx12TimeCodeZone("LT")`,
    results: `"${L}"\n{ kind: "zone", timeCode: "LT" }\n{ zone: "Local", daylight: null }`,
    verdict: "Offset: not stated",
    members: {
      kind: "local date-time",
      value: L,
      code: "names a zone",
      zone: "Local",
      daylight: "not said",
    },
    instant: "2024-06-15T13:30:00Z",
    date: "20240615",
    time: "1430",
  },
  "date-only": {
    calls: 'parseX12Date("20240615", "D8")',
    results: '"2024-06-15"',
    verdict: "Offset: not stated",
    members: { kind: "date", value: "2024-06-15" },
    instant: "no instant",
    date: "20240615",
    time: "not sent",
  },
  "time-only": {
    calls: 'parseX12Time("1430")',
    results: '"14:30:00"',
    verdict: "Offset: not stated",
    members: { kind: "time", value: "14:30:00" },
    instant: "no instant",
    date: "not sent",
    time: "1430",
  },
};

/** Testing Library collapses whitespace in what it reads, so the expectation is flattened too. */
const flat = (text: string) => text.replaceAll("\n", " ");

const MEMBER_LABELS: Record<string, string> = {
  kind: "Kind",
  value: "Value",
  code: "Time code",
  offset: "Offset",
  zone: "Zone name",
  daylight: "Daylight",
  instant: "Instant",
};
const MEMBER_KEYS = Object.keys(MEMBER_LABELS);

const open = (args = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const section = (name: RegExp | string) => screen.getByRole("region", { name });
const parseSection = () => section(/^2\. /);
const landsSection = () => section(/^3\. /);
const backSection = () => section(/^4\. /);
const dtpSection = () => section(/^6\. /);

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const dtpPreset = () => screen.getByRole("combobox", { name: "DTP preset" });
const dateBox = () => screen.getByRole("textbox", { name: /^Date/ });
const timeBox = () => screen.getByRole("textbox", { name: /^Time \(/ });
const codeBox = () => screen.getByRole("textbox", { name: /^Time code/ });
const dtpFormat = () => screen.getByRole("textbox", { name: /^Qualifier/ });
const dtpValue = () => screen.getByRole("textbox", { name: /^Value \(1251/ });
const zone = (n: number) => screen.getByRole("combobox", { name: `Zone ${n}` });

const calls = (root: HTMLElement, name = "Calls made") =>
  within(root).queryByRole("group", { name });
const output = (root: HTMLElement, name: string) =>
  within(root).getByRole("status", { name });
const verdict = () => screen.getByRole("status", { name: "Verdict" });

function memberTable(root: HTMLElement) {
  return within(root).getByRole("table", { name: /member by member/ });
}
function members(root: HTMLElement): Record<string, string> {
  const table = memberTable(root);
  const names = cellsInColumn(table, "Member").map((c) =>
    c.textContent!.trim(),
  );
  const values = cellsInColumn(table, "Value").map((c) =>
    c.textContent!.trim(),
  );
  return Object.fromEntries(names.map((n, i) => [n, values[i]!]));
}
const strip = () => screen.getByRole("table", { name: /four zones/ });
const column = (name: string) =>
  cellsInColumn(strip(), name).map((c) => c.textContent!.trim());

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(preset(), id);
}
async function retype(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.type(box, value);
}

describe("renderX12TimeReaderTemplate", () => {
  it("is a named region with six numbered sections and named controls", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "X12 Time Reader" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. The date, the time and the time code",
      "2. What the calls return",
      "3. The instant, and where the same digits land",
      "4. Written back by formatX12Date and formatX12TimeElement",
      "5. A DTP value",
      "6. What the DTP calls return",
    ]);
    for (const c of [preset(), dtpPreset(), zone(1), zone(4)]) {
      expect(c).toBeInTheDocument();
    }
    for (const b of [
      dateBox(),
      timeBox(),
      codeBox(),
      dtpFormat(),
      dtpValue(),
    ]) {
      expect(b).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("textbox", { name: /year/i }),
    ).not.toBeInTheDocument();
  });

  it("does not run a hostile seed", async () => {
    await open({
      date: '"><img src=x onerror=alert(1)>',
      zone: '"><script>x</script>',
    });
    expect(screen.queryByRole("img", { name: /^x$/ })).not.toBeInTheDocument();
    expect(dateBox()).toHaveValue('"><img src=x onerror=alert(1)>');
  });
});

describe("every main preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      X12_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(X12_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await choose(w, id!);
    const e = EXPECTED[id!]!;

    expect(calls(parseSection())).toHaveTextContent(flat(e.calls));
    expect(output(parseSection(), "What the calls returned")).toHaveTextContent(
      flat(e.results),
    );
    expect(verdict()).toHaveTextContent(e.verdict);
    expect(
      screen.queryByRole("complementary", { name: /^Why/ }),
    ).not.toBeInTheDocument();
    const got = members(parseSection());
    for (const key of MEMBER_KEYS) {
      expect(got[MEMBER_LABELS[key]!], key).toBe(e.members[key] ?? NOT_STATED);
    }
    expect(output(landsSection(), "The instant")).toHaveTextContent(
      e.instant === "no instant" ? e.instant : `"${e.instant}"`,
    );
    expect(output(backSection(), "The date written back")).toHaveTextContent(
      e.date === "not sent" ? e.date : `"${e.date}"`,
    );
    expect(output(backSection(), "The time written back")).toHaveTextContent(
      e.time === "not sent" ? e.time : `"${e.time}"`,
    );
    await expectNoAxeViolations(w.root);
  });

  it("prints resolveLocal(local, offset) for a code that states an offset, and no zone is read", async () => {
    const w = await open();
    await choose(w, "code-13");
    expect(calls(landsSection(), "Call made")).toHaveTextContent(
      'resolveLocal("2024-06-15T14:30:00", "-12:00")',
    );
    for (const n of [1, 2, 3, 4]) expect(zone(n)).toBeDisabled();
    expect(landsSection()).toHaveTextContent(
      "Stated by the value: 2024-06-16T02:30:00Z",
    );
    await expectNoAxeViolations(w.root);
  });

  it("prints resolveLocal in the first chosen zone for a code that states none", async () => {
    const w = await open();
    await choose(w, "status-et");
    expect(calls(landsSection(), "Call made")).toHaveTextContent(
      'resolveLocal("2024-06-15T14:30:00", "America/New_York", { disambiguation: "reject" })',
    );
    expect(column("Instant").slice(0, 2)).toEqual([
      "2024-06-15T18:30:00Z",
      "2024-06-15T19:30:00Z",
    ]);
    expect(
      screen.getByRole("status", { name: "Widest gap" }),
    ).toHaveTextContent("Widest gap: 1 h");
    await expectNoAxeViolations(w.root);
  });

  it("keeps example zones on exactly the presets whose strip has work to do", async () => {
    const w = await open();
    for (const p of X12_PRESETS) {
      await choose(w, p.id);
      const filled = [1, 2, 3, 4].some(
        (n) => (zone(n) as HTMLSelectElement).value !== "",
      );
      expect(filled, p.id).toBe(p.zones.some((z) => z !== ""));
    }
  });

  it("never fills a zone from the time code typed", async () => {
    const w = await open();
    for (const n of [1, 2, 3, 4]) await w.user.selectOptions(zone(n), "");
    await retype(w, codeBox(), "ET");
    await retype(w, dateBox(), "20240615");
    await retype(w, timeBox(), "1430");
    for (const n of [1, 2, 3, 4]) expect(zone(n)).toHaveValue("");
    expect(column("Instant")[0]).toBe("no zone chosen");
    expect(landsSection()).toHaveTextContent(/Pick the IANA zone/);
    await expectNoAxeViolations(w.root);
  });

  it("a zone change leaves the preset for Custom", async () => {
    const w = await open();
    await choose(w, "status-et");
    await w.user.selectOptions(zone(1), "Europe/Paris");
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });
});

describe("the sentinel", () => {
  it.each([
    ["240615", "1430", "", "CCYYMMDD"],
    ["20240615", "14:30", "", "HHMMSSDD"],
    ["20240615", "1430", "XX", "XX is not a 623 time code"],
    ["20240615", "", "ET", "qualifies a time"],
  ])("explains %j %j %j", async (date, time, code, snippet) => {
    const w = await open();
    await retype(w, dateBox(), date);
    await retype(w, timeBox(), time);
    await retype(w, codeBox(), code);
    expect(output(parseSection(), "What the calls returned")).toHaveTextContent(
      "NO SIGNAL",
    );
    expect(within(parseSection()).getByRole("complementary")).toHaveTextContent(
      snippet,
    );
    for (const label of Object.values(MEMBER_LABELS)) {
      expect(members(parseSection())[label]).toBe("no result");
    }
    expect(output(backSection(), "The date written back")).toHaveTextContent(
      "nothing to write back",
    );
    await expectNoAxeViolations(w.root);
  });

  it("a blank form makes no call and says nothing to read", async () => {
    const w = await open();
    await retype(w, dateBox(), "");
    await retype(w, timeBox(), "");
    await retype(w, codeBox(), "");
    expect(output(parseSection(), "What the calls returned")).toHaveTextContent(
      "nothing to read",
    );
    expect(calls(parseSection())).not.toBeInTheDocument();
    expect(
      within(parseSection()).queryByRole("complementary"),
    ).not.toBeInTheDocument();
    expect(output(landsSection(), "The instant")).toHaveTextContent(
      "no instant",
    );
    await expectNoAxeViolations(w.root);
  });
});

describe("writing back", () => {
  it("writes the date and the time with the element formatters and says where the date came from", async () => {
    const w = await open();
    await choose(w, "status-et");
    const groups = within(backSection()).getAllByRole("group", {
      name: "Call made",
    });
    expect(groups[0]).toHaveTextContent('formatX12Date("2024-06-15", "D8")');
    expect(groups[1]).toHaveTextContent(
      'formatX12TimeElement("14:30:00", "HHMM")',
    );
    expect(
      screen.getByRole("note", { name: "About the written elements" }),
    ).toHaveTextContent(/read alone by parseX12Date/);
    await expectNoAxeViolations(w.root);
  });

  it("writes hundredths back with their hundredths", async () => {
    const w = await open();
    await choose(w, "hundredths");
    expect(
      within(backSection()).getAllByRole("group", { name: "Call made" })[1],
    ).toHaveTextContent('formatX12TimeElement("14:30:00.12", "HHMMSSDD")');
    expect(output(backSection(), "The time written back")).toHaveTextContent(
      '"14300012"',
    );
    expect(
      screen.getByRole("note", { name: "About the written elements" }),
    ).not.toHaveTextContent(/cut/);
    await expectNoAxeViolations(w.root);
  });
});

describe("the DTP section", () => {
  const EXPECTED_DTP: Record<
    string,
    { calls: string; result: string; written: string | null }
  > = {
    "range-rd8": {
      calls:
        'classifyX12DateTimePeriodFormat("RD8")\nparseX12DateRange("20240615-20240620", "RD8")',
      result:
        '{ kind: "dateRange", format: "RD8" }\n{ start: "2024-06-15", end: "2024-06-20" }',
      written: 'formatX12DateRange("2024-06-15", "2024-06-20", "RD8")',
    },
    "range-dts": {
      calls:
        'classifyX12DateTimePeriodFormat("DTS")\nparseX12DateTimeRange("20240615143000-20240620160000", "DTS")',
      result:
        '{ kind: "dateTimeRange", format: "DTS" }\n{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }',
      written:
        'formatX12DateTimeRange("2024-06-15T14:30:00", "2024-06-20T16:00:00", "DTS")',
    },
    "date-db": {
      calls:
        'classifyX12DateTimePeriodFormat("DB")\nparseX12Date("06152024", "DB")',
      result: '{ kind: "date", format: "DB" }\n"2024-06-15"',
      written: 'formatX12Date("2024-06-15", "DB")',
    },
    "d6-two-digit": {
      calls: 'classifyX12DateTimePeriodFormat("D6")',
      result: "NO SIGNAL",
      written: null,
    },
  };

  it("has an expectation for every DTP preset", () => {
    expect(Object.keys(EXPECTED_DTP).sort()).toEqual(
      DTP_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(DTP_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await w.user.selectOptions(dtpPreset(), id!);
    const e = EXPECTED_DTP[id!]!;
    const out = output(dtpSection(), "What the DTP calls returned");
    expect(calls(dtpSection())).toHaveTextContent(flat(e.calls));
    if (e.written === null) {
      expect(out).toHaveTextContent("NO SIGNAL");
      const aside = within(dtpSection()).getByRole("complementary");
      expect(aside).toHaveTextContent("yyMMdd");
      expect(aside).toHaveTextContent("yearWindow");
      for (const label of ["Kind", "Value", "Range end"]) {
        expect(members(dtpSection())[label]).toBe("no result");
      }
      expect(
        output(dtpSection(), "The DTP value written back"),
      ).toHaveTextContent("nothing to write back");
    } else {
      expect(out).toHaveTextContent(flat(e.result));
      expect(
        within(dtpSection()).getAllByRole("group", { name: "Call made" })[0],
      ).toHaveTextContent(e.written);
      expect(
        within(dtpSection()).queryByRole("complementary"),
      ).not.toBeInTheDocument();
    }
    await expectNoAxeViolations(w.root);
  });

  it("starts on a preset that returns a value", async () => {
    const w = await open();
    expect(members(dtpSection())["Range end"]).toBe("2024-06-20");
    expect(members(dtpSection())["Kind"]).toBe("date range");
    await expectNoAxeViolations(w.root);
  });

  it("says a code it does not read is not read, and a blank pair is empty", async () => {
    const w = await open();
    await retype(w, dtpFormat(), "RTM");
    await retype(w, dtpValue(), "2200-0600");
    expect(within(dtpSection()).getByRole("complementary")).toHaveTextContent(
      "RTM is not a qualifier the library reads",
    );
    await retype(w, dtpFormat(), "");
    await retype(w, dtpValue(), "");
    expect(
      output(dtpSection(), "What the DTP calls returned"),
    ).toHaveTextContent("nothing to read");
    expect(
      within(dtpSection()).queryByRole("complementary"),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("draws a range's two halves in the figure's description", async () => {
    await open();
    expect(
      screen.getByRole("img", {
        name: /start: year 2024, month 06, day 15; end:/,
      }),
    ).toBeInTheDocument();
  });
});

describe("seeding and permalinks", () => {
  it("seeds the elements without a preset fallback", async () => {
    await open({ date: "20240615", time: "1430", timeCode: "20" });
    expect(verdict()).toHaveTextContent("Offset: stated (-05:00)");
    expect(output(landsSection(), "The instant")).toHaveTextContent(
      '"2024-06-15T19:30:00Z"',
    );
  });

  it("loads an old link that still carries a year window without error, and ignores it", async () => {
    const w = await open({
      format: "D6",
      value: "240615",
      yearWindow: "2000",
    });
    expect(
      output(dtpSection(), "What the DTP calls returned"),
    ).toHaveTextContent("NO SIGNAL");
    expect(w.permalink()).toContain("D6");
    expect(w.permalink()).not.toContain("yearWindow");
  });

  it.each(X12_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choose(first, id!);
      const url = first.permalink();
      const query = url.slice(url.indexOf("?"));
      const state = seedFromLocation("xtime", query) as Record<string, unknown>;
      expect(
        Object.values(state).every(
          (v) => typeof v === "string" && v.length > 0,
        ),
      ).toBe(true);
      expect(encodeWidgetPermalink("xtime", state)).toContain(
        query.slice(query.indexOf("wa=")),
      );
      first.destroy();
      await open(state, "second");
      expect(
        output(parseSection(), "What the calls returned"),
      ).toHaveTextContent(flat(EXPECTED[id!]!.results));
    },
  );
});

describe("naming and lifecycle", () => {
  it("names no regulator, statute, agency, docket or customs body, and no business event", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|gate-in)\b/i;
    const w = await open();
    expect(w.root).not.toHaveTextContent(forbidden);
    for (const p of X12_PRESETS) {
      await choose(w, p.id);
      expect(w.root).not.toHaveTextContent(forbidden);
    }
    for (const p of DTP_PRESETS) {
      await w.user.selectOptions(dtpPreset(), p.id);
      expect(w.root).not.toHaveTextContent(forbidden);
    }
  });

  it("an aborted mount is inert, and destroying twice is safe", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(members(parseSection())["Value"]).toBe("no result");
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});

describe("on-screen words", () => {
  it.each(X12_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null and never calls the library GMT",
    async (id) => {
      const w = await open();
      await choose(w, id!);
      expect(parseSection()).not.toHaveTextContent(/\bundefined\b/);
      expect(w.root).not.toHaveTextContent(
        /GMT (does|returns|maps|reads|never)/,
      );
      for (const v of Object.values(members(parseSection()))) {
        expect(v).not.toMatch(/null|undefined|^$/);
      }
    },
  );

  it("takes the three elements apart and says what the code calls returned", async () => {
    await open();
    expect(
      screen.getByRole("img", {
        name: "Date: year 2024, month 06, day 15. Time: hour 14, minute 30. Time code ET: zone Eastern, daylight not said.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("note", { name: "About the time" }),
    ).toHaveTextContent(
      'x12TimeCodeZone("ET") returned zone Eastern, daylight not said.',
    );
  });
});

describe("the length cap", () => {
  it("stops the time code at 8 characters", async () => {
    const w = await open();
    const box = screen.getByRole("textbox", { name: /^Time code/ });
    await w.user.clear(box);
    await w.user.type(box, "x".repeat(16));
    expect(box).toHaveValue("x".repeat(8));
  });
});
