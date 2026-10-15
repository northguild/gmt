/**
 * `epcis-event-reader.ts`'s pure helpers, against the real gmt modules. Every
 * expected library result is a JSDoc example of the function that returns it.
 * The drawing is checked against the library: the lit day of each rail is the
 * library's date for that clock.
 */
import { blDateLib } from "~/test/ledger-lib";
import { epcisLib } from "~/test/edi-lib";
import type { EpcisLib } from "./edi-lib";
import { readArgs as readBlArgs, readBlDate } from "./bl-date-stamp";
import {
  CUSTOM_PRESET_ID,
  DATES_NULL_TEXT,
  EPCIS_PRESETS,
  HANDOFF_LABEL,
  MEMBER_ROWS,
  NULL_TEXT,
  RAIL_HALF_HOURS,
  WIDEST_EVENT,
  WIDEST_RESULT,
  cutEventTime,
  datesWords,
  detailText,
  epcisBlank,
  epcisFigure,
  epcisNullText,
  epcisTexts,
  eventOf,
  handoffArgs,
  isSeeded,
  matchPreset,
  memberText,
  permalinkOf,
  presetState,
  railAria,
  railEmptyText,
  railHtml,
  railName,
  railsOf,
  tickLabelEnd,
  readArgs,
  readEpcis,
  verdictText,
  writeBack,
  type EpcisState,
} from "./epcis-event-reader";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

const preset = (id: string) => EPCIS_PRESETS.find((p) => p.id === id)!;
const state = (eventTime: string, eventTimeZoneOffset = ""): EpcisState => ({
  eventTime,
  eventTimeZoneOffset,
});
const read = (id: string) => readEpcis(presetState(preset(id)), epcisLib);

/** preset id → the JSDoc result, or `null` for the sentinel. */
const RESULTS: Record<
  string,
  { instant: string; offset: string; local: string } | null
> = {
  "next-day": {
    instant: "2024-06-15T23:30:00Z",
    offset: "+02:00",
    local: "2024-06-16T01:30:00",
  },
  "offsets-disagree": {
    instant: "2024-06-15T08:00:00Z",
    offset: "-05:00",
    local: "2024-06-15T03:00:00",
  },
  "minus-zero": {
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
    local: "2024-06-15T14:30:00",
  },
  "no-offset": null,
  "z-as-offset": null,
  "no-colon": null,
  "no-seconds": null,
  "february-30": null,
};

describe("seeds", () => {
  it("is seeded by either key, and by nothing else", () => {
    expect(isSeeded({})).toBe(false);
    expect(isSeeded({ eventTime: "x" })).toBe(true);
    expect(isSeeded({ eventTimeZoneOffset: "+02:00" })).toBe(true);
  });

  it("keeps a string as given, blanks anything else and fills nothing in", () => {
    expect(readArgs({ eventTime: "2024-06-15T14:30:00Z" })).toEqual({
      eventTime: "2024-06-15T14:30:00Z",
      eventTimeZoneOffset: "",
    });
    expect(
      readArgs({ eventTime: 5 as never, eventTimeZoneOffset: null as never }),
    ).toEqual({
      eventTime: "",
      eventTimeZoneOffset: "",
    });
  });

  it("carries only the non-blank fields, trimmed", () => {
    expect(permalinkOf(state(" 2024-06-15T14:30:00Z ", ""))).toEqual({
      eventTime: "2024-06-15T14:30:00Z",
    });
    expect(permalinkOf(state("a", " +02:00"))).toEqual({
      eventTime: "a",
      eventTimeZoneOffset: "+02:00",
    });
    expect(permalinkOf(state("", ""))).toEqual({});
  });

  it("leaves the offset member out of the event when it is blank", () => {
    expect(eventOf(state("2024-06-15T14:30:00Z", "  "))).toEqual({
      eventTime: "2024-06-15T14:30:00Z",
    });
    expect("eventTimeZoneOffset" in eventOf(state("x", ""))).toBe(false);
    expect(eventOf(state(" x ", " +02:00 "))).toEqual({
      eventTime: "x",
      eventTimeZoneOffset: "+02:00",
    });
  });

  it("is blank only when both fields are empty", () => {
    expect(epcisBlank(state("", ""))).toBe(true);
    expect(epcisBlank(state("  ", " "))).toBe(true);
    expect(epcisBlank(state("x", ""))).toBe(false);
    expect(epcisBlank(state("", "+02:00"))).toBe(false);
  });
});

