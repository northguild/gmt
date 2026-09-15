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

  // Regression: explicit `disambiguation` or `offset` used to run 24 wall-clock hours from the
  // resolved midnight, spilling onto the next date. Both are deprecated and ignored, so the window
  // is always the real 23-hour day, `startOfDay()` to the next day's `startOfDay()`. Verified on
  // @js-temporal/polyfill@0.5.1 (`hoursInDay` is 23).
  it.each`
    options                                           | expectedLength | expectedFirst                                    | expectedLast
    ${{ disambiguation: "compatible" }}               | ${23}          | ${"2024-09-08T01:00:00-03:00[America/Santiago]"} | ${"2024-09-08T23:00:00-03:00[America/Santiago]"}
    ${{ offset: "ignore" }}                           | ${23}          | ${"2024-09-08T01:00:00-03:00[America/Santiago]"} | ${"2024-09-08T23:00:00-03:00[America/Santiago]"}
    ${{ disambiguation: "reject", offset: "reject" }} | ${23}          | ${"2024-09-08T01:00:00-03:00[America/Santiago]"} | ${"2024-09-08T23:00:00-03:00[America/Santiago]"}
  `(
    "returns $expectedLength entries ending $expectedLast for Santiago's skipped midnight with ignored $options",
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

  // Repeated local midnight: Havana 2024-11-03 is one 25-hour day (the label never changes);
  // Goose Bay fell back at 00:01 on 2010-11-07, so that date has two midnights and 25 hours
  // while 2010-11-06 keeps 24. Matches Temporal's `startOfDay()` and `hoursInDay` on
  // @js-temporal/polyfill@0.5.1.
  //
  // The last row pins a documented divergence (coding standards § Calendar & zone semantics,
  // rule 3): an anchor at 23:30-04:00 falls in the reopened stretch of 6 November, so
  // `startOfZoned(…, "day")` returns a 59-minute bucket starting 23:01, while this function
  // follows TC39's date-labelled day and maps 6 November's 24 hours, ending before the anchor.
  it.each`
    anchor                                            | expectedLength | expectedFirstTwo                                                                                    | expectedLast
    ${"2024-11-03T12:00:00-05:00[America/Havana]"}    | ${25}          | ${["2024-11-03T00:00:00-04:00[America/Havana]", "2024-11-03T00:00:00-05:00[America/Havana]"]}       | ${"2024-11-03T23:00:00-05:00[America/Havana]"}
    ${"2010-11-07T12:00:00-04:00[America/Goose_Bay]"} | ${25}          | ${["2010-11-07T00:00:00-03:00[America/Goose_Bay]", "2010-11-07T00:00:00-04:00[America/Goose_Bay]"]} | ${"2010-11-07T23:00:00-04:00[America/Goose_Bay]"}
    ${"2010-11-06T12:00:00-03:00[America/Goose_Bay]"} | ${24}          | ${["2010-11-06T00:00:00-03:00[America/Goose_Bay]", "2010-11-06T01:00:00-03:00[America/Goose_Bay]"]} | ${"2010-11-06T23:00:00-03:00[America/Goose_Bay]"}
    ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"} | ${24}          | ${["2010-11-06T00:00:00-03:00[America/Goose_Bay]", "2010-11-06T01:00:00-03:00[America/Goose_Bay]"]} | ${"2010-11-06T23:00:00-03:00[America/Goose_Bay]"}
  `(
    "returns $expectedLength entries starting $expectedFirstTwo and ending $expectedLast for repeated-midnight anchor $anchor",
    ({ anchor, expectedLength, expectedFirstTwo, expectedLast }) => {
      const result = mapZonedHoursInDay(anchor);

      expect(result).toHaveLength(expectedLength);
      expect(result.slice(0, 2)).toEqual(expectedFirstTwo);
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

  // America/Sao_Paulo skipped local midnight on 2018-11-04, so that day is 23 hours long
  // (`hoursInDay`). The deprecated `disambiguation` is ignored: every value — "reject" included —
  // returns the real day. Verified on @js-temporal/polyfill@0.5.1.
  it.each`
    disambiguation  | expectedLength
    ${undefined}    | ${23}
    ${"compatible"} | ${23}
    ${"earlier"}    | ${23}
    ${"later"}      | ${23}
    ${"reject"}     | ${23}
  `(
    "returns $expectedLength entries for an anchor whose midnight is skipped with ignored disambiguation $disambiguation",
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

  // The deprecated `offset` is ignored too, alone or combined with `disambiguation: "reject"`.
  it.each`
    offset       | expectedLength
    ${undefined} | ${23}
    ${"ignore"}  | ${23}
    ${"prefer"}  | ${23}
    ${"use"}     | ${23}
    ${"reject"}  | ${23}
  `(
    "returns $expectedLength entries with disambiguation reject and ignored offset $offset",
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

describe("mapZonedHoursInDay at the range limits", () => {
  it("lists the 23 hours of America/Santiago's 7 Sep 275760, starting at the 01:00 transition", () => {
    const result = mapZonedHoursInDay(
      "+275760-09-07T12:00:00-03:00[America/Santiago]",
    );

    expect(result).toHaveLength(23);
    expect(result[0]).toBe("+275760-09-07T01:00:00-03:00[America/Santiago]");
    expect(result[22]).toBe("+275760-09-07T23:00:00-03:00[America/Santiago]");
  });
});
