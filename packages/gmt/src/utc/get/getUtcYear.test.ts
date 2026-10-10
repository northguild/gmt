import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../../plain/validate/isValidDate";
import { getUtcYear } from "./getUtcYear";

describe("getUtcYear", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current year", () => {
    expect(getUtcYear()).toBe("2024");
  });
});

// The clock read in the middle of each year. A year outside 0000 to 9999 is written as Temporal
// writes it at the head of a date, with a sign and six digits (TC39 Temporal `PadISOYear ( y )`, §3.5.10), so
// `<year>-06-15` is the date `Temporal.PlainDate` writes and `isValidDate` reads.
describe("getUtcYear with the clock outside years 0000 to 9999", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    clock                        | expected
    ${"-000005-06-15T12:00:00Z"} | ${"-000005"}
    ${"0000-06-15T12:00:00Z"}    | ${"0000"}
    ${"9999-06-15T12:00:00Z"}    | ${"9999"}
    ${"+010000-06-15T12:00:00Z"} | ${"+010000"}
    ${"-271821-06-15T12:00:00Z"} | ${"-271821"}
    ${"+275760-06-15T12:00:00Z"} | ${"+275760"}
  `("returns $expected when the clock reads $clock", ({ clock, expected }) => {
    vi.useFakeTimers();
    vi.setSystemTime(Temporal.Instant.from(clock).epochMilliseconds);

    const year = getUtcYear();

    expect(year).toBe(expected);
    expect(
      Temporal.Instant.from(clock)
        .toZonedDateTimeISO("UTC")
        .toPlainDate()
        .toString(),
    ).toBe(`${year}-06-15`);
    expect(isValidDate(`${year}-06-15`)).toBe(true);
  });
});
