/*
 * The inputs of `parseHL7.test.ts`, written once so `isValidHL7.test.ts` can assert, for every
 * row, `isValidHL7(input) === (parseHL7(input) !== null)`. Test-only: the build leaves it out.
 * Every expected value was decided from HL7 v2.5.1 2.A.22 / 2.A.77.2 (see the spec's Authority
 * table) before the parser existed.
 */

import type { Hl7DateTime } from "../types";

/** A string that parses, and what it reads as. */
export interface Hl7ParseRow {
  input: string;
  expected: Hl7DateTime;
}

const instant = (
  input: string,
  instant: string,
  offset: string,
  local: string,
  precision: Extract<Hl7DateTime, { kind: "instant" }>["precision"],
): Hl7ParseRow => ({
  input,
  expected: { kind: "instant", instant, offset, local, precision },
});

const local = (
  input: string,
  localValue: string,
  precision: Extract<Hl7DateTime, { kind: "local" }>["precision"],
): Hl7ParseRow => ({
  input,
  expected: { kind: "local", local: localValue, precision },
});

const partial = (
  input: string,
  localValue: string,
  offset: string,
  precision: Extract<Hl7DateTime, { kind: "partial" }>["precision"],
): Hl7ParseRow => ({
  input,
  expected: { kind: "partial", local: localValue, offset, precision },
});

/** `DTM` strings (2.A.22) that parse. */
export const hl7DtmRows: readonly Hl7ParseRow[] = [
  instant(
    "20240615103000-0500",
    "2024-06-15T15:30:00Z",
    "-05:00",
    "2024-06-15T10:30:00",
    "second",
  ),
  local("20240615103000", "2024-06-15T10:30:00", "second"),
  instant(
    "202406151030+0200",
    "2024-06-15T08:30:00Z",
    "+02:00",
    "2024-06-15T10:30:00",
    "minute",
  ),
  local("202406151030", "2024-06-15T10:30:00", "minute"),
  instant(
    "20240615103000.1234+0000",
    "2024-06-15T10:30:00.1234Z",
    "+00:00",
    "2024-06-15T10:30:00.1234",
    "fraction",
  ),
  instant(
    "20240615103000.1000+0000",
    "2024-06-15T10:30:00.1Z",
    "+00:00",
    "2024-06-15T10:30:00.1000",
    "fraction",
  ),
  local("20240615103000.5", "2024-06-15T10:30:00.5", "fraction"),
  instant(
    "20240615103000-0000",
    "2024-06-15T10:30:00Z",
    "+00:00",
    "2024-06-15T10:30:00",
    "second",
  ),
  instant(
    "20240615103000+2300",
    "2024-06-14T11:30:00Z",
    "+23:00",
    "2024-06-15T10:30:00",
    "second",
  ),
  partial("2024", "2024", "", "year"),
  partial("202406", "2024-06", "", "month"),
  partial("20240615", "2024-06-15", "", "day"),
  partial("2024061510", "2024-06-15T10", "", "hour"),
  partial("20240615-0500", "2024-06-15", "-05:00", "day"),
  partial("2024-0000", "2024", "+00:00", "year"),
  partial("0000", "0000", "", "year"),
  // the range limits of Temporal's instant, polyfill-checked
  instant(
    "00000101000000+2359",
    "-000001-12-31T00:01:00Z",
    "+23:59",
    "0000-01-01T00:00:00",
    "second",
  ),
  instant(
    "99991231235959.9999-2359",
    "+010000-01-01T23:58:59.9999Z",
    "-23:59",
    "9999-12-31T23:59:59.9999",
    "fraction",
  ),
  local("198807050000", "1988-07-05T00:00:00", "minute"),
  partial("20240229", "2024-02-29", "", "day"),
  // leap days: every fourth year, and the 400-year century
  partial("20000229", "2000-02-29", "", "day"),
  local("20240229235959", "2024-02-29T23:59:59", "second"),
  instant(
    "20240229235959-0500",
    "2024-03-01T04:59:59Z",
    "-05:00",
    "2024-02-29T23:59:59",
    "second",
  ),
  // year 0000 at finer precisions
  partial("0000-0500", "0000", "-05:00", "year"),
  local("000001010000", "0000-01-01T00:00:00", "minute"),
  instant(
    "000001010000+0000",
    "0000-01-01T00:00:00Z",
    "+00:00",
    "0000-01-01T00:00:00",
    "minute",
  ),
  // a fraction of 1 to 4 digits, without and with an offset
  local("20240615103000.12", "2024-06-15T10:30:00.12", "fraction"),
  local("20240615103000.123", "2024-06-15T10:30:00.123", "fraction"),
  local("20240615103000.1234", "2024-06-15T10:30:00.1234", "fraction"),
  local("20240615103000.0000", "2024-06-15T10:30:00.0000", "fraction"),
  instant(
    "20240615103000.5+0200",
    "2024-06-15T08:30:00.5Z",
    "+02:00",
    "2024-06-15T10:30:00.5",
    "fraction",
  ),
  instant(
    "20240615103000.12+0000",
    "2024-06-15T10:30:00.12Z",
    "+00:00",
    "2024-06-15T10:30:00.12",
    "fraction",
  ),
  instant(
    "20240615103000.123-0500",
    "2024-06-15T15:30:00.123Z",
    "-05:00",
    "2024-06-15T10:30:00.123",
    "fraction",
  ),
  instant(
    "20240615103000.0000+0000",
    "2024-06-15T10:30:00Z",
    "+00:00",
    "2024-06-15T10:30:00.0000",
    "fraction",
  ),
  // offset range edges
  instant(
    "202406151030-2359",
    "2024-06-16T10:29:00Z",
    "-23:59",
    "2024-06-15T10:30:00",
    "minute",
  ),
  instant(
    "202406151030+0059",
    "2024-06-15T09:31:00Z",
    "+00:59",
    "2024-06-15T10:30:00",
    "minute",
  ),
  partial("202406-0000", "2024-06", "+00:00", "month"),
  partial("2024061510+0200", "2024-06-15T10", "+02:00", "hour"),
];