describe("presets", () => {
  it("has the eight presets of the spec, with unique ids", () => {
    expect(EPCIS_PRESETS.map((p) => p.id)).toEqual(Object.keys(RESULTS));
  });

  it("matches a preset by both fields, trimmed, and else custom", () => {
    for (const p of EPCIS_PRESETS) {
      expect(matchPreset(presetState(p))).toBe(p.id);
      expect(
        matchPreset(state(` ${p.eventTime} `, ` ${p.eventTimeZoneOffset} `)),
      ).toBe(p.id);
    }
    expect(matchPreset(state("2024-06-15T14:30:00Z", "+03:00"))).toBe(
      CUSTOM_PRESET_ID,
    );
  });

  it("names no body, no law and no carrier", () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\b/i;
    for (const p of EPCIS_PRESETS) {
      expect(`${p.label} ${p.description}`).not.toMatch(forbidden);
    }
  });

  it.each(EPCIS_PRESETS.map((p) => [p.id]))(
    "%s is the library's own result",
    (id) => {
      const r = read(id!);
      expect(r.blank).toBe(false);
      expect(r.parse!.fn).toBe("parseEpcisEvent");
      expect(r.parse!.args).toEqual([r.event]);
      expect(r.result).toEqual(RESULTS[id!]);
    },
  );

  it("leaves the offset out of the printed call for a blank offset", () => {
    expect(read("no-offset").parse!.args).toEqual([
      { eventTime: "2024-06-15T14:30:00Z" },
    ]);
  });
});

describe("the dates", () => {
  it("makes the four date calls for a result, in order", () => {
    const r = read("next-day");
    expect(r.dates!.calls.map((c) => c.fn)).toEqual([
      "convertUtcToPlainDate",
      "chopTime",
      "areDatesEqual",
      "isAfterDate",
    ]);
    expect(r.dates!.calls.map((c) => c.args)).toEqual([
      ["2024-06-15T23:30:00Z"],
      ["2024-06-16T01:30:00"],
      ["2024-06-15", "2024-06-16"],
      ["2024-06-16", "2024-06-15"],
    ]);
    expect(r.dates!.utcDate).toBe("2024-06-15");
    expect(r.dates!.localDate).toBe("2024-06-16");
  });

  it("words the local date against the UTC date", () => {
    expect(datesWords(read("next-day").dates)).toBe(
      "The local date is the next day.",
    );
    expect(datesWords(read("offsets-disagree").dates)).toBe(
      "The same date on both clocks.",
    );
    expect(datesWords(read("minus-zero").dates)).toBe(
      "The same date on both clocks.",
    );
    const before = readEpcis(state("2024-06-15T01:00:00Z", "-05:00"), epcisLib);
    expect(before.dates!.localDate).toBe("2024-06-14");
    expect(datesWords(before.dates)).toBe("The local date is the day before.");
  });

  it("makes no date call and holds no dates without a result", () => {
    for (const id of [
      "no-offset",
      "z-as-offset",
      "no-colon",
      "no-seconds",
      "february-30",
    ]) {
      const r = read(id);
      expect(r.dates, id).toBeNull();
      expect(datesWords(r.dates)).toBe("");
    }
  });

  it("compares dates that sit past year 9999, as the library reads them", () => {
    const r = readEpcis(
      state(WIDEST_EVENT.eventTime, WIDEST_EVENT.eventTimeZoneOffset),
      epcisLib,
    );
    expect(r.result).toEqual(WIDEST_RESULT);
    expect(r.dates!.utcDate).toBe("+010000-01-01");
    expect(r.dates!.localDate).toBe("+010000-01-01");
    expect(datesWords(r.dates)).toBe("The same date on both clocks.");
  });

  it("makes no comparison when the library returns no date", () => {
    const lib = { ...epcisLib, chopTime: () => "" } as unknown as EpcisLib;
    const r = readEpcis(presetState(preset("next-day")), lib);
    expect(r.dates!.sameness).toBeNull();
    expect(r.dates!.calls.map((c) => c.fn)).toEqual([
      "convertUtcToPlainDate",
      "chopTime",
    ]);
    expect(datesWords(r.dates)).toBe("");
    expect(DATES_NULL_TEXT).toMatch(/library returned no date/);
  });
});

