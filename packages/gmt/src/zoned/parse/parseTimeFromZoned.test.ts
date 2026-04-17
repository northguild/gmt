import {
  localNoonBattleCases,
  TomorrowTimeZone,
  TomorrowTimeZoneGmtOffset,
  YesterdayTimeZone,
  YesterdayTimeZoneGmtOffset,
} from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseTimeFromZoned } from "./parseTimeFromZoned";

describe("parseTimeFromZoned", () => {
  it.each`
    value                                                | expected
    ${"2024-02-29T14:30-05:00[America/New_York]"}        | ${"14:30:00"}
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"14:30:45.123"}
  `("returns the plain time portion for $value", ({ value, expected }) => {
    expect(parseTimeFromZoned(value)).toBe(expected);
  });

  it.each`
    value                                            | expected
    ${"2024-03-10T01:30:00-05:00[America/New_York]"} | ${"01:30:00"}
  `("returns edge case time portion for $value", ({ value, expected }) => {
    expect(parseTimeFromZoned(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"2024-02-29T14:30:45.123-04:00"}
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseTimeFromZoned(invalidValue as never)).toBe("");
    },
  );

  it.each`
    value                                                                       | expected
    ${"2024-02-29T12:00:00+00:00[UTC]"}                                         | ${"12:00:00"}
    ${"2024-02-29T12:00:00+00:00[GMT]"}                                         | ${"12:00:00"}
    ${"2024-02-29T12:00:00+00:00[Etc/GMT]"}                                     | ${"12:00:00"}
    ${"2024-02-29T12:00:00+00:00[Europe/Lisbon]"}                               | ${"12:00:00"}
    ${"2024-02-29T12:00:00+00:00[Europe/Dublin]"}                               | ${"12:00:00"}
    ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}                               | ${"12:00:00"}
    ${"2024-02-29T12:00:00+02:00[Europe/Helsinki]"}                             | ${"12:00:00"}
    ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}                             | ${"12:00:00"}
    ${"2024-02-29T12:00:00+05:30[Asia/Kolkata]"}                                | ${"12:00:00"}
    ${"2024-02-29T12:00:00+05:45[Asia/Kathmandu]"}                              | ${"12:00:00"}
    ${"2024-02-29T12:00:00+08:00[Asia/Shanghai]"}                               | ${"12:00:00"}
    ${"2024-02-29T12:00:00+11:00[Australia/Lord_Howe]"}                         | ${"12:00:00"}
    ${"2024-02-29T12:00:00+13:45[Pacific/Chatham]"}                             | ${"12:00:00"}
    ${`2024-02-29T12:00:00${TomorrowTimeZoneGmtOffset}[${TomorrowTimeZone}]`}   | ${"12:00:00"}
    ${`2024-02-29T12:00:00${YesterdayTimeZoneGmtOffset}[${YesterdayTimeZone}]`} | ${"12:00:00"}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"}                            | ${"12:00:00"}
    ${"2024-02-29T12:00:00-06:00[America/Chicago]"}                             | ${"12:00:00"}
    ${"2024-02-29T12:00:00-07:00[America/Phoenix]"}                             | ${"12:00:00"}
  `(
    "returns local time $expected for local-noon battle-test $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseTimeFromZoned(value)).toBe(expected);
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns the local time for battle-test timeZone ${timeZone}`, () => {
      expect(parseTimeFromZoned(value)).toBe("12:00:00");
    });
  }

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseTimeFromZoned(
      "2024-02-29T14:30-05:00[America/New_York]",
    );
    expect(result).toBe("");
  });
});
