import { isBetweenUtc } from "./isBetweenUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("isBetweenUtc", () => {
  // Canonical inputs
  const earlyInput = "2024-01-01T00:00:00Z";
  const midInput = "2024-02-15T12:00:00Z";
  const lateInput = "2024-05-01T00:00:00Z";
  const preRangeInput = "2023-12-01T00:00:00Z";

  it.each`
    value            | start         | end          | expected
    ${midInput}      | ${earlyInput} | ${lateInput} | ${true}
    ${earlyInput}    | ${earlyInput} | ${lateInput} | ${true}
    ${lateInput}     | ${earlyInput} | ${lateInput} | ${true}
    ${preRangeInput} | ${earlyInput} | ${lateInput} | ${false}
  `(
    "returns $expected for value $value between $start and $end with default inclusive options",
    ({ value, start, end, expected }) => {
      expect(isBetweenUtc(value, start, end)).toBe(expected);
    },
  );

  it.each`
    value                     | start         | end                       | inclusiveStart | inclusiveEnd | expected
    ${midInput}               | ${earlyInput} | ${lateInput}              | ${false}       | ${true}      | ${true}
    ${"2024-01-01T12:00:00Z"} | ${earlyInput} | ${lateInput}              | ${false}       | ${true}      | ${true}
    ${"2024-04-01T12:00:00Z"} | ${earlyInput} | ${"2024-02-28T23:59:59Z"} | ${true}        | ${false}     | ${false}
    ${midInput}               | ${earlyInput} | ${lateInput}              | ${false}       | ${false}     | ${true}
    ${"2024-03-01T00:00:00Z"} | ${earlyInput} | ${lateInput}              | ${false}       | ${false}     | ${true}
  `(
    "returns $expected for value $value between $start and $end with inclusiveStart $inclusiveStart and inclusiveEnd $inclusiveEnd",
    ({ value, start, end, inclusiveStart, inclusiveEnd, expected }) => {
      expect(
        isBetweenUtc(value, start, end, { inclusiveStart, inclusiveEnd }),
      ).toBe(expected);
    },
  );

  it.each`
    value         | start         | end
    ${"invalid"}  | ${earlyInput} | ${lateInput}
    ${earlyInput} | ${"invalid"}  | ${lateInput}
    ${earlyInput} | ${earlyInput} | ${"invalid"}
    ${""}         | ${earlyInput} | ${lateInput}
    ${null}       | ${earlyInput} | ${lateInput}
  `(
    "returns false for invalid inputs: $value | $start | $end",
    ({ value, start, end }) => {
      expect(isBetweenUtc(value as never, start as never, end as never)).toBe(
        false,
      );
    },
  );

  it.each`
    value       | start        | end           | expected
    ${midInput} | ${lateInput} | ${earlyInput} | ${false}
  `(
    "returns $expected when start is after end",
    ({ value, start, end, expected }) => {
      expect(isBetweenUtc(value, start, end)).toBe(expected);
    },
  );

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(isBetweenUtc(midInput, earlyInput, lateInput)).toBe(false);
  });
});
