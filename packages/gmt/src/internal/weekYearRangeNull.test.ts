import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatZonedRange } from "../zoned/format/formatZonedRange";

vi.mock("./weekYearRange", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./weekYearRange")>()),
  formatRangeChecked: () => null,
}));

vi.mock("./temporalCompat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./temporalCompat")>()),
  isRangeZoneNameCompatNeeded: () => true,
}));

/*
 * CORE-112 (slice 3c): a flagged range whose year cannot be repaired is `null`, and every call
 * site answers the invalid-input sentinel `""` for it (coding-standards, API contract), never the
 * wrong-year text. The isolated mock makes `formatRangeChecked` answer `null`, so each of the four
 * paths is reached: the two plain functions, and both zoned paths (plain, and zone-name repair).
 */
describe("a range whose year cannot be repaired", () => {
  it("returns '' from formatDateRange", () => {
    expect(formatDateRange("2024-07-10", "2024-07-12", "en", {})).toBe("");
  });

  it("returns '' from formatDateTimeRange", () => {
    expect(
      formatDateTimeRange(
        "2024-07-10T01:00:00",
        "2024-07-12T01:00:00",
        "en",
        {},
      ),
    ).toBe("");
  });

  it.each`
    label                 | options
    ${"no zone name"}     | ${{ year: "numeric" }}
    ${"with a zone name"} | ${{ hour: "numeric", timeZoneName: "long" }}
  `("returns '' from formatZonedRange, $label", ({ options }) => {
    expect(
      formatZonedRange(
        "2024-07-10T01:00:00+00:00[UTC]",
        "2024-07-12T01:00:00+00:00[UTC]",
        "en",
        options,
      ),
    ).toBe("");
  });
});
