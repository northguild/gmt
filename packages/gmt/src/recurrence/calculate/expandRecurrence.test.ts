import { describe, expect, it } from "vitest";
import { classifyLocal } from "../../instant/convert/classifyLocal";
import { Temporal } from "../../internal/temporal";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import type { RecurrenceOccurrence, RecurrenceRule } from "../../types";
import { parseRecurrenceRule } from "../parse/parseRecurrenceRule";
import { expandRecurrence } from "./expandRecurrence";

const NY = "America/New_York";
const WIDE = { start: "1990-01-01T00:00:00Z", end: "2100-01-01T00:00:00Z" };

function rule(text: string): RecurrenceRule {
  const parsed = parseRecurrenceRule(text);
  if (parsed === null) throw new Error(`test rule ${text} did not parse`);
  return parsed;
}

function unique(local: string, instant: string): RecurrenceOccurrence {
  return {
    local,
    instant,
    classification: "unique",
    earlier: instant,
    later: instant,
  };
}

describe("expandRecurrence, gaps and overlaps in America/New_York", () => {
  // Rule: RFC 5545 §3.3.5 FORM #3 and Erratum 4271. A time in the spring gap is resolved to the
  // offset before the gap: 02:30 at -05:00 is 07:30Z, "earlier" reads it at -04:00, 06:30Z.
  const gap = rule("FREQ=DAILY;COUNT=3");

  it.each`
    disambiguation  | instantOnMarch10
    ${undefined}    | ${"2024-03-10T07:30:00Z"}
    ${"compatible"} | ${"2024-03-10T07:30:00Z"}
    ${"later"}      | ${"2024-03-10T07:30:00Z"}
    ${"earlier"}    | ${"2024-03-10T06:30:00Z"}
  `(
    "a skipped 02:30 counts and takes $instantOnMarch10 under $disambiguation",
    ({ disambiguation, instantOnMarch10 }) => {
      expect(
        expandRecurrence(gap, "2024-03-09T02:30:00", NY, WIDE, {
          disambiguation,
        }),
      ).toEqual([
        unique("2024-03-09T02:30:00", "2024-03-09T07:30:00Z"),
        {
          local: "2024-03-10T02:30:00",
          instant: instantOnMarch10,
          classification: "nonexistent",
          earlier: "2024-03-10T06:30:00Z",
          later: "2024-03-10T07:30:00Z",
        },
        unique("2024-03-11T02:30:00", "2024-03-11T06:30:00Z"),
      ]);
    },
  );

  it("reject returns [] for the whole call when a row is skipped", () => {
    expect(
      expandRecurrence(gap, "2024-03-09T02:30:00", NY, WIDE, {
        disambiguation: "reject",
      }),
    ).toEqual([]);
  });

  it("reject keeps the unique rows when the window holds no skipped time", () => {
    expect(
      expandRecurrence(
        gap,
        "2024-03-09T02:30:00",
        NY,
        { start: "2024-03-11T04:00:00Z", end: "2024-03-12T04:00:00Z" },
        { disambiguation: "reject" },
      ),
    ).toEqual([unique("2024-03-11T02:30:00", "2024-03-11T06:30:00Z")]);
  });

  // Rule: RFC 5545 §3.3.5, a repeated time is its first occurrence. 01:30 on 2024-11-03 is
  // 05:30Z at -04:00 and 06:30Z at -05:00.
  it.each`
    disambiguation  | instantOnNovember3
    ${"compatible"} | ${"2024-11-03T05:30:00Z"}
    ${"earlier"}    | ${"2024-11-03T05:30:00Z"}
    ${"later"}      | ${"2024-11-03T06:30:00Z"}
  `(
    "a repeated 01:30 takes $instantOnNovember3 under $disambiguation",
    ({ disambiguation, instantOnNovember3 }) => {
      expect(
        expandRecurrence(
          rule("FREQ=DAILY;COUNT=2"),
          "2024-11-02T01:30:00",
          NY,
          WIDE,
          {
            disambiguation,
          },
        ),
      ).toEqual([
        unique("2024-11-02T01:30:00", "2024-11-02T05:30:00Z"),
        {
          local: "2024-11-03T01:30:00",
          instant: instantOnNovember3,
          classification: "ambiguous",
          earlier: "2024-11-03T05:30:00Z",
          later: "2024-11-03T06:30:00Z",
        },
      ]);
    },
  );

  it("reject returns [] when a row is repeated, and for a repeated RDATE", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=2"),
        "2024-11-02T01:30:00",
        NY,
        WIDE,
        {
          disambiguation: "reject",
        },
      ),
    ).toEqual([]);
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=1"),
        "2024-11-01T09:00:00",
        NY,
        WIDE,
        { disambiguation: "reject", rdate: ["2024-11-03T01:30:00"] },
      ),
    ).toEqual([]);
  });

  // COUNT counts the five local hours 00, 01, 02, 03, 04; 02:00 is skipped and resolves to 07:00Z,
  // the same instant as 03:00, so one row collapses into the other (§3.8.5.3, first in local order).
  it("COUNT is taken before equal instants collapse", () => {
    expect(
      expandRecurrence(
        rule("FREQ=HOURLY;COUNT=5"),
        "2024-03-10T00:00:00",
        NY,
        WIDE,
      ),
    ).toEqual([
      unique("2024-03-10T00:00:00", "2024-03-10T05:00:00Z"),
      unique("2024-03-10T01:00:00", "2024-03-10T06:00:00Z"),
      {
        local: "2024-03-10T02:00:00",
        instant: "2024-03-10T07:00:00Z",
        classification: "nonexistent",
        earlier: "2024-03-10T06:00:00Z",
        later: "2024-03-10T07:00:00Z",
      },
      unique("2024-03-10T04:00:00", "2024-03-10T08:00:00Z"),
    ]);
  });
});

describe("expandRecurrence, probe zones", () => {
  const daily3 = rule("FREQ=DAILY;COUNT=3");

  it("Pacific/Apia compatible keeps the skipped day's later reading", () => {
    // 2011-12-30 was deleted: at 2011-12-30T10:00Z (00:00 on the 30th at -10:00) the offset went
    // from -10:00 to +14:00. 12:00 on the 30th: -10:00 gives 12-30T22:00Z, +14:00 gives 12-29T22:00Z.
    expect(
      expandRecurrence(daily3, "2011-12-29T12:00:00", "Pacific/Apia", WIDE),
    ).toEqual([
      unique("2011-12-29T12:00:00", "2011-12-29T22:00:00Z"),
      {
        local: "2011-12-30T12:00:00",
        instant: "2011-12-30T22:00:00Z",
        classification: "nonexistent",
        earlier: "2011-12-29T22:00:00Z",
        later: "2011-12-30T22:00:00Z",
      },
    ]);
  });

  it("Pacific/Apia earlier collapses the skipped day into the first and keeps the 31st", () => {
    expect(
      expandRecurrence(daily3, "2011-12-29T12:00:00", "Pacific/Apia", WIDE, {
        disambiguation: "earlier",
      }),
    ).toEqual([
      unique("2011-12-29T12:00:00", "2011-12-29T22:00:00Z"),
      unique("2011-12-31T12:00:00", "2011-12-30T22:00:00Z"),
    ]);
  });

  it.each`
    timeZone       | instants
    ${"+05:30"}    | ${["2024-03-08T21:00:00Z", "2024-03-09T21:00:00Z", "2024-03-10T21:00:00Z"]}
    ${"+05:30:00"} | ${["2024-03-08T21:00:00Z", "2024-03-09T21:00:00Z", "2024-03-10T21:00:00Z"]}
    ${"UTC"}       | ${["2024-03-09T02:30:00Z", "2024-03-10T02:30:00Z", "2024-03-11T02:30:00Z"]}
  `(
    "a fixed zone $timeZone makes every row unique",
    ({ timeZone, instants }) => {
      const locals = [
        "2024-03-09T02:30:00",
        "2024-03-10T02:30:00",
        "2024-03-11T02:30:00",
      ];
      expect(
        expandRecurrence(daily3, "2024-03-09T02:30:00", timeZone, WIDE),
      ).toEqual(locals.map((local, index) => unique(local, instants[index])));
    },
  );

  it("a stored offset with seconds is read exactly", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=2"),
        "1970-01-01T12:00:00",
        "-00:44:30",
        {
          start: "1969-01-01T00:00:00Z",
          end: "1971-01-01T00:00:00Z",
        },
      ),
    ).toEqual([
      unique("1970-01-01T12:00:00", "1970-01-01T12:44:30Z"),
      unique("1970-01-02T12:00:00", "1970-01-02T12:44:30Z"),
    ]);
  });
});

describe("expandRecurrence, windows", () => {
  const daily = rule("FREQ=DAILY");
  const start = "2024-01-01T09:00:00";

  it.each`
    window                                                            | locals
    ${{ start: "2024-01-02T09:00:00Z", end: "2024-01-04T09:00:00Z" }} | ${["2024-01-02T09:00:00", "2024-01-03T09:00:00"]}
    ${{ after: "2024-01-02T09:00:00Z", count: 2 }}                    | ${["2024-01-03T09:00:00", "2024-01-04T09:00:00"]}
    ${{ start: "2024-01-02T09:00:00Z", end: "2024-01-02T09:00:00Z" }} | ${[]}
    ${{ after: "2023-01-01T00:00:00Z", count: 1 }}                    | ${["2024-01-01T09:00:00"]}
  `("$window gives $locals", ({ window, locals }) => {
    expect(
      expandRecurrence(daily, start, "UTC", window).map((row) => row.local),
    ).toEqual(locals);
  });

  it("MINUTELY over 6 days gives 8,640 rows and over 7 days gives [] (the 10,000-row cap)", () => {
    const minutely = rule("FREQ=MINUTELY");
    const from = "2024-01-01T00:00:00";
    expect(
      expandRecurrence(minutely, from, "UTC", {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-07T00:00:00Z",
      }),
    ).toHaveLength(8640);
    expect(
      expandRecurrence(minutely, from, "UTC", {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-08T00:00:00Z",
      }),
    ).toEqual([]);
  });

  it("a 10,000-row count window is the largest allowed", () => {
    expect(
      expandRecurrence(daily, start, "UTC", {
        after: "2024-01-01T09:00:00Z",
        count: 10_000,
      }),
    ).toHaveLength(10_000);
  });

  it("fast-forwards to a window long after DTSTART", () => {
    expect(
      expandRecurrence(daily, "1900-01-01T09:00:00", NY, {
        start: "2024-06-01T00:00:00Z",
        end: "2024-06-04T00:00:00Z",
      }).map((row) => row.instant),
    ).toEqual([
      "2024-06-01T13:00:00Z",
      "2024-06-02T13:00:00Z",
      "2024-06-03T13:00:00Z",
    ]);
  });

  it("COUNT is taken from DTSTART, not from the window", () => {
    expect(
      expandRecurrence(rule("FREQ=DAILY;COUNT=5"), start, "UTC", {
        start: "2024-01-04T00:00:00Z",
        end: "2024-02-01T00:00:00Z",
      }).map((row) => row.local),
    ).toEqual(["2024-01-04T09:00:00", "2024-01-05T09:00:00"]);
  });

  it("a rule that never matches reaches the work cap and returns []", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"),
        start,
        "UTC",
        {
          after: "2024-01-01T09:00:00Z",
          count: 1,
        },
      ),
    ).toEqual([]);
  });
});

