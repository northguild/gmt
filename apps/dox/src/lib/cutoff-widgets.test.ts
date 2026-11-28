/**
 * `cutoff-widgets.ts`'s pure helpers, against the real gmt modules — imported
 * by module path, as `transport-widgets.test.ts` does for the TRAN-9 widgets.
 */
import { Temporal } from "@northguild/gmt";
import { cutoffSchedule } from "@northguild/gmt/transport/calculate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import {
  callSource,
  durationText,
  formatStack,
  isNegative,
  isZoneless,
  localLabel,
  localParts,
  minuteTickLabel,
  walkTicks,
  type CutoffLib,
} from "./cutoff-widgets";

const lib = { isValidDateTime } as Pick<CutoffLib, "isValidDateTime">;

describe("localParts", () => {
  it("reads date, weekday, time, offset and zone from a zoned string", () => {
    expect(localParts("2024-06-14T17:00:00+02:00[Europe/Amsterdam]")).toEqual({
      date: "2024-06-14",
      weekday: "Fri",
      time: "17:00",
      offset: "+02:00",
      zone: "Europe/Amsterdam",
    });
  });

  it("keeps a nonzero second, and drops an exact :00", () => {
    expect(localParts("2024-06-14T17:00:05+02:00[Europe/Amsterdam]").time).toBe(
      "17:00:05",
    );
    expect(localParts("2024-06-14T17:00:00+02:00[Europe/Amsterdam]").time).toBe(
      "17:00",
    );
  });

  it.each([
    "1960-06-01T11:15:30-00:45[Africa/Monrovia]",
    "1960-06-01T11:15:30-00:44:30[Africa/Monrovia]",
  ])("gives Monrovia's exact offset for %s", (zoned) => {
    // Temporal rounds -00:44:30 to -00:45 in the string; the zone has seconds.
    expect(localParts(zoned)).toEqual({
      date: "1960-06-01",
      weekday: "Wed",
      time: "11:15:30",
      offset: "-00:44:30",
      zone: "Africa/Monrovia",
    });
  });

  it("gives New York's offset to the second before 1883", () => {
    expect(
      localParts("1880-01-01T12:00:00-04:56:02[America/New_York]").offset,
    ).toBe("-04:56:02");
  });

  it("keeps a fraction of a second", () => {
    expect(
      localParts("2024-06-14T17:00:00.5+02:00[Europe/Amsterdam]").time,
    ).toBe("17:00:00.5");
  });

  it("gives every field blank for text that does not parse", () => {
    expect(localParts("not a zoned string")).toEqual({
      date: "",
      weekday: "",
      time: "",
      offset: "",
      zone: "",
    });
    expect(localParts("")).toEqual({
      date: "",
      weekday: "",
      time: "",
      offset: "",
      zone: "",
    });
  });
});

describe("localLabel", () => {
  it("formats 'Weekday D Mon HH:MM'", () => {
    expect(localLabel("2024-06-14T17:00:00+02:00[Europe/Amsterdam]")).toBe(
      "Fri 14 Jun 17:00",
    );
  });

  it("is blank for text that does not parse", () => {
    expect(localLabel("")).toBe("");
  });
});

describe("durationText", () => {
  it.each([
    ["PT50M", "50 min"],
    ["-PT20M", "20 min"],
    ["PT0S", "0 min"],
    ["PT73H", "73 h"],
    ["PT41H30M", "41 h 30 min"],
    ["-PT60H", "60 h"],
    ["PT0.000000001S", "0.000000001 s"],
    ["PT1M5.5S", "1 min 5.5 s"],
    ["", ""],
  ])("%s -> %s", (iso, want) => {
    expect(durationText(iso)).toBe(want);
  });

  it("never folds hours into days", () => {
    expect(durationText("PT78H")).toBe("78 h");
  });
});

describe("isNegative", () => {
  it("reads the leading sign", () => {
    expect(isNegative("-PT20M")).toBe(true);
    expect(isNegative("PT20M")).toBe(false);
    expect(isNegative("")).toBe(false);
  });
});

describe("isZoneless", () => {
  it("is true for a valid wall time with no offset, zone or bracket", () => {
    expect(isZoneless("2024-06-12T17:20:00", lib)).toBe(true);
  });

  it("is false once an offset, Z or bracket is present", () => {
    expect(isZoneless("2024-06-12T17:20:00+02:00", lib)).toBe(false);
    expect(isZoneless("2024-06-12T17:20:00Z", lib)).toBe(false);
    expect(isZoneless("2024-06-12T17:20:00+02:00[Europe/Amsterdam]", lib)).toBe(
      false,
    );
  });

  it("is false for text that is not a valid date-time at all", () => {
    expect(isZoneless("not a date", lib)).toBe(false);
  });
});

