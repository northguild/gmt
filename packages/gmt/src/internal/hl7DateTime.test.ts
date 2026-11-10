import {
  HL7_DEGREE_OF_PRECISION,
  HL7_NULL_VALUE,
  HL7_PRECISIONS,
  hl7DegreePrecision,
  hl7PrecisionRank,
  isoHl7Form,
  isoHl7Precision,
  readHl7Dtm,
  splitHl7Ts,
} from "./hl7DateTime";
import * as internal from "./index";

// HL7 v2.5.1 ch. 2A 2.A.22 (DTM), 2.A.77 and 2.A.77.2 (TS), Table 0529. The grammar proves shape
// only: month 01-12 and the calendar are Temporal's job in parseHL7.

describe("HL7_PRECISIONS and hl7PrecisionRank", () => {
  it("lists the seven precisions coarsest first", () => {
    expect(HL7_PRECISIONS).toEqual([
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "fraction",
    ]);
  });

  it.each`
    precision     | rank
    ${"year"}     | ${0}
    ${"month"}    | ${1}
    ${"day"}      | ${2}
    ${"hour"}     | ${3}
    ${"minute"}   | ${4}
    ${"second"}   | ${5}
    ${"fraction"} | ${6}
    ${"Second"}   | ${-1}
    ${""}         | ${-1}
  `("rank of '$precision' is $rank", ({ precision, rank }) => {
    expect(hl7PrecisionRank(precision)).toBe(rank);
  });

  it("ranks an input that is not a string as -1", () => {
    expect(hl7PrecisionRank(undefined)).toBe(-1);
  });
});

describe("HL7_DEGREE_OF_PRECISION", () => {
  it("is Table 0529, upper case, exactly six keys", () => {
    expect(HL7_DEGREE_OF_PRECISION).toEqual({
      Y: "year",
      L: "month",
      D: "day",
      H: "hour",
      M: "minute",
      S: "second",
    });
  });

  it("is frozen", () => {
    expect(Object.isFrozen(HL7_DEGREE_OF_PRECISION)).toBe(true);
  });
});

describe("hl7DegreePrecision", () => {
  it.each`
    degree              | precision
    ${"Y"}              | ${"year"}
    ${"L"}              | ${"month"}
    ${"D"}              | ${"day"}
    ${"H"}              | ${"hour"}
    ${"M"}              | ${"minute"}
    ${"S"}              | ${"second"}
    ${"l"}              | ${null}
    ${"F"}              | ${null}
    ${""}               | ${null}
    ${"toString"}       | ${null}
    ${"constructor"}    | ${null}
    ${"__proto__"}      | ${null}
    ${"hasOwnProperty"} | ${null}
  `("degree '$degree' names $precision", ({ degree, precision }) => {
    expect(hl7DegreePrecision(degree)).toBe(precision);
  });
});

describe("HL7_NULL_VALUE", () => {
  it("is two double quote marks, nothing else", () => {
    expect(HL7_NULL_VALUE).toBe('""');
    expect(HL7_NULL_VALUE).toHaveLength(2);
  });
});

describe("internal barrel", () => {
  it("re-exports the pure HL7 grammar", () => {
    expect(internal.HL7_PRECISIONS).toBe(HL7_PRECISIONS);
    expect(internal.hl7PrecisionRank).toBe(hl7PrecisionRank);
  });
});