/** `TS` strings (2.A.77) that parse. */
export const hl7TsRows: readonly Hl7ParseRow[] = [
  local("20240615103000^S", "2024-06-15T10:30:00", "second"),
  partial("20240615103000^D", "2024-06-15", "", "day"),
  partial("199904011200^L", "1999-04", "", "month"),
  instant(
    "20240615103045-0500^M",
    "2024-06-15T15:30:00Z",
    "-05:00",
    "2024-06-15T10:30:00",
    "minute",
  ),
  partial("20240615103045^H", "2024-06-15T10", "", "hour"),
  partial("20240615103045+0100^Y", "2024", "+01:00", "year"),
  local("20240615103045.9876^S", "2024-06-15T10:30:45", "second"),
  partial("20240615^", "2024-06-15", "", "day"),
  // an empty trailing component is not present (ch. 2 §2.6.1.1, §2.6.2)
  partial("20240615^D^", "2024-06-15", "", "day"),
  partial("20240615^^", "2024-06-15", "", "day"),
  partial("20240615^Y^", "2024", "", "year"),
  instant(
    "20240615103000+0000^S^",
    "2024-06-15T10:30:00Z",
    "+00:00",
    "2024-06-15T10:30:00",
    "second",
  ),
  partial("20240615103000+0000^D", "2024-06-15", "+00:00", "day"),
  local("20240615103000.5^M", "2024-06-15T10:30:00", "minute"),
  local("20240615103000.5^S", "2024-06-15T10:30:00", "second"),
  instant(
    "20240615103000.5+0100^S",
    "2024-06-15T09:30:00Z",
    "+01:00",
    "2024-06-15T10:30:00",
    "second",
  ),
  // components and subcomponents not expected are ignored (ch. 2 §2.6.2, §2.8.1, §2.8.2)
  partial("20240615^D^X", "2024-06-15", "", "day"),
  partial("20240615^^D", "2024-06-15", "", "day"),
  partial("20240615^D^X^", "2024-06-15", "", "day"),
  partial("2024&X", "2024", "", "year"),
  partial("2024^Y&X", "2024", "", "year"),
  partial("20240615^D&X", "2024-06-15", "", "day"),
  partial("20240615&X^D", "2024-06-15", "", "day"),
  local("20240615103000&X&Y^S&Z^Q", "2024-06-15T10:30:00", "second"),
  instant(
    "202406151030-0500&X^M",
    "2024-06-15T15:30:00Z",
    "-05:00",
    "2024-06-15T10:30:00",
    "minute",
  ),
];

/** Strings that return `null`. */
export const hl7NullRows: readonly string[] = [
  // a degree finer than the digits (2.A.77.2 "may not indicate greater precision")
  // the whole DTM is checked even when the degree lowers the precision (2.A.77.2)
  "20240615106000^D",
  "20240615103060^Y",
  "20240230^Y",
  "20240615240000^D",
  "20240615^S",
  "2024^L",
  "202406151030^S",
  "202406^D",
  "2024061510^M",
  "20240615^H",
  "20240615^S^",
  // the subcomponent is cut, then D is finer than the year sent
  "2024^D&X",
  "2024&X^D",
  // unknown, lower-case and padded degrees, an empty DTM
  "20240615^X",
  "20240615^d",
  "20240615^ D",
  "^D",
  "^^",
  "^^D",
  "&X",
  "&X^D",
  "^D&X",
  "20240615^toString",
  "20240615^__proto__",
  "20240615^constructor",
  // the null value is the two quotes alone, with nothing but empty components after them
  "",
  '"',
  '"""',
  '""^D',
  '""^D^',
  ' ""',
  '"" ',
  // out-of-range fields and days the month lacks
  "20240615240000",
  "20240615106000",
  "20240615103060",
  "20240230",
  "20231301",
  "20230229",
  "20240600",
  "2024061524",
  "202406152400",
  "20240615240000.5",
  "20240615103060.5",
  "20240615103061",
  "20240615106000.5",
  "202400",
  "202413",
  "20240000",
  "20230229103000",
  "19000229",
  "20240431",
  // fractions
  "20240615103000.12345",
  "20240615103000.",
  "202406151030.5",
  // offsets
  "20240615103000+010",
  "20240615103000+05",
  "20240615103000+2400",
  "20240615103000+0560",
  "20240615103000Z",
  "2024+2400",
  "20240615-2400",
  "2024061510+0060",
  "202406151030-0060",
  "20240615103000.5+2400",
  "20240615103000 +0000",
  "20240615103000+00:00",
  // ISO, not HL7
  "2024-06-15",
  "2024-06-15T10:30:00Z",
  // padding and wrong lengths
  " 20240615",
  "20240615 ",
  "202",
  "2024061",
];

/**
 * Strings that read as the HL7 null value (ch. 2 §2.5.3): `""` alone, with empty components,
 * which are not present, or with components and subcomponents not expected, which are ignored
 * (ch. 2 §2.6.2).
 */
export const hl7NullValueInputs: readonly string[] = [
  '""',
  '""^',
  '""^^',
  '""^^X',
  '""&X',
];

/** Every string input above, for the `isValidHL7` agreement test. */
export const hl7AllStringInputs: readonly string[] = [
  ...hl7DtmRows.map((row) => row.input),
  ...hl7TsRows.map((row) => row.input),
  ...hl7NullRows,
  ...hl7NullValueInputs,
];