describe("expandRecurrence, RDATE, EXDATE and UNTIL", () => {
  const start = "2024-01-01T09:00:00";
  const at = (local: string) => unique(local, `${local}Z`);

  it("RDATE merges, an instant RDATE equal to a generated row counts once", () => {
    expect(
      expandRecurrence(rule("FREQ=DAILY;COUNT=2"), start, "UTC", WIDE, {
        rdate: ["2024-01-05T12:00:00", "2024-01-02T09:00:00Z"],
      }),
    ).toEqual([
      at("2024-01-01T09:00:00"),
      at("2024-01-02T09:00:00"),
      at("2024-01-05T12:00:00"),
    ]);
  });

  it("UNTIL is inclusive", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;UNTIL=20240102T090000Z"),
        start,
        "UTC",
        WIDE,
      ).map((row) => row.local),
    ).toEqual(["2024-01-01T09:00:00", "2024-01-02T09:00:00"]);
  });

  it("an RDATE after UNTIL is kept", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;UNTIL=20240102T090000Z"),
        start,
        "UTC",
        WIDE,
        {
          rdate: ["2024-02-01T09:00:00"],
        },
      ).map((row) => row.local),
    ).toEqual([
      "2024-01-01T09:00:00",
      "2024-01-02T09:00:00",
      "2024-02-01T09:00:00",
    ]);
  });

  it.each`
    case                               | options
    ${"an EXDATE equal to an RDATE"}   | ${{ rdate: ["2024-01-05T12:00:00"], exdate: ["2024-01-05T12:00:00"] }}
    ${"an EXDATE given as an instant"} | ${{ rdate: ["2024-01-05T12:00:00"], exdate: ["2024-01-05T12:00:00Z"] }}
  `("$case removes the RDATE", ({ options }) => {
    expect(
      expandRecurrence(rule("FREQ=DAILY;COUNT=1"), start, "UTC", WIDE, options),
    ).toEqual([at("2024-01-01T09:00:00")]);
  });

  it("an EXDATE given as an instant removes DTSTART, which still counts toward COUNT", () => {
    expect(
      expandRecurrence(rule("FREQ=DAILY;COUNT=2"), start, "UTC", WIDE, {
        exdate: ["2024-01-01T09:00:00Z"],
      }),
    ).toEqual([at("2024-01-02T09:00:00")]);
  });

  it("an RDATE instant keeps its instant and takes the marks of its wall time", () => {
    // 06:30Z on 2024-11-03 is 01:30 at -05:00, the second reading of a repeated hour.
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=1"),
        "2024-11-01T09:00:00",
        NY,
        WIDE,
        {
          rdate: ["2024-11-03T06:30:00Z"],
        },
      )[1],
    ).toEqual({
      local: "2024-11-03T01:30:00",
      instant: "2024-11-03T06:30:00Z",
      classification: "ambiguous",
      earlier: "2024-11-03T05:30:00Z",
      later: "2024-11-03T06:30:00Z",
    });
  });

  it("an RDATE wall time is resolved by the call's policy", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=1"),
        "2024-11-01T09:00:00",
        NY,
        WIDE,
        {
          rdate: ["2024-11-03T01:30:00"],
          disambiguation: "later",
        },
      )[1]?.instant,
    ).toBe("2024-11-03T06:30:00Z");
  });

  it("DTSTART after UNTIL is still the first instance", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;UNTIL=20231231T000000Z"),
        start,
        "UTC",
        WIDE,
      ),
    ).toEqual([at("2024-01-01T09:00:00")]);
  });
});

describe("expandRecurrence, invalid input returns []", () => {
  const daily = parseRecurrenceRule("FREQ=DAILY")!;
  const ok = "2024-01-01T09:00:00";
  const window = { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" };

  it.each`
    case                          | rule                                                     | start                      | zone              | window                                                            | options
    ${"floating until"}           | ${{ ...daily, until: "2024-01-01T00:00:00" }}            | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${undefined}
    ${"date until"}               | ${{ ...daily, until: "2024-01-01" }}                     | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${undefined}
    ${"count and until"}          | ${{ ...daily, count: 2, until: "2024-01-03T00:00:00Z" }} | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${undefined}
    ${"a bare frequency"}         | ${{ frequency: "daily" }}                                | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${undefined}
    ${"sub-second start"}         | ${daily}                                                 | ${"2024-01-01T09:00:00.5"} | ${"UTC"}          | ${window}                                                         | ${undefined}
    ${"an impossible date"}       | ${daily}                                                 | ${"2024-02-30T09:00:00"}   | ${"UTC"}          | ${window}                                                         | ${undefined}
    ${"a start with Z"}           | ${daily}                                                 | ${"2024-01-01T09:00:00Z"}  | ${"UTC"}          | ${window}                                                         | ${undefined}
    ${"an unknown zone"}          | ${daily}                                                 | ${ok}                      | ${"Mars/Olympus"} | ${window}                                                         | ${undefined}
    ${"options that is a number"} | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${5}
    ${"unknown disambiguation"}   | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${{ disambiguation: "sideways" }}
    ${"a DATE rdate"}             | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${{ rdate: ["2024-01-01"] }}
    ${"a PERIOD exdate"}          | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${{ exdate: ["2024-01-01T00:00:00Z/PT1H"] }}
    ${"rdate that is not a list"} | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${{ rdate: "2024-01-02T09:00:00" }}
    ${"a null window"}            | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${null}                                                           | ${undefined}
    ${"an unparsable after"}      | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${{ after: "x", count: 1 }}                                       | ${undefined}
    ${"count 0"}                  | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${{ after: "2024-01-01T00:00:00Z", count: 0 }}                    | ${undefined}
    ${"count 10001"}              | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${{ after: "2024-01-01T00:00:00Z", count: 10_001 }}               | ${undefined}
    ${"count 1.5"}                | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${{ after: "2024-01-01T00:00:00Z", count: 1.5 }}                  | ${undefined}
    ${"an inverted interval"}     | ${daily}                                                 | ${ok}                      | ${"UTC"}          | ${{ start: "2024-01-05T00:00:00Z", end: "2024-01-01T00:00:00Z" }} | ${undefined}
    ${"a rule that is null"}      | ${null}                                                  | ${ok}                      | ${"UTC"}          | ${window}                                                         | ${undefined}
  `("$case", ({ rule: r, start, zone, window: w, options }) => {
    expect(expandRecurrence(r, start, zone, w, options)).toEqual([]);
  });
});

describe("expandRecurrence, invariants across zones and rules", () => {
  // A seeded generator keeps the rule mix fixed from run to run.
  function seeded(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return state / 4_294_967_296;
    };
  }
  const ruleTexts = [
    "FREQ=DAILY",
    "FREQ=HOURLY;INTERVAL=5",
    "FREQ=WEEKLY;BYDAY=SU,WE",
    "FREQ=MONTHLY;BYDAY=-1SU",
    "FREQ=MONTHLY;BYMONTHDAY=29,30,31",
    "FREQ=YEARLY;BYMONTH=3,10,11;BYDAY=1SU",
    "FREQ=MINUTELY;INTERVAL=45;BYHOUR=0,1,2,3",
  ];
  const zones = [
    ...battleTestTimeZones,
    "Antarctica/Casey",
    "America/Santiago",
  ];

  it.each(zones.map((timeZone) => ({ timeZone })))(
    "every row's classification matches classifyLocal and instants ascend in $timeZone",
    ({ timeZone }) => {
      const next = seeded(timeZone.length * 7919);
      for (const text of ruleTexts) {
        const day = 1 + Math.floor(next() * 28);
        const hour = Math.floor(next() * 24);
        const month = [3, 4, 10, 11, 12][Math.floor(next() * 5)]!;
        const start = `2023-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:15:00`;
        const rows = expandRecurrence(rule(text), start, timeZone, {
          start: "2023-01-01T00:00:00Z",
          end: "2024-06-01T00:00:00Z",
        });

        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.classification).toBe(classifyLocal(row.local, timeZone));
        }
        for (let index = 1; index < rows.length; index += 1) {
          expect(
            Temporal.Instant.compare(
              rows[index]!.instant,
              rows[index - 1]!.instant,
            ),
          ).toBe(1);
        }
      }
    },
  );
});

