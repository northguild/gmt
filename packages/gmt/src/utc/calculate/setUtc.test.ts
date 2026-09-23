import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { setUtc } from "./setUtc";

describe("setUtc", () => {
  const canonicalInput = "2024-03-10T12:00:00Z";

  it.each`
    value             | fields                     | expected
    ${canonicalInput} | ${{ hour: 9 }}             | ${"2024-03-10T09:00:00Z"}
    ${canonicalInput} | ${{ year: 2025 }}          | ${"2025-03-10T12:00:00Z"}
    ${canonicalInput} | ${{ month: 6 }}            | ${"2024-06-10T12:00:00Z"}
    ${canonicalInput} | ${{ day: 20 }}             | ${"2024-03-20T12:00:00Z"}
    ${canonicalInput} | ${{ minute: 45 }}          | ${"2024-03-10T12:45:00Z"}
    ${canonicalInput} | ${{ year: 2025, hour: 9 }} | ${"2025-03-10T09:00:00Z"}
    ${canonicalInput} | ${{}}                      | ${"2024-03-10T12:00:00Z"}
  `(
    "returns $expected for $value with fields $fields",
    ({ value, fields, expected }) => {
      expect(setUtc(value, fields)).toBe(expected);
    },
  );

  it("resolves multi-field updates atomically regardless of field order in the object", () => {
    const value = "2024-01-31T12:00:00Z";
    const monthThenDay = setUtc(value, { month: 2, day: 5 });
    const dayThenMonth = setUtc(value, { day: 5, month: 2 });
    expect(monthThenDay).toBe("2024-02-05T12:00:00Z");
    expect(dayThenMonth).toBe("2024-02-05T12:00:00Z");
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-03-10T12:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for an invalid UTC datetime $invalidValue",
    ({ invalidValue }) => {
      expect(setUtc(invalidValue as never, { hour: 9 })).toBe("");
    },
  );

  it.each`
    value                     | fields          | overflow       | expected
    ${"2024-01-31T12:00:00Z"} | ${{ month: 2 }} | ${undefined}   | ${"2024-02-29T12:00:00Z"}
    ${"2024-01-31T12:00:00Z"} | ${{ month: 2 }} | ${"constrain"} | ${"2024-02-29T12:00:00Z"}
    ${"2024-01-31T12:00:00Z"} | ${{ month: 2 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value with fields $fields and overflow $overflow",
    ({ value, fields, overflow, expected }) => {
      expect(
        setUtc(
          value,
          fields,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  // `disambiguation` and `offset` were removed in 1.16.0: a UTC instant's wall clock is never
  // ambiguous and carries a fixed +00:00 offset, so neither had anything to act on. Passing one is a
  // type error, and a JavaScript caller's stray property changes nothing.
  it("treats the removed disambiguation option as a type error and ignores it at runtime", () => {
    expect(
      setUtc(
        canonicalInput,
        { hour: 9 },
        // @ts-expect-error -- `disambiguation` was removed in 1.16.0
        { disambiguation: "reject" },
      ),
    ).toBe("2024-03-10T09:00:00Z");
  });
  it("treats the removed offset option as a type error and ignores it at runtime", () => {
    expect(
      setUtc(
        canonicalInput,
        { hour: 9 },
        // @ts-expect-error -- `offset` was removed in 1.16.0
        { offset: "reject" },
      ),
    ).toBe("2024-03-10T09:00:00Z");
  });

  it("returns an empty string when the with() call throws for a malformed fields object", () => {
    expect(setUtc(canonicalInput, { hour: Number.NaN })).toBe("");
  });

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(setUtc(canonicalInput, { hour: 9 })).toBe("");
  });
});
