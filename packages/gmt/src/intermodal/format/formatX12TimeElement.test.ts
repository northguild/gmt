import { Temporal } from "@js-temporal/polyfill";
import { expectTypeOf, vi } from "vitest";
import {
  CUT_X12_FORMATS,
  NON_STRINGS,
  NOT_X12_FORMATS,
  X12_FORMAT_KINDS,
} from "../../test/ediCodes";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import type { X12TimeElementForm } from "../../types/edi";
import { parseX12Time } from "../parse/parseX12Time";
import { formatX12TimeElement } from "./formatX12TimeElement";

/**
 * X12 data element 337 (Time), release 005010: "HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD, where
 * H = hours (00-23), M = minutes (00-59), S = integer seconds (00-59) and DD = decimal seconds;
 * decimal seconds are expressed as follows: D = tenths (0-9) and DD = hundredths (00-99)".
 *
 * Every expected value is the ISO 8601 time placed under the mask by hand: one digit per
 * character of the mask, each field zero-padded. `D` is the whole tenths of the second and `DD`
 * its whole hundredths; what the mask has no character for is left out, never rounded.
 */

const FORMS = ["HHMM", "HHMMSS", "HHMMSSD", "HHMMSSDD"] as const;

/**
 * Each form's precision as plain Temporal states it: the unit a time is cut to. A tenth of a
 * second is 100 milliseconds and a hundredth is 10.
 */
const CUT: Record<
  X12TimeElementForm,
  {
    smallestUnit: "minute" | "second" | "millisecond";
    roundingIncrement: number;
  }
> = {
  HHMM: { smallestUnit: "minute", roundingIncrement: 1 },
  HHMMSS: { smallestUnit: "second", roundingIncrement: 1 },
  HHMMSSD: { smallestUnit: "millisecond", roundingIncrement: 100 },
  HHMMSSDD: { smallestUnit: "millisecond", roundingIncrement: 10 },
};

/** What reading a hostile object as a string does. */
function throwing(): never {
  throw new TypeError("read as a string");
}

/** A time cut to a form's precision by plain Temporal, never by the code under test. */
function cutTo(value: string, form: X12TimeElementForm): string {
  return Temporal.PlainTime.from(value)
    .round({ ...CUT[form], roundingMode: "trunc" })
    .toString();
}

/**
 * Each form's precision as plain Temporal writes it: `HH:MM`, `HH:MM:SS`, and one or two digits
 * of the fraction of the second.
 */
const WRITTEN: Record<X12TimeElementForm, Temporal.ToStringPrecisionOptions> = {
  HHMM: { smallestUnit: "minute" },
  HHMMSS: { smallestUnit: "second" },
  HHMMSSD: { fractionalSecondDigits: 1 },
  HHMMSSDD: { fractionalSecondDigits: 2 },
};

/**
 * The digits of a time under a form, by plain Temporal and never by the code under test: its
 * string at the form's precision, truncated, without its colons and its decimal point.
 */
function digitsOf(value: string, form: X12TimeElementForm): string {
  return Temporal.PlainTime.from(value)
    .toString({ ...WRITTEN[form], roundingMode: "trunc" })
    .replaceAll(":", "")
    .replace(".", "");
}

/** The four expected columns of a row, keyed by the form each is written under. */
function byForm(row: {
  hhmm: string;
  hhmmss: string;
  tenths: string;
  hundredths: string;
}): [X12TimeElementForm, string][] {
  return [
    ["HHMM", row.hhmm],
    ["HHMMSS", row.hhmmss],
    ["HHMMSSD", row.tenths],
    ["HHMMSSDD", row.hundredths],
  ];
}