describe("a blank form", () => {
  it("makes no call", () => {
    const calls: string[] = [];
    const spy = new Proxy(epcisLib, {
      get: (target, key: string) => {
        calls.push(key);
        return (target as never)[key];
      },
    });
    const r = readEpcis(state("", ""), spy);
    expect(r).toEqual({
      blank: true,
      event: null,
      parse: null,
      result: null,
      dates: null,
    });
    expect(calls).toEqual([]);
    expect(writeBack(r, epcisLib)).toBeNull();
    expect(handoffArgs(r)).toBeNull();
    expect(verdictText(r, state("", ""))).toBe("");
  });
});

describe("why NO SIGNAL", () => {
  const text = (id: string) => epcisNullText(presetState(preset(id)), epcisLib);

  it("says the offset is missing when it is blank", () => {
    expect(text("no-offset")).toBe(NULL_TEXT.noOffset);
    expect(text("no-offset")).toMatch(/does not assume UTC/);
  });

  it("says the offset is refused, whatever the time", () => {
    expect(text("z-as-offset")).toBe(NULL_TEXT.badOffset);
    expect(text("no-colon")).toBe(NULL_TEXT.badOffset);
    expect(text("z-as-offset")).toMatch(/Z, \+0200 and \+02 are not offsets/);
    expect(epcisNullText(state("junk", "+14:30"), epcisLib)).toBe(
      NULL_TEXT.badOffset,
    );
  });

  it("says the time is missing when only the offset is typed", () => {
    expect(epcisNullText(state("", "+02:00"), epcisLib)).toBe(NULL_TEXT.noTime);
  });

  it("tells a refused time from a refused date", () => {
    expect(text("no-seconds")).toBe(NULL_TEXT.badTime);
    expect(
      epcisNullText(state("2024-06-15 14:30:00Z", "+02:00"), epcisLib),
    ).toBe(NULL_TEXT.badTime);
    expect(
      epcisNullText(
        state("2024-06-15T14:30:00.1234567891Z", "+02:00"),
        epcisLib,
      ),
    ).toBe(NULL_TEXT.badTime);
    expect(text("february-30")).toBe(NULL_TEXT.badDate);
    expect(
      epcisNullText(state("2024-13-01T14:30:00Z", "+02:00"), epcisLib),
    ).toBe(NULL_TEXT.badDate);
  });

  it("asks the library's two validators and nothing else", () => {
    const asked: string[] = [];
    const lib = {
      ...epcisLib,
      isValidEpcisTimeZoneOffset: (v: string) => {
        asked.push(`offset:${v}`);
        return epcisLib.isValidEpcisTimeZoneOffset(v);
      },
      isValidEpcisEventTime: (v: string) => {
        asked.push(`time:${v}`);
        return epcisLib.isValidEpcisEventTime(v);
      },
    } as EpcisLib;
    epcisNullText(presetState(preset("february-30")), lib);
    expect(asked[0]).toBe("offset:+02:00");
    expect(asked.slice(1).every((a) => a.startsWith("time:"))).toBe(true);
    expect(asked.length).toBeGreaterThan(1);
  });

  it("falls back to a sentence when both fields read and the library still returned nothing", () => {
    expect(epcisNullText(presetState(preset("next-day")), epcisLib)).toBe(
      NULL_TEXT.other,
    );
  });

  it("names the library as the library and never as GMT", () => {
    for (const sentence of Object.values(NULL_TEXT)) {
      expect(sentence).not.toMatch(/GMT/);
      expect(sentence).not.toMatch(/\bnull\b/);
    }
  });
});

