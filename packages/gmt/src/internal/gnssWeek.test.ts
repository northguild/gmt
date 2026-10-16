import { Temporal } from "@js-temporal/polyfill";
import {
  GNSS_WEEK_COUNTERS,
  isGnssWeekCounter,
  labelOfWeek,
  resolveRolloverEra,
  timeOfWeekNanoseconds,
  weekNumber,
  weekOfLabel,
  weeksSince,
} from "./gnssWeek";

function labelNs(label: string): bigint {
  return Temporal.PlainDateTime.from(label).toZonedDateTime("UTC")
    .epochNanoseconds;
}

describe("GNSS_WEEK_COUNTERS", () => {
  // Each counter's width, from the message that broadcasts it.
  it.each`
    counter       | system   | modulus  | source
    ${"GPS-LNAV"} | ${"GPS"} | ${1024n} | ${"IS-GPS-200N §20.3.3.3.1.1: modulo 1024"}
    ${"GPS-CNAV"} | ${"GPS"} | ${8192n} | ${"IS-GPS-200N §30.3.3.1.1.1: modulo-8192"}
    ${"GAL"}      | ${"GAL"} | ${4096n} | ${"Galileo OS SIS ICD Issue 2.2 Table 69: 12 bits, 4096 weeks"}
    ${"BDT"}      | ${"BDT"} | ${8192n} | ${"BDS-SIS-ICD-B1I-3.0 §5.2.4.4: 13 bits, 0 through 8191"}
    ${"QZS-LNAV"} | ${"QZS"} | ${1024n} | ${"IS-QZSS-PNT-006 §4.1.2.3(1): modulo 1024"}
    ${"QZS-CNAV"} | ${"QZS"} | ${8192n} | ${"IS-QZSS-PNT-006 §4.2.2: modulo 8192"}
    ${"IRN-LNAV"} | ${"IRN"} | ${1024n} | ${"ISRO-IRNSS-ICD-SPS-1.1 §5.7: 10 bits, 1024 weeks"}
    ${"IRN-L1NV"} | ${"IRN"} | ${8192n} | ${"ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6: 13 bits, 8192 weeks"}
  `(
    "counts $counter on the $system scale modulo $modulus ($source)",
    ({ counter, system, modulus }) => {
      expect(
        GNSS_WEEK_COUNTERS[counter as keyof typeof GNSS_WEEK_COUNTERS],
      ).toEqual({ system, modulus });
    },
  );

  it("has no GLONASS counter: GLONASS broadcasts no week number", () => {
    expect(Object.keys(GNSS_WEEK_COUNTERS)).not.toContain("GLO");
    expect(Object.keys(GNSS_WEEK_COUNTERS)).toHaveLength(8);
  });
});

describe("isGnssWeekCounter", () => {
  it.each`
    value
    ${"GPS-LNAV"}
    ${"GPS-CNAV"}
    ${"GAL"}
    ${"BDT"}
    ${"QZS-LNAV"}
    ${"QZS-CNAV"}
    ${"IRN-LNAV"}
    ${"IRN-L1NV"}
  `("accepts the counter $value", ({ value }) => {
    expect(isGnssWeekCounter(value)).toBe(true);
  });

  it.each`
    value         | why
    ${"GPS"}      | ${"a system, not a counter: GPS has two"}
    ${"QZS"}      | ${"a system, not a counter: QZSS has two"}
    ${"IRN"}      | ${"a system, not a counter: NavIC has two"}
    ${"GLO"}      | ${"GLONASS has no week counter"}
    ${"BDS"}      | ${"the constellation name"}
    ${"LNAV"}     | ${"a message without its system"}
    ${"gps-lnav"} | ${"lower case"}
    ${"toString"} | ${"an inherited property name"}
    ${null}       | ${"null"}
  `("rejects $value ($why)", ({ value }) => {
    expect(isGnssWeekCounter(value)).toBe(false);
  });
});

