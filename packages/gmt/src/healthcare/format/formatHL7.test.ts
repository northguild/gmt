import { fromOffsetInstant, toOffsetInstant } from "../../instant/convert";
import { revokedProxy } from "../../test/hostileValues";
import { NON_STRINGS } from "../../test/nonStrings";
import type { Hl7FormatOptions } from "../../types";
import { parseHL7 } from "../parse/parseHL7";
import { formatHL7 } from "./formatHL7";

// Every expected value is decided from HL7 v2.5.1 2.A.22 (digit count is the precision; the
// offset is `±ZZZZ`) and the GMT rules "cut, never round" and "precision only lowers".
const WRITTEN = [
  {
    input: "2024-06-15T10:30:00-05:00",
    expected: "20240615103000-0500",
  },
  { input: "2024-06-15T15:30:00Z", expected: "20240615153000+0000" },
  { input: "2024-06-15T10:30:00", expected: "20240615103000" },
  { input: "2024-06-15T10:30", expected: "202406151030" },
  {
    input: "2024-06-15T10:30:45.98765-05:00",
    expected: "20240615103045.9876-0500",
  },
  { input: "2024-06-15T10:30:00.1000", expected: "20240615103000.1000" },
  { input: "2024-06-15T10:30:00,5", expected: "20240615103000.5" },
  { input: "2024", expected: "2024" },
  { input: "2024-06", expected: "202406" },
  { input: "2024-06-15", expected: "20240615" },
  { input: "2024-06-15T10", expected: "2024061510" },
  { input: "0000-01-01", expected: "00000101" },
  {
    input: "2024-06-15T10:30:00+05:30[Asia/Kolkata]",
    expected: "20240615103000+0530",
  },
  {
    input: "2024-06-15T10:30:00+23:00",
    expected: "20240615103000+2300",
  },
  {
    // UTC year 10000, wall clock 9999
    input: "9999-12-31T23:59:59-14:00",
    expected: "99991231235959-1400",
  },
  // 2.A.22 `±ZZZZ`: the value's own offset, whole minutes, never `-0000`
  { input: "2024-06-15T10:30:00+00:00", expected: "20240615103000+0000" },
  { input: "2024-06-15T10:30:00-00:00", expected: "20240615103000+0000" },
  { input: "2024-06-15T10:30:00+05:45", expected: "20240615103000+0545" },
  { input: "2024-06-15T10:30:00-14:00", expected: "20240615103000-1400" },
  { input: "2024-06-15T10:30:00+14:00", expected: "20240615103000+1400" },
  // Z names an exact instant; a zone annotation shows it on that zone's clock (EEST, +03:00)
  {
    input: "2024-06-15T10:30:00Z[Europe/Helsinki]",
    expected: "20240615133000+0300",
  },
  { input: "2024-06-15T10:30:00Z[UTC]", expected: "20240615103000+0000" },
  { input: "2024-06-15T10:30:00+00:00:00", expected: "20240615103000+0000" },
  // 2.A.22 `YYYY`: years 0000 and 9999 are the ends
  { input: "0000-01-01T00:00:00Z", expected: "00000101000000+0000" },
  { input: "0000-01-01T00:00:00+01:00", expected: "00000101000000+0100" },
  { input: "9999", expected: "9999" },
  { input: "9999-12-31T23:59:59.9999", expected: "99991231235959.9999" },
  // 2.A.22 `[.S[S[S[S]]]]`: as many digits as written, at most four
  { input: "2024-06-15T10:30:00.0", expected: "20240615103000.0" },
  { input: "2024-06-15T10:30:00.123Z", expected: "20240615103000.123+0000" },
  {
    input: "2024-06-15T10:30:00.000000000Z",
    expected: "20240615103000.0000+0000",
  },
  {
    input: "2024-06-15T10:30:00.123456789+05:45",
    expected: "20240615103000.1234+0545",
  },
  {
    input: fromOffsetInstant({
      instant: "2024-06-15T15:30:00Z",
      offset: "-05:00",
      timeZone: "America/Chicago",
    }),
    expected: "20240615103000-0500",
  },
] as const;