describe("expandRecurrence, every disambiguation at a real transition", () => {
  // DAILY;COUNT=3 over the day before, the day of and the day after a transition. The instants come
  // from wall time and offset (RFC 5545 §3.3.5 FORM #3, TC39 disambiguation): `earlier` reads a skipped
  // time at the offset after the gap and a repeated one at the offset before the change; `later`
  // is the other reading. "compatible" is the earlier of a repeat and the later of a skip.
  const chosen = {
    ambiguous: { compatible: "earlier", earlier: "earlier", later: "later" },
    nonexistent: { compatible: "later", earlier: "earlier", later: "later" },
  } as const;

  describe.each`
    zone                     | kind             | locals                                                                   | before                    | earlierReading            | laterReading              | after
    ${"Europe/Berlin"}       | ${"nonexistent"} | ${["2024-03-30T02:30:00", "2024-03-31T02:30:00", "2024-04-01T02:30:00"]} | ${"2024-03-30T01:30:00Z"} | ${"2024-03-31T00:30:00Z"} | ${"2024-03-31T01:30:00Z"} | ${"2024-04-01T00:30:00Z"}
    ${"Europe/Berlin"}       | ${"ambiguous"}   | ${["2024-10-26T02:30:00", "2024-10-27T02:30:00", "2024-10-28T02:30:00"]} | ${"2024-10-26T00:30:00Z"} | ${"2024-10-27T00:30:00Z"} | ${"2024-10-27T01:30:00Z"} | ${"2024-10-28T01:30:00Z"}
    ${"Europe/Dublin"}       | ${"nonexistent"} | ${["2024-03-30T01:30:00", "2024-03-31T01:30:00", "2024-04-01T01:30:00"]} | ${"2024-03-30T01:30:00Z"} | ${"2024-03-31T00:30:00Z"} | ${"2024-03-31T01:30:00Z"} | ${"2024-04-01T00:30:00Z"}
    ${"Europe/Dublin"}       | ${"ambiguous"}   | ${["2024-10-26T01:30:00", "2024-10-27T01:30:00", "2024-10-28T01:30:00"]} | ${"2024-10-26T00:30:00Z"} | ${"2024-10-27T00:30:00Z"} | ${"2024-10-27T01:30:00Z"} | ${"2024-10-28T01:30:00Z"}
    ${"America/Santiago"}    | ${"nonexistent"} | ${["2024-09-07T00:30:00", "2024-09-08T00:30:00", "2024-09-09T00:30:00"]} | ${"2024-09-07T04:30:00Z"} | ${"2024-09-08T03:30:00Z"} | ${"2024-09-08T04:30:00Z"} | ${"2024-09-09T03:30:00Z"}
    ${"America/Santiago"}    | ${"ambiguous"}   | ${["2024-04-05T23:30:00", "2024-04-06T23:30:00", "2024-04-07T23:30:00"]} | ${"2024-04-06T02:30:00Z"} | ${"2024-04-07T02:30:00Z"} | ${"2024-04-07T03:30:00Z"} | ${"2024-04-08T03:30:00Z"}
    ${"Australia/Lord_Howe"} | ${"nonexistent"} | ${["2024-10-05T02:15:00", "2024-10-06T02:15:00", "2024-10-07T02:15:00"]} | ${"2024-10-04T15:45:00Z"} | ${"2024-10-05T15:15:00Z"} | ${"2024-10-05T15:45:00Z"} | ${"2024-10-06T15:15:00Z"}
    ${"Australia/Lord_Howe"} | ${"ambiguous"}   | ${["2024-04-06T01:45:00", "2024-04-07T01:45:00", "2024-04-08T01:45:00"]} | ${"2024-04-05T14:45:00Z"} | ${"2024-04-06T14:45:00Z"} | ${"2024-04-06T15:15:00Z"} | ${"2024-04-07T15:15:00Z"}
    ${"Pacific/Chatham"}     | ${"nonexistent"} | ${["2024-09-28T03:15:00", "2024-09-29T03:15:00", "2024-09-30T03:15:00"]} | ${"2024-09-27T14:30:00Z"} | ${"2024-09-28T13:30:00Z"} | ${"2024-09-28T14:30:00Z"} | ${"2024-09-29T13:30:00Z"}
    ${"Pacific/Chatham"}     | ${"ambiguous"}   | ${["2024-04-06T03:00:00", "2024-04-07T03:00:00", "2024-04-08T03:00:00"]} | ${"2024-04-05T13:15:00Z"} | ${"2024-04-06T13:15:00Z"} | ${"2024-04-06T14:15:00Z"} | ${"2024-04-07T14:15:00Z"}
    ${"Antarctica/Casey"}    | ${"nonexistent"} | ${["2020-10-03T01:30:00", "2020-10-04T01:30:00", "2020-10-05T01:30:00"]} | ${"2020-10-02T17:30:00Z"} | ${"2020-10-03T14:30:00Z"} | ${"2020-10-03T17:30:00Z"} | ${"2020-10-04T14:30:00Z"}
  `(
    "$zone, a $kind wall time",
    ({ zone, kind, locals, before, earlierReading, laterReading, after }) => {
      const daily3 = rule("FREQ=DAILY;COUNT=3");

      it.each`
        disambiguation
        ${undefined}
        ${"compatible"}
        ${"earlier"}
        ${"later"}
      `(
        "takes the $disambiguation reading and marks the row $kind",
        ({ disambiguation }) => {
          const reading =
            chosen[kind as keyof typeof chosen][
              (disambiguation ?? "compatible") as keyof typeof chosen.ambiguous
            ];

          expect(
            expandRecurrence(daily3, locals[0], zone, WIDE, { disambiguation }),
          ).toEqual([
            unique(locals[0], before),
            {
              local: locals[1],
              instant: reading === "earlier" ? earlierReading : laterReading,
              classification: kind,
              earlier: earlierReading,
              later: laterReading,
            },
            unique(locals[2], after),
          ]);
        },
      );

      it("reject returns [] for the call, and keeps the unique row of a window that holds no such time", () => {
        expect(
          expandRecurrence(daily3, locals[0], zone, WIDE, {
            disambiguation: "reject",
          }),
        ).toEqual([]);
        expect(
          expandRecurrence(
            daily3,
            locals[0],
            zone,
            {
              start: after,
              end: Temporal.Instant.from(after).add({ seconds: 1 }).toString(),
            },
            { disambiguation: "reject" },
          ),
        ).toEqual([unique(locals[2], after)]);
      });
    },
  );

  it("Pacific/Apia: the deleted 2011-12-30 under later", () => {
    // 12-30 12:00 read at -10:00 is 12-30T22:00Z, the same instant as 12-31 12:00 at +14:00, so
    // the second collapses into the first wall time.
    const daily3 = rule("FREQ=DAILY;COUNT=3");
    const start = "2011-12-29T12:00:00";

    expect(
      expandRecurrence(daily3, start, "Pacific/Apia", WIDE, {
        disambiguation: "later",
      }),
    ).toEqual([
      unique("2011-12-29T12:00:00", "2011-12-29T22:00:00Z"),
      {
        local: "2011-12-30T12:00:00",
        instant: "2011-12-30T22:00:00Z",
        classification: "nonexistent",
        earlier: "2011-12-29T22:00:00Z",
        later: "2011-12-30T22:00:00Z",
      },
    ]);
  });

  it.each`
    disambiguation
    ${"earlier"}
    ${"later"}
    ${"reject"}
  `(
    "$disambiguation changes nothing for rows that are all unique",
    ({ disambiguation }) => {
      expect(
        expandRecurrence(
          rule("FREQ=DAILY;COUNT=2"),
          "2024-01-01T09:00:00",
          NY,
          WIDE,
          { disambiguation },
        ),
      ).toEqual([
        unique("2024-01-01T09:00:00", "2024-01-01T14:00:00Z"),
        unique("2024-01-02T09:00:00", "2024-01-02T14:00:00Z"),
      ]);
    },
  );

  // Rule: expand.md step 7, "run as compatible; if any returned row is non-unique, return []". The
  // skipped 02:30 on 2024-03-10 is placed at 07:30Z by "compatible", so a window that holds only its
  // 06:30Z reading does not return it. Likewise the repeated 01:30 on 2024-11-03 is placed at 05:30Z,
  // so a window that holds only its 06:30Z reading does not return it.
  it.each`
    case                                        | text                    | start                    | window                                                            | locals
    ${"the skipped time's earlier reading"}     | ${"FREQ=DAILY;COUNT=3"} | ${"2024-03-09T02:30:00"} | ${{ start: "2024-03-09T07:00:00Z", end: "2024-03-10T07:00:00Z" }} | ${["2024-03-09T02:30:00"]}
    ${"the skipped time's both readings"}       | ${"FREQ=DAILY;COUNT=3"} | ${"2024-03-09T02:30:00"} | ${{ start: "2024-03-09T07:00:00Z", end: "2024-03-10T08:00:00Z" }} | ${[]}
    ${"neither of the skipped time's readings"} | ${"FREQ=DAILY;COUNT=3"} | ${"2024-03-09T02:30:00"} | ${{ start: "2024-03-09T07:00:00Z", end: "2024-03-10T06:30:00Z" }} | ${["2024-03-09T02:30:00"]}
    ${"the repeated time's later reading"}      | ${"FREQ=DAILY;COUNT=3"} | ${"2024-11-02T01:30:00"} | ${{ start: "2024-11-03T06:00:00Z", end: "2024-11-05T00:00:00Z" }} | ${["2024-11-04T01:30:00"]}
    ${"the repeated time's earlier reading"}    | ${"FREQ=DAILY;COUNT=3"} | ${"2024-11-02T01:30:00"} | ${{ start: "2024-11-03T05:00:00Z", end: "2024-11-03T06:00:00Z" }} | ${[]}
  `(
    "reject over a window with $case follows the compatible rows: $locals",
    ({ text, start, window, locals }) => {
      expect(
        expandRecurrence(rule(text), start, NY, window, {
          disambiguation: "reject",
        }).map((row) => row.local),
      ).toEqual(locals);
    },
  );

  // Rule: expand.md step 7. 02:00 is skipped; "compatible" places it at 07:00Z, where it collapses
  // with 03:00 and the row is non-unique, so the call returns []. A row that only looks unique after
  // a different reading collapses it must not hide the refusal.
  it.each`
    case                                  | text                     | start                    | zone
    ${"HOURLY through the skipped 02:00"} | ${"FREQ=HOURLY;COUNT=5"} | ${"2024-03-10T00:00:00"} | ${NY}
    ${"DAILY through Apia's deleted day"} | ${"FREQ=DAILY;COUNT=3"}  | ${"2011-12-29T12:00:00"} | ${"Pacific/Apia"}
  `("reject returns [] for $case", ({ text, start, zone }) => {
    expect(
      expandRecurrence(rule(text), start, zone, WIDE, {
        disambiguation: "reject",
      }),
    ).toEqual([]);
  });

  it("reject ignores a skipped time that the count window never reaches", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY"),
        "2024-03-09T02:30:00",
        NY,
        { after: "2024-03-08T00:00:00Z", count: 1 },
        { disambiguation: "reject" },
      ),
    ).toEqual([unique("2024-03-09T02:30:00", "2024-03-09T07:30:00Z")]);
  });

  it("the HOURLY run through the skipped hour collapses 03:00 under every policy but earlier", () => {
    // 02:00 skipped. compatible/later: 07:00Z, equal to 03:00 EDT (07:00Z), so one row.
    // earlier: 02:00 is 06:00Z, equal to 01:00 EST (06:00Z), so 01:00 and 02:00 become one row
    // and 03:00 stays.
    const hourly = rule("FREQ=HOURLY;COUNT=5");
    const start = "2024-03-10T00:00:00";

    expect(
      expandRecurrence(hourly, start, NY, WIDE, {
        disambiguation: "earlier",
      }).map((row) => [row.local, row.instant]),
    ).toEqual([
      ["2024-03-10T00:00:00", "2024-03-10T05:00:00Z"],
      ["2024-03-10T01:00:00", "2024-03-10T06:00:00Z"],
      ["2024-03-10T03:00:00", "2024-03-10T07:00:00Z"],
      ["2024-03-10T04:00:00", "2024-03-10T08:00:00Z"],
    ]);
    expect(
      expandRecurrence(hourly, start, NY, WIDE, {
        disambiguation: "later",
      }).map((row) => [row.local, row.instant]),
    ).toEqual([
      ["2024-03-10T00:00:00", "2024-03-10T05:00:00Z"],
      ["2024-03-10T01:00:00", "2024-03-10T06:00:00Z"],
      ["2024-03-10T02:00:00", "2024-03-10T07:00:00Z"],
      ["2024-03-10T04:00:00", "2024-03-10T08:00:00Z"],
    ]);
  });

  it("a count window counts rows after equal instants collapse", () => {
    expect(
      expandRecurrence(rule("FREQ=HOURLY"), "2024-03-10T00:00:00", NY, {
        after: "2024-03-10T04:00:00Z",
        count: 4,
      }).map((row) => [row.local, row.instant]),
    ).toEqual([
      ["2024-03-10T00:00:00", "2024-03-10T05:00:00Z"],
      ["2024-03-10T01:00:00", "2024-03-10T06:00:00Z"],
      ["2024-03-10T02:00:00", "2024-03-10T07:00:00Z"],
      ["2024-03-10T04:00:00", "2024-03-10T08:00:00Z"],
    ]);
  });
});

