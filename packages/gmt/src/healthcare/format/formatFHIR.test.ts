import { Temporal } from "../../internal/temporal";
import { FHIR_PARSE_ROWS } from "../../test/fhirRows";
import { revokedProxy } from "../../test/hostileValues";
import { NON_STRINGS } from "../../test/nonStrings";
import type {
  FhirDateType,
  FhirFormatOptions,
  FhirPrecision,
} from "../../types";
import { parseFHIR } from "../parse/parseFHIR";
import { isValidFHIR } from "../validate/isValidFHIR";
import { formatFHIR } from "./formatFHIR";

// Every expected value is decided from FHIR R4 Datatypes §2.24.0.1 (forms, zone, seconds) and the
// GMT rules in the HLTH-94 Authority table: cut never round, wall-clock date, no zero-fill, no
// leap second written.
const TYPES: FhirDateType[] = ["date", "dateTime", "instant"];

interface Row {
  input: string;
  type: FhirDateType;
  precision?: FhirPrecision;
  expected: string;
  why: string;
}

const ROWS: Row[] = [
  // Verification rows
  {
    input: "2024-06-15T23:30:00-05:00",
    type: "date",
    expected: "2024-06-15",
    why: "wall-clock date at the input offset",
  },
  {
    input: "2024-06-15T23:30:00-05:00",
    type: "instant",
    expected: "2024-06-15T23:30:00-05:00",
    why: "written as it is",
  },
  {
    input: "2024-06-15T10:30:00",
    type: "instant",
    expected: "",
    why: "an instant needs a zone",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "dateTime",
    precision: "month",
    expected: "2024-06",
    why: "cut",
  },
  {
    input: "2024-06",
    type: "dateTime",
    precision: "day",
    expected: "",
    why: "finer than written",
  },
  // Rules
  {
    input: "2024-06-16T04:30:00Z",
    type: "date",
    expected: "2024-06-16",
    why: "the UTC date from the Z form",
  },
  {
    input: "2024-06-15T10:30:00Z[Europe/Berlin]",
    type: "dateTime",
    expected: "2024-06-15T12:30:00+02:00",
    why: "zone offset written",
  },
  {
    input: "2024-06-15T10:30:00Z[Europe/Berlin]",
    type: "date",
    expected: "2024-06-15",
    why: "wall-clock date in the zone",
  },
  {
    input: "2024-06-15T10:30:00Z[UTC]",
    type: "instant",
    expected: "2024-06-15T10:30:00+00:00",
    why: "a bracketed zone writes its offset",
  },
  {
    input: "2024-01-15T10:30:00Z[Europe/London]",
    type: "dateTime",
    expected: "2024-01-15T10:30:00+00:00",
    why: "a zero zone offset is written as an offset",
  },
  {
    input: "2024-01-15T10:30:00-00:00[Europe/London]",
    type: "dateTime",
    expected: "2024-01-15T10:30:00+00:00",
    why: "-00:00 agrees with a zero zone offset",
  },
  {
    // Temporal.ZonedDateTime.from rejects an offset the zone contradicts (RFC 9557 §3.4)
    input: "2024-06-15T10:30:00-00:00[Europe/Berlin]",
    type: "dateTime",
    expected: "",
    why: "-00:00 contradicts the zone",
  },
  {
    input: "2024-06-15T10:30:00+05:30:00",
    type: "dateTime",
    expected: "2024-06-15T10:30:00+05:30",
    why: "zero offset seconds dropped",
  },
  {
    input: "2024-06-15T10:30:00-00:00",
    type: "dateTime",
    expected: "2024-06-15T10:30:00-00:00",
    why: "kept as written",
  },
  {
    input: "2024-06-15T10:30:00,5+02:00",
    type: "dateTime",
    expected: "2024-06-15T10:30:00.5+02:00",
    why: "always a dot",
  },
  {
    input: "2017-01-01T00:00:00.000Z",
    type: "instant",
    expected: "2017-01-01T00:00:00.000Z",
    why: "written digits kept",
  },
  {
    input: "2024-06-15T23:59:59.999Z",
    type: "instant",
    precision: "second",
    expected: "2024-06-15T23:59:59Z",
    why: "cut not rounded",
  },
  {
    input: "2024-12-31T23:59:59.999-05:00",
    type: "dateTime",
    precision: "year",
    expected: "2024",
    why: "cut",
  },
  {
    input: "2024-06-15T10:30:00.5Z",
    type: "dateTime",
    precision: "fraction",
    expected: "2024-06-15T10:30:00.5Z",
    why: "fraction kept",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "dateTime",
    precision: "fraction",
    expected: "",
    why: "finer than written",
  },
  {
    input: "2024-06-15T10:30Z",
    type: "dateTime",
    expected: "",
    why: "no minute precision",
  },
  {
    input: "2024-06-15T10:30Z",
    type: "date",
    expected: "2024-06-15",
    why: "cut to a day",
  },
  {
    input: "2024-06-15T10:30Z",
    type: "dateTime",
    precision: "day",
    expected: "2024-06-15",
    why: "cut to a day",
  },
  {
    input: "2024-06-15T10:30Z",
    type: "dateTime",
    precision: "second",
    expected: "",
    why: "no zero-fill",
  },
  {
    input: "2024-06-15T10:30-05:00",
    type: "dateTime",
    expected: "",
    why: "no minute precision, offset",
  },
  {
    input: "2024-06-15T10:30-05:00",
    type: "instant",
    expected: "",
    why: "no minute precision, instant",
  },
  {
    input: "2024-06-15T10:30-05:00",
    type: "date",
    expected: "2024-06-15",
    why: "wall-clock day",
  },
  {
    input: "2024-06-15T10Z",
    type: "date",
    expected: "2024-06-15",
    why: "an hour with an offset (ISO 8601-1 §5.3.1.3)",
  },
  {
    input: "2024-06-15T23-05:00",
    type: "date",
    expected: "2024-06-15",
    why: "an hour, wall-clock day at its offset",
  },
  {
    input: "2024-06-15T23Z[Europe/Berlin]",
    type: "date",
    expected: "2024-06-16",
    why: "an hour, wall-clock day in the zone",
  },
  {
    input: "2024-06-15T10Z",
    type: "dateTime",
    expected: "",
    why: "an hour with an offset, not cut",
  },
  {
    input: "2024-06-15T10:30:00",
    type: "date",
    expected: "2024-06-15",
    why: "a local date is a date",
  },
  {
    input: "2024-06-15T10:30:00",
    type: "dateTime",
    precision: "day",
    expected: "2024-06-15",
    why: "cut to a day",
  },
  {
    input: "2024-06-15T10:30:00[Europe/Berlin]",
    type: "date",
    expected: "",
    why: "a zone with no offset",
  },
  {
    input: "2024-06-15[u-ca=iso8601]",
    type: "date",
    expected: "",
    why: "annotation on a local form",
  },
  {
    input: "2024-06-15T25:00:00",
    type: "date",
    expected: "",
    why: "no hour 25",
  },
  { input: "2024-02-30", type: "date", expected: "", why: "no such day" },
  {
    input: "2024-06-15T10:30:00.1234567890Z",
    type: "instant",
    expected: "",
    why: "ten fraction digits",
  },
  {
    input: "2024-06-15T10:30:00+02:00:30",
    type: "dateTime",
    expected: "",
    why: "offset with seconds",
  },
  {
    input: "2024-06-15T10:30:00+15:00",
    type: "dateTime",
    expected: "",
    why: "offset past 14:00",
  },
  { input: "0000-06-15", type: "date", expected: "", why: "year 0000" },
  {
    input: "2024",
    type: "instant",
    expected: "",
    why: "an instant needs seconds",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "instant",
    precision: "day",
    expected: "",
    why: "instant is not coarse",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "date",
    precision: "second",
    expected: "",
    why: "date has no time",
  },
  {
    input: "2024",
    type: "Date" as FhirDateType,
    expected: "",
    why: "unknown type",
  },
  {
    input: "2024",
    type: "toString" as FhirDateType,
    expected: "",
    why: "inherited key is no type",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "dateTime",
    precision: "minute" as FhirPrecision,
    expected: "",
    why: "no minute precision",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "dateTime",
    precision: "hour" as FhirPrecision,
    expected: "",
    why: "no hour precision",
  },
  {
    input: "2024-06-15t10:30:00Z",
    type: "dateTime",
    expected: "",
    why: "upper case only",
  },
  {
    input: "2024-06-15T23:30:00Z[Asia/Tokyo]",
    type: "date",
    expected: "2024-06-16",
    why: "zone wall-clock date crosses midnight",
  },
  {
    input: "2024-06-15T23:30:00Z[Asia/Tokyo]",
    type: "dateTime",
    expected: "2024-06-16T08:30:00+09:00",
    why: "zone offset written",
  },
  {
    input: "2024-11-03T05:30:00Z[America/New_York]",
    type: "dateTime",
    expected: "2024-11-03T01:30:00-04:00",
    why: "first 01:30 of the fall-back hour",
  },
  {
    input: "2024-11-03T06:30:00Z[America/New_York]",
    type: "dateTime",
    expected: "2024-11-03T01:30:00-05:00",
    why: "second 01:30 of the fall-back hour",
  },
  {
    input: "0001-01-01T00:00:00Z[America/New_York]",
    type: "dateTime",
    expected: "",
    why: "written year would be 0000",
  },
  {
    input: "9999-12-31T23:59:59Z[Asia/Tokyo]",
    type: "dateTime",
    expected: "",
    why: "written year would be 10000",
  },
  {
    input: "2024-06-15T00:30:00+14:00",
    type: "date",
    expected: "2024-06-15",
    why: "wall-clock day, the UTC day is the 14th",
  },
  {
    input: "2024-06-15T10:30:00-00:00",
    type: "date",
    expected: "2024-06-15",
    why: "designator dropped under date",
  },
  {
    input: "2024-06-15T10:30:00+00:00",
    type: "dateTime",
    expected: "2024-06-15T10:30:00+00:00",
    why: "+00:00 kept as written",
  },
  {
    input: "2024-06-15T23:30:00-05:00",
    type: "dateTime",
    precision: "day",
    expected: "2024-06-15",
    why: "wall-clock day cut",
  },
  {
    input: "2024-06-15T23:59:59Z",
    type: "dateTime",
    precision: "day",
    expected: "2024-06-15",
    why: "last second of the day is cut, not rounded",
  },
  {
    input: "2024-06-30T23:59:59Z",
    type: "dateTime",
    precision: "month",
    expected: "2024-06",
    why: "last second of the month is cut, not rounded",
  },
  {
    input: "2024-12-31T23:59:59.999999999Z",
    type: "instant",
    precision: "second",
    expected: "2024-12-31T23:59:59Z",
    why: "nine nines cut at the second",
  },
  {
    input: "2024-06-15T10:30:00.123456789+05:30",
    type: "instant",
    expected: "2024-06-15T10:30:00.123456789+05:30",
    why: "nine digits kept",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "instant",
    precision: "year",
    expected: "",
    why: "instant is not a year",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "instant",
    precision: "month",
    expected: "",
    why: "instant is not a month",
  },
  {
    input: "2024-02-29T10:30:00",
    type: "date",
    expected: "2024-02-29",
    why: "leap day",
  },
  {
    input: "2023-02-29",
    type: "date",
    expected: "",
    why: "no leap day in 2023",
  },
  {
    input: "2024-06-15T10:30:00Z",
    type: "dateTime",
    expected: "2024-06-15T10:30:00Z",
    why: "identity",
  },
  {
    input: "2024-06-15",
    type: "date",
    expected: "2024-06-15",
    why: "identity",
  },
  { input: "2024-06", type: "dateTime", expected: "2024-06", why: "identity" },
];