describe("callSource", () => {
  it("matches the appendix Z S1 call verbatim, with absent keys omitted", () => {
    const anchor = "2024-06-17T18:00:00+02:00";
    const entries = [
      { name: "gate-in", offset: "P2D", atLocalTime: "17:00" },
      { name: "documents", offset: "P3D", atLocalTime: "12:00" },
    ];
    const options = {
      timeZone: "Europe/Amsterdam",
      calendar: {
        weekend: [6, 7],
        holidays: [],
        timeZone: "Europe/Amsterdam",
      },
      roll: "preceding",
    };
    const [, plain] = callSource("cutoffSchedule", [anchor, entries, options]);
    expect(plain).toBe(
      '"2024-06-17T18:00:00+02:00", ' +
        '[{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }, ' +
        '{ name: "documents", offset: "P3D", atLocalTime: "12:00" }], ' +
        '{ timeZone: "Europe/Amsterdam", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" }, roll: "preceding" }',
    );
    // The plain text is the real call: run it and check it against S1.
    expect(cutoffSchedule(anchor, entries, options as never)).toEqual([
      { name: "documents", at: "2024-06-14T12:00:00+02:00[Europe/Amsterdam]" },
      { name: "gate-in", at: "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" },
    ]);
  });

  it("omits an absent optional key rather than printing undefined", () => {
    const [, plain] = callSource("cutoffAt", [
      "2024-06-14T16:00:00Z",
      "P2D",
      { timeZone: "Europe/Amsterdam" },
    ]);
    expect(plain).toBe(
      '"2024-06-14T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam" }',
    );
    expect(plain).not.toContain("undefined");
  });

  it("wraps a string in an HTML span", () => {
    const [html] = callSource("timeToCutoff", ["a", "b"]);
    expect(html.match(/<span[^>]*>/g)).toHaveLength(2);
    expect(html.replace(/<[^>]+>/g, "")).toBe('"a", "b"');
  });
});

describe("formatStack", () => {
  it("collapses to the S1 literal", () => {
    const result = cutoffSchedule(
      "2024-06-17T18:00:00+02:00",
      [
        { name: "gate-in", offset: "P2D", atLocalTime: "17:00" },
        { name: "documents", offset: "P3D", atLocalTime: "12:00" },
      ],
      {
        timeZone: "Europe/Amsterdam",
        calendar: {
          weekend: [6, 7],
          holidays: [],
          timeZone: "Europe/Amsterdam",
        },
        roll: "preceding",
      } as never,
    );
    expect(formatStack(result).replace(/\n\s+/g, " ")).toBe(
      '[{ name: "documents", at: "2024-06-14T12:00:00+02:00[Europe/Amsterdam]" }, ' +
        '{ name: "gate-in", at: "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" }]',
    );
  });

  it("collapses to the S4 (JSDoc) literal", () => {
    const result = cutoffSchedule(
      "2024-06-14T16:00:00Z",
      [
        { name: "gate-in", offset: "P1D" },
        { name: "document", offset: "P2D", atLocalTime: "17:00" },
        { name: "VGM", offset: "P1D", atLocalTime: "10:00" },
      ],
      { timeZone: "Europe/Amsterdam" } as never,
    );
    expect(formatStack(result).replace(/\n\s+/g, " ")).toBe(
      '[{ name: "document", at: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]" }, ' +
        '{ name: "VGM", at: "2024-06-13T10:00:00+02:00[Europe/Amsterdam]" }, ' +
        '{ name: "gate-in", at: "2024-06-13T18:00:00+02:00[Europe/Amsterdam]" }]',
    );
  });

  it("is [] for an empty result", () => {
    expect(formatStack([])).toBe("[]");
  });
});

describe("walkTicks with minutes", () => {
  it("ticks every 15 minutes from the hour at or before the start", () => {
    const start = Temporal.Instant.from(
      "2024-06-12T14:30:00Z",
    ).epochMilliseconds; // 16:30 in Amsterdam
    const end = Temporal.Instant.from("2024-06-12T15:50:00Z").epochMilliseconds; // 17:50
    const ticks = walkTicks(
      start,
      end,
      "Europe/Amsterdam",
      "minutes",
      15,
      minuteTickLabel,
    );
    expect(ticks.map((t) => t.label)).toEqual([
      "16:30",
      "16:45",
      "17:00",
      "17:15",
      "17:30",
      "17:45",
    ]);
  });
});

describe("walkTicks at an offset with seconds", () => {
  // No Temporal zone holds -00:44:30 (Monrovia before 1972); the ticks still
  // fall on its whole hours and days, at their exact instants.
  const at = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds;

  it("ticks Monrovia's whole hours", () => {
    const ticks = walkTicks(
      at("1960-06-01T10:00:00Z"),
      at("1960-06-01T13:00:00Z"),
      "-00:44:30",
      "hours",
      1,
      minuteTickLabel,
    );
    expect(ticks).toEqual([
      { ms: at("1960-06-01T10:44:30Z"), label: "10:00" },
      { ms: at("1960-06-01T11:44:30Z"), label: "11:00" },
      { ms: at("1960-06-01T12:44:30Z"), label: "12:00" },
    ]);
  });

  it("ticks New York's local midnights before 1883", () => {
    const ticks = walkTicks(
      at("1880-01-01T00:00:00Z"),
      at("1880-01-03T12:00:00Z"),
      "-04:56:02",
      "days",
      1,
      minuteTickLabel,
    );
    expect(ticks.map((t) => t.ms)).toEqual([
      at("1880-01-01T04:56:02Z"),
      at("1880-01-02T04:56:02Z"),
      at("1880-01-03T04:56:02Z"),
    ]);
    expect(ticks.map((t) => t.label)).toEqual(["00:00", "00:00", "00:00"]);
  });
});