describe("expandRecurrence, window edges follow the chosen instant", () => {
  // The skipped 02:30 on 2024-03-10: "compatible" places it at 07:30Z, "earlier" at 06:30Z. A window
  // is half-open, so its start is in and its end is out (coding-standards § 8).
  const gap = rule("FREQ=DAILY;COUNT=3");

  it.each`
    disambiguation  | window                                                            | instants
    ${"compatible"} | ${{ start: "2024-03-10T06:30:00Z", end: "2024-03-10T07:30:00Z" }} | ${[]}
    ${"compatible"} | ${{ start: "2024-03-10T07:30:00Z", end: "2024-03-10T07:30:01Z" }} | ${["2024-03-10T07:30:00Z"]}
    ${"earlier"}    | ${{ start: "2024-03-10T06:30:00Z", end: "2024-03-10T06:30:01Z" }} | ${["2024-03-10T06:30:00Z"]}
    ${"earlier"}    | ${{ start: "2024-03-10T06:30:01Z", end: "2024-03-10T07:30:00Z" }} | ${[]}
    ${"later"}      | ${{ after: "2024-03-10T07:29:59Z", count: 1 }}                    | ${["2024-03-10T07:30:00Z"]}
    ${"later"}      | ${{ after: "2024-03-10T07:30:00Z", count: 1 }}                    | ${["2024-03-11T06:30:00Z"]}
  `(
    "$window under $disambiguation gives $instants",
    ({ disambiguation, window, instants }) => {
      expect(
        expandRecurrence(gap, "2024-03-09T02:30:00", NY, window, {
          disambiguation,
        }).map((row) => row.instant),
      ).toEqual(instants);
    },
  );

  // UNTIL is a UTC instant and inclusive (RFC 5545 §3.3.10); the policy's instant is the one compared.
  it.each`
    disambiguation  | until                 | instants
    ${"compatible"} | ${"20240310T070000Z"} | ${["2024-03-09T07:30:00Z"]}
    ${"earlier"}    | ${"20240310T070000Z"} | ${["2024-03-09T07:30:00Z", "2024-03-10T06:30:00Z"]}
    ${"compatible"} | ${"20240311T063000Z"} | ${["2024-03-09T07:30:00Z", "2024-03-10T07:30:00Z", "2024-03-11T06:30:00Z"]}
    ${"compatible"} | ${"20240311T062959Z"} | ${["2024-03-09T07:30:00Z", "2024-03-10T07:30:00Z"]}
  `(
    "UNTIL=$until under $disambiguation gives $instants",
    ({ disambiguation, until, instants }) => {
      expect(
        expandRecurrence(
          rule(`FREQ=DAILY;UNTIL=${until}`),
          "2024-03-09T02:30:00",
          NY,
          WIDE,
          { disambiguation },
        ).map((row) => row.instant),
      ).toEqual(instants);
    },
  );
});

describe("expandRecurrence, the 10,000-row cap and the work cap", () => {
  const minutely = rule("FREQ=MINUTELY");
  const from = "2024-01-01T00:00:00";

  // 10,000 minutes after 2024-01-01T00:00Z is 2024-01-07T22:40Z.
  it.each`
    end                       | rows
    ${"2024-01-07T22:40:00Z"} | ${10_000}
    ${"2024-01-07T22:41:00Z"} | ${0}
  `("an interval ending $end gives $rows rows", ({ end, rows }) => {
    expect(
      expandRecurrence(minutely, from, "UTC", {
        start: "2024-01-01T00:00:00Z",
        end,
      }),
    ).toHaveLength(rows);
  });

  it("RDATE rows count toward the 10,000", () => {
    expect(
      expandRecurrence(
        minutely,
        from,
        "UTC",
        { start: "2024-01-01T00:00:00Z", end: "2024-01-07T22:40:00Z" },
        { rdate: ["2024-01-01T00:00:30"] },
      ),
    ).toEqual([]);
  });

  it("an RDATE equal to a generated row does not count twice", () => {
    expect(
      expandRecurrence(
        minutely,
        from,
        "UTC",
        { start: "2024-01-01T00:00:00Z", end: "2024-01-07T22:40:00Z" },
        { rdate: ["2024-01-01T00:01:00Z"] },
      ),
    ).toHaveLength(10_000);
  });

  it("an EXDATE frees room under the cap", () => {
    expect(
      expandRecurrence(
        minutely,
        from,
        "UTC",
        { start: "2024-01-01T00:00:00Z", end: "2024-01-07T22:41:00Z" },
        { exdate: ["2024-01-01T00:00:00"] },
      ),
    ).toHaveLength(10_000);
  });

  it("a count window of 10,000 over a thinner rule with RDATE returns the first 10,000", () => {
    const rows = expandRecurrence(
      rule("FREQ=DAILY"),
      "2024-01-01T09:00:00",
      "UTC",
      { after: "2024-01-01T09:00:00Z", count: 10_000 },
      { rdate: ["2024-01-01T10:00:00"] },
    );

    expect(rows).toHaveLength(10_000);
    expect(rows[0]).toEqual(
      unique("2024-01-01T10:00:00", "2024-01-01T10:00:00Z"),
    );
    expect(rows[1]).toEqual(
      unique("2024-01-02T09:00:00", "2024-01-02T09:00:00Z"),
    );
  });

  it.each`
    case                           | text                                            | window
    ${"a count window"}            | ${"FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"}         | ${{ after: "2024-01-01T09:00:00Z", count: 1 }}
    ${"a count window with COUNT"} | ${"FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30;COUNT=2"} | ${{ after: "2024-01-01T09:00:00Z", count: 5 }}
    ${"a SECONDLY count window"}   | ${"FREQ=SECONDLY;BYMONTH=2;BYMONTHDAY=30"}      | ${{ after: "2024-01-01T09:00:00Z", count: 5 }}
  `(
    "a rule that never finds a row in 2,000,000 steps returns [], $case",
    ({ text, window }) => {
      expect(
        expandRecurrence(rule(text), "2024-01-01T09:00:00", "UTC", window),
      ).toEqual([]);
    },
  );

  // An interval window bounds the expansion (expand-recurrence.md step 4.5), so a rule that never
  // matches ends at the window instead of the work cap, and DTSTART (inside the window) is kept.
  it.each`
    case                              | text                                            | window
    ${"a daily rule, a short window"} | ${"FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"}         | ${{ start: "2024-01-01T00:00:00Z", end: "2024-03-01T00:00:00Z" }}
    ${"a SECONDLY rule to 2100"}      | ${"FREQ=SECONDLY;BYMONTH=2;BYMONTHDAY=30"}      | ${{ start: "2024-01-01T00:00:00Z", end: "2100-01-01T00:00:00Z" }}
    ${"a COUNT rule to 2100"}         | ${"FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30;COUNT=2"} | ${{ start: "2024-01-01T00:00:00Z", end: "2100-01-01T00:00:00Z" }}
  `(
    "a rule that never matches returns the DTSTART row over an interval holding it, $case",
    ({ text, window }) => {
      expect(
        expandRecurrence(rule(text), "2024-01-01T09:00:00", "UTC", window),
      ).toEqual([unique("2024-01-01T09:00:00", "2024-01-01T09:00:00Z")]);
    },
  );

  it("a rule that never matches returns [] over an interval that does not hold DTSTART", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"),
        "2024-01-01T09:00:00",
        "UTC",
        { start: "2024-01-02T00:00:00Z", end: "2024-03-01T00:00:00Z" },
      ),
    ).toEqual([]);
  });
});

