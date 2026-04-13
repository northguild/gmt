import { sameInstantBattleCases, unixEpochBattleCases } from "../../test";
import { isValidTimeZone } from "../validate";
import { chopZonedDateTime } from "./chopZonedDateTime";

describe("chopZonedDateTime", () => {
  it.each`
    value                                            | expected
    ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}     | ${"Europe/Paris"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}              | ${"UTC"}
    ${"2024-02-29T09:30:45+02:00[Europe/Helsinki]"}  | ${"Europe/Helsinki"}
    ${"2024-02-29T12:30:45.123+01:00[Europe/Paris]"} | ${"Europe/Paris"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}              | ${"UTC"}
    ${"2024-02-29T23:59:59.999+00:00[UTC]"}          | ${"UTC"}
    ${"2024-02-29T12:30:45Z[UTC]"}                   | ${"UTC"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopZonedDateTime(value)).toBe(expected);
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"UTC"}
    ${"2024-02-29T00:00:00+00:00[GMT]"}                 | ${"GMT"}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}             | ${"Etc/GMT"}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${"Europe/Lisbon"}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${"Europe/Dublin"}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}       | ${"Europe/Berlin"}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}     | ${"Europe/Helsinki"}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}     | ${"Europe/Istanbul"}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}        | ${"Asia/Kolkata"}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}      | ${"Asia/Kathmandu"}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}       | ${"Asia/Shanghai"}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"} | ${"Australia/Lord_Howe"}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}     | ${"Pacific/Chatham"}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}        | ${"Pacific/Apia"}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}        | ${"Pacific/Niue"}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}    | ${"America/New_York"}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}     | ${"America/Chicago"}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}     | ${"America/Phoenix"}
  `(
    "returns timeZone name $expected for battle-test $value (2024-02-29T00:00:00Z)",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopZonedDateTime(value)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"2024-02-29"}
    ${"12:30:45"}
    ${"2024-02-29T12:30:45"}
    ${"2024-02-29T12:30:45Z"}
    ${"not-a-datetime"}
    ${""}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
  `("returns empty string for $invalidValue", ({ invalidValue }) => {
    expect(chopZonedDateTime(invalidValue)).toBe("");
  });

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns matching timeZone for battle-test timeZone ${timeZone}`, () => {
      expect(chopZonedDateTime(value)).toBe(timeZone);
    });
  }

  for (const { timeZone, value } of unixEpochBattleCases) {
    it(`returns matching timeZone for historical battle-test timeZone ${timeZone}`, () => {
      expect(chopZonedDateTime(value)).toBe(timeZone);
    });
  }
});

describe("chopZonedDateTime edge cases", () => {
  it.each`
    value
    ${"2024-02-29T12:30:45Z[UTC]"}
  `(
    "returns a non-empty string for edge case zoned datetime $value",
    ({ value }) => {
      expect(chopZonedDateTime(value)).not.toBe("");
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns valid timeZone id for battle-test timeZone ${timeZone}`, () => {
      const result = chopZonedDateTime(value);
      expect(isValidTimeZone(result)).toBe(true);
    });
  }

  for (const { timeZone, value } of unixEpochBattleCases) {
    it(`returns valid timeZone id for historical battle-test timeZone ${timeZone}`, () => {
      const result = chopZonedDateTime(value);
      expect(isValidTimeZone(result)).toBe(true);
    });
  }
});
