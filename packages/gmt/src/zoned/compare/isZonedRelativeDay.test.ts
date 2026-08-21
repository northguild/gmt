import { Temporal } from "@js-temporal/polyfill";
import {
  TomorrowTimeZone,
  YesterdayTimeZone,
  battleTestTimeZones,
  sameInstantBattleCases,
} from "../../test/timeZoneMatrix";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { isZonedRelativeDay } from "./isZonedRelativeDay";

describe("isZonedRelativeDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Matches the instant sameInstantBattleCases is built from.
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(sameInstantBattleCases)(
    "returns true for $timeZone's own local 'today' at offsetDays 0",
    ({ value }) => {
      expect(isZonedRelativeDay(value, 0)).toBe(true);
    },
  );

  it.each(battleTestTimeZones)(
    "returns true for $timeZone one day ahead at offsetDays 1",
    (timeZone) => {
      const tomorrow = Temporal.Now.zonedDateTimeISO(timeZone)
        .toPlainDate()
        .add({ days: 1 });
      const value = Temporal.ZonedDateTime.from({
        year: tomorrow.year,
        month: tomorrow.month,
        day: tomorrow.day,
        hour: 10,
        timeZone,
      }).toString();
      expect(isZonedRelativeDay(value, 1)).toBe(true);
    },
  );

  it("demonstrates the 24-hour spread: the same instant is 'today' in Pacific/Apia and 'yesterday' in Pacific/Niue relative to each zone's own tomorrow/yesterday", () => {
    const apiaToday = sameInstantBattleCases.find(
      (c) => c.timeZone === TomorrowTimeZone,
    )!;
    const niueToday = sameInstantBattleCases.find(
      (c) => c.timeZone === YesterdayTimeZone,
    )!;

    // Each zone judges "today" against its own local calendar day, so the
    // shared instant is offsetDays 0 in both zones independently.
    expect(isZonedRelativeDay(apiaToday.value, 0)).toBe(true);
    expect(isZonedRelativeDay(niueToday.value, 0)).toBe(true);
  });

  it.each`
    offsetDays
    ${1.5}
    ${NaN}
    ${Infinity}
  `(
    "returns false for non-integer offsetDays $offsetDays",
    ({ offsetDays }) => {
      expect(
        isZonedRelativeDay("2024-02-29T10:00:00+00:00[UTC]", offsetDays),
      ).toBe(false);
    },
  );

  it.each`
    value
    ${""}
    ${null}
    ${undefined}
    ${"not-a-zoned-datetime"}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isZonedRelativeDay(value as never, 0)).toBe(false);
  });

  it("returns false when Temporal.Now.zonedDateTimeISO throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(isZonedRelativeDay("2024-02-29T10:00:00+00:00[UTC]", 0)).toBe(false);
  });
});
