import { isValidInt64NanosecondDateTime } from "./isValidInt64NanosecondDateTime";

describe("isValidInt64NanosecondDateTime", () => {
  it.each`
    value                                          | expected
    ${"1677-09-21T00:12:43.145224192"}             | ${true}
    ${"1677-09-21T00:12:43.145224191"}             | ${false}
    ${"2262-04-11T23:47:16.854775807"}             | ${true}
    ${"2262-04-11T23:47:16.854775808"}             | ${false}
    ${"1970-01-01T00:00:00"}                       | ${true}
    ${"2024-01-01T00:00:00[Asia/Tokyo]"}           | ${true}
    ${"+010000-01-01T00:00:00"}                    | ${false}
    ${"+275760-09-13T00:00:00"}                    | ${false}
    ${"2024-01-01T00:00:00Z"}                      | ${false}
    ${"2024-01-01T00:00:00+01:00"}                 | ${false}
    ${"2024-01-01T09:00:00+09:00[Asia/Tokyo]"}     | ${false}
    ${"2262-04-11T23:47:16.854775807Z"}            | ${false}
    ${"2262-04-11T23:47:16.854775807[Asia/Tokyo]"} | ${true}
    ${"2262-04-11T23:47:16.854775808[Asia/Tokyo]"} | ${false}
    ${"-271821-04-20T00:00:00"}                    | ${false}
    ${"2024-01-01"}                                | ${false}
    ${"2024-01-01T23:59:60"}                       | ${false}
    ${"invalid"}                                   | ${false}
    ${""}                                          | ${false}
    ${42}                                          | ${false}
    ${null}                                        | ${false}
    ${undefined}                                   | ${false}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(isValidInt64NanosecondDateTime(value)).toBe(expected);
  });
});
