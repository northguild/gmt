import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { setUnix } from "./setUnix";

describe("setUnix", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  it.each`
    value            | fields            | options                     | expected
    ${1709208000000} | ${{ hour: 9 }}    | ${undefined}                | ${1709197200000}
    ${1709208000000} | ${{ year: 2025 }} | ${undefined}                | ${1740744000000}
    ${1706702400}    | ${{ month: 2 }}   | ${{ epochUnit: "seconds" }} | ${1709208000}
    ${1709208000000} | ${{}}             | ${undefined}                | ${1709208000000}
  `(
    "returns $expected for $value with fields $fields and options $options",
    ({ value, fields, options, expected }) => {
      expect(setUnix(value, fields, options)).toBe(expected);
    },
  );

  it.each`
    value            | fields         | options
    ${"invalid"}     | ${{ hour: 9 }} | ${undefined}
    ${1.5}           | ${{ hour: 9 }} | ${undefined}
    ${null}          | ${{ hour: 9 }} | ${undefined}
    ${NaN}           | ${{ hour: 9 }} | ${undefined}
    ${1709208000000} | ${{ hour: 9 }} | ${{ timeZone: "Invalid/Zone" }}
  `("returns null for invalid input", ({ value, fields, options }) => {
    expect(setUnix(value as never, fields, options)).toBeNull();
  });

  it.each`
    value            | fields          | overflow       | expected
    ${1706702400000} | ${{ month: 2 }} | ${undefined}   | ${1709208000000}
    ${1706702400000} | ${{ month: 2 }} | ${"constrain"} | ${1709208000000}
    ${1706702400000} | ${{ month: 2 }} | ${"reject"}    | ${null}
  `(
    "returns $expected for $value with fields $fields and overflow $overflow",
    ({ value, fields, overflow, expected }) => {
      expect(
        setUnix(
          value,
          fields,
          overflow === undefined
            ? { timeZone: "UTC" }
            : { timeZone: "UTC", overflow },
        ),
      ).toBe(expected);
    },
  );

  it("resolves multi-field updates atomically regardless of field order in the object", () => {
    const value = Date.UTC(2024, 0, 31, 12, 0, 0);
    const monthThenDay = setUnix(
      value,
      { month: 2, day: 5 },
      { timeZone: "UTC" },
    );
    const dayThenMonth = setUnix(
      value,
      { day: 5, month: 2 },
      { timeZone: "UTC" },
    );
    expect(monthThenDay).toBe(Date.UTC(2024, 1, 5, 12, 0, 0));
    expect(dayThenMonth).toBe(Date.UTC(2024, 1, 5, 12, 0, 0));
  });

  // Temporal ZonedDateTime.prototype.with defaults offset to "prefer": the source's offset is kept
  // while it is still valid, so the ambiguous 01:00 resolves without consulting disambiguation.
  // offset:"ignore" re-resolves the wall clock, so disambiguation:"reject" throws (null).
  it.each`
    timeZone             | epoch            | offset       | expected
    ${"America/Chicago"} | ${1730616300000} | ${undefined} | ${1730613600000}
    ${"America/Chicago"} | ${1730616300000} | ${"ignore"}  | ${null}
    ${"America/Chicago"} | ${1730616300000} | ${"prefer"}  | ${1730613600000}
  `(
    "with disambiguation reject and offset $offset, returns $expected for $timeZone",
    ({ timeZone, epoch, offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { timeZone, disambiguation: "reject" as const }
          : { timeZone, disambiguation: "reject" as const, offset };
      expect(setUnix(epoch, { minute: 0 }, optionsArg)).toBe(expected);
    },
  );

  // 1730615400000 is the second 01:30 of the 2024-11-03 New York fall-back (-05:00). "prefer" keeps
  // -05:00 for 01:45 (06:45Z); "ignore" re-resolves with "compatible", the earlier -04:00 (05:45Z).
  it.each`
    offset       | expected
    ${undefined} | ${1730616300000}
    ${"prefer"}  | ${1730616300000}
    ${"ignore"}  | ${1730612700000}
  `(
    "sets minute 45 on the repeated 01:30 in New York with offset $offset giving $expected",
    ({ offset, expected }) => {
      expect(
        setUnix(
          1730615400000,
          { minute: 45 },
          { timeZone: "America/New_York", offset },
        ),
      ).toBe(expected);
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`resolves month-end overflow for battle-test timeZone ${timeZone}`, () => {
      const value = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 3,
        day: 31,
        hour: 12,
        minute: 0,
        second: 0,
        timeZone,
      }).epochMilliseconds;

      const constrained = setUnix(
        value,
        { month: 2 },
        { timeZone, overflow: "constrain" },
      );
      expect(constrained).not.toBeNull();

      const rejected = setUnix(
        value,
        { month: 2 },
        { timeZone, overflow: "reject" },
      );
      expect(rejected).toBeNull();
    });
  }

  it("returns null when the with() call throws for a malformed fields object", () => {
    expect(
      setUnix(1709208000000, { hour: Number.NaN }, { timeZone: "UTC" }),
    ).toBeNull();
  });
});

describe("setUnix at the maximum instant", () => {
  // 8_639_999_992_800_000 ms is 08:00 in Sydney; hour 9 is 8_639_999_996_400_000.
  it.each`
    value                    | fields         | timeZone              | expected
    ${8_639_999_992_800_000} | ${{ hour: 9 }} | ${"Australia/Sydney"} | ${8_639_999_996_400_000}
  `(
    "sets $fields on $value in $timeZone giving $expected",
    ({ value, fields, timeZone, expected }) => {
      expect(setUnix(value, fields, { timeZone })).toBe(expected);
    },
  );
});

describe("setUnix with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds", singular or plural): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"nanoseconds"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `("returns null for epochUnit $epochUnit", ({ epochUnit }) => {
    expect(
      setUnix(
        1_706_659_200,
        { hour: 1 },
        { epochUnit: epochUnit as never, timeZone: "UTC" },
      ),
    ).toBe(null);
  });
});