describe("expandRecurrence, RDATE and EXDATE at a transition in America/New_York", () => {
  // RFC 5545 §3.8.5.1: the set is RRULE plus RDATE minus EXDATE, and EXDATE wins. An entry with Z or an
  // offset is an exact instant (§3.3.5 FORM #2); one without is a wall time in the zone (FORM #3),
  // and a local value names an instant. So a wall-time EXDATE is placed as a wall-time RDATE is,
  // by the call's policy, and removes every occurrence at the instant that gives. An instant EXDATE
  // removes the occurrence at that instant only.
  const repeated = (instant: string) => ({
    local: "2024-11-03T01:30:00",
    instant,
    classification: "ambiguous" as const,
    earlier: "2024-11-03T05:30:00Z",
    later: "2024-11-03T06:30:00Z",
  });
  const skipped = (instant: string) => ({
    local: "2024-03-10T02:30:00",
    instant,
    classification: "nonexistent" as const,
    earlier: "2024-03-10T06:30:00Z",
    later: "2024-03-10T07:30:00Z",
  });
  const novemberFirst = unique("2024-11-02T01:30:00", "2024-11-02T05:30:00Z");
  const novemberThird = unique("2024-11-04T01:30:00", "2024-11-04T06:30:00Z");
  const marchFirst = unique("2024-03-09T02:30:00", "2024-03-09T07:30:00Z");
  const marchThird = unique("2024-03-11T02:30:00", "2024-03-11T06:30:00Z");

  it.each`
    exdate                         | disambiguation  | expected
    ${"2024-11-03T01:30:00"}       | ${"compatible"} | ${[novemberFirst, novemberThird]}
    ${"2024-11-03T01:30:00"}       | ${"later"}      | ${[novemberFirst, novemberThird]}
    ${"2024-11-03T05:30:00Z"}      | ${"compatible"} | ${[novemberFirst, novemberThird]}
    ${"2024-11-03T01:30:00-04:00"} | ${"compatible"} | ${[novemberFirst, novemberThird]}
    ${"2024-11-03T06:30:00Z"}      | ${"compatible"} | ${[novemberFirst, repeated("2024-11-03T05:30:00Z"), novemberThird]}
    ${"2024-11-03T05:30:00Z"}      | ${"later"}      | ${[novemberFirst, repeated("2024-11-03T06:30:00Z"), novemberThird]}
    ${"2024-11-03T06:30:00Z"}      | ${"later"}      | ${[novemberFirst, novemberThird]}
    ${"2024-11-03T01:30:00-05:00"} | ${"later"}      | ${[novemberFirst, novemberThird]}
  `(
    "a repeated 01:30 with EXDATE $exdate under $disambiguation",
    ({ exdate, disambiguation, expected }) => {
      expect(
        expandRecurrence(
          rule("FREQ=DAILY;COUNT=3"),
          "2024-11-02T01:30:00",
          NY,
          WIDE,
          { exdate: [exdate], disambiguation },
        ),
      ).toEqual(expected);
    },
  );

  it.each`
    exdate                         | disambiguation  | expected
    ${"2024-03-10T02:30:00"}       | ${"compatible"} | ${[marchFirst, marchThird]}
    ${"2024-03-10T02:30:00"}       | ${"earlier"}    | ${[marchFirst, marchThird]}
    ${"2024-03-10T07:30:00Z"}      | ${"compatible"} | ${[marchFirst, marchThird]}
    ${"2024-03-10T06:30:00Z"}      | ${"compatible"} | ${[marchFirst, skipped("2024-03-10T07:30:00Z"), marchThird]}
    ${"2024-03-10T06:30:00Z"}      | ${"earlier"}    | ${[marchFirst, marchThird]}
    ${"2024-03-10T07:30:00Z"}      | ${"earlier"}    | ${[marchFirst, skipped("2024-03-10T06:30:00Z"), marchThird]}
    ${"2024-03-10T03:30:00-04:00"} | ${"compatible"} | ${[marchFirst, marchThird]}
  `(
    "a skipped 02:30 with EXDATE $exdate under $disambiguation",
    ({ exdate, disambiguation, expected }) => {
      expect(
        expandRecurrence(
          rule("FREQ=DAILY;COUNT=3"),
          "2024-03-09T02:30:00",
          NY,
          WIDE,
          { exdate: [exdate], disambiguation },
        ),
      ).toEqual(expected);
    },
  );

  // 02:00 is skipped and lands on 07:00Z (02:00 at -05:00), the same instant as 03:00 EDT, so each
  // of these three EXDATEs names 07:00Z and removes the 02:00 row.
  it.each`
    exdate                         | locals
    ${"2024-03-10T07:00:00Z"}      | ${["2024-03-10T00:00:00", "2024-03-10T01:00:00", "2024-03-10T04:00:00"]}
    ${"2024-03-10T02:00:00"}       | ${["2024-03-10T00:00:00", "2024-03-10T01:00:00", "2024-03-10T04:00:00"]}
    ${"2024-03-10T03:00:00"}       | ${["2024-03-10T00:00:00", "2024-03-10T01:00:00", "2024-03-10T04:00:00"]}
    ${"2024-03-10T03:00:00-04:00"} | ${["2024-03-10T00:00:00", "2024-03-10T01:00:00", "2024-03-10T04:00:00"]}
  `(
    "HOURLY through the skipped hour with EXDATE $exdate keeps $locals",
    ({ exdate, locals }) => {
      expect(
        expandRecurrence(
          rule("FREQ=HOURLY;COUNT=5"),
          "2024-03-10T00:00:00",
          NY,
          WIDE,
          { exdate: [exdate] },
        ).map((row) => row.local),
      ).toEqual(locals);
    },
  );

  it.each`
    case                                                                | options                                                                       | locals
    ${"a wall-time EXDATE keeps an instant RDATE at the other reading"} | ${{ rdate: ["2024-11-03T06:30:00Z"], exdate: ["2024-11-03T01:30:00"] }}       | ${["2024-11-01T09:00:00", "2024-11-03T01:30:00"]}
    ${"an instant EXDATE of the other reading keeps the RDATE"}         | ${{ rdate: ["2024-11-03T06:30:00Z"], exdate: ["2024-11-03T05:30:00Z"] }}      | ${["2024-11-01T09:00:00", "2024-11-03T01:30:00"]}
    ${"an instant EXDATE of the same instant removes the RDATE"}        | ${{ rdate: ["2024-11-03T06:30:00Z"], exdate: ["2024-11-03T01:30:00-05:00"] }} | ${["2024-11-01T09:00:00"]}
    ${"empty lists change nothing"}                                     | ${{ rdate: [], exdate: [] }}                                                  | ${["2024-11-01T09:00:00"]}
    ${"an EXDATE that matches nothing changes nothing"}                 | ${{ exdate: ["2024-11-02T09:00:00"] }}                                        | ${["2024-11-01T09:00:00"]}
  `("$case", ({ options, locals }) => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=1"),
        "2024-11-01T09:00:00",
        NY,
        WIDE,
        options,
      ).map((row) => row.local),
    ).toEqual(locals);
  });

  // An RDATE instant is exact; the policy only places wall times (RFC 5545 §3.3.5 FORM #2 vs #3).
  it.each`
    rdate                          | disambiguation  | instant
    ${"2024-11-03T06:30:00Z"}      | ${"compatible"} | ${"2024-11-03T06:30:00Z"}
    ${"2024-11-03T06:30:00Z"}      | ${"earlier"}    | ${"2024-11-03T06:30:00Z"}
    ${"2024-11-03T05:30:00Z"}      | ${"later"}      | ${"2024-11-03T05:30:00Z"}
    ${"2024-11-03T01:30:00-05:00"} | ${"earlier"}    | ${"2024-11-03T06:30:00Z"}
    ${"2024-11-03T01:30:00"}       | ${"compatible"} | ${"2024-11-03T05:30:00Z"}
    ${"2024-11-03T01:30:00"}       | ${"earlier"}    | ${"2024-11-03T05:30:00Z"}
    ${"2024-11-03T01:30:00"}       | ${"later"}      | ${"2024-11-03T06:30:00Z"}
  `(
    "RDATE $rdate under $disambiguation is at $instant",
    ({ rdate, disambiguation, instant }) => {
      expect(
        expandRecurrence(
          rule("FREQ=DAILY;COUNT=1"),
          "2024-11-01T09:00:00",
          NY,
          WIDE,
          { rdate: [rdate], disambiguation },
        ).map((row) => [row.local, row.instant]),
      ).toEqual([
        ["2024-11-01T09:00:00", "2024-11-01T13:00:00Z"],
        ["2024-11-03T01:30:00", instant],
      ]);
    },
  );

  it("an RDATE wall time in the gap is placed by the policy and keeps its marks", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=1"),
        "2024-03-08T09:00:00",
        NY,
        WIDE,
        { rdate: ["2024-03-10T02:30:00"], disambiguation: "earlier" },
      )[1],
    ).toEqual(skipped("2024-03-10T06:30:00Z"));
  });

  // The two readings of one skipped wall time and the wall time three-thirty after it are different
  // wall times; an RDATE at 03:30 EDT (07:30Z) is the same instant as the compatible 02:30 row and
  // collapses with it, first in local order.
  it("an RDATE equal in instant to a skipped row collapses into the earlier wall time", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=3"),
        "2024-03-09T02:30:00",
        NY,
        WIDE,
        { rdate: ["2024-03-10T03:30:00"] },
      ).map((row) => [row.local, row.instant]),
    ).toEqual([
      ["2024-03-09T02:30:00", "2024-03-09T07:30:00Z"],
      ["2024-03-10T02:30:00", "2024-03-10T07:30:00Z"],
      ["2024-03-11T02:30:00", "2024-03-11T06:30:00Z"],
    ]);
  });

  describe("reject", () => {
    // `"reject"` refuses a wall time that is skipped or repeated. An instant names its own instant, so
    // it resolves nothing and cannot be refused (RFC 5545 §3.3.5 FORM #2).
    const oneRow = [unique("2024-11-01T09:00:00", "2024-11-01T13:00:00Z")];

    it.each`
      option      | entry                    | why
      ${"rdate"}  | ${"2024-03-10T02:30:00"} | ${"a skipped wall time"}
      ${"rdate"}  | ${"2024-11-03T01:30:00"} | ${"a repeated wall time"}
      ${"exdate"} | ${"2024-03-10T02:30:00"} | ${"a skipped wall time"}
      ${"exdate"} | ${"2024-11-03T01:30:00"} | ${"a repeated wall time"}
    `(
      "an $option entry that is $why returns [], even when no row is at that time",
      ({ option, entry }) => {
        expect(
          expandRecurrence(
            rule("FREQ=DAILY;COUNT=1"),
            "2024-11-01T09:00:00",
            NY,
            WIDE,
            { disambiguation: "reject", [option]: [entry] },
          ),
        ).toEqual([]);
      },
    );

    it.each`
      option      | entry                          | expected
      ${"exdate"} | ${"2024-11-03T06:30:00Z"}      | ${oneRow}
      ${"exdate"} | ${"2024-11-03T01:30:00-05:00"} | ${oneRow}
      ${"exdate"} | ${"2024-11-03T09:00:00"}       | ${oneRow}
      ${"rdate"}  | ${"2024-11-04T09:00:00"}       | ${[...oneRow, unique("2024-11-04T09:00:00", "2024-11-04T14:00:00Z")]}
      ${"rdate"}  | ${"2024-11-04T14:00:00Z"}      | ${[...oneRow, unique("2024-11-04T09:00:00", "2024-11-04T14:00:00Z")]}
    `(
      "an $option entry $entry that is not a skipped or repeated wall time keeps the rows",
      ({ option, entry, expected }) => {
        expect(
          expandRecurrence(
            rule("FREQ=DAILY;COUNT=1"),
            "2024-11-01T09:00:00",
            NY,
            WIDE,
            { disambiguation: "reject", [option]: [entry] },
          ),
        ).toEqual(expected);
      },
    );

    // The task's open point: an instant never triggers "reject". The instant 06:30Z is the second
    // reading of 01:30 on 2024-11-03, so its row is marked "ambiguous", but nothing was guessed.
    it("an instant RDATE in a repeated hour returns its row marked ambiguous", () => {
      expect(
        expandRecurrence(
          rule("FREQ=DAILY;COUNT=1"),
          "2024-11-01T09:00:00",
          NY,
          WIDE,
          { disambiguation: "reject", rdate: ["2024-11-03T06:30:00Z"] },
        ),
      ).toEqual([...oneRow, repeated("2024-11-03T06:30:00Z")]);
    });
  });
});

