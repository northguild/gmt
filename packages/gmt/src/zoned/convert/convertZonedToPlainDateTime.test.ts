import { convertZonedToPlainDateTime } from "./convertZonedToPlainDateTime";

describe("convertZonedToPlainDateTime", () => {
  it.each`
    value                                                | expected
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"2024-02-29T14:30:45.123"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}                  | ${"2024-02-29T14:30:45"}
    ${"2024-02-29T14:30:45+13:00[Pacific/Apia]"}         | ${"2024-02-29T14:30:45"}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}        | ${"2024-02-29T01:00:00"}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}         | ${"2024-02-29T05:30:00"}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}       | ${"2024-02-29T05:45:00"}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}        | ${"2024-02-29T08:00:00"}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"}  | ${"2024-02-29T11:00:00"}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}      | ${"2024-02-29T13:45:00"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(convertZonedToPlainDateTime(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"2024-02-29T14:30:45"}
  `("returns empty string for invalid $invalidValue", ({ invalidValue }) => {
    expect(convertZonedToPlainDateTime(invalidValue as never)).toBe("");
  });

  it("returns empty string for leap second", () => {
    expect(convertZonedToPlainDateTime("2024-02-29T23:59:60+00:00[UTC]")).toBe(
      "",
    );
  });
});