describe("the verdict, the detail and the members", () => {
  it("states the offset the library returned", () => {
    expect(verdictText(read("next-day"), presetState(preset("next-day")))).toBe(
      "Offset: stated (+02:00)",
    );
    expect(
      verdictText(read("minus-zero"), presetState(preset("minus-zero"))),
    ).toBe("Offset: stated (+00:00)");
  });

  it("says not stated for a blank offset, and nothing for a refused one", () => {
    expect(
      verdictText(read("no-offset"), presetState(preset("no-offset"))),
    ).toBe("Offset: not stated");
    expect(
      verdictText(read("z-as-offset"), presetState(preset("z-as-offset"))),
    ).toBe("");
  });

  it("tells an eventTime that ends in Z from one with an offset of its own", () => {
    expect(detailText(read("next-day"))).toMatch(/ends in Z/);
    expect(detailText(read("offsets-disagree"))).toMatch(/offset of its own/);
    expect(detailText(read("offsets-disagree"))).toMatch(
      /fixes the instant only/,
    );
    expect(detailText(read("no-offset"))).toBe("");
  });

  it("holds the three members of a result and none without one", () => {
    const r = read("next-day");
    expect(MEMBER_ROWS.map((m) => memberText(r, m.key))).toEqual([
      "2024-06-15T23:30:00Z",
      "+02:00",
      "2024-06-16T01:30:00",
    ]);
    for (const m of MEMBER_ROWS) {
      expect(memberText(read("no-offset"), m.key)).toBeNull();
    }
  });
});

describe("the fields taken apart", () => {
  const groups = (s: EpcisState) =>
    epcisFigure(s, epcisLib).halves.map((h) =>
      h.fields.map((f) => [f.text, f.mask, f.group]),
    );

  it("cuts a time with Z and an offset", () => {
    expect(groups(presetState(preset("next-day")))).toEqual([
      [
        ["2024-06-15", "YYYY-MM-DD", "date"],
        ["T23:30:00", "Thh:mm:ss", "time"],
        ["Z", "Z", "offset"],
      ],
      [["+02:00", "±hh:mm", "offset"]],
    ]);
  });

  it("cuts a time with an offset of its own and a fraction", () => {
    expect(cutEventTime("2024-06-15T14:30:00.123456789+05:45")).toEqual([
      { text: "2024-06-15", mask: "YYYY-MM-DD", group: "date", word: "date" },
      { text: "T14:30:00", mask: "Thh:mm:ss", group: "time", word: "time" },
      { text: ".123456789", mask: "fraction", group: "time", word: "fraction" },
      { text: "+05:45", mask: "±hh:mm", group: "offset", word: "offset" },
    ]);
  });

  it("draws a refused field as one neutral box and a missing one as a ghost box", () => {
    expect(groups(presetState(preset("no-offset")))[1]).toEqual([
      ["not sent", "", "none"],
    ]);
    expect(groups(presetState(preset("z-as-offset")))[1]).toEqual([
      ["Z", "", "neutral"],
    ]);
    expect(groups(presetState(preset("no-seconds")))[0]).toEqual([
      ["2024-06-15T14:30Z", "", "neutral"],
    ]);
    expect(groups(state("", "+02:00"))[0]).toEqual([["not sent", "", "none"]]);
  });

  it("cuts a long refused text to a box that fits and keeps the whole text in the spoken line", () => {
    const long = "x".repeat(60);
    const fig = epcisFigure(state(long, "+02:00"), epcisLib);
    const box = fig.halves[0]!.fields[0]!;
    expect(box.text.length).toBe(24);
    expect(box.text.endsWith("…")).toBe(true);
    expect(fig.aria).toContain(long);
  });

  it("speaks each field", () => {
    expect(epcisFigure(presetState(preset("next-day")), epcisLib).aria).toBe(
      "eventTime 2024-06-15T23:30:00Z: date 2024-06-15, time T23:30:00, offset Z; eventTimeZoneOffset +02:00: offset +02:00",
    );
    expect(
      epcisFigure(presetState(preset("no-offset")), epcisLib).aria,
    ).toMatch(/eventTimeZoneOffset not sent$/);
  });
});

