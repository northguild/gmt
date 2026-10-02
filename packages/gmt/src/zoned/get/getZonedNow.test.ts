import { Temporal } from "@js-temporal/polyfill";
import {
  battleTestTimeZones,
  TomorrowTimeZone,
  YesterdayTimeZone,
  MustTestDstTimeZones,
} from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { parseTimeZoneFromZoned } from "../parse";
import { getZonedNow } from "./getZonedNow";

// Expected values per battle-test timeZone, verified against @js-temporal/polyfill.
const zonedNowByZone = {
  UTC: "2024-02-29T00:00:00.000+00:00[UTC]",
  GMT: "2024-02-29T00:00:00.000+00:00[GMT]",
  "Etc/GMT": "2024-02-29T00:00:00.000+00:00[Etc/GMT]",
  "America/Nome": "2024-02-28T15:00:00.000-09:00[America/Nome]",
  "Asia/Anadyr": "2024-02-29T12:00:00.000+12:00[Asia/Anadyr]",
  "Europe/Lisbon": "2024-02-29T00:00:00.000+00:00[Europe/Lisbon]",
  "Europe/Dublin": "2024-02-29T00:00:00.000+00:00[Europe/Dublin]",
  "Europe/Berlin": "2024-02-29T01:00:00.000+01:00[Europe/Berlin]",
  "Europe/Helsinki": "2024-02-29T02:00:00.000+02:00[Europe/Helsinki]",
  "Europe/Istanbul": "2024-02-29T03:00:00.000+03:00[Europe/Istanbul]",
  "Asia/Kolkata": "2024-02-29T05:30:00.000+05:30[Asia/Kolkata]",
  "Asia/Kathmandu": "2024-02-29T05:45:00.000+05:45[Asia/Kathmandu]",
  "Asia/Shanghai": "2024-02-29T08:00:00.000+08:00[Asia/Shanghai]",
  "Australia/Lord_Howe": "2024-02-29T11:00:00.000+11:00[Australia/Lord_Howe]",
  "Pacific/Chatham": "2024-02-29T13:45:00.000+13:45[Pacific/Chatham]",
  "Pacific/Apia": "2024-02-29T13:00:00.000+13:00[Pacific/Apia]",
  "Pacific/Niue": "2024-02-28T13:00:00.000-11:00[Pacific/Niue]",
  "America/New_York": "2024-02-28T19:00:00.000-05:00[America/New_York]",
  "America/Chicago": "2024-02-28T18:00:00.000-06:00[America/Chicago]",
  "America/Phoenix": "2024-02-28T17:00:00.000-07:00[America/Phoenix]",
} satisfies Record<keyof typeof MustTestDstTimeZones, string>;

