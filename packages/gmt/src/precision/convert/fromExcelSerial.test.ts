import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { fromExcelSerial } from "./fromExcelSerial";
import { toExcelSerial } from "./toExcelSerial";

describe("fromExcelSerial", () => {
  it.each`
    value                 | expected                      | reason
    ${1}                  | ${"1900-01-01T00:00:00Z"}     | ${"Excel's first serial"}
    ${2}                  | ${"1900-01-02T00:00:00Z"}     | ${"the day after"}
    ${59}                 | ${"1900-02-28T00:00:00Z"}     | ${"the last real day before the phantom leap day"}
    ${59.5}               | ${"1900-02-28T12:00:00Z"}     | ${"midday, still before the phantom day"}
    ${61}                 | ${"1900-03-01T00:00:00Z"}     | ${"the first day after the phantom day"}
    ${25569}              | ${"1970-01-01T00:00:00Z"}     | ${"the Unix epoch"}
    ${45351}              | ${"2024-02-29T00:00:00Z"}     | ${"a real leap day"}
    ${45361.5}            | ${"2024-03-10T12:00:00Z"}     | ${"midday"}
    ${45361.5242683912}   | ${"2024-03-10T12:34:56.789Z"} | ${"millisecond precision"}
    ${2958465}            | ${"9999-12-31T00:00:00Z"}     | ${"Excel's last serial"}
    ${2958465.9999999884} | ${"9999-12-31T23:59:59.999Z"} | ${"the last instant Excel can name"}
  `(
    "returns $expected for $value in the default 1900 system ($reason)",
    ({ value, expected }) => {
      expect(fromExcelSerial(value)).toBe(expected);
    },
  );

  it.each`
    value        | reason
    ${60}        | ${"the phantom 29 February 1900 itself"}
    ${60.25}     | ${"a time of day inside the phantom day"}
    ${60.5}      | ${"midday on the phantom day"}
    ${60.999999} | ${"the last moment of the phantom day"}
  `(
    'returns "" for serial $value — Excel\'s phantom 29 February 1900, a date that never existed ($reason)',
    ({ value }) => {
      expect(fromExcelSerial(value)).toBe("");
    },
  );

  it("keeps the phantom day a hole rather than silently shifting either neighbour", () => {
    expect(fromExcelSerial(59)).toBe("1900-02-28T00:00:00Z");
    expect(fromExcelSerial(60)).toBe("");
    expect(fromExcelSerial(61)).toBe("1900-03-01T00:00:00Z");
  });

  it.each`
    value      | expected                  | reason
    ${0}       | ${"1904-01-01T00:00:00Z"} | ${"the 1904 system's first serial"}
    ${24107}   | ${"1970-01-01T00:00:00Z"} | ${"the Unix epoch"}
    ${43899.5} | ${"2024-03-10T12:00:00Z"} | ${"midday"}
    ${60}      | ${"1904-03-01T00:00:00Z"} | ${"serial 60 is a real date here — 1904 has no phantom day"}
    ${2957003} | ${"9999-12-31T00:00:00Z"} | ${"the 1904 system's last serial"}
  `(
    'returns $expected for $value with { system: "1904" } ($reason)',
    ({ value, expected }) => {
      expect(fromExcelSerial(value, { system: "1904" })).toBe(expected);
    },
  );

  it.each`
    value      | reason
    ${1462}    | ${"the 1904 epoch — the lowest serial both systems can name"}
    ${25569}   | ${"the Unix epoch"}
    ${45361.5} | ${"midday in 2024"}
    ${2958465} | ${"the last whole day"}
  `(
    "resolves 1900-system serial $value and 1904-system serial $value − 1462 to the same instant ($reason)",
    ({ value }) => {
      expect(fromExcelSerial(value)).toBe(
        fromExcelSerial(value - 1462, { system: "1904" }),
      );
    },
  );

  it.each`
    value                         | reason
    ${"1900-01-01T00:00:00Z"}     | ${"Excel's first serial"}
    ${"1900-02-28T00:00:00Z"}     | ${"the last day before the phantom day"}
    ${"1900-03-01T00:00:00Z"}     | ${"the first day after it"}
    ${"1970-01-01T00:00:00Z"}     | ${"the Unix epoch"}
    ${"2024-02-29T00:00:00Z"}     | ${"a real leap day"}
    ${"2024-03-10T12:00:00Z"}     | ${"midday"}
    ${"2024-03-10T12:34:56Z"}     | ${"whole second, non-round fraction of a day"}
    ${"2024-03-10T12:34:56.789Z"} | ${"millisecond precision"}
    ${"9999-12-31T23:59:59.999Z"} | ${"the last instant Excel can name"}
  `(
    "round-trips $value through toExcelSerial in the 1900 system ($reason)",
    ({ value }) => {
      expect(fromExcelSerial(toExcelSerial(value) as number)).toBe(value);
    },
  );

  it.each`
    value                         | reason
    ${"1904-01-01T00:00:00Z"}     | ${"the 1904 epoch"}
    ${"1970-01-01T00:00:00Z"}     | ${"the Unix epoch"}
    ${"2024-03-10T12:34:56.789Z"} | ${"millisecond precision"}
    ${"9999-12-31T23:59:59.999Z"} | ${"the last instant Excel can name"}
  `(
    "round-trips $value through toExcelSerial in the 1904 system ($reason)",
    ({ value }) => {
      expect(
        fromExcelSerial(toExcelSerial(value, { system: "1904" }) as number, {
          system: "1904",
        }),
      ).toBe(value);
    },
  );

  it("round-trips a sub-millisecond instant only as far as the millisecond grid", () => {
    expect(
      fromExcelSerial(
        toExcelSerial("2024-03-10T12:00:00.123456789Z") as number,
      ),
    ).toBe("2024-03-10T12:00:00.123Z");
  });

  it.each`
    value      | reason
    ${0}       | ${"serial 0, which Excel renders as January 0 rather than a date"}
    ${0.5}     | ${"inside the January 0 day"}
    ${-1}      | ${"negative, which Excel rejects"}
    ${2958466} | ${"one day past Excel's last serial"}
    ${1e9}     | ${"far past Excel's range"}
  `('returns "" for $value in the 1900 system ($reason)', ({ value }) => {
    expect(fromExcelSerial(value)).toBe("");
  });

  it.each`
    value      | reason
    ${-1}      | ${"negative, which Excel rejects"}
    ${-0.5}    | ${"just before the 1904 epoch"}
    ${2957004} | ${"one day past the 1904 system's last serial"}
  `('returns "" for $value in the 1904 system ($reason)', ({ value }) => {
    expect(fromExcelSerial(value, { system: "1904" })).toBe("");
  });

  it.each`
    system    | reason
    ${"1899"} | ${"not a date system Excel has"}
    ${1900}   | ${"number, not the string literal"}
    ${1904}   | ${"number, not the string literal"}
    ${""}     | ${"empty string"}
    ${true}   | ${"boolean"}
  `('returns "" when system $system is invalid ($reason)', ({ system }) => {
    expect(
      fromExcelSerial(45361.5, { system: system as unknown as "1900" }),
    ).toBe("");
  });

  it.each`
    options                  | reason
    ${undefined}             | ${"no options argument"}
    ${{}}                    | ${"empty options object"}
    ${{ system: undefined }} | ${"system explicitly undefined"}
    ${{ system: null }}      | ${"system explicitly null"}
  `(
    "falls back to the 1900 system when options is $options ($reason)",
    ({ options }) => {
      expect(fromExcelSerial(45361.5, options)).toBe("2024-03-10T12:00:00Z");
    },
  );

  it.each`
    value
    ${Number.NaN}
    ${Number.POSITIVE_INFINITY}
    ${Number.NEGATIVE_INFINITY}
    ${"45361.5"}
    ${45361n}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $value is not a finite number', ({ value }) => {
    expect(fromExcelSerial(value as unknown as number)).toBe("");
  });

  it('returns "" when Temporal.Instant.fromEpochNanoseconds throws', () => {
    mockTemporalInstantFromEpochNanosecondsThrow();

    expect(fromExcelSerial(45361.5)).toBe("");
  });
});
