import { Temporal } from "@js-temporal/polyfill";
import { advanceBusinessDays } from "./advanceBusinessDays";

const testDay = "2024-02-29"; // Thursday
const testFriday = "2024-03-08"; // Friday

describe("advanceBusinessDays", () => {
  describe("forward advancement (direction: 1)", () => {
    it.each`
      start      | target | expected
      ${testDay} | ${0}   | ${"2024-02-29"}
      ${testDay} | ${1}   | ${"2024-03-01"}
      ${testDay} | ${2}   | ${"2024-03-04"}
      ${testDay} | ${3}   | ${"2024-03-05"}
      ${testDay} | ${4}   | ${"2024-03-06"}
      ${testDay} | ${5}   | ${"2024-03-07"}
      ${testDay} | ${6}   | ${"2024-03-08"}
    `(
      "advances $target business day from $start -> $expected",
      ({ start, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          1,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );

    it.each`
      start         | target | expected
      ${testFriday} | ${1}   | ${"2024-03-11"}
      ${testFriday} | ${2}   | ${"2024-03-12"}
      ${testFriday} | ${3}   | ${"2024-03-13"}
      ${testFriday} | ${4}   | ${"2024-03-14"}
      ${testFriday} | ${5}   | ${"2024-03-15"}
      ${testFriday} | ${10}  | ${"2024-03-22"}
    `(
      "advances $target business days from Friday $start -> $expected",
      ({ start, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          1,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );

    it.each`
      start      | target | expected
      ${testDay} | ${5}   | ${"2024-03-07"}
      ${testDay} | ${6}   | ${"2024-03-08"}
      ${testDay} | ${10}  | ${"2024-03-14"}
      ${testDay} | ${11}  | ${"2024-03-15"}
      ${testDay} | ${15}  | ${"2024-03-21"}
    `(
      "advances $target business days from Monday $start -> $expected",
      ({ start, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          1,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );

    it.each`
      start      | target | expected
      ${testDay} | ${2}   | ${"2024-03-04"}
      ${testDay} | ${3}   | ${"2024-03-05"}
      ${testDay} | ${5}   | ${"2024-03-07"}
      ${testDay} | ${10}  | ${"2024-03-14"}
      ${testDay} | ${15}  | ${"2024-03-21"}
      ${testDay} | ${20}  | ${"2024-03-28"}
      ${testDay} | ${50}  | ${"2024-05-09"}
      ${testDay} | ${100} | ${"2024-07-18"}
      ${testDay} | ${200} | ${"2024-12-05"}
    `(
      "advances $target business days (large) from $start -> $expected",
      ({ start, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          1,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );
  });

  describe("backward advancement (direction: -1)", () => {
    it.each`
      start      | target | expected
      ${testDay} | ${0}   | ${"2024-02-29"}
      ${testDay} | ${1}   | ${"2024-02-28"}
      ${testDay} | ${2}   | ${"2024-02-27"}
      ${testDay} | ${3}   | ${"2024-02-26"}
      ${testDay} | ${4}   | ${"2024-02-23"}
      ${testDay} | ${5}   | ${"2024-02-22"}
      ${testDay} | ${6}   | ${"2024-02-21"}
    `(
      "goes back $target business day from $start -> $expected",
      ({ start, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          -1,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );

    it.each`
      start         | target | expected
      ${testFriday} | ${1}   | ${"2024-03-07"}
      ${testFriday} | ${2}   | ${"2024-03-06"}
      ${testFriday} | ${3}   | ${"2024-03-05"}
      ${testFriday} | ${4}   | ${"2024-03-04"}
      ${testFriday} | ${5}   | ${"2024-03-01"}
      ${testFriday} | ${10}  | ${"2024-02-23"}
    `(
      "goes back $target business days from Friday $start -> $expected",
      ({ start, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          -1,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );

    it.each`
      start      | target | expected
      ${testDay} | ${5}   | ${"2024-02-22"}
      ${testDay} | ${6}   | ${"2024-02-21"}
      ${testDay} | ${10}  | ${"2024-02-15"}
      ${testDay} | ${11}  | ${"2024-02-14"}
      ${testDay} | ${15}  | ${"2024-02-08"}
    `(
      "goes back $target business days from Monday $start -> $expected",
      ({ start, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          -1,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );

    it.each`
      start      | target | expected
      ${testDay} | ${2}   | ${"2024-02-27"}
      ${testDay} | ${5}   | ${"2024-02-22"}
      ${testDay} | ${10}  | ${"2024-02-15"}
      ${testDay} | ${20}  | ${"2024-02-01"}
      ${testDay} | ${50}  | ${"2023-12-21"}
      ${testDay} | ${100} | ${"2023-10-12"}
      ${testDay} | ${200} | ${"2023-05-25"}
    `(
      "goes back $target business days (large) from $start -> $expected",
      ({ start, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          -1,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );
  });

  describe("edge cases", () => {
    it.each`
      start      | direction | target | expected
      ${testDay} | ${1}      | ${1}   | ${"2024-03-01"}
      ${testDay} | ${1}      | ${3}   | ${"2024-03-05"}
      ${testDay} | ${-1}     | ${1}   | ${"2024-02-28"}
      ${testDay} | ${-1}     | ${3}   | ${"2024-02-26"}
    `(
      "handles $direction direction from $start with target $target -> $expected",
      ({ start, direction, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          direction,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );

    it.each`
      start      | direction | target  | expectedYear
      ${testDay} | ${1}      | ${1000} | ${2027}
      ${testDay} | ${-1}     | ${1000} | ${2020}
    `(
      "handles large $direction direction $target business days from $start (year $expectedYear)",
      ({ start, direction, target, expectedYear }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          direction,
          target,
        );
        expect(result.year).toBe(expectedYear);
      },
    );

    it.each`
      start      | direction | target | expected
      ${testDay} | ${1}      | ${1}   | ${"2024-03-01"}
      ${testDay} | ${1}      | ${2}   | ${"2024-03-04"}
      ${testDay} | ${1}      | ${3}   | ${"2024-03-05"}
      ${testDay} | ${1}      | ${4}   | ${"2024-03-06"}
      ${testDay} | ${1}      | ${5}   | ${"2024-03-07"}
      ${testDay} | ${1}      | ${6}   | ${"2024-03-08"}
      ${testDay} | ${1}      | ${7}   | ${"2024-03-11"}
    `(
      "single day forward from $start ($expected) -> $expected",
      ({ start, direction, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          direction,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );

    it.each`
      start      | direction | target | expected
      ${testDay} | ${-1}     | ${1}   | ${"2024-02-28"}
      ${testDay} | ${-1}     | ${2}   | ${"2024-02-27"}
      ${testDay} | ${-1}     | ${3}   | ${"2024-02-26"}
      ${testDay} | ${-1}     | ${4}   | ${"2024-02-23"}
      ${testDay} | ${-1}     | ${5}   | ${"2024-02-22"}
      ${testDay} | ${-1}     | ${6}   | ${"2024-02-21"}
      ${testDay} | ${-1}     | ${7}   | ${"2024-02-20"}
    `(
      "single day backward from $start -> $expected",
      ({ start, direction, target, expected }) => {
        const result = advanceBusinessDays(
          Temporal.PlainDate.from(start),
          direction,
          target,
        );
        expect(result.toString()).toBe(expected);
      },
    );
  });
});