describe("expandRecurrence, sub-second and malformed RDATE and EXDATE entries return []", () => {
  const daily = rule("FREQ=DAILY;COUNT=2");

  it.each`
    option      | entry
    ${"rdate"}  | ${"2024-01-02T09:00:00.5Z"}
    ${"rdate"}  | ${"2024-01-02T09:00:00.000000001Z"}
    ${"rdate"}  | ${"2024-01-02T10:00:00.5+01:00"}
    ${"rdate"}  | ${"2024-01-02T09:00:00.5"}
    ${"exdate"} | ${"2024-01-02T09:00:00.5Z"}
    ${"exdate"} | ${"2024-01-02T09:00:00.000000001Z"}
    ${"exdate"} | ${"2024-01-02T10:00:00.5+01:00"}
    ${"exdate"} | ${"2024-01-02T09:00:00.5"}
    ${"rdate"}  | ${5}
    ${"exdate"} | ${null}
    ${"rdate"}  | ${""}
    ${"exdate"} | ${"2024-02-30T09:00:00"}
    ${"rdate"}  | ${"2024-01-02T09:00:00Z/2024-01-02T10:00:00Z"}
    ${"exdate"} | ${"20240102T090000Z"}
  `("$option entry $entry", ({ option, entry }) => {
    expect(
      expandRecurrence(daily, "2024-01-01T09:00:00", "UTC", WIDE, {
        [option]: [entry],
      } as never),
    ).toEqual([]);
  });

  it("one bad entry among good ones returns [] for the whole call", () => {
    expect(
      expandRecurrence(daily, "2024-01-01T09:00:00", "UTC", WIDE, {
        rdate: ["2024-01-05T09:00:00", "2024-01-06T09:00:00.5Z"],
      }),
    ).toEqual([]);
  });
});

describe("expandRecurrence, RDATE in a window", () => {
  const daily = rule("FREQ=DAILY;COUNT=1");
  const start = "2024-01-01T09:00:00";
  const at = (local: string) => unique(local, `${local}Z`);

  // Half-open window (coding-standards § 8): start in, end out; `after` out.
  it.each`
    window                                                            | rdate                     | locals
    ${{ start: "2024-01-05T12:00:00Z", end: "2024-01-06T00:00:00Z" }} | ${"2024-01-05T12:00:00Z"} | ${["2024-01-05T12:00:00"]}
    ${{ start: "2024-01-05T00:00:00Z", end: "2024-01-05T12:00:00Z" }} | ${"2024-01-05T12:00:00Z"} | ${[]}
    ${{ after: "2024-01-05T12:00:00Z", count: 2 }}                    | ${"2024-01-05T12:00:00Z"} | ${[]}
    ${{ after: "2024-01-05T11:59:59Z", count: 2 }}                    | ${"2024-01-05T12:00:00Z"} | ${["2024-01-05T12:00:00"]}
    ${{ after: "2023-12-31T00:00:00Z", count: 1 }}                    | ${"2024-01-05T12:00:00Z"} | ${["2024-01-01T09:00:00"]}
    ${{ after: "2023-12-31T00:00:00Z", count: 2 }}                    | ${"2023-12-31T12:00:00Z"} | ${["2023-12-31T12:00:00", "2024-01-01T09:00:00"]}
  `("$window with RDATE $rdate gives $locals", ({ window, rdate, locals }) => {
    expect(
      expandRecurrence(daily, start, "UTC", window, { rdate: [rdate] }).map(
        (row) => row.local,
      ),
    ).toEqual(locals);
  });

  it("an RDATE before DTSTART is kept, and rows come out in instant order", () => {
    expect(
      expandRecurrence(daily, start, "UTC", WIDE, {
        rdate: ["2024-01-09T00:00:00", "2023-06-01T00:00:00Z"],
      }),
    ).toEqual([
      at("2023-06-01T00:00:00"),
      at("2024-01-01T09:00:00"),
      at("2024-01-09T00:00:00"),
    ]);
  });

  it("duplicate RDATE entries count once", () => {
    expect(
      expandRecurrence(daily, start, "UTC", WIDE, {
        rdate: [
          "2024-01-05T12:00:00",
          "2024-01-05T12:00:00Z",
          "2024-01-05T13:00:00+01:00",
        ],
      }),
    ).toEqual([at("2024-01-01T09:00:00"), at("2024-01-05T12:00:00")]);
  });

  it("an instant RDATE in an offset keeps its instant and reads its wall time in the zone", () => {
    // 2024-07-01T12:00+02:00 is 10:00Z, which is 06:00 EDT.
    expect(
      expandRecurrence(daily, "2024-06-30T09:00:00", NY, WIDE, {
        rdate: ["2024-07-01T12:00:00+02:00"],
      }),
    ).toEqual([
      unique("2024-06-30T09:00:00", "2024-06-30T13:00:00Z"),
      unique("2024-07-01T06:00:00", "2024-07-01T10:00:00Z"),
    ]);
  });

  it("a count window takes the first rows of the generated rows and RDATE together", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY"),
        start,
        "UTC",
        { after: "2024-01-01T09:00:00Z", count: 2 },
        { rdate: ["2024-01-02T12:00:00"] },
      ).map((row) => row.local),
    ).toEqual(["2024-01-02T09:00:00", "2024-01-02T12:00:00"]);
  });

  it("EXDATE removes a generated row without ending the expansion, and a count window reaches past it", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY"),
        start,
        "UTC",
        { after: "2024-01-01T09:00:00Z", count: 2 },
        { exdate: ["2024-01-02T09:00:00"] },
      ).map((row) => row.local),
    ).toEqual(["2024-01-03T09:00:00", "2024-01-04T09:00:00"]);
  });

  it("EXDATE does not give back a COUNT row: COUNT is taken before EXDATE", () => {
    expect(
      expandRecurrence(rule("FREQ=DAILY;COUNT=3"), start, "UTC", WIDE, {
        exdate: ["2024-01-02T09:00:00"],
      }).map((row) => row.local),
    ).toEqual(["2024-01-01T09:00:00", "2024-01-03T09:00:00"]);
  });
});

