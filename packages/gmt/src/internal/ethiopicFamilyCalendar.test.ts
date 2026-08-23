import { Temporal } from "@js-temporal/polyfill";
import {
  dateFromEthiopicFamilyFields,
  ethiopicFamilyFieldsFromDate,
  formatEthiopicFamilyDate,
  isEthiopicFamilyCalendar,
} from "./ethiopicFamilyCalendar";

describe("isEthiopicFamilyCalendar", () => {
  it.each`
    value
    ${"ethiopic"}
    ${"ethiopic-amete-alem"}
    ${"coptic"}
  `("returns true for $value", ({ value }: { value: string }) => {
    expect(isEthiopicFamilyCalendar(value)).toBe(true);
  });

  it.each`
    value
    ${"ethioaa"}
    ${"hebrew"}
    ${"gregorian"}
    ${""}
  `("returns false for $value", ({ value }: { value: string }) => {
    expect(isEthiopicFamilyCalendar(value)).toBe(false);
  });
});

// This suite only ever constructs dates from the plain ISO ("iso8601") calendar and reads
// them via "ethioaa" (Temporal's ICU-independent Ethiopic Amete Alem calendar) — never via
// Temporal's own "ethiopic"/"coptic" calendar ids, which are the ones this module exists to
// route around. See the module comment in ethiopicFamilyCalendar.ts for why.
describe("ethiopicFamilyFieldsFromDate / formatEthiopicFamilyDate", () => {
  it.each`
    iso             | calendar                 | expected
    ${"2024-10-03"} | ${"ethiopic"}            | ${"2017-01-23[u-ca=ethiopic;era=ethiopic]"}
    ${"2024-10-03"} | ${"ethiopic-amete-alem"} | ${"7517-01-23[u-ca=ethiopic-amete-alem]"}
    ${"2024-10-03"} | ${"coptic"}              | ${"1741-01-23[u-ca=coptic]"}
  `(
    "formats $iso as $calendar -> $expected",
    ({
      iso,
      calendar,
      expected,
    }: {
      iso: string;
      calendar: "ethiopic" | "ethiopic-amete-alem" | "coptic";
      expected: string;
    }) => {
      const date = Temporal.PlainDate.from(iso);
      expect(formatEthiopicFamilyDate(date, calendar)).toBe(expected);
    },
  );

  it("tags a modern date with eraYear and the 'ethiopic' era", () => {
    const date = Temporal.PlainDate.from("2024-10-03");
    const fields = ethiopicFamilyFieldsFromDate(date, "ethiopic");
    expect(fields).toEqual({
      year: 7517,
      era: "ethiopic",
      eraYear: 2017,
      month: 1,
      day: 23,
    });
  });

  it("tags a pre-epoch date with the 'ethioaa' era", () => {
    const date = Temporal.PlainDate.from("0001-01-01");
    const fields = ethiopicFamilyFieldsFromDate(date, "ethiopic");
    expect(fields).toEqual({
      year: 5493,
      era: "ethioaa",
      eraYear: 5493,
      month: 5,
      day: 8,
    });
    expect(formatEthiopicFamilyDate(date, "ethiopic")).toBe(
      "5493-05-08[u-ca=ethiopic;era=ethioaa]",
    );
  });

  it("uses the plain native year (no era) for ethiopic-amete-alem", () => {
    const date = Temporal.PlainDate.from("2024-10-03");
    const fields = ethiopicFamilyFieldsFromDate(date, "ethiopic-amete-alem");
    expect(fields).toEqual({ year: 7517, month: 1, day: 23 });
  });

  it("uses the plain native year (no era) for coptic", () => {
    const date = Temporal.PlainDate.from("2024-10-03");
    const fields = ethiopicFamilyFieldsFromDate(date, "coptic");
    expect(fields).toEqual({ year: 1741, month: 1, day: 23 });
  });

  // The ethiopic era boundary: Amete Alem gives way to Amete Mihret at this Julian-calendar
  // date (ethioaa proleptic year 5501), ported from EthiopicHelper's anchorEpoch.
  it("converts the ethiopic era boundary (amete-alem -> amete-mihret)", () => {
    expect(
      formatEthiopicFamilyDate(
        Temporal.PlainDate.from("0008-08-26"),
        "ethiopic",
      ),
    ).toBe("5500-13-05[u-ca=ethiopic;era=ethioaa]");
    expect(
      formatEthiopicFamilyDate(
        Temporal.PlainDate.from("0008-08-27"),
        "ethiopic",
      ),
    ).toBe("0001-01-01[u-ca=ethiopic;era=ethiopic]");
  });

  // Non-leap 13th month (Pagume/Nasie) is 5 days; leap is 6 — identical across all three
  // calendars since they share one annual cycle.
  it.each`
    iso             | calendar                 | expected
    ${"2025-09-10"} | ${"ethiopic"}            | ${"2017-13-05[u-ca=ethiopic;era=ethiopic]"}
    ${"2025-09-11"} | ${"ethiopic"}            | ${"2018-01-01[u-ca=ethiopic;era=ethiopic]"}
    ${"2027-09-11"} | ${"ethiopic"}            | ${"2019-13-06[u-ca=ethiopic;era=ethiopic]"}
    ${"2027-09-12"} | ${"ethiopic"}            | ${"2020-01-01[u-ca=ethiopic;era=ethiopic]"}
    ${"2025-09-10"} | ${"ethiopic-amete-alem"} | ${"7517-13-05[u-ca=ethiopic-amete-alem]"}
    ${"2025-09-11"} | ${"ethiopic-amete-alem"} | ${"7518-01-01[u-ca=ethiopic-amete-alem]"}
    ${"2025-09-10"} | ${"coptic"}              | ${"1741-13-05[u-ca=coptic]"}
    ${"2025-09-11"} | ${"coptic"}              | ${"1742-01-01[u-ca=coptic]"}
  `(
    "13th-month boundary: $iso as $calendar -> $expected",
    ({
      iso,
      calendar,
      expected,
    }: {
      iso: string;
      calendar: "ethiopic" | "ethiopic-amete-alem" | "coptic";
      expected: string;
    }) => {
      expect(
        formatEthiopicFamilyDate(Temporal.PlainDate.from(iso), calendar),
      ).toBe(expected);
    },
  );
});