describe("written back", () => {
  it("writes the result as it came back", () => {
    const w = writeBack(read("next-day"), epcisLib)!;
    expect(w.call.fn).toBe("formatEpcisEvent");
    expect(w.call.args).toEqual([RESULTS["next-day"]]);
    expect(w.written).toEqual({
      eventTime: "2024-06-15T23:30:00Z",
      eventTimeZoneOffset: "+02:00",
    });
    expect(w.note).toBe("");
  });

  it("says when -00:00 came back as +00:00", () => {
    const w = writeBack(read("minus-zero"), epcisLib)!;
    expect(w.written!.eventTimeZoneOffset).toBe("+00:00");
    expect(w.note).toMatch(/-00:00 as \+00:00/);
  });

  it("says when eventTime is written again in UTC", () => {
    const w = writeBack(read("offsets-disagree"), epcisLib)!;
    expect(w.written).toEqual({
      eventTime: "2024-06-15T08:00:00Z",
      eventTimeZoneOffset: "-05:00",
    });
    expect(w.note).toMatch(/instant in UTC/);
    expect(w.note).not.toMatch(/-00:00/);
  });

  it("returns the sentinel with its reason for an instant past year 9999", () => {
    const r = readEpcis(
      state(WIDEST_EVENT.eventTime, WIDEST_EVENT.eventTimeZoneOffset),
      epcisLib,
    );
    const w = writeBack(r, epcisLib)!;
    expect(w.written).toBeNull();
    expect(w.note).toMatch(/four-digit year/);
  });

  it("gives a general sentence when the library returned nothing for another reason", () => {
    const lib = {
      ...epcisLib,
      formatEpcisEvent: () => null,
    } as unknown as EpcisLib;
    const w = writeBack(read("next-day"), lib)!;
    expect(w.written).toBeNull();
    expect(w.note).toBe(
      "The library returned no result when writing this back.",
    );
  });

  it("writes nothing without a result", () => {
    expect(writeBack(read("no-offset"), epcisLib)).toBeNull();
  });
});

describe("the hand-off to the B/L Date Stamp", () => {
  it("has no seed without a result", () => {
    expect(handoffArgs(read("february-30"))).toBeNull();
  });

  it("names the instant, the event it picks and the offset as the place", () => {
    expect(HANDOFF_LABEL).toBe(
      "Read this moment as a shipped on board date in the B/L Date Stamp",
    );
    expect(handoffArgs(read("next-day"))).toEqual({
      value: "2024-06-15T23:30:00Z",
      event: "shippedOnBoard",
      timeZone: "+02:00",
    });
  });

  it.each(
    EPCIS_PRESETS.filter((p) => RESULTS[p.id] !== null).map((p) => [p.id]),
  )("%s opens the B/L Date Stamp on the event's local date", (id) => {
    const r = read(id!);
    const url = encodeWidgetPermalink("bldate", handoffArgs(r)!);
    const seeded = seedFromLocation("bldate", url.slice(url.indexOf("?")));
    expect(seeded).toEqual(handoffArgs(r));
    // The B/L Date Stamp reads the offset as its place zone, and its B/L date
    // is the date on the event's local clock.
    const bl = readBlDate(readBlArgs(seeded), blDateLib);
    expect(bl.bl).toBe(r.dates!.localDate);
    expect(bl.utc).toBe(r.dates!.utcDate);
    expect(bl.bl).not.toBe("");
  });
});