describe("expandRecurrence, more invalid input returns []", () => {
  const daily = parseRecurrenceRule("FREQ=DAILY")!;
  const ok = "2024-01-01T09:00:00";
  const window = { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" };

  it.each`
    case                              | rule         | start                          | zone         | window                                                  | options
    ${"an undefined rule"}            | ${undefined} | ${ok}                          | ${"UTC"}     | ${window}                                               | ${undefined}
    ${"an empty rule"}                | ${{}}        | ${ok}                          | ${"UTC"}     | ${window}                                               | ${undefined}
    ${"an undefined start"}           | ${daily}     | ${undefined}                   | ${"UTC"}     | ${window}                                               | ${undefined}
    ${"a numeric start"}              | ${daily}     | ${5}                           | ${"UTC"}     | ${window}                                               | ${undefined}
    ${"a date-only start"}            | ${daily}     | ${"2024-01-01"}                | ${"UTC"}     | ${window}                                               | ${undefined}
    ${"a start with an offset"}       | ${daily}     | ${"2024-01-01T09:00:00+01:00"} | ${"UTC"}     | ${window}                                               | ${undefined}
    ${"hour 24"}                      | ${daily}     | ${"2024-01-01T24:00:00"}       | ${"UTC"}     | ${window}                                               | ${undefined}
    ${"a leap second"}                | ${daily}     | ${"2024-01-01T23:59:60"}       | ${"UTC"}     | ${window}                                               | ${undefined}
    ${"an undefined zone"}            | ${daily}     | ${ok}                          | ${undefined} | ${window}                                               | ${undefined}
    ${"an empty zone"}                | ${daily}     | ${ok}                          | ${""}        | ${window}                                               | ${undefined}
    ${"a numeric zone"}               | ${daily}     | ${ok}                          | ${5}         | ${window}                                               | ${undefined}
    ${"an undefined window"}          | ${daily}     | ${ok}                          | ${"UTC"}     | ${undefined}                                            | ${undefined}
    ${"an empty window"}              | ${daily}     | ${ok}                          | ${"UTC"}     | ${{}}                                                   | ${undefined}
    ${"an interval with only start"}  | ${daily}     | ${ok}                          | ${"UTC"}     | ${{ start: "2024-01-01T00:00:00Z" }}                    | ${undefined}
    ${"an interval with a bad end"}   | ${daily}     | ${ok}                          | ${"UTC"}     | ${{ start: "2024-01-01T00:00:00Z", end: "tomorrow" }}   | ${undefined}
    ${"a count that is a string"}     | ${daily}     | ${ok}                          | ${"UTC"}     | ${{ after: "2024-01-01T00:00:00Z", count: "2" }}        | ${undefined}
    ${"a count of NaN"}               | ${daily}     | ${ok}                          | ${"UTC"}     | ${{ after: "2024-01-01T00:00:00Z", count: Number.NaN }} | ${undefined}
    ${"a negative count"}             | ${daily}     | ${ok}                          | ${"UTC"}     | ${{ after: "2024-01-01T00:00:00Z", count: -1 }}         | ${undefined}
    ${"an after without a count"}     | ${daily}     | ${ok}                          | ${"UTC"}     | ${{ after: "2024-01-01T00:00:00Z" }}                    | ${undefined}
    ${"an after that is a wall time"} | ${daily}     | ${ok}                          | ${"UTC"}     | ${{ after: "2024-01-01T00:00:00", count: 1 }}           | ${undefined}
    ${"options that is a string"}     | ${daily}     | ${ok}                          | ${"UTC"}     | ${window}                                               | ${"reject"}
    ${"a capitalised disambiguation"} | ${daily}     | ${ok}                          | ${"UTC"}     | ${window}                                               | ${{ disambiguation: "Earlier" }}
    ${"an exdate that is a string"}   | ${daily}     | ${ok}                          | ${"UTC"}     | ${window}                                               | ${{ exdate: "2024-01-02T09:00:00" }}
  `("$case", ({ rule: r, start, zone, window: w, options }) => {
    expect(expandRecurrence(r, start, zone, w, options)).toEqual([]);
  });

  it("a start in a skipped hour is accepted and DTSTART is placed by the policy", () => {
    // Not invalid: RFC 5545 §3.3.5 (Erratum 4271) resolves a nonexistent DTSTART like any other time.
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=1"),
        "2024-03-10T02:30:00",
        NY,
        WIDE,
      ),
    ).toEqual([
      {
        local: "2024-03-10T02:30:00",
        instant: "2024-03-10T07:30:00Z",
        classification: "nonexistent",
        earlier: "2024-03-10T06:30:00Z",
        later: "2024-03-10T07:30:00Z",
      },
    ]);
  });

  it("the same call twice gives equal results (the rule and options are not changed)", () => {
    const options = {
      rdate: ["2024-01-05T12:00:00"],
      exdate: ["2024-01-02T09:00:00"],
    };
    const frozen = Object.freeze({ ...daily, byHour: Object.freeze([9]) });
    const first = expandRecurrence(frozen, ok, "UTC", window, options);

    expect(expandRecurrence(frozen, ok, "UTC", window, options)).toEqual(first);
    expect(options).toEqual({
      rdate: ["2024-01-05T12:00:00"],
      exdate: ["2024-01-02T09:00:00"],
    });
  });
});

describe("expandRecurrence, rows past Temporal's range are dropped, not an error", () => {
  // Temporal holds instants up to +275760-09-13T00:00:00Z inclusive (TC39 IsValidEpochNanoseconds).
  // FREQ=DAILY from 09-08 at 12:00 has rows on 09-08 to 09-12; 09-13 at 12:00 is 12 h past the limit.
  const daily = rule("FREQ=DAILY");
  const top = (hour: string) =>
    [8, 9, 10, 11, 12].map((day) =>
      unique(
        `+275760-09-${String(day).padStart(2, "0")}T12:00:00`,
        `+275760-09-${String(day).padStart(2, "0")}T${hour}:00:00Z`,
      ),
    );
  const after = "+275760-09-08T00:00:00Z";

  it.each`
    zone     | count | hour
    ${"UTC"} | ${5}  | ${"12"}
    ${"UTC"} | ${6}  | ${"12"}
    ${"UTC"} | ${10} | ${"12"}
    ${NY}    | ${5}  | ${"16"}
    ${NY}    | ${6}  | ${"16"}
  `(
    "count $count in $zone from +275760-09-08T12:00:00 gives the 5 rows below the limit at $hour:00Z",
    ({ zone, count, hour }) => {
      expect(
        expandRecurrence(daily, "+275760-09-08T12:00:00", zone, {
          after,
          count,
        }),
      ).toEqual(top(hour));
    },
  );

  it("an RDATE past the limit is dropped", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=2"),
        "+275760-09-08T12:00:00",
        "UTC",
        { after, count: 5 },
        { rdate: ["+275760-09-13T12:00:00"] },
      ),
    ).toEqual(top("12").slice(0, 2));
  });

  it("an RDATE past the limit is dropped in a named zone", () => {
    expect(
      expandRecurrence(
        rule("FREQ=DAILY;COUNT=2"),
        "+275760-09-08T12:00:00",
        NY,
        { after, count: 5 },
        { rdate: ["+275760-09-13T12:00:00"] },
      ),
    ).toEqual(top("16").slice(0, 2));
  });

  it("the limit itself is inclusive", () => {
    const rows = expandRecurrence(daily, "+275760-09-08T00:00:00", "UTC", {
      after: "+275760-09-07T12:00:00Z",
      count: 7,
    });

    expect(rows.map((row) => row.instant)).toEqual([
      "+275760-09-08T00:00:00Z",
      "+275760-09-09T00:00:00Z",
      "+275760-09-10T00:00:00Z",
      "+275760-09-11T00:00:00Z",
      "+275760-09-12T00:00:00Z",
      "+275760-09-13T00:00:00Z",
    ]);
  });

  it("the bottom edge: -10:00 hourly from -271821-04-19T12:00:00 gives 00:00Z to 05:00Z on 04-20", () => {
    const rows = expandRecurrence(
      rule("FREQ=HOURLY"),
      "-271821-04-19T12:00:00",
      "-10:00",
      {
        start: "-271821-04-20T00:00:00Z",
        end: "-271821-04-20T06:00:00Z",
      },
    );

    expect(rows.map((row) => row.instant)).toEqual(
      [0, 1, 2, 3, 4, 5].map((hour) => `-271821-04-20T0${hour}:00:00Z`),
    );
  });
});

describe("expandRecurrence, a wall-time EXDATE names the instant its wall time takes", () => {
  it.each`
    exdate                         | locals
    ${"2024-03-10T03:00:00"}       | ${["2024-03-10T00:00:00", "2024-03-10T01:00:00", "2024-03-10T04:00:00"]}
    ${"2024-03-10T02:00:00"}       | ${["2024-03-10T00:00:00", "2024-03-10T01:00:00", "2024-03-10T04:00:00"]}
    ${"2024-03-10T03:00:00-04:00"} | ${["2024-03-10T00:00:00", "2024-03-10T01:00:00", "2024-03-10T04:00:00"]}
  `(
    "HOURLY COUNT=5 with EXDATE $exdate keeps $locals",
    ({ exdate, locals }) => {
      expect(
        expandRecurrence(
          rule("FREQ=HOURLY;COUNT=5"),
          "2024-03-10T00:00:00",
          NY,
          WIDE,
          { exdate: [exdate] },
        ).map((row) => row.local),
      ).toEqual(locals);
    },
  );
});

describe("expandRecurrence, reject also refuses a DTSTART that is skipped or repeated", () => {
  // The window holds only unique rows (06:30Z and 07:30Z on 12-01 and 12-02 are EST).
  const december = {
    start: "2024-12-01T00:00:00Z",
    end: "2024-12-03T00:00:00Z",
  };

  it.each`
    start                    | instants
    ${"2024-11-03T01:30:00"} | ${["2024-12-01T06:30:00Z", "2024-12-02T06:30:00Z"]}
    ${"2024-03-10T02:30:00"} | ${["2024-12-01T07:30:00Z", "2024-12-02T07:30:00Z"]}
  `(
    "start $start: reject gives [], compatible gives $instants",
    ({ start, instants }) => {
      expect(
        expandRecurrence(rule("FREQ=DAILY"), start, NY, december, {
          disambiguation: "reject",
        }),
      ).toEqual([]);
      expect(
        expandRecurrence(rule("FREQ=DAILY"), start, NY, december, {
          disambiguation: "compatible",
        }).map((row) => row.instant),
      ).toEqual(instants);
    },
  );
});

describe("expandRecurrence, a count window keeps DTSTART when no later occurrence exists", () => {
  // RFC 5545 §3.8.5.3: DTSTART is the first occurrence. The window form already returns it.
  it.each`
    rule                                             | start                    | instant
    ${"FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"}          | ${"2024-01-01T09:00:00"} | ${"2024-01-01T09:00:00Z"}
    ${"FREQ=YEARLY;COUNT=1;BYMONTH=4;BYMONTHDAY=31"} | ${"2024-01-01T09:00:00"} | ${"2024-01-01T09:00:00Z"}
    ${"FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=31"}         | ${"2024-01-01T09:00:00"} | ${"2024-01-01T09:00:00Z"}
    ${"FREQ=SECONDLY;BYMONTH=2;BYMONTHDAY=30"}       | ${"2024-01-01T09:00:00"} | ${"2024-01-01T09:00:00Z"}
    ${"FREQ=SECONDLY;COUNT=1"}                       | ${"2024-01-01T09:00:00"} | ${"2024-01-01T09:00:00Z"}
  `(
    "$rule from $start with count 1 gives $instant",
    ({ rule: text, start, instant }) => {
      expect(
        expandRecurrence(rule(text), start, "UTC", {
          after: "2024-01-01T00:00:00Z",
          count: 1,
        }).map((row) => row.instant),
      ).toEqual([instant]);
    },
  );

  // A rule with fewer than `count` occurrences returns the ones it has, as `FREQ=DAILY;COUNT=2`
  // does with a count of 5. These rules have none after DTSTART, so DTSTART alone comes back.
  it.each`
    rule                                       | start                    | after
    ${"FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30"}   | ${"2024-01-01T09:00:00"} | ${"2024-01-01T00:00:00Z"}
    ${"FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"}    | ${"2024-01-01T09:00:00"} | ${"2024-01-01T00:00:00Z"}
    ${"FREQ=SECONDLY;BYMONTH=2;BYMONTHDAY=30"} | ${"2024-01-01T09:00:00"} | ${"2024-01-01T00:00:00Z"}
    ${"FREQ=DAILY;INTERVAL=7;BYDAY=MO"}        | ${"2024-01-02T09:00:00"} | ${"2024-01-01T00:00:00Z"}
  `(
    "$rule from $start never matches after DTSTART, so a count of 5 gives DTSTART alone",
    ({ rule: text, start, after }) => {
      expect(
        expandRecurrence(rule(text), start, "UTC", { after, count: 5 }).map(
          (row) => row.local,
        ),
      ).toEqual([start]);
    },
  );
});

