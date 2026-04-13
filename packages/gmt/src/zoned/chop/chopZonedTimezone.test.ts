import { isValidDateTime } from "../../plain/validate/isValidDateTime";
import { sameInstantBattleCases } from "../../test";
import { chopZonedTimezone } from "./chopZonedTimezone";

describe("chopZonedTimezone", () => {
  it.each`
    value                                            | expected
    ${"2024-02-29T12:30:45+01:00[Europe/Paris]"}     | ${"2024-02-29T12:30:45"}
    ${"2024-02-29T12:30:45.123+01:00[Europe/Paris]"} | ${"2024-02-29T12:30:45.123"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}              | ${"2024-02-29T14:30:45"}
    ${"2024-02-29T09:30:45+02:00[Europe/Helsinki]"}  | ${"2024-02-29T09:30:45"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}              | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T23:59:59.999+00:00[UTC]"}          | ${"2024-02-29T23:59:59.999"}
    ${"2024-02-29T12:30+01:00[Europe/Paris]"}        | ${"2024-02-29T12:30:00"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopZonedTimezone(value)).toBe(expected);
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00+00:00[GMT]"}                 | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}             | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}       | ${"2024-02-29T01:00:00"}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}     | ${"2024-02-29T02:00:00"}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}     | ${"2024-02-29T03:00:00"}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}        | ${"2024-02-29T05:30:00"}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}      | ${"2024-02-29T05:45:00"}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}       | ${"2024-02-29T08:00:00"}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-02-29T11:00:00"}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}     | ${"2024-02-29T13:45:00"}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}        | ${"2024-02-29T13:00:00"}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}        | ${"2024-02-28T13:00:00"}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}    | ${"2024-02-28T19:00:00"}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}     | ${"2024-02-28T18:00:00"}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}     | ${"2024-02-28T17:00:00"}
  `(
    "returns local plain datetime $expected for battle-test timeZone $value (2024-02-29T00:00:00Z)",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopZonedTimezone(value)).toBe(expected);
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
    expect(chopZonedTimezone(invalidValue)).toBe("");
  });

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns a valid plain datetime for battle-test timeZone ${timeZone}`, () => {
      const result = chopZonedTimezone(value);
      expect(isValidDateTime(result)).toBe(true);
    });
  }
});