describe("dateFromEthiopicFamilyFields", () => {
  it.each`
    calendar                 | fields                                                   | expectedIso
    ${"ethiopic"}            | ${{ era: "ethiopic", eraYear: 2017, month: 1, day: 23 }} | ${"2024-10-03"}
    ${"ethiopic"}            | ${{ era: "ethioaa", eraYear: 5493, month: 5, day: 8 }}   | ${"0001-01-01"}
    ${"ethiopic-amete-alem"} | ${{ year: 7517, month: 1, day: 23 }}                     | ${"2024-10-03"}
    ${"coptic"}              | ${{ year: 1741, month: 1, day: 23 }}                     | ${"2024-10-03"}
  `(
    "constructs $calendar $fields -> $expectedIso",
    ({
      calendar,
      fields,
      expectedIso,
    }: {
      calendar: "ethiopic" | "ethiopic-amete-alem" | "coptic";
      fields: {
        year?: number;
        era?: string;
        eraYear?: number;
        month: number;
        day: number;
      };
      expectedIso: string;
    }) => {
      expect(
        dateFromEthiopicFamilyFields(calendar, fields)
          .withCalendar("iso8601")
          .toString(),
      ).toBe(expectedIso);
    },
  );

  it("throws for an unknown ethiopic era", () => {
    expect(() =>
      dateFromEthiopicFamilyFields("ethiopic", {
        era: "unknown-era",
        eraYear: 1,
        month: 1,
        day: 1,
      }),
    ).toThrow();
  });

  it("throws when ethiopic-amete-alem/coptic are missing a year", () => {
    expect(() =>
      dateFromEthiopicFamilyFields("ethiopic-amete-alem", {
        month: 1,
        day: 1,
      }),
    ).toThrow();
    expect(() =>
      dateFromEthiopicFamilyFields("coptic", { month: 1, day: 1 }),
    ).toThrow();
  });

  it("throws when ethiopic is missing an eraYear", () => {
    expect(() =>
      dateFromEthiopicFamilyFields("ethiopic", {
        era: "ethiopic",
        month: 1,
        day: 1,
      }),
    ).toThrow();
  });

  it("throws for an out-of-range month/day (overflow: reject)", () => {
    expect(() =>
      dateFromEthiopicFamilyFields("coptic", { year: 1741, month: 13, day: 7 }),
    ).toThrow();
  });
});