const LEAP_INPUTS = [
  "2016-12-31T23:59:60Z",
  "2016-12-31T23:59:60.5Z",
  "2016-12-31T18:59:60-05:00",
  "2016-12-31T23:59:60",
];
const PRECISIONS: (FhirPrecision | undefined)[] = [
  undefined,
  "year",
  "month",
  "day",
  "second",
  "fraction",
];

const BAD_OPTIONS: { label: string; options: unknown }[] = [
  { label: "null", options: null },
  { label: "5", options: 5 },
  { label: "'day'", options: "day" },
  { label: "{ precision: 'Day' }", options: { precision: "Day" } },
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

describe("formatFHIR", () => {
  it.each(ROWS)(
    "writes '$input' as $type with precision $precision as '$expected' ($why)",
    ({ input, type, precision, expected }) => {
      const options = precision === undefined ? undefined : { precision };
      expect(formatFHIR(input, type, options)).toBe(expected);
    },
  );

  it.each(
    LEAP_INPUTS.flatMap((input) =>
      TYPES.flatMap((type) =>
        PRECISIONS.map((precision) => ({ input, type, precision })),
      ),
    ),
  )(
    "returns '' for the leap second '$input' as $type with precision $precision",
    ({ input, type, precision }) => {
      const options = precision === undefined ? undefined : { precision };
      expect(formatFHIR(input, type, options)).toBe("");
    },
  );

  it("refuses a sub-minute offset by rule, before Temporal is asked to show it", () => {
    const spy = vi.spyOn(Temporal.Instant.prototype, "toZonedDateTimeISO");
    try {
      expect(formatFHIR("1960-01-01T00:00:00Z[Africa/Monrovia]", "date")).toBe(
        "",
      );
      // readFormOffsetInstant shows the instant in the zone; only a guard-less formatFHIR shows it at
      // the sub-minute offset itself.
      expect(spy.mock.calls.map(([zone]) => String(zone))).not.toContain(
        "-00:44:30",
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("accepts an empty options object", () => {
    expect(formatFHIR("2024-06-15", "date", {})).toBe("2024-06-15");
  });

  it("reads an array, a function and an unknown key as options with no precision", () => {
    const input = "2024-06-15T10:30:00Z";
    expect(formatFHIR(input, "dateTime", [] as FhirFormatOptions)).toBe(input);
    expect(formatFHIR(input, "dateTime", (() => 0) as FhirFormatOptions)).toBe(
      input,
    );
    expect(
      formatFHIR(input, "dateTime", { other: 1 } as FhirFormatOptions),
    ).toBe(input);
  });

  it("accepts options with precision undefined", () => {
    expect(formatFHIR("2024-06-15", "date", { precision: undefined })).toBe(
      "2024-06-15",
    );
  });

  it.each(BAD_OPTIONS)("returns '' for the options $label", ({ options }) => {
    expect(
      formatFHIR(
        "2024-06-15T10:30:00Z",
        "dateTime",
        options as FhirFormatOptions,
      ),
    ).toBe("");
  });

  it.each(NON_STRINGS.map(([label, make]) => ({ label, make })))(
    "returns '' without throwing for the value or type $label",
    ({ make }) => {
      expect(formatFHIR(make() as string, "dateTime")).toBe("");
      expect(formatFHIR("2024-06-15", make() as FhirDateType)).toBe("");
    },
  );

  describe("properties", () => {
    const identity = FHIR_PARSE_ROWS.flatMap(({ input }) =>
      TYPES.filter(
        (type) => isValidFHIR(input, type) && !input.includes(":60"),
      ).map((type) => ({ input, type })),
    );

    it.each(identity)(
      "writes the valid $type '$input' back unchanged",
      ({ input, type }) => {
        expect(formatFHIR(input, type)).toBe(input);
      },
    );

    it.each(ROWS.filter((r) => r.expected !== ""))(
      "the result '$expected' of '$input' is a valid $type",
      ({ expected, type }) => {
        expect(isValidFHIR(expected, type)).toBe(true);
      },
    );

    it.each`
      input                              | precision
      ${"2024"}                          | ${"year"}
      ${"2024-06"}                       | ${"month"}
      ${"2024-06-15"}                    | ${"day"}
      ${"2024-06-15T10:30:00-05:00"}     | ${"second"}
      ${"2024-06-15T10:30:00.250-05:00"} | ${"fraction"}
    `(
      "keeps the precision $precision of '$input' through formatFHIR and parseFHIR",
      ({ input, precision }: { input: string; precision: FhirPrecision }) => {
        expect(parseFHIR(formatFHIR(input, "dateTime"))?.precision).toBe(
          precision,
        );
      },
    );
  });
});
