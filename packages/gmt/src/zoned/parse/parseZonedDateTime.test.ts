import { parseZonedDateTime } from "./parseZonedDateTime";

describe("parseZonedDateTime", () => {
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
    "parses valid zoned date time string $value returning $expected",
    ({ value, expected }) => {
      expect(parseZonedDateTime(value)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"not-a-zoned-datetime"}
    ${"2024-02-29T09:00:00+00:00"}
    ${""}
    ${null}
    ${undefined}
    ${true}
    ${false}
  `(
    "returns an empty string for invalid zoned date time string $invalidValue",
    ({ invalidValue }) => {
      expect(parseZonedDateTime(invalidValue as never)).toBe("");
    },
  );

  it("returns an empty string for a leap second zoned date time string", () => {
    expect(parseZonedDateTime("2024-06-30T23:59:60+00:00[UTC]")).toBe("");
  });
});