describe("formatX12TimeElement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("each form writes the digits its mask names", () => {
    it.each`
      form          | value            | expected      | reads
      ${"HHMM"}     | ${"14:30"}       | ${"1430"}     | ${"hours and minutes"}
      ${"HHMM"}     | ${"14:30:00"}    | ${"1430"}     | ${"zero seconds"}
      ${"HHMM"}     | ${"09:05"}       | ${"0905"}     | ${"each field zero-padded"}
      ${"HHMMSS"}   | ${"14:30:45"}    | ${"143045"}   | ${"with seconds"}
      ${"HHMMSS"}   | ${"14:30"}       | ${"143000"}   | ${"no seconds given: written as 00"}
      ${"HHMMSSD"}  | ${"14:30:45.5"}  | ${"1430455"}  | ${"five tenths"}
      ${"HHMMSSD"}  | ${"14:30:00.12"} | ${"1430001"}  | ${"twelve hundredths holds one whole tenth"}
      ${"HHMMSSD"}  | ${"14:30:45"}    | ${"1430450"}  | ${"no fraction given: written as 0"}
      ${"HHMMSSD"}  | ${"14:30"}       | ${"1430000"}  | ${"no seconds given: written as 00 and 0"}
      ${"HHMMSSDD"} | ${"14:30:00.12"} | ${"14300012"} | ${"twelve hundredths"}
      ${"HHMMSSDD"} | ${"14:30:00,12"} | ${"14300012"} | ${"a comma is ISO 8601's other decimal sign, and Temporal's"}
      ${"HHMMSSDD"} | ${"14:30:45.5"}  | ${"14304550"} | ${"five tenths is fifty hundredths"}
      ${"HHMMSSDD"} | ${"14:30:45.05"} | ${"14304505"} | ${"five hundredths: the tenths digit is 0"}
      ${"HHMMSSDD"} | ${"09:05:03.07"} | ${"09050307"} | ${"each field zero-padded"}
      ${"HHMMSSDD"} | ${"14:30:00"}    | ${"14300000"} | ${"no fraction given: written as 00"}
      ${"HHMMSSDD"} | ${"14:30"}       | ${"14300000"} | ${"no seconds given: written as 00 and 00"}
    `(
      "writes $value under $form as $expected ($reads)",
      ({ form, value, expected }) => {
        expect(formatX12TimeElement(value, form)).toBe(expected);
      },
    );
  });

  describe("precision is cut to the mask, never rounded", () => {
    // 0.9 of a second is 9 whole tenths and 90 whole hundredths; 0.99 and 0.999 are still 9
    // whole tenths and 99 whole hundredths; 0.129 is 1 whole tenth and 12 whole hundredths.
    it.each`
      value                   | tenths       | hundredths    | reads
      ${"14:30:45.9"}         | ${"1430459"} | ${"14304590"} | ${"nine tenths"}
      ${"14:30:45.99"}        | ${"1430459"} | ${"14304599"} | ${"0.99 is not rounded up to the next second"}
      ${"14:30:45.999"}       | ${"1430459"} | ${"14304599"} | ${"0.999 is not rounded up to the next second"}
      ${"14:30:45.129"}       | ${"1430451"} | ${"14304512"} | ${"0.129 is not rounded up to 13 hundredths"}
      ${"14:30:45.09"}        | ${"1430450"} | ${"14304509"} | ${"nine hundredths is no whole tenth"}
      ${"14:30:45.009"}       | ${"1430450"} | ${"14304500"} | ${"nine thousandths is no whole hundredth"}
      ${"14:30:45.123456789"} | ${"1430451"} | ${"14304512"} | ${"digits below the hundredth are gone"}
      ${"23:59:59.999999999"} | ${"2359599"} | ${"23595999"} | ${"the last nanosecond of the day stays in second 59"}
    `(
      "writes $value as $tenths under HHMMSSD and $hundredths under HHMMSSDD ($reads)",
      ({ value, tenths, hundredths }) => {
        expect(formatX12TimeElement(value, "HHMMSSD")).toBe(tenths);
        expect(formatX12TimeElement(value, "HHMMSSDD")).toBe(hundredths);
      },
    );

    it.each`
      form        | value                   | expected    | reads
      ${"HHMM"}   | ${"14:30:45"}           | ${"1430"}   | ${"seconds are dropped: the mask has none"}
      ${"HHMM"}   | ${"14:30:59.999999999"} | ${"1430"}   | ${"the last nanosecond of the minute is still that minute"}
      ${"HHMM"}   | ${"23:59:59.999"}       | ${"2359"}   | ${"the last millisecond of the day stays in minute 59: never 0000"}
      ${"HHMMSS"} | ${"14:30:45.999"}       | ${"143045"} | ${"0.999 of a second is dropped, not rounded up"}
      ${"HHMMSS"} | ${"14:30:00.12"}        | ${"143000"} | ${"a fraction is dropped: the mask has none"}
      ${"HHMMSS"} | ${"23:59:59.999999999"} | ${"235959"} | ${"the last nanosecond of the day"}
    `(
      "writes $value under $form as $expected ($reads)",
      ({ form, value, expected }) => {
        expect(formatX12TimeElement(value, form)).toBe(expected);
      },
    );

    // Each edge of the cut, in the last second of an hour: rounding any of them up would name
    // a later tenth, a later second, or 15:00. Each column is the value with the digits its
    // mask has no character for left off, checked against plain Temporal's truncating string.
    it.each`
      value                   | hhmm      | hhmmss      | tenths       | hundredths    | reads
      ${"14:59:59.000000001"} | ${"1459"} | ${"145959"} | ${"1459590"} | ${"14595900"} | ${"one nanosecond is no whole hundredth"}
      ${"14:59:59.099999999"} | ${"1459"} | ${"145959"} | ${"1459590"} | ${"14595909"} | ${"one nanosecond under a tenth: no whole tenth, nine whole hundredths"}
      ${"14:59:59.1"}         | ${"1459"} | ${"145959"} | ${"1459591"} | ${"14595910"} | ${"one tenth exactly"}
      ${"14:59:59.19"}        | ${"1459"} | ${"145959"} | ${"1459591"} | ${"14595919"} | ${"nineteen hundredths hold one whole tenth"}
      ${"14:59:59.199999999"} | ${"1459"} | ${"145959"} | ${"1459591"} | ${"14595919"} | ${"one nanosecond under two tenths"}
      ${"14:59:59.99"}        | ${"1459"} | ${"145959"} | ${"1459599"} | ${"14595999"} | ${"the last hundredth of the second"}
      ${"14:59:59.999999999"} | ${"1459"} | ${"145959"} | ${"1459599"} | ${"14595999"} | ${"the last nanosecond of the hour: never 1500"}
    `(
      "writes $value as $hhmm, $hhmmss, $tenths and $hundredths under the four forms ($reads)",
      ({ value, ...row }) => {
        for (const [form, expected] of byForm(row)) {
          expect(digitsOf(value, form), form).toBe(expected);
          expect(formatX12TimeElement(value, form), form).toBe(expected);
        }
      },
    );

    // Every millisecond of one second, each with 999,999 nanoseconds below it, so nothing a mask
    // drops is ever zero. `values` is how many values the form has for one second: the minute,
    // the second, its 10 tenths or its 100 hundredths. The form alone fixes the width of the
    // field, and a later time never writes an earlier value.
    it.each`
      form          | values
      ${"HHMM"}     | ${1}
      ${"HHMMSS"}   | ${1}
      ${"HHMMSSD"}  | ${10}
      ${"HHMMSSDD"} | ${100}
    `(
      "$form writes the 1,000 milliseconds of 14:59:59 as $values value(s), each the digits plain Temporal truncates to",
      ({ form, values }: { form: X12TimeElementForm; values: number }) => {
        const written: string[] = [];
        for (let millisecond = 0; millisecond < 1000; millisecond++) {
          const value = new Temporal.PlainTime(
            14,
            59,
            59,
            millisecond,
            999,
            999,
          ).toString();
          const wire = formatX12TimeElement(value, form);
          expect(wire, value).toBe(digitsOf(value, form));
          expect(wire, value).toHaveLength(form.length);
          written.push(wire);
        }
        expect(written).toEqual([...written].sort());
        expect(new Set(written).size).toBe(values);
      },
    );
  });

  describe("round trip from the wire: a value reads, then writes back to itself under its own form", () => {
    // `time` is what element 337 says the digits mean, written by hand. `parseX12Time` drops a
    // zero fraction (`14300000` is `14:30:00`), and the form puts it back: the form, not the
    // value, fixes the width.
    it.each`
      wire          | form          | time
      ${"1430"}     | ${"HHMM"}     | ${"14:30:00"}
      ${"0000"}     | ${"HHMM"}     | ${"00:00:00"}
      ${"2359"}     | ${"HHMM"}     | ${"23:59:00"}
      ${"143045"}   | ${"HHMMSS"}   | ${"14:30:45"}
      ${"000000"}   | ${"HHMMSS"}   | ${"00:00:00"}
      ${"235959"}   | ${"HHMMSS"}   | ${"23:59:59"}
      ${"1430001"}  | ${"HHMMSSD"}  | ${"14:30:00.1"}
      ${"1430000"}  | ${"HHMMSSD"}  | ${"14:30:00"}
      ${"1430455"}  | ${"HHMMSSD"}  | ${"14:30:45.5"}
      ${"0000000"}  | ${"HHMMSSD"}  | ${"00:00:00"}
      ${"2359599"}  | ${"HHMMSSD"}  | ${"23:59:59.9"}
      ${"14300012"} | ${"HHMMSSDD"} | ${"14:30:00.12"}
      ${"14300000"} | ${"HHMMSSDD"} | ${"14:30:00"}
      ${"14304550"} | ${"HHMMSSDD"} | ${"14:30:45.5"}
      ${"14304505"} | ${"HHMMSSDD"} | ${"14:30:45.05"}
      ${"00000000"} | ${"HHMMSSDD"} | ${"00:00:00"}
      ${"23595999"} | ${"HHMMSSDD"} | ${"23:59:59.99"}
    `(
      "$wire reads as $time and writes back as $wire under $form",
      ({ wire, form, time }) => {
        expect(wire).toHaveLength(form.length);
        expect(parseX12Time(wire)).toBe(time);
        expect(formatX12TimeElement(time, form)).toBe(wire);
        expect(formatX12TimeElement(parseX12Time(wire), form)).toBe(wire);
      },
    );

    // Every value the two decimal parts can hold: `D` is 0–9 and `DD` is 00–99. `time` is that
    // many tenths (100 ms) or hundredths (10 ms) after 14:30:45, built by plain Temporal, which
    // writes no trailing zero: 50 hundredths and 5 tenths are both `14:30:45.5`.
    it.each`
      form          | values | milliseconds
      ${"HHMMSSD"}  | ${10}  | ${100}
      ${"HHMMSSDD"} | ${100} | ${10}
    `(
      "each of the $values decimal values of $form reads as that many times $milliseconds ms and writes back to itself",
      ({
        form,
        values,
        milliseconds,
      }: {
        form: X12TimeElementForm;
        values: number;
        milliseconds: number;
      }) => {
        for (let decimal = 0; decimal < values; decimal++) {
          const wire = `143045${String(decimal).padStart(form.length - 6, "0")}`;
          const time = new Temporal.PlainTime(
            14,
            30,
            45,
            decimal * milliseconds,
          ).toString();
          expect(parseX12Time(wire), wire).toBe(time);
          expect(formatX12TimeElement(time, form), wire).toBe(wire);
        }
      },
    );
  });

  describe("round trip across forms: a value read from one form is written under any of the four", () => {
    // `time` is what element 337 says the digits mean, written by hand. A narrower form drops
    // the digits it has no character for, and a wider one writes zeros: `14304550` and `1430455`
    // are the same time, and each writes back as the other under the other's form.
    it.each`
      wire          | time             | hhmm      | hhmmss      | tenths       | hundredths
      ${"14304550"} | ${"14:30:45.5"}  | ${"1430"} | ${"143045"} | ${"1430455"} | ${"14304550"}
      ${"1430455"}  | ${"14:30:45.5"}  | ${"1430"} | ${"143045"} | ${"1430455"} | ${"14304550"}
      ${"14304559"} | ${"14:30:45.59"} | ${"1430"} | ${"143045"} | ${"1430455"} | ${"14304559"}
      ${"143045"}   | ${"14:30:45"}    | ${"1430"} | ${"143045"} | ${"1430450"} | ${"14304500"}
      ${"1430"}     | ${"14:30:00"}    | ${"1430"} | ${"143000"} | ${"1430000"} | ${"14300000"}
      ${"23595999"} | ${"23:59:59.99"} | ${"2359"} | ${"235959"} | ${"2359599"} | ${"23595999"}
    `(
      "$wire reads as $time, and writes as $hhmm, $hhmmss, $tenths and $hundredths",
      ({ wire, time, ...row }) => {
        expect(parseX12Time(wire)).toBe(time);
        for (const [form, expected] of byForm(row)) {
          expect(digitsOf(time, form), form).toBe(expected);
          expect(formatX12TimeElement(parseX12Time(wire), form), form).toBe(
            expected,
          );
        }
      },
    );
  });

  describe("round trip from a time: it writes, then reads back cut to the form", () => {
    // `cut` is the time with everything below the form's last character removed, written by
    // hand and checked against plain Temporal's truncating `round`.
    it.each`
      value                   | form          | cut
      ${"14:30"}              | ${"HHMM"}     | ${"14:30:00"}
      ${"14:30:45.999"}       | ${"HHMM"}     | ${"14:30:00"}
      ${"23:59:59.999999999"} | ${"HHMM"}     | ${"23:59:00"}
      ${"14:30"}              | ${"HHMMSS"}   | ${"14:30:00"}
      ${"14:30:45.999"}       | ${"HHMMSS"}   | ${"14:30:45"}
      ${"23:59:59.999999999"} | ${"HHMMSS"}   | ${"23:59:59"}
      ${"14:30"}              | ${"HHMMSSD"}  | ${"14:30:00"}
      ${"14:30:00.12"}        | ${"HHMMSSD"}  | ${"14:30:00.1"}
      ${"14:30:45.999"}       | ${"HHMMSSD"}  | ${"14:30:45.9"}
      ${"14:30:45.09"}        | ${"HHMMSSD"}  | ${"14:30:45"}
      ${"23:59:59.999999999"} | ${"HHMMSSD"}  | ${"23:59:59.9"}
      ${"14:30"}              | ${"HHMMSSDD"} | ${"14:30:00"}
      ${"14:30:00.12"}        | ${"HHMMSSDD"} | ${"14:30:00.12"}
      ${"14:30:45.999"}       | ${"HHMMSSDD"} | ${"14:30:45.99"}
      ${"14:30:45.129"}       | ${"HHMMSSDD"} | ${"14:30:45.12"}
      ${"14:30:45.009"}       | ${"HHMMSSDD"} | ${"14:30:45"}
      ${"14:30:45.5"}         | ${"HHMMSSDD"} | ${"14:30:45.5"}
      ${"23:59:59.999999999"} | ${"HHMMSSDD"} | ${"23:59:59.99"}
    `("$value under $form reads back as $cut", ({ value, form, cut }) => {
      expect(cutTo(value, form)).toBe(cut);
      expect(parseX12Time(formatX12TimeElement(value, form))).toBe(cut);
      // A written value never names a later moment than its input.
      expect(Temporal.PlainTime.compare(cut, value)).toBeLessThanOrEqual(0);
    });
  });

  describe("the value is a time, as isValidTime accepts it", () => {
    // Every spelling of a time `isValidTime` accepts is written, and Temporal reads its fields:
    // ISO 8601's two decimal signs, up to nine digits of fraction, and an RFC 9557 annotation,
    // which `isValidTime` reads and ignores as `Temporal.PlainTime.from` does (a bracketed zone
    // with no offset names no instant, and a time has no calendar).
    it.each`
      value                           | hhmm      | hhmmss      | tenths       | hundredths    | reads
      ${"14:30:45,5"}                 | ${"1430"} | ${"143045"} | ${"1430455"} | ${"14304550"} | ${"a comma for the decimal sign"}
      ${"14:30:45,129999999"}         | ${"1430"} | ${"143045"} | ${"1430451"} | ${"14304512"} | ${"a comma and nanoseconds"}
      ${"14:30:45.50"}                | ${"1430"} | ${"143045"} | ${"1430455"} | ${"14304550"} | ${"a trailing zero in the fraction"}
      ${"14:30:45.000000000"}         | ${"1430"} | ${"143045"} | ${"1430450"} | ${"14304500"} | ${"nine zeros of fraction"}
      ${"14:30:45.12[Europe/Berlin]"} | ${"1430"} | ${"143045"} | ${"1430451"} | ${"14304512"} | ${"a bracketed zone and no offset: the annotation is ignored"}
      ${"14:30:45.12[u-ca=hebrew]"}   | ${"1430"} | ${"143045"} | ${"1430451"} | ${"14304512"} | ${"a calendar annotation: a time has no calendar"}
    `(
      "writes $value as $hhmm, $hhmmss, $tenths and $hundredths ($reads)",
      ({ value, ...row }) => {
        for (const [form, expected] of byForm(row)) {
          expect(digitsOf(value, form), form).toBe(expected);
          expect(formatX12TimeElement(value, form), form).toBe(expected);
        }
      },
    );

    it.each`
      value                                 | reads
      ${"2024-06-15T14:30:00"}              | ${"a date-time"}
      ${"2024-06-15"}                       | ${"a date"}
      ${"14:30:00+02:00"}                   | ${"a time with an offset"}
      ${"14:30:00Z"}                        | ${"a time with a UTC designator"}
      ${"14:30:45.12+02:00[Europe/Berlin]"} | ${"an offset and a bracketed zone"}
      ${"14:30:45.12Z[Europe/London]"}      | ${"a UTC designator and a bracketed zone"}
      ${"14:30[!foo=bar]"}                  | ${"an unknown critical annotation"}
      ${"T14:30"}                           | ${"a leading time designator"}
      ${"1430"}                             | ${"basic format: the input is extended ISO 8601"}
      ${"14300012"}                         | ${"the element's own digits: the input is ISO 8601"}
      ${"24:00"}                            | ${"hour 24"}
      ${"23:59:60"}                         | ${"a leap second"}
      ${"14:60"}                            | ${"minute 60"}
      ${"14:30:45.0999999999"}              | ${"ten digits of fraction: a time has nine at most"}
      ${"14:30:45."}                        | ${"a decimal sign and no digits"}
      ${"09:00/17:00"}                      | ${"a range of times"}
      ${"-14:30"}                           | ${"a sign"}
      ${" 14:30"}                           | ${"a leading space"}
      ${"14:30 "}                           | ${"a trailing space"}
      ${"14:30\n"}                          | ${"a trailing line feed"}
      ${"１４:３０"}                        | ${"full-width digits"}
      ${"HHMM"}                             | ${"a mask given as the value"}
      ${"__proto__"}                        | ${"an inherited property name"}
      ${""}                                 | ${"an empty value"}
    `("returns '' for $value under every form ($reads)", ({ value }) => {
      for (const form of FORMS) {
        expect(formatX12TimeElement(value, form), form).toBe("");
      }
    });
  });

  describe("the form is one of the four masks of element 337", () => {
    // The form is the element's own mask, matched exactly. A data element 1250 qualifier is
    // not a form: `TM` and `TS` belong to `formatX12Time`.
    it.each`
      form             | reads
      ${"TM"}          | ${"the 1250 qualifier for HHMM"}
      ${"TS"}          | ${"the 1250 qualifier for HHMMSS"}
      ${""}            | ${"an empty form"}
      ${"hhmm"}        | ${"lower case: matching is exact"}
      ${"HhMmSsDd"}    | ${"mixed case"}
      ${" HHMM"}       | ${"a leading space"}
      ${"HHMM "}       | ${"a trailing space"}
      ${"HH"}          | ${"hours alone: not a form of the element"}
      ${"HHMMS"}       | ${"five characters"}
      ${"HHMMSSDDD"}   | ${"thousandths: not a form of the element"}
      ${"HH:MM"}       | ${"a colon"}
      ${"HHMISS"}      | ${"an internal part name"}
      ${"337"}         | ${"the element's number"}
      ${"__proto__"}   | ${"an inherited property name"}
      ${"constructor"} | ${"an inherited property name"}
      ${"toString"}    | ${"an inherited property name"}
    `("returns '' for the form '$form' ($reads)", ({ form }) => {
      expect(formatX12TimeElement("14:30:45.12", form as never)).toBe("");
    });

    it.each`
      group                                  | codes
      ${"every 1250 code GMT reads"}         | ${Object.keys(X12_FORMAT_KINDS)}
      ${"every 1250 code cut from GMT"}      | ${CUT_X12_FORMATS.map(({ code }) => code)}
      ${"every string that is no 1250 code"} | ${NOT_X12_FORMATS.map(({ code }) => code)}
    `("returns '' for $group, given as the form", ({ codes }) => {
      expect((codes as string[]).length).toBeGreaterThan(0);
      for (const code of codes as string[]) {
        expect(formatX12TimeElement("14:30:45.12", code as never), code).toBe(
          "",
        );
      }
    });

    it("takes the four masks and no other string, as a type", () => {
      expectTypeOf(formatX12TimeElement)
        .parameter(1)
        .toEqualTypeOf<X12TimeElementForm>();
      expectTypeOf<X12TimeElementForm>().toEqualTypeOf<
        "HHMM" | "HHMMSS" | "HHMMSSD" | "HHMMSSDD"
      >();
    });
  });

  describe("non-string arguments", () => {
    it.each`
      argument   | call
      ${"value"} | ${(bad: unknown) => formatX12TimeElement(bad as never, "HHMMSSDD")}
      ${"form"}  | ${(bad: unknown) => formatX12TimeElement("14:30", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });

    // Nothing is coerced to a string. Each of the first three rows would be a mask if it were
    // (`String(["HHMM"])` is `"HHMM"`), and the next two throw when they are read as a string.
    // Built per use, so no row is read before the call.
    it.each`
      description                                    | make
      ${"a String object holding a mask"}            | ${() => new String("HHMM")}
      ${"an array holding a mask"}                   | ${() => ["HHMM"]}
      ${"an object whose toString returns a mask"}   | ${() => ({ toString: () => "HHMM" })}
      ${"an object whose toString throws"}           | ${() => ({ toString: throwing })}
      ${"an object whose Symbol.toPrimitive throws"} | ${() => ({ [Symbol.toPrimitive]: throwing })}
      ${"a symbol described as a mask"}              | ${() => Symbol("HHMM")}
      ${"the number of digits of a mask"}            | ${() => 4}
    `(
      "returns '' for a form that is $description",
      ({ make }: { make: () => unknown }) => {
        expect(formatX12TimeElement("14:30", make() as never)).toBe("");
      },
    );

    // The same for the value: the first three rows would be a time if they were coerced, and a
    // `Temporal.PlainTime` and a property bag are what `Temporal.PlainTime.from` itself takes.
    it.each`
      description                                    | make
      ${"a String object holding a time"}            | ${() => new String("14:30")}
      ${"an array holding a time"}                   | ${() => ["14:30"]}
      ${"an object whose toString returns a time"}   | ${() => ({ toString: () => "14:30" })}
      ${"a Temporal.PlainTime"}                      | ${() => new Temporal.PlainTime(14, 30)}
      ${"a property bag of an hour and a minute"}    | ${() => ({ hour: 14, minute: 30 })}
      ${"the number 1430"}                           | ${() => 1430}
      ${"an object whose toString throws"}           | ${() => ({ toString: throwing })}
      ${"an object whose Symbol.toPrimitive throws"} | ${() => ({ [Symbol.toPrimitive]: throwing })}
      ${"a symbol described as a time"}              | ${() => Symbol("14:30")}
    `(
      "returns '' under every form for a value that is $description",
      ({ make }: { make: () => unknown }) => {
        for (const form of FORMS) {
          expect(formatX12TimeElement(make() as never, form), form).toBe("");
        }
      },
    );

    it("returns '' for the two arguments in the other order", () => {
      expect(formatX12TimeElement("HHMMSSDD", "14:30:45.12" as never)).toBe("");
    });
  });

  it.each`
    form
    ${"HHMM"}
    ${"HHMMSS"}
    ${"HHMMSSD"}
    ${"HHMMSSDD"}
  `(
    "returns '' under $form when Temporal.PlainTime.from throws",
    ({ form }) => {
      mockTemporalPlainTimeFromThrow();
      expect(formatX12TimeElement("14:30", form)).toBe("");
    },
  );
});