describe("weekNumber", () => {
  it.each`
    week                       | expected
    ${0}                       | ${0n}
    ${-0}                      | ${0n}
    ${1023}                    | ${1023n}
    ${Number.MAX_SAFE_INTEGER} | ${9007199254740991n}
  `("reads $week as $expected", ({ week, expected }) => {
    expect(weekNumber(week)).toBe(expected);
  });

  it.each`
    week                           | why
    ${-1}                          | ${"negative"}
    ${1.5}                         | ${"not an integer"}
    ${Number.NaN}                  | ${"NaN"}
    ${Number.POSITIVE_INFINITY}    | ${"Infinity"}
    ${Number.MAX_SAFE_INTEGER + 1} | ${"not a safe integer"}
    ${"1"}                         | ${"a numeric string"}
    ${1n}                          | ${"a bigint"}
    ${null}                        | ${"null"}
  `("returns null for $week ($why)", ({ week }) => {
    expect(weekNumber(week)).toBeNull();
  });
});

describe("timeOfWeekNanoseconds", () => {
  // GMT rule: seconds of week, rounded to Temporal's 1 ns resolution.
  it.each`
    seconds             | expected
    ${0}                | ${0n}
    ${-0}               | ${0n}
    ${0.1}              | ${100_000_000n}
    ${17.5}             | ${17_500_000_000n}
    ${86418.123456789}  | ${86_418_123_456_789n}
    ${604799}           | ${604_799_000_000_000n}
    ${604799.999999999} | ${604_799_999_999_999n}
  `("reads $seconds s as $expected ns", ({ seconds, expected }) => {
    expect(timeOfWeekNanoseconds(seconds)).toBe(expected);
  });

  it.each`
    seconds                     | why
    ${604800}                   | ${"a whole week"}
    ${604799.9999999999}        | ${"rounds to a whole week"}
    ${-0.5}                     | ${"negative"}
    ${Number.NaN}               | ${"NaN"}
    ${Number.POSITIVE_INFINITY} | ${"Infinity"}
    ${"0"}                      | ${"a numeric string"}
    ${null}                     | ${"null"}
  `("returns null for $seconds ($why)", ({ seconds }) => {
    expect(timeOfWeekNanoseconds(seconds)).toBeNull();
  });
});

describe("weeksSince and labelOfWeek", () => {
  it.each`
    label                              | fullWeek | timeOfWeekSeconds
    ${"1980-01-06T00:00:00"}           | ${0n}    | ${0}
    ${"1980-01-12T23:59:59.999999999"} | ${0n}    | ${604799.999999999}
    ${"1980-01-13T00:00:00"}           | ${1n}    | ${0}
    ${"2024-01-01T00:00:18"}           | ${2295n} | ${86418}
    ${"2024-01-01T00:00:18.123456789"} | ${2295n} | ${86418.123456789}
  `(
    "splits GPS label $label into full week $fullWeek and $timeOfWeekSeconds s",
    ({ label, fullWeek, timeOfWeekSeconds }) => {
      expect(
        weeksSince(labelNs("1980-01-06T00:00:00"), labelNs(label)),
      ).toEqual({ fullWeek, timeOfWeekSeconds });
    },
  );

  it("returns null for a label before the epoch", () => {
    expect(
      weeksSince(
        labelNs("1980-01-06T00:00:00"),
        labelNs("1980-01-05T23:59:59.999999999"),
      ),
    ).toBeNull();
  });

  // label = epoch + (era × modulus + week) × 604 800 s + time of week.
  it.each`
    counter       | week     | timeOfWeek             | era   | label
    ${"GPS-LNAV"} | ${247n}  | ${86_418_000_000_000n} | ${2n} | ${"2024-01-01T00:00:18"}
    ${"GPS-CNAV"} | ${2295n} | ${86_418_000_000_000n} | ${0n} | ${"2024-01-01T00:00:18"}
    ${"GAL"}      | ${1271n} | ${86_418_000_000_000n} | ${0n} | ${"2024-01-01T00:00:18"}
    ${"BDT"}      | ${939n}  | ${86_404_000_000_000n} | ${0n} | ${"2024-01-01T00:00:04"}
    ${"IRN-LNAV"} | ${247n}  | ${86_418_000_000_000n} | ${1n} | ${"2024-01-01T00:00:18"}
    ${"GPS-LNAV"} | ${0n}    | ${0n}                  | ${3n} | ${"2038-11-21T00:00:00"}
  `(
    "places $counter week $week, $timeOfWeek ns, era $era at label $label",
    ({ counter, week, timeOfWeek, era, label }) => {
      expect(labelOfWeek(counter, week, timeOfWeek, era)).toBe(labelNs(label));
    },
  );
});

