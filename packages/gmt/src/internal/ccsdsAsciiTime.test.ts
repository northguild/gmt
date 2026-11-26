import {
  CCSDS_ASCII_A,
  CCSDS_ASCII_B,
  ccsdsCodeAText,
  ccsdsCodeBText,
  ccsdsInstantText,
  readCcsdsAsciiA,
  readCcsdsAsciiB,
} from "./ccsdsAsciiTime";
import { Temporal } from "./temporal";
import { parseUtcReading } from "./utcReading";
import { CCSDS_ASCII_CASES } from "../test/ccsdsAsciiCases";

const rows = CCSDS_ASCII_CASES.map((row) => ({ ...row, label: row.codeA }));

describe("CCSDS_ASCII_A and CCSDS_ASCII_B", () => {
  it.each(rows)("matches Code A '$codeA' and not Code B", ({ codeA }) => {
    expect(CCSDS_ASCII_A.test(codeA)).toBe(true);
    expect(CCSDS_ASCII_B.test(codeA)).toBe(false);
  });

  it.each(rows)("matches Code B '$codeB' and not Code A", ({ codeB }) => {
    expect(CCSDS_ASCII_B.test(codeB)).toBe(true);
    expect(CCSDS_ASCII_A.test(codeB)).toBe(false);
  });

  it.each`
    value
    ${"2024-06-15T10:30:00"}
    ${"2024-06-15T10:30:00.1"}
    ${"2024-06-15T10:30:00.1234567890123Z"}
    ${"2024-06-15T10:30:60Z"}
  `(
    "Code A matches the optional-Z and long-fraction form '$value'",
    ({ value }) => {
      expect(CCSDS_ASCII_A.test(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-06-15"}
    ${"2024-06-15T10:30Z"}
    ${"10:30:00"}
    ${"2024-06-15T10:30:00."}
    ${"2024-06-15T10:30:00.Z"}
    ${"2024-06-15T10:30:00,5Z"}
    ${"2024-06-15T10:30:61Z"}
    ${"2024-06-15t10:30:00Z"}
    ${"2024-06-15T10:30:00z"}
    ${"2024-06-15 10:30:00Z"}
    ${"20240615T103000Z"}
    ${"2024-06-15T10:30:00+00:00"}
    ${"2024-06-15T10:30:00Z\n"}
    ${" 2024-06-15T10:30:00Z"}
    ${"٢٠٢٤-06-15T10:30:00Z"}
    ${"2024-6-15T10:30:00Z"}
    ${"+2024-06-15T10:30:00Z"}
    ${"2024-06-15T10:30:00ZZ"}
  `("Code A refuses '$value'", ({ value }) => {
    expect(CCSDS_ASCII_A.test(value)).toBe(false);
  });

  it.each`
    value
    ${"2024-167T10:30:00"}
    ${"2024-167T10:30:00.1234567890123Z"}
    ${"2024-167T10:30:60Z"}
    ${"2024-000T10:30:00Z"}
    ${"2024-999T10:30:00Z"}
  `(
    "Code B matches the optional-Z and long-fraction form '$value'",
    ({ value }) => {
      expect(CCSDS_ASCII_B.test(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-167"}
    ${"2024-167T10:30Z"}
    ${"2024-16T10:30:00Z"}
    ${"2024-1670T10:30:00Z"}
    ${"2024-167T10:30:00.Z"}
    ${"2024-167T10:30:61Z"}
    ${"2024-167t10:30:00Z"}
    ${"2024-167T10:30:00z"}
    ${"2024167T10:30:00Z"}
    ${"2024-167T10:30:00Z\n"}
    ${"٢٠٢٤-167T10:30:00Z"}
  `("Code B refuses '$value'", ({ value }) => {
    expect(CCSDS_ASCII_B.test(value)).toBe(false);
  });
});

describe("readCcsdsAsciiA", () => {
  it("reads every field of a code with a fraction", () => {
    expect(readCcsdsAsciiA("1988-01-18T17:20:43.123456Z")).toEqual({
      year: 1988,
      month: 1,
      day: 18,
      hour: 17,
      minute: 20,
      second: 43,
      fraction: "123456",
    });
  });

  it("reads a code with no fraction and no Z as an empty fraction", () => {
    expect(readCcsdsAsciiA("2024-02-29T12:00:00")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
      hour: 12,
      minute: 0,
      second: 0,
      fraction: "",
    });
  });

  it("keeps the first nine of twelve fraction digits", () => {
    expect(readCcsdsAsciiA("2024-06-15T10:30:00.123456789999Z")).toMatchObject({
      fraction: "123456789",
    });
  });

  it("keeps a second of 60 as sent", () => {
    expect(readCcsdsAsciiA("2016-12-31T23:59:60Z")).toMatchObject({
      second: 60,
    });
  });

  it("returns null for year 0000", () => {
    expect(readCcsdsAsciiA("0000-01-01T00:00:00Z")).toBeNull();
  });

  it.each`
    label                     | value
    ${"42"}                   | ${42}
    ${"null"}                 | ${null}
    ${"undefined"}            | ${undefined}
    ${'"1988-018T17:20:43Z"'} | ${"1988-018T17:20:43Z"}
    ${'"2024-06-15"'}         | ${"2024-06-15"}
  `("returns null for $label", ({ value }) => {
    expect(readCcsdsAsciiA(value)).toBeNull();
  });
});

describe("readCcsdsAsciiB", () => {
  it("reads every field of a code with a fraction", () => {
    expect(readCcsdsAsciiB("1988-018T17:20:43.123456Z")).toEqual({
      year: 1988,
      dayOfYear: 18,
      hour: 17,
      minute: 20,
      second: 43,
      fraction: "123456",
    });
  });

  it("reads a code with no fraction and no Z as an empty fraction", () => {
    expect(readCcsdsAsciiB("2024-366T00:00:00")).toMatchObject({
      dayOfYear: 366,
      fraction: "",
    });
  });

  it.each`
    value                   | dayOfYear
    ${"2024-000T00:00:00Z"} | ${0}
    ${"2024-367T00:00:00Z"} | ${367}
    ${"2024-999T00:00:00Z"} | ${999}
  `(
    "returns the day '$value' as written, unchecked",
    ({ value, dayOfYear }) => {
      expect(readCcsdsAsciiB(value)).toMatchObject({ dayOfYear });
    },
  );

  it("keeps the first nine of twelve fraction digits", () => {
    expect(readCcsdsAsciiB("2024-167T10:30:00.123456789999Z")).toMatchObject({
      fraction: "123456789",
    });
  });

  it("returns null for year 0000", () => {
    expect(readCcsdsAsciiB("0000-001T00:00:00Z")).toBeNull();
  });

  it.each`
    label                       | value
    ${"42"}                     | ${42}
    ${"null"}                   | ${null}
    ${"undefined"}              | ${undefined}
    ${'"1988-01-18T17:20:43Z"'} | ${"1988-01-18T17:20:43Z"}
  `("returns null for $label", ({ value }) => {
    expect(readCcsdsAsciiB(value)).toBeNull();
  });
});

describe("ccsdsInstantText", () => {
  it.each(rows)(
    "writes '$instant' from the fields of Code A '$codeA'",
    ({ codeA, instant }) => {
      const f = readCcsdsAsciiA(codeA)!;
      expect(
        ccsdsInstantText(
          Temporal.PlainDate.from({ year: f.year, month: f.month, day: f.day }),
          f,
        ),
      ).toBe(instant);
    },
  );

  it("keeps trailing zeros of the fraction", () => {
    expect(
      ccsdsInstantText(Temporal.PlainDate.from("2024-06-15"), {
        hour: 10,
        minute: 30,
        second: 0,
        fraction: "500000",
      }),
    ).toBe("2024-06-15T10:30:00.500000Z");
  });

  it("returns '' for a second of 60 on a day with no inserted second", () => {
    expect(
      ccsdsInstantText(Temporal.PlainDate.from("2024-06-30"), {
        hour: 23,
        minute: 59,
        second: 60,
        fraction: "",
      }),
    ).toBe("");
  });

  it("returns '' for a second of 60 at 23:58 on a leap-second day", () => {
    expect(
      ccsdsInstantText(Temporal.PlainDate.from("2016-12-31"), {
        hour: 23,
        minute: 58,
        second: 60,
        fraction: "",
      }),
    ).toBe("");
  });

  it("returns '' for a second of 60 before 1972", () => {
    expect(
      ccsdsInstantText(Temporal.PlainDate.from("1971-12-31"), {
        hour: 23,
        minute: 59,
        second: 60,
        fraction: "",
      }),
    ).toBe("");
  });

  it.each`
    hour  | minute
    ${24} | ${0}
    ${0}  | ${60}
  `("throws for hour $hour minute $minute", ({ hour, minute }) => {
    expect(() =>
      ccsdsInstantText(Temporal.PlainDate.from("2024-06-15"), {
        hour,
        minute,
        second: 0,
        fraction: "",
      }),
    ).toThrow(RangeError);
  });
});

describe("ccsdsCodeAText and ccsdsCodeBText", () => {
  it.each(rows)(
    "writes Code A '$codeA' at $digits digits",
    ({ instant, codeA, digits }) => {
      expect(ccsdsCodeAText(parseUtcReading(instant)!, digits)).toBe(codeA);
    },
  );

  it.each(rows)(
    "writes Code B '$codeB' at $digits digits",
    ({ instant, codeB, digits }) => {
      expect(ccsdsCodeBText(parseUtcReading(instant)!, digits)).toBe(codeB);
    },
  );

  it("floors a pre-1970 fraction instead of truncating toward zero", () => {
    // -500000000 ns is 1969-12-31T23:59:59.5Z (polyfill).
    const reading = { epochNanoseconds: -500000000n, secondSixty: false };
    expect(ccsdsCodeAText(reading, "auto")).toBe("1969-12-31T23:59:59.5Z");
    expect(ccsdsCodeBText(reading, "auto")).toBe("1969-365T23:59:59.5Z");
  });

  it("cuts and never rounds nine digits to three", () => {
    const reading = {
      epochNanoseconds: 1718461800999999999n,
      secondSixty: false,
    };
    expect(ccsdsCodeAText(reading, 3)).toBe("2024-06-15T14:30:00.999Z");
  });

  it("writes a leap second as 60 with its fraction cut", () => {
    const reading = {
      epochNanoseconds: 1483228799999999999n,
      secondSixty: true,
    };
    expect(ccsdsCodeAText(reading, 2)).toBe("2016-12-31T23:59:60.99Z");
    expect(ccsdsCodeBText(reading, 0)).toBe("2016-366T23:59:60Z");
  });

  it.each`
    label          | digits       | expected
    ${"undefined"} | ${undefined} | ${"2024-06-15T14:30:00.123456789Z"}
    ${'"auto"'}    | ${"auto"}    | ${"2024-06-15T14:30:00.123456789Z"}
    ${"0"}         | ${0}         | ${"2024-06-15T14:30:00Z"}
    ${"3.5"}       | ${3.5}       | ${"2024-06-15T14:30:00.123Z"}
    ${"9"}         | ${9}         | ${"2024-06-15T14:30:00.123456789Z"}
  `("reads digits $label as Temporal does", ({ digits, expected }) => {
    const reading = {
      epochNanoseconds: 1718461800123456789n,
      secondSixty: false,
    };
    expect(ccsdsCodeAText(reading, digits)).toBe(expected);
  });

  it.each`
    label     | digits
    ${"null"} | ${null}
    ${'"3"'}  | ${"3"}
    ${"10"}   | ${10}
    ${"-1"}   | ${-1}
    ${"NaN"}  | ${NaN}
    ${"true"} | ${true}
  `("throws RangeError for digits $label", ({ digits }) => {
    const reading = { epochNanoseconds: 0n, secondSixty: false };
    expect(() => ccsdsCodeAText(reading, digits)).toThrow(RangeError);
    expect(() => ccsdsCodeBText(reading, digits)).toThrow(RangeError);
  });

  it.each`
    epochNanoseconds
    ${-62135596800000000001n}
    ${253402300800000000000n}
  `(
    "returns '' for the UTC year outside 0001-9999 at $epochNanoseconds",
    ({ epochNanoseconds }) => {
      const reading = { epochNanoseconds, secondSixty: false };
      expect(ccsdsCodeAText(reading, "auto")).toBe("");
      expect(ccsdsCodeBText(reading, "auto")).toBe("");
    },
  );
});
