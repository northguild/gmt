import { mockSystemTimeZone } from "../test";
import { unixWallClock } from "./unixWallClock";

describe("unixWallClock", () => {
  // 86400 s is 1970-01-02T00:00:00Z, 09:00 in Asia/Tokyo (+09:00).
  // 45 870 000 ms is 12:44:30Z, which is 12:00:00 at -00:44:30 and 18:14:30 at +05:30.
  it.each`
    value          | options                                            | expected
    ${0}           | ${undefined}                                       | ${"1970-01-01T00:00:00"}
    ${"86400"}     | ${{ epochUnit: "second", timeZone: "Asia/Tokyo" }} | ${"1970-01-02T09:00:00"}
    ${"86400"}     | ${{ epochUnit: "seconds", timeZone: "local" }}     | ${"1970-01-02T09:00:00"}
    ${-1}          | ${{ epochUnit: "millisecond" }}                    | ${"1969-12-31T23:59:59.999"}
    ${45_870_000}  | ${{ timeZone: "-00:44:30" }}                       | ${"1970-01-01T12:00:00"}
    ${45_870_000}  | ${{ timeZone: "+05:30:00" }}                       | ${"1970-01-01T18:14:30"}
    ${8.64e15}     | ${{ timeZone: "+23:59:59" }}                       | ${"+275760-09-13T23:59:59"}
    ${-8.64e15}    | ${{ timeZone: "-23:59:59" }}                       | ${"-271821-04-19T00:00:01"}
    ${0}           | ${{ timeZone: "Asia/Tokio" }}                      | ${null}
    ${0}           | ${{ timeZone: "+05:30:00.5" }}                     | ${null}
    ${0}           | ${{ epochUnit: "minutes" }}                        | ${null}
    ${"1e3"}       | ${undefined}                                       | ${null}
    ${8.64e15 + 1} | ${undefined}                                       | ${null}
  `(
    "returns $expected for $value with options $options",
    ({ value, options, expected }) => {
      const restore = mockSystemTimeZone("Asia/Tokyo");
      expect(unixWallClock(value, options)?.toString() ?? null).toBe(expected);
      restore();
    },
  );
});