describe("weekOfLabel", () => {
  it.each`
    counter       | label                    | week    | timeOfWeekSeconds | era
    ${"GPS-LNAV"} | ${"2024-01-01T00:00:18"} | ${247}  | ${86418}          | ${2}
    ${"GPS-CNAV"} | ${"2024-01-01T00:00:18"} | ${2295} | ${86418}          | ${0}
    ${"BDT"}      | ${"2024-01-01T00:00:04"} | ${939}  | ${86404}          | ${0}
  `(
    "reads $counter label $label as week $week, $timeOfWeekSeconds s, era $era",
    ({ counter, label, week, timeOfWeekSeconds, era }) => {
      expect(weekOfLabel(counter, labelNs(label))).toEqual({
        week,
        timeOfWeekSeconds,
        era,
      });
    },
  );

  it("returns null for a label before the counter's epoch", () => {
    expect(
      weekOfLabel("GAL", labelNs("1999-08-21T23:59:59.999999999")),
    ).toBeNull();
  });
});

describe("resolveRolloverEra", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each`
    rolloverEra                | expected
    ${0}                       | ${0n}
    ${3}                       | ${3n}
    ${Number.MAX_SAFE_INTEGER} | ${9007199254740991n}
  `("reads the integer era $rolloverEra as $expected", ({ rolloverEra }) => {
    expect(resolveRolloverEra("GPS-LNAV", 100n, 0n, rolloverEra)).toBe(
      BigInt(rolloverEra),
    );
  });

  it.each`
    rolloverEra   | why
    ${-1}         | ${"negative"}
    ${1.5}        | ${"not an integer"}
    ${Number.NaN} | ${"NaN"}
    ${"1"}        | ${"a numeric string"}
    ${"current"}  | ${"not the name rolling"}
    ${"Rolling"}  | ${"wrong case: the match is exact"}
    ${null}       | ${"null"}
    ${undefined}  | ${"absent"}
  `("returns null for the era $rolloverEra ($why)", ({ rolloverEra }) => {
    expect(resolveRolloverEra("GPS-LNAV", 100n, 0n, rolloverEra)).toBeNull();
  });

  // At 2026-10-15T00:00:00Z the GPS full week is 2440 (LNAV week 392, era 2). The rolling era puts
  // the full week in (now − M/2, now + M/2]: (2440 − week + M/2) / M, floored, never below 0.
  it.each`
    counter       | week     | expected | why
    ${"GPS-LNAV"} | ${100n}  | ${2n}    | ${"full week 2148, 292 weeks ago"}
    ${"GPS-LNAV"} | ${1023n} | ${1n}    | ${"full week 2047, 393 weeks ago"}
    ${"GPS-LNAV"} | ${904n}  | ${2n}    | ${"full week 2952, exactly half a period ahead"}
    ${"GPS-LNAV"} | ${905n}  | ${1n}    | ${"full week 1929: 2953 would be past half a period"}
    ${"GPS-CNAV"} | ${8191n} | ${0n}    | ${"clamped at era 0"}
    ${"IRN-LNAV"} | ${100n}  | ${1n}    | ${"NavIC full week 1416 now"}
  `(
    "resolves rolling for $counter week $week to era $expected ($why)",
    ({ counter, week, expected }) => {
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.from("2026-10-15T00:00:00Z"),
      );
      expect(resolveRolloverEra(counter, week, 0n, "rolling")).toBe(expected);
    },
  );

  it("returns null for rolling when the clock reads before the counter's epoch", () => {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from("1990-01-01T00:00:00Z"),
    );
    expect(resolveRolloverEra("GAL", 100n, 0n, "rolling")).toBeNull();
  });

  // era = ceil((pivot label − era-0 label) / period), never below 0 (eras from the independent
  // label arithmetic: GPS label = UTC + (TAI − UTC) − 19 s).
  it.each`
    counter       | week     | timeOfWeek             | notBefore                           | expected  | why
    ${"GPS-LNAV"} | ${1020n} | ${0n}                  | ${"2019-01-01T00:00:00Z"}           | ${1n}     | ${"before the 2019 rollover"}
    ${"GPS-LNAV"} | ${1020n} | ${0n}                  | ${"2019-04-07T00:00:00Z"}           | ${2n}     | ${"after the 2019 rollover"}
    ${"GPS-LNAV"} | ${0n}    | ${0n}                  | ${"2019-04-06T23:59:42Z"}           | ${2n}     | ${"exactly equal: counts"}
    ${"GPS-LNAV"} | ${0n}    | ${0n}                  | ${"2019-04-06T23:59:42.000000001Z"} | ${3n}     | ${"1 ns after"}
    ${"GPS-LNAV"} | ${100n}  | ${0n}                  | ${"1980-01-06T00:00:00Z"}           | ${0n}     | ${"at the epoch"}
    ${"GPS-LNAV"} | ${906n}  | ${17_000_000_000n}     | ${"2016-12-31T23:59:60Z"}           | ${1n}     | ${"a listed second 60, equal"}
    ${"GPS-LNAV"} | ${906n}  | ${16_000_000_000n}     | ${"2016-12-31T23:59:60Z"}           | ${2n}     | ${"a listed second 60, 1 s after"}
    ${"GPS-CNAV"} | ${100n}  | ${0n}                  | ${"2000-01-01T00:00:00Z"}           | ${1n}     | ${"13-bit"}
    ${"IRN-LNAV"} | ${247n}  | ${86_418_000_000_000n} | ${"2020-01-01T00:00:00Z"}           | ${1n}     | ${"NavIC 10-bit"}
    ${"GPS-LNAV"} | ${0n}    | ${0n}                  | ${"+275760-09-01T00:00:00Z"}        | ${13951n} | ${"placed; the label is past Temporal's range"}
  `(
    "resolves notBefore $notBefore for $counter week $week to era $expected ($why)",
    ({ counter, week, timeOfWeek, notBefore, expected }) => {
      expect(resolveRolloverEra(counter, week, timeOfWeek, { notBefore })).toBe(
        expected,
      );
    },
  );

  it.each`
    counter       | rolloverEra                              | why
    ${"GAL"}      | ${{ notBefore: "1999-01-01T00:00:00Z" }} | ${"before Galileo's epoch"}
    ${"GPS-LNAV"} | ${{ notBefore: "1979-12-31T00:00:00Z" }} | ${"before the GPS epoch"}
    ${"GPS-LNAV"} | ${{ notBefore: "2017-12-31T23:59:60Z" }} | ${"a second 60 the table does not list"}
    ${"GPS-LNAV"} | ${{ notBefore: "2019-04-07T00:00:00" }}  | ${"no offset"}
    ${"GPS-LNAV"} | ${{ notBefore: 123 }}                    | ${"not a string"}
    ${"GPS-LNAV"} | ${{}}                                    | ${"no notBefore"}
    ${"GPS-LNAV"} | ${[]}                                    | ${"an array"}
  `(
    "returns null for $counter and the era $rolloverEra ($why)",
    ({ counter, rolloverEra }) => {
      expect(resolveRolloverEra(counter, 100n, 0n, rolloverEra)).toBeNull();
    },
  );

  it("reads notBefore once and never reads the clock", () => {
    const now = vi.spyOn(Temporal.Now, "instant");
    const read = vi.fn(() => "2019-04-07T00:00:00Z");
    const rolloverEra = {
      get notBefore() {
        return read();
      },
    };
    expect(resolveRolloverEra("GPS-LNAV", 1020n, 0n, rolloverEra)).toBe(2n);
    expect(read).toHaveBeenCalledTimes(1);
    expect(now).not.toHaveBeenCalled();
  });
});
