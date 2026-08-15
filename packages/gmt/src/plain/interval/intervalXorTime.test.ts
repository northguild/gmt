import { intervalXorTime } from "./intervalXorTime";

describe("intervalXorTime", () => {
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"17:00:00"} | ${{ result: [{ start: "09:00:00", end: "10:59:59.999999999" }, { start: "12:00:00.000000001", end: "17:00:00" }] }}
    ${"09:00:00"} | ${"17:00:00"} | ${"11:00:00"} | ${"12:00:00"} | ${{ result: [{ start: "09:00:00", end: "10:59:59.999999999" }, { start: "12:00:00.000000001", end: "17:00:00" }] }}
    ${"09:00:00"} | ${"17:00:00"} | ${"09:00:00"} | ${"17:00:00"} | ${{ result: [] }}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"} | ${{ result: [{ start: "09:00:00", end: "12:00:00" }, { start: "13:00:00", end: "17:00:00" }] }}
  `(
    "returns $expected when A=$aStart..$aEnd and B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual(
        expected.result,
      );
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"17:00:00"} | ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${[]}
    ${"09:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"10:00:00"} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${"invalid"}  | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${""}         | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"invalid"}  | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${""}         | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"invalid"}  | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${""}         | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${"invalid"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${""}
  `(
    "returns [] for malformed time: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart        | aEnd          | bStart        | bEnd
    ${null}       | ${"12:00:00"} | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${undefined}  | ${"13:00:00"} | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${null}       | ${"17:00:00"}
    ${"09:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalXorTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
});