const LOWERED: {
  input: string;
  precision: Hl7FormatOptions["precision"];
  expected: string;
}[] = [
  {
    input: "2024-06-15T10:30:45.98765-05:00",
    precision: "minute",
    expected: "202406151030-0500",
  },
  {
    input: "2024-06-15T10:30:45.98765-05:00",
    precision: "day",
    expected: "20240615-0500",
  },
  {
    input: "2024-06-15T10:30:45.98765-05:00",
    precision: "year",
    expected: "2024-0500",
  },
  {
    input: "2024-06-15T10:30:59.999999999",
    precision: "minute",
    expected: "202406151030",
  },
  {
    input: "2024-06-15T23:59:59.9Z",
    precision: "second",
    expected: "20240615235959+0000",
  },
  {
    input: "2024-06-15T10:30:00-05:00",
    precision: "hour",
    expected: "2024061510-0500",
  },
  {
    input: "2024-06-15T10:30:00",
    precision: "minute",
    expected: "202406151030",
  },
  {
    input: "2024-06-15T10:30:45.123456789Z",
    precision: "fraction",
    expected: "20240615103045.1234+0000",
  },
  { input: "2024-06-15", precision: "day", expected: "20240615" },
  { input: "2024-06-15", precision: "month", expected: "202406" },
  { input: "2024-06-15T10", precision: "hour", expected: "2024061510" },
  // a cut that rounding would carry across a boundary
  {
    input: "2024-12-31T23:59:59.999999999Z",
    precision: "day",
    expected: "20241231+0000",
  },
  {
    input: "2024-12-31T23:59:59.999999999",
    precision: "year",
    expected: "2024",
  },
  {
    input: "2024-12-31T23:59:59.999999999",
    precision: "hour",
    expected: "2024123123",
  },
  {
    input: "2024-12-31T23:59:59.999999999+05:45",
    precision: "second",
    expected: "20241231235959+0545",
  },
  {
    input: "2024-06-15T10:30:00.5",
    precision: "fraction",
    expected: "20240615103000.5",
  },
  {
    input: "2024-06-15T10:30:45.98765",
    precision: "second",
    expected: "20240615103045",
  },
  {
    input: "2024-06-15T10:30:00-05:00",
    precision: "minute",
    expected: "202406151030-0500",
  },
  {
    input: "2024-06-15T10:30:00+05:45",
    precision: "month",
    expected: "202406+0545",
  },
];

const REFUSED: {
  input: string;
  precision?: Hl7FormatOptions["precision"];
  why: string;
}[] = [
  { input: "2024-06", precision: "day", why: "finer than the value carries" },
  {
    input: "2024-06-15T15:30:00Z",
    precision: "fraction",
    why: "no fraction to write",
  },
  {
    input: "2024-06-15T10:30",
    precision: "second",
    why: "minute value has no seconds",
  },
  { input: "1900-01-01T11:34:39-00:25:21", why: "offset with seconds" },
  {
    input: "1900-01-01T11:34:39-00:25:21[Europe/Dublin]",
    why: "Dublin Mean Time offset",
  },
  { input: "+010000-01-01", why: "expanded year" },
  { input: "-000001-01-01T00:00:00Z", why: "negative year" },
  { input: "2024-06-15-05:00", why: "day with an offset" },
  { input: "2024-06-15T10-05:00", why: "hour with an offset" },
  { input: "2024-06Z", why: "month with an offset" },
  { input: "2024-06-15T10:30:00[Europe/Helsinki]", why: "zone with no offset" },
  { input: "2024-06-15[u-ca=iso8601]", why: "annotated date" },
  { input: "2024-06-15T10:30:60", why: "second 60" },
  { input: "2024-06-15T24:00:00", why: "hour 24" },
  { input: "2024-02-30", why: "no such day" },
  { input: "2024-13", why: "no such month" },
  {
    input: "2024-06-15T10:30:00+05:30[Europe/Helsinki]",
    why: "zone disagrees with offset",
  },
  { input: "2023-02-29T10", why: "no such day, hour form" },
  { input: "20240615103000", why: "already basic form" },
  { input: "2024-06-15t10:30:00", why: "lower-case t" },
  { input: "2024-06-15T10:30:00z", why: "lower-case z" },
  { input: "2024-06-15 10:30", why: "space separator" },
  { input: "", why: "empty string" },
  { input: "2024", precision: "minute", why: "year value, finer precision" },
  { input: "2024-06-15", precision: "hour", why: "day value, finer precision" },
  { input: "2024-06-15T10", precision: "minute", why: "hour value, minute" },
  {
    input: "2024-06-15T10:30:00",
    precision: "fraction",
    why: "local second, no fraction",
  },
  { input: "2024-06-15T10:30:00+05:30:30", why: "offset with seconds" },
  { input: "2024-06-15T10:30:00[u-ca=iso8601]", why: "local, annotated" },
  { input: "2024-06-15T10:30:00+24:00", why: "offset hours 24" },
  { input: "10000-01-01", why: "five-digit year" },
];

