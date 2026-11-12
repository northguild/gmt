import { readMetarTimeFields } from "./metarTime";

describe("readMetarTimeFields", () => {
  it.each`
    value        | expected
    ${"251200Z"} | ${{ day: 25, hour: 12, minute: 0 }}
    ${"010000Z"} | ${{ day: 1, hour: 0, minute: 0 }}
    ${"312359Z"} | ${{ day: 31, hour: 23, minute: 59 }}
    ${"321200Z"} | ${{ day: 32, hour: 12, minute: 0 }}
    ${"252400Z"} | ${{ day: 25, hour: 24, minute: 0 }}
    ${"001260Z"} | ${{ day: 0, hour: 12, minute: 60 }}
  `(
    "reads the shape of '$value' without checking the ranges",
    ({ value, expected }) => {
      expect(readMetarTimeFields(value)).toEqual(expected);
    },
  );

  it.each`
    value          | reason
    ${"251200"}    | ${"no Z"}
    ${"251200z"}   | ${"lower-case z"}
    ${"251200 Z"}  | ${"space before Z"}
    ${"251200Z\n"} | ${"trailing newline"}
    ${" 251200Z"}  | ${"leading space"}
    ${"2512000Z"}  | ${"seven digits"}
    ${"25120Z"}    | ${"five digits"}
    ${""}          | ${"empty"}
    ${"٢٥١٢٠٠Z"}   | ${"Arabic-Indic digits"}
  `("returns null for '$value': $reason", ({ value }) => {
    expect(readMetarTimeFields(value)).toBeNull();
  });
});