describe("readHl7Dtm", () => {
  it.each`
    dtm                      | precision     | fractionDigits
    ${"2024"}                | ${"year"}     | ${0}
    ${"202406"}              | ${"month"}    | ${0}
    ${"20240615"}            | ${"day"}      | ${0}
    ${"2024061510"}          | ${"hour"}     | ${0}
    ${"202406151030"}        | ${"minute"}   | ${0}
    ${"20240615103000"}      | ${"second"}   | ${0}
    ${"20240615103000.1"}    | ${"fraction"} | ${1}
    ${"20240615103000.1234"} | ${"fraction"} | ${4}
  `(
    "reads '$dtm' as $precision with $fractionDigits fraction digits",
    ({ dtm, precision, fractionDigits }) => {
      expect(readHl7Dtm(dtm)).toMatchObject({ precision, fractionDigits });
    },
  );

  it("returns every group as a string, absent ones undefined", () => {
    expect(readHl7Dtm("20240615103045.1234-0530")).toEqual({
      year: "2024",
      month: "06",
      day: "15",
      hour: "10",
      minute: "30",
      second: "45",
      fraction: "1234",
      sign: "-",
      offsetHour: "05",
      offsetMinute: "30",
      precision: "fraction",
      fractionDigits: 4,
    });
    expect(readHl7Dtm("2024")).toEqual({
      year: "2024",
      month: undefined,
      day: undefined,
      hour: undefined,
      minute: undefined,
      second: undefined,
      fraction: undefined,
      sign: undefined,
      offsetHour: undefined,
      offsetMinute: undefined,
      precision: "year",
      fractionDigits: 0,
    });
  });

  it.each`
    dtm                           | sign   | offsetHour | offsetMinute
    ${"20240615103000-0500"}      | ${"-"} | ${"05"}    | ${"00"}
    ${"2024-0500"}                | ${"-"} | ${"05"}    | ${"00"}
    ${"20240615103000+0000"}      | ${"+"} | ${"00"}    | ${"00"}
    ${"20240615103000-0000"}      | ${"-"} | ${"00"}    | ${"00"}
    ${"2024061510+0100"}          | ${"+"} | ${"01"}    | ${"00"}
    ${"20240615103000.1234+0530"} | ${"+"} | ${"05"}    | ${"30"}
  `(
    "reads the offset of '$dtm' as $sign$offsetHour$offsetMinute",
    ({ dtm, sign, offsetHour, offsetMinute }) => {
      expect(readHl7Dtm(dtm)).toMatchObject({ sign, offsetHour, offsetMinute });
    },
  );

  it.each`
    dtm                         | reason
    ${"20240615103000.12345"}   | ${"five fraction digits"}
    ${"20240615103000."}        | ${"a point and no digit"}
    ${"202406151030.5"}         | ${"a fraction after minutes"}
    ${"19981004010159+010"}     | ${"HL7's own example, a three-digit offset"}
    ${"20240615+05"}            | ${"an hour-only offset"}
    ${"20240615+05:00"}         | ${"an extended offset"}
    ${"202"}                    | ${"three digits"}
    ${"2024061"}                | ${"seven digits"}
    ${"202406151"}              | ${"nine digits"}
    ${" 2024"}                  | ${"leading space"}
    ${"2024 "}                  | ${"trailing space"}
    ${"２０２４"}               | ${"full-width digits"}
    ${""}                       | ${"empty"}
    ${"2024Z"}                  | ${"a Z designator"}
    ${"20240615T103000"}        | ${"an ISO T separator"}
    ${"2024\n"}                 | ${"a trailing newline"}
    ${"2024-06-15"}             | ${"ISO extended dashes"}
    ${"20240615103000.1234+05"} | ${"a fraction and an hour-only offset"}
  `("rejects '$dtm' ($reason)", ({ dtm }) => {
    expect(readHl7Dtm(dtm)).toBeNull();
  });
});

describe("input that is not a string", () => {
  it("is not read by readHl7Dtm or splitHl7Ts", () => {
    expect(readHl7Dtm(undefined as unknown as string)).toBeNull();
    expect(splitHl7Ts(undefined as unknown as string)).toBeNull();
  });
});