const BAD_OPTIONS: { label: string; options: unknown }[] = [
  { label: "null", options: null },
  { label: "5", options: 5 },
  { label: "'minute'", options: "minute" },
  { label: "{ precision: 'Minute' }", options: { precision: "Minute" } },
  { label: "{ precision: 'week' }", options: { precision: "week" } },
  { label: "{ precision: null }", options: { precision: null } },
  { label: "{ precision: '' }", options: { precision: "" } },
  {
    label: "a throwing getter",
    options: {
      get precision(): never {
        throw new TypeError("hostile getter");
      },
    },
  },
  { label: "a revoked proxy", options: revokedProxy() },
];

describe("formatHL7", () => {
  it.each(WRITTEN)("writes '$input' as '$expected'", ({ input, expected }) => {
    expect(formatHL7(input)).toBe(expected);
  });

  it.each(LOWERED)(
    "writes '$input' lowered to $precision as '$expected', cut and never rounded",
    ({ input, precision, expected }) => {
      expect(formatHL7(input, { precision })).toBe(expected);
    },
  );

  it.each(REFUSED)("returns '' for '$input' ($why)", ({ input, precision }) => {
    expect(
      formatHL7(input, precision === undefined ? undefined : { precision }),
    ).toBe("");
  });

  it("accepts an empty options object", () => {
    expect(formatHL7("2024-06-15", {})).toBe("20240615");
  });

  it("reads an array, a function and an unknown key as options with no precision", () => {
    expect(formatHL7("2024-06-15T10:30:00Z", [] as Hl7FormatOptions)).toBe(
      "20240615103000+0000",
    );
    expect(
      formatHL7("2024-06-15T10:30:00Z", (() => 0) as Hl7FormatOptions),
    ).toBe("20240615103000+0000");
    expect(
      formatHL7("2024-06-15T10:30:00Z", { other: 1 } as Hl7FormatOptions),
    ).toBe("20240615103000+0000");
  });

  it("accepts options with precision undefined", () => {
    expect(formatHL7("2024-06-15", { precision: undefined })).toBe("20240615");
  });

  it.each(BAD_OPTIONS)("returns '' for the options $label", ({ options }) => {
    expect(formatHL7("2024-06-15T10:30:00Z", options as Hl7FormatOptions)).toBe(
      "",
    );
  });

  it.each(NON_STRINGS.map(([label, make]) => ({ label, make })))(
    "returns '' without throwing for $label",
    ({ make }) => {
      expect(formatHL7(make() as string)).toBe("");
    },
  );

  describe("round trip through parseHL7 (index correction 2)", () => {
    it.each(
      [
        "2024-06-15T10:30:00-05:00",
        "2024-06-15T15:30:00Z",
        "2024-06-15T10:30:45.1234-05:00",
        "2024-06-15T10:30:45.1-05:00",
        "2024-06-15T10:30:00+05:30[Asia/Kolkata]",
        "9999-12-31T23:59:59-14:00",
        "2024-06-15T10:30:00+05:45",
        "2024-06-15T10:30:00+14:00",
        "2024-06-15T10:30:00.1234Z",
        "2024-06-15T10:30:00-00:00",
      ].map((iso) => ({ iso })),
    )("reads '$iso' back as the same instant and offset", ({ iso }) => {
      const pair = toOffsetInstant(iso);
      const back = parseHL7(formatHL7(iso));
      expect(back).toMatchObject({
        kind: "instant",
        instant: pair?.instant,
        offset: pair?.offset,
      });
    });

    it("returns the cut instant for a five-digit fraction", () => {
      expect(
        parseHL7(formatHL7("2024-06-15T10:30:45.98765-05:00")),
      ).toMatchObject({
        instant: "2024-06-15T15:30:45.9876Z",
        offset: "-05:00",
      });
    });

    it("writes a minute-precision local back only with its parsed precision", () => {
      const parsed = parseHL7("202406151030");
      expect(parsed).not.toBeNull();
      const local = (parsed as { local: string }).local;
      const precision = (parsed as { precision: "minute" }).precision;
      expect(formatHL7(local, { precision })).toBe("202406151030");
      expect(formatHL7(local)).toBe("20240615103000");
    });
  });
});
