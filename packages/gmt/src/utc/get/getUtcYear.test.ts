import { Temporal } from "../../internal/temporal";
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

// 1960-01-01T00:00:00Z is -315619200000 ms and 2027-01-01T00:00:00Z is 1798761600000 ms. The clock
// is set to 1960 first, and the year is read twice, so a second reading after a clock before 1970
// is the year the clock was set to (TC39 Temporal SystemUTCEpochMilliseconds floors the system
// time; test262 built-ins/Temporal/Now/instant/return-value-value.js).
describe("getUtcYear after the clock was set before 1970", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 1960 for two readings at 1960-01-01T00:00:00Z", () => {
    vi.setSystemTime("1960-01-01T00:00:00Z");
    getUtcYear();
    expect(getUtcYear()).toBe("1960");
  });

  it("returns 2027 at 2027-01-01T00:00:00Z read after a 1960 clock", () => {
    vi.setSystemTime("1960-01-01T00:00:00Z");
    getUtcYear();
    getUtcYear();
    vi.setSystemTime("2027-01-01T00:00:00Z");
    expect(getUtcYear()).toBe("2027");
  });
});