describe("the day rails", () => {
  const litDate = (days: { lit: boolean; date: string }[]) =>
    days.filter((d) => d.lit).map((d) => d.date);

  it.each(
    EPCIS_PRESETS.filter((p) => RESULTS[p.id] !== null).map((p) => [p.id]),
  )(
    "%s: the lit day of each rail is the library's date for that clock",
    (id) => {
      const r = read(id!);
      const rails = railsOf(r.result!);
      expect(litDate(rails.utc.days)).toEqual([r.dates!.utcDate]);
      expect(litDate(rails.local.days)).toEqual([r.dates!.localDate]);
      expect(rails.pin).toBe(50);
    },
  );

  it("agrees with the library past year 9999 and before year 0", () => {
    for (const [time, offset] of [
      [WIDEST_EVENT.eventTime, WIDEST_EVENT.eventTimeZoneOffset],
      ["0000-01-01T00:30:00+14:00", "-14:00"],
    ] as const) {
      const r = readEpcis(state(time, offset), epcisLib);
      const rails = railsOf(r.result!);
      expect(litDate(rails.utc.days)).toEqual([r.dates!.utcDate]);
      expect(litDate(rails.local.days)).toEqual([r.dates!.localDate]);
    }
  });

  it("draws the same 72 hours on both rails, with the days filling it", () => {
    expect(RAIL_HALF_HOURS * 2).toBe(72);
    const rails = railsOf(RESULTS["next-day"]!);
    for (const rail of [rails.utc, rails.local]) {
      expect(rail.days[0]!.from).toBe(0);
      expect(rail.days[rail.days.length - 1]!.to).toBe(100);
      rail.days.forEach((d, i) => {
        if (i > 0) expect(d.from).toBeCloseTo(rail.days[i - 1]!.to, 6);
      });
      expect(rail.ticks.length).toBe(rail.days.length - 1);
      // The lit day is one whole day of the window: a third of the rail.
      const lit = rail.days.find((d) => d.lit)!;
      expect(lit.to - lit.from).toBeCloseTo(100 / 3, 6);
    }
  });

  it("shifts the local rail's midnights by the offset", () => {
    const rails = railsOf({
      instant: "2024-06-15T12:00:00Z",
      offset: "+02:00",
    });
    // UTC midnights fall 12 h either side of the pin: 24 h and 60 h into the
    // 72-hour window.
    expect(rails.utc.ticks.map((t) => Math.round(t * 100) / 100)).toEqual([
      33.33, 66.67,
    ]);
    // The local clock is two hours ahead, so its midnights are two hours earlier.
    const shift = (2 / 72) * 100;
    expect(rails.local.ticks).toHaveLength(3);
    rails.utc.ticks.forEach((t, i) => {
      expect(rails.local.ticks[i]!).toBeCloseTo(t - shift, 6);
    });
    // The third midnight is a day after the first: a third of the rail on.
    expect(rails.local.ticks[2]!).toBeCloseTo(
      rails.local.ticks[0]! + 200 / 3,
      6,
    );
  });

  it("puts a midnight's label where it meets neither the edge nor the pin", () => {
    expect(tickLabelEnd(10)).toBe(false);
    expect(tickLabelEnd(33.33)).toBe(true);
    expect(tickLabelEnd(47.2)).toBe(true);
    expect(tickLabelEnd(66.67)).toBe(false);
    expect(tickLabelEnd(97.22)).toBe(true);
    const html = railHtml({
      role: "local",
      name: "Local clock +02:00",
      date: "2024-06-16",
      layout: railsOf(RESULTS["next-day"]!).local,
      pin: 50,
      emptyText: "",
      aria: "",
    });
    expect(html.match(/data-end="1"/g)).toHaveLength(2);
  });

  it("keeps a box and says why without a result", () => {
    const blank = readEpcis(state("", ""), epcisLib);
    expect(railEmptyText("utc", blank, state("", ""))).toBe(
      "Nothing to place yet.",
    );
    const none = read("no-offset");
    const s = presetState(preset("no-offset"));
    expect(railEmptyText("local", none, s)).toMatch(
      /^Not stated: the offset is missing/,
    );
    expect(railEmptyText("utc", none, s)).toMatch(/no result/);
    expect(
      railEmptyText(
        "local",
        read("z-as-offset"),
        presetState(preset("z-as-offset")),
      ),
    ).toMatch(/No local clock/);
    const html = railHtml({
      role: "local",
      name: railName("local", null),
      date: "no result",
      layout: null,
      pin: 50,
      emptyText: railEmptyText("local", none, s),
      aria: railAria("local", null, "", "words"),
    });
    expect(html).toContain('data-state="empty"');
    expect(html).toContain("gmt-epcis-track--empty");
    expect(html).toContain("Not stated");
  });

  it("names the clock and speaks the date", () => {
    expect(railName("utc", null)).toBe("UTC");
    expect(railName("local", RESULTS["next-day"]!)).toBe("Local clock +02:00");
    expect(railAria("local", RESULTS["next-day"]!, "2024-06-16", "")).toBe(
      "Local clock +02:00: the event falls on 2024-06-16.",
    );
  });

  it("escapes what it interpolates, and gives a hold sizer no role", () => {
    const html = railHtml(
      {
        role: "utc",
        name: '"><img src=x>',
        date: "<b>",
        layout: null,
        pin: 50,
        emptyText: "<script>",
        aria: '"><i>',
      },
      false,
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    const sizer = railHtml(
      {
        role: "utc",
        name: "UTC",
        date: "x",
        layout: null,
        pin: 50,
        emptyText: "y",
        aria: "",
      },
      true,
    );
    expect(sizer).not.toContain("data-role");
    expect(sizer).toContain('aria-hidden="true"');
  });
});

describe("the widest result", () => {
  it("is a result the library returns, and its write-back is refused", () => {
    expect(epcisLib.parseEpcisEvent(WIDEST_EVENT)).toEqual(WIDEST_RESULT);
    expect(epcisLib.formatEpcisEvent(WIDEST_RESULT)).toBeNull();
  });

  it("is at least as wide as every value the presets show, in every member", () => {
    for (const p of EPCIS_PRESETS) {
      const r = read(p.id).result;
      if (r === null) continue;
      expect(r.instant.length).toBeLessThanOrEqual(
        WIDEST_RESULT.instant.length,
      );
      expect(r.local.length).toBeLessThanOrEqual(WIDEST_RESULT.local.length);
      expect(r.offset.length).toBeLessThanOrEqual(WIDEST_RESULT.offset.length);
    }
    // 33 characters for the instant of a result just past year 9999, 30 for
    // the widest of a four-digit year.
    expect(WIDEST_RESULT.instant).toHaveLength(33);
    const nine = epcisLib.parseEpcisEvent({
      eventTime: "2024-06-15T14:30:00.123456789Z",
      eventTimeZoneOffset: "+05:45",
    })!;
    expect(nine.instant).toHaveLength(30);
  });

  it("is reserved by a text for every region, built by the text functions", () => {
    const t = epcisTexts();
    expect(t.verdicts).toEqual([
      "Offset: not stated",
      "Offset: stated (+14:00)",
    ]);
    expect(t.words).toEqual([
      "The same date on both clocks.",
      "The local date is the next day.",
      "The local date is the day before.",
    ]);
    expect(t.details).toHaveLength(2);
    expect(t.descriptions).toEqual(EPCIS_PRESETS.map((p) => p.description));
    expect(t.nulls).toEqual(Object.values(NULL_TEXT));
    expect(t.parseCall).toBe(
      'parseEpcisEvent({ eventTime: "9999-12-31T23:30:00.123456789-05:00", eventTimeZoneOffset: "+14:00" })',
    );
    expect(t.parseOutput).toBe(
      '{ instant: "+010000-01-01T04:30:00.123456789Z", offset: "+14:00", local: "+010000-01-01T18:30:00.123456789" }',
    );
    expect(t.dateCalls.split("\n")).toHaveLength(4);
    // Every note a preset's write-back shows is one the region reserves.
    for (const p of EPCIS_PRESETS) {
      const w = writeBack(read(p.id), epcisLib);
      if (w !== null && w.note !== "") expect(t.writeNotes).toContain(w.note);
    }
  });
});
