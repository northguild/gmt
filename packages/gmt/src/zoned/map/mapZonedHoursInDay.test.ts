import { localNoonBattleCases } from "../../test";
import { mapZonedHoursInDay } from "./mapZonedHoursInDay";

describe("mapZonedHoursInDay", () => {
  it.each`
    anchor                                           | expectedLength
    ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${23}
    ${"2024-11-03T12:00:00-05:00[America/New_York]"} | ${25}
    ${"2024-02-29T12:00:00+00:00[UTC]"}              | ${24}
  `(
    "returns $expectedLength entries for $anchor",
    ({
      anchor,
      expectedLength,
    }: {
      anchor: string;
      expectedLength: number;
    }) => {
      expect(mapZonedHoursInDay(anchor)).toHaveLength(expectedLength);
    },
  );

  // Skipped local midnight: the day runs from the first instant after the gap to the next day's start.
  it.each`
    anchor                                           | expectedLength | expectedFirst                                    | expectedLast
    ${"2024-09-08T12:00:00-03:00[America/Santiago]"} | ${23}          | ${"2024-09-08T01:00:00-03:00[America/Santiago]"} | ${"2024-09-08T23:00:00-03:00[America/Santiago]"}
    ${"2024-03-10T12:00:00-04:00[America/Havana]"}   | ${23}          | ${"2024-03-10T01:00:00-04:00[America/Havana]"}   | ${"2024-03-10T23:00:00-04:00[America/Havana]"}
  `(
    "returns $expectedLength entries from $expectedFirst to $expectedLast for $anchor, whose midnight is skipped",
    ({ anchor, expectedLength, expectedFirst, expectedLast }) => {
      const result = mapZonedHoursInDay(anchor);

      expect(result).toHaveLength(expectedLength);
      expect(result[0]).toBe(expectedFirst);
      expect(result.at(-1)).toBe(expectedLast);
    },
  );

  // Passing `disambiguation` or `offset` keeps the legacy wall-clock path: midnight resolved with
  // those options (Santiago's skipped 00:00 moves to 01:00), then 24 wall-clock hours, so the
  // last entry lands on the next date. Verified on @js-temporal/polyfill@0.5.1.
  it.each`
    options                             | expectedLength | expectedFirst                                    | expectedLast
    ${{ disambiguation: "compatible" }} | ${24}          | ${"2024-09-08T01:00:00-03:00[America/Santiago]"} | ${"2024-09-09T00:00:00-03:00[America/Santiago]"}
    ${{ offset: "ignore" }}             | ${24}          | ${"2024-09-08T01:00:00-03:00[America/Santiago]"} | ${"2024-09-09T00:00:00-03:00[America/Santiago]"}
  `(
    "returns $expectedLength wall-clock entries ending $expectedLast for Santiago's skipped midnight with explicit $options",
    ({ options, expectedLength, expectedFirst, expectedLast }) => {
      const result = mapZonedHoursInDay(
        "2024-09-08T12:00:00-03:00[America/Santiago]",
        options,
      );

      expect(result).toHaveLength(expectedLength);
      expect(result[0]).toBe(expectedFirst);
      expect(result.at(-1)).toBe(expectedLast);
    },
  );

  // Australia/Lord_Howe shifts 30 minutes, so hourly steps across a transition land on :30.
  it.each`
    anchor                                              | expectedLength | expectedFirstThree
    ${"2024-10-06T12:00:00+11:00[Australia/Lord_Howe]"} | ${24}          | ${["2024-10-06T00:00:00+10:30[Australia/Lord_Howe]", "2024-10-06T01:00:00+10:30[Australia/Lord_Howe]", "2024-10-06T02:30:00+11:00[Australia/Lord_Howe]"]}
    ${"2024-04-07T12:00:00+10:30[Australia/Lord_Howe]"} | ${25}          | ${["2024-04-07T00:00:00+11:00[Australia/Lord_Howe]", "2024-04-07T01:00:00+11:00[Australia/Lord_Howe]", "2024-04-07T01:30:00+10:30[Australia/Lord_Howe]"]}
  `(
    "returns $expectedLength entries starting $expectedFirstThree for half-hour-shift anchor $anchor",
    ({ anchor, expectedLength, expectedFirstThree }) => {
      const result = mapZonedHoursInDay(anchor);

      expect(result).toHaveLength(expectedLength);
      expect(result.slice(0, 3)).toEqual(expectedFirstThree);
    },
  );

  it.each`
    anchor                              | expectedFirstPrefix
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"2024-02-29T00:00:00"}
  `(
    "returns expected midnight anchor for $anchor",
    ({ anchor, expectedFirstPrefix }) => {
      expect(mapZonedHoursInDay(anchor)[0]).toContain(expectedFirstPrefix);
    },
  );

  it.each`
    invalidAnchor
    ${"invalid"}
    ${"2024-02-29T12:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty array for invalid zoned datetime $invalidAnchor",
    ({ invalidAnchor }) => {
      expect(mapZonedHoursInDay(invalidAnchor as never)).toEqual([]);
    },
  );

  it.each`
    anchor                                              | expectedLength
    ${"2024-02-29T12:00:00+00:00[UTC]"}                 | ${24}
    ${"2024-02-29T12:00:00+00:00[GMT]"}                 | ${24}
    ${"2024-02-29T12:00:00+00:00[Etc/GMT]"}             | ${24}
    ${"2024-02-29T12:00:00+00:00[Europe/Lisbon]"}       | ${24}
    ${"2024-02-29T12:00:00+00:00[Europe/Dublin]"}       | ${24}
    ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}       | ${24}
    ${"2024-02-29T12:00:00+02:00[Europe/Helsinki]"}     | ${24}
    ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}     | ${24}
    ${"2024-02-29T12:00:00+05:30[Asia/Kolkata]"}        | ${24}
    ${"2024-02-29T12:00:00+05:45[Asia/Kathmandu]"}      | ${24}
    ${"2024-02-29T12:00:00+08:00[Asia/Shanghai]"}       | ${24}
    ${"2024-02-29T12:00:00+11:00[Australia/Lord_Howe]"} | ${24}
    ${"2024-02-29T12:00:00+13:45[Pacific/Chatham]"}     | ${24}
    ${"2024-02-29T12:00:00+13:00[Pacific/Apia]"}        | ${24}
    ${"2024-02-29T12:00:00-11:00[Pacific/Niue]"}        | ${24}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"}    | ${24}
    ${"2024-02-29T12:00:00-06:00[America/Chicago]"}     | ${24}
    ${"2024-02-29T12:00:00-07:00[America/Phoenix]"}     | ${24}
  `(
    "returns $expectedLength hourly entries for battle-test anchor $anchor",
    ({
      anchor,
      expectedLength,
    }: {
      anchor: string;
      expectedLength: number;
    }) => {
      expect(mapZonedHoursInDay(anchor)).toHaveLength(expectedLength);
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns 24 hourly entries for battle-test timeZone ${timeZone}`, () => {
      expect(mapZonedHoursInDay(value)).toHaveLength(24);
    });
  }

  // disambiguation: the midnight anchor itself is ambiguous in this historical Brazil zone/date
  // (2018-11-04's DST-start transition landed exactly on local midnight). With no options the day
  // is the real 23-hour day; passing disambiguation opts into wall-clock midnight + 24h stepping.
  it.each`
    disambiguation  | expectedLength
    ${undefined}    | ${23}
    ${"compatible"} | ${24}
    ${"earlier"}    | ${23}
    ${"later"}      | ${24}
    ${"reject"}     | ${0}
  `(
    "with disambiguation $disambiguation on an anchor whose midnight is ambiguous, returns $expectedLength entries",
    ({ disambiguation, expectedLength }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(
        mapZonedHoursInDay(
          "2018-11-04T12:00:00-02:00[America/Sao_Paulo]",
          optionsArg,
        ),
      ).toHaveLength(expectedLength);
    },
  );

  // offset controls whether disambiguation takes effect for the midnight anchor. Unlike
  // startOfZoned's Nov 3 America/New_York case, the source's -02:00 offset here is ALSO invalid
  // at midnight, so "prefer" falls through to disambiguation and "reject" still throws — offset
  // does not universally suppress disambiguation, only when the source offset happens to remain valid
  it.each`
    offset       | expectedLength
    ${undefined} | ${0}
    ${"ignore"}  | ${0}
    ${"prefer"}  | ${0}
  `(
    "with disambiguation reject and offset $offset, returns $expectedLength entries",
    ({ offset, expectedLength }) => {
      const optionsArg =
        offset === undefined
          ? { disambiguation: "reject" as const }
          : { disambiguation: "reject" as const, offset };
      expect(
        mapZonedHoursInDay(
          "2018-11-04T12:00:00-02:00[America/Sao_Paulo]",
          optionsArg,
        ),
      ).toHaveLength(expectedLength);
    },
  );
});
