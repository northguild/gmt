import { normalizeDateTime } from "../../internal";
import { formatZonedRange } from "./formatZonedRange";

const { zoneNameGate, dayPeriodGate } = vi.hoisted(() => ({
  zoneNameGate: vi.fn<(style: string) => boolean>(),
  dayPeriodGate: vi.fn<() => boolean>(),
}));

vi.mock("../../internal/temporalCompat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../internal/temporalCompat")>()),
  isRangeZoneNameCompatNeeded: zoneNameGate,
  isRangeDayPeriodCompatNeeded: dayPeriodGate,
}));

/*
 * CORE-112 slice 3: which repair `formatZonedRange` takes when the compat gates are forced. D16
 * alone repairs the `formatRange` string and makes no range parts call (a V8 that aborts on a
 * week-of-year year field must never reach one); D17, reachable only on SpiderMonkey, keeps the
 * parts merge, and with both gates on the parts merge handles both. The expected text is the
 * requested form (ECMA-402 FormatDateTimeRange keeps the width the options ask for): each
 * endpoint's `long` zone name, here Europe/London's standard and summer time across the 2026 change,
 * and the flexible day periods "in the morning" and "noon" (not AM/PM). The range pattern's own
 * punctuation is the engine's, so the day-period rows check the repaired fields, not the whole text.
 */
describe("formatZonedRange — D16 and D17 branch order", () => {
  const from = "2026-03-28T12:00:00+00:00[Europe/London]";
  const to = "2026-03-30T13:00:00+01:00[Europe/London]";
  const options = {
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "long",
  } as const;
  const newYorkFrom = "2026-03-28T10:00:00-04:00[America/New_York]";
  const newYorkTo = "2026-03-28T12:00:00-04:00[America/New_York]";
  const dayPeriodOptions = {
    hour: "numeric",
    dayPeriod: "short",
    timeZoneName: "short",
  } as const;
  const expected = normalizeDateTime(
    "28/03/2026, 12:00 Greenwich Mean Time – 30/03/2026, 13:00 British Summer Time",
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    zoneNameGate.mockReturnValue(false);
    dayPeriodGate.mockReturnValue(false);
  });

  it("D16 alone writes each endpoint's long zone name and calls no range parts method", () => {
    zoneNameGate.mockReturnValue(true);
    const partsCall = vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "formatRangeToParts",
    );
    expect(formatZonedRange(from, to, "en-GB", options)).toBe(expected);
    expect(partsCall).not.toHaveBeenCalled();
  });

  it("D17 alone merges the range parts", () => {
    dayPeriodGate.mockReturnValue(true);
    const partsCall = vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "formatRangeToParts",
    );
    const text = formatZonedRange(
      newYorkFrom,
      newYorkTo,
      "en-US",
      dayPeriodOptions,
    );
    expect(text).toContain("10 in the morning");
    expect(text).toContain("12 noon");
    expect(text).toContain("EDT");
    expect(partsCall).toHaveBeenCalledTimes(1);
  });

  it("both gates on: the parts merge handles both repairs", () => {
    zoneNameGate.mockReturnValue(true);
    dayPeriodGate.mockReturnValue(true);
    const partsCall = vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "formatRangeToParts",
    );
    const text = formatZonedRange(newYorkFrom, newYorkTo, "en-US", {
      ...dayPeriodOptions,
      timeZoneName: "long",
    });
    expect(text).toContain("10 in the morning");
    expect(text).toContain("12 noon");
    expect(text).toContain("Eastern Daylight Time");
    expect(text).not.toContain("EDT");
    expect(partsCall).toHaveBeenCalledTimes(1);
  });
});
