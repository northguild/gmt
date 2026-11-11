import { fhirDateTime } from "../regex/fhir";
import {
  FHIR_PRECISIONS,
  FHIR_TYPE_PRECISIONS,
  fhirTypeAllows,
  readFhirValue,
} from "./fhirDateTime";
import type { FhirDateType, FhirPrecision } from "../types";

describe("fhirTypeAllows", () => {
  // issue Design note "One parser, three validators": date takes year/month/day, instant takes
  // second/fraction, dateTime takes all five.
  const allowed: Record<FhirDateType, FhirPrecision[]> = {
    date: ["year", "month", "day"],
    dateTime: ["year", "month", "day", "second", "fraction"],
    instant: ["second", "fraction"],
  };
  const cases = (Object.keys(allowed) as FhirDateType[]).flatMap((type) =>
    (["year", "month", "day", "second", "fraction"] as FhirPrecision[]).map(
      (precision) => ({
        type,
        precision,
        expected: allowed[type].includes(precision),
      }),
    ),
  );

  it.each(cases)(
    "answers $expected for type '$type' at precision '$precision'",
    ({ type, precision, expected }) => {
      expect(fhirTypeAllows(type, precision)).toBe(expected);
    },
  );

  it.each([
    { type: "toString" },
    { type: "__proto__" },
    { type: undefined },
    { type: "DateTime" },
    { type: "time" },
  ])("is false for the unknown type $type", ({ type }) => {
    expect(fhirTypeAllows(type, "year")).toBe(false);
  });
});

describe("FHIR precision tables", () => {
  it("freezes FHIR_PRECISIONS, coarsest first", () => {
    expect(FHIR_PRECISIONS).toStrictEqual([
      "year",
      "month",
      "day",
      "second",
      "fraction",
    ]);
    expect(Object.isFrozen(FHIR_PRECISIONS)).toBe(true);
  });

  it.each(["date", "dateTime", "instant"] as const)(
    "freezes the precisions of '%s'",
    (type) => {
      expect(Object.isFrozen(FHIR_TYPE_PRECISIONS[type])).toBe(true);
    },
  );

  it("freezes FHIR_TYPE_PRECISIONS itself", () => {
    expect(Object.isFrozen(FHIR_TYPE_PRECISIONS)).toBe(true);
  });
});

describe("readFhirValue", () => {
  it("reads each field from the group number the reader relies on", () => {
    const m = fhirDateTime.exec("2016-12-31T23:59:60.5-00:00");
    expect(m?.[1]).toBe("2016");
    expect(m?.[5]).toBe("12");
    expect(m?.[7]).toBe("31");
    expect(m?.[10]).toBe("60");
    expect(m?.[11]).toBe(".5");
    expect(m?.[12]).toBe("-00:00");
  });

  it("returns the input string itself as value", () => {
    expect(readFhirValue("2024-06-15T10:30:00-00:00")?.value).toBe(
      "2024-06-15T10:30:00-00:00",
    );
  });

  // A String object, a number and an array all stringify to "2024": only the typeof check
  // refuses them.
  it.each([
    { label: "new String('2024')", make: () => new String("2024") },
    { label: "2024", make: () => 2024 },
    { label: "['2024']", make: () => ["2024"] },
  ])("returns null for the non-string $label", ({ make }) => {
    expect(readFhirValue(make())).toBeNull();
  });
});