describe("getZonedNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // yesterday tomorrow tests
  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${YesterdayTimeZone} | ${"2024-02-28T13:00:00.000-11:00[Pacific/Niue]"}
    ${TomorrowTimeZone}  | ${"2024-02-29T13:00:00.000+13:00[Pacific/Apia]"}
  `("returns $expected for timeZone $timeZone", ({ timeZone, expected }) => {
    const value = getZonedNow(timeZone);
    const normalizedValue = Temporal.ZonedDateTime.from(value).toString({
      smallestUnit: "millisecond",
    });

    expect(normalizedValue).toBe(expected);
  });

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: zonedNowByZone[timeZone],
    })),
  )(
    "returns an exact zoned datetime string for valid timeZone $timeZone",
    ({ timeZone, expected }) => {
      const value = getZonedNow(timeZone);
      expect(value).toBe(expected);
      expect(parseTimeZoneFromZoned(value)).toBe(timeZone);
    },
  );

  it.each`
    invalidTimeZone
    ${"Mars/Olympus"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid timeZone $invalidTimeZone",
    ({ invalidTimeZone }) => {
      expect(getZonedNow(invalidTimeZone as never)).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`returns an exact zoned datetime for battle-test timeZone ${timeZone}`, () => {
      const value = getZonedNow(timeZone);

      const expected = Temporal.Instant.from("2024-02-29T00:00:00.000Z")
        .toZonedDateTimeISO(timeZone)
        .toString({ smallestUnit: "milliseconds" });

      const normalizedValue = Temporal.ZonedDateTime.from(value).toString({
        smallestUnit: "millisecond",
      });

      expect(normalizedValue).toBe(expected);
      expect(parseTimeZoneFromZoned(value)).toBe(timeZone);
    });
  }

  // ECMA-262 GetOption: an option whose value is undefined is absent, so the documented
  // default ("millisecond", three fractional digits) applies. The clock is on a whole second,
  // where auto precision would print no fraction at all.
  it.each`
    label                            | options                        | expected
    ${"{}"}                          | ${{}}                          | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"{ smallestUnit: undefined }"} | ${{ smallestUnit: undefined }} | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
  `(
    "returns millisecond precision $expected for options $label",
    ({ options, expected }) => {
      expect(getZonedNow("UTC", options)).toBe(expected);
      expect(getZonedNow("UTC", options)).toBe(getZonedNow("UTC"));
    },
  );

  // Temporal.ZonedDateTime.prototype.toString: smallestUnit fixes the digits written.
  it.each`
    smallestUnit     | expected
    ${"minute"}      | ${"2024-02-29T00:00+00:00[UTC]"}
    ${"second"}      | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"millisecond"} | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
  `(
    "returns $expected for smallestUnit $smallestUnit",
    ({ smallestUnit, expected }) => {
      expect(getZonedNow("UTC", { smallestUnit })).toBe(expected);
    },
  );

  // Below a millisecond the system clock's digits are implementation-defined
  // (SystemUTCEpochNanoseconds), so only the digit count is fixed.
  it.each`
    smallestUnit     | fractionDigits
    ${"microsecond"} | ${6}
    ${"nanosecond"}  | ${9}
  `(
    "returns $fractionDigits fractional digits for smallestUnit $smallestUnit",
    ({ smallestUnit, fractionDigits }) => {
      expect(getZonedNow("UTC", { smallestUnit })).toMatch(
        new RegExp(
          `^2024-02-29T00:00:00\\.000\\d{${fractionDigits - 3}}\\+00:00\\[UTC\\]$`,
        ),
      );
    },
  );

  // smallestUnit is the one documented option. Every other key Temporal's
  // ZonedDateTime.prototype.toString reads (roundingMode, fractionalSecondDigits, timeZoneName,
  // offset, calendarName) is not an option of getZonedNow, so it is never read and the output
  // is the same as without it, whether its value would be valid for Temporal or not.
  it.each`
    label                               | extra                             | expected
    ${"{ timeZoneName: 'never' }"}      | ${{ timeZoneName: "never" }}      | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"{ timeZoneName: 'critical' }"}   | ${{ timeZoneName: "critical" }}   | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"{ offset: 'never' }"}            | ${{ offset: "never" }}            | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"{ calendarName: 'always' }"}     | ${{ calendarName: "always" }}     | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"{ fractionalSecondDigits: 9 }"}  | ${{ fractionalSecondDigits: 9 }}  | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"{ fractionalSecondDigits: 42 }"} | ${{ fractionalSecondDigits: 42 }} | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"{ roundingMode: 'bogus' }"}      | ${{ roundingMode: "bogus" }}      | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"{ timeZoneName: 'bogus' }"}      | ${{ timeZoneName: "bogus" }}      | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
  `(
    "ignores the undocumented key $label and returns $expected",
    ({ extra, expected }) => {
      expect(getZonedNow("UTC", extra as never)).toBe(expected);
      expect(getZonedNow("UTC", extra as never)).toBe(getZonedNow("UTC"));
    },
  );

  // "Anything smaller is truncated": with the clock at 00:00:00.999 the second is 00, whatever
  // roundingMode a caller adds. Temporal's toString would round 00:00:00.999 up to 00:00:01
  // (and 00:00 up to 00:01 from 00:00:59.999) if it received "ceil" or "halfExpand".
  it.each`
    clock                         | smallestUnit | roundingMode    | expected
    ${"2024-02-29T00:00:00.999Z"} | ${"second"}  | ${"ceil"}       | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00.999Z"} | ${"second"}  | ${"halfExpand"} | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00.999Z"} | ${"second"}  | ${"expand"}     | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:59.999Z"} | ${"minute"}  | ${"ceil"}       | ${"2024-02-29T00:00+00:00[UTC]"}
    ${"2024-02-29T23:59:59.999Z"} | ${"second"}  | ${"ceil"}       | ${"2024-02-29T23:59:59+00:00[UTC]"}
  `(
    "truncates $clock to $expected for smallestUnit $smallestUnit with an undocumented roundingMode $roundingMode",
    ({ clock, smallestUnit, roundingMode, expected }) => {
      vi.setSystemTime(clock);
      expect(getZonedNow("UTC", { smallestUnit, roundingMode } as never)).toBe(
        expected,
      );
      expect(getZonedNow("UTC", { smallestUnit })).toBe(expected);
    },
  );

  // Temporal.ZonedDateTime.prototype.toString accepts smallestUnit from "minute" to
  // "nanosecond" and throws RangeError for anything else, which is invalid input here.
  it.each`
    smallestUnit
    ${"fortnight"}
    ${"hour"}
    ${"day"}
    ${""}
    ${null}
  `(
    "returns '' for the invalid smallestUnit $smallestUnit",
    ({ smallestUnit }) => {
      expect(getZonedNow("UTC", { smallestUnit })).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedNow("America/New_York");
    expect(result).toBe("");
  });
});
