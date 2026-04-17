import { localNoonBattleCases } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseDateFromZoned } from "./parseDateFromZoned";

describe("parseDateFromZoned", () => {
  it.each`
    value                                                | expected
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"2024-02-29"}
  `("returns the plain date portion for $value", ({ value, expected }) => {
    expect(parseDateFromZoned(value)).toBe(expected);
  });

  it.each`
    value                                            | expected
    ${"2024-03-10T00:30:00-05:00[America/New_York]"} | ${"2024-03-10"}
  `("returns edge case date portion for $value", ({ value, expected }) => {
    expect(parseDateFromZoned(value)).toBe(expected);
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
      expect(parseDateFromZoned(invalidValue as never)).toBe("");
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T12:00:00+00:00[UTC]"}                 | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+00:00[GMT]"}                 | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+00:00[Etc/GMT]"}             | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+00:00[Europe/Lisbon]"}       | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+00:00[Europe/Dublin]"}       | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}       | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+02:00[Europe/Helsinki]"}     | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+03:00[Europe/Istanbul]"}     | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+05:30[Asia/Kolkata]"}        | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+05:45[Asia/Kathmandu]"}      | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+08:00[Asia/Shanghai]"}       | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+13:45[Pacific/Chatham]"}     | ${"2024-02-29"}
    ${"2024-02-29T12:00:00+13:00[Pacific/Apia]"}        | ${"2024-02-29"}
    ${"2024-02-29T12:00:00-11:00[Pacific/Niue]"}        | ${"2024-02-29"}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"}    | ${"2024-02-29"}
    ${"2024-02-29T12:00:00-06:00[America/Chicago]"}     | ${"2024-02-29"}
    ${"2024-02-29T12:00:00-07:00[America/Phoenix]"}     | ${"2024-02-29"}
  `(
    "returns local date $expected for local-noon battle-test $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseDateFromZoned(value)).toBe(expected);
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns the local date for battle-test timeZone ${timeZone}`, () => {
      expect(parseDateFromZoned(value)).toBe("2024-02-29");
    });
  }

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseDateFromZoned(
      "2024-02-29T14:30:45.123-05:00[America/New_York]",
    );
    expect(result).toBe("");
  });
});