describe("splitHl7Ts", () => {
  it.each`
    value               | dtm               | degree
    ${"20240615"}       | ${"20240615"}     | ${""}
    ${"199904011200^L"} | ${"199904011200"} | ${"L"}
    ${"20240615^"}      | ${"20240615"}     | ${""}
    ${"^D"}             | ${""}             | ${"D"}
    ${""}               | ${""}             | ${""}
  `(
    "splits '$value' into '$dtm' and degree '$degree'",
    ({ value, dtm, degree }) => {
      expect(splitHl7Ts(value)).toEqual({ dtm, degree });
    },
  );

  it.each`
    value
    ${"20240615^D^X"}
    ${"^^"}
    ${"20240615^D^"}
  `("rejects '$value': more than two components", ({ value }) => {
    expect(splitHl7Ts(value)).toBeNull();
  });

  it.each`
    value            | separator
    ${"20240615&D"}  | ${"&"}
    ${"20240615~D"}  | ${"~"}
    ${"20240615|D"}  | ${"|"}
    ${"20240615\\D"} | ${"\\"}
  `("reads no other separator: '$separator' stays in the DTM", ({ value }) => {
    expect(splitHl7Ts(value)).toEqual({ dtm: value, degree: "" });
  });
});

describe("isoHl7Form and isoHl7Precision", () => {
  it.each`
    iso                                 | precision     | fractionDigits | offset
    ${"2024"}                           | ${"year"}     | ${0}           | ${undefined}
    ${"2024-06"}                        | ${"month"}    | ${0}           | ${undefined}
    ${"2024-06-15"}                     | ${"day"}      | ${0}           | ${undefined}
    ${"2024-06-15T10"}                  | ${"hour"}     | ${0}           | ${undefined}
    ${"2024-06-15T10:30"}               | ${"minute"}   | ${0}           | ${undefined}
    ${"2024-06-15T10:30:00"}            | ${"second"}   | ${0}           | ${undefined}
    ${"2024-06-15T10:30:00,5"}          | ${"fraction"} | ${1}           | ${undefined}
    ${"2024-06-15T10:30:00.5"}          | ${"fraction"} | ${1}           | ${undefined}
    ${"2024-06-15T10:30:00.123456789Z"} | ${"fraction"} | ${9}           | ${"Z"}
    ${"2024-06-15T10:30Z"}              | ${"minute"}   | ${0}           | ${"Z"}
    ${"2024-06-15T10:30:00-05:00"}      | ${"second"}   | ${0}           | ${"-05:00"}
    ${"2024-06-15T10-05:00"}            | ${"hour"}     | ${0}           | ${"-05:00"}
    ${"2024-06-15T10:30:00-00:44:30"}   | ${"second"}   | ${0}           | ${"-00:44:30"}
    ${"2024-06-15T10:30:00+05:30:15.5"} | ${"second"}   | ${0}           | ${"+05:30:15.5"}
  `(
    "reads '$iso' as $precision, $fractionDigits fraction digits, offset $offset",
    ({ iso, precision, fractionDigits, offset }) => {
      const match = isoHl7Form.exec(iso);
      expect(match).not.toBeNull();
      expect(match?.groups?.["offset"]).toBe(offset);
      expect(isoHl7Precision(match as RegExpExecArray)).toEqual({
        precision,
        fractionDigits,
      });
    },
  );

  it.each`
    iso                                 | reason
    ${"+010000-01-01"}                  | ${"an expanded year"}
    ${"-000001"}                        | ${"a negative year"}
    ${"2024-06-15t10:30:00"}            | ${"lower-case t"}
    ${"2024-06-15T10:30:00z"}           | ${"lower-case z"}
    ${"20240615"}                       | ${"basic format"}
    ${"2024-06-15Z"}                    | ${"an offset on a date"}
    ${"2024-06-15T10:30:00-0500"}       | ${"a basic-format offset"}
    ${"2024-06-15T10:30:00-05"}         | ${"an hour-only offset"}
    ${"2024-06-15T10:30:00Z\n"}         | ${"a trailing newline"}
    ${"2024-06-15T10:30:00."}           | ${"a point and no digit"}
    ${"2024-06-15T10:30:00.1234567890"} | ${"ten fraction digits"}
    ${""}                               | ${"empty"}
  `("does not match '$iso' ($reason)", ({ iso }) => {
    expect(isoHl7Form.exec(iso)).toBeNull();
  });
});