describe("expandRecurrence, a bracketed annotation on DTSTART, RDATE or EXDATE returns []", () => {
  const daily = rule("FREQ=DAILY;COUNT=1");
  const window = { start: "2024-06-01T00:00:00Z", end: "2024-07-01T00:00:00Z" };

  it.each`
    option      | entry
    ${"rdate"}  | ${"2024-06-05T12:00:00[Europe/Paris]"}
    ${"rdate"}  | ${"2024-06-05T12:00:00[!Europe/Paris]"}
    ${"rdate"}  | ${"2024-06-05T12:00:00[u-ca=hebrew]"}
    ${"rdate"}  | ${"2024-06-05T12:00:00[foo=bar]"}
    ${"rdate"}  | ${"2024-06-05T12:00:00+02:00[America/New_York]"}
    ${"rdate"}  | ${"2024-06-05T12:00:00Z[UTC]"}
    ${"exdate"} | ${"2024-06-05T12:00:00[Europe/Paris]"}
    ${"exdate"} | ${"2024-06-05T12:00:00[!Europe/Paris]"}
    ${"exdate"} | ${"2024-06-05T12:00:00[u-ca=hebrew]"}
    ${"exdate"} | ${"2024-06-05T12:00:00[foo=bar]"}
    ${"exdate"} | ${"2024-06-05T12:00:00+02:00[America/New_York]"}
  `("$option entry $entry", ({ option, entry }) => {
    expect(
      expandRecurrence(daily, "2024-06-01T12:00:00", NY, window, {
        [option]: [entry],
      }),
    ).toEqual([]);
  });

  it.each`
    start
    ${"2024-06-01T12:00:00[Europe/Paris]"}
    ${"2024-06-01T12:00:00[u-ca=hebrew]"}
    ${"2024-06-01T12:00:00[foo=bar]"}
  `("start $start", ({ start }) => {
    expect(expandRecurrence(daily, start, NY, window)).toEqual([]);
  });
});

describe("expandRecurrence, a sparse rule finds every occurrence inside a count of 1 to 10,000", () => {
  /** Row `n` of a rule on Feb 29 from 2024, by counting leap years one at a time. */
  function nthLeapDay(n: number): string {
    let found = 0;

    for (let year = 2024; ; year++) {
      if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
        found++;
      }
      if (found === n) {
        return `${Temporal.PlainDate.from({ year, month: 2, day: 29 }).toString()}T00:00:00`;
      }
    }
  }

  // FREQ=YEARLY from 2024-02-28 has one row a year, so row 6000 is in 2024 + 5999 = 8023.
  it.each`
    rule                                     | start                    | count     | last
    ${"FREQ=YEARLY"}                         | ${"2024-02-28T00:00:00"} | ${6000}   | ${"8023-02-28T00:00:00"}
    ${"FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29"} | ${"2024-02-29T00:00:00"} | ${1400}   | ${nthLeapDay(1400)}
    ${"FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29"} | ${"2024-02-29T00:00:00"} | ${10_000} | ${nthLeapDay(10_000)}
  `(
    "$rule from $start with count $count gives $count rows ending on $last",
    ({ rule: text, start, count, last }) => {
      const rows = expandRecurrence(rule(text), start, "UTC", {
        after: "2024-01-01T00:00:00Z",
        count,
      });

      expect({ length: rows.length, last: rows.at(-1)?.local }).toEqual({
        length: count,
        last,
      });
    },
  );
});

describe("expandRecurrence, a count window finds every occurrence of a rule that matches a few days a year or fewer", () => {
  const isLeapYear = (year: number): boolean =>
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  /** Sunday is 0. Sakamoto's method: plain arithmetic on the calendar, never the code under test. */
  const weekdayOf = (year: number, month: number, day: number): number => {
    const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    const y = month < 3 ? year - 1 : year;

    return (
      (y +
        Math.floor(y / 4) -
        Math.floor(y / 100) +
        Math.floor(y / 400) +
        offsets[month - 1] +
        day) %
      7
    );
  };
  const dateText = (date: Temporal.PlainDate): string =>
    `${date.toString()}T00:00:00`;

  /** The year of the `n`th year from `from` on that passes `matches`. */
  function nthYear(
    from: number,
    n: number,
    matches: (year: number) => boolean,
  ): number {
    let found = 0;

    for (let year = from; ; year++) {
      if (matches(year) && ++found === n) {
        return year;
      }
    }
  }

  /** The `n`th month from `year`-`month` on whose 13th is a Friday. */
  function nthFridayThe13th(year: number, month: number, n: number): string {
    let found = 0;

    for (;;) {
      if (weekdayOf(year, month, 13) === 5 && ++found === n) {
        return dateText(Temporal.PlainDate.from({ year, month, day: 13 }));
      }
      month++;
      if (month === 13) {
        month = 1;
        year++;
      }
    }
  }

  /** ISO 8601: 53 weeks when January 1 is a Thursday, or a Wednesday in a leap year. */
  const hasWeek53 = (year: number): boolean =>
    weekdayOf(year, 1, 1) === 4 ||
    (isLeapYear(year) && weekdayOf(year, 1, 1) === 3);

  function nth20thMonday(year: number): string {
    let date = Temporal.PlainDate.from({ year, month: 1, day: 1 });
    let mondays = 0;

    while (date.dayOfWeek !== 1 || ++mondays < 20) {
      date = date.add({ days: 1 });
    }

    return dateText(date);
  }

  function weekTenMonday(year: number): string {
    const jan4 = Temporal.PlainDate.from({ year, month: 1, day: 4 });
    const monday = jan4
      .subtract({ days: jan4.dayOfWeek - 1 })
      .add({ weeks: 9 });

    expect([monday.weekOfYear, monday.yearOfWeek]).toEqual([10, year]);

    return dateText(monday);
  }

  function week53Thursday(year: number): string {
    const dec28 = Temporal.PlainDate.from({ year, month: 12, day: 28 });
    const thursday = dec28.add({ days: 4 - dec28.dayOfWeek });

    expect([thursday.weekOfYear, thursday.yearOfWeek]).toEqual([53, year]);

    return dateText(thursday);
  }

  /** ISO instants compare as text only within four-digit years; compare the year first. */
  function instantKey(instant: string): [number, string] {
    const [, year, rest] = /^([+-]\d{6}|\d{4})(-.*)$/.exec(instant) ?? [];

    return [Number(year), rest];
  }

  function isAscending(rows: readonly RecurrenceOccurrence[]): boolean {
    return rows.every((row, i) => {
      if (i === 0) return true;
      const [yearA, restA] = instantKey(rows[i - 1].instant);
      const [yearB, restB] = instantKey(row.instant);

      return yearA < yearB || (yearA === yearB && restA < restB);
    });
  }

  // Row n is the nth match from DTSTART, which matches the rule. Every last date is found by
  // counting years or months on the calendar.
  // 2024-04-09 is day 100 of leap 2024; 2024-05-13 is its 20th Monday; 2024-03-04 is Monday of week 10;
  // 2024-12-31 is day 366; 2020-12-31 is the Thursday of week 53; 2024-09-13 is a Friday the 13th.
  it.each`
    rule                                              | start                    | last
    ${"FREQ=YEARLY;BYYEARDAY=100"}                    | ${"2024-04-09T00:00:00"} | ${(n: number) => dateText(Temporal.PlainDate.from({ year: 2024 + n - 1, month: 1, day: 1 }).add({ days: 99 }))}
    ${"FREQ=YEARLY;BYDAY=20MO"}                       | ${"2024-05-13T00:00:00"} | ${(n: number) => nth20thMonday(2024 + n - 1)}
    ${"FREQ=YEARLY;BYWEEKNO=10;BYDAY=MO"}             | ${"2024-03-04T00:00:00"} | ${(n: number) => weekTenMonday(2024 + n - 1)}
    ${"FREQ=YEARLY;BYYEARDAY=366"}                    | ${"2024-12-31T00:00:00"} | ${(n: number) => dateText(Temporal.PlainDate.from({ year: nthYear(2024, n, isLeapYear), month: 12, day: 31 }))}
    ${"FREQ=YEARLY;BYWEEKNO=53;BYDAY=TH"}             | ${"2020-12-31T00:00:00"} | ${(n: number) => week53Thursday(nthYear(2020, n, hasWeek53))}
    ${"FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13"}          | ${"2024-09-13T00:00:00"} | ${(n: number) => nthFridayThe13th(2024, 9, n)}
    ${"FREQ=DAILY;BYMONTH=2;BYMONTHDAY=29"}           | ${"2024-02-29T00:00:00"} | ${(n: number) => dateText(Temporal.PlainDate.from({ year: nthYear(2024, n, isLeapYear), month: 2, day: 29 }))}
    ${"FREQ=DAILY;BYDAY=FR;BYMONTHDAY=13"}            | ${"2024-09-13T00:00:00"} | ${(n: number) => nthFridayThe13th(2024, 9, n)}
    ${"FREQ=HOURLY;BYMONTH=2;BYMONTHDAY=29;BYHOUR=0"} | ${"2024-02-29T00:00:00"} | ${(n: number) => dateText(Temporal.PlainDate.from({ year: nthYear(2024, n, isLeapYear), month: 2, day: 29 }))}
  `(
    "$rule from $start gives a full window at counts 6000 and 10000",
    ({ rule: text, start, last }) => {
      for (const count of [6000, 10_000]) {
        const rows = expandRecurrence(rule(text), start, "UTC", {
          after: "2020-01-01T00:00:00Z",
          count,
        });

        expect({
          length: rows.length,
          ascending: isAscending(rows),
          last: rows.at(-1)?.local,
        }).toEqual({ length: count, ascending: true, last: last(count) });
      }
    },
  );
});
