import {
  digitSetOf,
  referenceYear,
  withoutYear,
  type Reference,
} from "./weekYearText";

/*
 * The reference formatter prints the year alone, but the host's root data may add an era to it.
 * UTS #35 Part 4 §8 makes the era (`G`) a name, never a number, so a digit inside a word is part
 * of that name: ICU data without coptic era names prints the placeholder `ERA1` ("1740 ERA1"),
 * and its `1` is not a second year. No current host prints a placeholder in root; these rows
 * pin the rule for one that does. Only root (`und`) text reaches these functions.
 */
function printing(text: string): Reference {
  return {
    format: { format: () => text } as unknown as Intl.DateTimeFormat,
    digits: digitSetOf("latn"),
  };
}

describe("referenceYear", () => {
  it.each`
    text           | expected  | label
    ${"1740"}      | ${"1740"} | ${"a year alone"}
    ${"1740 ERA1"} | ${"1740"} | ${"a year beside a placeholder era name that holds a digit"}
    ${"AM 1740"}   | ${"1740"} | ${"a year after an era name"}
    ${"R6"}        | ${"6"}    | ${"a single number glued to an era letter"}
    ${"12 34"}     | ${null}   | ${"two numbers, neither inside a word"}
    ${"ERA1"}      | ${"1"}    | ${"a single number, even inside a word"}
    ${""}          | ${null}   | ${"no number"}
  `(
    "reads $expected from '$text' ($label)",
    ({ text, expected }: { text: string; expected: string | null }) => {
      expect(referenceYear(printing(text), 0)).toBe(expected);
    },
  );
});

/*
 * An era is compared with its year removed. The year is the number that stands on its own; a
 * number inside a word is part of the era's name (UTS #35 Part 4 §8, `G`), so the placeholder
 * eras `ERA0` and `ERA1` stay apart. With one number only, that number is the year, even beside a
 * letter. `R6` and `令和6年` are unit rows for that rule: root text, the only input, prints
 * `6 Reiwa`.
 */
describe("withoutYear", () => {
  it.each`
    text           | expected    | label
    ${"4932 ERA0"} | ${" ERA0"}  | ${"the placeholder era before AM 1"}
    ${"2026 ERA1"} | ${" ERA1"}  | ${"the placeholder era from AM 1"}
    ${"2016 AM"}   | ${" AM"}    | ${"an era name with no digit"}
    ${"6 Reiwa"}   | ${" Reiwa"} | ${"a Japanese era name after the year"}
    ${"R6"}        | ${"R"}      | ${"a year glued to an era letter"}
    ${"令和6年"}   | ${"令和年"} | ${"a year between CJK letters"}
    ${"12 34"}     | ${" "}      | ${"two numbers, neither inside a word"}
    ${""}          | ${""}       | ${"no text"}
  `(
    "keeps '$expected' of '$text' ($label)",
    ({ text, expected }: { text: string; expected: string }) => {
      expect(withoutYear(text, digitSetOf("latn"))).toBe(expected);
    },
  );
});
