import { mockSystemTimeZone } from "../test";
import { unixZonedDateTime } from "./unixZonedDateTime";

describe("unixZonedDateTime", () => {
  // 86400 s is 1970-01-02T00:00:00Z, 09:00 in Asia/Tokyo (+09:00).
  it.each`
    value          | options                                            | expected
    ${0}           | ${undefined}                                       | ${"1970-01-01T00:00:00+00:00[UTC]"}
    ${"86400"}     | ${{ epochUnit: "second", timeZone: "Asia/Tokyo" }} | ${"1970-01-02T09:00:00+09:00[Asia/Tokyo]"}
    ${"86400"}     | ${{ epochUnit: "seconds", timeZone: "local" }}     | ${"1970-01-02T09:00:00+09:00[Asia/Tokyo]"}
    ${-1}          | ${{ epochUnit: "millisecond" }}                    | ${"1969-12-31T23:59:59.999+00:00[UTC]"}
    ${0}           | ${{ timeZone: "Asia/Tokio" }}                      | ${null}
    ${0}           | ${{ epochUnit: "minutes" }}                        | ${null}
    ${"1e3"}       | ${undefined}                                       | ${null}
    ${8.64e15 + 1} | ${undefined}                                       | ${null}
  `(
    "returns $expected for $value with options $options",
    ({ value, options, expected }) => {
      const restore = mockSystemTimeZone("Asia/Tokyo");
      expect(unixZonedDateTime(value, options)?.toString() ?? null).toBe(
        expected,
      );
      restore();
    },
  );
});
