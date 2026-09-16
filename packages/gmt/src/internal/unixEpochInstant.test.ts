import {
  parseUnixEpochMilliseconds,
  unixEpochToInstant,
} from "./unixEpochInstant";

describe("parseUnixEpochMilliseconds", () => {
  it.each`
    value              | epochUnit         | expected         | description
    ${1710685845000}   | ${"milliseconds"} | ${1710685845000} | ${"a millisecond number"}
    ${"1710685845000"} | ${"milliseconds"} | ${1710685845000} | ${"a millisecond string"}
    ${"1710685845"}    | ${"seconds"}      | ${1710685845000} | ${"a second string, scaled by 1000"}
    ${" -86400 "}      | ${"seconds"}      | ${-86400000}     | ${"a padded negative string"}
    ${1.5}             | ${"milliseconds"} | ${1.5}           | ${"a finite fractional number, taken as-is"}
    ${""}              | ${"milliseconds"} | ${null}          | ${"an empty string, not the epoch"}
    ${"12.5"}          | ${"milliseconds"} | ${null}          | ${"a decimal string"}
    ${"1e3"}           | ${"milliseconds"} | ${null}          | ${"exponent notation"}
    ${"not-a-date"}    | ${"milliseconds"} | ${null}          | ${"a non-numeric string"}
    ${Number.NaN}      | ${"milliseconds"} | ${null}          | ${"NaN"}
    ${Infinity}        | ${"seconds"}      | ${null}          | ${"Infinity"}
    ${null}            | ${"milliseconds"} | ${null}          | ${"a non-string, non-number"}
  `(
    "returns $expected for $value in $epochUnit ($description)",
    ({ value, epochUnit, expected }) => {
      expect(parseUnixEpochMilliseconds(value, epochUnit)).toBe(expected);
    },
  );
});

describe("unixEpochToInstant", () => {
  it.each`
    value          | epochUnit         | expected                     | description
    ${0}           | ${"seconds"}      | ${"1970-01-01T00:00:00Z"}    | ${"the epoch"}
    ${8.64e15}     | ${"milliseconds"} | ${"+275760-09-13T00:00:00Z"} | ${"the last Temporal instant"}
    ${-8.64e15}    | ${"milliseconds"} | ${"-271821-04-20T00:00:00Z"} | ${"the first Temporal instant"}
    ${8.64e15 + 1} | ${"milliseconds"} | ${null}                      | ${"one millisecond past the range"}
    ${8.64e12 + 1} | ${"seconds"}      | ${null}                      | ${"one second past the range"}
    ${1.5}         | ${"milliseconds"} | ${null}                      | ${"a fractional millisecond"}
    ${"abc"}       | ${"seconds"}      | ${null}                      | ${"a non-numeric string"}
  `(
    "returns $expected for $value in $epochUnit ($description)",
    ({ value, epochUnit, expected }) => {
      expect(unixEpochToInstant(value, epochUnit)?.toString() ?? null).toBe(
        expected,
      );
    },
  );
});
