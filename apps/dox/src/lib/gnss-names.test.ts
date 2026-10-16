import {
  GNSS_DECODER_MODES,
  GNSS_SYSTEMS,
  GNSS_WEEK_COUNTERS,
  RINEX_WEEK_SYSTEMS,
  ROLLOVER_NOW_MODES,
} from "./gnss-names";
import { LIVE_PLAYGROUND_TEMPLATES } from "./playground-spec";

/** The `choices` of one enum field of a generated template. */
function choicesOf(fn: string, field: string): string[] {
  const template = (
    LIVE_PLAYGROUND_TEMPLATES as Record<
      string,
      { fields?: { name: string; kind: string; choices?: string[] }[] }
    >
  )[fn];
  const found = template?.fields?.find((f) => f.name === field);
  expect(found?.kind, `${fn}.${field} is an enum field`).toBe("enum");
  return [...(found?.choices ?? [])];
}

const sorted = (list: readonly string[]) => [...list].sort();

describe("the GNSS name lists", () => {
  it("GNSS_WEEK_COUNTERS equals the counter choices of gnssWeekToUtc", () => {
    expect(sorted(GNSS_WEEK_COUNTERS)).toEqual(
      sorted(choicesOf("gnssWeekToUtc", "counter")),
    );
  });

  it("GNSS_WEEK_COUNTERS equals the counter choices of utcToGnssWeek", () => {
    expect(sorted(GNSS_WEEK_COUNTERS)).toEqual(
      sorted(choicesOf("utcToGnssWeek", "counter")),
    );
  });

  it("RINEX_WEEK_SYSTEMS equals the system choices of rinexWeekToUtc", () => {
    expect(sorted(RINEX_WEEK_SYSTEMS)).toEqual(
      sorted(choicesOf("rinexWeekToUtc", "system")),
    );
  });

  it("RINEX_WEEK_SYSTEMS equals the system choices of utcToRinexWeek", () => {
    expect(sorted(RINEX_WEEK_SYSTEMS)).toEqual(
      sorted(choicesOf("utcToRinexWeek", "system")),
    );
  });

  it("GNSS_SYSTEMS equals the system choices of utcToGnss", () => {
    expect(sorted(GNSS_SYSTEMS)).toEqual(
      sorted(choicesOf("utcToGnss", "system")),
    );
  });

  it("GNSS_SYSTEMS equals the system choices of gnssToUtc", () => {
    expect(sorted(GNSS_SYSTEMS)).toEqual(
      sorted(choicesOf("gnssToUtc", "system")),
    );
  });

  it("holds no name twice", () => {
    for (const list of [
      GNSS_WEEK_COUNTERS,
      RINEX_WEEK_SYSTEMS,
      GNSS_SYSTEMS,
      GNSS_DECODER_MODES,
      ROLLOVER_NOW_MODES,
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("names the tool modes", () => {
    expect([...GNSS_DECODER_MODES]).toEqual(["broadcast", "rinex", "utc"]);
    expect([...ROLLOVER_NOW_MODES]).toEqual(["today", "date"]);
  });
});
