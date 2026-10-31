import { isValidIsoDateLike } from "./isValidIsoDateLike";
import { arrives, NON_STRINGS } from "../../test/nonStrings";

describe("isValidIsoDateLike", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T23:59:59"}
    ${"2024-02-29T12:30:45.123"}
    ${"+001234-12-31"}
    ${"+001234-12-31T23:59:59"}
  `(
    "returns true for valid date or datetime string $value",
    ({ value }: { value: string }) => {
      expect(isValidIsoDateLike(value)).toBe(true);
    },
  );

  it.each`
    value                               | label
    ${"2024-02-30"}                     | ${"'2024-02-30'"}
    ${"2024-02-29T24:00:00"}            | ${"'2024-02-29T24:00:00'"}
    ${"2024-02-29T12:60:00"}            | ${"'2024-02-29T12:60:00'"}
    ${"2024-02-29T12:30:60"}            | ${"'2024-02-29T12:30:60'"}
    ${"2024-02-29T12:30:45.1234567890"} | ${"'2024-02-29T12:30:45.1234567890'"}
    ${"invalid-date"}                   | ${"'invalid-date'"}
    ${""}                               | ${"''"}
  `(
    "returns false for invalid date or datetime string $label",
    ({ value }: { value: string }) => {
      expect(isValidIsoDateLike(value)).toBe(false);
    },
  );

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    value                                   | expected
    ${"2024-02-29[foo=bar]"}                | ${true}
    ${"2024-02-29T12:00[u-ca=iso8601]"}     | ${true}
    ${"2024-02-29T12:00[America/New_York]"} | ${true}
    ${"2024-02-29[!foo=bar]"}               | ${false}
    ${"2024-02-29[u-ca=hebrew]"}            | ${false}
    ${"2024-02-29T23:59:60[foo=bar]"}       | ${false}
  `(
    "reads the annotations of $value as Temporal does → $expected",
    ({ value, expected }) => {
      expect(isValidIsoDateLike(value)).toBe(expected);
    },
  );
});

describe("isValidIsoDateLike with any value", () => {
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidIsoDateLike(make()), kind).toBe(false);
    }
  });

  it("returns true for a valid string typed unknown, as for a string", () => {
    expect(isValidIsoDateLike(arrives("2024-02-29"))).toBe(true);
    expect(isValidIsoDateLike("2024-02-29")).toBe(true);
  });
});

describe("isValidIsoDateLike types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("2024-02-29");
    if (isValidIsoDateLike(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidIsoDateLike(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "invalid";
    if (!isValidIsoDateLike(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidIsoDateLike(input)).toBe(false);
  });

  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidIsoDateLike(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("2024-02-29")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidIsoDateLike(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("2024-02-29")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "2024-02-29", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidIsoDateLike);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["2024-02-29"]);
  });
});
