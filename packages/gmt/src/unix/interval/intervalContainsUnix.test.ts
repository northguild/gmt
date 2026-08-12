import { intervalContainsUnix } from "./intervalContainsUnix";

describe("intervalContainsUnix", () => {
  it.each`
    intervalStart | intervalEnd   | pointOrStart  | pointEnd     | expected
    ${0}          | ${1700000000} | ${170000000}  | ${undefined} | ${true}
    ${0}          | ${1700000000} | ${0}          | ${undefined} | ${true}
    ${0}          | ${1700000000} | ${1700000000} | ${undefined} | ${true}
    ${1000}       | ${1000}       | ${1000}       | ${undefined} | ${true}
    ${0}          | ${1700000000} | ${-100}       | ${undefined} | ${false}
    ${0}          | ${1700000000} | ${2000000000} | ${undefined} | ${false}
  `(
    "returns $expected for point $pointOrStart in Unix interval $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsUnix(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart | intervalEnd   | innerStart    | innerEnd      | expected
    ${0}          | ${1700000000} | ${100000}     | ${1000000}    | ${true}
    ${0}          | ${1700000000} | ${0}          | ${1700000000} | ${true}
    ${0}          | ${1700000000} | ${1700000000} | ${1700000000} | ${true}
    ${1000}       | ${1000}       | ${1000}       | ${1000}       | ${true}
    ${0}          | ${1700000000} | ${-100}       | ${100000}     | ${false}
    ${0}          | ${1700000000} | ${1000000}    | ${2000000000} | ${false}
    ${0}          | ${1700000000} | ${1000000}    | ${100000}     | ${false}
  `(
    "returns $expected for inner interval $innerStart to $innerEnd inside $intervalStart to $intervalEnd",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsUnix(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart | intervalEnd | pointOrStart | pointEnd     | expected
    ${1700000000} | ${0}        | ${170000000} | ${undefined} | ${false}
    ${1700000000} | ${0}        | ${170000000} | ${1000000}   | ${false}
    ${1000}       | ${1000}     | ${1000}      | ${500}       | ${false}
  `(
    "returns $expected for reversed outer interval",
    ({ intervalStart, intervalEnd, pointOrStart, pointEnd, expected }) => {
      expect(
        intervalContainsUnix(
          intervalStart,
          intervalEnd,
          pointOrStart,
          pointEnd,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart | intervalEnd   | innerStart | innerEnd   | expected
    ${0}          | ${1700000000} | ${1000000} | ${100000}  | ${false}
    ${0}          | ${1700000000} | ${2000000} | ${1000000} | ${false}
  `(
    "returns $expected for reversed inner interval",
    ({ intervalStart, intervalEnd, innerStart, innerEnd, expected }) => {
      expect(
        intervalContainsUnix(intervalStart, intervalEnd, innerStart, innerEnd),
      ).toBe(expected);
    },
  );

  it.each`
    intervalStart | intervalEnd   | pointOrStart
    ${NaN}        | ${1700000000} | ${170000000}
    ${Infinity}   | ${1700000000} | ${170000000}
    ${-Infinity}  | ${1700000000} | ${170000000}
    ${1700000000} | ${NaN}        | ${170000000}
    ${1700000000} | ${Infinity}   | ${170000000}
    ${1700000000} | ${-Infinity}  | ${170000000}
    ${1700000000} | ${1700000000} | ${NaN}
    ${1700000000} | ${1700000000} | ${Infinity}
    ${1700000000} | ${1700000000} | ${-Infinity}
  `(
    "returns false for non-finite: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsUnix(
          intervalStart as never,
          intervalEnd as never,
          pointOrStart as never,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart | intervalEnd   | pointOrStart | pointEnd
    ${null}       | ${1700000000} | ${170000000} | ${undefined}
    ${undefined}  | ${1700000000} | ${170000000} | ${undefined}
    ${"abc"}      | ${1700000000} | ${170000000} | ${undefined}
    ${1700000000} | ${null}       | ${170000000} | ${undefined}
    ${1700000000} | ${undefined}  | ${170000000} | ${undefined}
    ${1700000000} | ${"abc"}      | ${170000000} | ${undefined}
    ${1700000000} | ${1700000000} | ${null}      | ${undefined}
    ${1700000000} | ${1700000000} | ${undefined} | ${undefined}
    ${1700000000} | ${1700000000} | ${"abc"}     | ${undefined}
  `(
    "returns false for non-numeric input: $intervalStart, $intervalEnd, $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsUnix(
          intervalStart as never,
          intervalEnd as never,
          pointOrStart as never,
          undefined,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart | intervalEnd   | innerStart   | innerEnd
    ${null}       | ${1700000000} | ${170000000} | ${1000000}
    ${1700000000} | ${null}       | ${170000000} | ${1000000}
    ${1700000000} | ${1700000000} | ${null}      | ${1000000}
    ${1700000000} | ${1700000000} | ${170000000} | ${null}
    ${1700000000} | ${1700000000} | ${"abc"}     | ${1000000}
    ${1700000000} | ${1700000000} | ${170000000} | ${"abc"}
  `(
    "returns false for non-numeric 4-arg input",
    ({ intervalStart, intervalEnd, innerStart, innerEnd }) => {
      expect(
        intervalContainsUnix(
          intervalStart as never,
          intervalEnd as never,
          innerStart as never,
          innerEnd as never,
        ),
      ).toBe(false);
    },
  );

  it.each`
    intervalStart | intervalEnd     | pointOrStart
    ${"0"}        | ${"1700000000"} | ${"170000000"}
    ${"0"}        | ${"1700000000"} | ${"0"}
    ${"0"}        | ${"1700000000"} | ${"1700000000"}
  `(
    "accepts string inputs: $pointOrStart",
    ({ intervalStart, intervalEnd, pointOrStart }) => {
      expect(
        intervalContainsUnix(
          intervalStart,
          intervalEnd,
          pointOrStart,
          undefined,
        ),
      ).toBe(true);
    },
  );
});
