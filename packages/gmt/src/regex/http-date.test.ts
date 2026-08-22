import { httpDate } from "./http-date";

describe("regex/http-date", () => {
  it.each`
    value                                | expected
    ${"Fri, 15 Mar 2024 14:30:00 GMT"}   | ${true}
    ${"Fri, 05 Jan 2024 09:00:00 GMT"}   | ${true}
    ${"5 Jan 2024 09:00:00 GMT"}         | ${false}
    ${"Fri, 5 Jan 2024 09:00:00 GMT"}    | ${false}
    ${"Fri, 15 Mar 2024 14:30:00 -0400"} | ${false}
    ${"Fri, 15 Mar 2024 14:30:00 UT"}    | ${false}
    ${"Friday, 15-Mar-24 14:30:00 GMT"}  | ${false}
    ${"Fri Mar 15 14:30:00 2024"}        | ${false}
    ${"Fri, 15 Mar 24 14:30:00 GMT"}     | ${false}
    ${"Fri, 15 Mar 2024 14:30 GMT"}      | ${false}
    ${"not a date"}                      | ${false}
    ${""}                                | ${false}
  `(
    "httpDate pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(httpDate.test(value)).toBe(expected);
    },
  );
});
