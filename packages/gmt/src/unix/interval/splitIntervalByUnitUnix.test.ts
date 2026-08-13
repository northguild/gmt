import { splitIntervalByUnitUnix } from "./splitIntervalByUnitUnix";

describe("splitIntervalByUnitUnix", () => {
  const expectedExactDivision = [
    { start: 0, end: 21600000 },
    { start: 21600000, end: 43200000 },
    { start: 43200000, end: 64800000 },
    { start: 64800000, end: 86400000 },
  ];

  const expectedRemainder = [
    { start: 0, end: 3600000 },
    { start: 3600000, end: 5400000 },
  ];

  const expectedDayUnit = [
    { start: 0, end: 172800000 },
    { start: 172800000, end: 345600000 },
    { start: 345600000, end: 518400000 },
    { start: 518400000, end: 691200000 },
    { start: 691200000, end: 864000000 },
  ];

  const expectedZeroLength = [{ start: 0, end: 0 }];

  const expectedSingleStep = [{ start: 0, end: 3600000 }];

  it.each`
    start  | end           | unit      | amount | expected
    ${0}   | ${86400000}   | ${"hour"} | ${6}   | ${expectedExactDivision}
    ${0}   | ${5400000}    | ${"hour"} | ${1}   | ${expectedRemainder}
    ${0}   | ${864000000}  | ${"day"}  | ${2}   | ${expectedDayUnit}
    ${"0"} | ${"86400000"} | ${"hour"} | ${6}   | ${expectedExactDivision}
  `(
    "returns $expected for $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start | end        | unit      | amount | expected
    ${0}  | ${0}       | ${"hour"} | ${1}   | ${expectedZeroLength}
    ${0}  | ${3600000} | ${"hour"} | ${2}   | ${expectedSingleStep}
  `(
    "returns $expected for edge-case $start..$end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start        | end          | unit         | amount
    ${NaN}       | ${86400000}  | ${"hour"}    | ${1}
    ${Infinity}  | ${86400000}  | ${"hour"}    | ${1}
    ${-Infinity} | ${86400000}  | ${"hour"}    | ${1}
    ${0}         | ${NaN}       | ${"hour"}    | ${1}
    ${0}         | ${Infinity}  | ${"hour"}    | ${1}
    ${0}         | ${-Infinity} | ${"hour"}    | ${1}
    ${86400000}  | ${0}         | ${"hour"}    | ${1}
    ${0}         | ${86400000}  | ${"invalid"} | ${1}
    ${0}         | ${86400000}  | ${""}        | ${1}
    ${0}         | ${86400000}  | ${"hour"}    | ${0}
    ${0}         | ${86400000}  | ${"hour"}    | ${-1}
    ${0}         | ${86400000}  | ${"hour"}    | ${1.5}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitUnix(start, end, unit, amount)).toEqual([]);
    },
  );

  it.each`
    start        | end          | unit         | amount
    ${null}      | ${86400000}  | ${"hour"}    | ${1}
    ${undefined} | ${86400000}  | ${"hour"}    | ${1}
    ${"abc"}     | ${86400000}  | ${"hour"}    | ${1}
    ${true}      | ${86400000}  | ${"hour"}    | ${1}
    ${[]}        | ${86400000}  | ${"hour"}    | ${1}
    ${{}}        | ${86400000}  | ${"hour"}    | ${1}
    ${0}         | ${null}      | ${"hour"}    | ${1}
    ${0}         | ${undefined} | ${"hour"}    | ${1}
    ${0}         | ${"abc"}     | ${"hour"}    | ${1}
    ${0}         | ${true}      | ${"hour"}    | ${1}
    ${0}         | ${[]}        | ${"hour"}    | ${1}
    ${0}         | ${{}}        | ${"hour"}    | ${1}
    ${0}         | ${86400000}  | ${null}      | ${1}
    ${0}         | ${86400000}  | ${undefined} | ${1}
    ${0}         | ${86400000}  | ${123}       | ${1}
    ${0}         | ${86400000}  | ${true}      | ${1}
    ${0}         | ${86400000}  | ${[]}        | ${1}
    ${0}         | ${86400000}  | ${{}}        | ${1}
    ${0}         | ${86400000}  | ${"hour"}    | ${null}
    ${0}         | ${86400000}  | ${"hour"}    | ${undefined}
    ${0}         | ${86400000}  | ${"hour"}    | ${"1"}
    ${0}         | ${86400000}  | ${"hour"}    | ${true}
  `(
    "returns [] for non-string or non-number input: $start, $end, $unit, $amount",
    ({ start, end, unit, amount }) => {
      expect(
        splitIntervalByUnitUnix(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );
});
