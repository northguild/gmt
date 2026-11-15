import { formatZonedRange } from "./formatZonedRange";

const { broken, dayPeriodGate, zoneNameGate, repairSpy } = vi.hoisted(() => ({
  broken: vi.fn<() => string | null>(),
  dayPeriodGate: vi.fn<() => boolean>(),
  zoneNameGate: vi.fn<(style: string) => boolean>(),
  repairSpy: vi.fn(),
}));

vi.mock("../../internal/temporalCompat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../internal/temporalCompat")>()),
  isRangeZoneNameCompatNeeded: zoneNameGate,
  isRangeDayPeriodCompatNeeded: dayPeriodGate,
}));

vi.mock("../../internal/rangeFields", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../internal/rangeFields")>()),
  rangeFieldsText: broken,
}));

vi.mock("../../internal/repairRangeParts", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../internal/repairRangeParts")>();
  return {
    ...original,
    repairRangeParts: (
      ...args: Parameters<typeof original.repairRangeParts>
    ) => {
      repairSpy(...args);
      return original.repairRangeParts(...args);
    },
  };
});

/*
 * CORE-112 slice 7, D29: `repairRangeParts` merges the engine's own range parts with the single
 * dates' zone names and day periods. A range that D29 writes from the two single texts holds those
 * already, and its text must never be handed back to the parts repair as if it were engine parts.
 * ECMA-402 FormatDateTimeRange: the text of a range is the two single formats around the range
 * pattern's separator, so the text it gives is returned as it is.
 */
describe("formatZonedRange — D29 text never reaches the parts repair", () => {
  const from = "2026-03-28T12:00:00+00:00[Europe/London]";
  const to = "2026-03-30T13:00:00+01:00[Europe/London]";
  const options = {
    hour: "numeric",
    minute: "numeric",
    dayPeriod: "long",
    timeZoneName: "long",
  } as const;

  beforeEach(() => {
    repairSpy.mockClear();
    zoneNameGate.mockReturnValue(true);
    dayPeriodGate.mockReturnValue(true);
  });

  it("gives the two single texts without calling repairRangeParts when D29 flags the range", () => {
    broken.mockReturnValue("12:00 noon GMT \u2013 1:00 pm BST");
    expect(formatZonedRange(from, to, "en", options)).toBe(
      "12:00 noon GMT - 1:00 pm BST",
    );
    expect(repairSpy).not.toHaveBeenCalled();
  });

  it("still calls repairRangeParts once when D29 does not flag the range", () => {
    broken.mockReturnValue(null);
    formatZonedRange(from, to, "en", options);
    expect(repairSpy).toHaveBeenCalledTimes(1);
  });
});

/*
 * A formatter whose years are repaired (D25 to D27) is a stand-in with no range parts method, and a
 * host that needs the day period repair reads range parts from its carrier. The stand-in must not be
 * the carrier: the range still has a text.
 */
describe("formatZonedRange — a day period repair on a japanese-calendar formatter", () => {
  it("returns a text for ja-u-ca-japanese with a year, a day period and a zone name", () => {
    zoneNameGate.mockReturnValue(true);
    dayPeriodGate.mockReturnValue(true);
    broken.mockReturnValue(null);
    expect(
      formatZonedRange(
        "2024-07-10T09:00:00+09:00[Asia/Tokyo]",
        "2024-07-10T15:00:00+09:00[Asia/Tokyo]",
        "ja-u-ca-japanese",
        {
          year: "numeric",
          hour: "numeric",
          dayPeriod: "long",
          timeZoneName: "long",
        },
      ),
    ).toBe("令和6年 9時～15時(日本標準時)");
  });
});
