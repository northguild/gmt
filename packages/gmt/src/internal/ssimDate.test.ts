import {
  readSsimDateFields,
  SSIM_MONTH_LETTERS,
  writeSsimDate,
} from "./ssimDate";

describe("SSIM_MONTH_LETTERS", () => {
  it("holds twelve upper-case three-letter codes", () => {
    const bad = SSIM_MONTH_LETTERS.filter((m) => !/^[A-Z]{3}$/.test(m));
    expect({
      count: bad.length,
      first: bad.slice(0, 3),
      length: SSIM_MONTH_LETTERS.length,
    }).toEqual({ count: 0, first: [], length: 12 });
  });
});

describe("readSsimDateFields", () => {
  it.each`
    value        | expected
    ${"01JAN26"} | ${{ day: 1, month: 1, yy: 26 }}
    ${"31DEC99"} | ${{ day: 31, month: 12, yy: 99 }}
    ${"00JAN00"} | ${{ day: 0, month: 1, yy: 0 }}
    ${"32JAN26"} | ${{ day: 32, month: 1, yy: 26 }}
  `(
    "reads the shape of '$value' without checking the date",
    ({ value, expected }) => {
      expect(readSsimDateFields(value)).toEqual(expected);
    },
  );

  it.each`
    letters  | month
    ${"JAN"} | ${1}
    ${"FEB"} | ${2}
    ${"MAR"} | ${3}
    ${"APR"} | ${4}
    ${"MAY"} | ${5}
    ${"JUN"} | ${6}
    ${"JUL"} | ${7}
    ${"AUG"} | ${8}
    ${"SEP"} | ${9}
    ${"OCT"} | ${10}
    ${"NOV"} | ${11}
    ${"DEC"} | ${12}
  `("reads $letters as month $month", ({ letters, month }) => {
    expect(readSsimDateFields(`15${letters}26`)).toEqual({
      day: 15,
      month,
      yy: 26,
    });
  });

  it.each`
    value            | label
    ${"01jan26"}     | ${"lower case"}
    ${"01Jan26"}     | ${"title case"}
    ${"01jAN26"}     | ${"mixed case"}
    ${"01JANV26"}    | ${"French"}
    ${"01SEPT26"}    | ${"long form"}
    ${"01ENE26"}     | ${"Spanish"}
    ${"01MRZ26"}     | ${"German"}
    ${"01OCA26"}     | ${"Turkish"}
    ${"1JAN26"}      | ${"one-digit day"}
    ${"001JAN26"}    | ${"three-digit day"}
    ${"01JAN6"}      | ${"one-digit year"}
    ${"01JAN2026"}   | ${"four-digit year"}
    ${"01JAN"}       | ${"no year"}
    ${" 01JAN26"}    | ${"leading space"}
    ${"01JAN26 "}    | ${"trailing space"}
    ${"01JAN26\n"}   | ${"trailing newline"}
    ${"01 JAN 26"}   | ${"spaced"}
    ${"01-JAN-26"}   | ${"hyphenated"}
    ${"０１JAN２６"} | ${"full-width digits"}
    ${"٠١JAN٢٦"}     | ${"Arabic-Indic digits"}
    ${"00XXX00"}     | ${"XXX is not a month"}
    ${"X01JAN26"}    | ${"leading letter: the pattern is anchored at the start"}
    ${"01JAN26X"}    | ${"trailing letter: the pattern is anchored at the end"}
    ${"01JAN٢٦"}     | ${"Arabic-Indic year digits"}
    ${""}            | ${"empty"}
  `("returns null for '$value' ($label)", ({ value }) => {
    expect(readSsimDateFields(value)).toBeNull();
  });
});

describe("writeSsimDate", () => {
  it.each`
    day   | month | yy    | expected
    ${1}  | ${1}  | ${26} | ${"01JAN26"}
    ${25} | ${10} | ${26} | ${"25OCT26"}
    ${31} | ${12} | ${0}  | ${"31DEC00"}
    ${9}  | ${9}  | ${5}  | ${"09SEP05"}
  `("writes $day/$month/$yy as '$expected'", ({ day, month, yy, expected }) => {
    expect(writeSsimDate(day, month, yy)).toBe(expected);
  });
});

describe("reader and writer together", () => {
  it("reads back every day-month pair the writer produces", () => {
    const bad: string[] = [];
    for (const yy of [0, 26, 99]) {
      for (let month = 1; month <= 12; month++) {
        for (let day = 1; day <= 31; day++) {
          const text = writeSsimDate(day, month, yy);
          const f = readSsimDateFields(text);
          if (f?.day !== day || f.month !== month || f.yy !== yy) {
            bad.push(text);
          }
        }
      }
    }
    expect({ count: bad.length, first: bad.slice(0, 3) }).toEqual({
      count: 0,
      first: [],
    });
  });

  it("calls no case conversion", () => {
    const spies = (
      [
        "toUpperCase",
        "toLowerCase",
        "toLocaleUpperCase",
        "toLocaleLowerCase",
      ] as const
    ).map((name) => vi.spyOn(String.prototype, name));
    try {
      for (const v of ["01JAN26", "01jan26", "00XXX00", "", "０１JAN２６"]) {
        readSsimDateFields(v);
      }
      writeSsimDate(1, 1, 26);
      writeSsimDate(31, 12, 0);
      expect(spies.map((s) => s.mock.calls.length)).toEqual([0, 0, 0, 0]);
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });
});
